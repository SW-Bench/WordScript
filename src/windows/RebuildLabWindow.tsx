import { RebuildLabTab } from "../components/settings/RebuildLabTab";
import { useRuntime } from "../hooks/useRuntime";
import { WindowChrome } from "../components/settings/WindowChrome";
import "../styles/settings.css";

export default function RebuildLabWindow() {
  const { state } = useRuntime();

  if (!state.config) {
    return (
      <div className="settings settings--loading">
        Connecting to runtime…
      </div>
    );
  }

  return (
    <div className="settings settings--tool-window">
      <div className="settings__shell settings__shell--single">
        <main className="settings__main">
          <WindowChrome title="Diagnostics" subtitle="Native capture, transform and insert checks" />

          <div className="settings__body">
            <section className="settings__panel">
              <div className="settings__content">
                <div className="tab tab--active">
                  <RebuildLabTab isActive config={state.config} onChange={() => {}} />
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}