import raw from '@/lib/data/safetyResources.json'
import type { SafetyLang } from '@/lib/safetyI18n'
import type { RiskNextStep, SafetyResourceBucket } from '@/types'

type LabeledStepJson = {
  labels: Record<string, string>
  type: 'phone' | 'url' | 'info'
  value?: string
}

function labelFor(step: LabeledStepJson, lang: SafetyLang): string {
  return step.labels[lang] ?? step.labels.en ?? ''
}

function asSteps(steps: LabeledStepJson[], lang: SafetyLang): RiskNextStep[] {
  return steps.map((x) =>
    x.value !== undefined
      ? { label: labelFor(x, lang), type: x.type, value: x.value }
      : { label: labelFor(x, lang), type: x.type }
  )
}

const data = raw as {
  urgentPrefix: LabeledStepJson
  verifyOfficialStep: LabeledStepJson
  missingExplanationStep: LabeledStepJson
  scamPrioritySteps: LabeledStepJson[]
  buckets: Record<SafetyResourceBucket, LabeledStepJson[]>
}

export function getUrgentPrefix(lang: SafetyLang): RiskNextStep {
  const u = data.urgentPrefix
  return { label: labelFor(u, lang), type: u.type }
}

export function getVerifyOfficialStep(lang: SafetyLang): RiskNextStep {
  const v = data.verifyOfficialStep
  return { label: labelFor(v, lang), type: v.type }
}

export function getMissingExplanationStep(lang: SafetyLang): RiskNextStep {
  const m = data.missingExplanationStep
  return { label: labelFor(m, lang), type: m.type }
}

export function getScamPrioritySteps(lang: SafetyLang): RiskNextStep[] {
  return asSteps(data.scamPrioritySteps, lang)
}

export function getBucketSteps(
  bucket: SafetyResourceBucket,
  lang: SafetyLang
): RiskNextStep[] {
  return asSteps(data.buckets[bucket] ?? data.buckets.general, lang)
}
