import { type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface Props {
  title: string;
  subtitle?: string;
  status?: ReactNode;
  actions?: ReactNode;
}

export function WindowChrome({ title, subtitle, status, actions }: Props) {
  const appWindow = getCurrentWindow();

  const minimize = async () => {
    try {
      await appWindow.minimize();
    } catch {
      await appWindow.hide();
    }
  };

  const close = async () => {
    await appWindow.hide();
  };

  return (
    <header className="settings__topbar">
      <div className="settings__topbar-leading">
        <div className="settings__window-controls" aria-label="Window controls" onMouseDown={(event) => event.stopPropagation()}>
          <button className="settings__window-btn" type="button" title="Minimize window" aria-label="Minimize window" onMouseDown={(event) => event.stopPropagation()} onClick={() => void minimize()}>
            <span className="settings__window-btn-icon settings__window-btn-icon--minimize" aria-hidden="true" />
          </button>
          <button className="settings__window-btn settings__window-btn--close" type="button" title="Close window" aria-label="Close window" onMouseDown={(event) => event.stopPropagation()} onClick={() => void close()}>
            <span className="settings__window-btn-icon settings__window-btn-icon--close" aria-hidden="true" />
          </button>
        </div>

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