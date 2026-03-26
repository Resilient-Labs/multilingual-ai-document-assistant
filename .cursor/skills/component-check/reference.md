# Component Check — Reference

## Custom Component Creation Questions

Ask these **one at a time** when gathering requirements:

1. What is the **functional requirement** of this component?
2. What is your **feature or team name**?
3. What is the **current sprint number**?
4. Why weren't components in `components/ui` or `components/shared` sufficient?
5. Are there any **constraints, state requirements, or special behaviors**? (loading states, async data, animations, responsiveness, API integration)

## Interaction Flow

- Ask questions one at a time
- Keep responses concise

## Feature Folder Structure

```
components/features/
  chat/
    ChatInput.tsx
    ChatMessage.tsx
```

Do not place feature components at the root of `components/features`.

## Component Approval Gate

Before finalizing, ask: **Does an existing component already solve at least 80% of this use case?**

- **YES** → Recommend extending that component
- **NO** → Allow creation

Prevents duplicates like: `UserCard`, `UserCard2`, `UserProfileCard`, `UserDisplayCard`

## Slack Announcement Template

```
Added new shared component **ComponentName**.

Reason: [Why it was needed]

Created a **UI PR** with the component implementation.

Backend integration will follow in a separate PR.
```

## Mobile

For phones and tablets (breakpoints, touch targets, `useIsMobile` parity, verification), see **Mobile guidelines** in [SKILL.md](SKILL.md).

## Intelligent Behaviors

- Suggest existing shadcn primitives
- Recommend composition patterns
- Check registry for reuse opportunities
- Discourage unnecessary components
- Encourage reusable design