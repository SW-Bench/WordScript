# WordScript — Status

Stand: 2026-06-10

Aktueller Produktstand, implementierte Kernfunktionen, Insertion/Recovery-Modell, offene Produktluecken und Release-Build-Up.

## Produktstand

- Release-Linie: `0.2.2-alpha`
- aktiver Produktpfad: Tauri/React UI plus nativer Rust-Core
- heute benutzbare Version: Dev-Version aus dem Repo via `npm run tauri dev`
- aktive Fenster: Overlay, Settings und das Diagnostics-Pop-out
- aktive Settings-Tabs: Provider & Models, Input, Modes, Text Rules, About, Diagnostics

## Heute implementierte Kernfunktionen

- globale Start/Stop-, Pause/Resume- und Abort-Hotkeys
- native Mikrofonaufnahme mit Waveform-/Level-Events
- Silence-Timeout und Max-Duration-Autostop
- Groq-BYOK mit OS secret store
- `local_preview` als lokale Runtime-Lane ueber externes `whisper-cli`, lokale ggml-Modelle und lokales Ollama-Cleanup
- Provider-&-Models-Preflight fuer die lokale Runtime-Lane mit nativer Runner-, STT-Modell-, Cleanup-Endpoint- und Cleanup-Modell-Readiness
- bounded STT-Promptbias fuer Groq und `local_preview` aus aktivem Profil-Context, Dictionary-Schreibweisen und wahrscheinlichen Phrasen; der Mechanismus ist aktiv, aber einige nicht-generische Profile sind damit noch nicht verlaesslich genug fuer Alltagsdiktate
- der automatische Bias-Pfad ist inzwischen konservativer: generische Profilkategorien werden nicht mehr automatisch an STT und Cleanup weitergereicht, und eingeschlossene Profiles starten ohne vorbefuellte snippetartige `stt_hints`
- Text Rules zeigt diesen konservativen Bias-Vertrag jetzt direkt an und warnt, wenn Profil- oder Hint-Zeilen fuer den automatischen Pfad ignoriert werden oder gar keine konkreten STT-Hinweise uebrig bleiben
- Halluzinationsfilter und optionale AI-Nachkorrektur mit konservativen Preserve-Hinweisen aus aktivem Profil-Context und Dictionary-Schreibweisen; lokal und cloud nutzen dafuer getrennte Modell-Slots
- lokale Textprofile fuer Transcription Context, Dictionary, Snippets und Work-Mode-Defaults im nativen Transform-/Insert-/History-Pfad
- explizite Processing-Modi (`cleanup`, `rewrite`, `agent`, `prompt_enhance`, `verbatim`) mit `mode_router`-Aufloesung aus manuellem Override, Profil-Work-Mode, `auto_detect_mode` und `workspace_app_map`; Renderer fragt die effektive Mode ueber `resolve_current_processing_mode` ab, Overlay-Side-Label und ProfileDock zeigen den aktiven Modus
- `workspace_context` mit Foreground-App-Detection auf macOS, Windows und Linux; der Detektor nutzt `run_with_timeout` mit dedizierten Pipe-Drain-Threads, damit stdout/stderr nicht leer zurueckkommen
- `prompt_enhance`-Modus mit `enhance`/`expand` Sub-Mode und `PromptTarget` (system/developer/user) sowie Guardrail-Chain (empty, prompt_executes, language_mismatch, length_budget, semantic_drift)
- kurzer Overlay-Nachlauf innerhalb derselben kompakten Host-Buehne mit nativen `copy`-, `retry`-, `restore`- und Dismiss-Aktionen, breiterem Preview-/Result-Frame fuer voll lesbare Action-Labels, echter `clipboard_only`-Preview vor dem Commit, gemerkter Manual-Position oder preset-basiertem Display-Anchor, bewegungsbasiertem Drag statt Sofort-Drag und nativem Offscreen-Parking im Idle statt einer vergroesserten zweiten Preview-Flaeche
- persistenter nativer Transkriptverlauf mit Retry, Delete/Clear, serverseitigen Filtern, JSON-Export und separater Diagnostics-Darstellung neben Runtime-Logs
- Text-Rules-Validation, Preview, Import/Export und Konfliktbehandlung
- Profile Health und Bias Policy: automatische Erkennung systemischer Verhaltensverzerrungen in einem Profil (Laengen-Asymmetrie im Dictionary, widerspruechliche Stil-Anweisungen im Prompt, Cleanup-unterdrueckende Prompt-Muster) mit Traffic-Light-Anzeige (gruen / gelb / rot) im Text-Rules-Tab und als Punkt im Profil-Dock; einzelne Flags koennen per Acknowledge-Toggle unterdrückt werden, ohne die Konfiguration anzufassen; persistente `profile_health_acknowledged_flags`-Map ueber `acknowledge_profile_health_flag` / `unacknowledge_profile_health_flag` Tauri-Commands, geladen in `get_profile_health` aus der AppConfig
- native Insertion mit mehreren Fallback-Stufen
- Scratchpad und Last-Transcript-Restore
- Input-Preflight fuer die erste Diktation mit Trigger-, Mikrofon-, Insert- und Recovery-Status aus nativer Wahrheit
- native Sound-Cues fuer Startup, Start, Stop, Abort und Fehler
- gepufferte Runtime-Logs in Diagnostics
- nativer Release-Status-Check fuer die About-Flaeche mit ehrlichem GitHub-Release-Signal

## Text Rules und Profilstatus

### Heute aktiv

- lokale Textprofile mit aktivem `Transcription Context`
- Work-Mode-Defaults fuer Processing-Modus, Insert-Verhalten und Recovery-Verhalten; `rewrite_style` ist nur noch Migrations-Eingang (`polished`/`clean`/`verbatim`) und wird ueber `migrate_legacy_processing_mode` auf den primaeren `ProcessingMode`-Vertrag abgebildet
- profileigenes Personal Dictionary
- profileigene Snippet-Liste
- globale Schalter fuer AI cleanup, filler filter und rewrite phrasing nur noch als Fallback fuer Profile ohne expliziten Work-Mode
- ein dedizierter Modes-Tab in Settings (zwischen Input und Text Rules) exposiert den aktiven Modus, den Sub-Mode (nur fuer `prompt_enhance`), den Prompt-Target, den `auto_detect_mode`-Schalter, die `workspace_app_map` sowie sieben per-Mode-Hotkeys (`mode_picker_hotkey`, `mode_cycle_hotkey`, `mode_verbatim_hotkey`, `mode_cleanup_hotkey`, `mode_rewrite_hotkey`, `mode_agent_hotkey`, `mode_prompt_enhance_hotkey`) mit plattformspezifischen Defaults

### Heute nicht aktiv

- keine Prompt-Library als Produktfunktion
- keine Assistant-Identitaeten
- kein Team- oder Sync-Modell

### Profilrealitaet heute

- Profile werden lokal in der nativen Config gehalten
- der alte globale Rule-Zustand wird beim Laden in ein Standardprofil migriert
- die Settings-Sidebar zeigt den aktiven Profilnamen global und erlaubt manuellen Wechsel oder schnelles Anlegen neuer Profile
- die Text-Rules-UI kann Profile anlegen, duplizieren, waehlen und loeschen; eingeschlossene Profile erscheinen in derselben Profilbibliothek wie eigene Profile und koennen normal verwendet oder weiterbearbeitet werden
- die Text-Rules-UI ist als Workspace organisiert: Profilbibliothek links, aktive Context-/Preview-Karten oben und getrennte Dictionary-/Snippet-Arbeitsbereiche darunter
- History speichert den aktiven Profilnamen und den aktiven Work-Mode als Teil des Verlaufs
- automatische app- oder hotkey-basierte Profilaktivierung existiert noch nicht

Wichtige Doku-Regel dazu:

- `Transcription Context` bleibt eine STT-Hilfe
- Profile sind implementiert, aber bleiben lokal und manuell aktiviert
- eingeschlossene Profile sind lokale Baselines fuer zentrale ICPs und keine serverseitige Prompt-Library

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
- Overlay-Sichtbarkeit selbst folgt inzwischen ebenfalls dem nativen Host-Vertrag: aktive Sessions werden bottom-center sichtbar gemacht, Idle-Zustaende ausserhalb des sichtbaren Bereichs geparkt
- Overlay-Placement folgt ebenfalls dem nativen Host-Vertrag: Drag speichert die letzte Manual-Position, Settings kann auf preset-basierte Display-Anker umschalten und beides bleibt Teil desselben `AppConfig`

## Bekannte offene Produktluecken

- die Transkriptionszuverlaessigkeit ist ausserhalb von `General Writing` oder keinem Profil noch nicht belastbar genug; einzelne kuratierte Profile wie `Customer Success Replies` koennen Rohtranskripte aktuell mit mehrsprachigen Fragmenten, Fantasietokens und Topic-Drift sichtbar verschlechtern
- der AI-Cleanup-Schritt antwortet nicht mehr auf diktierte Fragen; ein expliziter Guardrail in `normalize_correction` faengt Faelle ab, in denen das Modell ein Fragezeichen aus dem Output entfernt; Regressionstests fuer diesen Pfad sind vorhanden
- reale Regression-Faelle aus misslungenen Diktaten werden jetzt ueber den Korpus in `src-tauri/tests/fixtures/regression_transcripts.json` plus Loader in `core::regression_corpus` abgefahren: Schema-Validierung, Bias-Pfad-Assertions, Text-Rules-Analyse-Assertions, Profile-Health-Init-Tests und Dictionary-Struktur-Tests; initiale Beispiele decken `cs_profile_multilingual_topic_drift`, `cs_profile_length_explosion_via_english_boilerplate` und `cs_profile_question_answered_german` ab; weitere reale Beispiele werden manuell nachgezogen und muessen jeweils in den Korpus und in passende synthetische Tests in `core::transform::tests` / `core::transcription_hints::tests` einfliessen
- Text Rules warnt heute ueber schwachen automatischen Bias; eine explizite profilgebundene Bias-Policy und sichtbare Profilgesundheit sind jetzt fuehrbar: `TextProfileWorkMode.bias_mode` (Conservative / Manual / Off) und `manual_bias` (cloud_include_profile_terms, local_include_profile_terms, stt_hints_override) werden in der AppConfig persistiert und ueber `analyze_document_with_context` als Provider-spezifische `cloud_prompt_preview` / `local_prompt_preview` an die UI zurueckgegeben; `BiasPolicyWeak`-Health-Flag warnt, wenn `Off` mit `agent` / `prompt_enhance` oder global aktivem Agent-Mode kollidiert; Conservative-Modus bleibt Default und schuetzt vor Sprachbias-Leakage in den Whisper-Initial-Prompt
- keine publizierten versionierten Releases
- kein signierter In-Place-Auto-Updater
- Release- und Signing-Validation mit echten Secrets ist noch kein regelmaessiger Routinepfad
- Linux Wayland bleibt experimentell
- **Linux Wayland – Auto-Paste deaktiviert auf reinen Wayland-Sessions:** Auf reinen Wayland-Sessions (kein `DISPLAY`, nur `WAYLAND_DISPLAY`) loest jeder Versuch, `wtype` oder `ydotool` fuer Input-Simulation zu starten, den KDE-Plasma-Portal-Dialog "Remote Control – Control input devices" aus. Deshalb ist die Paste-Driver-Chette auf reinen Wayland-Sessions leer; der Transkript landet nur im Clipboard und muss manuell eingefuegt werden. Hybrid-Sessions (X11+Wayland mit xdotool) sind davon nicht betroffen und nutzen weiterhin `xdotool type` (Fake-Input ueber XWayland). Diese bewusste Default-Wahl vermeidet den Portal-Dialog, schraenkt aber die Auto-Paste-Bequemlichkeit auf pure Wayland ein.
- **Linux Wayland – Overlay Click-Through nicht loesbar:** Das Overlay-Fenster blockiert auf Wayland Mausklicks auf den transparenten Bereich ausserhalb der sichtbaren Pill. Alle drei evaluierten Loesungsansaetze scheitern an architektonischen Grenzen: (1) GTK `input_shape_combine_region` schraenkt die Input-Region auf die Pill ein und gibt Click-Through frei, bricht aber `xdg_toplevel.move` auf dem getesteten Compositor – Drag funktioniert dann ueberhaupt nicht mehr. (2) `setIgnoreCursorEvents` ist auf dem getesteten Setup nicht wirksam. (3) JS-seitiges `setPosition`/`set_outer_position` bewegt sichtbare XDG-Toplevel-Fenster auf nativem Wayland nicht (Compositor-Ownership). Die einzig verbleibende Minderungsmassnahme waere eine exakte Fenstergroesse auf Pill-Level, was aber Drag-Zuverlaessigkeit und visuelle Position verschlechtert. Aktueller Stand: Fenster bleibt bei 256/300/388 px, Drag funktioniert, transparente Flaeche blockiert Klicks. Loesung erfordert entweder Tauri-seitige Layer-Shell-Unterstuetzung oder einen Compositor-spezifischen Protokollpfad.
- ein vollstaendiger gefuehrter Setup-, Permissions- und Packaging-Pfad von Install bis erster brauchbarer Diktation ist noch nicht implementiert; lokale Runtime und Input haben aber bereits Preflight-Flaechen fuer die wichtigsten ersten Schritte
- die lokale Runtime-Lane braucht noch automatisches Modellmanagement, Pull-/Install-Aktionen und einen nutzerfaehigen Erststartpfad ueber die aktuelle env-basierte Runtime-Verdrahtung hinaus
- mehrere vollwertige Produktionsprovider ueber Groq hinaus sind noch nicht implementiert; ebenso fehlt noch ein explizites Mode-Modell wie `fast`, `quality`, `local` oder `self_hosted`
- Settings-Tabs brauchen noch eine klarere Informationshierarchie und mehr native macOS-Produktpolish; die aktuelle Shell ist brauchbar, aber noch nicht der Zielzustand. Das Overlay ist derzeit nicht die primaere UI-Baustelle
- spaetere app- oder mode-basierte automatische Aktivierung fuer Arbeitsmodi bleibt offen
- Overlay ist noch kein vollstaendiger Live-Preview- und Controlled-Commit-Pfad; aktuell zeigt es einen festen In-Pill-Nachlauf mit `copy`, `retry`, `restore` und Dismiss nach erfolgreichem Lauf sowie einen echten Processing-Preview-Stop fuer `clipboard_only`, aber noch keinen allgemeinen Pre-Commit-Entscheidungsweg fuer alle Delivery-Modi oder feinere Placement-Regeln jenseits des aktuellen Manual-vs-Preset-Vertrags
- spaetere Notes- und weitergehende Workflow-Aufbauten auf Basis des neuen History-Kerns sind noch nicht implementiert

Explizit nicht naechste Baustelle dieser Produktphase sind `openwhispr`-Themen wie Notes, Search, Sync, MCP oder Assistant-Scope. Diese bleiben nachgelagert, bis WordScript als taegliches Diktierprodukt persoenlicher und vertrauenswuerdiger geworden ist.

## Release build-up status

- der aktive Repo-Pfad bleibt source-first mit `tauri dev`, hat aber wieder einen Build-Matrix-Workflow und Bundle-Ziele fuer Linux, macOS und Windows
- die aktuelle Nutzerrealitaet bleibt die Dev-Version via `npm run tauri dev`
- parallel entsteht ein interner Cross-Platform-Build-Up fuer Linux, macOS und Windows; er ist aber kein Signal, dass WordScript schon release-ready waere
- die aktuelle Launch-Blockade liegt vor allem bei der profilabhaengigen Transkriptionszuverlaessigkeit und beim noch unvollstaendigen gefuehrten Local-Setup, nicht beim Fehlen weiterer Packaging-Mechanik
- `check_app_update` signalisiert aktuell ehrlich, dass noch keine publizierten Releases existieren; interne Draft-Handoffs aendern diese Oeffentlichkeitswahrheit bewusst nicht
- es gibt aktuell keinen aktiven Installer-Kanal und keinen vertrauenswuerdigen Download-Handoff fuer Endnutzer; der neue Draft-Handoff bleibt maintainer-intern
- PR-CI validiert Frontend-Tests, Frontend-Build, `cargo check` und `cargo test` auf Ubuntu, macOS und Windows
- der manuelle Release-Build-Up-Workflow fuehrt Frontend-Tests, Rust-Tests und Frontend-Build vor dem Bundling aus, sammelt die Bundles in checksummierte Handoff-Archive und kann sie optional in einen internen Draft-Release legen
- Linux-AppImage-Packaging ist aktuell noch nicht release-stabil und kann im Build-Up-Pfad an `linuxdeploy` scheitern
- Packaging, Signing und Updater-Arbeit sind im Aufbau, aber noch nicht als live Nutzerpfad freigegeben
