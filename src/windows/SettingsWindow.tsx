import { useEffect, useMemo, useState, useTransition } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ActivitySquare,
  BookText,
  Cpu,
  History as HistoryIcon,
  Home,
  Info,
  Keyboard,
  MessageSquare,
  Monitor,
  NotebookPen,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  User,
  type LucideIcon,
} from "lucide-react";
import { useProvider } from "../hooks/useProvider";
import { useRuntime } from "../hooks/useRuntime";
import { getHotkeyValidationMessage, normalizeManualHotkey } from "../lib/hotkeys";
import { APP_VERSION } from "../lib/appMeta";
import type { AppConfig } from "../types/ipc";
import type { ProviderId } from "../types/providers";
import type { ProfileHealthLevel, TextRulesAnalysis } from "../types/textRules";
import { ModesTab } from "../components/settings/ModesTab";
import { ApiModelsTab } from "../components/settings/ApiModelsTab";
import { InputTab } from "../components/settings/InputTab";
import { PromptsTab } from "../components/settings/PromptsTab";
import { AboutTab } from "../components/settings/AboutTab";
import { RebuildLabTab } from "../components/settings/RebuildLabTab";
import { HomeArea } from "../components/areas/HomeArea";
import { HistoryArea } from "../components/areas/HistoryArea";
import { PermissionsArea } from "../components/areas/PermissionsArea";
import { Sidebar, ProfileSwitcher, StatusBadge } from "../components/shell";
import type { SidebarGroup } from "../components/shell";
import { Button } from "../components/ui/button";
import { TooltipProvider } from "../components/ui/tooltip";

type AreaId =
  | "home"
  | "history"
  | "profiles"
  | "speech"
  | "modes"
  | "capture"
  | "permissions"
  | "diagnostics"
  | "about";

interface AreaDef {
  id: AreaId;
  label: string;
  icon: LucideIcon;
  group: string;
  eyebrow: string;
  blurb: string;
  /** Does this area edit the persisted config draft (show the save bar)? */
  config?: boolean;
}

const AREAS: AreaDef[] = [
  { id: "home", label: "Home", icon: Home, group: "Workspace", eyebrow: "Overview", blurb: "Runtime readiness, recent dictations and quick recovery." },
  { id: "history", label: "History", icon: HistoryIcon, group: "Workspace", eyebrow: "Transcriptions", blurb: "Searchable transcription history, export and retention.", config: true },
  { id: "profiles", label: "Profiles", icon: BookText, group: "Workspace", eyebrow: "Text Rules", blurb: "Context, dictionary, snippets and transcription bias.", config: true },
  { id: "speech", label: "Speech & AI", icon: Cpu, group: "Engine", eyebrow: "Provider & Models", blurb: "Cloud BYOK or local lane, language, models and cleanup.", config: true },
  { id: "modes", label: "Modes", icon: SlidersHorizontal, group: "Engine", eyebrow: "Processing", blurb: "Verbatim, cleanup, rewrite, agent or prompt enhancement.", config: true },
  { id: "capture", label: "Capture", icon: Keyboard, group: "Engine", eyebrow: "Input & Delivery", blurb: "Shortcuts, microphone, delivery and overlay placement.", config: true },
  { id: "permissions", label: "Permissions", icon: ShieldCheck, group: "System", eyebrow: "Insert & Recovery", blurb: "Insert readiness, driver chain and recovery scratchpad." },
  { id: "diagnostics", label: "Diagnostics", icon: ActivitySquare, group: "System", eyebrow: "Runtime", blurb: "Capture, transform and insert pipeline diagnostics.", config: true },
  { id: "about", label: "About", icon: Info, group: "System", eyebrow: "Support", blurb: "Version, release path and project links." },
];

const PREVIEW_ITEMS = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "upload", label: "Upload", icon: Upload },
  { id: "notes", label: "Notes", icon: NotebookPen },
  { id: "workspace", label: "Workspace", icon: Monitor },
  { id: "account", label: "Account", icon: User },
];

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
  const [form, setForm] = useState<AppConfig | null>(null);
  const [active, setActive] = useState<AreaId>("home");
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [textRulesAnalysis, setTextRulesAnalysis] = useState<TextRulesAnalysis | null>(null);
  const [profileHealthLevel, setProfileHealthLevel] = useState<ProfileHealthLevel | null>(null);

  const selectedProvider: ProviderId =
    (form?.provider ?? state.config?.provider) === "local_preview" ? "local_preview" : "groq";
  const selectedLocalModel =
    selectedProvider === "local_preview"
      ? form?.local_model ?? state.config?.local_model ?? "base"
      : null;
  const selectedCleanupModel =
    selectedProvider === "local_preview"
      ? form?.local_correction_model ?? state.config?.local_correction_model ?? "llama3.2:latest"
      : form?.correction_model ?? state.config?.correction_model ?? "llama-3.3-70b-versatile";
  const { status: providerStatus } = useProvider(selectedProvider, selectedLocalModel, selectedCleanupModel);
  const providerReady =
    selectedProvider === "local_preview"
      ? providerStatus?.local_setup?.readiness === "ready"
      : providerStatus?.credential.configured;

  const navigate = (id: string) => startTransition(() => setActive(id as AreaId));

  // Populate form when the runtime provides config; route to Speech if not ready.
  useEffect(() => {
    if (state.config && !form) {
      setForm({ ...state.config });
      if (!providerReady) setActive("speech");
    }
  }, [state.config, form, providerReady]);

  // Keep form in sync if config reloads externally.
  useEffect(() => {
    if (state.config) setForm({ ...state.config });
  }, [state.config]);

  const patch = (partial: Partial<AppConfig>) =>
    setForm((prev) => (prev ? { ...prev, ...partial } : prev));

  const activeArea = AREAS.find((area) => area.id === active) ?? AREAS[0];

  const groups: SidebarGroup[] = useMemo(() => {
    const order = ["Workspace", "Engine", "System"];
    const byGroup: SidebarGroup[] = order.map((label) => ({
      label,
      items: AREAS.filter((area) => area.group === label).map((area) => ({
        id: area.id,
        label: area.label,
        icon: area.icon,
      })),
    }));
    byGroup.push({
      label: "Preview",
      items: PREVIEW_ITEMS.map((item) => ({ ...item, preview: true })),
    });
    return byGroup;
  }, []);

  const readiness = state.error
    ? { label: "Error", title: state.error, ok: false }
    : state.status === "processing"
      ? { label: "Processing", title: "WordScript is currently transcribing the last capture.", ok: true }
      : state.status === "recording"
        ? {
            label: state.paused ? "Paused" : "Recording",
            title: state.paused ? "Recording is paused." : "Recording is active.",
            ok: true,
          }
        : providerReady
          ? {
              label: selectedProvider === "local_preview" ? "Local ready" : "Ready",
              title:
                selectedProvider === "local_preview"
                  ? providerStatus?.local_setup?.guidance ??
                    "Local runtime helper, STT model and cleanup model are configured for the native runtime."
                  : "Groq key is present and the native runtime is configured.",
              ok: true,
            }
          : {
              label: selectedProvider === "local_preview" ? "Needs local setup" : "Needs key",
              title:
                selectedProvider === "local_preview"
                  ? providerStatus?.local_setup?.guidance ??
                    "Configure whisper-cli, a local STT model and a local cleanup model before the local runtime lane can run."
                  : "Add a Groq key before transcription can run.",
              ok: false,
            };

  const laneLabel = selectedProvider === "local_preview" ? "Local runtime" : "Groq cloud";
  const isDirty = Boolean(state.config && form && JSON.stringify(form) !== JSON.stringify(state.config));

  const handleSave = async () => {
    if (!form) return;
    if (textRulesAnalysis?.blocking) {
      setActive("profiles");
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
    const invalidHotkey = hotkeyIssues.find((item) =>
      getHotkeyValidationMessage(item.value, { allowModifierOnly: item.allowModifierOnly }),
    );

    if (invalidHotkey) {
      setActive("capture");
      setStatus({
        msg: `✗  ${invalidHotkey.label}: ${getHotkeyValidationMessage(invalidHotkey.value, {
          allowModifierOnly: invalidHotkey.allowModifierOnly,
        })} Use + between keys, e.g. ctrl_l+f9.`,
        ok: false,
      });
      return;
    }

    const nextForm = {
      ...form,
      ...normalizedHotkeys,
      audio_device: form.audio_device.trim(),
      max_recording_seconds: clampSettingsNumber(form.max_recording_seconds, 10, 3600, 720),
      silence_timeout_seconds: clampSettingsNumber(form.silence_timeout_seconds, 0, 300, 30),
      result_actions_timeout_ms: clampSettingsNumber(form.result_actions_timeout_ms, 1000, 60000, 9000),
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
      <div className="flex h-full items-center justify-center text-[13px] text-fg-dim">
        Connecting to runtime…
      </div>
    );
  }

  const renderArea = () => {
    switch (active) {
      case "home":
        return (
          <HomeArea
            isActive
            config={form}
            readiness={readiness}
            providerReady={Boolean(providerReady)}
            laneLabel={laneLabel}
            onNavigate={navigate}
          />
        );
      case "history":
        return <HistoryArea isActive config={form} onChange={patch} />;
      case "profiles":
        return (
          <PromptsTab
            config={form}
            onChange={patch}
            onValidationChange={setTextRulesAnalysis}
            onHealthChange={(s) => setProfileHealthLevel(s?.level ?? null)}
          />
        );
      case "speech":
        return <ApiModelsTab config={form} onChange={patch} onOpenDiagnostics={() => navigate("diagnostics")} />;
      case "modes":
        return <ModesTab config={form} onChange={patch} />;
      case "capture":
        return <InputTab config={form} onChange={patch} />;
      case "permissions":
        return <PermissionsArea />;
      case "diagnostics":
        return <RebuildLabTab isActive config={form} onChange={patch} />;
      case "about":
        return <AboutTab isActive />;
      default:
        return null;
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full w-full overflow-hidden text-foreground">
        <Sidebar
          groups={groups}
          activeId={active}
          onSelect={navigate}
          header={
            <div className="flex items-center gap-2.5 px-5 pb-3.5 pt-4">
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-gradient-to-b from-brand to-brand-strong text-[14px] font-bold text-[#1a1206] shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
              >
                W
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[14px] font-semibold leading-tight text-foreground">
                  WordScript
                </span>
                <span className="text-[11px] leading-tight text-fg-muted">v{APP_VERSION}</span>
              </div>
            </div>
          }
          footer={
            <ProfileSwitcher config={form} onChange={patch} onEdit={() => navigate("profiles")} />
          }
        />

        <main className="flex min-w-0 flex-1 flex-col">
          {/* Toolbar header (sits under the native title bar) */}
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <activeArea.icon className="size-5 shrink-0 text-fg-dim" strokeWidth={1.75} />
              <div className="min-w-0">
                <h1 className="truncate text-[15px] font-semibold leading-tight">{activeArea.label}</h1>
                <p className="truncate text-[12px] text-fg-muted">{activeArea.eyebrow}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge tone={readiness.ok ? "success" : "warning"} dot>
                {readiness.label}
              </StatusBadge>
              <StatusBadge tone={isDirty ? "warning" : "neutral"}>
                {isDirty ? "Unsaved" : "Synced"}
              </StatusBadge>
              {active === "diagnostics" && (
                <Button size="sm" variant="outline" onClick={() => void handleOpenDiagnosticsWindow()}>
                  Pop out
                </Button>
              )}
            </div>
          </header>

          {/* Scrollable content area (relative so an Inspector slide-over can anchor here) */}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto px-8 py-8">
              <div className="mx-auto max-w-[760px]">
                <div key={active} className="animate-in fade-in-50 duration-150">
                  {renderArea()}
                </div>
              </div>
            </div>
          </div>

          {/* Footer save bar */}
          <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-border px-6 py-3">
            <span
              className={
                status
                  ? status.ok
                    ? "text-[12px] text-[var(--green)]"
                    : "text-[12px] text-[var(--red)]"
                  : textRulesAnalysis?.blocking
                    ? "text-[12px] text-[var(--red)]"
                    : "text-[12px] text-fg-muted"
              }
            >
              {status?.msg ??
                (textRulesAnalysis?.blocking
                  ? "Fix blocking text-rule issues before saving this window."
                  : isDirty
                    ? "Changes stay local to this window until you save them into the runtime config."
                    : "This window is in sync with the persisted runtime config.")}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={Boolean(textRulesAnalysis?.blocking)}>
                Save Changes
              </Button>
            </div>
          </footer>
        </main>
      </div>
    </TooltipProvider>
  );
}
