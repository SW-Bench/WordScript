import { memo, useState, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { HotkeyRecorder } from "./HotkeyRecorder";
import type { AppConfig, ProcessingMode, EnhanceSubMode, PromptTarget } from "../../types/ipc";

interface Props {
  config: AppConfig;
  onChange: (p: Partial<AppConfig>) => void;
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
    <>
      <div className="tab__title">Modes</div>

      <div className="form-section">Default processing mode</div>
      <div className="settings__rule-card" aria-label="Processing mode selector">
        <div className="settings__rule-stack">
          {(Object.keys(MODE_LABELS) as ProcessingMode[]).map((mode) => (
            <label key={mode} className="form-check">
              <input
                type="radio"
                name="processing_mode"
                value={mode}
                checked={selectedMode === mode}
                onChange={() => handleSetMode(mode)}
              />
              <span className="form-check__label">
                <strong>{processingModeLabel(mode)}</strong>
                <span className="form-dim" style={{ display: "block", marginTop: 2 }}>
                  {MODE_DESCRIPTIONS[mode]}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {selectedMode === "prompt_enhance" && (
        <>
          <div className="form-section">Enhance sub-mode</div>
          <div className="settings__rule-card" aria-label="Enhance sub-mode selector">
            <div className="settings__rule-stack">
              {(Object.keys(SUB_MODE_LABELS) as EnhanceSubMode[]).map((sub) => (
                <label key={sub} className="form-check">
                  <input
                    type="radio"
                    name="enhance_sub_mode"
                    value={sub}
                    checked={selectedSubMode === sub}
                    onChange={() => handleSetSubMode(sub)}
                  />
                  <span>
                    <strong>{sub === "enhance" ? "Enhance" : "Expand"}</strong>
                    <span className="form-dim" style={{ display: "block", marginTop: 2 }}>
                      {SUB_MODE_LABELS[sub]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-section">Prompt target</div>
          <div className="form-row">
            <label htmlFor="prompt-target-select">Target platform</label>
            <select
              id="prompt-target-select"
              value={selectedTarget}
              onChange={(e) => handleSetTarget(e.target.value as PromptTarget)}
            >
              {TARGET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <p className="form-dim">
            Optimize prompt syntax and idiom for the selected AI tool.
          </p>
        </>
      )}

      <div className="form-section">Auto-detection</div>
      <label className="form-check" style={{ marginBottom: 10 }}>
        <input
          type="checkbox"
          checked={autoDetectEnabled}
          onChange={(e) => handleToggleAutoDetect(e.target.checked)}
        />
        <span>Extend overlay with detected app and mode suggestion</span>
      </label>
      <p className="form-dim">
        When enabled, WordScript detects the active app and suggests a processing mode.
        You can confirm or ignore the suggestion directly in the overlay.
      </p>

      <div className="form-section">Per-app mapping</div>
      <div className="settings__rule-card" aria-label="Per-app mode mappings">
        {!hasMappings ? (
          <p className="form-dim">No custom app mappings yet. Add one below or use the overlay to auto-populate.</p>
        ) : (
          <div className="settings__rule-stack">
            {Object.entries(appMappings).map(([category, mode]) => (
              <div key={category} className="settings__rule-row">
                <span className="settings__rule-chip">{APP_CATEGORIES.find((c) => c.value === category)?.label ?? category}</span>
                <span className="settings__rule-arrow">&rarr;</span>
                <span className="settings__rule-chip">{processingModeLabel(mode)}</span>
                <button
                  className="btn btn--cancel settings__rule-remove"
                  type="button"
                  onClick={() => handleRemoveMapping(category)}
                  aria-label={`Remove ${category} mapping`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="settings__rule-add">
          <select
            value={newMappingCategory}
            onChange={(e) => setNewMappingCategory(e.target.value)}
            aria-label="App category"
          >
            {APP_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select
            value={newMappingMode}
            onChange={(e) => setNewMappingMode(e.target.value as ProcessingMode)}
            aria-label="Processing mode"
          >
            {(Object.keys(MODE_LABELS) as ProcessingMode[]).map((m) => (
              <option key={m} value={m}>{processingModeLabel(m)}</option>
            ))}
          </select>
          <button className="btn btn--cancel" type="button" onClick={handleAddMapping}>
            Add mapping
          </button>
        </div>
      </div>
      <p className="form-dim">
        Maps a detected app category to a processing mode when auto-detection is on.
        You can also add or remove entries manually here.
      </p>

      <div className="form-section">Hotkeys</div>
      <div className="form-row">
        <label>Mode picker</label>
        <HotkeyRecorder value={modePickerHotkey} onChange={handleModePickerHotkey} />
      </div>
      <div className="form-row">
        <label>Cycle mode</label>
        <HotkeyRecorder value={cycleModeHotkey} onChange={handleCycleModeHotkey} />
      </div>
      {(Object.keys(MODE_LABELS) as ProcessingMode[]).map((mode) => (
        <div key={mode} className="form-row">
          <label>{processingModeLabel(mode)}</label>
          <HotkeyRecorder
            value={(config[MODE_HOTKEY_FIELDS[mode]] as string | undefined) ?? ""}
            onChange={(value) => handlePerModeHotkey(mode, value)}
          />
        </div>
      ))}
      <p className="form-dim">
        Global hotkeys for quick mode switching. Mode picker opens the overlay selector.
        Cycle rotates through recently used modes. Per-mode keys jump directly.
      </p>
    </>
  );
});
