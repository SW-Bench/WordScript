import { type ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  status?: ReactNode;
  actions?: ReactNode;
}

export function WindowChrome({ title, subtitle, status, actions }: Props) {
  return (
    <header className="settings__topbar">
      <div className="settings__topbar-leading">
        <div className="settings__topbar-drag" data-tauri-drag-region>
          <div className="settings__topbar-copy">
            <h1>{title}</h1>
            {subtitle ? <span>{subtitle}</span> : null}
          </div>
        </div>
      </div>

      <div className="settings__top-actions">
        {status}
        {actions}
      </div>
    </header>
  );
}