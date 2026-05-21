// ── Runtime → Tauri events (received via listen("wordscript-event")) ─────────

export interface DictionaryEntry {
  id:                      string;
  phrase:                  string;
  replace_with:            string;
}

export interface SnippetEntry {
  id:                      string;
  label:                   string;
  trigger:                 string;
  expansion:               string;
}

export interface TextProfile {
  id:                      string;
  label:                   string;
  prompt:                  string;
  dictionary_entries:      DictionaryEntry[];
  snippet_entries:         SnippetEntry[];
}

export interface LocalProfileDecodeSettings {
  profile_id:              string;
  beam_size:               number;
  best_of:                 number;
}

export interface LocalProfilePromptSettings {
  profile_id:              string;
  prompt_strength:         "off" | "profile" | "profile_and_terms";
  prompt_carry:            boolean;
}

export interface AppConfig {
  model:                   string;
  language:                string;
  prompt:                  string;
  dictionary_entries:      DictionaryEntry[];
  snippet_entries:         SnippetEntry[];
  active_text_profile_id:  string;
  text_profiles:           TextProfile[];
  post_process:            boolean;
  correction_model:        string;
  filter_fillers:          boolean;
  professionalize:         boolean;
  provider:                string;
  local_model:             string;
  local_profile:           string;
  local_prompt_strength:   "off" | "profile" | "profile_and_terms";
  local_prompt_carry:      boolean;
  local_beam_size:         number;
  local_best_of:           number;
  local_profile_prompt_settings: LocalProfilePromptSettings[];
  local_profile_decode_settings: LocalProfileDecodeSettings[];
  hotkey:                  string;
  pause_hotkey:            string;
  abort_hotkey:            string;
  activation_mode:         "tap" | "hold";
  sample_rate:             number;
  channels:                number;
  dtype:                   string;
  audio_device:            string;
  max_recording_seconds:   number;
  silence_timeout_seconds: number;
  auto_paste:              boolean;
  play_sounds:             boolean;
  log_level:               string;
  temp_audio_dir:          string;
  history_limit:           number;
  history_retention_days:  number;
}

export type BackendEvent =
  | { event: "ready";            version: string; config: AppConfig }
  | { event: "recording_started" }
  | { event: "recording_stopped" }
  | { event: "processing" }
  | { event: "transcription";    text: string; corrected: boolean }
  | { event: "empty" }
  | { event: "muted";            muted: boolean }
  | { event: "paused";           paused: boolean }
  | { event: "error";            message: string }
  | { event: "audio_level";      level: number; rms?: number; waveform?: number[] }
  | { event: "shutdown" };

// ── Runtime state (derived in useRuntime) ─────────────────────────────────────

export type RuntimeStatus = "idle" | "recording" | "processing";

export interface RuntimeState {
  status:            RuntimeStatus;
  config:            AppConfig | null;
  muted:             boolean;
  paused:            boolean;
  lastTranscription: string | null;
  error:             string | null;
  recordingStartMs:  number | null;   // Date.now() when recording started
}
