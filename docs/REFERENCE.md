# WordScript — Reference

Stand: 2026-05-12

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
- Halluzinationsfilter und optionale AI-Nachkorrektur
- Personal Dictionary und Snippets im nativen Transform-Pfad
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

### Groq-Modell

- aktuell ist nur Groq im aktiven Produktpfad implementiert
- der Nutzer speichert den eigenen API-Key lokal im OS secret store
- die JSON-Konfiguration wird beim Speichern gescrubbt
- ein WordScript-Proxy oder Hosted Mode existiert nicht

### Audio- und Upload-Relevanz

- Capture-Dateien werden fuer Groq auf 16 kHz Mono-WAV normalisiert
- der Runtime-Pfad nutzt ein kurzes interaktives Timeout von `18_000` bis `35_000` Millisekunden
- die aktive Transkriptionsanfrage laeuft ohne Retry-Kette (`max_retries = 0`)

Relevante externe Groq-Grenze fuer den Produktpfad:

- `413 request_too_large` bezieht sich auf Upload-Groesse, nicht nur auf Dauer
- dokumentierte Richtwerte aus der aktuellen Integration: Free `25 MiB`, Dev `100 MiB` pro Upload

Diese Werte sind nur insofern Teil der Produktreferenz, wie sie den aktiven Desktop-Flow beeinflussen.

## Text Rules und Profilstatus

### Heute aktiv

- ein globaler `Transcription Context`
- ein globales Personal Dictionary
- eine globale Snippet-Liste
- globale Schalter fuer AI cleanup, filler filter und rewrite phrasing

### Heute nicht aktiv

- kein lokales Profilsystem
- keine Prompt-Library als Produktfunktion
- keine Assistant-Identitaeten
- kein Team- oder Sync-Modell

Wichtige Doku-Regel dazu:

- `Transcription Context` bleibt eine STT-Hilfe
- Profile sind geplant, aber nicht implementiert
- geplante Profile duerfen nicht als aktive Funktion beschrieben werden

## Insertion- und Recovery-Modell

Der Insert-Pfad kann heute in vier sichtbare Modi enden:

- `direct_paste`
- `clipboard_only`
- `clipboard_fallback`
- `scratchpad_fallback`

Zusatzregeln des aktiven Pfads:

- erfolgreicher Direct Insert stellt den vorherigen Clipboard-Inhalt best effort wieder her
- Scratchpad und Last-Transcript-Restore bleiben sichtbar in der Input-UX
- Overlay, Input und About lesen denselben nativen Plattformstatus

## Bekannte offene Produktluecken

- keine publizierten versionierten Releases
- kein signierter In-Place-Auto-Updater
- Release- und Signing-Validation mit echten Secrets ist noch kein regelmaessiger Routinepfad
- Linux Wayland bleibt experimentell
- mehrere Provider oder lokaler Offline-Standardpfad sind noch nicht implementiert
- Profile ueber den globalen Text-Rules-Zustand hinaus sind noch nicht implementiert

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