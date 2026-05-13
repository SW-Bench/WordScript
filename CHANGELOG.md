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
- benchmark matrix for donor repositories, feature fit and staged WordScript expansion
- core execution plan that maps donor files to the next WordScript kernel slices
- native transcription history with persistence, retention, delete/clear commands and retry-based re-processing from stored raw transcripts
- local text profiles that bundle transcription context, dictionary and snippets into native runtime config and active Text Rules UI
- curated local profile starters for core ICPs with Customer Success, Sales, Founder/Ops, Recruiting and Product/Engineering baselines

### Changed

- the documentation set was consolidated into README, VISION, ARCHITECTURE, DEVELOPMENT, DESIGN_SYSTEM and REFERENCE
- product scope and wording now consistently describe WordScript as a dictation-first desktop app on `0.2.2-alpha`
- future planning docs now describe sync as an optional WordScript-owned local-first layer instead of leaving peer-to-peer or external hub ownership ambiguous
- native session transitions now run through shared session helpers, so trigger, commands and pipeline completion no longer finalize the same lifecycle edges independently
- provider status, credential and transcription dispatch now run through shared provider commands and types, while Groq remains the only wired production provider
- provider selection now exposes a second `local_preview` lane that uses an external `whisper-cli` runner and local ggml models without changing the capture, transform, insertion or recovery pipeline shape
- `local_preview` now strips timestamped `whisper-cli` segment output more cleanly and resolves common model variants from model directories instead of only exact `ggml-<model>.bin` names
- native history now supports server-side provider/status/profile filters, JSON export and persisted limit/retention policy instead of only a fixed in-memory diagnostics slice
- active config and settings terminology now use `provider` consistently, while the old JSON `groq_api_key` survives only as an explicit legacy migration field
- legacy Groq-secret migration now happens in the native config/provider path before save, so the frontend no longer owns or receives the legacy secret field
- Linux insertion now uses an explicit native driver chain with visible helper diagnostics for `wl-copy`, `xdotool`, `wtype`, `ydotool`, `enigo` and scratchpad recovery instead of implicit paste fallbacks
- Rebuild Lab now separates durable transcription history from transient runtime logs while reading both from the same native runtime truth
- Text Rules now scopes transcription context, dictionary and snippets to the selected local text profile while keeping preview, import/export and diagnostics tied to that active profile
- Settings now exposes the active text profile globally in the sidebar with a manual switcher, avatar badge and quick path into the Text Rules editor, while shared helper logic keeps shell and editor profile patches aligned
- Text Rules now includes a local starter-template library with curated ICP profiles plus `create profile` and `merge into active` flows, where merge adds missing context, dictionary terms and snippets without overwriting existing authored rules
- Text Rules now uses a sequenced workspace layout with a compact setup deck for profile editing and starter picks, top stage navigation and one dominant editing surface at a time instead of stacking profile, starter and rule-editing surfaces together
- Input and Diagnostics now name scratchpad recovery, diagnostic preview transcript and persistent transcription history as separate native data surfaces, and Diagnostics exposes the native history store path directly in the UI
- VISION, DEVELOPMENT and README now describe long-term assistant / computer-use expansion as a later platform stage without widening the active V1 scope
- Text Rules documentation now reflects the real native order `active profile -> transcription context -> dictionary -> snippets`
- planning and design docs now name Settings/Overlay UI polish as the current product bottleneck, with a native-feeling macOS utility-app target plus concrete donor and style-reference repos for the next UI pass
- planning docs now also describe the next post-core product phase explicitly: work-mode profiles, live preview plus controlled commit, a product-ready provider stack, a first-class local lane and guided setup/permissions/packaging, while deferring broader openwhispr platform scope like notes, search, sync, MCP and assistant features
- the core execution plan now treats the macOS-utility UI target and user-facing usability as hard product gates for slices 7 to 11 instead of leaving them implicit in the design docs
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
- the native pipeline no longer completes the same session twice when insertion succeeds, and failed insertion now finishes the session on the pipeline owner instead of inside the insert adapter
- provider config values now normalize to a supported runtime provider, and post-correction uses the same provider dispatch layer as transcription
- history entries now keep the active text profile name through success, empty, retry and failure paths instead of dropping profile context in diagnostics
- the settings UI now keeps cloud and local preview model slots separate, shows honest helper prerequisites for the local lane and hides API-key actions when the preview lane is selected
- retry in diagnostics is now a real re-process path through transform and insertion, not only a clipboard restore shortcut
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
- legacy Groq keys from old JSON configs are migrated natively into the OS secret store before the sanitized config is persisted again

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
