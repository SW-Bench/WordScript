import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FormCard, FormRow, Select, Stepper } from "../shell";
import type { AppConfig, OverlayAnchor, OverlayPositionMode } from "../../types/ipc";

interface Props {
  config: AppConfig;
  onChange: (p: Partial<AppConfig>) => void;
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

function clampOverlayTimeout(value: number) {
  if (!Number.isFinite(value)) return 9000;
  return Math.min(60000, Math.max(1000, Math.round(value)));
}

export function OverlayTab({ config, onChange }: Props) {
  const [overlayMonitors, setOverlayMonitors] = useState<OverlayMonitorOption[]>([]);
  const [overlayError, setOverlayError] = useState<string | null>(null);

  const refreshMonitors = useCallback(async () => {
    try {
      const monitors = await invoke<OverlayMonitorOption[]>("overlay_monitor_options");
      setOverlayMonitors(monitors);
      setOverlayError(null);
    } catch (cause) {
      setOverlayError(String(cause));
    }
  }, []);

  useEffect(() => {
    void refreshMonitors();
  }, [refreshMonitors]);

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
  const resultActionsTimeoutMs = clampOverlayTimeout(config.result_actions_timeout_ms);

  return (
    <div className="flex flex-col gap-8">
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
      </FormCard>

      <FormCard
        title="Result overlay"
        description="How long the result overlay stays visible before auto-dismissing. Editing the transcript pauses the timer."
      >
        <FormRow
          label="Result overlay timeout"
          hint="Shorter timeouts keep the overlay transient; longer timeouts give you time to edit before it disappears."
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
    </div>
  );
}