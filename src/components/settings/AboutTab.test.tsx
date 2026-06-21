import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AboutTab } from "./AboutTab";

const openUrlMock = vi.fn();
const invokeMock = vi.fn();

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: (...args: unknown[]) => openUrlMock(...args),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

describe("AboutTab", () => {
  beforeEach(() => {
    openUrlMock.mockReset();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({
      current_version: "0.2.2-alpha",
      status: "release_path_building",
      summary: "Commercial release build-up is active, but there are no published WordScript releases yet. Internal draft handoffs stay workflow-only until the first public release exists.",
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

  it("renders release build-up status for the commercial release path", async () => {
    const user = userEvent.setup();
    render(<AboutTab isActive />);

    expect(screen.getByText("Cross-platform release build-up")).toBeInTheDocument();
    expect(await screen.findByText(/there are no published wordscript releases yet/i)).toBeInTheDocument();
    expect(screen.getByText(/^Developer build from source$/)).toBeInTheDocument();
    expect(screen.getAllByText("npm run tauri dev")).toHaveLength(2);
    expect(screen.getByText(/first official cross-platform app release for linux, macos and windows/i)).toBeInTheDocument();
    expect(screen.getByText("No published release yet")).toBeInTheDocument();
    expect(screen.getByText(/internal draft release handoffs/i)).toBeInTheDocument();
    expect(screen.getByText(/dmg packaging lane/i)).toBeInTheDocument();
    expect(screen.getByText(/release workflow/i)).toBeInTheDocument();
    expect(screen.getByText(/today you use wordscript as a developer build from source/i)).toBeInTheDocument();
    expect(screen.queryByText("Linux Wayland")).not.toBeInTheDocument();
    expect(screen.queryByText("Experimental")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download installer/i })).not.toBeInTheDocument();
    expect(invokeMock).toHaveBeenCalledWith("check_app_update");

    await user.click(screen.getByRole("button", { name: /^GitHub$/i }));
    expect(openUrlMock).toHaveBeenCalledWith("https://github.com/sw-forge-org/WordScript");
  });
});