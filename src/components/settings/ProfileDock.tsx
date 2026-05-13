import type { AppConfig } from "../../types/ipc";
import {
  buildTextProfilesPatch,
  cloneTextProfile,
  createTextProfile,
  resolveActiveTextProfile,
  textProfileInitials,
} from "../../lib/textProfiles";

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

interface ProfileDockProps {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
  onOpenTextRules: () => void;
}

export function ProfileDock({ config, onChange, onOpenTextRules }: ProfileDockProps) {
  const profiles = config.text_profiles?.length
    ? config.text_profiles.map((profile) => cloneTextProfile(profile))
    : [resolveActiveTextProfile(config)];
  const activeProfile = resolveActiveTextProfile(config);
  const contextConfigured = activeProfile.prompt.trim().length > 0;
  const dictionaryLabel = countLabel(activeProfile.dictionary_entries.length, "term");
  const snippetLabel = countLabel(activeProfile.snippet_entries.length, "snippet");

  const handleProfileSwitch = (profileId: string) => {
    onChange(buildTextProfilesPatch(config, profiles, profileId));
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
          <strong>{activeProfile.label}</strong>
        </div>
      </div>

      <div className="settings__profile-strip">
        <span className="settings__profile-mode">Manual</span>
        <span className="settings__profile-stat">{contextConfigured ? "Context set" : "No context"}</span>
        <span className="settings__profile-stat">{dictionaryLabel}</span>
        <span className="settings__profile-stat">{snippetLabel}</span>
      </div>

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
            <option key={profile.id} value={profile.id}>{profile.label}</option>
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