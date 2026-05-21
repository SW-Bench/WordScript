import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNativeInsertion } from "../../hooks/useNativeInsertion";
import { HOTKEY_SEPARATOR_HINT, getHotkeyValidationMessage, normalizeManualHotkey } from "../../lib/hotkeys";
import type { AppConfig } from "../../types/ipc";
import type {
  NativeClipboardRestoreStatus,
  NativeInsertDriver,
  NativeInsertReadiness,
  NativeInsertRecoveryAction,
} from "../../types/nativeInsertion";
import { HotkeyRecorder } from "./HotkeyRecorder";

type ShortcutField = "hotkey" | "pause_hotkey" | "abort_hotkey";
type CaptureField = "max_recording_seconds" | "silence_timeout_seconds";

const SHORTCUT_FIELDS: Array<{
  field: ShortcutField;
  label: string;
  placeholder: string;
  description: string;
}> = [
  {
    field: "hotkey",
    label: "Start / Stop Hotkey",
    placeholder: "ctrl_l+f9",
    description: "Starts or stops the active capture.",
  },
  {
    field: "pause_hotkey",
    label: "Pause / Resume Hotkey",
    placeholder: "ctrl_l+f10",
    description: "Pause toggles the active recording without finishing the capture.",
  },
  {
    field: "abort_hotkey",
    label: "Abort Hotkey",
    placeholder: "ctrl_l+alt_l+escape",
    description: "Abort stops the active recording and discards the current capture.",
  },
];

interface Props {
  config: AppConfig;
  onChange: (p: Partial<AppConfig>) => void;
}

interface NativeInputDevice {
  name: string;
  is_default: boolean;
}

interface NativeCaptureStatus {
  is_recording: boolean;
  device_name: string | null;
  active_capture_id: string | null;
}

function clampCaptureNumber(value: number, minimum: number, maximum: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function formatDurationCompact(seconds: number) {
  const normalized = Math.max(0, Math.round(seconds));

  if (normalized < 60) {
    return `${normalized}s`;
  }

  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);
  const remainingSeconds = normalized % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function insertDriverLabel(value: NativeInsertDriver | undefined) {
  switch (value) {
    case "wl_copy":
      return "wl-copy";
    case "arboard":
      return "arboard clipboard";
    case "xdotool":
      return "xdotool";
    case "wtype":
      return "wtype";
    case "ydotool":
      return "ydotool";
    case "enigo":
      return "enigo";
    case "scratchpad":
      return "scratchpad recovery";
    default:
      return "Detecting current driver";
  }
}

function recoveryActionLabel(value: NativeInsertRecoveryAction | null | undefined) {
  switch (value) {
    case "none":
      return "No recovery action needed";
    case "manual_paste":
      return "Manual paste";
    case "use_scratchpad":
      return "Use scratchpad";
    default:
      return "Recovery ready";
  }
}

function clipboardRestoreLabel(value: NativeClipboardRestoreStatus | null | undefined) {
  switch (value) {
    case "scheduled":
      return "previous clipboard restore scheduled";
    case "skipped_no_previous_clipboard":
      return "no previous clipboard to restore";
    case "not_attempted":
      return "clipboard restore not needed";
    default:
      return null;
  }
}

function insertReadinessLabel(value: NativeInsertReadiness | null | undefined) {
  switch (value) {
    case "ready":
      return "Ready";
    case "recovery_only":
      return "Recovery only";
    default:
      return "Checking preflight";
  }
}

export function InputTab({ config, onChange }: Props) {
  const insertion = useNativeInsertion();
  const platformStatus = insertion.status?.platform ?? null;
  const [audioDevices, setAudioDevices] = useState<NativeInputDevice[]>([]);
  const [captureStatus, setCaptureStatus] = useState<NativeCaptureStatus | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isRefreshingAudio, setIsRefreshingAudio] = useState(false);
  const pauseNativeTrigger = () => { void invoke("pause_native_trigger").catch(() => {}); };
  const resumeNativeTrigger = () => { void invoke("resume_native_trigger").catch(() => {}); };

  const refreshAudioSetup = useCallback(async () => {
    setIsRefreshingAudio(true);

    const [devicesResult, captureStatusResult] = await Promise.allSettled([
      invoke<NativeInputDevice[]>("list_native_input_devices"),
      invoke<NativeCaptureStatus>("native_capture_status"),
    ]);

    if (devicesResult.status === "fulfilled") {
      setAudioDevices(devicesResult.value);
      setAudioError(null);
    } else {
      setAudioError(String(devicesResult.reason));
    }

    if (captureStatusResult.status === "fulfilled") {
      setCaptureStatus(captureStatusResult.value);
    }

    setIsRefreshingAudio(false);
  }, []);

  useEffect(() => {
    void refreshAudioSetup();
  }, [refreshAudioSetup]);

  const updateShortcut = (field: ShortcutField, value: string) => {
    onChange({ [field]: value } as Pick<AppConfig, ShortcutField>);
  };

  const normalizeShortcutField = (field: ShortcutField) => {
    const normalized = normalizeManualHotkey(config[field]);
    if (normalized !== config[field]) {
      updateShortcut(field, normalized);
    }
  };

  const normalizeCaptureField = (field: CaptureField, minimum: number, maximum: number, fallback: number) => {
    const normalized = clampCaptureNumber(config[field], minimum, maximum, fallback);
    if (normalized !== config[field]) {
      onChange({ [field]: normalized } as Pick<AppConfig, CaptureField>);
    }
  };

  const defaultAudioDevice = useMemo(
    () => audioDevices.find((device) => device.is_default) ?? null,
    [audioDevices],
  );
  const maxRecordingSeconds = clampCaptureNumber(config.max_recording_seconds, 10, 3600, 720);
  const silenceTimeoutSeconds = clampCaptureNumber(config.silence_timeout_seconds, 0, 300, 30);
  const hasExplicitAudioDevice = Boolean(config.audio_device.trim());
  const selectedAudioDeviceAvailable = !hasExplicitAudioDevice || audioDevices.some((device) => device.name === config.audio_device);
  const selectedAudioDeviceLabel = hasExplicitAudioDevice
    ? config.audio_device
    : defaultAudioDevice?.name ?? "System default microphone";
  const activationLabel = config.activation_mode === "hold" ? "Hold to talk" : "Tap to toggle";
  const deliveryLabel = config.auto_paste ? "Insert at cursor" : "Clipboard only";
  const autoStopLabel = silenceTimeoutSeconds > 0
    ? `${formatDurationCompact(silenceTimeoutSeconds)} silence`
    : "Manual stop";
  const scratchpadCount = insertion.status?.scratchpad_entries.length ?? 0;
  const scratchpadLabel = scratchpadCount === 1 ? "1 fallback entry" : `${scratchpadCount} fallback entries`;
  const driverChain = platformStatus?.driver_chain ?? [];
  const driverChainSummary = driverChain.length > 0
    ? driverChain.map((item) => item.label).join(" -> ")
    : "Detecting current insert chain.";
  const activeDriverLabel = insertDriverLabel(platformStatus?.active_driver);
  const insertPreflightLabel = insertReadinessLabel(platformStatus?.readiness);
  const audioStatusMessage = audioError
    ? audioError
    : captureStatus?.is_recording && captureStatus.device_name
      ? `Current capture is still using ${captureStatus.device_name}. Any new mic selection applies to the next recording.`
      : !selectedAudioDeviceAvailable
        ? `Saved microphone is not available right now. WordScript will fall back to ${defaultAudioDevice?.name ?? "the system default microphone"} on the next capture.`
        : `Next capture will use ${selectedAudioDeviceLabel}.`;
  const deliverySummary = config.auto_paste
    ? "Direct insert copies the transcript, pastes it at the cursor and restores your previous clipboard afterwards."
    : "Clipboard only keeps the transcript ready for manual paste and never sends a paste shortcut into the active app.";
  const soundSummary = config.play_sounds
    ? "Native sound cues are on for start, stop, abort and runtime errors."
    : "Native sound cues are off.";
  const deliveryDriverSummary = platformStatus
    ? `${insertPreflightLabel}: ${platformStatus.readiness_message} Current driver: ${activeDriverLabel}. ${platformStatus.platform_label} reports ${driverChainSummary}.`
    : "WordScript is checking the current native insert chain.";
  const latestFallbackReason = insertion.lastRestore?.fallback_reason
    ?? insertion.status?.last_transcript?.fallback_reason
    ?? null;
  const latestRecoveryAction = insertion.lastRestore?.recovery_action
    ?? insertion.status?.last_transcript?.recovery_action
    ?? null;
  const latestRecoveryMessage = insertion.lastRestore?.recovery_message
    ?? insertion.status?.last_transcript?.recovery_message
    ?? latestFallbackReason
    ?? null;
  const latestClipboardRestore = insertion.lastRestore?.clipboard_restore
    ?? insertion.status?.last_transcript?.clipboard_restore
    ?? null;
  const latestClipboardRestoreLabel = clipboardRestoreLabel(latestClipboardRestore);

  return (
    <>
      <div className="tab__title">Input</div>

      <div className="settings__about-card settings__input-overview">
        <div className="settings__input-overview-grid">
          <div className="settings__input-overview-item">
            <span>Trigger</span>
            <strong>{activationLabel}</strong>
            <small>{config.hotkey || "Start / stop shortcut not set"}</small>
          </div>
          <div className="settings__input-overview-item">
            <span>Capture</span>
            <strong>{selectedAudioDeviceLabel}</strong>
            <small>{`Cap ${formatDurationCompact(maxRecordingSeconds)} · ${autoStopLabel}`}</small>
          </div>
          <div className="settings__input-overview-item">
            <span>Delivery</span>
            <strong>{deliveryLabel}</strong>
            <small>{config.play_sounds ? "Sound cues on" : "Sound cues off"}</small>
          </div>
        </div>
      </div>

      <div className="settings__provider-card settings__input-path-card">
        <div className="settings__provider-card-header">
          <strong className="settings__about-title">Current native path</strong>
          <p className="form-dim settings__provider-card-copy">
            The next capture and insert cycle will follow this runtime path.
          </p>
        </div>
        <div className="settings__provider-meta-grid">
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">Current capture</span>
            <span>{captureStatus?.is_recording ? "Recording now" : "Idle"}</span>
            <code>{captureStatus?.device_name ?? selectedAudioDeviceLabel}</code>
          </div>
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">Insert driver</span>
            <span>{activeDriverLabel}</span>
            <code>{platformStatus?.insert_strategy ?? "detecting"}</code>
          </div>
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">Insert preflight</span>
            <span>{insertPreflightLabel}</span>
            <code>{platformStatus?.support_tier ?? "detecting"}</code>
          </div>
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">Recovery path</span>
            <span>{scratchpadLabel}</span>
            <code>{insertion.status?.scratchpad_path ?? "Loading recovery store"}</code>
          </div>
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">Delivery mode</span>
            <span>{deliveryLabel}</span>
            <code>{config.play_sounds ? "sound cues on" : "sound cues off"}</code>
          </div>
        </div>
      </div>

      <div className="form-section">Shortcuts</div>
      <p className="form-dim">
        Shortcuts are registered in the native trigger layer and stay active after this window closes. Use manual entry only when the desktop intercepts a key such as Win/Super on Linux.
        {" "}<code>{HOTKEY_SEPARATOR_HINT}</code>
      </p>

      {SHORTCUT_FIELDS.map((shortcut) => {
        const value = config[shortcut.field];
        const allowModifierOnly = true;
        const issue = getHotkeyValidationMessage(value, { allowModifierOnly });

        return (
          <div key={shortcut.field}>
            <div className="form-row">
              <label>{shortcut.label}</label>
              <HotkeyRecorder
                value={value}
                allowModifierOnly={allowModifierOnly}
                onChange={(nextValue) => updateShortcut(shortcut.field, nextValue)}
                onStartRecording={pauseNativeTrigger}
                onStopRecording={resumeNativeTrigger}
              />
            </div>
            <div className="form-row">
              <label style={{ fontSize: 12, color: "var(--fg-dim)" }}>manual format</label>
              <input
                type="text"
                value={value}
                style={{ fontFamily: "monospace" }}
                placeholder={`e.g. ${shortcut.placeholder}`}
                onChange={(event) => updateShortcut(shortcut.field, event.target.value)}
                onBlur={() => normalizeShortcutField(shortcut.field)}
              />
            </div>
            <p className={`form-dim${issue ? " form-dim--error" : ""}`}>
              {issue ?? shortcut.description}
            </p>
          </div>
        );
      })}

      <div className="form-row">
        <label>Activation Mode</label>
        <select
          value={config.activation_mode}
          onChange={(event) => onChange({ activation_mode: event.target.value as "tap" | "hold" })}
        >
          <option value="tap">Tap to toggle</option>
          <option value="hold">Hold to talk</option>
        </select>
      </div>
      <p className="form-dim">
        Tap starts and stops on the same shortcut. Hold records while the shortcut is pressed and stops on release.
      </p>

      <div className="form-section">Microphone</div>
      <div className="form-row">
        <label>Input Device</label>
        <div className="settings__input-inline-control">
          <select
            aria-label="Input device"
            value={config.audio_device}
            onChange={(event) => onChange({ audio_device: event.target.value })}
          >
            <option value="">
              {defaultAudioDevice ? `System default (${defaultAudioDevice.name})` : "System default microphone"}
            </option>
            {audioDevices.map((device) => (
              <option key={device.name} value={device.name}>
                {device.is_default ? `${device.name} — default` : device.name}
              </option>
            ))}
          </select>
          <button
            className="btn btn--cancel settings__input-inline-btn"
            type="button"
            aria-label="Refresh microphones"
            onClick={() => void refreshAudioSetup()}
            disabled={isRefreshingAudio}
          >
            {isRefreshingAudio ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
      <p className={`form-dim${audioError || !selectedAudioDeviceAvailable ? " form-dim--error" : ""}`}>
        {audioStatusMessage}
      </p>

      <div className="form-row">
        <label>Max recording</label>
        <input
          type="number"
          value={config.max_recording_seconds}
          min={10}
          max={3600}
          step={5}
          onChange={(event) => onChange({ max_recording_seconds: Number(event.target.value) })}
          onBlur={() => normalizeCaptureField("max_recording_seconds", 10, 3600, 720)}
          style={{ maxWidth: 90 }}
        />
        <span style={{ fontSize: 12, color: "var(--fg-dim)", marginLeft: 8 }}>{formatDurationCompact(maxRecordingSeconds)}</span>
      </div>

      <div className="form-row">
        <label>Silence timeout</label>
        <input
          type="number"
          value={config.silence_timeout_seconds}
          min={0}
          max={300}
          step={1}
          onChange={(event) => onChange({ silence_timeout_seconds: Number(event.target.value) })}
          onBlur={() => normalizeCaptureField("silence_timeout_seconds", 0, 300, 30)}
          style={{ maxWidth: 90 }}
        />
        <span style={{ fontSize: 12, color: "var(--fg-dim)", marginLeft: 8 }}>{silenceTimeoutSeconds > 0 ? formatDurationCompact(silenceTimeoutSeconds) : "Disabled"}</span>
      </div>
      <p className="form-dim">
        Max recording and silence timeout are enforced in the native capture monitor, not just in the UI. They keep working after this window is closed.
      </p>

      <div className="form-section">Delivery</div>
      <div className="form-row">
        <label>Transcript delivery</label>
        <select
          value={config.auto_paste ? "direct_insert" : "clipboard_only"}
          onChange={(event) => onChange({ auto_paste: event.target.value === "direct_insert" })}
        >
          <option value="direct_insert">Copy and insert at cursor</option>
          <option value="clipboard_only">Copy to clipboard only</option>
        </select>
      </div>
      <p className="form-dim">{deliverySummary}</p>
      <div className="form-row">
        <label>Native insert chain</label>
        <div className="provider-status provider-status--stacked">
          <span className={`provider-status__dot${platformStatus?.readiness === "ready" ? " provider-status__dot--ok" : ""}`} />
          <div>
            <strong>{activeDriverLabel}</strong>
            <span>{platformStatus?.readiness_message ?? driverChainSummary}</span>
          </div>
        </div>
      </div>
      <p className="form-dim">{deliveryDriverSummary}</p>
      <label className="form-check">
        <input
          type="checkbox"
          checked={config.play_sounds}
          onChange={(event) => onChange({ play_sounds: event.target.checked })}
        />
        <span>Play sound feedback for start, stop, abort and errors</span>
      </label>
      <p className="form-dim">{soundSummary}</p>

      <div className="form-section">Recovery</div>
      <p className="form-dim">
        Use recovery when direct insert failed, the target app ignored paste, or you want the latest transcript back without reopening diagnostics.
      </p>
      <div className="form-row">
        <label>Last recoverable transcript</label>
        <div className="provider-status">
          <span className={`provider-status__dot${insertion.status?.last_transcript ? " provider-status__dot--ok" : ""}`} />
          <span>{insertion.status?.last_transcript ? "Available" : "No transcript stored yet"}</span>
          {insertion.status?.last_transcript && (
            <code>{`${insertion.status.last_transcript.insert_mode} · ${recoveryActionLabel(latestRecoveryAction)}`}</code>
          )}
        </div>
      </div>
      <div className="form-row">
        <label>Recovery scratchpad</label>
        <div className="provider-status provider-status--stacked">
          <span className={`provider-status__dot${scratchpadCount > 0 ? " provider-status__dot--ok" : ""}`} />
          <div>
            <strong>{scratchpadLabel}</strong>
            <span className="provider-status__path">{insertion.status?.scratchpad_path ?? "Loading recovery path"}</span>
          </div>
        </div>
      </div>
      <div className="settings__provider-actions">
        <button
          className="btn btn--cancel"
          type="button"
          disabled={insertion.isLoading || !insertion.status?.last_transcript}
          onClick={() => void insertion.restoreLastTranscript()}
        >
          Restore recoverable transcript
        </button>
        <button
          className="btn btn--cancel"
          type="button"
          disabled={insertion.isLoading || !insertion.status?.scratchpad_entries.length}
          onClick={() => void insertion.clearScratchpad()}
        >
          Clear recovery scratchpad
        </button>
      </div>
      <p className={`form-dim${insertion.error ? " form-dim--error" : insertion.lastRestore ? " form-dim--ok" : ""}`}>
        {insertion.error
          ?? latestRecoveryMessage
          ?? (insertion.lastRestore ? "Recoverable transcript restored through native insertion." : `${scratchpadLabel} ready for recovery if direct insert fails.`)}
        {latestClipboardRestoreLabel ? ` ${latestClipboardRestoreLabel}.` : ""}
      </p>
    </>
  );
}
