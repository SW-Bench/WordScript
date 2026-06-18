import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/shell";
import type { StatusDotTone } from "@/components/shell";
import { relativeTime, truncate } from "@/lib/format";
import type { TranscriptionHistoryEntry } from "@/types/history";

interface HomeRecentListProps {
  entries: TranscriptionHistoryEntry[];
  onNavigate: (id: string) => void;
}

export function HomeRecentList({ entries, onNavigate }: HomeRecentListProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-lg font-semibold leading-tight tracking-[-0.005em]">Recent dictations</h2>
        </div>
        <Button size="sm" variant="ghost" onClick={() => onNavigate("history")}>
          <History className="size-3.5" /> View all
        </Button>
      </div>

      <div className="rounded-lg border border-border-strong bg-bg-surface p-5">
        {entries.length === 0 ? (
          <div className="py-12 text-center text-sm text-fg-muted">
            No dictations yet. Trigger your shortcut to make the first one.
          </div>
        ) : (
          <ul className="flex flex-col">
            {entries.map((entry, index) => {
              const text =
                entry.transformed_transcript ||
                entry.raw_transcript ||
                (entry.status === "failed" ? entry.error ?? "Failed" : "Empty capture");

              const tone: StatusDotTone =
                entry.status === "completed"
                  ? "success"
                  : entry.status === "failed"
                    ? "error"
                    : "neutral";

              const isLast = index === entries.length - 1;
              void isLast;

              return (
                <li
                  key={entry.id}
                  className="ws-list-item-compact group flex min-h-[44px] items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-bg-elevated"
                >
                  <StatusDot
                    tone={tone}
                    label={entry.status}
                    className="mt-1.5"
                  />
                  <p className="min-w-0 flex-1 text-sm leading-snug text-fg-dim">
                    {truncate(text, 110)}
                  </p>
                  <span className="shrink-0 text-xs tabular-nums text-fg-muted">
                    {relativeTime(entry.created_at_ms)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
