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

Status: erster Haertungspass umgesetzt. StopCapture traegt jetzt die aktive Session-ID in die async Pipeline, und Completion, Empty, Provider-Fehler sowie Insert-Fehler werden nur angewendet, wenn diese ID noch zur aktiven `processing`-Session passt. Szenario-Tests decken zu fruehe Completion, stale Completion nach Abort/neuer Session und stale Failure nach Completion ab.

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

Status: erster Provider-Haertungspass umgesetzt. `ProviderStatus` traegt jetzt Capabilities und typisierte Provider-Modi fuer `fast`, `quality`, `local` und spaeter `self_hosted`; `ProviderCommandError` traegt Retrybarkeit und eine konkrete Recovery-Aktion. Groq bleibt der einzige produktive Cloud-Adapter, `local_preview` bleibt STT-only, aber beide Lanes teilen denselben Status- und Fehlervertrag in Rust und TypeScript.

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

Status: erster Recovery-Haertungspass umgesetzt. Native Insert-Ergebnisse tragen jetzt eine typisierte Recovery-Aktion (`none`, `manual_paste`, `use_scratchpad`), eine nutzerfaehige Recovery-Message und einen Clipboard-Restore-Status (`not_attempted`, `scheduled`, `skipped_no_previous_clipboard`). Input liest diese Werte aus dem nativen Vertrag statt aus Fallback-Freitext zu raten, und History/Export/Diagnostics persistieren dieselbe Recovery-Semantik jetzt ebenfalls.

## Slice 4 - Lokale STT-Lane als Preview einfuehren

Status: umgesetzt als `local_preview`-Kompatibilitaets-ID fuer eine lokale Runtime-Lane ueber externes `whisper-cli` plus lokale ggml-Modelle und lokales Ollama-Cleanup; Cleanup-Modell und STT-Profil sind jetzt getrennte Runtime-Slots.

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

- lokaler Runtime-Provider mit demselben Antwortvertrag wie Groq
- Transcription Context / Dictionary kann optional als Prompt-Bias genutzt werden
- UI trennt lokale STT-Profile und lokales Cleanup-Modell explizit; cloud-first bleibt der Hauptpfad

### Exit-Kriterien

- ein lokaler Provider kann ueber denselben Runtime-Pfad transkribieren und lokal bereinigen
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

## Naechste Produktphase nach dem Kern

Die Kern-Slices 1 bis 6 haben WordScript zu einem echten Diktierkern gemacht.

Die naechste Produktphase ist deshalb nicht zuerst Notes, MCP oder Assistant-Scope, sondern Premium-Produktisierung auf demselben Kern:

- Profile muessen persoenlicher und arbeitsmodusfaehig werden
- zwischen Sprechen und Insert braucht es mehr Vertrauen und Sichtbarkeit
- der Provider-Stack muss von einem Adapter zu einem echten Modellsystem wachsen
- `local_preview` muss von einer Preview-Lane zu einem first-class lokalen Pfad werden
- Setup, Permissions und Packaging muessen als Produktpfad sichtbar fuehren

### Produktleitplanken fuer Slice 7 bis 11

Diese Produktphase ist nicht nur eine Funktionsliste. Sie ist vor allem ein UI- und Usability-Pass auf demselben nativen Kern.

- Settings und Overlay sind in dieser Phase ein owning product surface und kein spaeterer Polish-Nachtrag
- das Zielbild bleibt eine kleine, ruhige macOS-Utility-App mit klarer Sidebar/Main-Struktur, stabiler Chromatik und wenigen visuellen Ebenen
- jede neue Sichtbarkeit im Overlay oder in Settings muss echte Runtime-Wahrheit zeigen; keine Platzhalter, keine Demo-States, keine vorweggenommenen V2-Andeutungen
- Benutzbarkeit zaehlt als Exit-Kriterium: schneller verstehbare Hierarchie, klarere Recovery-Fuehrung, weniger Dev-Tool-Gefuehl und weniger Setup-Raten gehoeren direkt zu diesen Slices
- Plattformgrenzen, Permissions und lokale Helfer muessen so gefuehrt werden, dass ein Nutzer ohne Repo-Wissen vom Problem zur naechsten sinnvollen Aktion kommt

Die Design-System-Referenz dafuer ist nicht dekorativ, sondern operativ:

- `docs/DESIGN_SYSTEM.md` definiert die aktive UI-Sprache und das macOS-Zielbild fuer diese Produktphase
- `docs/VISION.md` setzt UI-Fuehrung und wahrgenommene Ruhe als aktuelle Produktluecke gegenueber bezahlten Alternativen
- jeder Slice 7 bis 11 gilt erst dann als produktfaehig, wenn Runtime-Gewinn und wahrgenommene Benutzbarkeit gemeinsam steigen

### Slice 7 - Profile zu Arbeitsmodi verdichten

### Ziel

Profile von `context + dictionary + snippets` zu echten Arbeitsmodi weiterziehen.

### Donor-Muster

- `VoiceInk/VoiceInk/Services/DictionaryService.swift`
- `VoiceInk/VoiceInk/PowerMode/PowerModeSessionManager.swift`
- `FluidVoice/Sources/Fluid/Services/CommandModeService.swift`

### Was dort gut ist

- Dictionary- und Replacement-Logik leben als eigene Produktservices
- app- oder mode-bezogene Sessions koennen explizit angewendet und sauber wiederhergestellt werden
- `write` vs `command` trennt Nutzungsabsicht von Provider- oder UI-Details

### WordScript-Zieloberflaechen

- `src-tauri/src/core/config.rs`
- `src-tauri/src/core/text_rules.rs`
- `src-tauri/src/core/transform.rs`
- `src-tauri/src/core/insertion.rs`
- `src/components/settings/PromptsTab.tsx`
- `src/components/settings/InputTab.tsx`

### Gewuenschte Zielstruktur in WordScript

- ein Arbeitsmodus kapselt `context`, `dictionary`, `snippets`, `rewrite style`, `insert behavior` und `recovery behavior`
- Arbeitsmodi sind zuerst manuell sichtbar und explizit waehlbar
- spaetere app- oder kontextbasierte Aktivierung bleibt permission-basiert und opt-in

### Exit-Kriterien

- der aktive Modus aendert mehr als nur Text Rules
- Runtime, Overlay und History tragen denselben aktiven Arbeitsmodus sichtbar mit
- keine verdeckte Auto-Aktivierung ohne explizite Erlaubnis und sichtbare Kontrolle

### Slice 8 - Live-Preview und kontrollierten Commit einziehen

### Ziel

Zwischen Sprechen und Insert einen sichtbaren Preview-/Commit-Pfad aufspannen, der Vertrauen schafft statt nur nachtraegliche Recovery anzubieten.

### Donor-Muster

- `FluidVoice` fuer Live Preview und Mode-Denken
- `Whisper-Input-Next` fuer floating preview und two-pass recognition
- `OpenSuperWhisper` fuer leichte hold-to-record- und quick-commit-Muster

### Was dort gut ist

- Nutzer sehen Text, bevor oder waehrend er committed wird
- Preview und Commit sind Produktaktionen statt versteckte Debug-Zustaende
- leichte Record-/Commit-Interaktion fuehlt sich schneller und nativer an

### WordScript-Zieloberflaechen

- `src/windows/OverlayWindow.tsx`
- `src/hooks/useRuntime.ts`
- `src-tauri/src/core/sessions.rs`
- `src-tauri/src/core/transform.rs`
- `src-tauri/src/core/insertion.rs`

### Gewuenschte Zielstruktur in WordScript

- Overlay kann `raw transcript`, bereinigten Text und aktiven Arbeitsmodus sichtbar machen
- Quick Actions fuer `insert`, `retry`, `scratchpad` und `restore` leben nah an der Preview
- kontrollierter Commit ist ein expliziter Produktmodus und keine nachtraegliche Log-Ansicht

### Exit-Kriterien

- Nutzer koennen Text im Preview-Pfad sehen, bevor er final committed wird
- schnelle Recovery-Aktionen sind aus dem Overlay heraus erreichbar
- Auto-Insert und kontrollierter Commit bleiben auf derselben nativen Recovery-Wahrheit
- der Overlay-Pfad wirkt als ruhiges Statusinstrument statt als Debug- oder Log-Flaeche

### Slice 9 - Provider-Stack produktfaehig machen

### Ziel

Den Provider-Stack von einem ersten Adapter zu einem echten Produktmodell mit weiteren Produktionsprovidern und klaren Inference-Modes ausbauen.

### Donor-Muster

- `openwhispr/src/stores/settingsStore.ts`
- `openwhispr/src/helpers/enterpriseAiProviders.js`
- `hyprwhspr` fuer pragmatische Hybrid-Steuerung

### Was dort gut ist

- Provider-, Local-, Self-Hosted- und Enterprise-Pfade werden als Modi statt als Sonderfaelle modelliert
- schwere Providerpfade koennen spaet und getrennt aktiviert werden
- Hybrid-Steuerung ist produktive Logik und kein CLI-Nebenpfad

### WordScript-Zieloberflaechen

- `src-tauri/src/core/providers/`
- `src-tauri/src/core/config.rs`
- `src/types/providers.ts`
- `src/hooks/useProvider.ts`
- `src/components/settings/ApiModelsTab.tsx`

### Gewuenschte Zielstruktur in WordScript

- mindestens ein zweiter echter Produktionsprovider neben Groq
- ein Modellsystem mit klaren Modi wie `fast`, `quality`, `local` und `self_hosted`
- sichtbare Health-, Fallback- und Konfigurationszustande statt provider-spezifischer Einzelfall-UI

### Exit-Kriterien

- der zweite Produktionsprovider laeuft ueber denselben Vertrag wie Groq
- Moduswahl blockiert spaetere Provider oder lokale Engines nicht mehr
- UI, Config und Rust sprechen dieselben Provider- und Mode-Begriffe

### Slice 10 - `local_preview` zur echten Local Lane ausbauen

### Ziel

Den lokalen Pfad von einer externen Preview-Lane zu einer first-class Option fuer privacy, resilience und echte lokale Arbeit weiterziehen.

### Donor-Muster

- `Handy` fuer lokale Modell- und Runtime-Pfade
- `voxtype` fuer Engine-Abstraktion
- `openwhispr/src/helpers/audioManager.js` fuer Audio- und Prompt-Bias-Denken

### Was dort gut ist

- lokale Modelle werden als Produktpfad statt nur als Hilfsbinary gedacht
- mehrere Engines koennen hinter derselben Produktoberflaeche haengen
- Dictionary- oder Bias-Prompting bleibt Teil des Transkriptionspfads

### WordScript-Zieloberflaechen

- `src-tauri/src/core/providers/local_preview.rs`
- `src-tauri/src/core/config.rs`
- `src-tauri/src/core/transform.rs`
- `src/components/settings/ApiModelsTab.tsx`
- `src/components/settings/RebuildLabTab.tsx`

### Gewuenschte Zielstruktur in WordScript

- Modellmanagement, klare Health-Diagnostics und sichtbare Runtime-Voraussetzungen fuer die lokale Lane
- Dictionary oder Transcription Context koennen optional als Bias-Prompt in den lokalen Pfad einfliessen
- Quality-vs-Latency-Presets machen den lokalen Pfad als Produktwahl verstehbar

### Exit-Kriterien

- lokale Lane ist sichtbar konfigurierbar, testbar und diagnostizierbar
- Nutzer koennen zwischen mehreren sinnvollen lokalen Presets waehlen
- lokaler Pfad fuehlt sich wie eine echte Produktoption an und nicht wie ein externer Debug-Helper

### Slice 11 - Setup, Permissions und Packaging fuehren

### Ziel

Den Weg von Install zu erster brauchbarer Diktation als gefuehrten Produktpfad bauen statt als verstreute Diagnostics- und README-Kenntnis.

### Donor-Muster

- `vocalinux` fuer ehrliche Installer- und Support-Haltung
- `hyprwhspr` fuer die Trennung von Setup- und Runtime-Lane
- `VoiceInk` und `FluidVoice` fuer macOS-Polish und Permissions-Fuehrung

### Was dort gut ist

- Setup und Runtime werden nicht verwechselt
- fehlende Helfer oder Permissions werden konkret benannt
- Produktvertrauen entsteht schon vor der ersten Aufnahme

### WordScript-Zieloberflaechen

- `src/components/settings/AboutTab.tsx`
- `src/components/settings/InputTab.tsx`
- `docs/RELEASE_RUNBOOK.md`
- `docs/REFERENCE.md`

### Gewuenschte Zielstruktur in WordScript

- gefuehrter Install-to-first-dictation-Pfad fuer Accessibility, Input Monitoring, UAC und Linux-Helfer
- Packaging-, Permissions- und Runtime-Voraussetzungen sprechen dieselbe Sprache in UI und Doku
- Setup-Checks helfen vor dem Fehler statt erst nach dem Scheitern

### Exit-Kriterien

- ein neuer Nutzer kommt ohne Repo-Wissen von Setup zu erster brauchbarer Diktation
- fehlende Permissions oder Helfer fuehren zu konkreten, plattformnahen Fix-Hinweisen
- Packaging und Runtime-Voraussetzungen divergieren nicht mehr zwischen Doku und Produkt
- Setup-Hinweise folgen derselben kompakten Produktfuehrung wie Settings und About statt verstreuter Diagnostics-Sprache

## Was bewusst noch nicht gebaut wird

Diese Themen bleiben nachgelagert, auch wenn sie langfristig Zielbild sind:

- Meeting-Transkription mit Speaker-Diarization
- Transcript-zu-Notes-Workflows
- semantic search
- sync mit users / tenants / cloud workspaces
- MCP / API
- Assistant / Browser-Use / Computer-Use

Der Grund ist nicht, dass diese Themen unwichtig sind, sondern dass sie auf Slice 1 bis 6 aufbauen.

Fuer die naechste Produktphase heisst das konkret:

- `openwhispr`-Themen wie Notes, Search, Sync, MCP oder Assistant-Scope sind bewusst nicht die naechste Baustelle
- erst muss WordScript als Diktierprodukt persoenlicher, vertrauenswuerdiger und produktiver wirken
- Breite oberhalb des Kerns kommt erst nach Arbeitsmodi, Live Preview, produktfaehigem Provider-Stack, echter Local Lane und gefuehrtem Setup

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

Deshalb war die richtige Kern-Reihenfolge:

1. Koordinator
2. Provider-Vertrag
3. Insert-Stack
4. Local Lane
5. History
6. Profile

Die naechste Produktphase oberhalb dieses Kerns ist:

7. Arbeitsmodi
8. Live Preview + kontrollierter Commit
9. produktfaehiger Provider-Stack
10. echte Local Lane
11. Setup, Permissions und Packaging

Danach erst die Plattform oberhalb des Diktierprodukts.