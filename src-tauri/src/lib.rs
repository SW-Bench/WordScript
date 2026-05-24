use std::{sync::Mutex, time::Duration};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::utils::config::Color;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Runtime};

mod core;
mod v1_slice;

use crate::core::capture::{NativeCaptureConfig, NativeCaptureState};
use crate::core::config::{AppConfig, OverlayAnchor, OverlayPositionMode};
use crate::core::insertion::{NativeInsertionConfig, NativeInsertionState};
use crate::core::providers::TranscribeAudioFileRequest;
use crate::core::sessions::NativeSessionState;
use crate::core::trigger::{NativeTriggerConfig, NativeTriggerState, TriggerEffect};
use crate::v1_slice::V1SliceState;

const OVERLAY_COMPACT_WINDOW_WIDTH: f64 = 256.0;
const OVERLAY_PROCESSING_PREVIEW_WINDOW_WIDTH: f64 = 300.0;
const OVERLAY_RESULT_ACTIONS_WINDOW_WIDTH: f64 = 388.0;
const OVERLAY_WINDOW_HEIGHT: f64 = 52.0;
const OVERLAY_TOP_INSET: f64 = 34.0;
const OVERLAY_SIDE_INSET: f64 = 28.0;
const OVERLAY_BOTTOM_INSET: f64 = 94.0;
const OVERLAY_PARK_MARGIN: f64 = 72.0;
const MIN_TRANSCRIPTION_TIMEOUT_MS: u64 = 18_000;
const MAX_TRANSCRIPTION_TIMEOUT_MS: u64 = 35_000;
const TRANSCRIPTION_TIMEOUT_PER_AUDIO_SECOND_MS: u64 = 800;
const CLOUD_TRANSCRIPTION_PROMPT_MAX_CHARS: usize = 896;
const LOCAL_PREVIEW_PROMPT_MAX_CHARS: usize = 480;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "snake_case")]
struct OverlayMonitorOption {
    id: String,
    label: String,
    is_primary: bool,
}

#[derive(Debug, Clone, Copy, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
enum OverlaySurface {
    Compact,
    ProcessingPreview,
    ResultActions,
}

impl Default for OverlaySurface {
    fn default() -> Self {
        Self::Compact
    }
}

impl OverlaySurface {
    fn dimensions(self) -> (f64, f64) {
        let width = match self {
            Self::Compact => OVERLAY_COMPACT_WINDOW_WIDTH,
            Self::ProcessingPreview => OVERLAY_PROCESSING_PREVIEW_WINDOW_WIDTH,
            Self::ResultActions => OVERLAY_RESULT_ACTIONS_WINDOW_WIDTH,
        };

        (width, OVERLAY_WINDOW_HEIGHT)
    }
}

// Remember the exact top-left window position, regardless of which overlay surface was dragged.
fn manual_overlay_reference_position(x: f64, y: f64, _surface: OverlaySurface) -> (f64, f64) {
    (x, y)
}

fn manual_overlay_surface_position(
    reference_x: f64,
    reference_y: f64,
    _surface: OverlaySurface,
) -> (f64, f64) {
    (reference_x, reference_y)
}

fn overlay_monitor_work_area(monitor: &tauri::Monitor) -> (f64, f64, f64, f64) {
    let scale = monitor.scale_factor().max(1.0);
    let work_area = monitor.work_area();

    (
        work_area.position.x as f64 / scale,
        work_area.position.y as f64 / scale,
        work_area.size.width as f64 / scale,
        work_area.size.height as f64 / scale,
    )
}

fn logical_point_in_work_area(
    point_x: f64,
    point_y: f64,
    work_x: f64,
    work_y: f64,
    work_width: f64,
    work_height: f64,
) -> bool {
    point_x >= work_x
        && point_x <= work_x + work_width
        && point_y >= work_y
        && point_y <= work_y + work_height
}

fn logical_point_distance_to_work_area(
    point_x: f64,
    point_y: f64,
    work_x: f64,
    work_y: f64,
    work_width: f64,
    work_height: f64,
) -> f64 {
    let max_x = work_x + work_width;
    let max_y = work_y + work_height;
    let distance_x = if point_x < work_x {
        work_x - point_x
    } else if point_x > max_x {
        point_x - max_x
    } else {
        0.0
    };
    let distance_y = if point_y < work_y {
        work_y - point_y
    } else if point_y > max_y {
        point_y - max_y
    } else {
        0.0
    };

    distance_x.powi(2) + distance_y.powi(2)
}

fn overlay_monitor_id_for_logical_point<I>(
    monitors: I,
    point_x: f64,
    point_y: f64,
) -> Option<String>
where
    I: IntoIterator<Item = (String, (f64, f64, f64, f64))>,
{
    let mut selected: Option<(String, bool, f64)> = None;

    for (id, (work_x, work_y, work_width, work_height)) in monitors {
        let contains =
            logical_point_in_work_area(point_x, point_y, work_x, work_y, work_width, work_height);
        let distance = logical_point_distance_to_work_area(
            point_x,
            point_y,
            work_x,
            work_y,
            work_width,
            work_height,
        );

        let replace = match &selected {
            None => true,
            Some((_, current_contains, current_distance)) => {
                (contains && !current_contains)
                    || (contains == *current_contains && distance < *current_distance)
            }
        };

        if replace {
            selected = Some((id, contains, distance));
        }
    }

    selected.map(|(id, _, _)| id)
}

fn overlay_monitor_id_for_manual_reference<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
    reference_x: f64,
    reference_y: f64,
) -> Option<String> {
    let monitors = window.available_monitors().ok()?;
    overlay_monitor_id_for_logical_point(
        monitors.into_iter().map(|monitor| {
            (
                overlay_monitor_id(&monitor),
                overlay_monitor_work_area(&monitor),
            )
        }),
        reference_x,
        reference_y,
    )
}

fn overlay_monitor_id(monitor: &tauri::Monitor) -> String {
    let name = monitor.name().cloned().unwrap_or_default();
    let trimmed = name.trim();
    if !trimmed.is_empty() {
        return format!("name:{trimmed}");
    }

    let work_area = monitor.work_area();
    format!(
        "workarea:{}:{}:{}:{}",
        work_area.position.x, work_area.position.y, work_area.size.width, work_area.size.height,
    )
}

fn overlay_monitor_label(monitor: &tauri::Monitor, index: usize, is_primary: bool) -> String {
    let name = monitor.name().cloned().unwrap_or_default();
    let trimmed = name.trim();
    let base = if trimmed.is_empty() {
        format!("Display {}", index + 1)
    } else {
        trimmed.to_string()
    };

    if is_primary {
        format!("{base} (Primary)")
    } else {
        base
    }
}

fn resolve_overlay_monitor<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
    monitor_id: &str,
) -> Option<tauri::Monitor> {
    let primary = window.primary_monitor().ok().flatten();
    if monitor_id == "primary" {
        return primary;
    }

    let monitors = window.available_monitors().ok()?;
    monitors
        .into_iter()
        .find(|monitor| overlay_monitor_id(monitor) == monitor_id)
        .or(primary)
}

fn overlay_work_area_for_config<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
    config: &AppConfig,
) -> Option<(f64, f64, f64, f64)> {
    let monitor = resolve_overlay_monitor(window, &config.overlay_monitor)?;
    Some(overlay_monitor_work_area(&monitor))
}

fn overlay_workspace_bounds<I>(work_areas: I) -> Option<(f64, f64, f64, f64)>
where
    I: IntoIterator<Item = (f64, f64, f64, f64)>,
{
    let mut bounds: Option<(f64, f64, f64, f64)> = None;

    for (work_x, work_y, work_width, work_height) in work_areas {
        let right = work_x + work_width;
        let bottom = work_y + work_height;

        bounds = Some(match bounds {
            Some((min_x, min_y, max_x, max_y)) => (
                min_x.min(work_x),
                min_y.min(work_y),
                max_x.max(right),
                max_y.max(bottom),
            ),
            None => (work_x, work_y, right, bottom),
        });
    }

    bounds
}

fn clamp_overlay_position(
    x: f64,
    y: f64,
    work_x: f64,
    work_y: f64,
    work_width: f64,
    work_height: f64,
    window_width: f64,
    window_height: f64,
) -> LogicalPosition<f64> {
    let clamped_x = x.clamp(work_x, (work_x + work_width - window_width).max(work_x));
    let clamped_y = y.clamp(work_y, (work_y + work_height - window_height).max(work_y));

    LogicalPosition::new(clamped_x.round(), clamped_y.round())
}

fn overlay_target_position<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
    config: &AppConfig,
    surface: OverlaySurface,
) -> Option<LogicalPosition<f64>> {
    let (work_x, work_y, work_width, work_height) = overlay_work_area_for_config(window, config)?;
    let (window_width, window_height) = surface.dimensions();

    match config.overlay_position_mode {
        OverlayPositionMode::Manual => {
            let (surface_x, surface_y) = manual_overlay_surface_position(
                config.overlay_manual_x as f64,
                config.overlay_manual_y as f64,
                surface,
            );

            Some(clamp_overlay_position(
                surface_x,
                surface_y,
                work_x,
                work_y,
                work_width,
                work_height,
                window_width,
                window_height,
            ))
        }
        OverlayPositionMode::Preset => {
            let left = work_x + OVERLAY_SIDE_INSET;
            let centered_x = work_x + ((work_width - window_width) / 2.0).max(0.0);
            let right = work_x + (work_width - window_width - OVERLAY_SIDE_INSET).max(0.0);
            let top = work_y + OVERLAY_TOP_INSET;
            let centered_y = work_y + ((work_height - window_height) / 2.0).max(0.0);
            let bottom = work_y + (work_height - window_height - OVERLAY_BOTTOM_INSET).max(0.0);

            let (x, y) = match config.overlay_anchor {
                OverlayAnchor::TopLeft => (left, top),
                OverlayAnchor::TopCenter => (centered_x, top),
                OverlayAnchor::TopRight => (right, top),
                OverlayAnchor::CenterLeft => (left, centered_y),
                OverlayAnchor::CenterRight => (right, centered_y),
                OverlayAnchor::BottomLeft => (left, bottom),
                OverlayAnchor::BottomCenter => (centered_x, bottom),
                OverlayAnchor::BottomRight => (right, bottom),
            };

            Some(clamp_overlay_position(
                x,
                y,
                work_x,
                work_y,
                work_width,
                work_height,
                window_width,
                window_height,
            ))
        }
    }
}

fn reveal_overlay_window<R: Runtime>(app: &AppHandle<R>, surface: OverlaySurface) {
    if let Some(window) = app.get_webview_window("overlay") {
        let config = AppConfig::load_from_disk();
        let (window_width, window_height) = surface.dimensions();
        let _ = window.set_size(LogicalSize::new(window_width, window_height));
        let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
        if let Some(position) = overlay_target_position(&window, &config, surface) {
            let _ = window.set_position(position);
        }
        let _ = window.show();
    }
}

fn park_overlay_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("overlay") {
        let (window_width, window_height) = OverlaySurface::Compact.dimensions();
        let _ = window.set_size(LogicalSize::new(window_width, window_height));
        let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
        if let Some(position) = overlay_offscreen_position(&window) {
            let _ = window.set_position(position);
        }
    }
}

fn overlay_offscreen_position<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
) -> Option<LogicalPosition<f64>> {
    let monitors = window.available_monitors().ok().unwrap_or_default();
    let bounds = overlay_workspace_bounds(
        monitors
            .into_iter()
            .map(|monitor| overlay_monitor_work_area(&monitor)),
    )
    .or_else(|| {
        window.current_monitor().ok().flatten().map(|monitor| {
            let (work_x, work_y, work_width, work_height) = overlay_monitor_work_area(&monitor);
            (work_x, work_y, work_x + work_width, work_y + work_height)
        })
    })
    .or_else(|| {
        window.primary_monitor().ok().flatten().map(|monitor| {
            let (work_x, work_y, work_width, work_height) = overlay_monitor_work_area(&monitor);
            (work_x, work_y, work_x + work_width, work_y + work_height)
        })
    })?;

    let (_, _, max_x, max_y) = bounds;
    Some(LogicalPosition::new(
        (max_x + OVERLAY_PARK_MARGIN).round(),
        (max_y + OVERLAY_PARK_MARGIN).round(),
    ))
}

#[tauri::command]
async fn overlay_monitor_options(app: AppHandle) -> Result<Vec<OverlayMonitorOption>, String> {
    let window = app
        .get_webview_window("overlay")
        .or_else(|| app.get_webview_window("settings"))
        .ok_or_else(|| "Overlay window is not configured.".to_string())?;

    let primary_id = window
        .primary_monitor()
        .map_err(|error| format!("Could not read the primary monitor: {error}"))?
        .map(|monitor| overlay_monitor_id(&monitor));

    let monitors = window
        .available_monitors()
        .map_err(|error| format!("Could not list monitors: {error}"))?;

    Ok(monitors
        .iter()
        .enumerate()
        .map(|(index, monitor)| {
            let id = overlay_monitor_id(monitor);
            let is_primary = primary_id.as_ref().is_some_and(|current| current == &id);
            OverlayMonitorOption {
                id,
                label: overlay_monitor_label(monitor, index, is_primary),
                is_primary,
            }
        })
        .collect())
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
                reveal_overlay_window(app, OverlaySurface::Compact);
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
        profile: optional_string(&value, "local_profile"),
        language: optional_string(&value, "language"),
        prompt: transcription_prompt_for_request(&provider, &value),
        carry_initial_prompt: (provider == core::providers::LOCAL_PREVIEW_PROVIDER_ID)
            .then(|| local_preview_prompt_carry(&value)),
        beam_size: (provider == core::providers::LOCAL_PREVIEW_PROVIDER_ID)
            .then(|| optional_u8(&value, "local_beam_size"))
            .flatten(),
        best_of: (provider == core::providers::LOCAL_PREVIEW_PROVIDER_ID)
            .then(|| optional_u8(&value, "local_best_of"))
            .flatten(),
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
                    if !app_config.active_text_profile_auto_paste() {
                        match core::sessions::stage_pending_transcription_preview(
                            &app,
                            app_config.clone(),
                            provider.clone(),
                            response.text.clone(),
                            transformed.clone(),
                        ) {
                            Ok(preview) => {
                                core::runtime_log::record(format!(
                                    "[WordScript] Native pipeline preview ready session_id={} elapsed_ms={} delivery=clipboard_only",
                                    session_id,
                                    pipeline_started_at.elapsed().as_millis(),
                                ));
                                let _ = app.emit(
                                    "wordscript-event",
                                    serde_json::json!({
                                        "event": "preview_ready",
                                        "text": preview.text,
                                        "corrected": preview.corrected,
                                        "provider": preview.provider,
                                        "active_profile": preview.active_profile,
                                        "work_mode": preview.work_mode,
                                        "raw_text": preview.raw_text,
                                        "transform": {
                                            "applied_rules": preview.transform.applied_rules,
                                            "warning": preview.transform.warning,
                                        }
                                    }),
                                );
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

                        let _ = tokio::fs::remove_file(cleanup_path).await;
                        return;
                    }

                    if !processing_session_still_current(&app, &session_id, "before_insertion") {
                        let _ = tokio::fs::remove_file(cleanup_path).await;
                        return;
                    }

                    match core::insertion::insert_transcription_from_legacy(
                        &app,
                        &text,
                        transformed.corrected,
                        Some(app_config.active_text_profile_auto_paste()),
                    ) {
                        Ok(result) if result.ok => {
                            if !processing_session_still_current(&app, &session_id, "insertion_ok")
                            {
                                let _ = tokio::fs::remove_file(cleanup_path).await;
                                return;
                            }

                            let history_entry = core::history::history_entry_from_insert_result(
                                &app_config,
                                None,
                                Some(response.text.clone()),
                                transformed.clone(),
                                &result,
                            )
                            .ok();
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
                                            "active_profile": app_config.active_text_profile_label(),
                                            "work_mode": app_config.resolved_active_text_profile_work_mode(),
                                            "raw_text": response.text,
                                            "transform": {
                                                "applied_rules": transformed.applied_rules,
                                                "warning": transformed.warning,
                                            },
                                            "history": history_entry.as_ref().map(|entry| serde_json::json!({
                                                "entry_id": entry.id,
                                                "retry_of": entry.retry_of,
                                            })),
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

                            let _ = core::history::record_insert_failure(
                                &app_config,
                                response.text.clone(),
                                text.clone(),
                                transformed.clone(),
                                error.clone(),
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
                                "retry_after_seconds": error.retry_after_seconds,
                                "retryable": error.retryable,
                                "user_action": error.user_action
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

fn optional_u8(value: &serde_json::Value, key: &str) -> Option<u8> {
    value
        .get(key)
        .and_then(|value| value.as_u64())
        .and_then(|value| u8::try_from(value).ok())
}

fn transcription_prompt_for_request(provider: &str, value: &serde_json::Value) -> Option<String> {
    if provider == core::providers::LOCAL_PREVIEW_PROVIDER_ID {
        return local_preview_prompt_for_request(value);
    }

    cloud_transcription_prompt_for_request(value)
}

fn cloud_transcription_prompt_for_request(value: &serde_json::Value) -> Option<String> {
    build_transcription_prompt(
        optional_string(value, "prompt"),
        transcription_dictionary_hints(value),
        transcription_stt_hints(value),
        CLOUD_TRANSCRIPTION_PROMPT_MAX_CHARS,
    )
}

fn local_preview_prompt_for_request(value: &serde_json::Value) -> Option<String> {
    let strength = value
        .get("local_prompt_strength")
        .and_then(|raw| raw.as_str())
        .unwrap_or("profile");

    match strength {
        "off" => None,
        "profile_and_terms" => build_transcription_prompt(
            optional_string(value, "prompt"),
            transcription_dictionary_hints(value),
            transcription_stt_hints(value),
            LOCAL_PREVIEW_PROMPT_MAX_CHARS,
        ),
        _ => optional_string(value, "prompt").and_then(|prompt| {
            truncate_transcription_prompt(prompt, LOCAL_PREVIEW_PROMPT_MAX_CHARS)
        }),
    }
}

fn local_preview_prompt_carry(value: &serde_json::Value) -> bool {
    value
        .get("local_prompt_carry")
        .and_then(|carry| carry.as_bool())
        .unwrap_or(false)
}

fn build_transcription_prompt(
    base_prompt: Option<String>,
    dictionary_hints: Vec<String>,
    stt_hints: Vec<String>,
    max_chars: usize,
) -> Option<String> {
    let mut sections = Vec::new();

    if let Some(prompt) = base_prompt {
        sections.push(prompt);
    }

    if !dictionary_hints.is_empty() {
        sections.push(format!("Preferred terms: {}", dictionary_hints.join("; ")));
    }

    if !stt_hints.is_empty() {
        sections.push(format!("STT hints: {}", stt_hints.join("; ")));
    }

    truncate_transcription_prompt(sections.join("\n"), max_chars)
}

fn transcription_dictionary_hints(value: &serde_json::Value) -> Vec<String> {
    value
        .get("dictionary_entries")
        .and_then(|entries| entries.as_array())
        .into_iter()
        .flatten()
        .filter_map(|entry| {
            let phrase = entry.get("phrase")?.as_str()?.trim();
            let replace_with = entry.get("replace_with")?.as_str()?.trim();
            if phrase.is_empty() || replace_with.is_empty() {
                return None;
            }

            Some(format!("{} -> {}", phrase, replace_with))
        })
        .take(8)
        .collect()
}

fn transcription_stt_hints(value: &serde_json::Value) -> Vec<String> {
    value
        .get("stt_hints")
        .and_then(|hints| hints.as_str())
        .into_iter()
        .flat_map(|hints| hints.lines())
        .map(str::trim)
        .filter(|hint| !hint.is_empty())
        .take(6)
        .map(ToString::to_string)
        .collect()
}

fn truncate_transcription_prompt(prompt: String, max_chars: usize) -> Option<String> {
    let trimmed = prompt.trim();
    if trimmed.is_empty() {
        return None;
    }

    let truncated = trimmed.chars().take(max_chars).collect::<String>();

    Some(truncated.trim().to_string())
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

#[tauri::command]
async fn sync_overlay_window_visibility(
    app: AppHandle,
    visible: bool,
    surface: Option<OverlaySurface>,
) -> Result<(), String> {
    if visible {
        reveal_overlay_window(&app, surface.unwrap_or_default());
    } else {
        park_overlay_window(&app);
    }

    Ok(())
}

#[tauri::command]
async fn remember_overlay_manual_position<R: Runtime>(
    app: AppHandle<R>,
    webview_window: tauri::WebviewWindow<R>,
    x: i32,
    y: i32,
    surface: Option<OverlaySurface>,
) -> Result<AppConfig, String> {
    let mut config = AppConfig::load_from_disk();
    let (reference_x, reference_y) =
        manual_overlay_reference_position(x as f64, y as f64, surface.unwrap_or_default());

    config.overlay_position_mode = OverlayPositionMode::Manual;
    config.overlay_monitor =
        overlay_monitor_id_for_manual_reference(&webview_window, reference_x, reference_y)
            .or_else(|| {
                webview_window
                    .primary_monitor()
                    .ok()
                    .flatten()
                    .map(|monitor| overlay_monitor_id(&monitor))
            })
            .unwrap_or_else(|| "primary".to_string());
    config.overlay_manual_x = reference_x.round() as i32;
    config.overlay_manual_y = reference_y.round() as i32;

    core::config::save_config(app, config)
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
            overlay_monitor_options,
            sync_overlay_window_visibility,
            remember_overlay_manual_position,
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
            core::sessions::commit_pending_transcription_preview,
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
    use serde_json::json;

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

    #[test]
    fn local_preview_prompt_strength_can_disable_bias() {
        let payload = json!({
            "prompt": "Customer success terminology",
            "local_prompt_strength": "off",
        });

        assert_eq!(
            transcription_prompt_for_request(core::providers::LOCAL_PREVIEW_PROVIDER_ID, &payload),
            None
        );
    }

    #[test]
    fn local_preview_prompt_strength_can_enrich_bias_with_terms() {
        let payload = json!({
            "prompt": "Support escalations and product names",
            "stt_hints": "status update\nhandoff summary",
            "local_prompt_strength": "profile_and_terms",
            "dictionary_entries": [
                {
                    "phrase": "word script",
                    "replace_with": "WordScript"
                }
            ]
        });

        let prompt =
            transcription_prompt_for_request(core::providers::LOCAL_PREVIEW_PROVIDER_ID, &payload)
                .expect("local preview prompt");

        assert!(prompt.contains("Support escalations and product names"));
        assert!(prompt.contains("Preferred terms: word script -> WordScript"));
        assert!(prompt.contains("STT hints: status update; handoff summary"));
    }

    #[test]
    fn cloud_transcription_prompt_includes_profile_terms_and_phrases() {
        let payload = json!({
            "prompt": "German and English customer support terminology",
            "stt_hints": "status update\ntriage summary",
            "dictionary_entries": [
                {
                    "phrase": "word script",
                    "replace_with": "WordScript"
                },
                {
                    "phrase": "sev one",
                    "replace_with": "SEV-1"
                }
            ]
        });

        let prompt = transcription_prompt_for_request("groq", &payload).expect("cloud prompt");

        assert!(prompt.contains("German and English customer support terminology"));
        assert!(prompt.contains("Preferred terms: word script -> WordScript; sev one -> SEV-1"));
        assert!(prompt.contains("STT hints: status update; triage summary"));
    }

    #[test]
    fn snippet_triggers_no_longer_feed_automatic_transcription_bias() {
        let payload = json!({
            "prompt": "Support language",
            "stt_hints": "status update",
            "dictionary_entries": [
                {
                    "phrase": "word script",
                    "replace_with": "WordScript"
                }
            ],
            "snippet_entries": [
                {
                    "trigger": "should not leak"
                }
            ]
        });

        let prompt = transcription_prompt_for_request("groq", &payload).expect("cloud prompt");

        assert!(prompt.contains("STT hints: status update"));
        assert!(!prompt.contains("should not leak"));
    }

    #[test]
    fn cloud_transcription_prompt_respects_conservative_size_limit() {
        let payload = json!({
            "prompt": "a".repeat(CLOUD_TRANSCRIPTION_PROMPT_MAX_CHARS * 2),
            "dictionary_entries": [
                {
                    "phrase": "word script",
                    "replace_with": "WordScript"
                }
            ]
        });

        let prompt = transcription_prompt_for_request("groq", &payload).expect("cloud prompt");

        assert!(prompt.chars().count() <= CLOUD_TRANSCRIPTION_PROMPT_MAX_CHARS);
    }

    #[test]
    fn manual_overlay_reference_roundtrips_surface_positions() {
        let compact = manual_overlay_reference_position(320.0, 180.0, OverlaySurface::Compact);
        assert_eq!(compact, (320.0, 180.0));

        let processing =
            manual_overlay_reference_position(210.0, 140.0, OverlaySurface::ProcessingPreview);
        assert_eq!(processing, (210.0, 140.0));
        assert_eq!(
            manual_overlay_surface_position(
                processing.0,
                processing.1,
                OverlaySurface::ProcessingPreview
            ),
            (210.0, 140.0)
        );

        let result = manual_overlay_reference_position(412.0, 96.0, OverlaySurface::ResultActions);
        assert_eq!(result, (412.0, 96.0));
        assert_eq!(
            manual_overlay_surface_position(result.0, result.1, OverlaySurface::ResultActions),
            (412.0, 96.0)
        );
    }

    #[test]
    fn manual_overlay_surface_positions_keep_the_same_top_left_across_states() {
        let (result_x, result_y) =
            manual_overlay_surface_position(480.0, 220.0, OverlaySurface::ResultActions);
        let (preview_x, preview_y) =
            manual_overlay_surface_position(480.0, 220.0, OverlaySurface::ProcessingPreview);

        assert_eq!((result_x, result_y), (480.0, 220.0));
        assert_eq!((preview_x, preview_y), (480.0, 220.0));
    }

    #[test]
    fn overlay_monitor_selection_prefers_the_work_area_containing_the_manual_reference() {
        let selected = overlay_monitor_id_for_logical_point(
            [
                ("name:Primary".to_string(), (0.0, 0.0, 1920.0, 1040.0)),
                (
                    "workarea:-1080:0:1080:1880".to_string(),
                    (-1080.0, 0.0, 1080.0, 1880.0),
                ),
            ],
            -320.0,
            240.0,
        );

        assert_eq!(selected.as_deref(), Some("workarea:-1080:0:1080:1880"));
    }

    #[test]
    fn overlay_monitor_selection_falls_back_to_the_nearest_work_area_when_point_is_outside_all_monitors(
    ) {
        let selected = overlay_monitor_id_for_logical_point(
            [
                ("name:Primary".to_string(), (0.0, 0.0, 1920.0, 1040.0)),
                (
                    "workarea:-1080:0:1080:1880".to_string(),
                    (-1080.0, 0.0, 1080.0, 1880.0),
                ),
            ],
            -1124.0,
            260.0,
        );

        assert_eq!(selected.as_deref(), Some("workarea:-1080:0:1080:1880"));
    }

    #[test]
    fn overlay_workspace_bounds_cover_the_full_multi_monitor_union() {
        let bounds = overlay_workspace_bounds([
            (0.0, 0.0, 1080.0, 1920.0),
            (1080.0, 411.0, 1920.0, 1080.0),
            (3000.0, 223.0, 1536.0, 960.0),
        ]);

        assert_eq!(bounds, Some((0.0, 0.0, 4536.0, 1920.0)));
    }

    #[test]
    fn overlay_workspace_bounds_keep_negative_monitor_origins() {
        let bounds =
            overlay_workspace_bounds([(-1080.0, 0.0, 1080.0, 1880.0), (0.0, 0.0, 1920.0, 1040.0)]);

        assert_eq!(bounds, Some((-1080.0, 0.0, 1920.0, 1880.0)));
    }
}
