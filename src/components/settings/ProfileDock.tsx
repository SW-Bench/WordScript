import { invoke } from "@tauri-apps/api/core";
import type { AppConfig, ProcessingMode } from "../../types/ipc";
import {
  buildTextProfilesPatch,
  cloneTextProfile,
  createTextProfile,
  describeTextProfileWorkMode,
  displayTextProfileLabel,
  isCuratedTextProfile,
  resolveActiveTextProfile,
  textProfileInitials,
} from "../../lib/textProfiles";

function processingModeLabel(mode?: ProcessingMode): string {
  switch (mode) {
    case "cleanup": return "Cleanup";
    case "rewrite": return "Rewrite";
    case "agent": return "Agent";
    case "prompt_enhance": return "Prompt Enhance";
    case "verbatim": return "Verbatim";
    default: return "";
  }
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

import type { ProfileHealthLevel } from "../../types/textRules";

interface ProfileDockProps {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
  onOpenTextRules: () => void;
  healthStatus?: ProfileHealthLevel;
}

export function ProfileDock({ config, onChange, onOpenTextRules, healthStatus }: ProfileDockProps) {
  const profiles = config.text_profiles?.length
    ? config.text_profiles.map((profile) => cloneTextProfile(profile))
    : [resolveActiveTextProfile(config)];
  const activeProfile = resolveActiveTextProfile(config);
  const contextConfigured = activeProfile.prompt.trim().length > 0;
  const dictionaryLabel = countLabel(activeProfile.dictionary_entries.length, "term");
  const snippetLabel = countLabel(activeProfile.snippet_entries.length, "snippet");
  const activeProfileCurated = isCuratedTextProfile(activeProfile);
  const workModeSummary = describeTextProfileWorkMode(activeProfile);
  const profileProcessingMode = activeProfile.work_mode?.processing_mode ?? config.processing_mode;
  const profileModeLabel = processingModeLabel(profileProcessingMode);

  const handleProfileSwitch = (profileId: string) => {
    onChange(buildTextProfilesPatch(config, profiles, profileId));
    void invoke("switch_active_text_profile", { profileId }).catch(() => {
      // Mocked test environments without a Tauri host will reject the invoke;
      // the local state has already been updated, so this is intentionally silent.
    });
  };

  const handleCreateProfile = () => {
    const nextProfile = createTextProfile();
    onChange(buildTextProfilesPatch(config, [...profiles, nextProfile], nextProfile.id));
    onOpenTextRules();
  };

  return (
    <section className="settings__profile-dock" aria-label="Active text profile">
      <div className="settings__profile-head">
        <div className="settings__profile-avatar" aria-hidden="true">{textProfileInitials(activeProfile)}</div>
        <div className="settings__profile-copy">
          <span className="settings__profile-kicker">Active profile</span>
          <strong>
            {activeProfile.label}
            {healthStatus && healthStatus !== "green" && (
              <span
                className={`settings__profile-health-dot settings__profile-health-dot--${healthStatus}`}
                aria-label={healthStatus === "red" ? "Profile has a structural conflict" : "Profile has a potential friction"}
              />
            )}
          </strong>
        </div>
      </div>

      <div className="settings__profile-strip">
        <span className="settings__profile-mode">{activeProfileCurated ? "Included" : "Manual"}</span>
        <span className="settings__profile-stat">{contextConfigured ? "Context set" : "No context"}</span>
        <span className="settings__profile-stat">{dictionaryLabel}</span>
        <span className="settings__profile-stat">{snippetLabel}</span>
      </div>

      <p className="settings__profile-note">
        <span className="settings__profile-kicker">Profile defaults</span>
        <strong>{workModeSummary}</strong>
      </p>

      {profileModeLabel && (
        <p className="settings__profile-note">
          <span className="settings__profile-kicker">Processing mode</span>
          <strong>{profileModeLabel}</strong>
        </p>
      )}

      <label className="settings__profile-field" htmlFor="settings-profile-select">
        <span>Switch profile</span>
        <select
          id="settings-profile-select"
          className="settings__profile-select"
          aria-label="Active profile"
          value={activeProfile.id}
          onChange={(event) => handleProfileSwitch(event.target.value)}
        >
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>{displayTextProfileLabel(profile)}</option>
          ))}
        </select>
      </label>

      <div className="settings__profile-actions">
        <button className="btn btn--cancel" type="button" onClick={handleCreateProfile}>
          New profile
        </button>
        <button className="btn btn--cancel" type="button" onClick={onOpenTextRules}>
          Open editor
        </button>
      </div>
    </section>
  );
}