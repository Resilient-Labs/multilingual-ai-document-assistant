'use client'

import { DownloadIcon, PauseIcon, PlayIcon, RotateCcwIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const
const WAVE_LEVELS = [35, 70, 45, 82, 55, 68, 40, 88, 52, 74, 48, 64] as const

type Props = {
  audioRef: RefObject<HTMLAudioElement | null>
  audioUrl: string
  text: string
  className?: string
}

type WordTiming = {
  start: number
  end: number
}

function getSpeechWeight(token: string) {
  const chars = Array.from(token)
  let spokenChars = 0

  for (const char of chars) {
    const isDigit = char >= '0' && char <= '9'
    const isLetter = char.toLowerCase() !== char.toUpperCase()
    if (isDigit || isLetter) {
      spokenChars += 1
    }
  }

  let pauseWeight = 0
  if (/\.{3}$/.test(token) || /…$/.test(token)) {
    pauseWeight += 6
  } else if (/[.!?]$/.test(token)) {
    pauseWeight += 5
  } else if (/[,:;]$/.test(token)) {
    pauseWeight += 2.5
  } else if (/[-–—]$/.test(token)) {
    pauseWeight += 1.5
  }

  return Math.max(1, spokenChars) + pauseWeight
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function findActiveWordIndex(progress: number, timings: WordTiming[]) {
  let lo = 0
  let hi = timings.length - 1

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const timing = timings[mid]
    if (progress < timing.start) {
      hi = mid - 1
      continue
    }
    if (progress > timing.end) {
      lo = mid + 1
      continue
    }
    return mid
  }

  return clamp(lo, 0, Math.max(0, timings.length - 1))
}

export function TtsPlaybackVisual({
  audioRef,
  audioUrl,
  text,
  className,
}: Props) {
  const words = useMemo(
    () =>
      text
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0),
    [text]
  )

  const timings = useMemo<WordTiming[]>(() => {
    if (words.length === 0) return []

    const wordWeights = words.map(getSpeechWeight)

    const totalWeight = wordWeights.reduce((sum, weight) => sum + weight, 0)
    let runningWeight = 0

    return wordWeights.map((weight) => {
      const start = runningWeight / totalWeight
      runningWeight += weight
      const end = runningWeight / totalWeight
      return { start, end }
    })
  }, [words])

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null)
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([])
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    let rafId: number | null = null

    const syncFromAudio = () => {
      const nextDuration =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : 0
      const nextCurrentTime = audio.currentTime || 0
      const nextRate = audio.playbackRate || 1
      const playing = !audio.paused && !audio.ended

      setDuration(nextDuration)
      setCurrentTime(nextCurrentTime)
      setPlaybackRate(nextRate)
      setIsPlaying(playing)

      if (nextDuration <= 0 || timings.length === 0) {
        setActiveWordIndex(null)
        return
      }

      const progress = clamp(nextCurrentTime / nextDuration, 0, 1)
      setActiveWordIndex(findActiveWordIndex(progress, timings))
    }

    const stopRaf = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    }

    const startRaf = () => {
      stopRaf()
      const tick = () => {
        syncFromAudio()
        if (!audio.paused && !audio.ended) {
          rafId = requestAnimationFrame(tick)
        }
      }
      rafId = requestAnimationFrame(tick)
    }

    const handlePlay = () => {
      syncFromAudio()
      startRaf()
    }

    const handlePauseOrEnded = () => {
      syncFromAudio()
      stopRaf()
    }

    audio.addEventListener('loadedmetadata', syncFromAudio)
    audio.addEventListener('durationchange', syncFromAudio)
    audio.addEventListener('timeupdate', syncFromAudio)
    audio.addEventListener('seeked', syncFromAudio)
    audio.addEventListener('ratechange', syncFromAudio)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePauseOrEnded)
    audio.addEventListener('ended', handlePauseOrEnded)

    syncFromAudio()

    return () => {
      stopRaf()
      audio.removeEventListener('loadedmetadata', syncFromAudio)
      audio.removeEventListener('durationchange', syncFromAudio)
      audio.removeEventListener('timeupdate', syncFromAudio)
      audio.removeEventListener('seeked', syncFromAudio)
      audio.removeEventListener('ratechange', syncFromAudio)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePauseOrEnded)
      audio.removeEventListener('ended', handlePauseOrEnded)
    }
  }, [audioRef, timings])

  useEffect(() => {
    if (activeWordIndex === null) return
    const target = wordRefs.current[activeWordIndex]
    target?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'smooth',
    })
  }, [activeWordIndex])

  if (words.length === 0) return null

  async function togglePlayPause() {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused || audio.ended) {
      try {
        await audio.play()
      } catch {
        // Browser autoplay restrictions can still block this.
      }
      return
    }

    audio.pause()
  }

  function seek(seconds: number) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = clamp(seconds, 0, duration || 0)
  }

  function rewindByFiveSeconds() {
    const audio = audioRef.current
    if (!audio) return
    seek((audio.currentTime || 0) - 5)
  }

  function updatePlaybackRate(value: number) {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = value
  }

  return (
    <section
      className={cn(
        'tts-ai-player flex flex-col gap-4 rounded-xl border px-4 py-4',
        className
      )}
      aria-label="AI read aloud"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium">AI Read Aloud</p>
          <div
            className={cn('tts-wave', isPlaying && 'tts-wave-playing')}
            aria-hidden="true"
          >
            {WAVE_LEVELS.map((height, i) => (
              <span
                // Stable sequence for decorative bars.
                key={i}
                className="tts-wave-bar"
                style={{
                  height: `${height}%`,
                  animationDelay: `${i * 75}ms`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={togglePlayPause}
          className="gap-2"
        >
          {isPlaying ? (
            <>
              <PauseIcon className="size-4" />
              Pause
            </>
          ) : (
            <>
              <PlayIcon className="size-4" />
              Play
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={rewindByFiveSeconds}
          className="gap-2"
        >
          <RotateCcwIcon className="size-4" />
          -5s
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <a href={audioUrl} download="translated-audio">
            <DownloadIcon className="size-4" />
            Download
          </a>
        </Button>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Speed
          <select
            value={playbackRate}
            onChange={(event) => updatePlaybackRate(Number(event.target.value))}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            aria-label="Playback speed"
          >
            {PLAYBACK_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate}x
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-2">
        <input
          type="range"
          min={0}
          max={Math.max(duration, 0.01)}
          step={0.01}
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => seek(Number(event.target.value))}
          className="tts-seek w-full"
          aria-label="Seek audio"
          style={{
            backgroundSize: `${clamp(progressPercent, 0, 100)}% 100%`,
          }}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div
        className="tts-readalong-script max-h-52 overflow-y-auto rounded-md border border-border/60 bg-background/80 px-3 py-2 text-left text-base leading-relaxed"
        aria-label="Read-along text"
      >
        {words.map((word, i) => (
          <span
            key={`${i}-${word}`}
            ref={(node) => {
              wordRefs.current[i] = node
            }}
            className={cn(
              'tts-readalong-word',
              activeWordIndex === i && 'tts-readalong-word-active'
            )}
          >
            {word}
          </span>
        ))}
      </div>
    </section>
  )
}
