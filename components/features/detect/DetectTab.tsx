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
  TriangleAlertIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useSafetyAnalysis } from '@/hooks/useSafetyAnalysis'
import { useDocumentSession } from '@/hooks/useDocumentSession'
import {
  getSafetyLang,
  SAFETY_LEGITIMACY_LABELS,
  SAFETY_SERIOUSNESS_LABELS,
  SAFETY_SEVERITY_LABELS,
  SAFETY_UI_STRINGS,
  SCAM_ACK_UI_STRINGS,
} from '@/lib/safetyI18n'
import { useEffect, useState } from 'react'
import { useErrorPopup } from '@/hooks/useErrorPopup'
import type { OCRResult, RiskNextStep, SafetyFlags } from '@/types'

export interface DetectTabProps {
  docId: string
  className?: string
  /** User-selected translation target language (drives safety API localization). */
  targetLang?: string
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

  // Use <span className="block"> — parent may be ItemDescription (<p>), where <p> children are invalid.
  if (type === 'url' && value) {
    return (
      <span className="block">
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline underline-offset-2"
        >
          {value}
        </a>
      </span>
    )
  }

  if (type === 'phone' && value) {
    return (
      <span className="block">
        <a
          href={telHref(value)}
          className="font-medium text-primary underline underline-offset-2"
        >
          {value}
        </a>
      </span>
    )
  }

  if (value) {
    return <span className="block">{value}</span>
  }

  return null
}

export function DetectTab({ docId, className, targetLang }: DetectTabProps) {
  const lang = getSafetyLang(targetLang)
  const t = SAFETY_UI_STRINGS[lang]
  const { showError } = useErrorPopup()
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
  } = useSafetyAnalysis(ocr, fieldCandidates, targetLang, docId)

  useEffect(() => {
    if (!docError) return
    showError(t.documentLoadFailed, docError)
  }, [docError, showError, t.documentLoadFailed])

  useEffect(() => {
    if (!safetyError) return
    showError(t.analysisFailedGeneric, safetyError)
  }, [safetyError, showError, t.analysisFailedGeneric])

  const [scamAcknowledged, setScamAcknowledged] = useState(false)
  const [scamReadChecked, setScamReadChecked] = useState(false)

  useEffect(() => {
    setScamAcknowledged(false)
    setScamReadChecked(false)
  }, [docId, flags?.detectedAt])

  if (docLoading) {
    return (
      <div className={`space-y-4 ${className ?? ''}`}>
        <p className="text-sm text-muted-foreground">
          {t.loadingDocContext}
        </p>
      </div>
    )
  }

  if (docError) {
    return <div className={`space-y-4 ${className ?? ''}`} />
  }

  if (!ocr || !ocr.fullText?.trim()) {
    return (
      <div className={`space-y-4 ${className ?? ''}`}>
        <p className="text-sm text-muted-foreground">
          {t.noDocText}
        </p>
      </div>
    )
  }

  if (safetyLoading) {
    return (
      <div className={`space-y-4 ${className ?? ''}`}>
        <p className="text-sm text-muted-foreground">{t.analyzing}</p>
      </div>
    )
  }

  if (safetyError) {
    return <div className={`space-y-4 ${className ?? ''}`} />
  }

  if (!flags || !presentation) {
    return (
      <div className={`space-y-4 ${className ?? ''}`}>
        <p className="text-sm text-muted-foreground">
          {t.noAnalysisData}
        </p>
      </div>
    )
  }

  const riskBody =
    [flags.category, flags.explanation].filter(Boolean).join(' - ') ||
    t.riskBodyFallback

  const effectiveSeverity = flags.riskLevel ?? flags.severity
  const tone = severityToneClasses(effectiveSeverity)
  const seriousnessKey = flags.riskLevel ?? flags.severity
  const seriousnessDisplay =
    SAFETY_SERIOUSNESS_LABELS[lang][seriousnessKey] ??
    SAFETY_SERIOUSNESS_LABELS[lang].medium
  const severityDisplay =
    flags.legitimacy === 'likely_scam'
      ? seriousnessDisplay
      : SAFETY_SEVERITY_LABELS[lang][flags.severity] ?? flags.severity
  const urgencyExtra =
    flags.legitimacy === 'likely_scam' && presentation.urgencyLabel
      ? ` · ${t.urgencyPrefix} ${presentation.urgencyLabel}`
      : ''
  const legitimacyDisplay = flags.legitimacy
    ? SAFETY_LEGITIMACY_LABELS[lang][flags.legitimacy]
    : ''

  const isLikelyScam = flags.legitimacy === 'likely_scam'
  const scamCopy = SCAM_ACK_UI_STRINGS[lang]

  if (isLikelyScam && !scamAcknowledged) {
    return (
      <>
        <Dialog open modal>
          <DialogContent
            showCloseButton={false}
            className="max-h-[90vh] max-w-[calc(100%-1.25rem)] gap-0 overflow-hidden border-2 border-destructive/70 p-0 shadow-2xl ring-destructive/20 sm:max-w-lg"
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader className="space-y-0 border-b border-destructive/25 bg-destructive/10 px-4 py-3 text-left dark:bg-destructive/20">
              <DialogTitle className="text-left">
                <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t.sectionTitle}
                </span>
                <span className="mt-2 flex items-start gap-2 text-lg font-semibold leading-snug text-destructive">
                  <TriangleAlertIcon
                    className="mt-0.5 size-5 shrink-0"
                    aria-hidden
                  />
                  {scamCopy.scamAlertTitle}
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="max-h-[min(52vh,420px)] overflow-y-auto px-4 py-4">
              <p className="text-sm leading-relaxed text-foreground">
                {scamCopy.scamAlertLead}
              </p>
              <ul className="mt-4 list-disc space-y-2.5 pl-5 text-sm leading-relaxed text-foreground">
                <li>{scamCopy.scamBulletNoPayment}</li>
                <li>{scamCopy.scamBulletOfficialOnly}</li>
                <li>{scamCopy.scamBulletNoRush}</li>
              </ul>
            </div>

            <div className="space-y-3 border-t border-border bg-muted/40 px-4 py-4 dark:bg-muted/25">
              <div className="flex gap-3">
                <Checkbox
                  id={`scam-ack-${docId}`}
                  checked={scamReadChecked}
                  onCheckedChange={(v) => setScamReadChecked(v === true)}
                  className="mt-0.5"
                />
                <Label
                  htmlFor={`scam-ack-${docId}`}
                  className="cursor-pointer text-sm font-normal leading-snug text-foreground"
                >
                  {scamCopy.scamAckCheckbox}
                </Label>
              </div>
              <Button
                type="button"
                className="w-full"
                disabled={!scamReadChecked}
                onClick={() => setScamAcknowledged(true)}
              >
                {scamCopy.scamAckButton}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div
          className={`flex min-h-[100px] flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/25 px-4 py-8 text-center ${className ?? ''}`}
          aria-live="polite"
        >
          <p className="max-w-md text-sm text-muted-foreground">
            {scamCopy.scamWaitingHint}
          </p>
        </div>
      </>
    )
  }

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      <Item variant="outline" className={tone}>
        <ItemMedia variant="icon">
          <OctagonAlertIcon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{t.riskLevel}</ItemTitle>
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
          <ItemTitle>{t.confidence}</ItemTitle>
          <ItemDescription>
            <span>
              {flags.confidence != null ? `${flags.confidence}%` : '—'}
              {flags.legitimacy
                ? ` · ${t.legitimacyPrefix} ${legitimacyDisplay}`
                : ''}
              {` · ${t.severityPrefix} ${severityDisplay}${urgencyExtra}`}
            </span>
          </ItemDescription>
        </ItemContent>
      </Item>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t.suggestedNextSteps}
      </div>
      <div className="space-y-4">
        {presentation.primaryActions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noNextSteps}</p>
        ) : (
          presentation.primaryActions.map((action, index) => {
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
          })
        )}
      </div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t.helpfulResources}
      </div>
      <div className="space-y-4">
        {presentation.resources.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t.noLinkedResources}
          </p>
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
                  <ItemDescription className="text-muted-foreground">
                    {resource.value}
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
