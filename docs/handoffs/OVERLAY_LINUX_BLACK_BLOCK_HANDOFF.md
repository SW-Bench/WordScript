# Handoff: Linux Overlay — Finaler Stand

> Status (2026-06-20): **Alle Linux-Overlay-Probleme gelöst** außer Click-Through zu Apps *unter* dem Overlay (Layer-Shell-Grenze, `docs/STATUS.md:108`).  
> Drag, Button-Click, Always-on-Top, Clipping und Audio funktionieren zuverlässig auf KDE Plasma 6 / Wayland und XWayland.

## Gelöste Probleme

### 1. Schwarzer Block (P3)
- **Ursache:** WebKitGTK malt den äußeren `box-shadow` eines transparenten Overlay-Fensters opak (die Alpha-Bounding-Box wird schwarz statt weich komponiert).
- **Fix:** `--ov-shadow: none` + `--ov-shadow-recording: none` in `src/styles/overlay-pill.css`. Tiefe kommt über Border + inset-Highlight.

### 2. Drag + Button-Click (Input-taub)
- **Ursache:** `pointer-events: none` auf `html/body/#root.overlay-window` (für DOM-Click-Through) macht auf WebKitGTK das gesamte Pill taub, obwohl `.pill` `pointer-events: auto` hat.
- **Fix:** `pointer-events: auto` auf `.ov-scope` in `src/styles/overlay-pill.css`. DOM-Click-Through war auf Wayland ohnehin wirkungslos (OS-input-region blockt unabhängig von CSS).

### 3. Always-on-Top
- **Ursache:** `alwaysOnTop: true` (EWMH `gtk_window_set_keep_above`) wird von KWin/Wayland ignoriert — Stacking ist Compositor-Policy, kein Client-Request in xdg-shell.
- **Fix:** KWin-Script (`packaging/kwin-wordscript-overlay/`) setzt `client.layer = 4` (OverlayLayer) für das WordScript-Fenster mit `skipTaskbar`. Install: `kpackagetool6 --type=KWin/Script -i packaging/kwin-wordscript-overlay && qdbus org.kde.KWin /KWin reconfigure`.

### 4. Overlay verschwindet nach 1. Transkription
- **Ursache:** `park_overlay_window` setzt das Fenster offscreen, ruft aber kein `hide()` auf. Beim nächsten Reveal ist `was_visible=true` → der Drag-Schutz (`set_position` nur bei Hidden→Visible) überspringt die Positionierung → Fenster bleibt offscreen.
- **Fix:** `park_overlay_window` ruft `window.hide()` auf. Reveal läuft dann durch den Hidden→Visible-Zweig.

### 5. Clipping (Pill-Enden rechts/links abgeschnitten)
- **Ursache:** Zwei konkurrierende invoke-Pfade — der alte "base surface sync" (sendet ohne width/height → Rust nutzt Defaults 256/300/388) und `useLayoutEffect` (sendet 440) — kämpfen wegen GTK-async `set_size` (Fenster hinkt einen Tick hinterher). Das Fenster bleibt bei 256/388, das Pill (388+) ragt darüber hinaus.
- **Fix:** 
  - `OverlaySurface::dimensions()` in `src-tauri/src/lib.rs` auf fixe Größen: flat (compact/processing/result) = 440×60, edit = 460×164. Beide Pfade senden jetzt konsistent 440.
  - `resizable: true` in `tauri.conf.json` (GTK ignoriert `set_size` bei `resizable: false`).
  - `set_background_color` bei **jedem** Reveal (nicht nur bei `size_changed`) → erzwingt Repaint, verhindert dass WebKitGTK die alte compositing-Layer behält (States überlagern sich sonst beim Wechsel).
  - `will-change: opacity` vom Pill entfernt (reduziert Layer-Cache).
  - `src/windows/OverlayWindow.tsx`: fixe Größe pro Surface (440×60 flat, 460×164 edit), kein pill-basiertes Measuring mehr.
  - **Nachtrag (2026-06-24, Plan 1782308448580):** `set_background_color` bei jedem Reveal reicht fuer die Black-Bar, aber nicht fuer das flat→flat-Stale-Layer-Overlap – die via `transform: scale(0.87)` promoted `.pill`-Layer wurde beim Surface-Wechsel retained (Ghost). Eine Opacity-Subpixel-Toggle-Runde brachte nichts (Pill hatte nie `will-change`, und Opacity-Toggeln innerhalb derselben promoted Layer erzwingt keinen Teardown). Realer Fix: visuelle `scale(0.87)` von `.pill` auf einen persistenten Wrapper `.ov-pill-shell` verschoben (`OverlayWindow.tsx` + `overlay-pill.css`); `.pill` ist jetzt transformfrei (auch `.pill--error`), sodass beim kind-Swap keine promoted Pill-Layer mehr orphaned. `.overlay-shell` bleibt transformfrei (Fenster-Sizing). Siehe `docs/STATUS.md`.
  - **Nachtrag (2026-06-29, Plan 1782750354086) – flat→flat-Ghosting endgültig behoben:** Der Wrapper-Fix war unvollständig: (a) die animierten Child-Layer (`ov-shimmer` auf Processing-Bars, `ov-breathe` auf Muted-Bars, `ov-spin` auf dem Spinner) orphanten beim Surface-Wechsel weiterhin und bleiben als Geist stehen ("alte States verschwinden verzögert"); (b) `set_size`/`set_background_color` auf denselben Wert sind für WebKitGTK ein No-op (keine Backing-Store-Reallokation, `outer_size()` meldet auf dem Setup 0×0). Zwei deterministische Maßnahmen: `<OverlayPill key={kind}>` remountet die Subtree pro Surface komplett (Child-Layer werden freigegeben, frische entstehen); `reveal_overlay_window` oszilliert die flat-Fensterhöhe pro Reveal um 1px (60↔61 via `OVERLAY_FLAT_REVEAL_TICK`) → echte `set_size`-Änderung → Backing-Store-Reallokation → vollständiger Repaint, der alle retained Layer löscht, bevor der neue Surface malt. 1px im transparenten, zentrierten Fenster unsichtbar. Bestätigt auf KDE Plasma 6 / XWayland.

### 6. Audio-Regression (gar kein Audio)
- **Ursache:** Der Poller-Thread (60Hz `cursor_position` + `set_ignore_cursor_events`) destabilisierte den Audio-Init.
- **Fix:** Poller entfernt. `park→hide`-Fix stellte Audio wieder her.

## Offene Punkte

### Click-Through zu Apps unter dem Overlay
- **Status:** Nicht lösbar mit Tauri-Mitteln (`docs/STATUS.md:108`). Die drei evaluierten Ansätze (GTK `input_shape_combine_region`, `setIgnoreCursorEvents`, JS `setPosition`) scheitern alle an architektonischen Grenzen.
- **Lösung:** Layer-Shell (`wlr-layer-shell-unstable-v1` oder `org.kde.kwin.layer-shell`) — eigener großer Slice. Das KWin-Script löst nur Always-on-Top, nicht Click-Through.

## Dateistruktur

| Datei | Zweck |
|-------|-------|
| `packaging/kwin-wordscript-overlay/` | KWin-Script für Always-on-Top (metadata.json + contents/code/main.js) |
| `src-tauri/src/lib.rs` | Rust-Logik: `park→hide`, fixe `dimensions()`, `set_background_color` immer, min/max-Pin |
| `src-tauri/src/main.rs` | XWayland-default (`GDK_BACKEND=x11`), `WORDSCRIPT_NATIVE_WAYLAND=1` opt-in, GPU-Compositing standardmäßig aktiviert (`WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING=1` opt-out), `WEBKIT_DISABLE_DMABUF_RENDERER=1` |
| `src-tauri/tauri.conf.json` | `resizable: true`, `width: 440, height: 60`, `focus: false` |
| `src/styles/overlay-pill.css` | `--ov-shadow: none`, `pointer-events: auto`, `will-change` entfernt |
| `src/windows/OverlayWindow.tsx` | Fixe Größe useLayoutEffect (440×60 flat, 460×164 edit), DEV-Logs (`[ov-dom]`, `[ov-reveal]`-Listener) |

## Diagnose

DEV-only Logs (`[ov-dom]` im Frontend, `[ov-reveal]` im Rust via Tauri-Event) bleiben vorerst im Code. Sie spiegeln Fenster-Größe (req/outer/inner) und DOM-Größen (Pill offsetWidth, Webview innerWidth) in die Console — nützlich für zukünftige Diagnose ohne Terminal-Zugriff.
