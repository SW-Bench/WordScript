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
          clipboard_written: true,
          paste_attempted: false,
          pasted: false,
          error: null,
        },
        scratchpad_entries: [],
        scratchpad_path: "/tmp/wordscript-scratchpad.json",
        platform: {
          platform_label: "Linux Wayland",
          support_tier: "experimental",
          insert_strategy: "clipboard_fallback",
          support_message: "Experimental path: WordScript tries direct paste through available Wayland/X11 helpers, then keeps clipboard and scratchpad recovery if the desktop blocks insertion.",
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
    expect(screen.getByText(/use recovery when auto-paste failed/i)).toBeInTheDocument();
    expect(screen.getByText(/0 fallback entries ready for recovery if direct insert fails/i)).toBeInTheDocument();
    expect(screen.getByText(/wordscript-scratchpad\.json/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /restore last transcript/i })).toBeEnabled();
    expect(screen.queryByText("Linux Wayland")).not.toBeInTheDocument();
  });
});