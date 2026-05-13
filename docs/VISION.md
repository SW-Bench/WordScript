# WordScript — Vision

Stand: 2026-05-13

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
- native Transform-Pipeline
- lokale Textprofile fuer Context, Dictionary und Snippets
- native Insertion mit Recovery
- nativer Verlauf mit Retry, Filter- und Exportpfad
- aktive Settings- und Diagnostics-Flaechen

Was noch fehlt, ist vor allem Produktkonsolidierung:

- heute wird WordScript praktisch als Dev-Version via `npm run tauri dev` benutzt
- ein sauberer kommerzieller Release-Aufbau ohne falsche Release- oder Update-Versprechen
- weitere Schaerfung bei Recovery, Support-Kommunikation und Text Rules

Parallel dazu wird das erste offizielle Cross-Platform-App-Release fuer Linux, macOS und Windows aufgebaut.

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
- neue tote Settings-Optionen ohne echten Runtime-Pfad
- Dokumentation, die geplante Themen als implementiert beschreibt

## Was wir jetzt konkret bearbeiten

Die unmittelbaren Produktprioritaeten sind:

1. Den kommerziellen Release-Aufbau ehrlich zeigen, ohne publizierte Releases oder funktionierende Updates vorzutaeuschen.
2. Settings und Overlay als ruhigere, klarere und nativer wirkende Produktoberflaeche weiterdenken, im Ziel eher wie eine kleine macOS Utility-App als wie eine Web-Konfigurationsflaeche.
3. Im bestehenden V1-Pfad Text Rules, Recovery und Supportfuehrung weiter schaerfen, inklusive lokaler kuratierter Starter-Profile fuer zentrale ICPs.
4. Plattformgrenzen und Diagnostics im aktiven Produktpfad weiter schaerfen.

Die aktuelle Produktluecke gegenueber bezahlten Alternativen ist damit nicht primaer ein weiterer Plattform-Scope, sondern die UI-Fuehrung: Die bestehende Settings-Shell und das Overlay sind eine brauchbare Basis, muessen aber in Informationsarchitektur, Motion, Hierarchie und wahrgenommener Ruhe noch einmal bewusst ueberarbeitet werden.

Die naechste Produktphase nach dem bisherigen Kern ist daher:

1. Profile von statischen Rule-Sets zu sichtbaren Arbeitsmodi fuer Context, Dictionary, Snippets, spaetere Rewrite-Defaults, Insert-Verhalten und Recovery-Verhalten verdichten.
2. Live-Preview und kontrollierten Commit zwischen Sprechen und finalem Insert einziehen, damit WordScript mehr Vertrauen und weniger Dev-Tool-Gefuehl erzeugt.
3. den Provider-Stack von einem ersten Adapter zu einem echten Modellsystem mit mindestens einem zweiten Produktionsprovider und klaren Modi wie `fast`, `quality`, `local` und `self_hosted` ausbauen.
4. `local_preview` von einer externen Preview-Lane zu einer first-class lokalen Produktoption mit Modellmanagement, Health-Diagnostics, Bias-Prompting und Quality-vs-Latency-Presets weiterziehen.
5. Setup, Permissions und Packaging als gefuehrten Produktpfad behandeln, damit Nutzer von Install bis erster brauchbarer Diktation nicht durch verstreute Diagnostics stolpern.

Was wir dafuer bewusst noch nicht in die naechste Baustelle ziehen:

- `openwhispr`-Scope wie Notes, Search, Sync, MCP oder Assistant-Scope
- weitere Plattformbreite, bevor die taegliche Dictation-Nutzung persoenlicher und vertrauenswuerdiger geworden ist

Wenn Profile vorgezogen werden, dann nur als lokaler, diktiernaher Ausbau fuer Context, Dictionary, Snippets, kuratierte Starter-Baselines und spaetere Rewrite-Defaults, nicht als verkappter Assistant-Scope.

Dieser lokale Profilausbau ist jetzt Teil des aktiven Produkts. Was weiter strikt ausserhalb des aktuellen Kerns bleibt, ist jede automatische Profilaktivierung, Team-Sync-Logik oder eine Assistant-Identitaet um diese Profile herum.