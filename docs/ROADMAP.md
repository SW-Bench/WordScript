# WordScript — Phasen-Roadmap

Stand: 2026-06-10

Diese Roadmap bündelt die geplanten V1-Konsolidierungs- und Ausbauphasen, ihre Reihenfolge, ihre Bedingungen und was bewusst noch nicht zu einer Phase gehört. Sie ist die ausführliche Form der Phasen-Pointer, die in `STATUS.md`, `VISION.md` und `DEVELOPMENT.md` jeweils nur angerissen werden.

V1-Nordstern bleibt: Trigger, Sprechen, brauchbarer Text, saubere Recovery, Weiterarbeiten. Jede Phase muss diesen Kern stabiler oder ehrlicher machen, nicht breiter.

## Status der Phasen

- [x] **Phase 1 — Transkriptions-Bias, Profil-Health, Korpus** (Commit `a6005ca` auf master, 2026-06-10): Korpus-Skelett, profilgebundene Bias-Policy (`BiasMode` Conservative / Manual / Off + `ManualBias`), Profile-Health um `BiasPolicyWeak`-Flag erweitert, persistente `profile_health_acknowledged_flags`, Bias-Preview (`cloud_prompt_preview` / `local_prompt_preview`) in `TextRulesAnalysis`, Bias-Policy-Stage im Text-Rules-Tab. 246 Rust-Tests + 70 Frontend-Tests grün, 0 Warnings.
- [ ] **Phase 2 — Settings-Shell Polish**: Information-Architektur, Motion, Hierarchie und native macOS-Anmutung der Settings-Fenster, ohne neue Runtime-Heuristiken. Siehe `VISION.md:154`.
- [ ] **Phase 3 — Live-Preview und kontrollierter Commit im Overlay**: Sprecher sieht rohen Transkript, bereinigten Text, aktiven Modus und kann vor dem finalen Insert entscheiden. Erweitert den bereits umgesetzten `clipboard_only`-Preview-Stop auf alle Insert-Modi. Siehe `VISION.md:165`.
- [ ] **Phase 4 — Provider-Stack-Ausbau**: Zweiter Produktionsprovider neben Groq, klare Modi `fast` / `quality` / `local` / `self_hosted` mit ehrlich getrennter Semantik. Siehe `VISION.md:166` und `REFERENCE.md` Modus-Semantik.
- [ ] **Phase 5 — Lokale Runtime als first-class Produktoption**: Geführtes Modellmanagement, Pull-Checks, Health-Diagnostics, Bias-Prompting und Quality-vs-Latency-Presets. Aufbauend auf der heutigen `local_preview`-Lane. Siehe `VISION.md:167`.
- [ ] **Phase 6 — Geführter Setup- und Packaging-Pfad**: Install, Permissions und erste brauchbare Diktation als zusammenhängender Produktpfad statt verstreuter Diagnostics. Siehe `VISION.md:168`.

Bewusst ausserhalb der aktuellen Phasen-Pipeline:

- `openwhispr`-Scope wie Notes, Search, Sync, MCP, Assistant-Identitäten. Diese Themen bleiben bis nach V1-Konsolidierung nachgelagert (`VISION.md:174`).
- Team-/Sync-Logik und automatische Profilaktivierung. Lokale manuelle Profile bleiben der V1-Vertrag.
- V2-Themen (siehe `VISION.md:51-72`) wie Workspace-Sync, Accounts, gehostete Workspaces, Browser-Use-Workflows. Diese sind explizit von V1 getrennt.

## Phase 1 — Transkriptions-Bias, Profil-Health, Korpus (abgeschlossen)

**Ziel:** Profilabhängige Transkriptions-Drift unsichtbar machen, indem Bias explizit konfigurierbar wird, reale Failure-Modes als Korpus festsitzen und die Profil-Health bewusst fuehrbar ist.

**Eingeführte Vertragspunkte:**

- `TextProfileWorkMode.bias_mode: Conservative | Manual | Off` mit Migration `bias_policy_migrated`.
- `TextProfileWorkMode.manual_bias: { cloud_include_profile_terms, local_include_profile_terms, stt_hints_override }` als opt-in-Erweiterung.
- `TranscriptionBiasPreview` traegt jetzt `cloud_prompt_preview`, `local_prompt_preview`, `manual_overrides_applied`, `effective_stt_hints_source` und propagiert ueber `analyze_document_with_context` in die UI.
- `ProfileHealthFlag::BiasPolicyWeak` mit eigenem Hint, Red-Level nur in Kombination mit `agent` / `prompt_enhance` oder global aktivem Agent Mode.
- `AppConfig.profile_health_acknowledged_flags: HashMap<profile_id, HashSet<flag_kind>>` mit Tauri-Commands `acknowledge_profile_health_flag` und `unacknowledge_profile_health_flag`.
- Korpus unter `src-tauri/tests/fixtures/regression_transcripts.json` plus Loader in `core::regression_corpus`. Schema-Validierung, Bias-Assertions, Text-Rules-Assertions, Profile-Health-Init, Dictionary-Struktur.

**Initialer Korpus-Inhalt:**

- `cs_profile_multilingual_topic_drift`: 6 generische CS-Phrasen, erwartet 0 accepted profile hints, 6 ignored lines.
- `cs_profile_length_explosion_via_english_boilerplate`: Profil-Bias-Pfad mit Multilingual-Boilerplate, erwartet `assistant_like_correction_rejected` als Guardrail.
- `cs_profile_question_answered_german`: Profil-getriebene LLM-Tendenz, Frage zu beantworten, erwartet `question_answered_guardrail_fallback`.

**Eingeführte UI-Stage:** 4. Step "Bias policy" im Text-Rules-Tab mit Conservative/Manual/Off-Radio, conditional Manual-Flags, Live-Preview (Cloud sieht / Local sieht), Health-Flag-Liste mit Acknowledge-Buttons. Funktional, nicht poliert (Polish kommt mit Phase 2).

**Validierung:** 246 Rust-Tests + 70 Frontend-Tests, `cargo check` ohne Warnings, `npm run build` erfolgreich.

## Phase 2 — Settings-Shell Polish (geplant)

**Ziel:** Die Settings-Fenster werden ruhiger, klarer und nativer. Keine neue Runtime-Heuristik.

**Scope (nicht final):**

- Sidebar-Rhythmus, Tab-Hierarchie, Motion konsistent.
- Footer-Save-Bar und Profile-Dock-Integration.
- Native macOS-Dekoration und Padding konsistent mit Donoren `VoiceInk`, `FluidVoice`, `OpenSuperWhisper` (Stilreferenz, kein Copy/Paste).
- Bias-Policy-Stage aus Phase 1 visuell in den Rest einpassen.
- Diagnostik-Lesbarkeit verbessern, ohne zweite Setup-Wahrheit aufzubauen.

**Aussenvor:** Overlay-Visuals, neue Tabs, neue Heuristiken, Profile-Logik.

**Erfolgsmetrik:** Visuelle Konsistenz, reduzierte kognitive Last, keine Regression in `cargo test` und `npm test`.

## Phase 3 — Live-Preview und kontrollierter Commit im Overlay (geplant)

**Ziel:** Sprecher sieht rohen Transkript, bereinigten Text, aktiven Modus und entscheidet vor dem finalen Insert. Erweitert den bereits umgesetzten `clipboard_only`-Preview-Stop auf alle Insert-Modi.

**Scope (nicht final):**

- `processing_preview` fuer `direct_paste` und `clipboard_fallback` analog zu `clipboard_only`.
- Overlay-State-Machine `idle -> capturing -> processing -> preview -> commit | cancel`.
- `commit_pending_transcription_preview` Command (existiert bereits) wird zur zentralen Commit-Aktion fuer alle Modi.
- Diff-Ansicht im Overlay: roh vs. bereinigt, markierte Halluzinationsfilter- und Guardrail-Eingriffe.
- Aktionen: `commit`, `retry`, `restore`, `cancel`, `copy_raw`, `copy_cleaned`. Alle Aktionen muessen den nativen `wordscript-event`-Pfad nutzen, keine UI-eigenen Commits.
- `clipboard_only`-Preview-Verhalten bleibt, wird aber auf gleicher Buehne wie andere Modi gerendert.

**Aussenvor:** Neue Heuristiken, Auto-Commit-Logik, Clipboard-Restore-Aenderungen.

**Erfolgsmetrik:** Nutzer kann in mindestens zwei Drittel der Realfaelle vor dem Commit entscheiden, ohne Insert-Pfad zu duplizieren.

## Phase 4 — Provider-Stack-Ausbau (geplant)

**Ziel:** WordScript wird von einem ersten Adapter zu einem echten Modellsystem. Modi `fast` / `quality` / `local` / `self_hosted` mit ehrlich getrennter Semantik.

**Scope (nicht final):**

- Zweiter Produktionsprovider (z. B. OpenAI Whisper API, Anthropic, oder ein nicht-US-Anbieter). Auswahl erfordert Diskussion zu Kosten, Latenz, Datenschutz.
- `self_hosted`-Lane als explizite, von `local` getrennte Provider-Lane. `local` = on-device, `self_hosted` = nutzerbetriebener Remote- oder LAN-Dienst. Siehe `REFERENCE.md` Modus-Semantik.
- Provider-Adapter unter `src-tauri/src/core/providers/<name>.rs` mit dem gemeinsamen `Provider`-Vertrag.
- Provider-Capabilities aus `ProviderStatus` (Transcription, Chat-Cleanup, Local, API-Key-Pflicht, Prompt-Bias, Segments) statt Modell-Heuristiken.
- `ProviderCommandError` bleibt Single Source of Truth fuer Fehler-Semantik; UI darf daraus anzeigen, aber nicht eigene Fehlerkategorien erfinden.

**Aussenvor:** Provider-wechsel zur Laufzeit ohne Save, Account-Bindings, WordScript-eigener Proxy.

**Erfolgsmetrik:** Mindestens zwei Produktionsprovider laufen in Settings, Diagnostics und History mit demselben Vertrag; `self_hosted` hat einen Stub-Adapter, der in `local` nicht reinfaellt.

## Phase 5 — Lokale Runtime als first-class Produktoption (geplant)

**Ziel:** Die `local_preview`-Lane wird von env-basierter Expertenkonfiguration zu einer sichtbaren, gefuehrten Produktoption mit Modell-Management, Pull-Checks und Health-Diagnostics.

**Scope (nicht final):**

- `Provider & Models` zeigt fuer `local_preview` einen gefuehrten Pfad: Runner-Probe, STT-Modell-Liste aus nativer Discovery, Cleanup-Endpoint-Probe, Cleanup-Modell-Probe. Heute existieren alle Preflight-Checks, aber ohne "Fix-it"-Aktionen.
- "Pull"-Aktionen: Whisper-Modell aus einer kuratierten Quelle herunterladen, Ollama-Cleanup-Modell pullen. Voraussetzung: klare no-License-Pfad (Open-Modelle aus offiziellen Quellen).
- Decode-Presets werden in den Profil-Editor verschoben (heute liegen sie global in `local_beam_size` / `local_best_of`).
- Bias-Prompting fuer lokale Lane: getrennte UI fuer `local_prompt_strength` und Carry-Behavior, mit Vorschau was `whisper-cli --prompt` tatsaechlich bekommt.
- Quality-vs-Latency-Presets: sichtbar als Fast/Quality-Wahl im Profil, nicht nur als Modellname.

**Aussenvor:** Nicht-Whisper STT-Engines, verteilte lokale Pipelines, Custom-Model-Training.

**Erfolgsmetrik:** Ein Erstkontakt-Nutzer kann die lokale Lane ohne `WORDSCRIPT_*`-Env-Variablen und ohne Terminal aktivieren und benutzen.

## Phase 6 — Geführter Setup- und Packaging-Pfad (geplant)

**Ziel:** Install, Permissions und erste brauchbare Diktation als zusammenhängender Produktpfad statt verstreuter Diagnostics.

**Scope (nicht final):**

- Einstiegs-Dialog (oder `Onboarding`-Tab) mit klarer Reihenfolge: Mikrofon-Permission, Accessibility-Permission, Provider-Key, Modellwahl, Test-Diktation.
- `Diagnostics` behält die Detail-Ebene, wird aber im Normalfall nicht der erste Anlauf.
- "Get started"-Hints in den Settings-Tabs, die erklaeren warum ein Tab jetzt wichtig ist und welcher Schritt fehlt.
- `About`-Fläche zeigt ehrlich, ob ein Setup-Schritt blockierend fehlt.
- ehrliche Release-Status-Signale: `check_app_update` bleibt auf publizierte GitHub-Releases beschraenkt, der interne Draft-Handoff wird in `About` klar als interner Pfad markiert.

**Aussenvor:** Auto-Updater als geliefertes Feature, Signatur-Pipeline, App-Store-Builds.

**Erfolgsmetrik:** Ein Erstkontakt-Nutzer kann WordScript vom Installer bis zur ersten brauchbaren Diktation fuehren, ohne `Diagnostics` zu öffnen.

## Bedingungen fuer Phasen-Reihenfolge

Phase 1 ist Voraussetzung fuer Phase 2 (Bias-Policy-Stage muss existieren, bevor die Settings-Shell poliert wird) und fuer Phase 3 (Preview braucht Bias-Klarheit).

Phase 4 ist unabhaengig von Phase 3, solange der Vertrag von `ProviderCommandError` und `ProviderStatus` stabil bleibt. Phase 4 ist explizit vor Phase 5, weil die Provider-Lane-Mechanik (Capabilities, Modi, Fehler) auch fuer `local` gilt.

Phase 5 setzt Phase 4 voraus (gleicher Provider-Vertrag, gleiche Modi-Semantik).

Phase 6 haengt am wenigsten an den anderen, kommt aber bewusst zuletzt, weil Setup-Gefuehrte nur dann ehrlich ist, wenn die zugrunde liegenden Pfade selbst ehrlich sind.

## Was diese Roadmap nicht macht

- Sie ersetzt nicht `VISION.md`. VISION bleibt der Nordstern, die Roadmap ist die ausfuehrbare Sicht.
- Sie ersetzt nicht `STATUS.md`. STATUS bleibt der aktuelle Produktstand mit offenen Luecken, die Roadmap blickt nach vorn.
- Sie ersetzt nicht `DEVELOPMENT.md`. Workflow und Validation bleiben dort.
- Sie ersetzt nicht die Plan-Dateien in `.kilo/plans/`. Die Phasen-Beschreibungen hier sind die Kurzform fuer Doku-Leser; ausfuehrbare Specs kommen weiterhin als Plan-Dateien pro Slice.

## Mitfuehren, wenn sich der Plan aendert

- Phase-Reihenfolge oder Scope-Anpassung: hier editieren und in der Commit-Message referenzieren.
- Neue Phasen: am Ende des "Status der Phasen"-Blocks einfuegen, im `STATUS.md` als "geplant" markieren.
- Phase abgeschlossen: Haken setzen, Datum eintragen, im `STATUS.md` den zugehoerigen Punkt aus "Bekannte offene Produktluecken" in "Heute implementierte Kernfunktionen" verschieben.
