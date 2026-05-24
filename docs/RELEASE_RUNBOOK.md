# WordScript — Release Runbook

Stand: 2026-05-24

## Zweck

Dieses Dokument beschreibt den aktuellen Release-Aufbaupfad fuer WordScript. Es ist bewusst kein Versprechen, dass bereits ein oeffentlicher Installer- oder Update-Kanal live ist.

## Aktuelle Wahrheit

- die heute benutzbare Version ist die Dev-Version aus dem Repo via `npm run tauri dev`
- der manuelle Build-Up-Workflow liegt in `.github/workflows/release.yml` und heisst `Release Build-Up Matrix`
- er baut aktuell plattformweise Bundle-Artefakte fuer Linux, macOS und Windows
- er aggregiert diese Bundle-Artefakte jetzt zusaetzlich in checksummierte Handoff-Archive fuer Maintainer-Review
- optional kann derselbe Workflow einen internen Draft-Release auf GitHub erzeugen oder aktualisieren
- der Workflow ist Teil der Arbeit am ersten offiziellen Cross-Platform-App-Release
- der Workflow bleibt trotzdem ein interner Maintainer-Pfad; die aktuelle oeffentliche Launch-Reife ist weiter durch profilabhaengige Transkriptionsprobleme und unvollstaendiges guided local setup blockiert
- vor dem Bundling laufen jetzt Frontend-Tests, Rust-Tests und der Frontend-Build als feste Gates
- die About-Flaeche und `check_app_update` muessen deshalb weiterhin ehrlich `no published releases yet` bzw. `in progress` signalisieren; GitHubs `releases/latest` bildet nur publizierte Releases ab, nicht interne Drafts
- Signierung und In-Place-Updater gelten weiterhin als Aufbauarbeit, nicht als fertiger Nutzerpfad
- Linux-AppImage-Packaging ist aktuell noch ein fragiler Build-Up-Pfad; `linuxdeploy`-Fehler sind im Moment offenes Packaging-Feedback, nicht eine gebrochene veroeffentlichte Release-Linie

## Vor jedem Release-Track-Build

1. `npm test`, `npm run build` und `cargo test --manifest-path src-tauri/Cargo.toml` muessen gruen sein.
2. Fuer jeden oeffentlichen Release-Kandidaten muss die Transkriptionsbasis ausserhalb von `General Writing` belastbar sein; solange aktive Profile wie `Customer Success Replies` noch mehrsprachige Fragmente, Fantasietokens oder Topic-Drift in Rohtranskripte ziehen, bleibt der Lauf rein intern.
3. Die Version in `package.json` und `src-tauri/tauri.conf.json` muss dem geplanten Build-Stand entsprechen.
4. README, REFERENCE, CHANGELOG und About-Copy duerfen keine Verfuegbarkeit behaupten, die es noch nicht gibt.
5. Wenn ein Draft-Release erzeugt werden soll, muss klar sein, welches Tag den internen Handoff bezeichnet; standardmaessig nutzt der Workflow `v<package.json version>`.

## Manueller Build-Matrix-Lauf

1. GitHub Actions oeffnen.
2. `Release Build-Up Matrix` auswaehlen.
3. Den gewuenschten `ref` setzen, standardmaessig `main`.
4. Optional `create_draft_release` aktivieren, wenn derselbe Lauf die Handoff-Archive in einen internen Draft-Release legen soll.
5. Optional `release_tag` oder `release_title` ueberschreiben; ohne Override wird `v<package.json version>` plus ein Standardtitel verwendet.
6. Workflow starten.
7. Nach Abschluss zuerst das aggregierte Artifact `wordscript-release-handoff` pruefen; dort liegen die checksummierten Archivdateien, `SHA256SUMS.txt` und `release-build-metadata.md`.
8. Falls `create_draft_release` aktiv war, den GitHub-Draft auf korrekten Tag, Titel, Notes und Asset-Liste pruefen.

## Was der Workflow jetzt erzeugt

- pro Plattform weiterhin den nativen Tauri-Bundle-Ordner als Workflow-Artefakt
- zusaetzlich ein aggregiertes Maintainer-Handoff mit `tar.gz`-Archiven pro Plattform-Artefakt
- `SHA256SUMS.txt` fuer diese Archive
- `release-build-metadata.md` mit Ref, Version, Tag, Workflow-Run und explizitem Hinweis, dass dies kein publizierter Nutzerkanal ist
- optional einen internen Draft-Release, der dieselben Archive und Checksummen traegt

## Was nach dem Lauf geprueft wird

- Linux: wenn die Packaging-Lane durchlaeuft, Bundle-Struktur fuer AppImage/DEB vorhanden; ein `linuxdeploy`-Fehler bleibt bis auf Weiteres ein bekannter Build-Up-Befund
- macOS: DMG/Bundle-Artefakte vorhanden
- Windows: Installer-/Bundle-Artefakte vorhanden
- Handoff: `SHA256SUMS.txt` passt zu den aggregierten Archivdateien und `release-build-metadata.md` benennt denselben Ref-/Version-/Tag-Stand
- Draft-Release: falls aktiviert, ist der Release weiterhin `draft`, traegt dieselben Assets und bleibt bewusst ausserhalb des oeffentlichen Installer- und Updater-Pfads
- keine About-/Doku-Copy suggeriert bereits live funktionierende Downloads oder Updates

## Vor dem ersten oeffentlichen Release noch offen

- Transkriptionszuverlaessigkeit fuer `General Writing` und aktive Profile auf eine belastbare Alltagsbasis bringen; profilgefuehrte STT-Hinweise duerfen Rohtranskripte nicht schlechter machen als kein Profil
- den gefuehrten Local-Setup-Pfad soweit schliessen, dass Nutzer nicht mehr den Grossteil von Runner-, Modell- und Cleanup-Konfiguration manuell zusammensuchen muessen
- Signierung pro Plattform verbindlich schliessen
- Release-Notes-, Tagging- und Promotion-Prozess vom internen Draft zum ersten publizierten Release festziehen
- In-Place-Updater-Semantik und Vertrauenspfad definieren
- Linux-Packaging ohne `linuxdeploy`-Abbruch stabil durchziehen
- final entscheiden, wann `release.yml` ueber interne Draft-Handoffs hinaus wirklich veroeffentlichen darf

Bis diese Punkte geschlossen sind, bleibt der Release-Pfad ein interner Aufbaupfad.