---
name: component-check
description: Enforces component reuse and design system compliance for React + TypeScript + Tailwind + shadcn/ui. Use when creating or modifying components, when the user asks about UI components, mobile layouts, extending a feature under components/features, or when reviewing component architecture.
---

# Component Check

Acts as a design system gatekeeper. Before allowing any new component, verify reuse opportunities and follow the validation flow.

## UI Architecture

```
components/
├── component-registry.md   # Single source of truth
├── ui/                     # shadcn primitives — DO NOT EDIT
├── shared/                 # Reusable across app
└── features/               # Feature-specific
```

## Absolute Rules

1. **NEVER EDIT `components/ui`**
2. Always compose from shadcn primitives
3. Prefer reuse over creation
4. Custom components must be wrappers
5. Components must follow WCAG 2.1 AA
6. Tailwind styling must follow existing patterns
7. Components must be small and composable
8. Avoid duplicate components
9. Always check the component registry before generating a new component

## Validation Flow (Must Complete Before Creation)

Execute steps in order. Stop and instruct the user if any step fails.

**Step 1 — Registry**

Read `components/component-registry.md`. If a similar component exists (≥80% overlap), recommend extending it.

**Step 2 — UI Primitives**

Check `components/ui`. If primitives exist for the need, require reuse.

**Step 3 — Shared Components**

Check `components/shared`. If a reusable component exists, require reuse.

**Step 4 — shadcn Library**

If the project hasn't installed a relevant shadcn component, recommend installing it from [shadcn/ui](https://ui.shadcn.com) before creating custom.

**Step 5 — Feature Relationship**

If the component is tied to a feature in `components/features`, extend or modify the existing feature component. Do not create a new shared component.

### When the user says the work relates to a current feature

Use this guidance with the user:

> Because it’s tied to a current feature, you should extend or modify an existing feature component instead of creating a new shared component. **Which feature is it for?** I can help you update the right component in `components/features/`.

Then:

1. **Brainstorm** — Help map the requirement onto the existing feature component (props, layout, data). Check `components/component-registry.md` for the right file under `components/features/{feature}/`.
2. **Implement** — Make the change in that feature component (compose shadcn primitives; do not edit `components/ui`).
3. **Verify** — Ask the user to **run the application** and try the flow on their target devices.
4. **Iterate** — Ask whether the change meets their functional requirement; adjust the component until it does (layout, states, copy, responsiveness).

## Custom Component Creation

Only proceed if all validation steps pass. Gather:

1. Functional requirement
2. Feature or team name
3. Current sprint number
4. Why `components/ui` or `components/shared` were insufficient
5. Constraints (loading states, async data, animations, responsiveness, API integration)

Create documentation from answers. Tell the user to keep it for component docs.

## Component Generation Rules

- React + TypeScript
- Import shadcn primitives from `@/components/ui`
- Tailwind styling only
- No business logic
- Clear prop interfaces
- Composable

**Example pattern:**

```tsx
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface UserCardProps {
  name: string
  onAction?: () => void
}

export function UserCard({ name, onAction }: UserCardProps) {
  return (
    <Card className="p-4 space-y-4">
      <div className="text-lg font-semibold">{name}</div>
      <Button onClick={onAction}>Action</Button>
    </Card>
  )
}
```

## Naming and Styling

- **Naming**: PascalCase, descriptive (e.g., `UserCard`, `AgentMessage`, `SearchBar`)
- **Spacing**: `p-4`, `p-6`, `gap-4`, `gap-6`, `space-y-4`
- **Corners**: `rounded-lg`, `rounded-xl`
- **Typography**: `text-sm`, `text-base`, `text-lg`, `font-medium`, `font-semibold`
- **Focus**: All interactive components need `focus-visible:outline-none focus-visible:ring-2`

## Accessibility

All components must support: keyboard navigation, semantic HTML, ARIA labels where needed, visible focus states, accessible color contrast, screen reader compatibility. Follow WCAG 2.1 AA.

## Mobile guidelines

When building or changing UI that must work on phones and tablets:

1. **Responsive layout** — Use Tailwind breakpoints (`sm:`, `md:`, etc.) and flexible layouts (`flex`, `grid`, `min-h-0`, `overflow-auto`) so content does not overflow small viewports. Prefer stacking or scroll regions over fixed heights that clip content.
2. **Touch targets** — Interactive controls (buttons, tabs, links in hit areas) should be large enough to tap (aim for at least ~44×44 CSS px effective target; use padding on small icons).
3. **Feature parity** — If the app already branches on mobile vs desktop (e.g. `useIsMobile` / matchMedia in `hooks/use-mobile.ts`), extend **both** paths when adding behavior unless the requirement is desktop-only; document intentional differences.
4. **Safe areas and chrome** — Avoid placing critical actions flush against notches or home indicators; use padding consistent with existing screens (`p-4`, footer spacing).
5. **Performance** — Avoid heavy animations or large synchronous work on interaction; keep lists virtualized or paginated when they grow.
6. **Verification** — Ask the user to verify on a real device or browser devtools device mode when mobile behavior matters.

## Placement and Registry

**Feature-specific** → `components/features/{feature-name}/` and append to `components/component-registry.md` (Feature components section). `features-doc.md` links to the registry; do not duplicate full entries there.

**Reusable** → `components/shared/` and append to `components/shared/shared-doc.md`

**Registry update** (required for every new component):

```markdown
### ComponentName

Location: components/shared/ComponentName.tsx

Purpose: [Brief description]

Built with: [List primitives used]

Created: Sprint X, Team: [Name]
```

## Post Creation

1. Ask user to run the frontend and verify integration (on real device or device mode when mobile matters)
2. Ask: Does this meet the functional requirement? Iterate if no
3. Instruct: Create UI-only PR; backend integration in separate PR
4. Generate short Slack announcement for the new component

## Strict Restrictions

Never: edit `components/ui`, duplicate components, create monolithic components, skip validation, bypass the registry.

## Additional Reference

For detailed rules and examples, see [reference.md](reference.md).



