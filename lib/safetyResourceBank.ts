import raw from '@/lib/data/safetyResources.json'
import type { RiskNextStep, SafetyResourceBucket } from '@/types'

type StepJson = {
  label: string
  type: 'phone' | 'url' | 'info'
  value?: string
}

function asSteps(s: StepJson[]): RiskNextStep[] {
  return s.map((x) =>
    x.value !== undefined
      ? { label: x.label, type: x.type, value: x.value }
      : { label: x.label, type: x.type }
  )
}

const data = raw as {
  urgentPrefix: StepJson
  verifyOfficialStep: StepJson
  missingExplanationStep: StepJson
  scamPrioritySteps: StepJson[]
  buckets: Record<SafetyResourceBucket, StepJson[]>
}

export const SAFETY_URGENT_PREFIX: RiskNextStep = {
  label: data.urgentPrefix.label,
  type: data.urgentPrefix.type,
}

export const SAFETY_VERIFY_OFFICIAL: RiskNextStep = {
  label: data.verifyOfficialStep.label,
  type: data.verifyOfficialStep.type,
}

export const SAFETY_MISSING_EXPLANATION: RiskNextStep = {
  label: data.missingExplanationStep.label,
  type: data.missingExplanationStep.type,
}

export const SAFETY_SCAM_PRIORITY_STEPS: RiskNextStep[] = asSteps(
  data.scamPrioritySteps
)

export function getBucketSteps(bucket: SafetyResourceBucket): RiskNextStep[] {
  return asSteps(data.buckets[bucket] ?? data.buckets.general)
}
