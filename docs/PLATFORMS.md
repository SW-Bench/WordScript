# WordScript — Platforms

Stand: 2026-06-10

Plattform-Supportmatrix und plattformspezifische Insert- und Recovery-Diagnostik. Quelle ist `core::insertion` (`NativeInsertionPlatformStatus`); diese Datei ist die menschenlesbare Spiegelung des nativen Vertrags.

## Support- und Plattformmatrix

| Plattform | Status | Aktuelle Realitaet |
|---|---|---|
| macOS | Tier 1 Zielpfad | nativer Hotkey-, Capture- und Insert-Pfad; Dev-Mode-Auto-Paste braucht Privacy-Freigaben |
| Windows | Tier 1 Zielpfad | nativer Hotkey-, Capture- und Insert-Pfad; UAC-Grenzen gelten fuer simuliertes Paste |
| Linux X11 | Preview | nutzbarer Produktpfad mit kleinerem Stabilitaetsversprechen |
| Linux Wayland hybrid (X11+Wayland mit xdotool) | Preview-lite | `xdotool type` (Fake-Input ueber XWayland) direkt, sonst Clipboard + manuelles Paste |
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

### Linux Wayland — bewusste Default-Wahl

Auf reinen Wayland-Sessions (kein `DISPLAY`, nur `WAYLAND_DISPLAY`) ist die Paste-Driver-Chette leer. Begruendung: jeder Versuch, `wtype`, `ydotool` oder `enigo` fuer Input-Simulation zu starten, loest den KDE-Plasma-Portal-Dialog "Remote Control – Control input devices" aus. Diese bewusste Default-Wahl vermeidet den Portal-Dialog, schraenkt aber die Auto-Paste-Bequemlichkeit auf pure Wayland ein. Hybrid-Sessions (X11+Wayland mit xdotool) sind davon nicht betroffen.
