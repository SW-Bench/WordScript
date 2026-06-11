import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "./lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "accent" | "success" | "warning" | "error";
  showValue?: boolean;
  indeterminate?: boolean;
}

const sizeClasses = {
  sm: "h-1",
  md: "h-1.5",
  lg: "h-2.5",
};

const variantColors = {
  default: "var(--accent)",
  accent: "var(--accent)",
  success: "var(--green)",
  warning: "var(--orange)",
  error: "var(--red)",
};

const glowColors = {
  default: "var(--accent-glow)",
  accent: "var(--accent-glow)",
  success: "rgba(129,214,174,0.30)",
  warning: "rgba(230,137,0,0.30)",
  error: "rgba(255,122,107,0.30)",
};

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      className,
      value,
      max = 100,
      size = "md",
      variant = "default",
      showValue = false,
      indeterminate = false,
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    const color = variantColors[variant];
    const glow = glowColors[variant];

    return (
      <div
        ref={ref}
        className={cn("flex items-center gap-3", className)}
        {...props}
      >
        <div
          className={cn(
            "flex-1 rounded-full bg-[var(--surface-3)] overflow-hidden",
            sizeClasses[size]
          )}
        >
          {indeterminate ? (
            <div className="relative h-full w-full overflow-hidden">
              <motion.div
                className="absolute h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
                }}
                initial={{ left: "-100%", width: "100%" }}
                animate={{ left: "100%" }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            </div>
          ) : (
            <motion.div
              className="h-full rounded-full"
              style={{
                background: color,
                boxShadow: `0 0 8px ${glow}`,
              }}
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            />
          )}
        </div>
        {showValue && !indeterminate && (
          <span className="text-[11px] text-[var(--fg-muted)] tabular-nums min-w-[2.5rem] text-right font-medium">
            {Math.round(percentage)}%
          </span>
        )}
      </div>
    );
  }
);
Progress.displayName = "Progress";

interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  variant?: "default" | "accent" | "success" | "warning" | "error";
  showValue?: boolean;
  className?: string;
}

export function CircularProgress({
  value,
  max = 100,
  size = 40,
  strokeWidth = 3,
  variant = "default",
  showValue = false,
  className,
}: CircularProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  const color = variantColors[variant];
  const glow = glowColors[variant];

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          style={{ filter: `drop-shadow(0 0 4px ${glow})` }}
        />
      </svg>
      {showValue && (
        <span className="absolute text-[11px] text-[var(--fg)] font-semibold">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
}
