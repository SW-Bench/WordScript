import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusDotTone =
  | "success"
  | "warning"
  | "error"
  | "neutral";

const toneClasses: Record<StatusDotTone, string> = {
  success: "bg-[var(--green)]",
  warning: "bg-[var(--orange)]",
  error: "bg-[var(--red)]",
  neutral: "bg-fg-muted",
};

interface StatusDotProps {
  tone?: StatusDotTone;
  label?: string;
  className?: string;
}

/** 8 px status dot used across Home, lists and diagnostics.
 *
 * This is the single source of truth for the small colored dot pattern.
 * Do not inline ad-hoc `size-1.5 rounded-full` spans; import this instead.
 */
export function StatusDot({ tone = "neutral", label, className }: StatusDotProps) {
  return (
    <span
      aria-label={label}
      className={cn("inline-block size-2 shrink-0 rounded-full", toneClasses[tone], className)}
      aria-hidden={!label}
    />
  );
}
