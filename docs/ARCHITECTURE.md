# WordScript — Architecture

Stand: 2026-05-12

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
- `settings`: Shell mit den Tabs Provider & Models, Input, Text Rules, About und Diagnostics

Wichtige Frontend-Bausteine:

- `src/windows/OverlayWindow.tsx`
- `src/windows/SettingsWindow.tsx`
- `src/hooks/useRuntime.ts`
- `src/hooks/useGroqProvider.ts`
- `src/hooks/useNativeInsertion.ts`
- `src/hooks/useRuntimeLogs.ts`
- `src/components/settings/*`

Die UI ist verantwortlich fuer:

- Anzeige von Runtime-Status, Waveform und Fehlermeldungen
- Pflege der Config-Werte
- Preview, Validation und Import/Export der Text Rules
- Sichtbare Recovery-Aktionen und Diagnostics

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

- `config.rs`: Config-Lifecycle, Disk-I/O, Scrubbing sensibler Werte
- `runtime_log.rs`: gepufferte strukturierte Runtime-Logs fuer die Diagnostics-UI
- `paths.rs`: Produktpfade wie Config und Scratchpad

### Aufnahme und Session

- `trigger.rs`: globale Start/Stop-, Pause/Resume- und Abort-Hotkeys
- `capture.rs`: Audioaufnahme, Level-/Waveform-Events, Silence-/Max-Duration-Autostop
- `sessions.rs`: Laufzeitstatus und Session-Uebergaenge
- `sound.rs`: Start-, Stop-, Abort-, Startup- und Error-Cues

### Provider und Textverarbeitung

- `providers/groq.rs`: aktiver Cloud-Provider, BYOK, Secret Store, Fehlerklassen
- `transform.rs`: Halluzinationsfilter, optionale Nachkorrektur, Dictionary- und Snippet-Aufloesung
- `text_rules.rs`: Analyse, Preview, Import/Export und Konfliktbehandlung der Text Rules

### Insertion und Recovery

- `insertion.rs`: Paste-Strategien, Clipboard-Restore, Scratchpad und Plattformstatus

`NativeInsertionPlatformStatus` ist der Support-Vertrag dieses Pfads. Er liefert Label, Support-Tier, Insert-Strategie, Freitext sowie konkrete Voraussetzungen und ehrliche Grenzen fuer die UI.

## Session-Fluss

Der aktive Fluss sieht so aus:

1. Hotkey wird im nativen Trigger erkannt.
2. `capture.rs` startet die Aufnahme und emittiert Level-/Waveform-Events.
3. Aufnahme endet durch Stop-Hotkey, Silence-Timeout, Max-Duration oder Abort.
4. Audio wird als 16 kHz Mono-WAV fuer den Provider vorbereitet.
5. `providers/groq.rs` sendet die Datei an Groq.
6. `transform.rs` prueft und bereinigt den Transkriptionsoutput.
7. `insertion.rs` waehlt den Insert-Modus und fuehrt ihn aus.
8. UI bekommt Status, letztes Transkript und moegliche Recovery-Daten zurueck.

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
- lokale Profile existieren im Produkt noch nicht

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

## Plattformmodell

WordScript modelliert Plattformgrenzen explizit:

- macOS und Windows sind die Tier-1-Zielpfade
- Linux X11 ist Preview
- Linux Wayland bleibt experimentell und haengt an XWayland-/Clipboard-Fallbacks

Das ist keine Marketing-Sprache, sondern Teil des Insert- und Support-Modells.

## Provider-Modell

Im aktiven Produktpfad gibt es genau einen echten Provider: Groq.

Architekturregeln dafuer:

- Groq laeuft als BYOK-Modell
- der API-Key liegt im OS secret store
- die JSON-Config wird beim Speichern gescrubbt
- ein eigener WordScript-Proxy oder Hosted Mode existiert nicht

Wenn spaeter weitere Provider dazukommen, gehoeren sie unter `src-tauri/src/core/providers/` und muessen denselben Fehler- und Antwortvertrag bedienen.

## Was bewusst noch nicht Architekturrealitaet ist

Diese Themen sind moegliche spaetere Produktstufen, aber heute nicht aktive Architektur:

- lokaler/offline Standardpfad
- lokales Profilsystem fuer mehrere Arbeitskontexte
- Team- oder Sync-Modell
- AI-Assistant- oder Screen-Context-Workflows
- veroeffentlichter Installer-Kanal und fertiger In-Place-Updater

Wenn die Doku eines dieser Themen beschreibt, muss klar markiert sein, dass es geplant und nicht aktiv ist.