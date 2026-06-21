import { memo, useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HotkeyRecorder } from "./HotkeyRecorder";
import { FormCard, FormRow, Select, StatusBadge, Toggle } from "../shell";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import {
  buildTextProfilesPatch,
  resolveActiveTextProfile,
} from "../../lib/textProfiles";
import type { AppConfig, ProcessingMode, EnhanceSubMode, PromptTarget, TextProfile, TextProfileWorkMode } from "../../types/ipc";

interface Props {
  config: AppConfig;
  onChange: (p: Partial<AppConfig>) => void;
}

interface ResolvedProcessingContext {
  mode: ProcessingMode;
  is_override: boolean;
  auto_detected: boolean;
  detected_from: string | null;
}

const MODE_LABELS: Record<ProcessingMode, string> = {
  auto: "Auto",
  verbatim: "Verbatim",
  cleanup: "Cleanup",
  rewrite: "Rewrite",
  agent: "Agent",
  prompt_enhance: "Prompt Enhance",
};

const MODE_DESCRIPTIONS: Record<ProcessingMode, string> = {
  auto: "LLM decides per transcription which concrete mode to run. Enable workspace context below to improve routing accuracy.",
  verbatim: "No LLM processing. Only text rules (dictionary, snippets) are applied.",
  cleanup: "Remove fillers, light grammar correction. Meaning preserved.",
  rewrite: "Cleanup plus professional rephrasing for better language. Manual only — not auto-detected.",
  agent: "WordScript executes instructions addressed to it by name (e.g. \"Hey WordScript, write an email…\").",
  prompt_enhance: "Structure raw dictation into a well-formed AI prompt for external tools (Claude Code, Cursor, …).",
};

const SUB_MODE_LABELS: Record<EnhanceSubMode, string> = {
  enhance: "Enhance — Polish without bloat. Role, constraints, format hints.",
  expand: "Expand — Full restructure. CoT, step-by-step, audience, output format.",
};

const TARGET_OPTIONS: { value: PromptTarget; label: string }[] = [
  { value: "general", label: "General" },
  { value: "claude_code", label: "Claude Code" },
  { value: "cursor", label: "Cursor" },
  { value: "chatgpt", label: "ChatGPT" },
  { value: "copilot", label: "Copilot" },
];

// Maps each processing mode to its dedicated per-mode hotkey config field.
const MODE_HOTKEY_FIELDS = {
  auto: "mode_auto_hotkey",
  verbatim: "mode_verbatim_hotkey",
  cleanup: "mode_cleanup_hotkey",
  rewrite: "mode_rewrite_hotkey",
  agent: "mode_agent_hotkey",
  prompt_enhance: "mode_prompt_enhance_hotkey",
} as const satisfies Record<ProcessingMode, keyof AppConfig>;

function processingModeLabel(mode: ProcessingMode): string {
  return MODE_LABELS[mode] ?? mode;
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

export const ModesTab = memo(function ModesTab({ config, onChange }: Props) {
  const activeProfile = resolveActiveTextProfile(config);
  const activeWorkMode = activeProfile.work_mode;
  const selectedMode: ProcessingMode = activeWorkMode?.processing_mode ?? config.processing_mode ?? "auto";
  const selectedSubMode: EnhanceSubMode = activeWorkMode?.enhance_sub_mode ?? config.enhance_sub_mode ?? "enhance";
  const selectedTarget: PromptTarget = activeWorkMode?.target ?? config.enhance_target ?? "general";
  const autoDetectEnabled = config.auto_detect_mode ?? false;
  const modePickerHotkey = config.mode_picker_hotkey ?? "";
  const cycleModeHotkey = config.mode_cycle_hotkey ?? "";
  const cleanupEnabled = config.post_process;

  const [resolved, setResolved] = useState<ResolvedProcessingContext | null>(null);

  const fetchResolved = useCallback(async () => {
    try {
      const ctx = await invoke<ResolvedProcessingContext>("resolve_current_processing_mode");
      setResolved(ctx);
    } catch {
      setResolved(null);
    }
  }, []);

  useEffect(() => {
    void fetchResolved();
  }, [fetchResolved, selectedMode, config.active_text_profile_id, autoDetectEnabled]);

  // Write the processing mode into the active profile's work_mode, not the
  // global config field. This is the same pattern the Prompts tab uses for
  // rewrite_style, insert_behavior, etc. — each profile carries its own mode
  // default, and the global `config.processing_mode` is only the serde
  // fallback for pre-migration configs.
  const updateActiveProfileWorkMode = useCallback(
    (updater: (workMode: NonNullable<TextProfileWorkMode>) => NonNullable<TextProfileWorkMode>) => {
      const currentWorkMode: NonNullable<TextProfileWorkMode> = activeWorkMode ?? {
        rewrite_style: "clean",
        insert_behavior: "auto_paste",
        recovery_behavior: "standard",
        processing_mode: "auto",
        enhance_sub_mode: null,
        target: null,
      };
      const nextProfiles = config.text_profiles.map((profile) =>
        profile.id === activeProfile.id
          ? { ...profile, work_mode: updater(currentWorkMode) }
          : profile,
      );
      onChange(buildTextProfilesPatch(config, nextProfiles, activeProfile.id));
    },
    [activeProfile.id, activeWorkMode, config, onChange],
  );

  const handleSetMode = useCallback((next: ProcessingMode) => {
    updateActiveProfileWorkMode((wm) => ({ ...wm, processing_mode: next }));
  }, [updateActiveProfileWorkMode]);

  const handleSetSubMode = useCallback((next: EnhanceSubMode) => {
    updateActiveProfileWorkMode((wm) => ({ ...wm, enhance_sub_mode: next }));
  }, [updateActiveProfileWorkMode]);

  const handleSetTarget = useCallback((next: PromptTarget) => {
    updateActiveProfileWorkMode((wm) => ({ ...wm, target: next }));
  }, [updateActiveProfileWorkMode]);

  const handleToggleAutoDetect = useCallback((next: boolean) => {
    onChange({ auto_detect_mode: next });
  }, [onChange]);

  const handleModePickerHotkey = useCallback((value: string) => {
    onChange({ mode_picker_hotkey: value });
  }, [onChange]);

  const handleCycleModeHotkey = useCallback((value: string) => {
    onChange({ mode_cycle_hotkey: value });
  }, [onChange]);

  const handlePerModeHotkey = useCallback((mode: ProcessingMode, value: string) => {
    onChange({ [MODE_HOTKEY_FIELDS[mode]]: value });
  }, [onChange]);

  const precedenceLine = resolved
    ? resolved.is_override
      ? `Runtime override: ${processingModeLabel(resolved.mode)} (wins over profile default)`
      : resolved.auto_detected
        ? `Auto mode: ${processingModeLabel(resolved.mode)} (LLM will decide per transcription)`
        : `Profile default: ${processingModeLabel(resolved.mode)}`
    : "Resolving effective mode…";

  return (
    <div className="flex flex-col gap-8">
      <FormCard
        title="Effective mode"
        description={`Which processing mode WordScript uses right now for the active profile "${activeProfile.label}". Mode defaults are stored per profile — switch profiles in the sidebar to set different defaults.`}
        bodyClassName="py-4"
      >
        <FormRow
          label="Currently effective"
          align="start"
          divider={false}
          control={
            <StatusBadge tone={resolved?.is_override ? "accent" : resolved?.auto_detected ? "info" : "neutral"} dot>
              {resolved ? processingModeLabel(resolved.mode) : "—"}
            </StatusBadge>
          }
          hint={precedenceLine}
        />
      </FormCard>

      <FormCard
        title="Processing mode"
        description={`How dictation is transformed before it is inserted. This is the default for the active profile "${activeProfile.label}". Trigger hotkeys live in Capture; mode hotkeys are further down.`}
      >
        <div role="radiogroup" aria-label="Processing mode selector" className="flex flex-col">
          {(Object.keys(MODE_LABELS) as ProcessingMode[]).map((mode, index, arr) => {
            const checked = selectedMode === mode;
            const isLast = index === arr.length - 1;
            return (
              <div key={mode} className={cn("border-b border-border", isLast && "border-b-0")}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 py-3",
                    checked && "cursor-default",
                  )}
                >
                  <input
                    type="radio"
                    name="processing_mode"
                    value={mode}
                    checked={checked}
                    onChange={() => handleSetMode(mode)}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-foreground">{processingModeLabel(mode)}</span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-fg-dim">{MODE_DESCRIPTIONS[mode]}</span>
                  </span>
                </label>

                {checked && mode === "prompt_enhance" && (
                  <div className="pb-4 pl-7">
                    <FormRow
                      label="Enhance sub-mode"
                      hint="Enhance polishes without bloat; Expand restructures fully."
                      control={
                        <Select
                          aria-label="Enhance sub-mode"
                          className="w-[200px]"
                          value={selectedSubMode}
                          onChange={(e) => handleSetSubMode(e.target.value as EnhanceSubMode)}
                        >
                          <option value="enhance">Enhance</option>
                          <option value="expand">Expand</option>
                        </Select>
                      }
                    />
                    <FormRow
                      label="Prompt target"
                      hint="Optimizes prompt syntax for the chosen AI tool."
                      divider={false}
                      control={
                        <Select
                          aria-label="Prompt target"
                          className="w-[200px]"
                          value={selectedTarget}
                          onChange={(e) => handleSetTarget(e.target.value as PromptTarget)}
                        >
                          {TARGET_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </Select>
                      }
                    />
                  </div>
                )}
                {checked && mode === "agent" && (
                  <div className="pb-4 pl-7">
                    <AgentControls config={config} onChange={onChange} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </FormCard>

      <FormCard
        title="Cleanup settings"
        description="Global parameters for the cleanup and rewrite transform pipeline. These apply whenever the effective mode is Cleanup or Rewrite (including when Auto resolves to one of them)."
        bodyClassName="py-4"
      >
        <FormRow
          label="AI cleanup"
          hint="Tidy punctuation, grammar and phrasing after transcription."
          htmlFor="ai-cleanup-toggle"
          control={
            <Toggle
              id="ai-cleanup-toggle"
              checked={cleanupEnabled}
              onCheckedChange={(checked) => onChange({ post_process: checked })}
            />
          }
        />
        {cleanupEnabled && (
          <>
            <FormRow
              label="Remove fillers"
              hint="Strip ums, uhs and false starts."
              htmlFor="filter-fillers-toggle"
              control={
                <Toggle
                  id="filter-fillers-toggle"
                  checked={config.filter_fillers}
                  disabled={!config.post_process}
                  onCheckedChange={(checked) => onChange({ filter_fillers: checked })}
                />
              }
            />
            <FormRow
              label="Rewrite phrasing"
              hint="Allow broader rewrites beyond simple fixes. Rewrite mode enables this implicitly."
              htmlFor="professionalize-toggle"
              divider={false}
              control={
                <Toggle
                  id="professionalize-toggle"
                  checked={config.professionalize}
                  disabled={!config.post_process}
                  onCheckedChange={(checked) => onChange({ professionalize: checked })}
                />
              }
            />
          </>
        )}
        <p className="border-t border-border py-3 text-[12px] leading-snug text-fg-muted">
          {cleanupSummary(config)} Choose the cleanup model in Speech &amp; AI.
        </p>
      </FormCard>

      <FormCard
        title="Workspace context"
        description="When enabled, WordScript detects the active app (IDE, browser, chat, …) and uses it as a probability signal for Auto mode routing. Enabled by default. Turn off to route based purely on transcript text."
      >
        <FormRow
          label="Collect workspace context for Auto mode"
          hint="Detects the active app category and feeds it into Auto mode routing. Off by choice only."
          htmlFor="auto-detect-toggle"
          divider={false}
          control={
            <Toggle id="auto-detect-toggle" checked={autoDetectEnabled} onCheckedChange={handleToggleAutoDetect} />
          }
        />
      </FormCard>

      <FormCard
        title="Hotkeys"
        description={
          <>
            Global hotkeys for quick mode switching. The picker opens the overlay selector; cycle rotates recent modes; per-mode keys jump directly.{" "}
            <span className="text-fg-muted">Trigger hotkeys (start, stop, pause, abort) live in Capture.</span>
          </>
        }
      >
        <FormRow
          label="Mode picker"
          control={<HotkeyRecorder value={modePickerHotkey} onChange={handleModePickerHotkey} />}
        />
        <FormRow
          label="Cycle mode"
          control={<HotkeyRecorder value={cycleModeHotkey} onChange={handleCycleModeHotkey} />}
        />
        {(Object.keys(MODE_LABELS) as ProcessingMode[]).map((mode, index, arr) => (
          <FormRow
            key={mode}
            label={processingModeLabel(mode)}
            divider={index < arr.length - 1}
            control={
              <HotkeyRecorder
                value={(config[MODE_HOTKEY_FIELDS[mode]] as string | undefined) ?? ""}
                onChange={(value) => handlePerModeHotkey(mode, value)}
              />
            }
          />
        ))}
      </FormCard>
    </div>
  );
});

function AgentControls({
  config,
  onChange,
}: {
  config: AppConfig;
  onChange: (p: Partial<AppConfig>) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface px-3 py-3">
      <FormRow
        label="Agent name"
        hint="The name you use when addressing the agent in speech."
        htmlFor="inline-agent-name-input"
        divider={false}
        control={
          <Input
            id="inline-agent-name-input"
            type="text"
            className="w-[200px]"
            value={config.agent_name}
            placeholder="WordScript"
            onChange={(e) => onChange({ agent_name: e.target.value })}
          />
        }
      />
      <p className="text-[12px] leading-snug text-fg-muted">
        The agent model is configured in Speech &amp; AI.
      </p>
    </div>
  );
}