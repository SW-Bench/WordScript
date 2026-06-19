# WordScript Overlay — Phase 1 Final Handoff

## Component

**OverlayPill** (`src/components/overlay/OverlayPill.tsx`) ist render-only, gesteuert durch einen discriminated-union `state` prop. Owns no internal state; alle Interaktionen sind callback props (z.B. `onTogglePause`), in der Gallery als no-ops gestubbt.

### States
- `recording` (+ `muted`, `paused` subvariants)
- `processing` (+ `preview` subvariant)
- `result-actions` (+ `clipboardOnly` variant)
- `edit-mode`
- `error`
- `action-pending` (via `pending` prop auf processing/result-actions)

---

## Decisions Locked In

### Icon-Only Actions
Alle Actions sind icon-only (lucide-react), jede mit `title` + `aria-label`:
- **Copy**: Clipboard icon
- **Edit**: Pencil icon
- **Dismiss**: X icon
- **Abort**: Square icon (distinct von Cancel's X)
- **Cancel**: X icon
- **Confirm**: Check icon
- **Insert**: CornerDownLeft icon
- **Status/Busy**: Loader2 spinner (rotiert via `ov-spin` keyframe)

**Primary Actions** (Insert, Confirm): accent-filled (`#e8912a`), visuell dominant. Alle anderen sind ghost icon-buttons.

**Mode Chip** ("Agent"/"Cleanup"/etc.): bleibt TEXT — Information, keine Action.

### Timer als Pause/Resume-Control
- **Kein Pause/Play Side-Button** mehr
- Der **Timer ist das Pause/Resume-Control** (Button → `onTogglePause` prop)
- Paused state blinkt (via `ov-timer-blink` keyframe)
- Timer sichtbar in allen aktiven States (recording, processing), positioniert nach dem Mode-Chip hinter einem Hairline
- Processing-Timer ist ein `<span>` (Status-Indikator), Recording-Timer ist ein `<button>` (interaktiv)

### Separators
Neutrale Hairlines nur: `1px`, `rgba(255,255,255,0.10)`. Accent-Farbe (`#e8912a`) ist **strikt reserviert** für Primary Action + aktives Mic — niemals Divider.

### Faux-Glass (KEIN Blur)
```css
background: rgba(27, 27, 29, 0.90);
```
**Warum kein `backdrop-filter`**: Transparentes Overlay-Fenster kann den Desktop hinter sich nicht sehen (Linux/Wayland limitation). Native vibrancy unsupported. Solid semi-transparent fill + hairline top highlight (`--ov-highlight: inset 0 1px 0 rgba(255,255,255,0.06)`).

**NIEMALS `backdrop-filter` hinzufügen** — das war ein wiederkehrender Bug in früheren Iterationen.

### Capsule Geometry
- **Compact pills**: `border-radius: 999px`
- **Edit-mode tall pill**: `border-radius: 14px`
- **Adaptive width**: `display: inline-flex; width: max-content` — jeder State sized zu seinem Content

### Scale Knob
Pill skaliert um ~13% via **single transform knob**:
```css
.ov-scope .pill {
  transform: scale(0.87);
  transform-origin: center;
}
```
Alle relativen Proportionen bleiben erhalten. Tunable: eine Zahl ändern.

### Horizontal Padding (Canonical: 6px)
Recording-State definiert den kanonischen Inset: **6px links/rechts**. Alle anderen Pill-Varianten teilen diesen Wert:
```css
.ov-scope .pill { padding: 0 6px; }
.ov-scope .pill--result-actions,
.ov-scope .pill--preview-actions { padding-left: 6px; padding-right: 6px; }
.ov-scope .pill__edit-body { padding: 12px 6px; }
```

### Motion (transform/opacity only, GPU-cheap)
- `overlay-panel-in`: 320ms fade+scale enter
- `overlay-panel-out`: 240ms fade leave
- `ov-shimmer`: processing bars sweep (1.4s infinite)
- `ov-breathe`: muted bars pulse (2.2s infinite)
- `ov-timer-blink`: paused timer blink (1s steps)
- `ov-spin`: busy spinner rotation (0.7s linear infinite)
- `prefers-reduced-motion: reduce` → alle Animationen auf 0.01ms

---

## Files & How to Run

### Files
- `src/components/overlay/OverlayPill.tsx` — render-only Komponente
- `src/styles/overlay-pill.css` — isolierte Styles (Tokens: `--ov-*`)
- `src/windows/OverlayGallery.tsx` — Dev Gallery
- `src/App.tsx:11` — Route `#/overlay-gallery`

### Run
```bash
npm run dev
# → http://localhost:1420/#/overlay-gallery
```

### Build
```bash
npm run build  # tsc && vite build, currently green
```

---

## Phase 2 Scope (NOT done yet — next chat's job)

### Wire into Tauri Window
- Mount `OverlayPill` in transparentes Always-on-Top-Fenster
- `state` prop vom Rust-Backend treiben (via `useRuntime` hook oder direkter IPC)
- `window.set_size()` via ResizeObserver damit Fenster Pill-Größe trackt
- Idle state = Fenster hidden + click-through (nicht in Gallery gezeigt)

### Real Callbacks
- `onTogglePause`: Pause/Resume Capture
- `onCopy`: Copy to clipboard
- `onInsert`: Type into focused app (native insert)
- `onEdit`: Open edit mode
- `onAbort`: Abort processing
- `onConfirm`: Confirm edit
- `onCancel`: Cancel edit
- `onDismiss`: Dismiss result

### Auto-Close Timers
- Result-actions: ~9s default (`autoCloseSec` prop)
- Error: ~4.2s
- Wire to real timers, fire `onDismiss` on expiry

### React.lazy (Recommended)
```tsx
const OverlayWindow = lazy(() => import("./windows/OverlayWindow"));
```
Löst legacy `overlay.css` Konflikt in Vite-Dev (alte CSS nur auf `/overlay`-Route geladen).

---

## Open Questions (Phase 2)

1. **"Done" semantics**: Wir haben "Done" zu einem einzelnen Dismiss/X collapsed. Wenn es tatsächlich eine Accept-Action braucht, revisit.

2. **Insert glyph readability**: CornerDownLeft bei 0.87 scale — verify clarity at real size.

---

## Legacy CSS Neutralization (Vite-Dev Only)

Alte `overlay.css` wird in Vite-Dev eager geladen (via `OverlayWindow` import). Workaround: 0,3,0 Spezifität Overrides in `overlay-pill.css`:
```css
.ov-scope .pill.pill--compact,
.ov-scope .pill.pill--recording,
/* ... alle Varianten ... */ {
  max-width: none;
}

.ov-scope .pill__mode::before {
  content: none !important;
  display: none !important;
  /* ... neutralize legacy orange bar ... */
}
```

**Dauerhafte Lösung**: React.lazy für OverlayWindow (siehe oben).

---

## Visual Reference

Screenshots liegen in `/tmp/kilo/`:
- `overlay-gallery-final-v6.png` — letzter Stand (Timer als Pause-Control, 6px padding, 0.87 scale)

Dev-Server starten + Gallery öffnen:
```bash
npm run dev
# Browser: http://localhost:1420/#/overlay-gallery
```
