'use client'

import type React from 'react'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useLanguagePreference } from '@/hooks/useLanguagePreference'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'zh', label: 'Chinese (Simplified)' },
  { code: 'zh-TW', label: 'Chinese (Traditional)' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
  { code: 'ru', label: 'Russian' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'sv', label: 'Swedish' },
  { code: 'tr', label: 'Turkish' },
  { code: 'vi', label: 'Vietnamese' },
] as const

interface LanguagePreferenceProps {
  className?: string
  /** Called after the preference is persisted to EntityDB. */
  onLanguageChange?: (language: string) => void
}

export function LanguagePreference({
  className,
  onLanguageChange,
}: LanguagePreferenceProps): React.JSX.Element {
  const { preferredLanguage, setLanguage, loading } = useLanguagePreference()

  async function handleChange(value: string): Promise<void> {
    try {
      await setLanguage(value)
      onLanguageChange?.(value)
    } catch {
      // Error is surfaced via the hook's `error` state
    }
  }

  if (loading) {
    return <Skeleton className={className ?? 'h-9 w-full rounded-xl'} />
  }

  return (
    <Select
      value={preferredLanguage ?? undefined}
      onValueChange={handleChange}
    >
      <SelectTrigger
        className={className ?? 'w-full h-9 text-sm rounded-xl'}
        aria-label="Preferred language"
      >
        <SelectValue placeholder="Select language" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Preferred language</SelectLabel>
          {LANGUAGES.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
