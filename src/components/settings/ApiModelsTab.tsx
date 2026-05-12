import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useGroqProvider } from "../../hooks/useGroqProvider";
import type { AppConfig } from "../../types/ipc";

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
  const postCorrectionDisabled = !config.post_process;
  const {
    status,
    isLoading,
    error,
    lastValidation,
    saveApiKey,
    clearApiKey,
    validateApiKey,
  } = useGroqProvider();

  const cloudProfiles = status?.profiles ?? [];
  const hasTypedKey = pendingKey.trim().length > 0;
  const storedKey = status?.credential.configured ?? Boolean(config.groq_api_key);
  const activeModel = config.model || cloudProfiles.find((profile) => profile.default)?.model || "whisper-large-v3-turbo";
  const validationState = error
    ? "error"
    : lastValidation?.ok
      ? "ok"
      : storedKey
        ? "stored"
        : "missing";
  const statusTitle = validationState === "ok"
    ? "Stored key validated"
    : validationState === "stored"
      ? "Stored key available"
      : validationState === "error"
        ? "Groq key check failed"
        : "No local Groq key stored";
  const statusCopy = validationState === "ok"
    ? "Validated and ready."
    : validationState === "stored"
      ? "Stored locally. Validate after changes."
      : validationState === "error"
        ? "The last provider action failed. Check the status line below."
        : "Save a Groq key to enable transcription.";
  const validationSource = lastValidation?.checked_with === "provided_key"
    ? "Typed key"
    : lastValidation?.checked_with === "stored_key"
      ? "Stored key"
      : "Not checked in this session";
  const actionSaveLabel = storedKey ? "Replace key" : "Save locally";
  const actionValidateLabel = hasTypedKey ? "Validate typed key" : "Validate stored key";

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
    onChange({ groq_api_key: "", backend: "groq" });
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
    onChange({ groq_api_key: "" });
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

      <div className="form-section">Authentication</div>
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
            <span className="settings__provider-meta-label">Storage</span>
            <code>{status?.credential.storage ?? "os_secret_store"}</code>
          </div>
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">Stored preview</span>
            <code>{status?.credential.key_preview ?? "No stored preview"}</code>
          </div>
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">Last check</span>
            <span>{validationSource}</span>
          </div>
        </div>
        <div className="settings__provider-actions settings__provider-actions--compact">
          <button className="btn btn--cancel" type="button" onClick={() => void handleOpenGroqKeys()}>
            Open Groq keys
          </button>
          <button className="btn btn--cancel" type="button" onClick={() => void handleRevealConfigJson()}>
            Reveal config JSON
          </button>
          <button className="btn btn--cancel" type="button" onClick={handleOpenDiagnostics}>
            Open diagnostics
          </button>
        </div>
      </div>

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
      {(statusMessage || lastValidation || error || localError) && (
        <p className={`form-dim${error || localError ? " form-dim--error" : " form-dim--ok"}`}>
          {error ?? localError ?? statusMessage ?? (lastValidation?.ok ? "Groq key validated." : "")}
        </p>
      )}

      <div className="form-section">Speech-to-text</div>
      <div className="form-row">
        <label>Provider</label>
        <div className="provider-status">
          <span>Groq cloud</span>
        </div>
      </div>
      <div className="form-row">
        <label>Profile</label>
        <select value={activeModel}
          onChange={(e) => onChange({ model: e.target.value })}>
          {cloudProfiles.length > 0
            ? cloudProfiles.map((profile) => <option key={profile.id} value={profile.model}>{profile.label}</option>)
            : WHISPER_MODELS.map((model) => <option key={model} value={model}>{model}</option>)}
        </select>
      </div>
      <div className="form-row">
        <label>Language</label>
        <select
          value={config.language || "Auto"}
          onChange={(e) => onChange({ language: e.target.value === "Auto" ? "" : e.target.value })}
        >
          {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
        </select>
      </div>
      <p className="form-dim">Profile controls speed vs. accuracy. Language can usually stay on Auto.</p>

      <div className="form-section">AI Cleanup</div>
      <label className="form-check" style={{ marginBottom: 10 }}>
        <input type="checkbox" checked={config.post_process}
          onChange={(e) => onChange({ post_process: e.target.checked })} />
        <span>AI cleanup</span>
      </label>
      <p className="form-dim" style={{ margin: "0 0 10px 26px" }}>
        {cleanupSummary(config)}
      </p>
      {config.post_process && (
        <>
          <label className={`form-check${postCorrectionDisabled ? " form-check--disabled" : ""}`} style={{ marginBottom: 8, marginLeft: 16 }}>
            <input type="checkbox" checked={config.filter_fillers} disabled={!config.post_process}
              onChange={(e) => onChange({ filter_fillers: e.target.checked })} />
            <span>Remove fillers</span>
          </label>
          <label className={`form-check${postCorrectionDisabled ? " form-check--disabled" : ""}`} style={{ marginBottom: 10, marginLeft: 16 }}>
            <input type="checkbox" checked={config.professionalize} disabled={!config.post_process}
              onChange={(e) => onChange({ professionalize: e.target.checked })} />
            <span>Rewrite phrasing</span>
          </label>
          <div className="form-row">
            <label>Model</label>
            <select value={config.correction_model}
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
