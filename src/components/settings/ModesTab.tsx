import { memo, useState, useCallback, useEffect, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowRight, Trash2 } from "lucide-react";
import { HotkeyRecorder } from "./HotkeyRecorder";
import { FormCard, FormRow, Select, StatusBadge, Toggle } from "../shell";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import type { AppConfig, ProcessingMode, EnhanceSubMode, PromptTarget } from "../../types/ipc";

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

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-surface-strong px-2 py-0.5 text-[12px] font-medium text-fg-dim">
      {children}
    </span>
  );
}

const MODE_LABELS: Record<ProcessingMode, string> = {
  verbatim: "Verbatim",
  cleanup: "Cleanup",
  rewrite: "Rewrite",
  agent: "Agent",
  prompt_enhance: "Prompt Enhance",
};

const MODE_DESCRIPTIONS: Record<ProcessingMode, string> = {
  verbatim: "No processing. Only text rules (dictionary, snippets) are applied.",
  cleanup: "Remove fillers, light grammar correction. Meaning preserved.",
  rewrite: "Cleanup plus professional rephrasing for better language.",
  agent: "Route to AI agent. Detects instructions and executes them.",
  prompt_enhance: "Structure raw dictation into a well-formed AI prompt.",
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

const APP_CATEGORIES: { value: string; label: string }[] = [
  { value: "ide", label: "IDE" },
  { value: "browser", label: "Browser" },
  { value: "chat", label: "Chat App" },
  { value: "mail", label: "Mail" },
  { value: "notes", label: "Notes" },
  { value: "terminal", label: "Terminal" },
  { value: "other", label: "Other" },
];

const AGENT_MODEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "llama-3.3-70b-versatile", label: "llama-3.3-70b-versatile — Empfohlen (beste Qualität)" },
  { value: "llama-3.1-8b-instant", label: "llama-3.1-8b-instant — Schnell, einfache Anweisungen" },
  { value: "mixtral-8x7b-32768", label: "mixtral-8x7b-32768 — Ausgewogen" },
  { value: "gemma2-9b-it", label: "gemma2-9b-it — Kompakt" },
];

const LOCAL_AGENT_MODEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "llama3.2:latest", label: "llama3.2:latest — Empfohlen (beste lokale Qualität)" },
  { value: "qwen2.5:7b-instruct", label: "qwen2.5:7b-instruct — Ausgewogen" },
  { value: "gemma3:4b", label: "gemma3:4b — Kompakt" },
];

// Maps each processing mode to its dedicated per-mode hotkey config field.
const MODE_HOTKEY_FIELDS = {
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
  const selectedMode: ProcessingMode = config.processing_mode ?? "cleanup";
  const selectedSubMode: EnhanceSubMode = config.enhance_sub_mode ?? "enhance";
  const selectedTarget: PromptTarget = config.enhance_target ?? "general";
  const autoDetectEnabled = config.auto_detect_mode ?? false;
  const appMappings: Record<string, ProcessingMode> = config.workspace_app_map ?? {};
  const modePickerHotkey = config.mode_picker_hotkey ?? "";
  const cycleModeHotkey = config.mode_cycle_hotkey ?? "";
  const previewLaneSelected = config.provider === "local_preview";
  const cleanupEnabled = config.post_process;
  const agentEnabled = config.agent_mode_enabled;

  const [newMappingCategory, setNewMappingCategory] = useState("ide");
  const [newMappingMode, setNewMappingMode] = useState<ProcessingMode>("cleanup");
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
  }, [fetchResolved, selectedMode, config.active_text_profile_id, autoDetectEnabled, appMappings]);

  const handleSetMode = useCallback((next: ProcessingMode) => {
    onChange({ processing_mode: next });
  }, [onChange]);

  const handleSetSubMode = useCallback((next: EnhanceSubMode) => {
    onChange({ enhance_sub_mode: next });
  }, [onChange]);

  const handleSetTarget = useCallback((next: PromptTarget) => {
    onChange({ enhance_target: next });
  }, [onChange]);

  const handleToggleAutoDetect = useCallback((next: boolean) => {
    onChange({ auto_detect_mode: next });
  }, [onChange]);

  const handleAddMapping = useCallback(() => {
    const nextMappings = { ...appMappings, [newMappingCategory]: newMappingMode };
    onChange({ workspace_app_map: nextMappings });
  }, [appMappings, newMappingCategory, newMappingMode, onChange]);

  const handleRemoveMapping = useCallback((category: string) => {
    const nextMappings = { ...appMappings };
    delete nextMappings[category];
    onChange({ workspace_app_map: nextMappings });
  }, [appMappings, onChange]);

  const handleModePickerHotkey = useCallback((value: string) => {
    onChange({ mode_picker_hotkey: value });
  }, [onChange]);

  const handleCycleModeHotkey = useCallback((value: string) => {
    onChange({ mode_cycle_hotkey: value });
  }, [onChange]);

  const handlePerModeHotkey = useCallback((mode: ProcessingMode, value: string) => {
    onChange({ [MODE_HOTKEY_FIELDS[mode]]: value });
  }, [onChange]);

  const hasMappings = Object.keys(appMappings).length > 0;

  const precedenceLine = resolved
    ? resolved.is_override
      ? `Runtime override: ${processingModeLabel(resolved.mode)} (wins over profile default)`
      : resolved.auto_detected
        ? `Auto-detected: ${processingModeLabel(resolved.mode)}${resolved.detected_from ? ` from ${resolved.detected_from}` : ""}`
        : `Profile default active: ${processingModeLabel(resolved.mode)}`
    : "Resolving effective mode…";

  return (
    <div className="flex flex-col gap-8">
      <FormCard
        title="Effective mode"
        description="Which processing mode WordScript is using right now, and where it comes from. Profile defaults live in Profiles; this tab sets the global fallback and per-session overrides."
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
        title="Default processing mode"
        description="How dictation is transformed before it is inserted. Pick a mode to reveal its controls. Trigger hotkeys live in Capture; mode hotkeys are further down."
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

                {checked && mode === "cleanup" && (
                  <div className="pb-4 pl-7">
                    <CleanupControls config={config} onChange={onChange} previewLaneSelected={previewLaneSelected} cleanupEnabled={cleanupEnabled} />
                  </div>
                )}
                {checked && mode === "rewrite" && (
                  <div className="pb-4 pl-7">
                    <CleanupControls config={config} onChange={onChange} previewLaneSelected={previewLaneSelected} cleanupEnabled={cleanupEnabled} />
                  </div>
                )}
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
                    <AgentControls config={config} onChange={onChange} previewLaneSelected={previewLaneSelected} agentEnabled={agentEnabled} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </FormCard>

      <FormCard
        title="AI cleanup"
        description="Cleanup runs after speech-to-text. When on, filter fillers and rewrite phrasing tune how aggressively the transcript is corrected. The cleanup model is configured in Speech & AI."
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
              hint="Allow broader rewrites beyond simple fixes."
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
        title="AI agent mode"
        description={
          agentEnabled
            ? "When an instruction is detected, WordScript executes it via AI instead of just transcribing."
            : "Off. All recordings are transcribed as-is and passed through the normal cleanup pipeline."
        }
      >
        <FormRow
          label="Agent mode"
          hint={'Detects spoken instructions like "Hey WordScript, write an email…".'}
          htmlFor="agent-mode-toggle"
          control={
            <Toggle
              id="agent-mode-toggle"
              checked={agentEnabled}
              onCheckedChange={(checked) => onChange({ agent_mode_enabled: checked })}
            />
          }
        />
        {agentEnabled && (
          <AgentControls config={config} onChange={onChange} previewLaneSelected={previewLaneSelected} agentEnabled={agentEnabled} embedded />
        )}
      </FormCard>

      <FormCard
        title="Auto-detection"
        description="When enabled, WordScript detects the active app and suggests a processing mode you can confirm in the overlay."
      >
        <FormRow
          label="Extend overlay with detected app and mode suggestion"
          htmlFor="auto-detect-toggle"
          divider={false}
          control={
            <Toggle id="auto-detect-toggle" checked={autoDetectEnabled} onCheckedChange={handleToggleAutoDetect} />
          }
        />
      </FormCard>

      <FormCard
        title="Per-app mapping"
        description="Maps a detected app category to a processing mode when auto-detection is on."
      >
        <div aria-label="Per-app mode mappings">
          {!hasMappings ? (
            <p className="py-3 text-[12px] text-fg-dim">
              No custom app mappings yet. Add one below or use the overlay to auto-populate.
            </p>
          ) : (
            <div className="flex flex-col">
              {Object.entries(appMappings).map(([category, mode]) => (
                <div
                  key={category}
                  className="flex items-center gap-2 border-b border-border py-2.5 last:border-b-0"
                >
                  <Chip>{APP_CATEGORIES.find((c) => c.value === category)?.label ?? category}</Chip>
                  <ArrowRight className="size-3.5 shrink-0 text-fg-muted" />
                  <Chip>{processingModeLabel(mode)}</Chip>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="ml-auto text-fg-muted hover:text-[var(--red)]"
                    onClick={() => handleRemoveMapping(category)}
                    aria-label={`Remove ${category} mapping`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-border py-3">
            <Select
              value={newMappingCategory}
              onChange={(e) => setNewMappingCategory(e.target.value)}
              aria-label="App category"
              className="w-[140px]"
            >
              {APP_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
            <Select
              value={newMappingMode}
              onChange={(e) => setNewMappingMode(e.target.value as ProcessingMode)}
              aria-label="Processing mode"
              className="w-[170px]"
            >
              {(Object.keys(MODE_LABELS) as ProcessingMode[]).map((m) => (
                <option key={m} value={m}>
                  {processingModeLabel(m)}
                </option>
              ))}
            </Select>
            <Button size="sm" variant="outline" onClick={handleAddMapping}>
              Add mapping
            </Button>
          </div>
        </div>
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

function CleanupControls({
  config,
  onChange,
  previewLaneSelected,
  cleanupEnabled,
}: {
  config: AppConfig;
  onChange: (p: Partial<AppConfig>) => void;
  previewLaneSelected: boolean;
  cleanupEnabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface px-3 py-3">
      <FormRow
        label="AI cleanup"
        hint="Tidy punctuation, grammar and phrasing after transcription."
        htmlFor="inline-ai-cleanup-toggle"
        divider={false}
        control={
          <Toggle
            id="inline-ai-cleanup-toggle"
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
            htmlFor="inline-filter-fillers-toggle"
            control={
              <Toggle
                id="inline-filter-fillers-toggle"
                checked={config.filter_fillers}
                onCheckedChange={(checked) => onChange({ filter_fillers: checked })}
              />
            }
          />
          <FormRow
            label="Rewrite phrasing"
            hint="Allow broader rewrites beyond simple fixes."
            htmlFor="inline-professionalize-toggle"
            divider={false}
            control={
              <Toggle
                id="inline-professionalize-toggle"
                checked={config.professionalize}
                onCheckedChange={(checked) => onChange({ professionalize: checked })}
              />
            }
          />
        </>
      )}
      <p className="text-[12px] leading-snug text-fg-muted">
        {previewLaneSelected ? "Local Ollama cleanup model" : "Groq cleanup model"} is selected in Speech &amp; AI.
        {previewLaneSelected ? ` Current: ${config.local_correction_model || "llama3.2:latest"}.` : ` Current: ${config.correction_model || "llama-3.3-70b-versatile"}.`}
      </p>
    </div>
  );
}

function AgentControls({
  config,
  onChange,
  previewLaneSelected,
  agentEnabled,
  embedded,
}: {
  config: AppConfig;
  onChange: (p: Partial<AppConfig>) => void;
  previewLaneSelected: boolean;
  agentEnabled: boolean;
  embedded?: boolean;
}) {
  if (!agentEnabled) return null;
  return (
    <div className={cn("flex flex-col gap-3", !embedded && "rounded-md border border-border bg-surface px-3 py-3")}>
      <FormRow
        label="Agent name"
        hint="The name you use when addressing the agent in speech."
        htmlFor={embedded ? "embedded-agent-name-input" : "inline-agent-name-input"}
        control={
          <Input
            id={embedded ? "embedded-agent-name-input" : "inline-agent-name-input"}
            type="text"
            className="w-[200px]"
            value={config.agent_name}
            placeholder="WordScript"
            onChange={(e) => onChange({ agent_name: e.target.value })}
          />
        }
      />
      <FormRow
        label="Model"
        hint={
          previewLaneSelected
            ? "Local Ollama model for intent + execution. Requires the local chat endpoint."
            : "Groq model for intent classification and instruction execution."
        }
        htmlFor={embedded ? "embedded-agent-model-select" : "inline-agent-model-select"}
        divider={false}
        control={
          <Select
            id={embedded ? "embedded-agent-model-select" : "inline-agent-model-select"}
            className="w-[300px]"
            value={previewLaneSelected ? config.local_agent_model : config.agent_model}
            onChange={(e) =>
              onChange(
                previewLaneSelected
                  ? { local_agent_model: e.target.value }
                  : { agent_model: e.target.value },
              )
            }
          >
            {(previewLaneSelected ? LOCAL_AGENT_MODEL_OPTIONS : AGENT_MODEL_OPTIONS).map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        }
      />
    </div>
  );
}