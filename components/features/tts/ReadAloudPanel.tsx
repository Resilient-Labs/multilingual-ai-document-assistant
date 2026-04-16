'use client'

import { useEffect, useRef, useState } from 'react'
import { Volume2Icon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Spinner } from '@/components/ui/spinner'
import { TtsPlaybackVisual } from '@/components/features/tts/TtsPlaybackVisual'
import { isDeepgramLanguage } from '@/lib/tts/deepgram-voices'
import type { Gender, SpanishAccent } from '@/lib/tts/types'

const SPANISH_ACCENTS: Array<{ label: string; value: SpanishAccent }> = [
  { label: 'Argentine', value: 'argentine' },
  { label: 'Colombian', value: 'colombian' },
  { label: 'Latin American', value: 'latin-american' },
  { label: 'Mexican', value: 'mexican' },
  { label: 'Peninsular', value: 'peninsular' },
]

type ReadAloudPanelProps = {
  text: string
  language: string
  disabled?: boolean
  labelSuffix?: string
}

export function ReadAloudPanel({
  text,
  language,
  disabled = false,
  labelSuffix,
}: ReadAloudPanelProps) {
  const [isReadAloudOpen, setIsReadAloudOpen] = useState(false)
  const [ttsLoading, setTtsLoading] = useState(false)
  const [ttsError, setTtsError] = useState<string | null>(null)
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null)
  const [voiceGender, setVoiceGender] = useState<Gender>('feminine')
  const [spanishAccent, setSpanishAccent] =
    useState<SpanishAccent>('latin-american')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const showGenderFilter = isDeepgramLanguage(language)
  const showSpanishAccentFilter = language === 'es'
  const hasVoiceFilters = showGenderFilter || showSpanishAccentFilter
  const isReadAloudDisabled = disabled || text.trim().length === 0

  useEffect(() => {
    return () => {
      if (ttsAudioUrl) {
        URL.revokeObjectURL(ttsAudioUrl)
      }
    }
  }, [ttsAudioUrl])

  useEffect(() => {
    if (!ttsAudioUrl || !audioRef.current) return

    const maybePlay = async () => {
      try {
        await audioRef.current?.play()
      } catch {
        setTtsError('Audio is ready. Tap Play in AI Read Aloud to start playback.')
      }
    }

    void maybePlay()
  }, [ttsAudioUrl])

  async function handleReadAloudGenerate() {
    if (isReadAloudDisabled) return

    setTtsLoading(true)
    setTtsError(null)
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          targetLang: language,
          gender: showGenderFilter ? voiceGender : 'feminine',
          spanishAccent: language === 'es' ? spanishAccent : undefined,
        }),
      })

      if (!response.ok) {
        let errorMessage = 'Read Aloud failed'
        try {
          const data = await response.json()
          errorMessage = data.error ?? errorMessage
        } catch {
          // Keep fallback message when response body is not JSON.
        }
        throw new Error(errorMessage)
      }

      const audioBlob = await response.blob()
      if (audioBlob.size === 0) {
        throw new Error('Generated audio was empty. Please try again.')
      }

      const nextAudioUrl = URL.createObjectURL(audioBlob)
      setTtsAudioUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl)
        }
        return nextAudioUrl
      })
      setIsReadAloudOpen(false)
    } catch (err) {
      setTtsError(err instanceof Error ? err.message : 'Read Aloud failed')
    } finally {
      setTtsLoading(false)
    }
  }

  function handleReadAloudClick() {
    if (isReadAloudDisabled) return

    if (hasVoiceFilters) {
      setIsReadAloudOpen(true)
      return
    }

    void handleReadAloudGenerate()
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={handleReadAloudClick}
          disabled={ttsLoading || isReadAloudDisabled}
        >
          {ttsLoading && !hasVoiceFilters ? (
            <Spinner className="size-4" aria-hidden="true" />
          ) : (
            <Volume2Icon className="size-4" />
          )}
          {ttsLoading && !hasVoiceFilters ? 'Generating audio...' : 'Read Aloud'}
        </Button>
      </div>

      {ttsLoading && !hasVoiceFilters && (
        <p className="text-xs text-muted-foreground">
          Generating audio for {labelSuffix ?? language}. This can take a few
          seconds.
        </p>
      )}

      <div className="grid gap-2">
        {ttsAudioUrl && text && (
          <TtsPlaybackVisual audioRef={audioRef} audioUrl={ttsAudioUrl} text={text} />
        )}
        <audio
          ref={audioRef}
          src={ttsAudioUrl ?? undefined}
          className="sr-only"
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
        >
          Your browser does not support audio playback.
        </audio>
        {!ttsAudioUrl && (
          <p className="text-xs text-muted-foreground">
            No audio generated yet. Click Read Aloud.
          </p>
        )}
      </div>

      {ttsError && (
        <Alert variant="destructive">
          <AlertTitle>Read Aloud failed</AlertTitle>
          <AlertDescription>{ttsError}</AlertDescription>
        </Alert>
      )}

      <Dialog
        open={isReadAloudOpen && hasVoiceFilters}
        onOpenChange={setIsReadAloudOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Read Aloud voice settings</DialogTitle>
            <DialogDescription>
              Choose voice filters before generating speech audio.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {showGenderFilter && (
              <div className="grid gap-2">
                <Label>Gender</Label>
                <RadioGroup
                  value={voiceGender}
                  onValueChange={(value) => setVoiceGender(value as Gender)}
                  className="grid gap-3"
                >
                  <label className="flex items-center gap-2 rounded-md border border-border p-2">
                    <RadioGroupItem value="feminine" id="voice-feminine" />
                    <span>Feminine</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-md border border-border p-2">
                    <RadioGroupItem value="masculine" id="voice-masculine" />
                    <span>Masculine</span>
                  </label>
                </RadioGroup>
              </div>
            )}

            {showSpanishAccentFilter && (
              <div className="grid gap-2">
                <Label>Accent</Label>
                <RadioGroup
                  value={spanishAccent}
                  onValueChange={(value) => setSpanishAccent(value as SpanishAccent)}
                  className="grid gap-2"
                >
                  {SPANISH_ACCENTS.map((accent) => (
                    <label
                      key={accent.value}
                      className="flex items-center gap-2 rounded-md border border-border p-2"
                    >
                      <RadioGroupItem value={accent.value} id={accent.value} />
                      <span>{accent.label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsReadAloudOpen(false)}
              disabled={ttsLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleReadAloudGenerate}
              disabled={ttsLoading || isReadAloudDisabled}
              className="gap-2"
            >
              {ttsLoading && <Spinner className="size-4" aria-hidden="true" />}
              {ttsLoading ? 'Generating...' : 'Start'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
