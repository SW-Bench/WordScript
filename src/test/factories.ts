import type { AppConfig } from "../types/ipc";

export function createAppConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    groq_api_key: "",
    model: "whisper-large-v3-turbo",
    language: "",
    prompt: "",
    dictionary_entries: [],
    snippet_entries: [],
    post_process: true,
    correction_model: "llama-3.1-8b-instant",
    filter_fillers: true,
    professionalize: false,
    backend: "groq",
    local_model: "",
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
    ...overrides,
  };
}