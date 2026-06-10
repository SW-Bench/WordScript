# WordScript — Development

Stand: 2026-06-10

## Zweck

Dieses Dokument beschreibt, wie am aktuellen WordScript-Produktpfad gearbeitet wird.

Wichtig: Der aktive Pfad ist kein Python-Sidecar-Rebuild mehr. Produktlogik liegt in Tauri/Rust, die React-UI stellt diesen Zustand dar und konfiguriert ihn.

## Stack und aktive Bereiche

- Frontend: React 18, TypeScript, Vite, Vitest
- Desktop host: Tauri v2
- Runtime: Rust mit `cpal`, `hound`, `reqwest`, `keyring`, `rodio`, `arboard`, `enigo`, externem `whisper-cli` fuer lokale STT und lokalem Ollama-Cleanup fuer die lokale Runtime-Lane
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
- Linux Wayland bleibt ein Clipboard-/Helper-lastiger Experimentalpfad: auf reinen Wayland-Sessions (ohne X11-Display) ist Auto-Paste explizit deaktiviert, weil `wtype`/`ydotool` sonst den KDE-Plasma-Portal-Prompt "Control input devices" ausloesen wuerden. Hybrid-Sessions (X11+Wayland) verwenden weiterhin xdotool-XTEST ueber XWayland.
- Linux-Checks fuer das Settings-Fenster muessen im nativen Host laufen; Browser-Preview reicht nicht, wenn Fensterdekorationen, Scrollverhalten oder Fensterrand-Verhalten beurteilt werden sollen
- dasselbe gilt fuer das Diagnostics-Pop-out: native Dekoration, Startgroesse und Resize-Grenzen muessen im Host geprueft werden, nicht nur im eingebetteten Settings-Tab

Optionaler lokaler Runtime-Pfad:

- `local_preview` braucht `whisper-cli` in `PATH` oder `WORDSCRIPT_LOCAL_WHISPER_CLI`
- ein nichtleerer `WORDSCRIPT_LOCAL_WHISPER_CLI`-Wert reicht nicht als Readiness-Signal; der native Provider-Status muss den Runnerpfad aktiv probe-pruefen und lokale Setup-Probleme als typed `issue_code` melden
- dazu `WORDSCRIPT_LOCAL_MODEL_PATH` fuer eine ggml-Datei oder `WORDSCRIPT_LOCAL_MODEL_DIR` fuer `ggml-<model>.bin`
- AI cleanup laeuft lokal ueber Ollama an `http://127.0.0.1:11434` oder `WORDSCRIPT_LOCAL_CHAT_BASE_URL`; das Cleanup-Modell lebt getrennt in `local_correction_model` statt den Cloud-Cleanup-Slot wiederzuverwenden
- Provider & Models rendert lokale Readiness als Preflight-Checkliste fuer Speech Runner, STT-Modell, Cleanup-Endpoint und Cleanup-Modell; diese Liste darf nur aus `local_setup` und der aktiven Config abgeleitet werden
- der native Provider-Status bewertet die Lane gegen das aktuell ausgewaehlte lokale Modell und liefert die Modellliste aus nativer Discovery statt aus einer statischen UI-Annahme
- dieselbe Lane reicht den aktiven Transkriptions-Context als `whisper-cli --prompt` durch; `local_prompt_strength` und `local_prompt_carry` leben jetzt explizit in Config und muessen als nativer Request-Vertrag behandelt werden
- der Cloud-Pfad nutzt denselben aktiven Profil-Context inzwischen ebenfalls fuer bounded STT-Hinweise aus Dictionary und expliziten `stt_hints`. Snippet-Trigger gehoeren nicht mehr implizit in diesen Bias. Wer Transkriptionsprompting aendert, muss Cloud- und Local-Lane zusammen betrachten statt nur `local_preview` zu verbessern
- Profil-, Dictionary-, `stt_hints`- oder Prompt-Bias-Aenderungen muessen immer gegen `General Writing` oder kein Profil gegengeprueft werden. Wenn ein kuratiertes Profil Rohtranskripte mit mehrsprachigen Fragmenten, Fantasietokens oder Topic-Drift sichtbar verschlechtert, ist das kein Feintuning, sondern ein Launch-Blocker im aktiven Diktierpfad
- generische Kategorien wie `customer names`, `release scope` oder snippetartige Makro-Phrasen gehoeren nicht mehr in automatische Starter-Bias-Pfade. Default-Profile muessen mit konservativen Vokabular-Baselines starten; nur explizite, kurze Sprachhinweise gehoeren in `stt_hints`
- wenn Text Rules im Context-Workspace meldet, dass Profilzeilen oder STT-Hints fuer den konservativen Bias ignoriert werden, ist das keine kosmetische UI-Warnung, sondern ein echter Hinweis auf schwache Profilqualitaet im Runtime-Pfad
- reale Fehltranskripte aus problematischen Profilen sind jetzt als fixes Regression-Korpus nachzuziehen; neue Bias-Filter gelten erst dann als nachhaltig, wenn mindestens ein echtes Fehlbeispiel als nativer Test fuer `transcription_hints`, Prompt-Building oder `text_rules::analyze_document` liegen bleibt
- die neuen Text-Rules-Warnings sind die Vorstufe fuer Profilgesundheit, nicht das Ende der Arbeit; offen bleibt eine profilgebundene Bias-Policy, die sichtbar zwischen praktisch keinem brauchbaren automatischen Bias, dem konservativen Default und spaeter bewusst staerkeren manuellen Profilen trennt, ohne die bestehenden provider-spezifischen `local_prompt_strength`-Regler zu vermischen
- eingeschlossene Profile werden einmalig in die User-App-Config geseedet und danach wie normale Profile behandelt. `curation` ist Herkunftsmetadata, kein Sichtbarkeitsfilter; neue UI oder Migrationen duerfen deshalb keinen separaten hartcodierten Starter-Katalog mehr als zweite Ownership-Flaeche einfuehren
- lokale Profile werden als echte `...-fast`- und `...-quality`-IDs gespeichert und im Provider-Request weitergereicht; Decode-Presets duerfen nicht mehr implizit nur aus dem Modellnamen rekonstruiert werden
- `local_beam_size` und `local_best_of` sind jetzt ebenfalls persistierte Runtime-Werte; wer lokale Decode-Semantik aendert, muss Config-Normalisierung, Request-Building, whisper-cli-Args und Settings gemeinsam aktualisieren
- dieselbe Regel gilt jetzt fuer `local_prompt_strength` und `local_prompt_carry`, aber profilgebunden: wer lokale Prompt-Bias-Semantik aendert, muss die Profilsammlung pflegen und darf die aktiven Mirror-Felder nicht mehr als einzige Persistenz behandeln
- History- und Diagnostics-Aenderungen fuer lokale Runs muessen dieselben Werte sichtbar halten. Ein lokaler Fehlerfall ohne `provider_profile`, Prompt-Bias oder Decode-Metadaten ist jetzt ein Vertragsbruch, kein UI-Detail
- Work-Mode-Aenderungen muessen denselben aktiven Profilvertrag durch Config, Transform, Insert, History und V1-Diagnostics tragen. Ein Settings-Label ohne native Runtime-Wirkung ist jetzt ein Vertragsbruch.
- Dasselbe gilt fuer den Overlay-Action-Zustand: Commit-, Copy-, Retry-, Restore- und Dismiss-Entscheidungen muessen aus demselben `wordscript-event`-Payload plus denselben nativen Commands kommen. `useRuntime` darf duennere Native-Folgeevents nicht wieder ueber diesen In-Pill-Zustand schreiben.
- Overlay-Quick-Actions muessen auf denselben nativen Commands bleiben. Wenn `retry` im Overlay sichtbar ist, muss die zugrunde liegende `history.entry_id` aus demselben Runtime-Snapshot kommen; `copy` und `restore` duerfen keine zweite Commit-Logik neben `insert_text_native` und `restore_last_transcript` aufbauen.
- Overlay-Sichtbarkeit ist jetzt ebenfalls ein nativer Vertrag: Aktiv-/Idle-Umschaltung laeuft ueber den Host-Command fuer Reveal bzw. Offscreen-Parking. Reine CSS-Unsichtbarkeit gilt fuer Linux/XWayland nicht mehr als ausreichender Lifecycle-Fix.
- Dasselbe gilt fuer Overlay-Placement: Preset-Anchor, ausgewaehlter Monitor und gemerkte Manual-Position leben im nativen Config-Vertrag. Drag-Persistenz darf nicht als nur renderer-lokaler State gebaut werden.
- Overlay-Drag selbst bleibt trotzdem ein UI-Gestenpfad: Drag darf erst nach realer Pointer-Bewegung beginnen, damit Buttons in Recording-, Processing- und Action-State weiter per Single-Click ausloesen koennen.
- Gemerkte Overlay-Placement-Werte duerfen nur aus echten User-Drag-Moves kommen; programmatische Host-Moves bei Reveal, Hide, Width-Change oder Offscreen-Parking sind keine neue Nutzerabsicht.
- Compact-, Preview- und Result-Surface teilen eine einzige gemerkte Top-Left-Position. Wenn der Nutzer einen dieser Zustandsfenster zieht, muss genau diese Position fuer den naechsten Overlay-Start wiederverwendet werden, statt intern auf einen anderen Surface-spezifischen Referenzpunkt umzurechnen.
- Der Zielmonitor fuer gemerkte Overlay-Positionen muss aus dieser gespeicherten logischen Drag-Referenz gegen die verfuegbaren Monitor-Work-Areas aufgeloest werden. `current_monitor()` allein ist auf Linux-/Wayland-Multi-Monitor-Pfaden nicht robust genug.
- Click-Suppression fuer Overlay-Buttons muss bis nach dem echten Drag-Ende reichen. Wenn sie nur am Drag-Beginn startet, wird ein laengerer Window-Drop spaeter wieder als Button-Eingabe fehlgedeutet.
- Das Standard-Overlay braucht zustandsspezifische Layoutwerte fuer die rechte Timer-/Statuszone. Recording, `working` und Action-State duerfen nicht denselben statischen Seiten-Column-Wert teilen, wenn dadurch sichtbare Randabstaende oder Label-Fit leiden.
- Die Live-Waveform darf near-idle Raumrauschen nicht wie Aktivitaet behandeln. Ein ruhiger Quiet-Gate fuer sehr niedrige Pegel und eine staerkere Speech-Kurve fuer echte Sprache gehoeren zusammen und muessen gemeinsam getestet werden.
- Der neue `preview_ready`-Pfad fuer `clipboard_only`-Profile folgt derselben Regel: der Pending-Preview muss direkt aus dem nativen Transform kommen, der Commit muss denselben Insert-/History-/Sessionpfad benutzen, und der spaetere native Session-Event darf die reichere Preview-Nutzlast in `useRuntime` nicht wieder ausduennen.
- die echte Persistenz fuer lokale Decode-Werte liegt jetzt in profilgebundenen Settings-Eintraegen. Wenn UI oder Migration nur `local_beam_size` und `local_best_of` schreiben, aber die Profilsammlung nicht aktualisieren, kommt beim naechsten Profilwechsel alter oder falscher Decoderzustand zurueck
- dasselbe gilt fuer lokale Prompt-Bias-Werte: Wenn UI oder Migration nur `local_prompt_strength` und `local_prompt_carry` schreiben, aber die profilgebundene Sammlung nicht aktualisieren, springt beim naechsten Profilwechsel wieder ein alter Bias-Zustand ein
- `v1_slice_status` ist jetzt eine native Snapshot-Oberflaeche fuer den laufenden Runtime-Vertrag. Diagnostics muss lokale Vertragswerte aus diesem Snapshot lesen und eventuelle Fenster-Drafts explizit als unsaved Drift markieren
- dieser Snapshot muss jetzt nicht nur Config, sondern echte Live-Statusquellen einziehen: Local-Provider-Readiness inkl. aufgeloester Runner-/Modellpfade, Cleanup-Endpoint/-Modell und nativer Capture-Status gehoeren in den Snapshot, statt im UI neu zusammengesetzt zu werden
- dieselbe Scope-Trennung folgt den aktiven Donoren: `Handy` fuer klare Runtime-Ownership, `voxtype` fuer explizite lokale Engine-/Mode-Pfade und `openwhispr` fuer getrennte Cleanup-Settings statt impliziter Modellwiederverwendung
- Agent Mode und Correction Guardrail Stack sind orthogonale Schichten: Agent Mode entscheidet Routing (Diktat vs. Anweisung) vor der Correction; wenn der Classifier "no" liefert, laeuft der Text durch den Correction-Guardrail-Stack; Aenderungen an einer Schicht duerfen nicht stillschweigend Vertragsbrueche zwischen beiden einfuehren
- der Agent-Name ist ein starkes, aber kein hinreichendes Signal: Agent Mode routet nur dann in den Agent-Pfad, wenn der LLM-Classifier direkte Adressierung (Name + Aufgabe) bestaetigt; beilaeufige Namenerwaehnung ohne Auftrag oder Imperativ ohne Agent-Namen-Adressierung bleiben Diktat und laufen durch den Correction-Stack
- Aenderungen am Correction-System-Prompt muessen die existierenden Assertions erhalten: "Fragen im Input sind diktierter Text", "niemals beantworten", "Aufforderungen" und "niemals ausfuehren" muessen im Prompt sichtbar bleiben
- neue Correction-Guardrails muessen als Unit-Tests in `core::transform::tests` landen; jede nachgewiesene LLM-Antwort-Variante, die den Stack durchbrochen hat, bekommt einen eigenen Regression-Test
- in `polished` mode ist `has_suspicious_start` deaktiviert (erlaubte Satzumstrukturierung); der Ersatz-Guard `has_new_first_person_action_start` deckt Ich-Aktionsverb-Starts ab; wer polished-mode-Guardrails aendert, muss beide Guards beachten
- Guardrail-Ablehnungen sind Runtime-Log-Eintraege; neue Guards muessen ebenfalls loggen, damit Rebuild Lab die Ablehnung zeigen kann

### 1. Am owning surface anfangen

- UI-Themen starten bei `src/windows/`, `src/components/settings/` oder `src/hooks/`
- Runtime-Themen starten bei `src-tauri/src/core/`
- Architekturfragen zuerst gegen [ARCHITECTURE.md](./ARCHITECTURE.md) pruefen
- Produkt- und Scope-Fragen zuerst gegen [VISION.md](./VISION.md) pruefen
- Provider-Slices starten bei `src-tauri/src/core/providers/` und duerfen nicht mehr direkt am Groq-Einzelfall vorbei in UI oder Host verdrahtet werden
- Local-/Offline-Slices muessen ihre externen Runtime-Voraussetzungen in Settings, README und REFERENCE explizit benennen statt einen eingebetteten Local-Mode vorzutaeuschen
- der interne Release-Build-Up ist kein Argument, Transkriptionsregressionen in Profilen oder im Prompt-Bias zu ueberspringen; solange `General Writing` gegenueber aktiven Profilen die deutlich robustere Lane bleibt, ist Release-Arbeit intern und nachgeordnet
- Provider-Fehler muessen ueber `ProviderCommandError` laufen und `kind`, `retryable` sowie `user_action` behalten; UI-Copy darf daraus anzeigen, aber keine eigene Fehlersemantik erfinden
- Settings-Performance-Slices starten am owning Scroll- oder Listenpfad. Bei langen React-Listen zuerst strukturelle Sharing-Brueche, Deep-Clones und parent-driven Re-Renders pruefen, bevor weiter CSS oder Scroll-Physics getunt wird

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
Dasselbe gilt fuer den V1-Slice: `preferred_provider` und `provider_mode` muessen aus dem nativen Runtime-Vertrag kommen. Tests duerfen diese Begriffe nicht aus `AppConfig::load_from_disk()` oder losen Modellnamen-Heuristiken ableiten.
Insert-Recovery muss ueber den nativen Insert-Outcome laufen. Neue UI darf `recovery_action`, `recovery_message` und `clipboard_restore` anzeigen, aber nicht aus `fallback_reason` eigene Recovery-States ableiten.
Input-Preflight darf Trigger-, Mikrofon-, Insert- und Recovery-Status kompakt zusammenziehen, muss aber fuer Insert und Recovery weiter den nativen Insertion-Vertrag und fuer Capture den nativen Audio-/Capture-Status verwenden.
Dasselbe gilt fuer durable History und Export: `TranscriptionHistoryEntry` ist eine Weitergabe des nativen Recovery-Vertrags und keine zweite, vereinfachte Recovery-Projektion.
Dasselbe gilt fuer Diagnostics-Stage-Telemetrie: Wenn Rebuild Lab Capture-, Provider-, Transform- oder Insert-Fortschritt anzeigt, muessen `state`, `duration_ms` und `error_code` aus dem nativen Slice-Vertrag kommen und nicht aus UI-Timern, Log-Parsing oder Text-Heuristiken rekonstruiert werden.
Transform-Aenderungen muessen code-switching, Umgangssprache und technische Tokens konservativ behandeln. Der aktive Profil-Context und Dictionary-Schreibweisen duerfen als Preserve-Hinweise in die Nachkorrektur eingehen, aber nie als Freifahrtschein fuer halluzinierte Fachwoerter oder semantische Regeln missverstanden werden.

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

### TODO: Build-Cache-Strategie

**Problem:** Nach einem Pfad-/Ordnerumbenennung (`sw-labs` → `sw-labs-master`, `WordScript_master` → `WordScript-master`) enthielt `src-tauri/target/` veraltete absolute Pfade zur alten Location. Der Tauri-Build-Script konnte autogenerierte Permission-TOMLs nicht mehr finden — `cargo clean` war noetig und entfernte ~27 GB akkumulierten Debug-Build-Cache.

**Zu loesen:** `sccache` oder eine vergleichbare Compiler-Cache-Loesung einrichten, damit:
- Compiler-Output ueber Pfadwechsel und Neustarts hinweg wiederverwendbar bleibt
- `target/` keine absoluten Pfade mehr als Invalidierungsgrund hat
- ein vollstaendiges `cargo clean` nicht mehr ~27 GB kostet und minutenlange Rekompilation erzwingt

## Validation

### UI-only Aenderungen

1. engsten betroffenen Vitest laufen lassen, fuer Text Rules z. B. `npx vitest run src/components/settings/PromptsTab.test.tsx`
2. `npm run build`
3. wenn Shell, Fenstergeometrie oder Tauri-gebundene Statusfuehrung geaendert wurde: die Ansicht im nativen Host pruefen statt nur im Browser-Preview
4. bei Overlay-Aenderungen auf Linux/XWayland oder KDE Plasma explizit pruefen, dass das Overlay nach Dismiss oder Idle nativ verschwindet und keine stale schwarze Restflaeche hinterlaesst
5. bei Overlay-Placement-Aenderungen explizit pruefen, dass eine manuell gezogene Position nach Stop, Action-State und der naechsten neuen Aufnahme erhalten bleibt und Preset-Display/Anchor-Einstellungen denselben Host-Pfad uebernehmen
6. bei Overlay-Placement-Aenderungen auf Multi-Monitor-Setups explizit pruefen, dass ein Wechsel auf einen zweiten Monitor samt spaeterem Preview-/Result-State nicht die gemerkte Drag-Position durch hostseitige Repositions oder Surface-Breitenwechsel ueberschreibt
7. bei Settings-Chrome-Aenderungen auf Linux explizit pruefen, dass native Fensterdekorationen sichtbar bleiben und keine fake Window-Controls in den Content zurueckkehren
8. bei Geometrie-Aenderungen sicherstellen, dass Settings-Sidebar, Footer und Diagnostics-Pop-out auch am jeweiligen Minimum noch ohne verschwundene Controls bedienbar bleiben

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
- interne Draft-Releases sind jetzt Teil desselben Build-Up-Pfads, aber kein Ersatz fuer einen publizierten Release-Kanal; `check_app_update` bleibt deshalb absichtlich auf publizierte GitHub-Releases beschraenkt

## CI

- `.github/workflows/ci.yml` prueft Pull Requests und `main` auf Ubuntu, macOS und Windows mit Frontend-Tests, Frontend-Build, `cargo check` und `cargo test`
- `.github/workflows/release.yml` ist der aktuelle manuelle Release-Build-Up-Workflow fuer Linux, macOS und Windows; er fuehrt Frontend-Tests, Rust-Tests, Frontend-Build und danach erst das Bundling aus, aggregiert die Bundle-Ausgaben in checksummierte Handoff-Archive und kann optional einen internen Draft-Release erzeugen oder aktualisieren
- Packaging, Signing und Updater-Arbeit sind wieder Teil des aktiven Aufbaupfads, duerfen aber erst nach dem ersten echten Release als live bezeichnet werden

## Repo-Orientierung

### Frontend

- `src/App.tsx`: Routing fuer Overlay und Settings
- `src/windows/`: Fenster-Komposition, native Settings-Shell, kompakter Tab-Header, dominante Content-Surface und Footer-Statusfuehrung
- `src/components/settings/`: aktive Settings-Tabs inklusive Profil-Dock, gefuehrtem Text-Rules-Workspace mit Prozesszusammenfassung, kompakter Profilbibliothek fuer User- und eingeschlossene Baselines, oberer Stage-Navigation und getrennter Hauptarbeitsflaeche fuer Recovery-/Diagnostics-nahe Editoren
- `src/hooks/`: Runtime-, Provider-, Insert-, Log- und Diagnostics-Hooks inklusive nativer History-Store-Status-Bridge
- `src/lib/textProfileTemplates.ts`: shared JSON-Seed-Loader und Create/Merge-Helfer fuer eingeschlossene Text-Profile
- `src/types/`: getypte UI-Vertraege fuer Runtime, Text Rules, Insertion und Release-Status

### Backend

- `src-tauri/src/lib.rs`: Window-Setup, Commands und Event-Bridges
- `src-tauri/src/core/config.rs`: Config-Lifecycle und Disk-I/O
- `src-tauri/src/core/history.rs`: persistenter Transkriptverlauf mit Retry-, Filter-, Export- und Retention-Logik
- `src-tauri/src/core/trigger.rs`: Start/Stop, Pause/Resume, Abort
- `src-tauri/src/core/capture.rs`: Mikrofon-Capture, Levels, WAV und Auto-Stop
- `src-tauri/src/core/providers/groq.rs`: Groq-BYOK und Provider-Fehler
- `src-tauri/src/core/providers/local_preview.rs`: lokale Runtime-Lane mit `whisper-cli` fuer STT, Ollama fuer Cleanup, Runner-Probe, selected-model-Readiness und nativer Model-Discovery
- `src-tauri/src/core/providers/mod.rs`: gemeinsamer Provider-Vertrag inklusive typed `local_setup`-Status fuer die lokale Runtime-Lane
- `src-tauri/src/core/transform.rs`: Cleanup, aktive Profile, Work-Mode-Rewrite-Defaults, Dictionary und Snippets
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
3. den jetzt durchgehenden Work-Mode-Vertrag im Overlay sichtbar machen, ohne neue UI-Heuristiken neben Runtime und History aufzubauen
4. Overlay und Settings auf einen Live-Preview- und kontrollierten Commit-Pfad vorbereiten, damit Nutzer `raw transcript`, bereinigten Text, aktiven Modus und schnelle Recovery-Aktionen sehen koennen; der erste echte Processing-Preview-Schritt fuer `clipboard_only` ist jetzt umgesetzt, aber der Vollausbau fuer Auto-Paste-Modi und Scratchpad-Oeffnen fehlt weiterhin
5. den Provider-Stack von Groq als erstem Adapter zu einem produktfaehigen Modellsystem mit mindestens einem zweiten Produktionsprovider und klaren Modi wie `fast`, `quality`, `local` und `self_hosted` ausbauen
6. die lokale Runtime-Lane ueber die jetzt vorhandenen Bausteine fuer getrennte Cleanup-Slots, initiales Prompt-Bias, Fast/Quality-Presets und ehrliche Health-Diagnostics hinaus mit gefuehrtem Modellmanagement, Pull-Checks und optionalen weiteren lokalen Backends ausbauen
7. Setup, Permissions und Packaging als gefuehrten Produktpfad ohne falsche Verfuegbarkeitssignale sauber mitfuehren

Lokale Profile sind jetzt als manuelle Arbeitsmodi implementiert. Shell und Text-Rules-Editor teilen sich denselben Profil-Patch-Pfad, zentrale ICP-Baselines werden einmalig als eingeschlossene Profile in die User-App-Config geseedet, und Rewrite-, Insert- sowie Recovery-Defaults laufen durch Config, Transform, Insert, History, Diagnostics und den kurzen Overlay-Nachlauf-Snapshot. `clipboard_only`-Profile halten jetzt bereits auf einem echten Processing-Preview vor dem Commit an, waehrend der Overlay-Nachlauf weiterhin die vorhandenen Native-Aktionen fuer `insert`, `retry` und `restore` direkt ausloesen kann. Nicht implementiert sind weiterhin automatische Aktivierung, Team-/Sync-Verteilung, der Vollausbau eines Live-Preview-/Controlled-Commit-Pfads fuer Auto-Paste-Modi und ein dedizierter Scratchpad-Open-Flow auf Basis dieses aktiven Modus.

Fuer diesen UI-Pass gelten produktnahe macOS-Donoren wie `VoiceInk`, `FluidVoice` und `OpenSuperWhisper` als primaere Referenzen. Reine React-/TypeScript-Stilreferenzen fuer Window-Chrome, Sidebar-Rhythmus oder Control-Sprache sind sekundaer und duerfen keine fake-desktophafte Spielerei in den aktiven Produktpfad druecken. GPL-Donoren bleiben dabei Stil- und UX-Referenzen, nicht Copy/Paste-Codequellen fuer den aktiven MIT-Pfad.

Was dabei bewusst nicht die naechste Baustelle ist:

- `openwhispr`-Features wie Notes, Search, Sync, MCP oder Assistant-Scope
- neue Plattformbreite, bevor der taegliche Dictation-Pfad persoenlicher, transparenter und vertrauenswuerdiger geworden ist

Langfristige Themen wie Notes, Sync, MCP, API, Assistant oder Browser-/Computer-Use sind explizit nicht ausgeschlossen. Sie muessen aber ueber gestufte Ausbaupfade auf einem stabilen Kern entstehen, nicht als Parallelprodukt neben dem aktiven Dictation-Pfad.

Fuer spaetere Sync-Arbeit gilt als aktuelle Planungsrichtung: WordScript-eigener optionaler local-first Sync statt Peer-to-Peer-Primarmodell oder externer Hub-Pflicht. Solange dieser Pfad nicht real gebaut ist, duerfen Doku und UI weder Accounts noch Cloud-Workspaces als aktive Produktrealitaet darstellen.