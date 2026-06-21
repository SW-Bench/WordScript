import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const invokeMock = vi.fn();
const listenMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}));

let modeEventListener: ((payload: unknown) => void) | null = null;

function emitModeEvent(payload: { mode: string; is_override: boolean; auto_detected: boolean }) {
  if (modeEventListener) {
    modeEventListener({ payload });
  }
}

async function importHook() {
    const mod = await import("./useProcessingMode");
    return mod.useProcessingMode;
}

beforeEach(() => {
  vi.resetModules();
  invokeMock.mockReset();
  listenMock.mockReset();
  listenMock.mockImplementation((channel: string, callback: (payload: unknown) => void) => {
    if (channel === "wordscript-mode-event") {
      modeEventListener = callback;
    }
    return Promise.resolve(() => {
      if (channel === "wordscript-mode-event") {
        modeEventListener = null;
      }
    });
  });
  modeEventListener = null;
});

describe("useProcessingMode", () => {
  it("returns initial mode", async () => {
    const useProcessingMode = await importHook();

    const { result } = renderHook(() => useProcessingMode("auto"));

    expect(result.current.mode).toBe("auto");
    expect(result.current.subMode).toBe("enhance");
    expect(result.current.isOverride).toBe(false);
    expect(result.current.autoDetected).toBe(false);
  });

  it("sets mode override via setModeOverride", async () => {
    invokeMock.mockResolvedValue(undefined);
    const useProcessingMode = await importHook();

    const { result } = renderHook(() => useProcessingMode("auto"));

    await act(async () => {
      await result.current.setModeOverride("agent", "expand");
    });

    expect(invokeMock).toHaveBeenCalledWith("set_processing_mode_override", { mode: "agent" });
    expect(result.current.mode).toBe("agent");
    expect(result.current.subMode).toBe("expand");
    expect(result.current.isOverride).toBe(true);
  });

  it("clears override via clearOverride", async () => {
    invokeMock.mockResolvedValue(undefined);
    const useProcessingMode = await importHook();

    const { result } = renderHook(() => useProcessingMode("auto"));

    await act(async () => {
      await result.current.setModeOverride("rewrite");
    });

    expect(result.current.isOverride).toBe(true);

    await act(async () => {
      await result.current.clearOverride();
    });

    expect(invokeMock).toHaveBeenCalledWith("clear_processing_mode_override");
    expect(result.current.isOverride).toBe(false);
  });

  it("detects workspace context", async () => {
    const mockContext = {
      app_name: "Code",
      bundle_id: "com.microsoft.VSCode",
      category: "ide",
      window_title: "src/types/ipc.ts — WordScript",
    };
    invokeMock.mockResolvedValue(mockContext);
    const useProcessingMode = await importHook();

    const { result } = renderHook(() => useProcessingMode("auto"));

    let context: unknown = null;
    await act(async () => {
      context = await result.current.detectWorkspaceContext();
    });

    expect(invokeMock).toHaveBeenCalledWith("get_workspace_context");
    expect(context).toEqual(mockContext);
    expect(result.current.workspaceContext).toEqual(mockContext);
  });

  it("handles workspace context detection failure gracefully", async () => {
    invokeMock.mockRejectedValue(new Error("Not implemented"));
    const useProcessingMode = await importHook();

    const { result } = renderHook(() => useProcessingMode("auto"));

    let context: unknown = "not called";
    await act(async () => {
      context = await result.current.detectWorkspaceContext();
    });

    expect(context).toBeNull();
    expect(result.current.workspaceContext).toBeNull();
  });

  it("listens for mode-change events from Rust", async () => {
    const useProcessingMode = await importHook();

    const { result } = renderHook(() => useProcessingMode("auto"));

    await act(async () => {
      emitModeEvent({ mode: "prompt_enhance", is_override: false, auto_detected: true });
    });

    await waitFor(() => {
      expect(result.current.mode).toBe("prompt_enhance");
      expect(result.current.autoDetected).toBe(true);
      expect(result.current.isOverride).toBe(false);
    });
  });
});