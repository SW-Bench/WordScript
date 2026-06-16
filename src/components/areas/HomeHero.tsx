import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/shell";

interface Readiness {
  label: string;
  title: string;
  ok: boolean;
}

interface HomeHeroProps {
  readiness: Readiness;
  laneLabel: string;
  onNavigate: (id: string) => void;
}

export function HomeHero({ readiness, laneLabel, onNavigate }: HomeHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-lg border border-border-strong bg-bg-elevated px-6 py-6">
      <div className="flex flex-col gap-5">
        {/* top row: lane + status */}
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-bg-base px-2 py-0.5 text-xs font-medium text-fg-dim">
            {laneLabel}
          </span>
          <div className="flex items-center gap-1.5">
            <StatusDot tone={readiness.ok ? "success" : "warning"} label={readiness.label} />
            <span className="text-xs font-medium text-fg-dim">{readiness.label}</span>
          </div>
        </div>

        {/* headline */}
        <div className="min-w-0">
          <h2 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.01em]">
            {readiness.ok ? "Ready to dictate" : "Almost there"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-fg-dim">{readiness.title}</p>
        </div>

        {/* actions */}
        <div className="flex items-center gap-3">
          {!readiness.ok && (
            <Button size="sm" variant="outline" onClick={() => onNavigate("speech")}>
              Set up
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={() => onNavigate("capture")}>
            <Mic className="size-3.5" /> Capture
          </Button>
        </div>
      </div>
    </section>
  );
}
