use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime};

use super::paths::config_file_path;
use super::providers::{
    default_provider_id, migrate_legacy_provider_api_key, normalize_provider_value,
    provider_credentials_configured,
};
use super::runtime_log;

pub const DEFAULT_CORRECTION_MODEL: &str = "llama-3.3-70b-versatile";
pub const DEFAULT_LOCAL_CORRECTION_MODEL: &str = "llama3.2:latest";
pub const DEFAULT_AGENT_MODEL: &str = "llama-3.3-70b-versatile";
pub const DEFAULT_LOCAL_AGENT_MODEL: &str = "llama3.2:latest";
pub const DEFAULT_AGENT_NAME: &str = "WordScript";

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

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct TextProfileCuration {
    pub curated: bool,
    pub audience: String,
    pub summary: String,
    pub highlights: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct TextProfileWorkMode {
    pub rewrite_style: String,
    pub insert_behavior: String,
    pub recovery_behavior: String,
}

impl Default for TextProfileWorkMode {
    fn default() -> Self {
        Self {
            rewrite_style: default_text_profile_rewrite_style().to_string(),
            insert_behavior: default_text_profile_insert_behavior().to_string(),
            recovery_behavior: default_text_profile_recovery_behavior().to_string(),
        }
    }
}

impl TextProfileWorkMode {
    pub(crate) fn normalized(&self) -> Self {
        normalize_text_profile_work_mode(self)
    }

    pub(crate) fn effective_rewrite_style(
        &self,
        fallback_filter_fillers: bool,
        fallback_professionalize: bool,
    ) -> String {
        let normalized = self.normalized();
        match normalized.rewrite_style.as_str() {
            "verbatim" | "polished" => normalized.rewrite_style,
            _ if fallback_professionalize => "polished".to_string(),
            _ if fallback_filter_fillers => "clean".to_string(),
            _ => "verbatim".to_string(),
        }
    }

    pub(crate) fn effective_filter_fillers(&self, fallback: bool) -> bool {
        match self.normalized().rewrite_style.as_str() {
            "verbatim" => false,
            "polished" => true,
            "clean" => true,
            _ => fallback,
        }
    }

    pub(crate) fn effective_professionalize(&self, fallback: bool) -> bool {
        match self.normalized().rewrite_style.as_str() {
            "verbatim" => false,
            "polished" => true,
            "clean" => false,
            _ => fallback,
        }
    }

    pub(crate) fn effective_insert_behavior(&self, fallback_auto_paste: bool) -> String {
        match self.normalized().insert_behavior.as_str() {
            "clipboard_only" => "clipboard_only".to_string(),
            _ if fallback_auto_paste => "auto_paste".to_string(),
            _ => "clipboard_only".to_string(),
        }
    }

    pub(crate) fn effective_auto_paste(&self, fallback_auto_paste: bool) -> bool {
        self.effective_insert_behavior(fallback_auto_paste) == "auto_paste"
    }

    pub(crate) fn effective_recovery_behavior(&self) -> String {
        self.normalized().recovery_behavior
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TextProfile {
    pub id: String,
    pub label: String,
    pub prompt: String,
    pub stt_hints: String,
    #[serde(default)]
    pub work_mode: TextProfileWorkMode,
    #[serde(default)]
    pub curation: TextProfileCuration,
    pub dictionary_entries: Vec<DictionaryEntry>,
    pub snippet_entries: Vec<SnippetEntry>,
}

#[derive(Debug, Clone, Deserialize, Default)]
struct LegacyTextRules {
    #[serde(default)]
    prompt: String,
    #[serde(default)]
    stt_hints: String,
    #[serde(default)]
    dictionary_entries: Vec<DictionaryEntry>,
    #[serde(default)]
    snippet_entries: Vec<SnippetEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct LocalProfileDecodeSettings {
    pub profile_id: String,
    pub beam_size: u8,
    pub best_of: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct LocalProfilePromptSettings {
    pub profile_id: String,
    pub prompt_strength: String,
    pub prompt_carry: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum OverlayPositionMode {
    #[default]
    Preset,
    Manual,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum OverlayAnchor {
    TopLeft,
    TopCenter,
    TopRight,
    CenterLeft,
    CenterRight,
    BottomLeft,
    #[default]
    BottomCenter,
    BottomRight,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppConfig {
    #[serde(alias = "groq_api_key", skip_serializing_if = "String::is_empty")]
    pub legacy_groq_api_key: String,
    pub model: String,
    pub language: String,
    pub active_text_profile_id: String,
    pub text_profiles: Vec<TextProfile>,
    pub curated_profiles_seeded: bool,
    pub post_process: bool,
    pub correction_model: String,
    pub local_correction_model: String,
    pub filter_fillers: bool,
    pub professionalize: bool,
    #[serde(alias = "backend")]
    pub provider: String,
    pub local_model: String,
    pub local_profile: String,
    pub local_prompt_strength: String,
    pub local_prompt_carry: bool,
    pub local_beam_size: u8,
    pub local_best_of: u8,
    pub local_profile_prompt_settings: Vec<LocalProfilePromptSettings>,
    pub local_profile_decode_settings: Vec<LocalProfileDecodeSettings>,
    pub hotkey: String,
    pub pause_hotkey: String,
    pub abort_hotkey: String,
    pub activation_mode: String,
    pub overlay_position_mode: OverlayPositionMode,
    pub overlay_monitor: String,
    pub overlay_anchor: OverlayAnchor,
    pub overlay_manual_x: i32,
    pub overlay_manual_y: i32,
    pub sample_rate: u32,
    pub channels: u16,
    pub dtype: String,
    pub audio_device: String,
    pub max_recording_seconds: u64,
    pub silence_timeout_seconds: u64,
    pub result_actions_timeout_ms: u64,
    pub auto_paste: bool,
    pub play_sounds: bool,
    pub log_level: String,
    pub temp_audio_dir: String,
    pub history_limit: usize,
    pub history_retention_days: u32,
    pub agent_mode_enabled: bool,
    pub agent_name: String,
    pub agent_model: String,
    pub local_agent_model: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        let default_local_profile = default_local_profile_for_model("base");
        let default_local_beam_size = default_local_beam_size_for_profile(&default_local_profile);
        let default_local_best_of = default_local_best_of_for_profile(&default_local_profile);
        let default_local_prompt_strength = default_local_prompt_strength().to_string();

        Self {
            legacy_groq_api_key: String::new(),
            model: "whisper-large-v3-turbo".to_string(),
            language: String::new(),
            active_text_profile_id: default_text_profile_id().to_string(),
            text_profiles: default_seeded_text_profiles(),
            curated_profiles_seeded: true,
            post_process: true,
            correction_model: DEFAULT_CORRECTION_MODEL.to_string(),
            local_correction_model: DEFAULT_LOCAL_CORRECTION_MODEL.to_string(),
            filter_fillers: true,
            professionalize: false,
            provider: default_provider_id().to_string(),
            local_model: "base".to_string(),
            local_profile: default_local_profile.clone(),
            local_prompt_strength: default_local_prompt_strength.clone(),
            local_prompt_carry: false,
            local_beam_size: default_local_beam_size,
            local_best_of: default_local_best_of,
            local_profile_prompt_settings: vec![LocalProfilePromptSettings {
                profile_id: default_local_profile.clone(),
                prompt_strength: default_local_prompt_strength,
                prompt_carry: false,
            }],
            local_profile_decode_settings: vec![LocalProfileDecodeSettings {
                profile_id: default_local_profile,
                beam_size: default_local_beam_size,
                best_of: default_local_best_of,
            }],
            hotkey: default_hotkey().to_string(),
            pause_hotkey: default_pause_hotkey().to_string(),
            abort_hotkey: default_abort_hotkey().to_string(),
            activation_mode: "tap".to_string(),
            overlay_position_mode: OverlayPositionMode::Preset,
            overlay_monitor: default_overlay_monitor().to_string(),
            overlay_anchor: OverlayAnchor::BottomCenter,
            overlay_manual_x: 0,
            overlay_manual_y: 0,
            sample_rate: 16_000,
            channels: 1,
            dtype: "int16".to_string(),
            audio_device: String::new(),
            max_recording_seconds: 720,
            silence_timeout_seconds: 30,
            result_actions_timeout_ms: 9000,
            auto_paste: true,
            play_sounds: true,
            log_level: "INFO".to_string(),
            temp_audio_dir: String::new(),
            history_limit: 200,
            history_retention_days: 90,
            agent_mode_enabled: false,
            agent_name: DEFAULT_AGENT_NAME.to_string(),
            agent_model: DEFAULT_AGENT_MODEL.to_string(),
            local_agent_model: DEFAULT_LOCAL_AGENT_MODEL.to_string(),
        }
    }
}

impl AppConfig {
    pub fn active_text_profile(&self) -> TextProfile {
        self.text_profiles
            .iter()
            .find(|profile| profile.id == self.active_text_profile_id)
            .cloned()
            .or_else(|| self.text_profiles.first().cloned())
            .unwrap_or_else(|| {
                default_text_profile(String::new(), String::new(), Vec::new(), Vec::new())
            })
    }

    pub(crate) fn active_text_profile_work_mode(&self) -> TextProfileWorkMode {
        self.active_text_profile().work_mode.normalized()
    }

    pub(crate) fn resolved_active_text_profile_work_mode(&self) -> TextProfileWorkMode {
        let work_mode = self.active_text_profile_work_mode();
        TextProfileWorkMode {
            rewrite_style: work_mode
                .effective_rewrite_style(self.filter_fillers, self.professionalize),
            insert_behavior: work_mode.effective_insert_behavior(self.auto_paste),
            recovery_behavior: work_mode.effective_recovery_behavior(),
        }
    }

    pub(crate) fn active_text_profile_filter_fillers(&self) -> bool {
        self.active_text_profile_work_mode()
            .effective_filter_fillers(self.filter_fillers)
    }

    pub(crate) fn active_text_profile_professionalize(&self) -> bool {
        self.active_text_profile_work_mode()
            .effective_professionalize(self.professionalize)
    }

    pub(crate) fn active_text_profile_auto_paste(&self) -> bool {
        self.active_text_profile_work_mode()
            .effective_auto_paste(self.auto_paste)
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

        let Ok(raw_value) = serde_json::from_str::<serde_json::Value>(&raw) else {
            return Self::default();
        };

        let mut config = serde_json::from_value::<Self>(raw_value.clone()).unwrap_or_default();
        apply_legacy_text_rules_from_value(&mut config, &raw_value);
        if should_reseed_curated_text_profiles(&raw_value) {
            config.curated_profiles_seeded = false;
        }
        config
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
        self.local_model = normalize_local_model_value(&self.local_model);
        self.local_profile = normalize_local_profile_id(&self.local_profile, &self.local_model);
        self.local_model = local_model_from_profile_id(&self.local_profile)
            .unwrap_or_else(|| self.local_model.clone());
        self.local_correction_model =
            normalize_local_correction_model_value(&self.local_correction_model);
        self.local_prompt_strength =
            normalize_local_prompt_strength_value(&self.local_prompt_strength);
        self.local_profile_prompt_settings =
            normalize_local_profile_prompt_settings(&self.local_profile_prompt_settings);
        let active_local_prompt = resolve_active_local_profile_prompt_settings(
            &self.local_profile_prompt_settings,
            &self.local_profile,
            &self.local_prompt_strength,
            self.local_prompt_carry,
        );
        self.local_prompt_strength = active_local_prompt.prompt_strength.clone();
        self.local_prompt_carry = active_local_prompt.prompt_carry;
        upsert_local_profile_prompt_settings(
            &mut self.local_profile_prompt_settings,
            active_local_prompt,
        );
        self.local_profile_decode_settings =
            normalize_local_profile_decode_settings(&self.local_profile_decode_settings);
        let active_local_decode = resolve_active_local_profile_decode_settings(
            &self.local_profile_decode_settings,
            &self.local_profile,
            self.local_beam_size,
            self.local_best_of,
        );
        self.local_beam_size = active_local_decode.beam_size;
        self.local_best_of = active_local_decode.best_of;
        upsert_local_profile_decode_settings(
            &mut self.local_profile_decode_settings,
            active_local_decode,
        );
        self.hotkey = normalize_shortcut_value(&self.hotkey, default_hotkey(), true);
        self.pause_hotkey =
            normalize_shortcut_value(&self.pause_hotkey, default_pause_hotkey(), true);
        self.abort_hotkey =
            normalize_shortcut_value(&self.abort_hotkey, default_abort_hotkey(), true);
        self.overlay_monitor = normalize_overlay_monitor_value(&self.overlay_monitor);
        self.history_limit = self.history_limit.clamp(25, 1000);
        self.history_retention_days = self.history_retention_days.min(3650);
    }

    fn normalize_text_profiles(&mut self) {
        if self.text_profiles.is_empty() {
            self.text_profiles.push(default_text_profile(
                String::new(),
                String::new(),
                Vec::new(),
                Vec::new(),
            ));
        }

        if !self.curated_profiles_seeded {
            append_missing_curated_text_profiles(&mut self.text_profiles);
            self.curated_profiles_seeded = true;
        }
        refresh_unedited_curated_text_profile_metadata(&mut self.text_profiles);

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

            profile.work_mode = normalize_text_profile_work_mode(&profile.work_mode);
        }

        let active_index = self
            .text_profiles
            .iter()
            .position(|profile| profile.id == self.active_text_profile_id)
            .unwrap_or(0);

        self.active_text_profile_id = self.text_profiles[active_index].id.clone();
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

#[tauri::command]
pub fn switch_active_text_profile<R: Runtime>(
    app: AppHandle<R>,
    profile_id: String,
) -> Result<AppConfig, String> {
    let mut config = AppConfig::load_from_disk();
    config.active_text_profile_id = profile_id;
    config.normalize_for_runtime();
    config.save_to_disk()?;
    super::sound::set_enabled(config.play_sounds);
    emit_ready_event(&app, &config);
    Ok(config.without_secrets())
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
        "ctrl_l+alt_l+space"
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

fn default_overlay_monitor() -> &'static str {
    "primary"
}

fn normalize_overlay_monitor_value(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        default_overlay_monitor().to_string()
    } else {
        trimmed.to_string()
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

fn default_local_prompt_strength() -> &'static str {
    "profile"
}

fn normalize_local_correction_model_value(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        DEFAULT_LOCAL_CORRECTION_MODEL.to_string()
    } else {
        trimmed.to_string()
    }
}

fn normalize_local_decode_value(value: u8, fallback: u8) -> u8 {
    match value {
        1..=8 => value,
        _ => fallback.clamp(1, 8),
    }
}

fn default_local_beam_size_for_profile(profile: &str) -> u8 {
    if normalize_local_profile_id(profile, "base").ends_with("-quality") {
        5
    } else {
        1
    }
}

fn default_local_best_of_for_profile(profile: &str) -> u8 {
    if normalize_local_profile_id(profile, "base").ends_with("-quality") {
        5
    } else {
        1
    }
}

fn normalize_local_profile_prompt_settings(
    settings: &[LocalProfilePromptSettings],
) -> Vec<LocalProfilePromptSettings> {
    let mut normalized = Vec::new();

    for entry in settings {
        let profile_id = normalize_local_profile_id(&entry.profile_id, "base");
        let normalized_entry = LocalProfilePromptSettings {
            profile_id,
            prompt_strength: normalize_local_prompt_strength_value(&entry.prompt_strength),
            prompt_carry: entry.prompt_carry,
        };

        upsert_local_profile_prompt_settings(&mut normalized, normalized_entry);
    }

    normalized
}

fn upsert_local_profile_prompt_settings(
    settings: &mut Vec<LocalProfilePromptSettings>,
    entry: LocalProfilePromptSettings,
) {
    if let Some(existing) = settings
        .iter_mut()
        .find(|candidate| candidate.profile_id == entry.profile_id)
    {
        *existing = entry;
        return;
    }

    settings.push(entry);
}

fn resolve_active_local_profile_prompt_settings(
    settings: &[LocalProfilePromptSettings],
    profile_id: &str,
    active_prompt_strength: &str,
    active_prompt_carry: bool,
) -> LocalProfilePromptSettings {
    let normalized_profile_id = normalize_local_profile_id(profile_id, "base");

    if let Some(existing) = settings
        .iter()
        .find(|candidate| candidate.profile_id == normalized_profile_id)
    {
        return existing.clone();
    }

    LocalProfilePromptSettings {
        profile_id: normalized_profile_id,
        prompt_strength: normalize_local_prompt_strength_value(active_prompt_strength),
        prompt_carry: active_prompt_carry,
    }
}

fn normalize_local_profile_decode_settings(
    settings: &[LocalProfileDecodeSettings],
) -> Vec<LocalProfileDecodeSettings> {
    let mut normalized = Vec::new();

    for entry in settings {
        let profile_id = normalize_local_profile_id(&entry.profile_id, "base");
        let normalized_entry = LocalProfileDecodeSettings {
            beam_size: normalize_local_decode_value(
                entry.beam_size,
                default_local_beam_size_for_profile(&profile_id),
            ),
            best_of: normalize_local_decode_value(
                entry.best_of,
                default_local_best_of_for_profile(&profile_id),
            ),
            profile_id,
        };

        upsert_local_profile_decode_settings(&mut normalized, normalized_entry);
    }

    normalized
}

fn upsert_local_profile_decode_settings(
    settings: &mut Vec<LocalProfileDecodeSettings>,
    entry: LocalProfileDecodeSettings,
) {
    if let Some(existing) = settings
        .iter_mut()
        .find(|candidate| candidate.profile_id == entry.profile_id)
    {
        *existing = entry;
        return;
    }

    settings.push(entry);
}

fn resolve_active_local_profile_decode_settings(
    settings: &[LocalProfileDecodeSettings],
    profile_id: &str,
    active_beam_size: u8,
    active_best_of: u8,
) -> LocalProfileDecodeSettings {
    let normalized_profile_id = normalize_local_profile_id(profile_id, "base");

    if let Some(existing) = settings
        .iter()
        .find(|candidate| candidate.profile_id == normalized_profile_id)
    {
        return existing.clone();
    }

    LocalProfileDecodeSettings {
        profile_id: normalized_profile_id.clone(),
        beam_size: normalize_local_decode_value(
            active_beam_size,
            default_local_beam_size_for_profile(&normalized_profile_id),
        ),
        best_of: normalize_local_decode_value(
            active_best_of,
            default_local_best_of_for_profile(&normalized_profile_id),
        ),
    }
}

fn normalize_local_prompt_strength_value(value: &str) -> String {
    match value.trim().to_ascii_lowercase().as_str() {
        "off" => "off".to_string(),
        "profile_and_terms" | "terms" | "strong" => "profile_and_terms".to_string(),
        _ => default_local_prompt_strength().to_string(),
    }
}

pub(crate) fn normalize_local_model_value(model: &str) -> String {
    let normalized = model.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "" => "base".to_string(),
        "large" => "large-v3".to_string(),
        "large_v3" => "large-v3".to_string(),
        other => other.to_string(),
    }
}

fn default_local_profile_mode_for_model(model: &str) -> &'static str {
    let normalized = normalize_local_model_value(model);

    if normalized.starts_with("tiny")
        || normalized.starts_with("base")
        || normalized.starts_with("small")
        || normalized.starts_with("distil-")
        || normalized.ends_with("-turbo")
    {
        "fast"
    } else {
        "quality"
    }
}

pub(crate) fn default_local_profile_for_model(model: &str) -> String {
    let normalized = normalize_local_model_value(model);
    format!(
        "local-preview-{}-{}",
        normalized,
        default_local_profile_mode_for_model(&normalized)
    )
}

pub(crate) fn local_model_from_profile_id(profile: &str) -> Option<String> {
    let normalized = profile.trim().to_ascii_lowercase();
    let rest = normalized.strip_prefix("local-preview-")?;

    rest.strip_suffix("-fast")
        .or_else(|| rest.strip_suffix("-quality"))
        .map(normalize_local_model_value)
}

pub(crate) fn normalize_local_profile_id(profile: &str, fallback_model: &str) -> String {
    let normalized = profile.trim().to_ascii_lowercase();
    let fallback = default_local_profile_for_model(fallback_model);

    let Some(model) = local_model_from_profile_id(&normalized) else {
        return fallback;
    };

    let mode = if normalized.ends_with("-quality") {
        "quality"
    } else {
        "fast"
    };

    format!("local-preview-{}-{}", model, mode)
}

fn default_text_profile_id() -> &'static str {
    "general"
}

fn default_text_profile_label() -> &'static str {
    "General writing"
}

fn default_text_profile_rewrite_style() -> &'static str {
    "clean"
}

fn default_text_profile_insert_behavior() -> &'static str {
    "auto_paste"
}

fn default_text_profile_recovery_behavior() -> &'static str {
    "standard"
}

fn normalize_text_profile_rewrite_style_value(value: &str) -> String {
    match value.trim().to_ascii_lowercase().as_str() {
        "verbatim" => "verbatim".to_string(),
        "polished" | "professional" => "polished".to_string(),
        _ => default_text_profile_rewrite_style().to_string(),
    }
}

fn normalize_text_profile_insert_behavior_value(value: &str) -> String {
    match value.trim().to_ascii_lowercase().as_str() {
        "clipboard_only" | "clipboard" | "manual" => "clipboard_only".to_string(),
        _ => default_text_profile_insert_behavior().to_string(),
    }
}

fn normalize_text_profile_recovery_behavior_value(value: &str) -> String {
    match value.trim().to_ascii_lowercase().as_str() {
        "standard" => "standard".to_string(),
        _ => default_text_profile_recovery_behavior().to_string(),
    }
}

fn normalize_text_profile_work_mode(value: &TextProfileWorkMode) -> TextProfileWorkMode {
    TextProfileWorkMode {
        rewrite_style: normalize_text_profile_rewrite_style_value(&value.rewrite_style),
        insert_behavior: normalize_text_profile_insert_behavior_value(&value.insert_behavior),
        recovery_behavior: normalize_text_profile_recovery_behavior_value(&value.recovery_behavior),
    }
}

fn default_text_profile(
    prompt: String,
    stt_hints: String,
    dictionary_entries: Vec<DictionaryEntry>,
    snippet_entries: Vec<SnippetEntry>,
) -> TextProfile {
    TextProfile {
        id: default_text_profile_id().to_string(),
        label: default_text_profile_label().to_string(),
        prompt,
        stt_hints,
        work_mode: TextProfileWorkMode::default(),
        curation: TextProfileCuration::default(),
        dictionary_entries,
        snippet_entries,
    }
}

fn curated_text_profile_seeds() -> Vec<TextProfile> {
    serde_json::from_str(include_str!("../../../src/data/curatedTextProfiles.json"))
        .expect("curated text profile seed data must stay valid")
}

fn default_seeded_text_profiles() -> Vec<TextProfile> {
    let mut profiles = vec![default_text_profile(
        String::new(),
        String::new(),
        Vec::new(),
        Vec::new(),
    )];
    profiles.extend(curated_text_profile_seeds());
    profiles
}

fn append_missing_curated_text_profiles(text_profiles: &mut Vec<TextProfile>) {
    for seed in curated_text_profile_seeds() {
        if text_profiles.iter().any(|profile| profile.id == seed.id) {
            continue;
        }

        text_profiles.push(seed);
    }
}

fn refresh_unedited_curated_text_profile_metadata(text_profiles: &mut [TextProfile]) {
    let seeds = curated_text_profile_seeds();
    for profile in text_profiles.iter_mut() {
        if !profile.curation.curated {
            continue;
        }

        let Some(seed) = seeds.iter().find(|seed| seed.id == profile.id) else {
            continue;
        };

        profile.work_mode = seed.work_mode.clone();
        profile.curation = seed.curation.clone();
    }
}

fn legacy_text_rules_present(legacy: &LegacyTextRules) -> bool {
    !legacy.prompt.trim().is_empty()
        || !legacy.stt_hints.trim().is_empty()
        || !legacy.dictionary_entries.is_empty()
        || !legacy.snippet_entries.is_empty()
}

fn raw_has_persisted_text_profiles(raw_value: &serde_json::Value) -> bool {
    raw_value
        .get("text_profiles")
        .and_then(|profiles| profiles.as_array())
        .map(|profiles| !profiles.is_empty())
        .unwrap_or(false)
}

fn should_reseed_curated_text_profiles(raw_value: &serde_json::Value) -> bool {
    let Some(profiles) = raw_value
        .get("text_profiles")
        .and_then(|profiles| profiles.as_array())
    else {
        return false;
    };

    if profiles.is_empty() {
        return false;
    }

    match raw_value
        .get("curated_profiles_seeded")
        .and_then(|value| value.as_bool())
    {
        Some(false) | None => return true,
        Some(true) => {}
    }

    let has_curated_profile = profiles.iter().any(|profile| {
        profile
            .get("curation")
            .and_then(|curation| curation.get("curated"))
            .and_then(|value| value.as_bool())
            .unwrap_or(false)
    });
    if has_curated_profile {
        return false;
    }

    // Legacy profile configs from before the work-mode rollout were incorrectly
    // treated as already seeded and therefore never received the included baselines.
    profiles
        .iter()
        .all(|profile| profile.get("work_mode").is_none())
}

fn apply_legacy_text_rules_from_value(config: &mut AppConfig, raw_value: &serde_json::Value) {
    if raw_has_persisted_text_profiles(raw_value) {
        return;
    }

    let legacy = serde_json::from_value::<LegacyTextRules>(raw_value.clone()).unwrap_or_default();
    if !legacy_text_rules_present(&legacy) {
        return;
    }

    config.text_profiles = vec![default_text_profile(
        legacy.prompt,
        legacy.stt_hints,
        legacy.dictionary_entries,
        legacy.snippet_entries,
    )];
    config.active_text_profile_id = default_text_profile_id().to_string();
    config.curated_profiles_seeded = false;
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
    fn normalizes_local_preview_controls_into_runtime_safe_values() {
        let mut config = AppConfig {
            provider: "local_preview".to_string(),
            local_model: "large_v3".to_string(),
            local_profile: String::new(),
            local_prompt_strength: "strong".to_string(),
            local_beam_size: 0,
            local_best_of: 42,
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.local_model, "large-v3");
        assert_eq!(config.local_profile, "local-preview-large-v3-quality");
        assert_eq!(config.local_prompt_strength, "profile_and_terms");
        assert!(!config.local_prompt_carry);
        assert!(config.local_profile_prompt_settings.iter().any(|entry| {
            entry
                == &LocalProfilePromptSettings {
                    profile_id: "local-preview-large-v3-quality".to_string(),
                    prompt_strength: "profile_and_terms".to_string(),
                    prompt_carry: false,
                }
        }));
        assert_eq!(config.local_beam_size, 5);
        assert_eq!(config.local_best_of, 5);
        assert!(config.local_profile_decode_settings.iter().any(|entry| {
            entry
                == &LocalProfileDecodeSettings {
                    profile_id: "local-preview-large-v3-quality".to_string(),
                    beam_size: 5,
                    best_of: 5,
                }
        }));
        assert!(config.local_profile_decode_settings.iter().any(|entry| {
            LocalProfileDecodeSettings {
                profile_id: "local-preview-base-fast".to_string(),
                beam_size: 1,
                best_of: 1,
            } == *entry
        }));
    }

    #[test]
    fn selected_local_profile_overrides_stale_local_model() {
        let mut config = AppConfig {
            provider: "local_preview".to_string(),
            local_model: "base".to_string(),
            local_profile: "local-preview-medium-fast".to_string(),
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.local_model, "medium");
        assert_eq!(config.local_profile, "local-preview-medium-fast");
    }

    #[test]
    fn selected_local_profile_uses_profile_specific_decode_settings() {
        let mut config = AppConfig {
            provider: "local_preview".to_string(),
            local_model: "base".to_string(),
            local_profile: "local-preview-medium-quality".to_string(),
            local_beam_size: 1,
            local_best_of: 1,
            local_profile_decode_settings: vec![LocalProfileDecodeSettings {
                profile_id: "local-preview-medium-quality".to_string(),
                beam_size: 7,
                best_of: 6,
            }],
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.local_beam_size, 7);
        assert_eq!(config.local_best_of, 6);
        assert_eq!(
            config.local_profile_decode_settings[0],
            LocalProfileDecodeSettings {
                profile_id: "local-preview-medium-quality".to_string(),
                beam_size: 7,
                best_of: 6,
            }
        );
    }

    #[test]
    fn selected_local_profile_uses_profile_specific_prompt_settings() {
        let mut config = AppConfig {
            provider: "local_preview".to_string(),
            local_model: "base".to_string(),
            local_profile: "local-preview-medium-quality".to_string(),
            local_prompt_strength: "off".to_string(),
            local_prompt_carry: false,
            local_profile_prompt_settings: vec![LocalProfilePromptSettings {
                profile_id: "local-preview-medium-quality".to_string(),
                prompt_strength: "profile_and_terms".to_string(),
                prompt_carry: true,
            }],
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert_eq!(config.local_prompt_strength, "profile_and_terms");
        assert!(config.local_prompt_carry);
        assert_eq!(
            config.local_profile_prompt_settings[0],
            LocalProfilePromptSettings {
                profile_id: "local-preview-medium-quality".to_string(),
                prompt_strength: "profile_and_terms".to_string(),
                prompt_carry: true,
            }
        );
    }

    #[test]
    fn migrates_legacy_text_rules_into_the_default_profile() {
        let raw_value = serde_json::json!({
            "prompt": "Product names and internal jargon",
            "stt_hints": "status update\nincident review",
            "dictionary_entries": [
                {
                    "id": "dict-brand",
                    "phrase": "word script",
                    "replace_with": "WordScript"
                }
            ],
            "snippet_entries": [
                {
                    "id": "snippet-follow-up",
                    "label": "Follow-up",
                    "trigger": "follow up",
                    "expansion": "Thanks for the update."
                }
            ]
        });

        let mut config = AppConfig {
            active_text_profile_id: String::new(),
            text_profiles: Vec::new(),
            curated_profiles_seeded: false,
            ..AppConfig::default()
        };

        apply_legacy_text_rules_from_value(&mut config, &raw_value);
        config.normalize_for_runtime();

        assert_eq!(config.active_text_profile_id, "general");
        assert!(config.curated_profiles_seeded);
        assert!(config.text_profiles.len() >= 6);

        let general_profile = config
            .text_profiles
            .iter()
            .find(|profile| profile.id == "general")
            .expect("general profile");

        assert_eq!(general_profile.label, "General writing");
        assert_eq!(general_profile.prompt, "Product names and internal jargon");
        assert_eq!(general_profile.stt_hints, "status update\nincident review");
        assert_eq!(general_profile.dictionary_entries.len(), 1);
        assert_eq!(general_profile.snippet_entries.len(), 1);
        assert!(config
            .text_profiles
            .iter()
            .any(|profile| profile.curation.curated));
    }

    #[test]
    fn keeps_existing_active_text_profile_as_runtime_owner() {
        let mut config = AppConfig {
            active_text_profile_id: "support".to_string(),
            text_profiles: vec![
                TextProfile {
                    id: "general".to_string(),
                    label: "General writing".to_string(),
                    prompt: "General".to_string(),
                    stt_hints: String::new(),
                    work_mode: TextProfileWorkMode::default(),
                    curation: TextProfileCuration::default(),
                    dictionary_entries: Vec::new(),
                    snippet_entries: Vec::new(),
                },
                TextProfile {
                    id: "support".to_string(),
                    label: "Support reply".to_string(),
                    prompt: "Support tone and escalation names".to_string(),
                    stt_hints: "status update\ntriage summary".to_string(),
                    work_mode: TextProfileWorkMode {
                        rewrite_style: "professional".to_string(),
                        insert_behavior: "clipboard".to_string(),
                        recovery_behavior: "guided".to_string(),
                    },
                    curation: TextProfileCuration::default(),
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
                },
            ],
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        let active_profile = config.active_text_profile();
        assert_eq!(active_profile.id, "support");
        assert_eq!(active_profile.label, "Support reply");
        assert_eq!(active_profile.prompt, "Support tone and escalation names");
        assert_eq!(active_profile.stt_hints, "status update\ntriage summary");
        assert_eq!(active_profile.work_mode.rewrite_style, "polished");
        assert_eq!(active_profile.work_mode.insert_behavior, "clipboard_only");
        assert_eq!(active_profile.work_mode.recovery_behavior, "standard");
        assert_eq!(active_profile.dictionary_entries.len(), 1);
        assert_eq!(active_profile.snippet_entries.len(), 1);
        assert_eq!(
            config.active_text_profile_label().as_deref(),
            Some("Support reply")
        );
    }

    #[test]
    fn seeds_curated_profiles_once_for_existing_configs() {
        let mut config = AppConfig {
            curated_profiles_seeded: false,
            active_text_profile_id: "general".to_string(),
            text_profiles: vec![TextProfile {
                id: "general".to_string(),
                label: "General writing".to_string(),
                prompt: String::new(),
                stt_hints: String::new(),
                work_mode: TextProfileWorkMode::default(),
                curation: TextProfileCuration::default(),
                dictionary_entries: Vec::new(),
                snippet_entries: Vec::new(),
            }],
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        assert!(config.curated_profiles_seeded);
        assert!(config
            .text_profiles
            .iter()
            .any(|profile| profile.id == "curated-customer-success" && profile.curation.curated));
        assert_eq!(
            config
                .text_profiles
                .iter()
                .find(|profile| profile.id == "curated-customer-success")
                .map(|profile| profile.work_mode.rewrite_style.as_str()),
            Some("polished")
        );

        let profile_count = config.text_profiles.len();
        config.normalize_for_runtime();
        assert_eq!(config.text_profiles.len(), profile_count);
    }

    #[test]
    fn refreshes_unedited_curated_profile_work_mode_metadata() {
        let mut config = AppConfig {
            curated_profiles_seeded: true,
            active_text_profile_id: "curated-customer-success".to_string(),
            text_profiles: vec![TextProfile {
                id: "curated-customer-success".to_string(),
                label: "Customer success replies".to_string(),
                prompt: String::new(),
                stt_hints: String::new(),
                work_mode: TextProfileWorkMode::default(),
                curation: TextProfileCuration {
                    curated: true,
                    audience: "Customer success".to_string(),
                    summary: "Old summary".to_string(),
                    highlights: Vec::new(),
                },
                dictionary_entries: Vec::new(),
                snippet_entries: Vec::new(),
            }],
            ..AppConfig::default()
        };

        config.normalize_for_runtime();

        let active_profile = config.active_text_profile();
        assert_eq!(active_profile.work_mode.rewrite_style, "polished");
        assert_eq!(active_profile.work_mode.insert_behavior, "auto_paste");
        assert_eq!(active_profile.curation.summary, "Inbox-ready support follow-ups, escalation language and status updates for customer-facing work.");
    }

    #[test]
    fn repairs_legacy_profile_configs_that_were_marked_seeded_too_early() {
        let raw_value = serde_json::json!({
            "active_text_profile_id": "general",
            "text_profiles": [
                {
                    "id": "general",
                    "label": "General writing",
                    "prompt": "",
                    "stt_hints": "",
                    "curation": {
                        "curated": false,
                        "audience": "",
                        "summary": "",
                        "highlights": []
                    },
                    "dictionary_entries": [],
                    "snippet_entries": []
                }
            ],
            "curated_profiles_seeded": true
        });

        assert!(should_reseed_curated_text_profiles(&raw_value));

        let mut config = serde_json::from_value::<AppConfig>(raw_value.clone()).unwrap_or_default();
        apply_legacy_text_rules_from_value(&mut config, &raw_value);
        if should_reseed_curated_text_profiles(&raw_value) {
            config.curated_profiles_seeded = false;
        }
        config.normalize_for_runtime();

        assert!(config.curated_profiles_seeded);
        assert!(config
            .text_profiles
            .iter()
            .any(|profile| profile.id == "curated-customer-success" && profile.curation.curated));
        assert!(config
            .text_profiles
            .iter()
            .any(|profile| profile.id == "curated-sales" && profile.curation.curated));
    }

    #[test]
    fn does_not_reseed_current_shape_configs_after_curated_profiles_were_removed() {
        let raw_value = serde_json::json!({
            "active_text_profile_id": "general",
            "text_profiles": [
                {
                    "id": "general",
                    "label": "General writing",
                    "prompt": "",
                    "stt_hints": "",
                    "work_mode": {
                        "rewrite_style": "clean",
                        "insert_behavior": "auto_paste",
                        "recovery_behavior": "standard"
                    },
                    "curation": {
                        "curated": false,
                        "audience": "",
                        "summary": "",
                        "highlights": []
                    },
                    "dictionary_entries": [],
                    "snippet_entries": []
                }
            ],
            "curated_profiles_seeded": true
        });

        assert!(!should_reseed_curated_text_profiles(&raw_value));
    }

    #[test]
    fn active_text_profile_falls_back_to_first_profile_without_legacy_mirrors() {
        let config = AppConfig {
            active_text_profile_id: "missing".to_string(),
            text_profiles: vec![TextProfile {
                id: "general".to_string(),
                label: "General writing".to_string(),
                prompt: "profile prompt".to_string(),
                stt_hints: "profile hint".to_string(),
                work_mode: TextProfileWorkMode::default(),
                curation: TextProfileCuration::default(),
                dictionary_entries: Vec::new(),
                snippet_entries: Vec::new(),
            }],
            ..AppConfig::default()
        };

        let active_profile = config.active_text_profile();

        assert_eq!(active_profile.id, "general");
        assert_eq!(active_profile.prompt, "profile prompt");
        assert_eq!(active_profile.stt_hints, "profile hint");
        assert_eq!(active_profile.work_mode, TextProfileWorkMode::default());
        assert!(active_profile.dictionary_entries.is_empty());
        assert!(active_profile.snippet_entries.is_empty());
    }

    #[test]
    fn ignores_legacy_text_rules_when_profiles_are_already_persisted() {
        let raw_value = serde_json::json!({
            "prompt": "legacy prompt should stay unused",
            "stt_hints": "legacy hint",
            "dictionary_entries": [
                {
                    "id": "legacy-dict",
                    "phrase": "word script",
                    "replace_with": "WordScript"
                }
            ],
            "snippet_entries": [
                {
                    "id": "legacy-snippet",
                    "label": "Status",
                    "trigger": "status update",
                    "expansion": "Legacy expansion"
                }
            ],
            "text_profiles": [
                {
                    "id": "general",
                    "label": "General writing",
                    "prompt": "profile prompt",
                    "stt_hints": "profile hint",
                    "dictionary_entries": [],
                    "snippet_entries": []
                }
            ]
        });

        let mut config = AppConfig {
            active_text_profile_id: "general".to_string(),
            text_profiles: vec![TextProfile {
                id: "general".to_string(),
                label: "General writing".to_string(),
                prompt: "profile prompt".to_string(),
                stt_hints: "profile hint".to_string(),
                work_mode: TextProfileWorkMode::default(),
                curation: TextProfileCuration::default(),
                dictionary_entries: Vec::new(),
                snippet_entries: Vec::new(),
            }],
            curated_profiles_seeded: true,
            ..AppConfig::default()
        };

        apply_legacy_text_rules_from_value(&mut config, &raw_value);

        let active_profile = config.active_text_profile();
        assert_eq!(active_profile.prompt, "profile prompt");
        assert_eq!(active_profile.stt_hints, "profile hint");
        assert!(active_profile.dictionary_entries.is_empty());
        assert!(active_profile.snippet_entries.is_empty());
    }

    #[test]
    fn defaults_to_high_accuracy_correction_model() {
        let config = AppConfig::default();

        assert_eq!(config.correction_model, DEFAULT_CORRECTION_MODEL);
    }
}
