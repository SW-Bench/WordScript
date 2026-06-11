import * as React from "react";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * macOS-style pop-up button backed by a native <select>. Native select keeps
 * keyboard/scroll behavior correct and feels closer to a system control than a
 * custom listbox for long option lists (languages, models).
 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select">
>(({ className, children, ...props }, ref) => (
  <div className="relative inline-flex w-full max-w-full">
    <select
      ref={ref}
      className={cn(
        "w-full appearance-none rounded-md border border-border bg-surface-strong py-1.5 pl-3 pr-8 text-[13px] text-foreground outline-none transition-colors hover:border-border-strong focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronsUpDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-fg-muted" />
  </div>
));
Select.displayName = "Select";
