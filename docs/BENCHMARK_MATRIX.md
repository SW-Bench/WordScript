# WordScript - Benchmark Matrix

Stand: 2026-05-13

## Zweck

Dieses Dokument verdichtet die wichtigsten Open-Source-Diktierprodukte, die als Donor-Repos fuer WordScript sinnvoll sind.

Die konkrete Arbeitsreihenfolge fuer die naechsten Kern-Slices steht in [CORE_EXECUTION_PLAN.md](./CORE_EXECUTION_PLAN.md).

Es ist keine allgemeine Marktstudie. Es beantwortet drei praktische Fragen:

- Welche Repos sollen lokal vorgehalten und aktiv gelesen werden?
- Welche Repos sind fuer welchen Teil von WordScript der beste Donor?
- Welche Reihenfolge ergibt sich daraus fuer den Ausbau von WordScript?

## WordScript-Leitplanken fuer den Vergleich

Alle Bewertungen in dieser Matrix sind gegen die aktive Produktrealitaet von WordScript gewichtet:

- Tauri/Rust bleiben der aktive Runtime-Kern.
- Der enge V1-Kern bleibt Dictation, Transform, Insert und Recovery.
- Cloud-first mit BYOK bleibt der Standardpfad.
- Lokal/offline bleibt wichtig, aber nicht als einziger Produktpfad.
- macOS und Windows sind Tier 1, Linux X11 Preview, Linux Wayland experimental.
- Langfristig soll WordScript ueber Dictation hinaus zu einer offenen Voice-Workstation wachsen.

## Download-Shortlist

Die folgenden Repos sind die aktive Benchmark-Basis unter `sw-bench/`:

- `Handy`
- `openwhispr`
- `voxtype`
- `hyprwhspr`
- `chirp-stt`
- `VoiceInk`
- `FluidVoice`
- `vocalinux`
- `Whisper-Input-Next`
- `OpenSuperWhisper`

Die erste Welle fuer aktives Reverse Engineering ist dennoch bewusst kleiner:

1. `Handy`
2. `openwhispr`
3. `voxtype`
4. `hyprwhspr`
5. `chirp-stt`
6. `VoiceInk`
7. `FluidVoice`

## Feature-Matrix

Legende:

- `Strong`: klarer Donor fuer diesen Bereich
- `Useful`: sinnvoller Sekundaer-Donor
- `Light`: nur begrenzter Wert
- `No`: nicht relevant oder nicht vorhanden

| Repo | Plattform-Fit | Lizenz-Fit | Local STT | BYOK / Cloud | Multi-Provider | Linux / Wayland Insert | Windows Fit | macOS Product Polish | Dictionary / Snippets / Profiles | Meetings / Diarization | Notes / Search / Sync | API / MCP | Assistant / Agent | Donor-Schwerpunkt |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Handy | Strong | Strong | Strong | Light | Light | Useful | Useful | Useful | Useful | No | No | No | No | Architekturkern, typed runtime, cross-platform dictation |
| openwhispr | Strong | Strong | Strong | Strong | Strong | Useful | Useful | Useful | Useful | Strong | Strong | Strong | Strong | Plattform-Referenz fuer V2+ |
| voxtype | Useful | Strong | Strong | Useful | Strong | Strong | Light | Light | Useful | Strong | Light | Light | No | Linux / Wayland, insertion, multi-engine |
| hyprwhspr | Useful | Strong | Strong | Strong | Strong | Strong | Light | Light | Useful | Light | No | No | No | Linux hybrid backend orchestration |
| chirp-stt | Useful | Strong | Strong | No | Light | No | Strong | No | Useful | No | No | No | No | Windows local-first minimal path |
| VoiceInk | Light | Medium | Strong | Useful | Useful | No | No | Strong | Strong | No | No | No | Useful | macOS product polish, personal dictionary |
| FluidVoice | Light | Medium | Strong | Strong | Strong | No | No | Strong | Useful | No | No | No | Useful | macOS low-latency, overlay, live preview |
| vocalinux | Useful | Medium | Strong | No | Light | Strong | No | No | Light | No | No | No | No | Linux support tiers, installer, recovery honesty |
| Whisper-Input-Next | Light | Medium | Useful | Strong | Useful | Light | Light | Light | Light | No | No | No | No | floating preview, two-pass recognition |
| OpenSuperWhisper | Light | Strong | Strong | No | Light | No | No | Useful | Light | No | No | No | No | macOS hold-to-record basics |

## Donor-Zuordnung nach WordScript-Bereich

### 1. Aktiver Kernel: Trigger -> Capture -> Transform -> Insert -> Recovery

- Primaer: `Handy`
- Sekundaer: `voxtype`
- Sekundaer: `vocalinux`

Warum:

- `Handy` liegt WordScript architektonisch am naechsten.
- `voxtype` ist staerker bei Linux typing backends, output modes und engine abstraction.
- `vocalinux` ist stark bei Linux support guidance, installer realism und non-ASCII / Wayland edge cases.

### 2. Linux X11 / Wayland Stabilitaet

- Primaer: `voxtype`
- Primaer: `hyprwhspr`
- Sekundaer: `vocalinux`

Warum:

- `voxtype` ist der beste Donor fuer Wayland-first text insertion.
- `hyprwhspr` ist stark bei setup, system integration und hybrid backend control.
- `vocalinux` ist wertvoll fuer distro caveats, recovery und support messaging.

### 3. Windows Tier-1 Pfad

- Primaer: `Handy`
- Sekundaer: `chirp-stt`

Warum:

- `Handy` ist der belastbarere cross-platform runtime donor.
- `chirp-stt` ist der beste Spezialdonor fuer lokale Windows dictation unter restriktiven Umgebungen.

### 4. macOS Produktqualitaet

- Primaer: `VoiceInk`
- Primaer: `FluidVoice`
- Sekundaer: `OpenSuperWhisper`

Warum:

- `VoiceInk` ist stark bei personal dictionary, per-app tuning und modes.
- `FluidVoice` ist stark bei overlay, live preview, low-latency engines und mode thinking.
- `OpenSuperWhisper` liefert kleinere native patterns fuer hold-to-record und menu bar dictation.

Fuer WordScript ist das nicht nur ein spaeteres Nice-to-have. Nach den bisherigen Kern-Slices ist die aktuelle Produktluecke gegenueber bezahlten Alternativen vor allem die UI-Qualitaet von Settings und Overlay: weniger webige Konfigurationsflaeche, mehr ruhige native Utility-App.

### 4b. React-/TypeScript-Stilreferenzen fuer macOS-nahe Shells

Primaere Produktdonoren bleiben weiter die obigen Dictation-Apps. Fuer die UI-Sprache von WordScript lohnt sich daneben ein schmaler Blick auf einige Shell- und Komponenten-Referenzen:

- [surajmandalcell/darwin-ui](https://github.com/surajmandalcell/darwin-ui)
- [andrejilderda/desktop-ui](https://github.com/andrejilderda/desktop-ui)
- [kitlib/tauri-app-template](https://github.com/kitlib/tauri-app-template)

Warum:

- Diese Repos sind keine eigentlichen Diktier- oder Runtime-Donoren.
- Sie koennen aber fuer Sidebar-Hierarchie, Titlebar-/Window-Chrome, Control-Sprache und Tauri-/React-Shell-Patterns nuetzlich sein.
- Sie sind als Stilreferenz zu behandeln, nicht als Produktarchitektur oder Feature-Backlog.

### 5. BYOK und Multi-Provider

- Primaer: `openwhispr`
- Primaer: `hyprwhspr`
- Sekundaer: `FluidVoice`

Warum:

- `openwhispr` zeigt den groessten offenen Provider-Scope.
- `hyprwhspr` zeigt Linux-pragmatische provider switching und hybrid control.
- `FluidVoice` zeigt, wie mehrere STT-Engines und AI backends in eine produktive UX passen.

### 6. Dictionary, Snippets, spaetere lokale Profile

- Primaer: `VoiceInk`
- Sekundaer: `Handy`
- Sekundaer: `voxtype`

Warum:

- `VoiceInk` ist hier der staerkste Produktdonor.
- `Handy` und `voxtype` sind nuetzlich fuer ersetzungen, overrides und model-driven cleanup.

### 7. Meeting-Transkription, Speaker-Diarization, Notes, Search, Sync, MCP, API

- Primaer: `openwhispr`
- Sekundaer: `voxtype`

Warum:

- `openwhispr` ist der einzige echte Plattform-Donor mit diesem Scope.
- `voxtype` ist nuetzlich fuer meeting-mode, export und long-form capture, aber kein kompletter Notes-/Sync-Donor.

### 8. Langfristiger Assistant-, Command- und Browser-Use-Scope

- Primaer: `openwhispr`
- Primaer: `FluidVoice`
- Sekundaer: `VoiceInk`

Warum:

- `openwhispr` ist der offenste Donor fuer assistant-facing platform expansion.
- `FluidVoice` denkt schon in modes wie write vs command.
- `VoiceInk` zeigt context-aware UX, die spaeter fuer agentische flows wichtig wird.

## WordScript-Staging

Die wichtigste Konsequenz aus der Benchmark-Arbeit:

WordScript darf langfristig deutlich groesser werden als der aktuelle V1-Umfang, aber der Ausbau muss in klaren Stufen passieren.

Direkt nach den bisherigen Kern-Slices ist der naechste Engpass allerdings nicht zuerst weiterer Plattform-Scope, sondern Produktpolish: Settings und Overlay muessen sich nativer, ruhiger und selbstverstaendlicher anfuehlen, wenn WordScript im Alltag an bezahlte Alternativen heranruecken soll.

### Stufe 1 - Kern stabilisieren

Ziel:

- den heutigen Dictation-Kern auf macOS, Windows und Linux stabil machen
- Linux Wayland von experimental auf belastbarere Preview heben
- Dictionary, Snippets, Recovery und Diagnostics konsolidieren

No-go in dieser Stufe:

- Notes
- Team-/Account-Systeme
- Assistant-/Agent-Scope
- Browser automation

### Stufe 2 - Provider- und Profilbasis erweitern

Ziel:

- Groq vom Einzelpfad zum ersten Provider im echten Provider-System machen
- lokale Engines als ernsthafte Option integrieren
- weitere Cloud-Provider sauber hinter demselben Vertrag anbinden
- lokale Profile fuer context, dictionary, snippets und spaetere rewrite defaults einfuehren

Primaere Donoren:

- `Handy`
- `openwhispr`
- `hyprwhspr`
- `VoiceInk`

### Stufe 3 - Long-form und Workspace-Funktionen

Ziel:

- meeting mode
- recording archive
- exports
- speaker-aware transcripts
- transcript history

Primaere Donoren:

- `openwhispr`
- `voxtype`
- `Whisper-Input-Next`

### Stufe 4 - Notes, Search, Sync, API, MCP

Ziel:

- transcript-backed notes
- semantic search
- cloud sync mit users, profiles und tenant model
- oeffentliche API und MCP adapter

Primaerer Donor:

- `openwhispr`

### Stufe 5 - Assistant und Computer-Use

Ziel:

- voice assistant, der nicht nur diktiert, sondern Werkzeuge ausfuehrt
- command / action modes fuer Apps und Desktop-Aufgaben
- spaetere browser-use- oder desktop-use flows
- erklaerender on-device / desktop agent, der Programme bedienen kann

Wichtig:

- das ist eine spaetere Produktstufe, nicht der naechste Slice
- diese Stufe braucht eine saubere Trennung zwischen dictation kernel, tool execution, permissions, safety und user trust

Primaere Donoren:

- `openwhispr`
- `FluidVoice`
- `VoiceInk`

## Konkrete naechste WordScript-Slices

### Slice 1 - Provider-Vertrag verallgemeinern

Ziel:

- `providers/groq.rs` zum ersten Adapter in einem echten Provider-System machen

Ergebnis:

- BYOK fuer mehrere Cloud-Provider wird spaeter ohne Core-Rewrite moeglich
- lokale Provider koennen denselben Antwortvertrag bedienen

Primaere Benchmarks:

- `Handy`
- `openwhispr`
- `hyprwhspr`

### Slice 2 - Linux insert stack haerten

Ziel:

- `insertion.rs` fuer Wayland/X11 robuster machen
- typing backend selection, clipboard restore, unicode / non-US layout behavior verbessern

Primaere Benchmarks:

- `voxtype`
- `hyprwhspr`
- `vocalinux`

### Slice 3 - Lokalen STT-Pfad als Preview einziehen

Ziel:

- einen lokalen Preview-Pfad fuer offline / privacy / fallback schaffen
- nicht als neuer Default, sondern als ernsthafte zweite Lane

Primaere Benchmarks:

- `Handy`
- `voxtype`
- `VoiceInk`

### Slice 4 - Lokale Profile einfuehren

Ziel:

- Profile fuer context, dictionary, snippets und spaetere rewrite defaults

Primaere Benchmarks:

- `VoiceInk`
- `Handy`

### Slice 5 - Transcript History + Diagnostics verbinden

Ziel:

- aus Last Transcript / Scratchpad / runtime logs eine echte History-Basis bauen

Primaere Benchmarks:

- `openwhispr`
- `voxtype`
- `Whisper-Input-Next`

## Naechste Donor-Welle nach dem ersten Kern-Ausbau

Nach den bisherigen Kern-Slices ist der naechste Sprung fuer WordScript nicht zuerst Notes, MCP oder Assistant-Scope, sondern Premium-Produktisierung im aktiven Diktierprodukt.

### 1. Arbeitsmodi statt statischer Profile

- Primaer: `VoiceInk`
- Primaer: `FluidVoice`

Warum:

- `VoiceInk` ist der staerkste Donor fuer persoenliches Dictionary als echten Produktservice und fuer session-basierte App-/Mode-Logik.
- `FluidVoice` zeigt mit `write` vs `command`, wie Profile ueber reine Rule-Sets hinaus zu Arbeitsmodi werden koennen.
- Genau dort entsteht persoenliche Produktqualitaet, ohne schon in Assistant-Scope zu kippen.

### 2. Live-Preview und kontrollierter Commit

- Primaer: `FluidVoice`
- Sekundaer: `Whisper-Input-Next`
- Sekundaer: `OpenSuperWhisper`

Warum:

- `FluidVoice` ist der staerkste Donor fuer overlay-nahe Live Preview und Mode-Denken.
- `Whisper-Input-Next` ist nuetzlich fuer floating preview und two-pass recognition als Vertrauensmuster.
- `OpenSuperWhisper` liefert kleinere native Patterns fuer leichte Record-/Commit-Interaktion.

### 3. Produktfaehiger Provider-Stack

- Primaer: `openwhispr`
- Primaer: `hyprwhspr`

Warum:

- `openwhispr` ist der staerkste Donor fuer Inference-Modes, Provider-Taxonomie und BYOK-vs-self-hosted-Struktur.
- `hyprwhspr` zeigt pragmatische Hybrid-Steuerung und Linux-nahe Provider-Orchestrierung.
- Bezahlte Alternativen wirken hier staerker, weil sie Modus-, Provider- und Fallback-Wahl elegant machen.

### 4. `local_preview` zur echten Local Lane machen

- Primaer: `Handy`
- Primaer: `voxtype`
- Sekundaer: `openwhispr`

Warum:

- `Handy` liefert Modell- und Runtime-Denken fuer lokale Pfade.
- `voxtype` ist stark bei Engine-Abstraktion und Produktwahl zwischen mehreren lokalen Backends.
- `openwhispr` ist nuetzlich fuer Audio- und Bias-Prompting-Denken.

### 5. Setup, Permissions und Packaging als Produktpfad

- Primaer: `vocalinux`
- Primaer: `hyprwhspr`
- Sekundaer: `VoiceInk`
- Sekundaer: `FluidVoice`

Warum:

- `vocalinux` ist stark bei ehrlicher Installer- und Support-Haltung.
- `hyprwhspr` trennt Setup- und Runtime-Lane sauber genug fuer Packaging und Linux-Helferrealitaet.
- `VoiceInk` und `FluidVoice` sind die nuetzlichsten Referenzen fuer macOS-Polish und Permissions-Fuehrung.

## Was wir aus `openwhispr` bewusst noch nicht ziehen

- Notes
- Search
- Sync
- MCP
- Assistant-Scope

Warum:

- Diese Themen sind echte spaetere Plattformbausteine.
- Sie wuerden heute Breite bauen, bevor WordScript im taeglichen Dictation-Moment persoenlicher und vertrauenswuerdiger geworden ist.
- Erst Arbeitsmodi, Live Preview, produktfaehiger Provider-Stack, echte Local Lane und gefuehrtes Setup bringen WordScript als Diktierprodukt naeher an bezahlte Alternativen.

## Reihenfolge-Empfehlung

Die beste Reihenfolge fuer WordScript ist nicht "alles aus allen Repos ziehen", sondern:

1. `VoiceInk` + `FluidVoice` fuer Arbeitsmodi, Dictionary-Service, Live Preview und Mode-Denken auswerten.
2. `openwhispr` + `hyprwhspr` fuer Provider-Taxonomie, Inference-Modes und Hybrid-Steuerung auswerten.
3. `Handy` + `voxtype` + `openwhispr` fuer die echte Local Lane mit Modellmanagement, Bias-Prompting und Presets auswerten.
4. `vocalinux` + `hyprwhspr` + `VoiceInk`/`FluidVoice` fuer Setup, Permissions und Packaging-Fuehrung auswerten.
5. `openwhispr` fuer Notes, Search, Sync, MCP und Assistant erst danach lesen.

## Schlussregel

WordScript darf langfristig zu einer offenen Voice-Workstation mit Dictation, Notes, Search, Sync, MCP und spaeterem Assistant / Computer-Use wachsen.

Aber der aktive Produktkern bleibt zuerst:

Trigger. Sprechen. Brauchbarer Text. Saubere Recovery. Weiterarbeiten.