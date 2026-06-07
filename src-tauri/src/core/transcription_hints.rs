use serde::{Deserialize, Serialize};

use super::config::DictionaryEntry;

const MAX_TRANSCRIPTION_PROFILE_HINTS: usize = 6;
const MAX_TRANSCRIPTION_DICTIONARY_TERMS: usize = 8;
const MAX_TRANSCRIPTION_STT_HINTS: usize = 4;
const MAX_TRANSCRIPTION_HINT_CHARS: usize = 48;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct FilteredTranscriptionHints {
    pub accepted: Vec<String>,
    pub ignored: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct TranscriptionBiasPreview {
    pub profile_hints: Vec<String>,
    pub dictionary_terms: Vec<String>,
    pub stt_hints: Vec<String>,
    pub ignored_profile_lines: Vec<String>,
    pub ignored_stt_hint_lines: Vec<String>,
}

pub fn analyze_transcription_bias(
    prompt: &str,
    stt_hints: &str,
    dictionary_entries: &[DictionaryEntry],
) -> TranscriptionBiasPreview {
    let profile_hints = filter_profile_hint_lines(prompt);
    let stt_hints = filter_stt_hint_lines(stt_hints);

    TranscriptionBiasPreview {
        profile_hints: profile_hints.accepted,
        dictionary_terms: preferred_dictionary_terms(dictionary_entries),
        stt_hints: stt_hints.accepted,
        ignored_profile_lines: profile_hints.ignored,
        ignored_stt_hint_lines: stt_hints.ignored,
    }
}

pub fn filter_profile_hint_lines(prompt: &str) -> FilteredTranscriptionHints {
    filter_hint_lines(
        prompt,
        MAX_TRANSCRIPTION_PROFILE_HINTS,
        is_profile_hint_candidate,
    )
}

pub fn filter_stt_hint_lines(stt_hints: &str) -> FilteredTranscriptionHints {
    filter_hint_lines(
        stt_hints,
        MAX_TRANSCRIPTION_STT_HINTS,
        is_stt_hint_candidate,
    )
}

pub fn preferred_dictionary_terms(entries: &[DictionaryEntry]) -> Vec<String> {
    let mut terms = Vec::new();

    for entry in entries {
        let replace_with = normalize_hint(&entry.replace_with);
        if replace_with.is_empty() {
            continue;
        }

        push_unique_case_insensitive(&mut terms, replace_with);
        if terms.len() >= MAX_TRANSCRIPTION_DICTIONARY_TERMS {
            break;
        }
    }

    terms
}

pub fn build_transcription_prompt(
    profile_hints: &[String],
    dictionary_terms: &[String],
    stt_hints: &[String],
    max_chars: usize,
) -> Option<String> {
    let mut sections = Vec::new();

    if !profile_hints.is_empty() {
        sections.push(format!("Vocabulary: {}", profile_hints.join("; ")));
    }

    if !dictionary_terms.is_empty() {
        sections.push(format!(
            "Preferred spellings: {}",
            dictionary_terms.join("; ")
        ));
    }

    if !stt_hints.is_empty() {
        sections.push(format!("Likely phrases: {}", stt_hints.join("; ")));
    }

    truncate_transcription_prompt(sections.join("\n"), max_chars)
}

fn filter_hint_lines(
    raw_lines: &str,
    limit: usize,
    include: fn(&str) -> bool,
) -> FilteredTranscriptionHints {
    let mut accepted = Vec::new();
    let mut ignored = Vec::new();

    for line in raw_lines.lines() {
        let candidate = normalize_hint(line);
        if candidate.is_empty() {
            continue;
        }

        if include(&candidate) {
            push_unique_case_insensitive(&mut accepted, candidate);
            if accepted.len() >= limit {
                break;
            }
        } else {
            push_unique_case_insensitive(&mut ignored, candidate);
        }
    }

    FilteredTranscriptionHints { accepted, ignored }
}

fn normalize_hint(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn is_profile_hint_candidate(value: &str) -> bool {
    if value.is_empty() || value.chars().count() > MAX_TRANSCRIPTION_HINT_CHARS {
        return false;
    }

    let word_count = value.split_whitespace().count();
    if word_count == 0 || word_count > 4 {
        return false;
    }

    if word_count == 1 {
        return true;
    }

    value.chars().any(|character| character.is_ascii_uppercase() || character.is_ascii_digit())
        || value.contains('/')
        || value.contains('&')
        || value.contains('+')
        || value.contains('-')
        || value.contains('_')
        || value.contains('.')
        || value.contains(':')
}

fn is_stt_hint_candidate(value: &str) -> bool {
    !value.is_empty()
        && value.chars().count() <= MAX_TRANSCRIPTION_HINT_CHARS
        && value.split_whitespace().count() <= 4
}

fn push_unique_case_insensitive(target: &mut Vec<String>, candidate: String) {
    if target
        .iter()
        .any(|existing| existing.eq_ignore_ascii_case(&candidate))
    {
        return;
    }

    target.push(candidate);
}

fn truncate_transcription_prompt(prompt: String, max_chars: usize) -> Option<String> {
    let trimmed = prompt.trim();
    if trimmed.is_empty() {
        return None;
    }

    let truncated = trimmed.chars().take(max_chars).collect::<String>();

    Some(truncated.trim().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filters_broad_profile_categories_but_keeps_concrete_terms() {
        let result = filter_profile_hint_lines(
            "customer names\nWordScript\nticket IDs\nrefund policy\nSEV-1",
        );

        assert_eq!(result.accepted, vec!["WordScript", "ticket IDs", "SEV-1"]);
        assert_eq!(result.ignored, vec!["customer names", "refund policy"]);
    }

    // --- Regression corpus: Customer Success Replies profile failure mode ---

    #[test]
    fn regression_cs_profile_all_generic_phrases_produce_no_accepted_hints() {
        // Known failure mode: profiles built from generic lowercase category phrases
        // contribute zero usable STT bias. Every line here would previously pass through
        // to the STT prompt and cause vocabulary drift / topic contamination.
        let result = filter_profile_hint_lines(
            "customer success\nfollow up with client\nescalation handling\nsatisfaction score\nsupport ticket resolution\nrefund request processing",
        );

        assert!(
            result.accepted.is_empty(),
            "expected no accepted hints from generic CS phrases, got: {:?}",
            result.accepted
        );
        assert_eq!(result.ignored.len(), 6);
    }

    #[test]
    fn cs_profile_with_concrete_acronyms_accepted_alongside_generic_lines() {
        // If a CS profile contains real product names or acronyms, those should still pass.
        let result = filter_profile_hint_lines(
            "customer success\nCRM\nSalesforce\nfollow up with client\nCSAT score\nNPS",
        );

        assert_eq!(result.accepted, vec!["CRM", "Salesforce", "CSAT score", "NPS"]);
        assert_eq!(result.ignored, vec!["customer success", "follow up with client"]);
    }

    // --- build_transcription_prompt ---

    #[test]
    fn build_transcription_prompt_returns_none_when_all_sections_empty() {
        assert!(build_transcription_prompt(&[], &[], &[], 512).is_none());
    }

    #[test]
    fn build_transcription_prompt_formats_all_three_sections() {
        let prompt = build_transcription_prompt(
            &["WordScript".to_string(), "SEV-1".to_string()],
            &["WordScript".to_string()],
            &["status update".to_string()],
            512,
        )
        .unwrap();

        assert!(prompt.contains("Vocabulary: WordScript; SEV-1"));
        assert!(prompt.contains("Preferred spellings: WordScript"));
        assert!(prompt.contains("Likely phrases: status update"));
    }

    #[test]
    fn build_transcription_prompt_omits_empty_sections() {
        let prompt = build_transcription_prompt(
            &["WordScript".to_string()],
            &[],
            &[],
            512,
        )
        .unwrap();

        assert!(prompt.contains("Vocabulary: WordScript"));
        assert!(!prompt.contains("Preferred spellings"));
        assert!(!prompt.contains("Likely phrases"));
    }

    #[test]
    fn build_transcription_prompt_truncates_at_max_chars() {
        let long_hints: Vec<String> = (0..20).map(|i| format!("Term{i}")).collect();
        let result = build_transcription_prompt(&long_hints, &[], &[], 30);

        let prompt = result.unwrap();
        assert!(prompt.chars().count() <= 30);
    }

    // --- analyze_transcription_bias composite ---

    #[test]
    fn analyze_transcription_bias_cs_style_profile_yields_empty_profile_hints() {
        let bias = analyze_transcription_bias(
            "customer success\nfollow up with client\nescalation handling",
            "",
            &[],
        );

        assert!(bias.profile_hints.is_empty());
        assert_eq!(bias.ignored_profile_lines.len(), 3);
        assert!(bias.dictionary_terms.is_empty());
        assert!(bias.stt_hints.is_empty());
    }
}