# WordScript — Design System

Stand: 2026-06-10

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
- Die aktuelle UI-Hauptbaustelle sind vor allem die Settings-Tabs und ihre Fuehrung. Das Overlay ist derzeit nicht die primaere Design-Baustelle und soll ohne neue Runtime-Anforderung nicht noch einmal breit umgestaltet werden.
- Das Zielbild fuer Settings und Overlay ist eine kleine, fokussierte Utility-App mit klarer Sidebar/Main-Struktur, wenigen visuellen Ebenen und knapper, weicher Motion.
- macOS bleibt eine Referenz fuer Produktpolish, ist aber keine Einladung fuer generische OS-Mockups, fake Traffic-Lights oder andere plattformfremde Desktop-Parodien in WordScript.
- Die bestehende Settings-Shell ist die Hauptbasis fuer den aktuellen Utility-Pass und muss vor weiterem Scope-Ausbau in Informationsarchitektur, Spacing, Zustandsklarheit und wahrgenommener Smoothness bewusst ruhig gehalten werden.
- Der aktive UI-Pass fuehrt diese Richtung jetzt ueber eine gruppierte Utility-Sidebar, native Fensterkontrollen im Host, einen kompakten Tab-Header und genau eine dominante Content-Surface pro Tab fort.

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
- nach erfolgreichem Lauf kompakte In-Pill-Action-Buttons statt einer zweiten vergroesserten Preview-Flaeche
- fuer `clipboard_only`-Profile im Processing-Zustand denselben festen In-Pill-Commit-Stop vor dem Commit
- im Idle keine sichtbare Restflaeche ausserhalb der Pill; der Host muss das Overlay dafuer nativ aus dem sichtbaren Bereich parken statt nur CSS-Unsichtbarkeit vorzutaeuschen
- Overlay-Placement bleibt Teil derselben Utility-Sprache: Drag verschiebt dieselbe feste Surface, nicht eine zweite Host-Schicht, und darf als gemerkte Manual-Position oder als Preset-Anchor pro Display auftreten

Es darf keine eigenen Schaetzungen ueber Audio oder Sessionzustand erfinden. Waveform, Mute und Aufnahmezustand kommen aus nativen Events.
Spaete Runtime-Ergebnisse, die nicht mehr zur aktiven `processing`-Session gehoeren, duerfen im Overlay keinen neuen Erfolgs- oder Fehlerzustand erzeugen; die UI folgt nur dem guardierten nativen Sessionstatus.

Die aktuelle Overlay-Ausbaustufe besteht aus zwei echten Runtime-Zustaenden innerhalb derselben Pill und einer kompakten Host-Buehne ohne separaten Backdrop-Layer: einem Action-Zustand nach erfolgreichem Lauf und einem Processing-Commit-Stop fuer `clipboard_only`-Profile vor dem Commit. Beide duerfen nur echte Runtime-Daten und echte Native-Aktionen zeigen. Die Live-Buehne bleibt klein; Preview- und Result-States duerfen nur so weit horizontal wachsen, dass alle Action-Labels lesbar bleiben. Im Action-Zustand gehoert keine passive Mic-Zone mehr in die Flaeche; der gesamte Nutzraum ist fuer produktive Folgeaktionen reserviert. Die naechste geplante Ausbaustufe bleibt trotzdem ein vollstaendiger Live-Preview-/Controlled-Commit-Pfad mit tieferem Textkontext und spaeter auch `scratchpad` fuer weitere Delivery-Modi. Solange dieser Pfad nicht real gebaut ist, darf die UI ihn nicht andeuten oder simulieren.

### Settings

Die Settings sind die eigentliche Produktoberflaeche. Sie fuehren durch:

- Provider & Models
- Input
- Modes
- Text Rules
- About
- Diagnostics

Jeder Tab braucht einen klaren owning purpose. Globale Banner oder doppelte Erklaerflaechen ueber mehrere Tabs hinweg sind zu vermeiden.

Die aktive Shell nutzt jetzt eine klare Utility-Orientierung: gruppierte Sidebar links fuer Navigation und Profilstatus, ein kompakter Tab-Header mit Runtime- und Save-Zustand oben und darunter genau eine dominante Content-Surface. Diese Flaechen sind erlaubt, solange sie nur den aktiven Tab erklaeren und keine zweite App in der App erzeugen.

Fuer scrollende Utility-Flaechen gilt zusaetzlich: lange Kartenlisten muessen ruhig bleiben. Wiederholte Diagnostics- oder Text-Rules-Karten duerfen nicht ueber per-render Deep-Clones oder unnötige Parent-Renders permanent neu aufgebaut werden.

Profile sind jetzt sichtbare manuelle Arbeitsmodi mit Defaults fuer Processing-Modus, Insert und Recovery. Die Shell darf diese Werte anzeigen und zwischen Profilen umschalten, muss aber weiterhin aus dem aktiven Profilvertrag lesen; automatische App-/Kontextaktivierung und Overlay-Commit-Entscheidungen duerfen nicht vorweggenommen werden.
Solange profilabhaengige Transkription ausserhalb von `General Writing` noch unzuverlaessig ist, darf die UI diese Profile nicht wie fertige Produktmodi inszenieren. Die Shell muss Fuehrung und Erwartungsmanagement leisten, nicht falsche Sicherheit.
Modes ist der dedizierte Tab fuer den `ProcessingMode`-Vertrag. Er zeigt den aktiven Modus als Radio-Group, den Sub-Mode (`enhance` / `expand`, nur sichtbar bei `prompt_enhance`), den `PromptTarget` (system / developer / user), den `auto_detect_mode`-Schalter und die `workspace_app_map`. Die sieben per-Mode-Hotkeys (`mode_picker_hotkey`, `mode_cycle_hotkey`, `mode_verbatim_hotkey`, `mode_cleanup_hotkey`, `mode_rewrite_hotkey`, `mode_agent_hotkey`, `mode_prompt_enhance_hotkey`) liegen im selben Tab mit plattformspezifischen Defaults; die Shell darf sie als Hotkey-Chips mit Reset-Button anzeigen, muss aber die effektive Mode selbst aus `resolve_current_processing_mode` lesen und nicht aus dem letzten UI-Klick.
Provider & Models muss Provider-Faehigkeiten, lokale Runtime-Grenzen und Recovery-Aktionen aus dem nativen Provider-Status anzeigen. Der Tab darf nicht aus Modellnamen raten, ob Cleanup, Prompt-Bias, Segments oder Local-Setup verfuegbar sind.
Fuer `local_preview` muessen Runner-, Modell-, Cleanup-Endpoint- und Cleanup-Modell-Probleme ueber den nativen `local_setup`-Vertrag sichtbar werden. Labels wie `Runner path invalid`, `Runner probe failed`, `Cleanup backend unavailable` oder `Cleanup model not found` sind Produkttext, keine UI-Erfindungen.
Provider & Models soll diesen Vertrag als kompakte Preflight-Checkliste zeigen: vier Schritte fuer Speech Runner, STT-Modell, Cleanup-Endpoint und Cleanup-Modell, jeweils mit Status, konkretem aufgeloestem Wert oder naechster lokaler Voraussetzung.
Der lokale Profilpicker muss auf nativen Provider-Profilen basieren. Wenn ein Nutzer ein anderes lokales Profil waehlt, muss dieselbe Selektion sofort die angezeigte Readiness, Warnungen, Modellauflosung und Fast-vs-Quality-Semantik steuern.
Wenn `local_preview` Prompt-Bias meldet, muss der Tab das als echte Runtime-Faehigkeit zeigen: der aktive Text-Profile-Context geht lokal als initialer `whisper-cli`-Prompt hinein, und die Regler fuer `off`, `profile`, `profile + terms` sowie `carry initial prompt` muessen sichtbar als echte Config-Zustaende auftreten.
Diese lokalen Prompt-Regler muessen profilgebunden arbeiten wie die Decode-Regler. Wechselt der Nutzer das lokale Profil, muss dieselbe Auswahl die fuer dieses Profil gespeicherte Bias-Staerke und Carry-Entscheidung laden statt einen globalen Restwert zu spiegeln.
Der lokale Mode-Label darf nicht generisch `local` bleiben, wenn das native Profil bereits `fast` oder `quality` liefert. Die Shell muss dieselbe Preset-Semantik auch fuer lokale Modelle spiegeln und darf den ausgewaehlten Profilmodus nicht aus dem Modellnamen neu ableiten.
Diagnostics braucht fuer `local_preview` eine sichtbare Local-Runtime-Kontraktflaeche, die Provider-Profil, Prompt-Bias-Staerke, Carry-Flag, Beam Size, Best Of, Cleanup-Endpoint und Cleanup-Modell zusammen zeigt. Diese Werte duerfen nicht nur im Provider-Tab existieren.
Diese Diagnostics-Flaeche muss jetzt ausserdem echte Live-Setup-Wahrheit zeigen: Provider-Readiness, aufgeloester Runnerpfad, aufgeloester Modellpfad, aufgeloester Cleanup-Endpoint, aufgeloestes Cleanup-Modell und aktueller nativer Capture-State gehoeren in denselben Snapshot statt in getrennte UI-Heuristiken.
Transcription-History-Karten muessen dieselben Local-Metadaten in der Karten-Chip-Reihe zeigen, damit ein lokaler Run nicht nur als `local_preview` plus Modell sichtbar bleibt, sondern als vollstaendiger Decode-, Prompt- und Cleanup-Zustand gelesen werden kann.
Wenn das Settings-Fenster unsaved lokale Aenderungen traegt, darf die Shell das bereits in ihrer Window-State-Flaeche markieren, aber Diagnostics muss die Abweichung zwischen Draft und nativer Runtime weiterhin explizit als Warning zeigen.
Der Provider-Tab muss lokale Decode-Regler profilgebunden behandeln. Wechselt der Nutzer zwischen `...-fast` und `...-quality`, muessen die fuer dieses Profil gespeicherten Decoderwerte erscheinen statt eines zuletzt global geaenderten lokalen Werts.

### Diagnostics

Diagnostics ist eine technische Flaeche innerhalb der Settings-Shell. Sie darf direkter und roher sein, muss aber dieselben Zustandsbegriffe verwenden wie der Rest der App.
Durable History und fluechtige Runtime-Logs muessen dort sichtbar getrennt sein, auch wenn beide aus demselben nativen Pfad gelesen werden. History braucht dort echte Filter-, Export- und Policy-Oberflaechen statt statischer Log-Karten.
Recovery-Scratchpad aus Input, diagnostische Preview-Transkripte und durable History duerfen sprachlich und visuell nicht mehr ineinanderlaufen.
Recovery-Copy soll die native Recovery-Aktion und den Clipboard-Restore-Status erklaeren. Freitext-Fehler wie `fallback_reason` duerfen Details liefern, aber nicht die primaere Nutzerfuehrung ersetzen.
History-Karten in Diagnostics sollen dieselbe Recovery-Semantik als Chips und Copy zeigen, damit Retry-, Export- und Recovery-Pfade ueber denselben Wortschatz erklaert werden.
Pipeline-Karten in Diagnostics sollen pro Schritt denselben nativen Wortschatz zeigen: `capture`, `provider`, `transform`, `insert` plus klarer `state`, sichtbare `duration_ms` und ein stabiler `error_code`, falls ein Schritt scheitert.
Provider-Labels in Diagnostics und Preview muessen aus dem nativen `provider_profile`-Vertrag kommen; Modellnamen-Heuristiken oder Fenster-Draft-Ableitungen sind fuer Cloud- wie Local-Runs ein UI-Fehler.
Wenn Diagnostics als eigenes Fenster geoeffnet wird, bleibt dieselbe native Fensterdekoration aktiv wie im Settings-Fenster. Auch dieses Pop-out ist eine Utility-Flaeche und darf keine zweite Custom-Chrome-Sprache einfuehren.
Die eigentliche Diagnostics Preview bleibt eine zusammenhaengende Vorschau: aktueller Transkriptzustand, Insert-Plan und Preview-Editor gehoeren sichtbar zusammen statt als voneinander geloeste Einzelkarten.
Diagnostische History- und Hint-Listen sollen als isolierte, stabile Teilbaeume implementiert werden. UI-Polish auf diesen Flaechen darf keine sekundaeren Blink- oder Rebuild-Muster beim Scrollen einfuehren.

## Layout-Regeln

- Overlay-Fenster: kompakte `256x52` Host-Buehne fuer Live-Aufnahme mit `248x44` Pill; Preview- und Result-States duerfen innerhalb desselben Host-Pfads auf breitere Frames wachsen, damit `Copy`, `Retry`, `Restore`, `Abort` und `Done` voll lesbar bleiben. Idle wird nativ ausserhalb des sichtbaren Bereichs geparkt
- Settings-Fenster: `1080x820`, Mindestgroesse `980x760`
- Diagnostics-Pop-out: `1040x780`, Mindestgroesse `900x680`
- Sidebar + Main-Panel statt frei schwebender Card-Landschaft
- kompakter Header mit Status und ein einziges Hauptpanel statt Hero-/Rail-Verschachtelung

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

- linke Mic-Aktion fuer Mute nur im Aufnahme-/Processing-Zustand ohne Action-Strip
- zentrale Waveform ohne erklaerenden Hilfetext im Normalfall
- rechte Timerzone fuer Zeit und Kontextaktion
- Fehlerhinweise so knapp wie moeglich, aber handlungsorientiert
- keine Sweep-, Glow- oder Blur-Layer ausserhalb der sichtbaren Pill
- nach dem Lauf darf das Overlay seinen Inhalt innerhalb derselben festen Pill auf Action-Buttons umschalten, aber keine zweite vergroesserte Preview-Surface mit eigenem Hintergrund aufmachen
- Nachlauf-Quick-Actions bleiben knapp und produktiv: nur Aktionen mit echter nativer Bindung (`copy`, `retry`, `restore`, `done`) duerfen als Buttons erscheinen
- Processing-Preview-Aktionen bleiben ebenso knapp: fuer den ersten Pass duerfen nur echte Session-Aktionen wie Commit entlang des nativen Insert-Pfads oder expliziter Abort sichtbar sein
- die sichtbare Hostflaeche muss auf die Pill-Form geclippt sein; schwarze oder stale Restflaechen ausserhalb der Pill gelten weiterhin als Defekt
- derselbe Overlay-Pfad muss gemerkte Manual-Positionen respektieren; ein Statuswechsel von Recording zu Processing oder Action darf die vom Nutzer gezogene Position nicht wieder auf Bottom-Center zuruecksetzen
- derselbe Overlay-Pfad darf eine gemerkte Manual-Position nur aus echter Drag-Interaktion aktualisieren; Host-Repositions fuer Reveal, Hide, Surface-Wechsel oder Offscreen-Parking gelten nicht als neue Placement-Quelle
- wenn dieselbe Manual-Position auf Compact-, Preview- oder Result-Surface angewendet wird, muss dieselbe gemerkte Top-Left-Position wiederverwendet werden; ein Oberflaechenwechsel darf die Position nicht auf einen anderen internen Drag-Anker umrechnen
- Recording-, `working`- und Action-State brauchen eigene Seitenzonen-Breiten und Paddingwerte, wenn sonst der rechte Rand optisch schwerer wird als die Mic-Seite; Gleichgewicht pro Zustand ist wichtiger als ein einziger statischer Grid-Wert fuer alle Overlay-Situationen
- derselbe Overlay-Pfad muss in jedem Zustand dragbar bleiben, ohne Single-Click-Aktionen auf Buttons zu verlieren; die Drag-Geste beginnt deshalb erst nach echter Pointer-Bewegung
- die Waveform soll Sprache sichtbar aussteuern; near-idle Raumrauschen soll wieder in eine ruhige Idle-Silhouette zurueckfallen, waehrend echte Sprache klar hoeher und lebendiger aussteuern darf als im Idle-Zustand

## Settings-Regeln

- native Fensterdekorationen im Settings-Fenster; keine plattformfremden Fake-Controls im Content
- dieselbe native Dekorationsregel gilt fuer das Diagnostics-Pop-out
- Sidebar fuer Orientierung, Main-Panel fuer Inhalt
- gruppierte Sidebar-Navigation darf `Configure` und `Inspect` sichtbar trennen, solange die Reihenfolge stabil bleibt
- der kompakte Tab-Header darf genau einen Snapshot aus Runtime-Status und Save-Zustand zeigen; er ist Orientierung, nicht Marketing
- der aktuelle Polish-Pass priorisiert Provider & Models, Text Rules, About und Diagnostics als Utility-Flaechen. Overlay-only Restyling ist nachgeordnet, solange Transkriptionsvertrauen und Setup-Fuehrung noch die groesseren Produktluecken sind
- Fenster-Minima muessen gross genug bleiben, damit Sidebar, Footer und Hauptinhalte beim nativen Resize nicht visuell verschwinden oder in mobileartige Notlayouts kippen
- Section-Blurb nur dort, wo er echte Entscheidungsunterstuetzung liefert
- Formkarten muessen die Runtime-Wahrheit abbilden, nicht Platzhalter simulieren
- Save-Bar bleibt ruhig und funktional
- About-/Trust-Flaechen muessen Plattformvoraussetzungen und ehrliche Grenzen sichtbar getrennt zeigen, nicht in einen neutralen Absatz verstecken
- Release-Aufbauflaechen im About-Tab sind erlaubt, wenn sie klar `in progress` markieren und keine live Downloads oder funktionierende In-App-Updates vortaeuschen
- Release-Aufbauflaechen duerfen workflow-interne Draft-Handoffs benennen, aber Statusfelder wie `Latest published tag` muessen sich weiterhin nur auf oeffentlich sichtbare Releases beziehen
- Provider & Models muss Groq-Authentifizierung sichtbar von Local-Runtime-Voraussetzungen trennen; API-Key-UI darf fuer `local_preview` nicht erscheinen, dafuer aber eine native Preflight-Checkliste mit Runner-, Modell-, Cleanup-Endpoint- und Cleanup-Modell-Status
- Input darf den ersten Diktierpfad als kompakte Preflight-Checkliste zeigen: Trigger, Mikrofon, Insert-Pfad und Recovery. Diese Flaeche muss bestehende native Statuswerte verdichten und darf keine neue Readiness-Semantik einfuehren.

## Text Rules UX

Die Text-Rules-Flaeche muss die reale Laufzeitsemantik exakt spiegeln:

- lokale Textprofile kapseln `Transcription Context`, optionale `STT hints`, Dictionary, Snippets sowie Rewrite-, Insert- und Recovery-Defaults als konkreten Arbeitsmodus
- `Transcription Context` bleibt innerhalb des aktiven Profils primaer STT-Hilfe; wenn AI cleanup laeuft, darf derselbe Context nur als konservativer Preserve-Hinweis fuer Termini und Sprachmix dienen, nie als semantische Regelmaschine
- `STT hints` sind ein eigenes explizites Feld fuer wenige kurze gesprochene Cues oder Alternativphrasen, die wirklich in den STT-Bias sollen; Snippet-Trigger duerfen nicht stillschweigend denselben Zweck uebernehmen
- eingeschlossene Profile sollen deshalb mit konservativen Wortschatz-Baselines starten. Vorgefuellte snippetartige STT-Hinweise oder breite Kategorienlisten, die jede Diktation in einen Szenariomodus ziehen, gehoeren nicht in den Default-Zustand
- die Text-Rules-Flaeche soll diese Grenze auch sichtbar fuehren: der Context-Workspace zeigt deshalb den effektiven automatischen Bias und Warnings fuer ignorierte breite Kontext- oder Hint-Zeilen, statt Profilinhalt stillschweigend als aktive Runtime-Wahrheit zu inszenieren
- Dictionary und Snippets arbeiten literal und case-insensitive
- Dictionary laeuft vor Snippets
- Preview und Validation muessen gegen denselben nativen Analysepfad laufen
- UI-Copy fuer AI cleanup muss klar machen, dass gemischte Sprache, Umgangssprache und Produktterme eher geschuetzt als umgeschrieben werden; die Flaeche darf keine semantische Fuzzy-Automation versprechen
- die Settings-Sidebar muss den aktiven Profilzustand global sichtbar machen; schneller Wechsel lebt dort, tiefes Profil-Editing bleibt in Text Rules
- Text Rules soll als gefuehrter Ablauf organisiert sein: zuerst eine kompakte Profilbibliothek fuer aktive, eigene und eingeschlossene Profile; danach sitzt die Schritt-Navigation oben ueber der aktiven Arbeitsflaeche; darunter bleibt immer genau eine dominante Bearbeitungsstufe statt mehrerer gleichgewichtiger Hauptflaechen
- oberhalb der Setup-Zone darf nur eine knappe Prozesszusammenfassung stehen; Import/Export und Diagnose-Hilfen bleiben Utility-Ebene und duerfen die aktive Bearbeitungsstufe nicht optisch ueberholen
- die Schritt-Navigation darf im Scroll-Kontext praesent bleiben, solange sie nicht mobilen oder kleinen Settings-Fenstern den Arbeitsraum nimmt
- eingeschlossene Profile muessen als normale persistierte User-Profile erscheinen, nur mit sichtbarem `Included`-Status bis zur ersten echten Bearbeitung; sie duerfen keine versteckte zweite Ownership-Flaeche oder Assistant-Persona erzeugen
- Profilwechsel muss sichtbar denselben aktiven Regelbestand fuer Preview, Import/Export und Runtime umschalten
- Diagnostics-Hinweise sollen auf konkrete Regelkarten zurueckfuehren

## Credential- und Privacy-UI

- Groq bleibt BYOK
- die aktive UI bleibt cloud-first, zeigt aber die `local_preview`-Lane als vollwertige lokale Runtime-Lane mit externem STT-Helper, lokalem Cleanup-Modell, nativer Modell-Discovery und ehrlicher Runner-/Cleanup-Gesundheit explizit daneben
- UI-Copy sagt `Save locally` und `OS secret store`, nicht implizit Cloud-Speicherung
- der volle API-Key wird nach dem Speichern nicht zurueck in den Renderer geholt
- Key-Praesenz ist neutral; gruene Signale gibt es erst nach echter Validierung
- die lokale Runtime zeigt Runner-/Model-/Cleanup-Status statt Auth-Sprache, muss die noetigen lokalen Voraussetzungen in der Preflight-Checkliste erklaeren und darf weder Runner- noch Cleanup-Gesundheit aus blossen Pfaden oder UI-Fallbacks ableiten

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