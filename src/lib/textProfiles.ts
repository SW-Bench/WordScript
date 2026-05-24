import type {
  AppConfig,
  TextProfile,
  TextProfileCuration,
  TextProfileInsertBehavior,
  TextProfileRecoveryBehavior,
  TextProfileRewriteStyle,
  TextProfileWorkMode,
} from "../types/ipc";

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

function normalizeTextProfileRewriteStyle(value?: string | null): TextProfileRewriteStyle {
  switch ((value ?? "").trim().toLowerCase()) {
    case "verbatim":
      return "verbatim";
    case "polished":
    case "professional":
      return "polished";
    default:
      return "clean";
  }
}

function normalizeTextProfileInsertBehavior(value?: string | null): TextProfileInsertBehavior {
  switch ((value ?? "").trim().toLowerCase()) {
    case "clipboard_only":
    case "clipboard":
    case "manual":
      return "clipboard_only";
    default:
      return "auto_paste";
  }
}

function normalizeTextProfileRecoveryBehavior(value?: string | null): TextProfileRecoveryBehavior {
  switch ((value ?? "").trim().toLowerCase()) {
    case "standard":
    default:
      return "standard";
  }
}

function cloneTextProfileWorkMode(workMode?: Partial<TextProfileWorkMode> | null): TextProfileWorkMode {
  return {
    rewrite_style: normalizeTextProfileRewriteStyle(workMode?.rewrite_style),
    insert_behavior: normalizeTextProfileInsertBehavior(workMode?.insert_behavior),
    recovery_behavior: normalizeTextProfileRecoveryBehavior(workMode?.recovery_behavior),
  };
}

export function createEmptyTextProfileCuration(): TextProfileCuration {
  return cloneTextProfileCuration();
}

export function createDefaultTextProfileWorkMode(): TextProfileWorkMode {
  return cloneTextProfileWorkMode();
}

export function resolveTextProfileWorkMode(profile: Pick<TextProfile, "work_mode">): TextProfileWorkMode {
  return cloneTextProfileWorkMode(profile.work_mode);
}

function rewriteStyleLabel(value: TextProfileRewriteStyle): string {
  switch (value) {
    case "verbatim":
      return "Verbatim rewrite";
    case "polished":
      return "Polished rewrite";
    default:
      return "Clean rewrite";
  }
}

function insertBehaviorLabel(value: TextProfileInsertBehavior): string {
  switch (value) {
    case "clipboard_only":
      return "Clipboard-only delivery";
    default:
      return "Auto-paste delivery";
  }
}

function recoveryBehaviorLabel(value: TextProfileRecoveryBehavior): string {
  switch (value) {
    case "standard":
    default:
      return "Standard recovery";
  }
}

export function describeTextProfileWorkMode(profile: Pick<TextProfile, "work_mode">): string {
  const workMode = resolveTextProfileWorkMode(profile);
  return `${rewriteStyleLabel(workMode.rewrite_style)}, ${insertBehaviorLabel(workMode.insert_behavior)}, ${recoveryBehaviorLabel(workMode.recovery_behavior)}`;
}

export function cloneTextProfile(profile: TextProfile, overrides: Partial<TextProfile> = {}): TextProfile {
  return {
    ...profile,
    ...overrides,
    work_mode: cloneTextProfileWorkMode(overrides.work_mode ?? profile.work_mode),
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
    ? `${profile.label} (included)`
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
    work_mode: createDefaultTextProfileWorkMode(),
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
    work_mode: createDefaultTextProfileWorkMode(),
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