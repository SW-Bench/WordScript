import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusTone =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "accent"
  | "neutral";

const toneClasses: Record<StatusTone, string> = {
  success: "bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-[var(--green)]",
  warning: "bg-[color-mix(in_srgb,var(--orange)_16%,transparent)] text-[var(--orange)]",
  error: "bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-[var(--red)]",
  info: "bg-[color-mix(in_srgb,var(--voice)_16%,transparent)] text-[var(--voice)]",
  accent: "bg-brand-soft text-brand-strong",
  neutral: "bg-surface-strong text-fg-dim",
};

const dotClasses: Record<StatusTone, string> = {
  success: "bg-[var(--green)]",
  warning: "bg-[var(--orange)]",
  error: "bg-[var(--red)]",
  info: "bg-[var(--voice)]",
  accent: "bg-brand",
  neutral: "bg-fg-muted",
};

interface StatusBadgeProps {
  tone?: StatusTone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Small status pill used in headers, cards and the Home dashboard. */
export function StatusBadge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {dot && (
        <span className={cn("size-1.5 rounded-full", dotClasses[tone])} aria-hidden />
      )}
      {children}
    </span>
  );
}
