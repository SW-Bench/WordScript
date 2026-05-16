import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppConfig } from "../../test/factories";
import { ApiModelsTab } from "./ApiModelsTab";

const openUrlMock = vi.fn();
const revealItemInDirMock = vi.fn();
const invokeMock = vi.fn();

const groqProviderState = {
  status: {
    provider: "groq",
    default_profile: "cloud-fast",
    credential: {
      provider: "groq",
      configured: false,
      storage: "os_secret_store",
      key_preview: null,
    },
    profiles: [
      {
        id: "cloud-fast",
        provider: "groq",
        model: "whisper-large-v3-turbo",
        label: "Groq fast multilingual transcription",
        default: true,
        requires_api_key: true,
      },
    ],
  },
  isLoading: false,
  error: null,
  lastValidation: null,
  saveApiKey: vi.fn(),
  clearApiKey: vi.fn(),
  validateApiKey: vi.fn(),
};

const localPreviewProviderState = {
  status: {
    provider: "local_preview",
    default_profile: "local-preview-base",
    credential: {
      provider: "local_preview",
      configured: false,
      storage: "external_cli",
      key_preview: "install whisper-cli and set WORDSCRIPT_LOCAL_MODEL_PATH or WORDSCRIPT_LOCAL_MODEL_DIR",
    },
    profiles: [
      {
        id: "local-preview-base",
        provider: "local_preview",
        model: "base",
        label: "Local preview base model (external whisper-cli)",
        default: true,
        requires_api_key: false,
      },
    ],
  },
  isLoading: false,
  error: null,
  lastValidation: null,
  saveApiKey: vi.fn(),
  clearApiKey: vi.fn(),
  validateApiKey: vi.fn(),
};

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  openUrlMock.mockReset();
  revealItemInDirMock.mockReset();
  invokeMock.mockReset();
  invokeMock.mockImplementation(async (command: string) => {
    if (command === "app_config_file_path") {
      return "/tmp/wordscript/config.json";
    }

    throw new Error(`Unexpected invoke command: ${command}`);
  });
  groqProviderState.status = {
    provider: "groq",
    default_profile: "cloud-fast",
    credential: {
      provider: "groq",
      configured: false,
      storage: "os_secret_store",
      key_preview: null,
    },
    profiles: [
      {
        id: "cloud-fast",
        provider: "groq",
        model: "whisper-large-v3-turbo",
        label: "Groq fast multilingual transcription",
        default: true,
        requires_api_key: true,
      },
    ],
  };
  groqProviderState.isLoading = false;
  groqProviderState.error = null;
  groqProviderState.lastValidation = null;
  groqProviderState.saveApiKey = vi.fn();
  groqProviderState.clearApiKey = vi.fn();
  groqProviderState.validateApiKey = vi.fn();
  localPreviewProviderState.status = {
    provider: "local_preview",
    default_profile: "local-preview-base",
    credential: {
      provider: "local_preview",
      configured: false,
      storage: "external_cli",
      key_preview: "install whisper-cli and set WORDSCRIPT_LOCAL_MODEL_PATH or WORDSCRIPT_LOCAL_MODEL_DIR",
    },
    profiles: [
      {
        id: "local-preview-base",
        provider: "local_preview",
        model: "base",
        label: "Local preview base model (external whisper-cli)",
        default: true,
        requires_api_key: false,
      },
    ],
  };
  localPreviewProviderState.isLoading = false;
  localPreviewProviderState.error = null;
  localPreviewProviderState.lastValidation = null;
  localPreviewProviderState.saveApiKey = vi.fn();
  localPreviewProviderState.clearApiKey = vi.fn();
  localPreviewProviderState.validateApiKey = vi.fn();
});

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: (...args: unknown[]) => openUrlMock(...args),
  revealItemInDir: (...args: unknown[]) => revealItemInDirMock(...args),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("../../hooks/useProvider", () => ({
  useProvider: (providerId: string) => providerId === "local_preview" ? localPreviewProviderState : groqProviderState,
}));

describe("ApiModelsTab", () => {
  it("keeps authentication compact and reveals the config file in the system file manager", async () => {
    render(<ApiModelsTab config={createAppConfig()} onChange={vi.fn()} onOpenDiagnostics={vi.fn()} />);

    expect(screen.queryByText(/one local groq key, one speech path, one place for logs/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/full key reveal stays off by design/i)).not.toBeInTheDocument();
    expect(screen.getByText("Storage")).toBeInTheDocument();
    expect(screen.getByText("Last check")).toBeInTheDocument();
    expect(screen.getAllByText("Not checked in this session").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /open groq keys/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reveal config json/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open diagnostics/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save locally/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /validate stored key/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /reveal config json/i }));

    await waitFor(() => expect(revealItemInDirMock).toHaveBeenCalledWith("/tmp/wordscript/config.json"));
  });

  it("reduces AI cleanup copy to one master switch and short dependent options", () => {
    render(<ApiModelsTab config={createAppConfig()} onChange={vi.fn()} onOpenDiagnostics={vi.fn()} />);

    expect(screen.getByRole("checkbox", { name: /^ai cleanup$/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /remove fillers/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /rewrite phrasing/i })).toBeInTheDocument();
    expect(screen.getByText(/fixes errors and removes fillers while staying close to the original phrasing/i)).toBeInTheDocument();
    expect(screen.getByText(/runs after speech-to-text and can fall back to the original transcript/i)).toBeInTheDocument();
  });

  it("hides AI cleanup sub-options when cleanup is off", () => {
    render(
      <ApiModelsTab
        config={createAppConfig({ post_process: false })}
        onChange={vi.fn()}
        onOpenDiagnostics={vi.fn()}
      />,
    );

    expect(screen.queryByRole("checkbox", { name: /remove fillers/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /rewrite phrasing/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Model")).not.toBeInTheDocument();
  });

  it("shows local preview as an STT-only lane without key actions", () => {
    render(
      <ApiModelsTab
        config={createAppConfig({ provider: "local_preview", local_model: "base" })}
        onChange={vi.fn()}
        onOpenDiagnostics={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/local preview helper missing/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/external helper setup/i)).toBeInTheDocument();
    expect(screen.getByText(/wordscript_local_whisper_cli/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /provider/i })).toHaveValue("local_preview");
    expect(screen.queryByRole("button", { name: /open groq keys/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save locally/i })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /^ai cleanup$/i })).toBeDisabled();
  });
});