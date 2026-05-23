import { RebuildLabTab } from "../components/settings/RebuildLabTab";
import { useRuntime } from "../hooks/useRuntime";
import { WindowChrome } from "../components/settings/WindowChrome";
import "../styles/settings.css";

export default function RebuildLabWindow() {
  const { state } = useRuntime();
  const previewState = state.error
    ? { label: "Error", title: state.error, ok: false }
    : state.status === "processing"
      ? { label: "Processing", title: "WordScript is currently transcribing the last capture.", ok: true }
      : state.status === "recording"
        ? { label: state.paused ? "Paused" : "Recording", title: state.paused ? "Recording is paused." : "Recording is active.", ok: true }
        : { label: "Ready", title: "Diagnostics preview is connected to the native runtime.", ok: true };

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
          <WindowChrome
            title="Diagnostics"
            subtitle="Native capture, transform and insert checks"
            status={(
              <span className={`settings__runtime-pill${previewState.ok ? " settings__runtime-pill--ok" : ""}`} title={previewState.title}>
                {previewState.label}
              </span>
            )}
          />

          <div className="settings__body">
            <section className="settings__panel">
              <header className="settings__panel-header">
                <div className="settings__panel-heading">
                  <span className="settings__panel-eyebrow">Runtime preview</span>
                  <div className="settings__panel-title-row">
                    <h2 className="settings__panel-title">Diagnostics Preview</h2>
                    <div className="settings__panel-meta" aria-label="Diagnostics preview meta">
                      <span className={`settings__panel-chip${previewState.ok ? " settings__panel-chip--ok" : ""}`}>
                        {previewState.label}
                      </span>
                      <span className="settings__panel-chip settings__panel-chip--muted">Dedicated window</span>
                    </div>
                  </div>
                </div>
                <p className="settings__panel-blurb">
                  Inspect the same native diagnostics lane in a wider pop-out without losing the calmer single-surface shell.
                </p>
              </header>

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