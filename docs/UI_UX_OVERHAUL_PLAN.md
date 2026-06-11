# WordScript — UI/UX Overhaul Plan v2

Stand: 2026-06-10

> ## Final decisions (implemented in `feat/ui-overhaul-v2` — supersedes contradictions below)
>
> Dieser Plan wurde umgesetzt; wo er von den folgenden Punkten abweicht, gelten die folgenden Punkte:
>
> - **Native Titelleiste auf jedem OS** (`decorations: true`). **Kein** frameless Main Window, **keine** custom titlebar, **kein** `macOSPrivateApi`, keine fake Traffic-Lights. Das macOS-Gefuehl kommt rein aus dem Content-Design. (Loest den Widerspruch zugunsten der Regel in `docs/DESIGN_SYSTEM.md`.)
> - **Stack:** shadcn/ui + Tailwind v4, auf den bestehenden CSS-Variablen-Tokens (`@theme inline`). Tokens bleiben Single Source of Truth.
> - **Motion:** React bleibt 18 → `useTransition` + CSS-Crossfade statt React-19-ViewTransition-API.
> - **Neue IA (9 aktive Areas):** WORKSPACE (Home, History, Profiles) · ENGINE (Speech & AI, Modes, Capture) · SYSTEM (Permissions & Recovery, Diagnostics, About), plus deaktivierte PREVIEW-Items (Chat, Upload, Notes, Workspace, Account) mit "coming later"-Tooltip. Home/History/Permissions sind neu und vollstaendig im Form-Kit gebaut.
> - **Overlay:** Glassmorphism via `backdrop-filter` mit `@supports`-Solid-Fallback (Linux) + orangefarbener Recording-Glow.
> - **Bekannter Folgeschritt:** Die grossen Legacy-Tabs (Speech & AI, Modes, Capture, Profiles, Diagnostics) nutzen weiterhin ihre `settings.css`-Markup-Struktur (an die neue macOS-Optik angeglichen) und werden noch nicht voll auf das Form-Kit migriert; dadurch ueberschneiden sich aktuell einige Inhalte mit den neuen Areas (History ↔ Diagnostics-History, Permissions ↔ Input-Recovery/About-Platform). Die Legacy-Tabs sind die uebergangsweise Quelle; die neuen Areas sind die kanonischen Ziele. Volle Kit-Migration + Sub-Tabs (Speech/Intelligence, Shortcuts/Mic/Delivery/Overlay, Context/Dictionary/Snippets/Bias) + Entfernen der Duplikate sind der naechste Pass.

## 1. Zielbild

WordScript reift von einer funktionalen Dev-Utility zu einer **nativen, polished Voice Workstation** fuer macOS (und cross-platform). Der Look ist **macOS-native mit SW-labs-Identitaet** — nicht ein generisches Web-UI im Dark Mode.

**Inspirationsquellen:**
- **OpenWhispr**: Informationsarchitektur, Sidebar-Struktur, Settings-Karten-Layout, Onboarding-Flow
- **Apple Human Interface Guidelines (HIG)**: Fenster-Verhalten, Spacing, Typography, Motion
- **UI-UX-Pro-Max Design-Datenbank**: "Operation orange on dark" Calculator-Palette (Result #1) als strukturelle Farb-Referenz
- **Tauri v2 Native APIs**: Custom Window Chrome, Transparenz, macOS-Private-API fuer echte Glassmorphism

**SW-labs Markenzeichen:** Die Orange Accent-Farbe (`#e68900`) ist das zentrale Identifikationsmerkmal. Sie wird als Primary, Ring, Glow und Muted-Tint verwendet.

Langfristig fuehrt der Weg zu einer **Voice Workstation** mit Diktat-Hub, Notepad, Audio-Upload, Meeting-Notes, AI-Chat und Self-Hosting-Sync.

## 2. Neue Informationsarchitektur

### 2.1 Fenster-Modell

```
Overlay          (Tauri transparent window, glassmorphism, always-on-top)
  |
Main Window      (Tauri window mit custom titlebar, decorations: false)
  |-- Custom Titlebar (WordScript-brand, native controls)
  |-- Sidebar Navigation (200px, nicht scrollbar)
  |-- Content Area (router-faehig, ViewTransition-animated)
  |
Diagnostics      (optionaler Pop-out, auch als Tab erreichbar)
```

Das **Main Window** ersetzt das heutige Settings-Fenster als **WordScript Shell**. Kein "Settings" mehr, sondern die zentrale Produktflaeche.

### 2.2 Tauri Window-Konfiguration (neu)

**`src-tauri/tauri.conf.json`:**

```json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "WordScript",
        "width": 980,
        "height": 720,
        "minWidth": 760,
        "minHeight": 540,
        "decorations": false,
        "transparent": false,
        "center": true,
        "hiddenTitle": true,
        "titleBarStyle": "Overlay",
        "macOSPrivateApi": true
      },
      {
        "label": "overlay",
        "width": 420,
        "height": 80,
        "decorations": false,
        "transparent": true,
        "alwaysOnTop": true,
        "skipTaskbar": true,
        "resizable": false,
        "visible": false
      }
    ]
  }
}
```

**Design-Entscheidungen:**
- **Main Window**: `decorations: false` + `titleBarStyle: "Overlay"` (macOS) = native Traffic Lights schweben ueber dem Content. Keine Fake-Traffic-Lights. Auf Windows/Linux: custom Titlebar mit WordScript-Branding.
- **Overlay**: `transparent: true` + `alwaysOnTop` = echte Glassmorphism-Pill moeglich. `skipTaskbar: true` = erscheint nicht in der Taskleiste.
- **macOSPrivateApi**: Erforderlich fuer transparente Overlay-Fenster auf macOS. Verhindert App Store, aber WordScript ist ein Dev-Tool.

### 2.3 Sidebar-Navigation

**Bereiche:**

| Icon (Lucide) | Label | Status | Beschreibung |
|---------------|-------|--------|--------------|
| `Mic` | Dictate | **aktiv** | Quick-Status, letzte Diktate, Trigger-Test |
| `BookText` | Text Rules | **aktiv** | Profile, Dictionary, Snippets, Context |
| `SlidersHorizontal` | Modes | **aktiv** | Processing Mode, Sub-Mode, Auto-Detect |
| `Cpu` | Provider | **aktiv** | Cloud/Lane, API-Key, Local Setup |
| `Keyboard` | Input | **aktiv** | Hotkey, Mic, Insert, Recovery |
| `ActivitySquare` | Diagnostics | **aktiv** | Logs, History, Pipeline-Status |
| `Info` | About | **aktiv** | Version, Platform, Release-Status |
| --- | --- | --- | --- |
| `MessageSquare` | Chat | **preview** | AI-Chat auf Transkript-Basis |
| `Upload` | Upload | **preview** | Audio-Upload, Batch-Transkription |
| `NotebookPen` | Notes | **preview** | Meeting-Notes, Speaker-Diarization |
| `Monitor` | Workspace | **preview** | Profil-Workspace, App-Zuordnung |
| `User` | Account | **preview** | Self-Hosting-Sync, Daten-Export |

**Sidebar-Regeln:**
- Breite: **200px** (macOS-Standard, wie Finder-Sidebar)
- Hintergrund: `var(--sidebar)` = `rgba(13, 18, 23, 0.88)`
- Aktive Bereiche oben, Preview-Tabs unten mit `16px` visuellem Abstand
- Preview-Tabs: `opacity: 0.35`, `cursor: not-allowed`, Tooltip "Coming in a future version"
- Aktiver Bereich: **4px orangener Akzentstreifen** links (`background: var(--accent)`), Text in `var(--fg)`
- Inaktiver Bereich: Text in `var(--fg-dim)`, Hover: `background: rgba(255,255,255,0.03)`
- Icon-Groesse: `18px`, Stroke-Width: `1.5`
- Label: `11px`, weight 500, tracking `0.01em`, uppercase
- **Nicht scrollbar.** Passt sie nicht, Schriftgroesse reduzieren statt Scroll.

### 2.4 Content-Area-Struktur (pro Bereich)

Jeder Bereich folgt dem gleichen Schema:

```
+------------------+
| Header           |  -- Icon + Titel + optional Runtime-Status-Pill
+------------------+
| Sub-Nav (opt.)   |  -- Horizontale Tabs innerhalb des Bereichs
+------------------+
|                  |
| Content Surface  |  -- Scrollbare Card-Liste
|                  |
+------------------+
| Action Bar (opt.)|  -- Fixierte oder mitscrollende Aktionen
+------------------+
```

- **Header**: `32px` Titel, weight 600, `var(--fg)`. Icon `20px` davor.
- **Sub-Navigation**: Nur wenn noetig (z.B. Text Rules -> Profile / Dictionary / Snippets). Pill-Style Tabs wie in React 19 ViewTransition-Beispiel.
- **Content Surface**: Eine dominante, scrollbare Flaeche mit `padding: 24px`
- **Card-Layout**: Jede Config-Sektion ist eine Card. Cards haben `gap: 16px` zwischen ihnen.

## 3. Settings-Redesign (WordScript Shell)

### 3.1 Heutige Tabs -> Neue Bereiche

| Heutiger Tab | Neuer Bereich | Aenderungen |
|--------------|---------------|-------------|
| Provider & Models | **Provider** | Top-Level-Sektion. Cloud/Local-Toggle als grosser Switch. Provider als horizontal scrollbare Chip-Liste mit Icon + Name. API-Key in sicherer Card mit Reveal-Button. |
| Modes | **Modes** | Radio-Cards statt Radio-Group (visuell aufgeraeumter). Sub-Mode nur bei `prompt_enhance` sichtbar. Auto-Detect-Toggle prominent. |
| Input | **Input** | Hotkey-Recorder als grosse, klickbare Taste (40x40px) mit `var(--accent)` Border. Tap-vs-Hold-Toggle als Segment-Control. |
| Text Rules | **Text Rules** | Zwei-Spalten-Layout: Links Sidebar-in-Sidebar (Profile-Liste), rechts Editor. Profile als auswaehlbare Cards mit Preview. |
| About | **About** | Kompakt: Version-Badge, Release-Status-Timeline (3 Eintraege: Stable/Beta/Alpha), Platform-Support-Tabelle, Links. |
| Diagnostics | **Diagnostics** | Eigener Sidebar-Eintrag statt Settings-Tab. Pop-out weiterhin moeglich. Real-time Log-Stream mit Filter. |

### 3.2 Card-basiertes Layout

Jede Config-Sektion ist eine **Card**:

```css
.ws-card {
  background: var(--surface-elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
}

.ws-card-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--fg-muted);
  margin-bottom: 16px;
}
```

**Card-Regeln:**
- Keine doppelten Rahmen; nur `1px solid var(--border)`
- Kein Box-Shadow auf Cards (macOS HIG: Elevation durch Hintergrund, nicht Schatten)
- Hover: `border-color: var(--border-strong)` (subtil, kein Lift)
- Controls innerhalb: `16px` vertikaler Abstand, `12px` horizontaler Abstand

### 3.3 Controls-Stil

**Toggle-Switch** (macOS-Native-Feeling):
- Track: `28px x 16px`, `border-radius: 8px`
- Inaktiv: `background: var(--surface-strong)`, Thumb: `14px` Weiss
- Aktiv: `background: var(--accent)`, Thumb mit `1px var(--accent-strong)` Border
- Transition: `150ms ease-out`

**Segment-Control** (fuer Tap-vs-Hold, Cloud-vs-Local):
- Container: `background: var(--surface-strong)`, `border-radius: 8px`, `padding: 2px`
- Aktiv: `background: var(--surface-elevated)`, `color: var(--accent)`, `box-shadow: 0 1px 2px rgba(0,0,0,0.2)`
- Inaktiv: `color: var(--fg-dim)`
- Transition: `100ms ease-out`

**Buttons:**
- Primary: `background: var(--accent)`, `color: #0f1418` (dunkler Text auf Orange fuer Kontrast)
- Secondary: `background: var(--btn-bg)`, `color: var(--fg)`
- Ghost: `background: transparent`, `color: var(--fg-dim)`, Hover: `background: rgba(255,255,255,0.05)`
- Border-Radius: `8px`
- Padding: `8px 16px`
- Font: `13px`, weight 500

**Inputs:**
- Background: `var(--surface-strong)`
- Border: `1px solid var(--border)`
- Focus: `border-color: var(--accent)`, `box-shadow: 0 0 0 2px var(--accent-soft)`
- Border-Radius: `8px`
- Padding: `8px 12px`

### 3.4 Onboarding-Wizard (spaeter)

Step-Navigation fuer den Erststart:

1. **Welcome**: Logo (Orange), Kurzbeschreibung, "Continue without account"
2. **Provider**: Cloud/Local-Toggle, Provider-Auswahl, API-Key-Eingabe
3. **Permissions**: Mikrofon-Status-Check, Accessibility-Hinweis (macOS)
4. **Activation**: Hotkey-Recorder, Tap-vs-Hold, Test-Diktat

Optional im Dev-Modus, gefuehrter Pfad im Release.

## 4. Overlay-Verbesserungen

### 4.1 Tauri-Transparentes Fenster

```rust
// src-tauri/src/lib.rs — Overlay-Window-Setup
WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App("/overlay".into()))
    .inner_size(420.0, 80.0)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .build()
    .expect("Failed to create overlay window");
```

**CSS fuer Transparentes Fenster:**

```css
/* Overlay-Fenster hat transparenten Body */
body.overlay-window {
  background: transparent !important;
}

.ws-pill {
  background: rgba(13, 18, 23, 0.72);
  backdrop-filter: blur(20px) saturate(1.2);
  -webkit-backdrop-filter: blur(20px) saturate(1.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
```

**Fallback:** Auf Linux (wo `transparent` + `backdrop-filter` nicht verfuegbar ist): solid background `var(--bg)` ohne Blur.

### 4.2 Visuelle Zustaende

| Zustand | Pill-Style |
|---------|------------|
| **Idle** | Default Glassmorphism, Status-Icon in `var(--fg-dim)` |
| **Recording** | `box-shadow: 0 0 20px rgba(230, 137, 0, 0.4), 0 4px 16px rgba(0,0,0,0.3)` — Orangener Glow-Puls |
| **Processing** | Spinner (rotierendes Lucide `Loader2`, `var(--accent)`), Text "Processing..." |
| **Muted** | `opacity: 0.6`, Icon `MicOff` in `var(--fg-muted)`, Roter Dot optional |
| **Error** | Border `var(--red)`, Icon `AlertCircle`, Mini-Error-Toast innerhalb der Pill |
| **Success** | Kurzer Gruen-Flash (`var(--green)`), Check-Icon, dann Rueck zu Idle |

### 4.3 Interaktion

- **Right-Click-Menu** auf der Pill: Quick-Settings (Mute, Pause), Abort, Open Main Window
- **Hover-Expand**: Im Idle-Zustand leichte Skalierung auf `scale(1.02)` bei Hover
- **Drag**: Pill kann per Drag repositioniert werden (Tauri `window.startDragging()`)

## 5. Neue Screens (Preview-Tabs)

### 5.1 Chat
- Split-View: Links Chat-History, Rechts aktiver Chat
- Voice-Input-Button neben Textfeld (gleiche Hotkey-Logik)
- Kontext: Letzte Transkripte (lokal)

### 5.2 Upload
- Drag-and-Drop-Zone (gross, zentriert, gestrichelte Border `var(--accent-soft)`)
- Queue-Liste mit Status (Pending -> Processing -> Done)
- Ergebnisse mit Copy/Insert/Edit Actions

### 5.3 Notes
- Drei-Spalten-View: Transkript / Rohe Notizen / Enhanced
- Speaker-Diarization: Farbige Labels (Orange-Tonality)
- AI-Enhancement: Extrahierte Decisions, Action Items

### 5.4 Workspace
- Grid der Profil-Arbeitsmodi
- Visuelle App-Zuordnung (wie `workspace_app_map`, aber mit Icons)
- Auto-Detect-Toggle global

### 5.5 Account
- Minimalistisch (kein Cloud-Account noetig)
- Self-Hosting: Server-URL, Sync-Status
- Export/Import: Vollstaendiger Daten-Export

### 5.6 Preview-Tab-Regeln

```css
.ws-sidebar-item.preview {
  opacity: 0.35;
  cursor: not-allowed;
  pointer-events: none;
}

.ws-sidebar-item.preview:hover {
  /* Kein Hover-Effekt */
}
```

- Tooltip bei Hover: "Coming in a future version"
- Kein Klick, kein Route-Wechsel, kein leerer Screen
- Kein Marketing-Text, keine Feature-Listen
- Automatische Aktivierung bei Implementierung

## 6. Design-System

### 6.1 Farben (v2 — basierend auf UI-UX-Pro-Max "Operation Orange on Dark")

| Token | Wert | Verwendung |
|-------|------|------------|
| `--bg` | `#0f1418` | Haupt-Hintergrund (beibehalten, passt zur Datenbank) |
| `--bg-elevated` | `#161d23` | Erhoehte Flaechen |
| `--surface` | `rgba(22, 29, 35, 0.92)` | Cards, Modals |
| `--surface-elevated` | `#1b242c` | Erhoehte Cards |
| `--surface-strong` | `#202a33` | Inputs, Buttons, Segment-Control-Container |
| `--sidebar` | `rgba(13, 18, 23, 0.88)` | Sidebar-Hintergrund |
| `--fg` | `#f3efe4` | Primaerer Text (warmes Weiss) |
| `--fg-dim` | `#92a0ad` | Sekundaerer Text, Labels |
| `--fg-muted` | `#667380` | Deaktiviert, Placeholder, Card-Titel |
| `--accent` | `#e68900` | **SW-labs Orange** — Primary Actions, Active States, Rings |
| `--accent-hover` | `#ff9800` | Hover auf Accent-Elementen |
| `--accent-strong` | `#f5a623` | Glows, Highlights, Sparkle-Effekte |
| `--accent-soft` | `rgba(230, 137, 0, 0.15)` | Subtile Hintergruende, Focus-Rings |
| `--accent-muted` | `#2C1E16` | Orange-tinted muted (aus der Datenbank) |
| `--border` | `rgba(255, 255, 255, 0.08)` | Subtile Trennlinien |
| `--border-strong` | `rgba(255, 255, 255, 0.14)` | Hover-Borders |
| `--green` | `#81d6ae` | Erfolg, positive Runtime-Zustaende |
| `--red` | `#ff7a6b` | Fehler, Muted-Status |
| `--orange` | `#e68900` | Warnung (selten, meist Accent verwenden) |

**Farb-Hierarchie:**
1. **Accent** (`#e68900`) fuer alle interaktiven Primary-States
2. **Surface-Elevation** fuer Tiefe (nicht Schatten)
3. **Borders** extrem subtil (`rgba(255,255,255,0.08)`)
4. **Text** in drei Stufen: `fg` > `fg-dim` > `fg-muted`

### 6.2 Typografie

**Font-Stack (beibehalten):**
- Display: `"Aptos Display", "SF Pro Display", "Segoe UI Variable Display", "Noto Sans", sans-serif`
- Body: `"Aptos", "SF Pro Text", "Segoe UI Variable", "Noto Sans", sans-serif`
- Mono: `"IBM Plex Mono", "Cascadia Code", "SF Mono", "Consolas", monospace`

**Type Scale:**

| Token | Groesse | Weight | Line-Height | Verwendung |
|-------|---------|--------|-------------|------------|
| `display-lg` | 28px | 600 | 1.2 | Bereichs-Titel im Header |
| `display` | 24px | 600 | 1.3 | Modale Titel |
| `title` | 18px | 600 | 1.4 | Card-Ueberschriften (gross) |
| `body-lg` | 15px | 400 | 1.5 | Wichtiger Body-Text |
| `body` | 13px | 400 | 1.5 | Standard-Body |
| `body-sm` | 12px | 400 | 1.5 | Sekundaere Info |
| `label` | 11px | 500 | 1.0 | uppercase, tracking 0.05em | Card-Sektions-Titel |
| `caption` | 10px | 500 | 1.0 | uppercase, tracking 0.08em | Status-Badges |

**Regeln:**
- Sidebar-Labels: `label` (11px, weight 500, uppercase)
- Card-Titel: `label` (11px, weight 600, uppercase, `var(--fg-muted)`)
- Body-Text niemals unter 12px
- Mono nur fuer technische Werte (Version, API-Keys, Timestamps)

### 6.3 Spacing

**Basierend auf 4pt-Grid:**

| Token | Wert |
|-------|------|
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |

**Layout-Werte:**
- Sidebar: `200px`
- Content-Padding: `24px`
- Card-Padding: `20px`
- Card-Gap: `16px`
- Section-Gap: `24px`
- Control-Gap (vertikal): `16px`
- Control-Gap (horizontal): `12px`

**Border-Radius:**
- Cards: `12px`
- Buttons/Inputs: `8px`
- Segment-Control: `8px`
- Toggle-Track: `8px`
- Pill (Overlay): `20px`
- Badges: `4px`

### 6.4 Motion

**Basierend auf UI-UX-Pro-Max und macOS HIG:**

| Animation | Dauer | Easing | Beschreibung |
|-----------|-------|--------|--------------|
| Tab-Wechsel (Content) | 150ms | `cubic-bezier(0.25, 0.1, 0.25, 1.0)` | Crossfade + leichte Verschiebung |
| Sidebar-Hover | 100ms | `ease-out` | Hintergrund-Fade |
| Card-Border-Hover | 150ms | `ease-out` | Border-Color-Transition |
| Toggle-Switch | 150ms | `ease-out` | Thumb-Slide |
| Button-Press | 50ms | `ease-out` | `scale(0.97)` |
| Button-Hover | 100ms | `ease-out` | Background-Color |
| Overlay-Glow-Puls | 2000ms | `ease-in-out` | Infinite Pulse bei Recording |
| Overlay-Enter | 200ms | `cubic-bezier(0.25, 0.1, 0.25, 1.0)` | Fade + Scale |
| Overlay-Leave | 150ms | `ease-in` | Fade |
| Toast-Enter | 200ms | `ease-out` | Slide-Up + Fade |
| Toast-Leave | 150ms | `ease-in` | Slide-Down + Fade |

**React 19 ViewTransition (fuer Tab-Wechsel):**

```tsx
import { useTransition } from 'react';

function Shell() {
  const [activeTab, setActiveTab] = useState('dictate');
  const [isPending, startTransition] = useTransition();

  const handleTabChange = (tab: string) => {
    startTransition(() => {
      setActiveTab(tab);
    });
  };

  return (
    <div className={isPending ? 'opacity-80' : ''}>
      {tabs.get(activeTab)}
    </div>
  );
}
```

**Regeln:**
- Keine Layout-Animationen (kein `width`, `height`, `top`, `left`)
- Nur `transform` und `opacity`
- `prefers-reduced-motion`: Alle Animationen auf `0ms` oder Instant
- Keine dekorativen Animationen — jede Bewegung muss einen Zweck haben

### 6.5 Icons

- **Basis**: Lucide React (`lucide-react`)
- **Stroke-Width**: `1.5` (duenner fuer mehr Eleganz)
- **Groessen**:
  - Sidebar: `18px`
  - Header: `20px`
  - Controls: `16px`
  - Inline: `14px`
- **Farben**:
  - Aktiv: `var(--fg)`
  - Inaktiv: `var(--fg-dim)`
  - Deaktiviert: `var(--fg-muted)`
  - Accent: `var(--accent)`

### 6.6 Shadows (minimal)

macOS HIG bevorzugt Elevation durch Hintergrund, nicht Schatten. Schatten nur dort, wo noetig:

```css
/* Overlay-Pill */
--shadow-pill: 0 8px 32px rgba(0, 0, 0, 0.25);

/* Modals/Sheets */
--shadow-modal: 0 20px 60px rgba(0, 0, 0, 0.4);

/* Dropdowns/Menus */
--shadow-dropdown: 0 4px 16px rgba(0, 0, 0, 0.3);
```

**Keine Schatten auf Cards** — Elevation durch `background: var(--surface-elevated)`.

## 7. Component-Architektur

### 7.1 Benoetigte shadcn/ui-Komponenten

Da die lokale shadcn-Registry nicht konfiguriert ist, nutzen wir die shadcn/ui-CLI direkt:

```bash
npx shadcn@latest add card button switch tooltip separator scroll-area tabs dialog label input badge
```

**Verwendung:**
- `Card` + `CardHeader` + `CardContent`: Settings-Karten
- `Button`: Alle Actions (mit Custom-Orange-Variant)
- `Switch`: Toggle-Controls (macOS-Style anpassen)
- `Tooltip`: Preview-Tab-Hinweise, Icon-Labels
- `Separator`: Trennlinien zwischen Sektionen
- `ScrollArea`: Scrollbare Content-Flaechen (custom scrollbar)
- `Tabs`: Sub-Navigation innerhalb von Bereichen
- `Dialog`: Modale (Onboarding, Bestaetigungen)
- `Label`: Form-Labels
- `Input` + `Textarea`: Text-Eingaben
- `Badge`: Status-Indikatoren (Version, Runtime-Status)

### 7.2 Custom Components (zu bauen)

**`Sidebar.tsx`**
```tsx
interface SidebarItem {
  id: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
  preview?: boolean;
}

interface SidebarProps {
  items: SidebarItem[];
  activeId: string;
  onSelect: (id: string) => void;
}
```

**`SettingsCard.tsx`**
```tsx
interface SettingsCardProps {
  title: string;
  children: React.ReactNode;
  icon?: LucideIcon;
}
```

**`SegmentControl.tsx`**
```tsx
interface SegmentControlProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}
```

**`HotkeyRecorder.tsx`**
```tsx
interface HotkeyRecorderProps {
  value: string;
  onChange: (hotkey: string) => void;
  recording?: boolean;
}
```

**`OverlayPill.tsx`**
```tsx
interface OverlayPillProps {
  state: 'idle' | 'recording' | 'processing' | 'muted' | 'error';
  text?: string;
  onClick?: () => void;
  onContextMenu?: () => void;
}
```

**`StatusBadge.tsx`**
```tsx
interface StatusBadgeProps {
  status: 'success' | 'warning' | 'error' | 'info';
  children: React.ReactNode;
}
```

### 7.3 State Management

- **Aktiver Tab**: `useState` im Shell-Component (top-level)
- **Settings-Daten**: Bestehende React Context/Hook-Struktur beibehalten
- **Overlay-State**: Tauri Events (Rust -> Frontend) + lokalen State
- **Preview-Tabs**: Kein State noetig — statische Liste mit `preview: true`

## 8. Technische Donor-Repositories

| Repo | URL | Nutzung |
|------|-----|---------|
| **darwin-ui** | `surajmandalcell/darwin-ui` | macOS-inspirierte React-Komponenten (Glassmorphism, Window-Chrome, Sidebar-Patterns) |
| **desktop-ui** | `andrejilderda/desktop-ui` | HIG-konforme Komponenten fuer macOS + Windows; CSS-Variables-System |
| **tauri-app-template** | `kitlib/tauri-app-template` | Tauri-v2 + React 19 + shadcn/ui Starter mit nativem Fenster-Handling |
| **macOS Design Guidelines** | `leny/macos-design-guidelines-skill` | Exakte Spacing-Werte, Toolbar-Regeln, Sidebar-Breiten |
| **OpenWhispr** (UI-Referenz) | `openwhispr.com` | Informationsarchitektur, Onboarding-Flow, Settings-Karten-Layout |

**Cherry-Picking-Regel:** Keine ganzen Bibliotheken importieren. Patterns und Code-Snippets extrahieren und auf WordScripts Runtime-Vertrag anpassen.

## 9. Staggered Implementation

### Phase 1: Foundation
- [ ] Neue CSS-Variable-Struktur (v2 Farben, Spacing, Typografie)
- [ ] `globals.css` auf v2 aktualisieren
- [ ] Tauri Window-Konfiguration (`tauri.conf.json`): Main mit `titleBarStyle: "Overlay"`, Overlay mit `transparent: true`
- [ ] Sidebar-Navigation-Komponente (nur aktive Bereiche)
- [ ] Settings zu "WordScript Shell" umbenennen und Sidebar-Integration
- [ ] Card-basiertes Layout fuer bestehende Tabs
- [ ] shadcn/ui-Komponenten installieren (Card, Button, Switch, Tooltip, etc.)

### Phase 2: Polish
- [ ] Overlay-Glassmorphism mit Tauri-Transparenz
- [ ] Orange Glow fuer Recording-Zustand
- [ ] Hotkey-Recorder als grosse klickbare Taste
- [ ] Segment-Control fuer Tap-vs-Hold und Cloud-vs-Local
- [ ] Subtile Animationen (Tab-Wechsel, Hover, Button-Press)
- [ ] Profilbibliothek als Sidebar-in-Sidebar

### Phase 3: Preview Tabs
- [ ] Chat-, Upload-, Notes-, Workspace-, Account-Screens als Preview-Tabs
- [ ] "Coming Soon"-States (kein Marketing-Text)
- [ ] Routing-Struktur fuer zukuenftige Tabs

### Phase 4: Onboarding
- [ ] Welcome-Screen mit SW-labs-Branding
- [ ] Step-Navigation (Setup, Permissions, Activation)
- [ ] Gefuehrter Erststart-Pfad

### Phase 5: Neue Features
- [ ] Chat-Implementierung
- [ ] Audio-Upload
- [ ] Meeting-Notes
- [ ] Workspace-Manager
- [ ] Self-Hosting-Account

## 10. Accessibility (aus UI-UX-Pro-Max Skill)

- **Kontrast**: Alle Text/Background-Paare muessen 4.5:1 erfuellen (WCAG AA)
- **Focus States**: Sichtbare Focus-Rings (`2px solid var(--accent)`) auf allen interaktiven Elementen
- **Keyboard Navigation**: Tab-Order entspricht visueller Order; Sidebar per Pfeiltasten
- **ARIA**: `aria-current="page"` fuer aktiven Sidebar-Eintrag; `aria-disabled="true"` fuer Preview-Tabs
- **Reduced Motion**: `prefers-reduced-motion: reduce` = alle Animationen instant
- **Touch Targets**: Mindestens `44x44px` fuer alle klickbaren Elemente
- **Screen Reader**: Icon-Buttons mit `aria-label`; Status-Aenderungen mit `aria-live`

## 11. Zusammenfassung der Architektur-Entscheidungen

- **Main Window** ersetzt Settings als WordScript Shell
- **Sidebar-Navigation** mit 200px Breite, nicht scrollbar
- **Cards** als dominante Content-Struktur, keine Schatten, nur Borders
- **macOS-HIG** ist primaere Referenz: Elevation durch Background, nicht Shadow
- **SW-labs Orange** (`#e68900`) als einzige Accent-Farbe — kein generisches Blue
- **OpenWhispr** liefert Informationsarchitektur, nicht den Look
- **Preview-Tabs** geben ehrlichen Vorgeschmack auf zukuenftigen Scope
- **Tauri transparent** Overlay fuer echte Glassmorphism
- **React 19** ViewTransitions fuer smooth Tab-Wechsel
- **shadcn/ui** als Komponenten-Basis, aber vollstaendig custom-gestyled
- **Kein Account-Zwang**: WordScript bleibt ohne Konto voll nutzbar

---

*Dieses Dokument ist ein Plan. Implementierungsdetails koennen sich im Code anpassen. Bei Konflikten gilt: Runtime-Wahrheit vor UI-Schoenheit.*
