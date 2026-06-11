import { memo, useState, useCallback, type ReactNode } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import { HotkeyRecorder } from "./HotkeyRecorder";
import { FormCard, FormRow, Select, Toggle } from "../shell";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import type { AppConfig, ProcessingMode, EnhanceSubMode, PromptTarget } from "../../types/ipc";

interface Props {
  config: AppConfig;
  onChange: (p: Partial<AppConfig>) => void;
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-surface-strong px-2 py-0.5 text-[12px] font-medium text-fg-dim">
      {children}
    </span>
  );
}

function ModeRadioRow({
  name,
  value,
  checked,
  title,
  description,
  onSelect,
}: {
  name: string;
  value: string;
  checked: boolean;
  title: ReactNode;
  description: ReactNode;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 border-b border-border py-3 last:border-b-0",
        checked && "cursor-default",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-snug text-fg-dim">{description}</span>
      </span>
    </label>
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

export const ModesTab = memo(function ModesTab({ config, onChange }: Props) {
  const selectedMode: ProcessingMode = config.processing_mode ?? "cleanup";
  const selectedSubMode: EnhanceSubMode = config.enhance_sub_mode ?? "enhance";
  const selectedTarget: PromptTarget = config.enhance_target ?? "general";
  const autoDetectEnabled = config.auto_detect_mode ?? false;
  const appMappings: Record<string, ProcessingMode> = config.workspace_app_map ?? {};
  const modePickerHotkey = config.mode_picker_hotkey ?? "";
  const cycleModeHotkey = config.mode_cycle_hotkey ?? "";

  const [newMappingCategory, setNewMappingCategory] = useState("ide");
  const [newMappingMode, setNewMappingMode] = useState<ProcessingMode>("cleanup");

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

  return (
    <div className="flex flex-col gap-6">
      <FormCard title="Default processing mode" description="How dictation is transformed before it is inserted.">
        <div role="radiogroup" aria-label="Processing mode selector">
          {(Object.keys(MODE_LABELS) as ProcessingMode[]).map((mode) => (
            <ModeRadioRow
              key={mode}
              name="processing_mode"
              value={mode}
              checked={selectedMode === mode}
              title={processingModeLabel(mode)}
              description={MODE_DESCRIPTIONS[mode]}
              onSelect={() => handleSetMode(mode)}
            />
          ))}
        </div>
      </FormCard>

      {selectedMode === "prompt_enhance" && (
        <>
          <FormCard title="Enhance sub-mode" description="How aggressively raw dictation is restructured into a prompt.">
            <div role="radiogroup" aria-label="Enhance sub-mode selector">
              {(Object.keys(SUB_MODE_LABELS) as EnhanceSubMode[]).map((sub) => (
                <ModeRadioRow
                  key={sub}
                  name="enhance_sub_mode"
                  value={sub}
                  checked={selectedSubMode === sub}
                  title={sub === "enhance" ? "Enhance" : "Expand"}
                  description={SUB_MODE_LABELS[sub]}
                  onSelect={() => handleSetSubMode(sub)}
                />
              ))}
            </div>
          </FormCard>

          <FormCard title="Prompt target" description="Optimize prompt syntax and idiom for the selected AI tool.">
            <FormRow
              label="Target platform"
              htmlFor="prompt-target-select"
              divider={false}
              control={
                <Select
                  id="prompt-target-select"
                  className="w-[180px]"
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
          </FormCard>
        </>
      )}

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
        description="Global hotkeys for quick mode switching. The picker opens the overlay selector; cycle rotates recent modes; per-mode keys jump directly."
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
