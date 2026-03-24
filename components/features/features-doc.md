# Feature Components Documentation

## Tabs Layout

### DocumentTabs

Tab container with pluggable slots for Detect and Ask content.

**Props:**
- `detectContent` (ReactNode): Content for the Detect tab
- `askContent` (ReactNode): Content for the Ask tab
- `className` (string): Optional Tailwind classes

**Usage:** `app/dashboard/page.tsx` — composes DetectTab and AskTab

## Detect

### DetectTab

Document analysis results — risk level, urgency, confidence breakdown, suggested steps.

**Props:**
- `riskLevel` (number): Risk percentage, default 74
- `urgency` (string): Urgency label, default "High Urgency: Time Sensitive"
- `confidence` (object): `{ financial, housing, medical }` percentages
- `suggestedSteps` (array): `{ title, description }[]` for step cards
- `className` (string): Optional Tailwind classes

**Usage:** Plugs into DocumentTabs as detectContent

## Ask

### AskTab

Ask feature content — placeholder for Q&A or question interface.

**Props:**
- `className` (string): Optional Tailwind classes

**Usage:** Plugs into DocumentTabs as askContent
