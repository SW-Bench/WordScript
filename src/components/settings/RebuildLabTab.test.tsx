import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppConfig } from "../../test/factories";
import type { TranscriptionHistoryEntry } from "../../types/history";
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

let transcriptionHistoryState: {
  entries: TranscriptionHistoryEntry[];
  storagePath: string | null;
  error: string | null;
  isLoading: boolean;
  refresh: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  retry: ReturnType<typeof vi.fn>;
  exportEntries: ReturnType<typeof vi.fn>;
};

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(),
}));

vi.mock("../../hooks/useV1Slice", () => ({
  useV1Slice: () => v1SliceState,
}));

vi.mock("../../hooks/useRuntimeLogs", () => ({
  useRuntimeLogs: () => runtimeLogState,
}));

vi.mock("../../hooks/useTranscriptionHistory", () => ({
  useTranscriptionHistory: () => transcriptionHistoryState,
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

  transcriptionHistoryState = {
    entries: [
      {
        id: "history-1",
        created_at_ms: Date.UTC(2026, 4, 13, 10, 15),
        status: "completed",
        source: "native_pipeline",
        retry_of: null,
        provider: "groq",
        model: "whisper-large-v3-turbo",
        language: "de",
        active_profile: null,
        raw_transcript: "ähm wir shippen das morgen",
        transformed_transcript: "Wir shippen das morgen.",
        corrected: false,
        applied_rules: ["removed_fillers"],
        transform_warning: null,
        insert_mode: "direct_paste",
        active_driver: "xdotool",
        pasted: true,
        fallback_available: false,
        fallback_reason: null,
        error: null,
      },
    ],
    storagePath: "/tmp/wordscript-history.json",
    error: null,
    isLoading: false,
    refresh: vi.fn(),
    clear: vi.fn(),
    remove: vi.fn(),
    retry: vi.fn(),
    exportEntries: vi.fn(),
  };
});

describe("RebuildLabTab", () => {
  it("renders friendly explanations for transcript rule ids", () => {
    render(<RebuildLabTab isActive config={createAppConfig()} onChange={vi.fn()} />);

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

    render(<RebuildLabTab isActive config={createAppConfig()} onChange={vi.fn()} />);

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

  it("renders native transcription history separately from runtime logs", () => {
    render(<RebuildLabTab isActive config={createAppConfig()} onChange={vi.fn()} />);

    expect(screen.getByText("Transcription History")).toBeInTheDocument();
    expect(screen.getByText(/this preview belongs to the active diagnostics lane/i)).toBeInTheDocument();
    expect(screen.getByText(/history is stored natively and survives the diagnostics ui/i)).toBeInTheDocument();
    expect(screen.getByText("History store")).toBeInTheDocument();
    expect(screen.getByText(/wordscript-history\.json/i)).toBeInTheDocument();
    expect(screen.getByLabelText("History provider filter")).toBeInTheDocument();
    expect(screen.getByLabelText("History profile filter")).toBeInTheDocument();
    expect(screen.getByLabelText("History retention window")).toHaveValue("90");
    expect(screen.getByRole("button", { name: /export history/i })).toBeEnabled();
    expect(screen.getByText(/completed · groq/i)).toBeInTheDocument();
    expect(screen.getAllByText(/raw transcript/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/final transcript/i)).toBeInTheDocument();
    expect(screen.getByText(/1 history entries match the current filters/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry history entry history-1/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /delete history entry history-1/i })).toBeEnabled();
  });
});