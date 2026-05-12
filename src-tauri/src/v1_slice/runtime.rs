use super::contracts::{
    CompleteCaptureRequest, InsertMode, SliceCapabilities, SliceInsertionPlan, SliceResult,
    SliceStage, SliceStatus, SliceTranscript, StartCaptureRequest,
};

#[derive(Debug, Clone)]
struct ActiveSession {
    id: String,
    trigger: String,
}

#[derive(Debug, Default)]
pub struct V1SliceState {
    session_counter: u64,
    stage: SliceStage,
    active_session: Option<ActiveSession>,
    last_session_id: Option<String>,
    last_transcript: Option<SliceTranscript>,
    last_insert_target: Option<String>,
    last_error: Option<String>,
}

impl V1SliceState {
    pub fn status(&self) -> SliceStatus {
        SliceStatus {
            stage: self.stage.clone(),
            session_id: self.last_session_id.clone(),
            active_trigger: self
                .active_session
                .as_ref()
                .map(|session| session.trigger.clone()),
            preferred_provider: "cloud-fast".to_string(),
            architecture_mode: "native-rebuild-slice".to_string(),
            last_transcript: self
                .last_transcript
                .as_ref()
                .map(|transcript| transcript.final_text.clone()),
            last_insert_target: self.last_insert_target.clone(),
            last_error: self.last_error.clone(),
            capabilities: SliceCapabilities {
                cloud_transcription: true,
                local_transcription: false,
                insertion_fallback: true,
                typed_contracts: true,
                rebuild_lab: true,
            },
            next_milestones: vec![
                "native global hotkey".to_string(),
                "native audio capture".to_string(),
                "real insertion adapters".to_string(),
                "cloud provider retries and timeouts".to_string(),
            ],
        }
    }

    pub fn reset(&mut self) -> SliceStatus {
        self.stage = SliceStage::Idle;
        self.active_session = None;
        self.last_session_id = None;
        self.last_transcript = None;
        self.last_insert_target = None;
        self.last_error = None;
        self.status()
    }

    pub fn start_capture(&mut self, request: StartCaptureRequest) -> Result<SliceStatus, String> {
        if self.active_session.is_some() {
            return Err("A capture session is already active.".to_string());
        }

        let trigger = request.trigger.trim();
        if trigger.is_empty() {
            return Err("Trigger must not be empty.".to_string());
        }

        self.session_counter += 1;
        let session_id = format!("slice-{}", self.session_counter);
        self.active_session = Some(ActiveSession {
            id: session_id.clone(),
            trigger: trigger.to_string(),
        });
        self.last_session_id = Some(session_id);
        self.last_error = None;
        self.stage = SliceStage::Capturing;

        Ok(self.status())
    }

    pub fn complete_capture(
        &mut self,
        request: CompleteCaptureRequest,
    ) -> Result<SliceResult, String> {
        let active_session = self
            .active_session
            .clone()
            .ok_or_else(|| "No active capture session. Start capture first.".to_string())?;

        let raw_text = request.raw_text.trim();
        if raw_text.is_empty() {
            self.stage = SliceStage::Error;
            self.last_error = Some("Raw text must not be empty.".to_string());
            return Err("Raw text must not be empty.".to_string());
        }

        self.stage = SliceStage::Processing;

        let transcript = build_transcript(raw_text, &request.profile);
        let insertion = build_insertion_plan(&request.insert_target);

        self.last_session_id = Some(active_session.id);
        self.last_transcript = Some(transcript.clone());
        self.last_insert_target = Some(insertion.target.clone());
        self.last_error = None;
        self.active_session = None;
        self.stage = SliceStage::Completed;

        Ok(SliceResult {
            status: self.status(),
            transcript,
            insertion,
        })
    }
}

fn build_transcript(raw_text: &str, profile: &str) -> SliceTranscript {
    let mut applied_rules = Vec::new();
    let trimmed = raw_text.trim();
    if trimmed != raw_text {
        applied_rules.push("trimmed_edges".to_string());
    }

    let filtered_words: Vec<&str> = trimmed
        .split_whitespace()
        .filter(|token| !is_filler(token))
        .collect();
    if filtered_words.len() != trimmed.split_whitespace().count() {
        applied_rules.push("removed_fillers".to_string());
    }

    let mut final_text = filtered_words.join(" ");

    let collapsed = final_text.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed != final_text {
        applied_rules.push("collapsed_whitespace".to_string());
    }
    final_text = collapsed;

    if let Some(first) = final_text.chars().next() {
        let upper = first.to_uppercase().to_string();
        if upper != first.to_string() {
            final_text.replace_range(0..first.len_utf8(), &upper);
            applied_rules.push("capitalized_sentence_start".to_string());
        }
    }

    if !final_text.is_empty()
        && !matches!(final_text.chars().last(), Some('.') | Some('!') | Some('?'))
    {
        final_text.push('.');
        applied_rules.push("added_terminal_punctuation".to_string());
    }

    SliceTranscript {
        raw_text: raw_text.to_string(),
        final_text,
        provider_mode: "cloud-fast".to_string(),
        profile: profile.trim().to_string(),
        applied_rules,
    }
}

fn build_insertion_plan(insert_target: &str) -> SliceInsertionPlan {
    let normalized_target = insert_target.trim();
    let mode = if normalized_target.contains("clipboard") {
        InsertMode::ClipboardFallbackPlanned
    } else {
        InsertMode::InAppPreview
    };

    SliceInsertionPlan {
        target: normalized_target.to_string(),
        mode,
        fallback: "clipboard_fallback_planned".to_string(),
    }
}

fn is_filler(token: &str) -> bool {
    matches!(
        normalize_token(token).as_str(),
        "um" | "uh" | "uhm" | "hmm" | "ah" | "eh" | "äh" | "ähm"
    )
}

fn normalize_token(token: &str) -> String {
    token
        .trim_matches(|ch: char| !ch.is_alphanumeric())
        .to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transforms_text_for_the_first_slice() {
        let transcript = build_transcript(" ähm wir shippen das morgen ", "developer");

        assert_eq!(transcript.final_text, "Wir shippen das morgen.");
        assert!(transcript
            .applied_rules
            .contains(&"removed_fillers".to_string()));
        assert!(transcript
            .applied_rules
            .contains(&"added_terminal_punctuation".to_string()));
    }

    #[test]
    fn requires_active_session_before_completion() {
        let mut state = V1SliceState::default();
        let result = state.complete_capture(CompleteCaptureRequest {
            raw_text: "hello world".to_string(),
            insert_target: "editor".to_string(),
            profile: "developer".to_string(),
        });

        assert!(result.is_err());
    }
}
