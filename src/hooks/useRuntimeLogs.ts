import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

const REFRESH_INTERVAL_MS = 1200;

export function useRuntimeLogs(isActive: boolean) {
  const [entries, setEntries] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await invoke<string[]>("runtime_log_entries");
      setEntries(next);
      setError(null);
      return next;
    } catch (cause) {
      setError(String(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await invoke<string[]>("clear_runtime_log_entries");
      setEntries(next);
      setError(null);
      return next;
    } catch (cause) {
      setError(String(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [isActive, refresh]);

  return {
    entries,
    error,
    isLoading,
    refresh,
    clear,
  };
}