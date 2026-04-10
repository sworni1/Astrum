import { useCallback, useState } from 'react'

export type SentimentLabel = 'POSITIVE' | 'NEGATIVE' | 'UNKNOWN'

export interface SentimentResult {
  label: SentimentLabel
  score: number
  meta?: {
    detectedLanguage?: 'ru' | 'en' | 'unknown'
    translate_error?: string
  }
}

const SENTIMENT_TIMEOUT_MS = 30_000

function getSentimentPredictUrl(): string {
  return '/api-gateway/sentiment/predict'
}

export function useReviewSentiment(): {
  sentiment: SentimentResult | null
  isPredicting: boolean
  predictSentiment: (text: string) => Promise<SentimentResult>
  resetSentiment: () => void
} {
  const [sentiment, setSentiment] = useState<SentimentResult | null>(null)
  const [isPredicting, setIsPredicting] = useState<boolean>(false)

  const resetSentiment = useCallback((): void => {
    setSentiment(null)
  }, [])

  const predictSentiment = useCallback(async (text: string) => {
    const predictUrl = getSentimentPredictUrl()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), SENTIMENT_TIMEOUT_MS)
    setIsPredicting(true)
    try {
      const response = await fetch(predictUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
        credentials: 'include',
      })
      if (!response.ok) {
        const fallback: SentimentResult = { label: 'UNKNOWN', score: 0 }
        setSentiment(fallback)
        return fallback
      }
      const payload = (await response.json()) as SentimentResult
      const label: SentimentLabel =
        payload.label === 'POSITIVE' ||
        payload.label === 'NEGATIVE' ||
        payload.label === 'UNKNOWN'
          ? payload.label
          : 'UNKNOWN'
      const score = typeof payload.score === 'number' ? payload.score : 0
      const normalized: SentimentResult = { ...payload, label, score }
      setSentiment(normalized)
      return normalized
    } catch {
      const fallback: SentimentResult = { label: 'UNKNOWN', score: 0 }
      setSentiment(fallback)
      return fallback
    } finally {
      clearTimeout(timeout)
      setIsPredicting(false)
    }
  }, [])

  return { sentiment, isPredicting, predictSentiment, resetSentiment }
}

