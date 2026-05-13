use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::{Duration, Instant};

use tokio::process::Command;
use tokio::time::timeout;

use crate::core::runtime_log;

use super::{
    ChatCompletionRequest, ProviderCommandError, ProviderCredentialStatus,
    ProviderErrorKind, ProviderProfile, ProviderStatus, TranscribeAudioFileRequest,
    TranscriptionResponse, ValidateProviderApiKeyResponse, LOCAL_PREVIEW_PROVIDER_ID,
};

const DEFAULT_TIMEOUT_MS: u64 = 90_000;
const LOCAL_STORAGE_LABEL: &str = "external_cli";
const LOCAL_WHISPER_BINARY_ENV: &str = "WORDSCRIPT_LOCAL_WHISPER_CLI";
const LOCAL_MODEL_PATH_ENV: &str = "WORDSCRIPT_LOCAL_MODEL_PATH";
const LOCAL_MODEL_DIR_ENV: &str = "WORDSCRIPT_LOCAL_MODEL_DIR";

pub fn provider_status() -> Result<ProviderStatus, ProviderCommandError> {
    let binary = resolve_local_whisper_binary();
    let model_path = resolve_local_model_path("base").ok();
    let configured = binary.is_some() && model_path.is_some();
    let status_detail = Some(match (&binary, &model_path) {
        (Some(binary), Some(model_path)) => format!(
            "{} · {}",
            binary,
            model_path.file_name().and_then(|value| value.to_str()).unwrap_or("model.bin"),
        ),
        (Some(binary), None) => format!(
            "{} · set {} or {}",
            binary, LOCAL_MODEL_PATH_ENV, LOCAL_MODEL_DIR_ENV,
        ),
        (None, Some(model_path)) => format!(
            "set {} or install whisper-cli · {}",
            LOCAL_WHISPER_BINARY_ENV,
            model_path.display(),
        ),
        (None, None) => format!(
            "install whisper-cli and set {} or {}",
            LOCAL_MODEL_PATH_ENV, LOCAL_MODEL_DIR_ENV,
        ),
    });

    Ok(ProviderStatus {
        provider: LOCAL_PREVIEW_PROVIDER_ID.to_string(),
        default_profile: "local-preview-base".to_string(),
        credential: ProviderCredentialStatus {
            provider: LOCAL_PREVIEW_PROVIDER_ID.to_string(),
            configured,
            storage: LOCAL_STORAGE_LABEL.to_string(),
            key_preview: status_detail,
        },
        profiles: provider_profiles(),
    })
}

pub fn save_api_key(_api_key: &str) -> Result<ProviderCredentialStatus, ProviderCommandError> {
    Err(ProviderCommandError::invalid_request(
        "Local preview does not use API keys. Configure whisper-cli and a local model instead.",
    ))
}

pub fn clear_api_key() -> Result<ProviderCredentialStatus, ProviderCommandError> {
    Err(ProviderCommandError::invalid_request(
        "Local preview does not use API keys. There is no stored key to clear.",
    ))
}

pub async fn validate_api_key(
    _api_key: Option<String>,
) -> Result<ValidateProviderApiKeyResponse, ProviderCommandError> {
    let status = provider_status()?;
    if !status.credential.configured {
        return Err(ProviderCommandError::invalid_request(
            local_preview_setup_message("base"),
        ));
    }

    Ok(ValidateProviderApiKeyResponse {
        ok: true,
        provider: LOCAL_PREVIEW_PROVIDER_ID.to_string(),
        checked_with: "local_runner".to_string(),
    })
}

pub async fn transcribe_audio_file(
    request: TranscribeAudioFileRequest,
) -> Result<TranscriptionResponse, ProviderCommandError> {
    let started_at = Instant::now();
    let binary = resolve_local_whisper_binary().ok_or_else(|| {
        ProviderCommandError::invalid_request(local_preview_setup_message(
            request.model.as_deref().unwrap_or("base"),
        ))
    })?;
    let model = request
        .model
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("base");
    let model_path = resolve_local_model_path(model)?;
    let language = request.language.filter(|value| !value.trim().is_empty());
    let timeout_ms = request.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS).max(10_000);

    if let Some(prompt) = request.prompt.as_ref().filter(|value| !value.trim().is_empty()) {
        runtime_log::record(format!(
            "[WordScript] Local preview ignored transcription prompt because the external runner path does not map prompt-bias consistently yet: {} chars",
            prompt.len(),
        ));
    }

    let mut command = Command::new(&binary);
    command
        .arg("-m")
        .arg(&model_path)
        .arg("-f")
        .arg(&request.audio_path)
        .arg("-nt")
        .arg("-np")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(language) = language.as_deref() {
        command.arg("-l").arg(language);
    }

    runtime_log::record(format!(
        "[WordScript] Local preview transcription start binary={} model={} timeout_ms={} audio_path={}",
        binary,
        model_path.display(),
        timeout_ms,
        request.audio_path,
    ));

    let output = timeout(Duration::from_millis(timeout_ms), command.output())
        .await
        .map_err(|_| ProviderCommandError {
            kind: ProviderErrorKind::Timeout,
            message: format!(
                "Local preview transcription timed out after {} ms while waiting for whisper-cli.",
                timeout_ms,
            ),
            status: None,
            retry_after_seconds: None,
        })?
        .map_err(|error| ProviderCommandError {
            kind: ProviderErrorKind::Io,
            message: format!("Could not start local preview transcription: {error}"),
            status: None,
            retry_after_seconds: None,
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(ProviderCommandError {
            kind: ProviderErrorKind::ProviderStatus,
            message: if stderr.is_empty() {
                format!(
                    "Local preview transcription failed with status {}.",
                    output.status,
                )
            } else {
                format!("Local preview transcription failed: {stderr}")
            },
            status: output.status.code().map(|code| code as u16),
            retry_after_seconds: None,
        });
    }

    let text = normalize_transcription_stdout(&output.stdout);
    if text.is_empty() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(ProviderCommandError {
            kind: ProviderErrorKind::Parse,
            message: if stderr.is_empty() {
                "Local preview returned no transcription text on stdout.".to_string()
            } else {
                format!(
                    "Local preview returned no transcription text. whisper-cli stderr: {}",
                    stderr,
                )
            },
            status: None,
            retry_after_seconds: None,
        });
    }

    runtime_log::record(format!(
        "[WordScript] Local preview transcription done elapsed_ms={} chars={}",
        started_at.elapsed().as_millis(),
        text.len(),
    ));

    Ok(TranscriptionResponse {
        text,
        language,
        duration: None,
        segments: None,
    })
}

pub async fn create_chat_completion(
    _request: ChatCompletionRequest,
) -> Result<String, ProviderCommandError> {
    Err(ProviderCommandError::invalid_request(
        "Local preview does not provide AI cleanup. Disable AI cleanup or switch back to Groq for post-correction.",
    ))
}

fn provider_profiles() -> Vec<ProviderProfile> {
    vec![
        ProviderProfile {
            id: "local-preview-base".to_string(),
            provider: LOCAL_PREVIEW_PROVIDER_ID.to_string(),
            model: "base".to_string(),
            label: "Local preview base model (external whisper-cli)".to_string(),
            default: true,
            requires_api_key: false,
        },
        ProviderProfile {
            id: "local-preview-small".to_string(),
            provider: LOCAL_PREVIEW_PROVIDER_ID.to_string(),
            model: "small".to_string(),
            label: "Local preview small model (external whisper-cli)".to_string(),
            default: false,
            requires_api_key: false,
        },
        ProviderProfile {
            id: "local-preview-medium".to_string(),
            provider: LOCAL_PREVIEW_PROVIDER_ID.to_string(),
            model: "medium".to_string(),
            label: "Local preview medium model (external whisper-cli)".to_string(),
            default: false,
            requires_api_key: false,
        },
        ProviderProfile {
            id: "local-preview-large-v3".to_string(),
            provider: LOCAL_PREVIEW_PROVIDER_ID.to_string(),
            model: "large-v3".to_string(),
            label: "Local preview large-v3 model (external whisper-cli)".to_string(),
            default: false,
            requires_api_key: false,
        },
    ]
}

fn local_preview_setup_message(model: &str) -> String {
    format!(
        "Local preview requires an external whisper-cli runner and a local model file. Set {} to the binary or install whisper-cli in PATH, then point {} to a ggml model file or {} to a directory containing ggml-{}.bin.",
        LOCAL_WHISPER_BINARY_ENV,
        LOCAL_MODEL_PATH_ENV,
        LOCAL_MODEL_DIR_ENV,
        normalize_local_model_name(model),
    )
}

fn normalize_transcription_stdout(stdout: &[u8]) -> String {
    String::from_utf8_lossy(stdout)
        .lines()
        .map(str::trim)
        .map(strip_whisper_segment_prefix)
        .filter(|line| !is_non_transcript_output(line))
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

fn strip_whisper_segment_prefix(line: &str) -> &str {
    if line.starts_with('[') && line.contains("-->") {
        if let Some(index) = line.find(']') {
            return line[index + 1..].trim();
        }
    }

    line
}

fn is_non_transcript_output(line: &str) -> bool {
    let lower = line.trim().to_ascii_lowercase();

    lower.starts_with("main:")
        || lower.starts_with("whisper_")
        || lower.starts_with("system_info:")
        || lower.starts_with("output_")
        || lower.starts_with("sampling parameters:")
        || lower.starts_with("n_threads =")
        || lower.starts_with("n_processors =")
}

fn resolve_local_whisper_binary() -> Option<String> {
    std::env::var(LOCAL_WHISPER_BINARY_ENV)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| command_in_path("whisper-cli").then(|| "whisper-cli".to_string()))
}

fn resolve_local_model_path(model: &str) -> Result<PathBuf, ProviderCommandError> {
    let requested = model.trim();
    if requested.is_empty() {
        return resolve_local_model_path("base");
    }

    if requested.contains('/') || requested.contains('\\') || requested.ends_with(".bin") {
        let explicit_path = PathBuf::from(requested);
        if explicit_path.is_dir() {
            return find_local_model_path_in_dir(&explicit_path, requested);
        }

        return validate_local_model_path(explicit_path);
    }

    if let Ok(path) = std::env::var(LOCAL_MODEL_PATH_ENV) {
        if !path.trim().is_empty() {
            let explicit_path = PathBuf::from(path);
            if explicit_path.is_dir() {
                return find_local_model_path_in_dir(&explicit_path, requested);
            }

            return validate_local_model_path(explicit_path);
        }
    }

    if let Ok(dir) = std::env::var(LOCAL_MODEL_DIR_ENV) {
        if !dir.trim().is_empty() {
            return find_local_model_path_in_dir(&PathBuf::from(dir), requested);
        }
    }

    Err(ProviderCommandError::invalid_request(local_preview_setup_message(
        requested,
    )))
}

fn find_local_model_path_in_dir(
    dir: &Path,
    requested: &str,
) -> Result<PathBuf, ProviderCommandError> {
    let normalized = normalize_local_model_name(requested);
    let preferred_files = [
        format!("ggml-{}.bin", normalized),
        format!("ggml-{}.en.bin", normalized),
    ];

    for file_name in preferred_files {
        let candidate = dir.join(file_name);
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    let mut matches = std::fs::read_dir(dir)
        .map_err(|error| {
            ProviderCommandError::invalid_request(format!(
                "Could not read local preview model directory {}: {error}",
                dir.display(),
            ))
        })?
        .filter_map(|entry| entry.ok().map(|value| value.path()))
        .filter(|path| path.is_file())
        .filter(|path| {
            path.extension()
                .and_then(|value| value.to_str())
                .is_some_and(|value| value.eq_ignore_ascii_case("bin"))
        })
        .filter(|path| local_model_filename_matches(path, &normalized))
        .collect::<Vec<_>>();

    matches.sort();
    if let Some(path) = matches.into_iter().next() {
        return Ok(path);
    }

    Err(ProviderCommandError::invalid_request(format!(
        "Local preview model file was not found in {} for '{}'. Set {} to a valid ggml model file or {} to a directory containing the requested model.",
        dir.display(),
        normalized,
        LOCAL_MODEL_PATH_ENV,
        LOCAL_MODEL_DIR_ENV,
    )))
}

fn local_model_filename_matches(path: &Path, normalized_model: &str) -> bool {
    let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
        return false;
    };

    let lower = file_name.to_ascii_lowercase();
    let exact = format!("ggml-{}.bin", normalized_model);
    let english = format!("ggml-{}.en.bin", normalized_model);
    let dashed_prefix = format!("ggml-{}-", normalized_model);
    let dotted_prefix = format!("ggml-{}.", normalized_model);

    lower == exact
        || lower == english
        || (lower.starts_with(&dashed_prefix) && lower.ends_with(".bin"))
        || (lower.starts_with(&dotted_prefix) && lower.ends_with(".bin"))
}

fn validate_local_model_path(path: PathBuf) -> Result<PathBuf, ProviderCommandError> {
    if path.is_file() {
        return Ok(path);
    }

    Err(ProviderCommandError::invalid_request(format!(
        "Local preview model file was not found at {}. Set {} to a valid ggml model file or {} to a directory containing the requested model.",
        path.display(),
        LOCAL_MODEL_PATH_ENV,
        LOCAL_MODEL_DIR_ENV,
    )))
}

fn normalize_local_model_name(model: &str) -> String {
    let normalized = model.trim().to_ascii_lowercase().replace('_', "-");
    match normalized.as_str() {
        "" => "base".to_string(),
        "large" => "large-v3".to_string(),
        other => other.to_string(),
    }
}

fn command_in_path(program: &str) -> bool {
    std::env::var_os("PATH")
        .map(|paths| {
            std::env::split_paths(&paths).any(|path| {
                let candidate = path.join(program);
                candidate.is_file() && is_executable(&candidate)
            })
        })
        .unwrap_or(false)
}

fn is_executable(path: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        return std::fs::metadata(path)
            .map(|metadata| metadata.permissions().mode() & 0o111 != 0)
            .unwrap_or(false);
    }

    #[cfg(not(unix))]
    {
        path.is_file()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_local_model_aliases() {
        assert_eq!(normalize_local_model_name("base"), "base");
        assert_eq!(normalize_local_model_name("large"), "large-v3");
        assert_eq!(normalize_local_model_name("large_v3"), "large-v3");
    }

    #[test]
    fn normalizes_whisper_cli_segment_output() {
        let stdout = br#"
main: processing '/tmp/test.wav' (16000 samples)
[00:00:00.000 --> 00:00:01.200]  hello world
[00:00:01.200 --> 00:00:02.000]  from wordscript
whisper_print_timings: total time = 1337.00 ms
        "#;

        assert_eq!(
            normalize_transcription_stdout(stdout),
            "hello world from wordscript"
        );
    }

    #[test]
    fn finds_quantized_model_variants_in_directory() {
        let dir = std::env::temp_dir().join("wordscript-local-preview-models");
        let _ = std::fs::create_dir_all(&dir);
        let quantized = dir.join("ggml-large-v3-q5_0.bin");
        std::fs::write(&quantized, "model").expect("write model file");

        let resolved = find_local_model_path_in_dir(&dir, "large-v3")
            .expect("resolve quantized model variant");

        assert_eq!(resolved, quantized);
    }

    #[test]
    fn local_preview_status_is_not_configured_without_runner_or_model() {
        let status = provider_status().expect("local preview status");

        assert_eq!(status.provider, LOCAL_PREVIEW_PROVIDER_ID);
        assert!(!status.credential.configured);
        assert!(status
            .credential
            .key_preview
            .as_deref()
            .unwrap_or_default()
            .contains("whisper-cli"));
    }
}