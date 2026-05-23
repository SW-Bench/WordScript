import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { BadgeCheck, SquarePen } from "lucide-react";
import type { AppConfig, DictionaryEntry, SnippetEntry, TextProfile } from "../../types/ipc";
import {
  buildTextProfilesPatch,
  clearTextProfileCuration,
  cloneTextProfile,
  createTextProfile,
  displayTextProfileLabel,
  isCuratedTextProfile,
  resolveActiveTextProfile,
} from "../../lib/textProfiles";
import {
  createTextProfileFromTemplate,
  mergeTemplateIntoTextProfile,
} from "../../lib/textProfileTemplates";
import type {
  ExportTextRulesResponse,
  ImportTextRulesResponse,
  TextRulesAnalysis,
  TextRulesConflictResolution,
  TextRulesIssue,
} from "../../types/textRules";

interface Props {
  config: AppConfig;
  onChange: (p: Partial<AppConfig>) => void;
  onValidationChange?: (analysis: TextRulesAnalysis | null) => void;
}

const DEFAULT_SAMPLE_TEXT = "word script follow up note";
const ANALYSIS_DEBOUNCE_MS = 120;
const EMPTY_ISSUES: TextRulesIssue[] = [];

interface RuleSummary {
  id: string;
  kind: "dictionary" | "snippet";
  label: string;
  detail: string;
}

interface PreviewRuleChip {
  key: string;
  label: string;
  title: string;
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return items;

  const nextItems = [...items];
  const [item] = nextItems.splice(index, 1);
  nextItems.splice(nextIndex, 0, item);
  return nextItems;
}

function formatRuleTitle(value: string, fallback: string) {
  const trimmed = value.trim();
  return trimmed || fallback;
}

function buildRuleLookup(dictionaryEntries: DictionaryEntry[], snippetEntries: SnippetEntry[]) {
  const lookup = new Map<string, RuleSummary>();

  for (const entry of dictionaryEntries) {
    lookup.set(entry.id, {
      id: entry.id,
      kind: "dictionary",
      label: `Dictionary: ${formatRuleTitle(entry.phrase, "Untitled term")}`,
      detail: entry.replace_with.trim()
        ? `Replaces with ${entry.replace_with.trim()}`
        : "Replacement missing",
    });
  }

  for (const entry of snippetEntries) {
    const label = entry.label.trim() || entry.trigger.trim() || "Untitled snippet";
    lookup.set(entry.id, {
      id: entry.id,
      kind: "snippet",
      label: `Snippet: ${label}`,
      detail: entry.trigger.trim()
        ? `Triggered by ${entry.trigger.trim()}`
        : "Trigger missing",
    });
  }

  return lookup;
}

function humanizeFallbackRule(rule: string) {
  const parts = rule.split(":");
  const trimmed = parts[parts.length - 1] ?? rule;
  return trimmed
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character: string) => character.toUpperCase());
}

function buildPreviewRuleChip(rule: string, lookup: Map<string, RuleSummary>): PreviewRuleChip {
  const [kind, ruleId] = rule.split(":", 2);
  const resolved = ruleId ? lookup.get(ruleId) : undefined;

  if (resolved) {
    return {
      key: rule,
      label: resolved.label,
      title: `${resolved.label}. ${resolved.detail}`,
    };
  }

  if (kind === "dictionary") {
    return {
      key: rule,
      label: `Dictionary: ${humanizeFallbackRule(rule)}`,
      title: "Dictionary replacement applied during preview.",
    };
  }

  if (kind === "snippet") {
    return {
      key: rule,
      label: `Snippet: ${humanizeFallbackRule(rule)}`,
      title: "Snippet expansion applied during preview.",
    };
  }

  return {
    key: rule,
    label: humanizeFallbackRule(rule),
    title: "A text rule changed the preview output.",
  };
}

function buildIssueMap(issues: TextRulesIssue[]) {
  const ruleIssues = new Map<string, TextRulesIssue[]>();

  for (const issue of issues) {
    for (const ruleId of issue.rule_ids) {
      const current = ruleIssues.get(ruleId) ?? [];
      current.push(issue);
      ruleIssues.set(ruleId, current);
    }
  }

  return ruleIssues;
}

function hasSeverity(issues: TextRulesIssue[], severity: TextRulesIssue["severity"]) {
  return issues.some((issue) => issue.severity === severity);
}

function createRuleId(prefix: string) {
  const random = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.round(Math.random() * 100000)}`;
  return `${prefix}-${random}`;
}

function countPromptLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .length;
}

function makeDictionaryEntry(): DictionaryEntry {
  return {
    id: createRuleId("dict"),
    phrase: "",
    replace_with: "",
  };
}

function makeSnippetEntry(): SnippetEntry {
  return {
    id: createRuleId("snippet"),
    label: "",
    trigger: "",
    expansion: "",
  };
}

interface RuleCardRefRegistrar {
  (ruleId: string, element: HTMLElement | null): void;
}

interface DictionaryRuleCardProps {
  entry: DictionaryEntry;
  index: number;
  totalCount: number;
  isActive: boolean;
  issues: TextRulesIssue[];
  registerRef: RuleCardRefRegistrar;
  onMove: (id: string, direction: -1 | 1) => void;
  onChange: (id: string, key: keyof DictionaryEntry, value: string) => void;
  onRemove: (id: string) => void;
}

const DictionaryRuleCard = memo(function DictionaryRuleCard({
  entry,
  index,
  totalCount,
  isActive,
  issues,
  registerRef,
  onMove,
  onChange,
  onRemove,
}: DictionaryRuleCardProps) {
  const cardClassName = `settings__rule-card${isActive ? " settings__rule-card--active" : ""}${hasSeverity(issues, "error") ? " settings__rule-card--error" : hasSeverity(issues, "warning") ? " settings__rule-card--warning" : ""}`;

  return (
    <article
      ref={(element) => {
        registerRef(entry.id, element);
      }}
      className={cardClassName}
    >
      <div className="settings__rule-card-head">
        <div className="settings__rule-card-heading">
          <strong className="settings__rule-card-title">Dictionary term {index + 1}</strong>
          <span className="settings__rule-meta">
            Runs in order. Later rules see the output of earlier ones.
          </span>
        </div>
        <div className="settings__rule-card-buttons">
          <button className="settings__rule-mini-btn" type="button" onClick={() => onMove(entry.id, -1)} disabled={index === 0}>
            Move up
          </button>
          <button className="settings__rule-mini-btn" type="button" onClick={() => onMove(entry.id, 1)} disabled={index === totalCount - 1}>
            Move down
          </button>
        </div>
      </div>
      <div className="settings__rule-grid">
        <label className="settings__rule-field">
          <span>Heard as</span>
          <input
            type="text"
            value={entry.phrase}
            onChange={(event) => onChange(entry.id, "phrase", event.target.value)}
            placeholder="e.g. word script"
          />
        </label>
        <label className="settings__rule-field">
          <span>Replace with</span>
          <input
            type="text"
            value={entry.replace_with}
            onChange={(event) => onChange(entry.id, "replace_with", event.target.value)}
            placeholder="e.g. WordScript"
          />
        </label>
      </div>
      <div className="settings__rule-actions">
        <span className="settings__rule-meta">Literal whole-phrase match, case-insensitive. Add separate entries for variants.</span>
        <button className="btn btn--cancel" type="button" onClick={() => onRemove(entry.id)}>
          Remove
        </button>
      </div>
      {issues.length > 0 && (
        <div className="settings__rule-inline-issues">
          {issues.map((issue) => (
            <div key={`${entry.id}-${issue.code}-${issue.message}`} className={`settings__rule-inline-issue settings__rule-inline-issue--${issue.severity}`}>
              <strong>{issue.severity}</strong>
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
});

interface SnippetRuleCardProps {
  entry: SnippetEntry;
  index: number;
  totalCount: number;
  isActive: boolean;
  issues: TextRulesIssue[];
  registerRef: RuleCardRefRegistrar;
  onMove: (id: string, direction: -1 | 1) => void;
  onChange: (id: string, key: keyof SnippetEntry, value: string) => void;
  onRemove: (id: string) => void;
}

const SnippetRuleCard = memo(function SnippetRuleCard({
  entry,
  index,
  totalCount,
  isActive,
  issues,
  registerRef,
  onMove,
  onChange,
  onRemove,
}: SnippetRuleCardProps) {
  const cardClassName = `settings__rule-card${isActive ? " settings__rule-card--active" : ""}${hasSeverity(issues, "error") ? " settings__rule-card--error" : hasSeverity(issues, "warning") ? " settings__rule-card--warning" : ""}`;

  return (
    <article
      ref={(element) => {
        registerRef(entry.id, element);
      }}
      className={cardClassName}
    >
      <div className="settings__rule-card-head">
        <div className="settings__rule-card-heading">
          <strong className="settings__rule-card-title">Snippet {index + 1}</strong>
          <span className="settings__rule-meta">
            Runs after Dictionary. Reorder when triggers overlap or one snippet should win over another.
          </span>
        </div>
        <div className="settings__rule-card-buttons">
          <button className="settings__rule-mini-btn" type="button" onClick={() => onMove(entry.id, -1)} disabled={index === 0}>
            Move up
          </button>
          <button className="settings__rule-mini-btn" type="button" onClick={() => onMove(entry.id, 1)} disabled={index === totalCount - 1}>
            Move down
          </button>
        </div>
      </div>
      <div className="settings__rule-grid settings__rule-grid--three">
        <label className="settings__rule-field">
          <span>Label</span>
          <input
            type="text"
            value={entry.label}
            onChange={(event) => onChange(entry.id, "label", event.target.value)}
            placeholder="e.g. Support follow-up"
          />
        </label>
        <label className="settings__rule-field">
          <span>Trigger phrase</span>
          <input
            type="text"
            value={entry.trigger}
            onChange={(event) => onChange(entry.id, "trigger", event.target.value)}
            placeholder="e.g. follow up note"
          />
        </label>
        <label className="settings__rule-field settings__rule-field--wide">
          <span>Expansion</span>
          <textarea
            value={entry.expansion}
            onChange={(event) => onChange(entry.id, "expansion", event.target.value)}
            placeholder="e.g. Thanks for the update. We will send the next status tomorrow morning."
            rows={4}
          />
        </label>
      </div>
      <div className="settings__rule-actions">
        <span className="settings__rule-meta">Literal trigger phrase match, case-insensitive, in the final transcript.</span>
        <button className="btn btn--cancel" type="button" onClick={() => onRemove(entry.id)}>
          Remove
        </button>
      </div>
      {issues.length > 0 && (
        <div className="settings__rule-inline-issues">
          {issues.map((issue) => (
            <div key={`${entry.id}-${issue.code}-${issue.message}`} className={`settings__rule-inline-issue settings__rule-inline-issue--${issue.severity}`}>
              <strong>{issue.severity}</strong>
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
});

export function PromptsTab({ config, onChange, onValidationChange }: Props) {
  const textProfiles = config.text_profiles?.length
    ? config.text_profiles
    : [resolveActiveTextProfile(config)];
  const activeTextProfile = textProfiles.find((profile) => profile.id === config.active_text_profile_id) ?? textProfiles[0];
  const sttHints = activeTextProfile.stt_hints ?? "";
  const dictionaryEntries = activeTextProfile.dictionary_entries ?? [];
  const snippetEntries = activeTextProfile.snippet_entries ?? [];
  const [sampleText, setSampleText] = useState(DEFAULT_SAMPLE_TEXT);
  const [analysis, setAnalysis] = useState<TextRulesAnalysis | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    path: string;
    resolution: TextRulesConflictResolution;
    payload: ImportTextRulesResponse;
  } | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [activeRuleId, setActiveRuleId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [activeWorkspacePanel, setActiveWorkspacePanel] = useState<"context" | "dictionary" | "snippets">("context");
  const [showStarterDetails, setShowStarterDetails] = useState(false);
  const [pendingFocusRuleId, setPendingFocusRuleId] = useState<string | null>(null);
  const ruleCardRefs = useRef<Record<string, HTMLElement | null>>({});
  const configRef = useRef(config);
  const textProfilesRef = useRef(textProfiles);
  const activeTextProfileIdRef = useRef(activeTextProfile.id);
  const curatedProfiles = textProfiles.filter((profile) => isCuratedTextProfile(profile));
  const selectedTemplate = curatedProfiles.find((profile) => profile.id === selectedTemplateId) ?? curatedProfiles[0] ?? null;

  configRef.current = config;
  textProfilesRef.current = textProfiles;
  activeTextProfileIdRef.current = activeTextProfile.id;

  useEffect(() => {
    if (curatedProfiles.length === 0) {
      if (selectedTemplateId) {
        setSelectedTemplateId("");
      }
      return;
    }

    if (!curatedProfiles.some((profile) => profile.id === selectedTemplateId)) {
      setSelectedTemplateId(curatedProfiles[0].id);
    }
  }, [curatedProfiles, selectedTemplateId]);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void invoke<TextRulesAnalysis>("analyze_text_rules", {
        request: {
          prompt: activeTextProfile.prompt,
          stt_hints: sttHints,
          dictionary_entries: dictionaryEntries,
          snippet_entries: snippetEntries,
          sample_text: sampleText,
        },
      }).then((next) => {
        if (cancelled) return;
        setAnalysis(next);
        onValidationChange?.(next);
      }).catch((error) => {
        if (cancelled) return;
        setAnalysis(null);
        onValidationChange?.(null);
        setFeedback({ ok: false, text: `Text-rule validation failed: ${error}` });
      });
    }, ANALYSIS_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeTextProfile.prompt, dictionaryEntries, onValidationChange, sampleText, snippetEntries, sttHints]);

  const applyProfiles = useCallback((nextProfiles: TextProfile[], nextActiveProfileId = activeTextProfileIdRef.current) => {
    onChange(buildTextProfilesPatch(configRef.current, nextProfiles, nextActiveProfileId));
  }, [onChange]);

  const updateActiveProfile = useCallback((update: Partial<TextProfile> | ((profile: TextProfile) => TextProfile)) => {
    const activeProfileId = activeTextProfileIdRef.current;
    const nextProfiles = textProfilesRef.current.map((profile) => {
      if (profile.id !== activeProfileId) return profile;

      const nextProfile = typeof update === "function"
        ? update(profile)
        : { ...profile, ...update };

      return clearTextProfileCuration(nextProfile);
    });

    applyProfiles(nextProfiles, activeProfileId);
  }, [applyProfiles]);

  const createProfile = () => {
    const nextProfile = createTextProfile();
    applyProfiles([...textProfiles, nextProfile], nextProfile.id);
    setActiveWorkspacePanel("context");
  };

  const createProfileFromStarter = () => {
    if (!selectedTemplate) return;

    const nextProfile = createTextProfileFromTemplate(
      selectedTemplate,
      textProfiles.map((profile) => profile.label),
    );

    applyProfiles([...textProfiles, nextProfile], nextProfile.id);
    setActiveWorkspacePanel("context");
    setMessage(true, `Created working copy from ${selectedTemplate.label}.`);
  };

  const mergeStarterIntoActiveProfile = () => {
    if (!selectedTemplate) return;

    updateActiveProfile((profile) => mergeTemplateIntoTextProfile(profile, selectedTemplate));
    setActiveWorkspacePanel("context");
    setMessage(true, `Merged ${selectedTemplate.label} into ${activeTextProfile.label}.`);
  };

  const duplicateProfile = () => {
    const nextProfileId = createTextProfile().id;
    const nextProfile = cloneTextProfile(activeTextProfile, {
      id: nextProfileId,
      label: activeTextProfile.label.trim() ? `${activeTextProfile.label} copy` : "Profile copy",
      curation: createTextProfile().curation,
    });
    applyProfiles([...textProfiles, nextProfile], nextProfile.id);
    setActiveWorkspacePanel("context");
  };

  const deleteActiveProfile = () => {
    if (textProfiles.length <= 1) return;

    const nextProfiles = textProfiles.filter((profile) => profile.id !== activeTextProfile.id);
    applyProfiles(nextProfiles, nextProfiles[0]?.id);
  };

  const updateDictionaryEntry = useCallback((id: string, key: keyof DictionaryEntry, value: string) => {
    updateActiveProfile((profile) => ({
      ...profile,
      dictionary_entries: (profile.dictionary_entries ?? []).map((entry) => (
        entry.id === id ? { ...entry, [key]: value } : entry
      )),
    }));
  }, [updateActiveProfile]);

  const removeDictionaryEntry = useCallback((id: string) => {
    updateActiveProfile((profile) => ({
      ...profile,
      dictionary_entries: (profile.dictionary_entries ?? []).filter((entry) => entry.id !== id),
    }));
  }, [updateActiveProfile]);

  const moveDictionaryEntry = useCallback((id: string, direction: -1 | 1) => {
    updateActiveProfile((profile) => {
      const entries = profile.dictionary_entries ?? [];
      const index = entries.findIndex((entry) => entry.id === id);
      if (index < 0) return profile;

      return {
        ...profile,
        dictionary_entries: moveItem(entries, index, direction),
      };
    });
    setActiveRuleId(id);
  }, [updateActiveProfile]);

  const updateSnippetEntry = useCallback((id: string, key: keyof SnippetEntry, value: string) => {
    updateActiveProfile((profile) => ({
      ...profile,
      snippet_entries: (profile.snippet_entries ?? []).map((entry) => (
        entry.id === id ? { ...entry, [key]: value } : entry
      )),
    }));
  }, [updateActiveProfile]);

  const removeSnippetEntry = useCallback((id: string) => {
    updateActiveProfile((profile) => ({
      ...profile,
      snippet_entries: (profile.snippet_entries ?? []).filter((entry) => entry.id !== id),
    }));
  }, [updateActiveProfile]);

  const moveSnippetEntry = useCallback((id: string, direction: -1 | 1) => {
    updateActiveProfile((profile) => {
      const entries = profile.snippet_entries ?? [];
      const index = entries.findIndex((entry) => entry.id === id);
      if (index < 0) return profile;

      return {
        ...profile,
        snippet_entries: moveItem(entries, index, direction),
      };
    });
    setActiveRuleId(id);
  }, [updateActiveProfile]);

  const setMessage = useCallback((ok: boolean, text: string) => {
    setFeedback({ ok, text });
  }, []);

  const startImport = async (resolution: TextRulesConflictResolution) => {
    setIsBusy(true);
    try {
      const selected = await open({
        multiple: false,
        title: resolution === "replace_current" ? "Replace text rules from file" : "Merge text rules from file",
        filters: [{ name: "WordScript text rules", extensions: ["json"] }],
      });
      if (typeof selected !== "string") return;

      const payload = await invoke<ImportTextRulesResponse>("import_text_rules", {
        request: {
          path: selected,
          current_prompt: activeTextProfile.prompt,
          current_stt_hints: sttHints,
          current_dictionary_entries: dictionaryEntries,
          current_snippet_entries: snippetEntries,
          sample_text: sampleText,
          resolution,
        },
      });

      setPendingImport({ path: selected, resolution, payload });
      setMessage(true, `Loaded import preview from ${selected.split(/[\\/]/).pop() ?? selected}`);
    } catch (error) {
      setPendingImport(null);
      setMessage(false, `Import preview failed: ${error}`);
    } finally {
      setIsBusy(false);
    }
  };

  const applyImport = () => {
    if (!pendingImport) return;
    updateActiveProfile({
      prompt: pendingImport.payload.document.prompt,
      stt_hints: pendingImport.payload.document.stt_hints,
      dictionary_entries: pendingImport.payload.document.dictionary_entries,
      snippet_entries: pendingImport.payload.document.snippet_entries,
    });
    setMessage(
      true,
      pendingImport.payload.analysis.blocking
        ? "Imported file loaded, but the merged result still contains blocking issues. Fix them before saving."
        : `Applied ${pendingImport.resolution === "replace_current" ? "replacement" : "merge"} import.`,
    );
    setPendingImport(null);
  };

  const exportRules = async () => {
    setIsBusy(true);
    try {
      const target = await save({
        title: "Export text rules",
        defaultPath: "wordscript-text-rules.json",
        filters: [{ name: "WordScript text rules", extensions: ["json"] }],
      });
      if (!target) return;

      const result = await invoke<ExportTextRulesResponse>("export_text_rules", {
        request: {
          path: target,
          prompt: activeTextProfile.prompt,
          stt_hints: sttHints,
          dictionary_entries: dictionaryEntries,
          snippet_entries: snippetEntries,
        },
      });

      setMessage(true, `Exported text rules to ${result.path.split(/[\\/]/).pop() ?? result.path}`);
    } catch (error) {
      setMessage(false, `Export failed: ${error}`);
    } finally {
      setIsBusy(false);
    }
  };

  const previewSource = pendingImport?.payload.analysis ?? analysis;
  const issueList = previewSource?.issues ?? EMPTY_ISSUES;
  const previewDictionaryEntries = pendingImport?.payload.document.dictionary_entries ?? dictionaryEntries;
  const previewSnippetEntries = pendingImport?.payload.document.snippet_entries ?? snippetEntries;
  const previewRuleLookup = useMemo(
    () => buildRuleLookup(previewDictionaryEntries, previewSnippetEntries),
    [previewDictionaryEntries, previewSnippetEntries],
  );
  const currentRuleLookup = useMemo(
    () => buildRuleLookup(dictionaryEntries, snippetEntries),
    [dictionaryEntries, snippetEntries],
  );
  const currentIssueMap = useMemo(
    () => buildIssueMap(analysis?.issues ?? EMPTY_ISSUES),
    [analysis?.issues],
  );
  const previewRuleChips = useMemo(
    () => (previewSource?.preview.applied_rules ?? []).map((rule) => buildPreviewRuleChip(rule, previewRuleLookup)),
    [previewRuleLookup, previewSource?.preview.applied_rules],
  );
  const hasImportedOnlyIssues = Boolean(pendingImport && issueList.some((entry) => entry.rule_ids.some((ruleId) => !currentRuleLookup.has(ruleId))));
  const activePromptLineCount = countPromptLines(activeTextProfile.prompt);
  const activeSttHintLineCount = countPromptLines(activeTextProfile.stt_hints);
  const selectedTemplatePromptLines = selectedTemplate ? countPromptLines(selectedTemplate.prompt) : 0;
  const selectedTemplateSttHintLines = selectedTemplate ? countPromptLines(selectedTemplate.stt_hints) : 0;
  const selectedTemplateContextLines = selectedTemplate?.prompt.split(/\r?\n/).filter(Boolean) ?? [];
  const selectedTemplateSttHintPreview = selectedTemplate?.stt_hints.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) ?? [];
  const selectedTemplateDictionaryPreview = selectedTemplate?.dictionary_entries.slice(0, 4) ?? [];
  const selectedTemplateSnippetPreview = selectedTemplate?.snippet_entries.slice(0, 4) ?? [];
  const totalRuleCount = dictionaryEntries.length + snippetEntries.length;
  const activeWorkspaceCopy = activeWorkspacePanel === "context"
    ? {
      step: "Step 1 of 3",
      title: "Context & Preview",
      summary: "Teach the recognizer your names, jargon and a few explicit spoken cues, then verify the literal rule pass on a likely transcript.",
      status: `${activePromptLineCount} context lines · ${activeSttHintLineCount} STT hints`,
      note: "Start here. Keep the context concrete, and only add a handful of explicit STT hints you really want forwarded into the transcription request.",
    }
    : activeWorkspacePanel === "dictionary"
      ? {
        step: "Step 2 of 3",
        title: "Dictionary",
        summary: "Add literal replacements for product names, people, acronyms and recurring mishears.",
        status: `${dictionaryEntries.length} dictionary rules`,
        note: "Author one rule per likely transcript variant. If the recognizer says the same thing in three ways, model those three ways explicitly.",
      }
      : {
        step: "Step 3 of 3",
        title: "Snippets",
        summary: "Create deliberate spoken macros for reusable expansions such as follow-ups, handoffs and recap blocks.",
        status: `${snippetEntries.length} snippets`,
        note: "Only use snippet triggers you are comfortable saying almost verbatim. They are literal phrase matches, not semantic intents.",
      };

  const registerRuleCardRef = useCallback((ruleId: string, element: HTMLElement | null) => {
    ruleCardRefs.current[ruleId] = element;
  }, []);

  useEffect(() => {
    if (!pendingFocusRuleId) return;

    const target = ruleCardRefs.current[pendingFocusRuleId];
    if (!target) return;

    target.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea")?.focus();
    setPendingFocusRuleId(null);
  }, [activeWorkspacePanel, dictionaryEntries, pendingFocusRuleId, snippetEntries]);

  const focusRuleCard = (ruleId: string) => {
    const rule = currentRuleLookup.get(ruleId);
    if (rule?.kind === "dictionary") {
      setActiveWorkspacePanel("dictionary");
    } else if (rule?.kind === "snippet") {
      setActiveWorkspacePanel("snippets");
    }

    setActiveRuleId(ruleId);
    setPendingFocusRuleId(ruleId);
  };

  return (
    <>
      <div className="tab__title">Text Rules</div>

      <div className="settings__rule-toolbar settings__rule-toolbar--top">
        <div className="settings__rule-toolbar-copy">
          <strong>Portable personal text rules</strong>
          <span>These rules run after speech-to-text. Import/export stays local via JSON, and preview uses the same native text-rule pass that runs before insertion.</span>
        </div>
        <div className="settings__rule-toolbar-buttons">
          <button className="btn btn--cancel" type="button" onClick={() => void startImport("merge_imported_wins")} disabled={isBusy}>
            Import & merge
          </button>
          <button className="btn btn--cancel" type="button" onClick={() => void startImport("replace_current")} disabled={isBusy}>
            Replace from file
          </button>
          <button className="btn btn--save" type="button" onClick={() => void exportRules()} disabled={isBusy}>
            Export rules
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`settings__rule-feedback${feedback.ok ? " settings__rule-feedback--ok" : " settings__rule-feedback--error"}`}>
          {feedback.text}
        </div>
      )}

      {pendingImport && (
        <div className="settings__rule-import-card">
          <div className="settings__rule-import-head">
            <div>
              <strong>Pending import preview</strong>
              <p>
                {pendingImport.resolution === "replace_current"
                  ? "Replace mode overwrites the current prompt, STT hints, dictionary and snippets with the imported file."
                  : "Merge mode preserves the current prompt and STT hints unless they are empty and lets imported phrase/trigger matches replace existing rules."}
              </p>
            </div>
            <span>{pendingImport.path.split(/[\\/]/).pop() ?? pendingImport.path}</span>
          </div>
          <div className="settings__rule-actions">
            <span className="settings__rule-meta">
              {pendingImport.payload.analysis.dictionary_count} dictionary entries, {pendingImport.payload.analysis.snippet_count} snippets after {pendingImport.resolution === "replace_current" ? "replace" : "merge"}.
            </span>
            <div className="settings__rule-toolbar-buttons">
              <button className="btn btn--cancel" type="button" onClick={() => setPendingImport(null)}>
                Discard preview
              </button>
              <button className="btn btn--save" type="button" onClick={applyImport} disabled={pendingImport.payload.analysis.blocking}>
                Apply import
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="settings__summary-grid settings__summary-grid--three settings__editor-process-summary" aria-label="Text rules process summary">
        <article className="settings__summary-item">
          <span>Active profile</span>
          <strong>{activeTextProfile.label}</strong>
          <small>{activePromptLineCount} context lines, {activeSttHintLineCount} STT hints and {totalRuleCount} authored rules in this local mode{isCuratedTextProfile(activeTextProfile) ? ". Still marked curated until you edit it." : "."}</small>
        </article>
        <article className="settings__summary-item">
          <span>Rule order</span>
          <strong>Dictionary -&gt; Snippets</strong>
          <small>Literal, case-insensitive matches in authored order. Preview and runtime follow the same pass.</small>
        </article>
        <article className="settings__summary-item">
          <span>Current step</span>
          <strong>{activeWorkspaceCopy.title}</strong>
          <small>{activeWorkspaceCopy.note}</small>
        </article>
      </div>

      <div className="settings__editor-shell">
        <div className="settings__editor-setup-grid">
          <article className="settings__editor-setup-card">
            <div className="settings__editor-setup-head settings__editor-profile-head">
              <div className="settings__editor-setup-copy">
                <span className="settings__template-kicker">Profile setup</span>
                <strong>Pick the profile you want to shape</strong>
                <p>Keep switching and renaming here. Everything below edits the active profile only.</p>
              </div>
              <div className="settings__editor-setup-indicator" aria-label={`Active profile ${activeTextProfile.label}`}>
                <div className="settings__editor-profile-badge" aria-hidden="true">
                  <SquarePen className="settings__editor-profile-icon" size={18} strokeWidth={2} />
                </div>
                <div className="settings__editor-profile-button-copy">
                  <strong>{activeTextProfile.label}</strong>
                  <span>{isCuratedTextProfile(activeTextProfile) ? "Curated profile" : "Active writing mode"}</span>
                </div>
                {isCuratedTextProfile(activeTextProfile) ? (
                  <span className="settings__editor-profile-status">
                    <BadgeCheck className="settings__editor-profile-status-icon" size={14} strokeWidth={2} />
                    Curated
                  </span>
                ) : null}
              </div>
            </div>
            <div className="settings__template-highlight-row settings__template-highlight-row--compact settings__editor-setup-pills">
              <span className="settings__template-highlight">{activeTextProfile.label}</span>
              {isCuratedTextProfile(activeTextProfile) && <span className="settings__template-highlight">Curated</span>}
              <span className="settings__template-highlight">{activePromptLineCount} context lines</span>
              <span className="settings__template-highlight">{activeSttHintLineCount} STT hints</span>
              <span className="settings__template-highlight">{dictionaryEntries.length} terms</span>
              <span className="settings__template-highlight">{snippetEntries.length} snippets</span>
            </div>
            <div className="settings__editor-setup-fields settings__editor-profile-fields">
              <div className="form-row">
                <label htmlFor="text-profile-select">Active profile</label>
                <select
                  id="text-profile-select"
                  aria-label="Active profile"
                  value={activeTextProfile.id}
                  onChange={(event) => applyProfiles(textProfiles, event.target.value)}
                >
                  {textProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>{displayTextProfileLabel(profile)}</option>
                  ))}
                </select>
              </div>
              <label className="settings__rule-field settings__rule-field--wide">
                <span>Profile label</span>
                <input
                  type="text"
                  value={activeTextProfile.label}
                  onChange={(event) => updateActiveProfile({ label: event.target.value })}
                  placeholder="e.g. Support reply"
                />
              </label>
            </div>
            <div className="settings__editor-setup-actions settings__editor-profile-actions">
              <button className="btn btn--cancel" type="button" onClick={createProfile}>
                New profile
              </button>
              <button className="btn btn--cancel" type="button" onClick={duplicateProfile}>
                Duplicate profile
              </button>
              <button className="btn btn--cancel" type="button" onClick={deleteActiveProfile} disabled={textProfiles.length <= 1}>
                Delete profile
              </button>
            </div>
            <p className="settings__editor-setup-note">Each profile carries its own context, optional STT hints, dictionary and snippets. Curated profiles ship inside this app config on first run, but the first real edit turns them into normal user-owned profiles. Preview, import/export and runtime all follow the same active profile.</p>
          </article>

          <article className="settings__editor-setup-card settings__editor-setup-card--starter">
            <div className="settings__editor-setup-head">
              <div className="settings__editor-setup-copy">
                <span className="settings__template-kicker">Curated profiles</span>
                <strong>Use the built-in baselines already in your app</strong>
                <p>These profiles are persisted like any other profile. They keep a curated label only until you edit them.</p>
              </div>
            </div>
            {selectedTemplate ? (
              <div className="settings__editor-starter-summary">
                <div className="settings__editor-starter-summary-copy">
                  <span className="settings__template-kicker">Selected curated profile</span>
                  <strong>{selectedTemplate.label}</strong>
                  <p>{selectedTemplate.curation.summary}</p>
                </div>
                <div className="settings__template-highlight-row settings__template-highlight-row--compact">
                  <span className="settings__template-highlight">Curated</span>
                  <span className="settings__template-highlight">{selectedTemplatePromptLines} context lines</span>
                  <span className="settings__template-highlight">{selectedTemplateSttHintLines} STT hints</span>
                  <span className="settings__template-highlight">{selectedTemplate.dictionary_entries.length} terms</span>
                  <span className="settings__template-highlight">{selectedTemplate.snippet_entries.length} snippets</span>
                </div>
                <div className="settings__editor-setup-actions settings__editor-setup-actions--starter">
                  <button className="settings__rule-mini-btn" type="button" onClick={createProfileFromStarter}>
                    Create working copy
                  </button>
                  <button className="settings__rule-mini-btn" type="button" onClick={mergeStarterIntoActiveProfile}>
                    Merge into active
                  </button>
                  <button className="settings__rule-mini-btn" type="button" onClick={() => setShowStarterDetails((current) => !current)}>
                    {showStarterDetails ? "Hide curated details" : "Show curated details"}
                  </button>
                </div>
                {showStarterDetails && (
                  <div className="settings__editor-starter-detail-list">
                    <article className="settings__editor-starter-detail-card">
                      <span className="settings__rule-preview-label">Context focus</span>
                      <ul className="settings__template-list">
                        {selectedTemplateContextLines.slice(0, 4).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </article>
                    <article className="settings__editor-starter-detail-card">
                      <span className="settings__rule-preview-label">Optional STT hints</span>
                      <ul className="settings__template-list">
                        {selectedTemplateSttHintPreview.slice(0, 4).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </article>
                    <article className="settings__editor-starter-detail-card">
                      <span className="settings__rule-preview-label">Key replacements</span>
                      <ul className="settings__template-list">
                        {selectedTemplateDictionaryPreview.slice(0, 3).map((entry) => (
                          <li key={entry.phrase}>{entry.phrase}{" -> "}{entry.replace_with}</li>
                        ))}
                      </ul>
                    </article>
                    <article className="settings__editor-starter-detail-card">
                      <span className="settings__rule-preview-label">Ready snippets</span>
                      <ul className="settings__template-list">
                        {selectedTemplateSnippetPreview.slice(0, 3).map((entry) => (
                          <li key={entry.trigger}>{entry.label}: {entry.trigger}</li>
                        ))}
                      </ul>
                    </article>
                  </div>
                )}
              </div>
            ) : (
              <div className="settings__editor-starter-summary">
                <div className="settings__editor-starter-summary-copy">
                  <span className="settings__template-kicker">Curated profiles exhausted</span>
                  <strong>No untouched curated profiles left</strong>
                  <p>Every built-in baseline in this app has already been edited. They now behave like regular user-owned profiles.</p>
                </div>
              </div>
            )}
            <div className="settings__editor-template-list" role="list" aria-label="Curated profiles in this app">
              {curatedProfiles.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={`settings__template-tile settings__template-tile--compact${selectedTemplate?.id === template.id ? " settings__template-tile--active" : ""}`}
                  aria-label={`Select ${template.label} curated profile`}
                  aria-pressed={selectedTemplate?.id === template.id}
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <span className="settings__template-kicker">{template.curation.audience}</span>
                  <strong>{template.label}</strong>
                  <div className="settings__rule-chip-row">
                    <span className="settings__rule-chip">Curated</span>
                    <span className="settings__rule-chip">{template.dictionary_entries.length} terms</span>
                    <span className="settings__rule-chip">{template.snippet_entries.length} snippets</span>
                  </div>
                </button>
              ))}
            </div>
          </article>
        </div>

        <article className="settings__editor-workspace-bar">
          <div className="settings__editor-workspace-copy">
            <span className="settings__template-kicker">{activeWorkspaceCopy.step}</span>
            <strong className="settings__editor-workspace-title">{activeWorkspaceCopy.title}</strong>
            <p>{activeWorkspaceCopy.summary}</p>
          </div>
          <div className="settings__template-highlight-row settings__template-highlight-row--compact settings__editor-workspace-pills">
            <span className="settings__template-highlight">{activeTextProfile.label}</span>
            {isCuratedTextProfile(activeTextProfile) && <span className="settings__template-highlight">Curated</span>}
            <span className="settings__template-highlight">{activeWorkspaceCopy.status}</span>
          </div>
        </article>

        <div className="settings__editor-step-list" role="tablist" aria-label="Text rules workspace">
            <button
              className={`settings__editor-step-button${activeWorkspacePanel === "context" ? " settings__editor-step-button--active" : ""}`}
              type="button"
              role="tab"
              aria-label="Open context and preview workspace"
              aria-selected={activeWorkspacePanel === "context"}
              onClick={() => setActiveWorkspacePanel("context")}
            >
              <div className="settings__editor-step-button-head">
                <span className="settings__editor-step-index" aria-hidden="true">1</span>
                <div className="settings__editor-step-button-copy">
                  <strong>Context & Preview</strong>
                  <span>{activePromptLineCount} context lines · {activeSttHintLineCount} STT hints</span>
                </div>
              </div>
            </button>
            <button
              className={`settings__editor-step-button${activeWorkspacePanel === "dictionary" ? " settings__editor-step-button--active" : ""}`}
              type="button"
              role="tab"
              aria-label="Open dictionary workspace"
              aria-selected={activeWorkspacePanel === "dictionary"}
              onClick={() => setActiveWorkspacePanel("dictionary")}
            >
              <div className="settings__editor-step-button-head">
                <span className="settings__editor-step-index" aria-hidden="true">2</span>
                <div className="settings__editor-step-button-copy">
                  <strong>Dictionary</strong>
                  <span>{dictionaryEntries.length} literal replacements</span>
                </div>
              </div>
            </button>
            <button
              className={`settings__editor-step-button${activeWorkspacePanel === "snippets" ? " settings__editor-step-button--active" : ""}`}
              type="button"
              role="tab"
              aria-label="Open snippets workspace"
              aria-selected={activeWorkspacePanel === "snippets"}
              onClick={() => setActiveWorkspacePanel("snippets")}
            >
              <div className="settings__editor-step-button-head">
                <span className="settings__editor-step-index" aria-hidden="true">3</span>
                <div className="settings__editor-step-button-copy">
                  <strong>Snippets</strong>
                  <span>{snippetEntries.length} reusable expansions</span>
                </div>
              </div>
            </button>
        </div>

        {activeWorkspacePanel === "context" && (
          <section className="settings__editor-stage">
            <article className="settings__editor-stage-card settings__editor-stage-card--context">
              <div className="settings__editor-stage-card-head">
                <div className="settings__rule-card-heading">
                  <span className="settings__template-kicker">Context</span>
                  <strong className="settings__rule-card-title">Transcription context</strong>
                </div>
              </div>
              <p className="form-dim">
                Add names, acronyms and domain terms the recognizer should bias toward. This text is forwarded as one plain prompt string, so short line-based lists work better than prose.
              </p>
              <textarea
                className="form-textarea settings__editor-context-input"
                value={activeTextProfile.prompt}
                aria-label="Transcription context"
                rows={12}
                onChange={(event) => updateActiveProfile({ prompt: event.target.value })}
                placeholder={"WordScript\nGroq\nTauri\nCPAL\ncustomer names\ninternal product terms"}
              />
              <label className="settings__rule-field settings__rule-field--wide">
                <span>Optional STT hints</span>
                <textarea
                  className="form-textarea settings__editor-context-input"
                  value={sttHints}
                  aria-label="Optional STT hints"
                  rows={5}
                  onChange={(event) => updateActiveProfile({ stt_hints: event.target.value })}
                  placeholder={"status update\nhandoff summary\ncustomer follow up"}
                />
              </label>
              <p className="form-dim">
                Use this only for a few spoken cues or alternate phrasings you explicitly want in STT bias. These lines go into the transcription request. Snippet triggers do not feed STT automatically anymore.
              </p>
              <div className="settings__editor-context-notes">
                <div className="settings__editor-context-note">
                  <strong>What belongs here</strong>
                  <span>Company names, products, acronyms, people, ticket prefixes and phrases the model should recognize reliably.</span>
                </div>
                <div className="settings__editor-context-note">
                  <strong>Good starting size</strong>
                  <span>Start with 5 to 10 high-value terms. Add more only when preview still misses obvious vocabulary.</span>
                </div>
                <div className="settings__editor-context-note">
                  <strong>What not to put here</strong>
                  <span>Do not mirror whole snippets or long macros. If you want expansion behavior, keep that in Snippets; STT hints should stay short and intentional.</span>
                </div>
              </div>
            </article>

            <article className="settings__editor-stage-card">
              <div className="settings__editor-stage-card-head">
                <div className="settings__rule-card-heading">
                  <span className="settings__template-kicker">Preview</span>
                  <strong className="settings__rule-card-title">Rule check and preview</strong>
                </div>
              </div>
              <p className="form-dim">
                Validation checks for empty fields, duplicates and collisions. Preview runs the literal dictionary-plus-snippet pass on the sample text below, with no microphone capture or semantic guessing.
              </p>
              <label className="settings__rule-field settings__rule-field--wide">
                <span>Preview sample transcription</span>
                <textarea
                  value={sampleText}
                  onChange={(event) => setSampleText(event.target.value)}
                  placeholder="e.g. word script follow up note"
                  rows={4}
                />
              </label>
              <p className="form-dim">Type what the recognizer is likely to return, not what you wish it meant. If one spoken idea lands in several transcript forms, model those forms explicitly.</p>

              <div className="settings__editor-preview-split">
                <article className="settings__rule-preview-card">
                  <span className="settings__rule-preview-label">Resolved output</span>
                  <strong>{previewSource?.preview.output || "No preview yet"}</strong>
                  {previewRuleChips.length > 0 ? (
                    <div className="settings__rule-chip-row">
                      {previewRuleChips.map((rule) => (
                        <span key={rule.key} className="settings__rule-chip" title={rule.title}>{rule.label}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="form-dim" style={{ margin: 0 }}>
                      No dictionary or snippet rule matched this preview sample.
                    </p>
                  )}
                </article>
                <article className="settings__rule-preview-card">
                  <span className="settings__rule-preview-label">Validation diagnostics</span>
                  {issueList.length === 0 ? (
                    <strong>No blocking rule conflicts right now.</strong>
                  ) : (
                    <ul className="settings__rule-issues">
                      {issueList.map((entry) => (
                        <li key={`${entry.code}-${entry.rule_ids.join("-")}-${entry.message}`} className={`settings__rule-issue settings__rule-issue--${entry.severity}`}>
                          <strong>{entry.severity}</strong>
                          <div className="settings__rule-issue-copy">
                            <span>{entry.message}</span>
                            {entry.rule_ids.length > 0 && (
                              <div className="settings__rule-issue-links">
                                {entry.rule_ids.map((ruleId) => {
                                  const currentRule = currentRuleLookup.get(ruleId);
                                  const previewRule = previewRuleLookup.get(ruleId);
                                  const rule = previewRule ?? currentRule;

                                  if (!rule) {
                                    return (
                                      <span key={ruleId} className="settings__rule-issue-target">
                                        Rule {ruleId}
                                      </span>
                                    );
                                  }

                                  if (!currentRule) {
                                    return (
                                      <span key={ruleId} className="settings__rule-issue-target" title="This issue comes from the imported preview file.">
                                        {rule.label}
                                      </span>
                                    );
                                  }

                                  return (
                                    <button
                                      key={ruleId}
                                      className="settings__rule-link"
                                      type="button"
                                      onClick={() => focusRuleCard(ruleId)}
                                    >
                                      {rule.label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {hasImportedOnlyIssues && (
                    <p className="form-dim" style={{ margin: 0 }}>
                      Some diagnostics belong to the imported preview file. Apply that import first if you want those incoming rules to appear as editable cards in this tab.
                    </p>
                  )}
                </article>
              </div>
            </article>

            <div className="settings__editor-inline-note settings__editor-stage-guide">
              <strong>Literal rule model</strong>
              <span>Text Rules match transcript phrases, not raw audio and not semantic intent. Dictionary runs first, snippets second. For everyday reliability, add separate rules for common transcript variants instead of expecting fuzzy matching.</span>
            </div>
          </section>
        )}

        {activeWorkspacePanel === "dictionary" && (
            <section className="settings__editor-stage settings__editor-stage--stacked">
              <article className="settings__editor-stage-banner">
                <div className="settings__editor-stage-banner-head">
                  <div className="settings__rule-card-heading">
                    <span className="settings__template-kicker">Dictionary</span>
                    <strong className="settings__rule-card-title">Personal dictionary</strong>
                    <p className="settings__rule-meta">Literal replacements for names, brands and recurring mishears that should always resolve the same way.</p>
                  </div>
                  <button
                    className="btn btn--cancel"
                    type="button"
                    onClick={() => updateActiveProfile({ dictionary_entries: [...dictionaryEntries, makeDictionaryEntry()] })}
                  >
                    Add dictionary term
                  </button>
                </div>
                <p className="form-dim">
                  Add one rule for each phrase the recognizer gets wrong. Matching is literal and case-insensitive, so separate transcript variants need separate entries.
                </p>
              </article>

              <div className="settings__rule-stack">
                {dictionaryEntries.length === 0 ? (
                  <div className="settings__rule-empty">
                    No dictionary entries yet. Add the phrases Groq hears wrong and the exact output WordScript should insert instead.
                  </div>
                ) : dictionaryEntries.map((entry, index) => {
                  return (
                    <DictionaryRuleCard
                      key={entry.id}
                      entry={entry}
                      index={index}
                      totalCount={dictionaryEntries.length}
                      isActive={activeRuleId === entry.id}
                      issues={currentIssueMap.get(entry.id) ?? EMPTY_ISSUES}
                      registerRef={registerRuleCardRef}
                      onMove={moveDictionaryEntry}
                      onChange={updateDictionaryEntry}
                      onRemove={removeDictionaryEntry}
                    />
                  );
                })}
              </div>
            </section>
        )}

        {activeWorkspacePanel === "snippets" && (
            <section className="settings__editor-stage settings__editor-stage--stacked">
              <article className="settings__editor-stage-banner">
                <div className="settings__editor-stage-banner-head">
                  <div className="settings__rule-card-heading">
                    <span className="settings__template-kicker">Snippets</span>
                    <strong className="settings__rule-card-title">Snippets</strong>
                    <p className="settings__rule-meta">Deliberate spoken macros for repeatable blocks like follow-ups, handoffs, recaps and status notes.</p>
                  </div>
                  <button
                    className="btn btn--cancel"
                    type="button"
                    onClick={() => updateActiveProfile({ snippet_entries: [...snippetEntries, makeSnippetEntry()] })}
                  >
                    Add snippet
                  </button>
                </div>
                <p className="form-dim">
                  Snippets are deliberate spoken macros. Keep triggers short and explicit; if a trigger lands in multiple transcript forms, normalize first in Dictionary or add separate triggers.
                </p>
              </article>

              <div className="settings__rule-stack">
                {snippetEntries.length === 0 ? (
                  <div className="settings__rule-empty">
                    No snippets yet. Add a trigger phrase and the full expansion WordScript should drop into the final transcript.
                  </div>
                ) : snippetEntries.map((entry, index) => {
                  return (
                    <SnippetRuleCard
                      key={entry.id}
                      entry={entry}
                      index={index}
                      totalCount={snippetEntries.length}
                      isActive={activeRuleId === entry.id}
                      issues={currentIssueMap.get(entry.id) ?? EMPTY_ISSUES}
                      registerRef={registerRuleCardRef}
                      onMove={moveSnippetEntry}
                      onChange={updateSnippetEntry}
                      onRemove={removeSnippetEntry}
                    />
                  );
                })}
              </div>
            </section>
        )}

        <p className="form-dim settings__editor-footnote">
          Team-sharing stays outside V1. These rules stay personal and exportable, with ordering and preview meant for daily solo dictation instead of a shared automation system.
        </p>
      </div>
    </>
  );
}
