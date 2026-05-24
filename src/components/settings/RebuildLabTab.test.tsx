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
    runtime_contract: {
      provider: string;
      provider_profile: string;
      model: string;
      work_mode: {
        rewrite_style: "verbatim" | "clean" | "polished";
        insert_behavior: "auto_paste" | "clipboard_only";
        recovery_behavior: "standard";
      };
      provider_status: {
        ready: boolean;
        detail: string | null;
        local_setup: {
          readiness: "ready" | "setup_required";
          runner_ready: boolean;
          model_ready: boolean;
          chat_ready: boolean;
          issue_code: string | null;
          resolved_runner: string | null;
          resolved_model: string | null;
          resolved_chat_base_url: string | null;
          resolved_chat_model: string | null;
          guidance: string;
        } | null;
      };
      capture_status: {
        is_recording: boolean;
        muted: boolean;
        paused: boolean;
        device_name: string | null;
        silence_seconds: number;
      };
      local_preview: {
        provider_profile: string;
        model: string;
        prompt_strength: string;
        prompt_carry: boolean;
        beam_size: number;
        best_of: number;
      } | null;
    };
    last_transcript: string | null;
    last_insert_target: string | null;
    last_error: string | null;
    pipeline: Array<{
      step: "capture" | "provider" | "transform" | "insert";
      state: "idle" | "running" | "completed" | "failed" | "skipped";
      duration_ms: number | null;
      error_code: string | null;
      detail: string | null;
    }>;
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
      runtime_contract: {
        provider: string;
        provider_profile: string;
        model: string;
        work_mode: {
          rewrite_style: "verbatim" | "clean" | "polished";
          insert_behavior: "auto_paste" | "clipboard_only";
          recovery_behavior: "standard";
        };
        provider_status: {
          ready: boolean;
          detail: string | null;
          local_setup: {
            readiness: "ready" | "setup_required";
            runner_ready: boolean;
            model_ready: boolean;
            chat_ready: boolean;
            issue_code: string | null;
            resolved_runner: string | null;
            resolved_model: string | null;
            resolved_chat_base_url: string | null;
            resolved_chat_model: string | null;
            guidance: string;
          } | null;
        };
        capture_status: {
          is_recording: boolean;
          muted: boolean;
          paused: boolean;
          device_name: string | null;
          silence_seconds: number;
        };
        local_preview: {
          provider_profile: string;
          model: string;
          prompt_strength: string;
          prompt_carry: boolean;
          beam_size: number;
          best_of: number;
        } | null;
      };
      last_transcript: string | null;
      last_insert_target: string | null;
      last_error: string | null;
      pipeline: Array<{
        step: "capture" | "provider" | "transform" | "insert";
        state: "idle" | "running" | "completed" | "failed" | "skipped";
        duration_ms: number | null;
        error_code: string | null;
        detail: string | null;
      }>;
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
  const baseStatus: NonNullable<typeof v1SliceState.status> = {
    stage: "completed" as const,
    session_id: "slice-1",
    active_trigger: "diagnostic_demo",
    preferred_provider: "cloud-fast",
    architecture_mode: "native-rebuild-slice",
    runtime_contract: {
      provider: "groq",
      provider_profile: "cloud-fast",
      model: "whisper-large-v3-turbo",
      work_mode: {
        rewrite_style: "clean",
        insert_behavior: "auto_paste",
        recovery_behavior: "standard",
      },
      provider_status: {
        ready: true,
        detail: "API key loaded",
        local_setup: null,
      },
      capture_status: {
        is_recording: false,
        muted: false,
        paused: false,
        device_name: null,
        silence_seconds: 0,
      },
      local_preview: null,
    },
    last_transcript: "Original transcript",
    last_insert_target: "editor_preview",
    last_error: null,
    pipeline: [
      {
        step: "capture" as const,
        state: "completed" as const,
        duration_ms: 18,
        error_code: null,
        detail: "Capture finished and handed text to the provider preview stage.",
      },
      {
        step: "provider" as const,
        state: "completed" as const,
        duration_ms: 4,
        error_code: null,
        detail: "Simulated cloud-fast transcription response prepared.",
      },
      {
        step: "transform" as const,
        state: "completed" as const,
        duration_ms: 3,
        error_code: null,
        detail: "Applied 2 runtime rules to the transcript.",
      },
      {
        step: "insert" as const,
        state: "completed" as const,
        duration_ms: 1,
        error_code: null,
        detail: "Planned InAppPreview toward editor_preview with fallback clipboard_fallback_planned.",
      },
    ],
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
        work_mode: {
          rewrite_style: "clean",
          insert_behavior: "auto_paste",
          recovery_behavior: "standard",
        },
        provider_profile: null,
        local_prompt_strength: null,
        local_prompt_carry: null,
        local_beam_size: null,
        local_best_of: null,
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
        recovery_action: "none",
        recovery_message: "Inserted at the cursor. No recovery action is needed.",
        clipboard_restore: "scheduled",
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

    expect(screen.getByText("Diagnostics Preview")).toBeInTheDocument();
    expect(screen.getByText("Transcription History")).toBeInTheDocument();
    expect(screen.getByText(/this preview belongs to the active diagnostics lane/i)).toBeInTheDocument();
    expect(screen.getAllByText(/insert plan/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/history is stored natively and survives the diagnostics ui/i)).toBeInTheDocument();
    expect(screen.getByText("History store")).toBeInTheDocument();
    expect(screen.getByText(/capture · completed/i)).toBeInTheDocument();
    expect(screen.getByText(/provider · completed/i)).toBeInTheDocument();
    expect(screen.getByText(/applied 2 runtime rules to the transcript/i)).toBeInTheDocument();
    expect(screen.getByText(/wordscript-history\.json/i)).toBeInTheDocument();
    expect(screen.getByLabelText("History provider filter")).toBeInTheDocument();
    expect(screen.getByLabelText("History profile filter")).toBeInTheDocument();
    expect(screen.getByLabelText("History retention window")).toHaveValue("90");
    expect(screen.getByRole("button", { name: /export history/i })).toBeEnabled();
    expect(screen.getByText(/completed · groq/i)).toBeInTheDocument();
    expect(screen.getAllByText(/raw transcript/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/final transcript/i)).toBeInTheDocument();
    expect(screen.getByText(/no recovery action needed/i)).toBeInTheDocument();
    expect(screen.getAllByText(/previous clipboard restore scheduled/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 history entries match the current filters/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry history entry history-1/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /delete history entry history-1/i })).toBeEnabled();
  });

  it("surfaces local decode and prompt controls in diagnostics and history", () => {
    if (v1SliceState.status) {
      v1SliceState.status = {
        ...v1SliceState.status,
        preferred_provider: "local-preview-base-quality",
        runtime_contract: {
          provider: "local_preview",
          provider_profile: "local-preview-base-quality",
          model: "base",
          work_mode: {
            rewrite_style: "clean",
            insert_behavior: "auto_paste",
            recovery_behavior: "standard",
          },
          provider_status: {
            ready: true,
            detail: "/usr/bin/whisper-cli · ggml-base.bin",
            local_setup: {
              readiness: "ready",
              runner_ready: true,
              model_ready: true,
              chat_ready: true,
              issue_code: null,
              resolved_runner: "/usr/bin/whisper-cli",
              resolved_model: "/models/ggml-base.bin",
              resolved_chat_base_url: "http://127.0.0.1:11434",
              resolved_chat_model: "llama3.2:latest",
              guidance: "Local runtime is ready.",
            },
          },
          capture_status: {
            is_recording: false,
            muted: false,
            paused: false,
            device_name: "Built-in Mic",
            silence_seconds: 0,
          },
          local_preview: {
            provider_profile: "local-preview-base-quality",
            model: "base",
            prompt_strength: "profile_and_terms",
            prompt_carry: true,
            beam_size: 5,
            best_of: 5,
          },
        },
        capabilities: {
          ...v1SliceState.status.capabilities,
          cloud_transcription: false,
          local_transcription: true,
        },
      };
    }
    if (v1SliceState.result) {
      v1SliceState.result = {
        ...v1SliceState.result,
        status: v1SliceState.status!,
        transcript: {
          ...v1SliceState.result.transcript,
          provider_mode: "local-preview-base-quality",
        },
      };
    }
    transcriptionHistoryState.entries = [
      {
        ...transcriptionHistoryState.entries[0],
        provider: "local_preview",
        model: "base",
        provider_profile: "local-preview-base-quality",
        local_prompt_strength: "profile_and_terms",
        local_prompt_carry: true,
        local_beam_size: 5,
        local_best_of: 5,
      },
    ];

    render(
      <RebuildLabTab
        isActive
        config={createAppConfig({
          provider: "local_preview",
          local_model: "base",
          local_profile: "local-preview-base-quality",
          local_prompt_strength: "profile_and_terms",
          local_prompt_carry: true,
          local_beam_size: 5,
          local_best_of: 5,
        })}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Local Runtime Contract")).toBeInTheDocument();
    expect(screen.getAllByText("local-preview-base-quality").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Prompt bias profile + terms").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Carry initial prompt").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Beam 5").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Best of 5").length).toBeGreaterThan(0);
    expect(screen.getByText("/usr/bin/whisper-cli")).toBeInTheDocument();
    expect(screen.getByText("/models/ggml-base.bin")).toBeInTheDocument();
    expect(screen.getByText("Built-in Mic")).toBeInTheDocument();
  });

  it("shows when the unsaved local draft differs from the native runtime contract", () => {
    if (v1SliceState.status) {
      v1SliceState.status = {
        ...v1SliceState.status,
        preferred_provider: "local-preview-base-fast",
        runtime_contract: {
          provider: "local_preview",
          provider_profile: "local-preview-base-fast",
          model: "base",
          work_mode: {
            rewrite_style: "clean",
            insert_behavior: "auto_paste",
            recovery_behavior: "standard",
          },
          provider_status: {
            ready: false,
            detail: "Missing local setup",
            local_setup: {
              readiness: "setup_required",
              runner_ready: false,
              model_ready: false,
              chat_ready: false,
              issue_code: "missing_runner_and_model",
              resolved_runner: null,
              resolved_model: null,
              resolved_chat_base_url: null,
              resolved_chat_model: null,
              guidance: "Install whisper-cli and configure a local model.",
            },
          },
          capture_status: {
            is_recording: false,
            muted: false,
            paused: false,
            device_name: null,
            silence_seconds: 0,
          },
          local_preview: {
            provider_profile: "local-preview-base-fast",
            model: "base",
            prompt_strength: "profile",
            prompt_carry: false,
            beam_size: 1,
            best_of: 1,
          },
        },
      };
    }

    render(
      <RebuildLabTab
        isActive
        config={createAppConfig({
          provider: "local_preview",
          local_model: "base",
          local_profile: "local-preview-base-quality",
          local_prompt_strength: "profile_and_terms",
          local_prompt_carry: true,
          local_beam_size: 5,
          local_best_of: 5,
          local_profile_decode_settings: [
            {
              profile_id: "local-preview-base-fast",
              beam_size: 1,
              best_of: 1,
            },
            {
              profile_id: "local-preview-base-quality",
              beam_size: 5,
              best_of: 5,
            },
          ],
        })}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/unsaved draft differs from runtime/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/profile runtime local-preview-base-fast differs from unsaved draft local-preview-base-quality/i)).toBeInTheDocument();
    expect(screen.getByText(/beam size runtime 1 differs from unsaved draft 5/i)).toBeInTheDocument();
  });
});