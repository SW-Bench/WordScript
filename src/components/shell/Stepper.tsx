import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  id?: string;
  className?: string;
  "aria-label"?: string;
}

/** macOS-style numeric stepper: -, editable field, +, optional unit suffix. */
export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  id,
  className,
  ...rest
}: StepperProps) {
  const clamp = (n: number) =>
    Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, n));

  const commit = (n: number) => {
    if (Number.isNaN(n)) return;
    onChange(clamp(n));
  };

  return (
    <div
      className={cn(
        "inline-flex items-center overflow-hidden rounded-md border border-border bg-surface-strong",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Decrease"
        disabled={min !== undefined && value <= min}
        onClick={() => commit(value - step)}
        className="flex size-7 items-center justify-center text-fg-dim transition-colors hover:text-foreground disabled:opacity-30"
      >
        <Minus className="size-3.5" />
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={rest["aria-label"]}
        onChange={(e) => commit(Number(e.target.value))}
        className="w-12 border-x border-border bg-transparent py-1 text-center text-[13px] tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        aria-label="Increase"
        disabled={max !== undefined && value >= max}
        onClick={() => commit(value + step)}
        className="flex size-7 items-center justify-center text-fg-dim transition-colors hover:text-foreground disabled:opacity-30"
      >
        <Plus className="size-3.5" />
      </button>
      {suffix && (
        <span className="px-2 text-[12px] text-fg-muted select-none">{suffix}</span>
      )}
    </div>
  );
}
