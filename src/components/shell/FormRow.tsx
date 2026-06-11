import * as React from "react";
import { cn } from "@/lib/utils";

interface FormRowProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  /** Tone for the hint text. "danger" surfaces validation problems. */
  hintTone?: "default" | "danger";
  htmlFor?: string;
  /** Trailing control (right aligned). Ignored when `layout="stacked"`. */
  control?: React.ReactNode;
  /** Default: control sits to the right. "stacked": control spans full width below the label. */
  layout?: "inline" | "stacked";
  align?: "center" | "start";
  /** Drop the bottom hairline (e.g. last row handled by parent). */
  divider?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * A single settings row inside a FormCard: label (+ hint) on the left, control
 * on the right, hairline divider below. The label/control rhythm mirrors macOS
 * System Settings grouped forms.
 */
export function FormRow({
  label,
  hint,
  hintTone = "default",
  htmlFor,
  control,
  layout = "inline",
  align = "center",
  divider = true,
  className,
  children,
}: FormRowProps) {
  const trailing = control ?? children;
  const hintClass = cn(
    "mt-0.5 text-[12px] leading-snug",
    hintTone === "danger" ? "text-[var(--red)]" : "text-fg-dim",
  );

  if (layout === "stacked") {
    return (
      <div
        className={cn(
          "py-3",
          divider && "border-b border-border last:border-b-0",
          className,
        )}
      >
        {(label || hint) && (
          <div className="mb-2">
            {label && (
              <label
                htmlFor={htmlFor}
                className="block text-[13px] font-medium text-foreground"
              >
                {label}
              </label>
            )}
            {hint && <p className={hintClass}>{hint}</p>}
          </div>
        )}
        {trailing}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-[48px] gap-4 py-3",
        align === "start" ? "items-start" : "items-center",
        divider && "border-b border-border last:border-b-0",
        className,
      )}
    >
      {(label || hint) && (
        <div className="min-w-0 flex-1">
          {label && (
            <label
              htmlFor={htmlFor}
              className="block text-[13px] font-medium text-foreground"
            >
              {label}
            </label>
          )}
          {hint && <p className={hintClass}>{hint}</p>}
        </div>
      )}
      {trailing && (
        <div className="flex shrink-0 items-center justify-end gap-2">
          {trailing}
        </div>
      )}
    </div>
  );
}
