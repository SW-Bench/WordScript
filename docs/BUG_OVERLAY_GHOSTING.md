# Bug: Overlay Ghosting / State Bleeding

**Status:** Offener Bug, noch nicht gefixt. GPU-Compositing wurde am 2026-06-21 standardmäßig aktiviert (siehe Update unten), der Black-Block-Bug tritt nicht mehr auf, das Ghosting bleibt aber sichtbar (evtl. marginal verstaerkt).  
**Erstmals berichtet:** Phase 2 Follow-up, nach 12h real-world use  
**Betrifft:** Linux Overlay (WebKitGTK), alle Oberflächen-Übergänge

## Symptome

### Szenario 1: Recording → Result-Actions
Nach Abschluss einer Aufnahme wird die Result-Actions-Pille (mit Copy/Edit/Insert-Buttons) angezeigt, aber die vorherige Recording-Pille (insbesondere die Waveform-Balken) scheint schwach durch den semi-transparenten Hintergrund der neuen Pille durch.

### Szenario 2: Neues Recording während Leave-Animation
Wenn ein neues Recording gestartet wird, während die vorherige Overlay-Pille noch in der Leave-Animation (240ms "Diminishing-Zeit") ist, wird die neue Recording-Pille angezeigt, aber der vorherige Overlay-State (z.B. Result-Actions oder ein vorheriges Recording) wird überlagert/ghosted hinter der neuen Pille sichtbar.

## Diagnose-Ergebnisse

### Bug-Klasse: (B) Composited-Layer-Cache

Detaillierte Analyse durch Research-Agents und Code-Inspektion bestätigt: **Es ist kein DOM-Leak** (es existiert immer nur ein `<OverlayPill>` Element im DOM), **kein State-Machine-Race** (die `overlayMotion`-Zustandsmaschine hat korrekte Guards), sondern ein **WebKitGTK Compositing-Layer-Cache-Problem**.

> **Update 2026-06-21:** GPU-Compositing ist jetzt standardmäßig aktiviert (`src-tauri/src/main.rs`). Der Black-Block-Bug tritt mit dem Overlay-Shadow-Fix (`--ov-shadow: none`) und `WEBKIT_DISABLE_DMABUF_RENDERER=1` nicht mehr auf. Der Ghosting-Bug bleibt offen und sollte mit aktiviertem GPU-Compositor neu evaluiert werden – die Compositor-Layer-Cache-Hypothese könnte sich anders verhalten als im deaktivierten Modus.

### Root Causes (drei konvergierende Faktoren)

1. **`transform: scale(0.87)` auf `.pill`** (`src/styles/overlay-pill.css:83`)
   - Toter Code: Die `.pill--entering/--open/--leaving` CSS-Klassen, die diesen Transform hätten übersetzen sollen, werden **nie** angewendet (verifiziert via grep: keine Anwendung in OverlayPill.tsx, OverlayWindow.tsx, OverlayGallery.tsx)
   - Der `transform` hebt die Pille auf eine **eigene Compositor-Layer**
   - WebKitGTK cached diese Layer beim Unmount und rendert sie beim nächsten Paint durch

2. **`key={pillKind}` auf `<OverlayPill>`** (falscher Fix-Versuch)
   - Erzwingt Unmount/Remount bei jedem Surface-Wechsel
   - Veranlasst WebKitGTK, die alte Layer zwischenzuspeichern
   - Hatte das Problem verschlimmert statt behoben

3. **Halbtransparenter Pille-Hintergrund** `rgba(27, 27, 29, 0.90)`
   - Lässt die zwischengespeicherten Pixel der alten Layer zu 10% durchscheinen
   - Da das Overlay-Fenster ohnehin nicht den Desktop dahinter sieht (kein echtes Blur/Vibrancy auf Linux), war die Transparenz rein optisch und hat nur dem Ghosting gedient

### Warum existierende Fixes nicht ausreichen

- `set_background_color` bei jedem Reveal (`src-tauri/src/lib.rs:436`) — soll die Layer invalidieren, ist aber async IPC und invalidiert nicht immer vor dem nächsten Paint
- `key={pillKind}` — hatte das Problem verschlimmert (erzwingt Layer-Cache-Eviction)
- Die `holdPreviewDuringClose`-Logik ist korrekt und nicht die Ursache

### Ausgeschlossene Ursachen

- **(A) DOM-Leak:** Nein — nur ein `<OverlayPill>` Element im DOM (kein AnimatePresence, keine Portals, strikte if/else-Kette in pillState-Ableitung)
- **(C) State-Machine-Race:** Nein — die `overlayMotion`-Zustandsmaschine hat korrekte Guards (`overlayMotionRef.current !== "leaving"` Check im Leave-Timer, Effect-Cleanup cancelt den Timer)

## Fehlgeschlagene Fix-Versuche

### Versuch 1: `key={pillKind}` + `pillKind` in Dependencies
- **Ansatz:** React zwingen, die Pille bei jedem Zustandswechsel neu zu mounten
- **Ergebnis:** Verschlimmert das Problem — erzwingt Layer-Cache-Eviction bei jedem Surface-Wechsel
- **Status:** Zurückgenommen

### Versuch 2: `pillKind` in `useLayoutEffect` Dependencies
- **Ansatz:** `sync_overlay_window_visibility` bei jedem Zustandswechsel aufrufen
- **Ergebnis:** Reicht nicht — async IPC, invalidiert nicht immer vor Paint
- **Status:** Zurückgenommen

### Versuch 3: `transform: scale(0.87)` entfernen + opaker Hintergrund
- **Ansatz:** Compositor-Layer-Formation verhindern + Ghosting durch Opazität blockieren
- **Ergebnis:** Wurde vom Benutzer verworfen (visuelle Regression befürchtet)
- **Status:** Zurückgenommen

## Mögliche Lösungsansätze (für zukünftige Implementation)

### Ansatz A: Stabile Pille ohne Unmount
- `key={pillKind}` entfernen (bereits geschehen)
- Pille als stabiles DOM-Element behalten, nur Content swappen
- Verhindert Layer-Cache-Eviction-Trigger
- **Risiko:** React-Reconciliation könnte bei unterschiedlichen Pill-Strukturen komplex werden

### Ansatz B: Opaker Hintergrund
- `--ov-surface` von `rgba(27,27,29,0.90)` → `#1b1b1d` (opak)
- Blockiert jedes residuelle Durchscheinen
- **Risiko:** Visuelle Regression (Pille sieht "schwerer" aus)

### Ansatz C: Transform entfernen
- `transform: scale(0.87)` + `transform-origin: center` entfernen
- Verhindert eigene Compositor-Layer-Formation
- **Risiko:** Pille wird größer (87% → 100%), Layout-Anpassungen nötig

### Ansatz D: Native Repaint erzwingen
- Tauri API `request_redraw()` (falls verfügbar in Tauri v2)
- Oder 1px Size-Jiggle (`set_size(w+1, h)` dann `set_size(w, h)`)
- **Risiko:** Async-Timing, möglicherweise nicht zuverlässig

### Ansatz E: Kombination A+B+C
- Stabile Pille + opaker Hintergrund + kein Transform
- Adressiert alle drei Root Causes gleichzeitig
- **Risiko:** Visuelle Regression (Pille größer, opaker)

## Referenzen

- `docs/DEVELOPMENT.md:120` — "Linux-Overlay: `set_background_color` muss bei jedem Reveal aufgerufen werden"
- `docs/handoffs/OVERLAY_LINUX_BLACK_BLOCK_HANDOFF.md:29` — gleiche Warnung
- `src-tauri/src/lib.rs:431-436` — Rust-Kommentar zum Compositing-Problem
- `src/styles/overlay-pill.css:83` — `transform: scale(0.87)` (toter Code)
- `src/styles/overlay-pill.css:16` — `--ov-surface: rgba(27, 27, 29, 0.90)` (semi-transparent)

## Validierungskriterien (für zukünftigen Fix)

- [ ] Recording → Processing → Result-Actions → Edit → Error → Idle: keine visuelle Überlappung bei keinem Übergang
- [ ] Neues Recording während Leave-Animation: keine Ghosting des vorherigen States
- [ ] Pille-Größe und -Optik bleiben konsistent (keine visuelle Regression)
- [ ] `npm run build` grün
- [ ] Alle Tests grün (261 Rust, 70 Frontend)
