export type ProviderId = "groq" | "local_preview";

export type ProviderErrorKind =
  | "missing_api_key"
  | "secret_store_unavailable"
  | "invalid_request"
  | "unauthorized"
  | "rate_limited"
  | "timeout"
  | "network"
  | "provider_status"
  | "parse"
  | "io"
  | "local_setup";

export type ProviderErrorAction =
  | "configure_credential"
  | "check_secret_store"
  | "change_request"
  | "wait_and_retry"
  | "retry"
  | "check_network"
  | "check_provider_status"
  | "check_local_setup";

export interface ProviderCommandError {
  kind: ProviderErrorKind;
  message: string;
  status: number | null;
  retry_after_seconds: number | null;
  retryable: boolean;
  user_action: ProviderErrorAction;
}

export interface ProviderCredentialStatus {
  provider: string;
  configured: boolean;
  storage: string;
  key_preview: string | null;
}

export type ProviderMode = "fast" | "quality" | "local" | "self_hosted";

export interface ProviderProfile {
  id: string;
  provider: string;
  mode: ProviderMode;
  model: string;
  label: string;
  default: boolean;
  requires_api_key: boolean;
}

export interface ProviderCapabilities {
  transcription: boolean;
  chat_completion: boolean;
  local: boolean;
  requires_api_key: boolean;
  supports_prompt_bias: boolean;
  supports_language: boolean;
  supports_segments: boolean;
  model_management: boolean;
}

export type LocalProviderReadiness = "ready" | "setup_required";

export type LocalProviderIssueCode =
  | "missing_runner"
  | "invalid_runner_path"
  | "runner_probe_failed"
  | "runner_probe_timed_out"
  | "missing_model"
  | "invalid_model_path"
  | "unreadable_model_directory"
  | "model_not_found"
  | "missing_runner_and_model"
  | "invalid_chat_endpoint"
  | "chat_backend_unavailable"
  | "missing_chat_model"
  | "chat_model_not_found";

export interface LocalProviderSetupStatus {
  readiness: LocalProviderReadiness;
  runner_ready: boolean;
  model_ready: boolean;
  chat_ready: boolean;
  issue_code: LocalProviderIssueCode | null;
  resolved_runner: string | null;
  resolved_model: string | null;
  resolved_chat_base_url: string | null;
  resolved_chat_model: string | null;
  available_chat_models: string[];
  guidance: string;
}

export interface ProviderStatus {
  provider: string;
  default_profile: string;
  credential: ProviderCredentialStatus;
  profiles: ProviderProfile[];
  capabilities: ProviderCapabilities;
  local_setup: LocalProviderSetupStatus | null;
}

export interface ProviderStatusRequest {
  provider: string;
  model: string | null;
  correction_model?: string | null;
}

export type GroqProviderStatus = ProviderStatus;

export interface ValidateProviderApiKeyResponse {
  ok: boolean;
  provider: string;
  checked_with: string;
}

export type ValidateGroqApiKeyResponse = ValidateProviderApiKeyResponse;