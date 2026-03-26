"use client"

import { useEffect, useState } from "react"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"

import {
  ExternalLinkIcon,
  Clock4Icon,
  ShieldAlertIcon,
  OctagonAlertIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { useSafetyAnalysis } from "@/hooks/useSafetyAnalysis"
import type { OCRResult, RiskNextStep } from "@/types"

export interface DetectTabProps {
  className?: string
}

const CURRENT_DOC_ID_KEY = "current-doc-id"
const TRANSLATE_SESSION_PREFIX = "translate-"

interface TranslateSessionPayload {
  fullText?: unknown
}

function resolveCurrentTranslateSessionKey(): string | null {
  const currentDocId = sessionStorage.getItem(CURRENT_DOC_ID_KEY)?.trim()
  if (currentDocId) {
    const key = `${TRANSLATE_SESSION_PREFIX}${currentDocId}`
    if (sessionStorage.getItem(key)) {
      return key
    }
  }

  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index)
    if (key?.startsWith(TRANSLATE_SESSION_PREFIX)) {
      return key
    }
  }
  return null
}

function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  return digits ? `tel:${digits}` : `tel:${phone.trim()}`
}

function PrimaryActionDescription({ action }: { action: RiskNextStep }) {
  const { type, value } = action

  if (type === "url" && value) {
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

  if (type === "phone" && value) {
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

export function DetectTab({ className }: DetectTabProps) {
  const [ocr, setOcr] = useState<OCRResult | null>(null)
  const [documentLookupError, setDocumentLookupError] = useState<string | null>(
    null
  )
  const [documentReady, setDocumentReady] = useState(false)

  useEffect(() => {
    try {
      const key = resolveCurrentTranslateSessionKey()
      if (!key) {
        setOcr(null)
        setDocumentLookupError(
          "No uploaded document found in this session. Upload a document to run safety analysis."
        )
        return
      }

      const raw = sessionStorage.getItem(key)
      if (!raw) {
        setOcr(null)
        setDocumentLookupError(
          "Document data is unavailable in this session. Please upload again."
        )
        return
      }

      const parsed = JSON.parse(raw) as TranslateSessionPayload
      const fullText =
        typeof parsed.fullText === "string" ? parsed.fullText.trim() : ""
      if (!fullText) {
        setOcr(null)
        setDocumentLookupError(
          "Uploaded document has no readable text for safety analysis."
        )
        return
      }

      const documentId = key.slice(TRANSLATE_SESSION_PREFIX.length)
      setOcr({
        documentId,
        fullText,
        blocks: [],
      })
      setDocumentLookupError(null)
    } catch {
      setOcr(null)
      setDocumentLookupError(
        "Unable to read uploaded document data from session storage."
      )
    } finally {
      setDocumentReady(true)
    }
  }, [])

  const { flags, presentation, loading, error } = useSafetyAnalysis(ocr)

  if (!documentReady) {
    return (
      <div className={`space-y-4 ${className ?? ""}`}>
        <p className="text-sm text-muted-foreground">
          Loading document context...
        </p>
      </div>
    )
  }

  if (documentLookupError) {
    return (
      <div className={`space-y-4 ${className ?? ""}`}>
        <p className="text-sm text-muted-foreground">{documentLookupError}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`space-y-4 ${className ?? ""}`}>
        <p className="text-sm text-muted-foreground">Analyzing document...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`space-y-4 ${className ?? ""}`}>
        <p className="text-sm text-muted-foreground">
          Safety analysis could not be completed. {error}
        </p>
      </div>
    )
  }

  if (!flags || !presentation) {
    return (
      <div className={`space-y-4 ${className ?? ""}`}>
        <p className="text-sm text-muted-foreground">
          No analysis data available. Try again later.
        </p>
      </div>
    )
  }

  const riskBody =
    [flags.category, flags.explanation].filter(Boolean).join(" - ") ||
    "Risk category was identified, but no explanation was provided."

  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      <Item
        variant="outline"
        className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      >
        <ItemMedia variant="icon">
          <OctagonAlertIcon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Risk Level</ItemTitle>
          <ItemDescription>{riskBody}</ItemDescription>
        </ItemContent>
      </Item>
      <Badge
        variant="secondary"
        className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      >
        <Clock4Icon />
        <span>{presentation.severityLabel}</span>
      </Badge>
      <Item variant="muted">
        <ItemContent>
          <ItemTitle>Confidence</ItemTitle>
          <ItemDescription>
            <span>
              {flags.confidence != null
                ? `${flags.confidence}%`
                : "—"}
              {flags.legitimacy
                ? ` · Legitimacy: ${flags.legitimacy.replace(/_/g, " ")}`
                : ""}
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
            (action.type === "url" && action.value) ||
              (action.type === "phone" && action.value) ||
              (action.type === "info" && action.value)
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
            {(action.type === "url" || action.type === "phone") &&
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
                  {resource.type === "url" && resource.value ? (
                    <a
                      href={resource.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary underline underline-offset-2"
                    >
                      {resource.label}
                    </a>
                  ) : resource.type === "phone" && resource.value ? (
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
        <p className="text-xs text-muted-foreground">{presentation.disclaimer}</p>
      ) : null}
    </div>
  )
}
