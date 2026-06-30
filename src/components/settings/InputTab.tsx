import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw } from "lucide-react";
import { HOTKEY_SEPARATOR_HINT, getHotkeyValidationMessage, normalizeManualHotkey } from "../../lib/hotkeys";
import { FormCard, FormRow, Select, StatTiles, Stepper } from "../shell";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import type { AppConfig } from "../../types/ipc";
import { HotkeyRecorder } from "./HotkeyRecorder";
import {
  buildProfileCapturePatch,
  resolveActiveTextProfile,
  resolveProfileCaptureSettings,
} from "../../lib/textProfiles";

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

export function InputTab({ config, onChange }: Props) {
  const [audioDevices, setAudioDevices] = useState<NativeInputDevice[]>([]);
  const [captureStatus, setCaptureStatus] = useState<NativeCaptureStatus | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isRefreshingAudio, setIsRefreshingAudio] = useState(false);
  const pauseNativeTrigger = () => { void invoke("pause_native_trigger").catch(() => {}); };
  const resumeNativeTrigger = () => { void invoke("resume_native_trigger").catch(() => {}); };

  // Read capture settings from active profile
  const activeProfile = resolveActiveTextProfile(config);
  const capture = resolveProfileCaptureSettings(activeProfile);

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

  const defaultAudioDevice = useMemo(
    () => audioDevices.find((device) => device.is_default) ?? null,
    [audioDevices],
  );
  const maxRecordingSeconds = clampCaptureNumber(capture.max_recording_seconds, 60, 1800, 720);
  const silenceTimeoutSeconds = clampCaptureNumber(capture.silence_timeout_seconds, 0, 60, 30);
  const hasExplicitAudioDevice = Boolean(config.audio_device.trim());
  const selectedAudioDeviceAvailable = !hasExplicitAudioDevice || audioDevices.some((device) => device.name === config.audio_device);
  const selectedAudioDeviceLabel = hasExplicitAudioDevice
    ? config.audio_device
    : defaultAudioDevice?.name ?? "System default microphone";
  const activationLabel = config.activation_mode === "hold" ? "Hold to talk" : "Tap to toggle";
  const autoStopLabel = silenceTimeoutSeconds > 0
    ? `${formatDurationCompact(silenceTimeoutSeconds)} silence`
    : "Manual stop";
  const startHotkeyIssue = getHotkeyValidationMessage(config.hotkey, { allowModifierOnly: true });
  const audioStatusMessage = audioError
    ? audioError
    : captureStatus?.is_recording && captureStatus.device_name
      ? `Current capture is still using ${captureStatus.device_name}. Any new mic selection applies to the next recording.`
      : !selectedAudioDeviceAvailable
        ? `Saved microphone is not available right now. WordScript will fall back to ${defaultAudioDevice?.name ?? "the system default microphone"} on the next capture.`
        : `Next capture will use ${selectedAudioDeviceLabel}.`;

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
        ]}
      />

      <FormCard
        title="Shortcuts"
        description={
          <>
            Shortcuts are registered in the native trigger layer and stay active after this window closes. Use manual
            entry only when the desktop intercepts a key such as Win/Super on Linux.{" "}
            <span className="text-fg-dim">{HOTKEY_SEPARATOR_HINT}</span>
            <span className="block text-fg-muted">Mode hotkeys (picker, cycle, per-mode) live in Modes.</span>
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
          hint="Maximum recording length in minutes (1–30). Enforced in the native capture monitor — keeps working after this window is closed."
          control={
            <Stepper
              value={Math.round(capture.max_recording_seconds / 60)}
              min={1}
              max={30}
              step={1}
              suffix="min"
              onChange={(value) => onChange(buildProfileCapturePatch(config, { max_recording_seconds: value * 60 }))}
              aria-label="Max recording"
            />
          }
        />
        <FormRow
          label="Silence timeout"
          hint="Auto-stop after this many seconds of silence (0 = disabled, max 60). Enforced in the native capture monitor — keeps working after this window is closed."
          divider={false}
          control={
            <Stepper
              value={capture.silence_timeout_seconds}
              min={0}
              max={60}
              step={1}
              suffix={silenceTimeoutSeconds > 0 ? "s" : "Disabled"}
              onChange={(value) => onChange(buildProfileCapturePatch(config, { silence_timeout_seconds: value }))}
              aria-label="Silence timeout"
            />
          }
        />
      </FormCard>
    </div>
  );
}