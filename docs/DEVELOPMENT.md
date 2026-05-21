# WordScript — Development

Stand: 2026-05-13

## Zweck

Dieses Dokument beschreibt, wie am aktuellen WordScript-Produktpfad gearbeitet wird.

Wichtig: Der aktive Pfad ist kein Python-Sidecar-Rebuild mehr. Produktlogik liegt in Tauri/Rust, die React-UI stellt diesen Zustand dar und konfiguriert ihn.

## Stack und aktive Bereiche

- Frontend: React 18, TypeScript, Vite, Vitest
- Desktop host: Tauri v2
- Runtime: Rust mit `cpal`, `hound`, `reqwest`, `keyring`, `rodio`, `arboard`, `enigo` und optionalem externen `whisper-cli` fuer die lokale Preview-Lane
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

Optionaler lokaler Preview-Pfad:

- `local_preview` braucht `whisper-cli` in `PATH` oder `WORDSCRIPT_LOCAL_WHISPER_CLI`
- ein nichtleerer `WORDSCRIPT_LOCAL_WHISPER_CLI`-Wert reicht nicht als Readiness-Signal; der native Provider-Status muss den Runnerpfad aktiv probe-pruefen und lokale Setup-Probleme als typed `issue_code` melden
- dazu `WORDSCRIPT_LOCAL_MODEL_PATH` fuer eine ggml-Datei oder `WORDSCRIPT_LOCAL_MODEL_DIR` fuer `ggml-<model>.bin`
- der native Provider-Status bewertet die Lane gegen das aktuell ausgewaehlte lokale Modell und liefert die Modellliste aus nativer Discovery statt aus einer statischen UI-Annahme
- dieselbe Lane reicht den aktiven Transkriptions-Context als `whisper-cli --prompt` durch; `local_prompt_strength` und `local_prompt_carry` leben jetzt explizit in Config und muessen als nativer Request-Vertrag behandelt werden
- lokale Profile werden als echte `...-fast`- und `...-quality`-IDs gespeichert und im Provider-Request weitergereicht; Decode-Presets duerfen nicht mehr implizit nur aus dem Modellnamen rekonstruiert werden
- `local_beam_size` und `local_best_of` sind jetzt ebenfalls persistierte Runtime-Werte; wer lokale Decode-Semantik aendert, muss Config-Normalisierung, Request-Building, whisper-cli-Args und Settings gemeinsam aktualisieren
- dieselbe Regel gilt jetzt fuer `local_prompt_strength` und `local_prompt_carry`, aber profilgebunden: wer lokale Prompt-Bias-Semantik aendert, muss die Profilsammlung pflegen und darf die aktiven Mirror-Felder nicht mehr als einzige Persistenz behandeln
- History- und Diagnostics-Aenderungen fuer lokale Runs muessen dieselben Werte sichtbar halten. Ein lokaler Fehlerfall ohne `provider_profile`, Prompt-Bias oder Decode-Metadaten ist jetzt ein Vertragsbruch, kein UI-Detail
- die echte Persistenz fuer lokale Decode-Werte liegt jetzt in profilgebundenen Settings-Eintraegen. Wenn UI oder Migration nur `local_beam_size` und `local_best_of` schreiben, aber die Profilsammlung nicht aktualisieren, kommt beim naechsten Profilwechsel alter oder falscher Decoderzustand zurueck
- dasselbe gilt fuer lokale Prompt-Bias-Werte: Wenn UI oder Migration nur `local_prompt_strength` und `local_prompt_carry` schreiben, aber die profilgebundene Sammlung nicht aktualisieren, springt beim naechsten Profilwechsel wieder ein alter Bias-Zustand ein
- `v1_slice_status` ist jetzt eine native Snapshot-Oberflaeche fuer den laufenden Runtime-Vertrag. Diagnostics muss lokale Vertragswerte aus diesem Snapshot lesen und eventuelle Fenster-Drafts explizit als unsaved Drift markieren
- dieser Snapshot muss jetzt nicht nur Config, sondern echte Live-Statusquellen einziehen: Local-Provider-Readiness inkl. aufgeloester Runner-/Modellpfade und nativer Capture-Status gehoeren in den Snapshot, statt im UI neu zusammengesetzt zu werden
- die Lane ist aktuell STT-only; AI cleanup bleibt Groq-first und faellt sonst auf das rohe Transkript zurueck

## Arbeitsregeln

### 1. Am owning surface anfangen

- UI-Themen starten bei `src/windows/`, `src/components/settings/` oder `src/hooks/`
- Runtime-Themen starten bei `src-tauri/src/core/`
- Architekturfragen zuerst gegen [ARCHITECTURE.md](./ARCHITECTURE.md) pruefen
- Produkt- und Scope-Fragen zuerst gegen [VISION.md](./VISION.md) pruefen
- Provider-Slices starten bei `src-tauri/src/core/providers/` und duerfen nicht mehr direkt am Groq-Einzelfall vorbei in UI oder Host verdrahtet werden
- Preview-/Offline-Slices muessen ihre externen Runtime-Voraussetzungen in Settings, README und REFERENCE explizit benennen statt einen eingebetteten Local-Mode vorzutaeuschen
- Provider-Fehler muessen ueber `ProviderCommandError` laufen und `kind`, `retryable` sowie `user_action` behalten; UI-Copy darf daraus anzeigen, aber keine eigene Fehlersemantik erfinden

### 2. Rust bleibt Runtime-Owner

Die folgenden Themen gehoeren in Rust, nicht in React:

- globale Hotkeys
- Capture-Lifecycle
- Session-Orchestrierung
- Provider-Aufruf
- Transform-Reihenfolge
- Insert und Recovery

React darf diese Dinge anzeigen, konfigurieren und diagnostisch erklaeren, aber nicht semantisch neu erfinden.

Async Runtime-Ergebnisse aus Provider, Transform und Insert muessen ueber die aktive `processing`-Session-ID guardiert werden. Ein spaeter Provider- oder Insert-Fehler darf nach Abort, neuer Aufnahme oder bereits finalisierter Session keinen UI-State mehr ueberschreiben.
Provider-Capabilities und Provider-Modi kommen aus dem nativen Provider-Vertrag. Settings duerfen sie als Status- und Auswahlhilfe nutzen, aber nicht aus Modellnamen oder UI-Heuristiken ableiten.
Insert-Recovery muss ueber den nativen Insert-Outcome laufen. Neue UI darf `recovery_action`, `recovery_message` und `clipboard_restore` anzeigen, aber nicht aus `fallback_reason` eigene Recovery-States ableiten.
Dasselbe gilt fuer durable History und Export: `TranscriptionHistoryEntry` ist eine Weitergabe des nativen Recovery-Vertrags und keine zweite, vereinfachte Recovery-Projektion.
Dasselbe gilt fuer Diagnostics-Stage-Telemetrie: Wenn Rebuild Lab Capture-, Provider-, Transform- oder Insert-Fortschritt anzeigt, muessen `state`, `duration_ms` und `error_code` aus dem nativen Slice-Vertrag kommen und nicht aus UI-Timern, Log-Parsing oder Text-Heuristiken rekonstruiert werden.

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

Wenn es um Ausbaupfade, Donor-Repos und Feature-Staging geht, ist zusaetzlich [BENCHMARK_MATRIX.md](./BENCHMARK_MATRIX.md) die Arbeitsreferenz.

Wenn es um die konkrete Reihenfolge der naechsten Kern-Slices geht, ist [CORE_EXECUTION_PLAN.md](./CORE_EXECUTION_PLAN.md) die operative Referenz.

### 5. Repo sauber halten

- generierte Metadaten wie `BUILD_ID` und `build_info.json` gehoeren nicht mehr zum aktiven Repo-Pfad
- lokale Tool-Spuren wie `.playwright-mcp/`, `wordscript.log` oder alte Python-`__pycache__`-Reste duerfen nicht in Git landen
- vor Pushes `git status --short` gegen unbeabsichtigte lokale Artefakte pruefen

## Validation

### UI-only Aenderungen

1. engsten betroffenen Vitest laufen lassen, fuer Text Rules z. B. `npx vitest run src/components/settings/PromptsTab.test.tsx`
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
- `src/components/settings/`: aktive Settings-Tabs inklusive Profil-Dock, gefuehrtem Text-Rules-Workspace mit Prozesszusammenfassung, kompakter Setup-Zone fuer Profile/Starter, oberer Stage-Navigation und getrennter Hauptarbeitsflaeche fuer Recovery-/Diagnostics-nahe Editoren
- `src/hooks/`: Runtime-, Provider-, Insert-, Log- und Diagnostics-Hooks inklusive nativer History-Store-Status-Bridge
- `src/lib/textProfileTemplates.ts`: kuratierte lokale Starterprofile und Create/Merge-Helfer fuer Text Profiles
- `src/types/`: getypte UI-Vertraege fuer Runtime, Text Rules, Insertion und Release-Status

### Backend

- `src-tauri/src/lib.rs`: Window-Setup, Commands und Event-Bridges
- `src-tauri/src/core/config.rs`: Config-Lifecycle und Disk-I/O
- `src-tauri/src/core/history.rs`: persistenter Transkriptverlauf mit Retry-, Filter-, Export- und Retention-Logik
- `src-tauri/src/core/trigger.rs`: Start/Stop, Pause/Resume, Abort
- `src-tauri/src/core/capture.rs`: Mikrofon-Capture, Levels, WAV und Auto-Stop
- `src-tauri/src/core/providers/groq.rs`: Groq-BYOK und Provider-Fehler
- `src-tauri/src/core/providers/local_preview.rs`: lokale `whisper-cli`-Lane mit Runner-Probe, selected-model-Readiness und nativer Model-Discovery
- `src-tauri/src/core/providers/mod.rs`: gemeinsamer Provider-Vertrag inklusive typed `local_setup`-Status fuer die lokale Preview-Lane
- `src-tauri/src/core/transform.rs`: Cleanup, aktive Profile, Dictionary und Snippets
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
2. History-, Retry- und Diagnostics-Pfad auf dem nativen Verlauf weiter ausbauen
3. lokale Textprofile zu sichtbaren Arbeitsmodi fuer Context, Dictionary, Snippets, spaetere Rewrite-Defaults, Insert-Verhalten und Recovery-Verhalten weiterziehen
4. Overlay und Settings auf einen Live-Preview- und kontrollierten Commit-Pfad vorbereiten, damit Nutzer `raw transcript`, bereinigten Text, aktiven Modus und schnelle Recovery-Aktionen sehen koennen
5. den Provider-Stack von Groq als erstem Adapter zu einem produktfaehigen Modellsystem mit mindestens einem zweiten Produktionsprovider und klaren Modi wie `fast`, `quality`, `local` und `self_hosted` ausbauen
6. `local_preview` weiter ueber die jetzt vorhandenen Bausteine fuer Modellmanagement, initiales Prompt-Bias, Fast/Quality-Presets und ehrliche Health-Diagnostics hinaus mit tieferen Prompt-Reglern und expliziten Quality-vs-Latency-Controls zu einer volleren Local Lane ausbauen
7. Setup, Permissions und Packaging als gefuehrten Produktpfad ohne falsche Verfuegbarkeitssignale sauber mitfuehren

Lokale Profile sind jetzt implementiert. Shell und Text-Rules-Editor teilen sich dafuer denselben Profil-Patch-Pfad, und die Text-Rules-Flaeche bringt eine lokale Starter-Library fuer zentrale ICPs mit. Nicht implementiert sind weiterhin automatische Aktivierung, Team-/Sync-Verteilung und spaetere Rewrite-Defaults ueber den aktiven Profilzustand hinaus.

Fuer diesen UI-Pass gelten produktnahe macOS-Donoren wie `VoiceInk`, `FluidVoice` und `OpenSuperWhisper` als primaere Referenzen. Reine React-/TypeScript-Stilreferenzen fuer Window-Chrome, Sidebar-Rhythmus oder Control-Sprache sind sekundaer und duerfen keine fake-desktophafte Spielerei in den aktiven Produktpfad druecken.

Was dabei bewusst nicht die naechste Baustelle ist:

- `openwhispr`-Features wie Notes, Search, Sync, MCP oder Assistant-Scope
- neue Plattformbreite, bevor der taegliche Dictation-Pfad persoenlicher, transparenter und vertrauenswuerdiger geworden ist

Langfristige Themen wie Notes, Sync, MCP, API, Assistant oder Browser-/Computer-Use sind explizit nicht ausgeschlossen. Sie muessen aber ueber gestufte Ausbaupfade auf einem stabilen Kern entstehen, nicht als Parallelprodukt neben dem aktiven Dictation-Pfad.

Fuer spaetere Sync-Arbeit gilt als aktuelle Planungsrichtung: WordScript-eigener optionaler local-first Sync statt Peer-to-Peer-Primarmodell oder externer Hub-Pflicht. Solange dieser Pfad nicht real gebaut ist, duerfen Doku und UI weder Accounts noch Cloud-Workspaces als aktive Produktrealitaet darstellen.