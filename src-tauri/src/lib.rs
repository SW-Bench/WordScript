use std::{sync::Mutex, time::Duration};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::utils::config::Color;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Runtime};

mod core;
mod v1_slice;

use crate::core::capture::{NativeCaptureConfig, NativeCaptureState};
use crate::core::config::AppConfig;
use crate::core::insertion::{NativeInsertionConfig, NativeInsertionState};
use crate::core::providers::TranscribeAudioFileRequest;
use crate::core::sessions::NativeSessionState;
use crate::core::trigger::{NativeTriggerConfig, NativeTriggerState, TriggerEffect};
use crate::v1_slice::V1SliceState;

const OVERLAY_WINDOW_WIDTH: f64 = 236.0;
const OVERLAY_WINDOW_HEIGHT: f64 = 44.0;
const OVERLAY_BOTTOM_INSET: f64 = 76.0;
const MIN_TRANSCRIPTION_TIMEOUT_MS: u64 = 18_000;
const MAX_TRANSCRIPTION_TIMEOUT_MS: u64 = 35_000;
const TRANSCRIPTION_TIMEOUT_PER_AUDIO_SECOND_MS: u64 = 800;

fn reveal_overlay_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("overlay") {
        let _ = window.set_size(LogicalSize::new(
            OVERLAY_WINDOW_WIDTH,
            OVERLAY_WINDOW_HEIGHT,
        ));
        let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
        if let Some(position) = overlay_bottom_center_position(&window) {
            let _ = window.set_position(position);
        }
        let _ = window.show();
    }
}

fn overlay_bottom_center_position<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
) -> Option<LogicalPosition<f64>> {
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten())?;
    let scale = monitor.scale_factor().max(1.0);
    let work_area = monitor.work_area();
    let work_x = work_area.position.x as f64 / scale;
    let work_y = work_area.position.y as f64 / scale;
    let work_width = work_area.size.width as f64 / scale;
    let work_height = work_area.size.height as f64 / scale;
    let x = work_x + ((work_width - OVERLAY_WINDOW_WIDTH) / 2.0).max(0.0);
    let y = work_y + (work_height - OVERLAY_WINDOW_HEIGHT - OVERLAY_BOTTOM_INSET).max(0.0);

    Some(LogicalPosition::new(x.round(), y.round()))
}

fn reveal_settings_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn reveal_rebuild_lab_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("rebuild-lab") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn install_hide_on_close<R: Runtime>(window: &tauri::WebviewWindow<R>) {
    let window_clone = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = window_clone.hide();
        }
    });
}

fn apply_trigger_effect<R: Runtime>(app: &AppHandle<R>, effect: TriggerEffect) {
    match effect {
        TriggerEffect::StartCapture => match core::capture::start_native_capture(app) {
            Ok(status) => {
                reveal_overlay_window(app);
                core::sound::play_if_enabled(core::sound::SoundCue::Start);
                if let Some(capture_id) = status.active_capture_id {
                    spawn_native_capture_monitor(app.clone(), capture_id);
                }
            }
            Err(error) => {
                core::sound::play_if_enabled(core::sound::SoundCue::Error);
                core::sessions::fail_from_native_error(app, &error);
                let _ = app.emit(
                    "wordscript-event",
                    serde_json::json!({
                        "event": "error",
                        "message": error
                    }),
                );
            }
        },
        TriggerEffect::StopCapture { session_id } => finalize_native_capture_stop(app, session_id),
        TriggerEffect::TogglePause => {
            if let Err(error) = core::capture::toggle_native_capture_pause_for_app(app) {
                if error != "No native capture is active." {
                    core::sound::play_if_enabled(core::sound::SoundCue::Error);
                    core::sessions::fail_from_native_error(app, &error);
                    let _ = app.emit(
                        "wordscript-event",
                        serde_json::json!({
                            "event": "error",
                            "message": error
                        }),
                    );
                }
            }
        }
        TriggerEffect::AbortCapture => {
            core::sound::play_if_enabled(core::sound::SoundCue::Abort);
            if let Err(error) = core::capture::abort_native_capture(app) {
                core::sound::play_if_enabled(core::sound::SoundCue::Error);
                core::sessions::fail_from_native_error(app, &error);
                let _ = app.emit(
                    "wordscript-event",
                    serde_json::json!({
                        "event": "error",
                        "message": error
                    }),
                );
            }
        }
        TriggerEffect::DeferredStop {
            hold_session,
            delay_ms,
        } => {
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_millis(delay_ms)).await;
                if let Some(effect) = core::trigger::resolve_deferred_hold_stop(&app, hold_session)
                {
                    apply_trigger_effect(&app, effect);
                }
            });
        }
    }
}

fn finalize_native_capture_stop<R: Runtime + 'static>(app: &AppHandle<R>, session_id: String) {
    core::sound::play_if_enabled(core::sound::SoundCue::Stop);
    match core::capture::stop_native_capture(app) {
        Ok(Some(value)) => handle_audio_ready(app.clone(), value, session_id),
        Ok(None) => {
            match core::sessions::empty_processing_session_from_native(
                app,
                &session_id,
                "No speech detected in recording.",
            ) {
                Ok(true) => {
                    let _ = app.emit("wordscript-event", serde_json::json!({ "event": "empty" }));
                }
                Ok(false) => log_stale_pipeline_result(app, &session_id, "empty_capture"),
                Err(error) => {
                    core::sessions::fail_from_native_error(app, &error);
                    let _ = app.emit(
                        "wordscript-event",
                        serde_json::json!({
                            "event": "error",
                            "message": error
                        }),
                    );
                }
            }
        }
        Err(error) => {
            core::sound::play_if_enabled(core::sound::SoundCue::Error);
            match core::sessions::fail_processing_session_from_native_error(
                app,
                &session_id,
                &error,
            ) {
                Ok(true) => {
                    let _ = app.emit(
                        "wordscript-event",
                        serde_json::json!({
                            "event": "error",
                            "message": error
                        }),
                    );
                }
                Ok(false) => log_stale_pipeline_result(app, &session_id, "capture_stop_error"),
                Err(gate_error) => {
                    core::sessions::fail_from_native_error(app, &gate_error);
                    let _ = app.emit(
                        "wordscript-event",
                        serde_json::json!({
                            "event": "error",
                            "message": gate_error
                        }),
                    );
                }
            }
        }
    }
}

fn spawn_native_capture_monitor<R: Runtime + 'static>(app: AppHandle<R>, capture_id: String) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_millis(200)).await;

            match core::capture::monitor_native_capture(&app, &capture_id) {
                Ok(core::capture::NativeCaptureMonitorState::Continue) => continue,
                Ok(core::capture::NativeCaptureMonitorState::Finished) => return,
                Ok(core::capture::NativeCaptureMonitorState::Stop(reason)) => {
                    let status = match core::sessions::processing_from_native(&app) {
                        Ok(status) => status,
                        Err(error) => {
                            core::runtime_log::record(format!(
                                "[WordScript] Could not move native capture to processing during autostop: {error}"
                            ));
                            return;
                        }
                    };
                    let Some(session_id) = status.active_session_id else {
                        core::runtime_log::record(
                            "[WordScript] Autostop entered processing without an active session id"
                                .to_string(),
                        );
                        return;
                    };
                    let _ = app.emit(
                        "wordscript-event",
                        serde_json::json!({
                            "event": "recording_stopped",
                            "reason": reason.message(),
                        }),
                    );
                    finalize_native_capture_stop(&app, session_id);
                    return;
                }
                Err(error) => {
                    core::sound::play_if_enabled(core::sound::SoundCue::Error);
                    core::sessions::fail_from_native_error(&app, &error);
                    let _ = app.emit(
                        "wordscript-event",
                        serde_json::json!({
                            "event": "error",
                            "message": error
                        }),
                    );
                    return;
                }
            }
        }
    });
}

fn handle_audio_ready<R: Runtime + 'static>(
    app: AppHandle<R>,
    value: serde_json::Value,
    session_id: String,
) {
    let pipeline_started_at = std::time::Instant::now();
    let audio_path = match value.get("audio_path").and_then(|path| path.as_str()) {
        Some(path) if !path.trim().is_empty() => path.trim().to_string(),
        _ => {
            let message = "Capture pipeline did not provide an audio path.";
            match core::sessions::fail_processing_session_from_native_error(
                &app,
                &session_id,
                message,
            ) {
                Ok(true) => {
                    let _ = app.emit(
                        "wordscript-event",
                        serde_json::json!({
                            "event": "error",
                            "message": message
                        }),
                    );
                }
                Ok(false) => log_stale_pipeline_result(&app, &session_id, "missing_audio_path"),
                Err(error) => {
                    core::sessions::fail_from_native_error(&app, &error);
                    let _ = app.emit(
                        "wordscript-event",
                        serde_json::json!({
                            "event": "error",
                            "message": error
                        }),
                    );
                }
            }
            return;
        }
    };

    let provider = value
        .get("provider")
        .and_then(|provider| provider.as_str())
        .unwrap_or(core::providers::default_provider_id())
        .trim()
        .to_string();

    let request = TranscribeAudioFileRequest {
        provider: provider.clone(),
        audio_path: audio_path.clone(),
        model: optional_string(&value, "model"),
        language: optional_string(&value, "language"),
        prompt: optional_string(&value, "prompt"),
        response_format: Some("json".to_string()),
        timeout_ms: Some(runtime_transcription_timeout_ms(
            value
                .get("audio_duration_seconds")
                .and_then(|duration| duration.as_f64()),
        )),
        max_retries: Some(0),
    };
    let transcription_timeout_ms = request.timeout_ms.unwrap_or(MIN_TRANSCRIPTION_TIMEOUT_MS);
    let requested_model = request.model.clone();
    let requested_language = request.language.clone();
    let transform_config = core::transform::NativeTransformConfig::from_payload(&value);
    let audio_duration_seconds = value
        .get("audio_duration_seconds")
        .and_then(|duration| duration.as_f64());

    core::runtime_log::record(format!(
        "[WordScript] Native pipeline start session_id={} audio_path={} audio_duration_seconds={:?} transcription_timeout_ms={} post_process={}",
        session_id,
        audio_path,
        audio_duration_seconds,
        transcription_timeout_ms,
        transform_config.post_process,
    ));

    tauri::async_runtime::spawn(async move {
        let cleanup_path = audio_path.clone();
        if !processing_session_still_current(&app, &session_id, "pipeline_start") {
            let _ = tokio::fs::remove_file(cleanup_path).await;
            return;
        }

        let pipeline_app_config = core::config::AppConfig::load_from_disk();
        let transcription = core::providers::transcribe_audio_file(request).await;

        match transcription {
            Ok(response) => {
                if !processing_session_still_current(&app, &session_id, "transcription_ready") {
                    let _ = tokio::fs::remove_file(cleanup_path).await;
                    return;
                }

                core::runtime_log::record(format!(
                    "[WordScript] Native pipeline transcription ready elapsed_ms={} text_len={} provider_duration={:?}",
                    pipeline_started_at.elapsed().as_millis(),
                    response.text.len(),
                    response.duration,
                ));
                let transformed =
                    core::transform::apply_native_transform(&response.text, transform_config).await;
                let app_config = pipeline_app_config.clone();
                if let Some(warning) = &transformed.warning {
                    core::runtime_log::record(format!(
                        "[WordScript] Native transform warning: {warning}"
                    ));
                }

                core::runtime_log::record(format!(
                    "[WordScript] Native pipeline transform done elapsed_ms={} corrected={} output_len={} rules={}",
                    pipeline_started_at.elapsed().as_millis(),
                    transformed.corrected,
                    transformed.text.len(),
                    transformed.applied_rules.join(","),
                ));

                if !processing_session_still_current(&app, &session_id, "transform_done") {
                    let _ = tokio::fs::remove_file(cleanup_path).await;
                    return;
                }

                let text = transformed.text.trim().to_string();
                if text.is_empty() {
                    let _ = core::history::record_empty_result(
                        &app_config,
                        response.text.clone(),
                        transformed,
                    );
                    core::runtime_log::record(format!(
                        "[WordScript] Native pipeline empty result elapsed_ms={}",
                        pipeline_started_at.elapsed().as_millis(),
                    ));
                    match core::sessions::empty_processing_session_from_native(
                        &app,
                        &session_id,
                        "No speech detected in recording.",
                    ) {
                        Ok(true) => {
                            let _ = app
                                .emit("wordscript-event", serde_json::json!({ "event": "empty" }));
                        }
                        Ok(false) => {
                            log_stale_pipeline_result(&app, &session_id, "empty_transform")
                        }
                        Err(error) => {
                            core::sessions::fail_from_native_error(&app, &error);
                            let _ = app.emit(
                                "wordscript-event",
                                serde_json::json!({
                                    "event": "error",
                                    "message": error
                                }),
                            );
                        }
                    }
                } else {
                    if !processing_session_still_current(&app, &session_id, "before_insertion") {
                        let _ = tokio::fs::remove_file(cleanup_path).await;
                        return;
                    }

                    match core::insertion::insert_transcription_from_legacy(
                        &app,
                        &text,
                        transformed.corrected,
                    ) {
                        Ok(result) if result.ok => {
                            if !processing_session_still_current(&app, &session_id, "insertion_ok")
                            {
                                let _ = tokio::fs::remove_file(cleanup_path).await;
                                return;
                            }

                            let _ = core::history::history_entry_from_insert_result(
                                &app_config,
                                None,
                                Some(response.text.clone()),
                                transformed.clone(),
                                &result,
                            );
                            let completion_applied =
                                core::sessions::complete_processing_session_from_transcription(
                                    &app,
                                    &session_id,
                                    &text,
                                    transformed.corrected,
                                );
                            match completion_applied {
                                Ok(true) => {
                                    core::runtime_log::record(format!(
                                        "[WordScript] Native pipeline insertion done session_id={} elapsed_ms={} insert_mode={:?} pasted={} fallback_available={}",
                                        session_id,
                                        pipeline_started_at.elapsed().as_millis(),
                                        result.insert_mode,
                                        result.pasted,
                                        result.fallback_available,
                                    ));
                                    let _ = app.emit(
                                        "wordscript-event",
                                        serde_json::json!({
                                            "event": "transcription",
                                            "text": text,
                                            "corrected": transformed.corrected,
                                            "provider": provider,
                                            "transform": {
                                                "applied_rules": transformed.applied_rules,
                                                "warning": transformed.warning,
                                            },
                                            "insertion": result
                                        }),
                                    );
                                }
                                Ok(false) => {
                                    log_stale_pipeline_result(&app, &session_id, "completion")
                                }
                                Err(error) => {
                                    core::sessions::fail_from_native_error(&app, &error);
                                    let _ = app.emit(
                                        "wordscript-event",
                                        serde_json::json!({
                                            "event": "error",
                                            "message": error
                                        }),
                                    );
                                }
                            }
                        }
                        Ok(result) => {
                            if !processing_session_still_current(
                                &app,
                                &session_id,
                                "insertion_failed",
                            ) {
                                let _ = tokio::fs::remove_file(cleanup_path).await;
                                return;
                            }

                            let _ = core::history::history_entry_from_insert_result(
                                &app_config,
                                None,
                                Some(response.text.clone()),
                                transformed.clone(),
                                &result,
                            );
                            let error = result
                                .error
                                .clone()
                                .unwrap_or_else(|| "Native insertion failed.".to_string());
                            core::runtime_log::record(format!(
                                "[WordScript] Native pipeline insertion reported failure session_id={} elapsed_ms={} insert_mode={:?} pasted={} fallback_available={} error={}",
                                session_id,
                                pipeline_started_at.elapsed().as_millis(),
                                result.insert_mode,
                                result.pasted,
                                result.fallback_available,
                                error,
                            ));
                            match core::sessions::fail_processing_session_from_native_error(
                                &app,
                                &session_id,
                                &error,
                            ) {
                                Ok(true) => {
                                    let _ = app.emit(
                                        "wordscript-event",
                                        serde_json::json!({
                                            "event": "error",
                                            "message": format!("Native insertion failed: {error}"),
                                            "provider": provider,
                                            "transform": {
                                                "applied_rules": transformed.applied_rules,
                                                "warning": transformed.warning,
                                            },
                                            "insertion": result
                                        }),
                                    );
                                }
                                Ok(false) => log_stale_pipeline_result(
                                    &app,
                                    &session_id,
                                    "insertion_failure",
                                ),
                                Err(gate_error) => {
                                    core::sessions::fail_from_native_error(&app, &gate_error);
                                    let _ = app.emit(
                                        "wordscript-event",
                                        serde_json::json!({
                                            "event": "error",
                                            "message": gate_error
                                        }),
                                    );
                                }
                            }
                        }
                        Err(error) => {
                            if !processing_session_still_current(
                                &app,
                                &session_id,
                                "insertion_error",
                            ) {
                                let _ = tokio::fs::remove_file(cleanup_path).await;
                                return;
                            }

                            let _ = core::history::record_entry(
                                core::history::RecordHistoryEntryRequest {
                                    status: core::history::TranscriptionHistoryStatus::Failed,
                                    source:
                                        core::history::TranscriptionHistorySource::NativePipeline,
                                    retry_of: None,
                                    provider: app_config.provider.clone(),
                                    model: Some(
                                        if app_config.provider
                                            == core::providers::LOCAL_PREVIEW_PROVIDER_ID
                                        {
                                            app_config.local_model.clone()
                                        } else {
                                            app_config.model.clone()
                                        },
                                    ),
                                    language: if app_config.language.trim().is_empty() {
                                        None
                                    } else {
                                        Some(app_config.language.clone())
                                    },
                                    active_profile: app_config.active_text_profile_label(),
                                    raw_transcript: Some(response.text.clone()),
                                    transformed_transcript: Some(text.clone()),
                                    corrected: transformed.corrected,
                                    applied_rules: transformed.applied_rules.clone(),
                                    transform_warning: transformed.warning.clone(),
                                    insert_mode: None,
                                    active_driver: None,
                                    pasted: None,
                                    fallback_available: None,
                                    fallback_reason: None,
                                    error: Some(error.clone()),
                                },
                            );
                            core::runtime_log::record(format!(
                                "[WordScript] Native pipeline insertion failed session_id={} elapsed_ms={} error={}",
                                session_id,
                                pipeline_started_at.elapsed().as_millis(),
                                error,
                            ));
                            match core::sessions::fail_processing_session_from_native_error(
                                &app,
                                &session_id,
                                &error,
                            ) {
                                Ok(true) => {
                                    let _ = app.emit(
                                        "wordscript-event",
                                        serde_json::json!({
                                            "event": "error",
                                            "message": format!("Native insertion failed: {error}")
                                        }),
                                    );
                                }
                                Ok(false) => {
                                    log_stale_pipeline_result(&app, &session_id, "insert_error")
                                }
                                Err(gate_error) => {
                                    core::sessions::fail_from_native_error(&app, &gate_error);
                                    let _ = app.emit(
                                        "wordscript-event",
                                        serde_json::json!({
                                            "event": "error",
                                            "message": gate_error
                                        }),
                                    );
                                }
                            }
                        }
                    }
                }
            }
            Err(error) => {
                if !processing_session_still_current(&app, &session_id, "transcription_error") {
                    let _ = tokio::fs::remove_file(cleanup_path).await;
                    return;
                }

                let _ = core::history::record_transcription_failure(
                    &pipeline_app_config,
                    &provider,
                    requested_model.clone(),
                    requested_language.clone(),
                    error.message.clone(),
                );
                core::runtime_log::record(format!(
                    "[WordScript] Native pipeline transcription failed session_id={} elapsed_ms={} kind={:?} message={}",
                    session_id,
                    pipeline_started_at.elapsed().as_millis(),
                    error.kind,
                    error.message,
                ));
                core::sound::play_if_enabled(core::sound::SoundCue::Error);
                match core::sessions::fail_processing_session_from_native_error(
                    &app,
                    &session_id,
                    &error.message,
                ) {
                    Ok(true) => {
                        let _ = app.emit(
                            "wordscript-event",
                            serde_json::json!({
                                "event": "error",
                                "message": error.message,
                                "kind": error.kind,
                                "status": error.status,
                                "retry_after_seconds": error.retry_after_seconds
                            }),
                        );
                    }
                    Ok(false) => {
                        log_stale_pipeline_result(&app, &session_id, "transcription_failure")
                    }
                    Err(gate_error) => {
                        core::sessions::fail_from_native_error(&app, &gate_error);
                        let _ = app.emit(
                            "wordscript-event",
                            serde_json::json!({
                                "event": "error",
                                "message": gate_error
                            }),
                        );
                    }
                }
            }
        }

        let _ = tokio::fs::remove_file(cleanup_path).await;
    });
}

fn processing_session_still_current<R: Runtime>(
    app: &AppHandle<R>,
    session_id: &str,
    checkpoint: &str,
) -> bool {
    if core::sessions::is_processing_session_current(app, session_id) {
        return true;
    }

    log_stale_pipeline_result(app, session_id, checkpoint);
    false
}

fn log_stale_pipeline_result<R: Runtime>(app: &AppHandle<R>, session_id: &str, checkpoint: &str) {
    let current_session =
        core::sessions::current_processing_session_id(app).unwrap_or_else(|| "none".to_string());
    core::runtime_log::record(format!(
        "[WordScript] Ignored stale native pipeline result session_id={} current_processing_session={} checkpoint={}",
        session_id, current_session, checkpoint,
    ));
}

fn optional_string(value: &serde_json::Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn runtime_transcription_timeout_ms(audio_duration_seconds: Option<f64>) -> u64 {
    let audio_duration_ms = audio_duration_seconds
        .filter(|duration| duration.is_finite() && *duration > 0.0)
        .map(|duration| {
            let clamped = duration.min(60.0);
            (clamped * 1000.0).round() as u64
        })
        .unwrap_or_default();

    MIN_TRANSCRIPTION_TIMEOUT_MS
        .saturating_add(
            audio_duration_ms.saturating_mul(TRANSCRIPTION_TIMEOUT_PER_AUDIO_SECOND_MS) / 1000,
        )
        .clamp(MIN_TRANSCRIPTION_TIMEOUT_MS, MAX_TRANSCRIPTION_TIMEOUT_MS)
}

// ── Tauri Commands (callable from React via invoke()) ─────────────────────────

/// Show (and focus) the settings window.
#[tauri::command]
async fn open_settings_window(app: AppHandle) -> Result<(), String> {
    reveal_settings_window(&app);
    Ok(())
}

#[tauri::command]
async fn open_rebuild_lab_window(app: AppHandle) -> Result<(), String> {
    if app.get_webview_window("rebuild-lab").is_none() {
        return Err("Diagnostics window is not configured.".to_string());
    }

    reveal_rebuild_lab_window(&app);
    Ok(())
}

#[tauri::command]
async fn app_config_file_path() -> Result<String, String> {
    Ok(core::paths::config_file_path()
        .to_string_lossy()
        .to_string())
}

// ── App entry ─────────────────────────────────────────────────────────────────

pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(not(debug_assertions))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        reveal_settings_window(app);
    }));
    #[cfg(debug_assertions)]
    let builder = builder;

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if let Some(effect) =
                        core::trigger::handle_global_shortcut_event(app, shortcut, event)
                    {
                        apply_trigger_effect(app, effect);
                    }
                })
                .build(),
        )
        .manage(Mutex::new(V1SliceState::default()))
        .manage(Mutex::new(NativeSessionState::default()))
        .manage(Mutex::new(NativeTriggerState::new(
            NativeTriggerConfig::load_from_disk(),
        )))
        .manage(Mutex::new(NativeCaptureState::load(
            NativeCaptureConfig::load_from_disk(),
        )))
        .manage(Mutex::new(NativeInsertionState::load(
            NativeInsertionConfig::load_from_disk(),
        )))
        .setup(|app| {
            // ── System tray ───────────────────────────────────────────────
            let title = MenuItem::with_id(app, "title", "WordScript", false, None::<&str>)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let diagnostics =
                MenuItem::with_id(app, "diagnostics", "Diagnostics", true, None::<&str>)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu =
                Menu::with_items(app, &[&title, &sep1, &settings, &diagnostics, &sep2, &quit])?;

            let tray_icon = app.default_window_icon().cloned().expect(
                "No default window icon configured — add an icon to tauri.conf.json bundle.icon",
            );
            TrayIconBuilder::new()
                .icon(tray_icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "settings" => {
                        reveal_settings_window(app);
                    }
                    "diagnostics" => {
                        reveal_rebuild_lab_window(app);
                    }
                    _ => {}
                })
                .build(app)?;

            // ── Settings window: minimize on close instead of destroy ────
            if let Some(settings) = app.get_webview_window("settings") {
                install_hide_on_close(&settings);
            }

            if let Some(rebuild_lab) = app.get_webview_window("rebuild-lab") {
                install_hide_on_close(&rebuild_lab);
            }

            let initial_config = AppConfig::load_from_disk();
            core::config::emit_ready_event(app.handle(), &initial_config);
            core::sound::schedule_startup_if_enabled();

            let trigger_state = app.state::<Mutex<NativeTriggerState>>();
            if let Err(error) = core::trigger::register_native_shortcuts(
                app.handle(),
                trigger_state.inner(),
                NativeTriggerConfig::load_from_disk(),
            ) {
                core::runtime_log::record(format!(
                    "[WordScript] Failed to register native shortcut: {error}"
                ));
                let _ = app.emit(
                    "wordscript-native-event",
                    serde_json::json!({
                        "event": "error",
                        "message": format!("Native shortcut registration failed: {error}")
                    }),
                );
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            core::config::load_app_config,
            core::config::save_config,
            open_settings_window,
            open_rebuild_lab_window,
            app_config_file_path,
            core::providers::provider_status,
            core::providers::save_provider_api_key,
            core::providers::clear_provider_api_key,
            core::providers::validate_provider_api_key,
            core::providers::transcribe_audio_file,
            core::text_rules::analyze_text_rules,
            core::text_rules::export_text_rules,
            core::text_rules::import_text_rules,
            core::sessions::native_session_status,
            core::sessions::start_native_session,
            core::sessions::stop_native_session,
            core::sessions::abort_native_session,
            core::sessions::complete_native_session,
            core::trigger::native_trigger_status,
            core::trigger::configure_native_trigger,
            core::trigger::pause_native_trigger,
            core::trigger::resume_native_trigger,
            core::capture::native_capture_status,
            core::capture::configure_native_capture,
            core::capture::list_native_input_devices,
            core::capture::toggle_native_capture_mute,
            core::capture::toggle_native_capture_pause,
            core::insertion::native_insertion_status,
            core::insertion::configure_native_insertion,
            core::insertion::insert_text_native,
            core::insertion::restore_last_transcript,
            core::insertion::clear_native_scratchpad,
            core::history::transcription_history_entries,
            core::history::transcription_history_storage_status,
            core::history::export_transcription_history,
            core::history::clear_transcription_history_entries,
            core::history::delete_transcription_history_entry,
            core::history::retry_transcription_history_entry,
            core::updates::check_app_update,
            core::runtime_log::runtime_log_entries,
            core::runtime_log::clear_runtime_log_entries,
            v1_slice::v1_slice_status,
            v1_slice::start_v1_slice_capture,
            v1_slice::complete_v1_slice_capture,
            v1_slice::reset_v1_slice,
        ])
        .run(tauri::generate_context!())
        .expect("error while running WordScript");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runtime_transcription_timeout_stays_interactive() {
        assert_eq!(
            runtime_transcription_timeout_ms(None),
            MIN_TRANSCRIPTION_TIMEOUT_MS
        );
        assert_eq!(runtime_transcription_timeout_ms(Some(3.0)), 20_400);
        assert_eq!(
            runtime_transcription_timeout_ms(Some(30.0)),
            MAX_TRANSCRIPTION_TIMEOUT_MS
        );
        assert_eq!(
            runtime_transcription_timeout_ms(Some(90.0)),
            MAX_TRANSCRIPTION_TIMEOUT_MS
        );
    }
}
