# Handoff — control-input-linux portal-prompt fix

## Ausgangslage

Auf KDE Plasma 6 / CachyOS, GNOME Mutter, Hyprland, Sway und KDE Plasma 5
erschien der KDE-Plasma-Portal-Dialog "Remote Control — Control input
devices" trotz der im Commit `339ef66` dokumentierten Beruhigung
(pure-Wayland-Sessions nutzen `wtype`/`ydotool`/`enigo` nicht mehr).

Drei verbleibende Quellen wurden identifiziert:

1. `enigo` als Linux-Fallback kann auf KDE Plasma 6 ebenfalls den
   RemoteDesktop-Portal-Prompt ausloesen, wenn `xdotool` fehlt.
2. `xdotool` ueber XWayland klassifiziert KWin 6 / Plasma 6 als
   Remote-Control-Session und oeffnet denselben Dialog.
3. Es gab keinerlei Laufzeit-Erkennung — der naechste Versuch hat
   einfach wieder denselben Dialog ausgeloest.

## Loesung in vier Slices

### Slice 0 — Diagnose-Instrumentierung

- Neues Modul `core::portal.rs` mit `CompositorKind` (KDE Plasma 5/6,
  GNOME Mutter, Hyprland, Sway, Other, Unknown) und
  `PortalCapabilities` (Session-Type, XDG-Env, Portal-Interface-Status,
  Daemon-Status, Restore-Token-Path).
- `detect_compositor()` liest `XDG_CURRENT_DESKTOP`,
  `XDG_SESSION_DESKTOP`, `HYPRLAND_INSTANCE_SIGNATURE`, `SWAYSOCK`,
  `plasmashell --version`.
- `detect_portal_capabilities()` prueft ueber `busctl --user list`,
  ob `org.freedesktop.portal.remotedesktop` erreichbar ist.
- `detect_portal_prompt_from_stderr()` ist die Heuristik fuer die
  drei bekannten Signaturen:
  - "Authorization denied" + KDE/RemoteDesktop/KWin/Control input devices
    → `KdeRemoteDesktop`
  - "Authorization denied" + InputCapture
    → `InputCapture`
  - generisches "denied"/"permission denied" ohne Treffer
    → `Unknown`
- `run_paste_driver_chain` und der `xdotool type`-Pfad in
  `execute_insert_request_with_io` rufen die Heuristik auf und loggen
  den erkannten Signal ueber `runtime_log`.
- `NativeInsertionPlatformStatus` traegt `portal_capabilities` und
  `paste_disabled_reason` als optionale Felder.
- UI (`InputTab.tsx`, `AboutTab.tsx`) zeigt Compositor + Daemon-Status
  + RemoteDesktop-Interface in roter Diagnostic-Zeile an.
- 10 neue Unit-Tests in `core::portal::tests`.

### Slice 1 — Laufzeit-Degradation

- `NativeInsertionState` traegt jetzt `last_portal_prompt: Option<LastPortalPrompt>`.
- `execute_insert_request_with_io` returnt ueber einen Out-Parameter
  `Option<LastPortalPrompt>` mit Signal, Treiber, Zeitstempel und
  gekuerztem stderr-Excerpt (max. 280 Zeichen).
- `state.insert()` schreibt den erkannten Signal in den State und
  gibt ihn ueber `native_insertion_status` an die UI weiter.
- `AboutTab.tsx` rendert eine eigene `LastPortalPromptCard` mit
  Signal, Treiber und Original-stderr.
- Neuer Test `last_portal_prompt_is_recorded_when_paste_driver_is_blocked`
  in `core::insertion::tests`.

### Slice 2 — KDE RemoteDesktop-Portal korrekt anfordern

- `core::portal.rs` erweitert um `PortalSessionHandle`, `PortalError`,
  `portal_token_path()`, `load_persisted_restore_token()`,
  `store_restore_token()`, `clear_persisted_restore_token()` und
  `request_remote_desktop_session()`.
- Der Restore-Token liegt unter
  `$XDG_RUNTIME_DIR/wordscript/remote-desktop.token` (mode `0600`).
- Der eigentliche D-Bus-Call laeuft ueber `busctl call` statt ueber
  eine schwere `zbus`/`ashpd`-Crate — minimal-invasive Loesung, kein
  neuer Build-Blocker.
- `NativeInsertionState.ensure_portal_session()` ist idempotent: pro
  Laufzeit genau ein Anforderungsversuch. Der Versuch wird im Status
  als `portal_session: PortalSessionSummary { active, compositor,
  error }` sichtbar.
- `AboutTab.tsx` rendert den Portal-Session-Block mit aktiv/inaktiv
  und ggf. der konkreten Fehlermeldung.
- 4 neue Unit-Tests (`request_remote_desktop_session_rejects_*`,
  `portal_error_label_summarises_cause_for_user`,
  `portal_token_path_uses_xdg_runtime_dir`).

### Slice 3 — Compositor-spezifische Hinweise

- `PasteDisableReason`-Enum erweitert:
  - `HyprlandNoPersistentPortal` (mit Hinweis auf `wlr-virtual-input`)
  - `SwayUseWlrVirtualInput` (mit Hinweis auf `xdg-desktop-portal-wlr`)
  - `KdePlasma5UpgradeRecommended` (mit Hinweis auf Plasma-6-Upgrade)
- `paste_disabled_reason_for_platform` mappt jeden Compositor auf
  die spezifische Variante.
- Tests in `core::portal::tests` weiterhin gruen.

### Slice 4 — Doku-Sync

- `CHANGELOG.md` (Unreleased, Changed): vier neue Bullets zur Portal-
  Diagnose, zum echten RemoteDesktop-Grant, zur Compositor-Aufteilung
  und zur sichtbaren UI-Diagnose.
- `docs/PLATFORMS.md` (Support-Matrix + drei neue Sektionen): Tabelle
  um KDE Plasma 6, GNOME Mutter, Hyprland, Sway, KDE Plasma 5
  erweitert; neue Sektionen "Linux Wayland — Portal-Diagnose zur
  Laufzeit", "Linux Wayland — RemoteDesktop-Portal auf KDE Plasma 6 /
  GNOME Mutter", "Linux Wayland — Hyprland, Sway, KDE Plasma 5".
- `docs/ARCHITECTURE.md` (Plattform-Bullet): Wayland-Beschreibung
  compositorspezifisch formuliert.
- `docs/DEVELOPMENT.md` (Plattformhinweis): identisch aktualisiert.
- `docs/STATUS.md` (Linux Wayland): compositorspezifische Realitaet
  dokumentiert.

## Verifikation

- `cd src-tauri && cargo test`: 236/236 Tests gruen.
- `npm run build`: Build erfolgreich, 370 kB JS-Bundle.
- `npm test`: 70/70 Frontend-Tests gruen.
- Echter D-Bus-Call ist nur auf der Zielmaschine (CachyOS / KDE Plasma 6)
  verifizierbar; die Code-Pfade sind ueber `busctl`-Aufrufe real und
  produzieren bei Fehlern sprechende `PortalError::label()`-Texte.

## Offene Punkte / bewusst out of scope

- ashpd-basierter SDK-Wrapper als zukuenftige Refactoring-Option
  (aktuell zu grosse Build-Surface, kein klarer Mehrwert gegenueber
  dem direkten `busctl`-Aufruf).
- Polkit-Rule-Installer in `/etc/polkit-1/rules.d/` — bleibt Aufgabe
  des Distributors, nicht der App.
- Automatischer Probe-Loop, der den Portal-Grant ohne User-Klick
  erzwingt — widerspricht der User-Erwartung und unterbleibt.

## Rollout-Hinweis

Beim ersten Lauf auf einer KDE-Plasma-6-Maschine erscheint der
"Control input devices"-Dialog genau einmal. Nach Bestätigung wird
das Restore-Token unter `$XDG_RUNTIME_DIR/wordscript/remote-desktop.token`
abgelegt. Folgt der User der Empfehlung in der About-Karte
("Active portal session for KDE Plasma 6"), bleiben alle weiteren
Auto-Paste-Versuche ohne weiteren Dialog.
