import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { useNativeInsertion } from "../../hooks/useNativeInsertion";
import {
  APP_ORGANIZATION_URL,
  APP_RELEASE_RUNBOOK_URL,
  APP_RELEASE_WORKFLOW_URL,
  APP_REPOSITORY_URL,
  APP_SITE_URL,
  APP_VERSION,
} from "../../lib/appMeta";
import type { NativeInsertDriver, NativeInsertReadiness } from "../../types/nativeInsertion";
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

function releaseStatusPillClass(value: AppUpdateStatusKind | undefined) {
  switch (value) {
    case "update_available":
    case "up_to_date":
      return " settings__support-pill--tier1";
    case "check_failed":
      return " settings__support-pill--experimental";
    case "release_path_building":
    default:
      return " settings__support-pill--preview";
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
      ? [{ label: releaseStatus.release_version ? `Latest visible release ${releaseStatus.release_version}` : "Latest visible release", url: releaseStatus.release_url }]
      : []),
  ];
  const releaseSummary = releaseError
    ?? releaseStatus?.summary
    ?? "WordScript is checking the commercial release path and current GitHub release visibility.";
  const releaseHeadline = releaseStatus?.release_version ?? "No published release yet";
  const releaseCheckLabel = isCheckingRelease ? "Checking GitHub" : releaseStatusLabel(releaseStatus?.status);

  return (
    <>
      <div className="tab__title">About</div>

      <p style={{ fontSize: 14, marginBottom: 4 }}>WordScript&nbsp;&nbsp;{APP_VERSION}</p>
      <p className="form-dim" style={{ marginBottom: 16 }}>
        Lightweight speech-to-text for your desktop.
      </p>

      <div className="settings__about-card settings__about-card--highlight">
        <div className="settings__about-head">
          <div>
            <span className="settings__about-kicker">Commercial release path</span>
            <strong className="settings__about-title">Cross-platform release build-up</strong>
          </div>
          <span className={`settings__support-pill${releaseStatusPillClass(releaseStatus?.status)}`}>
            {releaseCheckLabel}
          </span>
        </div>

        <div className="settings__provider-meta-grid">
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">Current usable version</span>
            <span>Developer build from source</span>
          </div>
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">Current version</span>
            <span>{releaseStatus?.current_version ?? APP_VERSION}</span>
          </div>
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">Use today</span>
            <code>npm run tauri dev</code>
          </div>
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">Release target</span>
            <span>First official cross-platform app release for Linux, macOS and Windows</span>
          </div>
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">Latest visible tag</span>
            <span>{releaseHeadline}</span>
          </div>
        </div>

        <p className="form-dim settings__about-copy">
          Today you use WordScript as a developer build from source via <code>npm run tauri dev</code>. In parallel, the first official cross-platform app release is being assembled.
        </p>

        <p className={`form-dim settings__about-copy${releaseError ? " form-dim--error" : ""}`}>
          {releaseSummary}
        </p>

        <div className="settings__about-installers">
          <strong className="settings__about-title">Target build lanes</strong>
          <div className="settings__about-installer-list">
            {(releaseStatus?.build_targets ?? []).map((target) => (
              <div key={`${target.platform}:${target.artifact}`} className="settings__about-installer settings__about-installer--static">
                <strong>{target.platform}</strong>
                <span className="settings__about-installer-meta">{buildStateLabel(target.state)} • {target.artifact}</span>
                <span>{target.note}</span>
              </div>
            ))}
          </div>
        </div>

        {releaseStatus?.release_notes && (
          <p className="settings__about-release-body">{releaseStatus.release_notes}</p>
        )}

        <p className="form-dim settings__about-copy">
          Until the first tagged release exists, treat this card as release-path diagnostics. It should explain what is being built, not imply that installers or in-app updates already work.
        </p>

        <div className="settings__about-actions">
          {releaseLinks.map((link) => (
            <button key={link.url} type="button" className="about-link" onClick={() => void open(link.url)}>
              {link.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings__about-card">
        <div className="settings__about-head">
          <div>
            <span className="settings__about-kicker">Platform support</span>
            <strong className="settings__about-title">{platformStatus?.platform_label ?? "Checking current platform"}</strong>
          </div>
          <span className={`settings__support-pill${platformStatus ? ` settings__support-pill--${platformStatus.support_tier}` : ""}`}>
            {supportTierLabel(platformStatus?.support_tier)}
          </span>
        </div>

        <p className={`form-dim settings__about-copy${insertion.error ? " form-dim--error" : ""}`}>
          {insertion.error ?? platformStatus?.support_message ?? "WordScript is checking the active insert path for this machine."}
        </p>

        {platformStatus?.readiness_message && (
          <div className={`settings__rule-issue${platformStatus.readiness === "ready" ? "" : " settings__rule-issue--warning"}`} style={{ marginTop: 14 }}>
            <strong>Insert preflight</strong>
            <div className="settings__rule-issue-copy">
              <span>{platformReadinessLabel}</span>
              <span>{platformStatus.readiness_message}</span>
            </div>
          </div>
        )}

        <div className="settings__provider-meta-grid">
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">Insert path</span>
            <span>{insertPathLabel(platformStatus?.insert_strategy)}</span>
          </div>
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">Preflight</span>
            <span>{platformReadinessLabel}</span>
          </div>
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">Active driver</span>
            <span>{insertDriverLabel(platformStatus?.active_driver)}</span>
          </div>
          <div className="settings__provider-meta-item">
            <span className="settings__provider-meta-label">Fallback recovery</span>
            <span>{scratchpadEntries === 1 ? "1 stored transcript" : `${scratchpadEntries} stored transcripts`}</span>
            <code>{insertion.status?.scratchpad_path ?? "Loading recovery store"}</code>
          </div>
        </div>

        {driverChain.length > 0 && (
          <div className="settings__rule-issues" style={{ marginTop: 14 }}>
            {driverChain.map((item) => (
              <div
                key={`driver:${item.role}:${item.driver}`}
                className={`settings__rule-issue${!item.available ? " settings__rule-issue--warning" : ""}`}
              >
                <strong>{item.active ? "Active driver" : item.available ? "Fallback driver" : "Unavailable driver"}</strong>
                <div className="settings__rule-issue-copy">
                  <span>{`${item.label} · ${item.role}`}</span>
                  <span>{item.detail}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {(platformChecks.length > 0 || platformCaveats.length > 0) && (
          <div className="settings__rule-issues" style={{ marginTop: 14 }}>
            {platformChecks.map((item) => (
              <div key={`check:${item}`} className="settings__rule-issue">
                <strong>Before relying on this path</strong>
                <div className="settings__rule-issue-copy">
                  <span>{item}</span>
                </div>
              </div>
            ))}
            {platformCaveats.map((item) => (
              <div key={`caveat:${item}`} className="settings__rule-issue settings__rule-issue--warning">
                <strong>Honest limit</strong>
                <div className="settings__rule-issue-copy">
                  <span>{item}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="form-sep" />

      {projectLinks.map((link) => (
        <button key={link.url} type="button" className="about-link" onClick={() => void open(link.url)}>
          {link.label}
        </button>
      ))}

      {linkError && (
        <p className="form-dim form-dim--error">{linkError}</p>
      )}
    </>
  );
}
