import { type MouseEvent, type PointerEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { useRuntime } from "../hooks/useRuntime";
import { resolveActiveTextProfile, resolveTextProfileWorkMode } from "../lib/textProfiles";
import type { AppConfig, ProcessingMode } from "../types/ipc";
import type { NativeInsertResult } from "../types/nativeInsertion";
import {
  OverlayPill,
  type OverlayPendingPreview,
  type OverlayPendingResult,
  type OverlayPillState,
  type OverlayProcessingMode,
} from "../components/overlay/OverlayPill";
import "../styles/overlay-shell.css";

const RUNTIME_EVENT_CHANNEL = "wordscript-event";
// Order the in-overlay mode cycler rotates through. Mirrors the modes exposed in
// Settings → Modes.
const MODE_CYCLE: ProcessingMode[] = ["verbatim", "cleanup", "rewrite", "prompt_enhance", "agent"];
const OVERLAY_ENTER_MS = 320;
const OVERLAY_LEAVE_MS = 240;
const DRAG_DISTANCE_THRESHOLD = 6;
const DRAG_CLICK_SUPPRESS_MS = 1000;
// Matches the .overlay-shell padding so the native window hugs the pill plus its
// transparent breathing room on every edge.
const SHELL_PADDING = 4;
// Extra slack on top of the measured pill box. WebKitGTK under-reports the
// scaled (scale 0.87) sub-pixel box of the transformed pill — on XWayland by
// enough to clip both ends of the processing pill, on native Wayland only by a
// few pixels (the orange mode/accent content at the ends read as a clipped
// "shimmer"). 4px was too tight; 12px absorbs the under-report plus border /
// antialiasing without a visible gap (the transparent headroom is click-through
// via .overlay-shell pointer-events:none). See handoff Abschnitt 0/2.
const MEASURE_BUFFER = 12;

type OverlayMotion = "idle" | "entering" | "open" | "leaving";
type OverlaySurface = "compact" | "processing_preview" | "result_actions" | "edit_mode";

// Proven per-surface widths, mirrored from OverlaySurface::dimensions() in
// src-tauri/src/lib.rs. Used as a floor under the live measurement: if WebKitGTK
// under-reports the scaled box, the known-good constant still prevents clipping.
const SURFACE_MIN_WIDTH: Record<OverlaySurface, number> = {
  compact: 256,
  processing_preview: 300,
  result_actions: 388,
  edit_mode: 420,
};

interface AudioLevelEvent {
  event: string;
  level?: number;
  rms?: number;
  waveform?: number[];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function setOverlayDocumentState(idle: boolean) {
  const targets = [document.documentElement, document.body, document.getElementById("root")]
    .filter((node): node is HTMLElement => Boolean(node));

  targets.forEach((node) => {
    node.classList.add("overlay-window");
    node.classList.toggle("overlay-idle", idle);
  });
}

// Derives the processing mode the active session actually runs in, straight from
// runtime config. Mirrors the native migration so the pill stays honest even for
// configs written before processing modes existed — never a guessed placeholder.
function resolveOverlayProcessingMode(config: AppConfig): ProcessingMode {
  const workMode = resolveTextProfileWorkMode(resolveActiveTextProfile(config));
  const explicit = workMode.processing_mode ?? config.processing_mode;
  if (explicit) return explicit;
  if (config.agent_mode_enabled) return "agent";
  switch (workMode.rewrite_style) {
    case "verbatim": return "verbatim";
    case "polished": return "rewrite";
    default: return "cleanup";
  }
}

// Collapses the native capture payload into a single perceptual level (0–1) that
// OverlayPill turns into bar heights. The gain mirrors the legacy waveform mapping
// so quiet speech still reads, while genuine room silence settles to the idle
// silhouette (level 0).
function audioPayloadToLevel(payload: AudioLevelEvent): number {
  const level = clamp01(payload.level ?? 0);
  const rms = clamp01(payload.rms ?? level * 0.65);
  const waveformPeak = (payload.waveform ?? []).reduce((peak, sample) => Math.max(peak, clamp01(sample)), 0);

  if (level < 0.022 && waveformPeak < 0.05) {
    return 0;
  }

  return clamp01(Math.max(level * 3.15, rms * 3.45, waveformPeak * 2.2));
}

export default function OverlayWindow() {
  const { state, toggleMute, togglePause } = useRuntime();
  const { status, muted, paused, error } = state;
  const isRecording = status === "recording";
  const isProcessing = status === "processing";
  const overlayMotionRef = useRef<OverlayMotion>("idle");
  const overlaySurfaceRef = useRef<OverlaySurface>("compact");
  const shellRef = useRef<HTMLDivElement>(null);
  const dragIntentRef = useRef<{ pointerId: number; startX: number; startY: number; dragged: boolean } | null>(null);
  const movePersistTimeoutRef = useRef<number | null>(null);
  const dragSessionActiveRef = useRef(false);
  const dragSessionEndTimeoutRef = useRef<number | null>(null);
  const autoCloseResultTimerRef = useRef<number | null>(null);
  const suppressNextClickRef = useRef(false);
  const suppressClickUntilRef = useRef(0);
  const suppressMovedPersistenceUntilRef = useRef(0);
  const suppressNextResultActionsRef = useRef(false);
  const lastVisibleSurfaceRef = useRef<OverlaySurface>("compact");
  const [showError, setShowError] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [overlayMotion, setOverlayMotion] = useState<OverlayMotion>("idle");
  const [actionPending, setActionPending] = useState<"commit" | "abort" | "copy" | "edit" | "insert" | null>(null);
  const [editText, setEditText] = useState("");
  const [showEditMode, setShowEditMode] = useState(false);
  const [modeOverride, setModeOverride] = useState<ProcessingMode | null>(null);
  const pendingPreviewResult = state.pendingResult;
  const previewResult = state.lastResult;
  const showProcessingPreview = Boolean(isProcessing && pendingPreviewResult && !showError);
  const showResultPreview = Boolean(showPreview && previewResult && status === "idle" && !showError);
  const showAnyPreview = showProcessingPreview || showResultPreview;
  const overlaySurface: OverlaySurface = showEditMode
    ? "edit_mode"
    : showResultPreview
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
      && (lastVisibleSurfaceRef.current === "result_actions" || lastVisibleSurfaceRef.current === "edit_mode")
      && Boolean(previewResult));
  const renderOverlaySurface: OverlaySurface = showEditMode
    ? "edit_mode"
    : renderResultPreview
      ? "result_actions"
      : renderProcessingPreview
        ? "processing_preview"
        : overlaySurface;
  const activePreviewResult = renderProcessingPreview ? pendingPreviewResult : renderResultPreview ? previewResult : null;
  const finalPreviewText = activePreviewResult?.final_text?.trim() ?? "";
  const previewClipboardOnly = activePreviewResult?.work_mode?.insert_behavior === "clipboard_only";

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
    setShowEditMode(false);
    setEditText("");
    setActionPending(null);
  }, [state.lastResult?.occurred_at_ms]);

  useEffect(() => {
    if (!showResultPreview || actionPending || showEditMode) {
      if (autoCloseResultTimerRef.current) {
        window.clearTimeout(autoCloseResultTimerRef.current);
        autoCloseResultTimerRef.current = null;
      }
      return;
    }

    const autoCloseMs = state.config?.result_actions_timeout_ms ?? 9000;
    autoCloseResultTimerRef.current = window.setTimeout(() => {
      autoCloseResultTimerRef.current = null;
      setShowPreview(false);
    }, autoCloseMs);

    return () => {
      if (autoCloseResultTimerRef.current) {
        window.clearTimeout(autoCloseResultTimerRef.current);
        autoCloseResultTimerRef.current = null;
      }
    };
  }, [showResultPreview, actionPending, showEditMode, state.config?.result_actions_timeout_ms]);

  useEffect(() => {
    if (status === "recording" || (status === "processing" && !pendingPreviewResult)) {
      setShowPreview(false);
      setShowEditMode(false);
      setEditText("");
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

  const processingMode = useMemo(
    () => (state.config ? resolveOverlayProcessingMode(state.config) : null),
    [state.config],
  );
  const pillMode: OverlayProcessingMode = modeOverride ?? processingMode ?? "cleanup";

  // Fixed per-surface window size. Dynamic pill-based sizing is unreliable on
  // WebKitGTK/GTK: set_size is applied ASYNCHRONOUSLY (one event-loop tick
  // behind), so back-to-back resizes (ResizeObserver) leave the window stuck at
  // the previous, too-small size and clip the pill ends. A fixed size per
  // surface means one set_size on first reveal, then size_changed=false (no
  // further async churn) — the window is stable and never clips. All flat
  // surfaces share one size (wide enough for the widest, result-actions); the
  // pill is centred inside, so compact has transparent side margins. That is
  // acceptable: click-through beneath the window is already a Wayland layer-
  // shell limit (docs/STATUS.md:108), not a sizing concern.
  useLayoutEffect(() => {
    if (!isActive) return;
    if (overlayMotionRef.current === "leaving") return;
    if (dragSessionActiveRef.current) return;
    const surface = overlaySurfaceRef.current;
    const { width, height } =
      surface === "edit_mode"
        ? { width: 460, height: 164 }
        : { width: 440, height: 60 };
    if (import.meta.env.DEV) {
      const pill = shellRef.current?.querySelector<HTMLElement>(".pill");
      console.warn(
        `[ov-dom] surface=${surface} reqW=${width} innerW=${window.innerWidth} innerH=${window.innerHeight} pillOffsetW=${pill?.offsetWidth ?? "n/a"}`,
      );
    }
    void invoke("sync_overlay_window_visibility", {
      visible: true,
      surface,
      width,
      height,
    }).catch(() => {});
  }, [isActive, renderOverlaySurface]);

  // DEV: mirror the native reveal (req/outer/inner window sizes) into the
  // overlay console so window-vs-webview sizing is diagnosable without the
  // terminal (the Rust eprintln goes to the terminal, this goes to devtools).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let unlisten: (() => void) | undefined;
    void listen<unknown>("ov-reveal-debug", (event) => {
      console.warn("[ov-reveal]", JSON.stringify(event.payload));
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  // Reactive waveform level driven by native capture sample buckets. OverlayPill
  // turns the single level into bar heights.
  const [audioLevel, setAudioLevel] = useState(0);

  useEffect(() => {
    const unlisten = listen<AudioLevelEvent>(RUNTIME_EVENT_CHANNEL, ({ payload }) => {
      if (paused) return;
      if (payload.event === "audio_level" && typeof payload.level === "number") {
        setAudioLevel(audioPayloadToLevel(payload));
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [paused]);

  // Settle the level when capture is not actively producing sound.
  useEffect(() => {
    if (status !== "recording" || muted || paused) {
      setAudioLevel(0);
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

    const target = event.target as HTMLElement;
    if (target.tagName === "TEXTAREA") return;

    dragIntentRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragged: false,
    };
  };

  // Capture-phase guard: swallow the click that ends a drag before it can reach
  // any pill button, so dragging the overlay never fires an action.
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

  // Tap-to-cycle through processing modes straight from the overlay. Uses the
  // native session override so the change applies to the in-flight pass without
  // permanently rewriting the active profile.
  const handleCycleMode = () => {
    const current = modeOverride ?? processingMode;
    if (!current) return;
    const index = MODE_CYCLE.indexOf(current);
    const next = MODE_CYCLE[(index + 1) % MODE_CYCLE.length] ?? MODE_CYCLE[0];
    setModeOverride(next);
    void invoke("set_processing_mode_override", { mode: next }).catch(() => {});
  };

  const beginOverlayAction = (action: "commit" | "abort" | "copy" | "edit" | "insert") => {
    setShowPreview(true);
    setActionPending(action);
  };

  const finishOverlayAction = (failed = false) => {
    setActionPending(null);
    if (!failed) {
      setShowPreview(false);
    }
  };

  const handleDismissPreview = () => {
    if (actionPending) return;

    setShowPreview(false);
    setShowEditMode(false);
    setEditText("");
  };

  const handleCommitPreview = async () => {
    if (!pendingPreviewResult || actionPending) return;

    beginOverlayAction("commit");
    suppressNextResultActionsRef.current = true;
    try {
      const result = await invoke<NativeInsertResult>("commit_pending_transcription_preview");
      finishOverlayAction(!result.ok);
      if (!result.ok) {
        suppressNextResultActionsRef.current = false;
      }
    } catch {
      suppressNextResultActionsRef.current = false;
      finishOverlayAction(true);
    }
  };

  const handleAbortPreview = async () => {
    if (!pendingPreviewResult || actionPending) return;

    beginOverlayAction("abort");
    try {
      await invoke("abort_native_session");
      finishOverlayAction();
    } catch {
      finishOverlayAction(true);
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
      finishOverlayAction(!result.ok);
    } catch {
      finishOverlayAction(true);
    }
  };

  const handleEditOpen = () => {
    setEditText(finalPreviewText);
    setShowEditMode(true);
  };

  const handleEditCancel = () => {
    setShowEditMode(false);
    setEditText("");
  };

  const handleEditConfirm = async () => {
    if (!editText.trim() || actionPending) return;

    beginOverlayAction("edit");
    suppressNextResultActionsRef.current = true;
    const isAutoPaste = previewResult?.work_mode?.insert_behavior !== "clipboard_only";
    try {
      const result = await invoke<NativeInsertResult>("insert_text_native", {
        request: {
          text: editText,
          source: "overlay_edit_confirm",
          corrected: false,
          auto_paste: isAutoPaste,
        },
      });
      if (result.ok) {
        setActionPending(null);
        setShowEditMode(false);
        setEditText("");
        setShowPreview(false);
      } else {
        suppressNextResultActionsRef.current = false;
        finishOverlayAction(true);
      }
    } catch {
      suppressNextResultActionsRef.current = false;
      finishOverlayAction(true);
    }
  };

  const handleInsertResult = async () => {
    if (!finalPreviewText || actionPending) return;

    beginOverlayAction("insert");
    try {
      const result = await invoke<NativeInsertResult>("insert_text_native", {
        request: {
          text: finalPreviewText,
          source: "overlay_preview_insert",
          corrected: previewResult?.corrected ?? false,
          auto_paste: true,
        },
      });
      finishOverlayAction(!result.ok);
    } catch {
      finishOverlayAction(true);
    }
  };

  const resultPending: OverlayPendingResult | undefined =
    actionPending === "copy" || actionPending === "edit" || actionPending === "insert"
      ? { action: actionPending, label: actionPending }
      : undefined;
  const previewPending: OverlayPendingPreview | undefined =
    actionPending === "commit"
      ? { action: "commit", label: "commit" }
      : actionPending === "abort"
        ? { action: "abort", label: "abort" }
        : undefined;

  const pillState: OverlayPillState | null = (() => {
    if (showError && error) {
      return { kind: "error", message: error };
    }
    if (showEditMode && previewResult) {
      return {
        kind: "edit-mode",
        text: editText,
        onTextChange: setEditText,
        onConfirm: () => void handleEditConfirm(),
        onCancel: handleEditCancel,
      };
    }
    if (renderResultPreview && activePreviewResult) {
      return {
        kind: "result-actions",
        text: finalPreviewText,
        clipboardOnly: previewClipboardOnly,
        autoCloseSec: Math.round((state.config?.result_actions_timeout_ms ?? 9000) / 1000),
        pending: resultPending,
        onCopy: () => void handleCopyResult(),
        onEdit: handleEditOpen,
        onInsert: () => void handleInsertResult(),
        onDismiss: handleDismissPreview,
      };
    }
    if (renderProcessingPreview && activePreviewResult) {
      return {
        kind: "processing",
        mode: pillMode,
        elapsedSec: elapsed,
        preview: { text: finalPreviewText, clipboardOnly: previewClipboardOnly },
        pending: previewPending,
        onCommit: () => void handleCommitPreview(),
        onAbort: () => void handleAbortPreview(),
        onCycleMode: handleCycleMode,
      };
    }
    if (isProcessing) {
      return {
        kind: "processing",
        mode: pillMode,
        elapsedSec: elapsed,
        onCycleMode: handleCycleMode,
      };
    }
    if (isRecording) {
      return {
        kind: "recording",
        mode: pillMode,
        muted,
        paused,
        level: audioLevel,
        elapsedSec: elapsed,
        onMuteToggle: () => toggleMute(),
        onPauseToggle: () => togglePause(),
        onCycleMode: handleCycleMode,
      };
    }
    return null;
  })();

  return (
    <div
      ref={shellRef}
      className="ov-scope overlay-shell"
      data-motion={overlayMotion}
      onPointerDownCapture={handleOverlayPointerDownCapture}
      onClickCapture={handleInteractiveClickCapture}
    >
      {pillState && <OverlayPill state={pillState} />}
    </div>
  );
}
