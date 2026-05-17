import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAppConfig } from "../../test/factories";
import type { NativeInsertionStatus } from "../../types/nativeInsertion";
import { InputTab } from "./InputTab";

const invokeMock = vi.fn();

let insertionState: {
  status: NativeInsertionStatus | null;
  lastRestore: null;
  error: string | null;
  isLoading: boolean;
  refresh: ReturnType<typeof vi.fn>;
  restoreLastTranscript: ReturnType<typeof vi.fn>;
  clearScratchpad: ReturnType<typeof vi.fn>;
};

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("../../hooks/useNativeInsertion", () => ({
  useNativeInsertion: () => insertionState,
}));

vi.mock("./HotkeyRecorder", () => ({
  HotkeyRecorder: ({ value }: { value: string }) => <div data-testid="hotkey-recorder">{value}</div>,
}));

describe("InputTab", () => {
  beforeEach(() => {
    insertionState = {
      status: {
        config: { auto_paste: true, paste_delay_ms: 220 },
        last_transcript: {
          id: "scratch-1",
          text: "Recovered text",
          source: "native_insert",
          created_at_ms: 1,
          corrected: false,
          insert_mode: "clipboard_fallback",
          active_driver: "arboard",
          clipboard_written: true,
          paste_attempted: false,
          pasted: false,
          fallback_reason: "wtype missing in PATH",
          error: null,
          recovery_action: "manual_paste",
          recovery_message: "Auto-paste failed, but the transcript is on the clipboard. Paste manually or use the scratchpad recovery.",
          clipboard_restore: "not_attempted",
        },
        scratchpad_entries: [],
        scratchpad_path: "/tmp/wordscript-scratchpad.json",
        platform: {
          platform_label: "Linux Wayland",
          support_tier: "experimental",
          insert_strategy: "clipboard_fallback",
          active_driver: "wl_copy",
          support_message: "Experimental path: WordScript tries direct paste through available Wayland/X11 helpers, then keeps clipboard and scratchpad recovery if the desktop blocks insertion.",
          driver_chain: [
            {
              driver: "wl_copy",
              label: "wl-copy",
              role: "clipboard",
              available: true,
              active: true,
              detail: "Preferred Wayland clipboard writer when wl-copy is installed.",
            },
            {
              driver: "wtype",
              label: "wtype",
              role: "paste",
              available: false,
              active: false,
              detail: "wtype is not available in PATH.",
            },
          ],
          prerequisites: [
            "Wayland helper tools and compositor policy decide whether synthetic paste can work at all.",
          ],
          caveats: [
            "Behavior can differ between compositors, portal setups, and XWayland fallback paths on the same distro.",
          ],
        },
      },
      lastRestore: null,
      error: null,
      isLoading: false,
      refresh: vi.fn(),
      restoreLastTranscript: vi.fn(),
      clearScratchpad: vi.fn(),
    };
    invokeMock.mockReset();
    invokeMock.mockImplementation((command: string) => {
      if (command === "list_native_input_devices") {
        return Promise.resolve([
          { name: "USB Podcast Mic", is_default: false },
          { name: "Built-in Microphone", is_default: true },
        ]);
      }

      if (command === "native_capture_status") {
        return Promise.resolve({
          is_recording: false,
          device_name: null,
          active_capture_id: null,
        });
      }

      return Promise.resolve(undefined);
    });
  });

  it("shows native mic selection and recovery controls in the input tab", async () => {
    render(<InputTab config={createAppConfig()} onChange={vi.fn()} />);

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("list_native_input_devices"));

    expect(screen.getByRole("checkbox", { name: /play sound feedback/i })).toBeChecked();
    expect(screen.getByText(/manual format: use \+ between keys/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /input device/i })).toBeInTheDocument();
    expect(screen.getByText(/next capture will use built-in microphone/i)).toBeInTheDocument();
    expect(screen.getByText(/current driver: wl-copy/i)).toBeInTheDocument();
    expect(screen.getAllByText(/wl-copy -> wtype/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/use recovery when direct insert failed/i)).toBeInTheDocument();
    expect(screen.getByText(/last recoverable transcript/i)).toBeInTheDocument();
    expect(screen.getByText(/clipboard_fallback · manual paste/i)).toBeInTheDocument();
    expect(screen.getByText(/^recovery scratchpad$/i)).toBeInTheDocument();
    expect(screen.getByText(/auto-paste failed, but the transcript is on the clipboard/i)).toBeInTheDocument();
    expect(screen.getByText(/clipboard restore not needed/i)).toBeInTheDocument();
    expect(screen.getAllByText(/wordscript-scratchpad\.json/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /restore recoverable transcript/i })).toBeEnabled();
    expect(screen.queryByText("Linux Wayland")).not.toBeInTheDocument();
  });
});