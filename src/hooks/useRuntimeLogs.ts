import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

const REFRESH_INTERVAL_MS = 1200;

function areLogEntriesEqual(current: string[], next: string[]) {
  if (current.length !== next.length) return false;
  return current.every((entry, index) => entry === next[index]);
}

interface RefreshOptions {
  background?: boolean;
}

export function useRuntimeLogs(isActive: boolean) {
  const [entries, setEntries] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async (options?: RefreshOptions) => {
    const showLoading = !options?.background;

    if (showLoading) {
      setIsLoading(true);
    }

    try {
      const next = await invoke<string[]>("runtime_log_entries");
      setEntries((current) => (areLogEntriesEqual(current, next) ? current : next));
      setError((current) => (current === null ? current : null));
      return next;
    } catch (cause) {
      const message = String(cause);
      setError((current) => (current === message ? current : message));
      return null;
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
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

    void refresh({ background: true });
    const timer = window.setInterval(() => {
      void refresh({ background: true });
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