import { RebuildLabTab } from "../components/settings/RebuildLabTab";
import { useRuntime } from "../hooks/useRuntime";
import { WindowChrome } from "../components/settings/WindowChrome";
import { StatusBadge, type StatusTone } from "../components/shell";

export default function RebuildLabWindow() {
  const { state } = useRuntime();
  const previewState: { label: string; title: string; tone: StatusTone } = state.error
    ? { label: "Error", title: state.error, tone: "error" }
    : state.status === "processing"
      ? { label: "Processing", title: "WordScript is currently transcribing the last capture.", tone: "info" }
      : state.status === "recording"
        ? {
            label: state.paused ? "Paused" : "Recording",
            title: state.paused ? "Recording is paused." : "Recording is active.",
            tone: state.paused ? "warning" : "accent",
          }
        : { label: "Ready", title: "Diagnostics preview is connected to the native runtime.", tone: "success" };

  if (!state.config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-[13px] text-fg-muted">
        Connecting to runtime…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <WindowChrome
        title="Diagnostics"
        subtitle="Native capture, transform and insert checks"
        status={
          <StatusBadge tone={previewState.tone} dot>
            {previewState.label}
          </StatusBadge>
        }
      />

      <main className="mx-auto w-full max-w-[760px] flex-1 px-6 py-6">
        <div className="mb-5">
          <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-fg-muted">Runtime preview</span>
          <h2 className="mt-1 text-[17px] font-semibold text-foreground">Diagnostics Preview</h2>
          <p className="mt-1 text-[13px] leading-snug text-fg-muted">
            Inspect the same native diagnostics lane in a wider pop-out without losing the calmer single-surface shell.
          </p>
        </div>

        <RebuildLabTab isActive config={state.config} onChange={() => {}} />
      </main>
    </div>
  );
}