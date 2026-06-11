import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface InspectorProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  children: React.ReactNode;
}

/**
 * Right-side slide-over for editing a single item (a profile, a per-app rule, a
 * dictionary entry). Positioned absolutely inside its relative content area, so
 * the native window chrome is untouched. Replaces long inline edit lists.
 */
export function Inspector({
  open,
  onClose,
  title,
  description,
  footer,
  width = 380,
  children,
}: InspectorProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "absolute inset-0 z-40 bg-black/40 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        style={{ width }}
        className={cn(
          "absolute inset-y-0 right-0 z-50 flex flex-col border-l border-border bg-surface-elevated shadow-[var(--shadow-modal)] transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            {title && (
              <h2 className="truncate text-[15px] font-semibold text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-[12px] text-fg-dim">{description}</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-fg-dim transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
            {footer}
          </footer>
        )}
      </aside>
    </>
  );
}
