import { type MouseEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { currentMonitor, getCurrentWindow, LogicalPosition, LogicalSize } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { useNativeInsertion } from "../hooks/useNativeInsertion";
import { useRuntime } from "../hooks/useRuntime";
import "../styles/overlay.css";

const BAR_COUNT = 19;
const RUNTIME_EVENT_CHANNEL = "wordscript-event";
const OVERLAY_WIDTH = 236;
const OVERLAY_HEIGHT = 44;
const OVERLAY_WINDOW_WIDTH = OVERLAY_WIDTH;
const OVERLAY_WINDOW_HEIGHT = OVERLAY_HEIGHT;
const OVERLAY_ENTER_MS = 320;
const OVERLAY_LEAVE_MS = 240;
const OVERLAY_BOTTOM_INSET = 76;
const IDLE_WAVEFORM = [3, 4, 5, 7, 9, 11, 14, 16, 18, 16, 14, 11, 9, 7, 6, 5, 4, 4, 3];
const MIN_BAR_HEIGHT = 2;
const MAX_BAR_HEIGHT = 22;

type OverlayMotion = "idle" | "entering" | "open" | "leaving";

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
  const insertion = useNativeInsertion();
  const overlayMotionRef = useRef<OverlayMotion>("idle");
  const [showError, setShowError] = useState(false);
  const [overlayMotion, setOverlayMotion] = useState<OverlayMotion>("idle");

  const applyOverlayMotion = (next: OverlayMotion) => {
    overlayMotionRef.current = next;
    setOverlayMotion(next);
  };

  // Mark html element before first paint so the overlay window stays transparent while idle.
  useLayoutEffect(() => {
    setOverlayDocumentState(true);
    const currentWindow = getCurrentWindow();
    void currentWindow.setSize(new LogicalSize(OVERLAY_WINDOW_WIDTH, OVERLAY_WINDOW_HEIGHT)).catch(() => {});
    void currentWindow.setBackgroundColor([0, 0, 0, 0]).catch(() => {});
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

  // CSS-based visibility: idle overlay is transparent + click-through
  // This avoids GTK show()/hide() which crash under XWayland.
  useEffect(() => {
    if (!error) return;

    setShowError(true);
    const timeout = window.setTimeout(() => setShowError(false), 4200);
    return () => window.clearTimeout(timeout);
  }, [error]);

  const isActive = status === "recording" || status === "processing" || showError;
  useEffect(() => {
    const currentWindow = getCurrentWindow();

    if (isActive) {
      void currentWindow.setSize(new LogicalSize(OVERLAY_WINDOW_WIDTH, OVERLAY_WINDOW_HEIGHT)).catch(() => {});
      // Re-apply on every activation: GTK/WebKit can restore dark defaults after show().
      void currentWindow.setBackgroundColor([0, 0, 0, 0]).catch(() => {});
      void getCurrentWebview().setBackgroundColor([0, 0, 0, 0]).catch(() => {});
      setOverlayDocumentState(false);
      if (overlayMotionRef.current !== "open" && overlayMotionRef.current !== "entering") {
        applyOverlayMotion("entering");
      }

      currentMonitor().then((monitor) => {
        if (monitor) {
          const scale = monitor.scaleFactor || 1;
          const workX = monitor.position.x / scale;
          const workY = monitor.position.y / scale;
          const workWidth = monitor.size.width / scale;
          const workHeight = monitor.size.height / scale;
          const x = Math.round(workX + Math.max(0, (workWidth - OVERLAY_WINDOW_WIDTH) / 2));
          const y = Math.round(workY + Math.max(0, workHeight - OVERLAY_WINDOW_HEIGHT - OVERLAY_BOTTOM_INSET));
          currentWindow.setPosition(new LogicalPosition(x, y)).catch(() => {});
        }
      });
    } else {
      if (overlayMotionRef.current === "open" || overlayMotionRef.current === "entering") {
        applyOverlayMotion("leaving");
      }
    }
  }, [isActive]);

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
        applyOverlayMotion("idle");
      }, OVERLAY_LEAVE_MS);

      return () => window.clearTimeout(timeout);
    }
  }, [isActive, overlayMotion]);

  // Reactive waveform bars driven by native capture sample buckets.
  const [barHeights, setBarHeights] = useState<number[]>(IDLE_WAVEFORM);

  useEffect(() => {
    const unlisten = listen<AudioLevelEvent>(RUNTIME_EVENT_CHANNEL, ({ payload }) => {
      if (paused) return;

      if (payload.event === "audio_level" && typeof payload.level === "number") {
        const nextHeights = audioPayloadToHeights(payload);
        setBarHeights((current) => current.map((height, index) => {
          const target = nextHeights[index];
          const blend = target > height ? 0.82 : 0.46;
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

  const handlePillMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    void startDrag();
  };

  const isRecording = status === "recording";
  const isProcessing = status === "processing";
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

  const pillClass = [
    "pill",
    overlayMotion === "entering" ? "pill--entering" : "",
    overlayMotion === "open" ? "pill--open" : "",
    overlayMotion === "leaving" ? "pill--leaving" : "",
    isRecording && !muted ? "pill--recording" : "",
    isRecording && muted ? "pill--muted" : "",
    isRecording && paused ? "pill--paused" : "",
    isProcessing ? "pill--processing" : "",
    showError ? "pill--error" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={pillClass} onMouseDown={handlePillMouseDown}>
      <button
        type="button"
        className="pill__mic"
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
  );
}

function audioPayloadToHeights(payload: AudioLevelEvent) {
  const level = Math.min(1, Math.max(0, payload.level ?? 0));
  const rms = Math.min(1, Math.max(0, payload.rms ?? level * 0.55));
  const waveform = normalizeWaveform(payload.waveform, level);

  return waveform.map((sample) => {
    const energy = Math.min(1, sample * 1.72 + rms * 0.72 + level * 0.18);
    const shaped = Math.pow(energy, 0.86);
    const floor = Math.min(0.18, rms * 0.38 + level * 0.1);
    return Math.round(MIN_BAR_HEIGHT + (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT) * Math.max(shaped, floor));
  });
}

function normalizeWaveform(waveform: number[] | undefined, fallbackLevel: number) {
  if (!waveform?.length) {
    return Array.from({ length: BAR_COUNT }, () => Math.min(1, fallbackLevel * 0.45));
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
