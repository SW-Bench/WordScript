import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DisclosureRowProps {
  title?: React.ReactNode;
  defaultOpen?: boolean;
  /** Controlled open state (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  divider?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Progressive-disclosure section inside a FormCard. Hides power-user controls
 * behind an "Advanced" chevron so the surface stays calm by default.
 */
export function DisclosureRow({
  title = "Advanced",
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  divider = true,
  className,
  children,
}: DisclosureRowProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;

  const toggle = () => {
    const next = !open;
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div className={cn(divider && "border-b border-border last:border-b-0", className)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className="flex w-full items-center gap-1.5 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-muted transition-colors hover:text-foreground"
      >
        <ChevronRight
          className={cn("size-3.5 transition-transform duration-150", open && "rotate-90")}
        />
        {title}
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}
