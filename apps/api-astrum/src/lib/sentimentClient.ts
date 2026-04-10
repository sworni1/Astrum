export interface SentimentResult {
  readonly label: 'POSITIVE' | 'NEGATIVE' | 'UNKNOWN'
  readonly score: number
  readonly detectedLanguage?: 'ru' | 'en' | 'unknown'
  readonly translate_error?: string
}

const DEFAULT_TIMEOUT_MS = 30_000

function getSentimentServiceUrl(): string | null {
  const raw = process.env.SENTIMENT_SERVICE_URL
  if (!raw) return null
  return raw.replace(/\/+$/, '')
}

export async function predictSentiment(
  text: string,
): Promise<SentimentResult> {
  const baseUrl = getSentimentServiceUrl()
  if (!baseUrl) return { label: 'UNKNOWN', score: 0 }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  try {
    const response = await fetch(`${baseUrl}/predict`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    })
    if (!response.ok) return { label: 'UNKNOWN', score: 0 }
    const payload = (await response.json()) as {
      label?: string
      score?: number
      meta?: { detectedLanguage?: string; translate_error?: string }
    }
    const label =
      payload.label === 'POSITIVE' || payload.label === 'NEGATIVE'
        ? payload.label
        : 'UNKNOWN'
    const score = typeof payload.score === 'number' ? payload.score : 0
    const detectedLanguageRaw = payload.meta?.detectedLanguage
    const detectedLanguage =
      detectedLanguageRaw === 'ru' ||
      detectedLanguageRaw === 'en' ||
      detectedLanguageRaw === 'unknown'
        ? detectedLanguageRaw
        : undefined
    const translate_error =
      typeof payload.meta?.translate_error === 'string'
        ? payload.meta.translate_error
        : undefined
    return { label, score, detectedLanguage, translate_error }
  } catch {
    return { label: 'UNKNOWN', score: 0 }
  } finally {
    clearTimeout(timeout)
  }
}

