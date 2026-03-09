# Multilingual AI Document Assistant

Next.js application with Convex backend.

## Structure

- `app/` - Next.js UI + API routes (upload, summarize, safety)
- `components/` - Shared React components
- `lib/` - Utilities and helpers
- `types/` - Shared TypeScript interfaces
- `convex/` - Backend database + functions
- `tests/` - Integration and E2E tests

## Setup

1. Install dependencies: `npm install`
2. Copy `.env.local.example` to `.env.local` and configure
3. Run Convex: `npm run convex:dev`
4. Run dev server: `npm run dev`
