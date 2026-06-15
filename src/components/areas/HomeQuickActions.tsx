import { ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { truncate } from "@/lib/format";
import type { ScratchpadEntry } from "@/types/nativeInsertion";

interface HomeQuickActionsProps {
  lastTranscript: ScratchpadEntry | null;
  isLoading: boolean;
  onRestore: () => void;
  onOpen: () => void;
}

export function HomeQuickActions({ lastTranscript, isLoading, onRestore, onOpen }: HomeQuickActionsProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 px-1">
        <span className="text-xs font-medium uppercase tracking-[0.05em] text-fg-muted">Tools</span>
        <h2 className="text-xl font-semibold leading-tight tracking-[-0.005em]">Quick actions</h2>
      </div>

      <div className="rounded-[16px] border border-border-strong bg-bg-surface p-5">
        <ul className="flex flex-col">
          <li className="flex min-h-[56px] items-center gap-4 rounded-lg border-b border-border-subtle px-2 py-4 transition-colors hover:bg-bg-elevated">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Restore last transcript</p>
              <p className="mt-0.5 text-xs text-fg-muted">
                {lastTranscript
                  ? `Re-deliver “${truncate(lastTranscript.text, 48)}”.`
                  : "Nothing buffered yet."}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={!lastTranscript || isLoading}
              onClick={() => void onRestore()}
            >
              <RotateCcw className="size-3.5" /> Restore
            </Button>
          </li>

          <li className="flex min-h-[56px] items-center gap-4 rounded-lg px-2 py-4 transition-colors hover:bg-bg-elevated">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Shortcuts & microphone</p>
              <p className="mt-0.5 text-xs text-fg-muted">Hotkey, microphone and delivery.</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => void onOpen()}>
              Open <ArrowRight className="size-3.5" />
            </Button>
          </li>
        </ul>
      </div>
    </section>
  );
}
