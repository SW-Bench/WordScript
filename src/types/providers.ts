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
  | "io";

export interface ProviderCommandError {
  kind: ProviderErrorKind;
  message: string;
  status: number | null;
  retry_after_seconds: number | null;
}

export interface ProviderCredentialStatus {
  provider: string;
  configured: boolean;
  storage: string;
  key_preview: string | null;
}

export interface ProviderProfile {
  id: string;
  provider: string;
  model: string;
  label: string;
  default: boolean;
  requires_api_key: boolean;
}

export interface ProviderStatus {
  provider: string;
  default_profile: string;
  credential: ProviderCredentialStatus;
  profiles: ProviderProfile[];
}

export type GroqProviderStatus = ProviderStatus;

export interface ValidateProviderApiKeyResponse {
  ok: boolean;
  provider: string;
  checked_with: string;
}

export type ValidateGroqApiKeyResponse = ValidateProviderApiKeyResponse;