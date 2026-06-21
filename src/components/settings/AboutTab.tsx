import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { ExternalLink, Code2, Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  APP_RELEASE_RUNBOOK_URL,
  APP_RELEASE_WORKFLOW_URL,
  APP_REPOSITORY_URL,
  APP_SITE_URL,
  APP_VERSION,
} from "../../lib/appMeta";
import type { AppUpdateStatus, AppUpdateStatusKind, ReleaseBuildState } from "../../types/updates";

interface AboutTabProps {
  isActive: boolean;
}

function releaseStatusLabel(value: AppUpdateStatusKind | undefined) {
  switch (value) {
    case "update_available":
      return "Release found";
    case "up_to_date":
      return "Tracked";
    case "check_failed":
      return "Check failed";
    case "release_path_building":
    default:
      return "In progress";
  }
}

function releaseStatusTone(value: AppUpdateStatusKind | undefined): "success" | "warning" | "primary" {
  switch (value) {
    case "update_available":
    case "up_to_date":
      return "success";
    case "check_failed":
      return "warning";
    case "release_path_building":
    default:
      return "primary";
  }
}

function buildStateLabel(value: ReleaseBuildState) {
  switch (value) {
    case "published":
      return "Published";
    case "planned":
      return "Planned";
    case "building":
    default:
      return "Building";
  }
}

export function AboutTab({ isActive }: AboutTabProps) {
  const [linkError, setLinkError] = useState<string | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [releaseStatus, setReleaseStatus] = useState<AppUpdateStatus | null>(null);
  const [isCheckingRelease, setIsCheckingRelease] = useState(false);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    let cancelled = false;
    setIsCheckingRelease(true);
    setReleaseError(null);

    void invoke<AppUpdateStatus>("check_app_update")
      .then((status) => {
        if (!cancelled) {
          setReleaseStatus(status);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setReleaseError(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsCheckingRelease(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isActive]);

  const open = async (url: string) => {
    try {
      await openUrl(url);
    } catch (error) {
      setLinkError(error instanceof Error ? error.message : String(error));
    }
  };
  const projectLinks = [
    { label: "GitHub", url: APP_REPOSITORY_URL },
    { label: "SW labs", url: APP_SITE_URL },
  ];
  const releaseLinks = [
    { label: "Release workflow", url: APP_RELEASE_WORKFLOW_URL },
    { label: "Release runbook", url: APP_RELEASE_RUNBOOK_URL },
    ...(releaseStatus?.release_url
      ? [{ label: releaseStatus.release_version ? `Latest published release ${releaseStatus.release_version}` : "Latest published release", url: releaseStatus.release_url }]
      : []),
  ];
  const releaseSummary = releaseError
    ?? releaseStatus?.summary
    ?? "WordScript is checking the commercial release path and current GitHub release visibility.";
  const releaseHeadline = releaseStatus?.release_version ?? "No published release yet";
  const releaseCheckLabel = isCheckingRelease ? "Checking GitHub" : releaseStatusLabel(releaseStatus?.status);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-[15px] font-semibold text-[var(--fg)]">WordScript {APP_VERSION}</p>
          <p className="mt-0.5 text-[12px] text-[var(--fg-muted)]">Lightweight speech-to-text for your desktop.</p>
        </div>
        <div className="flex gap-2">
          {projectLinks.map((link) => (
            <Button key={link.url} size="sm" variant="ghost" onClick={() => void open(link.url)}>
              {link.url === APP_REPOSITORY_URL ? <Code2 size={14} className="mr-1" /> : <Globe size={14} className="mr-1" />}
              {link.label}
            </Button>
          ))}
        </div>
      </div>

      <Card className="border-[var(--accent)]/10">
        <CardContent className="pt-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="text-[11px] text-[var(--fg-muted)] uppercase tracking-wide font-medium">
                Commercial release path
              </span>
              <h3 className="text-[14px] font-semibold text-[var(--fg)] mt-1">
                Cross-platform release build-up
              </h3>
            </div>
            <Badge variant={releaseStatusTone(releaseStatus?.status)}>
              {releaseCheckLabel}
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {[
              { label: "Current usable version", value: "Developer build from source" },
              { label: "Current version", value: releaseStatus?.current_version ?? APP_VERSION },
              { label: "Use today", value: "npm run tauri dev" },
              { label: "Release target", value: "First official cross-platform app release for Linux, macOS and Windows" },
              { label: "Latest published tag", value: releaseHeadline },
            ].map((item) => (
              <div key={item.label} className="flex flex-col gap-0.5">
                <span className="text-[11px] text-[var(--fg-muted)] uppercase tracking-wide font-medium">
                  {item.label}
                </span>
                <span className="text-[12px] text-[var(--fg)]">{item.value}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-[var(--hairline)] py-4">
            <p className="text-[12px] leading-snug text-[var(--fg-muted)]">
              Today you use WordScript as a developer build from source via{" "}
              <code className="rounded bg-[var(--surface-3)] px-1 py-0.5 font-mono text-[11px] text-[var(--fg-dim)]">npm run tauri dev</code>. In
              parallel, the first official cross-platform app release is being assembled.
            </p>
            <p className="text-[12px] leading-snug text-[var(--fg-muted)]">
              Internal draft release handoffs, if the workflow creates them, stay maintainer-only and do not change this
              public GitHub release check.
            </p>
            <p className={cn("text-[12px] leading-snug", releaseError ? "text-[var(--red)]" : "text-[var(--fg-muted)]")}>
              {releaseSummary}
            </p>
          </div>

          <div className="border-t border-[var(--hairline)] py-4">
            <strong className="text-[12px] font-semibold text-[var(--fg)]">Target build lanes</strong>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(releaseStatus?.build_targets ?? []).map((target) => (
                <div key={`${target.platform}:${target.artifact}`} className="rounded-lg border border-[var(--hairline)] bg-[var(--surface-1)] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-[12px] font-semibold text-[var(--fg)]">{target.platform}</strong>
                    <span className="text-[11px] text-[var(--fg-muted)]">{buildStateLabel(target.state)}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--fg-dim)]">{target.artifact}</div>
                  <p className="mt-1 text-[11px] leading-snug text-[var(--fg-muted)]">{target.note}</p>
                </div>
              ))}
            </div>
          </div>

          {releaseStatus?.release_notes && (
            <p className="border-t border-[var(--hairline)] py-4 text-[12px] leading-snug text-[var(--fg-dim)]">{releaseStatus.release_notes}</p>
          )}

          <p className="border-t border-[var(--hairline)] py-4 text-[12px] leading-snug text-[var(--fg-muted)]">
            Until the first published release exists, treat this card as public release-path diagnostics. It should explain
            what is being built, not imply that installers, draft handoffs or in-app updates already work for end users.
          </p>

          <div className="flex flex-wrap gap-2 border-t border-[var(--hairline)] py-3">
            {releaseLinks.map((link) => (
              <Button key={link.url} size="sm" variant="outline" onClick={() => void open(link.url)}>
                <ExternalLink size={14} className="mr-1" /> {link.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {linkError && <p className="px-1 text-[12px] text-[var(--red)]">{linkError}</p>}
    </div>
  );
}
