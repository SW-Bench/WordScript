# CLAUDE.md — WordScript

## Purpose

WordScript ist ein Tauri-v2-Desktopprodukt mit React/TypeScript-UI und nativer Rust-Runtime fuer Trigger, Capture, Transform, Insert und Updates.

## Core Commands

```bash
npm install
npm test
npm run build
npm run tauri dev
cd src-tauri && cargo test
```

## Working Areas

- `src/` fuer Overlay, Settings, Rebuild Lab und UI-State
- `src-tauri/src/` fuer nativen Runtime-Core
- `docs/` fuer Vision, Architektur, Development, Design System, Status, Platforms, Reference und Release-Operations
- `docs/handoffs/` fuer abgeschlossene Implementation-Specs
- `docs/donors/` fuer eingefrorene Donor-Referenzen

## Source Of Truth

- Architektur: `docs/ARCHITECTURE.md`
- Arbeitsmodus und Validation: `docs/DEVELOPMENT.md`
- Produktziel und Scope: `docs/VISION.md`
- Aktueller Produktstand, offene Luecken, Release-Status: `docs/STATUS.md`
- Plattform-Support und Insert-/Recovery-Diagnostik: `docs/PLATFORMS.md`
- Provider-Grenzen und Modus-Semantik: `docs/REFERENCE.md`
- Design-Tokens und UI-Patterns: `docs/DESIGN_SYSTEM.md`
- Entscheidungen: `docs/VISION.md`

## Rules

- Keine neue Produktlogik in alte Sidecar- oder Glue-Pfade verschieben.
- UI muss Runtime-Wahrheit anzeigen; keine Fake-States, keine Fake-Readiness.
- Hotkeys, Capture, Session-Orchestrierung und Insert-Zuverlaessigkeit bleiben Rust-Ownership.
- Secrets nie committen oder hardcoden; nur ueber OS Secret Store oder Env.
- Nach Dependency-Aenderungen `npm audit` laufen lassen.
- Nach Architekturentscheidungen `docs/VISION.md` aktualisieren.

## Validation

- Nach UI-Aenderungen mindestens `npm run build`.
- Nach nativen Aenderungen mindestens `cd src-tauri && cargo test`.
- Bei groesseren Slices beide Seiten validieren.

## Gotchas

- Husky Pre-Commit-Hooks sind aktiv; nie mit `--no-verify` umgehen.
- Linux-Hotkeys koennen von der Desktop-Umgebung abgefangen werden; Win/Super bei Bedarf manuell eintragen.
