use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime};

use super::paths::config_file_path;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DictionaryEntry {
    pub id: String,
    pub phrase: String,
    pub replace_with: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SnippetEntry {
    pub id: String,
    pub label: String,
    pub trigger: String,
    pub expansion: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppConfig {
    pub groq_api_key: String,
    pub model: String,
    pub language: String,
    pub prompt: String,
    pub dictionary_entries: Vec<DictionaryEntry>,
    pub snippet_entries: Vec<SnippetEntry>,
    pub post_process: bool,
    pub correction_model: String,
    pub filter_fillers: bool,
    pub professionalize: bool,
    pub backend: String,
    pub local_model: String,
    pub hotkey: String,
    pub pause_hotkey: String,
    pub abort_hotkey: String,
    pub activation_mode: String,
    pub sample_rate: u32,
    pub channels: u16,
    pub dtype: String,
    pub audio_device: String,
    pub max_recording_seconds: u64,
    pub silence_timeout_seconds: u64,
    pub auto_paste: bool,
    pub play_sounds: bool,
    pub log_level: String,
    pub temp_audio_dir: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            groq_api_key: String::new(),
            model: "whisper-large-v3-turbo".to_string(),
            language: String::new(),
            prompt: String::new(),
            dictionary_entries: Vec::new(),
            snippet_entries: Vec::new(),
            post_process: true,
            correction_model: "llama-3.1-8b-instant".to_string(),
            filter_fillers: true,
            professionalize: false,
            backend: "groq".to_string(),
            local_model: "base".to_string(),
            hotkey: default_hotkey().to_string(),
            pause_hotkey: default_pause_hotkey().to_string(),
            abort_hotkey: default_abort_hotkey().to_string(),
            activation_mode: "tap".to_string(),
            sample_rate: 16_000,
            channels: 1,
            dtype: "int16".to_string(),
            audio_device: String::new(),
            max_recording_seconds: 720,
            silence_timeout_seconds: 30,
            auto_paste: true,
            play_sounds: true,
            log_level: "INFO".to_string(),
            temp_audio_dir: String::new(),
        }
    }
}

impl AppConfig {
    pub fn without_secrets(&self) -> Self {
        let mut sanitized = self.clone();
        sanitized.groq_api_key.clear();
        sanitized
    }

    fn normalize_for_runtime(&mut self) {
        self.hotkey = normalize_shortcut_value(&self.hotkey, default_hotkey(), true);
        self.pause_hotkey =
            normalize_shortcut_value(&self.pause_hotkey, default_pause_hotkey(), true);
        self.abort_hotkey =
            normalize_shortcut_value(&self.abort_hotkey, default_abort_hotkey(), true);
    }

    pub fn load_from_disk() -> Self {
        let path = config_file_path();
        let Ok(raw) = std::fs::read_to_string(path) else {
            return Self::default();
        };

        let mut config = serde_json::from_str::<Self>(&raw).unwrap_or_default();
        let original_hotkeys = (
            config.hotkey.clone(),
            config.pause_hotkey.clone(),
            config.abort_hotkey.clone(),
        );
        config.normalize_for_runtime();

        if original_hotkeys
            != (
                config.hotkey.clone(),
                config.pause_hotkey.clone(),
                config.abort_hotkey.clone(),
            )
        {
            let _ = config.save_to_disk();
        }

        config
    }

    pub fn save_to_disk(&self) -> Result<(), String> {
        let path = config_file_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|error| format!("Could not create config directory: {error}"))?;
        }

        let raw = serde_json::to_string_pretty(&self.without_secrets())
            .map_err(|error| format!("Could not serialize config: {error}"))?;
        std::fs::write(path, raw).map_err(|error| format!("Could not write config file: {error}"))
    }
}

#[tauri::command]
pub fn load_app_config() -> Result<AppConfig, String> {
    Ok(AppConfig::load_from_disk())
}

#[tauri::command]
pub fn save_config<R: Runtime>(app: AppHandle<R>, config: AppConfig) -> Result<AppConfig, String> {
    let mut sanitized = config.without_secrets();
    sanitized.normalize_for_runtime();
    sanitized.save_to_disk()?;
    super::sound::set_enabled(sanitized.play_sounds);
    emit_ready_event(&app, &sanitized);
    Ok(sanitized)
}

pub fn emit_ready_event<R: Runtime>(app: &AppHandle<R>, config: &AppConfig) {
    let _ = app.emit(
        "wordscript-event",
        serde_json::json!({
            "event": "ready",
            "version": env!("CARGO_PKG_VERSION"),
            "config": config,
        }),
    );
}

fn default_hotkey() -> &'static str {
    if cfg!(target_os = "macos") {
        "ctrl_l+cmd+space"
    } else if cfg!(target_os = "windows") {
        "ctrl_l+win+space"
    } else {
        "ctrl_l+f9"
    }
}

fn default_abort_hotkey() -> &'static str {
    if cfg!(target_os = "macos") {
        "cmd+escape"
    } else {
        "ctrl_l+alt_l+escape"
    }
}

fn default_pause_hotkey() -> &'static str {
    if cfg!(target_os = "macos") {
        "ctrl_l+cmd+p"
    } else {
        "ctrl_l+f10"
    }
}

fn normalize_shortcut_value(value: &str, fallback: &str, allow_modifier_only: bool) -> String {
    let parts = value
        .split(['+', ','])
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .map(normalize_shortcut_part)
        .collect::<Vec<_>>();

    if parts.is_empty() {
        return fallback.to_string();
    }

    if allow_modifier_only
        && matches!(
            parts.join("+").as_str(),
            "ctrl_l+win+space" | "ctrl_l+cmd+space" | "ctrl_l+alt_l+space"
        )
    {
        return parts[..parts.len().saturating_sub(1)].join("+");
    }

    if is_legacy_autofilled_space_shortcut(&parts, allow_modifier_only) {
        return fallback.to_string();
    }

    if !allow_modifier_only && parts.iter().all(|part| is_modifier_only(part)) {
        return fallback.to_string();
    }

    parts.join("+")
}

fn is_legacy_autofilled_space_shortcut(parts: &[String], allow_modifier_only: bool) -> bool {
    let joined = parts.join("+");
    if allow_modifier_only {
        return joined == "ctrl_l+cmd+space";
    }

    joined == "ctrl_l+alt_l+space"
}

fn normalize_shortcut_part(part: &str) -> String {
    let lower = part.trim().to_ascii_lowercase();
    match lower.as_str() {
        "ctrl" | "control" | "ctrl_l" | "ctrl_r" => "ctrl_l".to_string(),
        "alt" | "alt_l" | "alt_r" | "option" => "alt_l".to_string(),
        "shift" | "shift_l" | "shift_r" => "shift_l".to_string(),
        "win" | "super" | "meta" if cfg!(target_os = "macos") => "cmd".to_string(),
        "win" | "super" | "meta" => "win".to_string(),
        "cmd" | "command" => "cmd".to_string(),
        "space" => "space".to_string(),
        "esc" | "escape" => "escape".to_string(),
        "enter" | "return" => "enter".to_string(),
        "tab" => "tab".to_string(),
        "backspace" => "backspace".to_string(),
        _ => lower,
    }
}

fn is_modifier_only(part: &str) -> bool {
    matches!(part, "ctrl_l" | "alt_l" | "shift_l" | "win" | "cmd")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disk_config_payload_never_contains_groq_key() {
        let config = AppConfig {
            groq_api_key: "gsk_secret_value".to_string(),
            ..AppConfig::default()
        };

        let serialized =
            serde_json::to_string(&config.without_secrets()).expect("serialize config");

        assert!(!serialized.contains("gsk_secret_value"));
        assert!(serialized.contains("\"groq_api_key\":\"\""));
    }

    #[test]
    fn normalizes_legacy_shortcuts_to_valid_runtime_values() {
        assert_eq!(
            normalize_shortcut_value("ctrl_l, win", "ctrl_l+f9", true),
            "ctrl_l+win"
        );
        assert_eq!(
            normalize_shortcut_value("ctrl_l+alt_l", "ctrl_l+alt_l+escape", true),
            "ctrl_l+alt_l"
        );
        assert_eq!(
            normalize_shortcut_value("ctrl_l+win+space", "ctrl_l+f9", true),
            "ctrl_l+win"
        );
        assert_eq!(
            normalize_shortcut_value("ctrl_l+alt_l+space", "ctrl_l+alt_l+escape", true),
            "ctrl_l+alt_l"
        );
        assert_eq!(
            normalize_shortcut_value("Ctrl+F9", "ctrl_l+f9", true),
            "ctrl_l+f9"
        );
    }
}
