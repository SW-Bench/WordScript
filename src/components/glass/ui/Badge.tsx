import * as React from "react";
import { cn } from "./lib/utils";

export type BadgeVariant =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "destructive"
  | "outline";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:
    "bg-[var(--surface-3)] text-[var(--fg-dim)]",
  primary:
    "bg-[var(--accent-soft)] text-[var(--accent)] font-semibold border border-[var(--accent)]/15",
  secondary:
    "bg-[var(--surface-2)] text-[var(--fg-dim)] border border-[var(--hairline)]",
  success: "bg-[var(--green)]/15 text-[var(--green)] font-semibold border border-[var(--green)]/20",
  warning: "bg-[var(--orange)]/15 text-[var(--orange)] font-semibold border border-[var(--orange)]/20",
  destructive: "bg-[var(--red)]/15 text-[var(--red)] font-semibold border border-[var(--red)]/20",
  outline:
    "bg-transparent text-[var(--fg-dim)] border border-[var(--hairline-strong)]",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-[var(--radius-badge)] px-2 py-0.5 text-[11px] font-medium transition-colors",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
);
Badge.displayName = "Badge";
