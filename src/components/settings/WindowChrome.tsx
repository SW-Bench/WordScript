import { type ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  status?: ReactNode;
  actions?: ReactNode;
}

export function WindowChrome({ title, subtitle, status, actions }: Props) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
      <div className="min-w-0">
        <h1 className="truncate text-[15px] font-semibold text-foreground">{title}</h1>
        {subtitle ? <span className="block truncate text-[12px] text-fg-muted">{subtitle}</span> : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {status}
        {actions}
      </div>
    </header>
  );
}