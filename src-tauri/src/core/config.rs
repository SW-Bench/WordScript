use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime};

use super::paths::config_file_path;
use super::providers::{
    default_provider_id, migrate_legacy_provider_api_key, normalize_provider_value,
    provider_credentials_configured,
};
use super::runtime_log;

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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TextProfile {
    pub id: String,
    pub label: String,
    pub prompt: String,
    pub dictionary_entries: Vec<DictionaryEntry>,
    pub snippet_entries: Vec<SnippetEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppConfig {
    #[serde(alias = "groq_api_key", skip_serializing_if = "String::is_empty")]
    pub legacy_groq_api_key: String,
    pub model: String,
    pub language: String,
    pub prompt: String,
    pub dictionary_entries: Vec<DictionaryEntry>,
    pub snippet_entries: Vec<SnippetEntry>,
    pub active_text_profile_id: String,
    pub text_profiles: Vec<TextProfile>,
    pub post_process: bool,
    pub correction_model: String,
    pub filter_fillers: bool,
    pub professionalize: bool,
    #[serde(alias = "backend")]
    pub provider: String,
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
    pub history_limit: usize,
    pub history_retention_days: u32,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            legacy_groq_api_key: String::new(),
            model: "whisper-large-v3-turbo".to_string(),
            language: String::new(),
            prompt: String::new(),
            dictionary_entries: Vec::new(),
            snippet_entries: Vec::new(),
            active_text_profile_id: default_text_profile_id().to_string(),
            text_profiles: vec![default_text_profile(
                String::new(),
                Vec::new(),
                Vec::new(),
            )],
            post_process: true,
            correction_model: "llama-3.1-8b-instant".to_string(),
            filter_fillers: true,
            professionalize: false,
            provider: default_provider_id().to_string(),
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
            history_limit: 200,
            history_retention_days: 90,
        }
    }
}

impl AppConfig {
    pub fn active_text_profile(&self) -> TextProfile {
        self.text_profiles
            .iter()
            .find(|profile| profile.id == self.active_text_profile_id)
            .cloned()
            .unwrap_or_else(|| {
                default_text_profile(
                    self.prompt.clone(),
                    self.dictionary_entries.clone(),
                    self.snippet_entries.clone(),
                )
            })
    }

    pub fn active_text_profile_label(&self) -> Option<String> {
        let label = self.active_text_profile().label;
        let trimmed = label.trim();
        (!trimmed.is_empty()).then(|| trimmed.to_string())
    }

    pub fn without_secrets(&self) -> Self {
        let mut sanitized = self.clone();
        sanitized.legacy_groq_api_key.clear();
        sanitized
    }

    fn load_raw_from_disk() -> Self {
        let path = config_file_path();
        let Ok(raw) = std::fs::read_to_string(path) else {
            return Self::default();
        };

        serde_json::from_str::<Self>(&raw).unwrap_or_default()
    }

    fn has_pending_legacy_secret(&self) -> bool {
        !self.legacy_groq_api_key.trim().is_empty()
    }

    fn try_migrate_legacy_secret(&mut self) -> Result<bool, String> {
        let legacy_key = self.legacy_groq_api_key.trim().to_string();
        if legacy_key.is_empty() {
            return Ok(false);
        }

        self.provider = normalize_provider_value(&self.provider);
        let credential = migrate_legacy_provider_api_key(&self.provider, &legacy_key)
            .map_err(|error| error.message)?;
        self.legacy_groq_api_key.clear();

        runtime_log::record(format!(
            "[WordScript] Migrated legacy {} API key to {}",
            self.provider, credential.storage,
        ));

        Ok(true)
    }

    fn reconcile_legacy_secret_before_save() -> Result<(), String> {
        let mut disk_config = Self::load_raw_from_disk();
        if !disk_config.has_pending_legacy_secret() {
            return Ok(());
        }

        disk_config.provider = normalize_provider_value(&disk_config.provider);

        match disk_config.try_migrate_legacy_secret() {
            Ok(true) => {
                disk_config.save_to_disk()?;
                Ok(())
            }
            Ok(false) => Ok(()),
            Err(error) => {
                if provider_credentials_configured(&disk_config.provider)
                    .map_err(|provider_error| provider_error.message)?
                {
                    runtime_log::record(format!(
                        "[WordScript] Dropping unresolved legacy {} API key from disk because a provider credential is already configured after migration failed: {}",
                        disk_config.provider,
                        error,
                    ));
                    return Ok(());
                }

                Err(
                    "Could not migrate the legacy Groq key to the OS secret store. Save the key again in Provider & Models before saving settings."
                        .to_string(),
                )
            }
        }
    }

    fn normalize_for_runtime(&mut self) {
        self.normalize_text_profiles();
        self.provider = normalize_provider_value(&self.provider);
        self.hotkey = normalize_shortcut_value(&self.hotkey, default_hotkey(), true);
        self.pause_hotkey =
            normalize_shortcut_value(&self.pause_hotkey, default_pause_hotkey(), true);
        self.abort_hotkey =
            normalize_shortcut_value(&self.abort_hotkey, default_abort_hotkey(), true);
        self.history_limit = self.history_limit.clamp(25, 1000);
        self.history_retention_days = self.history_retention_days.min(3650);
    }

    fn normalize_text_profiles(&mut self) {
        if self.text_profiles.is_empty() {
            self.text_profiles.push(default_text_profile(
                self.prompt.clone(),
                self.dictionary_entries.clone(),
                self.snippet_entries.clone(),
            ));
        }

        for (index, profile) in self.text_profiles.iter_mut().enumerate() {
            if profile.id.trim().is_empty() {
                profile.id = if index == 0 {
                    default_text_profile_id().to_string()
                } else {
                    format!("profile-{}", index + 1)
                };
            }

            if profile.label.trim().is_empty() {
                profile.label = if index == 0 {
                    default_text_profile_label().to_string()
                } else {
                    format!("Profile {}", index + 1)
                };
            }
        }

        let active_index = self
            .text_profiles
            .iter()
            .position(|profile| profile.id == self.active_text_profile_id)
            .unwrap_or(0);

        self.active_text_profile_id = self.text_profiles[active_index].id.clone();
        self.text_profiles[active_index].prompt = self.prompt.clone();
        self.text_profiles[active_index].dictionary_entries = self.dictionary_entries.clone();
        self.text_profiles[active_index].snippet_entries = self.snippet_entries.clone();

        let active_profile = self.text_profiles[active_index].clone();
        self.prompt = active_profile.prompt;
        self.dictionary_entries = active_profile.dictionary_entries;
        self.snippet_entries = active_profile.snippet_entries;
    }

    pub fn load_from_disk() -> Self {
        let mut config = Self::load_raw_from_disk();
        let original_provider = config.provider.clone();
        let original_hotkeys = (
            config.hotkey.clone(),
            config.pause_hotkey.clone(),
            config.abort_hotkey.clone(),
        );

        let mut should_save = false;

        match config.try_migrate_legacy_secret() {
            Ok(migrated) => should_save |= migrated,
            Err(error) => runtime_log::record(format!(
                "[WordScript] Legacy provider key migration deferred: {error}"
            )),
        }

        config.normalize_for_runtime();
        should_save |= original_provider != config.provider;

        should_save |= original_hotkeys
            != (
                config.hotkey.clone(),
                config.pause_hotkey.clone(),
                config.abort_hotkey.clone(),
            );

        if should_save && !config.has_pending_legacy_secret() {
            let _ = config.save_to_disk();
        } else if should_save {
            runtime_log::record(
                "[WordScript] Deferred config rewrite because a legacy provider key is still pending migration."
                    .to_string(),
            );
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
    Ok(AppConfig::load_from_disk().without_secrets())
}

#[tauri::command]
pub fn save_config<R: Runtime>(app: AppHandle<R>, config: AppConfig) -> Result<AppConfig, String> {
    AppConfig::reconcile_legacy_secret_before_save()?;
    let mut sanitized = config.without_secrets();
    sanitized.normalize_for_runtime();
    sanitized.save_to_disk()?;
    super::sound::set_enabled(sanitized.play_sounds);
    emit_ready_event(&app, &sanitized);
    Ok(sanitized)
}

pub fn emit_ready_event<R: Runtime>(app: &AppHandle<R>, config: &AppConfig) {
    let config = config.without_secrets();
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

fn default_text_profile_id() -> &'static str {
    "general"
}

fn default_text_profile_label() -> &'static str {
    "General writing"
}

fn default_text_profile(
    prompt: String,
    dictionary_entries: Vec<DictionaryEntry>,
    snippet_entries: Vec<SnippetEntry>,
) -> TextProfile {
    TextProfile {
        id: default_text_profile_id().to_string(),
        label: default_text_profile_label().to_string(),
        prompt,
        dictionary_entries,
        snippet_entries,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disk_config_payload_never_contains_groq_key() {
        let config = AppConfig {
            legacy_groq_api_key: "gsk_secret_value".to_string(),
            ..AppConfig::default()
        };

        let serialized =
            serde_json::to_string(&config.without_secrets()).expect("serialize config");

        assert!(!serialized.contains("gsk_secret_value"));
        assert!(!serialized.contains("legacy_groq_api_key"));
        assert!(!serialized.contains("groq_api_key"));
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

    #[test]
    fn normalizes_unknown_provider_to_default_runtime_provider() {
        let mut config = AppConfig {
            provider: "openai".to_string(),
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.provider, "groq");
    }

    #[test]
    fn normalizes_history_settings_to_supported_runtime_values() {
        let mut config = AppConfig {
            history_limit: 2,
            history_retention_days: 9_999,
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.history_limit, 25);
        assert_eq!(config.history_retention_days, 3650);
    }

    #[test]
    fn migrates_legacy_text_rules_into_the_default_profile() {
        let mut config = AppConfig {
            prompt: "Product names and internal jargon".to_string(),
            dictionary_entries: vec![DictionaryEntry {
                id: "dict-brand".to_string(),
                phrase: "word script".to_string(),
                replace_with: "WordScript".to_string(),
            }],
            snippet_entries: vec![SnippetEntry {
                id: "snippet-follow-up".to_string(),
                label: "Follow-up".to_string(),
                trigger: "follow up".to_string(),
                expansion: "Thanks for the update.".to_string(),
            }],
            active_text_profile_id: String::new(),
            text_profiles: Vec::new(),
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.active_text_profile_id, "general");
        assert_eq!(config.text_profiles.len(), 1);
        assert_eq!(config.text_profiles[0].label, "General writing");
        assert_eq!(config.text_profiles[0].prompt, "Product names and internal jargon");
        assert_eq!(config.text_profiles[0].dictionary_entries.len(), 1);
        assert_eq!(config.text_profiles[0].snippet_entries.len(), 1);
    }

    #[test]
    fn syncs_active_text_profile_from_top_level_fields() {
        let mut config = AppConfig {
            prompt: "Support tone and escalation names".to_string(),
            dictionary_entries: vec![DictionaryEntry {
                id: "dict-escalation".to_string(),
                phrase: "sev one".to_string(),
                replace_with: "SEV-1".to_string(),
            }],
            snippet_entries: vec![SnippetEntry {
                id: "snippet-status".to_string(),
                label: "Status".to_string(),
                trigger: "status update".to_string(),
                expansion: "We will send the next status at 10:00.".to_string(),
            }],
            active_text_profile_id: "support".to_string(),
            text_profiles: vec![
                TextProfile {
                    id: "general".to_string(),
                    label: "General writing".to_string(),
                    prompt: "General".to_string(),
                    dictionary_entries: Vec::new(),
                    snippet_entries: Vec::new(),
                },
                TextProfile {
                    id: "support".to_string(),
                    label: "Support reply".to_string(),
                    prompt: "Old support prompt".to_string(),
                    dictionary_entries: Vec::new(),
                    snippet_entries: Vec::new(),
                },
            ],
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        let active_profile = config.active_text_profile();
        assert_eq!(active_profile.id, "support");
        assert_eq!(active_profile.label, "Support reply");
        assert_eq!(active_profile.prompt, "Support tone and escalation names");
        assert_eq!(active_profile.dictionary_entries.len(), 1);
        assert_eq!(active_profile.snippet_entries.len(), 1);
        assert_eq!(config.active_text_profile_label().as_deref(), Some("Support reply"));
    }
}
