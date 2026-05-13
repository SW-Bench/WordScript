import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ExportTranscriptionHistoryResponse,
  TranscriptionHistoryEntry,
  TranscriptionHistoryQuery,
  TranscriptionHistoryStorageStatus,
} from "../types/history";

const REFRESH_INTERVAL_MS = 1500;

function sanitizeQuery(query?: TranscriptionHistoryQuery): TranscriptionHistoryQuery {
  if (!query) return {};

  return {
    limit: query.limit,
    provider: query.provider?.trim() || undefined,
    status: query.status,
    source: query.source,
    active_profile: query.active_profile?.trim() || undefined,
    search: query.search?.trim() || undefined,
    include_errors_only: query.include_errors_only || undefined,
  };
}

export function useTranscriptionHistory(isActive: boolean) {
  const [entries, setEntries] = useState<TranscriptionHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const activeQueryRef = useRef<TranscriptionHistoryQuery>({});

  const refreshStorageStatus = useCallback(async () => {
    try {
      const next = await invoke<TranscriptionHistoryStorageStatus>("transcription_history_storage_status");
      setStoragePath(next.path);
      return next;
    } catch {
      setStoragePath(null);
      return null;
    }
  }, []);

  const refresh = useCallback(async (query?: TranscriptionHistoryQuery) => {
    setIsLoading(true);
    try {
      const nextQuery = sanitizeQuery(query ?? activeQueryRef.current);
      activeQueryRef.current = nextQuery;
      const next = await invoke<TranscriptionHistoryEntry[]>("transcription_history_entries", {
        query: nextQuery,
      });
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
      await invoke<TranscriptionHistoryEntry[]>("clear_transcription_history_entries");
      const next = await refresh();
      setError(null);
      return next;
    } catch (cause) {
      setError(String(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      await invoke<TranscriptionHistoryEntry[]>("delete_transcription_history_entry", {
        request: { id },
      });
      const next = await refresh();
      setError(null);
      return next;
    } catch (cause) {
      setError(String(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [refresh]);

  const retry = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const next = await invoke<TranscriptionHistoryEntry>("retry_transcription_history_entry", {
        request: { id },
      });
      await refresh();
      setError(null);
      return next;
    } catch (cause) {
      setError(String(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [refresh]);

  const exportEntries = useCallback(async (path: string, query?: TranscriptionHistoryQuery) => {
    setIsLoading(true);
    try {
      const nextQuery = sanitizeQuery(query ?? activeQueryRef.current);
      activeQueryRef.current = nextQuery;
      const response = await invoke<ExportTranscriptionHistoryResponse>("export_transcription_history", {
        request: {
          path,
          query: nextQuery,
        },
      });
      setError(null);
      return response;
    } catch (cause) {
      setError(String(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;

    void refreshStorageStatus();
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [isActive, refresh, refreshStorageStatus]);

  return {
    entries,
    storagePath,
    error,
    isLoading,
    refresh,
    clear,
    remove,
    retry,
    exportEntries,
  };
}