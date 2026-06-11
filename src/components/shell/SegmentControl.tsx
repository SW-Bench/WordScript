import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface SegmentControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "default";
  className?: string;
  "aria-label"?: string;
}

/**
 * macOS-style segmented control. One translucent track, the active segment is
 * an elevated chip. Used for binary/few-way choices (cloud/local, tap/hold,
 * delivery mode) instead of radio groups.
 */
export function SegmentControl<T extends string>({
  options,
  value,
  onChange,
  size = "default",
  className,
  ...rest
}: SegmentControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={rest["aria-label"]}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg bg-surface-strong p-0.5",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={opt.disabled}
            onClick={() => !opt.disabled && onChange(opt.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-all duration-100 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-40",
              size === "sm" ? "h-6 px-2.5 text-[11px]" : "h-7 px-3 text-[13px]",
              active
                ? "bg-surface-elevated text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
                : "text-fg-dim hover:text-foreground",
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
