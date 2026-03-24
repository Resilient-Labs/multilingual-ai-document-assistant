# Component Registry

Single source of truth for all components.

## Feature Components

### DocumentTabs

Location: components/features/tabs-layout/DocumentTabs.tsx

Purpose: Tab container that accepts pluggable content for Detect and Ask tabs. Composes shadcn Tabs with slots for detectContent and askContent.

Built with:
- Tabs
- TabsList
- TabsTrigger
- TabsContent

Created: Tabs layout

### DetectTab

Location: components/features/detect/DetectTab.tsx

Purpose: Detect feature content — document analysis results (risk level, urgency, confidence, suggested steps). Plugs into DocumentTabs.

Built with:
- Card
- CardHeader
- CardTitle
- CardContent

Created: Detect feature

### AskTab

Location: components/features/ask/AskTab.tsx

Purpose: Ask feature content — Q&A or question interface for documents. Plugs into DocumentTabs.

Built with: (primitive-free, layout only)

Created: Ask feature
