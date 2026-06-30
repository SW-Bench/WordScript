use std::{
    str::FromStr,
    sync::Mutex,
    time::{Duration, Instant},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime, State};
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutEvent, ShortcutState,
};

use super::capture::NativeCaptureState;
use super::config::{AppConfig, ProcessingMode};
use super::sessions::{NativeSessionStage, NativeSessionState};

const DEFAULT_DEBOUNCE_MS: u64 = 300;
const DEFAULT_HOLD_MIN_MS: u64 = 300;

/// Processing-mode hotkeys sourced from `AppConfig`. Each entry is either a
/// normalized shortcut string (e.g. `"Ctrl+Alt+M"`) or empty when the user has
/// disabled that particular hotkey.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModeHotkeys {
    pub picker: String,
    pub auto: String,
    pub verbatim: String,
    pub cleanup: String,
    pub rewrite: String,
    pub agent: String,
    pub prompt_enhance: String,
}

impl ModeHotkeys {
    /// Loads all mode hotkeys from a persisted `AppConfig`. The values
    /// are already normalized on save, but normalization is idempotent so we
    /// re-run it defensively against the platform defaults (empty strings pass
    /// through as empty — meaning "disabled").
    fn from_app_config(config: &AppConfig) -> Self {
        Self {
            picker: config.mode_picker_hotkey.clone(),
            auto: config.mode_auto_hotkey.clone(),
            verbatim: config.mode_verbatim_hotkey.clone(),
            cleanup: config.mode_cleanup_hotkey.clone(),
            rewrite: config.mode_rewrite_hotkey.clone(),
            agent: config.mode_agent_hotkey.clone(),
            prompt_enhance: config.mode_prompt_enhance_hotkey.clone(),
        }
    }

    /// Returns the hotkey string for a direct per-mode jump.
    fn for_mode(&self, mode: ProcessingMode) -> &str {
        match mode {
            ProcessingMode::Auto => &self.auto,
            ProcessingMode::Verbatim => &self.verbatim,
            ProcessingMode::Cleanup => &self.cleanup,
            ProcessingMode::Rewrite => &self.rewrite,
            ProcessingMode::Agent => &self.agent,
            ProcessingMode::PromptEnhance => &self.prompt_enhance,
        }
    }

    /// Iterates over all non-empty mode hotkeys together with a label describing
    /// their semantic role. Used by the registration loop and the idempotency /
    /// collision checks.
    fn entries(&self) -> Vec<(&'static str, &str)> {
        let mut out = Vec::new();
        if !self.picker.is_empty() {
            out.push(("mode_picker", self.picker.as_str()));
        }
        for (mode, hotkey) in [
            (ProcessingMode::Auto, &self.auto),
            (ProcessingMode::Verbatim, &self.verbatim),
            (ProcessingMode::Cleanup, &self.cleanup),
            (ProcessingMode::Rewrite, &self.rewrite),
            (ProcessingMode::Agent, &self.agent),
            (ProcessingMode::PromptEnhance, &self.prompt_enhance),
        ] {
            if !hotkey.is_empty() {
                out.push((mode.as_str(), hotkey.as_str()));
            }
        }
        out
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NativeActivationMode {
    Tap,
    Hold,
}

impl NativeActivationMode {
    fn from_config(value: &str) -> Self {
        if value.eq_ignore_ascii_case("hold") {
            Self::Hold
        } else {
            Self::Tap
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeTriggerConfig {
    pub hotkey: String,
    pub pause_hotkey: String,
    pub abort_hotkey: String,
    pub activation_mode: NativeActivationMode,
    pub enabled: bool,
    pub debounce_ms: u64,
    pub hold_min_ms: u64,
    #[serde(default)]
    pub mode_hotkeys: ModeHotkeys,
}

impl Default for NativeTriggerConfig {
    fn default() -> Self {
        Self {
            hotkey: default_hotkey(),
            pause_hotkey: default_pause_hotkey(),
            abort_hotkey: default_abort_hotkey(),
            activation_mode: NativeActivationMode::Tap,
            enabled: true,
            debounce_ms: DEFAULT_DEBOUNCE_MS,
            hold_min_ms: DEFAULT_HOLD_MIN_MS,
            mode_hotkeys: ModeHotkeys::default(),
        }
    }
}

impl NativeTriggerConfig {
    pub fn load_from_disk() -> Self {
        let app_config = AppConfig::load_from_disk();
        let mode_hotkeys = ModeHotkeys::from_app_config(&app_config);

        Self {
            hotkey: app_config.hotkey,
            pause_hotkey: app_config.pause_hotkey,
            abort_hotkey: app_config.abort_hotkey,
            activation_mode: NativeActivationMode::from_config(&app_config.activation_mode),
            mode_hotkeys,
            ..Self::default()
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ConfigureNativeTriggerRequest {
    pub hotkey: String,
    pub pause_hotkey: String,
    pub abort_hotkey: String,
    pub activation_mode: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct NativeTriggerStatus {
    pub configured: bool,
    pub enabled: bool,
    pub paused: bool,
    pub hotkey: String,
    pub pause_hotkey: String,
    pub abort_hotkey: String,
    pub registered_hotkey: Option<String>,
    pub registered_pause_hotkey: Option<String>,
    pub registered_abort_hotkey: Option<String>,
    pub activation_mode: NativeActivationMode,
    pub last_error: Option<String>,
    pub owner: String,
    /// Labels of mode hotkeys currently registered with the OS, together with
    /// their display string. Empty when no mode hotkeys are active. Lets the
    /// frontend show runtime truth instead of assuming registration succeeded.
    #[serde(default)]
    pub registered_mode_hotkeys: Vec<ModeHotkeyStatus>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ModeHotkeyStatus {
    pub label: String,
    pub display: String,
}

#[derive(Debug, Clone)]
struct RegisteredShortcutBinding {
    display: String,
    shortcuts: Vec<Shortcut>,
}

#[derive(Debug, Clone)]
pub enum TriggerEffect {
    StartCapture,
    StopCapture { session_id: String },
    TogglePause,
    AbortCapture,
    DeferredStop { hold_session: u64, delay_ms: u64 },
    /// Mode-select hotkey: toggle signal for the overlay. First press opens
    /// the overlay in the mode-select surface (current mode shown, tap to
    /// cycle). Second press cycles to the next mode persistently. The frontend
    /// owns the toggle state — Rust just emits the signal.
    ModeSelect,
    /// Jump directly to a specific processing mode (per-mode hotkey).
    SetModeDirect(ProcessingMode),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TapShortcutIntent {
    Start,
    Stop,
    Ignore,
}

#[derive(Debug)]
pub struct NativeTriggerState {
    config: NativeTriggerConfig,
    registered_hotkey: Option<String>,
    registered_pause_hotkey: Option<String>,
    registered_abort_hotkey: Option<String>,
    hotkey_ids: Vec<u32>,
    pause_hotkey_ids: Vec<u32>,
    abort_hotkey_ids: Vec<u32>,
    /// Maps each mode-hotkey label (e.g. `"mode_picker"`, or a
    /// processing-mode token like `"agent"`) to the registered shortcut IDs.
    /// Empty when no mode hotkeys are configured / registered.
    mode_hotkey_ids: std::collections::HashMap<String, Vec<u32>>,
    /// Mirrors `mode_hotkey_ids` but stores the human-readable display string
    /// for status reporting and idempotency checks.
    registered_mode_hotkeys: std::collections::HashMap<String, String>,
    paused: bool,
    hotkey_active: bool,
    tap_hotkey_down: bool,
    pause_active: bool,
    abort_active: bool,
    toggled_on: bool,
    hold_session: u64,
    hold_started_at: Option<Instant>,
    last_hotkey_press: Option<Instant>,
    last_tap_shortcut_intent: Option<TapShortcutIntent>,
    last_error: Option<String>,
}

impl Default for NativeTriggerState {
    fn default() -> Self {
        Self::new(NativeTriggerConfig::default())
    }
}

impl NativeTriggerState {
    pub fn new(config: NativeTriggerConfig) -> Self {
        Self {
            config,
            registered_hotkey: None,
            registered_pause_hotkey: None,
            registered_abort_hotkey: None,
            hotkey_ids: Vec::new(),
            pause_hotkey_ids: Vec::new(),
            abort_hotkey_ids: Vec::new(),
            mode_hotkey_ids: std::collections::HashMap::new(),
            registered_mode_hotkeys: std::collections::HashMap::new(),
            paused: false,
            hotkey_active: false,
            tap_hotkey_down: false,
            pause_active: false,
            abort_active: false,
            toggled_on: false,
            hold_session: 0,
            hold_started_at: None,
            last_hotkey_press: None,
            last_tap_shortcut_intent: None,
            last_error: None,
        }
    }

    fn status(&self) -> NativeTriggerStatus {
        NativeTriggerStatus {
            configured: !self.hotkey_ids.is_empty(),
            enabled: self.config.enabled,
            paused: self.paused,
            hotkey: self.config.hotkey.clone(),
            pause_hotkey: self.config.pause_hotkey.clone(),
            abort_hotkey: self.config.abort_hotkey.clone(),
            registered_hotkey: self.registered_hotkey.clone(),
            registered_pause_hotkey: self.registered_pause_hotkey.clone(),
            registered_abort_hotkey: self.registered_abort_hotkey.clone(),
            activation_mode: self.config.activation_mode.clone(),
            last_error: self.last_error.clone(),
            owner: "native_tauri_global_shortcut".to_string(),
            registered_mode_hotkeys: self
                .registered_mode_hotkeys
                .iter()
                .map(|(label, display)| ModeHotkeyStatus {
                    label: label.clone(),
                    display: display.clone(),
                })
                .collect(),
        }
    }
}

#[tauri::command]
pub fn native_trigger_status(
    state: State<'_, Mutex<NativeTriggerState>>,
) -> Result<NativeTriggerStatus, String> {
    let state = state.lock().map_err(|error| error.to_string())?;
    Ok(state.status())
}

#[tauri::command]
pub fn configure_native_trigger(
    app: AppHandle,
    request: ConfigureNativeTriggerRequest,
    state: State<'_, Mutex<NativeTriggerState>>,
) -> Result<NativeTriggerStatus, String> {
    // Preserve the existing mode hotkeys — configure_native_trigger only
    // changes the base capture hotkeys. Mode hotkeys are managed via the
    // config file (Settings → Modes) and re-loaded on the next startup or
    // config-reload registration call.
    let existing_mode_hotkeys = {
        let lock = state.lock().map_err(|error| error.to_string())?;
        lock.config.mode_hotkeys.clone()
    };

    let config = NativeTriggerConfig {
        hotkey: request.hotkey,
        pause_hotkey: request.pause_hotkey,
        abort_hotkey: request.abort_hotkey,
        activation_mode: NativeActivationMode::from_config(&request.activation_mode),
        enabled: true,
        debounce_ms: DEFAULT_DEBOUNCE_MS,
        hold_min_ms: DEFAULT_HOLD_MIN_MS,
        mode_hotkeys: existing_mode_hotkeys,
    };

    register_native_shortcuts(&app, state.inner(), config)
}

#[tauri::command]
pub fn pause_native_trigger(
    state: State<'_, Mutex<NativeTriggerState>>,
) -> Result<NativeTriggerStatus, String> {
    let mut state = state.lock().map_err(|error| error.to_string())?;
    state.paused = true;
    Ok(state.status())
}

#[tauri::command]
pub fn resume_native_trigger(
    state: State<'_, Mutex<NativeTriggerState>>,
) -> Result<NativeTriggerStatus, String> {
    let mut state = state.lock().map_err(|error| error.to_string())?;
    state.paused = false;
    Ok(state.status())
}

pub fn register_native_shortcuts<R: Runtime>(
    app: &AppHandle<R>,
    state: &Mutex<NativeTriggerState>,
    config: NativeTriggerConfig,
) -> Result<NativeTriggerStatus, String> {
    let hotkey = build_shortcut_binding(&config.hotkey, true)?;
    let mut pause_hotkey = build_shortcut_binding(&config.pause_hotkey, true)?;
    let mut abort_hotkey = build_shortcut_binding(&config.abort_hotkey, true)?;
    if abort_hotkey.display == hotkey.display {
        abort_hotkey = build_shortcut_binding(&default_abort_hotkey(), true)?;
    }
    if pause_hotkey.display == hotkey.display || pause_hotkey.display == abort_hotkey.display {
        pause_hotkey = build_shortcut_binding(&default_pause_hotkey(), true)?;
    }
    if pause_hotkey.display == hotkey.display || pause_hotkey.display == abort_hotkey.display {
        return Err("Pause hotkey must differ from Start / Stop and Abort hotkeys.".to_string());
    }

    // Reserved display strings (start / pause / abort). Mode hotkeys must not
    // collide with any of them.
    let reserved = [hotkey.display.clone(), pause_hotkey.display.clone(), abort_hotkey.display.clone()];

    // Parse all non-empty mode hotkeys and reject collisions with the reserved
    // set and with each other. Empty strings are skipped (hotkey disabled).
    let mut mode_bindings: Vec<(&'static str, RegisteredShortcutBinding)> = Vec::new();
    let mut seen_mode_displays: Vec<String> = Vec::new();
    for (label, raw) in config.mode_hotkeys.entries() {
        let binding = build_shortcut_binding(raw, true)?;
        if reserved.contains(&binding.display) {
            return Err(format!(
                "Mode hotkey '{}' ({}): must differ from Start / Stop / Pause / Abort hotkeys.",
                label, binding.display
            ));
        }
        if seen_mode_displays.contains(&binding.display) {
            return Err(format!(
                "Mode hotkey '{}' ({}): duplicate of another mode hotkey.",
                label, binding.display
            ));
        }
        seen_mode_displays.push(binding.display.clone());
        mode_bindings.push((label, binding));
    }

    let config = NativeTriggerConfig {
        hotkey: hotkey.display.clone(),
        pause_hotkey: pause_hotkey.display.clone(),
        abort_hotkey: abort_hotkey.display.clone(),
        ..config
    };

    // Idempotency guard: skip unregister/re-register when shortcuts haven't changed.
    // This prevents a brief gap where the shortcut is unregistered (and a user press
    // would be silently dropped) on every concurrent startup call from multiple windows.
    {
        let current = state.lock().map_err(|error| error.to_string())?;
        let base_unchanged = current.registered_hotkey.as_deref()
            == Some(hotkey.display.as_str())
            && current.registered_pause_hotkey.as_deref() == Some(pause_hotkey.display.as_str())
            && current.registered_abort_hotkey.as_deref() == Some(abort_hotkey.display.as_str())
            && !current.hotkey_ids.is_empty();

        let mode_unchanged = mode_bindings.iter().all(|(label, binding)| {
            current
                .registered_mode_hotkeys
                .get(*label)
                .map(|display| display == &binding.display)
                .unwrap_or(false)
        }) && current.registered_mode_hotkeys.len() == mode_bindings.len();

        if base_unchanged && mode_unchanged {
            drop(current);
            let mut state = state.lock().map_err(|error| error.to_string())?;
            state.config = config;
            sync_trigger_state_with_session(&mut state, active_session_stage(app));
            return Ok(state.status());
        }

        let mut old_shortcuts = Vec::new();
        let mut old_shortcut_ids = Vec::new();
        if let Some(value) = &current.registered_hotkey {
            if let Ok(binding) = build_shortcut_binding(value, true) {
                collect_unique_shortcuts(
                    &mut old_shortcuts,
                    &mut old_shortcut_ids,
                    &binding.shortcuts,
                );
            }
        }
        if let Some(value) = &current.registered_pause_hotkey {
            if let Ok(binding) = build_shortcut_binding(value, true) {
                collect_unique_shortcuts(
                    &mut old_shortcuts,
                    &mut old_shortcut_ids,
                    &binding.shortcuts,
                );
            }
        }
        if let Some(value) = &current.registered_abort_hotkey {
            if let Ok(binding) = build_shortcut_binding(value, true) {
                collect_unique_shortcuts(
                    &mut old_shortcuts,
                    &mut old_shortcut_ids,
                    &binding.shortcuts,
                );
            }
        }
        for value in current.registered_mode_hotkeys.values() {
            if let Ok(binding) = build_shortcut_binding(value, true) {
                collect_unique_shortcuts(
                    &mut old_shortcuts,
                    &mut old_shortcut_ids,
                    &binding.shortcuts,
                );
            }
        }
        drop(current);

        for shortcut in old_shortcuts {
            let _ = app.global_shortcut().unregister(shortcut);
        }
    }

    for shortcut in &hotkey.shortcuts {
        app.global_shortcut().register(*shortcut).map_err(|error| {
            format!(
                "Could not register native hotkey '{}': {error}",
                hotkey.display
            )
        })?;
    }

    for shortcut in &pause_hotkey.shortcuts {
        app.global_shortcut().register(*shortcut).map_err(|error| {
            format!(
                "Could not register native pause hotkey '{}': {error}",
                pause_hotkey.display
            )
        })?;
    }

    if abort_hotkey.display != hotkey.display {
        for shortcut in &abort_hotkey.shortcuts {
            app.global_shortcut().register(*shortcut).map_err(|error| {
                format!(
                    "Could not register native abort hotkey '{}': {error}",
                    abort_hotkey.display
                )
            })?;
        }
    }

    // Register every mode hotkey. A failure here is logged but does NOT abort
    // the whole registration — the base capture hotkeys are already live and
    // a single mode-hotkey collision with another app should not break dictation.
    let mut mode_hotkey_ids: std::collections::HashMap<String, Vec<u32>> =
        std::collections::HashMap::new();
    let mut registered_mode_hotkeys: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    for (label, binding) in &mode_bindings {
        let mut ids = Vec::new();
        for shortcut in &binding.shortcuts {
            match app.global_shortcut().register(*shortcut) {
                Ok(()) => ids.push(shortcut.id()),
                Err(error) => {
                    super::runtime_log::record(format!(
                        "[WordScript] Could not register mode hotkey '{}' ({}): {error}",
                        label, binding.display
                    ));
                }
            }
        }
        if !ids.is_empty() {
            mode_hotkey_ids.insert((*label).to_string(), ids);
            registered_mode_hotkeys.insert((*label).to_string(), binding.display.clone());
        }
    }

    let mut state = state.lock().map_err(|error| error.to_string())?;
    state.config = config;
    state.registered_hotkey = Some(hotkey.display);
    state.registered_pause_hotkey = Some(pause_hotkey.display);
    state.registered_abort_hotkey = Some(abort_hotkey.display);
    state.hotkey_ids = hotkey.shortcuts.iter().map(Shortcut::id).collect();
    state.pause_hotkey_ids = pause_hotkey.shortcuts.iter().map(Shortcut::id).collect();
    state.abort_hotkey_ids = abort_hotkey.shortcuts.iter().map(Shortcut::id).collect();
    state.mode_hotkey_ids = mode_hotkey_ids;
    state.registered_mode_hotkeys = registered_mode_hotkeys;
    state.pause_active = false;
    state.abort_active = false;
    state.tap_hotkey_down = false;
    state.last_tap_shortcut_intent = None;
    state.last_error = None;
    sync_trigger_state_with_session(&mut state, active_session_stage(app));
    Ok(state.status())
}

pub fn handle_global_shortcut_event<R: Runtime>(
    app: &AppHandle<R>,
    shortcut: &Shortcut,
    event: ShortcutEvent,
) -> Option<TriggerEffect> {
    let trigger_state = app.try_state::<Mutex<NativeTriggerState>>()?;
    let mut state = trigger_state.lock().ok()?;

    if !state.config.enabled || state.paused {
        return None;
    }

    let shortcut_id = shortcut.id();
    let is_abort = state.abort_hotkey_ids.contains(&shortcut_id);
    let is_pause = state.pause_hotkey_ids.contains(&shortcut_id);
    let is_hotkey = state.hotkey_ids.contains(&shortcut_id);

    // Mode hotkeys are fire-and-forget: they only act on the initial Press and
    // ignore Release. We look up which mode-hotkey label (if any) owns this
    // shortcut ID and map it to a TriggerEffect.
    let mode_hotkey_label: Option<&str> = state
        .mode_hotkey_ids
        .iter()
        .find(|(_, ids)| ids.contains(&shortcut_id))
        .map(|(label, _)| label.as_str());

    if !is_abort && !is_pause && !is_hotkey && mode_hotkey_label.is_none() {
        return None;
    }

    // Mode hotkeys fire on Press only and don't participate in the
    // capture start/stop state machine below.
    if let Some(label) = mode_hotkey_label {
        if event.state == ShortcutState::Pressed {
            let effect = match label {
                "mode_picker" => TriggerEffect::ModeSelect,
                other => {
                    let parsed = ProcessingMode::from_str(other);
                    TriggerEffect::SetModeDirect(parsed)
                }
            };
            drop(state);
            return Some(effect);
        }
        return None;
    }

    let session_stage = active_session_stage(app);
    let capture_is_recording = active_capture_is_recording(app);
    sync_trigger_state_with_session(&mut state, session_stage.clone());

    match event.state {
        ShortcutState::Pressed if is_abort => {
            if state.abort_active {
                return None;
            }
            state.abort_active = true;
            state.hotkey_active = false;
            state.tap_hotkey_down = false;
            state.toggled_on = false;
            state.hold_started_at = None;
            drop(state);
            abort_session(app, "Capture aborted by native abort shortcut.")
        }
        ShortcutState::Released if is_abort => {
            state.abort_active = false;
            None
        }
        ShortcutState::Pressed if is_pause => {
            if state.pause_active {
                return None;
            }
            state.pause_active = true;
            drop(state);
            Some(TriggerEffect::TogglePause)
        }
        ShortcutState::Released if is_pause => {
            state.pause_active = false;
            None
        }
        ShortcutState::Pressed if is_hotkey => {
            let now = Instant::now();

            match state.config.activation_mode {
                NativeActivationMode::Tap => {
                    if !begin_tap_press(&mut state) {
                        return None;
                    }
                    if tap_hotkey_uses_release_trigger(&state) {
                        state.last_tap_shortcut_intent = None;
                        return None;
                    }
                    let intent = match resolve_tap_shortcut_intent(
                        &mut state,
                        session_stage,
                        capture_is_recording,
                        now,
                    ) {
                        Some(intent) => intent,
                        None => return None,
                    };

                    drop(state);
                    apply_tap_shortcut_intent(app, intent, capture_is_recording)
                }
                NativeActivationMode::Hold => {
                    if state
                        .last_hotkey_press
                        .map(|last| {
                            now.duration_since(last)
                                < Duration::from_millis(state.config.debounce_ms)
                        })
                        .unwrap_or(false)
                    {
                        return None;
                    }
                    if state.hotkey_active {
                        return None;
                    }
                    state.last_hotkey_press = Some(now);
                    state.last_tap_shortcut_intent = None;
                    state.hotkey_active = true;
                    state.hold_session += 1;
                    state.hold_started_at = Some(now);
                    drop(state);
                    start_session(app, "native_hold_hotkey")
                }
            }
        }
        ShortcutState::Released if is_hotkey => {
            if state.config.activation_mode == NativeActivationMode::Tap {
                if !tap_hotkey_uses_release_trigger(&state) {
                    end_tap_press(&mut state);
                    state.last_tap_shortcut_intent = None;
                    return None;
                }

                if !state.tap_hotkey_down {
                    state.last_tap_shortcut_intent = None;
                    return None;
                }

                end_tap_press(&mut state);
                let now = Instant::now();
                let intent = match resolve_tap_shortcut_intent(
                    &mut state,
                    session_stage,
                    capture_is_recording,
                    now,
                ) {
                    Some(intent) => intent,
                    None => return None,
                };

                drop(state);
                return apply_tap_shortcut_intent(app, intent, capture_is_recording);
            }

            state.last_tap_shortcut_intent = None;
            if state.config.activation_mode != NativeActivationMode::Hold || !state.hotkey_active {
                return None;
            }
            state.hotkey_active = false;
            let held_for = state
                .hold_started_at
                .map(|start| start.elapsed())
                .unwrap_or_default();
            let min_hold = Duration::from_millis(state.config.hold_min_ms);
            let hold_session = state.hold_session;
            state.hold_started_at = None;

            if held_for >= min_hold {
                drop(state);
                stop_session(app, active_capture_is_recording(app))
            } else {
                Some(TriggerEffect::DeferredStop {
                    hold_session,
                    delay_ms: (min_hold - held_for).as_millis().min(u128::from(u64::MAX)) as u64,
                })
            }
        }
        _ => None,
    }
}

pub fn resolve_deferred_hold_stop<R: Runtime>(
    app: &AppHandle<R>,
    hold_session: u64,
) -> Option<TriggerEffect> {
    let trigger_state = app.try_state::<Mutex<NativeTriggerState>>()?;
    let state = trigger_state.lock().ok()?;
    if state.hold_session == hold_session
        && state.config.activation_mode == NativeActivationMode::Hold
    {
        drop(state);
        stop_session(app, active_capture_is_recording(app))
    } else {
        None
    }
}

fn start_session<R: Runtime>(app: &AppHandle<R>, trigger: &str) -> Option<TriggerEffect> {
    match super::sessions::start_from_native(app, trigger) {
        Ok(_) => Some(TriggerEffect::StartCapture),
        Err(error) => {
            super::sessions::fail_from_native_error(app, &error);
            None
        }
    }
}

fn stop_session<R: Runtime>(
    app: &AppHandle<R>,
    capture_is_recording: bool,
) -> Option<TriggerEffect> {
    match super::sessions::processing_or_recover_from_native(
        app,
        capture_is_recording,
        "native_capture_recovery",
    ) {
        Ok(status) => status
            .active_session_id
            .map(|session_id| TriggerEffect::StopCapture { session_id }),
        Err(error) => {
            super::sessions::fail_from_native_error(app, &error);
            None
        }
    }
}

fn abort_session<R: Runtime>(app: &AppHandle<R>, reason: &str) -> Option<TriggerEffect> {
    match super::sessions::abort_from_native(app, reason) {
        Ok(_) => Some(TriggerEffect::AbortCapture),
        Err(error) => {
            super::sessions::fail_from_native_error(app, &error);
            None
        }
    }
}

fn collect_unique_shortcuts(
    target: &mut Vec<Shortcut>,
    known_ids: &mut Vec<u32>,
    shortcuts: &[Shortcut],
) {
    for shortcut in shortcuts {
        let shortcut_id = shortcut.id();
        if !known_ids.contains(&shortcut_id) {
            known_ids.push(shortcut_id);
            target.push(*shortcut);
        }
    }
}

fn active_session_stage<R: Runtime>(app: &AppHandle<R>) -> Option<NativeSessionStage> {
    let session_state = app.try_state::<Mutex<NativeSessionState>>()?;
    let session_state = session_state.lock().ok()?;
    Some(session_state.status().stage)
}

fn active_capture_is_recording<R: Runtime>(app: &AppHandle<R>) -> bool {
    let Some(capture_state) = app.try_state::<Mutex<NativeCaptureState>>() else {
        return false;
    };

    capture_state
        .lock()
        .map(|state| state.is_recording())
        .unwrap_or(false)
}

fn tap_shortcut_intent(
    stage: Option<NativeSessionStage>,
    capture_is_recording: bool,
) -> TapShortcutIntent {
    if capture_is_recording {
        return TapShortcutIntent::Stop;
    }

    match stage {
        Some(NativeSessionStage::Capturing) => TapShortcutIntent::Stop,
        Some(NativeSessionStage::Processing) => TapShortcutIntent::Ignore,
        _ => TapShortcutIntent::Start,
    }
}

fn should_debounce_tap_press(
    last_press: Option<Instant>,
    debounce_ms: u64,
    last_intent: Option<TapShortcutIntent>,
    next_intent: TapShortcutIntent,
    now: Instant,
) -> bool {
    last_press
        .map(|last| now.duration_since(last) < Duration::from_millis(debounce_ms))
        .unwrap_or(false)
        && last_intent == Some(next_intent)
}

fn resolve_tap_shortcut_intent(
    state: &mut NativeTriggerState,
    session_stage: Option<NativeSessionStage>,
    capture_is_recording: bool,
    now: Instant,
) -> Option<TapShortcutIntent> {
    let intent = tap_shortcut_intent(session_stage, capture_is_recording);
    if should_debounce_tap_press(
        state.last_hotkey_press,
        state.config.debounce_ms,
        state.last_tap_shortcut_intent,
        intent,
        now,
    ) {
        return None;
    }

    state.last_hotkey_press = Some(now);
    state.last_tap_shortcut_intent = Some(intent);

    match intent {
        TapShortcutIntent::Stop => {
            state.toggled_on = false;
            state.hotkey_active = false;
        }
        TapShortcutIntent::Ignore => {}
        TapShortcutIntent::Start => {
            state.toggled_on = true;
            state.hotkey_active = true;
        }
    }

    Some(intent)
}

fn apply_tap_shortcut_intent<R: Runtime>(
    app: &AppHandle<R>,
    intent: TapShortcutIntent,
    capture_is_recording: bool,
) -> Option<TriggerEffect> {
    match intent {
        TapShortcutIntent::Stop => stop_session(app, capture_is_recording),
        TapShortcutIntent::Ignore => None,
        TapShortcutIntent::Start => start_session(app, "native_tap_hotkey"),
    }
}

fn tap_hotkey_uses_release_trigger(state: &NativeTriggerState) -> bool {
    state.config.activation_mode == NativeActivationMode::Tap
        && is_modifier_only_shortcut(&state.config.hotkey)
}

fn begin_tap_press(state: &mut NativeTriggerState) -> bool {
    if state.tap_hotkey_down {
        return false;
    }

    state.tap_hotkey_down = true;
    true
}

fn end_tap_press(state: &mut NativeTriggerState) {
    state.tap_hotkey_down = false;
}

fn sync_trigger_state_with_session(
    state: &mut NativeTriggerState,
    stage: Option<NativeSessionStage>,
) {
    let is_capturing = matches!(stage, Some(NativeSessionStage::Capturing));
    state.toggled_on = is_capturing;
    if !is_capturing {
        state.hotkey_active = false;
        state.hold_started_at = None;
        state.last_tap_shortcut_intent = None;
    }
}

fn build_shortcut_binding(
    input: &str,
    allow_modifier_only: bool,
) -> Result<RegisteredShortcutBinding, String> {
    let display = normalize_shortcut(input, allow_modifier_only)?;
    let parts = display.split('+').collect::<Vec<_>>();

    let shortcuts = if allow_modifier_only && parts.iter().all(|part| is_normalized_modifier(part))
    {
        build_modifier_only_shortcuts(&parts)?
    } else {
        vec![Shortcut::from_str(&display)
            .map_err(|error| format!("Could not parse hotkey '{display}': {error}"))?]
    };

    Ok(RegisteredShortcutBinding { display, shortcuts })
}

fn build_modifier_only_shortcuts(parts: &[&str]) -> Result<Vec<Shortcut>, String> {
    let mut shortcuts = Vec::with_capacity(parts.len());

    for (index, key_part) in parts.iter().enumerate() {
        let modifiers = shortcut_modifiers_from_parts(
            &parts
                .iter()
                .enumerate()
                .filter_map(|(modifier_index, part)| (modifier_index != index).then_some(*part))
                .collect::<Vec<_>>(),
        )?;
        let key = modifier_part_to_code(key_part)?;
        shortcuts.push(Shortcut::new(
            (!modifiers.is_empty()).then_some(modifiers),
            key,
        ));
    }

    Ok(shortcuts)
}

fn shortcut_modifiers_from_parts(parts: &[&str]) -> Result<Modifiers, String> {
    parts.iter().try_fold(Modifiers::empty(), |mods, part| {
        Ok(mods | modifier_part_to_modifiers(part)?)
    })
}

fn modifier_part_to_modifiers(part: &str) -> Result<Modifiers, String> {
    match part {
        "Ctrl" => Ok(Modifiers::CONTROL),
        "Alt" => Ok(Modifiers::ALT),
        "Shift" => Ok(Modifiers::SHIFT),
        "Super" => Ok(Modifiers::SUPER),
        _ => Err(format!("Unsupported shortcut modifier '{part}'.")),
    }
}

fn modifier_part_to_code(part: &str) -> Result<Code, String> {
    match part {
        "Ctrl" => Ok(Code::ControlLeft),
        "Alt" => Ok(Code::AltLeft),
        "Shift" => Ok(Code::ShiftLeft),
        "Super" => Ok(Code::MetaLeft),
        _ => Err(format!("Unsupported shortcut modifier '{part}'.")),
    }
}

pub fn normalize_shortcut(input: &str, allow_modifier_only: bool) -> Result<String, String> {
    let parts = input
        .split(|ch| ch == '+' || ch == ',')
        .map(|part| part.trim())
        .filter(|part| !part.is_empty())
        .map(normalize_shortcut_part)
        .collect::<Result<Vec<_>, _>>()?;

    if parts.is_empty() {
        return Err("Shortcut must not be empty.".to_string());
    }

    if !allow_modifier_only && parts.iter().all(|part| is_normalized_modifier(part)) {
        return Err("Shortcut must include at least one non-modifier key.".to_string());
    }

    Ok(parts.join("+"))
}

fn is_modifier_only_shortcut(shortcut: &str) -> bool {
    let parts = shortcut
        .split('+')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();

    !parts.is_empty() && parts.iter().all(|part| is_normalized_modifier(part))
}

fn is_normalized_modifier(part: &str) -> bool {
    matches!(part, "Ctrl" | "Alt" | "Shift" | "Super")
}

fn normalize_shortcut_part(part: &str) -> Result<String, String> {
    let lower = part.trim().to_ascii_lowercase();
    let normalized = match lower.as_str() {
        "ctrl" | "ctrl_l" | "ctrl_r" | "control" => "Ctrl".to_string(),
        "alt" | "alt_l" | "alt_r" | "option" => "Alt".to_string(),
        "shift" | "shift_l" | "shift_r" => "Shift".to_string(),
        "win" | "cmd" | "command" | "super" | "meta" => "Super".to_string(),
        "space" => "Space".to_string(),
        "esc" | "escape" => "Escape".to_string(),
        "enter" | "return" => "Enter".to_string(),
        "tab" => "Tab".to_string(),
        "backspace" => "Backspace".to_string(),
        value if value.len() == 1 && value.chars().all(|ch| ch.is_ascii_alphanumeric()) => {
            value.to_ascii_uppercase()
        }
        value if is_function_key(value) => value.to_ascii_uppercase(),
        _ => return Err(format!("Unsupported shortcut key '{part}'.")),
    };

    Ok(normalized)
}

fn is_function_key(value: &str) -> bool {
    value
        .strip_prefix('f')
        .and_then(|number| number.parse::<u8>().ok())
        .map(|number| (1..=24).contains(&number))
        .unwrap_or(false)
}

fn default_hotkey() -> String {
    if cfg!(target_os = "macos") {
        "ctrl_l+cmd+space".to_string()
    } else if cfg!(target_os = "windows") {
        "ctrl_l+alt_l+space".to_string()
    } else {
        "ctrl_l+f9".to_string()
    }
}

fn default_abort_hotkey() -> String {
    if cfg!(target_os = "macos") {
        "cmd+escape".to_string()
    } else if cfg!(target_os = "windows") {
        "ctrl_l+alt_l+escape".to_string()
    } else {
        "ctrl_l+alt_l+escape".to_string()
    }
}

fn default_pause_hotkey() -> String {
    if cfg!(target_os = "macos") {
        "ctrl_l+cmd+p".to_string()
    } else {
        "ctrl_l+f10".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_legacy_hotkey_names() {
        assert_eq!(normalize_shortcut("ctrl_l+f9", true).unwrap(), "Ctrl+F9");
        assert_eq!(
            normalize_shortcut("ctrl_l, alt_l, escape", false).unwrap(),
            "Ctrl+Alt+Escape"
        );
    }

    #[test]
    fn allows_modifier_only_start_shortcuts() {
        let binding = build_shortcut_binding("ctrl_l+win", true).unwrap();
        assert_eq!(binding.display, "Ctrl+Super");
        assert_eq!(binding.shortcuts.len(), 2);
        assert!(binding
            .shortcuts
            .contains(&Shortcut::new(Some(Modifiers::SUPER), Code::ControlLeft)));
        assert!(binding
            .shortcuts
            .contains(&Shortcut::new(Some(Modifiers::CONTROL), Code::MetaLeft)));
    }

    #[test]
    fn rejects_modifier_only_secondary_shortcuts() {
        assert!(normalize_shortcut("ctrl_l+win", false).is_err());
        assert!(normalize_shortcut("ctrl_l+alt_l", false).is_err());
    }

    #[test]
    fn allows_modifier_only_pause_and_abort_shortcuts() {
        let pause = build_shortcut_binding("ctrl_l+alt_l", true).unwrap();
        let abort = build_shortcut_binding("shift_l+win", true).unwrap();
        assert!(pause
            .shortcuts
            .contains(&Shortcut::new(Some(Modifiers::CONTROL), Code::AltLeft)));
        assert!(pause
            .shortcuts
            .contains(&Shortcut::new(Some(Modifiers::ALT), Code::ControlLeft)));
        assert!(abort
            .shortcuts
            .contains(&Shortcut::new(Some(Modifiers::SHIFT), Code::MetaLeft)));
        assert!(abort
            .shortcuts
            .contains(&Shortcut::new(Some(Modifiers::SUPER), Code::ShiftLeft)));
    }

    #[test]
    fn rejects_empty_shortcut() {
        assert!(normalize_shortcut(" ", true).is_err());
    }

    #[test]
    fn tap_hotkey_follows_real_session_stage() {
        assert_eq!(
            tap_shortcut_intent(Some(NativeSessionStage::Capturing), false),
            TapShortcutIntent::Stop
        );
        assert_eq!(
            tap_shortcut_intent(Some(NativeSessionStage::Processing), false),
            TapShortcutIntent::Ignore
        );
        assert_eq!(
            tap_shortcut_intent(Some(NativeSessionStage::Completed), false),
            TapShortcutIntent::Start
        );
        assert_eq!(tap_shortcut_intent(None, false), TapShortcutIntent::Start);
        assert_eq!(
            tap_shortcut_intent(Some(NativeSessionStage::Idle), true),
            TapShortcutIntent::Stop
        );
    }

    #[test]
    fn debounce_allows_fast_switch_from_start_to_stop() {
        let now = Instant::now();

        assert!(should_debounce_tap_press(
            Some(now),
            300,
            Some(TapShortcutIntent::Start),
            TapShortcutIntent::Start,
            now + Duration::from_millis(120),
        ));

        assert!(!should_debounce_tap_press(
            Some(now),
            300,
            Some(TapShortcutIntent::Start),
            TapShortcutIntent::Stop,
            now + Duration::from_millis(120),
        ));
    }

    #[test]
    fn tap_press_ignores_duplicate_pressed_events_until_release() {
        let mut state = NativeTriggerState::default();

        assert!(begin_tap_press(&mut state));
        assert!(!begin_tap_press(&mut state));

        end_tap_press(&mut state);

        assert!(begin_tap_press(&mut state));
    }

    #[test]
    fn detects_modifier_only_shortcuts() {
        assert!(is_modifier_only_shortcut("Ctrl+Super"));
        assert!(is_modifier_only_shortcut("Ctrl+Alt+Shift"));
        assert!(!is_modifier_only_shortcut("Ctrl+F9"));
        assert!(!is_modifier_only_shortcut("Ctrl+Space"));
    }

    #[test]
    fn mode_hotkeys_entries_skips_empty_and_preserves_order() {
        let hotkeys = ModeHotkeys {
            picker: "Ctrl+Alt+M".to_string(),
            auto: "Ctrl+F6".to_string(),
            verbatim: "Ctrl+F1".to_string(),
            cleanup: String::new(),
            rewrite: String::new(),
            agent: String::new(),
            prompt_enhance: String::new(),
        };

        let entries = hotkeys.entries();
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0], ("mode_picker", "Ctrl+Alt+M"));
        assert_eq!(entries[1], ("auto", "Ctrl+F6"));
        assert_eq!(entries[2], ("verbatim", "Ctrl+F1"));
    }

    #[test]
    fn mode_hotkeys_for_mode_returns_correct_field() {
        let hotkeys = ModeHotkeys {
            picker: String::new(),
            auto: "A".to_string(),
            verbatim: "V".to_string(),
            cleanup: "C".to_string(),
            rewrite: "R".to_string(),
            agent: "G".to_string(),
            prompt_enhance: "P".to_string(),
        };

        assert_eq!(hotkeys.for_mode(ProcessingMode::Auto), "A");
        assert_eq!(hotkeys.for_mode(ProcessingMode::Verbatim), "V");
        assert_eq!(hotkeys.for_mode(ProcessingMode::Cleanup), "C");
        assert_eq!(hotkeys.for_mode(ProcessingMode::Rewrite), "R");
        assert_eq!(hotkeys.for_mode(ProcessingMode::Agent), "G");
        assert_eq!(hotkeys.for_mode(ProcessingMode::PromptEnhance), "P");
    }

    #[test]
    fn mode_hotkeys_all_empty_yields_no_entries() {
        let hotkeys = ModeHotkeys::default();
        assert!(hotkeys.entries().is_empty());
    }

    #[test]
    fn native_trigger_status_reports_registered_mode_hotkeys() {
        let mut state = NativeTriggerState::default();
        state
            .registered_mode_hotkeys
            .insert("mode_picker".to_string(), "Ctrl+Alt+M".to_string());
        state
            .registered_mode_hotkeys
            .insert("agent".to_string(), "Ctrl+Alt+5".to_string());

        let status = state.status();
        assert_eq!(status.registered_mode_hotkeys.len(), 2);
        assert!(status
            .registered_mode_hotkeys
            .iter()
            .any(|h| h.label == "mode_picker" && h.display == "Ctrl+Alt+M"));
        assert!(status
            .registered_mode_hotkeys
            .iter()
            .any(|h| h.label == "agent" && h.display == "Ctrl+Alt+5"));
    }

    #[test]
    fn trigger_effect_mode_variants_are_debug_reachable() {
        // Smoke test: the new variants construct and match without panic.
        let select = TriggerEffect::ModeSelect;
        let direct = TriggerEffect::SetModeDirect(ProcessingMode::Agent);

        match select {
            TriggerEffect::ModeSelect => {}
            _ => panic!("expected ModeSelect"),
        }
        match direct {
            TriggerEffect::SetModeDirect(ProcessingMode::Agent) => {}
            _ => panic!("expected SetModeDirect(Agent)"),
        }
    }
}
