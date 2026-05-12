// ── Backend → Tauri events (received via listen("wordscript-event")) ─────────

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

export interface AppConfig {
  groq_api_key:            string;
  model:                   string;
  language:                string;
  prompt:                  string;
  dictionary_entries:      DictionaryEntry[];
  snippet_entries:         SnippetEntry[];
  post_process:            boolean;
  correction_model:        string;
  filter_fillers:          boolean;
  professionalize:         boolean;
  backend:                 string;
  local_model:             string;
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
