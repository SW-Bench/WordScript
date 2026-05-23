import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ActivitySquare,
  Info,
  Keyboard,
  Settings2,
  SquarePen,
} from "lucide-react";
import { useProvider } from "../hooks/useProvider";
import { useRuntime } from "../hooks/useRuntime";
import { getHotkeyValidationMessage, normalizeManualHotkey } from "../lib/hotkeys";
import { APP_VERSION } from "../lib/appMeta";
import type { AppConfig } from "../types/ipc";
import type { ProviderId } from "../types/providers";
import type { TextRulesAnalysis } from "../types/textRules";
import { ApiModelsTab }   from "../components/settings/ApiModelsTab";
import { InputTab }       from "../components/settings/InputTab";
import { ProfileDock } from "../components/settings/ProfileDock";
import { PromptsTab }     from "../components/settings/PromptsTab";
import { AboutTab }       from "../components/settings/AboutTab";
import { RebuildLabTab }  from "../components/settings/RebuildLabTab";
import { WindowChrome } from "../components/settings/WindowChrome";
import swBenchWordmark from "../../assets/SW bench_wordmark.png";
import wordmark from "../../assets/wordscript_wordmark.png";
import "../styles/settings.css";

const NAV_ICONS = {
  gear: Settings2,
  key: Keyboard,
  panel: SquarePen,
  info: Info,
  diagnostics: ActivitySquare,
} as const;

const TABS = [
  {
    section: "Configure",
    label: "Provider",
    id: "Provider & Models",
    icon: "gear",
    eyebrow: "Provider & Models",
    blurb: "Cloud BYOK, local runtime lane, language, model choice and post-correction.",
  },
  {
    section: "Configure",
    label: "Input",
    id: "Input",
    icon: "key",
    eyebrow: "Capture & Delivery",
    blurb: "Shortcut, microphone, delivery and capture recovery.",
  },
  {
    section: "Configure",
    label: "Text Rules",
    id: "Text Rules",
    icon: "panel",
    eyebrow: "Profiles",
    blurb: "Personal dictionary, snippets and transform preview.",
  },
  {
    section: "Inspect",
    label: "About",
    id: "About",
    icon: "info",
    eyebrow: "Support",
    blurb: "Version, installer flow, platform support and project links.",
  },
  {
    section: "Inspect",
    label: "Diagnostics",
    id: "Rebuild Lab",
    icon: "diagnostics",
    eyebrow: "Runtime",
    blurb: "Native capture, transform, recovery and insert diagnostics.",
  },
] as const;

type SettingsTab = (typeof TABS)[number];
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
  const [form, setForm]       = useState<AppConfig | null>(null);
  const [active, setActive]   = useState<Tab>("Provider & Models");
  const [status, setStatus]   = useState<{ msg: string; ok: boolean } | null>(null);
  const [textRulesAnalysis, setTextRulesAnalysis] = useState<TextRulesAnalysis | null>(null);
  const selectedProvider: ProviderId = (form?.provider ?? state.config?.provider) === "local_preview"
    ? "local_preview"
    : "groq";
  const selectedLocalModel = selectedProvider === "local_preview"
    ? (form?.local_model ?? state.config?.local_model ?? "base")
    : null;
  const selectedCleanupModel = selectedProvider === "local_preview"
    ? (form?.local_correction_model ?? state.config?.local_correction_model ?? "llama3.2:latest")
    : (form?.correction_model ?? state.config?.correction_model ?? "llama-3.3-70b-versatile");
  const { status: providerStatus } = useProvider(selectedProvider, selectedLocalModel, selectedCleanupModel);
  const providerReady = selectedProvider === "local_preview"
    ? providerStatus?.local_setup?.readiness === "ready"
    : providerStatus?.credential.configured;

  // Populate form when the runtime provides config
  useEffect(() => {
    if (state.config && !form) {
      setForm({ ...state.config });
      if (!providerReady) {
        setActive("Provider & Models");
      }
    }
  }, [state.config, form, providerReady]);

  // Keep form in sync if config reloads externally
  useEffect(() => {
    if (state.config) setForm({ ...state.config });
  }, [state.config]);

  const patch = (partial: Partial<AppConfig>) =>
    setForm((prev) => (prev ? { ...prev, ...partial } : prev));

  const activeTab = TABS.find((tab) => tab.id === active) ?? TABS[0];
  const groupedTabs = useMemo(() => {
    const groups = new Map<string, SettingsTab[]>();

    for (const tab of TABS) {
      const existing = groups.get(tab.section) ?? [];
      groups.set(tab.section, [...existing, tab]);
    }

    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
  }, []);
  const readiness = state.error
    ? { label: "Error", title: state.error, ok: false }
    : state.status === "processing"
      ? { label: "Processing", title: "WordScript is currently transcribing the last capture.", ok: true }
      : state.status === "recording"
        ? { label: state.paused ? "Paused" : "Recording", title: state.paused ? "Recording is paused." : "Recording is active.", ok: true }
          : providerReady
          ? {
              label: selectedProvider === "local_preview" ? "Local ready" : "Ready",
              title: selectedProvider === "local_preview"
                  ? providerStatus?.local_setup?.guidance ?? "Local runtime helper, STT model and cleanup model are configured for the native runtime."
                : "Groq key is present and the native runtime is configured.",
              ok: true,
            }
          : {
              label: selectedProvider === "local_preview" ? "Needs local setup" : "Needs key",
              title: selectedProvider === "local_preview"
                  ? providerStatus?.local_setup?.guidance ?? "Configure whisper-cli, a local STT model and a local cleanup model before the local runtime lane can run."
                : "Add a Groq key before transcription can run.",
              ok: false,
            };
  const isDirty = Boolean(state.config && form && JSON.stringify(form) !== JSON.stringify(state.config));

  const handleSave = async () => {
    if (!form) return;
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
      await saveConfig(normalizedForm);
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
        Connecting to runtime…
      </div>
    );
  }

  return (
    <div className="settings">
      <div className="settings__shell">
        <aside className="settings__sidebar">
          <div className="settings__brand">
            <span className="settings__brand-kicker">WordScript utility</span>
            <img className="settings__brand-mark" src={wordmark} alt="WordScript" />
            <p className="settings__brand-copy">
              Native settings shell for provider truth, capture reliability, profiles and recovery.
            </p>
            <span>v{APP_VERSION}</span>
          </div>

          <nav className="settings__nav" aria-label="Settings sections">
            {groupedTabs.map((group) => (
              <section key={group.label} className="settings__nav-group" aria-label={group.label}>
                <span className="settings__nav-group-label">{group.label}</span>
                <div className="settings__nav-group-stack">
                  {group.items.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`settings__nav-item${active === tab.id ? " settings__nav-item--active" : ""}`}
                      onClick={() => setActive(tab.id)}
                    >
                      {(() => {
                        const NavIcon = NAV_ICONS[tab.icon];
                        return <NavIcon className="settings__nav-icon" size={16} strokeWidth={1.9} />;
                      })()}
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </nav>

          <div className="settings__sidebar-bottom">
            <ProfileDock config={form} onChange={patch} onOpenTextRules={() => setActive("Text Rules")} />

            <div className="settings__project">
              <span className="settings__project-kicker">Open-source brand by SW labs</span>
              <img className="settings__project-mark" src={swBenchWordmark} alt="SW Bench" />
            </div>
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
            actions={(
              <>
                <span className={`settings__runtime-pill${isDirty ? " settings__runtime-pill--warn" : " settings__runtime-pill--sync"}`}>
                  {isDirty ? "Unsaved" : "Synced"}
                </span>
                {active === "Rebuild Lab" ? (
                  <button
                    className="btn btn--cancel"
                    type="button"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={() => void handleOpenDiagnosticsWindow()}
                  >
                    Open diagnostics window
                  </button>
                ) : null}
              </>
            )}
          />
          <div className="settings__body">
            <section className="settings__panel">
              <header className="settings__panel-header">
                <div className="settings__panel-heading">
                  <span className="settings__panel-eyebrow">{activeTab.eyebrow}</span>
                  <div className="settings__panel-title-row">
                    <h2 className="settings__panel-title">{activeTab.label}</h2>
                    <div className="settings__panel-meta" aria-label="Section meta">
                      <span className={`settings__panel-chip${readiness.ok ? " settings__panel-chip--ok" : ""}`}>
                        {readiness.label}
                      </span>
                      <span className={`settings__panel-chip${isDirty ? " settings__panel-chip--warn" : " settings__panel-chip--muted"}`}>
                        {isDirty ? "Unsaved local draft" : "Local save window"}
                      </span>
                    </div>
                  </div>
                </div>
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
                  <RebuildLabTab isActive={active === "Rebuild Lab"} config={form} onChange={patch} />
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
                : isDirty
                  ? "Changes stay local to this window until you save them into the runtime config."
                  : "This settings window is currently in sync with the persisted runtime config.")}
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
