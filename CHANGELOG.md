# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- Template for new releases:

## [X.Y.Z] - YYYY-MM-DD

### Added
- New features or capabilities

### Changed
- Changes to existing functionality

### Deprecated
- Features that will be removed in upcoming releases

### Removed
- Features removed in this release

### Fixed
- Bug fixes

### Security
- Security patches and vulnerability fixes

-->

## [Unreleased]

### Added

- native dictation runtime with trigger, capture, Groq transcription, transform, insertion and recovery in Rust
- active settings surface for Provider & Models, Input, Text Rules, About and Diagnostics
- manual cross-platform release build matrix and release runbook for the current commercial release build-up

### Changed

- the documentation set was consolidated into README, VISION, ARCHITECTURE, DEVELOPMENT, DESIGN_SYSTEM and REFERENCE
- product scope and wording now consistently describe WordScript as a dictation-first desktop app on `0.2.2-alpha`
- Text Rules documentation now reflects the real native order `transcription context -> dictionary -> snippets` without implying profiles that do not exist yet
- pull request CI now runs frontend tests and Rust tests on macOS and Windows in addition to Ubuntu
- the manual release build-up workflow now runs frontend tests and Rust tests before bundling
- platform support copy now exposes native prerequisites and honest limits for insertion, including macOS development-mode privacy requirements
- About, docs and backend surface now describe the release path as in progress, with no published releases yet
- release docs now explicitly describe Linux AppImage packaging as an in-progress `linuxdeploy` lane instead of implying a stable public release track
- README, VISION and REFERENCE now explain SW labs, SW-Bench and the community-build posture more directly
- repo setup and pre-commit behavior no longer regenerate legacy `BUILD_ID` and `build_info.json` files
- Diagnostics can now open either inside Settings or as a dedicated pop-out utility window while reusing the same active Rebuild Lab panel

### Deprecated

### Removed

- `build-sidecar.sh` und `build-sidecar.ps1` aus dem aktiven Repo-Pfad entfernt
- alter Python-Sidecar-Bestand inklusive `wordscript/`, `speech_to_text.py`, `WordScript.spec`, `requirements.txt` und `config.example.json` entfernt
- sichtbare AI-Assistant-, Account/Sync- und General-Placeholder aus der aktiven Settings-Oberflaeche entfernt
- totes `show_tray_icon`-Config-Feld aus dem aktiven Runtime-Vertrag entfernt
- veraltete `rebuild-lab.css` entfernt; das aktive Diagnostics-Pop-out nutzt jetzt dieselbe Settings-Shell wie das eingebettete Panel

### Fixed

- Linux hotkeys, overlay behavior, timeout handling, clipboard restore and diagnostics reflect the current native runtime path
- the client now exposes release build-up honestly without implying published installers or working in-place updates
- README, DEVELOPMENT and REFERENCE now include explicit macOS and Windows bootstrap paths instead of a Linux-only quick start
- Settings nutzen wieder transparente Fensterränder statt schwarzer Window-Fill-Flächen; die Shell bleibt dekorationslos im Fenster statt den gesamten Tauri-Canvas zu füllen
- About- und Utility-Links zeigen jetzt auf die aktiven SW-Bench-/SW labs-Ziele und werden nativ über den Opener-Plugin geöffnet statt über tote oder falsche Webview-Links
- Provider-Selects erzwingen jetzt dunkles Native-Styling statt weißer, unleserlicher Browser-Defaults
- der Groq-Key-Status ist jetzt neutral, solange ein Key nur im Secret Store liegt; grün wird erst nach expliziter erfolgreicher Validierung verwendet
- der native Trigger-Vertrag deckt jetzt Start/Stop, Pause/Resume und Abort mit registrierten Hotkeys ab; Settings speichern dabei die tatsächlich normalisierten nativen Shortcut-Werte zurück
- README public-project copy no longer contains the old `pay -wall` typo

### Security

- Groq API keys stay in the OS secret store and are scrubbed from the JSON config on save

## [0.2.0-alpha]

### Added

### Changed

### Deprecated

### Removed
- Debug-Code aus `SettingsWindow.tsx` und `lib.rs` entfernt

### Fixed
- Linux/Wayland: fataler `Gdk Error 71` beim App-Start behoben; der App-Start faellt fuer transparente/dekorationslose Fenster auf XWayland zurueck
- Linux/Wayland: Overlay-Crashs bei `show()`/`hide()`/`set_always_on_top()` behoben; die Sichtbarkeit wird stattdessen ueber Positionierung gesteuert
- Linux/Wayland: Crashs des Settings-Fensters bei `hide()`/`show()` behoben; `minimize()`/`unminimize()` und ein dauerhaft sichtbares Window-Setup stabilisieren den Pfad
- alle Plattformen: Dev-Config-Pfad von `./config.json` auf den einheitlichen User-Config-Pfad korrigiert, sodass Groq-Konfiguration und Transkription wieder funktionieren
- alle Plattformen: IPv6-bedingte Groq-Timeouts wirken im neuen Pfad nicht mehr blockierend, weil der IPv4-Transport-Fix mit dem korrigierten Config-Path wirksam wird

### Security

## [0.1.6-alpha]

### Added

### Changed

### Deprecated

### Removed

### Fixed
- alle Plattformen: Groq API-Calls mit 20 bis 60 Sekunden IPv6-Connect-Timeout durch erzwungenen IPv4-Transport stabilisiert
- Linux Dev-Mode: Python-Sidecar startet ueber das Projekt-Root jetzt verlaesslich mit der `.venv`, statt unkontrolliert das System-Python zu verwenden

### Security

## [0.1.5-alpha]

### Added

### Changed

### Deprecated

### Removed

### Fixed
- Linux: Groq API-Calls mit fehlgeschlagenem IPv6-Fallback durch erzwungenen IPv4-Transport stabilisiert

### Security
