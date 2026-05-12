import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AboutTab } from "./AboutTab";

const openUrlMock = vi.fn();
const invokeMock = vi.fn();
const insertionState = {
  status: {
    config: { auto_paste: true, paste_delay_ms: 220 },
    last_transcript: null,
    scratchpad_entries: [{
      id: "scratch-1",
      text: "Recovered text",
      source: "native_insert",
      created_at_ms: 1,
      corrected: false,
      insert_mode: "clipboard_fallback" as const,
      clipboard_written: true,
      paste_attempted: false,
      pasted: false,
      error: null,
    }],
    scratchpad_path: "/tmp/wordscript-scratchpad.json",
    platform: {
      platform_label: "Linux Wayland",
      support_tier: "experimental" as const,
      insert_strategy: "clipboard_fallback" as const,
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

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: (...args: unknown[]) => openUrlMock(...args),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("../../hooks/useNativeInsertion", () => ({
  useNativeInsertion: () => insertionState,
}));

describe("AboutTab", () => {
  beforeEach(() => {
    openUrlMock.mockReset();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({
      current_version: "0.2.2-alpha",
      status: "release_path_building",
      summary: "Commercial release build-up is active, but there are no published WordScript releases yet.",
      release_version: null,
      release_url: null,
      release_notes: null,
      checked_at_ms: 1,
      build_targets: [
        {
          platform: "macOS",
          artifact: "DMG packaging lane",
          state: "building",
          note: "Installer packaging and signing checks are being assembled for the commercial release path.",
        },
        {
          platform: "Windows",
          artifact: "NSIS installer lane",
          state: "building",
          note: "Cross-platform compilation is in place, while release handoff and signing policy are still being hardened.",
        },
        {
          platform: "Linux",
          artifact: "AppImage and DEB lane",
          state: "building",
          note: "Linux packaging is part of the build-up, but it should not be treated as a published channel until the first tagged release exists.",
        },
      ],
    });
  });

  it("renders release build-up status and platform diagnostics", async () => {
    const user = userEvent.setup();
    render(<AboutTab isActive />);

    expect(screen.getByText("Cross-platform release build-up")).toBeInTheDocument();
    expect(await screen.findByText(/there are no published wordscript releases yet/i)).toBeInTheDocument();
    expect(screen.getByText(/^Developer build from source$/)).toBeInTheDocument();
    expect(screen.getAllByText("npm run tauri dev")).toHaveLength(2);
    expect(screen.getByText(/first official cross-platform app release for linux, macos and windows/i)).toBeInTheDocument();
    expect(screen.getByText("No published release yet")).toBeInTheDocument();
    expect(screen.getByText(/dmg packaging lane/i)).toBeInTheDocument();
    expect(screen.getByText(/release workflow/i)).toBeInTheDocument();
    expect(screen.getByText(/today you use wordscript as a developer build from source/i)).toBeInTheDocument();
    expect(screen.getByText("Linux Wayland")).toBeInTheDocument();
    expect(screen.getByText("Experimental")).toBeInTheDocument();
    expect(screen.getByText(/clipboard fallback/i)).toBeInTheDocument();
    expect(screen.getByText(/before relying on this path/i)).toBeInTheDocument();
    expect(screen.getByText(/honest limit/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download installer/i })).not.toBeInTheDocument();
    expect(invokeMock).toHaveBeenCalledWith("check_app_update");

    await user.click(screen.getByRole("button", { name: /GitHub - SW-Bench\/WordScript/i }));
    expect(openUrlMock).toHaveBeenCalledWith("https://github.com/SW-Bench/WordScript");
  });
});