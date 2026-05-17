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

export interface ProviderStatus {
  provider: string;
  default_profile: string;
  credential: ProviderCredentialStatus;
  profiles: ProviderProfile[];
  capabilities: ProviderCapabilities;
}

export type GroqProviderStatus = ProviderStatus;

export interface ValidateProviderApiKeyResponse {
  ok: boolean;
  provider: string;
  checked_with: string;
}

export type ValidateGroqApiKeyResponse = ValidateProviderApiKeyResponse;