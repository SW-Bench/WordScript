# Handoff: Settings Scroll-Performance Fix

**Datum:** 2026-06-21  
**Status:** Implementiert und validiert

## Problem

Das Settings-Fenster ruckelte extrem beim Scrollen, besonders im History-Tab, Profiles-Tab und allen anderen UI-Settings-Tabs. Das Problem war besonders ausgeprägt, wenn das Fenster auf einen 27-Zoll-Monitor skaliert wurde (fullscreen). In einem kleinen Fenster war das Scrollen smooth.

## Root Cause

### Primär: GPU-Compositing deaktiviert

`src-tauri/src/main.rs` setzte standardmäßig `WEBKIT_DISABLE_COMPOSITING_MODE=1`. Diese Variable zwang WebKitGTK in den Cairo-Software-Rendering-Pfad. Ursprünglich eingeführt um den Overlay-Black-Block-Bug zu fixen (WebKitGTK malte runde Ecken als schwarze Blöcke auf Nvidia hybrid GPUs, tauri-apps/tauri#14924).

Ohne GPU-Compositing:
- Jeder Scroll-Frame wurde komplett CPU-gerendert
- `box-shadow`, `backdrop-filter`, `transform` waren extrem teuer
- Bei Fenster-Skalierung musste das gesamte Layout neu berechnet werden
- `content-visibility: auto` konnte nicht effizient arbeiten

### Sekundär: CSS-Kosten skalieren mit Viewport-Größe

Der Kommentar in `globals.css` beschrieb das Problem exakt: "compositing every currently-rendered card across the whole viewport — which scales with the visible viewport area, exactly why scrolling stuttered badly in fullscreen but not in a small window."

Verstärkende Faktoren:
- `shadow-card` (2 Layer Box-Shadow) auf jeder FormCard, StatTile und Rule-Card
- `backdrop-filter: blur(12px)` auf der `.material`-Klasse (Sidebar active state, Cards)
- `body` background-gradient (radial + linear) wurde pro Scroll-Frame neu compositet
- `transition-colors` auf Scroll-Containern (Rule-Cards, Profile-Buttons, Tab-Buttons)
- History-Tab: 1.5s Refresh-Interval triggerte Re-Renders während des Scrollens
- `animate-in fade-in-50` CSS-Animation bei Tab-Wechsel mit `key={active}` (Remount)

## Lösung

### Phase 1: GPU-Compositing aktivieren

**Datei:** `src-tauri/src/main.rs:28-49`

- `WEBKIT_DISABLE_COMPOSITING_MODE` standardmäßig entfernt (GPU an)
- `WEBKIT_DISABLE_DMABUF_RENDERER=1` beibehalten (verhindert GBM buffer errors)
- Neues Opt-out: `WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING=1` für Hardware wo Overlay Black-Blocks zeigt
- Alte `WORDSCRIPT_ENABLE_WEBKIT_COMPOSITING`-Variable entfernt (war invertiert und verwirrend)

**Ergebnis:** Overlay zeigt keine schwarzen Blöcke mehr. Ghosting-Bug bleibt (separat dokumentiert in `docs/BUG_OVERLAY_GHOSTING.md`).

### Phase 2: CSS-Kostenreduktion

**`src/styles/globals.css`:**
- `--shadow-card` von 2 Layer auf 1 Layer reduziert, dann komplett von allen Settings-Karten entfernt
- `.material`-Klasse: `backdrop-filter: blur(12px) saturate(140%)` entfernt, durch solid `background: var(--surface-2)` + inset shadows ersetzt
- Zweite `.material` Definition (Zeile 509-511) mit `backdrop-filter` entfernt
- `body` background-gradient: `background-attachment: fixed` hinzugefügt (verhindert Re-Composite pro Scroll-Frame)

**`src/components/shell/FormCard.tsx`:**
- `shadow-card` entfernt
- `contain-layout contain-paint` hinzugefügt (unabhängiges Compositing)

**`src/components/shell/StatTile.tsx`:**
- `shadow-card` entfernt

**`src/components/settings/PromptsTab.tsx`:**
- `shadow-card` von Rule-Cards und Workspace-Tabs entfernt
- `transition-colors` von Rule-Cards, Profile-Buttons und Tab-Buttons entfernt

**`src/components/areas/HomeRecentList.tsx`:**
- `transition-colors` entfernt

### Phase 3: React/Scroll-Optimierung

**`src/hooks/useTranscriptionHistory.ts`:**
- `REFRESH_INTERVAL_MS` von 1500ms auf 5000ms erhöht

**`src/windows/SettingsWindow.tsx`:**
- `animate-in fade-in-50 duration-150` bei Tab-Wechsel entfernt
- Scroll-Container: `contain-layout contain-paint` + `overscroll-contain` + `[scrollbar-gutter:stable]` + `[will-change:scroll-position]`
- Content-Wrapper: `[contain:content]`

## Validierung

- `cargo test`: 261 Tests grün
- `npm run build`: grün
- `npm test`: 70 Tests grün (4 Storybook-Failures sind pre-existing, netzwerkbezogen)
- Overlay: keine schwarzen Blöcke, Ghosting marginal verstaerkt (separater Bug)
- Settings: smooth scrolling in allen Tabs, auch bei 27-Zoll fullscreen
- Verbleibende minimale Ruckler beim Skalieren kommen vom nativen Resize-Event (WebKitGTK muss Fenster-Backing neu allozieren)

## Opt-out

Falls auf bestimmter Hardware das Overlay mit GPU-Compositing Black-Blocks zeigt:

```bash
WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING=1 npm run tauri dev
```

Das stellt den alten Cairo-Software-Rendering-Pfad wieder her.

## Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `src-tauri/src/main.rs` | GPU-Compositing standardmäßig an, Opt-out via `WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING` |
| `src/styles/globals.css` | `shadow-card` 1 Layer, `.material` ohne backdrop-filter, `background-attachment: fixed`, Doku-Kommentare aktualisiert |
| `src/components/shell/FormCard.tsx` | `shadow-card` entfernt, `contain: layout paint` hinzugefügt |
| `src/components/shell/StatTile.tsx` | `shadow-card` entfernt |
| `src/components/settings/PromptsTab.tsx` | `shadow-card` und `transition-colors` entfernt |
| `src/components/areas/HomeRecentList.tsx` | `transition-colors` entfernt |
| `src/hooks/useTranscriptionHistory.ts` | Refresh-Interval 1500ms → 5000ms |
| `src/windows/SettingsWindow.tsx` | Tab-Wechsel-Animation entfernt, Scroll-Container-Optimierungen |
| `docs/STATUS.md` | Neuer Eintrag für Scroll-Ruckeln-Fix |
| `docs/DESIGN_SYSTEM.md` | Motion, Form-Kit, Content-Visibility, Scroll-Performance Sektionen aktualisiert |
| `docs/DEVELOPMENT.md` | Neue Gotchas für GPU-Compositing, shadow-card, backdrop-filter, background-attachment, contain, transition-colors, Refresh-Interval, Tab-Wechsel-Animation |
| `docs/ROADMAP.md` | Scroll-Performance-Fix zu Phase 2 hinzugefügt |
| `docs/BUG_OVERLAY_GHOSTING.md` | Status aktualisiert: GPU-Compositing an, Black-Block weg, Ghosting bleibt |
| `docs/handoffs/OVERLAY_LINUX_BLACK_BLOCK_HANDOFF.md` | main.rs Dateistruktur-Eintrag aktualisiert |