export type NativeInsertMode = "direct_paste" | "clipboard_only" | "clipboard_fallback" | "scratchpad_fallback";
export type NativeSupportTier = "tier1" | "preview" | "experimental";

export interface NativeInsertionPlatformStatus {
  platform_label: string;
  support_tier: NativeSupportTier;
  insert_strategy: NativeInsertMode;
  support_message: string;
  prerequisites: string[];
  caveats: string[];
}

export interface ScratchpadEntry {
  id: string;
  text: string;
  source: string;
  created_at_ms: number;
  corrected: boolean;
  insert_mode: NativeInsertMode;
  clipboard_written: boolean;
  paste_attempted: boolean;
  pasted: boolean;
  error: string | null;
}

export interface NativeInsertionConfig {
  auto_paste: boolean;
  paste_delay_ms: number;
}

export interface NativeInsertionStatus {
  config: NativeInsertionConfig;
  last_transcript: ScratchpadEntry | null;
  scratchpad_entries: ScratchpadEntry[];
  scratchpad_path: string;
  platform: NativeInsertionPlatformStatus;
}

export interface NativeInsertResult {
  ok: boolean;
  text: string;
  insert_mode: NativeInsertMode;
  clipboard_written: boolean;
  paste_attempted: boolean;
  pasted: boolean;
  scratchpad_entry: ScratchpadEntry;
  fallback_available: boolean;
  error: string | null;
}