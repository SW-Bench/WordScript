import { useEffect, useState, useTransition } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  CompleteCaptureRequest,
  StartCaptureRequest,
  V1SliceResult,
  V1SliceStatus,
} from "../types/v1Slice";

export function useV1Slice() {
  const [status, setStatus] = useState<V1SliceStatus | null>(null);
  const [result, setResult] = useState<V1SliceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = async () => {
    try {
      const next = await invoke<V1SliceStatus>("v1_slice_status");
      startTransition(() => {
        setStatus(next);
        setError(null);
      });
    } catch (cause) {
      setError(String(cause));
    }
  };

  const startCapture = async (request: StartCaptureRequest) => {
    try {
      const next = await invoke<V1SliceStatus>("start_v1_slice_capture", { request });
      startTransition(() => {
        setStatus(next);
        setError(null);
      });
      return next;
    } catch (cause) {
      setError(String(cause));
      return null;
    }
  };

  const completeCapture = async (request: CompleteCaptureRequest) => {
    try {
      const next = await invoke<V1SliceResult>("complete_v1_slice_capture", { request });
      startTransition(() => {
        setResult(next);
        setStatus(next.status);
        setError(null);
      });
      return next;
    } catch (cause) {
      setError(String(cause));
      return null;
    }
  };

  const reset = async () => {
    try {
      const next = await invoke<V1SliceStatus>("reset_v1_slice");
      startTransition(() => {
        setStatus(next);
        setResult(null);
        setError(null);
      });
      return next;
    } catch (cause) {
      setError(String(cause));
      return null;
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return {
    status,
    result,
    error,
    isPending,
    refresh,
    startCapture,
    completeCapture,
    reset,
  };
}