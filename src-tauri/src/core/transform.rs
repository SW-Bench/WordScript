use std::time::Instant;

use regex::{Captures, NoExpand, Regex, RegexBuilder};

use super::config::{DictionaryEntry, SnippetEntry};
use super::providers::groq::{
    create_groq_chat_completion, GroqChatCompletionRequest, GroqChatMessage,
};
use super::runtime_log;

#[derive(Debug, Clone)]
pub struct NativeTransformConfig {
    pub dictionary_entries: Vec<DictionaryEntry>,
    pub snippet_entries: Vec<SnippetEntry>,
    pub post_process: bool,
    pub correction_model: String,
    pub filter_fillers: bool,
    pub professionalize: bool,
}

#[derive(Debug, Clone)]
pub struct NativeTransformResult {
    pub text: String,
    pub corrected: bool,
    pub applied_rules: Vec<String>,
    pub warning: Option<String>,
}

impl NativeTransformConfig {
    pub fn from_payload(value: &serde_json::Value) -> Self {
        Self {
            dictionary_entries: value
                .get("dictionary_entries")
                .cloned()
                .and_then(|value| serde_json::from_value(value).ok())
                .unwrap_or_default(),
            snippet_entries: value
                .get("snippet_entries")
                .cloned()
                .and_then(|value| serde_json::from_value(value).ok())
                .unwrap_or_default(),
            post_process: value
                .get("post_process")
                .and_then(|value| value.as_bool())
                .unwrap_or(true),
            correction_model: value
                .get("correction_model")
                .and_then(|value| value.as_str())
                .filter(|value| !value.trim().is_empty())
                .unwrap_or("llama-3.1-8b-instant")
                .to_string(),
            filter_fillers: value
                .get("filter_fillers")
                .and_then(|value| value.as_bool())
                .unwrap_or(true),
            professionalize: value
                .get("professionalize")
                .and_then(|value| value.as_bool())
                .unwrap_or(false),
        }
    }
}

pub async fn apply_native_transform(
    text: &str,
    config: NativeTransformConfig,
) -> NativeTransformResult {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return NativeTransformResult {
            text: String::new(),
            corrected: false,
            applied_rules: vec!["empty_transcription".to_string()],
            warning: None,
        };
    }

    if is_hallucination(trimmed) {
        return NativeTransformResult {
            text: String::new(),
            corrected: false,
            applied_rules: vec!["hallucination_filtered".to_string()],
            warning: None,
        };
    }

    let mut result = if !config.post_process {
        NativeTransformResult {
            text: trimmed.to_string(),
            corrected: false,
            applied_rules: vec!["post_process_disabled".to_string()],
            warning: None,
        }
    } else {
        let word_count = trimmed.split_whitespace().count();
        let model = if word_count > 300 {
            "llama-3.3-70b-versatile".to_string()
        } else {
            config.correction_model.clone()
        };
        let timeout_ms = if word_count > 300 { 30_000 } else { 8_000 };
        let correction_started_at = Instant::now();

        runtime_log::record(format!(
            "[WordScript] Native transform correction start words={} model={} timeout_ms={} filter_fillers={} professionalize={}",
            word_count,
            model,
            timeout_ms,
            config.filter_fillers,
            config.professionalize,
        ));

        let request = GroqChatCompletionRequest {
            model,
            messages: vec![
                GroqChatMessage {
                    role: "system".to_string(),
                    content: correction_system_prompt(
                        config.filter_fillers,
                        config.professionalize,
                    )
                    .to_string(),
                },
                GroqChatMessage {
                    role: "user".to_string(),
                    content: trimmed.to_string(),
                },
            ],
            temperature: 0.0,
            max_tokens: (trimmed.len().saturating_mul(2).max(40)).min(4_096) as u32,
            timeout_ms: Some(timeout_ms),
            max_retries: Some(1),
        };

        match create_groq_chat_completion(request).await {
            Ok(corrected) => {
                runtime_log::record(format!(
                    "[WordScript] Native transform correction done elapsed_ms={} corrected_len={}",
                    correction_started_at.elapsed().as_millis(),
                    corrected.trim().len(),
                ));
                normalize_correction(trimmed, corrected.trim(), &config)
            }
            Err(error) => NativeTransformResult {
                text: trimmed.to_string(),
                corrected: false,
                applied_rules: vec!["post_correction_failed_fallback".to_string()],
                warning: Some(error.message),
            },
        }
    };

    let (resolved_text, mut resolved_rules) = apply_text_rules(&result.text, &config);
    if resolved_text != result.text {
        result.corrected = true;
        result.text = resolved_text;
    }
    result.applied_rules.append(&mut resolved_rules);
    result
}

pub fn preview_text_rules_only(
    text: &str,
    config: &NativeTransformConfig,
) -> (String, Vec<String>) {
    apply_text_rules(text, config)
}

fn normalize_correction(
    original: &str,
    corrected: &str,
    config: &NativeTransformConfig,
) -> NativeTransformResult {
    if corrected.is_empty() {
        return NativeTransformResult {
            text: original.to_string(),
            corrected: false,
            applied_rules: vec!["empty_correction_fallback".to_string()],
            warning: None,
        };
    }

    let min_ratio = if config.professionalize {
        0.4
    } else if config.filter_fillers {
        0.5
    } else {
        0.85
    };

    if corrected.len() > original.len().saturating_mul(3) / 2 + 50 {
        return NativeTransformResult {
            text: original.to_string(),
            corrected: false,
            applied_rules: vec!["assistant_like_correction_rejected".to_string()],
            warning: None,
        };
    }

    if original.len() > 20 && (corrected.len() as f32) < (original.len() as f32 * min_ratio) {
        return NativeTransformResult {
            text: original.to_string(),
            corrected: false,
            applied_rules: vec!["over_shortened_correction_rejected".to_string()],
            warning: None,
        };
    }

    let corrected_lower = corrected.to_lowercase();
    let original_lower = original.to_lowercase();
    if contains_new_assistant_phrase(&corrected_lower, &original_lower)
        || has_suspicious_start(&corrected_lower, &original_lower, config.professionalize)
        || !word_overlap_ok(
            original,
            corrected,
            if config.professionalize {
                0.25
            } else if config.filter_fillers {
                0.4
            } else {
                0.55
            },
        )
    {
        return NativeTransformResult {
            text: original.to_string(),
            corrected: false,
            applied_rules: vec!["correction_guardrail_fallback".to_string()],
            warning: None,
        };
    }

    let changed = corrected != original;
    NativeTransformResult {
        text: if changed {
            corrected.to_string()
        } else {
            original.to_string()
        },
        corrected: changed,
        applied_rules: vec![if changed {
            "post_corrected".to_string()
        } else {
            "post_correction_no_change".to_string()
        }],
        warning: None,
    }
}

fn apply_text_rules(text: &str, config: &NativeTransformConfig) -> (String, Vec<String>) {
    let (dictionary_text, mut dictionary_rules) =
        apply_dictionary_entries(text, &config.dictionary_entries);
    let (snippet_text, mut snippet_rules) =
        apply_snippet_entries(&dictionary_text, &config.snippet_entries);
    dictionary_rules.append(&mut snippet_rules);
    (snippet_text, dictionary_rules)
}

fn apply_dictionary_entries(text: &str, entries: &[DictionaryEntry]) -> (String, Vec<String>) {
    let mut current = text.to_string();
    let mut applied_rules = Vec::new();

    for entry in entries {
        let phrase = entry.phrase.trim();
        let replace_with = entry.replace_with.trim();
        if phrase.is_empty() || replace_with.is_empty() {
            continue;
        }

        let Some(pattern) = build_phrase_pattern(phrase) else {
            continue;
        };
        let replaced = replace_with_pattern(&pattern, &current, replace_with);
        if replaced != current {
            applied_rules.push(format!("dictionary:{}", rule_label(&entry.id, phrase)));
            current = replaced;
        }
    }

    (current, applied_rules)
}

fn apply_snippet_entries(text: &str, entries: &[SnippetEntry]) -> (String, Vec<String>) {
    let mut current = text.to_string();
    let mut applied_rules = Vec::new();

    for entry in entries {
        let trigger = entry.trigger.trim();
        let expansion = entry.expansion.trim();
        if trigger.is_empty() || expansion.is_empty() {
            continue;
        }

        let Some(pattern) = build_phrase_pattern(trigger) else {
            continue;
        };
        let replaced = replace_with_pattern(&pattern, &current, expansion);
        if replaced != current {
            let label = entry.label.trim();
            applied_rules.push(format!(
                "snippet:{}",
                rule_label(&entry.id, if label.is_empty() { trigger } else { label })
            ));
            current = replaced;
        }
    }

    (current, applied_rules)
}

struct PhrasePattern {
    regex: Regex,
    preserve_boundaries: bool,
}

fn build_phrase_pattern(phrase: &str) -> Option<PhrasePattern> {
    let trimmed = phrase.trim();
    if trimmed.is_empty() {
        return None;
    }

    let escaped = regex::escape(trimmed).replace("\\ ", r"\s+");
    let word_like = trimmed.chars().all(|character| {
        character.is_alphanumeric() || character.is_whitespace() || matches!(character, '-' | '_')
    });
    let pattern = if word_like {
        format!(r"(^|[^\p{{L}}\p{{N}}])({escaped})($|[^\p{{L}}\p{{N}}])")
    } else {
        escaped
    };

    RegexBuilder::new(&pattern)
        .case_insensitive(true)
        .build()
        .ok()
        .map(|regex| PhrasePattern {
            regex,
            preserve_boundaries: word_like,
        })
}

fn replace_with_pattern(pattern: &PhrasePattern, text: &str, replacement: &str) -> String {
    if pattern.preserve_boundaries {
        pattern
            .regex
            .replace_all(text, |captures: &Captures| {
                let leading = captures.get(1).map_or("", |value| value.as_str());
                let trailing = captures.get(3).map_or("", |value| value.as_str());
                format!("{leading}{replacement}{trailing}")
            })
            .into_owned()
    } else {
        pattern
            .regex
            .replace_all(text, NoExpand(replacement))
            .into_owned()
    }
}

fn rule_label(id: &str, fallback: &str) -> String {
    let trimmed = id.trim();
    if trimmed.is_empty() {
        fallback.to_lowercase().replace(' ', "-")
    } else {
        trimmed.to_string()
    }
}

fn correction_system_prompt(filter_fillers: bool, professionalize: bool) -> &'static str {
    match (filter_fillers, professionalize) {
        (true, true) => {
            "Du bist ein stummer Textverarbeitungs-Filter. Gib AUSSCHLIESSLICH den verarbeiteten Text zurück — KEINE Kommentare, Erklärungen oder Antworten. Sprache beibehalten (DE/EN/gemischt), niemals übersetzen. Aufgaben: (1) Füllwörter entfernen: ähm, äh, öh, ähh, hmm, uh, um, er, mhm; (2) Tippfehler und Grammatik korrigieren; (3) Text professionell und klar formulieren — Satzstruktur verbessern, Redundanzen entfernen, sachlich und präzise. Du bist ein Filter, kein Assistent."
        }
        (false, true) => {
            "Du bist ein stummer Textverarbeitungs-Filter. Gib AUSSCHLIESSLICH den verarbeiteten Text zurück — KEINE Kommentare, Erklärungen oder Antworten. Sprache beibehalten (DE/EN/gemischt), niemals übersetzen. Aufgaben: (1) Tippfehler und Grammatik korrigieren; (2) Text professionell und klar formulieren — Satzstruktur verbessern, Redundanzen entfernen, sachlich und präzise. Bedeutung erhalten, keine neuen Informationen hinzufügen. Du bist ein Filter, kein Assistent."
        }
        (true, false) => {
            "Du bist ein stummer Textkorrektur-Filter. Gib AUSSCHLIESSLICH den korrigierten Text zurück — KEINE Kommentare, Erklärungen oder Antworten. Sprache beibehalten (DE/EN/gemischt), niemals übersetzen. Aufgaben: (1) Füllwörter entfernen: ähm, äh, öh, ähh, hmm, uh, um, er, mhm; (2) Tippfehler und Grammatik korrigieren. Sonst nichts verändern. Bedeutung und Stil beibehalten. Du bist ein Filter, kein Assistent."
        }
        (false, false) => {
            "Du bist ein stummer Textkorrektur-Filter. Gib AUSSCHLIESSLICH den korrigierten Text zurück — KEINE Kommentare, Erklärungen oder Antworten. Sprache beibehalten (DE/EN/gemischt), niemals übersetzen. Nur Tippfehler und Grammatik korrigieren; niemals Wörter entfernen, kürzen oder umformulieren. Kurzer Input (1-5 Wörter): exakt zurückgeben. Bei korrektem Text: Originaltext Zeichen für Zeichen zurück. Du bist ein Filter, kein Assistent."
        }
    }
}

fn word_overlap_ok(original: &str, corrected: &str, threshold: f32) -> bool {
    let original_words = split_words(original);
    if original_words.len() < 5 {
        return true;
    }
    let corrected_words = split_words(corrected);
    let overlap = original_words
        .iter()
        .filter(|word| corrected_words.contains(*word))
        .count() as f32
        / original_words.len() as f32;
    overlap >= threshold
}

fn split_words(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split_whitespace()
        .map(|token| {
            token
                .trim_matches(|ch: char| !ch.is_alphanumeric())
                .to_string()
        })
        .filter(|token| !token.is_empty())
        .collect()
}

fn contains_new_assistant_phrase(corrected: &str, original: &str) -> bool {
    const ASSISTANT_PHRASES: &[&str] = &[
        "ich verstehe",
        "hier ist",
        "der text lautet",
        "ich bin bereit",
        "als ki",
        "als sprachmodell",
        "entschuldigung",
        "leider",
        "möchtest du",
        "danke für",
        "bitte geben",
        "bitte eingeben",
        "bitte gib",
        "damit ich",
        "ich benötige",
        "ich brauche",
        "es gibt nichts",
        "kein text",
        "keinen text",
        "keine eingabe",
        "gerne helfe",
        "gerne korrigiere",
        "hier der korrigier",
        "natürlich,",
        "selbstverständlich,",
        "please enter",
        "please provide",
        "i need",
        "as an ai",
        "as a language model",
        "here is the",
        "here's the",
        "i'm ready",
        "no text",
        "no input",
    ];

    ASSISTANT_PHRASES
        .iter()
        .any(|phrase| corrected.contains(phrase) && !original.contains(phrase))
}

fn has_suspicious_start(corrected: &str, original: &str, professionalize: bool) -> bool {
    if professionalize {
        return false;
    }

    const SUSPICIOUS_STARTS: &[&str] = &[
        "ich ",
        "sie ",
        "du ",
        "bitte ",
        "danke",
        "vielen",
        "here ",
        "i ",
        "you ",
        "please ",
        "thank",
        "sure,",
        "of course",
        "certainly",
        "natürlich,",
        "selbstverständlich,",
    ];

    SUSPICIOUS_STARTS
        .iter()
        .any(|start| corrected.starts_with(start) && !original.starts_with(start))
}

fn is_hallucination(text: &str) -> bool {
    let normalized = text.trim().to_lowercase();
    if normalized.is_empty() {
        return true;
    }

    const EXACT: &[&str] = &[
        ".",
        "..",
        "...",
        "thanks for watching",
        "thank you for watching",
        "thank you",
        "thanks",
        "vielen dank",
        "vielen dank fürs zuschauen",
        "vielen dank für ihre aufmerksamkeit",
        "danke schön",
        "danke fürs zuschauen",
        "danke",
        "bitte abonnieren",
        "nicht vergessen zu abonnieren",
        "untertitel von",
        "untertitel der amara.org-community",
        "merci d'avoir regardé",
        "merci pour votre attention",
        "gracias por ver",
        "gracias",
        "subtítulos",
    ];

    if EXACT.contains(&normalized.as_str()) {
        return true;
    }

    if normalized
        .chars()
        .all(|ch| ch.is_whitespace() || "….,!?;:-–—[]♪♫".contains(ch))
    {
        return true;
    }

    [
        "thanks for ",
        "thank you for ",
        "subscribe",
        "like and subscribe",
        "don't forget to subscribe",
        "untertitel",
        "subtitles",
        "subtítulos",
        "sous-titres",
    ]
    .iter()
    .any(|prefix| normalized.starts_with(prefix))
        || [
            "bye",
            "goodbye",
            "tschüss",
            "auf wiedersehen",
            "musik",
            "music",
            "applause",
            "laughter",
        ]
        .iter()
        .any(|value| normalized == *value || normalized == format!("[{value}]"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn filters_known_hallucination_text() {
        let result = apply_native_transform(
            "Thanks for watching",
            NativeTransformConfig {
                dictionary_entries: Vec::new(),
                snippet_entries: Vec::new(),
                post_process: true,
                correction_model: "llama-3.1-8b-instant".to_string(),
                filter_fillers: true,
                professionalize: false,
            },
        )
        .await;

        assert!(result.text.is_empty());
    }

    #[tokio::test]
    async fn keeps_text_when_post_process_is_disabled() {
        let result = apply_native_transform(
            "wir shippen das morgen",
            NativeTransformConfig {
                dictionary_entries: Vec::new(),
                snippet_entries: Vec::new(),
                post_process: false,
                correction_model: "llama-3.1-8b-instant".to_string(),
                filter_fillers: true,
                professionalize: false,
            },
        )
        .await;

        assert_eq!(result.text, "wir shippen das morgen");
        assert!(!result.corrected);
    }

    #[tokio::test]
    async fn applies_dictionary_and_snippet_rules_in_native_slice() {
        let result = apply_native_transform(
            "word script follow up note",
            NativeTransformConfig {
                dictionary_entries: vec![DictionaryEntry {
                    id: "brand".to_string(),
                    phrase: "word script".to_string(),
                    replace_with: "WordScript".to_string(),
                }],
                snippet_entries: vec![SnippetEntry {
                    id: "followup".to_string(),
                    label: "follow up note".to_string(),
                    trigger: "follow up note".to_string(),
                    expansion: "Danke fuer das Update. Wir melden uns mit dem naechsten Stand."
                        .to_string(),
                }],
                post_process: false,
                correction_model: "llama-3.1-8b-instant".to_string(),
                filter_fillers: true,
                professionalize: false,
            },
        )
        .await;

        assert_eq!(
            result.text,
            "WordScript Danke fuer das Update. Wir melden uns mit dem naechsten Stand."
        );
        assert!(result.corrected);
        assert!(result
            .applied_rules
            .contains(&"dictionary:brand".to_string()));
        assert!(result
            .applied_rules
            .contains(&"snippet:followup".to_string()));
    }
}
