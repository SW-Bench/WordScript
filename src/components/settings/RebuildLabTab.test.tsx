import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RebuildLabTab } from "./RebuildLabTab";

let v1SliceState: {
  status: {
    stage: "idle" | "capturing" | "processing" | "completed" | "error";
    session_id: string | null;
    active_trigger: string | null;
    preferred_provider: string;
    architecture_mode: string;
    last_transcript: string | null;
    last_insert_target: string | null;
    last_error: string | null;
    capabilities: {
      cloud_transcription: boolean;
      local_transcription: boolean;
      insertion_fallback: boolean;
      typed_contracts: boolean;
      rebuild_lab: boolean;
    };
    next_milestones: string[];
  } | null;
  result: {
    status: {
      stage: "idle" | "capturing" | "processing" | "completed" | "error";
      session_id: string | null;
      active_trigger: string | null;
      preferred_provider: string;
      architecture_mode: string;
      last_transcript: string | null;
      last_insert_target: string | null;
      last_error: string | null;
      capabilities: {
        cloud_transcription: boolean;
        local_transcription: boolean;
        insertion_fallback: boolean;
        typed_contracts: boolean;
        rebuild_lab: boolean;
      };
      next_milestones: string[];
    };
    transcript: {
      raw_text: string;
      final_text: string;
      provider_mode: string;
      profile: string;
      applied_rules: string[];
    };
    insertion: {
      target: string;
      mode: "in_app_preview" | "clipboard_fallback_planned";
      fallback: string;
    };
  } | null;
  error: string | null;
  isPending: boolean;
  refresh: ReturnType<typeof vi.fn>;
  startCapture: ReturnType<typeof vi.fn>;
  completeCapture: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
};

let runtimeLogState: {
  entries: string[];
  error: string | null;
  isLoading: boolean;
  refresh: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
};

vi.mock("../../hooks/useV1Slice", () => ({
  useV1Slice: () => v1SliceState,
}));

vi.mock("../../hooks/useRuntimeLogs", () => ({
  useRuntimeLogs: () => runtimeLogState,
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  const baseStatus = {
    stage: "completed" as const,
    session_id: "slice-1",
    active_trigger: "diagnostic_demo",
    preferred_provider: "cloud-fast",
    architecture_mode: "native-rebuild-slice",
    last_transcript: "Original transcript",
    last_insert_target: "editor_preview",
    last_error: null,
    capabilities: {
      cloud_transcription: true,
      local_transcription: false,
      insertion_fallback: true,
      typed_contracts: true,
      rebuild_lab: true,
    },
    next_milestones: [],
  };

  v1SliceState = {
    status: baseStatus,
    result: {
      status: baseStatus,
      transcript: {
        raw_text: "ähm wir shippen das morgen",
        final_text: "Wir shippen das morgen.",
        provider_mode: "cloud-fast",
        profile: "developer",
        applied_rules: ["correction_guardrail_fallback", "removed_fillers"],
      },
      insertion: {
        target: "editor_preview",
        mode: "in_app_preview",
        fallback: "clipboard_fallback_planned",
      },
    },
    error: null,
    isPending: false,
    refresh: vi.fn(),
    startCapture: vi.fn(),
    completeCapture: vi.fn(),
    reset: vi.fn(),
  };

  runtimeLogState = {
    entries: [],
    error: null,
    isLoading: false,
    refresh: vi.fn(),
    clear: vi.fn(),
  };
});

describe("RebuildLabTab", () => {
  it("renders friendly explanations for transcript rule ids", () => {
    render(<RebuildLabTab isActive />);

    expect(screen.getAllByText("Guardrail kept original transcript")).toHaveLength(2);
    expect(screen.getByText(/the model returned a rewrite, but the runtime kept the safer original transcript/i)).toBeInTheDocument();
    expect(screen.getAllByText("Removed filler words")).toHaveLength(2);
    expect(screen.getByText(/common spoken fillers such as ähm, äh or um were removed/i)).toBeInTheDocument();
    expect(screen.queryByText("correction_guardrail_fallback")).not.toBeInTheDocument();
  });

  it("keeps raw runtime logs visible and adds decoded rule hints separately", () => {
    if (v1SliceState.result) {
      v1SliceState.result = {
        ...v1SliceState.result,
        transcript: {
          ...v1SliceState.result.transcript,
          applied_rules: [],
        },
      };
    }

    runtimeLogState.entries = [
      "[WordScript] Native pipeline transform done elapsed_ms=812 corrected=false output_len=26 rules=correction_guardrail_fallback,removed_fillers",
    ];

    render(<RebuildLabTab isActive />);

    expect(
      screen.getByDisplayValue(
        "[WordScript] Native pipeline transform done elapsed_ms=812 corrected=false output_len=26 rules=correction_guardrail_fallback,removed_fillers",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Decoded transform rules")).toBeInTheDocument();
    expect(screen.getByText("Original transcript kept in this pass")).toBeInTheDocument();
    expect(screen.getAllByText("Guardrail kept original transcript")).toHaveLength(2);
    expect(screen.getAllByText("Removed filler words")).toHaveLength(2);
  });
});