use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use arboard::Clipboard;
use enigo::{
    Direction::{Click, Press, Release},
    Enigo, Key, Keyboard, Settings,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Runtime, State};

use super::paths::{config_file_path, scratchpad_file_path};
use super::runtime_log;
use super::sessions::{complete_from_transcription, fail_from_native_error, now_ms};

const CLIPBOARD_RESTORE_DELAY_MS: u64 = 180;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeInsertionConfig {
    pub auto_paste: bool,
    pub paste_delay_ms: u64,
}

impl Default for NativeInsertionConfig {
    fn default() -> Self {
        Self {
            auto_paste: true,
            paste_delay_ms: 220,
        }
    }
}

impl NativeInsertionConfig {
    pub fn load_from_disk() -> Self {
        let mut config = Self::default();
        let Ok(raw) = std::fs::read_to_string(config_file_path()) else {
            return config;
        };
        let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) else {
            return config;
        };
        if let Some(auto_paste) = value.get("auto_paste").and_then(|value| value.as_bool()) {
            config.auto_paste = auto_paste;
        }
        config
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ConfigureNativeInsertionRequest {
    pub auto_paste: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NativeInsertRequest {
    pub text: String,
    pub source: Option<String>,
    pub corrected: Option<bool>,
    pub auto_paste: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NativeInsertMode {
    DirectPaste,
    ClipboardOnly,
    ClipboardFallback,
    ScratchpadFallback,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScratchpadEntry {
    pub id: String,
    pub text: String,
    pub source: String,
    pub created_at_ms: u64,
    pub corrected: bool,
    pub insert_mode: NativeInsertMode,
    pub clipboard_written: bool,
    pub paste_attempted: bool,
    pub pasted: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct NativeInsertResult {
    pub ok: bool,
    pub text: String,
    pub insert_mode: NativeInsertMode,
    pub clipboard_written: bool,
    pub paste_attempted: bool,
    pub pasted: bool,
    pub scratchpad_entry: ScratchpadEntry,
    pub fallback_available: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum NativeSupportTier {
    Tier1,
    Preview,
    Experimental,
}

#[derive(Debug, Clone, Serialize)]
pub struct NativeInsertionPlatformStatus {
    pub platform_label: String,
    pub support_tier: NativeSupportTier,
    pub insert_strategy: NativeInsertMode,
    pub support_message: String,
    pub prerequisites: Vec<String>,
    pub caveats: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct NativeInsertionStatus {
    pub config: NativeInsertionConfig,
    pub last_transcript: Option<ScratchpadEntry>,
    pub scratchpad_entries: Vec<ScratchpadEntry>,
    pub scratchpad_path: String,
    pub platform: NativeInsertionPlatformStatus,
}

#[derive(Debug)]
pub struct NativeInsertionState {
    config: NativeInsertionConfig,
    entries: Vec<ScratchpadEntry>,
    last_transcript: Option<ScratchpadEntry>,
}

pub(crate) trait InsertIo {
    fn write_clipboard(&mut self, text: &str) -> Result<(), String>;
    fn read_clipboard_text(&mut self) -> Option<String>;
    fn paste_from_clipboard(&mut self) -> Result<(), String>;
    fn schedule_clipboard_restore(&mut self, text: Option<String>, delay_ms: u64);
    fn wait_before_paste(&mut self, delay_ms: u64);
}

struct SystemInsertIo;

impl InsertIo for SystemInsertIo {
    fn write_clipboard(&mut self, text: &str) -> Result<(), String> {
        write_clipboard(text)
    }

    fn read_clipboard_text(&mut self) -> Option<String> {
        read_clipboard_text()
    }

    fn paste_from_clipboard(&mut self) -> Result<(), String> {
        paste_from_clipboard()
    }

    fn schedule_clipboard_restore(&mut self, text: Option<String>, delay_ms: u64) {
        schedule_clipboard_restore(text, delay_ms);
    }

    fn wait_before_paste(&mut self, delay_ms: u64) {
        thread::sleep(Duration::from_millis(delay_ms));
    }
}

impl NativeInsertionState {
    pub fn load(config: NativeInsertionConfig) -> Self {
        let entries = load_scratchpad_entries();
        let last_transcript = entries.last().cloned();
        Self {
            config,
            entries,
            last_transcript,
        }
    }

    fn status(&self) -> NativeInsertionStatus {
        NativeInsertionStatus {
            config: self.config.clone(),
            last_transcript: self.last_transcript.clone(),
            scratchpad_entries: self.entries.clone(),
            scratchpad_path: scratchpad_file_path().to_string_lossy().to_string(),
            platform: platform_status(self.config.auto_paste),
        }
    }

    fn configure(&mut self, config: NativeInsertionConfig) -> NativeInsertionStatus {
        self.config = config;
        self.status()
    }

    fn clear(&mut self) -> NativeInsertionStatus {
        self.entries.clear();
        self.last_transcript = None;
        let _ = save_scratchpad_entries(&self.entries);
        self.status()
    }

    fn insert(&mut self, request: NativeInsertRequest) -> NativeInsertResult {
        let started_at = Instant::now();
        let mut io = SystemInsertIo;
        let result = execute_insert_request_with_io(
            request,
            &self.config,
            self.entries.len() + 1,
            is_wayland_session(),
            &mut io,
        );

        runtime_log::record(format!(
            "[WordScript] Native insert state core done elapsed_ms={} insert_mode={:?} pasted={} clipboard_written={}",
            started_at.elapsed().as_millis(),
            result.insert_mode,
            result.pasted,
            result.clipboard_written,
        ));

        self.last_transcript = Some(result.scratchpad_entry.clone());
        self.entries.push(result.scratchpad_entry.clone());
        if self.entries.len() > 100 {
            let overflow = self.entries.len() - 100;
            self.entries.drain(0..overflow);
        }
        let save_started_at = Instant::now();
        let _ = save_scratchpad_entries(&self.entries);
        runtime_log::record(format!(
            "[WordScript] Native insert scratchpad save done elapsed_ms={} total_elapsed_ms={}",
            save_started_at.elapsed().as_millis(),
            started_at.elapsed().as_millis(),
        ));

        result
    }
}

#[tauri::command]
pub fn native_insertion_status(
    state: State<'_, Mutex<NativeInsertionState>>,
) -> Result<NativeInsertionStatus, String> {
    let state = state.lock().map_err(|error| error.to_string())?;
    Ok(state.status())
}

#[tauri::command]
pub fn configure_native_insertion(
    request: ConfigureNativeInsertionRequest,
    state: State<'_, Mutex<NativeInsertionState>>,
) -> Result<NativeInsertionStatus, String> {
    let mut state = state.lock().map_err(|error| error.to_string())?;
    Ok(state.configure(NativeInsertionConfig {
        auto_paste: request.auto_paste,
        paste_delay_ms: NativeInsertionConfig::default().paste_delay_ms,
    }))
}

#[tauri::command]
pub fn insert_text_native(
    app: AppHandle,
    request: NativeInsertRequest,
    state: State<'_, Mutex<NativeInsertionState>>,
) -> Result<NativeInsertResult, String> {
    let mut state = state.lock().map_err(|error| error.to_string())?;
    let result = state.insert(request);
    emit_insert_event(&app, &result);
    Ok(result)
}

#[tauri::command]
pub fn restore_last_transcript(
    app: AppHandle,
    state: State<'_, Mutex<NativeInsertionState>>,
) -> Result<NativeInsertResult, String> {
    let last = {
        let state = state.lock().map_err(|error| error.to_string())?;
        state
            .last_transcript
            .as_ref()
            .map(|entry| entry.text.clone())
            .ok_or_else(|| "No last transcript available.".to_string())?
    };

    let mut state = state.lock().map_err(|error| error.to_string())?;
    let result = state.insert(NativeInsertRequest {
        text: last,
        source: Some("last_transcript_restore".to_string()),
        corrected: Some(false),
        auto_paste: None,
    });
    emit_insert_event(&app, &result);
    Ok(result)
}

#[tauri::command]
pub fn clear_native_scratchpad(
    state: State<'_, Mutex<NativeInsertionState>>,
) -> Result<NativeInsertionStatus, String> {
    let mut state = state.lock().map_err(|error| error.to_string())?;
    Ok(state.clear())
}

pub fn insert_transcription_from_legacy<R: Runtime>(
    app: &AppHandle<R>,
    text: &str,
    corrected: bool,
) -> Result<NativeInsertResult, String> {
    let started_at = Instant::now();
    let state = app
        .try_state::<Mutex<NativeInsertionState>>()
        .ok_or_else(|| "Native insertion state is not available.".to_string())?;
    let mut state = state.lock().map_err(|error| error.to_string())?;
    let result = state.insert(NativeInsertRequest {
        text: text.to_string(),
        source: Some(
            if corrected {
                "legacy_transcription_corrected"
            } else {
                "legacy_transcription"
            }
            .to_string(),
        ),
        corrected: Some(corrected),
        auto_paste: None,
    });
    drop(state);

    runtime_log::record(format!(
        "[WordScript] Native insert legacy state done elapsed_ms={}",
        started_at.elapsed().as_millis(),
    ));

    let session_emit_started_at = Instant::now();
    complete_from_transcription(app, &result.text, corrected);
    runtime_log::record(format!(
        "[WordScript] Native insert session emit done elapsed_ms={} total_elapsed_ms={}",
        session_emit_started_at.elapsed().as_millis(),
        started_at.elapsed().as_millis(),
    ));

    let insert_emit_started_at = Instant::now();
    emit_insert_event(app, &result);
    runtime_log::record(format!(
        "[WordScript] Native insert event emit done elapsed_ms={} total_elapsed_ms={}",
        insert_emit_started_at.elapsed().as_millis(),
        started_at.elapsed().as_millis(),
    ));
    if result.error.is_some() {
        super::sound::play_if_enabled(super::sound::SoundCue::Error);
    }
    if !result.ok {
        if let Some(error) = &result.error {
            fail_from_native_error(app, error);
        }
    }

    Ok(result)
}

pub fn format_text_for_insert(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    if matches!(trimmed.chars().last(), Some('.') | Some('!') | Some('?')) {
        format!("{trimmed} ")
    } else {
        trimmed.to_string()
    }
}

pub(crate) fn execute_insert_request_with_io(
    request: NativeInsertRequest,
    config: &NativeInsertionConfig,
    entry_index: usize,
    _is_wayland: bool,
    io: &mut impl InsertIo,
) -> NativeInsertResult {
    let source = request
        .source
        .unwrap_or_else(|| "native_insert".to_string());
    let corrected = request.corrected.unwrap_or(false);
    let insert_text = format_text_for_insert(&request.text);
    let auto_paste = request.auto_paste.unwrap_or(config.auto_paste);
    let previous_clipboard_text = auto_paste.then(|| io.read_clipboard_text()).flatten();
    let mut clipboard_written = false;
    let mut paste_attempted = false;
    let mut pasted = false;
    let mut error = None;

    match io.write_clipboard(&insert_text) {
        Ok(()) => clipboard_written = true,
        Err(cause) => error = Some(cause),
    }

    let insert_mode = if !clipboard_written {
        NativeInsertMode::ScratchpadFallback
    } else if !auto_paste {
        NativeInsertMode::ClipboardOnly
    } else {
        paste_attempted = true;
        io.wait_before_paste(config.paste_delay_ms);
        match io.paste_from_clipboard() {
            Ok(()) => {
                pasted = true;
                io.schedule_clipboard_restore(
                    previous_clipboard_text,
                    CLIPBOARD_RESTORE_DELAY_MS,
                );
                NativeInsertMode::DirectPaste
            }
            Err(cause) => {
                error = Some(cause);
                NativeInsertMode::ClipboardFallback
            }
        }
    };

    let entry = ScratchpadEntry {
        id: format!("scratch-{}-{}", now_ms(), entry_index),
        text: insert_text.clone(),
        source,
        created_at_ms: now_ms(),
        corrected,
        insert_mode: insert_mode.clone(),
        clipboard_written,
        paste_attempted,
        pasted,
        error: error.clone(),
    };

    NativeInsertResult {
        ok: clipboard_written
            && (!auto_paste || pasted || matches!(insert_mode, NativeInsertMode::ClipboardOnly)),
        text: insert_text,
        insert_mode,
        clipboard_written,
        paste_attempted,
        pasted,
        scratchpad_entry: entry,
        fallback_available: true,
        error,
    }
}

fn write_clipboard(text: &str) -> Result<(), String> {
    if cfg!(target_os = "linux")
        && original_wayland_display().is_some()
        && command_in_path("wl-copy")
    {
        return write_wayland_clipboard(text).or_else(|wayland_error| {
            write_clipboard_with_arboard(text)
                .map_err(|arboard_error| format!("{wayland_error}; {arboard_error}"))
        });
    }

    let arboard_result = write_clipboard_with_arboard(text);
    if arboard_result.is_ok() {
        return Ok(());
    }

    if cfg!(target_os = "linux") && original_wayland_display().is_some() {
        return write_wayland_clipboard(text).or(arboard_result);
    }

    arboard_result
}

fn read_clipboard_text() -> Option<String> {
    Clipboard::new()
        .ok()
        .and_then(|mut clipboard| clipboard.get_text().ok())
}

fn schedule_clipboard_restore(text: Option<String>, delay_ms: u64) {
    let Some(text) = text else {
        return;
    };

    thread::sleep(Duration::from_millis(delay_ms));
    if let Err(error) = write_clipboard(&text) {
        runtime_log::record(format!(
            "[WordScript] Native insert clipboard restore failed: {error}"
        ));
    } else {
        runtime_log::record(format!(
            "[WordScript] Native insert clipboard restore done after_ms={delay_ms}"
        ));
    }
}

fn write_clipboard_with_arboard(text: &str) -> Result<(), String> {
    let arboard_result = Clipboard::new()
        .map_err(|error| format!("Clipboard unavailable: {error}"))
        .and_then(|mut clipboard| {
            clipboard
                .set_text(text.to_string())
                .map_err(|error| format!("Could not write clipboard: {error}"))
        });

    arboard_result
}

fn paste_from_clipboard() -> Result<(), String> {
    let mut errors = Vec::new();
    let started_at = Instant::now();
    let has_x11_display = cfg!(target_os = "linux") && std::env::var_os("DISPLAY").is_some();
    let has_wayland_display = original_wayland_display().is_some();

    if has_x11_display {
        match paste_with_command("xdotool", &["key", "--clearmodifiers", "ctrl+v"], false) {
            Ok(()) => {
                runtime_log::record(format!(
                    "[WordScript] Native insert paste strategy=xdotool elapsed_ms={}",
                    started_at.elapsed().as_millis(),
                ));
                return Ok(());
            }
            Err(error) => {
                if has_wayland_display && command_in_path("xdotool") {
                    return Err(format!(
                        "{error}; skipped Wayland fake-input fallbacks in hybrid X11/Wayland session to avoid compositor permission prompts"
                    ));
                }
                errors.push(error);
            }
        }
    }

    if has_wayland_display {
        match paste_with_command("wtype", &["-M", "ctrl", "-k", "v", "-m", "ctrl"], true) {
            Ok(()) => {
                runtime_log::record(format!(
                    "[WordScript] Native insert paste strategy=wtype elapsed_ms={}",
                    started_at.elapsed().as_millis(),
                ));
                return Ok(());
            }
            Err(error) => errors.push(error),
        }
        match paste_with_command("ydotool", &["key", "29:1", "47:1", "47:0", "29:0"], false) {
            Ok(()) => {
                runtime_log::record(format!(
                    "[WordScript] Native insert paste strategy=ydotool elapsed_ms={}",
                    started_at.elapsed().as_millis(),
                ));
                return Ok(());
            }
            Err(error) => errors.push(error),
        }
    }

    match paste_with_enigo() {
        Ok(()) => {
            runtime_log::record(format!(
                "[WordScript] Native insert paste strategy=enigo elapsed_ms={}",
                started_at.elapsed().as_millis(),
            ));
            return Ok(());
        }
        Err(error) => errors.push(error),
    }

    Err(errors.join("; "))
}

fn command_in_path(program: &str) -> bool {
    std::env::var_os("PATH")
        .map(|paths| {
            std::env::split_paths(&paths).any(|path| executable_exists(&path, program))
        })
        .unwrap_or(false)
}

fn executable_exists(path: &PathBuf, program: &str) -> bool {
    let candidate = path.join(program);
    candidate.is_file()
}

fn paste_with_enigo() -> Result<(), String> {
    if cfg!(target_os = "linux") && command_in_path("xdotool") {
        return Err("Enigo skipped because xdotool is available on Linux.".to_string());
    }

    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|error| format!("Enigo input adapter unavailable: {error}"))?;
    let modifier = if cfg!(target_os = "macos") {
        Key::Meta
    } else {
        Key::Control
    };
    enigo
        .key(modifier, Press)
        .map_err(|error| format!("Could not press paste modifier: {error}"))?;
    let click_result = enigo.key(Key::Unicode('v'), Click);
    let release_result = enigo.key(modifier, Release);
    click_result.map_err(|error| format!("Could not trigger paste key: {error}"))?;
    release_result.map_err(|error| format!("Could not release paste modifier: {error}"))?;
    Ok(())
}

fn paste_with_command(program: &str, args: &[&str], restore_wayland: bool) -> Result<(), String> {
    let mut command = Command::new(program);
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    if restore_wayland {
        if let Some(display) = original_wayland_display() {
            command.env("WAYLAND_DISPLAY", display);
        }
    }

    let output = command
        .output()
        .map_err(|error| format!("{program} unavailable: {error}"))?;
    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        Err(format!(
            "{program} paste failed with status {}",
            output.status
        ))
    } else {
        Err(format!("{program} paste failed: {stderr}"))
    }
}

fn write_wayland_clipboard(text: &str) -> Result<(), String> {
    let Some(display) = original_wayland_display() else {
        return Err("not an original Wayland session".to_string());
    };

    let mut child = Command::new("wl-copy")
        .env("WAYLAND_DISPLAY", display)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("wl-copy unavailable: {error}"))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(text.as_bytes())
            .map_err(|error| format!("Could not send transcript to wl-copy: {error}"))?;
    }

    std::thread::spawn(move || match child.wait() {
        Ok(status) if !status.success() => {
            runtime_log::record(format!(
                "[WordScript] wl-copy exited with non-success status {}",
                status
            ));
        }
        Ok(_) => {}
        Err(error) => {
            runtime_log::record(format!("[WordScript] wl-copy wait failed: {error}"));
        }
    });

    Ok(())
}

fn original_wayland_display() -> Option<String> {
    std::env::var("WAYLAND_DISPLAY")
        .ok()
        .or_else(|| std::env::var("WORDSCRIPT_WAYLAND_DISPLAY").ok())
}

fn is_wayland_session() -> bool {
    cfg!(target_os = "linux")
        && (std::env::var_os("WAYLAND_DISPLAY").is_some()
            || std::env::var_os("WORDSCRIPT_WAS_WAYLAND").is_some())
}

fn platform_status(auto_paste: bool) -> NativeInsertionPlatformStatus {
    if cfg!(target_os = "windows") {
        NativeInsertionPlatformStatus {
            platform_label: "Windows".to_string(),
            support_tier: NativeSupportTier::Tier1,
            insert_strategy: if auto_paste {
                NativeInsertMode::DirectPaste
            } else {
                NativeInsertMode::ClipboardOnly
            },
            support_message: if auto_paste {
                "Tier-1 path: direct auto-paste is the default, and the scratchpad keeps a recovery copy if insertion still fails.".to_string()
            } else {
                "Tier-1 path with manual paste: WordScript writes to the clipboard and keeps a scratchpad recovery copy.".to_string()
            },
            prerequisites: vec![
                "Keep focus on the target app before the auto-paste step runs.".to_string(),
                "Use clipboard-only mode if you want recovery without simulated Ctrl+V.".to_string(),
            ],
            caveats: vec![
                "Elevated target apps can ignore synthetic paste from a non-elevated WordScript process.".to_string(),
            ],
        }
    } else if cfg!(target_os = "macos") {
        NativeInsertionPlatformStatus {
            platform_label: "macOS".to_string(),
            support_tier: NativeSupportTier::Tier1,
            insert_strategy: if auto_paste {
                NativeInsertMode::DirectPaste
            } else {
                NativeInsertMode::ClipboardOnly
            },
            support_message: if auto_paste {
                "Tier-1 path: direct Cmd+V auto-paste is the default, and the scratchpad keeps a recovery copy if the target app blocks insertion.".to_string()
            } else {
                "Tier-1 path with manual paste: WordScript writes to the clipboard and keeps a scratchpad recovery copy.".to_string()
            },
            prerequisites: vec![
                "Allow Accessibility for WordScript, your terminal, or VS Code in System Settings -> Privacy & Security -> Accessibility before relying on auto-paste.".to_string(),
                "If macOS prompts for Input Monitoring while sending Cmd+V, allow it for the process that launched WordScript in development mode.".to_string(),
                "Disable auto-paste when you only want clipboard handoff without synthetic Cmd+V.".to_string(),
            ],
            caveats: vec![
                "Some sandboxed, remote-desktop, or elevated target apps can still reject simulated paste even after permissions were granted.".to_string(),
                "In development mode the permission entry may appear under Terminal or VS Code instead of a packaged WordScript app name.".to_string(),
            ],
        }
    } else if is_wayland_session() {
        NativeInsertionPlatformStatus {
            platform_label: "Linux Wayland".to_string(),
            support_tier: NativeSupportTier::Experimental,
            insert_strategy: if auto_paste {
                NativeInsertMode::ClipboardFallback
            } else {
                NativeInsertMode::ClipboardOnly
            },
            support_message: if auto_paste {
                "Experimental path: WordScript tries direct paste through available Wayland/X11 helpers, then keeps clipboard and scratchpad recovery if the desktop blocks insertion.".to_string()
            } else {
                "Experimental path with manual paste: WordScript writes to the clipboard and keeps a scratchpad recovery copy.".to_string()
            },
            prerequisites: vec![
                "Wayland helper tools and compositor policy decide whether synthetic paste can work at all.".to_string(),
                "Keep clipboard-only recovery enabled if your desktop blocks direct insert.".to_string(),
            ],
            caveats: vec![
                "Behavior can differ between compositors, portal setups, and XWayland fallback paths on the same distro.".to_string(),
            ],
        }
    } else {
        NativeInsertionPlatformStatus {
            platform_label: "Linux X11".to_string(),
            support_tier: NativeSupportTier::Preview,
            insert_strategy: if auto_paste {
                NativeInsertMode::DirectPaste
            } else {
                NativeInsertMode::ClipboardOnly
            },
            support_message: if auto_paste {
                "Preview path: direct auto-paste is available on X11, but WordScript still keeps clipboard and scratchpad recovery for target apps that behave differently.".to_string()
            } else {
                "Preview path with manual paste: WordScript writes to the clipboard and keeps a scratchpad recovery copy.".to_string()
            },
            prerequisites: vec![
                "Run under X11 or XWayland if you want the current direct paste path.".to_string(),
                "Keep clipboard recovery enabled for apps that do not accept synthetic paste consistently.".to_string(),
            ],
            caveats: vec![
                "Window manager quirks still make Linux less uniform than the Windows and macOS paths.".to_string(),
            ],
        }
    }
}

fn emit_insert_event<R: Runtime>(app: &AppHandle<R>, result: &NativeInsertResult) {
    let _ = app.emit("wordscript-native-insert", result);
}

fn load_scratchpad_entries() -> Vec<ScratchpadEntry> {
    let Ok(raw) = std::fs::read_to_string(scratchpad_file_path()) else {
        return Vec::new();
    };
    serde_json::from_str::<Vec<ScratchpadEntry>>(&raw).unwrap_or_default()
}

fn save_scratchpad_entries(entries: &[ScratchpadEntry]) -> Result<(), String> {
    let path = scratchpad_file_path();
    let raw = serde_json::to_string_pretty(entries).map_err(|error| error.to_string())?;
    std::fs::write(path, raw).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    struct FakeInsertIo {
        clipboard_result: Result<(), String>,
        clipboard_read: Option<String>,
        paste_result: Result<(), String>,
        scheduled_restores: Vec<(Option<String>, u64)>,
        waits: Vec<u64>,
        clipboard_texts: Vec<String>,
    }

    impl FakeInsertIo {
        fn direct_paste() -> Self {
            Self {
                clipboard_result: Ok(()),
                clipboard_read: Some("Previous clipboard".to_string()),
                paste_result: Ok(()),
                scheduled_restores: Vec::new(),
                waits: Vec::new(),
                clipboard_texts: Vec::new(),
            }
        }
    }

    impl InsertIo for FakeInsertIo {
        fn write_clipboard(&mut self, text: &str) -> Result<(), String> {
            self.clipboard_texts.push(text.to_string());
            self.clipboard_result.clone()
        }

        fn read_clipboard_text(&mut self) -> Option<String> {
            self.clipboard_read.clone()
        }

        fn paste_from_clipboard(&mut self) -> Result<(), String> {
            self.paste_result.clone()
        }

        fn schedule_clipboard_restore(&mut self, text: Option<String>, delay_ms: u64) {
            self.scheduled_restores.push((text, delay_ms));
        }

        fn wait_before_paste(&mut self, delay_ms: u64) {
            self.waits.push(delay_ms);
        }
    }

    #[test]
    fn adds_trailing_space_after_terminal_punctuation() {
        assert_eq!(format_text_for_insert("Hello."), "Hello. ");
        assert_eq!(format_text_for_insert("Hello"), "Hello");
    }

    #[test]
    fn direct_paste_path_is_testable_without_os_clipboard() {
        let mut io = FakeInsertIo::direct_paste();
        let result = execute_insert_request_with_io(
            NativeInsertRequest {
                text: "Hello world".to_string(),
                source: Some("test".to_string()),
                corrected: Some(false),
                auto_paste: Some(true),
            },
            &NativeInsertionConfig {
                auto_paste: true,
                paste_delay_ms: 5,
            },
            1,
            false,
            &mut io,
        );

        assert!(result.ok);
        assert_eq!(result.insert_mode, NativeInsertMode::DirectPaste);
        assert_eq!(io.waits, vec![5]);
        assert_eq!(io.clipboard_texts, vec!["Hello world".to_string()]);
        assert_eq!(
            io.scheduled_restores,
            vec![(Some("Previous clipboard".to_string()), CLIPBOARD_RESTORE_DELAY_MS)]
        );
    }

    #[test]
    fn clipboard_fallback_surfaces_auto_paste_failure() {
        let mut io = FakeInsertIo {
            clipboard_result: Ok(()),
            clipboard_read: Some("Previous clipboard".to_string()),
            paste_result: Err("Target app blocked paste".to_string()),
            scheduled_restores: Vec::new(),
            waits: Vec::new(),
            clipboard_texts: Vec::new(),
        };
        let result = execute_insert_request_with_io(
            NativeInsertRequest {
                text: "Hello world".to_string(),
                source: Some("test".to_string()),
                corrected: Some(false),
                auto_paste: Some(true),
            },
            &NativeInsertionConfig {
                auto_paste: true,
                paste_delay_ms: 0,
            },
            1,
            false,
            &mut io,
        );

        assert!(!result.ok);
        assert_eq!(result.insert_mode, NativeInsertMode::ClipboardFallback);
        assert!(result.fallback_available);
        assert_eq!(result.error.as_deref(), Some("Target app blocked paste"));
        assert!(io.scheduled_restores.is_empty());
    }

    #[test]
    fn macos_platform_status_exposes_permission_diagnostics() {
        if !cfg!(target_os = "macos") {
            return;
        }

        let status = platform_status(true);

        assert_eq!(status.platform_label, "macOS");
        assert!(status
            .prerequisites
            .iter()
            .any(|item| item.contains("Accessibility")));
        assert!(status
            .prerequisites
            .iter()
            .any(|item| item.contains("Input Monitoring")));
        assert!(status
            .caveats
            .iter()
            .any(|item| item.contains("Terminal") || item.contains("VS Code")));
    }
}
