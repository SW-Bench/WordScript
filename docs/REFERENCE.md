# WordScript — Reference

Stand: 2026-05-13

## Zweck

Dieses Dokument ist die konsolidierte Faktensammlung fuer den aktuellen Produktstand. Es ersetzt verstreute Einzelnotizen zu Support-Grenzen, API-relevanten Limits, Profilplanung und Audit-Zwischenstaenden.

Wenn README, Vision oder Architektur eine aktuelle Produktaussage brauchen, soll sie von hier aus belegbar sein.

## Projektkontext

- SW bench: Open-Source-brand von SW labs
- WordScript: der aktive Desktop-Diktierpfad innerhalb von SW bench
- Produktziel: eine offene, ernstzunehmende Alternative zu bezahlten AI-Voice-Dictation-Angeboten

## Produktstand

- Release-Linie: `0.2.2-alpha`
- aktiver Produktpfad: Tauri/React UI plus nativer Rust-Core
- heute benutzbare Version: Dev-Version aus dem Repo via `npm run tauri dev`
- aktive Fenster: Overlay und Settings
- aktive Settings-Tabs: Provider & Models, Input, Text Rules, About, Diagnostics

## Heute implementierte Kernfunktionen

- globale Start/Stop-, Pause/Resume- und Abort-Hotkeys
- native Mikrofonaufnahme mit Waveform-/Level-Events
- Silence-Timeout und Max-Duration-Autostop
- Groq-BYOK mit OS secret store
- `local_preview` als STT-only Preview-Lane ueber externes `whisper-cli` und lokale ggml-Modelle
- bounded STT-Promptbias fuer Groq und `local_preview` aus aktivem Profil-Context, Dictionary-Schreibweisen und wahrscheinlichen Phrasen
- Halluzinationsfilter und optionale AI-Nachkorrektur mit konservativen Preserve-Hinweisen aus aktivem Profil-Context und Dictionary-Schreibweisen
- lokale Textprofile fuer Transcription Context, Dictionary und Snippets im nativen Transform-Pfad
- persistenter nativer Transkriptverlauf mit Retry, Delete/Clear, serverseitigen Filtern, JSON-Export und separater Diagnostics-Darstellung neben Runtime-Logs
- Text-Rules-Validation, Preview, Import/Export und Konfliktbehandlung
- native Insertion mit mehreren Fallback-Stufen
- Scratchpad und Last-Transcript-Restore
- native Sound-Cues fuer Startup, Start, Stop, Abort und Fehler
- gepufferte Runtime-Logs in Diagnostics
- nativer Release-Status-Check fuer die About-Flaeche mit ehrlichem GitHub-Release-Signal

## Support- und Plattformmatrix

| Plattform | Status | Aktuelle Realitaet |
|---|---|---|
| macOS | Tier 1 Zielpfad | nativer Hotkey-, Capture- und Insert-Pfad; Dev-Mode-Auto-Paste braucht Privacy-Freigaben |
| Windows | Tier 1 Zielpfad | nativer Hotkey-, Capture- und Insert-Pfad; UAC-Grenzen gelten fuer simuliertes Paste |
| Linux X11 | Preview | nutzbarer Produktpfad mit kleinerem Stabilitaetsversprechen |
| Linux Wayland | Experimental | XWayland- und Clipboard-lastiger Fallback-Pfad, kein Vollversprechen |

## Plattformdiagnostik fuer Insert und Recovery

Die native Plattformdiagnostik kommt aus `core::insertion` und wird sichtbar in der About-Flaeche ausgespielt. Sie besteht nicht nur aus einem Support-Tier, sondern aus:

- Plattformlabel
- Insert-Strategie
- Support-Message
- sichtbaren Voraussetzungen
- sichtbaren ehrlichen Grenzen

### macOS Dev-Mode

- fuer direktes Cmd+V-Auto-Paste braucht der ausfuehrende Prozess Accessibility in `System Settings -> Privacy & Security -> Accessibility`
- wenn macOS fuer synthetische Eingaben zusaetzlich `Input Monitoring` verlangt, muss dieselbe Launcher-App freigegeben werden
- im Dev-Mode kann dieser Eintrag unter Terminal oder VS Code erscheinen statt unter einem paketierten WordScript-App-Namen
- einzelne sandboxes, Remote-Desktop-Sitzungen oder Apps mit hoeheren Rechten koennen simuliertes Paste trotzdem ablehnen

### Windows

- der aktive Tier-1-Pfad nutzt simuliertes `Ctrl+V` oder Clipboard-Handoff
- elevated Ziel-Apps koennen synthetisches Paste von einem nicht-elevated WordScript-Prozess blockieren
- Scratchpad und Last-Transcript-Restore bleiben der offizielle Recovery-Pfad

## Provider- und Runtime-Grenzen

### Provider-Lanes heute

- `groq` ist der cloud-first Produktionspfad
- `local_preview` ist die aktuelle lokale Preview-Lane fuer STT ueber einen externen `whisper-cli`-Runner
- der Nutzer speichert den eigenen Groq-API-Key lokal im OS secret store
- die JSON-Konfiguration wird beim Speichern gescrubbt und alte JSON-Groq-Secrets werden nativ in den Secret Store migriert
- Provider-Status enthaelt typisierte Modi (`fast`, `quality`, `local`, spaeter `self_hosted`) und Capabilities fuer Transcription, Chat-Cleanup, Local, API-Key-Pflicht, Prompt-Bias, Language, Segments und Modellmanagement
- Provider-Fehler enthalten neben Text auch `kind`, HTTP-Status, Retry-After, `retryable` und eine `user_action`; Settings und Runtime-Events sollen diese Semantik weiterreichen statt eigene Fehlerkategorien zu bauen
- ein WordScript-Proxy oder Hosted Mode existiert nicht

### Lokale Preview-Voraussetzungen

- `whisper-cli` in `PATH` oder `WORDSCRIPT_LOCAL_WHISPER_CLI`
- `WORDSCRIPT_LOCAL_MODEL_PATH` fuer eine ggml-Datei oder `WORDSCRIPT_LOCAL_MODEL_DIR` fuer `ggml-<model>.bin` sowie gaengige Varianten wie quantisierte oder `.en`-Dateien
- die Lane ist aktuell STT-only; AI cleanup bleibt Groq-first und faellt im Preview-Pfad auf das rohe lokale Transkript zurueck

### Audio- und Upload-Relevanz

- Capture-Dateien werden fuer Groq auf 16 kHz Mono-WAV normalisiert
- der Runtime-Pfad nutzt ein kurzes interaktives Timeout von `18_000` bis `35_000` Millisekunden
- die aktive Transkriptionsanfrage laeuft ohne Retry-Kette (`max_retries = 0`)
- async Provider-, Transform- und Insert-Ergebnisse werden an die aktive `processing`-Session-ID gebunden; stale Ergebnisse nach Abort, neuer Aufnahme oder bereits finalisierter Session werden verworfen und nur im Runtime-Log notiert

Relevante externe Groq-Grenze fuer den Produktpfad:

- `413 request_too_large` bezieht sich auf Upload-Groesse, nicht nur auf Dauer
- dokumentierte Richtwerte aus der aktuellen Integration: Free `25 MiB`, Dev `100 MiB` pro Upload

Diese Werte sind nur insofern Teil der Produktreferenz, wie sie den aktiven Desktop-Flow beeinflussen.

## Text Rules und Profilstatus

### Heute aktiv

- lokale Textprofile mit aktivem `Transcription Context`
- profileigenes Personal Dictionary
- profileigene Snippet-Liste
- globale Schalter fuer AI cleanup, filler filter und rewrite phrasing

### Heute nicht aktiv

- keine Prompt-Library als Produktfunktion
- keine Assistant-Identitaeten
- kein Team- oder Sync-Modell

### Profilrealitaet heute

- Profile werden lokal in der nativen Config gehalten
- der alte globale Rule-Zustand wird beim Laden in ein Standardprofil migriert
- die Settings-Sidebar zeigt den aktiven Profilnamen global und erlaubt manuellen Wechsel oder schnelles Anlegen neuer Profile
- die Text-Rules-UI kann Profile anlegen, duplizieren, waehlen und loeschen sowie kuratierte lokale Starter-Templates als neues Profil anlegen oder in das aktive Profil mergen
- die Text-Rules-UI ist als Workspace organisiert: Profil-/Starter-Rail links, aktive Context-/Preview-Karten oben und getrennte Dictionary-/Snippet-Arbeitsbereiche darunter
- History speichert den aktiven Profilnamen als Teil des Verlaufs
- automatische app- oder hotkey-basierte Profilaktivierung existiert noch nicht

Wichtige Doku-Regel dazu:

- `Transcription Context` bleibt eine STT-Hilfe
- Profile sind implementiert, aber bleiben lokal und manuell aktiviert
- Starter-Templates sind lokale Baselines fuer zentrale ICPs und keine serverseitige Prompt-Library
- geplante Profil-Automation duerfen nicht als aktive Funktion beschrieben werden

## Planungsstand fuer spaetere Sync-Themen

Diese Punkte beschreiben keine aktive Funktion, sondern die aktuelle Zielrichtung fuer spaeteren Ausbau:

- WordScript bleibt local-first; ein Konto waere additiv und nicht Voraussetzung fuer den Produktkern
- wenn spaeter Sync kommt, dann als WordScript-eigener Dienst fuer WordScript-Daten statt als Pflicht-Abhaengigkeit von einem externen Produkt-Hub
- der primaere Ausbaupfad ist kein Peer-to-Peer- oder Client-to-Client-Primarmodell
- fruehe Sync-Kandidaten sind Profile, Dictionary, Snippets, ausgewaehlte Settings und spaeter optional Verlauf oder Workspaces
- Provider-Credentials wie der Groq-API-Key bleiben lokal im OS secret store und sind kein impliziter Sync-Bestandteil

## Insertion- und Recovery-Modell

Der Insert-Pfad kann heute in vier sichtbare Modi enden:

- `direct_paste`
- `clipboard_only`
- `clipboard_fallback`
- `scratchpad_fallback`

Zusatzregeln des aktiven Pfads:

- erfolgreicher Direct Insert stellt den vorherigen Clipboard-Inhalt best effort wieder her
- Scratchpad und Last-Transcript-Restore bleiben sichtbar in der Input-UX
- aktuelle Insert-Ergebnisse enthalten `recovery_action`, `recovery_message` und `clipboard_restore`, damit Settings und Diagnostics klar zwischen keiner Aktion, manuellem Paste, Scratchpad-Recovery und Clipboard-Restore-Signal unterscheiden koennen
- persistierte History-Eintraege und History-Exporte tragen dieselben Recovery-Felder, damit Retry, Export und Diagnostics dieselbe Insert-Wahrheit behalten
- Scratchpad-Recovery in Input, diagnostische Preview-Transkripte in Diagnostics und der persistente History-Store sind drei getrennte native Datenflaechen
- Overlay, Input und About lesen denselben nativen Plattformstatus

## Bekannte offene Produktluecken

- keine publizierten versionierten Releases
- kein signierter In-Place-Auto-Updater
- Release- und Signing-Validation mit echten Secrets ist noch kein regelmaessiger Routinepfad
- Linux Wayland bleibt experimentell
- ein gefuehrter Setup-, Permissions- und Packaging-Pfad von Install bis erster brauchbarer Diktation ist noch nicht implementiert
- `local_preview` ist noch keine first-class Local Lane; Modellmanagement, Health-Diagnostics, Bias-Prompting und Quality-vs-Latency-Presets fehlen noch
- mehrere vollwertige Produktionsprovider ueber Groq hinaus sind noch nicht implementiert; ebenso fehlt noch ein explizites Mode-Modell wie `fast`, `quality`, `local` oder `self_hosted`
- Settings- und Overlay-UI brauchen noch eine klarere Informationshierarchie und mehr native macOS-Produktpolish; die aktuelle Shell ist brauchbar, aber noch nicht der Zielzustand
- Profile sind noch nicht zu echten Arbeitsmodi mit Defaults fuer Rewrite, Insert und Recovery verdichtet; spaetere app- oder mode-basierte Aktivierung bleibt ebenfalls offen
- Overlay ist noch kein Live-Preview- und Controlled-Commit-Pfad mit `raw transcript`, bereinigtem Text, aktivem Profil und schnellen Recovery-Aktionen
- spaetere Notes- und weitergehende Workflow-Aufbauten auf Basis des neuen History-Kerns sind noch nicht implementiert

Explizit nicht naechste Baustelle dieser Produktphase sind `openwhispr`-Themen wie Notes, Search, Sync, MCP oder Assistant-Scope. Diese bleiben nachgelagert, bis WordScript als taegliches Diktierprodukt persoenlicher und vertrauenswuerdiger geworden ist.

## Release build-up status

- der aktive Repo-Pfad bleibt source-first mit `tauri dev`, hat aber wieder einen Build-Matrix-Workflow und Bundle-Ziele fuer Linux, macOS und Windows
- die aktuelle Nutzerrealitaet bleibt die Dev-Version via `npm run tauri dev`
- parallel entsteht das erste offizielle Cross-Platform-App-Release fuer Linux, macOS und Windows
- `check_app_update` signalisiert aktuell ehrlich, dass noch keine publizierten Releases existieren
- es gibt aktuell keinen aktiven Installer-Kanal und keinen vertrauenswuerdigen Download-Handoff fuer Endnutzer
- PR-CI validiert Frontend-Tests, Frontend-Build, `cargo check` und `cargo test` auf Ubuntu, macOS und Windows
- der manuelle Release-Build-Up-Workflow fuehrt Frontend-Tests, Rust-Tests und Frontend-Build vor dem Bundling aus
- Linux-AppImage-Packaging ist aktuell noch nicht release-stabil und kann im Build-Up-Pfad an `linuxdeploy` scheitern
- Packaging, Signing und Updater-Arbeit sind im Aufbau, aber noch nicht als live Nutzerpfad freigegeben

## Verbleibender Dokumentensatz

Das absichtlich kleine Doku-Set ist:

- `README.md` fuer Projektueberblick
- `docs/VISION.md` fuer Produktziel und V1/V2-Einordnung
- `docs/ARCHITECTURE.md` fuer Systemwahrheit und Ownership
- `docs/DEVELOPMENT.md` fuer Arbeitsmodus und Validation
- `docs/DESIGN_SYSTEM.md` fuer UI-Regeln
- `docs/REFERENCE.md` fuer aktuelle Fakten und Grenzen
- `docs/RELEASE_RUNBOOK.md` fuer den aktuellen Release-Aufbaupfad

Weitere Dateien brauchen einen engeren Zweck als diese sechs Dokumente.