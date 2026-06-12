import { CheckCircle2, Circle, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormCard, FormRow, StatusBadge } from "@/components/shell";
import type { StatusTone } from "@/components/shell";
import { useNativeInsertion } from "@/hooks/useNativeInsertion";
import { relativeTime, truncate } from "@/lib/format";

const tierTone: Record<string, StatusTone> = {
  tier1: "success",
  preview: "info",
  experimental: "warning",
};

export function PermissionsArea() {
  const insertion = useNativeInsertion();
  const platform = insertion.status?.platform;
  const last = insertion.status?.last_transcript;
  const scratchpadCount = insertion.status?.scratchpad_entries.length ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <FormCard
        title="Insert readiness"
        description="Whether WordScript can place transcribed text into the focused app."
        action={
          <Button
            size="sm"
            variant="outline"
            disabled={insertion.isLoading}
            onClick={() => void insertion.refresh()}
          >
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        }
      >
        {platform ? (
          <>
            <FormRow
              label="Platform"
              control={
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-fg-dim">{platform.platform_label}</span>
                  <StatusBadge tone={tierTone[platform.support_tier] ?? "neutral"}>
                    {platform.support_tier}
                  </StatusBadge>
                </div>
              }
            />
            <FormRow
              label="Readiness"
              hint={platform.readiness_message}
              control={
                <StatusBadge tone={platform.readiness === "ready" ? "success" : "warning"} dot>
                  {platform.readiness === "ready" ? "Ready" : "Recovery only"}
                </StatusBadge>
              }
            />
            <FormRow
              label="Insert strategy"
              divider={false}
              control={
                <span className="font-mono text-[12px] text-fg-dim">
                  {platform.insert_strategy} · {platform.active_driver}
                </span>
              }
            />
          </>
        ) : (
          <div className="py-6 text-center text-[12px] text-fg-muted">
            Checking the native insert chain…
          </div>
        )}
      </FormCard>

      {platform && platform.driver_chain.length > 0 && (
        <FormCard title="Driver chain" description="Order WordScript tries to deliver text.">
          <ul className="flex flex-col">
            {platform.driver_chain.map((driver) => (
              <li
                key={driver.driver}
                className="flex items-start gap-3 border-b border-border py-2.5 last:border-b-0"
              >
                {driver.available ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--green)]" />
                ) : (
                  <Circle className="mt-0.5 size-4 shrink-0 text-fg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-foreground">{driver.label}</span>
                    {driver.active && <StatusBadge tone="accent">active</StatusBadge>}
                  </div>
                  <p className="mt-0.5 text-[12px] text-fg-dim">{driver.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </FormCard>
      )}

      {platform && (platform.prerequisites.length > 0 || platform.caveats.length > 0) && (
        <FormCard title="Prerequisites & limits">
          {platform.prerequisites.map((item, i) => (
            <FormRow key={`pre-${i}`} label={<span className="font-normal text-fg-dim">{item}</span>} />
          ))}
          {platform.caveats.map((item, i) => (
            <FormRow
              key={`cav-${i}`}
              divider={i < platform.caveats.length - 1}
              label={<span className="font-normal text-[var(--orange)]">{item}</span>}
            />
          ))}
        </FormCard>
      )}

      <FormCard
        title="Recovery"
        description="If an insert fails, the last transcript is buffered so it is never lost."
      >
        <FormRow
          label="Last buffered transcript"
          hint={last ? truncate(last.text, 90) : "Nothing buffered."}
          control={
            last ? (
              <span className="text-[11px] tabular-nums text-fg-muted">
                {relativeTime(last.created_at_ms)}
              </span>
            ) : undefined
          }
        />
        <FormRow
          label="Scratchpad"
          hint={`${scratchpadCount} buffered ${scratchpadCount === 1 ? "entry" : "entries"} at ${insertion.status?.scratchpad_path ?? "—"}`}
          divider={false}
          control={
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={!last || insertion.isLoading}
                onClick={() => void insertion.restoreLastTranscript()}
              >
                <RotateCcw className="size-3.5" /> Restore
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={scratchpadCount === 0 || insertion.isLoading}
                onClick={() => void insertion.clearScratchpad()}
              >
                <Trash2 className="size-3.5" /> Clear
              </Button>
            </div>
          }
        />
      </FormCard>

      {insertion.error && (
        <p className="text-[12px] text-[var(--red)]">{insertion.error}</p>
      )}
    </div>
  );
}
