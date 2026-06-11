import * as React from "react";
import { cn } from "@/lib/utils";

interface FormCardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

/**
 * Grouped inset "form" card — the core macOS System Settings idiom.
 *
 * The group title/description sit OUTSIDE the card as a calm, sentence-case
 * header (exactly like System Settings); the card itself is a clearly elevated,
 * rounded surface holding a stack of FormRow children separated by hairlines.
 * Elevation comes from background + a single hairline, not heavy shadow.
 */
export function FormCard({
  title,
  description,
  action,
  icon,
  className,
  bodyClassName,
  children,
}: FormCardProps) {
  const hasHeader = Boolean(title || description || action);
  return (
    <section className="flex flex-col gap-2.5">
      {hasHeader && (
        <div className="flex items-end justify-between gap-3 px-1">
          <div className="flex min-w-0 items-center gap-2">
            {icon && <span className="text-fg-muted [&_svg]:size-4">{icon}</span>}
            <div className="min-w-0">
              {title && (
                <h3 className="text-[13px] font-semibold leading-tight text-foreground">
                  {title}
                </h3>
              )}
              {description && (
                <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">
                  {description}
                </p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div
        className={cn(
          "rounded-[10px] border border-border bg-card px-5 shadow-card",
          bodyClassName,
          className,
        )}
      >
        {children}
      </div>
    </section>
  );
}
