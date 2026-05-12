use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SliceStage {
    Idle,
    Capturing,
    Processing,
    Completed,
    Error,
}

impl Default for SliceStage {
    fn default() -> Self {
        Self::Idle
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct SliceCapabilities {
    pub cloud_transcription: bool,
    pub local_transcription: bool,
    pub insertion_fallback: bool,
    pub typed_contracts: bool,
    pub rebuild_lab: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct SliceStatus {
    pub stage: SliceStage,
    pub session_id: Option<String>,
    pub active_trigger: Option<String>,
    pub preferred_provider: String,
    pub architecture_mode: String,
    pub last_transcript: Option<String>,
    pub last_insert_target: Option<String>,
    pub last_error: Option<String>,
    pub capabilities: SliceCapabilities,
    pub next_milestones: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum InsertMode {
    InAppPreview,
    ClipboardFallbackPlanned,
}

#[derive(Debug, Deserialize)]
pub struct StartCaptureRequest {
    pub trigger: String,
}

#[derive(Debug, Deserialize)]
pub struct CompleteCaptureRequest {
    pub raw_text: String,
    pub insert_target: String,
    pub profile: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SliceTranscript {
    pub raw_text: String,
    pub final_text: String,
    pub provider_mode: String,
    pub profile: String,
    pub applied_rules: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SliceInsertionPlan {
    pub target: String,
    pub mode: InsertMode,
    pub fallback: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SliceResult {
    pub status: SliceStatus,
    pub transcript: SliceTranscript,
    pub insertion: SliceInsertionPlan,
}
