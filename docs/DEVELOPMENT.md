# WordScript — Development

Stand: 2026-05-12

## Zweck

Dieses Dokument beschreibt, wie am aktuellen WordScript-Produktpfad gearbeitet wird.

Wichtig: Der aktive Pfad ist kein Python-Sidecar-Rebuild mehr. Produktlogik liegt in Tauri/Rust, die React-UI stellt diesen Zustand dar und konfiguriert ihn.

## Stack und aktive Bereiche

- Frontend: React 18, TypeScript, Vite, Vitest
- Desktop host: Tauri v2
- Runtime: Rust mit `cpal`, `hound`, `reqwest`, `keyring`, `rodio`, `arboard`, `enigo`
- Versionstand: `0.2.2-alpha`

Die aktiven Arbeitsbereiche sind:

- `src/` fuer Overlay, Settings, Hooks, UI-Vertraege und Tests
- `src-tauri/src/` fuer Trigger, Capture, Provider, Transform, Insert, Recovery und Sound
- `docs/` fuer die bewusst kleine Dokumentationsbasis

Diese Bereiche sind keine Grundlage fuer neue Produktlogik:

- alte Sidecar- oder Glue-Pfade
- Renderer-only Zustandsmaschinen fuer Runtime-Orchestrierung
- ungetypte JSON-Zwischenschichten, die Rust-Ownership wieder verwischen

## Setup

### Voraussetzungen

- Node.js 18+
- Rust + Cargo
- macOS: Xcode Command Line Tools; Homebrew is recommended for `setup-tauri.sh`
- Windows: Visual Studio Build Tools mit C++-Workload und Microsoft WebView2 Runtime
- Linux: `libwebkit2gtk-4.1-0`, `libayatana-appindicator3-1`, `libxdo3`

### Bootstrap pro Plattform

macOS und Linux:

```bash
bash setup-tauri.sh
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-tauri.ps1
```

### Lokaler Start

```bash
npm install
npm run tauri dev
```

`npm run tauri dev` startet den nativen Produktpfad. Das ist heute die benutzbare Dev-Version von WordScript. Es wird kein Python-Sidecar gebaut oder gestartet.

Parallel dazu wird am ersten offiziellen Cross-Platform-App-Release fuer Linux, macOS und Windows gearbeitet. Dieser Release-Aufbau ersetzt die Dev-Version noch nicht.

Wichtiger Plattformhinweis fuer echte Insert-Checks:

- macOS Dev-Mode kann Accessibility und je nach Launcher auch Input Monitoring fuer Terminal, VS Code oder die spaeter paketierte WordScript-App verlangen
- Windows-Ziele mit hoeheren Rechten koennen simuliertes Paste blockieren, wenn WordScript nicht auf demselben Privileg-Level laeuft
- Linux Wayland bleibt ein Clipboard-/Helper-lastiger Experimentalpfad

## Arbeitsregeln

### 1. Am owning surface anfangen

- UI-Themen starten bei `src/windows/`, `src/components/settings/` oder `src/hooks/`
- Runtime-Themen starten bei `src-tauri/src/core/`
- Architekturfragen zuerst gegen [ARCHITECTURE.md](./ARCHITECTURE.md) pruefen
- Produkt- und Scope-Fragen zuerst gegen [VISION.md](./VISION.md) pruefen

### 2. Rust bleibt Runtime-Owner

Die folgenden Themen gehoeren in Rust, nicht in React:

- globale Hotkeys
- Capture-Lifecycle
- Session-Orchestrierung
- Provider-Aufruf
- Transform-Reihenfolge
- Insert und Recovery

React darf diese Dinge anzeigen, konfigurieren und diagnostisch erklaeren, aber nicht semantisch neu erfinden.

### 3. Kleine, pruefbare Slices bauen

Jede groessere Aenderung sollte mindestens eines davon sichtbar schliessen:

- typed contract
- nativer Zustand
- echte Nutzerwirkung im Produktpfad
- testbare Regression oder reproduzierbare Build-Validierung

### 4. Dokumentation gleichzeitig pflegen

Wenn sich Produktrealitaet aendert, muessen mindestens die passenden Kern-Dokumente mitgezogen werden:

- [README.md](../README.md) fuer Projektueberblick
- [VISION.md](./VISION.md) fuer Richtung und Scope
- [ARCHITECTURE.md](./ARCHITECTURE.md) fuer Ownership und Fluss
- [DEVELOPMENT.md](./DEVELOPMENT.md) fuer Workflow und Validation
- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) fuer UI-Regeln
- [REFERENCE.md](./REFERENCE.md) fuer aktuelle Fakten, Grenzen und offene Punkte
- [CHANGELOG.md](../CHANGELOG.md) fuer veroeffentlichte Aenderungen

### 5. Repo sauber halten

- generierte Metadaten wie `BUILD_ID` und `build_info.json` gehoeren nicht mehr zum aktiven Repo-Pfad
- lokale Tool-Spuren wie `.playwright-mcp/`, `wordscript.log` oder alte Python-`__pycache__`-Reste duerfen nicht in Git landen
- vor Pushes `git status --short` gegen unbeabsichtigte lokale Artefakte pruefen

## Validation

### UI-only Aenderungen

1. engsten betroffenen Vitest laufen lassen
2. `npm run build`

### Rust- oder Runtime-Aenderungen

1. `cd src-tauri && cargo test`
2. wenn noetig zusaetzlich `cd src-tauri && cargo check`

### Cross-cutting Aenderungen

```bash
npm test
npm run build
cd src-tauri && cargo test
```

### Release-build-up Aenderungen

Wenn Bundle-Ziele, Release-Workflow, Runbook oder die About-Release-Flaeche angepasst werden:

```bash
npm run build
cd src-tauri && cargo test
npm run tauri build
```

Ein reiner Browser-Check reicht fuer Tauri-gebundene Ansichten nicht aus, weil `invoke()` und Event-Bridges ohne nativen Host nur einen Teil des Produktpfads abdecken.

Wichtig fuer den aktuellen Stand:

- `npm run tauri build` bleibt ein Build-Up-Check und kein Beweis fuer einen fertigen oeffentlichen Release-Pfad
- Linux-AppImage-Packaging kann aktuell noch an `linuxdeploy` scheitern; das ist derzeit ein bekannter Packaging-Befund waehrend der Release-Aufbau weiter stabilisiert wird

## CI

- `.github/workflows/ci.yml` prueft Pull Requests und `main` auf Ubuntu, macOS und Windows mit Frontend-Tests, Frontend-Build, `cargo check` und `cargo test`
- `.github/workflows/release.yml` ist der aktuelle manuelle Release-Build-Up-Workflow fuer Linux, macOS und Windows; er fuehrt Frontend-Tests, Rust-Tests, Frontend-Build und danach erst das Bundling aus
- Packaging, Signing und Updater-Arbeit sind wieder Teil des aktiven Aufbaupfads, duerfen aber erst nach dem ersten echten Release als live bezeichnet werden

## Repo-Orientierung

### Frontend

- `src/App.tsx`: Routing fuer Overlay und Settings
- `src/windows/`: Fenster-Komposition
- `src/components/settings/`: aktive Settings-Tabs
- `src/hooks/`: Runtime-, Provider-, Insert-, Log- und Diagnostics-Hooks
- `src/types/`: getypte UI-Vertraege fuer Runtime, Text Rules, Insertion und Release-Status

### Backend

- `src-tauri/src/lib.rs`: Window-Setup, Commands und Event-Bridges
- `src-tauri/src/core/config.rs`: Config-Lifecycle und Disk-I/O
- `src-tauri/src/core/trigger.rs`: Start/Stop, Pause/Resume, Abort
- `src-tauri/src/core/capture.rs`: Mikrofon-Capture, Levels, WAV und Auto-Stop
- `src-tauri/src/core/providers/groq.rs`: Groq-BYOK und Provider-Fehler
- `src-tauri/src/core/transform.rs`: Cleanup, Dictionary und Snippets
- `src-tauri/src/core/insertion.rs`: Paste-Modi, Clipboard-Restore, Scratchpad und Recovery
- `src-tauri/src/core/updates.rs`: ehrlicher GitHub-Release-Status fuer die About-Flaeche und den Release-Aufbaupfad
- `src-tauri/src/core/runtime_log.rs`: gepufferte Runtime-Logs

## Verbleibender Dokumentensatz

Jede verbliebene Datei im Doku-Set hat einen klaren Zweck:

- `README.md`: Projektueberblick fuer neue Nutzer und Entwickler
- `docs/VISION.md`: Produktziel, V1, V2 und aktueller Fokus
- `docs/ARCHITECTURE.md`: Systemgrenzen und aktiver Runtime-Fluss
- `docs/DEVELOPMENT.md`: Arbeitsmodus und Validation
- `docs/DESIGN_SYSTEM.md`: UI-Regeln fuer Overlay und Settings
- `docs/REFERENCE.md`: aktuelle Produktrealitaet, Limits, Support und offene Punkte
- `docs/RELEASE_RUNBOOK.md`: aktueller manueller Build-Matrix- und Release-Aufbaupfad

Wenn eine weitere Doku-Datei hinzukommt, braucht sie einen engeren Zweck als diese Kern-Dokumente.

## Aktueller Entwicklungsfokus

Die naechste Arbeit ist nicht weiterer Scope-Ausbau, sondern V1-Konsolidierung:

1. Trigger-, Capture-, Insert- und Recovery-Pfad weiter stabilisieren
2. Text Rules, Diagnostics und Support-Kommunikation im bestehenden Produktpfad weiter schaerfen
3. den kommerziellen Release-Aufbau ohne falsche Verfuegbarkeitssignale sauber mitfuehren

Lokale Profile bleiben eine moegliche naechste Produktstufe, sind aber heute nicht implementiert und duerfen in der Doku nicht als aktive Funktion beschrieben werden.