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
 * Finder-style grouped navigation with material surfaces.
 * 240px, translucent, uppercase section headers,
 * material specular + pressed inset on active items.
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
        "flex h-full w-[232px] shrink-0 flex-col border-r border-[var(--hairline)] bg-[var(--surface-1)]",
        className,
      )}
    >
      {header && <div className="shrink-0">{header}</div>}

      <nav
        aria-label="WordScript sections"
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 pb-3 pt-2"
      >
        {groups.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <h2 className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-muted)]">
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

      {footer && <div className="shrink-0 border-t border-[var(--hairline)] mx-2 mb-2 mt-1">{footer}</div>}
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
        "group relative flex items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40",
        item.preview
          ? "opacity-40 cursor-not-allowed text-[var(--fg-dim)]"
          : active
            ? "text-[var(--fg)]"
            : "text-[var(--fg-dim)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)]",
      )}
    >
      {active && !item.preview && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-[var(--radius-control)] material"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--hairline-strong)",
          }}
        />
      )}
      <span
        className={cn(
          "relative shrink-0",
          active && !item.preview ? "text-[var(--accent)]" : ""
        )}
      >
        <Icon
          size={14}
          strokeWidth={1.75}
        />
      </span>
      <span className="relative truncate">{item.label}</span>
      {item.badge && <span className="relative ml-auto shrink-0">{item.badge}</span>}
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
