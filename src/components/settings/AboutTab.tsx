import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, Code2, Globe } from "lucide-react";
import { useNativeInsertion } from "../../hooks/useNativeInsertion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  APP_ORGANIZATION_URL,
  APP_RELEASE_RUNBOOK_URL,
  APP_RELEASE_WORKFLOW_URL,
  APP_REPOSITORY_URL,
  APP_SITE_URL,
  APP_VERSION,
} from "../../lib/appMeta";
import type { CompositorKind, LastPortalPrompt, NativeInsertDriver, NativeInsertReadiness, PortalCapabilities } from "../../types/nativeInsertion";
import type { AppUpdateStatus, AppUpdateStatusKind, ReleaseBuildState } from "../../types/updates";

interface AboutTabProps {
  isActive: boolean;
}

function supportTierLabel(value: string | undefined) {
  switch (value) {
    case "tier1":
      return "Tier 1";
    case "preview":
      return "Preview";
    case "experimental":
      return "Experimental";
    default:
      return "Checking";
  }
}

function insertPathLabel(value: string | undefined) {
  switch (value) {
    case "direct_paste":
      return "Direct paste";
    case "clipboard_only":
      return "Clipboard only";
    case "clipboard_fallback":
      return "Clipboard fallback";
    case "scratchpad_fallback":
      return "Scratchpad fallback";
    default:
      return "Detecting current path";
  }
}

function insertDriverLabel(value: NativeInsertDriver | undefined) {
  switch (value) {
    case "wl_copy":
      return "wl-copy";
    case "arboard":
      return "arboard clipboard";
    case "xdotool":
      return "xdotool";
    case "wtype":
      return "wtype";
    case "ydotool":
      return "ydotool";
    case "enigo":
      return "enigo";
    case "scratchpad":
      return "scratchpad recovery";
    default:
      return "Detecting current driver";
  }
}

function insertReadinessLabel(value: NativeInsertReadiness | undefined) {
  switch (value) {
    case "ready":
      return "Ready";
    case "recovery_only":
      return "Recovery only";
    default:
      return "Checking preflight";
  }
}

function compositorLabel(value: CompositorKind | undefined): string {
  switch (value) {
    case "kde_plasma6":
      return "KDE Plasma 6";
    case "kde_plasma5":
      return "KDE Plasma 5";
    case "gnome_mutter":
      return "GNOME Mutter";
    case "hyprland":
      return "Hyprland";
    case "sway":
      return "Sway";
    case "other":
      return "Other Wayland compositor";
    case "unknown":
    default:
      return "Unknown";
  }
}

function portalCapabilitySummary(capabilities: PortalCapabilities | null | undefined): string {
  if (!capabilities) {
    return "Portal not probed on this platform.";
  }
  const remoteDesktop = capabilities.has_remote_desktop_portal ? "RemoteDesktop ready" : "RemoteDesktop not reachable";
  const daemon = capabilities.has_xdg_desktop_portal_daemon ? "xdg-desktop-portal detected" : "xdg-desktop-portal missing";
  return `${compositorLabel(capabilities.compositor)} · ${daemon} · ${remoteDesktop}`;
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

function supportTierTone(value: string | undefined): "success" | "primary" | "warning" {
  switch (value) {
    case "tier1":
      return "success";
    case "preview":
      return "primary";
    case "experimental":
      return "warning";
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

function portalSignalLabel(signal: LastPortalPrompt["signal"] | undefined): string {
  switch (signal) {
    case "kde_remote_desktop":
      return "KDE Plasma Remote Desktop portal rejected the input";
    case "input_capture":
      return "xdg-desktop-portal InputCapture rejected the input";
    case "unknown":
    default:
      return "A portal prompt rejected the input";
  }
}

function DiagItem({
  title,
  tone = "default",
  lines,
}: {
  title: string;
  tone?: "default" | "success" | "warning" | "primary";
  lines: ReactNode[];
}) {
  return (
    <div className="rounded-lg border border-[var(--hairline)] bg-[var(--surface-1)] px-3.5 py-3">
      <Badge variant={tone === "default" ? "secondary" : tone} dot>
        {title}
      </Badge>
      <div className="mt-2 flex flex-col gap-0.5 text-[12px] leading-snug text-[var(--fg-dim)]">
        {lines.map((line, index) => (
          <span key={index}>{line}</span>
        ))}
      </div>
    </div>
  );
}

export function AboutTab({ isActive }: AboutTabProps) {
  const [linkError, setLinkError] = useState<string | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [releaseStatus, setReleaseStatus] = useState<AppUpdateStatus | null>(null);
  const [isCheckingRelease, setIsCheckingRelease] = useState(false);
  const insertion = useNativeInsertion();
  const platformStatus = insertion.status?.platform;
  const scratchpadEntries = insertion.status?.scratchpad_entries.length ?? 0;
  const driverChain = platformStatus?.driver_chain ?? [];
  const platformChecks = platformStatus?.prerequisites ?? [];
  const platformCaveats = platformStatus?.caveats ?? [];
  const platformReadinessLabel = insertReadinessLabel(platformStatus?.readiness);

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
    { label: "GitHub - SW-Bench/WordScript", url: APP_REPOSITORY_URL },
    { label: "GitHub - SW-Bench", url: APP_ORGANIZATION_URL },
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
      <div className="px-1">
        <p className="text-[15px] font-semibold text-[var(--fg)]">WordScript {APP_VERSION}</p>
        <p className="mt-0.5 text-[12px] text-[var(--fg-muted)]">Lightweight speech-to-text for your desktop.</p>
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

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="text-[11px] text-[var(--fg-muted)] uppercase tracking-wide font-medium">
                Platform support
              </span>
              <h3 className="text-[14px] font-semibold text-[var(--fg)] mt-1">
                {platformStatus?.platform_label ?? "Checking current platform"}
              </h3>
            </div>
            <Badge variant={supportTierTone(platformStatus?.support_tier)}>
              {supportTierLabel(platformStatus?.support_tier)}
            </Badge>
          </div>

          <p className={cn("text-[12px] leading-snug mb-4", insertion.error ? "text-[var(--red)]" : "text-[var(--fg-muted)]")}>
            {insertion.error ?? platformStatus?.support_message ?? "WordScript is checking the active insert path for this machine."}
          </p>

          {platformStatus?.readiness_message && (
            <div className="border-t border-[var(--hairline)] py-3">
              <DiagItem
                title="Insert preflight"
                tone={platformStatus.readiness === "ready" ? "success" : "warning"}
                lines={[platformReadinessLabel, platformStatus.readiness_message]}
              />
            </div>
          )}

          {(platformStatus?.portal_capabilities || platformStatus?.paste_disabled_reason) && (
            <div className="border-t border-[var(--hairline)] py-3">
              <DiagItem
                title="Linux portal diagnostics"
                tone="warning"
                lines={[
                  portalCapabilitySummary(platformStatus?.portal_capabilities),
                  platformStatus?.paste_disabled_reason ? `Reason: ${platformStatus.paste_disabled_reason}` : "",
                  platformStatus?.portal_capabilities
                    ? `Session: ${platformStatus.portal_capabilities.session_type || "unknown"} · xdg_current_desktop=${platformStatus.portal_capabilities.xdg_current_desktop ?? "-"}`
                    : "",
                ].filter(Boolean)}
              />
            </div>
          )}

          {insertion.status?.last_portal_prompt && (
            <div className="border-t border-[var(--hairline)] py-3">
              <DiagItem
                title="Last detected portal prompt"
                tone="warning"
                lines={[
                  `${portalSignalLabel(insertion.status.last_portal_prompt.signal)} (driver=${insertion.status.last_portal_prompt.driver})`,
                  insertion.status.last_portal_prompt.stderr_excerpt,
                  `Detected at ${new Date(insertion.status.last_portal_prompt.detected_at_ms).toLocaleString()}`,
                ]}
              />
            </div>
          )}

          {insertion.status?.portal_session && (
            <div className="border-t border-[var(--hairline)] py-3">
              <DiagItem
                title="RemoteDesktop portal session"
                tone={insertion.status.portal_session.active ? "success" : "warning"}
                lines={[
                  insertion.status.portal_session.active
                    ? `Active portal session for ${insertion.status.portal_session.compositor}. Future paste attempts should not prompt again.`
                    : `No active portal session for ${insertion.status.portal_session.compositor}.`,
                  insertion.status.portal_session.error ? `Reason: ${insertion.status.portal_session.error}` : "",
                ].filter(Boolean)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-[var(--hairline)] pt-4">
            {[
              { label: "Insert path", value: insertPathLabel(platformStatus?.insert_strategy) },
              { label: "Preflight", value: platformReadinessLabel },
              { label: "Active driver", value: insertDriverLabel(platformStatus?.active_driver) },
              { label: "Fallback recovery", value: scratchpadEntries === 1 ? "1 stored transcript" : `${scratchpadEntries} stored transcripts` },
            ].map((item) => (
              <div key={item.label} className="flex flex-col gap-0.5">
                <span className="text-[11px] text-[var(--fg-muted)] uppercase tracking-wide font-medium">
                  {item.label}
                </span>
                <span className="text-[12px] text-[var(--fg)]">{item.value}</span>
              </div>
            ))}
          </div>

          {driverChain.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-[var(--hairline)] py-3 mt-3">
              {driverChain.map((item) => (
                <DiagItem
                  key={`driver:${item.role}:${item.driver}`}
                  title={item.active ? "Active driver" : item.available ? "Fallback driver" : "Unavailable driver"}
                  tone={item.active ? "success" : item.available ? "default" : "warning"}
                  lines={[`${item.label} · ${item.role}`, item.detail]}
                />
              ))}
            </div>
          )}

          {(platformChecks.length > 0 || platformCaveats.length > 0) && (
            <div className="flex flex-col gap-2 border-t border-[var(--hairline)] py-3">
              {platformChecks.map((item) => (
                <DiagItem key={`check:${item}`} title="Before relying on this path" lines={[item]} />
              ))}
              {platformCaveats.map((item) => (
                <DiagItem key={`caveat:${item}`} title="Honest limit" tone="warning" lines={[item]} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 px-1">
        {projectLinks.map((link) => (
          <Button key={link.url} size="sm" variant="ghost" onClick={() => void open(link.url)}>
            {link.url === APP_REPOSITORY_URL ? <Code2 size={14} className="mr-1" /> : link.url === APP_SITE_URL ? <Globe size={14} className="mr-1" /> : <ExternalLink size={14} className="mr-1" />}
            {link.label}
          </Button>
        ))}
      </div>

      {linkError && <p className="px-1 text-[12px] text-[var(--red)]">{linkError}</p>}
    </div>
  );
}
