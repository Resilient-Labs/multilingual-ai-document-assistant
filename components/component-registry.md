# Component Registry

Single source of truth for everything under `components/`. **Do not edit `components/ui/`** — shadcn primitives only; compose from them in features, shared, or app-level components.

## Layout

| Path | Role |
|------|------|
| `components/ui/` | shadcn primitives (generated; do not edit) |
| `components/shared/` | Reusable across features (empty today) |
| `components/features/{feature}/` | Feature-specific composed components |

---

## UI primitives (`components/ui/`)

Alphabetical inventory (55). Import from `@/components/ui/<name>`.

`accordion`, `alert-dialog`, `alert`, `aspect-ratio`, `avatar`, `badge`, `breadcrumb`, `button-group`, `button`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `combobox`, `command`, `context-menu`, `direction`, `dialog`, `drawer`, `dropdown-menu`, `empty`, `field`, `hover-card`, `input-group`, `input-otp`, `input`, `item`, `kbd`, `label`, `menubar`, `native-select`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner`, `spinner`, `switch`, `table`, `tabs`, `textarea`, `toggle-group`, `toggle`, `tooltip`

---

## Feature components (`components/features/`)

### DocumentTabs

| | |
|---|---|
| **Location** | `components/features/tabs-layout/DocumentTabs.tsx` |
| **Purpose** | Tab container with pluggable slots for Detect and Ask content. |
| **Props** | `detectContent` (ReactNode), `askContent` (ReactNode), `className?` |
| **Built with** | Tabs, TabsList, TabsTrigger, TabsContent |
| **Usage** | `app/dashboard/page.tsx` — passes `<DetectTab />` and `<AskTab />` as slots |

---

### DetectTab

| | |
|---|---|
| **Location** | `components/features/detect/DetectTab.tsx` |
| **Purpose** | Safety / detection UI: risk summary, severity, confidence, suggested actions, resources, disclaimer. Loads document text from `sessionStorage` (`translate-{docId}` / `current-doc-id`), then runs `useSafetyAnalysis` → `POST /api/safety`. |
| **Props** | `className?` |
| **Built with** | Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions, Badge; lucide-react icons |
| **Usage** | Plugs into `DocumentTabs` as `detectContent`, and mobile dashboard Detect tab |

---

### AskTab

| | |
|---|---|
| **Location** | `components/features/ask/AskTab.tsx` |
| **Purpose** | Placeholder for document Q&A / ask interface. |
| **Props** | `className?` |
| **Built with** | Layout-only (no shadcn primitives yet) |
| **Usage** | Plugs into `DocumentTabs` as `askContent` |

---

### ExtractedDataPanel

| | |
|---|---|
| **Location** | `components/features/document/ExtractedDataPanel.tsx` |
| **Purpose** | Canonical document session UI: job status, progress, OCR text, field candidates, tabs for document data. |
| **Props** | (see file — document session driven) |
| **Built with** | Card, Tabs, Textarea, Input, Label, Button, Alert, Spinner, Progress |
| **Usage** | Feature document / extraction flows |

---

### TtsPlaybackVisual

| | |
|---|---|
| **Location** | `components/features/tts/TtsPlaybackVisual.tsx` |
| **Purpose** | TTS playback controls and visual sync (audio ref, waveform-style UI, word timing). |
| **Props** | `audioRef`, `audioUrl`, `text`, `className?` |
| **Built with** | Button, `cn` utility |
| **Usage** | Text-to-speech playback feature |

---

## App-level components (root of `components/`)

### UploadForm

| | |
|---|---|
| **Location** | `components/upload-form.tsx` |
| **Purpose** | File upload (dropzone), processing, OCR persistence, navigation to translate flow; writes `sessionStorage` keys used by DetectTab. |
| **Built with** | Button, Select, Spinner, react-dropzone, lucide-react |

---

## Related docs

- Feature-specific notes: this file replaces duplicated content formerly in `components/features/features-doc.md` (see pointer there).