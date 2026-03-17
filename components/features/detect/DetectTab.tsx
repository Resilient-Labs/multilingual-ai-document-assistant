import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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
  riskLevel?: number
  urgency?: string
  confidence?: ConfidenceBreakdown
  suggestedSteps?: SuggestedStep[]
  className?: string
}

const sectionHeading =
  "scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0"
const bodyText = "leading-7 [&:not(:first-child)]:mt-6"

export function DetectTab({
  riskLevel = 74,
  urgency = "High Urgency: Time Sensitive",
  confidence = { financial: 90, housing: 10, medical: 0 },
  suggestedSteps = [
    {
      title: "Do not use the contact info in the letter",
      description:
        "Scam letters often include fake phone numbers or websites. Instead, independently look up the official company website. Do not call the number on the letter, call the number listed on the company's official site.",
    },
  ],
  className,
}: DetectTabProps) {
  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      <h2 className={sectionHeading}>Risk Level: {riskLevel}%</h2>
      <h2 className={sectionHeading}>{urgency}</h2>
      <h2 className={sectionHeading}>Confidence</h2>
      <p className={bodyText}>{confidence.financial}% Financial</p>
      <p className={bodyText}>{confidence.housing}% Housing</p>
      <p className={bodyText}>{confidence.medical}% Medical</p>
      <h2 className={sectionHeading}>Suggested Next Steps</h2>
      <div className="space-y-4">
        {suggestedSteps.map((step) => (
          <Card key={step.title}>
            <CardHeader>
              <CardTitle>{step.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{step.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
