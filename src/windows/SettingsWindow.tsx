import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useGroqProvider } from "../hooks/useGroqProvider";
import { useRuntime } from "../hooks/useRuntime";
import { getHotkeyValidationMessage, normalizeManualHotkey } from "../lib/hotkeys";
import { APP_ORGANIZATION_URL, APP_REPOSITORY_URL, APP_SITE_URL, APP_VERSION } from "../lib/appMeta";
import type { AppConfig } from "../types/ipc";
import type { TextRulesAnalysis } from "../types/textRules";
import { ApiModelsTab }   from "../components/settings/ApiModelsTab";
import { InputTab }       from "../components/settings/InputTab";
import { PromptsTab }     from "../components/settings/PromptsTab";
import { AboutTab }       from "../components/settings/AboutTab";
import { RebuildLabTab }  from "../components/settings/RebuildLabTab";
import { WindowChrome } from "../components/settings/WindowChrome";
import swBenchWordmark from "../../assets/SW bench_wordmark.png";
import wordmark from "../../assets/wordscript_wordmark.png";
import "../styles/settings.css";

const TABS = [
  {
    label: "General",
    id: "Provider & Models",
    icon: "gear",
    eyebrow: "Language & Region",
    blurb: "Groq BYOK, language, model choice and post-correction.",
  },
  {
    label: "Hotkeys",
    id: "Input",
    icon: "key",
    eyebrow: "Application Behavior",
    blurb: "Shortcut, microphone, delivery and capture recovery.",
  },
  {
    label: "Editor",
    id: "Text Rules",
    icon: "panel",
    eyebrow: "Text Rules",
    blurb: "Personal dictionary, snippets and transform preview.",
  },
  {
    label: "About",
    id: "About",
    icon: "info",
    eyebrow: "Updates",
    blurb: "Version, installer flow, platform support and project links.",
  },
  {
    label: "Diagnostics",
    id: "Rebuild Lab",
    icon: "diagnostics",
    eyebrow: "Diagnostics",
    blurb: "Native capture, transform, recovery and insert diagnostics.",
  },
] as const;
type Tab = (typeof TABS)[number]["id"];

interface ConfiguredTriggerStatus {
  hotkey: string;
  pause_hotkey: string;
  abort_hotkey: string;
  registered_hotkey: string | null;
  registered_pause_hotkey: string | null;
  registered_abort_hotkey: string | null;
}

function clampSettingsNumber(value: number, minimum: number, maximum: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

export default function SettingsWindow() {
  const { state, saveConfig } = useRuntime();
  const { status: groqProviderStatus, saveApiKey } = useGroqProvider();
  const [form, setForm]       = useState<AppConfig | null>(null);
  const [active, setActive]   = useState<Tab>("Provider & Models");
  const [status, setStatus]   = useState<{ msg: string; ok: boolean } | null>(null);
  const [textRulesAnalysis, setTextRulesAnalysis] = useState<TextRulesAnalysis | null>(null);
  const [legacyMigrationAttempted, setLegacyMigrationAttempted] = useState(false);

  // Populate form when the runtime provides config
  useEffect(() => {
    if (state.config && !form) {
      setForm({ ...state.config });
      if (!state.config.groq_api_key && !groqProviderStatus?.credential.configured) {
        setActive("Provider & Models");
      }
    }
  }, [state.config, form, groqProviderStatus]);

  // Keep form in sync if config reloads externally
  useEffect(() => {
    if (state.config) setForm({ ...state.config });
  }, [state.config]);

  useEffect(() => {
    if (!form?.groq_api_key || !groqProviderStatus || legacyMigrationAttempted) {
      return;
    }

    setLegacyMigrationAttempted(true);

    if (groqProviderStatus.credential.configured) {
      patch({ groq_api_key: "", backend: "groq" });
      return;
    }

    void saveApiKey(form.groq_api_key).then((credential) => {
      if (!credential) {
        setActive("Provider & Models");
        setStatus({ msg: "✗  Could not move legacy Groq key to OS secret store", ok: false });
        return;
      }

      patch({ groq_api_key: "", backend: "groq" });
      setStatus({ msg: "✓  Legacy Groq key moved to OS secret store", ok: true });
      setTimeout(() => setStatus(null), 2000);
    });
  }, [form, groqProviderStatus, legacyMigrationAttempted, saveApiKey]);

  const patch = (partial: Partial<AppConfig>) =>
    setForm((prev) => (prev ? { ...prev, ...partial } : prev));

  const activeTab = TABS.find((tab) => tab.id === active) ?? TABS[0];
  const readiness = state.error
    ? { label: "Error", title: state.error, ok: false }
    : state.status === "processing"
      ? { label: "Processing", title: "WordScript is currently transcribing the last capture.", ok: true }
      : state.status === "recording"
        ? { label: state.paused ? "Paused" : "Recording", title: state.paused ? "Recording is paused." : "Recording is active.", ok: true }
        : groqProviderStatus?.credential.configured
          ? { label: "Ready", title: "Groq key is present and the native runtime is configured.", ok: true }
          : { label: "Needs key", title: "Add a Groq key before transcription can run.", ok: false };

  const handleSave = async () => {
    if (!form) return;
    if (form.groq_api_key) {
      setActive("Provider & Models");
      setStatus({ msg: "✗  Move Groq key to OS secret store before saving", ok: false });
      return;
    }
    if (textRulesAnalysis?.blocking) {
      setActive("Text Rules");
      setStatus({ msg: "✗  Fix blocking text-rule issues before saving", ok: false });
      return;
    }

    const normalizedHotkeys = {
      hotkey: normalizeManualHotkey(form.hotkey),
      pause_hotkey: normalizeManualHotkey(form.pause_hotkey),
      abort_hotkey: normalizeManualHotkey(form.abort_hotkey),
    };

    const hotkeyIssues = [
      { label: "Start / Stop Hotkey", value: normalizedHotkeys.hotkey, allowModifierOnly: true },
      { label: "Pause / Resume Hotkey", value: normalizedHotkeys.pause_hotkey, allowModifierOnly: true },
      { label: "Abort Hotkey", value: normalizedHotkeys.abort_hotkey, allowModifierOnly: true },
    ];
    const invalidHotkey = hotkeyIssues.find((item) => getHotkeyValidationMessage(item.value, { allowModifierOnly: item.allowModifierOnly }));

    if (invalidHotkey) {
      setActive("Input");
      setStatus({ msg: `✗  ${invalidHotkey.label}: ${getHotkeyValidationMessage(invalidHotkey.value, { allowModifierOnly: invalidHotkey.allowModifierOnly })} Use + between keys, e.g. ctrl_l+f9.`, ok: false });
      return;
    }

    const nextForm = {
      ...form,
      ...normalizedHotkeys,
      audio_device: form.audio_device.trim(),
      max_recording_seconds: clampSettingsNumber(form.max_recording_seconds, 10, 3600, 720),
      silence_timeout_seconds: clampSettingsNumber(form.silence_timeout_seconds, 0, 300, 30),
    };

    try {
      const triggerStatus = await invoke<ConfiguredTriggerStatus>("configure_native_trigger", {
        request: {
          hotkey: nextForm.hotkey,
          pause_hotkey: nextForm.pause_hotkey,
          abort_hotkey: nextForm.abort_hotkey,
          activation_mode: nextForm.activation_mode,
        },
      });
      await invoke("configure_native_insertion", {
        request: { auto_paste: nextForm.auto_paste },
      });
      await invoke("configure_native_capture", {
        request: {
          audio_device: nextForm.audio_device,
          max_recording_seconds: nextForm.max_recording_seconds,
          silence_timeout_seconds: nextForm.silence_timeout_seconds,
        },
      });
      const normalizedForm = {
        ...nextForm,
        hotkey: triggerStatus.registered_hotkey ?? triggerStatus.hotkey,
        pause_hotkey: triggerStatus.registered_pause_hotkey ?? triggerStatus.pause_hotkey,
        abort_hotkey: triggerStatus.registered_abort_hotkey ?? triggerStatus.abort_hotkey,
      };
      setForm(normalizedForm);
      await saveConfig({ ...normalizedForm, groq_api_key: "" });
      setStatus({ msg: "✓  Saved", ok: true });
      setTimeout(() => setStatus(null), 1500);
    } catch (e) {
      setStatus({ msg: `✗  ${e}`, ok: false });
    }
  };

  const handleCancel = async () => {
    getCurrentWindow().minimize();
  };

  const handleOpenDiagnosticsWindow = async () => {
    try {
      await invoke("open_rebuild_lab_window");
      setStatus({ msg: "✓  Diagnostics window opened.", ok: true });
      setTimeout(() => setStatus(null), 1500);
    } catch (error) {
      setStatus({
        msg: `✗  ${error instanceof Error ? error.message : String(error)}`,
        ok: false,
      });
    }
  };

  if (!form) {
    return (
      <div className="settings settings--loading">
        Connecting to backend…
      </div>
    );
  }

  return (
    <div className="settings">
      <div className="settings__shell">
        <aside className="settings__sidebar">
          <div className="settings__brand">
            <img className="settings__brand-mark" src={wordmark} alt="WordScript" />
            <span>v{APP_VERSION}</span>
          </div>

          <nav className="settings__nav" aria-label="Settings sections">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`settings__nav-item${active === tab.id ? " settings__nav-item--active" : ""}`}
                onClick={() => setActive(tab.id)}
              >
                <span className={`settings__nav-icon settings__nav-icon--${tab.icon}`} aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="settings__project">
            <span className="settings__project-kicker">Open-source brand by SW labs</span>
            <img className="settings__project-mark" src={swBenchWordmark} alt="SW Bench" />
            <small>WordScript is community-built open-source voice dictation, made as a real alternative to paid speech tools.</small>
          </div>
        </aside>

        <main className="settings__main">
          <WindowChrome
            title="Settings"
            subtitle={activeTab.eyebrow}
            status={(
              <span className={`settings__runtime-pill${readiness.ok ? " settings__runtime-pill--ok" : ""}`} title={readiness.title}>
                {readiness.label}
              </span>
            )}
            actions={active === "Rebuild Lab" ? (
              <button
                className="btn btn--cancel"
                type="button"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={() => void handleOpenDiagnosticsWindow()}
              >
                Open diagnostics window
              </button>
            ) : null}
          />
          <div className="settings__body">
            <section className="settings__panel">
            <header className="settings__panel-header">
              <span className="settings__panel-eyebrow">{activeTab.eyebrow}</span>
              <h2 className="settings__panel-title">{activeTab.label}</h2>
              <p className="settings__panel-blurb">{activeTab.blurb}</p>
            </header>

            <div className="settings__content">
              <div className={`tab${active === "Provider & Models" ? " tab--active" : ""}`}>
                <ApiModelsTab config={form} onChange={patch} onOpenDiagnostics={() => setActive("Rebuild Lab")} />
              </div>
              <div className={`tab${active === "Input" ? " tab--active" : ""}`}>
                <InputTab config={form} onChange={patch} />
              </div>
              <div className={`tab${active === "Text Rules" ? " tab--active" : ""}`}>
                <PromptsTab config={form} onChange={patch} onValidationChange={setTextRulesAnalysis} />
              </div>
              <div className={`tab${active === "About" ? " tab--active" : ""}`}>
                <AboutTab isActive={active === "About"} />
              </div>
              <div className={`tab${active === "Rebuild Lab" ? " tab--active" : ""}`}>
                <RebuildLabTab isActive={active === "Rebuild Lab"} />
              </div>
            </div>
            </section>
          </div>

          <div className="settings__footer">
            <span className={`settings__footer-status${
              status
                ? (status.ok ? " settings__footer-status--ok" : " settings__footer-status--err")
                : textRulesAnalysis?.blocking
                  ? " settings__footer-status--err"
                  : ""
            }`}>
              {status?.msg ?? (textRulesAnalysis?.blocking
                ? "Fix blocking text-rule issues before saving this window."
                : "Changes stay local until you save this window.")}
            </span>
            <div className="settings__footer-btns">
              <button className="btn btn--cancel" onClick={handleCancel}>Cancel</button>
              <button className="btn btn--save" onClick={handleSave} disabled={Boolean(textRulesAnalysis?.blocking)}>Save Changes</button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
