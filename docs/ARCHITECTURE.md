# WordScript — Architecture

Stand: 2026-06-10

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

Die aktive UI besteht derzeit aus drei Fenstern in der Tauri-Konfiguration:

- `overlay`: transparente kompakte Overlay-Buehne mit einer Pill fuer Aufnahme-/Processing-Zustand, die nach einem Lauf innerhalb derselben Flaeche zu nativen `copy`-, `retry`-, `restore`- und `done`-Aktionen umschaltet; fuer `clipboard_only`-Arbeitsmodi haelt dieselbe Runtime im Processing-Schritt auf einem echten Preview vor dem Commit, ohne dafuer eine zweite vergroesserte Overlay-Flaeche oder einen separaten Shell-Backdrop aufzumachen, der Host parkt das Fenster im Idle nativ ausserhalb des sichtbaren Bereichs, respektiert gemerkte Manual-Positionen oder preset-basierte Display-Anker, verwendet fuer Compact-, Preview- und Result-Surface dieselbe gemerkte Top-Left-Position, variiert aber die rechte Status-/Action-Zone je nach Overlay-Zustand statt ein einziges statisches Seitenlayout ueber Recording, `working` und Action zu ziehen, und leitet den Zielmonitor fuer Manual-Placement aus der gespeicherten logischen Drag-Referenz statt aus dem fenstergebundenen `current_monitor()`-Snapshot ab
- `settings`: native-dekorierte Shell mit den Tabs Provider & Models, Input, Modes, Text Rules, About und Diagnostics, gruppierter Sidebar-Navigation, persistentem Profil-Dock, kompaktem Tab-Header, einer dominanten Content-Surface und Footer-Save-Bar
- `rebuild-lab`: native-dekoriertes Diagnostics-Pop-out mit demselben Rebuild-Lab-Panel, kompaktem Preview-Header und einer einzelnen scrollbaren Content-Surface fuer den technischen Check ausserhalb des Settings-Fensters

Wichtige Frontend-Bausteine:

- `src/windows/OverlayWindow.tsx`
- `src/windows/SettingsWindow.tsx`
- `src/windows/RebuildLabWindow.tsx`
- `src/hooks/useRuntime.ts`
- `src/hooks/useProvider.ts`
- `src/hooks/useNativeInsertion.ts`
- `src/hooks/useRuntimeLogs.ts`
- `src/hooks/useProcessingMode.ts`
- `src/components/settings/*`

Die UI ist verantwortlich fuer:

- Anzeige von Runtime-Status, Waveform und Fehlermeldungen
- Anzeige des guardierten In-Pill-Action-Zustands nach einem Lauf, ohne eine zweite vergroesserte Preview-Surface, eine passive Mic-Zone im Action-Modus oder Overlay-Heuristik neben der nativen Runtime einzufuehren
- Pflege der Config-Werte
- global sichtbare manuelle Profilumschaltung in der Sidebar plus eingeschlossene Profile, Preview, Validation und Import/Export in den Text Rules
- tab-spezifische Orientierung ueber kompakten Header, Runtime-/Save-State-Chips und Section-Blurb, ohne neue UI-Heuristiken neben dem nativen Vertrag einzufuehren
- die About-Flaeche darf den Release-Aufbaupfad erklaeren, muss aber oeffentliche Release-Sichtbarkeit strikt von workflow-internen Draft-Handoffs trennen; publizierte GitHub-Releases bleiben die einzige Update-Wahrheit fuer `check_app_update`
- Text Rules als Workspace mit knapper Prozesszusammenfassung, kompakter Profilbibliothek und praesent bleibender Schritt-Navigation; darunter steht immer nur eine dominante Bearbeitungsstufe fuer Context/Preview, Dictionary oder Snippets
- Sichtbare Recovery-Aktionen und Diagnostics
- getrennte Darstellung von transienten Runtime-Logs und dauerhaftem nativen Transkriptverlauf inklusive Filter, Export und sichtbarem History-Store-Pfad; Recovery-Scratchpad bleibt davon getrennt
- render-sensible Settings-Teilbaeume muessen strukturell stabil bleiben: lange Listen wie Diagnostics-History, decoded Runtime-Log-Hints sowie Dictionary-/Snippet-Karten werden als isolierte Subtrees gehalten und duerfen nicht durch per-render Deep-Clones aller Profile oder Eintraege wieder unnoetig invalidiert werden

Die UI ist nicht verantwortlich fuer:

- globale Shortcut-Registrierung
- Mikrofon-Capture
- Session-State-Machine
- Insert-Entscheidungen

## Tauri-Host

`src-tauri/src/lib.rs` ist die Huelle des Produkts. Dort liegen:

- Window-Setup fuer Overlay und Settings
- native Sichtbarkeits- und Positionierungssteuerung fuer das Overlay inklusive Bottom-Center-Reveal und Offscreen-Parking im Idle
- monitor- und anchor-basierte Overlay-Placement-Aufloesung plus Persistenz der letzten manuellen Drag-Position; Host-seitige Repositionierungen fuer Reveal, Hide oder Surface-Wechsel duerfen diese gemerkte Position nicht als neue Nutzerabsicht ueberschreiben
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
- `providers/local_preview.rs`: lokale Runtime-Lane mit `whisper-cli` fuer STT, lokalem Ollama-Cleanup, nativer Modell-Discovery, probe-basierter Runner-Gesundheit und selected-model-/cleanup-Setup-Wahrheit ueber denselben Antwortvertrag
- `transform.rs`: Halluzinationsfilter, optionale Nachkorrektur mit mehrstufigem Guardrail Stack, Dictionary- und Snippet-Aufloesung
- `agent.rs`: hybrid Intent-Detection (Heuristik + LLM-Classifier) und Agent-Execution; sitzt als Routing-Layer vor `transform.rs`
- `text_rules.rs`: Analyse, Preview, Import/Export, Konfliktbehandlung und Profile-Health-Analyse der Text Rules

### Mode-Routing und Workspace

- `mode_router.rs`: Aufloesung des effektiven `ProcessingMode` pro Session aus manuellem Override, aktivem Profil-Work-Mode, `auto_detect_mode` und `workspace_app_map`; exponiert den Tauri-Command `resolve_current_processing_mode`
- `workspace_context.rs`: Foreground-App-Detection auf macOS, Windows und Linux; nutzt `run_with_timeout` mit dedizierten Pipe-Drain-Threads (sonst bleibt `Output.stdout`/`stderr` leer), klassifiziert die App, erkennt Browser-Domain und IDE-Framework (aktuell nur macOS-Pfad produktiv, Cross-Plattform-Sniffing steht hinter `#[allow(dead_code)]` und ist Teil der naechsten Ausbau-Slice)
- `prompt_enhance.rs`: Prompt-Strukturierung und -Expansion ueber den aktiven LLM-Pfad, Guardrail-Chain (empty, prompt_executes, language_mismatch, length_budget, semantic_drift) und Routing des bereinigten Ergebnisses in `transform.rs`

Hinweis: IDE-Framework- und Browser-Domain-Detection in `workspace_context` sind aktuell macOS-only; die Cross-Plattform-Pfade bleiben ueber `#[allow(dead_code)]` markiert, bis der naechste `workspace_context`-Slice die Linux-/Windows-Heuristiken produktiv schaltet.

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
5. `mode_router.rs` loest vor dem Transform den effektiven `ProcessingMode` (cleanup/rewrite/agent/prompt_enhance/verbatim) aus manuellem Override, aktivem Profil-Work-Mode, `auto_detect_mode` und `workspace_app_map` auf; der Renderer kann die effektive Mode ueber den `resolve_current_processing_mode`-Tauri-Command abfragen.
6. `providers/mod.rs` loest den aktiven Provider auf und delegiert heute an `providers/groq.rs` oder `providers/local_preview.rs`.
7. `transform.rs` prueft und bereinigt den Transkriptionsoutput und nutzt denselben Provider-Vertrag fuer AI cleanup; bei `prompt_enhance`-Mode wird der bereinigte Text zusaetzlich durch die `prompt_enhance`-Guardrail-Chain geschickt.

Fuer Diagnostics reicht persistierte Config hier nicht mehr als Wahrheitsquelle. `v1_slice_status` muss den persistierten Provider-/Profilvertrag mit echten Runtime-Statusquellen kombinieren: `provider_status` fuer Local-Setup-Readiness und aufgeloeste Runner-/Modellpfade sowie `native_capture_status` fuer laufenden Capture-Zustand und aktives Device.
7. `insertion.rs` waehlt den Insert-Modus und fuehrt ihn aus.
8. `history.rs` schreibt raw vs transformed transcript, aktives Textprofil, effektive `ProcessingMode`, Insert-Outcome und Fehler in den nativen Verlauf.
9. `sessions.rs` finalisiert danach genau einmal `completed`, `aborted` oder `error` und akzeptiert async Pipeline-Ergebnisse nur fuer die aktive `processing`-Session-ID.
10. UI bekommt Status, letztes Transkript, effektive Mode, History und moegliche Recovery-Daten zurueck.

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

Provider-, Transform- und Insert-Ergebnisse laufen nach dem Capture-Ende asynchron weiter, duerfen aber den Runtime-Zustand nur veraendern, solange ihre Session-ID noch zur aktiven `processing`-Session passt. Spaete Ergebnisse nach Abort, neuer Aufnahme oder bereits finalisierter Session werden im Runtime-Log als stale markiert und nicht mehr an Overlay oder Settings ausgespielt.

## Transform-Reihenfolge

Die Textverarbeitung ist im aktiven Pfad keine Black Box. Die Reihenfolge ist bewusst fest:

1. Halluzinationsmuster ablehnen oder markieren
2. wenn Agent Mode aktiv: Intent-Detection, bei bestaetiger Anweisung `apply_agent_transform` aufrufen und Correction ueberspringen
3. optionale AI-Nachkorrektur ausfuehren (Correction Guardrail Stack)
4. Dictionary anwenden
5. Snippets anwenden

### Agent Mode

Der Agent Mode sitzt als Routing-Layer vor der Correction und entscheidet, ob ein Transkript als Benutzer-Diktat oder als direkte Anweisung an den konfigurierten Agenten behandelt wird.

Der Entscheidungspfad ist hybrid:

```text
heuristic score >= 0.75  →  sicherer AGENT-Pfad, kein LLM-Call noetig
heuristic score < 0.20   →  sicherer DIKTAT-Pfad, direkt zu Correction
score 0.20 – 0.74        →  Uncertain Zone → LLM-Classifier entscheidet
```

Heuristik-Signale (O(n), kein API-Call):

- Agent-Name in Worten 1–4: +0.55 (direkte Eroeffnung mit dem Agenten)
- Agent-Name in Worten 5–10: +0.35 (nach kurzer Einleitung wie "Also ich dachte, WordScript, schreib…")
- Agent-Name spaeter im Text: +0.15 (beilaeufige Erwaehnung, schwaches Signal)
- Imperativverb als erstes Wort: +0.45
- Imperativverb in Worten 2–10: +0.25
- Textlaenge > 60 Woerter: -0.15 (Agenten-Anweisungen sind meist kurz)

LLM-Classifier (nur in der Uncertain Zone):

- Entscheidet mit "yes" oder "no", kein weiterer Text
- "yes" nur wenn Nutzer den Agenten **direkt adressiert** UND eine Aufgabe beauftragt
- "no" bei beilaeufiger Namenerwaehnung ohne Auftrag
- "no" bei Imperativ ohne Agent-Namen-Adressierung (das ist Diktat, kein Befehl an den Agenten)
- Fallback bei Fehler: immer "no" (sicher auf Diktat-Pfad)

Wenn der Agent Mode deaktiviert ist oder der Classifier "no" liefert, laeuft der Text durch `apply_native_transform` mit dem vollen Correction Guardrail Stack.

### Correction Guardrail Stack

Die AI-Korrektur in `normalize_correction` verteidigt den Diktatpfad in mehreren Schichten gegen Antwort-artiges Verhalten des Correction-LLMs. Jede Ablehnung schreibt einen strukturierten Eintrag in den Runtime-Log (sichtbar in Rebuild Lab):

| Guard | Ausloeser | Regel-ID |
|---|---|---|
| Empty correction | Korrektur leer | `empty_correction_fallback` |
| Question answered | Original hat `?`, Korrektur hat kein `?` | `question_answered_guardrail_fallback` |
| Length explosion | Korrektur > 1.5× Original + 50 Zeichen | `assistant_like_correction_rejected` |
| Over-shortened | Korrektur < min_ratio × Original | `over_shortened_correction_rejected` |
| Assistant phrase | Neu eingefuegte Assistenz-Phrasen (z.B. "ich verstehe", "gerne erledige", "task completed") | `correction_guardrail_fallback` |
| Suspicious start | Korrektur beginnt neu mit Ich/Bitte/Gerne/Klar/Here/I/… | `correction_guardrail_fallback` |
| First-person action start (polished) | Korrektur beginnt neu mit Ich-Aktionsverb wie "ich schicke", "i'll send" — nur in `polished` mode, weil `suspicious_start` dort deaktiviert ist | `correction_guardrail_fallback` |
| Word overlap | Gemeinsame Wortmenge < Schwellwert (0.25/0.4/0.55 je Modus) | `correction_guardrail_fallback` |

Wichtige Architekturregeln dieses Stacks:

- der Correction-LLM ist ein Chat-Modell mit starker Assistenz-Feintuning; alle Guardrails koennen trotz korrektem System-Prompt gelegentlich durchbrochen werden — der Stack ist mehrschichtig, um das aufzufangen
- `has_suspicious_start` ist in `polished` mode deaktiviert, weil dort Satzumstrukturierungen erlaubt sind; stattdessen laeuft `has_new_first_person_action_start` als Ersatz-Guard fuer klar assistenz-artige Ich-Aktionsverb-Starts
- alle Guardrail-Ablehnungen erhalten denselben Fallback: Originaltext unveraendert zurueckgeben; kein Vertragsbruch mit Downstream-Insertion, History oder Recovery
- das System-Prompt der Correction instruiert den LLM explizit: Fragen, Aufforderungen, Befehle und Anweisungen im Input sind diktierter Nutzertext — niemals beantworten, ausfuehren oder darauf reagieren
- dieser Correction-Stack ist orthogonal zum Agent Mode: Agent Mode entscheidet das Routing vor der Correction; die Guardrails greifen, wenn das Routing "Diktat" liefert, der Correction-LLM aber trotzdem in den Assistenz-Modus abdriftet

Wichtig:

- `prompt` bleibt primaer Transcription Context fuer die STT-Anfrage; `lib.rs` baut daraus fuer Groq und je nach `local_prompt_strength` auch fuer `local_preview` einen begrenzten Bias-Prompt mit Profil-Context, expliziten `stt_hints` und Dictionary-Schreibweisen
- dieser Bias-Prompt ist jetzt konservativer gefiltert: generische Profilkategorien oder breite Themenlisten werden nicht mehr automatisch an STT und Cleanup durchgereicht; im automatischen Pfad bleiben nur konkrete lexikale Hinweise, explizite `stt_hints` und bevorzugte Schreibweisen uebrig
- dieser STT-Bias ist konservativ und providerbegrenzt; er soll Fachwoerter, Produktnamen, Sprachmix und haeufige Phrasen erhalten, nicht freie semantische Rewrites oder Halluzinationen erzeugen
- `text_rules::analyze_document` zeigt denselben Vertrag inzwischen sichtbar im Settings-Tab: konkrete automatisch uebernommene Vokabeln, bevorzugte Schreibweisen, explizite STT-Hints sowie Warnings fuer ignorierte breite Kontextzeilen oder unbrauchbare STT-Hints
- `text_rules::analyze_profile_health` analysiert zusaetzlich das gesamte Profil auf systemische Verhaltensverzerrungen, die AI-Cleanup beeinflussen: LengthBias (Woerterlaenge-Asymmetrie in Dictionary-Eintraegen), FormConflict (widerspruechliche Stil-Anweisungen im Prompt) und CleanupInterference (Prompt-Muster, die AI-Cleanup aktiv unterdruecken); die resultierenden Flags werden im Text-Rules-Tab als Bias Policy angezeigt und koennen per Acknowledge-Toggle pro Flag unterdrückt werden, ohne die Konfiguration zu aendern; der Healthstatus (green / yellow / red) erscheint ausserdem als kleiner Farbpunkt im Profil-Dock der Settings-Sidebar
- wenn Profil-Context, `stt_hints` oder Dictionary-Schreibweisen dennoch zu schlechteren Rohtranskripten als `General Writing` fuehren, ist das ein Vertragsbruch dieses Pfads; mehrsprachige Fragmente, Fantasietokens oder Topic-Drift sind dann nicht "nur Profilrauschen", sondern ein Kernproblem der Diktierlane
- Dictionary- und Snippet-Matches sind literal und case-insensitive
- Snippet-Trigger sind kein automatischer Teil des STT-Bias; wenn kurze gesprochene Cues oder alternative Phrasen in die STT-Anfrage sollen, muessen sie explizit ueber `stt_hints` im Profil gepflegt werden
- lokale Textprofile kapseln heute `prompt`, optionale `stt_hints`, Dictionary, Snippets und Work-Mode-Defaults als aktive Runtime-Konfiguration; der primaere Work-Mode-Vertrag ist `processing_mode` (`cleanup` / `rewrite` / `agent` / `prompt_enhance` / `verbatim`) plus optional `enhance_sub_mode` und `prompt_target`, das Legacy-Feld `rewrite_style` (`polished` / `clean` / `verbatim`) ist nur noch Migrations-Eingang und wird ueber `migrate_legacy_processing_mode` auf den primaeren Vertrag abgebildet
- AI cleanup muss Sprachmix, Umgangssprache, eingedeutschte Borrowings und technische Tokens konservativ erhalten; unsichere oder assistant-artige Rewrites fallen weiter ueber Guardrails auf das Rohtranskript zurueck
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
- jeder Insert-Outcome traegt eine maschinenlesbare Recovery-Aktion, eine Recovery-Message und den Clipboard-Restore-Status; UI und History duerfen Recovery nicht aus Freitext-Fallbacks erraten
- dieselbe Recovery-Semantik wird in persistierter History, History-Export und Diagnostics-Karten weitergereicht; diese Flaechen duerfen keine zweite Recovery-Wahrheit bilden
- der Overlay-Nachlauf-Snapshot darf nur Quick Actions zeigen, die ueber dieselbe native History- oder Insert-Wahrheit ausgeloest werden; `retry` braucht die echte `history.entry_id`, und `insert` oder `restore` duerfen nur bestehende Native-Commands aufrufen
- der neue Processing-Preview fuer `clipboard_only`-Profile bleibt dieselbe Runtime-Wahrheit: Transform liefert den Preview-Text, die Session bleibt in `processing`, und der spaetere Commit muss ueber denselben nativen Insert-, History- und Sessionpfad laufen
- Overlay, Input und About nutzen denselben nativen Plattformstatus als Quelle
- About zeigt Voraussetzungen und Grenzen aus diesem nativen Vertrag, statt pro Plattform neue UI-Nebenwahrheiten zu erfinden
- Linux/X11/Wayland werden als explizite Driver-Ketten modelliert; `wl-copy`, `xdotool`, `wtype`, `ydotool`, `enigo` und Scratchpad stehen im Status nicht mehr nur implizit im Code
- Rebuild-Lab-Diagnostics zeigt fuer die V1-Slice nicht nur `stage`, sondern eine native Step-Timeline fuer `capture`, `provider`, `transform` und `insert` inklusive `state`, `duration_ms` und stabilem `error_code`
- derselbe V1-Slice-Vertrag traegt jetzt auch ein explizites `provider_profile`; Diagnostics, Preview und Tests duerfen Cloud- oder Local-Modi nicht mehr aus Modellnamen oder lokaler Disk-Config erraten

## Plattformmodell

WordScript modelliert Plattformgrenzen explizit:

- macOS und Windows sind die Tier-1-Zielpfade
- Linux X11 ist Preview
- Linux Wayland bleibt experimentell: hybride Sessions (X11+Wayland) nutzen `xdotool type` (Fake-Input ueber XWayland, nicht XTEST) als ersten Paste-Pfad und `enigo` als Hybrid-Fallback, reine Wayland-Sessions (kein `DISPLAY`) verwenden ausschliesslich Clipboard + manuelles Paste, weil `wtype`/`ydotool`/`enigo` sonst den Wayland-Portal-Prompt "Control input devices" ausloesen wuerden

Das ist keine Marketing-Sprache, sondern Teil des Insert- und Support-Modells.

## Provider-Modell

Im aktiven Produktpfad gibt es zwei klar getrennte Provider-Lanes:

- `groq`: cloud-first Produktionspfad fuer BYOK, Secret Store und AI cleanup
- `local_preview`: Kompatibilitaets-ID fuer die lokale Runtime-Lane mit externem `whisper-cli`-Runner fuer STT, lokalen ggml-Modellen und lokalem Ollama-Cleanup-Modell

Architekturregeln dafuer:

- Groq laeuft als BYOK-Modell
- der API-Key liegt im OS secret store
- die JSON-Config wird beim Speichern gescrubbt
- `ProviderStatus` liefert neben Profilen auch typisierte Modi (`fast`, `quality`, `local`, spaeter `self_hosted`) und Capabilities wie Transcription, Chat-Cleanup, Prompt-Bias, Segments, Local und API-Key-Pflicht
- `local` und `self_hosted` sind keine austauschbaren Labels: `local` meint den aktuellen on-device beziehungsweise lokalen Runtime-Pfad, `self_hosted` bleibt fuer spaetere nutzerbetriebene Remote- oder LAN-Dienste reserviert und existiert heute noch nicht als aktive Lane
- `ProviderCommandError` traegt Fehlerart, Status, Retry-After, `retryable` und eine `user_action`, damit Runtime-Events und Settings dieselbe Recovery-Semantik verwenden
- `local_preview` nutzt keine API-Keys, sondern sichtbare lokale Runtime-Voraussetzungen in Settings und Diagnostics
- diese lokalen Voraussetzungen laufen jetzt ueber einen typed `local_setup`-Vertrag mit `readiness`, stabilem `issue_code`, aufgeloestem Runner- und Modellpfad sowie aufgeloestem Cleanup-Endpoint und Cleanup-Modell; der Vertrag wird gegen das aktuell gewaehlte lokale STT-Modell und das aktuell gewaehlte lokale Cleanup-Modell ausgewertet und darf lokale Readiness nicht aus `credential.configured` oder Copy rekonstruieren
- Provider & Models rendert denselben Vertrag als Preflight-Checkliste fuer Speech Runner, STT-Modell, Cleanup-Endpoint und Cleanup-Modell; diese UI ist Anzeige und Fuehrung, nicht eine zweite Setup-Quelle
- `local_preview` prueft den Runner nicht nur ueber Dateisystem-Praesenz, sondern ueber einen aktiven nativen Probe-Spawn; Fehlercodes wie `runner_probe_failed` oder `runner_probe_timed_out` sind Teil derselben Produktwahrheit
- lokale Modellprofile kommen nativ aus `WORDSCRIPT_LOCAL_MODEL_PATH` oder `WORDSCRIPT_LOCAL_MODEL_DIR`; die UI darf fuer die Local Lane keine statische Modellliste als Source of Truth behandeln
- die lokale Lane trennt STT-Profil und Cleanup-Modell explizit; diese Trennung folgt der donor-orientierten Struktur aus `Handy` fuer Runtime-Ownership, `voxtype` fuer klare Engine-/Mode-Pfade und `openwhispr` fuer getrennte Cleanup-Scopes statt impliziter Modellwiederverwendung
- `local_preview` reicht den aktiven STT-Prompt als initialen `whisper-cli --prompt` durch und meldet Prompt-Bias deshalb als echte Capability statt als UI-only Wunsch; die Staerke dieses Bias lebt jetzt explizit in `off`, `profile`, `profile_and_terms` plus optionalem `carry_initial_prompt`
- lokale `local_preview`-Profile sind jetzt echte Provider-Profile mit eigener ID pro Modell und Preset (`...-fast`, `...-quality`); dieselbe Auswahl lebt in Config, Settings und dem nativen Provider-Request statt in einer Modellfamilien-Heuristik
- dieselbe lokale Runtime-Konfiguration traegt jetzt zusaetzlich explizite Decode-Regler (`beam_size`, `best_of`); Fast/Quality liefern nur noch Defaults, die eigentliche Decoder-Suchtiefe ist Teil des persistierten AppConfig- und Provider-Request-Vertrags
- dieselbe lokale Runtime-Konfiguration traegt jetzt auch ein separates `local_correction_model`; das lokale Cleanup-Modell darf nicht mehr implizit aus dem Cloud-Cleanup-Modell oder einem UI-Fallback rekonstruiert werden
- native Diagnostics und Transcription History muessen fuer `local_preview` nicht nur Provider und Modell, sondern auch `provider_profile`, Prompt-Bias-Staerke, Carry-Flag, Decode-Werte, Cleanup-Endpoint und Cleanup-Modell zeigen; diese Metadaten gehoeren zur Runtime-Wahrheit eines lokalen Runs
- diese Decode-Regler leben jetzt profilgebunden in AppConfig. `local_beam_size` und `local_best_of` bleiben nur der aktive Mirror des aktuell gewaehlten Profils, waehrend die eigentliche Persistenz pro `local_profile` erfolgt
- Rebuild-Lab-Diagnostics darf den Local-Runtime-Vertrag nicht mehr aus dem Fenster-Draft ableiten. Der Snapshot kommt nativ aus der aktuell geladenen Runtime-Config, und die UI vergleicht ihn gegen unsaved Settings-Aenderungen statt beides zu vermischen
- `local_preview` ist jetzt ein voller lokaler Dictation-Pfad fuer STT plus Cleanup innerhalb derselben Runtime-Lane; Capture, Insertion und Recovery bleiben bewusst dieselben Produktpfade wie bei Groq
- ein eigener WordScript-Proxy oder Hosted Mode existiert nicht

Die aktuelle Local-Runtime-Verdrahtung erwartet:

- `whisper-cli` in `PATH` oder `WORDSCRIPT_LOCAL_WHISPER_CLI`
- `WORDSCRIPT_LOCAL_MODEL_PATH` fuer eine einzelne ggml-Datei oder `WORDSCRIPT_LOCAL_MODEL_DIR` fuer `ggml-<model>.bin` und gaengige Varianten wie quantisierte oder `.en`-Dateien
- Ollama lokal unter `http://127.0.0.1:11434` oder `WORDSCRIPT_LOCAL_CHAT_BASE_URL`
- ein installiertes lokales Cleanup-Modell, das ueber `local_correction_model` oder `WORDSCRIPT_LOCAL_CHAT_MODEL` ausgewaehlt wird

Wenn spaeter weitere Provider dazukommen, gehoeren sie unter `src-tauri/src/core/providers/` und muessen denselben Fehler- und Antwortvertrag bedienen.

## Was bewusst noch nicht Architekturrealitaet ist

Diese Themen sind moegliche spaetere Produktstufen, aber heute nicht aktive Architektur:

- automatisches Modellmanagement mit Download-/Pull-Flow und Installer-nahen Checks ueber die aktuelle env-basierte Runtime-Verdrahtung und Provider-&-Models-Preflight-Flaeche hinaus
- automatische oder permission-basierte App-/Mode-Aktivierung fuer Arbeitsmodi
- voller Live-Preview-/Controlled-Commit-Pfad im Overlay mit Aktionen vor dem finalen Commit
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