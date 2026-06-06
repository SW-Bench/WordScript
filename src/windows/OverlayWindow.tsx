import { type MouseEvent, type PointerEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { useRuntime } from "../hooks/useRuntime";
import type { TranscriptionHistoryEntry } from "../types/history";
import type { NativeInsertResult } from "../types/nativeInsertion";
import "../styles/overlay.css";

const BAR_COUNT = 11;
const RUNTIME_EVENT_CHANNEL = "wordscript-event";
const OVERLAY_ENTER_MS = 320;
const OVERLAY_LEAVE_MS = 240;
const IDLE_WAVEFORM = [4, 5, 6, 8, 10, 12, 10, 8, 6, 5, 4];
const MIN_BAR_HEIGHT = 4;
const MAX_BAR_HEIGHT = 30;
const DRAG_DISTANCE_THRESHOLD = 6;
const DRAG_CLICK_SUPPRESS_MS = 1000;

type OverlayMotion = "idle" | "entering" | "open" | "leaving";
type OverlaySurface = "compact" | "processing_preview" | "result_actions";

interface AudioLevelEvent {
  event: string;
  level?: number;
  rms?: number;
  waveform?: number[];
}

function setOverlayDocumentState(idle: boolean) {
  const targets = [document.documentElement, document.body, document.getElementById("root")]
    .filter((node): node is HTMLElement => Boolean(node));

  targets.forEach((node) => {
    node.classList.add("overlay-window");
    node.classList.toggle("overlay-idle", idle);
  });
}

function formatElapsed(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export default function OverlayWindow() {
  const { state, toggleMute, togglePause, openSettings } = useRuntime();
  const { status, muted, paused, error } = state;
  const isRecording = status === "recording";
  const isProcessing = status === "processing";
  const overlayMotionRef = useRef<OverlayMotion>("idle");
  const overlaySurfaceRef = useRef<OverlaySurface>("compact");
  const dragIntentRef = useRef<{ pointerId: number; startX: number; startY: number; dragged: boolean } | null>(null);
  const movePersistTimeoutRef = useRef<number | null>(null);
  const dragSessionActiveRef = useRef(false);
  const dragSessionEndTimeoutRef = useRef<number | null>(null);
  const suppressNextClickRef = useRef(false);
  const suppressClickUntilRef = useRef(0);
  const suppressMovedPersistenceUntilRef = useRef(0);
  const suppressNextResultActionsRef = useRef(false);
  const lastVisibleSurfaceRef = useRef<OverlaySurface>("compact");
  const [showError, setShowError] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [overlayMotion, setOverlayMotion] = useState<OverlayMotion>("idle");
  const [actionPending, setActionPending] = useState<"commit" | "abort" | "copy" | "retry" | "restore" | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionFailed, setActionFailed] = useState(false);
  const pendingPreviewResult = state.pendingResult;
  const previewResult = state.lastResult;
  const showProcessingPreview = Boolean(isProcessing && pendingPreviewResult && !showError);
  const showResultPreview = Boolean(showPreview && previewResult && status === "idle" && !showError);
  const showAnyPreview = showProcessingPreview || showResultPreview;
  const overlaySurface: OverlaySurface = showResultPreview
    ? "result_actions"
    : showProcessingPreview
      ? "processing_preview"
      : "compact";
  const holdPreviewDuringClose = !showAnyPreview
    && !showError
    && status === "idle"
    && overlayMotion !== "idle"
    && lastVisibleSurfaceRef.current !== "compact";
  const renderProcessingPreview = showProcessingPreview
    || (holdPreviewDuringClose
      && lastVisibleSurfaceRef.current === "processing_preview"
      && Boolean(pendingPreviewResult));
  const renderResultPreview = showResultPreview
    || (holdPreviewDuringClose
      && lastVisibleSurfaceRef.current === "result_actions"
      && Boolean(previewResult));
  const renderOverlaySurface: OverlaySurface = renderResultPreview
    ? "result_actions"
    : renderProcessingPreview
      ? "processing_preview"
      : overlaySurface;
  const activePreviewResult = renderProcessingPreview ? pendingPreviewResult : renderResultPreview ? previewResult : null;
  const finalPreviewText = activePreviewResult?.final_text?.trim() ?? "";
  const canCopy = Boolean(renderResultPreview && finalPreviewText);
  const canRetry = Boolean(renderResultPreview && previewResult?.history?.entry_id);
  const canRestore = Boolean(renderResultPreview && previewResult?.insertion);
  const canCommitPreview = Boolean(renderProcessingPreview && finalPreviewText);
  const previewCommitLabel = activePreviewResult?.work_mode?.insert_behavior === "clipboard_only"
    ? "Copy"
    : "Insert";
  const actionButtons = renderProcessingPreview
    ? [
        ...(canCommitPreview ? [{ id: "commit" as const, label: previewCommitLabel, pendingLabel: previewCommitLabel === "Copy" ? "Copying" : "Inserting", onClick: () => void handleCommitPreview() }] : []),
        { id: "abort" as const, label: "Abort", pendingLabel: "Aborting", onClick: () => void handleAbortPreview() },
      ]
    : [
        ...(canCopy ? [{ id: "copy" as const, label: "Copy", pendingLabel: "Copying", onClick: () => void handleCopyResult() }] : []),
        ...(canRetry ? [{ id: "retry" as const, label: "Retry", pendingLabel: "Retrying", onClick: () => void handleRetry() }] : []),
        ...(canRestore ? [{ id: "restore" as const, label: "Restore", pendingLabel: "Restoring", onClick: () => void handleRestore() }] : []),
      ];

  overlaySurfaceRef.current = overlaySurface;

  const applyOverlayMotion = (next: OverlayMotion) => {
    overlayMotionRef.current = next;
    setOverlayMotion(next);
  };

  // Mark html element before first paint so the overlay window stays transparent while idle.
  useLayoutEffect(() => {
    setOverlayDocumentState(true);
    void getCurrentWindow().setBackgroundColor([0, 0, 0, 0]).catch(() => {});
    void getCurrentWebview().setBackgroundColor([0, 0, 0, 0]).catch(() => {});

    return () => {
      const targets = [document.documentElement, document.body, document.getElementById("root")]
        .filter((node): node is HTMLElement => Boolean(node));

      targets.forEach((node) => {
        node.classList.remove("overlay-window");
        node.classList.remove("overlay-idle");
      });
    };
  }, []);

  useEffect(() => {
    const currentWindow = getCurrentWindow();
    const unlistenPromise = currentWindow.onMoved(({ payload }) => {
      // Ignore host-driven moves; remembered placement should only follow an active native drag session.
      if (!dragSessionActiveRef.current) {
        return;
      }

      if (Date.now() < suppressMovedPersistenceUntilRef.current) {
        return;
      }

      if (movePersistTimeoutRef.current) {
        window.clearTimeout(movePersistTimeoutRef.current);
      }

      movePersistTimeoutRef.current = window.setTimeout(async () => {
        try {
          const scale = await currentWindow.scaleFactor();
          const logicalX = Math.round(payload.x / Math.max(scale, 1));
          const logicalY = Math.round(payload.y / Math.max(scale, 1));
          await invoke("remember_overlay_manual_position", {
            x: logicalX,
            y: logicalY,
            surface: overlaySurfaceRef.current,
          });
        } catch {
          // Ignore transient move persistence failures during drag.
        }
        // End drag session here so trailing onMoved events after a native drag
        // (where pointerup already fired before the window moved) are still captured.
        dragSessionActiveRef.current = false;
        if (dragSessionEndTimeoutRef.current) {
          window.clearTimeout(dragSessionEndTimeoutRef.current);
          dragSessionEndTimeoutRef.current = null;
        }
      }, 180);
    });

    return () => {
      if (movePersistTimeoutRef.current) {
        window.clearTimeout(movePersistTimeoutRef.current);
        movePersistTimeoutRef.current = null;
      }
      if (dragSessionEndTimeoutRef.current) {
        window.clearTimeout(dragSessionEndTimeoutRef.current);
        dragSessionEndTimeoutRef.current = null;
      }
      void unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
    };
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const dragIntent = dragIntentRef.current;
      if (!dragIntent || dragIntent.pointerId !== event.pointerId) {
        return;
      }

      if ((event.buttons & 1) !== 1) {
        dragIntentRef.current = null;
        return;
      }

      if (dragIntent.dragged) {
        return;
      }

      const distance = Math.hypot(event.clientX - dragIntent.startX, event.clientY - dragIntent.startY);
      if (distance < DRAG_DISTANCE_THRESHOLD) {
        return;
      }

      dragIntent.dragged = true;
      dragSessionActiveRef.current = true;
      void startDrag().catch(() => {
        dragSessionActiveRef.current = false;
        dragIntentRef.current = null;
      });
    };

    const clearDragIntent = () => {
      if (dragIntentRef.current?.dragged) {
        // On Windows, startDragging() causes WebView2 to fire pointercancel/pointerup
        // immediately (native drag takes pointer ownership), before any onMoved events
        // arrive. Do not clear dragSessionActive here; let the onMoved persist handler
        // clear it after saving the position. A fallback timeout covers the case where
        // onMoved never fires (e.g. window not actually moved).
        if (dragSessionEndTimeoutRef.current) {
          window.clearTimeout(dragSessionEndTimeoutRef.current);
        }
        dragSessionEndTimeoutRef.current = window.setTimeout(() => {
          dragSessionActiveRef.current = false;
          dragSessionEndTimeoutRef.current = null;
        }, 2000);
        suppressNextClickRef.current = true;
        suppressClickUntilRef.current = Date.now() + DRAG_CLICK_SUPPRESS_MS;
      }
      dragIntentRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", clearDragIntent);
    window.addEventListener("pointercancel", clearDragIntent);
    window.addEventListener("blur", clearDragIntent);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", clearDragIntent);
      window.removeEventListener("pointercancel", clearDragIntent);
      window.removeEventListener("blur", clearDragIntent);
    };
  }, []);

  useEffect(() => {
    if (!error) return;

    setShowPreview(false);
    setShowError(true);
    const timeout = window.setTimeout(() => setShowError(false), 4200);
    return () => window.clearTimeout(timeout);
  }, [error]);

  useEffect(() => {
    if (!state.pendingResult?.occurred_at_ms) {
      return;
    }

    setActionPending(null);
    setActionMessage(null);
    setActionFailed(false);
  }, [state.pendingResult?.occurred_at_ms]);

  useEffect(() => {
    if (!state.lastResult?.occurred_at_ms) {
      return;
    }

    if (suppressNextResultActionsRef.current) {
      suppressNextResultActionsRef.current = false;
      return;
    }

    setShowPreview(true);
    setActionPending(null);
    setActionMessage(null);
    setActionFailed(false);
  }, [state.lastResult?.occurred_at_ms]);

  useEffect(() => {
    if (status === "recording" || (status === "processing" && !pendingPreviewResult)) {
      setShowPreview(false);
    }
  }, [pendingPreviewResult, status]);

  const isActive = status === "recording" || status === "processing" || showError || showAnyPreview;

  useEffect(() => {
    if (isActive) {
      lastVisibleSurfaceRef.current = overlaySurface;
    }
  }, [isActive, overlaySurface]);

  useEffect(() => {
    if (isActive) {
      suppressMovedPersistenceUntilRef.current = Date.now() + 420;
      void invoke("sync_overlay_window_visibility", { visible: true, surface: overlaySurface }).catch(() => {});
      void getCurrentWindow().setBackgroundColor([0, 0, 0, 0]).catch(() => {});
      void getCurrentWebview().setBackgroundColor([0, 0, 0, 0]).catch(() => {});
      setOverlayDocumentState(false);
      if (overlayMotionRef.current !== "open" && overlayMotionRef.current !== "entering") {
        applyOverlayMotion("entering");
      }
    } else {
      if (overlayMotionRef.current === "open" || overlayMotionRef.current === "entering") {
        applyOverlayMotion("leaving");
      }
    }
  }, [isActive, overlaySurface]);

  // WebKitGTK can fire animationend too early on filtered/transformed layers.
  // Drive the state machine from the known animation durations instead.
  useEffect(() => {
    if (overlayMotion === "entering") {
      const timeout = window.setTimeout(() => {
        if (overlayMotionRef.current !== "entering") return;
        applyOverlayMotion(isActive ? "open" : "leaving");
      }, OVERLAY_ENTER_MS);

      return () => window.clearTimeout(timeout);
    }

    if (overlayMotion === "leaving") {
      const timeout = window.setTimeout(() => {
        if (overlayMotionRef.current !== "leaving") return;
        setOverlayDocumentState(true);
        suppressMovedPersistenceUntilRef.current = Date.now() + 420;
        void invoke("sync_overlay_window_visibility", { visible: false, surface: "compact" satisfies OverlaySurface }).catch(() => {});
        applyOverlayMotion("idle");
      }, OVERLAY_LEAVE_MS);

      return () => window.clearTimeout(timeout);
    }
  }, [isActive, overlayMotion, overlaySurface]);

  // Reactive waveform bars driven by native capture sample buckets.
  const [barHeights, setBarHeights] = useState<number[]>(IDLE_WAVEFORM);

  useEffect(() => {
    const unlisten = listen<AudioLevelEvent>(RUNTIME_EVENT_CHANNEL, ({ payload }) => {
      if (paused) return;

      if (payload.event === "audio_level" && typeof payload.level === "number") {
        const nextHeights = audioPayloadToHeights(payload);
        setBarHeights((current) => current.map((height, index) => {
          const target = nextHeights[index];
          const blend = target > height ? 0.97 : 0.66;
          return Math.round(height + (target - height) * blend);
        }));
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [paused]);

  // Reset bars when not actively recording
  useEffect(() => {
    if (status !== "recording" || muted || paused) {
      setBarHeights(IDLE_WAVEFORM);
    }
  }, [status, muted, paused]);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<number | null>(null);
  const sessionActiveRef = useRef(false);

  useEffect(() => {
    const isSessionActive = status === "recording" || status === "processing";

    if (!isSessionActive) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      sessionActiveRef.current = false;
      setElapsed(0);
      return;
    }

    if (!sessionActiveRef.current) {
      sessionActiveRef.current = true;
      setElapsed(0);
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!paused) {
      timerRef.current = window.setInterval(() => setElapsed(s => s + 1), 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status, paused]);

  const startDrag = async () => {
    await getCurrentWindow().startDragging();
  };

  const handleOverlayPointerDownCapture = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    dragIntentRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragged: false,
    };
  };

  const handleInteractiveClickCapture = (event: MouseEvent<HTMLElement>) => {
    const suppressClick = suppressNextClickRef.current && Date.now() < suppressClickUntilRef.current;
    if (!suppressClick) {
      if (Date.now() >= suppressClickUntilRef.current) {
        suppressNextClickRef.current = false;
      }
      return;
    }

    suppressNextClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const sideTitle = isRecording
    ? (paused ? "Resume recording" : "Pause recording")
    : isProcessing
      ? "Processing"
      : "Open Settings";
  const sideCaption = isRecording
    ? (paused ? "Paused" : "Live")
    : isProcessing
      ? "Working"
      : showError
        ? "Review"
        : "Settings";

  const handleSideAction = () => {
    if (isRecording) {
      void togglePause();
      return;
    }

    void openSettings();
  };

  const beginOverlayAction = (action: "commit" | "abort" | "copy" | "retry" | "restore") => {
    setShowPreview(true);
    setActionPending(action);
    setActionMessage(null);
    setActionFailed(false);
  };

  const finishOverlayAction = (message: string | null, failed = false) => {
    setActionPending(null);
    setActionFailed(failed);
    setActionMessage(failed ? message : null);
    if (!failed) {
      setShowPreview(false);
    }
  };

  const handleDismissPreview = () => {
    if (actionPending) return;

    setShowPreview(false);
    setActionMessage(null);
    setActionFailed(false);
  };

  const handleCommitPreview = async () => {
    if (!pendingPreviewResult || actionPending) return;

    beginOverlayAction("commit");
    suppressNextResultActionsRef.current = true;
    try {
      const result = await invoke<NativeInsertResult>("commit_pending_transcription_preview");
      finishOverlayAction(result.ok ? result.recovery_message : result.error ?? "Commit failed.", !result.ok);
      if (!result.ok) {
        suppressNextResultActionsRef.current = false;
      }
    } catch (error) {
      suppressNextResultActionsRef.current = false;
      finishOverlayAction(String(error), true);
    }
  };

  const handleAbortPreview = async () => {
    if (!pendingPreviewResult || actionPending) return;

    beginOverlayAction("abort");
    try {
      await invoke("abort_native_session");
      finishOverlayAction("Preview discarded.");
    } catch (error) {
      finishOverlayAction(String(error), true);
    }
  };

  const handleCopyResult = async () => {
    if (!finalPreviewText || actionPending) return;

    beginOverlayAction("copy");
    try {
      const result = await invoke<NativeInsertResult>("insert_text_native", {
        request: {
          text: finalPreviewText,
          source: "overlay_preview_copy",
          corrected: previewResult?.corrected ?? false,
          auto_paste: false,
        },
      });
      finishOverlayAction(result.ok ? result.recovery_message : result.error ?? "Copy failed.", !result.ok);
    } catch (error) {
      finishOverlayAction(String(error), true);
    }
  };

  const handleRetry = async () => {
    const historyId = previewResult?.history?.entry_id;
    if (!historyId || actionPending) return;

    beginOverlayAction("retry");
    try {
      const entry = await invoke<TranscriptionHistoryEntry>("retry_transcription_history_entry", {
        request: { id: historyId },
      });
      finishOverlayAction(
        entry.status === "completed"
          ? "Retry completed."
          : entry.status === "empty"
            ? "Retry produced no usable transcript."
            : entry.error ?? "Retry failed.",
        entry.status === "failed",
      );
    } catch (error) {
      finishOverlayAction(String(error), true);
    }
  };

  const handleRestore = async () => {
    if (!previewResult?.insertion || actionPending) return;

    beginOverlayAction("restore");
    try {
      const result = await invoke<NativeInsertResult>("restore_last_transcript");
      finishOverlayAction(result.ok ? result.recovery_message : result.error ?? "Restore failed.", !result.ok);
    } catch (error) {
      finishOverlayAction(String(error), true);
    }
  };

  const pillClass = [
    "pill",
    renderOverlaySurface === "compact" ? "pill--compact" : "",
    renderOverlaySurface === "processing_preview" ? "pill--preview-actions" : "",
    renderOverlaySurface === "result_actions" ? "pill--result-actions" : "",
    overlayMotion === "entering" ? "pill--entering" : "",
    overlayMotion === "open" ? "pill--open" : "",
    overlayMotion === "leaving" ? "pill--leaving" : "",
    isRecording && !muted ? "pill--recording" : "",
    isRecording && muted ? "pill--muted" : "",
    isRecording && paused ? "pill--paused" : "",
    isProcessing ? "pill--processing" : "",
    showError ? "pill--error" : "",
  ].filter(Boolean).join(" ");

  if ((renderProcessingPreview || renderResultPreview) && activePreviewResult) {
    return (
      <div className="overlay-shell" onPointerDownCapture={handleOverlayPointerDownCapture}>
        <div className={pillClass}>
          <div className="pill__center pill__center--actions">
            {actionButtons.length > 0 ? (
              <div className="pill__action-strip" aria-label={renderProcessingPreview ? "Preview actions" : "Result actions"}>
                {actionButtons.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className="pill__action-button"
                    onClickCapture={handleInteractiveClickCapture}
                    onClick={action.onClick}
                    disabled={actionPending !== null}
                    title={actionFailed && actionMessage ? actionMessage : action.label}
                  >
                    {actionPending === action.id ? action.pendingLabel : action.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="pill__action-empty">{finalPreviewText || "Ready for the next pass."}</span>
            )}
          </div>

          <div className="pill__divider" />
          {renderResultPreview ? (
            <button
              type="button"
              className="pill__side pill__side--action"
              aria-label="Done"
              onClickCapture={handleInteractiveClickCapture}
              onClick={handleDismissPreview}
              title={actionFailed && actionMessage ? actionMessage : "Dismiss action mode"}
              disabled={actionPending !== null}
            >
              <span className="pill__side-copy">
                <span className="pill__timer">Done</span>
                <span className="pill__side-label">Dismiss</span>
              </span>
            </button>
          ) : (
            <div className="pill__side pill__side--status" title={actionFailed && actionMessage ? actionMessage : "Transcription ready for action"}>
              <span className="pill__side-copy">
                <span className="pill__timer">{actionFailed ? "Error" : "Ready"}</span>
                <span className="pill__side-label">{actionFailed ? "Review" : "Action"}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overlay-shell" onPointerDownCapture={handleOverlayPointerDownCapture}>
      <div className={pillClass}>
        <button
          type="button"
          className="pill__mic"
          onClickCapture={handleInteractiveClickCapture}
          onClick={() => isRecording && toggleMute()}
          title={muted ? "Unmute" : "Mute"}
          aria-pressed={muted}
        >
          <MicIcon muted={muted} />
        </button>

        <div className="pill__center">
          <div className="pill__bars" aria-label="Audio level">
            {Array.from({ length: BAR_COUNT }, (_, i) => (
              <div
                key={i}
                className={`bar${muted ? " bar--muted" : ""}`}
                style={{ height: barHeights[i] }}
              />
            ))}
          </div>
        </div>

        <div className="pill__divider" />
        <button
          type="button"
          className="pill__side"
          onClickCapture={handleInteractiveClickCapture}
          onClick={handleSideAction}
          title={sideTitle}
          aria-pressed={paused}
        >
          <span className="pill__side-copy">
            <span className="pill__timer">{formatElapsed(elapsed)}</span>
            <span className="pill__side-label">{sideCaption}</span>
          </span>
        </button>
      </div>
    </div>
  );
}

function audioPayloadToHeights(payload: AudioLevelEvent) {
  const level = Math.min(1, Math.max(0, payload.level ?? 0));
  const rms = Math.min(1, Math.max(0, payload.rms ?? level * 0.65));
  const waveform = normalizeWaveform(payload.waveform, Math.max(level, rms));
  const waveformPeak = waveform.reduce((peak, sample) => Math.max(peak, sample), Math.max(level, rms, 0.001));
  const quietLevel = Math.max(level, rms);

  // Room noise should settle back toward the idle silhouette instead of twitching constantly.
  if (quietLevel < 0.022 && waveformPeak < 0.05) {
    return IDLE_WAVEFORM;
  }

  const levelGain = Math.min(1, level * 3.15);
  const rmsGain = Math.min(1, rms * 3.45);
  const speechBoost = Math.max(levelGain, rmsGain);

  return waveform.map((sample, index) => {
    const distanceFromCenter = Math.abs(index - (waveform.length - 1) / 2);
    const centerBias = 1 - distanceFromCenter / Math.max(1, (waveform.length - 1) / 2);
    const relative = waveformPeak > 0 ? sample / waveformPeak : 0;
    const energy = Math.min(1, relative * 0.4 + sample * 1.18 + rmsGain * 0.82 + levelGain * 0.5);
    const floor = quietLevel < 0.05
      ? Math.min(0.14, 0.026 + speechBoost * 0.08)
      : Math.min(0.26, 0.04 + rmsGain * 0.1 + levelGain * 0.08);
    const shaped = Math.pow(Math.max(energy, floor), speechBoost > 0.14 ? 0.68 : 0.76);
    const emphasis = 0.88 + centerBias * 0.14;
    return Math.round(MIN_BAR_HEIGHT + (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT) * Math.min(1, shaped * emphasis));
  });
}

function normalizeWaveform(waveform: number[] | undefined, fallbackLevel: number) {
  if (!waveform?.length) {
    return Array.from({ length: BAR_COUNT }, () => Math.min(1, fallbackLevel * 1.35));
  }

  if (waveform.length === BAR_COUNT) {
    return waveform.map((value) => Math.min(1, Math.max(0, value)));
  }

  return Array.from({ length: BAR_COUNT }, (_, index) => {
    const sourceIndex = Math.min(waveform.length - 1, Math.floor(index * waveform.length / BAR_COUNT));
    return Math.min(1, Math.max(0, waveform[sourceIndex] ?? 0));
  });
}

// ── Mic SVG icon ──────────────────────────────────────────────────────────────

function MicIcon({ muted }: { muted: boolean }) {
  const color = muted ? "var(--red)" : "var(--fg)";
  return (
    <svg width="34" height="40" viewBox="0 0 38 46" fill="none" aria-hidden="true">
      <rect x="12" y="3" width="14" height="24" rx="7" fill={color} />
      <path d="M6 21c0 17 26 17 26 0" stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" />
      <line x1="19" y1="35" x2="19" y2="41" stroke={color} strokeWidth="4" strokeLinecap="round" />
      <line x1="11" y1="42" x2="27" y2="42" stroke={color} strokeWidth="4" strokeLinecap="round" />
      {muted && (
        <line x1="7" y1="6" x2="31" y2="40" stroke="var(--red)" strokeWidth="4" strokeLinecap="round" />
      )}
    </svg>
  );
}
