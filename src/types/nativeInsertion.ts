export type NativeInsertMode = "direct_paste" | "clipboard_only" | "clipboard_fallback" | "scratchpad_fallback";
export type NativeInsertDriver = "wl_copy" | "arboard" | "xdotool" | "wdotool_type" | "wtype" | "ydotool" | "enigo" | "scratchpad";
export type NativeSupportTier = "tier1" | "preview" | "experimental";
export type NativeInsertReadiness = "ready" | "recovery_only";
export type NativeInsertRecoveryAction = "none" | "manual_paste" | "use_scratchpad";
export type NativeClipboardRestoreStatus = "not_attempted" | "scheduled" | "skipped_no_previous_clipboard";

export type CompositorKind =
  | "unknown"
  | "kde_plasma5"
  | "kde_plasma6"
  | "gnome_mutter"
  | "hyprland"
  | "sway"
  | "other";

export interface PortalCapabilities {
  compositor: CompositorKind;
  session_type: string;
  xdg_current_desktop: string | null;
  xdg_session_desktop: string | null;
  has_remote_desktop_portal: boolean;
  has_input_capture_portal: boolean;
  has_xdg_desktop_portal_daemon: boolean;
  xdg_desktop_portal_version: string | null;
  last_session_active: boolean;
}

export type PortalPromptSignal =
  | "kde_remote_desktop"
  | "input_capture"
  | "unknown";

export interface NativeInsertDriverStatus {
  driver: NativeInsertDriver;
  label: string;
  role: string;
  available: boolean;
  active: boolean;
  detail: string;
}

export interface NativeInsertionPlatformStatus {
  platform_label: string;
  support_tier: NativeSupportTier;
  readiness: NativeInsertReadiness;
  readiness_message: string;
  insert_strategy: NativeInsertMode;
  active_driver: NativeInsertDriver;
  support_message: string;
  driver_chain: NativeInsertDriverStatus[];
  prerequisites: string[];
  caveats: string[];
  portal_capabilities?: PortalCapabilities | null;
  paste_disabled_reason?: string | null;
}

export interface ScratchpadEntry {
  id: string;
  text: string;
  source: string;
  created_at_ms: number;
  corrected: boolean;
  insert_mode: NativeInsertMode;
  active_driver: NativeInsertDriver;
  clipboard_written: boolean;
  paste_attempted: boolean;
  pasted: boolean;
  fallback_reason: string | null;
  error: string | null;
  recovery_action: NativeInsertRecoveryAction;
  recovery_message: string | null;
  clipboard_restore: NativeClipboardRestoreStatus;
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
  last_portal_prompt?: LastPortalPrompt | null;
  portal_session?: PortalSessionSummary | null;
}

export interface LastPortalPrompt {
  signal: PortalPromptSignal;
  driver: NativeInsertDriver;
  detected_at_ms: number;
  stderr_excerpt: string;
}

export interface PortalSessionSummary {
  active: boolean;
  compositor: string;
  error: string | null;
}

export interface NativeInsertResult {
  ok: boolean;
  text: string;
  insert_mode: NativeInsertMode;
  active_driver: NativeInsertDriver;
  clipboard_written: boolean;
  paste_attempted: boolean;
  pasted: boolean;
  scratchpad_entry: ScratchpadEntry;
  fallback_available: boolean;
  fallback_reason: string | null;
  error: string | null;
  recovery_action: NativeInsertRecoveryAction;
  recovery_message: string;
  clipboard_restore: NativeClipboardRestoreStatus;
}