# WordScript — Release Runbook

Stand: 2026-05-12

## Zweck

Dieses Dokument beschreibt den aktuellen Release-Aufbaupfad fuer WordScript. Es ist bewusst kein Versprechen, dass bereits ein oeffentlicher Installer- oder Update-Kanal live ist.

## Aktuelle Wahrheit

- die heute benutzbare Version ist die Dev-Version aus dem Repo via `npm run tauri dev`
- der manuelle Build-Up-Workflow liegt in `.github/workflows/release.yml` und heisst `Release Build-Up Matrix`
- er baut aktuell plattformweise Bundle-Artefakte fuer Linux, macOS und Windows
- er veroeffentlicht noch keine versionierten GitHub-Releases
- der Workflow ist Teil der Arbeit am ersten offiziellen Cross-Platform-App-Release
- vor dem Bundling laufen jetzt Frontend-Tests, Rust-Tests und der Frontend-Build als feste Gates
- die About-Flaeche und `check_app_update` muessen deshalb ehrlich `no published releases yet` bzw. `in progress` signalisieren
- Signierung und In-Place-Updater gelten weiterhin als Aufbauarbeit, nicht als fertiger Nutzerpfad
- Linux-AppImage-Packaging ist aktuell noch ein fragiler Build-Up-Pfad; `linuxdeploy`-Fehler sind im Moment offenes Packaging-Feedback, nicht eine gebrochene veroeffentlichte Release-Linie

## Vor jedem Release-Track-Build

1. `npm test`, `npm run build` und `cargo test --manifest-path src-tauri/Cargo.toml` muessen gruen sein.
2. Die Version in `package.json` und `src-tauri/tauri.conf.json` muss dem geplanten Build-Stand entsprechen.
3. README, REFERENCE, CHANGELOG und About-Copy duerfen keine Verfuegbarkeit behaupten, die es noch nicht gibt.

## Manueller Build-Matrix-Lauf

1. GitHub Actions oeffnen.
2. `Release Build-Up Matrix` auswaehlen.
3. Den gewuenschten `ref` setzen, standardmaessig `main`.
4. Workflow starten.
5. Nach Abschluss die hochgeladenen Artefakte pro Plattform pruefen.

## Was nach dem Lauf geprueft wird

- Linux: wenn die Packaging-Lane durchlaeuft, Bundle-Struktur fuer AppImage/DEB vorhanden; ein `linuxdeploy`-Fehler bleibt bis auf Weiteres ein bekannter Build-Up-Befund
- macOS: DMG/Bundle-Artefakte vorhanden
- Windows: Installer-/Bundle-Artefakte vorhanden
- keine About-/Doku-Copy suggeriert bereits live funktionierende Downloads oder Updates

## Vor dem ersten oeffentlichen Release noch offen

- Signierung pro Plattform verbindlich schliessen
- Release-Notes- und Tagging-Prozess festziehen
- In-Place-Updater-Semantik und Vertrauenspfad definieren
- Linux-Packaging ohne `linuxdeploy`-Abbruch stabil durchziehen
- final entscheiden, wann `release.yml` ueber Artefakt-Builds hinaus wirklich veroeffentlichen darf

Bis diese Punkte geschlossen sind, bleibt der Release-Pfad ein interner Aufbaupfad.