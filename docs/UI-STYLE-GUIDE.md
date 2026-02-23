# UI Style Guide

Design system for the Multilingual AI Document Assistant chat mockup. Use this guide when building or extending the UI.

## Color Palette

The app uses a **brown-scale palette** (cream, tan, camel, mocha, espresso). Purple tones are avoided.

### Light Mode

| Token | HSL | Usage |
|-------|-----|-------|
| `--background` | 35 30% 97% | Page background (cream) |
| `--foreground` | 25 25% 12% | Primary text (espresso) |
| `--primary` | 25 40% 32% | Buttons, accents (mocha) |
| `--primary-foreground` | 35 30% 97% | Text on primary |
| `--secondary` | 35 20% 92% | Secondary surfaces (tan) |
| `--muted` | 35 18% 92% | Muted backgrounds |
| `--muted-foreground` | 25 18% 42% | Secondary text |
| `--accent` | 35 22% 90% | Hover states (camel) |
| `--border` | 35 18% 86% | Borders |
| `--chat-user-bubble` | 30 35% 42% | User message bubbles |
| `--chat-assistant-bubble` | 35 22% 94% | Assistant message bubbles |
| `--chat-assistant-border` | 35 15% 88% | Assistant bubble border |
| `--chat-typing-bg` | 35 20% 91% | Typing indicator background |

### Dark Mode

Dark mode uses the same hue family with inverted lightness. Apply the `dark` class to the root element to enable.

### Tailwind Usage

```tsx
// Semantic colors
<div className="bg-background text-foreground" />
<button className="bg-primary text-primary-foreground" />
<p className="text-muted-foreground" />

// Chat-specific
<div className="bg-chat-user text-primary-foreground" />
<div className="bg-chat-assistant border-chat-assistant-border" />
```

## Typography

- **Headings**: `font-semibold`, `text-sm` for section titles
- **Body**: `text-sm` for chat content
- **Muted**: `text-muted-foreground` for secondary text
- **Small**: `text-xs` for labels and hints

## Spacing

- Base unit: 4px (Tailwind `1` = 4px)
- Chat padding: `px-4 py-3` (header, messages)
- Component gaps: `gap-2`, `gap-3`, `gap-4`
- Section spacing: `space-y-4` for stacked content

## Border Radius

- Default: `--radius: 0.5rem` (8px)
- Message bubbles: `rounded-lg`
- Buttons: `rounded-md`
- Cards: `rounded-lg`

## Components

### Chat Header

- Avatar (9x9) with "AI" fallback
- Title: `text-sm font-semibold`
- Subtitle: `text-xs text-muted-foreground`
- Expand/shrink toggle in top-right

### Message Bubbles

- **User**: `bg-chat-user text-primary-foreground`, right-aligned, `max-w-[85%]`
- **Assistant**: `bg-chat-assistant border border-chat-assistant-border`, left-aligned with avatar
- Padding: `px-4 py-2.5`

### Quick Summary Cards

- Types: `requirements`, `missing`, `action`
- Badge + title in header
- Bullet list for items
- Use `QuickSummaryCard` from `@/components/chat/quick-summary-card`

### Chat Composer

- Textarea with placeholder
- Attachment chips: `Badge` with `variant="secondary"`
- Icon buttons: Paste (Paperclip), Image, Link, Send
- Helper text: `text-xs text-muted-foreground`

### Buttons

- Primary: `variant="default"` for main actions (Send)
- Ghost: `variant="ghost"` for toggles and secondary actions
- Outline: `variant="outline"` for attachment controls
- Icon: `size="icon"` for icon-only buttons

## Layout

- **Expanded**: Full viewport, chat fills the screen
- **Shrunk**: Centered card, `max-w-2xl`, `h-[min(80vh,700px)]`, `rounded-lg`, `shadow-lg`

## Accessibility

- Use `aria-label` on icon-only buttons
- Ensure focus rings: `focus-visible:ring-2 focus-visible:ring-ring`
- Maintain contrast for text (foreground on background, primary-foreground on primary)

## File Structure

```
components/
  chat/           # Chat-specific components
  ui/             # Shadcn primitives
app/
  globals.css     # CSS variables and base styles
tailwind.config.ts # Theme extension
```
