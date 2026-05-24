import curatedTextProfiles from "../data/curatedTextProfiles.json";
import type { DictionaryEntry, SnippetEntry, TextProfile } from "../types/ipc";
import {
  clearTextProfileCuration,
  cloneTextProfile,
  createEmptyTextProfileCuration,
} from "./textProfiles";

export const CURATED_TEXT_PROFILE_SEEDS: TextProfile[] = curatedTextProfiles as TextProfile[];

function createEntityId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function normalizedKey(value: string) {
  return value.trim().toLowerCase();
}

function uniqueProfileLabel(label: string, takenLabels: string[]) {
  const trimmed = label.trim() || "New profile";
  const taken = new Set(takenLabels.map((entry) => normalizedKey(entry)));

  if (!taken.has(normalizedKey(trimmed))) {
    return trimmed;
  }

  let suffix = 2;
  while (taken.has(normalizedKey(`${trimmed} ${suffix}`))) {
    suffix += 1;
  }

  return `${trimmed} ${suffix}`;
}

function promptLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function mergeLineList(currentValue: string, sourceValue: string) {
  const lines = promptLines(currentValue);
  const seen = new Set(lines.map((line) => normalizedKey(line)));

  for (const line of promptLines(sourceValue)) {
    const key = normalizedKey(line);
    if (!key || seen.has(key)) {
      continue;
    }

    lines.push(line);
    seen.add(key);
  }

  return lines.join("\n");
}

function cloneDictionaryEntry(entry: DictionaryEntry): DictionaryEntry {
  return { ...entry };
}

function cloneSnippetEntry(entry: SnippetEntry): SnippetEntry {
  return { ...entry };
}

export function buildCuratedTextProfiles(): TextProfile[] {
  return CURATED_TEXT_PROFILE_SEEDS.map((profile) => cloneTextProfile(profile));
}

export function createTextProfileFromTemplate(profile: TextProfile, takenLabels: string[] = []): TextProfile {
  return cloneTextProfile(profile, {
    id: createEntityId("profile"),
    label: uniqueProfileLabel(profile.label, takenLabels),
    curation: createEmptyTextProfileCuration(),
  });
}

export function mergeTemplateIntoTextProfile(profile: TextProfile, sourceProfile: TextProfile): TextProfile {
  const nextProfile = clearTextProfileCuration(profile);
  nextProfile.work_mode = cloneTextProfile(sourceProfile).work_mode;

  nextProfile.prompt = mergeLineList(nextProfile.prompt, sourceProfile.prompt);
  nextProfile.stt_hints = mergeLineList(nextProfile.stt_hints, sourceProfile.stt_hints);

  const dictionaryKeys = new Set(nextProfile.dictionary_entries.map((entry) => normalizedKey(entry.phrase)));
  for (const entry of sourceProfile.dictionary_entries) {
    const key = normalizedKey(entry.phrase);
    if (!key || dictionaryKeys.has(key)) {
      continue;
    }

    nextProfile.dictionary_entries.push(cloneDictionaryEntry(entry));
    dictionaryKeys.add(key);
  }

  const snippetKeys = new Set(
    nextProfile.snippet_entries.map((entry) => normalizedKey(entry.trigger || entry.label)),
  );
  for (const entry of sourceProfile.snippet_entries) {
    const key = normalizedKey(entry.trigger || entry.label);
    if (!key || snippetKeys.has(key)) {
      continue;
    }

    nextProfile.snippet_entries.push(cloneSnippetEntry(entry));
    snippetKeys.add(key);
  }

  return nextProfile;
}
