use std::{
    collections::{BTreeMap, BTreeSet},
    path::PathBuf,
};

use serde::{Deserialize, Serialize};

use super::{
    config::{DictionaryEntry, SnippetEntry},
    transcription_hints::{analyze_transcription_bias, TranscriptionBiasPreview},
    transform::NativeTransformConfig,
};

const TEXT_RULES_SCHEMA_VERSION: u32 = 1;
const DEFAULT_PREVIEW_TEXT: &str = "word script follow up note";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextRulesDocument {
    pub schema_version: u32,
    pub prompt: String,
    #[serde(default)]
    pub stt_hints: String,
    pub dictionary_entries: Vec<DictionaryEntry>,
    pub snippet_entries: Vec<SnippetEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TextRulesConflictResolution {
    MergeImportedWins,
    ReplaceCurrent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TextRulesIssueSeverity {
    Error,
    Warning,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TextRulesIssueCode {
    EmptyDictionaryPhrase,
    EmptyDictionaryReplacement,
    EmptySnippetLabel,
    EmptySnippetTrigger,
    EmptySnippetExpansion,
    DuplicateDictionaryPhrase,
    DuplicateSnippetTrigger,
    DictionarySnippetOverlap,
    DuplicateRuleId,
    BroadProfileContextIgnored,
    NoConcreteProfileHints,
    IgnoredSttHint,
    NoUsableSttHints,
    ImportSchemaMismatch,
    ImportParseFailed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextRulesIssue {
    pub severity: TextRulesIssueSeverity,
    pub code: TextRulesIssueCode,
    pub message: String,
    pub rule_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextRulesPreview {
    pub input: String,
    pub output: String,
    pub applied_rules: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextRulesAnalysis {
    pub blocking: bool,
    pub issues: Vec<TextRulesIssue>,
    pub preview: TextRulesPreview,
    pub transcription_bias: TranscriptionBiasPreview,
    pub dictionary_count: usize,
    pub snippet_count: usize,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AnalyzeTextRulesRequest {
    pub prompt: String,
    #[serde(default)]
    pub stt_hints: String,
    pub dictionary_entries: Vec<DictionaryEntry>,
    pub snippet_entries: Vec<SnippetEntry>,
    pub sample_text: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ExportTextRulesRequest {
    pub path: String,
    pub prompt: String,
    #[serde(default)]
    pub stt_hints: String,
    pub dictionary_entries: Vec<DictionaryEntry>,
    pub snippet_entries: Vec<SnippetEntry>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExportTextRulesResponse {
    pub path: String,
    pub analysis: TextRulesAnalysis,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ImportTextRulesRequest {
    pub path: String,
    pub current_prompt: Option<String>,
    #[serde(default)]
    pub current_stt_hints: Option<String>,
    pub current_dictionary_entries: Vec<DictionaryEntry>,
    pub current_snippet_entries: Vec<SnippetEntry>,
    pub sample_text: Option<String>,
    pub resolution: TextRulesConflictResolution,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportTextRulesResponse {
    pub document: TextRulesDocument,
    pub analysis: TextRulesAnalysis,
}

#[tauri::command]
pub fn analyze_text_rules(request: AnalyzeTextRulesRequest) -> Result<TextRulesAnalysis, String> {
    Ok(analyze_document(
        &TextRulesDocument {
            schema_version: TEXT_RULES_SCHEMA_VERSION,
            prompt: request.prompt,
            stt_hints: request.stt_hints,
            dictionary_entries: request.dictionary_entries,
            snippet_entries: request.snippet_entries,
        },
        request.sample_text.as_deref(),
    ))
}

#[tauri::command]
pub fn export_text_rules(
    request: ExportTextRulesRequest,
) -> Result<ExportTextRulesResponse, String> {
    let document = TextRulesDocument {
        schema_version: TEXT_RULES_SCHEMA_VERSION,
        prompt: request.prompt,
        stt_hints: request.stt_hints,
        dictionary_entries: request.dictionary_entries,
        snippet_entries: request.snippet_entries,
    };
    let analysis = analyze_document(&document, None);
    let raw = serde_json::to_string_pretty(&document)
        .map_err(|error| format!("Could not serialize text rules export: {error}"))?;
    std::fs::write(export_path(&request.path)?, raw)
        .map_err(|error| format!("Could not write text rules export: {error}"))?;

    Ok(ExportTextRulesResponse {
        path: request.path,
        analysis,
    })
}

#[tauri::command]
pub fn import_text_rules(
    request: ImportTextRulesRequest,
) -> Result<ImportTextRulesResponse, String> {
    let raw = std::fs::read_to_string(import_path(&request.path)?)
        .map_err(|error| format!("Could not read text rules import: {error}"))?;
    let imported = parse_document(&raw)?;
    let merged = match request.resolution {
        TextRulesConflictResolution::ReplaceCurrent => imported,
        TextRulesConflictResolution::MergeImportedWins => merge_documents(
            TextRulesDocument {
                schema_version: TEXT_RULES_SCHEMA_VERSION,
                prompt: request.current_prompt.unwrap_or_default(),
                stt_hints: request.current_stt_hints.unwrap_or_default(),
                dictionary_entries: request.current_dictionary_entries,
                snippet_entries: request.current_snippet_entries,
            },
            imported,
        ),
    };
    let analysis = analyze_document(&merged, request.sample_text.as_deref());

    Ok(ImportTextRulesResponse {
        document: merged,
        analysis,
    })
}

pub fn analyze_document(
    document: &TextRulesDocument,
    sample_text: Option<&str>,
) -> TextRulesAnalysis {
    let mut issues = Vec::new();
    let mut seen_ids = BTreeMap::<String, Vec<String>>::new();
    let mut seen_dictionary = BTreeMap::<String, Vec<String>>::new();
    let mut seen_snippets = BTreeMap::<String, Vec<String>>::new();
    let mut dictionary_keys = BTreeSet::new();

    for entry in &document.dictionary_entries {
        let key = normalized_key(&entry.phrase);
        push_duplicate_id(&mut seen_ids, &entry.id);
        if key.is_empty() {
            issues.push(issue(
                TextRulesIssueSeverity::Error,
                TextRulesIssueCode::EmptyDictionaryPhrase,
                "Dictionary entries need a non-empty 'Heard as' phrase.",
                vec![entry.id.clone()],
            ));
        } else {
            dictionary_keys.insert(key.clone());
            seen_dictionary
                .entry(key)
                .or_default()
                .push(entry.id.clone());
        }
        if entry.replace_with.trim().is_empty() {
            issues.push(issue(
                TextRulesIssueSeverity::Error,
                TextRulesIssueCode::EmptyDictionaryReplacement,
                "Dictionary entries need a non-empty replacement.",
                vec![entry.id.clone()],
            ));
        }
    }

    for entry in &document.snippet_entries {
        let key = normalized_key(&entry.trigger);
        push_duplicate_id(&mut seen_ids, &entry.id);
        if entry.label.trim().is_empty() {
            issues.push(issue(
                TextRulesIssueSeverity::Warning,
                TextRulesIssueCode::EmptySnippetLabel,
                "Snippet labels should be filled so import previews and conflict lists stay readable.",
                vec![entry.id.clone()],
            ));
        }
        if key.is_empty() {
            issues.push(issue(
                TextRulesIssueSeverity::Error,
                TextRulesIssueCode::EmptySnippetTrigger,
                "Snippets need a non-empty trigger phrase.",
                vec![entry.id.clone()],
            ));
        } else {
            if dictionary_keys.contains(&key) {
                issues.push(issue(
                    TextRulesIssueSeverity::Warning,
                    TextRulesIssueCode::DictionarySnippetOverlap,
                    format!(
                        "Dictionary and snippet share the same spoken key '{}'. Dictionary replacements run before snippets.",
                        entry.trigger.trim()
                    ),
                    vec![entry.id.clone()],
                ));
            }
            seen_snippets.entry(key).or_default().push(entry.id.clone());
        }
        if entry.expansion.trim().is_empty() {
            issues.push(issue(
                TextRulesIssueSeverity::Error,
                TextRulesIssueCode::EmptySnippetExpansion,
                "Snippets need a non-empty expansion.",
                vec![entry.id.clone()],
            ));
        }
    }

    issues.extend(duplicate_issues(
        seen_ids,
        TextRulesIssueSeverity::Warning,
        TextRulesIssueCode::DuplicateRuleId,
        "Two or more text rules share the same id. Imported rules will still work, but stable ids make diffs and future team sync safer.",
    ));
    issues.extend(duplicate_issues(
        seen_dictionary,
        TextRulesIssueSeverity::Warning,
        TextRulesIssueCode::DuplicateDictionaryPhrase,
        "Two or more dictionary entries share the same spoken phrase. Later entries win because rules run top-to-bottom.",
    ));
    issues.extend(duplicate_issues(
        seen_snippets,
        TextRulesIssueSeverity::Warning,
        TextRulesIssueCode::DuplicateSnippetTrigger,
        "Two or more snippets share the same trigger phrase. Later entries win because rules run top-to-bottom.",
    ));

    let sample_text = sample_text
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(DEFAULT_PREVIEW_TEXT);
    let (output, applied_rules) = preview_transform(document, sample_text);
    let transcription_bias = analyze_transcription_bias(
        &document.prompt,
        &document.stt_hints,
        &document.dictionary_entries,
    );
    issues.extend(bias_warning_issues(document, &transcription_bias));

    TextRulesAnalysis {
        blocking: issues
            .iter()
            .any(|issue| matches!(issue.severity, TextRulesIssueSeverity::Error)),
        issues,
        preview: TextRulesPreview {
            input: sample_text.to_string(),
            output,
            applied_rules,
        },
        transcription_bias,
        dictionary_count: document.dictionary_entries.len(),
        snippet_count: document.snippet_entries.len(),
    }
}

fn bias_warning_issues(
    document: &TextRulesDocument,
    bias: &TranscriptionBiasPreview,
) -> Vec<TextRulesIssue> {
    let mut issues = Vec::new();

    let prompt_line_count = document
        .prompt
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .count();
    let stt_hint_line_count = document
        .stt_hints
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .count();

    if !bias.ignored_profile_lines.is_empty() {
        issues.push(issue(
            TextRulesIssueSeverity::Warning,
            TextRulesIssueCode::BroadProfileContextIgnored,
            format!(
                "{} context line(s) are too broad for the automatic STT bias path and will be ignored. Keep automatic context lexical and concrete.",
                bias.ignored_profile_lines.len()
            ),
            Vec::new(),
        ));
    }

    if prompt_line_count > 0 && bias.profile_hints.is_empty() {
        issues.push(issue(
            TextRulesIssueSeverity::Warning,
            TextRulesIssueCode::NoConcreteProfileHints,
            "This profile currently contributes no concrete automatic STT vocabulary. Add short lexical terms like product names, acronyms or ticket prefixes instead of broad categories.".to_string(),
            Vec::new(),
        ));
    }

    if !bias.ignored_stt_hint_lines.is_empty() {
        issues.push(issue(
            TextRulesIssueSeverity::Warning,
            TextRulesIssueCode::IgnoredSttHint,
            format!(
                "{} STT hint line(s) are too long for the conservative bias path and will be ignored. Keep STT hints short and phrase-like.",
                bias.ignored_stt_hint_lines.len()
            ),
            Vec::new(),
        ));
    }

    if stt_hint_line_count > 0 && bias.stt_hints.is_empty() {
        issues.push(issue(
            TextRulesIssueSeverity::Warning,
            TextRulesIssueCode::NoUsableSttHints,
            "None of the current STT hints qualify for the automatic bias path. Keep them to a few short spoken cues instead of full sentences or macros.".to_string(),
            Vec::new(),
        ));
    }

    issues
}

fn parse_document(raw: &str) -> Result<TextRulesDocument, String> {
    let value = serde_json::from_str::<serde_json::Value>(raw)
        .map_err(|error| format!("Could not parse text rules JSON: {error}"))?;
    let schema_version = value
        .get("schema_version")
        .and_then(|value| value.as_u64())
        .unwrap_or(u64::from(TEXT_RULES_SCHEMA_VERSION)) as u32;
    if schema_version != TEXT_RULES_SCHEMA_VERSION {
        return Err(format!(
            "Unsupported text rules schema version {schema_version}. Expected {TEXT_RULES_SCHEMA_VERSION}."
        ));
    }
    serde_json::from_value::<TextRulesDocument>(value)
        .map_err(|error| format!("Could not decode text rules document: {error}"))
}

fn merge_documents(current: TextRulesDocument, imported: TextRulesDocument) -> TextRulesDocument {
    TextRulesDocument {
        schema_version: TEXT_RULES_SCHEMA_VERSION,
        prompt: if current.prompt.trim().is_empty() {
            imported.prompt
        } else {
            current.prompt
        },
        stt_hints: if current.stt_hints.trim().is_empty() {
            imported.stt_hints
        } else {
            current.stt_hints
        },
        dictionary_entries: merge_dictionary_entries(
            current.dictionary_entries,
            imported.dictionary_entries,
        ),
        snippet_entries: merge_snippet_entries(current.snippet_entries, imported.snippet_entries),
    }
}

fn merge_dictionary_entries(
    current: Vec<DictionaryEntry>,
    imported: Vec<DictionaryEntry>,
) -> Vec<DictionaryEntry> {
    let mut merged = BTreeMap::<String, DictionaryEntry>::new();
    let mut order = Vec::<String>::new();

    for entry in current {
        let key = normalized_key(&entry.phrase);
        if key.is_empty() {
            order.push(format!("current:{}", entry.id));
            merged.insert(format!("current:{}", entry.id), entry);
        } else {
            order.push(key.clone());
            merged.insert(key, entry);
        }
    }
    for entry in imported {
        let key = normalized_key(&entry.phrase);
        if key.is_empty() {
            let synthetic = format!("imported:{}", entry.id);
            order.push(synthetic.clone());
            merged.insert(synthetic, entry);
        } else {
            if !order.contains(&key) {
                order.push(key.clone());
            }
            merged.insert(key, entry);
        }
    }

    order
        .into_iter()
        .filter_map(|key| merged.remove(&key))
        .collect()
}

fn merge_snippet_entries(
    current: Vec<SnippetEntry>,
    imported: Vec<SnippetEntry>,
) -> Vec<SnippetEntry> {
    let mut merged = BTreeMap::<String, SnippetEntry>::new();
    let mut order = Vec::<String>::new();

    for entry in current {
        let key = normalized_key(&entry.trigger);
        if key.is_empty() {
            let synthetic = format!("current:{}", entry.id);
            order.push(synthetic.clone());
            merged.insert(synthetic, entry);
        } else {
            order.push(key.clone());
            merged.insert(key, entry);
        }
    }
    for entry in imported {
        let key = normalized_key(&entry.trigger);
        if key.is_empty() {
            let synthetic = format!("imported:{}", entry.id);
            order.push(synthetic.clone());
            merged.insert(synthetic, entry);
        } else {
            if !order.contains(&key) {
                order.push(key.clone());
            }
            merged.insert(key, entry);
        }
    }

    order
        .into_iter()
        .filter_map(|key| merged.remove(&key))
        .collect()
}

fn preview_transform(document: &TextRulesDocument, sample_text: &str) -> (String, Vec<String>) {
    let config = NativeTransformConfig {
        provider: "groq".to_string(),
        profile_prompt: String::new(),
        dictionary_entries: document.dictionary_entries.clone(),
        snippet_entries: document.snippet_entries.clone(),
        post_process: false,
        correction_model: "llama-3.1-8b-instant".to_string(),
        filter_fillers: true,
        professionalize: false,
    };
    let (output, applied_rules) = super::transform::preview_text_rules_only(sample_text, &config);
    (output, applied_rules)
}

fn duplicate_issues(
    groups: BTreeMap<String, Vec<String>>,
    severity: TextRulesIssueSeverity,
    code: TextRulesIssueCode,
    message: &str,
) -> Vec<TextRulesIssue> {
    groups
        .into_values()
        .filter(|ids| ids.len() > 1)
        .map(|rule_ids| {
            issue(
                severity.clone(),
                code.clone(),
                message.to_string(),
                rule_ids,
            )
        })
        .collect()
}

fn push_duplicate_id(seen_ids: &mut BTreeMap<String, Vec<String>>, id: &str) {
    let trimmed = id.trim();
    if trimmed.is_empty() {
        return;
    }
    seen_ids
        .entry(trimmed.to_string())
        .or_default()
        .push(trimmed.to_string());
}

fn issue(
    severity: TextRulesIssueSeverity,
    code: TextRulesIssueCode,
    message: impl Into<String>,
    rule_ids: Vec<String>,
) -> TextRulesIssue {
    TextRulesIssue {
        severity,
        code,
        message: message.into(),
        rule_ids,
    }
}

fn normalized_key(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_lowercase()
}

fn export_path(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Export path must not be empty.".to_string());
    }
    Ok(PathBuf::from(trimmed))
}

fn import_path(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Import path must not be empty.".to_string());
    }
    Ok(PathBuf::from(trimmed))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flags_empty_entries_and_duplicates() {
        let analysis = analyze_document(
            &TextRulesDocument {
                schema_version: TEXT_RULES_SCHEMA_VERSION,
                prompt: String::new(),
                stt_hints: String::new(),
                dictionary_entries: vec![
                    DictionaryEntry {
                        id: "dict-1".to_string(),
                        phrase: "".to_string(),
                        replace_with: "WordScript".to_string(),
                    },
                    DictionaryEntry {
                        id: "dict-2".to_string(),
                        phrase: "word script".to_string(),
                        replace_with: "WordScript".to_string(),
                    },
                    DictionaryEntry {
                        id: "dict-3".to_string(),
                        phrase: "word   script".to_string(),
                        replace_with: "WordScript".to_string(),
                    },
                ],
                snippet_entries: vec![SnippetEntry {
                    id: "snippet-1".to_string(),
                    label: "".to_string(),
                    trigger: "follow up note".to_string(),
                    expansion: "Thanks".to_string(),
                }],
            },
            None,
        );

        assert!(analysis.blocking);
        assert!(analysis
            .issues
            .iter()
            .any(|issue| matches!(issue.code, TextRulesIssueCode::EmptyDictionaryPhrase)));
        assert!(analysis
            .issues
            .iter()
            .any(|issue| matches!(issue.code, TextRulesIssueCode::DuplicateDictionaryPhrase)));
        assert!(analysis
            .issues
            .iter()
            .any(|issue| matches!(issue.code, TextRulesIssueCode::EmptySnippetLabel)));
    }

    #[test]
    fn merge_imported_rules_replace_matching_keys() {
        let merged = merge_documents(
            TextRulesDocument {
                schema_version: TEXT_RULES_SCHEMA_VERSION,
                prompt: "current prompt".to_string(),
                stt_hints: "current hint".to_string(),
                dictionary_entries: vec![DictionaryEntry {
                    id: "dict-current".to_string(),
                    phrase: "word script".to_string(),
                    replace_with: "Current".to_string(),
                }],
                snippet_entries: vec![SnippetEntry {
                    id: "snippet-current".to_string(),
                    label: "Current".to_string(),
                    trigger: "follow up note".to_string(),
                    expansion: "Current expansion".to_string(),
                }],
            },
            TextRulesDocument {
                schema_version: TEXT_RULES_SCHEMA_VERSION,
                prompt: "imported prompt".to_string(),
                stt_hints: "imported hint".to_string(),
                dictionary_entries: vec![DictionaryEntry {
                    id: "dict-imported".to_string(),
                    phrase: "word script".to_string(),
                    replace_with: "Imported".to_string(),
                }],
                snippet_entries: vec![SnippetEntry {
                    id: "snippet-imported".to_string(),
                    label: "Imported".to_string(),
                    trigger: "follow up note".to_string(),
                    expansion: "Imported expansion".to_string(),
                }],
            },
        );

        assert_eq!(merged.prompt, "current prompt");
        assert_eq!(merged.stt_hints, "current hint");
        assert_eq!(merged.dictionary_entries.len(), 1);
        assert_eq!(merged.dictionary_entries[0].replace_with, "Imported");
        assert_eq!(merged.snippet_entries.len(), 1);
        assert_eq!(merged.snippet_entries[0].expansion, "Imported expansion");
    }

    #[test]
    fn analysis_surfaces_effective_bias_and_ignored_lines() {
        let analysis = analyze_document(
            &TextRulesDocument {
                schema_version: TEXT_RULES_SCHEMA_VERSION,
                prompt: "customer names\nWordScript\nSEV-1\nrefund policy".to_string(),
                stt_hints: "status update\nthis hint is too long to stay in the automatic bias path".to_string(),
                dictionary_entries: vec![DictionaryEntry {
                    id: "dict-1".to_string(),
                    phrase: "sev one".to_string(),
                    replace_with: "SEV-1".to_string(),
                }],
                snippet_entries: Vec::new(),
            },
            None,
        );

        assert_eq!(
            analysis.transcription_bias.profile_hints,
            vec!["WordScript", "SEV-1"]
        );
        assert_eq!(
            analysis.transcription_bias.dictionary_terms,
            vec!["SEV-1"]
        );
        assert_eq!(
            analysis.transcription_bias.stt_hints,
            vec!["status update"]
        );
        assert_eq!(
            analysis.transcription_bias.ignored_profile_lines,
            vec!["customer names", "refund policy"]
        );
        assert_eq!(
            analysis.transcription_bias.ignored_stt_hint_lines,
            vec!["this hint is too long to stay in the automatic bias path"]
        );
        assert!(analysis.issues.iter().any(|issue| matches!(
            issue.code,
            TextRulesIssueCode::BroadProfileContextIgnored
        )));
        assert!(analysis.issues.iter().any(|issue| matches!(
            issue.code,
            TextRulesIssueCode::IgnoredSttHint
        )));
    }

    #[test]
    fn analysis_warns_when_profile_context_or_stt_hints_produce_no_usable_bias() {
        let analysis = analyze_document(
            &TextRulesDocument {
                schema_version: TEXT_RULES_SCHEMA_VERSION,
                prompt: "customer names\nrefund policy".to_string(),
                stt_hints: "this hint is too long to stay in the automatic bias path".to_string(),
                dictionary_entries: Vec::new(),
                snippet_entries: Vec::new(),
            },
            None,
        );

        assert!(analysis.issues.iter().any(|issue| matches!(
            issue.code,
            TextRulesIssueCode::NoConcreteProfileHints
        )));
        assert!(analysis.issues.iter().any(|issue| matches!(
            issue.code,
            TextRulesIssueCode::NoUsableSttHints
        )));
    }

    #[test]
    fn regression_customer_success_profile_warns_no_concrete_hints_and_ignores_all_lines() {
        // Regression: Customer Success Replies-style profiles with only generic lowercase
        // category phrases silently contributed zero usable STT bias while appearing populated.
        // This test ensures the warning path fires and all lines land in ignored_profile_lines.
        let analysis = analyze_document(
            &TextRulesDocument {
                schema_version: TEXT_RULES_SCHEMA_VERSION,
                prompt: "customer success\nfollow up with client\nescalation handling\nsatisfaction score".to_string(),
                stt_hints: String::new(),
                dictionary_entries: Vec::new(),
                snippet_entries: Vec::new(),
            },
            None,
        );

        assert!(
            analysis.transcription_bias.profile_hints.is_empty(),
            "expected no profile hints from generic CS phrases"
        );
        assert_eq!(
            analysis.transcription_bias.ignored_profile_lines.len(),
            4,
            "expected all 4 CS category lines in ignored_profile_lines"
        );
        assert!(analysis.issues.iter().any(|issue| matches!(
            issue.code,
            TextRulesIssueCode::NoConcreteProfileHints
        )));
    }
}
