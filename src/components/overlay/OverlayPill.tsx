import { type ChangeEvent, type ReactNode } from "react";
import {
  Ban,
  Check,
  Clipboard,
  CornerDownLeft,
  Mic,
  MicOff,
  Pause,
  Pencil,
  Play,
  X,
} from "lucide-react";
import "../../styles/overlay-pill.css";

/* ── Public types ─────────────────────────────────────────────────────────── */

export type OverlayProcessingMode =
  | "verbatim"
  | "cleanup"
  | "rewrite"
  | "prompt_enhance"
  | "agent";

export type OverlayPendingPreview = { action: "commit" | "abort"; label: string };
export type OverlayPendingResult = { action: "copy" | "edit" | "insert"; label: string };

export type OverlayPillState =
  | {
      kind: "recording";
      mode: OverlayProcessingMode;
      muted: boolean;
      paused: boolean;
      /** Mock audio level 0..1 driving the waveform. */
      level: number;
      elapsedSec: number;
      onMuteToggle?: () => void;
      onPauseToggle?: () => void;
      onCycleMode?: () => void;
    }
  | {
      kind: "processing";
      mode: OverlayProcessingMode;
      elapsedSec: number;
      preview?: { text: string; clipboardOnly: boolean };
      pending?: OverlayPendingPreview;
      onCommit?: () => void;
      onAbort?: () => void;
      onCycleMode?: () => void;
    }
  | {
      kind: "result-actions";
      text: string;
      clipboardOnly: boolean;
      autoCloseSec: number;
      pending?: OverlayPendingResult;
      onCopy?: () => void;
      onEdit?: () => void;
      onInsert?: () => void;
      onDismiss?: () => void;
    }
  | {
      kind: "edit-mode";
      text: string;
      onTextChange?: (text: string) => void;
      onConfirm?: () => void;
      onCancel?: () => void;
    }
  | {
      kind: "error";
      message: string;
    };

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const BAR_COUNT = 11;
const MIN_BAR = 5;
const MAX_BAR = 30;
const IDLE_BARS = [5, 7, 9, 12, 15, 17, 15, 12, 9, 7, 5];

function modeShortLabel(mode: OverlayProcessingMode): string {
  switch (mode) {
    case "cleanup": return "Cleanup";
    case "rewrite": return "Rewrite";
    case "agent": return "Agent";
    case "verbatim": return "Verbatim";
    case "prompt_enhance": return "Enhance";
    default: return "Cleanup";
  }
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/** Shape a mock 0..1 audio level into 11 bar heights (5..30 px). A gentle,
 *  center-biased envelope keeps the waveform legible at low levels and
 *  saturates softly at full level. */
function levelToBars(level: number): number[] {
  const clamped = Math.min(1, Math.max(0, level));
  if (clamped < 0.018) return [...IDLE_BARS];

  const gain = Math.min(1, clamped * 2.9);
  return Array.from({ length: BAR_COUNT }, (_, index) => {
    const center = (BAR_COUNT - 1) / 2;
    const distance = Math.abs(index - center) / center;
    const falloff = 1 - distance * 0.42;
    const wobble = 1 - Math.abs(((index * 1.7) % 5) - 2) / 6;
    const energy = Math.min(1, gain * falloff * wobble * 1.25);
    return Math.round(MIN_BAR + (MAX_BAR - MIN_BAR) * energy);
  });
}

/* ── Component ────────────────────────────────────────────────────────────── */

export function OverlayPill({ state }: { state: OverlayPillState }) {
  switch (state.kind) {
    case "recording":     return <RecordingPill state={state} />;
    case "processing":    return <ProcessingPill state={state} />;
    case "result-actions": return <ResultActionsPill state={state} />;
    case "edit-mode":     return <EditPill state={state} />;
    case "error":         return <ErrorPill state={state} />;
  }
}

export default OverlayPill;

/* ── Recording ────────────────────────────────────────────────────────────── */

function RecordingPill({ state }: { state: Extract<OverlayPillState, { kind: "recording" }> }) {
  const classes = ["pill", "pill--compact", "pill--recording"];
  if (state.muted) classes.push("pill--muted");
  if (state.paused) classes.push("pill--paused");

  const bars = levelToBars(state.level);

  return (
    <div className={classes.join(" ")}>
      <MicButton muted={state.muted} onClick={state.onMuteToggle} />
      <Bars heights={bars} muted={state.muted} />
      <ModeChip mode={state.mode} onClick={state.onCycleMode} />
      <span className="pill__divider" aria-hidden="true" />
      <SideButton
        icon={state.paused ? <Play size={13} strokeWidth={2.5} /> : <Pause size={13} strokeWidth={2.5} />}
        timer={formatElapsed(state.elapsedSec)}
        label={state.paused ? "Paused" : "Pause"}
        ariaLabel={state.paused ? "Resume recording" : "Pause recording"}
        pressed={state.paused}
        onClick={state.onPauseToggle}
      />
    </div>
  );
}

/* ── Processing ───────────────────────────────────────────────────────────── */

function ProcessingPill({ state }: { state: Extract<OverlayPillState, { kind: "processing" }> }) {
  if (state.preview) {
    return (
      <div className="pill pill--preview-actions pill--processing">
        <MicButton muted={false} disabled />
        <PreviewText text={state.preview.text} />
        <PreviewActions
          clipboardOnly={state.preview.clipboardOnly}
          pending={state.pending}
          onCommit={state.onCommit}
          onAbort={state.onAbort}
        />
        <span className="pill__divider" aria-hidden="true" />
        <SideButton
          timer={formatElapsed(state.elapsedSec)}
          label="Working"
          ariaLabel="Processing"
          onClick={undefined}
          staticAffordance
        />
      </div>
    );
  }

  return (
    <div className="pill pill--compact pill--processing">
      <MicButton muted={false} disabled />
      <Bars heights={IDLE_BARS} muted={false} />
      <ModeChip mode={state.mode} onClick={state.onCycleMode} />
      <span className="pill__divider" aria-hidden="true" />
      <SideButton
        timer={formatElapsed(state.elapsedSec)}
        label="Working"
        ariaLabel="Processing"
        onClick={undefined}
        staticAffordance
      />
    </div>
  );
}

/* ── Result actions ───────────────────────────────────────────────────────── */

function ResultActionsPill({ state }: { state: Extract<OverlayPillState, { kind: "result-actions" }> }) {
  return (
    <div className="pill pill--result-actions">
      <PreviewText text={state.text} />
      <ResultActions
        clipboardOnly={state.clipboardOnly}
        pending={state.pending}
        onCopy={state.onCopy}
        onEdit={state.onEdit}
        onInsert={state.onInsert}
      />
      <span className="pill__divider" aria-hidden="true" />
      <SideButton
        icon={<Check size={14} strokeWidth={2.5} />}
        timer="Done"
        label="Dismiss"
        ariaLabel="Dismiss result actions"
        onClick={state.onDismiss}
      />
    </div>
  );
}

/* ── Edit mode (tall capsule) ─────────────────────────────────────────────── */

function EditPill({ state }: { state: Extract<OverlayPillState, { kind: "edit-mode" }> }) {
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    state.onTextChange?.(e.target.value);
  };

  return (
    <div className="pill pill--edit-mode">
      <div className="pill__edit-body">
        <textarea
          className="pill__edit-textarea"
          value={state.text}
          onChange={handleChange}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          aria-label="Edit transcription text"
          spellCheck={false}
        />
        <div className="pill__edit-footer">
          <IconAction
            icon={<Check size={14} strokeWidth={2.5} />}
            label="Confirm"
            busyLabel="Inserting"
            disabled={!state.text.trim()}
            primary
            onClick={state.onConfirm}
          />
          <IconAction
            icon={<X size={14} strokeWidth={2.5} />}
            label="Cancel"
            busyLabel="Cancel"
            onClick={state.onCancel}
          />
        </div>
      </div>
      <span className="pill__resize-handle" aria-hidden="true" title="Resize" />
    </div>
  );
}

/* ── Error ────────────────────────────────────────────────────────────────── */

function ErrorPill({ state }: { state: Extract<OverlayPillState, { kind: "error" }> }) {
  return (
    <div className="pill pill--compact pill--error">
      <span className="pill__error-icon" aria-hidden="true">
        <Ban size={18} strokeWidth={2.25} />
      </span>
      <span className="pill__error-text" title={state.message}>{state.message}</span>
    </div>
  );
}

/* ── Shared sub-components ────────────────────────────────────────────────── */

function MicButton({ muted, onClick, disabled }: { muted: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="pill__mic"
      onClick={onClick}
      aria-pressed={muted}
      aria-label={muted ? "Unmute microphone" : "Mute microphone"}
      title={muted ? "Unmute" : "Mute"}
      disabled={disabled}
    >
      {muted ? <MicOff size={18} strokeWidth={2.25} /> : <Mic size={18} strokeWidth={2.25} />}
    </button>
  );
}

function Bars({ heights, muted }: { heights: number[]; muted: boolean }) {
  return (
    <div className="pill__bars" aria-label="Audio level">
      {heights.map((h, i) => (
        <span key={i} className={`bar${muted ? " bar--muted" : ""}`} style={{ height: h }} />
      ))}
    </div>
  );
}

function ModeChip({ mode, onClick }: { mode: OverlayProcessingMode; onClick?: () => void }) {
  const label = modeShortLabel(mode);
  return (
    <button
      type="button"
      className="pill__mode"
      onClick={onClick}
      aria-label={`Mode ${label}, tap to cycle`}
      title={`Mode: ${label} · tap to cycle`}
    >
      <span className="pill__mode-dot" aria-hidden="true" />
      <span className="pill__mode-label">{label}</span>
    </button>
  );
}

function PreviewText({ text }: { text: string }) {
  return (
    <span className="pill__preview-text" title={text}>
      {text}
    </span>
  );
}

function SideButton({
  icon,
  timer,
  label,
  ariaLabel,
  pressed,
  onClick,
  staticAffordance,
}: {
  icon?: ReactNode;
  timer: string;
  label: string;
  ariaLabel: string;
  pressed?: boolean;
  onClick?: () => void;
  staticAffordance?: boolean;
}) {
  return (
    <button
      type="button"
      className="pill__side"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      title={ariaLabel}
      disabled={staticAffordance && !onClick}
    >
      {icon}
      <span className="pill__timer">{timer}</span>
      <span className="pill__side-label">{label}</span>
    </button>
  );
}

function PreviewActions({
  clipboardOnly,
  pending,
  onCommit,
  onAbort,
}: {
  clipboardOnly: boolean;
  pending?: OverlayPendingPreview;
  onCommit?: () => void;
  onAbort?: () => void;
}) {
  const committing = pending?.action === "commit";
  const aborting = pending?.action === "abort";
  return (
    <div className="pill__action-group" role="group" aria-label="Preview actions">
      <IconAction
        icon={clipboardOnly ? <Clipboard size={14} strokeWidth={2.25} /> : <CornerDownLeft size={14} strokeWidth={2.25} />}
        label={clipboardOnly ? "Copy" : "Insert"}
        busy={committing}
        busyLabel={committing ? pending!.label : clipboardOnly ? "Copying" : "Inserting"}
        primary
        disabled={Boolean(pending)}
        onClick={onCommit}
      />
      <IconAction
        icon={<Ban size={14} strokeWidth={2.25} />}
        label="Abort"
        busy={aborting}
        busyLabel={aborting ? pending!.label : "Aborting"}
        disabled={Boolean(pending)}
        onClick={onAbort}
      />
    </div>
  );
}

function ResultActions({
  clipboardOnly,
  pending,
  onCopy,
  onEdit,
  onInsert,
}: {
  clipboardOnly: boolean;
  pending?: OverlayPendingResult;
  onCopy?: () => void;
  onEdit?: () => void;
  onInsert?: () => void;
}) {
  return (
    <div className="pill__action-group" role="group" aria-label="Result actions">
      <IconAction
        icon={<Clipboard size={14} strokeWidth={2.25} />}
        label="Copy"
        busy={pending?.action === "copy"}
        busyLabel={pending?.action === "copy" ? pending.label : "Copying"}
        disabled={Boolean(pending)}
        onClick={onCopy}
      />
      <IconAction
        icon={<Pencil size={14} strokeWidth={2.25} />}
        label="Edit"
        busy={pending?.action === "edit"}
        busyLabel={pending?.action === "edit" ? pending.label : "Editing"}
        disabled={Boolean(pending)}
        onClick={onEdit}
      />
      {clipboardOnly && (
        <IconAction
          icon={<CornerDownLeft size={14} strokeWidth={2.25} />}
          label="Insert"
          busy={pending?.action === "insert"}
          busyLabel={pending?.action === "insert" ? pending.label : "Inserting"}
          primary
          disabled={Boolean(pending)}
          onClick={onInsert}
        />
      )}
    </div>
  );
}

function IconAction({
  icon,
  label,
  busy,
  busyLabel,
  primary,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  busy?: boolean;
  busyLabel: string;
  primary?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`pill__action${primary ? " pill__action--primary" : ""}`}
      onClick={busy ? undefined : onClick}
      disabled={disabled}
      aria-label={busy ? busyLabel : label}
      title={busy ? busyLabel : label}
    >
      <span className="pill__action-icon" aria-hidden="true">{icon}</span>
      <span className="pill__action-label">{busy ? busyLabel : label}</span>
    </button>
  );
}
