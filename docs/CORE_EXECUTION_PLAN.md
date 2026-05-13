# WordScript - Core Execution Plan

Stand: 2026-05-13

## Zweck

Dieses Dokument uebersetzt die Benchmark-Matrix in eine konkrete Arbeitsreihenfolge.

Es beantwortet nicht, was WordScript irgendwann alles werden koennte, sondern was jetzt nacheinander gebaut werden muss, damit der Kern stark, belastbar und spaeter ausbaufaehig wird.

## Was der Kern wirklich ist

Der WordScript-Kern ist nicht "alles, was spaeter sprachgesteuert passieren soll".

Der Kern ist der Pfad, der fuer jede spaetere Produktstufe tragfaehig sein muss:

1. Trigger
2. Capture
3. Transcription
4. Transform
5. Insert
6. Recovery
7. History / Diagnostics / Settings-Vertrag

Wenn dieser Pfad nicht stark ist, helfen spaetere Features wie Notes, MCP oder Assistant-Scope nicht.

## Donor-Prinzip

Wir lesen die geklonten Repos nicht breit, sondern entlang der owning surfaces.

### Donor-Dateien fuer den aktiven Kern

- `../Handy/src-tauri/src/transcription_coordinator.rs`
- `../Handy/src-tauri/src/commands/history.rs`
- `../voxtype/src/output/mod.rs`
- `../voxtype/config/default.toml`
- `../openwhispr/src/stores/settingsStore.ts`
- `../openwhispr/src/helpers/enterpriseAiProviders.js`
- `../openwhispr/src/helpers/audioManager.js`
- `../hyprwhspr/bin/hyprwhspr`
- `../VoiceInk/VoiceInk/Services/DictionaryService.swift`
- `../VoiceInk/VoiceInk/PowerMode/PowerModeSessionManager.swift`
- `../FluidVoice/Sources/Fluid/Persistence/TranscriptionHistoryStore.swift`
- `../FluidVoice/Sources/Fluid/Services/CommandModeService.swift`

### Was diese Donoren konkret liefern

- `Handy`: serialisierte Runtime-Orchestrierung und brauchbarer History-Vertrag
- `voxtype`: Insert-Treiberkette, Output-Modi, Linux-/Wayland-Fallbacks, konfigurierbare Profileingaben
- `openwhispr`: Migration von Single-Provider-Settings zu Inference-Modes, BYOK-/Enterprise-Split, Dictionary-Prompting fuer STT
- `hyprwhspr`: saubere Trennung von CLI, Setup und Runtime-Lane
- `VoiceInk`: Dictionary-Service und session-basierte App-/Power-Modes
- `FluidVoice`: lokale History-Store-Struktur und spaetere Command-Mode-Form

## Arbeitsmodus fuer die naechsten Slices

Die naechsten Slices folgen immer demselben Muster:

1. Donor-Dateien lesen
2. WordScript-Zielfiles festlegen
3. kleinsten echten Runtime-Slice bauen
4. Build + Tests laufen lassen
5. erst dann zum naechsten Slice gehen

Wichtig:

- kein Parallelbau an fuenf neuen Kernsystemen gleichzeitig
- kein Assistant-Scope, bevor Provider-, Insert- und History-Grundlagen stehen
- keine UI-Option, bevor der native Pfad existiert

## Slice 1 - Runtime-Koordinator haerten

### Ziel

Den aktiven Trigger-/Capture-/Processing-Pfad in WordScript expliziter serialisieren, damit Start, Stop, Abort und Busy-Zustaende nicht implizit zwischen mehreren Rust-Oberflaechen driften.

### Donor-Muster

- `Handy/src-tauri/src/transcription_coordinator.rs`

### Was dort gut ist

- ein einziger Koordinator-Thread besitzt die Pipeline-Stage
- Input-, Cancel- und Processing-Finished-Ereignisse laufen seriell durch denselben Pfad
- Busy-Zustaende und Debounce sind nicht ueber mehrere Stellen verteilt

### WordScript-Zieloberflaechen

- `src-tauri/src/core/sessions.rs`
- `src-tauri/src/core/trigger.rs`
- `src-tauri/src/lib.rs`

### Gewuenschte Zielstruktur in WordScript

- ein expliziter Lifecycle-Owner fuer `idle`, `capturing`, `processing`, `completed`, `error`, `aborted`
- Start/Stop/Abort/Pause-Intents laufen ueber denselben nativen Koordinator
- UI und Tray lesen nur abgeleiteten Zustand, statt selbstaendig Orchestrierung zu implizieren

### Exit-Kriterien

- doppelte Trigger feuern keinen zweiten Capture-Start
- Stop waehrend `processing` fuehrt nicht zu driftendem State
- Abort setzt Stage, Overlay und Recovery konsistent zurueck

## Slice 2 - Provider-Vertrag verallgemeinern

### Ziel

Groq vom Einzeladapter zum ersten Provider in einem echten Provider-System machen, das spaeter lokale und weitere Cloud-Lanes aufnehmen kann.

### Donor-Muster

- `openwhispr/src/stores/settingsStore.ts`
- `openwhispr/src/helpers/enterpriseAiProviders.js`

### Was dort gut ist

- Migration von historisch gewachsenen Provider-Flags in klare Inference-Modes
- saubere Trennung zwischen local, providers, self-hosted und enterprise-artigen Pfaden
- schwere Provider-SDKs werden spaet und getrennt geladen

### WordScript-Zieloberflaechen

- `src-tauri/src/core/providers/`
- `src-tauri/src/core/config.rs`
- `src/types/providers.ts`
- `src/hooks/useProvider.ts`

### Gewuenschte Zielstruktur in WordScript

- gemeinsamer Provider-Request-/Response-Vertrag fuer Transcription
- Konfigurationsmodell fuer `mode`, `provider`, `self_hosted`, `local` statt Groq-Sonderfall
- Secret-Store-Handhabung pro Provider ohne JSON-Leaks

### Exit-Kriterien

- Groq laeuft weiter unveraendert als erster produktiver Adapter
- Konfigurationsschema blockiert spaetere Provider nicht mehr
- UI und Rust teilen denselben Provider-Vertrag typisiert

## Slice 3 - Insert-Stack fuer Linux / Wayland haerten

### Ziel

Die Textinsertion von WordScript muss unter Linux nicht nur "irgendwie paste" koennen, sondern eine klare Treiberkette mit Fallbacks, Unicode-Verhalten und Recovery besitzen.

### Donor-Muster

- `voxtype/src/output/mod.rs`
- `voxtype/config/default.toml`
- `hyprwhspr/bin/hyprwhspr`

### Was dort gut ist

- voxtype definiert die Output-Treiber explizit und in Reihenfolge
- Fallbacks sind kein Zufall, sondern Teil des Produkts
- Konfiguration und Runtime sind sauber getrennt
- hyprwhspr trennt CLI-/Setup-/Runtime-Lane klar genug, um Packaging und Runtime nicht zu vermischen

### WordScript-Zieloberflaechen

- `src-tauri/src/core/insertion.rs`
- `src-tauri/src/core/config.rs`
- `src/types/nativeInsertion.ts`
- `src/components/settings/InputTab.tsx`

### Gewuenschte Zielstruktur in WordScript

- explizite Insert-Driver-Kette nach Plattform
- klarer Unterschied zwischen `type`, `paste`, `clipboard_only`, `scratchpad`
- Linux-spezifische Diagnostics benennen den echten fehlenden Helfer statt nur "not supported"

### Exit-Kriterien

- Wayland/X11-Insert-Pfad ist im Code als Kette nachvollziehbar
- Diagnostics nennen aktive Strategie plus Fallback-Grund
- Clipboard-Restore bleibt best effort, aber strukturell stabil

## Slice 4 - Lokale STT-Lane als Preview einfuehren

Status: umgesetzt als `local_preview`-Lane ueber externes `whisper-cli` plus lokale ggml-Modelle; AI cleanup bleibt cloud-first und faellt im Preview-Pfad auf Rohtext zurueck.

### Ziel

WordScript braucht eine echte lokale Preview-Lane als zweite Produktspur fuer offline, privacy und resilience, ohne den cloud-first Kern umzudrehen.

### Donor-Muster

- `Handy` Modell- und Runtime-Pfade
- `voxtype` Engine- und Output-Modell
- `openwhispr/src/helpers/audioManager.js`

### Was dort gut ist

- Dictionary-/Bias-Prompting wird direkt an STT uebergeben
- lokaler Pfad ist nicht nur ein Demo-Feature, sondern eine echte Fallback- oder Wahl-Lane
- mehrere Engines koennen hinter demselben Produktpfad haengen

### WordScript-Zieloberflaechen

- `src-tauri/src/core/providers/`
- `src-tauri/src/core/transform.rs`
- `src/components/settings/ApiModelsTab.tsx`

### Gewuenschte Zielstruktur in WordScript

- lokaler Preview-Provider mit demselben Antwortvertrag wie Groq
- Transcription Context / Dictionary kann optional als Prompt-Bias genutzt werden
- UI macht klar: local ist Preview-Lane, cloud-first bleibt der Hauptpfad

### Exit-Kriterien

- ein lokaler Provider kann ueber denselben Runtime-Pfad transkribieren
- Transform und Insertion unterscheiden nicht zwischen lokal und cloud
- bestehende Recovery-Pfade funktionieren fuer beide Lanes

## Slice 5 - History und Diagnostics zur echten Kernschicht machen

Status: umgesetzt mit Persistenz, Delete/Clear, Retry ueber raw transcript -> transform -> insert, konfigurierbarer Retention-Policy, serverseitigen Filtern, JSON-Export und separater Rebuild-Lab-Darstellung neben Runtime-Logs.

### Ziel

History darf nicht nur Debugging-Anhang sein. Sie ist der Anfang von Transcript-Verlauf, Retry, spaeteren Exports und spaeteren Notes.

### Donor-Muster

- `Handy/src-tauri/src/commands/history.rs`
- `FluidVoice/Sources/Fluid/Persistence/TranscriptionHistoryStore.swift`
- `openwhispr/src/stores/transcriptionStore.ts`

### Was dort gut ist

- History hat CRUD, Retry und Retention statt nur passivem Log
- Eintraege enthalten roh vs verarbeitet, Kontext und Fehler
- UI-Stores bleiben von Runtime-Ereignissen inkrementell aktuell

### WordScript-Zieloberflaechen

- `src-tauri/src/core/runtime_log.rs`
- `src-tauri/src/core/paths.rs`
- `src/components/settings/RebuildLabTab.tsx`
- neue native History-Oberflaeche unter `src-tauri/src/core/`

### Gewuenschte Zielstruktur in WordScript

- History-Eintrag enthaelt mindestens: Zeit, raw transcript, transformed transcript, insert outcome, provider, active profile und Fehler wenn vorhanden
- Retry ist nicht nur last transcript restore, sondern echte Re-Process-Funktion
- Diagnostics und History teilen Daten, statt zwei parallele Wahrheiten zu pflegen

### Exit-Kriterien

- nativer Verlauf existiert unabhaengig vom UI
- Rebuild Lab kann History und Runtime-Log trennen, aber aus derselben Realitaet lesen
- Verlauf wird Basis fuer spaetere Export- und Notes-Funktionen

## Slice 6 - Lokale Profile fuer Kontext, Dictionary und Snippets

Status: umgesetzt als native Textprofile in `config.rs` mit aktivem Profil, Migration des alten globalen Rule-Zustands, profile-spezifischer Text-Rules-UI und History-Metadaten fuer den aktiven Arbeitsmodus.

### Ziel

Profile sind die erste echte Verdichtung des Kerns, weil sie den selben Dictation-Pfad je nach Arbeitskontext produktiver machen.

### Donor-Muster

- `VoiceInk/VoiceInk/Services/DictionaryService.swift`
- `VoiceInk/VoiceInk/PowerMode/PowerModeSessionManager.swift`
- `voxtype/config/default.toml`

### Was dort gut ist

- Dictionary und Word-Replacements sind eigene Services statt Nebenlogik
- App-/Mode-bezogene Settings koennen als Session angewendet und sauber wiederhergestellt werden
- Profile sind konkrete Arbeitsmodi, nicht abstrakte Benutzerverwaltung

### WordScript-Zieloberflaechen

- `src-tauri/src/core/text_rules.rs`
- `src-tauri/src/core/config.rs`
- `src/components/settings/PromptsTab.tsx`
- `src/components/settings/InputTab.tsx`

### Gewuenschte Zielstruktur in WordScript

- lokales Profil kapselt `context`, `dictionary`, `snippets`, spaetere rewrite defaults
- Profile koennen manuell umgeschaltet werden
- spaetere app- oder hotkey-basierte Aktivierung bleibt offen, wird aber vom Datenmodell vorbereitet

### Exit-Kriterien

- Profile existieren als native Datenstruktur
- Transform-Pipeline liest aktives Profil statt globaler Einzellisten
- UI kann Profile anlegen, duplizieren, waehlen und testen

## Was bewusst noch nicht gebaut wird

Diese Themen bleiben nachgelagert, auch wenn sie langfristig Zielbild sind:

- Meeting-Transkription mit Speaker-Diarization
- Transcript-zu-Notes-Workflows
- semantic search
- sync mit users / tenants / cloud workspaces
- MCP / API
- Assistant / Browser-Use / Computer-Use

Der Grund ist nicht, dass diese Themen unwichtig sind, sondern dass sie auf Slice 1 bis 6 aufbauen.

Wenn diese Stufe spaeter gebaut wird, ist die aktuelle Zielrichtung ein optionaler WordScript-eigener local-first Sync mit Account- und Cloud-Workspace-Layer. Kein Peer-to-Peer-Primarmodell und kein externer Produkt-Hub sollen dafuer die Grundannahme werden.

## Konkrete Lesereihenfolge fuer die naechsten Arbeitstage

### Tag 1

- `Handy/src-tauri/src/transcription_coordinator.rs`
- `src-tauri/src/core/sessions.rs`
- `src-tauri/src/lib.rs`

Ziel:

- WordScript-Lifecycle-Owner definieren

### Tag 2

- `openwhispr/src/stores/settingsStore.ts`
- `openwhispr/src/helpers/enterpriseAiProviders.js`
- `src-tauri/src/core/providers/groq.rs`
- `src-tauri/src/core/config.rs`

Ziel:

- Provider-Vertrag in WordScript aufspannen

### Tag 3

- `voxtype/src/output/mod.rs`
- `voxtype/config/default.toml`
- `src-tauri/src/core/insertion.rs`

Ziel:

- Linux-Insert-Driver-Kette fuer WordScript definieren

### Tag 4

- `Handy/src-tauri/src/commands/history.rs`
- `FluidVoice/Sources/Fluid/Persistence/TranscriptionHistoryStore.swift`
- `src-tauri/src/core/runtime_log.rs`

Ziel:

- native History-Struktur fuer WordScript entwerfen

### Tag 5

- `VoiceInk/VoiceInk/Services/DictionaryService.swift`
- `VoiceInk/VoiceInk/PowerMode/PowerModeSessionManager.swift`
- `src-tauri/src/core/text_rules.rs`

Ziel:

- Profil- und Dictionary-Modell fuer WordScript aufspannen

## Schlussregel

Ein facettenreicher Kern entsteht nicht dadurch, dass WordScript sofort Notes, Meetings und Agenten bekommt.

Er entsteht dadurch, dass derselbe Dictation-Kern spaeter all diese Dinge tragen kann, ohne neu gebaut werden zu muessen.

Deshalb ist die richtige Reihenfolge:

1. Koordinator
2. Provider-Vertrag
3. Insert-Stack
4. Local Lane
5. History
6. Profile

Danach erst die Plattform oberhalb des Kerns.