# Multilingual AI Document Assistant

A frontend-only UI mockup for the chat interface of an AI-powered document translation application. Built with Next.js and Shadcn/UI, this prototype demonstrates how users interact with an AI assistant to clarify document content, paste text/images/links, and receive summaries about requirements or missing information.

## Scope

This is a **non-functional prototype** for stakeholder review and user testing. It includes:

- No backend services, API calls, or data processing
- No server actions, API routes, or database connections
- All content is hardcoded or stored in client-side state

## Features

- **Chat interface** — Users can ask clarification questions about documents
- **Input affordances** — Paste text, add images, and insert links (visual only)
- **AI response summaries** — Requirements found, missing information, and action items
- **Brown-scale design** — Professional, warm palette (cream, tan, camel, mocha, espresso)
- **Expand/shrink** — Toggle between full-page and windowed chat view
- **Demo controls** — Toggle typing indicator and clear/restore chat to explore states

## For Developers: Running the Demo

### Prerequisites

- Node.js 18+ (or 20+ recommended)
- npm

### Quick Start

```bash
# Clone the repository (if not already)
git clone git@github.com:jj-javascript/multilingual-ai-document-assistant.git
cd multilingual-ai-document-assistant

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the chat mockup.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server (Turbopack) |
| `npm run build` | Build for production |
| `npm start` | Run production build locally |
| `npm run lint` | Run ESLint |
| `npm run clean` | Remove `.next` build cache (use if you see ENOENT/build errors) |

### Production Build

```bash
npm run build
npm start
```

Serves the app at [http://localhost:3000](http://localhost:3000).

### Project Structure

```
app/
  layout.tsx       # Root layout
  page.tsx         # Chat page (client component)
  globals.css      # Theme tokens and base styles
components/
  chat/            # Chat UI components
  ui/              # Shadcn primitives
lib/
  mock-chat-data.tsx  # Hardcoded conversation data
  utils.ts         # cn() helper
docs/
  UI-STYLE-GUIDE.md   # Design system documentation
```

### UI Style Guide

See [docs/UI-STYLE-GUIDE.md](docs/UI-STYLE-GUIDE.md) for:

- Color palette and CSS variables
- Typography and spacing
- Component usage
- Layout patterns
- Accessibility notes

## Tech Stack

- Next.js 15 (App Router)
- React 19
- Tailwind CSS
- Shadcn/UI (Card, Button, Input, Textarea, ScrollArea, Badge, Avatar)
- Lucide React icons
