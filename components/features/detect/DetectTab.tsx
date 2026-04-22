'use client'

import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'

import {
  ExternalLinkIcon,
  Clock4Icon,
  ShieldAlertIcon,
  OctagonAlertIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { useSafetyAnalysis } from '@/hooks/useSafetyAnalysis'
import { useDocumentSession } from '@/hooks/useDocumentSession'
import type { OCRResult, RiskNextStep, SafetyFlags } from '@/types'

export interface DetectTabProps {
  docId: string
  className?: string
}

type EffectiveSeverity = NonNullable<SafetyFlags['riskLevel']> | SafetyFlags['severity']

function severityToneClasses(severity: EffectiveSeverity): string {
  switch (severity) {
    case 'low':
      return 'bg-green-50 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900'
    case 'medium':
      return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900'
    case 'high':
      return 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900'
    case 'urgent':
    default:
      return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900'
  }
}

function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits ? `tel:${digits}` : `tel:${phone.trim()}`
}

function PrimaryActionDescription({ action }: { action: RiskNextStep }) {
  const { type, value } = action

  if (type === 'url' && value) {
    return (
      <p>
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline underline-offset-2"
        >
          {value}
        </a>
      </p>
    )
  }

  if (type === 'phone' && value) {
    return (
      <p>
        <a
          href={telHref(value)}
          className="font-medium text-primary underline underline-offset-2"
        >
          {value}
        </a>
      </p>
    )
  }

  if (value) {
    return <p>{value}</p>
  }

  return null
}

export function DetectTab({ docId, className }: DetectTabProps) {
  const {
    data,
    loading: docLoading,
    error: docError,
  } = useDocumentSession(docId)
  const ocr: OCRResult | null = data?.ocr ?? null
  const fieldCandidates = data?.fieldCandidates ?? null
  const {
    flags,
    presentation,
    loading: safetyLoading,
    error: safetyError,
  } = useSafetyAnalysis(ocr, fieldCandidates)

  if (docLoading) {
    return (
      <div className={`space-y-4 ${className ?? ''}`}>
        <p className="text-sm text-muted-foreground">
          Loading document context...
        </p>
      </div>
    )
  }

  if (docError) {
    return (
      <div className={`space-y-4 ${className ?? ''}`}>
        <p className="text-sm text-muted-foreground">{docError}</p>
      </div>
    )
  }

  if (!ocr || !ocr.fullText?.trim()) {
    return (
      <div className={`space-y-4 ${className ?? ''}`}>
        <p className="text-sm text-muted-foreground">
          No document text available for safety analysis.
        </p>
      </div>
    )
  }

  if (safetyLoading) {
    return (
      <div className={`space-y-4 ${className ?? ''}`}>
        <p className="text-sm text-muted-foreground">Analyzing document...</p>
      </div>
    )
  }

  if (safetyError) {
    return (
      <div className={`space-y-4 ${className ?? ''}`}>
        <p className="text-sm text-muted-foreground">
          Safety analysis could not be completed. {safetyError}
        </p>
      </div>
    )
  }

  if (!flags || !presentation) {
    return (
      <div className={`space-y-4 ${className ?? ''}`}>
        <p className="text-sm text-muted-foreground">
          No analysis data available. Try again later.
        </p>
      </div>
    )
  }

  const riskBody =
    [flags.category, flags.explanation].filter(Boolean).join(' - ') ||
    'Risk category was identified, but no explanation was provided.'

  const effectiveSeverity = flags.riskLevel ?? flags.severity
  const tone = severityToneClasses(effectiveSeverity)

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      <Item variant="outline" className={tone}>
        <ItemMedia variant="icon">
          <OctagonAlertIcon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Risk Level</ItemTitle>
          <ItemDescription className="line-clamp-none whitespace-normal text-current/90">
            {riskBody}
          </ItemDescription>
        </ItemContent>
      </Item>
      <Badge variant="secondary" className={tone}>
        <Clock4Icon />
        <span>{presentation.severityLabel}</span>
      </Badge>
      <Item variant="muted">
        <ItemContent>
          <ItemTitle>Confidence</ItemTitle>
          <ItemDescription>
            <span>
              {flags.confidence != null ? `${flags.confidence}%` : '—'}
              {flags.legitimacy
                ? ` · Legitimacy: ${flags.legitimacy.replace(/_/g, ' ')}`
                : ''}
              {` · Severity: ${flags.severity}`}
            </span>
          </ItemDescription>
        </ItemContent>
      </Item>
      <div className="text-lg font-semibold">Suggested Next Steps</div>
      <div className="space-y-4">
        {presentation.primaryActions.map((action, index) => {
          const desc = <PrimaryActionDescription action={action} />
          const showDesc = Boolean(
            (action.type === 'url' && action.value) ||
            (action.type === 'phone' && action.value) ||
            (action.type === 'info' && action.value)
          )
          return (
            <Item key={`${action.label}-${action.type}-${index}`}>
              <ItemMedia variant="icon">
                <ShieldAlertIcon data-icon="inline-start" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{action.label}</ItemTitle>
                {showDesc ? <ItemDescription>{desc}</ItemDescription> : null}
              </ItemContent>
              {(action.type === 'url' || action.type === 'phone') &&
              action.value ? (
                <ItemActions>
                  <ExternalLinkIcon className="size-4" />
                </ItemActions>
              ) : null}
            </Item>
          )
        })}
      </div>
      <div className="text-lg font-semibold">Helpful Resources</div>
      <div className="space-y-4">
        {presentation.resources.length === 0 ? (
          <p className="text-sm text-muted-foreground">No linked resources.</p>
        ) : (
          presentation.resources.map((resource, index) => (
            <Item key={`${resource.label}-${resource.value}-${index}`}>
              <ItemMedia variant="icon">
                <ExternalLinkIcon className="size-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  {resource.type === 'url' && resource.value ? (
                    <a
                      href={resource.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary underline underline-offset-2"
                    >
                      {resource.label}
                    </a>
                  ) : resource.type === 'phone' && resource.value ? (
                    <a
                      href={telHref(resource.value)}
                      className="font-medium text-primary underline underline-offset-2"
                    >
                      {resource.label}
                    </a>
                  ) : (
                    resource.label
                  )}
                </ItemTitle>
                {resource.value ? (
                  <ItemDescription>
                    <p className="text-muted-foreground">{resource.value}</p>
                  </ItemDescription>
                ) : null}
              </ItemContent>
            </Item>
          ))
        )}
      </div>
      {presentation.disclaimer ? (
        <p className="text-xs text-muted-foreground">
          {presentation.disclaimer}
        </p>
      ) : null}
    </div>
  )
}
