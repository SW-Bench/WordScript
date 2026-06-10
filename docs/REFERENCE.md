# WordScript — Reference

Stand: 2026-06-10

## Zweck

Dieses Dokument ist die konsolidierte Faktensammlung fuer den aktuellen Produktstand. Es ersetzt verstreute Einzelnotizen zu Support-Grenzen, API-relevanten Limits, Profilplanung und Audit-Zwischenstaenden.

Wenn README, Vision oder Architektur eine aktuelle Produktaussage brauchen, soll sie von hier aus belegbar sein.

## Projektkontext

- SW bench: Open-Source-brand von SW labs
- WordScript: der aktive Desktop-Diktierpfad innerhalb von SW bench
- Produktziel: eine offene, ernstzunehmende Alternative zu bezahlten AI-Voice-Dictation-Angeboten

## Produktstand

- Release-Linie: `0.2.2-alpha`
- aktiver Produktpfad: Tauri/React UI plus nativer Rust-Core
- heute benutzbare Version: Dev-Version aus dem Repo via `npm run tauri dev`
- aktive Fenster: Overlay, Settings und das Diagnostics-Pop-out
- aktive Settings-Tabs: Provider & Models, Input, Text Rules, About, Diagnostics

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
- kurzer Overlay-Nachlauf innerhalb derselben kompakten Host-Buehne mit nativen `copy`-, `retry`-, `restore`- und Dismiss-Aktionen, breiterem Preview-/Result-Frame fuer voll lesbare Action-Labels, echter `clipboard_only`-Preview vor dem Commit, gemerkter Manual-Position oder preset-basiertem Display-Anchor, bewegungsbasiertem Drag statt Sofort-Drag und nativem Offscreen-Parking im Idle statt einer vergroesserten zweiten Preview-Flaeche
- persistenter nativer Transkriptverlauf mit Retry, Delete/Clear, serverseitigen Filtern, JSON-Export und separater Diagnostics-Darstellung neben Runtime-Logs
- Text-Rules-Validation, Preview, Import/Export und Konfliktbehandlung
- Profile Health und Bias Policy: automatische Erkennung systemischer Verhaltensverzerrungen in einem Profil (Laengen-Asymmetrie im Dictionary, widerspruechliche Stil-Anweisungen im Prompt, Cleanup-unterdrueckende Prompt-Muster) mit Traffic-Light-Anzeige (gruen / gelb / rot) im Text-Rules-Tab und als Punkt im Profil-Dock; einzelne Flags koennen per Acknowledge-Toggle unterdrückt werden, ohne die Konfiguration anzufassen
- native Insertion mit mehreren Fallback-Stufen
- Scratchpad und Last-Transcript-Restore
- Input-Preflight fuer die erste Diktation mit Trigger-, Mikrofon-, Insert- und Recovery-Status aus nativer Wahrheit
- native Sound-Cues fuer Startup, Start, Stop, Abort und Fehler
- gepufferte Runtime-Logs in Diagnostics
- nativer Release-Status-Check fuer die About-Flaeche mit ehrlichem GitHub-Release-Signal

## Support- und Plattformmatrix

| Plattform | Status | Aktuelle Realitaet |
|---|---|---|
| macOS | Tier 1 Zielpfad | nativer Hotkey-, Capture- und Insert-Pfad; Dev-Mode-Auto-Paste braucht Privacy-Freigaben |
| Windows | Tier 1 Zielpfad | nativer Hotkey-, Capture- und Insert-Pfad; UAC-Grenzen gelten fuer simuliertes Paste |
| Linux X11 | Preview | nutzbarer Produktpfad mit kleinerem Stabilitaetsversprechen |
| Linux Wayland hybrid (X11+Wayland mit xdotool) | Preview-lite | xdotool-XTEST-Pfad direkt, sonst Clipboard + manuelles Paste |
| Linux Wayland rein (kein X11-Display) | Experimental | Auto-Paste deaktiviert, Clipboard-only + manuelles Paste; verhindert Wayland-Portal-Prompt "Control input devices" |

## Plattformdiagnostik fuer Insert und Recovery

Die native Plattformdiagnostik kommt aus `core::insertion` und wird sichtbar in der About-Flaeche ausgespielt. Sie besteht nicht nur aus einem Support-Tier, sondern aus:

- Plattformlabel
- Insert-Strategie
- Support-Message
- sichtbaren Voraussetzungen
- sichtbaren ehrlichen Grenzen

### macOS Dev-Mode

- fuer direktes Cmd+V-Auto-Paste braucht der ausfuehrende Prozess Accessibility in `System Settings -> Privacy & Security -> Accessibility`
- wenn macOS fuer synthetische Eingaben zusaetzlich `Input Monitoring` verlangt, muss dieselbe Launcher-App freigegeben werden
- im Dev-Mode kann dieser Eintrag unter Terminal oder VS Code erscheinen statt unter einem paketierten WordScript-App-Namen
- einzelne sandboxes, Remote-Desktop-Sitzungen oder Apps mit hoeheren Rechten koennen simuliertes Paste trotzdem ablehnen

### Windows

- der aktive Tier-1-Pfad nutzt simuliertes `Ctrl+V` oder Clipboard-Handoff
- elevated Ziel-Apps koennen synthetisches Paste von einem nicht-elevated WordScript-Prozess blockieren
- Scratchpad und Last-Transcript-Restore bleiben der offizielle Recovery-Pfad

## Provider- und Runtime-Grenzen

### Provider-Lanes heute

- `groq` ist der cloud-first Produktionspfad
- `local_preview` ist die interne Kompatibilitaets-ID fuer die lokale Runtime-Lane mit `whisper-cli` fuer STT und Ollama fuer Cleanup
- der Nutzer speichert den eigenen Groq-API-Key lokal im OS secret store
- die JSON-Konfiguration wird beim Speichern gescrubbt und alte JSON-Groq-Secrets werden nativ in den Secret Store migriert
- Provider-Status enthaelt typisierte Modi (`fast`, `quality`, `local`, spaeter `self_hosted`) und Capabilities fuer Transcription, Chat-Cleanup, Local, API-Key-Pflicht, Prompt-Bias, Language, Segments und Modellmanagement
- Provider-Fehler enthalten neben Text auch `kind`, HTTP-Status, Retry-After, `retryable` und eine `user_action`; Settings und Runtime-Events sollen diese Semantik weiterreichen statt eigene Fehlerkategorien zu bauen
- ein WordScript-Proxy oder Hosted Mode existiert nicht

### Modus-Semantik heute

- `fast` und `quality` beschreiben heute Qualitaets-/Latenz-Presets innerhalb derselben Provider-Lane
- `local` bedeutet einen lokalen oder on-device Laufzeitpfad ohne WordScript-Backend; bei WordScript ist das aktuell die `local_preview`-Lane mit lokalem Runner, lokalem Modellpfad und lokalem Cleanup-Endpoint
- `self_hosted` ist noch keine aktive Produktlane; der Begriff bleibt fuer spaetere nutzerbetriebene Remote- oder LAN-Dienste reserviert, die nicht WordScripts eigener Hosted Mode waeren
- diese Begriffe duerfen in UI und Doku nicht zusammengeschoben werden, solange die zweite Produktionslane und der gefuehrte Setup-Pfad noch fehlen

### Lokale Runtime-Voraussetzungen

- `whisper-cli` in `PATH` oder `WORDSCRIPT_LOCAL_WHISPER_CLI`
- `WORDSCRIPT_LOCAL_MODEL_PATH` fuer eine ggml-Datei oder `WORDSCRIPT_LOCAL_MODEL_DIR` fuer `ggml-<model>.bin` sowie gaengige Varianten wie quantisierte oder `.en`-Dateien
- Ollama lokal unter `http://127.0.0.1:11434` oder `WORDSCRIPT_LOCAL_CHAT_BASE_URL`
- ein installiertes lokales Cleanup-Modell, ausgewaehlt ueber `local_correction_model` oder `WORDSCRIPT_LOCAL_CHAT_MODEL`
- Provider & Models zeigt diese Voraussetzungen jetzt als native Preflight-Checkliste statt nur als Env-Text; die Checkliste liest `local_setup` und nicht eigene UI-Heuristiken
- die Lane ist nicht mehr STT-only; AI cleanup laeuft lokal ueber das separate Cleanup-Modell und faellt nur bei Nichtverfuegbarkeit oder Guardrail-Rejects auf das rohe lokale Transkript zurueck

### Audio- und Upload-Relevanz

- Capture-Dateien werden fuer Groq auf 16 kHz Mono-WAV normalisiert
- der Runtime-Pfad nutzt ein kurzes interaktives Timeout von `18_000` bis `35_000` Millisekunden
- die aktive Transkriptionsanfrage laeuft ohne Retry-Kette (`max_retries = 0`)
- async Provider-, Transform- und Insert-Ergebnisse werden an die aktive `processing`-Session-ID gebunden; stale Ergebnisse nach Abort, neuer Aufnahme oder bereits finalisierter Session werden verworfen und nur im Runtime-Log notiert

Relevante externe Groq-Grenze fuer den Produktpfad:

- `413 request_too_large` bezieht sich auf Upload-Groesse, nicht nur auf Dauer
- dokumentierte Richtwerte aus der aktuellen Integration: Free `25 MiB`, Dev `100 MiB` pro Upload

Diese Werte sind nur insofern Teil der Produktreferenz, wie sie den aktiven Desktop-Flow beeinflussen.

## Text Rules und Profilstatus

### Heute aktiv

- lokale Textprofile mit aktivem `Transcription Context`
- Work-Mode-Defaults fuer Rewrite-Stil, Insert-Verhalten und Recovery-Verhalten
- profileigenes Personal Dictionary
- profileigene Snippet-Liste
- globale Schalter fuer AI cleanup, filler filter und rewrite phrasing nur noch als Fallback fuer Profile ohne expliziten Work-Mode

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
- geplante Profil-Automation duerfen nicht als aktive Funktion beschrieben werden

### Profile Health und Bias Policy

#### Was ist Profile Health?

AI-Cleanup ist kein freier Rewrite-Agent. Er bekommt ein fertig transkribiertes Dokument, das Profil als Stil-Kontext und Dictionary-Schreibweisen als Preserve-Hinweise. Wenn die Profil-Konfiguration sich selbst widerspricht oder bestimmte Muster enthaelt, gibt es keinen Fehler zur Laufzeit — der Cleanup arbeitet einfach mit widerspruechilichen oder bremsenden Anweisungen. Das Ergebnis verschlechtert sich still.

Profile Health erkennt drei solcher Muster bevor der erste Diktat-Lauf passiert:

**LengthBias (gelb):** Wenn mindestens 60 Prozent aller Dictionary-Eintraege konsequent laengere (Faktor 2×) oder kuerzere Schreibweisen (unter 40 Prozent der Originallaenge) produzieren, sieht AI-Cleanup ein strukturell verzerrtes Eingabedokument. Das Modell versucht dann, diese systematische Laengen-Asymmetrie selbst zu korrigieren — was zu unerwarteten Rerewrites fuehrt, die nichts mit dem tatsaechlichen Diktat zu tun haben. Nur Eintraege mit mindestens drei Zeichen werden gezaehlt.

**FormConflict (rot):** Wenn der Prompt gleichzeitig widerspruchliche Stil-Anweisungen enthaelt (formal + casual, concise + verbose, add punctuation + no punctuation, technical + simple, direct + elaborate, professional + casual), bekommt das Cleanup-Modell zwei Geloebde, die es nicht beide halten kann. Es waehlt intern irgendwie zwischen ihnen — oder wechselt zwischen Saetzen ab. Das Ergebnis ist nicht vorhersehbar.

**CleanupInterference (gelb):** Wenn der Prompt Muster enthaelt, die direkt gegen AI-Cleanup arbeiten — "verbatim", "do not change", "act as", "do not correct", "transcript only", "preserve exactly", "no cleanup", "raw output", "keep as is" — unterdruecken diese Anweisungen teilweise oder vollstaendig den Cleanup-Durchlauf. In bestimmten Faellen kann AI-Cleanup gar nicht mehr zwischen Stilkorrektur und Respektierung des Verbots unterscheiden.

#### Traffic Light

- Gruen: kein Flag aktiv oder alle Flags acknowledged
- Gelb: mindestens ein LengthBias- oder CleanupInterference-Flag unbestaetigt
- Rot: mindestens ein FormConflict-Flag unbestaetigt

Das Level erscheint als kleiner Farbpunkt neben dem aktiven Profilnamen im Profil-Dock der Settings-Sidebar. Gruen wird nicht explizit angezeigt.

#### Bias Policy — Acknowledge statt Loeschen

Jedes Flag hat einen individuellen Acknowledge-Toggle. Wer einen Flag bestaetigt, unterdrueckt die Warnung ohne die Konfiguration zu aendern. Das ist beabsichtigt: manchmal ist ein LengthBias korrekt — zum Beispiel wenn ein Kuerzel explizit auf einen vollen Ausdruck expandiert werden soll. Wer weiss, was er tut, kann das Flag wegklicken. Wer das Profil wechselt oder den Tab neu laedt, bekommt alle Flags zurueck.

Die acknowledged_flags werden nicht in der Profil-Konfiguration gespeichert. Sie sind Session-State in der Text-Rules-UI und werden beim Profilwechsel zurueckgesetzt.

#### Technische Details

Backend-Seite (`src-tauri/src/core/text_rules.rs`):

- `analyze_profile_health(prompt, dictionary_entries, acknowledged_flags) -> ProfileHealthStatus`
- `ProfileHealthFlag` ist ein enum mit drei Varianten: `LengthBias { direction, entry_count, hint }`, `FormConflict { hint }`, `CleanupInterference { hint }`
- `ProfileHealthLevel` ist `green | yellow | red`
- `derive_health_level` berechnet das Level aus den Flags minus acknowledged: jeder unbestaetigt FormConflict → red; jeder andere unbestaetigt Flag → yellow; alles acknowledged oder kein Flag → green
- `get_profile_health` ist ein Tauri-Command, der eine `GetProfileHealthRequest` (prompt, dictionary_entries, acknowledged_flags) annimmt und `ProfileHealthStatus` (level, flags) zurueckgibt
- Serde-Tag: `#[serde(tag = "kind", rename_all = "snake_case")]` fuer diskriminierte Union auf TypeScript-Seite

Frontend-Seite:

- `src/types/textRules.ts`: `ProfileHealthFlag` als TypeScript-Union ueber `kind`-Discriminant, `ProfileHealthStatus`, `GetProfileHealthRequest`
- `src/components/settings/PromptsTab.tsx`: ruft `get_profile_health` parallel zu `analyze_text_rules` in demselben 120ms-Debounce-Effekt auf; `acknowledgedFlags` ist ein `Set<string>` im lokalen State, der bei Profilwechsel zurueckgesetzt wird; `onHealthChange` Callback propagiert `ProfileHealthStatus | null` an SettingsWindow
- `src/components/settings/ProfileDock.tsx`: bekommt `healthStatus?: ProfileHealthLevel` als Prop und zeigt bei yellow/red einen kleinen Farbpunkt neben dem Profilnamen
- `src/windows/SettingsWindow.tsx`: haelt `profileHealthLevel` als State, empfaengt ihn ueber `onHealthChange` aus PromptsTab und reicht ihn als `healthStatus` an ProfileDock weiter

## Planungsstand fuer spaetere Sync-Themen

Diese Punkte beschreiben keine aktive Funktion, sondern die aktuelle Zielrichtung fuer spaeteren Ausbau:

- WordScript bleibt local-first; ein Konto waere additiv und nicht Voraussetzung fuer den Produktkern
- wenn spaeter Sync kommt, dann als WordScript-eigener Dienst fuer WordScript-Daten statt als Pflicht-Abhaengigkeit von einem externen Produkt-Hub
- der primaere Ausbaupfad ist kein Peer-to-Peer- oder Client-to-Client-Primarmodell
- fruehe Sync-Kandidaten sind Profile, Dictionary, Snippets, ausgewaehlte Settings und spaeter optional Verlauf oder Workspaces
- Provider-Credentials wie der Groq-API-Key bleiben lokal im OS secret store und sind kein impliziter Sync-Bestandteil

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
- reale Regression-Faelle aus misslungenen Diktaten fehlen noch; solange problematische Profilbeispiele nicht als feste native Tests fuer Bias-Filter, Prompt-Building und Text-Rules-Analyse vorliegen, bleibt Reliability-Fortschritt zu stark an manueller Reproduktion haengen; erste Regressionstests fuer question-answering-Guardrail und Length-Explosion-Pattern sind in `core::transform` vorhanden, aber Tests fuer `transcription_hints`, `text_rules::analyze_document` und den Prompt-Building-Pfad in `lib.rs` fehlen noch
- Text Rules warnt heute ueber schwachen automatischen Bias, aber eine explizite profilgebundene Bias-Policy und sichtbare Profilgesundheit fehlen noch; damit sind Ignorierfaelle sichtbar, aber nicht bereits als bewusste Profilentscheidung fuehrbar
- keine publizierten versionierten Releases
- kein signierter In-Place-Auto-Updater
- Release- und Signing-Validation mit echten Secrets ist noch kein regelmaessiger Routinepfad
- Linux Wayland bleibt experimentell
- **Linux Wayland – Auto-Paste deaktiviert auf reinen Wayland-Sessions:** Auf reinen Wayland-Sessions (kein `DISPLAY`, nur `WAYLAND_DISPLAY`) loest jeder Versuch, `wtype` oder `ydotool` fuer Input-Simulation zu starten, den KDE-Plasma-Portal-Dialog "Remote Control – Control input devices" aus. Deshalb ist die Paste-Driver-Chette auf reinen Wayland-Sessions leer; der Transkript landet nur im Clipboard und muss manuell eingefuegt werden. Hybrid-Sessions (X11+Wayland mit xdotool) sind davon nicht betroffen und nutzen weiterhin xdotool-XTEST. Diese bewusste Default-Wahl vermeidet den Portal-Dialog, schraenkt aber die Auto-Paste-Bequemlichkeit auf pure Wayland ein.
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

## Verbleibender Dokumentensatz

Das absichtlich kleine Doku-Set ist:

- `README.md` fuer Projektueberblick
- `docs/VISION.md` fuer Produktziel und V1/V2-Einordnung
- `docs/ARCHITECTURE.md` fuer Systemwahrheit und Ownership
- `docs/DEVELOPMENT.md` fuer Arbeitsmodus und Validation
- `docs/DESIGN_SYSTEM.md` fuer UI-Regeln
- `docs/REFERENCE.md` fuer aktuelle Fakten und Grenzen
- `docs/RELEASE_RUNBOOK.md` fuer den aktuellen Release-Aufbaupfad

Weitere Dateien brauchen einen engeren Zweck als diese sechs Dokumente.