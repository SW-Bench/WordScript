# WordScript — Design System

Stand: 2026-05-12

## Zweck

Das Design System beschreibt die aktive Produktsprache von WordScript. Es ist keine Wunschliste, sondern die Regelbasis fuer Overlay, Settings und Diagnostics im aktuellen App-Pfad.

## Produktprinzipien

- utility-first statt dashboard-first
- klarer Runtime-Zustand statt dekorativer Bewegung
- kleine Flaechen mit hoher Lesbarkeit
- Fehler und Recovery muessen fuehren, nicht nur anzeigen
- Plattformgrenzen duerfen nicht von der UI versteckt werden

## Aktive Oberflaechen

### Overlay

Das Overlay ist ein Statusinstrument. Es zeigt:

- bereit
- aufnehmend
- pausiert
- verarbeitend
- Fehler oder Recovery-Bedarf

Es darf keine eigenen Schaetzungen ueber Audio oder Sessionzustand erfinden. Waveform, Mute und Aufnahmezustand kommen aus nativen Events.

### Settings

Die Settings sind die eigentliche Produktoberflaeche. Sie fuehren durch:

- Provider & Models
- Input
- Text Rules
- About
- Diagnostics

Jeder Tab braucht einen klaren owning purpose. Globale Banner oder doppelte Erklaerflaechen ueber mehrere Tabs hinweg sind zu vermeiden.

### Diagnostics

Diagnostics ist eine technische Flaeche innerhalb der Settings-Shell. Sie darf direkter und roher sein, muss aber dieselben Zustandsbegriffe verwenden wie der Rest der App.

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

## Text Rules UX

Die Text-Rules-Flaeche muss die reale Laufzeitsemantik exakt spiegeln:

- `Transcription Context` ist STT-Hilfe und keine semantische Regelmaschine
- Dictionary und Snippets arbeiten literal und case-insensitive
- Dictionary laeuft vor Snippets
- Preview und Validation muessen gegen denselben nativen Analysepfad laufen
- Diagnostics-Hinweise sollen auf konkrete Regelkarten zurueckfuehren

## Credential- und Privacy-UI

- Groq bleibt BYOK
- UI-Copy sagt `Save locally` und `OS secret store`, nicht implizit Cloud-Speicherung
- der volle API-Key wird nach dem Speichern nicht zurueck in den Renderer geholt
- Key-Praesenz ist neutral; gruene Signale gibt es erst nach echter Validierung

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