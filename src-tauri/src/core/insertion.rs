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
use super::sessions::now_ms;

const CLIPBOARD_RESTORE_DELAY_MS: u64 = 180;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum NativeInsertDriver {
    WlCopy,
    Arboard,
    Xdotool,
    Wtype,
    Ydotool,
    Enigo,
    Scratchpad,
}

impl NativeInsertDriver {
    fn label(self) -> &'static str {
        match self {
            Self::WlCopy => "wl-copy",
            Self::Arboard => "arboard clipboard",
            Self::Xdotool => "xdotool",
            Self::Wtype => "wtype",
            Self::Ydotool => "ydotool",
            Self::Enigo => "enigo",
            Self::Scratchpad => "scratchpad recovery",
        }
    }

    fn role(self) -> &'static str {
        match self {
            Self::WlCopy | Self::Arboard => "clipboard",
            Self::Xdotool | Self::Wtype | Self::Ydotool | Self::Enigo => "paste",
            Self::Scratchpad => "recovery",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeInsertDriverStatus {
    pub driver: NativeInsertDriver,
    pub label: String,
    pub role: String,
    pub available: bool,
    pub active: bool,
    pub detail: String,
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct NativeInsertPlatformContext {
    pub auto_paste: bool,
    pub is_wayland: bool,
    pub has_x11_display: bool,
    pub has_wl_copy: bool,
    pub has_xdotool: bool,
    pub has_wtype: bool,
    pub has_ydotool: bool,
}

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
    pub active_driver: NativeInsertDriver,
    pub clipboard_written: bool,
    pub paste_attempted: bool,
    pub pasted: bool,
    pub fallback_reason: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct NativeInsertResult {
    pub ok: bool,
    pub text: String,
    pub insert_mode: NativeInsertMode,
    pub active_driver: NativeInsertDriver,
    pub clipboard_written: bool,
    pub paste_attempted: bool,
    pub pasted: bool,
    pub scratchpad_entry: ScratchpadEntry,
    pub fallback_available: bool,
    pub fallback_reason: Option<String>,
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
    pub active_driver: NativeInsertDriver,
    pub support_message: String,
    pub driver_chain: Vec<NativeInsertDriverStatus>,
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
    fn write_clipboard_with_driver(
        &mut self,
        driver: NativeInsertDriver,
        text: &str,
    ) -> Result<(), String>;
    fn read_clipboard_text(&mut self) -> Option<String>;
    fn paste_with_driver(&mut self, driver: NativeInsertDriver) -> Result<(), String>;
    fn schedule_clipboard_restore(&mut self, text: Option<String>, delay_ms: u64);
    fn wait_before_paste(&mut self, delay_ms: u64);
}

struct SystemInsertIo;

impl InsertIo for SystemInsertIo {
    fn write_clipboard_with_driver(
        &mut self,
        driver: NativeInsertDriver,
        text: &str,
    ) -> Result<(), String> {
        match driver {
            NativeInsertDriver::WlCopy => write_wayland_clipboard(text),
            NativeInsertDriver::Arboard => write_clipboard_with_arboard(text),
            _ => Err(format!("{} is not a clipboard driver.", driver.label())),
        }
    }

    fn read_clipboard_text(&mut self) -> Option<String> {
        read_clipboard_text()
    }

    fn paste_with_driver(&mut self, driver: NativeInsertDriver) -> Result<(), String> {
        match driver {
            NativeInsertDriver::Xdotool => {
                paste_with_command("xdotool", &["key", "--clearmodifiers", "ctrl+v"], false)
            }
            NativeInsertDriver::Wtype => {
                paste_with_command("wtype", &["-M", "ctrl", "-k", "v", "-m", "ctrl"], true)
            }
            NativeInsertDriver::Ydotool => {
                paste_with_command("ydotool", &["key", "29:1", "47:1", "47:0", "29:0"], false)
            }
            NativeInsertDriver::Enigo => paste_with_enigo(),
            _ => Err(format!("{} is not a paste driver.", driver.label())),
        }
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
        let auto_paste = request.auto_paste.unwrap_or(self.config.auto_paste);
        let result = execute_insert_request_with_io(
            request,
            &self.config,
            self.entries.len() + 1,
            detect_insert_platform_context(auto_paste),
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
    platform: NativeInsertPlatformContext,
    io: &mut impl InsertIo,
) -> NativeInsertResult {
    let source = request
        .source
        .unwrap_or_else(|| "native_insert".to_string());
    let corrected = request.corrected.unwrap_or(false);
    let insert_text = format_text_for_insert(&request.text);
    let auto_paste = platform.auto_paste;
    let previous_clipboard_text = auto_paste.then(|| io.read_clipboard_text()).flatten();
    let mut clipboard_written = false;
    let mut paste_attempted = false;
    let mut pasted = false;
    let mut error = None;
    let mut fallback_reason = None;
    let mut active_driver = NativeInsertDriver::Scratchpad;

    match run_clipboard_driver_chain(&platform, &insert_text, io) {
        Ok(driver) => {
            clipboard_written = true;
            active_driver = driver;
        }
        Err(cause) => {
            error = Some(cause.clone());
            fallback_reason = Some(cause);
        }
    }

    let insert_mode = if !clipboard_written {
        active_driver = NativeInsertDriver::Scratchpad;
        NativeInsertMode::ScratchpadFallback
    } else if !auto_paste {
        NativeInsertMode::ClipboardOnly
    } else {
        paste_attempted = true;
        io.wait_before_paste(config.paste_delay_ms);
        match run_paste_driver_chain(&platform, io) {
            Ok(driver) => {
                pasted = true;
                active_driver = driver;
                io.schedule_clipboard_restore(
                    previous_clipboard_text,
                    CLIPBOARD_RESTORE_DELAY_MS,
                );
                NativeInsertMode::DirectPaste
            }
            Err(cause) => {
                error = Some(cause.clone());
                fallback_reason = Some(cause);
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
        active_driver,
        clipboard_written,
        paste_attempted,
        pasted,
        fallback_reason: fallback_reason.clone(),
        error: error.clone(),
    };

    NativeInsertResult {
        ok: clipboard_written
            && (!auto_paste || pasted || matches!(insert_mode, NativeInsertMode::ClipboardOnly)),
        text: insert_text,
        insert_mode,
        active_driver,
        clipboard_written,
        paste_attempted,
        pasted,
        scratchpad_entry: entry,
        fallback_available: true,
        fallback_reason,
        error,
    }
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
    if let Err(error) = write_clipboard_with_system_chain(&text) {
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

fn detect_insert_platform_context(auto_paste: bool) -> NativeInsertPlatformContext {
    NativeInsertPlatformContext {
        auto_paste,
        is_wayland: is_wayland_session(),
        has_x11_display: cfg!(target_os = "linux") && std::env::var_os("DISPLAY").is_some(),
        has_wl_copy: cfg!(target_os = "linux") && command_in_path("wl-copy"),
        has_xdotool: cfg!(target_os = "linux") && command_in_path("xdotool"),
        has_wtype: cfg!(target_os = "linux") && command_in_path("wtype"),
        has_ydotool: cfg!(target_os = "linux") && command_in_path("ydotool"),
    }
}

fn write_clipboard_with_system_chain(text: &str) -> Result<NativeInsertDriver, String> {
    let mut io = SystemInsertIo;
    run_clipboard_driver_chain(&detect_insert_platform_context(false), text, &mut io)
}

fn run_clipboard_driver_chain(
    platform: &NativeInsertPlatformContext,
    text: &str,
    io: &mut impl InsertIo,
) -> Result<NativeInsertDriver, String> {
    let mut errors = Vec::new();

    for driver in clipboard_driver_execution_chain(platform) {
        match io.write_clipboard_with_driver(driver, text) {
            Ok(()) => {
                runtime_log::record(format!(
                    "[WordScript] Native insert clipboard strategy={} auto_paste={}",
                    driver.label(),
                    platform.auto_paste,
                ));
                return Ok(driver);
            }
            Err(error) => errors.push(format!("{}: {error}", driver.label())),
        }
    }

    Err(errors.join("; "))
}

fn run_paste_driver_chain(
    platform: &NativeInsertPlatformContext,
    io: &mut impl InsertIo,
) -> Result<NativeInsertDriver, String> {
    let mut errors = Vec::new();
    let started_at = Instant::now();
    let execution_chain = paste_driver_execution_chain(platform);

    if execution_chain.is_empty() {
        return Err(no_available_paste_driver_reason(platform));
    }

    for driver in execution_chain {
        match io.paste_with_driver(driver) {
            Ok(()) => {
            runtime_log::record(format!(
                "[WordScript] Native insert paste strategy={} elapsed_ms={}",
                driver.label(),
                started_at.elapsed().as_millis(),
            ));
                return Ok(driver);
            }
            Err(error) => errors.push(format!("{}: {error}", driver.label())),
        }
    }

    Err(errors.join("; "))
}

fn clipboard_driver_execution_chain(
    platform: &NativeInsertPlatformContext,
) -> Vec<NativeInsertDriver> {
    let mut chain = Vec::new();

    if cfg!(target_os = "linux") && platform.is_wayland && platform.has_wl_copy {
        chain.push(NativeInsertDriver::WlCopy);
    }

    chain.push(NativeInsertDriver::Arboard);
    chain
}

fn paste_driver_execution_chain(platform: &NativeInsertPlatformContext) -> Vec<NativeInsertDriver> {
    if cfg!(target_os = "windows") || cfg!(target_os = "macos") {
        return vec![NativeInsertDriver::Enigo];
    }

    let mut chain = Vec::new();

    if platform.has_x11_display && platform.has_xdotool {
        chain.push(NativeInsertDriver::Xdotool);
        if platform.is_wayland {
            return chain;
        }
    }

    if platform.is_wayland {
        if platform.has_wtype {
            chain.push(NativeInsertDriver::Wtype);
        }
        if platform.has_ydotool {
            chain.push(NativeInsertDriver::Ydotool);
        }
        chain.push(NativeInsertDriver::Enigo);
        return chain;
    }

    chain.push(NativeInsertDriver::Enigo);
    chain
}

fn no_available_paste_driver_reason(platform: &NativeInsertPlatformContext) -> String {
    if cfg!(target_os = "linux") && platform.is_wayland {
        if platform.has_x11_display {
            return "No usable paste driver available: xdotool is missing in PATH for the active XWayland lane.".to_string();
        }

        return "No usable paste driver available: install wtype or ydotool, or keep clipboard-only recovery enabled on Wayland.".to_string();
    }

    if cfg!(target_os = "linux") {
        return "No usable paste driver available: install xdotool or fall back to clipboard-only recovery on Linux.".to_string();
    }

    "No usable paste driver available for this platform path.".to_string()
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
    platform_status_from_context(detect_insert_platform_context(auto_paste))
}

fn platform_status_from_context(platform: NativeInsertPlatformContext) -> NativeInsertionPlatformStatus {
    let active_driver = preferred_active_driver(&platform);
    let driver_chain = build_driver_chain(&platform, active_driver);

    if cfg!(target_os = "windows") {
        NativeInsertionPlatformStatus {
            platform_label: "Windows".to_string(),
            support_tier: NativeSupportTier::Tier1,
            insert_strategy: if platform.auto_paste {
                NativeInsertMode::DirectPaste
            } else {
                NativeInsertMode::ClipboardOnly
            },
            active_driver,
            support_message: if platform.auto_paste {
                "Tier-1 path: direct auto-paste is the default, and the scratchpad keeps a recovery copy if insertion still fails.".to_string()
            } else {
                "Tier-1 path with manual paste: WordScript writes to the clipboard and keeps a scratchpad recovery copy.".to_string()
            },
            driver_chain,
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
            insert_strategy: if platform.auto_paste {
                NativeInsertMode::DirectPaste
            } else {
                NativeInsertMode::ClipboardOnly
            },
            active_driver,
            support_message: if platform.auto_paste {
                "Tier-1 path: direct Cmd+V auto-paste is the default, and the scratchpad keeps a recovery copy if the target app blocks insertion.".to_string()
            } else {
                "Tier-1 path with manual paste: WordScript writes to the clipboard and keeps a scratchpad recovery copy.".to_string()
            },
            driver_chain,
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
    } else if platform.is_wayland {
        NativeInsertionPlatformStatus {
            platform_label: "Linux Wayland".to_string(),
            support_tier: NativeSupportTier::Experimental,
            insert_strategy: if platform.auto_paste {
                NativeInsertMode::ClipboardFallback
            } else {
                NativeInsertMode::ClipboardOnly
            },
            active_driver,
            support_message: if platform.auto_paste {
                format!(
                    "Experimental path: WordScript writes through {}, then tries {} before falling back to clipboard and scratchpad recovery.",
                    preferred_clipboard_driver(&platform).label(),
                    preferred_paste_driver_label(&platform),
                )
            } else {
                "Experimental path with manual paste: WordScript writes to the clipboard and keeps a scratchpad recovery copy.".to_string()
            },
            driver_chain,
            prerequisites: vec![
                wayland_prerequisite_message(&platform),
                "Keep clipboard-only recovery enabled if your desktop blocks direct insert.".to_string(),
            ],
            caveats: vec![
                if platform.has_x11_display && platform.has_xdotool {
                    "Hybrid X11/Wayland sessions stay on the xdotool lane first; WordScript skips extra fake-input helpers there to avoid compositor permission prompts.".to_string()
                } else {
                    "Behavior can differ between compositors, portal setups, and XWayland fallback paths on the same distro.".to_string()
                },
                "Behavior can differ between compositors, portal setups, and XWayland fallback paths on the same distro.".to_string(),
            ],
        }
    } else {
        NativeInsertionPlatformStatus {
            platform_label: "Linux X11".to_string(),
            support_tier: NativeSupportTier::Preview,
            insert_strategy: if platform.auto_paste {
                NativeInsertMode::DirectPaste
            } else {
                NativeInsertMode::ClipboardOnly
            },
            active_driver,
            support_message: if platform.auto_paste {
                format!(
                    "Preview path: WordScript writes through {}, then prefers {} for direct paste on X11 before falling back to clipboard and scratchpad recovery.",
                    preferred_clipboard_driver(&platform).label(),
                    preferred_paste_driver_label(&platform),
                )
            } else {
                "Preview path with manual paste: WordScript writes to the clipboard and keeps a scratchpad recovery copy.".to_string()
            },
            driver_chain,
            prerequisites: vec![
                "Run under X11 or XWayland if you want the current direct paste path.".to_string(),
                if platform.has_xdotool {
                    "xdotool is available for the active X11 lane.".to_string()
                } else {
                    "Install xdotool if you want the preferred X11 paste helper instead of the enigo fallback.".to_string()
                },
                "Keep clipboard recovery enabled for apps that do not accept synthetic paste consistently.".to_string(),
            ],
            caveats: vec![
                "Window manager quirks still make Linux less uniform than the Windows and macOS paths.".to_string(),
            ],
        }
    }
}

fn preferred_active_driver(platform: &NativeInsertPlatformContext) -> NativeInsertDriver {
    if platform.auto_paste {
        if let Some(driver) = paste_driver_execution_chain(platform)
            .into_iter()
            .find(|driver| !platform.is_wayland || !matches!(driver, NativeInsertDriver::Enigo))
        {
            return driver;
        }
    }

    if let Some(driver) = clipboard_driver_execution_chain(platform).into_iter().next() {
        return driver;
    }

    NativeInsertDriver::Scratchpad
}

fn preferred_clipboard_driver(platform: &NativeInsertPlatformContext) -> NativeInsertDriver {
    clipboard_driver_execution_chain(platform)
        .into_iter()
        .next()
        .unwrap_or(NativeInsertDriver::Scratchpad)
}

fn preferred_paste_driver_label(platform: &NativeInsertPlatformContext) -> &'static str {
    paste_driver_execution_chain(platform)
        .into_iter()
        .next()
        .unwrap_or(NativeInsertDriver::Scratchpad)
        .label()
}

fn wayland_prerequisite_message(platform: &NativeInsertPlatformContext) -> String {
    if platform.has_x11_display && platform.has_xdotool {
        return "XWayland is available, so WordScript prefers xdotool for the active hybrid session.".to_string();
    }

    let mut helpers = Vec::new();
    if !platform.has_wtype {
        helpers.push("wtype");
    }
    if !platform.has_ydotool {
        helpers.push("ydotool");
    }

    if helpers.is_empty() {
        "Wayland helper tools are present, but compositor policy still decides whether synthetic paste can work at all.".to_string()
    } else {
        format!(
            "Wayland helper tools and compositor policy decide whether synthetic paste can work at all. Missing today: {}.",
            helpers.join(", "),
        )
    }
}

fn build_driver_chain(
    platform: &NativeInsertPlatformContext,
    active_driver: NativeInsertDriver,
) -> Vec<NativeInsertDriverStatus> {
    if cfg!(target_os = "windows") || cfg!(target_os = "macos") {
        return vec![
            driver_status(
                NativeInsertDriver::Arboard,
                true,
                active_driver,
                "Clipboard handoff before any paste shortcut runs.",
            ),
            driver_status(
                NativeInsertDriver::Enigo,
                true,
                active_driver,
                "Synthetic paste shortcut for the active target app.",
            ),
            driver_status(
                NativeInsertDriver::Scratchpad,
                true,
                active_driver,
                "Disk-backed recovery if clipboard or paste fails.",
            ),
        ];
    }

    if platform.is_wayland {
        let hybrid_lane = platform.has_x11_display && platform.has_xdotool;
        let mut statuses = vec![
            driver_status(
                NativeInsertDriver::WlCopy,
                platform.has_wl_copy,
                active_driver,
                if platform.has_wl_copy {
                    "Preferred Wayland clipboard writer when wl-copy is installed."
                } else {
                    "wl-copy is not available in PATH for the active Wayland session."
                },
            ),
            driver_status(
                NativeInsertDriver::Arboard,
                true,
                active_driver,
                "Generic clipboard writer fallback via arboard.",
            ),
            driver_status(
                NativeInsertDriver::Xdotool,
                hybrid_lane,
                active_driver,
                if hybrid_lane {
                    "Preferred paste helper for hybrid X11/Wayland sessions."
                } else if platform.has_x11_display {
                    "DISPLAY is present but xdotool is missing in PATH."
                } else {
                    "XWayland is not active, so xdotool is not part of this Wayland lane."
                },
            ),
            driver_status(
                NativeInsertDriver::Wtype,
                !hybrid_lane && platform.has_wtype,
                active_driver,
                if hybrid_lane {
                    "Skipped in hybrid X11/Wayland sessions to avoid compositor fake-input prompts after xdotool."
                } else if platform.has_wtype {
                    "Wayland-native paste helper for compositors that allow virtual keyboard input."
                } else {
                    "wtype is not available in PATH."
                },
            ),
            driver_status(
                NativeInsertDriver::Ydotool,
                !hybrid_lane && platform.has_ydotool,
                active_driver,
                if hybrid_lane {
                    "Skipped in hybrid X11/Wayland sessions to avoid extra fake-input prompts after xdotool."
                } else if platform.has_ydotool {
                    "Wayland fallback helper when ydotool and its daemon are available."
                } else {
                    "ydotool is not available in PATH."
                },
            ),
            driver_status(
                NativeInsertDriver::Enigo,
                !hybrid_lane,
                active_driver,
                if hybrid_lane {
                    "Skipped in the hybrid lane; clipboard and scratchpad recovery take over after xdotool failures."
                } else {
                    "Last-resort synthetic paste helper after the dedicated Linux tools."
                },
            ),
        ];
        statuses.push(driver_status(
            NativeInsertDriver::Scratchpad,
            true,
            active_driver,
            "Disk-backed recovery if every clipboard or paste helper fails.",
        ));
        return statuses;
    }

    vec![
        driver_status(
            NativeInsertDriver::Arboard,
            true,
            active_driver,
            "Clipboard writer for the X11 path.",
        ),
        driver_status(
            NativeInsertDriver::Xdotool,
            platform.has_xdotool,
            active_driver,
            if platform.has_xdotool {
                "Preferred X11 paste helper."
            } else {
                "xdotool is not available in PATH."
            },
        ),
        driver_status(
            NativeInsertDriver::Enigo,
            true,
            active_driver,
            "Fallback synthetic paste helper if xdotool is unavailable or rejected.",
        ),
        driver_status(
            NativeInsertDriver::Scratchpad,
            true,
            active_driver,
            "Disk-backed recovery if clipboard or paste fails.",
        ),
    ]
}

fn driver_status(
    driver: NativeInsertDriver,
    available: bool,
    active_driver: NativeInsertDriver,
    detail: &str,
) -> NativeInsertDriverStatus {
    NativeInsertDriverStatus {
        driver,
        label: driver.label().to_string(),
        role: driver.role().to_string(),
        available,
        active: driver == active_driver,
        detail: detail.to_string(),
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
    use std::collections::HashMap;

    struct FakeInsertIo {
        clipboard_results: HashMap<NativeInsertDriver, Result<(), String>>,
        clipboard_read: Option<String>,
        paste_results: HashMap<NativeInsertDriver, Result<(), String>>,
        scheduled_restores: Vec<(Option<String>, u64)>,
        waits: Vec<u64>,
        clipboard_texts: Vec<String>,
        clipboard_drivers: Vec<NativeInsertDriver>,
        paste_drivers: Vec<NativeInsertDriver>,
    }

    impl FakeInsertIo {
        fn direct_paste() -> Self {
            let mut clipboard_results = HashMap::new();
            clipboard_results.insert(NativeInsertDriver::Arboard, Ok(()));
            let mut paste_results = HashMap::new();
            paste_results.insert(NativeInsertDriver::Enigo, Ok(()));

            Self {
                clipboard_results,
                clipboard_read: Some("Previous clipboard".to_string()),
                paste_results,
                scheduled_restores: Vec::new(),
                waits: Vec::new(),
                clipboard_texts: Vec::new(),
                clipboard_drivers: Vec::new(),
                paste_drivers: Vec::new(),
            }
        }
    }

    impl InsertIo for FakeInsertIo {
        fn write_clipboard_with_driver(
            &mut self,
            driver: NativeInsertDriver,
            text: &str,
        ) -> Result<(), String> {
            self.clipboard_drivers.push(driver);
            self.clipboard_texts.push(text.to_string());
            self.clipboard_results
                .get(&driver)
                .cloned()
                .unwrap_or_else(|| Err(format!("{} missing fake clipboard result", driver.label())))
        }

        fn read_clipboard_text(&mut self) -> Option<String> {
            self.clipboard_read.clone()
        }

        fn paste_with_driver(&mut self, driver: NativeInsertDriver) -> Result<(), String> {
            self.paste_drivers.push(driver);
            self.paste_results
                .get(&driver)
                .cloned()
                .unwrap_or_else(|| Err(format!("{} missing fake paste result", driver.label())))
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
            NativeInsertPlatformContext {
                auto_paste: true,
                is_wayland: false,
                has_x11_display: false,
                has_wl_copy: false,
                has_xdotool: false,
                has_wtype: false,
                has_ydotool: false,
            },
            &mut io,
        );

        assert!(result.ok);
        assert_eq!(result.insert_mode, NativeInsertMode::DirectPaste);
        assert_eq!(result.active_driver, NativeInsertDriver::Enigo);
        assert_eq!(io.waits, vec![5]);
        assert_eq!(io.clipboard_texts, vec!["Hello world".to_string()]);
        assert_eq!(io.clipboard_drivers, vec![NativeInsertDriver::Arboard]);
        assert_eq!(io.paste_drivers, vec![NativeInsertDriver::Enigo]);
        assert_eq!(
            io.scheduled_restores,
            vec![(Some("Previous clipboard".to_string()), CLIPBOARD_RESTORE_DELAY_MS)]
        );
    }

    #[test]
    fn clipboard_fallback_surfaces_auto_paste_failure() {
        let mut clipboard_results = HashMap::new();
        clipboard_results.insert(NativeInsertDriver::Arboard, Ok(()));
        let mut paste_results = HashMap::new();
        paste_results.insert(
            NativeInsertDriver::Wtype,
            Err("Target app blocked paste".to_string()),
        );
        paste_results.insert(
            NativeInsertDriver::Ydotool,
            Err("ydotool daemon unavailable".to_string()),
        );
        paste_results.insert(
            NativeInsertDriver::Enigo,
            Err("Enigo input adapter unavailable".to_string()),
        );

        let mut io = FakeInsertIo {
            clipboard_results,
            clipboard_read: Some("Previous clipboard".to_string()),
            paste_results,
            scheduled_restores: Vec::new(),
            waits: Vec::new(),
            clipboard_texts: Vec::new(),
            clipboard_drivers: Vec::new(),
            paste_drivers: Vec::new(),
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
            NativeInsertPlatformContext {
                auto_paste: true,
                is_wayland: true,
                has_x11_display: false,
                has_wl_copy: false,
                has_xdotool: false,
                has_wtype: true,
                has_ydotool: true,
            },
            &mut io,
        );

        assert!(!result.ok);
        assert_eq!(result.insert_mode, NativeInsertMode::ClipboardFallback);
        assert!(result.fallback_available);
        assert_eq!(result.active_driver, NativeInsertDriver::Arboard);
        assert_eq!(
            result.fallback_reason.as_deref(),
            Some(
                "wtype: Target app blocked paste; ydotool: ydotool daemon unavailable; enigo: Enigo input adapter unavailable"
            )
        );
        assert!(io.scheduled_restores.is_empty());
    }

    #[test]
    fn wayland_platform_status_names_missing_helpers_in_driver_chain() {
        let status = platform_status_from_context(NativeInsertPlatformContext {
            auto_paste: true,
            is_wayland: true,
            has_x11_display: false,
            has_wl_copy: false,
            has_xdotool: false,
            has_wtype: false,
            has_ydotool: false,
        });

        assert_eq!(status.platform_label, "Linux Wayland");
        assert_eq!(status.active_driver, NativeInsertDriver::Arboard);
        assert!(status
            .driver_chain
            .iter()
            .any(|item| item.driver == NativeInsertDriver::Wtype && item.detail.contains("wtype")));
        assert!(status
            .prerequisites
            .iter()
            .any(|item| item.contains("Missing today: wtype, ydotool")));
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
