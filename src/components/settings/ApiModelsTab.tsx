import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useProvider } from "../../hooks/useProvider";
import type { AppConfig } from "../../types/ipc";
import type { ProviderId, ProviderProfile } from "../../types/providers";

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
const CORRECTION_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
];
const LANGUAGES = ["Auto", "en", "de", "fr", "es", "it", "pt", "nl", "pl", "ru", "ja", "ko", "zh"];

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

export function ApiModelsTab({ config, onChange, onOpenDiagnostics }: Props) {
  const [showTypedKey, setShowTypedKey] = useState(false);
  const [pendingKey, setPendingKey] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [configPath, setConfigPath] = useState<string | null>(null);
  const selectedProvider: ProviderId = config.provider === "local_preview" ? "local_preview" : "groq";
  const previewLaneSelected = selectedProvider === "local_preview";
  const providerLabel = previewLaneSelected ? "Local preview" : "Groq cloud";
  const cleanupEnabled = !previewLaneSelected && config.post_process;
  const {
    status,
    isLoading,
    error,
    lastValidation,
    saveApiKey,
    clearApiKey,
    validateApiKey,
  } = useProvider(selectedProvider);

  const fallbackProfiles: ProviderProfile[] = previewLaneSelected
    ? LOCAL_PREVIEW_MODELS.map((model, index) => ({
        id: `local-preview-${model}`,
        provider: "local_preview",
        model,
        label: `Local preview ${model} model (external whisper-cli)`,
        default: index === 0,
        requires_api_key: false,
      }))
    : WHISPER_MODELS.map((model, index) => ({
        id: `groq-${model}`,
        provider: "groq",
        model,
        label: model,
        default: index === 0,
        requires_api_key: true,
      }));
  const providerProfiles = status?.profiles.length ? status.profiles : fallbackProfiles;
  const providerRequiresKey = providerProfiles.some((profile) => profile.requires_api_key);
  const hasTypedKey = pendingKey.trim().length > 0;
  const storedKey = status?.credential.configured ?? false;
  const activeModel = previewLaneSelected
    ? config.local_model || providerProfiles.find((profile) => profile.default)?.model || "base"
    : config.model || providerProfiles.find((profile) => profile.default)?.model || "whisper-large-v3-turbo";
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
      ? "Local preview helper ready"
      : "Local preview helper missing"
    : validationState === "ok"
      ? "Stored key validated"
      : validationState === "stored"
        ? "Stored key available"
        : validationState === "error"
          ? "Groq key check failed"
          : "No local Groq key stored";
  const statusCopy = previewLaneSelected
    ? storedKey
      ? "WordScript can transcribe through an external whisper-cli helper in this preview lane."
      : "Install whisper-cli and point WordScript at a local ggml model before using this preview lane."
    : validationState === "ok"
      ? "Validated and ready."
      : validationState === "stored"
        ? "Stored locally. Validate after changes."
        : validationState === "error"
          ? "The last provider action failed. Check the status line below."
          : "Save a Groq key to enable transcription.";
  const validationSource = previewLaneSelected
    ? "STT-only preview lane"
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
    onChange({
      provider,
      ...(provider === "local_preview" && !config.local_model.trim() ? { local_model: "base" } : {}),
      ...(provider === "groq" && !config.model.trim() ? { model: "whisper-large-v3-turbo" } : {}),
    });
  };

  const handleProfileChange = (model: string) => {
    onChange(previewLaneSelected ? { local_model: model } : { model });
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
          <small>{providerRequiresKey ? "Cloud transcription with local BYOK." : "External helper lane for local speech-to-text preview."}</small>
        </article>
        <article className="settings__summary-item">
          <span>Active model</span>
          <strong>{activeModel}</strong>
          <small>{previewLaneSelected ? "Preview helper model" : "Primary transcription model"}</small>
        </article>
        <article className="settings__summary-item">
          <span>Status</span>
          <strong>{statusTitle}</strong>
          <small>{validationSource}</small>
        </article>
      </div>

      <div className="form-section">{providerRequiresKey ? "Credential status" : "Preview status"}</div>
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
            <span className="settings__provider-meta-label">{providerRequiresKey ? "Storage" : "Runner"}</span>
            <code>{status?.credential.storage ?? (providerRequiresKey ? "os_secret_store" : "external_cli")}</code>
          </div>
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">{providerRequiresKey ? "Stored preview" : "Runner detail"}</span>
            <code>{status?.credential.key_preview ?? (providerRequiresKey ? "No stored preview" : "No helper detected")}</code>
          </div>
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">{providerRequiresKey ? "Last check" : "Lane role"}</span>
            <span>{validationSource}</span>
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
            <strong className="settings__about-title">External helper setup</strong>
            <p className="form-dim settings__provider-card-copy">
              Set <code>WORDSCRIPT_LOCAL_WHISPER_CLI</code> to a whisper-cli binary or install <code>whisper-cli</code> in PATH. Then set <code>WORDSCRIPT_LOCAL_MODEL_PATH</code> to one ggml model file or <code>WORDSCRIPT_LOCAL_MODEL_DIR</code> to a directory with <code>ggml-&lt;model&gt;.bin</code> files.
            </p>
          </div>
          <p className="form-dim">
            This lane is intentionally STT-only. WordScript keeps the same runtime path for capture, insert and diagnostics, but skips cloud cleanup while local preview is active.
          </p>
        </div>
      )}
      {(statusMessage || lastValidation || error || localError) && (
        <p className={`form-dim${error || localError ? " form-dim--error" : " form-dim--ok"}`}>
          {error ?? localError ?? statusMessage ?? (!previewLaneSelected && lastValidation?.ok ? "Groq key validated." : "")}
        </p>
      )}

      <div className="form-section">Speech-to-text</div>
      <div className="form-row">
        <label htmlFor="provider-select">Provider</label>
        <select id="provider-select" value={selectedProvider} onChange={(e) => handleProviderChange(e.target.value as ProviderId)}>
          <option value="groq">Groq cloud</option>
          <option value="local_preview">Local preview (external whisper-cli)</option>
        </select>
      </div>
      <div className="form-row">
        <label htmlFor="profile-select">Profile</label>
        <select id="profile-select" value={activeModel}
          onChange={(e) => handleProfileChange(e.target.value)}>
          {providerProfiles.map((profile) => <option key={profile.id} value={profile.model}>{profile.label}</option>)}
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
      <p className="form-dim">
        {previewLaneSelected
          ? "Local preview keeps the same runtime pipeline but swaps speech-to-text to an external whisper-cli helper. Language can usually stay on Auto."
          : "Profile controls speed vs. accuracy. Language can usually stay on Auto."}
      </p>

      <div className="form-section">AI cleanup</div>
      <label className="form-check" style={{ marginBottom: 10 }}>
        <input type="checkbox" checked={cleanupEnabled}
          disabled={previewLaneSelected}
          onChange={(e) => onChange({ post_process: e.target.checked })} />
        <span>AI cleanup</span>
      </label>
      <p className="form-dim" style={{ margin: "0 0 10px 26px" }}>
        {previewLaneSelected
          ? "Local preview is STT-only. WordScript inserts the raw local transcript for this lane and leaves cloud cleanup off."
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
            <select id="correction-model-select" value={config.correction_model}
              onChange={(e) => onChange({ correction_model: e.target.value })}>
              {CORRECTION_MODELS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <p className="form-dim">
            Runs after speech-to-text and can fall back to the original transcript if the rewrite looks unsafe.
          </p>
        </>
      )}
    </>
  );
}
