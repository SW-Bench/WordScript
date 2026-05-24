import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OverlayWindow from "./OverlayWindow";

const useRuntimeMock = vi.fn();
const invokeMock = vi.fn();
const startDraggingMock = vi.fn();
const scaleFactorMock = vi.fn();
const movedHandlers: Array<(event: { payload: { x: number; y: number } }) => void> = [];
const runtimeEventHandlers: Array<(event: { payload: { event: string; level?: number; rms?: number; waveform?: number[] } }) => void> = [];

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("../hooks/useRuntime", () => ({
  useRuntime: () => useRuntimeMock(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (channel: string, handler: (event: { payload: { event: string; level?: number; rms?: number; waveform?: number[] } }) => void) => {
    if (channel === "wordscript-event") {
      runtimeEventHandlers.push(handler);
    }

    return () => {
      const index = runtimeEventHandlers.indexOf(handler);
      if (index >= 0) {
        runtimeEventHandlers.splice(index, 1);
      }
    };
  }),
}));

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    setBackgroundColor: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    setBackgroundColor: vi.fn().mockResolvedValue(undefined),
    startDragging: startDraggingMock,
    scaleFactor: scaleFactorMock,
    onMoved: vi.fn(async (handler: (event: { payload: { x: number; y: number } }) => void) => {
      movedHandlers.push(handler);
      return () => {
        const index = movedHandlers.indexOf(handler);
        if (index >= 0) {
          movedHandlers.splice(index, 1);
        }
      };
    }),
  }),
}));

describe("OverlayWindow", () => {
  beforeEach(() => {
    movedHandlers.length = 0;
    runtimeEventHandlers.length = 0;
    invokeMock.mockReset();
    startDraggingMock.mockReset();
    scaleFactorMock.mockReset();
    startDraggingMock.mockResolvedValue(undefined);
    scaleFactorMock.mockResolvedValue(1);
    invokeMock.mockImplementation((command: string) => {
      switch (command) {
        case "sync_overlay_window_visibility":
          return Promise.resolve();
        case "remember_overlay_manual_position":
          return Promise.resolve();
        case "commit_pending_transcription_preview":
          return Promise.resolve({
            ok: true,
            text: "Wir shippen das morgen.",
            insert_mode: "clipboard_only",
            active_driver: "arboard",
            clipboard_written: true,
            paste_attempted: false,
            pasted: false,
            scratchpad_entry: {
              id: "scratchpad-1",
              text: "Wir shippen das morgen.",
              source: command,
              created_at_ms: 1716500000000,
              corrected: true,
              insert_mode: "clipboard_only",
              active_driver: "arboard",
              clipboard_written: true,
              paste_attempted: false,
              pasted: false,
              fallback_reason: null,
              error: null,
              recovery_action: "manual_paste",
              recovery_message: "The transcript is on the clipboard.",
              clipboard_restore: "skipped_no_previous_clipboard",
            },
            fallback_available: true,
            fallback_reason: null,
            error: null,
            recovery_action: "manual_paste",
            recovery_message: "The transcript is on the clipboard.",
            clipboard_restore: "skipped_no_previous_clipboard",
          });
        case "abort_native_session":
          return Promise.resolve({
            stage: "aborted",
          });
        case "insert_text_native":
        case "restore_last_transcript":
          return Promise.resolve({
            ok: true,
            text: "Wir shippen das morgen.",
            insert_mode: "direct_paste",
            active_driver: "enigo",
            clipboard_written: true,
            paste_attempted: true,
            pasted: true,
            scratchpad_entry: {
              id: "scratchpad-1",
              text: "Wir shippen das morgen.",
              source: command,
              created_at_ms: 1716500000000,
              corrected: true,
              insert_mode: "direct_paste",
              active_driver: "enigo",
              clipboard_written: true,
              paste_attempted: true,
              pasted: true,
              fallback_reason: null,
              error: null,
              recovery_action: "none",
              recovery_message: "Inserted at the cursor. No recovery action is needed.",
              clipboard_restore: "scheduled",
            },
            fallback_available: false,
            fallback_reason: null,
            error: null,
            recovery_action: "none",
            recovery_message: "Inserted at the cursor. No recovery action is needed.",
            clipboard_restore: "scheduled",
          });
        case "retry_transcription_history_entry":
          return Promise.resolve({
            id: "history-2",
            created_at_ms: 1716500001000,
            status: "completed",
          });
        default:
          throw new Error(`Unexpected invoke command: ${command}`);
      }
    });

    useRuntimeMock.mockReturnValue({
      state: {
        status: "idle",
        config: {
          model: "whisper-large-v3-turbo",
          language: "de",
          active_text_profile_id: "support",
          text_profiles: [
            {
              id: "support",
              label: "Support reply",
              prompt: "Support tone and escalation names",
              stt_hints: "status update",
              work_mode: {
                rewrite_style: "polished",
                insert_behavior: "clipboard_only",
                recovery_behavior: "standard",
              },
              curation: {
                curated: false,
                audience: "",
                summary: "",
                highlights: [],
              },
              dictionary_entries: [],
              snippet_entries: [],
            },
          ],
          curated_profiles_seeded: true,
          post_process: true,
          correction_model: "llama-3.3-70b-versatile",
          local_correction_model: "llama3.2:latest",
          filter_fillers: true,
          professionalize: false,
          provider: "groq",
          local_model: "base",
          local_profile: "local-preview-base-fast",
          local_prompt_strength: "profile",
          local_prompt_carry: false,
          local_beam_size: 1,
          local_best_of: 1,
          local_profile_prompt_settings: [],
          local_profile_decode_settings: [],
          hotkey: "ctrl+space",
          pause_hotkey: "ctrl+shift+space",
          abort_hotkey: "escape",
          activation_mode: "tap",
          overlay_position_mode: "preset",
          overlay_monitor: "primary",
          overlay_anchor: "bottom_center",
          overlay_manual_x: 0,
          overlay_manual_y: 0,
          sample_rate: 16000,
          channels: 1,
          dtype: "i16",
          audio_device: "",
          max_recording_seconds: 720,
          silence_timeout_seconds: 30,
          auto_paste: true,
          play_sounds: true,
          log_level: "info",
          temp_audio_dir: "",
          history_limit: 200,
          history_retention_days: 90,
        },
        muted: false,
        paused: false,
        lastTranscription: "Wir shippen das morgen.",
        pendingResult: null,
        lastResult: {
          provider: "groq",
          active_profile: "Support reply",
          work_mode: {
            rewrite_style: "polished",
            insert_behavior: "clipboard_only",
            recovery_behavior: "standard",
          },
          raw_text: "ähm wir shippen das morgen",
          final_text: "Wir shippen das morgen.",
          corrected: true,
          transform: {
            applied_rules: ["removed_fillers"],
            warning: null,
          },
          history: {
            entry_id: "history-1",
            retry_of: null,
          },
          insertion: {
            ok: true,
            text: "Wir shippen das morgen.",
            insert_mode: "clipboard_only",
            active_driver: "arboard",
            clipboard_written: true,
            paste_attempted: false,
            pasted: false,
            scratchpad_entry: {
              id: "scratchpad-1",
              text: "Wir shippen das morgen.",
              source: "legacy_transcription_corrected",
              created_at_ms: 1716500000000,
              corrected: true,
              insert_mode: "clipboard_only",
              active_driver: "arboard",
              clipboard_written: true,
              paste_attempted: false,
              pasted: false,
              fallback_reason: null,
              error: null,
              recovery_action: "manual_paste",
              recovery_message: "The transcript is on the clipboard.",
              clipboard_restore: "skipped_no_previous_clipboard",
            },
            fallback_available: true,
            fallback_reason: null,
            error: null,
            recovery_action: "manual_paste",
            recovery_message: "The transcript is on the clipboard.",
            clipboard_restore: "skipped_no_previous_clipboard",
          },
          occurred_at_ms: 1716500000000,
        },
        error: null,
        recordingStartMs: null,
      },
      toggleMute: vi.fn(),
      togglePause: vi.fn(),
      saveConfig: vi.fn(),
      openSettings: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps result actions inside the same pill instead of expanding into a second preview surface", async () => {
    render(<OverlayWindow />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument());
    expect(invokeMock).toHaveBeenCalledWith("sync_overlay_window_visibility", { visible: true, surface: "result_actions" });

    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mute" })).not.toBeInTheDocument();
    expect(screen.queryByText("Last pass")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();

    vi.useFakeTimers();
    try {
      act(() => {
        vi.advanceTimersByTime(6000);
      });

      expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("routes overlay quick actions through the existing native commands", async () => {
    render(<OverlayWindow />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("retry_transcription_history_entry", {
      request: { id: "history-1" },
    }));

    cleanup();
    invokeMock.mockClear();

    render(<OverlayWindow />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("restore_last_transcript"));

    cleanup();
    invokeMock.mockClear();

    render(<OverlayWindow />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("insert_text_native", {
      request: {
        text: "Wir shippen das morgen.",
        source: "overlay_preview_copy",
        corrected: true,
        auto_paste: false,
      },
    }));
  });

  it("keeps the action-state pill on screen while Done dismisses it", async () => {
    render(<OverlayWindow />);

    const doneButton = await screen.findByRole("button", { name: "Done" });
    expect(screen.queryByLabelText("Audio level")).not.toBeInTheDocument();

    fireEvent.click(doneButton);

    expect(screen.queryByLabelText("Audio level")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("shows the live commit preview during processing for clipboard-only delivery", async () => {
    useRuntimeMock.mockReturnValue({
      state: {
        status: "processing",
        config: {
          model: "whisper-large-v3-turbo",
          language: "de",
          active_text_profile_id: "support",
          text_profiles: [
            {
              id: "support",
              label: "Support reply",
              prompt: "Support tone and escalation names",
              stt_hints: "status update",
              work_mode: {
                rewrite_style: "polished",
                insert_behavior: "clipboard_only",
                recovery_behavior: "standard",
              },
              curation: {
                curated: false,
                audience: "",
                summary: "",
                highlights: [],
              },
              dictionary_entries: [],
              snippet_entries: [],
            },
          ],
          curated_profiles_seeded: true,
          post_process: true,
          correction_model: "llama-3.3-70b-versatile",
          local_correction_model: "llama3.2:latest",
          filter_fillers: true,
          professionalize: false,
          provider: "groq",
          local_model: "base",
          local_profile: "local-preview-base-fast",
          local_prompt_strength: "profile",
          local_prompt_carry: false,
          local_beam_size: 1,
          local_best_of: 1,
          local_profile_prompt_settings: [],
          local_profile_decode_settings: [],
          hotkey: "ctrl+space",
          pause_hotkey: "ctrl+shift+space",
          abort_hotkey: "escape",
          activation_mode: "tap",
          overlay_position_mode: "preset",
          overlay_monitor: "primary",
          overlay_anchor: "bottom_center",
          overlay_manual_x: 0,
          overlay_manual_y: 0,
          sample_rate: 16000,
          channels: 1,
          dtype: "i16",
          audio_device: "",
          max_recording_seconds: 720,
          silence_timeout_seconds: 30,
          auto_paste: true,
          play_sounds: true,
          log_level: "info",
          temp_audio_dir: "",
          history_limit: 200,
          history_retention_days: 90,
        },
        muted: false,
        paused: false,
        lastTranscription: null,
        pendingResult: {
          provider: "groq",
          active_profile: "Support reply",
          work_mode: {
            rewrite_style: "polished",
            insert_behavior: "clipboard_only",
            recovery_behavior: "standard",
          },
          raw_text: "ähm wir shippen das morgen",
          final_text: "Wir shippen das morgen.",
          corrected: true,
          transform: {
            applied_rules: ["removed_fillers"],
            warning: null,
          },
          history: null,
          insertion: null,
          occurred_at_ms: 1716500000000,
        },
        lastResult: null,
        error: null,
        recordingStartMs: null,
      },
      toggleMute: vi.fn(),
      togglePause: vi.fn(),
      saveConfig: vi.fn(),
      openSettings: vi.fn(),
    });

    render(<OverlayWindow />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument());

    expect(screen.getByRole("button", { name: "Abort" })).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.queryByText("Last pass")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("commit_pending_transcription_preview"));

    fireEvent.click(screen.getByRole("button", { name: "Abort" }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("abort_native_session"));
  });

  it("resyncs the native overlay window when the active surface changes while the overlay stays visible", async () => {
    let pendingResult: {
      provider: string;
      active_profile: string;
      work_mode: {
        rewrite_style: string;
        insert_behavior: string;
        recovery_behavior: string;
      };
      raw_text: string;
      final_text: string;
      corrected: boolean;
      transform: {
        applied_rules: string[];
        warning: null;
      };
      history: null;
      insertion: null;
      occurred_at_ms: number;
    } | null = null;

    let runtimeValue: any = {
      state: {
        status: "recording",
        config: {
          model: "whisper-large-v3-turbo",
          language: "de",
          active_text_profile_id: "support",
          text_profiles: [
            {
              id: "support",
              label: "Support reply",
              prompt: "Support tone and escalation names",
              stt_hints: "status update",
              work_mode: {
                rewrite_style: "polished",
                insert_behavior: "clipboard_only",
                recovery_behavior: "standard",
              },
              curation: {
                curated: false,
                audience: "",
                summary: "",
                highlights: [],
              },
              dictionary_entries: [],
              snippet_entries: [],
            },
          ],
          curated_profiles_seeded: true,
          post_process: true,
          correction_model: "llama-3.3-70b-versatile",
          local_correction_model: "llama3.2:latest",
          filter_fillers: true,
          professionalize: false,
          provider: "groq",
          local_model: "base",
          local_profile: "local-preview-base-fast",
          local_prompt_strength: "profile",
          local_prompt_carry: false,
          local_beam_size: 1,
          local_best_of: 1,
          local_profile_prompt_settings: [],
          local_profile_decode_settings: [],
          hotkey: "ctrl+space",
          pause_hotkey: "ctrl+shift+space",
          abort_hotkey: "escape",
          activation_mode: "tap",
          overlay_position_mode: "preset",
          overlay_monitor: "primary",
          overlay_anchor: "bottom_center",
          overlay_manual_x: 0,
          overlay_manual_y: 0,
          sample_rate: 16000,
          channels: 1,
          dtype: "i16",
          audio_device: "",
          max_recording_seconds: 720,
          silence_timeout_seconds: 30,
          auto_paste: true,
          play_sounds: true,
          log_level: "info",
          temp_audio_dir: "",
          history_limit: 200,
          history_retention_days: 90,
        },
        muted: false,
        paused: false,
        lastTranscription: null,
        pendingResult,
        lastResult: null,
        error: null,
        recordingStartMs: 1716500000000,
      },
      toggleMute: vi.fn(),
      togglePause: vi.fn(),
      saveConfig: vi.fn(),
      openSettings: vi.fn(),
    };

    useRuntimeMock.mockImplementation(() => runtimeValue);

    const { rerender } = render(<OverlayWindow />);

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("sync_overlay_window_visibility", {
      visible: true,
      surface: "compact",
    }));

    invokeMock.mockClear();

    pendingResult = {
      provider: "groq",
      active_profile: "Support reply",
      work_mode: {
        rewrite_style: "polished",
        insert_behavior: "clipboard_only",
        recovery_behavior: "standard",
      },
      raw_text: "ähm wir shippen das morgen",
      final_text: "Wir shippen das morgen.",
      corrected: true,
      transform: {
        applied_rules: ["removed_fillers"],
        warning: null,
      },
      history: null,
      insertion: null,
      occurred_at_ms: 1716500000000,
    };

    runtimeValue = {
      ...runtimeValue,
      state: {
        ...runtimeValue.state,
        status: "processing",
        pendingResult,
      },
    };

    rerender(<OverlayWindow />);

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("sync_overlay_window_visibility", {
      visible: true,
      surface: "processing_preview",
    }));
  });

  it("persists the dragged overlay position as the remembered manual placement", async () => {
    render(<OverlayWindow />);

    await waitFor(() => expect(movedHandlers.length).toBeGreaterThan(0));
    const copyButton = await screen.findByRole("button", { name: "Copy" });
    vi.useFakeTimers();

    try {
      await act(async () => {
        fireEvent.pointerDown(copyButton, { button: 0, pointerId: 11, clientX: 20, clientY: 16 });
        fireEvent.pointerMove(window, { buttons: 1, pointerId: 11, clientX: 34, clientY: 30 });
        vi.advanceTimersByTime(500);
        movedHandlers[0]?.({ payload: { x: 480, y: 220 } });
        vi.advanceTimersByTime(220);
        await Promise.resolve();
      });

      expect(invokeMock).toHaveBeenCalledWith("remember_overlay_manual_position", {
        x: 480,
        y: 220,
        surface: "result_actions",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("converts moved physical positions with the window scale factor before persisting them", async () => {
    scaleFactorMock.mockResolvedValue(2);
    render(<OverlayWindow />);

    await waitFor(() => expect(movedHandlers.length).toBeGreaterThan(0));
    const copyButton = await screen.findByRole("button", { name: "Copy" });
    vi.useFakeTimers();

    try {
      await act(async () => {
        fireEvent.pointerDown(copyButton, { button: 0, pointerId: 19, clientX: 12, clientY: 18 });
        fireEvent.pointerMove(window, { buttons: 1, pointerId: 19, clientX: 26, clientY: 34 });
        vi.advanceTimersByTime(500);
        movedHandlers[0]?.({ payload: { x: -640, y: 240 } });
        vi.advanceTimersByTime(220);
        await Promise.resolve();
      });

      expect(invokeMock).toHaveBeenCalledWith("remember_overlay_manual_position", {
        x: -320,
        y: 120,
        surface: "result_actions",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores moved events that were not caused by an active user drag", async () => {
    render(<OverlayWindow />);

    await waitFor(() => expect(movedHandlers.length).toBeGreaterThan(0));
    vi.useFakeTimers();

    try {
      await act(async () => {
        movedHandlers[0]?.({ payload: { x: 520, y: 260 } });
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      expect(invokeMock).not.toHaveBeenCalledWith("remember_overlay_manual_position", expect.anything());
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops persisting moved events once the native drag session has finished", async () => {
    render(<OverlayWindow />);

    await waitFor(() => expect(movedHandlers.length).toBeGreaterThan(0));
    const copyButton = await screen.findByRole("button", { name: "Copy" });
    vi.useFakeTimers();

    try {
      await act(async () => {
        fireEvent.pointerDown(copyButton, { button: 0, pointerId: 23, clientX: 18, clientY: 20 });
        fireEvent.pointerMove(window, { buttons: 1, pointerId: 23, clientX: 32, clientY: 36 });
        await Promise.resolve();
      });

      expect(startDraggingMock).toHaveBeenCalledTimes(1);

      fireEvent.pointerUp(window, { pointerId: 23 });

      invokeMock.mockClear();

      await act(async () => {
        movedHandlers[0]?.({ payload: { x: 806, y: 1365 } });
        vi.advanceTimersByTime(220);
        await Promise.resolve();
      });

      expect(invokeMock).not.toHaveBeenCalledWith("remember_overlay_manual_position", expect.anything());
    } finally {
      vi.useRealTimers();
    }
  });

  it("starts dragging only after pointer movement and does not turn a dragged button press into a click", async () => {
    render(<OverlayWindow />);

    const copyButton = await screen.findByRole("button", { name: "Copy" });

    fireEvent.pointerDown(copyButton, { button: 0, pointerId: 7, clientX: 10, clientY: 12 });
    fireEvent.pointerMove(window, { buttons: 1, pointerId: 7, clientX: 22, clientY: 24 });

    await waitFor(() => expect(startDraggingMock).toHaveBeenCalledTimes(1));
    fireEvent.pointerUp(window, { pointerId: 7 });

    fireEvent.click(copyButton);

    expect(invokeMock.mock.calls.some(([command]) => command === "insert_text_native")).toBe(false);
  });

  it("keeps suppressing button clicks until a long drag actually ends", async () => {
    render(<OverlayWindow />);

    const copyButton = await screen.findByRole("button", { name: "Copy" });

    fireEvent.pointerDown(copyButton, { button: 0, pointerId: 13, clientX: 14, clientY: 18 });
    fireEvent.pointerMove(window, { buttons: 1, pointerId: 13, clientX: 30, clientY: 34 });

    expect(startDraggingMock).toHaveBeenCalledTimes(1);
    vi.useFakeTimers();

    try {
      act(() => {
        vi.advanceTimersByTime(1200);
      });

      fireEvent.pointerUp(window, { pointerId: 13 });

      fireEvent.click(copyButton);

      expect(invokeMock.mock.calls.some(([command]) => command === "insert_text_native")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("maps low speech levels to visibly taller waveform bars while recording", async () => {
    useRuntimeMock.mockReturnValue({
      state: {
        status: "recording",
        config: {
          model: "whisper-large-v3-turbo",
          language: "de",
          active_text_profile_id: "support",
          text_profiles: [
            {
              id: "support",
              label: "Support reply",
              prompt: "Support tone and escalation names",
              stt_hints: "status update",
              work_mode: {
                rewrite_style: "polished",
                insert_behavior: "clipboard_only",
                recovery_behavior: "standard",
              },
              curation: {
                curated: false,
                audience: "",
                summary: "",
                highlights: [],
              },
              dictionary_entries: [],
              snippet_entries: [],
            },
          ],
          curated_profiles_seeded: true,
          post_process: true,
          correction_model: "llama-3.3-70b-versatile",
          local_correction_model: "llama3.2:latest",
          filter_fillers: true,
          professionalize: false,
          provider: "groq",
          local_model: "base",
          local_profile: "local-preview-base-fast",
          local_prompt_strength: "profile",
          local_prompt_carry: false,
          local_beam_size: 1,
          local_best_of: 1,
          local_profile_prompt_settings: [],
          local_profile_decode_settings: [],
          hotkey: "ctrl+space",
          pause_hotkey: "ctrl+shift+space",
          abort_hotkey: "escape",
          activation_mode: "tap",
          overlay_position_mode: "preset",
          overlay_monitor: "primary",
          overlay_anchor: "bottom_center",
          overlay_manual_x: 0,
          overlay_manual_y: 0,
          sample_rate: 16000,
          channels: 1,
          dtype: "i16",
          audio_device: "",
          max_recording_seconds: 720,
          silence_timeout_seconds: 30,
          auto_paste: true,
          play_sounds: true,
          log_level: "info",
          temp_audio_dir: "",
          history_limit: 200,
          history_retention_days: 90,
        },
        muted: false,
        paused: false,
        lastTranscription: null,
        pendingResult: null,
        lastResult: null,
        error: null,
        recordingStartMs: null,
      },
      toggleMute: vi.fn(),
      togglePause: vi.fn(),
      saveConfig: vi.fn(),
      openSettings: vi.fn(),
    });

    const { container } = render(<OverlayWindow />);

    await waitFor(() => expect(screen.getByLabelText("Audio level")).toBeInTheDocument());

    act(() => {
      runtimeEventHandlers[0]?.({
        payload: {
          event: "audio_level",
          level: 0.04,
          rms: 0.03,
          waveform: [0.01, 0.02, 0.03, 0.05, 0.08, 0.12, 0.08, 0.05, 0.03, 0.02, 0.01],
        },
      });
    });

    const heights = Array.from(container.querySelectorAll(".bar"))
      .map((bar) => Number.parseFloat((bar as HTMLElement).style.height || "0"));

    expect(Math.max(...heights)).toBeGreaterThanOrEqual(20);
  });

  it("keeps near-idle room noise close to the calm idle waveform", async () => {
    useRuntimeMock.mockReturnValue({
      state: {
        status: "recording",
        config: {
          model: "whisper-large-v3-turbo",
          language: "de",
          active_text_profile_id: "support",
          text_profiles: [
            {
              id: "support",
              label: "Support reply",
              prompt: "Support tone and escalation names",
              stt_hints: "status update",
              work_mode: {
                rewrite_style: "polished",
                insert_behavior: "clipboard_only",
                recovery_behavior: "standard",
              },
              curation: {
                curated: false,
                audience: "",
                summary: "",
                highlights: [],
              },
              dictionary_entries: [],
              snippet_entries: [],
            },
          ],
          curated_profiles_seeded: true,
          post_process: true,
          correction_model: "llama-3.3-70b-versatile",
          local_correction_model: "llama3.2:latest",
          filter_fillers: true,
          professionalize: false,
          provider: "groq",
          local_model: "base",
          local_profile: "local-preview-base-fast",
          local_prompt_strength: "profile",
          local_prompt_carry: false,
          local_beam_size: 1,
          local_best_of: 1,
          local_profile_prompt_settings: [],
          local_profile_decode_settings: [],
          hotkey: "ctrl+space",
          pause_hotkey: "ctrl+shift+space",
          abort_hotkey: "escape",
          activation_mode: "tap",
          overlay_position_mode: "preset",
          overlay_monitor: "primary",
          overlay_anchor: "bottom_center",
          overlay_manual_x: 0,
          overlay_manual_y: 0,
          sample_rate: 16000,
          channels: 1,
          dtype: "i16",
          audio_device: "",
          max_recording_seconds: 720,
          silence_timeout_seconds: 30,
          auto_paste: true,
          play_sounds: true,
          log_level: "info",
          temp_audio_dir: "",
          history_limit: 200,
          history_retention_days: 90,
        },
        muted: false,
        paused: false,
        lastTranscription: null,
        pendingResult: null,
        lastResult: null,
        error: null,
        recordingStartMs: null,
      },
      toggleMute: vi.fn(),
      togglePause: vi.fn(),
      saveConfig: vi.fn(),
      openSettings: vi.fn(),
    });

    const { container } = render(<OverlayWindow />);

    await waitFor(() => expect(screen.getByLabelText("Audio level")).toBeInTheDocument());

    act(() => {
      runtimeEventHandlers[0]?.({
        payload: {
          event: "audio_level",
          level: 0.01,
          rms: 0.008,
          waveform: [0.006, 0.008, 0.01, 0.012, 0.014, 0.016, 0.014, 0.012, 0.01, 0.008, 0.006],
        },
      });
    });

    const heights = Array.from(container.querySelectorAll(".bar"))
      .map((bar) => Number.parseFloat((bar as HTMLElement).style.height || "0"));

    expect(Math.max(...heights)).toBeLessThanOrEqual(12);
  });
});