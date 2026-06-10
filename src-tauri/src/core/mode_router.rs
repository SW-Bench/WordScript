use std::collections::HashMap;
use std::sync::Mutex;

use serde::Serialize;

use super::config::ProcessingMode;

static MODE_OVERRIDE: Mutex<Option<ProcessingMode>> = Mutex::new(None);

#[derive(Debug, Clone, Serialize)]
pub struct ProcessingContext {
    pub mode: ProcessingMode,
    pub is_override: bool,
    pub auto_detected: bool,
    pub detected_from: Option<String>,
}

pub fn resolve_processing_mode(
    profile_mode: ProcessingMode,
    manual_override: Option<ProcessingMode>,
    config_auto_detect: bool,
    workspace_category: &str,
    workspace_app_map: &HashMap<String, ProcessingMode>,
) -> ProcessingContext {
    if let Some(override_mode) = manual_override {
        return ProcessingContext {
            mode: override_mode,
            is_override: true,
            auto_detected: false,
            detected_from: None,
        };
    }

    if config_auto_detect {
        if let Some(mapped_mode) = workspace_app_map.get(workspace_category) {
            if *mapped_mode != profile_mode {
                return ProcessingContext {
                    mode: mapped_mode.clone(),
                    is_override: false,
                    auto_detected: true,
                    detected_from: Some(format!("workspace_map:{}", workspace_category)),
                };
            }
        }
    }

    ProcessingContext {
        mode: profile_mode,
        is_override: false,
        auto_detected: false,
        detected_from: None,
    }
}

// Validation helper for the upcoming mode-conflict UI; exercised by unit tests.
#[allow(dead_code)]
pub fn is_invalid_mode_combination(mode_a: &ProcessingMode, mode_b: &ProcessingMode) -> bool {
    matches!(
        (mode_a, mode_b),
        (ProcessingMode::Verbatim, ProcessingMode::Agent)
            | (ProcessingMode::Verbatim, ProcessingMode::PromptEnhance)
            | (ProcessingMode::Agent, ProcessingMode::Verbatim)
            | (ProcessingMode::PromptEnhance, ProcessingMode::Verbatim)
    )
}

#[tauri::command]
pub fn set_processing_mode_override(mode: String) -> Result<(), String> {
    let parsed = ProcessingMode::from_str(&mode);
    if parsed == ProcessingMode::Cleanup && !matches!(mode.as_str(), "cleanup") {
        return Err(format!("Unknown processing mode: {}", mode));
    }
    let mut override_lock = MODE_OVERRIDE.lock().map_err(|e| e.to_string())?;
    *override_lock = Some(parsed);
    Ok(())
}

#[tauri::command]
pub fn clear_processing_mode_override() -> Result<(), String> {
    let mut override_lock = MODE_OVERRIDE.lock().map_err(|e| e.to_string())?;
    *override_lock = None;
    Ok(())
}

pub fn current_mode_override() -> Option<ProcessingMode> {
    MODE_OVERRIDE.lock().ok().and_then(|guard| guard.clone())
}

/// Joins the active profile's mode, any manual override, and (when auto-detect is on)
/// the workspace app map into a single resolved `ProcessingContext`. This is the seam
/// the frontend uses to know which mode a dictation will actually run in.
#[tauri::command]
pub async fn resolve_current_processing_mode() -> Result<ProcessingContext, String> {
    let config = super::config::AppConfig::load_from_disk();

    let profile_mode = config
        .text_profiles
        .iter()
        .find(|profile| profile.id == config.active_text_profile_id)
        .map(|profile| profile.work_mode.effective_processing_mode())
        .unwrap_or_else(|| config.processing_mode.clone());

    let manual_override = current_mode_override();
    let auto_detect = config.auto_detect_mode;
    let workspace_app_map = config.workspace_app_map.clone();

    // App detection shells out to the OS; keep it off the async runtime thread and
    // only pay the cost when auto-detection is actually enabled.
    let category = if auto_detect && manual_override.is_none() {
        tauri::async_runtime::spawn_blocking(|| {
            super::workspace_context::detect_active_app().category
        })
        .await
        .map_err(|e| e.to_string())?
    } else {
        String::new()
    };

    Ok(resolve_processing_mode(
        profile_mode,
        manual_override,
        auto_detect,
        &category,
        &workspace_app_map,
    ))
}

fn is_known_processing_mode(value: &str) -> bool {
    matches!(
        value,
        "cleanup" | "rewrite" | "agent" | "prompt_enhance" | "verbatim"
    )
}

#[tauri::command]
pub fn add_workspace_app_mapping(
    app_category: String,
    mode: String,
) -> Result<super::config::AppConfig, String> {
    let parsed_mode = ProcessingMode::from_str(&mode);
    if parsed_mode == ProcessingMode::Cleanup && !is_known_processing_mode(&mode) {
        return Err(format!("Unknown processing mode: {}", mode));
    }

    let valid_categories = ["ide", "browser", "chat", "mail", "notes", "terminal", "other"];
    if !valid_categories.contains(&app_category.as_str()) {
        return Err(format!("Unknown app category: {}", app_category));
    }

    let mut config = super::config::AppConfig::load_from_disk();
    config.workspace_app_map.insert(app_category, parsed_mode);
    config.save_to_disk()?;
    Ok(config.without_secrets())
}

#[tauri::command]
pub fn remove_workspace_app_mapping(
    app_category: String,
) -> Result<super::config::AppConfig, String> {
    let mut config = super::config::AppConfig::load_from_disk();
    config.workspace_app_map.remove(&app_category);
    config.save_to_disk()?;
    Ok(config.without_secrets())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_map() -> HashMap<String, ProcessingMode> {
        let mut map = HashMap::new();
        map.insert("ide".to_string(), ProcessingMode::Agent);
        map.insert("browser".to_string(), ProcessingMode::Verbatim);
        map.insert("chat".to_string(), ProcessingMode::PromptEnhance);
        map
    }

    #[test]
    fn manual_override_wins_over_profile_default() {
        let result = resolve_processing_mode(
            ProcessingMode::Rewrite,
            Some(ProcessingMode::Verbatim),
            false,
            "ide",
            &test_map(),
        );
        assert_eq!(result.mode, ProcessingMode::Verbatim);
        assert!(result.is_override);
        assert!(!result.auto_detected);
    }

    #[test]
    fn auto_detect_from_workspace_map_wins_over_profile() {
        let result = resolve_processing_mode(
            ProcessingMode::Rewrite,
            None,
            true,
            "ide",
            &test_map(),
        );
        assert_eq!(result.mode, ProcessingMode::Agent);
        assert!(!result.is_override);
        assert!(result.auto_detected);
        assert_eq!(
            result.detected_from,
            Some("workspace_map:ide".to_string())
        );
    }

    #[test]
    fn profile_default_used_when_no_override_and_no_match() {
        let result = resolve_processing_mode(
            ProcessingMode::Rewrite,
            None,
            true,
            "notes",
            &test_map(),
        );
        assert_eq!(result.mode, ProcessingMode::Rewrite);
        assert!(!result.is_override);
        assert!(!result.auto_detected);
        assert_eq!(result.detected_from, None);
    }

    #[test]
    fn profile_default_used_when_auto_detect_disabled() {
        let result = resolve_processing_mode(
            ProcessingMode::Rewrite,
            None,
            false,
            "ide",
            &test_map(),
        );
        assert_eq!(result.mode, ProcessingMode::Rewrite);
        assert!(!result.is_override);
        assert!(!result.auto_detected);
    }

    #[test]
    fn invalid_combination_verbatim_and_agent_is_detected() {
        assert!(is_invalid_mode_combination(
            &ProcessingMode::Verbatim,
            &ProcessingMode::Agent
        ));
        assert!(is_invalid_mode_combination(
            &ProcessingMode::Agent,
            &ProcessingMode::Verbatim
        ));
    }

    #[test]
    fn invalid_combination_verbatim_and_prompt_enhance_is_detected() {
        assert!(is_invalid_mode_combination(
            &ProcessingMode::Verbatim,
            &ProcessingMode::PromptEnhance
        ));
        assert!(is_invalid_mode_combination(
            &ProcessingMode::PromptEnhance,
            &ProcessingMode::Verbatim
        ));
    }

    #[test]
    fn valid_combinations_are_not_flagged_invalid() {
        assert!(!is_invalid_mode_combination(
            &ProcessingMode::Agent,
            &ProcessingMode::PromptEnhance
        ));
        assert!(!is_invalid_mode_combination(
            &ProcessingMode::Rewrite,
            &ProcessingMode::Agent
        ));
        assert!(!is_invalid_mode_combination(
            &ProcessingMode::Rewrite,
            &ProcessingMode::Rewrite
        ));
    }

    #[test]
    fn override_cleared_after_clear() {
        let _ = set_processing_mode_override("agent".to_string());
        assert_eq!(current_mode_override(), Some(ProcessingMode::Agent));
        let _ = clear_processing_mode_override();
        assert_eq!(current_mode_override(), None);
    }

    #[test]
    fn set_processing_mode_override_rejects_unknown_mode() {
        let result = set_processing_mode_override("invalid_mode".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn set_processing_mode_override_accepts_aliases() {
        let result = set_processing_mode_override("polished".to_string());
        assert!(result.is_ok());
        assert_eq!(current_mode_override(), Some(ProcessingMode::Rewrite));
        let _ = clear_processing_mode_override();
    }
}
