import { Button } from "@/components/ui/button";
import { FormCard, FormRow, StatusBadge } from "@/components/shell";
import { HomeHero } from "./HomeHero";
import { HomeRecentList } from "./HomeRecentList";
import { HomeQuickActions } from "./HomeQuickActions";
import { useTranscriptionHistory } from "@/hooks/useTranscriptionHistory";
import { useNativeInsertion } from "@/hooks/useNativeInsertion";
import type { AppConfig } from "@/types/ipc";
import type { ScratchpadEntry } from "@/types/nativeInsertion";

interface Readiness {
  label: string;
  title: string;
  ok: boolean;
}

interface HomeAreaProps {
  isActive: boolean;
  config: AppConfig;
  readiness: Readiness;
  providerReady: boolean;
  laneLabel: string;
  onNavigate: (id: string) => void;
}

export function HomeArea({
  isActive,
  config,
  readiness,
  providerReady,
  laneLabel,
  onNavigate,
}: HomeAreaProps) {
  void config;
  void providerReady;

  const history = useTranscriptionHistory(isActive);
  const insertion = useNativeInsertion();

  const recent = history.entries.slice(0, 5);
  const platform = insertion.status?.platform;
  const insertReady = platform?.readiness === "ready";
  const lastTranscript: ScratchpadEntry | null = insertion.status?.last_transcript ?? null;

  return (
    <div className="flex flex-col gap-8">
      <HomeHero readiness={readiness} laneLabel={laneLabel} onNavigate={onNavigate} />

      <section className="flex flex-col gap-3">
        <div className="px-1">
          <h2 className="text-lg font-semibold leading-tight tracking-[-0.005em]">Delivery status</h2>
        </div>
        <FormCard className="border-border-strong" bodyClassName="px-5">
          <FormRow
            label={insertReady ? "Direct paste available" : "Recovery only"}
            hint={platform?.readiness_message ?? "Checking the native insert chain…"}
            divider={false}
            control={
              <div className="flex items-center gap-2">
                <StatusBadge tone={insertReady ? "success" : "warning"} dot>
                  {platform ? (insertReady ? "Ready" : "Fallback") : "Checking"}
                </StatusBadge>
                {platform && !insertReady && (
                  <Button size="sm" variant="ghost" onClick={() => onNavigate("insert_recovery")}>
                    Review
                  </Button>
                )}
              </div>
            }
          />
        </FormCard>
      </section>

      <HomeRecentList entries={recent} onNavigate={onNavigate} />

      <HomeQuickActions
        lastTranscript={lastTranscript}
        isLoading={insertion.isLoading}
        onRestore={() => void insertion.restoreLastTranscript()}
        onOpen={() => onNavigate("capture")}
      />
    </div>
  );
}
