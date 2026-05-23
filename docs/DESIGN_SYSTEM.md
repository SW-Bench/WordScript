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

Die naechste geplante Vertiefung dieser Shell ist, Profile als sichtbare Arbeitsmodi mit spaeteren Defaults fuer Rewrite, Insert und Recovery zu fuehren. Solange das nicht aktiv ist, bleibt die echte Profilrealitaet bei lokalem Context, optionalen STT-Hints, Dictionary und Snippets.
Provider & Models muss Provider-Faehigkeiten, STT-only-Grenzen und Recovery-Aktionen aus dem nativen Provider-Status anzeigen. Der Tab darf nicht aus Modellnamen raten, ob Cleanup, Prompt-Bias, Segments oder Local-Setup verfuegbar sind.
Fuer `local_preview` muessen Runner-, Modell- und Combined-Setup-Probleme ueber den nativen `local_setup`-Vertrag sichtbar werden. Labels wie `Runner path invalid`, `Runner probe failed` oder `Model not found` sind Produkttext, keine UI-Erfindungen.
Der lokale Profilpicker muss auf nativen Provider-Profilen basieren. Wenn ein Nutzer ein anderes lokales Profil waehlt, muss dieselbe Selektion sofort die angezeigte Readiness, Warnungen, Modellauflosung und Fast-vs-Quality-Semantik steuern.
Wenn `local_preview` Prompt-Bias meldet, muss der Tab das als echte Runtime-Faehigkeit zeigen: der aktive Text-Profile-Context geht lokal als initialer `whisper-cli`-Prompt hinein, und die Regler fuer `off`, `profile`, `profile + terms` sowie `carry initial prompt` muessen sichtbar als echte Config-Zustaende auftreten.
Diese lokalen Prompt-Regler muessen profilgebunden arbeiten wie die Decode-Regler. Wechselt der Nutzer das lokale Profil, muss dieselbe Auswahl die fuer dieses Profil gespeicherte Bias-Staerke und Carry-Entscheidung laden statt einen globalen Restwert zu spiegeln.
Der lokale Mode-Label darf nicht generisch `local` bleiben, wenn das native Profil bereits `fast` oder `quality` liefert. Die Shell muss dieselbe Preset-Semantik auch fuer lokale Modelle spiegeln und darf den ausgewaehlten Profilmodus nicht aus dem Modellnamen neu ableiten.
Diagnostics braucht fuer `local_preview` eine sichtbare Local-STT-Kontraktflaeche, die Provider-Profil, Prompt-Bias-Staerke, Carry-Flag, Beam Size und Best Of zusammen zeigt. Diese Werte duerfen nicht nur im Provider-Tab existieren.
Diese Diagnostics-Flaeche muss jetzt ausserdem echte Live-Setup-Wahrheit zeigen: Provider-Readiness, aufgeloester Runnerpfad, aufgeloester Modellpfad und aktueller nativer Capture-State gehoeren in denselben Snapshot statt in getrennte UI-Heuristiken.
Transcription-History-Karten muessen dieselben Local-Metadaten in der Karten-Chip-Reihe zeigen, damit ein lokaler Run nicht nur als `local_preview` plus Modell sichtbar bleibt, sondern als vollstaendiger Decode- und Prompt-Zustand gelesen werden kann.
Wenn das Settings-Fenster unsaved lokale Aenderungen traegt, muss Diagnostics die Abweichung zwischen Draft und nativer Runtime explizit als Warning zeigen. Ein einzelner Kartenblock fuer den Fensterzustand reicht nicht mehr.
Der Provider-Tab muss lokale Decode-Regler profilgebunden behandeln. Wechselt der Nutzer zwischen `...-fast` und `...-quality`, muessen die fuer dieses Profil gespeicherten Decoderwerte erscheinen statt eines zuletzt global geaenderten lokalen Werts.

### Diagnostics

Diagnostics ist eine technische Flaeche innerhalb der Settings-Shell. Sie darf direkter und roher sein, muss aber dieselben Zustandsbegriffe verwenden wie der Rest der App.
Durable History und fluechtige Runtime-Logs muessen dort sichtbar getrennt sein, auch wenn beide aus demselben nativen Pfad gelesen werden. History braucht dort echte Filter-, Export- und Policy-Oberflaechen statt statischer Log-Karten.
Recovery-Scratchpad aus Input, diagnostische Preview-Transkripte und durable History duerfen sprachlich und visuell nicht mehr ineinanderlaufen.
Recovery-Copy soll die native Recovery-Aktion und den Clipboard-Restore-Status erklaeren. Freitext-Fehler wie `fallback_reason` duerfen Details liefern, aber nicht die primaere Nutzerfuehrung ersetzen.
History-Karten in Diagnostics sollen dieselbe Recovery-Semantik als Chips und Copy zeigen, damit Retry-, Export- und Recovery-Pfade ueber denselben Wortschatz erklaert werden.
Pipeline-Karten in Diagnostics sollen pro Schritt denselben nativen Wortschatz zeigen: `capture`, `provider`, `transform`, `insert` plus klarer `state`, sichtbare `duration_ms` und ein stabiler `error_code`, falls ein Schritt scheitert.

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

- lokale Textprofile kapseln `Transcription Context`, optionale `STT hints`, Dictionary und Snippets als konkreten Arbeitsmodus
- `Transcription Context` bleibt innerhalb des aktiven Profils primaer STT-Hilfe; wenn AI cleanup laeuft, darf derselbe Context nur als konservativer Preserve-Hinweis fuer Termini und Sprachmix dienen, nie als semantische Regelmaschine
- `STT hints` sind ein eigenes explizites Feld fuer wenige kurze gesprochene Cues oder Alternativphrasen, die wirklich in den STT-Bias sollen; Snippet-Trigger duerfen nicht stillschweigend denselben Zweck uebernehmen
- Dictionary und Snippets arbeiten literal und case-insensitive
- Dictionary laeuft vor Snippets
- Preview und Validation muessen gegen denselben nativen Analysepfad laufen
- UI-Copy fuer AI cleanup muss klar machen, dass gemischte Sprache, Umgangssprache und Produktterme eher geschuetzt als umgeschrieben werden; die Flaeche darf keine semantische Fuzzy-Automation versprechen
- die Settings-Sidebar muss den aktiven Profilzustand global sichtbar machen; schneller Wechsel lebt dort, tiefes Profil-Editing bleibt in Text Rules
- Text Rules soll als gefuehrter Ablauf organisiert sein: zuerst eine kompakte Setup-Zone fuer Profilbearbeitung und sekundare Hilfe fuer kuratierte Profile; danach sitzt die Schritt-Navigation oben ueber der aktiven Arbeitsflaeche; darunter bleibt immer genau eine dominante Bearbeitungsstufe statt mehrerer gleichgewichtiger Hauptflaechen
- oberhalb der Setup-Zone darf nur eine knappe Prozesszusammenfassung stehen; Import/Export und Diagnose-Hilfen bleiben Utility-Ebene und duerfen die aktive Bearbeitungsstufe nicht optisch ueberholen
- die Schritt-Navigation darf im Scroll-Kontext praesent bleiben, solange sie nicht mobilen oder kleinen Settings-Fenstern den Arbeitsraum nimmt
- kuratierte Profile muessen als normale persistierte User-Profile erscheinen, nur mit sichtbarem `Curated`-Status bis zur ersten echten Bearbeitung; sie duerfen keine versteckte zweite Ownership-Flaeche oder Assistant-Persona erzeugen
- Profilwechsel muss sichtbar denselben aktiven Regelbestand fuer Preview, Import/Export und Runtime umschalten
- Diagnostics-Hinweise sollen auf konkrete Regelkarten zurueckfuehren

## Credential- und Privacy-UI

- Groq bleibt BYOK
- die aktive UI bleibt cloud-first, zeigt aber die `local_preview`-Lane als STT-only Local Lane mit externem Helper, nativer Modell-Discovery und ehrlicher Runner-Gesundheit explizit daneben
- UI-Copy sagt `Save locally` und `OS secret store`, nicht implizit Cloud-Speicherung
- der volle API-Key wird nach dem Speichern nicht zurueck in den Renderer geholt
- Key-Praesenz ist neutral; gruene Signale gibt es erst nach echter Validierung
- lokale Preview zeigt Runner-/Model-Status statt Auth-Sprache, muss die noetigen Env-Variablen erklaeren und darf Runner-Gesundheit nicht aus blossen Pfaden oder Dateiexistenz ableiten

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