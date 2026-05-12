import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { AppConfig, DictionaryEntry, SnippetEntry } from "../../types/ipc";
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

export function PromptsTab({ config, onChange, onValidationChange }: Props) {
  const dictionaryEntries = config.dictionary_entries ?? [];
  const snippetEntries = config.snippet_entries ?? [];
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
  const ruleCardRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    let cancelled = false;

    void invoke<TextRulesAnalysis>("analyze_text_rules", {
      request: {
        prompt: config.prompt,
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

    return () => {
      cancelled = true;
    };
  }, [config.prompt, dictionaryEntries, onValidationChange, sampleText, snippetEntries]);

  const updateDictionaryEntry = (id: string, key: keyof DictionaryEntry, value: string) => {
    onChange({
      dictionary_entries: dictionaryEntries.map((entry) => (
        entry.id === id ? { ...entry, [key]: value } : entry
      )),
    });
  };

  const removeDictionaryEntry = (id: string) => {
    onChange({
      dictionary_entries: dictionaryEntries.filter((entry) => entry.id !== id),
    });
  };

  const moveDictionaryEntry = (id: string, direction: -1 | 1) => {
    const index = dictionaryEntries.findIndex((entry) => entry.id === id);
    if (index < 0) return;

    onChange({
      dictionary_entries: moveItem(dictionaryEntries, index, direction),
    });
    setActiveRuleId(id);
  };

  const updateSnippetEntry = (id: string, key: keyof SnippetEntry, value: string) => {
    onChange({
      snippet_entries: snippetEntries.map((entry) => (
        entry.id === id ? { ...entry, [key]: value } : entry
      )),
    });
  };

  const removeSnippetEntry = (id: string) => {
    onChange({
      snippet_entries: snippetEntries.filter((entry) => entry.id !== id),
    });
  };

  const moveSnippetEntry = (id: string, direction: -1 | 1) => {
    const index = snippetEntries.findIndex((entry) => entry.id === id);
    if (index < 0) return;

    onChange({
      snippet_entries: moveItem(snippetEntries, index, direction),
    });
    setActiveRuleId(id);
  };

  const setMessage = (ok: boolean, text: string) => {
    setFeedback({ ok, text });
  };

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
          current_prompt: config.prompt,
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
    onChange({
      prompt: pendingImport.payload.document.prompt,
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
          prompt: config.prompt,
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
  const issueList = previewSource?.issues ?? [];
  const previewDictionaryEntries = pendingImport?.payload.document.dictionary_entries ?? dictionaryEntries;
  const previewSnippetEntries = pendingImport?.payload.document.snippet_entries ?? snippetEntries;
  const previewRuleLookup = buildRuleLookup(previewDictionaryEntries, previewSnippetEntries);
  const currentRuleLookup = buildRuleLookup(dictionaryEntries, snippetEntries);
  const currentIssueMap = buildIssueMap(analysis?.issues ?? []);
  const previewRuleChips = (previewSource?.preview.applied_rules ?? []).map((rule) => buildPreviewRuleChip(rule, previewRuleLookup));
  const hasImportedOnlyIssues = Boolean(pendingImport && issueList.some((entry) => entry.rule_ids.some((ruleId) => !currentRuleLookup.has(ruleId))));

  const focusRuleCard = (ruleId: string) => {
    const target = ruleCardRefs.current[ruleId];
    if (!target) return;

    setActiveRuleId(ruleId);
    target.scrollIntoView?.({ behavior: "smooth", block: "center" });
    target.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea")?.focus();
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

      <div className="settings__rule-guide">
        <article className="settings__rule-guide-card">
          <strong>How matching works</strong>
          <ul className="settings__rule-guide-list">
            <li>Text Rules match transcript phrases, not raw audio and not semantic intent.</li>
            <li>Matching is case-insensitive and tolerant of repeated spaces, but it still relies on the phrase appearing in the transcript.</li>
            <li>Dictionary runs first, snippets second, and later rules see the result of earlier ones.</li>
            <li>For everyday reliability, add separate rules for common transcript variants instead of expecting fuzzy matching.</li>
          </ul>
        </article>
        <article className="settings__rule-guide-card">
          <strong>When to use which rule</strong>
          <ul className="settings__rule-guide-list">
            <li>Use Dictionary for names, brands and recurring mishears like word script to WordScript.</li>
            <li>Use Snippets for deliberate spoken macros you are happy to say almost verbatim, such as follow up note or meeting recap.</li>
            <li>Use Preview with the transcript you expect Whisper to return. It checks rule shape and phrase resolution only, not microphone capture or AI post-correction.</li>
          </ul>
        </article>
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
                  ? "Replace mode overwrites the current prompt, dictionary and snippets with the imported file."
                  : "Merge mode preserves the current prompt unless it is empty and lets imported phrase/trigger matches replace existing rules."}
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

      <div className="form-section">Transcription Context</div>
      <p className="form-dim">
        Optional request context for names, jargon, abbreviations and domain-specific wording. WordScript forwards this text as a plain prompt string with the speech-to-text request; it does not parse it into special fields or trigger dictionary or snippet rules on its own.
      </p>
      <p className="form-dim">
        Best practice: keep it compact and concrete. A short list of names, product terms, abbreviations and likely phrases works better than long prose. One item per line is easiest to maintain, but commas also work because the whole box is sent as plain text.
      </p>
      <textarea
        className="form-textarea"
        value={config.prompt}
        rows={6}
        onChange={(e) => onChange({ prompt: e.target.value })}
        placeholder={"WordScript\nGroq\nTauri\nCPAL\ncustomer names\ninternal product terms"}
      />

      <div className="form-sep" />
      <div className="form-section">Rule Check & Preview</div>
      <p className="form-dim">
        Validation checks for empty fields, duplicates and collisions. Preview runs the literal dictionary-plus-snippet pass on the sample text below, without microphone, insertion or semantic guessing.
      </p>
      <label className="settings__rule-field settings__rule-field--wide">
        <span>Preview sample transcription</span>
        <textarea
          value={sampleText}
          onChange={(event) => setSampleText(event.target.value)}
          placeholder="e.g. word script follow up note"
          rows={3}
        />
      </label>
      <p className="form-dim">
        Everyday tip: type what the transcript is likely to say, not what you hope the AI meant. If one spoken idea appears in several transcript forms, model those variants as separate rules.
      </p>

      <div className="settings__rule-preview-grid">
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

      <div className="form-sep" />
      <div className="form-section">Personal Dictionary</div>
      <p className="form-dim">
        Dictionary entries replace literal transcript phrases after transcription and post-correction. Use them for names, product terms and recurring spelling fixes that are predictable in everyday dictation.
      </p>
      <p className="form-dim">
        Matching is phrase-based and case-insensitive. If Groq alternates between several spellings or phrasings, add one dictionary entry per likely variant.
      </p>

      <div className="settings__rule-stack">
        {dictionaryEntries.length === 0 ? (
          <div className="settings__rule-empty">
            No dictionary entries yet. Add the phrases Groq hears wrong and the exact output WordScript should insert instead.
          </div>
        ) : dictionaryEntries.map((entry, index) => {
          const entryIssues = currentIssueMap.get(entry.id) ?? [];
          const cardClassName = `settings__rule-card${activeRuleId === entry.id ? " settings__rule-card--active" : ""}${hasSeverity(entryIssues, "error") ? " settings__rule-card--error" : hasSeverity(entryIssues, "warning") ? " settings__rule-card--warning" : ""}`;

          return (
          <article
            key={entry.id}
            ref={(element) => {
              ruleCardRefs.current[entry.id] = element;
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
                <button className="settings__rule-mini-btn" type="button" onClick={() => moveDictionaryEntry(entry.id, -1)} disabled={index === 0}>
                  Move up
                </button>
                <button className="settings__rule-mini-btn" type="button" onClick={() => moveDictionaryEntry(entry.id, 1)} disabled={index === dictionaryEntries.length - 1}>
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
                  onChange={(event) => updateDictionaryEntry(entry.id, "phrase", event.target.value)}
                  placeholder="e.g. word script"
                />
              </label>
              <label className="settings__rule-field">
                <span>Replace with</span>
                <input
                  type="text"
                  value={entry.replace_with}
                  onChange={(event) => updateDictionaryEntry(entry.id, "replace_with", event.target.value)}
                  placeholder="e.g. WordScript"
                />
              </label>
            </div>
            <div className="settings__rule-actions">
              <span className="settings__rule-meta">Literal whole-phrase match, case-insensitive. Add separate entries for variants.</span>
              <button className="btn btn--cancel" type="button" onClick={() => removeDictionaryEntry(entry.id)}>
                Remove
              </button>
            </div>
            {entryIssues.length > 0 && (
              <div className="settings__rule-inline-issues">
                {entryIssues.map((issue) => (
                  <div key={`${entry.id}-${issue.code}-${issue.message}`} className={`settings__rule-inline-issue settings__rule-inline-issue--${issue.severity}`}>
                    <strong>{issue.severity}</strong>
                    <span>{issue.message}</span>
                  </div>
                ))}
              </div>
            )}
          </article>
        )})}
      </div>

      <div className="settings__rule-toolbar">
        <button
          className="btn btn--cancel"
          type="button"
          onClick={() => onChange({ dictionary_entries: [...dictionaryEntries, makeDictionaryEntry()] })}
        >
          Add dictionary term
        </button>
      </div>

      <div className="form-sep" />
      <div className="form-section">Snippets</div>
      <p className="form-dim">
        Snippets expand reusable text blocks when the trigger phrase appears in the transcript. Start with short spoken cues you are comfortable saying deliberately, for example support follow up or send closing note.
      </p>
      <p className="form-dim">
        Snippet triggers are also literal phrase rules, not fuzzy or semantic matching. If a trigger can land in multiple transcript forms, add multiple snippet entries or normalize those forms in Dictionary first.
      </p>

      <div className="settings__rule-stack">
        {snippetEntries.length === 0 ? (
          <div className="settings__rule-empty">
            No snippets yet. Add a trigger phrase and the full expansion WordScript should drop into the final transcript.
          </div>
        ) : snippetEntries.map((entry, index) => {
          const entryIssues = currentIssueMap.get(entry.id) ?? [];
          const cardClassName = `settings__rule-card${activeRuleId === entry.id ? " settings__rule-card--active" : ""}${hasSeverity(entryIssues, "error") ? " settings__rule-card--error" : hasSeverity(entryIssues, "warning") ? " settings__rule-card--warning" : ""}`;

          return (
          <article
            key={entry.id}
            ref={(element) => {
              ruleCardRefs.current[entry.id] = element;
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
                <button className="settings__rule-mini-btn" type="button" onClick={() => moveSnippetEntry(entry.id, -1)} disabled={index === 0}>
                  Move up
                </button>
                <button className="settings__rule-mini-btn" type="button" onClick={() => moveSnippetEntry(entry.id, 1)} disabled={index === snippetEntries.length - 1}>
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
                  onChange={(event) => updateSnippetEntry(entry.id, "label", event.target.value)}
                  placeholder="e.g. Support follow-up"
                />
              </label>
              <label className="settings__rule-field">
                <span>Trigger phrase</span>
                <input
                  type="text"
                  value={entry.trigger}
                  onChange={(event) => updateSnippetEntry(entry.id, "trigger", event.target.value)}
                  placeholder="e.g. follow up note"
                />
              </label>
              <label className="settings__rule-field settings__rule-field--wide">
                <span>Expansion</span>
                <textarea
                  value={entry.expansion}
                  onChange={(event) => updateSnippetEntry(entry.id, "expansion", event.target.value)}
                  placeholder="e.g. Thanks for the update. We will send the next status tomorrow morning."
                  rows={4}
                />
              </label>
            </div>
            <div className="settings__rule-actions">
              <span className="settings__rule-meta">Literal trigger phrase match, case-insensitive, in the final transcript.</span>
              <button className="btn btn--cancel" type="button" onClick={() => removeSnippetEntry(entry.id)}>
                Remove
              </button>
            </div>
            {entryIssues.length > 0 && (
              <div className="settings__rule-inline-issues">
                {entryIssues.map((issue) => (
                  <div key={`${entry.id}-${issue.code}-${issue.message}`} className={`settings__rule-inline-issue settings__rule-inline-issue--${issue.severity}`}>
                    <strong>{issue.severity}</strong>
                    <span>{issue.message}</span>
                  </div>
                ))}
              </div>
            )}
          </article>
        )})}
      </div>

      <div className="settings__rule-toolbar">
        <button
          className="btn btn--cancel"
          type="button"
          onClick={() => onChange({ snippet_entries: [...snippetEntries, makeSnippetEntry()] })}
        >
          Add snippet
        </button>
      </div>

      <p className="form-dim">
        Team-sharing stays outside V1. These rules stay personal and exportable, with ordering and preview meant for daily solo dictation instead of a shared automation system.
      </p>
    </>
  );
}
