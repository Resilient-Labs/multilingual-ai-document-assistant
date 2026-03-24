// import {
//   Card,
//   CardContent,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card"

import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"

import { ExternalLinkIcon, Clock4Icon, ShieldAlertIcon, OctagonAlertIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"

export interface SuggestedStep {
  title: string
  description: string
}

export interface ConfidenceBreakdown {
  financial: number
  housing: number
  medical: number
}

export interface DetectTabProps {
  riskLevel?: number,
  riskLevelDescription?: string,
  urgency?: string
  confidence?: ConfidenceBreakdown
  suggestedSteps?: SuggestedStep[]
  className?: string
}

// const bodyText = "leading-7 [&:not(:first-child)]:mt-6"

export function DetectTab({
  riskLevel = 74,
  riskLevelDescription = " chance this document is not legitimate. Be aware of contacting or sharing sensitive information.",
  urgency = "High Urgency: Time Sensitive",
  confidence = { financial: 90, housing: 10, medical: 0 },
  suggestedSteps = [
    {
      title: "Do not use the contact info in the letter",
      description:
        "Do not call the number on the letter, call the number listed on the company's official site.",
    },
    {
      title: "Contact the supposed issuer directly",
      description:
        "Go to their official website and call the verified customer service number to confirm legitimacy.",
    }
  ],
  className,
}: DetectTabProps) {
  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      <Item variant="outline" className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
        <ItemMedia variant="icon">
          <OctagonAlertIcon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Risk Level</ItemTitle>
          <ItemDescription>
            {riskLevel}%
            {riskLevelDescription}
          </ItemDescription>
        </ItemContent>
      </Item>
      <Badge variant="secondary" className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
        <Clock4Icon />
        <span>{urgency}</span>
      </Badge>
      <Item variant="muted">
        <ItemContent>
          <ItemTitle>Confidence</ItemTitle>
          <ItemDescription>
            <span>
              {confidence.financial}% Financial | {confidence.housing}% Housing | {confidence.medical}% Medical
            </span>
          </ItemDescription>
        </ItemContent>
      </Item>
      <div className="text-lg font-semibold">Suggested Next Steps</div>
      <div className="space-y-4">
        {suggestedSteps.map((step) => (
          <Item key={step.title}>
            <ItemMedia variant="icon">
              <ShieldAlertIcon data-icon="inline-start" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{step.title}</ItemTitle>
              <ItemDescription><p>{step.description}</p></ItemDescription>
            </ItemContent>
            <ItemActions>
              <ExternalLinkIcon className="size-4" />
            </ItemActions>
          </Item>

          // <Card key={step.title}>
          //   <CardHeader>
          //     <CardTitle>{step.title}</CardTitle>
          //   </CardHeader>
          //   <CardContent>
          //     <p>{step.description}</p>
          //   </CardContent>
          // </Card>
        ))}
      </div>
    </div>
  )
}
