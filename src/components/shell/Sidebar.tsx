import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Disabled future area: shown dimmed with a "coming later" tooltip. */
  preview?: boolean;
  badge?: React.ReactNode;
}

export interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

interface SidebarProps {
  groups: SidebarGroup[];
  activeId: string;
  onSelect: (id: string) => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Finder-style grouped navigation. 200px, translucent, uppercase section
 * headers, 4px accent stripe + aria-current on the active item. Non-scrolling
 * by design; if items overflow, reduce density rather than scroll.
 */
export function Sidebar({
  groups,
  activeId,
  onSelect,
  header,
  footer,
  className,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full w-[200px] shrink-0 flex-col border-r border-border bg-sidebar",
        className,
      )}
    >
      {header && <div className="shrink-0">{header}</div>}

      <nav
        aria-label="WordScript sections"
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 py-3"
      >
        {groups.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <h2 className="px-2 pb-1.5 text-[11px] font-semibold tracking-[0.01em] text-fg-muted">
              {group.label}
            </h2>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.id}>
                  <SidebarButton
                    item={item}
                    active={item.id === activeId}
                    onSelect={onSelect}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>

      {footer && <div className="shrink-0 border-t border-border">{footer}</div>}
    </aside>
  );
}

function SidebarButton({
  item,
  active,
  onSelect,
}: {
  item: SidebarItem;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon = item.icon;

  const button = (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      aria-disabled={item.preview || undefined}
      onClick={() => !item.preview && onSelect(item.id)}
      className={cn(
        "relative flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-[7px] text-left text-[13px] transition-colors",
        item.preview
          ? "cursor-not-allowed font-medium text-fg-muted/55"
          : active
            ? "bg-[rgba(255,255,255,0.07)] font-semibold text-foreground"
            : "font-medium text-fg-dim hover:bg-[rgba(255,255,255,0.04)] hover:text-foreground",
      )}
    >
      {active && !item.preview && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-r-full bg-brand"
        />
      )}
      <Icon
        className={cn("size-[17px] shrink-0", active && !item.preview && "text-brand")}
        strokeWidth={1.75}
      />
      <span className="truncate">{item.label}</span>
      {item.badge && <span className="ml-auto shrink-0">{item.badge}</span>}
    </button>
  );

  if (item.preview) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">Coming in a future version</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
