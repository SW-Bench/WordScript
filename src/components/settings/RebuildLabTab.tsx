import { useMemo, useState } from "react";
import { useRuntimeLogs } from "../../hooks/useRuntimeLogs";
import { useV1Slice } from "../../hooks/useV1Slice";
import type { SliceStage } from "../../types/v1Slice";

const DEFAULT_TEXT = "wir shippen morgen die neue WordScript Version und brauchen klare release notes ohne Halluzinationen oder Fallback Chaos";

const TRIGGER_OPTIONS = [
  { value: "hold_to_talk", label: "Hold to talk" },
  { value: "tap_to_toggle", label: "Tap to toggle" },
  { value: "diagnostic_demo", label: "Diagnostics demo" },
] as const;

const PROFILE_OPTIONS = [
  { value: "developer", label: "Developer notes" },
  { value: "general", label: "General writing" },
  { value: "support", label: "Support reply" },
] as const;

const INSERT_TARGET_OPTIONS = [
  { value: "editor_preview", label: "Editor preview" },
  { value: "clipboard_preview", label: "Clipboard fallback preview" },
] as const;

function stageLabel(stage: SliceStage | undefined) {
  switch (stage) {
    case "idle":
      return "Idle";
    case "capturing":
      return "Capturing";
    case "processing":
      return "Processing";
    case "completed":
      return "Completed";
    case "error":
      return "Error";
    default:
      return "Unknown";
  }
}

function humanizeValue(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;

  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function optionLabel(options: ReadonlyArray<{ value: string; label: string }>, value: string | null | undefined, fallback: string) {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

interface AppliedRuleInfo {
  id: string;
  label: string;
  description: string;
}

interface RuntimeLogRuleHint {
  entry: string;
  rules: AppliedRuleInfo[];
  corrected: boolean | null;
}

function describeAppliedRule(rule: string): AppliedRuleInfo {
  if (rule.startsWith("dictionary:")) {
    return {
      id: rule,
      label: "Dictionary replacement applied",
      description: "A personal dictionary rule replaced a known phrase in the transcript.",
    };
  }

  if (rule.startsWith("snippet:")) {
    return {
      id: rule,
      label: "Snippet expansion applied",
      description: "A snippet trigger was expanded into its saved full text.",
    };
  }

  switch (rule) {
    case "trimmed_edges":
      return {
        id: rule,
        label: "Trimmed transcript edges",
        description: "Leading and trailing whitespace was removed before further processing.",
      };
    case "removed_fillers":
      return {
        id: rule,
        label: "Removed filler words",
        description: "Common spoken fillers such as ähm, äh or um were removed from the transcript.",
      };
    case "collapsed_whitespace":
      return {
        id: rule,
        label: "Collapsed repeated spaces",
        description: "Repeated whitespace was normalized to a single spacing pass.",
      };
    case "capitalized_sentence_start":
      return {
        id: rule,
        label: "Capitalized sentence start",
        description: "The transcript start was normalized to sentence case.",
      };
    case "added_terminal_punctuation":
      return {
        id: rule,
        label: "Added final punctuation",
        description: "A trailing period or equivalent closing punctuation was added.",
      };
    case "empty_transcription":
      return {
        id: rule,
        label: "No usable transcript",
        description: "The transcription stage returned no usable text.",
      };
    case "hallucination_filtered":
      return {
        id: rule,
        label: "Hallucination filtered",
        description: "The runtime rejected the transcript because it matched a known hallucination pattern.",
      };
    case "post_process_disabled":
      return {
        id: rule,
        label: "AI post-correction skipped",
        description: "Whisper output was kept as-is because AI post-correction was disabled.",
      };
    case "post_corrected":
      return {
        id: rule,
        label: "AI post-correction applied",
        description: "The correction model changed the transcript and the rewrite passed the runtime guardrails.",
      };
    case "post_correction_no_change":
      return {
        id: rule,
        label: "No AI rewrite needed",
        description: "The correction stage ran, but the resulting text stayed effectively the same.",
      };
    case "post_correction_failed_fallback":
      return {
        id: rule,
        label: "Correction request failed",
        description: "The correction model failed, so WordScript kept the original transcript.",
      };
    case "empty_correction_fallback":
      return {
        id: rule,
        label: "Empty correction rejected",
        description: "The correction model returned no text, so WordScript kept the original transcript.",
      };
    case "assistant_like_correction_rejected":
      return {
        id: rule,
        label: "Assistant-style rewrite rejected",
        description: "The correction output looked like an assistant response instead of a cleaned transcript.",
      };
    case "over_shortened_correction_rejected":
      return {
        id: rule,
        label: "Over-shortened rewrite rejected",
        description: "The correction output removed too much content compared with the original dictation.",
      };
    case "correction_guardrail_fallback":
      return {
        id: rule,
        label: "Guardrail kept original transcript",
        description: "The model returned a rewrite, but the runtime kept the safer original transcript because the output looked too risky or drifted too far.",
      };
    default:
      return {
        id: rule,
        label: humanizeValue(rule, "Applied rule"),
        description: "A runtime text-processing rule changed or validated the transcript.",
      };
  }
}

function describeCorrectionOutcome(corrected: boolean | null) {
  switch (corrected) {
    case true:
      return "AI rewrite applied in this pass";
    case false:
      return "Original transcript kept in this pass";
    default:
      return "Decoded transform rules";
  }
}

function parseRuntimeLogRuleHints(entries: string[]): RuntimeLogRuleHint[] {
  return entries
    .filter((entry) => entry.includes(" rules="))
    .slice(-5)
    .flatMap((entry) => {
      const rulesMatch = entry.match(/\brules=([^\s]*)/);

      if (!rulesMatch) return [];

      const ruleIds = rulesMatch[1]
        .split(",")
        .map((rule) => rule.trim())
        .filter(Boolean);

      if (!ruleIds.length) return [];

      const correctedMatch = entry.match(/\bcorrected=(true|false)/);

      return [
        {
          entry,
          rules: ruleIds.map(describeAppliedRule),
          corrected: correctedMatch ? correctedMatch[1] === "true" : null,
        },
      ];
    });
}

interface RebuildLabTabProps {
  isActive: boolean;
}

export function RebuildLabTab({ isActive }: RebuildLabTabProps) {
  const { status, result, error, isPending, refresh, startCapture, completeCapture, reset } = useV1Slice();
  const runtimeLogs = useRuntimeLogs(isActive);
  const [trigger, setTrigger] = useState("hold_to_talk");
  const [profile, setProfile] = useState("developer");
  const [insertTarget, setInsertTarget] = useState("editor_preview");
  const [rawText, setRawText] = useState(DEFAULT_TEXT);
  const [editorValue, setEditorValue] = useState("");

  const capabilityText = useMemo(() => {
    if (!status) return [];
    return [
      status.capabilities.cloud_transcription ? "Cloud path ready" : "Cloud path pending",
      status.capabilities.typed_contracts ? "Typed contracts active" : "Typed contracts pending",
      status.capabilities.insertion_fallback ? "Fallback path ready" : "Fallback missing",
      status.capabilities.rebuild_lab ? "Diagnostics unlocked" : "Diagnostics pending",
    ];
  }, [status]);
  const transcriptRules = useMemo(
    () => (result?.transcript.applied_rules ?? []).map(describeAppliedRule),
    [result?.transcript.applied_rules],
  );
  const runtimeRuleHints = useMemo(
    () => parseRuntimeLogRuleHints(runtimeLogs.entries),
    [runtimeLogs.entries],
  );

  const stage = status?.stage;
  const runtimeLogText = runtimeLogs.entries.length
    ? runtimeLogs.entries.join("\n")
    : "No runtime logs yet.";
  const canStartSession = !isPending && stage !== "capturing" && stage !== "processing";
  const canCompleteSession = !isPending && stage === "capturing";

  const appendPreview = (text: string) => {
    setEditorValue((current) => (current ? `${current}\n${text}` : text));
  };

  const handleStart = async () => {
    await startCapture({ trigger });
  };

  const handleComplete = async () => {
    const next = await completeCapture({
      raw_text: rawText,
      insert_target: insertTarget,
      profile,
    });

    if (next) {
      appendPreview(next.transcript.final_text);
    }
  };

  const handleRunDemo = async () => {
    await reset();
    const started = await startCapture({ trigger });
    if (!started) return;

    const next = await completeCapture({
      raw_text: rawText,
      insert_target: insertTarget,
      profile,
    });

    if (next) {
      appendPreview(next.transcript.final_text);
    }
  };

  const handleReset = async () => {
    await reset();
    setEditorValue("");
  };

  const handleLoadSample = () => {
    setRawText(DEFAULT_TEXT);
  };

  return (
    <>
      <div className="tab__title">Diagnostics</div>
      <p className="form-dim" style={{ marginTop: 0 }}>
        Diagnostics is the native control room for capture, transform, recovery and insert. Use it to verify the live runtime path without leaving the settings shell.
      </p>

      <div className="settings__rule-toolbar settings__rule-toolbar--top">
        <div className="settings__rule-toolbar-copy">
          <strong>Runtime checks</strong>
          <span>Run a full capture-to-insert check, inspect the current native state and confirm which fallback path the runtime will use right now.</span>
        </div>
        <div className="settings__rule-toolbar-buttons">
          <button className="btn btn--cancel" type="button" onClick={() => void refresh()}>
            Refresh status
          </button>
          <button className="btn btn--save" type="button" onClick={() => void handleRunDemo()} disabled={isPending}>
            Run end-to-end check
          </button>
        </div>
      </div>

      <div className="form-section">Runtime Snapshot</div>
      <div className="form-row">
        <label>Stage</label>
        <div className="provider-status">
          <span className={`provider-status__dot${status?.stage === "completed" ? " provider-status__dot--ok" : ""}`} />
          <span>{stageLabel(status?.stage)}</span>
        </div>
      </div>
      <div className="form-row">
        <label>Active session</label>
        <div className="provider-status"><span>{status?.session_id ?? "No session armed"}</span></div>
      </div>
      <div className="form-row">
        <label>Session source</label>
        <div className="provider-status"><span>{optionLabel(TRIGGER_OPTIONS, status?.active_trigger, humanizeValue(status?.active_trigger, "Not armed"))}</span></div>
      </div>
      <div className="form-row">
        <label>Transcription path</label>
        <div className="provider-status"><span>{humanizeValue(status?.preferred_provider, "Cloud Fast")}</span></div>
      </div>
      <div className="form-row">
        <label>Pipeline</label>
        <div className="provider-status"><span>{humanizeValue(status?.architecture_mode, "Native Runtime Slice")}</span></div>
      </div>
      {isPending && <p className="form-dim">Refreshing native runtime status…</p>}

      <div className="form-section">Coverage</div>
      <div className="settings__about-card">
        <div className="settings__rule-chip-row">
          {capabilityText.map((item) => (
            <span key={item} className="settings__rule-chip">{item}</span>
          ))}
        </div>
        <div className="settings__rule-issues">
          {(status?.next_milestones ?? []).map((item) => (
            <div key={item} className="settings__rule-issue settings__rule-issue--warning">
              <strong>Next</strong>
              <span>{item}</span>
            </div>
          ))}
        </div>
        {!status?.next_milestones?.length && (
          <p className="form-dim" style={{ margin: "12px 0 0" }}>
            No pending milestones were reported by the runtime snapshot.
          </p>
        )}
      </div>

      <div className="form-section">Run a Diagnostic</div>
      <div className="form-row">
        <label>Session source</label>
        <select value={trigger} onChange={(event) => setTrigger(event.target.value)}>
          {TRIGGER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label>Text profile</label>
        <select value={profile} onChange={(event) => setProfile(event.target.value)}>
          {PROFILE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label>Preview target</label>
        <select value={insertTarget} onChange={(event) => setInsertTarget(event.target.value)}>
          {INSERT_TARGET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="form-section">Sample Dictation</div>
      <textarea className="form-textarea" value={rawText} onChange={(event) => setRawText(event.target.value)} rows={5} />
      <div className="settings__provider-actions">
        <button className="btn btn--cancel" type="button" onClick={handleLoadSample}>
          Load sample text
        </button>
        <button className="btn btn--cancel" type="button" onClick={() => void handleStart()} disabled={!canStartSession}>
          Start capture
        </button>
        <button className="btn btn--cancel" type="button" onClick={() => void handleComplete()} disabled={!canCompleteSession}>
          Complete step
        </button>
        <button className="btn btn--save" type="button" onClick={() => void handleRunDemo()} disabled={isPending}>
          Run end-to-end
        </button>
        <button className="btn btn--cancel" type="button" onClick={() => void handleReset()} disabled={isPending}>
          Reset diagnostics
        </button>
      </div>
      <p className="form-dim">
        Start capture opens a fresh native session. Complete step resolves the current session with the sample text below. End-to-end does both in one go and appends the final insert preview.
      </p>

      <div className="form-section">Transcript Output</div>
      <div className="settings__about-card">
        <strong className="settings__about-title">Last transcript</strong>
        <p className="form-dim" style={{ margin: 0 }}>
          {result?.transcript.final_text ?? status?.last_transcript ?? "No transcript yet."}
        </p>
        <div className="settings__rule-chip-row">
          {transcriptRules.map((rule) => (
            <span key={rule.id} className="settings__rule-chip" title={rule.id}>{rule.label}</span>
          ))}
        </div>
        {transcriptRules.length > 0 && (
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {transcriptRules.map((rule) => (
              <div key={rule.id}>
                <strong>{rule.label}</strong>
                <p className="form-dim" style={{ margin: "4px 0 0" }}>
                  {rule.description}
                </p>
              </div>
            ))}
          </div>
        )}
        <div className="form-row" style={{ marginTop: 12 }}>
          <label>Profile used</label>
          <div className="provider-status"><span>{optionLabel(PROFILE_OPTIONS, result?.transcript.profile ?? profile, humanizeValue(result?.transcript.profile ?? profile, "Developer"))}</span></div>
        </div>
      </div>

      <div className="form-section">Insertion Preview</div>
      <div className="settings__about-card">
        <p className="form-dim" style={{ marginTop: 0 }}>
          This editor mirrors the current insert plan. It is diagnostic, but it already reflects the real fallback contract coming back from the native runtime.
        </p>
        <textarea className="form-textarea" value={editorValue} onChange={(event) => setEditorValue(event.target.value)} rows={8} placeholder="No preview text yet." />
        <div className="form-row">
          <label>Target</label>
          <div className="provider-status"><span>{optionLabel(INSERT_TARGET_OPTIONS, result?.insertion.target ?? insertTarget, humanizeValue(result?.insertion.target ?? insertTarget, "Editor preview"))}</span></div>
        </div>
        <div className="form-row">
          <label>Insert mode</label>
          <div className="provider-status"><span>{humanizeValue(result?.insertion.mode, "Pending")}</span></div>
        </div>
        <div className="form-row">
          <label>Fallback path</label>
          <div className="provider-status"><span>{humanizeValue(result?.insertion.fallback, "Clipboard fallback planned")}</span></div>
        </div>
      </div>

      <div className="form-section">Runtime Logs</div>
      <div className="settings__about-card">
        <p className="form-dim" style={{ marginTop: 0 }}>
          Structured native logs stay enabled and are buffered here for fast inspection while the runtime is active.
        </p>
        <div className="settings__provider-actions">
          <button className="btn btn--cancel" type="button" onClick={() => void runtimeLogs.refresh()} disabled={runtimeLogs.isLoading}>
            Refresh logs
          </button>
          <button className="btn btn--cancel" type="button" onClick={() => void runtimeLogs.clear()} disabled={runtimeLogs.isLoading || !runtimeLogs.entries.length}>
            Clear logs
          </button>
        </div>
        <textarea className="form-textarea" value={runtimeLogText} readOnly rows={10} />
        {runtimeRuleHints.length > 0 && (
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <div>
              <strong className="settings__about-title">Decoded transform rules</strong>
              <p className="form-dim" style={{ margin: "4px 0 0" }}>
                Raw logs stay unchanged in the textarea above. Known transform rules from recent entries are translated here for faster reading.
              </p>
            </div>
            {runtimeRuleHints.map((hint, index) => (
              <div key={`${hint.entry}-${index}`}>
                <strong>{describeCorrectionOutcome(hint.corrected)}</strong>
                <p className="form-dim" style={{ margin: "4px 0 0" }}>
                  {hint.entry}
                </p>
                <div className="settings__rule-chip-row" style={{ marginTop: 8 }}>
                  {hint.rules.map((rule) => (
                    <span key={`${hint.entry}:${rule.id}`} className="settings__rule-chip" title={rule.id}>{rule.label}</span>
                  ))}
                </div>
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  {hint.rules.map((rule) => (
                    <div key={`${hint.entry}:${rule.id}:details`}>
                      <strong>{rule.label}</strong>
                      <p className="form-dim" style={{ margin: "4px 0 0" }}>
                        {rule.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className={`form-dim${runtimeLogs.error ? " form-dim--error" : ""}`}>
          {runtimeLogs.error ?? `${runtimeLogs.entries.length} runtime log entries buffered.`}
        </p>
      </div>

      {(error || status?.last_error) && (
        <p className="form-dim form-dim--error">
          {error ?? status?.last_error}
        </p>
      )}
    </>
  );
}