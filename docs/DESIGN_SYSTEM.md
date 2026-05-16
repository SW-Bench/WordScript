# WordScript — Design System

Stand: 2026-05-13

## Zweck

Das Design System beschreibt die aktive Produktsprache von WordScript. Es ist keine Wunschliste, sondern die Regelbasis fuer Overlay, Settings und Diagnostics im aktuellen App-Pfad.

## Produktprinzipien

- utility-first statt dashboard-first
- klarer Runtime-Zustand statt dekorativer Bewegung
- kleine Flaechen mit hoher Lesbarkeit
- Fehler und Recovery muessen fuehren, nicht nur anzeigen
- Plattformgrenzen duerfen nicht von der UI versteckt werden

## Aktuelles UI-Zielbild

- Das aktuelle Problem ist nicht mehr fehlende Flaeche, sondern fehlende Ruhe, Hierarchie und Produktklarheit.
- Das Zielbild fuer Settings und Overlay ist eine kleine, fokussierte Utility-App mit Apple-artiger Praezision: klare Fensterchromatik, stabile Sidebar/Main-Struktur, wenige visuelle Ebenen und knappe, weiche Motion.
- macOS ist dafuer die Referenz fuer Produktpolish, nicht die Einladung, generische OS-Mockups oder verspielte Desktop-Parodien in WordScript zu ziehen.
- Die bestehende Settings-Shell und das Overlay sind eine gute Basis, muessen aber vor weiterem Scope-Ausbau in Informationsarchitektur, Spacing, Zustandsklarheit und wahrgenommener Smoothness noch einmal bewusst ueberarbeitet werden.
- Der aktive UI-Pass hat diese Richtung bereits begonnen: sichtbare Panel-Header, klarere Sidebar-/Main-Trennung, verdichtete Summary-Flaechen fuer kritische Tabs und ein Overlay mit expliziterer Zustandslesbarkeit statt rein dekorativer Reduktion.

## UI-Donoren und Stilreferenzen

- Primaere Produktdonoren fuer diesen UI-Pass bleiben `VoiceInk`, `FluidVoice` und `OpenSuperWhisper`.
- Diese Repos liefern nicht nur Look, sondern produktrelevante Patterns fuer Overlay-Ruhe, Live-Preview, Mode-Denken, Dictionary-Naehe und macOS-native Utility-Fuehrung.
- Sekundaere Stil- und UX-Referenzen werden jetzt in drei Lanes gelesen: `menu bar utilities` mit `Ice`, `MonitorControl` und `Clipy`; `keyboard-first command surfaces` mit `raycast/extensions`, `massCode`, `Zed` und `AeroSpace`; sowie `desktop productivity shells` mit `Spacedrive`, `Mullvad VPN`, `Beekeeper Studio`, `Standard Notes` und `UTM`.
- Zusaetzliche React-/TypeScript-Stilreferenzen fuer Shell und Komponenten bleiben [surajmandalcell/darwin-ui](https://github.com/surajmandalcell/darwin-ui), [andrejilderda/desktop-ui](https://github.com/andrejilderda/desktop-ui) und [kitlib/tauri-app-template](https://github.com/kitlib/tauri-app-template).
- Diese Stilreferenzen duerfen Window-Chrome, Sidebar-Rhythmus, Control-Sprache, Secondary-Surfaces, Action-Naming und Tauri-App-Shell-Ideen liefern, aber nicht den aktiven Produktpfad in ein generisches Web-OS, eine IDE, einen File Manager oder eine VPN-App verwandeln.

## Aktive Oberflaechen

### Overlay

Das Overlay ist ein Statusinstrument. Es zeigt:

- bereit
- aufnehmend
- pausiert
- verarbeitend
- Fehler oder Recovery-Bedarf

Es darf keine eigenen Schaetzungen ueber Audio oder Sessionzustand erfinden. Waveform, Mute und Aufnahmezustand kommen aus nativen Events.
Spaete Runtime-Ergebnisse, die nicht mehr zur aktiven `processing`-Session gehoeren, duerfen im Overlay keinen neuen Erfolgs- oder Fehlerzustand erzeugen; die UI folgt nur dem guardierten nativen Sessionstatus.

Die naechste geplante Overlay-Ausbaustufe ist ein Live-Preview-/Controlled-Commit-Pfad mit `raw transcript`, bereinigtem Text, aktivem Arbeitsmodus und schnellen Aktionen fuer `insert`, `retry`, `scratchpad` und `restore`. Solange dieser Pfad nicht real gebaut ist, darf die UI ihn nicht andeuten oder simulieren.

### Settings

Die Settings sind die eigentliche Produktoberflaeche. Sie fuehren durch:

- Provider & Models
- Input
- Text Rules
- About
- Diagnostics

Jeder Tab braucht einen klaren owning purpose. Globale Banner oder doppelte Erklaerflaechen ueber mehrere Tabs hinweg sind zu vermeiden.

Die naechste geplante Vertiefung dieser Shell ist, Profile als sichtbare Arbeitsmodi mit spaeteren Defaults fuer Rewrite, Insert und Recovery zu fuehren. Solange das nicht aktiv ist, bleibt die echte Profilrealitaet bei lokalem Context, Dictionary und Snippets.

### Diagnostics

Diagnostics ist eine technische Flaeche innerhalb der Settings-Shell. Sie darf direkter und roher sein, muss aber dieselben Zustandsbegriffe verwenden wie der Rest der App.
Durable History und fluechtige Runtime-Logs muessen dort sichtbar getrennt sein, auch wenn beide aus demselben nativen Pfad gelesen werden. History braucht dort echte Filter-, Export- und Policy-Oberflaechen statt statischer Log-Karten.
Recovery-Scratchpad aus Input, diagnostische Preview-Transkripte und durable History duerfen sprachlich und visuell nicht mehr ineinanderlaufen.

## Layout-Regeln

- Overlay-Fenster: `236x44` logisch, pill-foermig, keine sichtbare Aussenflaeche
- Settings-Fenster: `880x620`, Mindestgroesse `760x560`
- Sidebar + Main-Panel statt frei schwebender Card-Landschaft
- kompakter Header mit Status, keine Marketing-Hero-Sektion

## Typografie

Die aktiven Font-Tokens in `src/styles/globals.css` sind:

- `--font-display`: Aptos Display, SF Pro Display, Segoe UI Variable Display, Noto Sans
- `--font`: Aptos, SF Pro Text, Segoe UI Variable, Noto Sans
- `--font-mono`: IBM Plex Mono, Cascadia Code, SF Mono, Consolas

Regeln:

- Display-Schrift nur fuer starke Oberflaechenmomente wie Titel und markante Statuslabels
- Body-Schrift fuer Formulare, Copy und Hilfetexte
- Monospace nur fuer Logs, Pfade und technisches Debugging

## Farb- und Statussprache

- dunkle Shell als Grundflaeche
- warmer Akzent fuer aktive Call-to-Actions und Hervorhebungen
- Gruen nur fuer echten positiven Status, nicht als generische Primaerfarbe
- Rot fuer Fehler und blockierende Probleme
- kuehlere Toene fuer laufende Verarbeitung und technische Zustandsfelder

Neue Farben sollen ueber bestehende CSS-Variablen und bestehende Oberflaechenmuster eingefuehrt werden, nicht ueber isolierte Ad-hoc-Hexwerte.

## Overlay-Regeln

- linke Mic-Aktion fuer Mute
- zentrale Waveform ohne erklaerenden Hilfetext im Normalfall
- rechte Timerzone fuer Zeit und Kontextaktion
- Fehlerhinweise so knapp wie moeglich, aber handlungsorientiert
- keine Sweep-, Glow- oder Blur-Layer ausserhalb der sichtbaren Pill

## Settings-Regeln

- dekorationslose Chrome mit klarer Drag-Region
- Sidebar fuer Orientierung, Main-Panel fuer Inhalt
- Section-Blurb nur dort, wo er echte Entscheidungsunterstuetzung liefert
- Formkarten muessen die Runtime-Wahrheit abbilden, nicht Platzhalter simulieren
- Save-Bar bleibt ruhig und funktional
- About-/Trust-Flaechen muessen Plattformvoraussetzungen und ehrliche Grenzen sichtbar getrennt zeigen, nicht in einen neutralen Absatz verstecken
- Release-Aufbauflaechen im About-Tab sind erlaubt, wenn sie klar `in progress` markieren und keine live Downloads oder funktionierende In-App-Updates vortaeuschen
- Provider & Models muss Groq-Authentifizierung sichtbar von Local-Preview-Helper-Voraussetzungen trennen; API-Key-UI darf fuer lokale Preview nicht erscheinen

## Text Rules UX

Die Text-Rules-Flaeche muss die reale Laufzeitsemantik exakt spiegeln:

- lokale Textprofile kapseln `Transcription Context`, Dictionary und Snippets als konkreten Arbeitsmodus
- `Transcription Context` bleibt innerhalb des aktiven Profils STT-Hilfe und keine semantische Regelmaschine
- Dictionary und Snippets arbeiten literal und case-insensitive
- Dictionary laeuft vor Snippets
- Preview und Validation muessen gegen denselben nativen Analysepfad laufen
- die Settings-Sidebar muss den aktiven Profilzustand global sichtbar machen; schneller Wechsel lebt dort, tiefes Profil-Editing bleibt in Text Rules
- Text Rules soll als gefuehrter Ablauf organisiert sein: zuerst eine kompakte Setup-Zone fuer Profilbearbeitung und sekundare Starter-Hilfe; danach sitzt die Schritt-Navigation oben ueber der aktiven Arbeitsflaeche; darunter bleibt immer genau eine dominante Bearbeitungsstufe statt mehrerer gleichgewichtiger Hauptflaechen
- oberhalb der Setup-Zone darf nur eine knappe Prozesszusammenfassung stehen; Import/Export und Diagnose-Hilfen bleiben Utility-Ebene und duerfen die aktive Bearbeitungsstufe nicht optisch ueberholen
- die Schritt-Navigation darf im Scroll-Kontext praesent bleiben, solange sie nicht mobilen oder kleinen Settings-Fenstern den Arbeitsraum nimmt
- kuratierte Starter-Templates duerfen nur lokale Create-/Merge-Baselines fuer konkrete ICP-Arbeitsmodi sein, keine versteckte Profil-Automation oder Assistant-Persona
- Profilwechsel muss sichtbar denselben aktiven Regelbestand fuer Preview, Import/Export und Runtime umschalten
- Diagnostics-Hinweise sollen auf konkrete Regelkarten zurueckfuehren

## Credential- und Privacy-UI

- Groq bleibt BYOK
- die aktive UI bleibt cloud-first, zeigt aber die `local_preview`-Lane als STT-only Preview mit externem Helper explizit daneben
- UI-Copy sagt `Save locally` und `OS secret store`, nicht implizit Cloud-Speicherung
- der volle API-Key wird nach dem Speichern nicht zurueck in den Renderer geholt
- Key-Praesenz ist neutral; gruene Signale gibt es erst nach echter Validierung
- lokale Preview zeigt Runner-/Model-Status statt Auth-Sprache und muss die noetigen Env-Variablen erklaeren

## Motion und Plattformgrenzen

Unter Linux/WebKitGTK gelten strengere Regeln als in generischen Web-UIs:

- keine Blur- oder Backdrop-Abhaengigkeit fuer den Produktkern
- keine Animation, die auf unsicheren transparenten Aussenflaechen beruht
- Overlay-Animationen muessen innerhalb der Pill bleiben
- schwarze Fensterflaechen ausserhalb der Shell gelten als Defekt

## Was das Design System bewusst nicht ist

Es ist nicht:

- eine Marketing-CI-Datei
- eine Sammlung spekulativer V2-Mockups
- ein separater Komponenten-Katalog ohne Produktkontext

Wenn eine visuelle Entscheidung den aktiven Produktpfad nicht verbessert oder klaert, gehoert sie hier nicht hinein.