import { useEffect, useMemo, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { useTranscriptionHistory } from "../../hooks/useTranscriptionHistory";
import { useRuntimeLogs } from "../../hooks/useRuntimeLogs";
import { useV1Slice } from "../../hooks/useV1Slice";
import type { AppConfig } from "../../types/ipc";
import type {
  TranscriptionHistoryEntry,
  TranscriptionHistoryQuery,
  TranscriptionHistorySource,
  TranscriptionHistoryStatus,
} from "../../types/history";
import type { NativeClipboardRestoreStatus, NativeInsertRecoveryAction } from "../../types/nativeInsertion";
import type {
  SlicePipelineState,
  SlicePipelineStep,
  SlicePipelineStepStatus,
  SliceRuntimeContract,
  SliceStage,
} from "../../types/v1Slice";

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

const HISTORY_PROVIDER_OPTIONS = [
  { value: "all", label: "All providers" },
  { value: "groq", label: "Groq" },
  { value: "local_preview", label: "Local preview" },
] as const;

const HISTORY_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "completed", label: "Completed" },
  { value: "empty", label: "Empty" },
  { value: "failed", label: "Failed" },
] as const;

const HISTORY_SOURCE_OPTIONS = [
  { value: "all", label: "All sources" },
  { value: "native_pipeline", label: "Native pipeline" },
  { value: "retry", label: "Retry only" },
] as const;

const HISTORY_VIEW_LIMIT_OPTIONS = [8, 25, 50] as const;
const HISTORY_LIMIT_OPTIONS = [50, 100, 200, 500, 1000] as const;
const HISTORY_RETENTION_OPTIONS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
  { value: 0, label: "Keep indefinitely" },
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

function pipelineStepLabel(step: SlicePipelineStep) {
  switch (step) {
    case "capture":
      return "Capture";
    case "provider":
      return "Provider";
    case "transform":
      return "Transform";
    case "insert":
      return "Insert";
    default:
      return "Pipeline step";
  }
}

function pipelineStateLabel(state: SlicePipelineState) {
  switch (state) {
    case "idle":
      return "Idle";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
    default:
      return "Unknown";
  }
}

function pipelineDurationLabel(durationMs: number | null) {
  return durationMs === null ? "Duration pending" : `${durationMs} ms`;
}

function pipelineTone(step: SlicePipelineStepStatus) {
  return step.state === "failed" ? " settings__rule-issue--warning" : "";
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

function historyStatusLabel(status: TranscriptionHistoryStatus) {
  switch (status) {
    case "completed":
      return "Completed";
    case "empty":
      return "Empty";
    case "failed":
    default:
      return "Failed";
  }
}

function historySourceLabel(source: TranscriptionHistorySource) {
  switch (source) {
    case "retry":
      return "Retry run";
    case "native_pipeline":
    default:
      return "Native pipeline";
  }
}

function historyRecoveryActionLabel(action: NativeInsertRecoveryAction | null | undefined) {
  switch (action) {
    case "none":
      return "No recovery action needed";
    case "manual_paste":
      return "Manual paste";
    case "use_scratchpad":
      return "Use scratchpad";
    default:
      return null;
  }
}

function historyClipboardRestoreLabel(status: NativeClipboardRestoreStatus | null | undefined) {
  switch (status) {
    case "scheduled":
      return "Previous clipboard restore scheduled";
    case "skipped_no_previous_clipboard":
      return "No previous clipboard to restore";
    case "not_attempted":
      return "Clipboard restore not attempted";
    default:
      return null;
  }
}

function localPromptStrengthLabel(value: string | null | undefined) {
  switch (value) {
    case "off":
      return "Prompt bias off";
    case "profile":
      return "Prompt bias profile";
    case "profile_and_terms":
      return "Prompt bias profile + terms";
    default:
      return null;
  }
}

function runtimeProviderLabel(runtimeContract: SliceRuntimeContract | null | undefined, fallback: string | null | undefined) {
  if (runtimeContract?.local_preview?.provider_profile) {
    return humanizeValue(runtimeContract.local_preview.provider_profile, "Local preview");
  }

  return humanizeValue(fallback, "Cloud Fast");
}

function providerReadinessLabel(runtimeContract: SliceRuntimeContract | null | undefined) {
  if (!runtimeContract) {
    return "Unknown";
  }

  return runtimeContract.provider_status.ready ? "Ready" : "Needs attention";
}

function captureRuntimeLabel(runtimeContract: SliceRuntimeContract | null | undefined) {
  const capture = runtimeContract?.capture_status;

  if (!capture) {
    return "Unknown";
  }
  if (capture.is_recording && capture.paused) {
    return "Recording paused";
  }
  if (capture.is_recording) {
    return capture.muted ? "Recording muted" : "Recording live";
  }

  return "Idle";
}

function localSetupReadinessLabel(readiness: string | null | undefined) {
  switch (readiness) {
    case "ready":
      return "Local setup ready";
    case "setup_required":
      return "Local setup required";
    default:
      return "Local setup unknown";
  }
}

function describeRuntimeDraftDifferences(
  runtimeContract: SliceRuntimeContract | null | undefined,
  config: AppConfig,
): string[] {
  if (!runtimeContract) {
    return [];
  }

  const differences: string[] = [];
  if (runtimeContract.provider !== config.provider) {
    differences.push(
      `Provider runtime ${humanizeValue(runtimeContract.provider, "unknown")} differs from unsaved draft ${humanizeValue(config.provider, "unknown")}.`,
    );
  }

  const runtimeLocal = runtimeContract.local_preview;
  if (!runtimeLocal || config.provider !== "local_preview") {
    return differences;
  }

  if (runtimeLocal.provider_profile !== config.local_profile) {
    differences.push(`Profile runtime ${runtimeLocal.provider_profile} differs from unsaved draft ${config.local_profile}.`);
  }
  if (runtimeLocal.prompt_strength !== config.local_prompt_strength) {
    differences.push(
      `Prompt bias runtime ${localPromptStrengthLabel(runtimeLocal.prompt_strength) ?? runtimeLocal.prompt_strength} differs from unsaved draft ${localPromptStrengthLabel(config.local_prompt_strength) ?? config.local_prompt_strength}.`,
    );
  }
  if (runtimeLocal.prompt_carry !== config.local_prompt_carry) {
    differences.push(
      `Prompt carry runtime ${runtimeLocal.prompt_carry ? "enabled" : "disabled"} differs from unsaved draft ${config.local_prompt_carry ? "enabled" : "disabled"}.`,
    );
  }
  if (runtimeLocal.beam_size !== config.local_beam_size) {
    differences.push(`Beam size runtime ${runtimeLocal.beam_size} differs from unsaved draft ${config.local_beam_size}.`);
  }
  if (runtimeLocal.best_of !== config.local_best_of) {
    differences.push(`Best of runtime ${runtimeLocal.best_of} differs from unsaved draft ${config.local_best_of}.`);
  }

  return differences;
}

function formatHistoryTimestamp(createdAtMs: number) {
  return new Date(createdAtMs).toISOString().slice(0, 16).replace("T", " ");
}

function canRetryHistoryEntry(entry: TranscriptionHistoryEntry) {
  return Boolean(entry.raw_transcript?.trim());
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
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
}

export function RebuildLabTab({ isActive, config, onChange }: RebuildLabTabProps) {
  const { status, result, error, isPending, refresh, startCapture, completeCapture, reset } = useV1Slice();
  const transcriptionHistory = useTranscriptionHistory(isActive);
  const runtimeLogs = useRuntimeLogs(isActive);
  const [trigger, setTrigger] = useState("hold_to_talk");
  const [profile, setProfile] = useState("developer");
  const [insertTarget, setInsertTarget] = useState("editor_preview");
  const [rawText, setRawText] = useState(DEFAULT_TEXT);
  const [editorValue, setEditorValue] = useState("");
  const [historyProviderFilter, setHistoryProviderFilter] = useState("all");
  const [historyProfileFilter, setHistoryProfileFilter] = useState("all");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [historySourceFilter, setHistorySourceFilter] = useState("all");
  const [historySearch, setHistorySearch] = useState("");
  const [historyErrorsOnly, setHistoryErrorsOnly] = useState(false);
  const [historyViewLimit, setHistoryViewLimit] = useState<number>(8);
  const [historyFeedback, setHistoryFeedback] = useState<string | null>(null);

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
  const historyQuery = useMemo<TranscriptionHistoryQuery>(() => ({
    limit: historyViewLimit,
    provider: historyProviderFilter === "all" ? undefined : historyProviderFilter,
    active_profile: historyProfileFilter === "all"
      ? undefined
      : config.text_profiles.find((profileOption) => profileOption.id === historyProfileFilter)?.label,
    status: historyStatusFilter === "all" ? undefined : historyStatusFilter as TranscriptionHistoryStatus,
    source: historySourceFilter === "all" ? undefined : historySourceFilter as TranscriptionHistorySource,
    search: historySearch,
    include_errors_only: historyErrorsOnly,
  }), [config.text_profiles, historyErrorsOnly, historyProfileFilter, historyProviderFilter, historySearch, historySourceFilter, historyStatusFilter, historyViewLimit]);
  const visibleHistoryEntries = transcriptionHistory.entries;
  const retentionLabel = HISTORY_RETENTION_OPTIONS.find((option) => option.value === config.history_retention_days)?.label
    ?? `${config.history_retention_days} days`;
  const runtimeContract = status?.runtime_contract ?? null;
  const runtimeLocalPreview = runtimeContract?.local_preview ?? null;
  const runtimeProviderStatus = runtimeContract?.provider_status ?? null;
  const runtimeCaptureStatus = runtimeContract?.capture_status ?? null;
  const runtimeLocalSetup = runtimeProviderStatus?.local_setup ?? null;
  const runtimeDraftDifferences = describeRuntimeDraftDifferences(runtimeContract, config);

  const stage = status?.stage;
  const runtimeLogText = runtimeLogs.entries.length
    ? runtimeLogs.entries.join("\n")
    : "No runtime logs yet.";
  const canStartSession = !isPending && stage !== "capturing" && stage !== "processing";
  const canCompleteSession = !isPending && stage === "capturing";

  useEffect(() => {
    if (!isActive) return;
    void transcriptionHistory.refresh(historyQuery);
  }, [historyQuery, isActive, transcriptionHistory.refresh]);

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

  const handleExportHistory = async () => {
    const target = await save({
      title: "Export transcription history",
      defaultPath: "wordscript-transcription-history.json",
      filters: [{ name: "WordScript history", extensions: ["json"] }],
    });
    if (!target) return;

    const response = await transcriptionHistory.exportEntries(target, historyQuery);
    if (response) {
      setHistoryFeedback(`Exported ${response.exported_count} history entries to ${response.path.split(/[\\/]/).pop() ?? response.path}.`);
    }
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
        <div className="provider-status"><span>{runtimeProviderLabel(runtimeContract, status?.preferred_provider)}</span></div>
      </div>
      <div className="form-row">
        <label>Runtime model</label>
        <div className="provider-status"><span>{runtimeContract?.model ?? "No runtime model loaded"}</span></div>
      </div>
      <div className="form-row">
        <label>Provider readiness</label>
        <div className="provider-status"><span>{providerReadinessLabel(runtimeContract)}</span></div>
      </div>
      <div className="form-row">
        <label>Capture runtime</label>
        <div className="provider-status"><span>{captureRuntimeLabel(runtimeContract)}</span></div>
      </div>
      <div className="form-row">
        <label>Capture device</label>
        <div className="provider-status"><span>{runtimeCaptureStatus?.device_name ?? "No active device"}</span></div>
      </div>
      <div className="form-row">
        <label>Pipeline</label>
        <div className="provider-status"><span>{humanizeValue(status?.architecture_mode, "Native Runtime Slice")}</span></div>
      </div>
      {!!status?.pipeline.length && (
        <div className="settings__rule-issues" style={{ marginTop: 14 }}>
          {status.pipeline.map((step) => (
            <div key={step.step} className={`settings__rule-issue${pipelineTone(step)}`}>
              <strong>{`${pipelineStepLabel(step.step)} · ${pipelineStateLabel(step.state)}`}</strong>
              <span>{pipelineDurationLabel(step.duration_ms)}</span>
              {step.error_code && <span>{`Error code: ${step.error_code}`}</span>}
              {step.detail && <span>{step.detail}</span>}
            </div>
          ))}
        </div>
      )}
      {isPending && <p className="form-dim">Refreshing native runtime status…</p>}

      {(runtimeLocalPreview || config.provider === "local_preview") && (
        <>
          <div className="form-section">Local STT Contract</div>
          <div className="settings__about-card">
            <p className="form-dim" style={{ marginTop: 0 }}>
              This contract comes from the native runtime snapshot. Unsaved changes in this window do not change the running contract until you save settings.
            </p>
            {runtimeLocalPreview ? (
              <>
                <div className="settings__rule-chip-row">
                  <span className="settings__rule-chip">{runtimeLocalPreview.provider_profile}</span>
                  <span className="settings__rule-chip">{localPromptStrengthLabel(runtimeLocalPreview.prompt_strength) ?? "Prompt bias unknown"}</span>
                  <span className="settings__rule-chip">{runtimeLocalPreview.prompt_carry ? "Carry initial prompt" : "Do not carry prompt"}</span>
                  <span className="settings__rule-chip">{`Beam ${runtimeLocalPreview.beam_size}`}</span>
                  <span className="settings__rule-chip">{`Best of ${runtimeLocalPreview.best_of}`}</span>
                </div>
                <p className="form-dim" style={{ marginBottom: runtimeDraftDifferences.length ? 12 : 0 }}>
                  These values are currently active in the native runtime and flow into local preview requests and transcription history.
                </p>
                {runtimeLocalSetup && (
                  <>
                    <div className="settings__rule-chip-row">
                      <span className="settings__rule-chip">{localSetupReadinessLabel(runtimeLocalSetup.readiness)}</span>
                      <span className="settings__rule-chip">{runtimeLocalSetup.runner_ready ? "Runner ready" : "Runner missing"}</span>
                      <span className="settings__rule-chip">{runtimeLocalSetup.model_ready ? "Model ready" : "Model missing"}</span>
                    </div>
                    <div className="settings__rule-issues" style={{ marginTop: 12 }}>
                      <div className={`settings__rule-issue${runtimeProviderStatus?.ready ? "" : " settings__rule-issue--warning"}`}>
                        <strong>Resolved runner</strong>
                        <span>{runtimeLocalSetup.resolved_runner ?? "Not resolved"}</span>
                      </div>
                      <div className={`settings__rule-issue${runtimeProviderStatus?.ready ? "" : " settings__rule-issue--warning"}`}>
                        <strong>Resolved model</strong>
                        <span>{runtimeLocalSetup.resolved_model ?? "Not resolved"}</span>
                      </div>
                      {runtimeLocalSetup.issue_code && (
                        <div className="settings__rule-issue settings__rule-issue--warning">
                          <strong>Provider issue</strong>
                          <span>{humanizeValue(runtimeLocalSetup.issue_code, runtimeLocalSetup.issue_code)}</span>
                        </div>
                      )}
                      <div className={`settings__rule-issue${runtimeProviderStatus?.ready ? "" : " settings__rule-issue--warning"}`}>
                        <strong>Setup guidance</strong>
                        <span>{runtimeLocalSetup.guidance}</span>
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              <p className="form-dim" style={{ marginBottom: runtimeDraftDifferences.length ? 12 : 0 }}>
                The native runtime is not currently using local preview.
              </p>
            )}
            {runtimeDraftDifferences.length > 0 && (
              <div className="settings__rule-issues">
                {runtimeDraftDifferences.map((difference) => (
                  <div key={difference} className="settings__rule-issue settings__rule-issue--warning">
                    <strong>Unsaved draft differs from runtime</strong>
                    <span>{difference}</span>
                  </div>
                ))}
              </div>
            )}
            {config.provider === "local_preview" && (
              <>
                <strong className="settings__about-title" style={{ display: "block", marginTop: 12 }}>Draft in this window</strong>
                <div className="settings__rule-chip-row" style={{ marginTop: 8 }}>
                  <span className="settings__rule-chip">{config.local_profile}</span>
                  <span className="settings__rule-chip">{localPromptStrengthLabel(config.local_prompt_strength) ?? "Prompt bias unknown"}</span>
                  <span className="settings__rule-chip">{config.local_prompt_carry ? "Carry initial prompt" : "Do not carry prompt"}</span>
                  <span className="settings__rule-chip">{`Beam ${config.local_beam_size}`}</span>
                  <span className="settings__rule-chip">{`Best of ${config.local_best_of}`}</span>
                </div>
              </>
            )}
          </div>
        </>
      )}

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
        <strong className="settings__about-title">Current diagnostic transcript</strong>
        <p className="form-dim" style={{ margin: 0 }}>
          This preview belongs to the active diagnostics lane in this window. It is not the recovery scratchpad from Input and not the persisted history store below.
        </p>
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

      <div className="form-section">Transcription History</div>
      <div className="settings__about-card">
        <p className="form-dim" style={{ marginTop: 0 }}>
          History is stored natively and survives the diagnostics UI. Retry re-runs transform and insertion from the stored raw transcript instead of only restoring clipboard state, so this is a separate store from Input recovery.
        </p>
        <div className="form-row">
          <label>History store</label>
          <div className="provider-status provider-status--stacked">
            <span className={`provider-status__dot${transcriptionHistory.storagePath ? " provider-status__dot--ok" : ""}`} />
            <div>
              <strong>Persistent transcript log</strong>
              <span className="provider-status__path">{transcriptionHistory.storagePath ?? "Loading native history path"}</span>
            </div>
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="history-provider-filter">Provider filter</label>
          <select id="history-provider-filter" aria-label="History provider filter" value={historyProviderFilter} onChange={(event) => setHistoryProviderFilter(event.target.value)}>
            {HISTORY_PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="history-status-filter">Status filter</label>
          <select id="history-status-filter" aria-label="History status filter" value={historyStatusFilter} onChange={(event) => setHistoryStatusFilter(event.target.value)}>
            {HISTORY_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="history-profile-filter">Profile filter</label>
          <select id="history-profile-filter" aria-label="History profile filter" value={historyProfileFilter} onChange={(event) => setHistoryProfileFilter(event.target.value)}>
            <option value="all">All profiles</option>
            {config.text_profiles.map((profileOption) => (
              <option key={profileOption.id} value={profileOption.id}>{profileOption.label}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="history-source-filter">Source filter</label>
          <select id="history-source-filter" aria-label="History source filter" value={historySourceFilter} onChange={(event) => setHistorySourceFilter(event.target.value)}>
            {HISTORY_SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="history-search">Search history</label>
          <input
            id="history-search"
            aria-label="Search history"
            type="search"
            value={historySearch}
            placeholder="Find transcript text, recovery notes, errors or models"
            onChange={(event) => setHistorySearch(event.target.value)}
          />
        </div>
        <div className="form-row">
          <label htmlFor="history-view-limit">Visible entries</label>
          <select id="history-view-limit" aria-label="History visible entries" value={historyViewLimit} onChange={(event) => setHistoryViewLimit(Number(event.target.value))}>
            {HISTORY_VIEW_LIMIT_OPTIONS.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="history-errors-only">Only failed entries</label>
          <input
            id="history-errors-only"
            aria-label="Only failed history entries"
            type="checkbox"
            checked={historyErrorsOnly}
            onChange={(event) => setHistoryErrorsOnly(event.target.checked)}
          />
        </div>
        <div className="form-section">History Policy</div>
        <div className="form-row">
          <label htmlFor="history-limit">Stored entries</label>
          <select id="history-limit" aria-label="Stored history entries" value={config.history_limit} onChange={(event) => onChange({ history_limit: Number(event.target.value) })}>
            {HISTORY_LIMIT_OPTIONS.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="history-retention-days">Retention window</label>
          <select id="history-retention-days" aria-label="History retention window" value={config.history_retention_days} onChange={(event) => onChange({ history_retention_days: Number(event.target.value) })}>
            {HISTORY_RETENTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <p className="form-dim">
          Native retention currently keeps up to {config.history_limit} entries and prunes anything older than {retentionLabel.toLowerCase()}. Save settings to apply policy changes to the runtime store.
        </p>
        <div className="settings__provider-actions">
          <button className="btn btn--cancel" type="button" onClick={() => void transcriptionHistory.refresh(historyQuery)} disabled={transcriptionHistory.isLoading}>
            Refresh history
          </button>
          <button className="btn btn--cancel" type="button" onClick={() => void handleExportHistory()} disabled={transcriptionHistory.isLoading || !visibleHistoryEntries.length}>
            Export history
          </button>
          <button className="btn btn--cancel" type="button" onClick={() => void transcriptionHistory.clear()} disabled={transcriptionHistory.isLoading || !transcriptionHistory.entries.length}>
            Clear history
          </button>
        </div>
        {visibleHistoryEntries.length > 0 ? (
          <div style={{ display: "grid", gap: 12 }}>
            {visibleHistoryEntries.map((entry) => (
              <div key={entry.id} className="settings__rule-issue">
                <strong>{historyStatusLabel(entry.status)} · {humanizeValue(entry.provider, "Provider")}</strong>
                <p className="form-dim" style={{ margin: "4px 0 0" }}>
                  {formatHistoryTimestamp(entry.created_at_ms)} · {historySourceLabel(entry.source)}
                  {entry.retry_of ? ` · retry of ${entry.retry_of}` : ""}
                </p>
                <div className="settings__rule-chip-row" style={{ marginTop: 8 }}>
                  <span className="settings__rule-chip">{entry.model ?? "default model"}</span>
                  {entry.provider_profile && <span className="settings__rule-chip">{entry.provider_profile}</span>}
                  {entry.local_prompt_strength && (
                    <span className="settings__rule-chip">
                      {localPromptStrengthLabel(entry.local_prompt_strength) ?? entry.local_prompt_strength}
                    </span>
                  )}
                  {entry.local_prompt_carry !== null && entry.local_prompt_carry !== undefined && (
                    <span className="settings__rule-chip">
                      {entry.local_prompt_carry ? "Carry initial prompt" : "Do not carry prompt"}
                    </span>
                  )}
                  {entry.local_beam_size !== null && entry.local_beam_size !== undefined && (
                    <span className="settings__rule-chip">{`Beam ${entry.local_beam_size}`}</span>
                  )}
                  {entry.local_best_of !== null && entry.local_best_of !== undefined && (
                    <span className="settings__rule-chip">{`Best of ${entry.local_best_of}`}</span>
                  )}
                  {entry.insert_mode && <span className="settings__rule-chip">{humanizeValue(entry.insert_mode, "Insert mode")}</span>}
                  {entry.active_driver && <span className="settings__rule-chip">{humanizeValue(entry.active_driver, "Driver")}</span>}
                  {entry.recovery_action && <span className="settings__rule-chip">{historyRecoveryActionLabel(entry.recovery_action)}</span>}
                  {entry.clipboard_restore && <span className="settings__rule-chip">{historyClipboardRestoreLabel(entry.clipboard_restore)}</span>}
                  <span className="settings__rule-chip">{entry.active_profile ?? "Global rules"}</span>
                </div>
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  <div>
                    <strong>Raw transcript</strong>
                    <p className="form-dim" style={{ margin: "4px 0 0" }}>
                      {entry.raw_transcript ?? "No raw transcript stored."}
                    </p>
                  </div>
                  <div>
                    <strong>Final transcript</strong>
                    <p className="form-dim" style={{ margin: "4px 0 0" }}>
                      {entry.transformed_transcript ?? entry.error ?? "No transformed transcript stored."}
                    </p>
                  </div>
                  {(entry.recovery_message || entry.fallback_reason || entry.clipboard_restore) && (
                    <div>
                      <strong>Recovery</strong>
                      <p className="form-dim" style={{ margin: "4px 0 0" }}>
                        {entry.recovery_message ?? entry.fallback_reason ?? "No recovery guidance stored."}
                      </p>
                      {entry.clipboard_restore && (
                        <p className="form-dim" style={{ margin: "4px 0 0" }}>
                          {historyClipboardRestoreLabel(entry.clipboard_restore)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="settings__provider-actions settings__provider-actions--compact">
                  <button
                    className="btn btn--cancel"
                    type="button"
                    aria-label={`Retry history entry ${entry.id}`}
                    disabled={transcriptionHistory.isLoading || !canRetryHistoryEntry(entry)}
                    onClick={() => void transcriptionHistory.retry(entry.id)}
                  >
                    Retry
                  </button>
                  <button
                    className="btn btn--cancel"
                    type="button"
                    aria-label={`Delete history entry ${entry.id}`}
                    disabled={transcriptionHistory.isLoading}
                    onClick={() => void transcriptionHistory.remove(entry.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="form-dim">No history entries match the current filters.</p>
        )}
        <p className={`form-dim${transcriptionHistory.error ? " form-dim--error" : ""}`}>
          {transcriptionHistory.error ?? historyFeedback ?? `${transcriptionHistory.entries.length} history entries match the current filters.`}
        </p>
      </div>

      <div className="form-section">Runtime Logs</div>
      <div className="settings__about-card">
        <p className="form-dim" style={{ marginTop: 0 }}>
          Structured native logs stay enabled and are buffered here for fast inspection while the runtime is active. History above keeps the durable transcript record separate from this transient log stream.
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