# WordScript Overlay — Phase 1 Handoff

## Projekt-Kontext

WordScript ist ein Tauri-v2-Desktopprodukt (React/TypeScript UI + Rust Runtime) für Trigger, Capture, Transform, Insert und Updates. Das Overlay ist eine schwebende Kapsel die Transkriptions-States anzeigt.

**Phase 1 Ziel**: Visuelle Schicht isoliert rebuilden (keine Tauri-Integration). Alle States in einer Dev-Gallery rendern.

**Phase 2 Ziel** (nicht begonnen): OverlayPill in das transparente Always-on-Top-Fenster integrieren, States vom Rust-Backend treiben, `window.set_size()` via ResizeObserver.

---

## Architektur

### Komponente: `OverlayPill`

**Datei**: `src/components/overlay/OverlayPill.tsx`

Render-only Komponente, gesteuert durch discriminated-union `state` prop. Kein eigener State.

```typescript
export type OverlayPillState =
  | { kind: "recording"; mode; muted; paused; level; elapsedSec; handlers... }
  | { kind: "processing"; mode; elapsedSec; preview?; pending?; handlers... }
  | { kind: "result-actions"; text; clipboardOnly; autoCloseSec; pending?; handlers... }
  | { kind: "edit-mode"; text; handlers... }
  | { kind: "error"; message };
```

**Sub-Komponenten** (internal):
- `RecordingPill`, `ProcessingPill`, `ResultActionsPill`, `EditPill`, `ErrorPill`
- `MicButton`, `Bars`, `ModeChip`, `PreviewText`, `SideButton`
- `PreviewActions`, `ResultActions`, `IconAction` (icon-only, busy→spinner)

### Styles: `overlay-pill.css`

**Datei**: `src/styles/overlay-pill.css`

Isolierte CSS mit `--ov-*` Tokens. **KEIN `backdrop-filter`/blur** (Linux unsupported, transparent window kann Desktop nicht sehen). Fake-glass via solid semi-transparent fill + hairline top highlight.

**Wichtige Tokens**:
```css
--ov-surface: rgba(27,27,29,0.90)
--ov-accent: #e8912a
--ov-radius-compact: 999px
--ov-radius-tall: 14px
```

**Pill-Root**:
```css
.ov-scope .pill {
  display: inline-flex;
  width: max-content;
  /* flex-basis wird NICHT gesetzt — width:max-content als cross-axis size
     in column-direction stage wird direkt respektiert */
}
```

### Gallery: `OverlayGallery`

**Datei**: `src/windows/OverlayGallery.tsx`

Dev-Route (`#/overlay-gallery`) rendert alle 9+ States auf neutralem Backdrop. Mock-Audio-Slider (0..1) treibt Waveform. Mock-Handler für Mute/Pause/Mode-Cycle/Edit.

**Card-Layout**:
- Grid: `repeat(auto-fill, minmax(480px, 1fr))`
- Breite Pills (preview/result/pending) nutzen `og-card--wide` → `grid-column: 1 / -1`
- Stage: `display: flex; flex-direction: column; align-items: center; justify-content: center`

---

## Wichtige Entscheidungen

### 1. Keine `backdrop-filter` (Hard Constraint)

Linux unterstützt native vibrancy nicht, und ein transparentes Fenster kann den Desktop hinter sich nicht sehen. Fake-glass via solid fill + faux top highlight. **Nicht "helpfully" Blur hinzufügen.**

### 2. Capsule Shape

Compact pills: `border-radius: 999px`. Edit-mode tall pill: `border-radius: 14px`.

### 3. Adaptive Width

Jeder State sized zu seinem Content. Idle/tiny → recording (~298px) → processing (~313px) → preview (~435px) → result (~489px) → edit (380px fixed) → error (~241px). **Nicht alle States gleiche Breite.**

### 4. Icon-Only Actions

Alle Action-Buttons sind icon-only (Copy/Pencil/X/Pause/Play/Check/Square/CornerDownLeft). Busy-State zeigt `Loader2` Spinner statt Icon. **Insert/Confirm bleiben primary** (accent-filled background `#e8912a`), visuell dominant gegenüber ghost peers.

**MANDATORY**: Jeder icon-only Button hat `title="..."` + `aria-label="..."` (Tooltip + Screenreader). Min. 28px hit target.

### 5. Mode Chip bleibt Text

Mode-Cycler ("Agent"/"Cleanup"/etc.) ist Information, keine Action. Kein Icon.

### 6. CSS-Scope via `.ov-scope`

Alle Pill-Styles sind unter `.ov-scope` gescoped um Konflikte mit der alten `overlay.css` zu vermeiden. Die Gallery wrapt in `<div className="ov-scope">`. Phase 2 wird das Overlay-Fenster-Root ebenfalls mit `ov-scope` markieren.

### 7. Legacy `overlay.css` Neutralisation

In Vite-Dev wird die alte `overlay.css` (für `OverlayWindow`) eager geladen via `OverlayWindow`-Import im Modulgraph. Sie hat konkurrierende Regeln (z.B. `.pill--compact.pill--recording { max-width: 296px }`).

**Workaround**: `.ov-scope .pill.pill--*` Overrides mit 0,3,0 Spezifität neutralisieren `max-width` + `width: 100%` auf `.pill__side`.

**Dauerhafte Lösung** (nicht implementiert): `React.lazy` für `OverlayWindow` → alte CSS nur auf `/overlay`-Route geladen.

---

## States (9 + 1 Bonus)

1. **recording** — Accent mic, live waveform, mode chip, side-btn "Pause"
2. **recording + muted** — Struck mic, RED bars "breathe" anim, red-orange border
3. **recording + paused** — Bars dimmed (opacity .32), blinking timer, side-btn "Paused"
4. **processing** — Shimmer anim on bars, side-btn "Working", weaker accent border
5. **processing-preview** — Text preview + inline actions: Insert/Copy + Abort
6. **result-actions** — Final text + inline icon actions: Copy, Edit, (Insert if clipboard_only); auto-close 9s
7. **edit-mode** — Taller pill, editable textarea, Confirm/Cancel icon-btns, resize handle bottom-right
8. **error** — Error text, red-orange border, red glow on mic, pill translateY(-2px)
9. **action-pending** — All buttons disabled, spinner icon, cursor progress

Bonus: **result-actions clipboard_only** (zeigt Insert-Button)

---

## Motion (CSS Keyframes)

Alle GPU-cheap (`transform` + `opacity`):

- `overlay-panel-in`: 320ms fade+scale enter
- `overlay-panel-out`: 240ms fade leave
- `ov-shimmer`: processing bars sweep (1.4s infinite)
- `ov-breathe`: muted bars pulse (2.2s infinite)
- `ov-timer-blink`: paused timer blink (1s steps)
- `ov-spin`: busy spinner rotation (0.7s linear infinite)

`prefers-reduced-motion: reduce` → alle Animationen auf 0.01ms.

---

## Testing

### Build Validation

```bash
npm run build  # tsc && vite build
```

Typecheck + Bundle. Immer grün halten.

### Visual Verification

Playwright-Script mit vorhandenem Chromium-Binary (`/home/felixontv/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`):

```bash
# Dev server starten
npm run dev  # → http://localhost:1420/#/overlay-gallery

# Playwright check (script in /tmp/kilo/)
node _verify.mjs
```

Checkt:
- Clipping (scrollWidth > clientWidth)
- Card overflow (negative offsets)
- Icon buttons haben title + aria-label
- Primary buttons haben accent background
- Pill widths (adaptive, verschiedene pro State)

### Dev Server

Port 1420 (Tauri default). Bei Konflikt: `fuser -k 1420/tcp`.

---

## Offene Punkte / Phase 2

### 1. React.lazy für OverlayWindow

**Problem**: Alte `overlay.css` wird in Dev eager geladen → Konflikte mit neuer `overlay-pill.css`.

**Lösung**: `OverlayWindow` via `React.lazy` + `Suspense` lazy-loaden → alte CSS nur auf `/overlay`-Route.

**Datei**: `src/App.tsx`

```tsx
const OverlayWindow = lazy(() => import("./windows/OverlayWindow"));
```

### 2. Tauri Integration

- `OverlayPill` in transparentes Always-on-Top-Fenster mounten
- States vom Rust-Backend treiben (via `useRuntime` hook oder direkter IPC)
- `window.set_size()` via ResizeObserver damit Fenster Pill-Größe trackt
- `ov-scope` auf Fenster-Root setzen

### 3. Window Resize Logic

Phase 2: `ResizeObserver` auf Pill → `invoke("resize_overlay", { width, height })`. Edit-mode braucht dynamische Höhe basierend auf Textmenge.

### 4. Echte Handler

Gallery nutzt Mock-Handler (`() => {}`). Phase 2: echte IPC calls (`commit_pending_transcription_preview`, `insert_text_native`, etc.).

### 5. Auto-Close Timer

Result-actions haben `autoCloseSec` prop (default 9s). Gallery ignoriert es. Phase 2: Timer starten, nach Ablauf `onDismiss` feuern.

---

## Bekannte Issues

### 1. Legacy CSS in Dev

Alte `overlay.css` Regeln werden in Vite-Dev geladen. Workaround: 0,3,0 Spezifität Overrides in `overlay-pill.css`. Dauerhafte Lösung: React.lazy (siehe oben).

### 2. Gallery Card Widths

Breite Pills (result/pending ~500-650px) brauchen `og-card--wide` (full grid row). Normale Cards (recording/edit ~300-380px) passen in 480px min.

### 3. Playwright Chrome Channel

Playwright MCP sucht `/opt/google/chrome/chrome` (Chrome channel). In Sandbox nicht installierbar (sudo required). Workaround: Chromium-1228 Binary direkt nutzen (`/home/felixontv/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`).

---

## Dateistruktur (relevant)

```
src/
├── components/
│   └── overlay/
│       └── OverlayPill.tsx          # Render-only Komponente
├── styles/
│   ├── overlay.css                  # ALTE Styles (OverlayWindow) — NICHT anfassen
│   └── overlay-pill.css             # NEUE Styles (Phase 1)
├── windows/
│   ├── OverlayWindow.tsx            # Altes Overlay (Phase 2 ersetzt)
│   ├── OverlayGallery.tsx           # Dev Gallery (Phase 1)
│   └── App.tsx                      # Routes
└── main.tsx                         # Entry
```

---

## Commands

```bash
npm install          # Dependencies
npm run dev          # Dev server (http://localhost:1420)
npm run build        # Typecheck + Bundle
npm test             # Vitest
npm run tauri dev    # Tauri dev (nicht für Phase 1)
```

---

## Constraints (Hard)

- **KEIN `backdrop-filter`/blur** — Linux unsupported, transparent window sieht Desktop nicht
- **Capsule shape** — 999px radius (compact), 14px (edit-mode)
- **Adaptive width** — jeder State sized zu Content, nicht alle gleich
- **Single accent** — `#e8912a` (warm orange), sonst neutral/dark
- **Inline icon-buttons** — kein separater Button-Bar
- **Min font-size 11px**
- **aria-label auf jedem icon-only Button**
- **State logic OUTSIDE Komponente** — OverlayPill rendert nur

---

## Nächster Agent: Wo weitermachen

1. **React.lazy für OverlayWindow** implementieren (löst legacy CSS Problem)
2. **Phase 2 starten**: OverlayPill in transparentes Fenster integrieren
3. **Tauri IPC**: States vom Backend treiben, Handler implementieren
4. **ResizeObserver**: Fenster-Größe trackt Pill-Größe
5. **Testing**: E2E Tests für Overlay-States (Recording → Processing → Result → Insert)

---

## Visual Reference

Screenshots liegen in `/tmp/kilo/`:
- `overlay-gallery-final.png` — alle States, zentriert, kein Clipping
- `overlay-gallery-icons.png` — icon-only buttons, primary Insert akzentuiert

Dev-Server starten + Gallery öffnen:
```bash
npm run dev
# Browser: http://localhost:1420/#/overlay-gallery
```
