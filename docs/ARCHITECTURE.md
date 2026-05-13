# WordScript — Architecture

Stand: 2026-05-13

## Zweck

Dieses Dokument beschreibt die aktive Systemarchitektur von WordScript. Es soll zeigen, wo Verhalten heute wirklich entschieden wird und wie neue Arbeit verortet werden muss.

Der alte Python-Sidecar ist nicht mehr der Referenzpfad.

## Leitprinzipien

- Rust ist Runtime-Owner fuer Trigger, Capture, Provider, Transform, Insert und Recovery.
- React stellt dar, konfiguriert und erklaert denselben nativen Zustand.
- WordScript ist cloud-first im aktuellen Produktpfad.
- Typed contracts zwischen UI und Runtime sind Pflicht.
- Recovery und Support-Grenzen sind Teil der Architektur, nicht nur Begleittext.

## Aktive Schichten

```text
React UI
    overlay + settings + diagnostics tab
                |
                | invoke() + events
                v
Tauri host
    windows + tray + commands + event bridge
                |
                v
Rust core
    config + trigger + capture + sessions + providers + transform + insertion + sound
```

## UI-Schicht

Die aktive UI besteht derzeit aus zwei Fenstern in der Tauri-Konfiguration:

- `overlay`: transparente Pill fuer Aufnahmezustand
- `settings`: Shell mit den Tabs Provider & Models, Input, Text Rules, About und Diagnostics sowie einem persistenten Profil-Dock in der Sidebar

Wichtige Frontend-Bausteine:

- `src/windows/OverlayWindow.tsx`
- `src/windows/SettingsWindow.tsx`
- `src/hooks/useRuntime.ts`
- `src/hooks/useProvider.ts`
- `src/hooks/useNativeInsertion.ts`
- `src/hooks/useRuntimeLogs.ts`
- `src/components/settings/*`

Die UI ist verantwortlich fuer:

- Anzeige von Runtime-Status, Waveform und Fehlermeldungen
- Pflege der Config-Werte
- global sichtbare manuelle Profilumschaltung in der Sidebar plus lokale Starter-Templates, Preview, Validation und Import/Export in den Text Rules
- Text Rules als Workspace mit linker Kontrollspur fuer Profilwahl, Schritt-Navigation und sekundare Starter-Hilfe; rechts steht immer nur eine dominante Bearbeitungsstufe fuer Context/Preview, Dictionary oder Snippets
- Sichtbare Recovery-Aktionen und Diagnostics
- getrennte Darstellung von transienten Runtime-Logs und dauerhaftem nativen Transkriptverlauf inklusive Filter, Export und sichtbarem History-Store-Pfad; Recovery-Scratchpad bleibt davon getrennt

Die UI ist nicht verantwortlich fuer:

- globale Shortcut-Registrierung
- Mikrofon-Capture
- Session-State-Machine
- Insert-Entscheidungen

## Tauri-Host

`src-tauri/src/lib.rs` ist die Huelle des Produkts. Dort liegen:

- Window-Setup fuer Overlay und Settings
- Tray-Menue und Fensteroeffnung
- Command-Registrierung
- Event-Emission fuer `wordscript-event` und `wordscript-native-event`
- Grobe Orchestrierung zwischen Trigger-Effekt, Capture-Ende, Provider-Aufruf und Runtime-Feedback

Der Host ist die Bruecke, nicht die Business-Logik.

## Rust-Core-Module

Der aktive Produktkern sitzt in `src-tauri/src/core/`.

### Konfiguration und Status

- `config.rs`: Config-Lifecycle, Disk-I/O, Scrubbing sensibler Werte und lokales Textprofil-Modell
- `runtime_log.rs`: gepufferte strukturierte Runtime-Logs fuer die Diagnostics-UI
- `history.rs`: persistenter nativer Verlauf mit raw vs transformed transcript, Insert-Outcome, serverseitigen Filtern, Export, Retention-Policy und Retry
- `paths.rs`: Produktpfade wie Config und Scratchpad

### Aufnahme und Session

- `trigger.rs`: globale Start/Stop-, Pause/Resume- und Abort-Hotkeys
- `capture.rs`: Audioaufnahme, Level-/Waveform-Events, Silence-/Max-Duration-Autostop
- `sessions.rs`: Laufzeitstatus und gemeinsame Session-Uebergaenge fuer Trigger, Commands und nativen Pipeline-Abschluss
- `sound.rs`: Start-, Stop-, Abort-, Startup- und Error-Cues

### Provider und Textverarbeitung

- `providers/mod.rs`: gemeinsamer Provider-Vertrag, Dispatch und generische Command-Oberflaechen
- `providers/groq.rs`: erste produktive Cloud-Implementierung fuer BYOK, Secret Store und Groq-spezifische HTTP-Fehler
- `providers/local_preview.rs`: externe `whisper-cli`-Preview-Lane fuer lokales STT ueber denselben Antwortvertrag
- `transform.rs`: Halluzinationsfilter, optionale Nachkorrektur, Dictionary- und Snippet-Aufloesung
- `text_rules.rs`: Analyse, Preview, Import/Export und Konfliktbehandlung der Text Rules

### Insertion und Recovery

- `insertion.rs`: Paste-Strategien, Clipboard-Restore, Scratchpad und Plattformstatus

`NativeInsertionPlatformStatus` ist der Support-Vertrag dieses Pfads. Er liefert Label, Support-Tier, Insert-Strategie, Freitext sowie konkrete Voraussetzungen und ehrliche Grenzen fuer die UI.
Fuer Linux liefert derselbe Vertrag jetzt auch eine explizite Driver-Kette fuer Clipboard- und Paste-Helfer inklusive aktiver Lane und fehlender Helfer.

## Session-Fluss

Der aktive Fluss sieht so aus:

1. Hotkey wird im nativen Trigger erkannt.
2. `capture.rs` startet die Aufnahme und emittiert Level-/Waveform-Events.
3. Aufnahme endet durch Stop-Hotkey, Silence-Timeout, Max-Duration oder Abort.
4. Audio wird als 16 kHz Mono-WAV fuer den Provider vorbereitet.
5. `providers/mod.rs` loest den aktiven Provider auf und delegiert heute an `providers/groq.rs` oder `providers/local_preview.rs`.
6. `transform.rs` prueft und bereinigt den Transkriptionsoutput und nutzt denselben Provider-Vertrag fuer AI cleanup.
7. `insertion.rs` waehlt den Insert-Modus und fuehrt ihn aus.
8. `history.rs` schreibt raw vs transformed transcript, aktives Textprofil, Insert-Outcome und Fehler in den nativen Verlauf.
9. `sessions.rs` finalisiert danach genau einmal `completed`, `aborted` oder `error`.
10. UI bekommt Status, letztes Transkript, History und moegliche Recovery-Daten zurueck.

## Session-State-Machine

Die Session-Stufen werden natuerlich im Core gehalten.

```text
idle -> capturing -> processing -> completed
    |         |             |
    |         v             v
    |      aborted        error
    +-------------------------------
```

`paused` ist kein eigener Stage-Name, sondern ein Capture-Zustand innerhalb von `capturing`.

## Transform-Reihenfolge

Die Textverarbeitung ist im aktiven Pfad keine Black Box. Die Reihenfolge ist bewusst fest:

1. Halluzinationsmuster ablehnen oder markieren
2. optionale AI-Nachkorrektur ausfuehren
3. Dictionary anwenden
4. Snippets anwenden

Wichtig:

- `prompt` ist heute nur Transcription Context fuer die STT-Anfrage
- Dictionary- und Snippet-Matches sind literal und case-insensitive
- lokale Textprofile kapseln heute `prompt`, Dictionary und Snippets als aktive Runtime-Konfiguration
- die aktuelle Local-Preview-Lane ist STT-only; wenn AI cleanup aktiv bleibt, faellt `transform.rs` auf das rohe lokale Transkript zurueck

## Insertion-Modi

`insertion.rs` entscheidet ueber mehrere echte Modi, nicht nur ueber einen simplen Paste-Versuch.

```text
if direct paste succeeds
    -> direct_paste
else if clipboard write succeeds but direct paste is not possible
    -> clipboard_only
else if fallback paste was attempted through helper paths
    -> clipboard_fallback
else
    -> scratchpad_fallback
```

Wichtige Architekturregeln dieses Pfads:

- erfolgreicher Direct Insert stellt den vorherigen Clipboard-Inhalt best effort wieder her
- Scratchpad und Last-Transcript-Restore sind Teil des Produktpfads
- Overlay, Input und About nutzen denselben nativen Plattformstatus als Quelle
- About zeigt Voraussetzungen und Grenzen aus diesem nativen Vertrag, statt pro Plattform neue UI-Nebenwahrheiten zu erfinden
- Linux/X11/Wayland werden als explizite Driver-Ketten modelliert; `wl-copy`, `xdotool`, `wtype`, `ydotool`, `enigo` und Scratchpad stehen im Status nicht mehr nur implizit im Code

## Plattformmodell

WordScript modelliert Plattformgrenzen explizit:

- macOS und Windows sind die Tier-1-Zielpfade
- Linux X11 ist Preview
- Linux Wayland bleibt experimentell und haengt an XWayland-/Clipboard-Fallbacks

Das ist keine Marketing-Sprache, sondern Teil des Insert- und Support-Modells.

## Provider-Modell

Im aktiven Produktpfad gibt es zwei klar getrennte Provider-Lanes:

- `groq`: cloud-first Produktionspfad fuer BYOK, Secret Store und AI cleanup
- `local_preview`: lokale STT-Preview-Lane ueber einen externen `whisper-cli`-Runner und lokale ggml-Modelle

Architekturregeln dafuer:

- Groq laeuft als BYOK-Modell
- der API-Key liegt im OS secret store
- die JSON-Config wird beim Speichern gescrubbt
- `local_preview` nutzt keine API-Keys, sondern sichtbare Helper-/Model-Voraussetzungen in Settings und Diagnostics
- `local_preview` ist bewusst kein zweiter Full-Feature-Produktpfad; Capture, Insertion und Recovery bleiben gleich, AI cleanup bleibt cloud-first
- ein eigener WordScript-Proxy oder Hosted Mode existiert nicht

Die aktuelle Local-Preview-Verdrahtung erwartet:

- `whisper-cli` in `PATH` oder `WORDSCRIPT_LOCAL_WHISPER_CLI`
- `WORDSCRIPT_LOCAL_MODEL_PATH` fuer eine einzelne ggml-Datei oder `WORDSCRIPT_LOCAL_MODEL_DIR` fuer `ggml-<model>.bin` und gaengige Varianten wie quantisierte oder `.en`-Dateien

Wenn spaeter weitere Provider dazukommen, gehoeren sie unter `src-tauri/src/core/providers/` und muessen denselben Fehler- und Antwortvertrag bedienen.

## Was bewusst noch nicht Architekturrealitaet ist

Diese Themen sind moegliche spaetere Produktstufen, aber heute nicht aktive Architektur:

- first-class lokale Lane mit Modellmanagement, Health-Diagnostics, Bias-Prompting und Quality-vs-Latency-Presets
- arbeitsmodusfaehige Profile mit Defaults fuer Rewrite, Insert und Recovery sowie spaeterer permission-basierter App-/Mode-Aktivierung
- Live-Preview-/Controlled-Commit-Overlay mit `raw transcript`, bereinigtem Text, aktivem Arbeitsmodus und schnellen Recovery-Aktionen
- weiteres Produktionsprovider-System mit expliziten Modi wie `fast`, `quality`, `local` und `self_hosted`
- gefuehrter Setup- und Permissions-Pfad von Install bis erster brauchbarer Diktation
- Team- oder Sync-Modell
- AI-Assistant- oder Screen-Context-Workflows
- veroeffentlichter Installer-Kanal und fertiger In-Place-Updater

Wenn spaeter ein Sync- oder Workspace-Pfad entsteht, ist die aktuelle Zielrichtung dafuer kein Peer-to-Peer-Primarmodell. Erwartet ist stattdessen eine WordScript-eigene Sync-Schicht auf einem lokalen Datenmodell mit optionalem Account- und Cloud-Workspace-Layer.

Daraus folgen fuer die spaetere Architektur diese Leitplanken:

- der lokale Dictation-Pfad bleibt ohne Account benutzbar
- Profile, Verlauf und spaetere Voice-Workspaces bleiben WordScript-owned
- ein spaeterer Sync-Service ist keine allgemeine Fremd-Hub-Abhaengigkeit
- Provider-Traffic bleibt nicht automatisch an einen WordScript-Proxy gebunden; Sync und STT-Transport sind getrennte Entscheidungen

Wenn die Doku eines dieser Themen beschreibt, muss klar markiert sein, dass es geplant und nicht aktiv ist.