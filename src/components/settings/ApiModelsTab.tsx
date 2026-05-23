import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { providerErrorActionLabel, useProvider } from "../../hooks/useProvider";
import type { AppConfig } from "../../types/ipc";
import type {
  LocalProviderIssueCode,
  ProviderCapabilities,
  ProviderId,
  ProviderProfile,
} from "../../types/providers";

interface Props {
  config: AppConfig;
  onChange: (p: Partial<AppConfig>) => void;
  onOpenDiagnostics: () => void;
}

const WHISPER_MODELS = [
  "whisper-large-v3-turbo",
  "whisper-large-v3",
  "distil-whisper-large-v3-en",
];
const LOCAL_PREVIEW_MODELS = ["base", "small", "medium", "large-v3"];
const LOCAL_PROMPT_STRENGTH_OPTIONS: Array<{
  value: AppConfig["local_prompt_strength"];
  label: string;
}> = [
  { value: "off", label: "Off" },
  { value: "profile", label: "Profile context only" },
  { value: "profile_and_terms", label: "Profile + terms" },
];
const LOCAL_DECODE_OPTIONS = [1, 2, 3, 4, 5, 6, 8] as const;
const CORRECTION_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
];
const LOCAL_RUNTIME_CORRECTION_MODELS = [
  "llama3.2:latest",
  "qwen2.5:7b-instruct",
  "gemma3:4b",
];
const LANGUAGES = ["Auto", "en", "de", "fr", "es", "it", "pt", "nl", "pl", "ru", "ja", "ko", "zh"];
const GROQ_CAPABILITIES: ProviderCapabilities = {
  transcription: true,
  chat_completion: true,
  local: false,
  requires_api_key: true,
  supports_prompt_bias: true,
  supports_language: true,
  supports_segments: true,
  model_management: false,
};
const LOCAL_PREVIEW_CAPABILITIES: ProviderCapabilities = {
  transcription: true,
  chat_completion: true,
  local: true,
  requires_api_key: false,
  supports_prompt_bias: true,
  supports_language: true,
  supports_segments: false,
  model_management: true,
};

function buildLocalPreviewFallbackProfiles(): ProviderProfile[] {
  return LOCAL_PREVIEW_MODELS.flatMap((model, index) => {
    const profiles: ProviderProfile[] = [
      {
        id: `local-preview-${model}-fast`,
        provider: "local_preview",
        mode: "fast",
        model,
        label: `Local preview ${model} fast profile (external whisper-cli)`,
        default: index === 0,
        requires_api_key: false,
      },
      {
        id: `local-preview-${model}-quality`,
        provider: "local_preview",
        mode: "quality",
        model,
        label: `Local preview ${model} quality profile (external whisper-cli)`,
        default: false,
        requires_api_key: false,
      },
    ];

    return profiles;
  });
}

function cleanupSummary(config: AppConfig) {
  if (!config.post_process) {
    return "Off. WordScript keeps the raw speech-to-text result and only applies your text rules.";
  }
  if (config.professionalize && config.filter_fillers) {
    return "On. Fixes errors, removes fillers, and allows broader rewrites.";
  }
  if (config.professionalize) {
    return "On. Fixes errors and allows broader rewrites.";
  }
  if (config.filter_fillers) {
    return "On. Fixes errors and removes fillers while staying close to the original phrasing.";
  }

  return "On. Fixes punctuation, typos, and grammar without broader rewrites.";
}

function defaultLocalDecodeSettingsForProfileId(profileId: string | null | undefined) {
  return profileId?.endsWith("-quality")
    ? { beamSize: 5, bestOf: 5 }
    : { beamSize: 1, bestOf: 1 };
}

function defaultLocalPromptSettingsForProfileId() {
  return { promptStrength: "profile" as AppConfig["local_prompt_strength"], promptCarry: false };
}

function localProfilePromptSettingsForProfile(config: AppConfig, profileId: string | null | undefined) {
  const fallback = defaultLocalPromptSettingsForProfileId();
  const normalizedProfileId = profileId?.trim();

  if (!normalizedProfileId) {
    return fallback;
  }

  const stored = config.local_profile_prompt_settings.find((entry) => entry.profile_id === normalizedProfileId);
  if (!stored) {
    return fallback;
  }

  return {
    promptStrength: stored.prompt_strength,
    promptCarry: stored.prompt_carry,
  };
}

function upsertLocalProfilePromptSettings(
  settings: AppConfig["local_profile_prompt_settings"],
  profileId: string,
  promptStrength: AppConfig["local_prompt_strength"],
  promptCarry: boolean,
): AppConfig["local_profile_prompt_settings"] {
  const nextEntry = {
    profile_id: profileId,
    prompt_strength: promptStrength,
    prompt_carry: promptCarry,
  };
  const existingIndex = settings.findIndex((entry) => entry.profile_id === profileId);

  if (existingIndex === -1) {
    return [...settings, nextEntry];
  }

  const next = [...settings];
  next[existingIndex] = nextEntry;
  return next;
}

function localProfileDecodeSettingsForProfile(config: AppConfig, profileId: string | null | undefined) {
  const fallback = defaultLocalDecodeSettingsForProfileId(profileId);
  const normalizedProfileId = profileId?.trim();

  if (!normalizedProfileId) {
    return fallback;
  }

  const stored = config.local_profile_decode_settings.find((entry) => entry.profile_id === normalizedProfileId);
  if (!stored) {
    return fallback;
  }

  return {
    beamSize: stored.beam_size,
    bestOf: stored.best_of,
  };
}

function upsertLocalProfileDecodeSettings(
  settings: AppConfig["local_profile_decode_settings"],
  profileId: string,
  beamSize: number,
  bestOf: number,
): AppConfig["local_profile_decode_settings"] {
  const nextEntry = {
    profile_id: profileId,
    beam_size: beamSize,
    best_of: bestOf,
  };
  const existingIndex = settings.findIndex((entry) => entry.profile_id === profileId);

  if (existingIndex === -1) {
    return [...settings, nextEntry];
  }

  const next = [...settings];
  next[existingIndex] = nextEntry;
  return next;
}

function localSetupIssueLabel(issueCode: LocalProviderIssueCode | null | undefined) {
  switch (issueCode) {
    case "missing_runner":
      return "Runner missing";
    case "invalid_runner_path":
      return "Runner path invalid";
    case "runner_probe_failed":
      return "Runner health check failed";
    case "runner_probe_timed_out":
      return "Runner health check timed out";
    case "missing_model":
      return "Model missing";
    case "invalid_model_path":
      return "Model path invalid";
    case "unreadable_model_directory":
      return "Model directory unreadable";
    case "model_not_found":
      return "Model not found";
    case "missing_runner_and_model":
      return "Runner and model missing";
    case "invalid_chat_endpoint":
      return "Cleanup endpoint invalid";
    case "chat_backend_unavailable":
      return "Cleanup backend unavailable";
    case "missing_chat_model":
      return "Cleanup model missing";
    case "chat_model_not_found":
      return "Cleanup model not found";
    default:
      return "No setup blockers";
  }
}

function localCleanupModelOptions(config: AppConfig, availableModels: string[] | undefined) {
  return Array.from(new Set([
    config.local_correction_model.trim() || "llama3.2:latest",
    ...(availableModels ?? []),
    ...LOCAL_RUNTIME_CORRECTION_MODELS,
  ]));
}

export function ApiModelsTab({ config, onChange, onOpenDiagnostics }: Props) {
  const [showTypedKey, setShowTypedKey] = useState(false);
  const [pendingKey, setPendingKey] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [configPath, setConfigPath] = useState<string | null>(null);
  const selectedProvider: ProviderId = config.provider === "local_preview" ? "local_preview" : "groq";
  const previewLaneSelected = selectedProvider === "local_preview";
  const selectedLocalModel = previewLaneSelected ? config.local_model : null;
  const selectedCleanupModel = previewLaneSelected ? config.local_correction_model : config.correction_model;
  const providerLabel = previewLaneSelected ? "Local runtime" : "Groq cloud";
  const cleanupEnabled = config.post_process;
  const {
    status,
    isLoading,
    error,
    lastError,
    lastValidation,
    saveApiKey,
    clearApiKey,
    validateApiKey,
  } = useProvider(selectedProvider, selectedLocalModel, selectedCleanupModel);

  const fallbackProfiles: ProviderProfile[] = previewLaneSelected
    ? buildLocalPreviewFallbackProfiles()
    : WHISPER_MODELS.map((model, index) => ({
        id: `groq-${model}`,
        provider: "groq",
        mode: index === 0 ? "fast" : "quality",
        model,
        label: model,
        default: index === 0,
        requires_api_key: true,
      }));
  const providerProfiles = status?.profiles.length ? status.profiles : fallbackProfiles;
  const providerCapabilities = status?.capabilities ?? (previewLaneSelected ? LOCAL_PREVIEW_CAPABILITIES : GROQ_CAPABILITIES);
  const providerRequiresKey = providerCapabilities.requires_api_key;
  const localSetup = previewLaneSelected ? status?.local_setup ?? null : null;
  const activeLocalProfileId = previewLaneSelected
    ? config.local_profile || providerProfiles.find((profile) => profile.default)?.id || "local-preview-base-fast"
    : null;
  const activeProviderProfile = previewLaneSelected
    ? providerProfiles.find((profile) => profile.id === activeLocalProfileId)
      ?? providerProfiles.find((profile) => profile.default)
      ?? providerProfiles[0]
    : providerProfiles.find((profile) => profile.model === config.model)
      ?? providerProfiles.find((profile) => profile.default)
      ?? providerProfiles[0];
  const previewReady = localSetup?.readiness === "ready";
  const hasTypedKey = pendingKey.trim().length > 0;
  const storedKey = previewLaneSelected ? previewReady : status?.credential.configured ?? false;
  const activeModel = previewLaneSelected
    ? activeProviderProfile?.model || config.local_model || "base"
    : config.model || activeProviderProfile?.model || "whisper-large-v3-turbo";
  const activeMode = activeProviderProfile?.mode ?? (previewLaneSelected ? "fast" : "fast");
  const activeLocalPrompt = localProfilePromptSettingsForProfile(config, activeLocalProfileId);
  const activeLocalPromptStrength = activeLocalPrompt.promptStrength;
  const activeLocalPromptCarry = activeLocalPrompt.promptCarry;
  const activeLocalDecode = localProfileDecodeSettingsForProfile(config, activeLocalProfileId);
  const activeLocalBeamSize = activeLocalDecode.beamSize;
  const activeLocalBestOf = activeLocalDecode.bestOf;
  const localCleanupModels = localCleanupModelOptions(config, localSetup?.available_chat_models);
  const validationState = previewLaneSelected
    ? storedKey
      ? "ok"
      : "missing"
    : error
      ? "error"
      : lastValidation?.ok
        ? "ok"
        : storedKey
          ? "stored"
          : "missing";
  const statusTitle = previewLaneSelected
    ? storedKey
      ? "Local runtime ready"
      : "Local runtime setup required"
    : validationState === "ok"
      ? "Stored key validated"
      : validationState === "stored"
        ? "Stored key available"
        : validationState === "error"
          ? "Groq key check failed"
          : "No local Groq key stored";
  const statusCopy = previewLaneSelected
    ? localSetup?.guidance ?? "Configure whisper-cli, a local ggml STT model, and a local Ollama cleanup model before using this local runtime lane."
    : validationState === "ok"
      ? "Validated and ready."
      : validationState === "stored"
        ? "Stored locally. Validate after changes."
        : validationState === "error"
          ? "The last provider action failed. Check the status line below."
          : "Save a Groq key to enable transcription.";
  const validationSource = previewLaneSelected
    ? localSetup?.issue_code ? localSetupIssueLabel(localSetup.issue_code) : "Local transcription + cleanup lane"
    : lastValidation?.checked_with === "provided_key"
      ? "Typed key"
      : lastValidation?.checked_with === "stored_key"
        ? "Stored key"
        : "Not checked in this session";
  const actionSaveLabel = storedKey ? "Replace key" : "Save locally";
  const actionValidateLabel = hasTypedKey ? "Validate typed key" : "Validate stored key";

  const handleProviderChange = (provider: ProviderId) => {
    setLocalError(null);
    setStatusMessage(null);
    const nextLocalProfile = config.local_profile.trim() || "local-preview-base-fast";
    const nextLocalPrompt = localProfilePromptSettingsForProfile(config, nextLocalProfile);
    const nextLocalDecode = localProfileDecodeSettingsForProfile(config, nextLocalProfile);
    onChange({
      provider,
      ...(provider === "local_preview"
        ? {
            local_model: config.local_model.trim() || "base",
          local_correction_model: config.local_correction_model.trim() || "llama3.2:latest",
            local_profile: nextLocalProfile,
            local_prompt_strength: nextLocalPrompt.promptStrength,
            local_prompt_carry: nextLocalPrompt.promptCarry,
            local_beam_size: nextLocalDecode.beamSize,
            local_best_of: nextLocalDecode.bestOf,
            local_profile_prompt_settings: upsertLocalProfilePromptSettings(
              config.local_profile_prompt_settings,
              nextLocalProfile,
              nextLocalPrompt.promptStrength,
              nextLocalPrompt.promptCarry,
            ),
            local_profile_decode_settings: upsertLocalProfileDecodeSettings(
              config.local_profile_decode_settings,
              nextLocalProfile,
              nextLocalDecode.beamSize,
              nextLocalDecode.bestOf,
            ),
          }
        : {}),
      ...(provider === "groq" && !config.model.trim() ? { model: "whisper-large-v3-turbo" } : {}),
    });
  };

  const handleProfileChange = (value: string) => {
    if (previewLaneSelected) {
      const selectedProfile = providerProfiles.find((profile) => profile.id === value);
      if (!selectedProfile) {
        return;
      }

      const storedPrompt = localProfilePromptSettingsForProfile(config, selectedProfile.id);
      const storedDecode = localProfileDecodeSettingsForProfile(config, selectedProfile.id);

      onChange({
        local_profile: selectedProfile.id,
        local_model: selectedProfile.model,
        local_prompt_strength: storedPrompt.promptStrength,
        local_prompt_carry: storedPrompt.promptCarry,
        local_beam_size: storedDecode.beamSize,
        local_best_of: storedDecode.bestOf,
        local_profile_prompt_settings: upsertLocalProfilePromptSettings(
          config.local_profile_prompt_settings,
          selectedProfile.id,
          storedPrompt.promptStrength,
          storedPrompt.promptCarry,
        ),
        local_profile_decode_settings: upsertLocalProfileDecodeSettings(
          config.local_profile_decode_settings,
          selectedProfile.id,
          storedDecode.beamSize,
          storedDecode.bestOf,
        ),
      });
      return;
    }

    onChange({ model: value });
  };

  const resolveConfigPath = async () => {
    if (configPath) {
      return configPath;
    }

    try {
      const nextPath = await invoke<string>("app_config_file_path");
      setConfigPath(nextPath);
      return nextPath;
    } catch (cause) {
      setLocalError(`Could not resolve config JSON path: ${cause instanceof Error ? cause.message : String(cause)}`);
      return null;
    }
  };

  const handleSaveKey = async () => {
    setLocalError(null);
    const saved = await saveApiKey(pendingKey);
    if (!saved) return;
    setPendingKey("");
    setShowTypedKey(false);
    setStatusMessage(storedKey
      ? "Stored Groq key replaced in the local OS secret store."
      : "Groq key saved to the local OS secret store.");
  };

  const handleValidate = async () => {
    setLocalError(null);
    const validation = await validateApiKey(pendingKey || undefined);
    if (!validation) return;
    setStatusMessage(
      validation.checked_with === "provided_key"
        ? "Typed key validated. Save it locally if you want to replace the stored slot."
        : "Stored Groq key validated.",
    );
  };

  const handleClear = async () => {
    setLocalError(null);
    const cleared = await clearApiKey();
    if (!cleared) return;
    setPendingKey("");
    setShowTypedKey(false);
    setStatusMessage("Stored Groq key removed from the local OS secret store.");
  };

  const handleOpenGroqKeys = async () => {
    setLocalError(null);
    try {
      await openUrl("https://console.groq.com/keys");
    } catch (cause) {
      setLocalError(`Could not open Groq keys: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  };

  const handleRevealConfigJson = async () => {
    setLocalError(null);
    const path = await resolveConfigPath();
    if (!path) {
      return;
    }

    try {
      await revealItemInDir(path);
      setStatusMessage("Config JSON revealed in the file manager.");
    } catch (cause) {
      setLocalError(`Could not reveal config JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  };

  const handleOpenDiagnostics = () => {
    setLocalError(null);
    onOpenDiagnostics();
    setStatusMessage("Diagnostics opened.");
  };

  return (
    <>
      <div className="tab__title">Provider &amp; Models</div>

      <div className="settings__summary-grid settings__summary-grid--three" aria-label="Provider overview">
        <article className="settings__summary-item">
          <span>Lane</span>
          <strong>{providerLabel}</strong>
          <small>{providerCapabilities.local ? "Local transcription plus local AI cleanup via whisper-cli and Ollama." : "Cloud transcription with local BYOK."}</small>
        </article>
        <article className="settings__summary-item">
          <span>Active model</span>
          <strong>{activeModel}</strong>
          <small>{activeMode.replace("_", " ")} transcription mode</small>
        </article>
        <article className="settings__summary-item">
          <span>Status</span>
          <strong>{statusTitle}</strong>
          <small>{validationSource}</small>
        </article>
      </div>

      <div className="form-section">{providerRequiresKey ? "Credential status" : "Local runtime status"}</div>
      <div className="settings__provider-card settings__provider-card--highlight">
        <div className="provider-status provider-status--stacked">
          <span className={`provider-status__dot${
            validationState === "ok"
              ? " provider-status__dot--ok"
              : validationState === "stored"
                ? " provider-status__dot--stored"
                : ""
          }`} />
          <div>
            <strong>{statusTitle}</strong>
            <span>{statusCopy}</span>
          </div>
        </div>
        <div className="settings__provider-meta-grid">
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">{providerRequiresKey ? "Storage" : "Setup"}</span>
            {providerRequiresKey ? (
              <code>{status?.credential.storage ?? "os_secret_store"}</code>
            ) : (
              <span>{previewReady ? "Ready" : "Setup required"}</span>
            )}
          </div>
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">{providerRequiresKey ? "Stored preview" : "Runner"}</span>
            <code>{providerRequiresKey ? status?.credential.key_preview ?? "No stored preview" : localSetup?.resolved_runner ?? "No runner resolved"}</code>
          </div>
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">{providerRequiresKey ? "Last check" : "Model"}</span>
            <span>{providerRequiresKey ? validationSource : localSetup?.resolved_model ?? "No model resolved"}</span>
          </div>
          {!providerRequiresKey && (
            <div className="settings__provider-meta-item">
              <span className="settings__provider-meta-label">Issue</span>
              <span>{validationSource}</span>
            </div>
          )}
          {!providerRequiresKey && (
            <div className="settings__provider-meta-item">
              <span className="settings__provider-meta-label">Cleanup endpoint</span>
              <code>{localSetup?.resolved_chat_base_url ?? "No endpoint resolved"}</code>
            </div>
          )}
          {!providerRequiresKey && (
            <div className="settings__provider-meta-item">
              <span className="settings__provider-meta-label">Cleanup model</span>
              <span>{(localSetup?.resolved_chat_model ?? config.local_correction_model) || "No cleanup model resolved"}</span>
            </div>
          )}
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">Cleanup</span>
            <span>{providerCapabilities.chat_completion ? "Available" : "Unavailable"}</span>
          </div>
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">Context bias</span>
            <span>{providerCapabilities.supports_prompt_bias ? "Supported" : "Not supported"}</span>
          </div>
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">Segments</span>
            <span>{providerCapabilities.supports_segments ? "Available" : "Unavailable"}</span>
          </div>
        </div>
        <div className="settings__provider-actions settings__provider-actions--compact">
          {providerRequiresKey && (
            <button className="btn btn--cancel" type="button" onClick={() => void handleOpenGroqKeys()}>
              Open Groq keys
            </button>
          )}
          <button className="btn btn--cancel" type="button" onClick={() => void handleRevealConfigJson()}>
            Reveal config JSON
          </button>
          <button className="btn btn--cancel" type="button" onClick={handleOpenDiagnostics}>
            Open diagnostics
          </button>
        </div>
      </div>

      {providerRequiresKey ? (
        <div className="settings__provider-card">
          <div className="settings__provider-card-header">
            <strong className="settings__about-title">{storedKey ? "Replace local key" : "Add local key"}</strong>
            <p className="form-dim settings__provider-card-copy">
              {hasTypedKey
                ? "Validate first, save after."
                : storedKey
                  ? "Paste only when you want to rotate the stored key."
                  : "Paste one Groq key and save it locally."}
            </p>
          </div>
          <div className="form-row settings__provider-form-row">
            <label>{storedKey ? "New key" : "Key"}</label>
            <div className="settings__provider-input">
              <input
                type={showTypedKey ? "text" : "password"}
                value={pendingKey}
                onChange={(e) => setPendingKey(e.target.value)}
                placeholder={storedKey ? "Paste replacement gsk_..." : "Paste gsk_..."}
                spellCheck={false}
              />
              <button
                className="btn btn--cancel settings__provider-inline-btn"
                type="button"
                disabled={!hasTypedKey}
                onClick={() => setShowTypedKey((current) => !current)}
              >
                {showTypedKey ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div className="settings__provider-actions">
            <button className="btn btn--cancel" type="button" disabled={isLoading || !hasTypedKey} onClick={() => void handleSaveKey()}>
              {actionSaveLabel}
            </button>
            <button className="btn btn--cancel" type="button" disabled={isLoading || (!hasTypedKey && !storedKey)} onClick={() => void handleValidate()}>
              {actionValidateLabel}
            </button>
            <button className="btn btn--cancel" type="button" disabled={isLoading || !storedKey} onClick={() => void handleClear()}>
              Clear key
            </button>
          </div>
        </div>
      ) : (
        <div className="settings__provider-card">
          <div className="settings__provider-card-header">
            <strong className="settings__about-title">Local runtime setup</strong>
            <p className="form-dim settings__provider-card-copy">
              Set <code>WORDSCRIPT_LOCAL_WHISPER_CLI</code> to a whisper-cli binary or install <code>whisper-cli</code> in PATH. Then set <code>WORDSCRIPT_LOCAL_MODEL_PATH</code> to one ggml model file or <code>WORDSCRIPT_LOCAL_MODEL_DIR</code> to a directory with <code>ggml-&lt;model&gt;.bin</code> files. AI cleanup runs through Ollama at <code>WORDSCRIPT_LOCAL_CHAT_BASE_URL</code> or the default local endpoint.
            </p>
          </div>
          <p className="form-dim">
            {localSetup?.guidance ?? "This lane uses the same runtime path for capture, insert and diagnostics, but now expects both local STT and local cleanup to be reachable."}
          </p>
        </div>
      )}
      {(statusMessage || lastValidation || error || localError) && (
        <p className={`form-dim${error || localError ? " form-dim--error" : " form-dim--ok"}`}>
          {error ?? localError ?? statusMessage ?? (!previewLaneSelected && lastValidation?.ok ? "Groq key validated." : "")}
          {lastError ? ` ${providerErrorActionLabel(lastError.user_action)}` : ""}
        </p>
      )}

      <div className="form-section">Speech-to-text</div>
      <div className="form-row">
        <label htmlFor="provider-select">Provider</label>
        <select id="provider-select" value={selectedProvider} onChange={(e) => handleProviderChange(e.target.value as ProviderId)}>
          <option value="groq">Groq cloud</option>
          <option value="local_preview">Local runtime (whisper-cli + Ollama)</option>
        </select>
      </div>
      <div className="form-row">
        <label htmlFor="profile-select">Profile</label>
        <select id="profile-select" value={previewLaneSelected ? activeLocalProfileId ?? "" : activeModel}
          onChange={(e) => handleProfileChange(e.target.value)}>
          {providerProfiles.map((profile) => (
            <option key={profile.id} value={previewLaneSelected ? profile.id : profile.model}>{profile.label}</option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label htmlFor="language-select">Language</label>
        <select
          id="language-select"
          value={config.language || "Auto"}
          onChange={(e) => onChange({ language: e.target.value === "Auto" ? "" : e.target.value })}
        >
          {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
        </select>
      </div>
      {previewLaneSelected && providerCapabilities.supports_prompt_bias && (
        <>
          <div className="form-row">
            <label htmlFor="local-prompt-strength-select">Bias strength</label>
            <select
              id="local-prompt-strength-select"
              value={activeLocalPromptStrength}
              onChange={(e) => {
                const nextPromptStrength = e.target.value as AppConfig["local_prompt_strength"];
                const profileId = activeLocalProfileId ?? "local-preview-base-fast";
                onChange({
                  local_prompt_strength: nextPromptStrength,
                  local_profile_prompt_settings: upsertLocalProfilePromptSettings(
                    config.local_profile_prompt_settings,
                    profileId,
                    nextPromptStrength,
                    activeLocalPromptCarry,
                  ),
                });
              }}
            >
              {LOCAL_PROMPT_STRENGTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <label className="form-check" style={{ marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={activeLocalPromptCarry}
              onChange={(e) => {
                const nextPromptCarry = e.target.checked;
                const profileId = activeLocalProfileId ?? "local-preview-base-fast";
                onChange({
                  local_prompt_carry: nextPromptCarry,
                  local_profile_prompt_settings: upsertLocalProfilePromptSettings(
                    config.local_profile_prompt_settings,
                    profileId,
                    activeLocalPromptStrength,
                    nextPromptCarry,
                  ),
                });
              }}
            />
            <span>Carry initial prompt</span>
          </label>
          <p className="form-dim">
            Local prompt bias uses the active Text Rules profile. <strong>Profile + terms</strong> adds dictionary replacements and explicit STT hints to the initial whisper prompt, while carry keeps that bias across decoder windows.
          </p>
        </>
      )}
      {previewLaneSelected && (
        <>
          <div className="form-row">
            <label htmlFor="local-beam-size-select">Beam size</label>
            <select
              id="local-beam-size-select"
              value={activeLocalBeamSize}
              onChange={(e) => {
                const nextBeamSize = Number(e.target.value);
                const profileId = activeLocalProfileId ?? "local-preview-base-fast";
                onChange({
                  local_beam_size: nextBeamSize,
                  local_profile_decode_settings: upsertLocalProfileDecodeSettings(
                    config.local_profile_decode_settings,
                    profileId,
                    nextBeamSize,
                    activeLocalBestOf,
                  ),
                });
              }}
            >
              {LOCAL_DECODE_OPTIONS.map((value) => (
                <option key={`beam-${value}`} value={value}>{value}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="local-best-of-select">Best of</label>
            <select
              id="local-best-of-select"
              value={activeLocalBestOf}
              onChange={(e) => {
                const nextBestOf = Number(e.target.value);
                const profileId = activeLocalProfileId ?? "local-preview-base-fast";
                onChange({
                  local_best_of: nextBestOf,
                  local_profile_decode_settings: upsertLocalProfileDecodeSettings(
                    config.local_profile_decode_settings,
                    profileId,
                    activeLocalBeamSize,
                    nextBestOf,
                  ),
                });
              }}
            >
              {LOCAL_DECODE_OPTIONS.map((value) => (
                <option key={`best-of-${value}`} value={value}>{value}</option>
              ))}
            </select>
          </div>
          <p className="form-dim">
            Fast and quality profiles now set decoder defaults, not hidden behavior. Lower beam and best-of values reduce search work, while higher values trade more latency for a broader local decode pass.
          </p>
        </>
      )}
      <p className="form-dim">
        {previewLaneSelected
          ? "Local runtime keeps the same pipeline for capture, transform and insert, but runs speech-to-text through whisper-cli and cleanup through a local Ollama model. Language can usually stay on Auto, and the selected local profile controls latency vs. quality explicitly."
          : "Profile controls speed vs. accuracy. Language can usually stay on Auto."}
      </p>

      <div className="form-section">AI cleanup</div>
      <label className="form-check" style={{ marginBottom: 10 }}>
        <input type="checkbox" checked={cleanupEnabled}
          onChange={(e) => onChange({ post_process: e.target.checked })} />
        <span>AI cleanup</span>
      </label>
      <p className="form-dim" style={{ margin: "0 0 10px 26px" }}>
        {previewLaneSelected
          ? "Runs locally after speech-to-text and falls back to the original transcript if the rewrite looks unsafe or the local cleanup model is unavailable."
          : cleanupSummary(config)}
      </p>
      {cleanupEnabled && (
        <>
          <label className="form-check" style={{ marginBottom: 8, marginLeft: 16 }}>
            <input type="checkbox" checked={config.filter_fillers} disabled={!config.post_process}
              onChange={(e) => onChange({ filter_fillers: e.target.checked })} />
            <span>Remove fillers</span>
          </label>
          <label className="form-check" style={{ marginBottom: 10, marginLeft: 16 }}>
            <input type="checkbox" checked={config.professionalize} disabled={!config.post_process}
              onChange={(e) => onChange({ professionalize: e.target.checked })} />
            <span>Rewrite phrasing</span>
          </label>
          <div className="form-row">
            <label htmlFor="correction-model-select">Model</label>
            <select id="correction-model-select" value={previewLaneSelected ? config.local_correction_model : config.correction_model}
              onChange={(e) => onChange(previewLaneSelected
                ? { local_correction_model: e.target.value }
                : { correction_model: e.target.value })}>
              {(previewLaneSelected ? localCleanupModels : CORRECTION_MODELS).map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <p className="form-dim">
            {previewLaneSelected
              ? "Uses a local Ollama chat model for cleanup. Keep the chosen model installed locally so the native lane stays fully offline and sustainable."
              : "Runs after speech-to-text and can fall back to the original transcript if the rewrite looks unsafe."}
          </p>
        </>
      )}
    </>
  );
}
