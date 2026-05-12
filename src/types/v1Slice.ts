export type SliceStage = "idle" | "capturing" | "processing" | "completed" | "error";
export type InsertMode = "in_app_preview" | "clipboard_fallback_planned";

export interface SliceCapabilities {
  cloud_transcription: boolean;
  local_transcription: boolean;
  insertion_fallback: boolean;
  typed_contracts: boolean;
  rebuild_lab: boolean;
}

export interface V1SliceStatus {
  stage: SliceStage;
  session_id: string | null;
  active_trigger: string | null;
  preferred_provider: string;
  architecture_mode: string;
  last_transcript: string | null;
  last_insert_target: string | null;
  last_error: string | null;
  capabilities: SliceCapabilities;
  next_milestones: string[];
}

export interface StartCaptureRequest {
  trigger: string;
}

export interface CompleteCaptureRequest {
  raw_text: string;
  insert_target: string;
  profile: string;
}

export interface SliceTranscript {
  raw_text: string;
  final_text: string;
  provider_mode: string;
  profile: string;
  applied_rules: string[];
}

export interface SliceInsertionPlan {
  target: string;
  mode: InsertMode;
  fallback: string;
}

export interface V1SliceResult {
  status: V1SliceStatus;
  transcript: SliceTranscript;
  insertion: SliceInsertionPlan;
}