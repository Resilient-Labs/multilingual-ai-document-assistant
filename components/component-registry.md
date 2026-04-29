# Component Registry

Single source of truth for everything under `components/`. **Do not edit `components/ui/`** — shadcn primitives only; compose from them in features, shared, or app-level components.

## Layout

| Path                             | Role                                       |
| -------------------------------- | ------------------------------------------ |
| `components/ui/`                 | shadcn primitives (generated; do not edit) |
| `components/shared/`             | Reusable across features (empty today)     |
| `components/features/{feature}/` | Feature-specific composed components       |

---

## UI primitives (`components/ui/`)

Alphabetical inventory (55). Import from `@/components/ui/<name>`.

`accordion`, `alert-dialog`, `alert`, `aspect-ratio`, `avatar`, `badge`, `breadcrumb`, `button-group`, `button`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `combobox`, `command`, `context-menu`, `direction`, `dialog`, `drawer`, `dropdown-menu`, `empty`, `field`, `hover-card`, `input-group`, `input-otp`, `input`, `item`, `kbd`, `label`, `menubar`, `native-select`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner`, `spinner`, `switch`, `table`, `tabs`, `textarea`, `toggle-group`, `toggle`, `tooltip`

---

## Feature components (`components/features/`)

### DetectTab

|                |                                                                                                                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Location**   | `components/features/detect/DetectTab.tsx`                                                                                                                                                                |
| **Purpose**    | Safety / detection UI: risk summary, severity, confidence, suggested actions, resources, disclaimer. Reads the canonical OCR from EntityDB via `useDocumentSession(docId)`, then runs `useSafetyAnalysis` → `POST /api/safety`. |
| **Props**      | `docId: string`, `className?`                                                                                                                                                                             |
| **Built with** | Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions, Badge; lucide-react icons                                                                                                          |
| **Usage**      | `app/translate/[id]/page.tsx` — rendered in the Safety Analysis card between `TranslateSummary` and `AskTab`                                                                                              |

---

### AskTab

|                |                                               |
| -------------- | --------------------------------------------- |
| **Location**   | `components/features/ask/AskTab.tsx`          |
| **Purpose**    | Placeholder for document Q&A / ask interface. |
| **Props**      | `className?`                                  |
| **Built with** | Layout-only (no shadcn primitives yet)        |
| **Usage**      | `app/translate/[id]/page.tsx` — rendered in the Ask card below Safety Analysis |

---

### ExtractedDataPanel

|                |                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| **Location**   | `components/features/document/ExtractedDataPanel.tsx`                                                    |
| **Purpose**    | Canonical document session UI: job status, progress, OCR text, field candidates, tabs for document data. |
| **Props**      | (see file — document session driven)                                                                     |
| **Built with** | Card, Tabs, Textarea, Input, Label, Button, Alert, Spinner, Progress                                     |
| **Usage**      | Feature document / extraction flows                                                                      |

---

### ReadAloudPanel

|                |                                                                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Location**   | `components/features/tts/ReadAloudPanel.tsx`                                                                                                                         |
| **Purpose**    | Complete Read Aloud shell. Manages TTS request lifecycle (loading, error, audio URL) via the HF Space backend (en/es/vi only). Shows a gender-picker dialog for English (VCTK multi-speaker); Spanish and Vietnamese generate with one click. |
| **Props**      | `text: string`, `language: string`, `disabled?: boolean`, `labelSuffix?: string`                                                                                     |
| **Built with** | Button, Dialog, RadioGroup, Alert, Spinner, `TtsPlaybackVisual`                                                                                                      |
| **Usage**      | `app/translate/[id]/page.tsx` — once for the original doc (gated by `TTS_SUPPORTED_LANGS.has(session.sourceLang)`), once for the translation (gated by `TTS_SUPPORTED_LANGS.has(session.targetLang)`) |

---

### TtsPlaybackVisual

|                |                                                                                    |
| -------------- | ---------------------------------------------------------------------------------- |
| **Location**   | `components/features/tts/TtsPlaybackVisual.tsx`                                    |
| **Purpose**    | TTS playback controls and visual sync (audio ref, waveform-style UI, word timing). |
| **Props**      | `audioRef`, `audioUrl`, `text`, `className?`                                       |
| **Built with** | Button, `cn` utility                                                               |
| **Usage**      | Rendered by `ReadAloudPanel` after audio is successfully generated                 |

---

### LanguagePreference

|                |                                                                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Location**   | `components/features/language/LanguagePreference.tsx`                                                                                     |
| **Purpose**    | Persisted language preference selector. Reads the saved preference from EntityDB on mount via `useLanguagePreference` and writes back on change. |
| **Props**      | `className?: string`, `onLanguageChange?: (language: string) => void`                                                                     |
| **Built with** | Select, Skeleton, `useLanguagePreference` hook                                                                                            |
| **Usage**      | Drop into any client page/layout that needs a remembered language choice                                                                  |

---

## App-level components (root of `components/`)

### UploadForm

|                |                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Location**   | `components/upload-form.tsx`                                                                                                       |
| **Purpose**    | File upload (dropzone), processing, OCR persistence, navigation to translate flow; writes `sessionStorage` keys consumed by the translate page. |
| **Built with** | Button, Select, Spinner, react-dropzone, lucide-react                                                                              |

---

## Related docs

- Feature-specific notes: this file replaces duplicated content formerly in `components/features/features-doc.md` (see pointer there).
