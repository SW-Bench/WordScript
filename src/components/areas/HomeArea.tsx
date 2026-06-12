import { useMemo } from "react";
import { ArrowRight, History, Mic, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormCard, FormRow, StatusBadge } from "@/components/shell";
import type { StatusTone } from "@/components/shell";
import { cn } from "@/lib/utils";
import { useTranscriptionHistory } from "@/hooks/useTranscriptionHistory";
import { useNativeInsertion } from "@/hooks/useNativeInsertion";
import { resolveActiveTextProfile } from "@/lib/textProfiles";
import { relativeTime, truncate } from "@/lib/format";
import type { AppConfig } from "@/types/ipc";

interface Readiness {
  label: string;
  title: string;
  ok: boolean;
}

interface HomeAreaProps {
  isActive: boolean;
  config: AppConfig;
  readiness: Readiness;
  providerReady: boolean;
  laneLabel: string;
  onNavigate: (id: string) => void;
}

export function HomeArea({
  isActive,
  config,
  readiness,
  providerReady,
  laneLabel,
  onNavigate,
}: HomeAreaProps) {
  const history = useTranscriptionHistory(isActive);
  const insertion = useNativeInsertion();
  const profile = useMemo(() => resolveActiveTextProfile(config), [config]);

  const recent = history.entries.slice(0, 5);
  const platform = insertion.status?.platform;
  const insertReady = platform?.readiness === "ready";
  const lastTranscript = insertion.status?.last_transcript;

  return (
    <div className="flex flex-col gap-8">
      <section
        className={cn(
          "relative overflow-hidden rounded-[16px] border border-border bg-card px-6 py-5 shadow-card",
          readiness.ok ? "" : "border-[var(--orange)]/30",
        )}
      >
        <div className="flex items-center gap-5">
          <div
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-[14px]",
              readiness.ok
                ? "bg-[color-mix(in_srgb,var(--green)_18%,transparent)]"
                : "bg-[color-mix(in_srgb,var(--orange)_18%,transparent)]",
            )}
            aria-hidden
          >
            <StatusBadge tone={readiness.ok ? "success" : "warning"} dot>
              {readiness.ok ? "Ready" : "Setup"}
            </StatusBadge>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[18px] font-semibold leading-tight tracking-[-0.01em]">
                {readiness.ok ? "Ready to dictate" : "Almost there"}
              </h2>
              <span className="rounded-full bg-surface-strong px-2 py-0.5 text-[11px] font-medium text-fg-dim">
                {laneLabel}
              </span>
            </div>
            <p className="mt-1 truncate text-[12.5px] leading-snug text-fg-muted">
              {readiness.title}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!readiness.ok && (
              <Button size="sm" onClick={() => onNavigate("speech")}>
                Set up
              </Button>
            )}
            <Button size="sm" variant={readiness.ok ? "secondary" : "outline"} onClick={() => onNavigate("capture")}>
              <Mic className="size-3.5" /> Capture
            </Button>
          </div>
        </div>
      </section>

      <FormCard title="Insert path">
        <FormRow
          label={insertReady ? "Direct paste available" : "Recovery only"}
          hint={platform?.readiness_message ?? "Checking the native insert chain…"}
          divider={false}
          control={
            <div className="flex items-center gap-2">
              <StatusBadge tone={insertReady ? "success" : "warning"} dot>
                {platform ? (insertReady ? "Ready" : "Fallback") : "Checking"}
              </StatusBadge>
              {platform && !insertReady && (
                <Button size="sm" variant="ghost" onClick={() => onNavigate("permissions")}>
                  Review
                </Button>
              )}
            </div>
          }
        />
      </FormCard>

      <FormCard
        title="Recent dictations"
        action={
          <Button size="sm" variant="ghost" onClick={() => onNavigate("history")}>
            <History className="size-3.5" /> View all
          </Button>
        }
      >
        {recent.length === 0 ? (
          <div className="py-8 text-center text-[12.5px] text-fg-muted">
            No dictations yet. Trigger your shortcut to make the first one.
          </div>
        ) : (
          <ul className="flex flex-col">
            {recent.map((entry) => {
              const text =
                entry.transformed_transcript ||
                entry.raw_transcript ||
                (entry.status === "failed" ? entry.error ?? "Failed" : "Empty capture");
              const tone: StatusTone =
                entry.status === "completed"
                  ? "success"
                  : entry.status === "failed"
                    ? "error"
                    : "neutral";
              return (
                <li
                  key={entry.id}
                  className="flex items-start gap-3 border-b border-border py-3 last:border-b-0 first:pt-1"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      tone === "success" && "bg-[var(--green)]",
                      tone === "error" && "bg-[var(--red)]",
                      tone === "neutral" && "bg-fg-muted",
                    )}
                  />
                  <p className="min-w-0 flex-1 text-[13px] leading-snug text-fg-dim">
                    {truncate(text, 110)}
                  </p>
                  <span className="shrink-0 text-[11px] tabular-nums text-fg-muted">
                    {relativeTime(entry.created_at_ms)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </FormCard>

      <FormCard title="Quick actions">
        <FormRow
          label="Restore last transcript"
          hint={
            lastTranscript
              ? `Re-deliver “${truncate(lastTranscript.text, 48)}”.`
              : "Nothing buffered yet."
          }
          control={
            <Button
              size="sm"
              variant="secondary"
              disabled={!lastTranscript || insertion.isLoading}
              onClick={() => void insertion.restoreLastTranscript()}
            >
              <RotateCcw className="size-3.5" /> Restore
            </Button>
          }
        />
        <FormRow
          label="Shortcuts & microphone"
          hint="Hotkey, microphone and delivery."
          divider={false}
          control={
            <Button size="sm" variant="ghost" onClick={() => onNavigate("capture")}>
              Open <ArrowRight className="size-3.5" />
            </Button>
          }
        />
      </FormCard>
    </div>
  );
}
