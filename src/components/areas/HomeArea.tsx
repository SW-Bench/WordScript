import { useMemo } from "react";
import { ArrowRight, History, Mic, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormCard, FormRow, StatusBadge } from "@/components/shell";
import type { StatusTone } from "@/components/shell";
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
    <div className="flex flex-col gap-6">
      <FormCard title="Runtime status" description="What WordScript can do right now.">
        <FormRow
          label="Transcription"
          hint={readiness.title}
          control={
            <div className="flex items-center gap-2">
              <StatusBadge tone={readiness.ok ? "success" : "warning"} dot>
                {readiness.label}
              </StatusBadge>
              {!providerReady && (
                <Button size="sm" variant="outline" onClick={() => onNavigate("speech")}>
                  Fix
                </Button>
              )}
            </div>
          }
        />
        <FormRow
          label="Insert path"
          hint={platform?.readiness_message ?? "Checking the native insert chain…"}
          control={
            <div className="flex items-center gap-2">
              <StatusBadge tone={insertReady ? "success" : "warning"} dot>
                {platform ? (insertReady ? "Ready" : "Recovery only") : "Checking"}
              </StatusBadge>
              {platform && !insertReady && (
                <Button size="sm" variant="outline" onClick={() => onNavigate("permissions")}>
                  Review
                </Button>
              )}
            </div>
          }
        />
        <FormRow
          label="Active profile"
          hint="Dictionary, snippets and context bias for your dictation."
          divider={false}
          control={
            <div className="flex items-center gap-2">
              <StatusBadge tone="accent">{profile.label}</StatusBadge>
              <Button size="sm" variant="ghost" onClick={() => onNavigate("profiles")}>
                Open
              </Button>
            </div>
          }
        />
      </FormCard>

      <FormCard
        title="Recent dictations"
        description="The last few captures from this machine."
        action={
          <Button size="sm" variant="ghost" onClick={() => onNavigate("history")}>
            <History className="size-3.5" /> View all
          </Button>
        }
      >
        {recent.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-fg-muted">
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
                  className="flex items-start gap-3 border-b border-border py-2.5 last:border-b-0"
                >
                  <StatusBadge tone={tone} dot>
                    {entry.status}
                  </StatusBadge>
                  <p className="min-w-0 flex-1 text-[12px] leading-snug text-fg-dim">
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
              ? `Re-deliver the last captured text (${truncate(lastTranscript.text, 48)}).`
              : "Nothing buffered in the recovery scratchpad yet."
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
          label="Capture & shortcuts"
          hint="Review your hotkey, microphone and delivery setup."
          divider={false}
          control={
            <Button size="sm" variant="ghost" onClick={() => onNavigate("capture")}>
              <Mic className="size-3.5" /> Open <ArrowRight className="size-3.5" />
            </Button>
          }
        />
      </FormCard>
    </div>
  );
}
