import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  GroqProviderStatus,
  ProviderCommandError,
  ProviderCredentialStatus,
  ValidateGroqApiKeyResponse,
} from "../types/providers";

function providerErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error) {
    return (error as ProviderCommandError).message;
  }
  return String(error);
}

export function useGroqProvider() {
  const [status, setStatus] = useState<GroqProviderStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastValidation, setLastValidation] = useState<ValidateGroqApiKeyResponse | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await invoke<GroqProviderStatus>("groq_provider_status");
      setStatus(next);
      setError(null);
      return next;
    } catch (cause) {
      setError(providerErrorMessage(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveApiKey = useCallback(async (apiKey: string) => {
    setIsLoading(true);
    try {
      const credential = await invoke<ProviderCredentialStatus>("save_groq_api_key", {
        request: { api_key: apiKey },
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
  }, [refresh]);

  const clearApiKey = useCallback(async () => {
    setIsLoading(true);
    try {
      const credential = await invoke<ProviderCredentialStatus>("clear_groq_api_key");
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
  }, [refresh]);

  const validateApiKey = useCallback(async (apiKey?: string) => {
    setIsLoading(true);
    try {
      const validation = await invoke<ValidateGroqApiKeyResponse>("validate_groq_api_key", {
        request: { api_key: apiKey?.trim() ? apiKey : null },
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
  }, []);

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