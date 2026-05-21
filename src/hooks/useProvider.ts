import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ProviderCommandError,
  ProviderErrorAction,
  ProviderCredentialStatus,
  ProviderId,
  ProviderStatus,
  ValidateProviderApiKeyResponse,
} from "../types/providers";

function isProviderCommandError(error: unknown): error is ProviderCommandError {
  return typeof error === "object" && error !== null && "message" in error && "kind" in error && "user_action" in error;
}

function providerErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error) {
    return (error as ProviderCommandError).message;
  }
  return String(error);
}

export function providerErrorActionLabel(action: ProviderErrorAction) {
  switch (action) {
    case "configure_credential":
      return "Check or save the provider credential.";
    case "check_secret_store":
      return "Check the operating-system secret store.";
    case "change_request":
      return "Change the model, audio, or request settings before retrying.";
    case "wait_and_retry":
      return "Wait for the provider limit to reset, then retry.";
    case "retry":
      return "Retry the request.";
    case "check_network":
      return "Check the network connection, then retry.";
    case "check_provider_status":
      return "Check the provider status and retry later.";
    case "check_local_setup":
      return "Check the local helper and model setup.";
  }
}

export function useProvider(providerId: ProviderId = "groq", model?: string | null) {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<ProviderCommandError | null>(null);
  const [lastValidation, setLastValidation] = useState<ValidateProviderApiKeyResponse | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await invoke<ProviderStatus>("provider_status", {
        request: {
          provider: providerId,
          model: model?.trim() ? model.trim() : null,
        },
      });
      setStatus(next);
      setError(null);
      setLastError(null);
      return next;
    } catch (cause) {
      setLastError(isProviderCommandError(cause) ? cause : null);
      setError(providerErrorMessage(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [model, providerId]);

  const saveApiKey = useCallback(async (apiKey: string) => {
    setIsLoading(true);
    try {
      const credential = await invoke<ProviderCredentialStatus>("save_provider_api_key", {
        request: { provider: providerId, api_key: apiKey },
      });
      await refresh();
      setLastValidation(null);
      setError(null);
      setLastError(null);
      return credential;
    } catch (cause) {
      setLastError(isProviderCommandError(cause) ? cause : null);
      setError(providerErrorMessage(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [providerId, refresh]);

  const clearApiKey = useCallback(async () => {
    setIsLoading(true);
    try {
      const credential = await invoke<ProviderCredentialStatus>("clear_provider_api_key", {
        request: { provider: providerId },
      });
      await refresh();
      setLastValidation(null);
      setError(null);
      setLastError(null);
      return credential;
    } catch (cause) {
      setLastError(isProviderCommandError(cause) ? cause : null);
      setError(providerErrorMessage(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [providerId, refresh]);

  const validateApiKey = useCallback(async (apiKey?: string) => {
    setIsLoading(true);
    try {
      const validation = await invoke<ValidateProviderApiKeyResponse>("validate_provider_api_key", {
        request: { provider: providerId, api_key: apiKey?.trim() ? apiKey : null },
      });
      setLastValidation(validation);
      setError(null);
      setLastError(null);
      return validation;
    } catch (cause) {
      setLastValidation(null);
      setLastError(isProviderCommandError(cause) ? cause : null);
      setError(providerErrorMessage(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    status,
    isLoading,
    error,
    lastError,
    lastValidation,
    refresh,
    saveApiKey,
    clearApiKey,
    validateApiKey,
  };
}