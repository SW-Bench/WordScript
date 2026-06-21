# WordScript — Status

Stand: 2026-06-20

Aktueller Produktstand, implementierte Kernfunktionen, Insertion/Recovery-Modell, offene Produktluecken und Release-Build-Up.

## Produktstand

- Release-Linie: `0.2.2-alpha`
- aktiver Produktpfad: Tauri/React UI plus nativer Rust-Core
- heute benutzbare Version: Dev-Version aus dem Repo via `npm run tauri dev`
- aktive Fenster: Overlay, Settings und das Diagnostics-Pop-out
- UI-Stand: Auf `feat/ui-overhaul-v2` ist die Settings-Flaeche eine native-macOS-inspirierte **WordScript Shell** (gruppierte 200px-Sidebar, shadcn/ui + Tailwind v4 auf den v2-Tokens, native Titelleiste auf jedem OS, `useTransition`-Crossfade).
- aktive Areas: WORKSPACE (Home, History, Profiles) · ENGINE (Speech & AI, Modes, Capture, Overlay) · SYSTEM (Insert & Recovery, Diagnostics, About) · MORE (Chat, Upload, Notes, Account); alle Areas sind voll im Form-Kit gebaut.
- Settings-IA-Restrukturierung (2026-06-21): Die Tab-Struktur wurde auf Redundanz und Auffindbarkeit auditiert und neu geordnet.insert/Recovery/Diagnostics-Daten waren bis zu 4-fach dupliziert (Input, Permissions, About, Diagnostics) und sind jetzt konsolidiert: **Insert & Recovery** (Merge aus Permissions + Input-Delivery/Recovery, config-bearing) ist die einzige Recovery-Flaeche; **Overlay** wurde aus Input extrahiert (Placement/Display/Anchor/Result-Timeout); **About** wurde auf Version + Release-Path entschlankt (Platform-support-Karte entfernt). History-Liste + -Policy wurden aus Diagnostics entfernt (History ist jetzt die einzige History-Flaeche). Diagnostics erhielt interne Sub-Tabs (Slice runner / Diagnostics preview / Runtime logs). Profile-`work_mode`-Defaults (processing_mode/rewrite_style/insert_behavior/enhance_sub_mode/target) sind jetzt in Profiles editierbar ("Profile defaults"-Karte); Modes zeigt einen "Effective mode"-Praezedenz-Indikator (Profil-Default → Global → Runtime-Override via `resolve_current_processing_mode` IPC). AI-Cleanup-Verhalten (post_process/filter_fillers/professionalize) und AI-Agent-Mode (agent_mode_enabled/agent_name) wanderten von Speech & AI zu Modes (beschreiben die AI-Reaktion, nicht den Provider); Speech & AI behaelt nur Provider/Key/Local-Setup/STT/Language + Cleanup-/Agent-**Model**-Selects. Profile-Gallery ("Use any profile already loaded") entfiel; Vorschau-Chips sind in die Active-Profile-Select-Optionen eingefoldet. Das tote Preview-Nav (Chat/Upload/Notes/Workspace/Account) wurde durch 4 aktive MORE-Areas ersetzt (Workspace-Intent ist in Modes erfuellt, Account ist eigenstaendig). Storybook (`.storybook/`, `src/stories/`, Storybook-deps + scripts) und die Glass-Prototypen (`src/components/glass/`) wurden komplett geloescht; die 4 MORE-Areas sind im Settings-Kit (`@/components/ui/*` + shell) gebaut, nicht im isolierten Glass-Kit. Details in `.kilo/plans/1782040423014-settings-ia-audit.md` und `docs/UI_UX_OVERHAUL_PLAN.md`.

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
- explizite Processing-Modi (`auto`, `cleanup`, `rewrite`, `agent`, `prompt_enhance`, `verbatim`) mit `mode_router`-Aufloesung aus manuellem Override und Profil-Work-Mode; bei `auto` wird der konkrete Modus pro Transkription durch `resolve_auto_mode` aufgeloest (Agent-Name + imperativ → agent, imperativ + IDE-Kontext → prompt_enhance, sonst cleanup); Renderer fragt die effektive Mode ueber `resolve_current_processing_mode` ab, Overlay-Side-Label und ProfileDock zeigen den aktiven Modus
- `workspace_context` mit Foreground-App-Detection auf macOS, Windows und Linux; der Detektor nutzt `run_with_timeout` mit dedizierten Pipe-Drain-Threads, damit stdout/stderr nicht leer zurueckkommen
- `prompt_enhance`-Modus mit `enhance`/`expand` Sub-Mode und `PromptTarget` (system/developer/user) sowie Guardrail-Chain (empty, prompt_executes, language_mismatch, length_budget, semantic_drift)
- kurzer Overlay-Nachlauf innerhalb derselben kompakten Host-Buehne mit nativen `copy`-, `retry`-, `restore`- und Dismiss-Aktionen, breiterem Preview-/Result-Frame fuer voll lesbare Action-Labels, echter `clipboard_only`-Preview vor dem Commit, gemerkter Manual-Position oder preset-basiertem Display-Anchor, bewegungsbasiertem Drag statt Sofort-Drag und nativem Offscreen-Parking im Idle statt einer vergroesserten zweiten Preview-Flaeche
- Linux-Overlay mit fixen Fenstergroessen (440×60 flat / 460×164 edit) statt dynamischem pill-Resize, `set_background_color` bei jedem Reveal, `park_overlay_window` mit `hide()`, XWayland-Default (`GDK_BACKEND=x11`) mit `WORDSCRIPT_NATIVE_WAYLAND=1` opt-in, KWin-Script fuer Always-on-Top auf KDE Plasma 6 (`packaging/kwin-wordscript-overlay/`)
- persistenter nativer Transkriptverlauf mit Retry, Delete/Clear, serverseitigen Filtern, JSON-Export und separater Diagnostics-Darstellung neben Runtime-Logs
- Text-Rules-Validation, Preview, Import/Export und Konfliktbehandlung
- Profile Health und Bias Policy: automatische Erkennung systemischer Verhaltensverzerrungen in einem Profil (Laengen-Asymmetrie im Dictionary, widerspruechliche Stil-Anweisungen im Prompt, Cleanup-unterdrueckende Prompt-Muster) mit Traffic-Light-Anzeige (gruen / gelb / rot) im Text-Rules-Tab und als Punkt im Profil-Dock; einzelne Flags koennen per Acknowledge-Toggle unterdrückt werden, ohne die Konfiguration anzufassen; persistente `profile_health_acknowledged_flags`-Map ueber `acknowledge_profile_health_flag` / `unacknowledge_profile_health_flag` Tauri-Commands, geladen in `get_profile_health` aus der AppConfig
- native Insertion mit mehreren Fallback-Stufen
- Scratchpad und Last-Transcript-Restore
- Input-Preflight fuer die erste Diktation mit Trigger- und Mikrofon-Status aus nativer Wahrheit; Insert- und Recovery-Status leben jetzt in der Insert & Recovery-Area
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
- ein dedizierter Modes-Tab in Settings (zwischen Input und Text Rules) exposiert den aktiven Modus, den Sub-Mode (nur fuer `prompt_enhance`), den Prompt-Target, den `auto_detect_mode`-Schalter (Workspace-Kontext als Wahrscheinlichkeitssignal fuer Auto-Mode) sowie acht per-Mode-Hotkeys (`mode_picker_hotkey`, `mode_cycle_hotkey`, `mode_auto_hotkey`, `mode_verbatim_hotkey`, `mode_cleanup_hotkey`, `mode_rewrite_hotkey`, `mode_agent_hotkey`, `mode_prompt_enhance_hotkey`) mit plattformspezifischen Defaults

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
- Scratchpad und Last-Transcript-Restore bleiben sichtbar in der Insert & Recovery-UX (einzige Recovery-Flaeche; Home behaelt nur einen Quick-Restore-Button mit Link dorthin)
- aktuelle Insert-Ergebnisse enthalten `recovery_action`, `recovery_message` und `clipboard_restore`, damit Settings und Diagnostics klar zwischen keiner Aktion, manuellem Paste, Scratchpad-Recovery und Clipboard-Restore-Signal unterscheiden koennen
- persistierte History-Eintraege und History-Exporte tragen dieselben Recovery-Felder, damit Retry, Export und Diagnostics dieselbe Insert-Wahrheit behalten
- Scratchpad-Recovery in Insert & Recovery, diagnostische Preview-Transkripte in Diagnostics und der persistente History-Store sind drei getrennte native Datenflaechen
- Overlay, Insert & Recovery und Diagnostics lesen denselben nativen Plattformstatus; About zeigt keinen Plattformstatus mehr
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
- Linux Wayland ist compositorspezifisch: KDE Plasma 6 / GNOME Mutter erreichen direkten Auto-Paste ueber einen einmaligen xdg-desktop-portal-RemoteDesktop-Grant; Hyprland, Sway und KDE Plasma 5 bleiben experimentell ohne stabilen Portal-Pfad
- **Linux Wayland – Auto-Paste-Verhalten pro Compositor:** Auf KDE Plasma 6 und GNOME Mutter fordert WordScript beim ersten Status-Pull eine RemoteDesktop-Portal-Session ueber `busctl` an, persistiert das Restore-Token unter `$XDG_RUNTIME_DIR/wordscript/remote-desktop.token` und nutzt die Session fuer nachfolgende Auto-Paste-Versuche, sodass der "Control input devices"-Dialog nur einmal erscheint. Auf reinen Wayland-Sessions ohne aktive XWayland-Bridge bleibt Auto-Paste deaktiviert; der Transkript landet im Clipboard und muss manuell eingefuegt werden. Hybrid-Sessions (X11+Wayland mit xdotool) verwenden `xdotool type` als ersten Paste-Pfad, klassifizieren aber den stderr zur Laufzeit (KDE RemoteDesktop / InputCapture / unknown) und degradieren bei einem erkannten Portal-Prompt automatisch auf Clipboard-only mit sichtbarem `last_portal_prompt`-Treiber und stderr-Excerpt in der UI. Hyprland, Sway und KDE Plasma 5 haben keinen stabilen Portal-Grant; `paste_disabled_reason` nennt den konkreten naechsten Schritt (Plasma-6-Upgrade, `wlr-virtual-input`, etc.).
- **Linux Wayland – Overlay Click-Through nicht loesbar:** Das Overlay-Fenster blockiert auf Wayland Mausklicks auf den transparenten Bereich ausserhalb der sichtbaren Pill. Alle drei evaluierten Loesungsansaetze scheitern an architektonischen Grenzen: (1) GTK `input_shape_combine_region` schraenkt die Input-Region auf die Pill ein und gibt Click-Through frei, bricht aber `xdg_toplevel.move` auf dem getesteten Compositor – Drag funktioniert dann ueberhaupt nicht mehr. (2) `setIgnoreCursorEvents` ist auf dem getesteten Setup nicht wirksam. (3) JS-seitiges `setPosition`/`set_outer_position` bewegt sichtbare XDG-Toplevel-Fenster auf nativem Wayland nicht (Compositor-Ownership). **Aktueller Stand (2026-06-20):** Drag, Button-Click und Clipping funktionieren jetzt zuverlaessig (siehe `docs/handoffs/OVERLAY_LINUX_BLACK_BLOCK_HANDOFF.md`). Always-on-Top via KWin-Script (`packaging/kwin-wordscript-overlay/`). Click-Through zu Apps unter dem Overlay bleibt die einzige offene Grenze — Loesung erfordert Tauri-seitige Layer-Shell-Unterstuetzung oder einen Compositor-spezifischen Protokollpfad.
- **Linux Overlay – Black Block und Compositing-Artefakte behoben:** WebKitGTK malt `outer box-shadow` opak, was zu schwarzen Bloecken um die Pill fuehrte. Behoben durch `--ov-shadow: none` in `overlay-pill.css`. States ueberlagern sich nicht mehr beim Wechsel (flat→flat), da `set_background_color` jetzt bei jedem Reveal aufgerufen wird. `will-change: opacity` entfernt, um Layer-Cache-Probleme zu vermeiden.
- **Linux Settings – Scroll-Ruckeln durch GPU-Compositing und CSS-Kostenreduktion behoben:** `WEBKIT_DISABLE_COMPOSITING_MODE=1` zwang WebKitGTK in den Cairo-Software-Rendering-Pfad, was das Overlay vor Black-Blocks schuetzte, aber jedes Scrollen im Settings-Fenster CPU-gebunden und ruckelig machte (besonders bei Fenster-Skalierung). GPU-Compositing ist jetzt standardmaessig aktiviert; der Overlay-Shadow-Fix (`--ov-shadow: none`) und `WEBKIT_DISABLE_DMABUF_RENDERER=1` halten das Overlay auch mit GPU-Compositor korrekt. Zusaetzlich wurden die CSS-Kosten im Settings-Scroll-Pfad reduziert: `shadow-card` komplett von FormCard/StatTile/Rule-Cards entfernt (Elevation kommt jetzt nur noch durch Background + Border), `backdrop-filter` von der `material`-Klasse entfernt, `transition-colors` auf Scroll-Containern entfernt, `body` background-gradient auf `background-attachment: fixed` gesetzt (verhindert Re-Composite pro Scroll-Frame), `contain: layout paint` auf FormCard ergaenzt, History-Refresh-Interval von 1.5s auf 5s erhoeht, Tab-Wechsel-Animation (`animate-in fade-in-50`) entfernt und `contain: layout paint` + `overscroll-contain` + `scrollbar-gutter: stable` auf dem Scroll-Container ergaenzt. Opt-out via `WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING=1` fuer Hardware, auf der das Overlay dennoch Black-Blocks zeigt.
- ein vollstaendiger gefuehrter Setup-, Permissions- und Packaging-Pfad von Install bis erster brauchbarer Diktation ist noch nicht implementiert; lokale Runtime und Input haben aber bereits Preflight-Flaechen fuer die wichtigsten ersten Schritte
- die lokale Runtime-Lane braucht noch automatisches Modellmanagement, Pull-/Install-Aktionen und einen nutzerfaehigen Erststartpfad ueber die aktuelle env-basierte Runtime-Verdrahtung hinaus
- mehrere vollwertige Produktionsprovider ueber Groq hinaus sind noch nicht implementiert; ebenso fehlt noch ein explizites Mode-Modell wie `fast`, `quality`, `local` oder `self_hosted`
- Settings-Tabs brauchen noch eine klarere Informationshierarchie und mehr native macOS-Produktpolish; die aktuelle Shell ist brauchbar, aber noch nicht der Zielzustand. Das Overlay ist derzeit nicht die primaere UI-Baustelle
- Linux Overlay: Drag, Button-Click und Clipping funktionieren zuverlaessig (2026-06-20), aber Click-Through zu Apps unter dem Overlay bleibt offen (siehe `docs/handoffs/OVERLAY_LINUX_BLACK_BLOCK_HANDOFF.md`)
- spaetere app- oder mode-basierte automatische Aktivierung fuer Arbeitsmodi bleibt offen
- Overlay ist noch kein vollstaendiger Live-Preview- und Controlled-Commit-Pfad; aktuell zeigt es einen festen In-Pill-Nachlauf mit `copy`, `retry`, `restore` und Dismiss nach erfolgreichem Lauf sowie einen echten Processing-Preview-Stop fuer `clipboard_only`, aber noch keinen allgemeinen Pre-Commit-Entscheidungsweg fuer alle Delivery-Modi oder feinere Placement-Regeln jenseits des aktuellen Manual-vs-Preset-Vertrags
- spaetere Notes- und weitergehende Workflow-Aufbauten auf Basis des neuen History-Kerns sind noch nicht implementiert

Explizit nicht naechste Baustelle dieser Produktphase sind `openwhispr`-Themen wie Notes, Search, Sync, MCP oder Assistant-Scope. Diese bleiben nachgelagert, bis WordScript als taegliches Diktierprodukt persoenlicher und vertrauenswuerdiger geworden ist.

## Phasen-Status (V1-Konsolidierung)

Die ausfuehrliche Roadmap mit Reihenfolge, Bedingungen und Phasen-Scope liegt in [docs/ROADMAP.md](./ROADMAP.md). Hier nur der aktuelle Stand der einzelnen V1-Phasen:

- [x] **Phase 1 — Transkriptions-Bias, Profil-Health, Korpus** (Commit `a6005ca`, gemerged 2026-06-10). Korpus-Skelett unter `src-tauri/tests/fixtures/regression_transcripts.json`, profilgebundene Bias-Policy (`BiasMode` Conservative / Manual / Off + `ManualBias`), Profile-Health um `BiasPolicyWeak`-Flag erweitert, persistente `profile_health_acknowledged_flags`, Bias-Preview (`cloud_prompt_preview` / `local_prompt_preview`) in `TextRulesAnalysis`, Bias-Policy-Stage im Text-Rules-Tab. 246 Rust-Tests + 70 Frontend-Tests gruen, 0 Warnings.
- [x] **Phase 2 — Settings-Shell Polish** (abgeschlossen 2026-06-20). Design-System v2 mit Storybook, Liquid Glass Polish, macOS-Utility-Shell, Home-Screen v2.1, CSS @layer base Fix, Content-Visibility-Utilities, Overlay-Refinement mit fixen Linux-Groessen, KWin-Script fuer KDE Plasma 6 Always-on-Top, Black-Block- und Compositing-Fixes, AGPL-3.0 Lizenz.
- [ ] **Phase 3 — Live-Preview und kontrollierter Commit im Overlay.** Voraussetzung: Phase 1 (Preview braucht Bias-Klarheit). Siehe `VISION.md:165`.
- [ ] **Phase 4 — Provider-Stack-Ausbau** mit ehrlich getrennter `local` vs. `self_hosted` Semantik. Voraussetzung: stabiler `ProviderCommandError` / `ProviderStatus`-Vertrag. Siehe `VISION.md:166` und `REFERENCE.md` Modus-Semantik.
- [ ] **Phase 5 — Lokale Runtime als first-class Produktoption.** Voraussetzung: Phase 4 (gleicher Provider-Vertrag). Siehe `VISION.md:167`.
- [ ] **Phase 6 — Gefuehrter Setup- und Packaging-Pfad.** Kommt bewusst zuletzt, weil Setup-Gefuehrte nur dann ehrlich ist, wenn die zugrunde liegenden Pfade selbst ehrlich sind. Siehe `VISION.md:168`.

## Release build-up status

- der aktive Repo-Pfad bleibt source-first mit `tauri dev`, hat aber wieder einen Build-Matrix-Workflow und Bundle-Ziele fuer Linux, macOS und Windows
- die aktuelle Nutzerrealitaet bleibt die Dev-Version via `npm run tauri dev`
- parallel entsteht ein interner Cross-Platform-Build-Up fuer Linux, macOS und Windows; er ist aber kein Signal, dass WordScript schon release-ready waere
- die aktuelle Launch-Blockade liegt vor allem bei der profilabhaengigen Transkriptionszuverlaessigkeit und beim noch unvollstaendigen gefuehrten Local-Setup, nicht beim Fehlen weiterer Packaging-Mechanik
- `check_app_update` signalisiert aktuell ehrlich, dass noch keine publizierten Releases existieren; interne Draft-Handoffs aendern diese Oeffentlichkeitswahrheit bewusst nicht
- es gibt aktuell keinen aktiven Installer-Kanal und keinen vertrauenswuerdigen Download-Handoff fuer Endnutzer; der neue Draft-Handoff bleibt maintainer-intern
- PR-CI validiert Frontend-Tests, Frontend-Build, `cargo check` und `cargo test` auf Ubuntu, macOS und Windows; `push: main`-Trigger ist temporaer deaktiviert (manueller `workflow_dispatch` bleibt verfuegbar), um wiederholte rote Runs waehrend der Development-Phase zu vermeiden
- der manuelle Release-Build-Up-Workflow fuehrt Frontend-Tests, Rust-Tests und Frontend-Build vor dem Bundling aus, sammelt die Bundles in checksummierte Handoff-Archive und kann sie optional in einen internen Draft-Release legen
- Linux-AppImage-Packaging ist aktuell noch nicht release-stabil und kann im Build-Up-Pfad an `linuxdeploy` scheitern
- Packaging, Signing und Updater-Arbeit sind im Aufbau, aber noch nicht als live Nutzerpfad freigegeben
