# WordScript — Vision

Stand: 2026-06-10

## Nordstern

WordScript soll eine offene Desktop-Diktier-App werden, die fuer Vielschreiber schneller und ehrlicher ist als generische Sprachtools.

Nicht als allgemeiner AI-Assistent. Nicht als Feature-Sammlung. Sondern als Produkt fuer einen klaren Moment:

**Trigger. Sprechen. Brauchbarer Text. Saubere Recovery. Weiterarbeiten.**

## Community-Haltung

WordScript entsteht unter SW bench, der Open-Source-brand von SW labs. Das Produkt soll als Community-Build wachsen: offen im Repo, nachvollziehbar im Runtime-Pfad und attraktiv fuer Leute, die ein gutes Diktierprodukt bauen wollen statt nur ein weiteres Abo-Modell. 

Ein spaeterer kommerzieller Release-Aufbau ist nicht ausgeschlossen. Aber die Richtung ist klar: zuerst ein richtig gutes Produkt, keine kuenstliche Bezahlschranke auf Basis-Produktivitaet wie Sprechen, Tippen und Weiterarbeiten. 

## Was WordScript einmal werden soll

Langfristig soll WordScript eine starke, offene Diktierbasis fuer Desktop-Workflows werden:

- schnell genug fuer IDEs, Chat, Mail und Dokumente
- flexibel genug fuer unterschiedliche Provider und spaetere Arbeitsprofile
- ehrlich genug, um Plattformgrenzen und Recovery nicht hinter Marketing zu verstecken
- offen genug, dass Nutzer ihre Regeln, Daten und Workflows kontrollieren koennen

## Was V1 ist

V1 ist ein enges Diktierprodukt fuer Desktop-Textfelder.

V1 bedeutet:

- globaler Trigger
- stabiler Capture-to-Insert-Loop
- cloud-first Transkription als Standardpfad
- persoenliches Dictionary und erste Snippets
- klares Recovery-Modell
- ehrliche Support-Tiers
- eine kleine, produktive Desktopoberflaeche statt Tool-Sammlung

V1 bedeutet nicht:

- kein allgemeiner AI-Assistant
- kein Screen-Context-System
- keine Team- oder Admin-Flaeche
- keine mobile Paritaet
- kein als fertig verkaufter halb fertiger Auto-Updater

## Was V2 ist

V2 beginnt erst auf einem funktionierenden Diktierkern.

Erst dann werden Themen wie diese sinnvoll:

- spaetere Rewrite-Styles und produktivere Textmodi
- Team-Dictionaries oder geteilte Snippet-Sets
- tieferere IDE-Integrationen
- spaetere Assistant- oder Command-Workflows
- moeglicher Hosted Mode mit eigenem Backend

V2 ist also ein Ausbau auf Basis eines guten Kerns, nicht eine Abkuerzung an V1 vorbei.

Wenn WordScript spaeter Sync, Accounts oder gehostete Arbeitsraeume bekommt, dann als eigene WordScript-Schicht auf einem lokalen Kern, nicht als Voraussetzung fuer den Basis-Flow.

Die aktuelle Planungsrichtung dafuer ist:

- local-first statt account-first
- optionaler WordScript-Account statt Zwangslogin
- WordScript-eigener Sync-Service statt externer Produkt-Hub als Pflicht-Backend
- kein Peer-to-Peer-Primarmodell fuer die langfristige Plattform
- **UI/UX-Overhaul zur nativen macOS-Shell** als Voraussetzung fuer den V2-Ausbau; siehe `docs/UI_UX_OVERHAUL_PLAN.md`
- **Ausgegraute Preview-Tabs** (Chat, Upload, Notes, Workspace, Account) als ehrlicher Vorgeschmack auf zukuenftigen Scope

## Langfristige Plattform-Richtung

Langfristig darf WordScript groesser werden als ein reines Diktierprodukt.

Die Richtung dahinter ist nicht "mehr Features um jeden Preis", sondern eine offene Voice-Workstation fuer Desktop-Arbeit:

- Diktat und Textmodi fuer IDE, Mail, Chat und Dokumente
- spaetere Meeting-Transkription, Speaker-Diarization und Verlauf
- Notes, Search, Sync, API und MCP
- lokale Profile, geteilte Arbeitskontexte und spaetere Team-Modelle
- ein spaeterer Voice-Assistant, der nicht nur Text produziert, sondern Werkzeuge ausfuehrt
- spaetere Browser-Use- und Computer-Use-Workflows mit klaren Permissions und sichtbarer Kontrolle

Wichtig:

- Diese Richtung ist echt.
- Sie ist aber nicht der aktuelle V1-Produktkern.
- Sie darf den heutigen Dictation-, Recovery- und Support-Fokus nicht verwischen.

Auch in dieser spaeteren Plattformstufe bleibt der Kern gleich: WordScript soll ohne Konto benutzbar bleiben, waehrend spaetere Sync- und Workspace-Funktionen additiv darauf aufbauen.

WordScript soll also erst ein starkes Diktierprodukt werden und darauf spaeter eine groessere offene Arbeitsplattform aufbauen.

## Wo wir gerade stehen

Der aktuelle Stand ist `0.2.2-alpha`.

Der Produktkern ist real:

- native Hotkeys
- native Aufnahme
- Groq-BYOK
- lokale Runtime-Lane fuer STT plus Cleanup
- native Transform-Pipeline
- lokale Textprofile fuer Context, Dictionary und Snippets
- native Insertion mit Recovery
- nativer Verlauf mit Retry, Filter- und Exportpfad
- aktive Settings- und Diagnostics-Flaechen

Was noch fehlt, ist vor allem Produktkonsolidierung:

- die Transkriptionszuverlaessigkeit faellt ausserhalb von `General Writing` oder keinem Profil noch zu oft hinter die Basis zurueck; profilgebundener STT-Bias darf keine mehrsprachigen Fragmente, Fantasietokens oder Topic-Drift in Rohtranskripte ziehen
- heute wird WordScript praktisch als Dev-Version via `npm run tauri dev` benutzt
- ein sauberer kommerzieller Release-Aufbau ohne falsche Release- oder Update-Versprechen
- weitere Schaerfung bei Recovery, Support-Kommunikation, Text Rules und gefuehrter lokaler Einrichtung

Parallel dazu wird ein interner Cross-Platform-Release-Aufbau fuer Linux, macOS und Windows weiter gepflegt. Er ist aber nicht die aktuelle Launch-Freigabe und ersetzt keine belastbare Diktierqualitaet.

## Aktuelle Entscheidungen

- Der aktive Kern bleibt Tauri/Rust plus React-UI.
- Cloud ist fuer V1 der Standardpfad.
- Groq ist der erste echte Provider im Produkt.
- BYOK bleibt die aktuelle Credential-Strategie.
- Dictionary und Snippets liegen im nativen Transform-Pfad.
- Recovery mit Clipboard, Scratchpad und Last-Transcript-Restore ist Teil des Produktversprechens.
- Distribution, Signierung und Updater sind aktive Aufbaupfade, aber noch kein fertiges Nutzer-Versprechen.
- falls spaeter Sync kommt, dann als optionale WordScript-eigene local-first Schicht und nicht als P2P-Primarmodell

## Plattformziel

- macOS: Tier 1 Zielpfad
- Windows: Tier 1 Zielpfad
- Linux X11: Preview
- Linux Wayland: Experimental

## Was jetzt nicht passieren soll

Die aktuelle Arbeit darf nicht wieder in diese Richtung driften:

- Scope-Ausweitung auf Assistant-, Agent- oder Account-Themen vor einem stabilen Kern
- den internen Release-Aufbau mit Launch-Reife zu verwechseln, solange profilabhaengige Transkriptionsfehler die Alltagsnutzung noch untergraben
- aggressiven Profil- oder Prompt-Bias auszurollen, der Rohtranskripte gegenueber `General Writing` verschlechtert
- neue tote Settings-Optionen ohne echten Runtime-Pfad
- Dokumentation, die geplante Themen als implementiert beschreibt

## Was wir jetzt konkret bearbeiten

Die unmittelbaren Produktprioritaeten sind:

1. Die Transkriptionszuverlaessigkeit im aktiven Diktierpfad haerten. Aktive Profile wie `Customer Success Replies` duerfen Rohtranskripte nicht unzuverlaessiger machen als `General Writing` oder kein Profil. Die zwei naechsten konkreten Ausfuehrungsschritte darunter sind ein fixes Regression-Korpus aus realen Fehltranskripten und danach eine sichtbare Profilgesundheit mit expliziter profilgebundener Bias-Policy statt nur impliziter konservativer Defaults.
2. Die Settings-Tabs als ruhigere, klarere und nativer wirkende Produktoberflaeche weiterziehen, im Ziel eher wie eine kleine macOS Utility-App als wie eine Web-Konfigurationsflaeche. Das Overlay ist dafuer aktuell nicht die primaere Baustelle.
3. Profile von statischen Rule-Sets zu sichtbaren lokalen Arbeitsmodi fuer Context, Dictionary, Snippets, Processing-Modus, Insert- und Recovery-Defaults verdichten, aber vorerst lokal und manuell halten; der primaere Work-Mode-Vertrag ist `ProcessingMode` (`cleanup` / `rewrite` / `agent` / `prompt_enhance` / `verbatim`), die Aufloesung pro Session laeuft ueber `mode_router` und kann optional `workspace_context` fuer Foreground-App-Auto-Detection nutzen, sobald `auto_detect_mode` aktiviert ist
4. Den Provider-Stack von Groq plus `local_preview` zu einem echten Modellsystem mit mindestens einem zweiten Produktionsprovider und klaren Modi wie `fast`, `quality`, `local` und spaeter `self_hosted` ausbauen; die Semantik von `local` vs `self_hosted` muss davor klar und ehrlich erklaert sein.
5. Die lokale Runtime-Lane von env-basierter Expertenkonfiguration zu einer first-class lokalen Produktoption mit gefuehrtem Modellmanagement, Pull-Checks, Health-Diagnostics, Bias-Prompting und Setup-Hilfe weiterziehen.
6. Den kommerziellen Release-Aufbau ehrlich intern halten, ohne publizierte Releases oder funktionierende Updates vorzutaeuschen, bis die Produktbasis diese Freigabe wirklich traegt.

Die akuteste Produktluecke gegenueber bezahlten Alternativen ist derzeit nicht primaer Packaging oder weiterer Plattform-Scope, sondern die Kombination aus profilabhaengiger Transkriptionszuverlaessigkeit und der UI-Fuehrung der Settings-Shell. Die bestehende Settings-Shell ist eine brauchbare Basis, muss aber in Informationsarchitektur, Motion, Hierarchie und wahrgenommener Ruhe noch einmal bewusst ueberarbeitet werden.

Sobald die Transkriptionsbasis fuer `General Writing` und aktive Profile wieder belastbar ist, ist die naechste Produktphase nach dem bisherigen Kern daher:

1. Profile von statischen Rule-Sets zu sichtbaren Arbeitsmodi fuer Context, Dictionary, Snippets, spaetere Rewrite-Defaults, Insert-Verhalten und Recovery-Verhalten verdichten.
2. Live-Preview und kontrollierten Commit zwischen Sprechen und finalem Insert einziehen, damit WordScript mehr Vertrauen und weniger Dev-Tool-Gefuehl erzeugt.
3. den Provider-Stack von einem ersten Adapter zu einem echten Modellsystem mit mindestens einem zweiten Produktionsprovider und klaren Modi wie `fast`, `quality`, `local` und `self_hosted` ausbauen.
4. die lokale Runtime-Lane von env-basierter Expertenkonfiguration zu einer first-class lokalen Produktoption mit gefuehrtem Modellmanagement, Pull-Checks, Health-Diagnostics, Bias-Prompting und Quality-vs-Latency-Presets weiterziehen.
5. Setup, Permissions und Packaging als gefuehrten Produktpfad behandeln, damit Nutzer von Install bis erster brauchbarer Diktation nicht durch verstreute Diagnostics stolpern.

Solange aktive Profile die Rohtranskription noch sichtbar destabilisieren, bleibt dieser Ausbau eine Folgephase und kein Argument, Release-Aufbau oder Packaging als eigentliche Hauptarbeit voranzuziehen.

Was wir dafuer bewusst noch nicht in die naechste Baustelle ziehen:

- `openwhispr`-Scope wie Notes, Search, Sync, MCP oder Assistant-Scope
- weitere Plattformbreite, bevor die taegliche Dictation-Nutzung persoenlicher und vertrauenswuerdiger geworden ist

Wenn Profile vorgezogen werden, dann nur als lokaler, diktiernaher Ausbau fuer Context, Dictionary, Snippets, kuratierte Starter-Baselines und spaetere Rewrite-Defaults, nicht als verkappter Assistant-Scope.

Dieser lokale Profilausbau ist jetzt Teil des aktiven Produkts. Was weiter strikt ausserhalb des aktuellen Kerns bleibt, ist jede automatische Profilaktivierung, Team-Sync-Logik oder eine Assistant-Identitaet um diese Profile herum.