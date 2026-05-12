import { RebuildLabTab } from "../components/settings/RebuildLabTab";
import { WindowChrome } from "../components/settings/WindowChrome";
import "../styles/settings.css";

export default function RebuildLabWindow() {
  return (
    <div className="settings settings--tool-window">
      <div className="settings__shell settings__shell--single">
        <main className="settings__main">
          <WindowChrome title="Diagnostics" subtitle="Native capture, transform and insert checks" />

          <div className="settings__body">
            <section className="settings__panel">
              <div className="settings__content">
                <div className="tab tab--active">
                  <RebuildLabTab isActive />
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}