import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppConfig } from "../../test/factories";
import { InputTab } from "./InputTab";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("./HotkeyRecorder", () => ({
  HotkeyRecorder: ({ value }: { value: string }) => <div data-testid="hotkey-recorder">{value}</div>,
}));

describe("InputTab", () => {
  beforeEach(() => {
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

  afterEach(() => {
    cleanup();
  });

  it("shows native mic selection in the input tab", async () => {
    render(<InputTab config={createAppConfig()} onChange={vi.fn()} />);

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("list_native_input_devices"));

    expect(screen.getAllByText("Trigger").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Microphone").length).toBeGreaterThan(0);
    expect(screen.getByText(/manual format: use \+ between keys/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /input device/i })).toBeInTheDocument();
    expect(screen.getAllByText(/next capture will use built-in microphone/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/mode hotkeys \(picker, cycle, per-mode\) live in modes\./i)).toBeInTheDocument();
    expect(screen.queryByText(/play sound feedback/i)).not.toBeInTheDocument();
    expect(screen.queryByText("First dictation preflight")).not.toBeInTheDocument();
    expect(screen.queryByText("Overlay placement")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /overlay placement mode/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /overlay display/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /overlay anchor/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^recovery$/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Linux Wayland")).not.toBeInTheDocument();
  });
});