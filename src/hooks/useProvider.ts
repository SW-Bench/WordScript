import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ProviderCommandError,
  ProviderCredentialStatus,
  ProviderId,
  ProviderStatus,
  ValidateProviderApiKeyResponse,
} from "../types/providers";

function providerErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error) {
    return (error as ProviderCommandError).message;
  }
  return String(error);
}

export function useProvider(providerId: ProviderId = "groq") {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastValidation, setLastValidation] = useState<ValidateProviderApiKeyResponse | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await invoke<ProviderStatus>("provider_status", {
        request: { provider: providerId },
      });
      setStatus(next);
      setError(null);
      return next;
    } catch (cause) {
      setError(providerErrorMessage(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [providerId]);

  const saveApiKey = useCallback(async (apiKey: string) => {
    setIsLoading(true);
    try {
      const credential = await invoke<ProviderCredentialStatus>("save_provider_api_key", {
        request: { provider: providerId, api_key: apiKey },
      });
      await refresh();
      setLastValidation(null);
      setError(null);
      return credential;
    } catch (cause) {
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
      return credential;
    } catch (cause) {
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
      return validation;
    } catch (cause) {
      setLastValidation(null);
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
    lastValidation,
    refresh,
    saveApiKey,
    clearApiKey,
    validateApiKey,
  };
}