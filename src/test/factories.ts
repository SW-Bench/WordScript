import type { AppConfig } from "../types/ipc";

export function createAppConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    model: "whisper-large-v3-turbo",
    language: "",
    prompt: "",
    dictionary_entries: [],
    snippet_entries: [],
    active_text_profile_id: "general",
    text_profiles: [
      {
        id: "general",
        label: "General writing",
        prompt: "",
        dictionary_entries: [],
        snippet_entries: [],
      },
    ],
    post_process: true,
    correction_model: "llama-3.1-8b-instant",
    filter_fillers: true,
    professionalize: false,
    provider: "groq",
    local_model: "base",
    hotkey: "ctrl_l+f9",
    pause_hotkey: "ctrl_l+f10",
    abort_hotkey: "ctrl_l+alt_l+escape",
    activation_mode: "tap",
    sample_rate: 16000,
    channels: 1,
    dtype: "int16",
    audio_device: "",
    max_recording_seconds: 180,
    silence_timeout_seconds: 2,
    auto_paste: true,
    play_sounds: true,
    log_level: "info",
    temp_audio_dir: "",
    history_limit: 200,
    history_retention_days: 90,
    ...overrides,
  };
}