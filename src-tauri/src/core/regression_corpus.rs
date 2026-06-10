use std::fs;
use std::path::PathBuf;

use serde::Deserialize;

use super::config::{BiasMode, DictionaryEntry, ManualBias, TextProfile, TextProfileWorkMode};
use super::text_rules::{
    analyze_document, get_profile_health, GetProfileHealthRequest, TextRulesDocument,
    TextRulesIssueCode,
};
use super::transcription_hints::{analyze_transcription_bias_with_mode, BiasRequestContext};

const CORPUS_VERSION: u32 = 1;
const TEXT_RULES_SCHEMA_VERSION: u32 = 1;
const EMBEDDED_CORPUS: &str = include_str!("../../tests/fixtures/regression_transcripts.json");

#[derive(Debug, Clone, Deserialize)]
struct CorpusFile {
    version: u32,
    #[serde(default)]
    entries: Vec<CorpusEntry>,
}

#[derive(Debug, Clone, Deserialize)]
struct CorpusEntry {
    id: String,
    #[serde(default)]
    failure_mode: String,
    profile: CorpusProfile,
    #[allow(dead_code)]
    raw_transcript: String,
    #[serde(default)]
    expected_transcription_bias: Option<ExpectedBias>,
    #[allow(dead_code)]
    expected_post_correction: String,
    #[serde(default)]
    #[allow(dead_code)]
    expected_guardrail: Option<String>,
    #[allow(dead_code)]
    notes: String,
}

#[derive(Debug, Clone, Deserialize)]
struct CorpusProfile {
    id: String,
    prompt: String,
    stt_hints: String,
    #[serde(default)]
    dictionary_entries: Vec<DictionaryEntry>,
    #[serde(default)]
    #[allow(dead_code)]
    snippet_entries: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize)]
struct ExpectedBias {
    #[serde(default)]
    profile_hints_accepted: Vec<String>,
    #[serde(default)]
    ignored_profile_lines_count: Option<usize>,
    #[serde(default)]
    dictionary_terms: Vec<String>,
    #[serde(default)]
    stt_hints: Vec<String>,
}

/// Optional filesystem override for the corpus. The default load path is
/// `tests/fixtures/regression_transcripts.json`; in CI and release builds we
/// embed it with `include_str!` so the test never depends on cwd.
fn corpus_override_path() -> Option<PathBuf> {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    Some(
        PathBuf::from(manifest_dir)
            .join("tests")
            .join("fixtures")
            .join("regression_transcripts.local.json"),
    )
}

pub fn load_corpus() -> CorpusFile {
    let raw = match corpus_override_path().and_then(|path| fs::read_to_string(path).ok()) {
        Some(local) => local,
        None => EMBEDDED_CORPUS.to_string(),
    };
    let corpus: CorpusFile = serde_json::from_str(&raw)
        .unwrap_or_else(|error| panic!("parse regression corpus: {error}"));

    assert_eq!(
        corpus.version, CORPUS_VERSION,
        "corpus version mismatch: file={} expected={}",
        corpus.version, CORPUS_VERSION
    );

    corpus
}

fn text_profile_from_corpus(corpus: &CorpusProfile) -> TextProfile {
    TextProfile {
        id: corpus.id.clone(),
        label: corpus.id.clone(),
        prompt: corpus.prompt.clone(),
        stt_hints: corpus.stt_hints.clone(),
        work_mode: TextProfileWorkMode {
            bias_mode: BiasMode::Conservative,
            manual_bias: ManualBias::default(),
            ..TextProfileWorkMode::default()
        },
        dictionary_entries: corpus.dictionary_entries.clone(),
        snippet_entries: Vec::new(),
        ..TextProfile::default()
    }
}

fn conservative_context() -> BiasRequestContext {
    BiasRequestContext {
        bias_mode: BiasMode::Conservative,
        manual_bias: ManualBias::default(),
        local_prompt_strength: "profile".to_string(),
        local_prompt_carry: false,
    }
}

#[test]
fn corpus_schema_is_valid() {
    let corpus = load_corpus();
    assert!(
        !corpus.entries.is_empty(),
        "corpus must contain at least one entry"
    );
    let mut ids: Vec<&str> = corpus.entries.iter().map(|e| e.id.as_str()).collect();
    ids.sort();
    ids.dedup();
    assert_eq!(
        ids.len(),
        corpus.entries.len(),
        "corpus entries must have unique ids"
    );
}

#[test]
fn corpus_drives_transcription_bias_assertions() {
    let corpus = load_corpus();
    for entry in &corpus.entries {
        let Some(expected) = &entry.expected_transcription_bias else {
            continue;
        };
        let bias = analyze_transcription_bias_with_mode(
            &entry.profile.prompt,
            &entry.profile.stt_hints,
            &entry.profile.dictionary_entries,
            &conservative_context(),
        );

        assert_eq!(
            bias.profile_hints, expected.profile_hints_accepted,
            "[{}] profile_hints mismatch (failure_mode={})",
            entry.id, entry.failure_mode
        );
        assert_eq!(
            bias.dictionary_terms, expected.dictionary_terms,
            "[{}] dictionary_terms mismatch (failure_mode={})",
            entry.id, entry.failure_mode
        );
        assert_eq!(
            bias.stt_hints, expected.stt_hints,
            "[{}] stt_hints mismatch (failure_mode={})",
            entry.id, entry.failure_mode
        );
        if let Some(expected_ignored) = expected.ignored_profile_lines_count {
            assert_eq!(
                bias.ignored_profile_lines.len(),
                expected_ignored,
                "[{}] ignored_profile_lines count mismatch (failure_mode={})",
                entry.id,
                entry.failure_mode
            );
        }
    }
}

#[test]
fn corpus_drives_text_rules_analysis_assertions() {
    let corpus = load_corpus();
    for entry in &corpus.entries {
        let document = TextRulesDocument {
            schema_version: TEXT_RULES_SCHEMA_VERSION,
            prompt: entry.profile.prompt.clone(),
            stt_hints: entry.profile.stt_hints.clone(),
            dictionary_entries: entry.profile.dictionary_entries.clone(),
            snippet_entries: Vec::new(),
        };
        let analysis = analyze_document(&document, None);

        let has_no_concrete_hints = analysis
            .issues
            .iter()
            .any(|issue| matches!(issue.code, TextRulesIssueCode::NoConcreteProfileHints));

        let accepted_count = analysis.transcription_bias.profile_hints.len();
        if accepted_count == 0 && !entry.profile.prompt.trim().is_empty() {
            assert!(
                has_no_concrete_hints,
                "[{}] expected NoConcreteProfileHints issue (failure_mode={})",
                entry.id, entry.failure_mode
            );
        }
    }
}

#[test]
fn corpus_profile_health_initialization_does_not_panic() {
    let corpus = load_corpus();
    for entry in &corpus.entries {
        let profile = text_profile_from_corpus(&entry.profile);
        let _ = get_profile_health(GetProfileHealthRequest {
            prompt: profile.prompt,
            dictionary_entries: profile.dictionary_entries,
            acknowledged_flags: Vec::new(),
            bias_mode: None,
            processing_mode: None,
            agent_mode_enabled: false,
            profile_id: None,
        });
    }
}

#[test]
fn corpus_dictionary_entries_have_phrase_and_replacement() {
    let corpus = load_corpus();
    for entry in &corpus.entries {
        for dict in &entry.profile.dictionary_entries {
            assert!(
                !dict.phrase.trim().is_empty(),
                "[{}] dictionary entry {} has empty phrase",
                entry.id,
                dict.id
            );
            assert!(
                !dict.replace_with.trim().is_empty(),
                "[{}] dictionary entry {} has empty replacement",
                entry.id,
                dict.id
            );
        }
    }
}
