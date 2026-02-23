import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type SummaryType = "requirements" | "missing" | "action";

export interface QuickSummaryCardProps {
  type: SummaryType;
  title: string;
  items: string[];
  className?: string;
}

const typeConfig: Record<
  SummaryType,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  requirements: { label: "Requirements found", variant: "default" },
  missing: { label: "Missing information", variant: "secondary" },
  action: { label: "Action items", variant: "outline" },
};

export function QuickSummaryCard({
  type,
  title,
  items,
  className,
}: QuickSummaryCardProps) {
  const config = typeConfig[type];

  return (
    <Card
      className={cn(
        "border-chat-assistant-border bg-chat-assistant shadow-sm",
        className
      )}
    >
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center gap-2">
          <Badge variant={config.variant} className="text-xs">
            {config.label}
          </Badge>
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-primary">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
