import type { AppConfig, TextProfile, TextProfileCuration } from "../types/ipc";

function createProfileId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `profile-${crypto.randomUUID()}`;
  }

  return `profile-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function cloneTextProfileCuration(curation?: TextProfileCuration): TextProfileCuration {
  return {
    curated: curation?.curated ?? false,
    audience: curation?.audience ?? "",
    summary: curation?.summary ?? "",
    highlights: [...(curation?.highlights ?? [])],
  };
}

export function createEmptyTextProfileCuration(): TextProfileCuration {
  return cloneTextProfileCuration();
}

export function cloneTextProfile(profile: TextProfile, overrides: Partial<TextProfile> = {}): TextProfile {
  return {
    ...profile,
    ...overrides,
    curation: cloneTextProfileCuration(overrides.curation ?? profile.curation),
    dictionary_entries: (overrides.dictionary_entries ?? profile.dictionary_entries).map((entry) => ({ ...entry })),
    snippet_entries: (overrides.snippet_entries ?? profile.snippet_entries).map((entry) => ({ ...entry })),
  };
}

export function isCuratedTextProfile(profile: TextProfile): boolean {
  return Boolean(profile.curation?.curated);
}

export function clearTextProfileCuration(profile: TextProfile): TextProfile {
  if (!isCuratedTextProfile(profile)) {
    return profile;
  }

  return {
    ...profile,
    curation: createEmptyTextProfileCuration(),
  };
}

export function displayTextProfileLabel(profile: TextProfile): string {
  return isCuratedTextProfile(profile)
    ? `${profile.label} (curated)`
    : profile.label;
}

export function resolveActiveTextProfile(config: AppConfig): TextProfile {
  const profiles = config.text_profiles ?? [];
  const activeProfile = profiles.find((profile) => profile.id === config.active_text_profile_id);

  if (activeProfile) {
    return cloneTextProfile(activeProfile);
  }

  if (profiles.length > 0) {
    return cloneTextProfile(profiles[0]);
  }

  return {
    id: config.active_text_profile_id || "general",
    label: "General writing",
    prompt: "",
    stt_hints: "",
    curation: createEmptyTextProfileCuration(),
    dictionary_entries: [],
    snippet_entries: [],
  };
}

export function createTextProfile(): TextProfile {
  return {
    id: createProfileId(),
    label: "New profile",
    prompt: "",
    stt_hints: "",
    curation: createEmptyTextProfileCuration(),
    dictionary_entries: [],
    snippet_entries: [],
  };
}

export function buildTextProfilesPatch(
  config: AppConfig,
  nextProfiles: TextProfile[],
  nextActiveProfileId?: string,
): Partial<AppConfig> {
  const normalizedProfiles = nextProfiles.length
    ? nextProfiles
    : [resolveActiveTextProfile(config)];

  const activeProfile = normalizedProfiles.find((profile) => profile.id === nextActiveProfileId)
    ?? normalizedProfiles[0];

  return {
    active_text_profile_id: activeProfile.id,
    text_profiles: normalizedProfiles,
  };
}

export function textProfileInitials(profile: TextProfile): string {
  const words = (profile.label.trim() || "Profile")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return (words.map((word) => word[0]?.toUpperCase() ?? "").join("") || "PR").slice(0, 2);
}