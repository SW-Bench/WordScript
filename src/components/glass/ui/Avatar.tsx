import * as React from "react";
import { cn } from "./lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg";
  status?: "online" | "offline" | "away" | "busy";
}

const sizeClasses = {
  sm: "w-7 h-7 text-[11px]",
  md: "w-9 h-9 text-[12px]",
  lg: "w-11 h-11 text-[13px]",
};

const statusColors = {
  online: "bg-[var(--green)]",
  offline: "bg-[var(--fg-muted)]",
  away: "bg-[var(--orange)]",
  busy: "bg-[var(--red)]",
};

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  (
    { className, src, alt, fallback, size = "md", status, ...props },
    ref
  ) => {
    const [error, setError] = React.useState(false);
    const initials = fallback
      ?.split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    return (
      <div ref={ref} className={cn("relative inline-block", className)} {...props}>
        <div
          className={cn(
            "rounded-full overflow-hidden bg-[var(--surface-3)] flex items-center justify-center font-semibold text-[var(--fg-dim)] select-none",
            "shadow-[inset_0_0_0_1px_var(--hairline-strong)]",
            sizeClasses[size]
          )}
        >
          {src && !error ? (
            <img
              src={src}
              alt={alt}
              className="w-full h-full object-cover"
              onError={() => setError(true)}
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        {status && (
          <span
            className={cn(
              "absolute bottom-0 right-0 rounded-full ring-2 ring-[var(--surface-1)]",
              statusColors[status],
              size === "sm" ? "w-2 h-2" : size === "md" ? "w-2.5 h-2.5" : "w-3 h-3"
            )}
          />
        )}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  max?: number;
}

export function AvatarGroup({
  children,
  max,
  className,
  ...props
}: AvatarGroupProps) {
  const childArray = React.Children.toArray(children);
  const visible = max ? childArray.slice(0, max) : childArray;
  const remaining = max ? Math.max(0, childArray.length - max) : 0;

  return (
    <div className={cn("flex items-center -space-x-2", className)} {...props}>
      {visible.map((child, i) => (
        <div key={i} className="relative ring-2 ring-[var(--surface-1)] rounded-full">
          {child}
        </div>
      ))}
      {remaining > 0 && (
        <div className="relative ring-2 ring-[var(--surface-1)] rounded-full w-9 h-9 flex items-center justify-center bg-[var(--surface-3)] text-[var(--fg-dim)] text-[12px] font-semibold">
          +{remaining}
        </div>
      )}
    </div>
  );
}
