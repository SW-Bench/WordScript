import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useNativeInsertion } from "../../hooks/useNativeInsertion";
import { HOTKEY_SEPARATOR_HINT, getHotkeyValidationMessage, normalizeManualHotkey } from "../../lib/hotkeys";
import { FormCard, FormRow, Select, StatTiles, StatusBadge, Stepper, Toggle } from "../shell";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import type { AppConfig, OverlayAnchor, OverlayPositionMode } from "../../types/ipc";
import type {
  NativeClipboardRestoreStatus,
  NativeInsertDriver,
  NativeInsertReadiness,
  NativeInsertRecoveryAction,
} from "../../types/nativeInsertion";
import { HotkeyRecorder } from "./HotkeyRecorder";

type ShortcutField = "hotkey" | "pause_hotkey" | "abort_hotkey";

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

interface OverlayMonitorOption {
  id: string;
  label: string;
  is_primary: boolean;
}

const OVERLAY_ANCHORS: Array<{ value: OverlayAnchor; label: string }> = [
  { value: "top_left", label: "Top left" },
  { value: "top_center", label: "Top center" },
  { value: "top_right", label: "Top right" },
  { value: "center_left", label: "Left center" },
  { value: "center_right", label: "Right center" },
  { value: "bottom_left", label: "Bottom left" },
  { value: "bottom_center", label: "Bottom center" },
  { value: "bottom_right", label: "Bottom right" },
];

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

function MetaRow({
  label,
  value,
  code,
  divider = true,
}: {
  label: string;
  value: ReactNode;
  code?: ReactNode;
  divider?: boolean;
}) {
  return (
    <FormRow
      label={label}
      divider={divider}
      align={code ? "start" : "center"}
      control={
        <div className="flex flex-col items-end gap-0.5 text-right">
          <span className="text-[12px] text-fg-dim">{value}</span>
          {code && (
            <span
              className="max-w-[280px] truncate font-mono text-[11px] text-fg-muted"
              title={typeof code === "string" ? code : undefined}
            >
              {code}
            </span>
          )}
        </div>
      }
    />
  );
}

export function InputTab({ config, onChange }: Props) {
  const insertion = useNativeInsertion();
  const platformStatus = insertion.status?.platform ?? null;
  const [audioDevices, setAudioDevices] = useState<NativeInputDevice[]>([]);
  const [captureStatus, setCaptureStatus] = useState<NativeCaptureStatus | null>(null);
  const [overlayMonitors, setOverlayMonitors] = useState<OverlayMonitorOption[]>([]);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const [isRefreshingAudio, setIsRefreshingAudio] = useState(false);
  const pauseNativeTrigger = () => { void invoke("pause_native_trigger").catch(() => {}); };
  const resumeNativeTrigger = () => { void invoke("resume_native_trigger").catch(() => {}); };

  const refreshAudioSetup = useCallback(async () => {
    setIsRefreshingAudio(true);

    const [devicesResult, captureStatusResult, overlayMonitorsResult] = await Promise.allSettled([
      invoke<NativeInputDevice[]>("list_native_input_devices"),
      invoke<NativeCaptureStatus>("native_capture_status"),
      invoke<OverlayMonitorOption[]>("overlay_monitor_options"),
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

    if (overlayMonitorsResult.status === "fulfilled") {
      setOverlayMonitors(overlayMonitorsResult.value);
      setOverlayError(null);
    } else {
      setOverlayError(String(overlayMonitorsResult.reason));
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

  const defaultAudioDevice = useMemo(
    () => audioDevices.find((device) => device.is_default) ?? null,
    [audioDevices],
  );
  const maxRecordingSeconds = clampCaptureNumber(config.max_recording_seconds, 10, 3600, 720);
  const silenceTimeoutSeconds = clampCaptureNumber(config.silence_timeout_seconds, 0, 300, 30);
  const resultActionsTimeoutMs = clampCaptureNumber(config.result_actions_timeout_ms, 1000, 60000, 9000);
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
  const startHotkeyIssue = getHotkeyValidationMessage(config.hotkey, { allowModifierOnly: true });
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
  const overlayPlacementMode = config.overlay_position_mode ?? "preset" satisfies OverlayPositionMode;
  const overlayMonitorValue = config.overlay_monitor || "primary";
  const overlayAnchorValue = config.overlay_anchor ?? "bottom_center";
  const overlayUsesPreset = overlayPlacementMode === "preset";
  const selectedOverlayMonitor = overlayMonitors.find((monitor) => monitor.id === overlayMonitorValue)
    ?? overlayMonitors.find((monitor) => monitor.is_primary)
    ?? null;
  const selectedOverlayAnchor = OVERLAY_ANCHORS.find((anchor) => anchor.value === overlayAnchorValue)?.label.toLowerCase() ?? "the chosen anchor";
  const overlayPlacementSummary = overlayUsesPreset
    ? `WordScript keeps the overlay on ${selectedOverlayMonitor?.label ?? "the selected display"} at ${selectedOverlayAnchor} until you drag it somewhere else.`
    : "Drag the overlay in any state. WordScript reuses that exact spot as the next default position.";
  const overlayPlacementDetail = overlayUsesPreset
    ? "Preset placement is best when the overlay should consistently open on one display edge."
    : config.overlay_manual_x !== 0 || config.overlay_manual_y !== 0
      ? `Current remembered position: ${config.overlay_manual_x}, ${config.overlay_manual_y}.`
      : "No remembered position yet. The first drag sets it.";
  const deliveryDriverSummary = platformStatus
    ? `${insertPreflightLabel}: ${platformStatus.readiness_message} Current driver: ${activeDriverLabel}. ${platformStatus.platform_label} reports ${driverChainSummary}.`
    : "WordScript is checking the current native insert chain.";
  const portalDiagnosticSummary = platformStatus
    ? [
        platformStatus.portal_capabilities
          ? `Compositor: ${String(platformStatus.portal_capabilities.compositor).replace(/_/g, " ")} · xdg-desktop-portal: ${
              platformStatus.portal_capabilities.has_xdg_desktop_portal_daemon ? "present" : "missing"
            } · RemoteDesktop: ${
              platformStatus.portal_capabilities.has_remote_desktop_portal ? "reachable" : "not reachable"
            }`
          : null,
        platformStatus.paste_disabled_reason ? `Why auto-paste is restricted: ${platformStatus.paste_disabled_reason}` : null,
      ]
        .filter((value): value is string => value !== null)
        .join(" · ")
    : "";
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
  const firstDictationPreflight = [
    {
      id: "trigger",
      label: "Trigger",
      ready: Boolean(config.hotkey.trim()) && !startHotkeyIssue,
      state: startHotkeyIssue ? "Shortcut needs attention" : "Ready",
      detail: startHotkeyIssue ?? (config.hotkey || "Set a start / stop hotkey."),
      action: startHotkeyIssue ? "Fix shortcut" : activationLabel,
    },
    {
      id: "microphone",
      label: "Microphone",
      ready: selectedAudioDeviceAvailable && !audioError,
      state: audioError || !selectedAudioDeviceAvailable ? "Needs attention" : "Ready",
      detail: audioStatusMessage,
      action: captureStatus?.is_recording ? "Applies next capture" : "Capture ready",
    },
    {
      id: "insert",
      label: "Insert path",
      ready: platformStatus?.readiness === "ready",
      state: insertPreflightLabel,
      detail: platformStatus?.readiness_message ?? "WordScript is checking the current native insert chain.",
      action: platformStatus?.readiness === "ready" ? activeDriverLabel : recoveryActionLabel("manual_paste"),
    },
    {
      id: "recovery",
      label: "Recovery",
      ready: Boolean(insertion.status?.scratchpad_path),
      state: insertion.status?.scratchpad_path ? "Ready" : "Checking preflight",
      detail: insertion.status?.scratchpad_path ?? "WordScript is loading the recovery scratchpad path.",
      action: scratchpadLabel,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <StatTiles
        items={[
          { label: "Trigger", value: activationLabel, hint: config.hotkey || "Start / stop shortcut not set" },
          {
            label: "Capture",
            value: selectedAudioDeviceLabel,
            hint: `Cap ${formatDurationCompact(maxRecordingSeconds)} · ${autoStopLabel}`,
          },
          {
            label: "Delivery",
            value: deliveryLabel,
            hint: config.play_sounds ? "Sound cues on" : "Sound cues off",
          },
        ]}
      />

      <FormCard
        title="Overlay placement"
        description="Pick one default: either reopen the overlay where you last dragged it, or pin it to a chosen display anchor."
      >
        <FormRow
          label="Placement mode"
          control={
            <Select
              aria-label="Overlay placement mode"
              className="w-[240px]"
              value={overlayPlacementMode}
              onChange={(event) => onChange({ overlay_position_mode: event.target.value as OverlayPositionMode })}
            >
              <option value="manual">Remember last drag position</option>
              <option value="preset">Use preset display anchor</option>
            </Select>
          }
        />
        {overlayUsesPreset ? (
          <>
            <FormRow
              label="Display"
              control={
                <Select
                  aria-label="Overlay display"
                  className="w-[240px]"
                  value={selectedOverlayMonitor?.id ?? overlayMonitorValue}
                  onChange={(event) => onChange({ overlay_monitor: event.target.value })}
                >
                  {overlayMonitors.length === 0 ? (
                    <option value={overlayMonitorValue}>
                      {overlayError ? "Display lookup failed" : "Loading displays"}
                    </option>
                  ) : (
                    overlayMonitors.map((monitor) => (
                      <option key={monitor.id} value={monitor.id}>
                        {monitor.label}
                      </option>
                    ))
                  )}
                </Select>
              }
            />
            <FormRow
              label="Anchor"
              control={
                <Select
                  aria-label="Overlay anchor"
                  className="w-[180px]"
                  value={overlayAnchorValue}
                  onChange={(event) => onChange({ overlay_anchor: event.target.value as OverlayAnchor })}
                >
                  {OVERLAY_ANCHORS.map((anchor) => (
                    <option key={anchor.value} value={anchor.value}>
                      {anchor.label}
                    </option>
                  ))}
                </Select>
              }
            />
            <p className="py-3 text-[12px] leading-snug text-fg-dim">
              {overlayPlacementSummary} {overlayPlacementDetail}
            </p>
          </>
        ) : (
          <div className="py-3" aria-label="Remembered overlay placement details">
            <p className="text-[12px] leading-snug text-fg-dim">{overlayPlacementSummary}</p>
            <p className="mt-1 text-[12px] leading-snug text-fg-muted">{overlayPlacementDetail}</p>
          </div>
        )}
        <FormRow
          label="Result overlay timeout"
          hint="How long the result overlay stays visible before auto-dismissing. Editing the transcript pauses the timer."
          divider={false}
          control={
            <Stepper
              value={config.result_actions_timeout_ms}
              min={1000}
              max={60000}
              step={500}
              suffix={formatDurationCompact(Math.round(resultActionsTimeoutMs / 1000))}
              onChange={(value) => onChange({ result_actions_timeout_ms: value })}
              aria-label="Result overlay timeout"
            />
          }
        />
      </FormCard>

      <FormCard
        title="First dictation preflight"
        description="The next capture and insert cycle follows these native checks before it reaches recovery."
      >
        <div role="group" aria-label="First dictation preflight checklist" className="border-b border-border">
          {firstDictationPreflight.map((step) => (
            <FormRow
              key={step.id}
              label={step.label}
              hint={step.detail}
              align="start"
              control={
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge tone={step.ready ? "success" : "warning"} dot>
                    {step.state}
                  </StatusBadge>
                  <span className="text-right text-[11px] text-fg-muted">{step.action}</span>
                </div>
              }
            />
          ))}
        </div>
        <MetaRow
          label="Current capture"
          value={captureStatus?.is_recording ? "Recording now" : "Idle"}
          code={captureStatus?.device_name ?? selectedAudioDeviceLabel}
        />
        <MetaRow label="Insert driver" value={activeDriverLabel} code={platformStatus?.insert_strategy ?? "detecting"} />
        <MetaRow label="Insert preflight" value={insertPreflightLabel} code={platformStatus?.support_tier ?? "detecting"} />
        <MetaRow
          label="Recovery path"
          value={scratchpadLabel}
          code={insertion.status?.scratchpad_path ?? "Loading recovery store"}
        />
        <MetaRow
          label="Delivery mode"
          value={deliveryLabel}
          code={config.play_sounds ? "sound cues on" : "sound cues off"}
          divider={false}
        />
      </FormCard>

      <FormCard
        title="Shortcuts"
        description={
          <>
            Shortcuts are registered in the native trigger layer and stay active after this window closes. Use manual
            entry only when the desktop intercepts a key such as Win/Super on Linux.{" "}
            <span className="text-fg-dim">{HOTKEY_SEPARATOR_HINT}</span>
          </>
        }
      >
        {SHORTCUT_FIELDS.map((shortcut) => {
          const value = config[shortcut.field];
          const allowModifierOnly = true;
          const issue = getHotkeyValidationMessage(value, { allowModifierOnly });

          return (
            <FormRow
              key={shortcut.field}
              label={shortcut.label}
              hint={issue ?? shortcut.description}
              hintTone={issue ? "danger" : undefined}
              align="start"
              control={
                <div className="flex flex-col items-end gap-2">
                  <HotkeyRecorder
                    value={value}
                    allowModifierOnly={allowModifierOnly}
                    onChange={(nextValue) => updateShortcut(shortcut.field, nextValue)}
                    onStartRecording={pauseNativeTrigger}
                    onStopRecording={resumeNativeTrigger}
                  />
                  <Input
                    aria-label={`${shortcut.label} manual format`}
                    className="w-[200px] font-mono text-[12px]"
                    value={value}
                    placeholder={`e.g. ${shortcut.placeholder}`}
                    onChange={(event) => updateShortcut(shortcut.field, event.target.value)}
                    onBlur={() => normalizeShortcutField(shortcut.field)}
                  />
                </div>
              }
            />
          );
        })}
        <FormRow
          label="Activation mode"
          hint="Tap starts and stops on the same shortcut. Hold records while the shortcut is pressed and stops on release."
          divider={false}
          control={
            <Select
              aria-label="Activation mode"
              className="w-[180px]"
              value={config.activation_mode}
              onChange={(event) => onChange({ activation_mode: event.target.value as "tap" | "hold" })}
            >
              <option value="tap">Tap to toggle</option>
              <option value="hold">Hold to talk</option>
            </Select>
          }
        />
      </FormCard>

      <FormCard title="Microphone">
        <FormRow
          label="Input device"
          hint={audioStatusMessage}
          hintTone={audioError || !selectedAudioDeviceAvailable ? "danger" : undefined}
          align="start"
          control={
            <div className="flex items-center gap-2">
              <Select
                aria-label="Input device"
                className="w-[240px]"
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
              </Select>
              <Button
                size="icon-sm"
                variant="outline"
                aria-label="Refresh microphones"
                disabled={isRefreshingAudio}
                onClick={() => void refreshAudioSetup()}
              >
                <RefreshCw className={cn("size-3.5", isRefreshingAudio && "animate-spin")} />
              </Button>
            </div>
          }
        />
        <FormRow
          label="Max recording"
          control={
            <Stepper
              value={config.max_recording_seconds}
              min={10}
              max={3600}
              step={5}
              suffix={formatDurationCompact(maxRecordingSeconds)}
              onChange={(value) => onChange({ max_recording_seconds: value })}
              aria-label="Max recording"
            />
          }
        />
        <FormRow
          label="Silence timeout"
          hint="Max recording and silence timeout are enforced in the native capture monitor, not just in the UI. They keep working after this window is closed."
          divider={false}
          control={
            <Stepper
              value={config.silence_timeout_seconds}
              min={0}
              max={300}
              step={1}
              suffix={silenceTimeoutSeconds > 0 ? formatDurationCompact(silenceTimeoutSeconds) : "Disabled"}
              onChange={(value) => onChange({ silence_timeout_seconds: value })}
              aria-label="Silence timeout"
            />
          }
        />
      </FormCard>

      <FormCard title="Delivery">
        <FormRow
          label="Transcript delivery"
          hint={deliverySummary}
          align="start"
          control={
            <Select
              aria-label="Transcript delivery"
              className="w-[240px]"
              value={config.auto_paste ? "direct_insert" : "clipboard_only"}
              onChange={(event) => onChange({ auto_paste: event.target.value === "direct_insert" })}
            >
              <option value="direct_insert">Copy and insert at cursor</option>
              <option value="clipboard_only">Copy to clipboard only</option>
            </Select>
          }
        />
        <FormRow
          label="Native insert chain"
          hint={deliveryDriverSummary}
          align="start"
          control={
            <StatusBadge tone={platformStatus?.readiness === "ready" ? "success" : "warning"} dot>
              {activeDriverLabel}
            </StatusBadge>
          }
        />
        {portalDiagnosticSummary && (
          <FormRow
            label="Linux portal diagnostics"
            hint={portalDiagnosticSummary}
            hintTone="danger"
            align="start"
          />
        )}
        <FormRow
          label="Play sound feedback for start, stop, abort and errors"
          hint={soundSummary}
          htmlFor="play-sounds-toggle"
          divider={false}
          control={
            <Toggle
              id="play-sounds-toggle"
              checked={config.play_sounds}
              onCheckedChange={(checked) => onChange({ play_sounds: checked })}
            />
          }
        />
      </FormCard>

      <FormCard
        title="Recovery"
        description="Use recovery when direct insert failed, the target app ignored paste, or you want the latest transcript back without reopening diagnostics."
      >
        <FormRow
          label="Last recoverable transcript"
          align="start"
          control={
            <div className="flex flex-col items-end gap-1">
              <StatusBadge tone={insertion.status?.last_transcript ? "success" : "neutral"} dot>
                {insertion.status?.last_transcript ? "Available" : "No transcript stored yet"}
              </StatusBadge>
              {insertion.status?.last_transcript && (
                <span className="font-mono text-[11px] text-fg-muted">
                  {`${insertion.status.last_transcript.insert_mode} · ${recoveryActionLabel(latestRecoveryAction)}`}
                </span>
              )}
            </div>
          }
        />
        <FormRow
          label="Recovery scratchpad"
          hint={insertion.status?.scratchpad_path ?? "Loading recovery path"}
          align="start"
          control={
            <StatusBadge tone={scratchpadCount > 0 ? "success" : "neutral"} dot>
              {scratchpadLabel}
            </StatusBadge>
          }
        />
        <div className="flex flex-wrap gap-2 border-t border-border py-3">
          <Button
            size="sm"
            variant="outline"
            disabled={insertion.isLoading || !insertion.status?.last_transcript}
            onClick={() => void insertion.restoreLastTranscript()}
          >
            <RotateCcw /> Restore recoverable transcript
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={insertion.isLoading || !insertion.status?.scratchpad_entries.length}
            onClick={() => void insertion.clearScratchpad()}
          >
            <Trash2 /> Clear recovery scratchpad
          </Button>
        </div>
        <p
          className={cn(
            "text-[12px] leading-snug",
            insertion.error ? "text-[var(--red)]" : insertion.lastRestore ? "text-[var(--green)]" : "text-fg-dim",
          )}
        >
          {insertion.error
            ?? latestRecoveryMessage
            ?? (insertion.lastRestore
              ? "Recoverable transcript restored through native insertion."
              : `${scratchpadLabel} ready for recovery if direct insert fails.`)}
          {latestClipboardRestoreLabel ? ` ${latestClipboardRestoreLabel}.` : ""}
        </p>
      </FormCard>
    </div>
  );
}
