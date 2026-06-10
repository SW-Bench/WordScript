import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ProcessingMode, EnhanceSubMode, WorkspaceContext, ProcessingModeEvent } from "../types/ipc";

const MODE_EVENT_CHANNEL = "wordscript-mode-event";

export function useProcessingMode(initialMode: ProcessingMode) {
  const [mode, setMode] = useState<ProcessingMode>(initialMode);
  const [subMode, setSubMode] = useState<EnhanceSubMode>("enhance");
  const [isOverride, setIsOverride] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);
  const [detectedFrom, setDetectedFrom] = useState<string | null>(null);
  const [workspaceContext, setWorkspaceContext] = useState<WorkspaceContext | null>(null);

  const setModeOverride = useCallback(async (newMode: ProcessingMode, newSubMode?: EnhanceSubMode) => {
    await invoke("set_processing_mode_override", { mode: newMode });
    setMode(newMode);
    setIsOverride(true);
    if (newSubMode) setSubMode(newSubMode);
  }, []);

  const clearOverride = useCallback(async () => {
    await invoke("clear_processing_mode_override");
    setIsOverride(false);
  }, []);

  const detectWorkspaceContext = useCallback(async () => {
    try {
      const context = await invoke<WorkspaceContext>("get_workspace_context");
      setWorkspaceContext(context);
      return context;
    } catch {
      return null;
    }
  }, []);

  const addAppMapping = useCallback(async (appCategory: string, selectedMode: ProcessingMode) => {
    await invoke("add_workspace_app_mapping", { appCategory, mode: selectedMode });
  }, []);

  const removeAppMapping = useCallback(async (appCategory: string) => {
    await invoke("remove_workspace_app_mapping", { appCategory });
  }, []);

  useEffect(() => {
    const unlistenPromise = listen<ProcessingModeEvent>(
      MODE_EVENT_CHANNEL,
      ({ payload }) => {
        setMode(payload.mode);
        setIsOverride(payload.is_override);
        setAutoDetected(payload.auto_detected);
      }
    );
    return () => { unlistenPromise.then(fn => fn()).catch(() => {}); };
  }, []);

  return {
    mode, setMode, subMode, setSubMode,
    isOverride, autoDetected, detectedFrom,
    workspaceContext,
    setModeOverride, clearOverride, detectWorkspaceContext,
    addAppMapping, removeAppMapping,
  };
}
