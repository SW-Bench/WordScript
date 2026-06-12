import { invoke } from "@tauri-apps/api/core";
import { ChevronRight } from "lucide-react";
import type { AppConfig } from "@/types/ipc";
import {
  buildTextProfilesPatch,
  cloneTextProfile,
  displayTextProfileLabel,
  resolveActiveTextProfile,
  textProfileInitials,
} from "@/lib/textProfiles";
import { Select } from "./Select";

interface ProfileSwitcherProps {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
  onEdit: () => void;
}

/** Compact active-profile switcher for the sidebar footer. Deep edits live in Profiles. */
export function ProfileSwitcher({ config, onChange, onEdit }: ProfileSwitcherProps) {
  const profiles = config.text_profiles?.length
    ? config.text_profiles.map((profile) => cloneTextProfile(profile))
    : [resolveActiveTextProfile(config)];
  const active = resolveActiveTextProfile(config);

  const handleSwitch = (id: string) => {
    onChange(buildTextProfilesPatch(config, profiles, id));
    void invoke("switch_active_text_profile", { profileId: id });
  };

  return (
    <div className="flex flex-col gap-2.5 p-3.5">
      <div className="flex items-center gap-2.5">
        <div
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-soft text-[11px] font-semibold text-brand-strong"
        >
          {textProfileInitials(active)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
            Profile
          </div>
          <div className="truncate text-[12.5px] font-medium leading-tight text-foreground">
            {active.label}
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit profiles"
          className="shrink-0 rounded-md p-1 text-fg-muted transition-colors hover:bg-[var(--surface-2)] hover:text-foreground"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
      <Select
        value={active.id}
        onChange={(e) => handleSwitch(e.target.value)}
        aria-label="Switch active profile"
        className="text-[12px]"
      >
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {displayTextProfileLabel(profile)}
          </option>
        ))}
      </Select>
    </div>
  );
}
