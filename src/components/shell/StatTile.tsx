import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatTileItem {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** Render the value in the brand accent (e.g. an active selection). */
  accent?: boolean;
}

interface StatTilesProps {
  items: StatTileItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

/**
 * A compact row of "info tiles" — the small at-a-glance summary blocks macOS
 * uses at the top of a settings pane (lane / model / status). Elevated like a
 * card, calm sentence-case label, one strong value, optional hint.
 */
export function StatTiles({ items, columns = 3, className }: StatTilesProps) {
  return (
    <div
      className={cn(
        "grid gap-3",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-3",
        columns === 4 && "grid-cols-4",
        className,
      )}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className="min-w-0 rounded-lg border border-border bg-card px-4 py-3.5 shadow-card"
        >
          <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-fg-muted">
            {item.label}
          </div>
          <div
            className={cn(
              "mt-1.5 truncate text-[15px] font-semibold leading-tight tracking-[-0.005em]",
              item.accent ? "text-brand-strong" : "text-foreground",
            )}
            title={typeof item.value === "string" ? item.value : undefined}
          >
            {item.value}
          </div>
          {item.hint && (
            <div className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-fg-muted">
              {item.hint}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
