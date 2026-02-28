import type {
  DocumentaryStructure,
  DocumentaryNarration,
  MasterTimelineData,
  MusicPlan,
  MusicActPlan,
  MusicBeatPlan,
  DeepUnderstandingResult,
  PerspectivePostureResult,
} from '../types'

/**
 * Build a high-level music plan from structure, master timeline, and narration.
 * targetDurationSec is derived from the documentary structure's totalDuration so
 * it stays consistent with whatever duration (e.g. 120s) the pipeline is using.
 */
export function buildMusicPlan(
  structure: DocumentaryStructure,
  timeline: MasterTimelineData,
  narration: DocumentaryNarration
): MusicPlan {
  const targetDurationSec = structure.totalDuration

  // Compute act windows based on cumulative act durations
  const acts: MusicActPlan[] = []
  let cursor = 0
  structure.acts.forEach((act, index) => {
    const startSec = cursor
    const endSec = cursor + act.duration
    acts.push({
      index,
      actType: act.actType,
      startSec,
      endSec,
      mood: describeActMood(act.actType),
      intensityCurveHint: describeActIntensityHint(act.actType, structure.intensityLevel),
    })
    cursor = endSec
  })

  // Map beats and mark which ones carry narration
  const narratedTextByBeat = new Map<number, string>()
  narration.segments.forEach((seg) => {
    if (typeof seg.beatIndex === 'number') {
      narratedTextByBeat.set(seg.beatIndex, seg.text)
    }
  })

  const beats: MusicBeatPlan[] = timeline.beats.map((beat) => ({
    startSec: beat.startSec,
    durationSec: beat.durationSec,
    type: beat.beatType,
    actIndex: beat.actIndex,
    hasNarration: beat.beatType === 'narrated' && (beat.narrationText != null || narratedTextByBeat.has(beat.beatIndex)),
  }))

  return {
    targetDurationSec,
    acts,
    beats,
  }
}

function describeActMood(actType: DocumentaryStructure['acts'][number]['actType']): string {
  switch (actType) {
    case 'vast':
      return 'cosmic, sparse, patient, almost no rhythm, wide ambient pads'
    case 'living_dot':
      return 'earthly continuity, gentle motion, subtle pulses, natural textures'
    case 'miracle_of_you':
      return 'intimate, warm, close, small-scale textures and soft piano or guitar'
    case 'return':
      return 'ordinary, neutral, grounded, unobtrusive, quiet closure'
    default:
      return 'quiet, observational ambient bed, non-intrusive'
  }
}

function describeActIntensityHint(
  actType: DocumentaryStructure['acts'][number]['actType'],
  intensityLevel: number
): string {
  const clamped = Math.max(0, Math.min(1, intensityLevel / 10))
  switch (actType) {
    case 'vast':
      return `start very low intensity and stay mostly low; occasional gentle swells. globalIntensity=${clamped.toFixed(
        2
      )}`
    case 'living_dot':
      return `slightly more motion than vast, but still subtle. keep intensity in the low-to-medium range. globalIntensity=${clamped.toFixed(
        2
      )}`
    case 'miracle_of_you':
      return `allow warm harmonic movement and a bit more presence, but no big builds. medium intensity at most. globalIntensity=${clamped.toFixed(
        2
      )}`
    case 'return':
      return `gradually come back down to low intensity by the end, with stable harmony. globalIntensity=${clamped.toFixed(
        2
      )}`
    default:
      return `keep intensity low and stable. globalIntensity=${clamped.toFixed(2)}`
  }
}

/**
 * Build a SHORT style-only prompt for music so Udio (or any music model)
 * generates INSTRUMENTAL MUSIC, not speech. We send only a brief description
 * of the sound: genre, mood, instruments, no lyrics.
 */
export function buildMusicPrompt(
  musicPlan: MusicPlan,
  _understanding: DeepUnderstandingResult,
  perspective: PerspectivePostureResult
): string {
  const firstMood = musicPlan.acts[0]?.mood ?? 'quiet ambient'
  const moodWords = firstMood.split(',').slice(0, 2).join(', ').trim()

  const shortPrompt = [
    'Instrumental only, no vocals, no lyrics, no speech.',
    'Ambient documentary score,',
    moodWords + ',',
    'slow tempo, soft pads, minimal or no drums, contemplative and patient.',
    `Perspective posture: ${perspective.posture}.`,
    'Naturalistic, no cinematic builds or dramatic hits.',
  ].join(' ')

  return shortPrompt
}

/**
 * Udio client config from env. generateMusicTrack uses this to call Udio and return audio URL.
 * without hard depending on an external music provider. When you’re ready to
 */
function getUdioConfig(): {
  apiKey: string
  generateUrl: string
  feedBaseUrl: string
  model: string
  pollMaxMs: number
} | null {
  const provider = process.env.MUSIC_PROVIDER
  const apiKey = process.env.UDIO_API_KEY?.trim()
  const generateUrl = process.env.MUSIC_API_URL?.trim()
  if (provider !== 'udio' || !apiKey || !generateUrl) return null
  const feedBaseUrl = generateUrl.replace(/\/v2\/generate\/?$/i, '')
  const model = process.env.UDIO_MUSIC_MODEL?.trim() || 'chirp-v5'
  const pollMaxMs = Number(process.env.UDIO_MUSIC_POLL_MAX_MS) || 5 * 60 * 1000
  return { apiKey, generateUrl, feedBaseUrl, model, pollMaxMs }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function generateMusicTrack(
  videoId: string,
  musicPlan: MusicPlan,
  prompt: string
): Promise<string | null> {
  const config = getUdioConfig()
  if (!config) {
    console.log(`[Music] Skipping (MUSIC_PROVIDER=${process.env.MUSIC_PROVIDER ?? 'none'} or missing UDIO_API_KEY/MUSIC_API_URL)`)
    return null
  }

  const durationHint = ` Approximately ${Math.round(musicPlan.targetDurationSec / 60)} minutes long.`
  let gptPrompt = (prompt + durationHint).trim()
  if (gptPrompt.length > 400) gptPrompt = gptPrompt.slice(0, 397) + '...'

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
  }

  const MAX_RETRIES = 3
  const RETRY_BASE_MS = 30_000

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = RETRY_BASE_MS * attempt
      console.log(`[Music] Retry ${attempt}/${MAX_RETRIES - 1} after ${backoff / 1000}s backoff...`)
      await sleep(backoff)
    }

    try {
      const createRes = await fetch(config.generateUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          gpt_description_prompt: gptPrompt,
          make_instrumental: true,
          model: config.model,
        }),
      })

      const createBody = (await createRes.json().catch(() => ({}))) as {
        code?: number
        workId?: string
        data?: { task_id?: string }
        message?: string
      }
      const workId = createBody.workId ?? createBody.data?.task_id

      if (!createRes.ok || !workId) {
        const msg = createBody.message ?? ''
        const isRateLimit = createRes.status === 429 || msg.toLowerCase().includes('elevated usage') || msg.toLowerCase().includes('try again')
        console.warn(`[Music] Udio generate failed: ${createRes.status} ${msg}`)
        if (isRateLimit && attempt < MAX_RETRIES - 1) continue
        return null
      }

      const feedUrl = `${config.feedBaseUrl}/v2/feed?workId=${encodeURIComponent(workId)}`
      const startedAt = Date.now()
      const POLL_MS = 9000

      let shouldRetry = false
      while (Date.now() - startedAt < config.pollMaxMs) {
        await sleep(POLL_MS)
        const feedRes = await fetch(feedUrl, { method: 'GET', headers: { Authorization: headers.Authorization } })
        const feedBody = (await feedRes.json().catch(() => ({}))) as {
          data?: {
            response_data?: Array<{
              extra_message?: string
              audio_url?: string
              fail_message?: string
              error_message?: string
            }>
          }
        }

        if (feedRes.status === 404) continue
        if (feedRes.status >= 500) continue

        const list = feedBody.data?.response_data
        if (!Array.isArray(list)) continue

        for (const item of list) {
          if (item.fail_message || item.error_message) {
            const failMsg = item.fail_message ?? item.error_message ?? ''
            const isRateLimit = failMsg.toLowerCase().includes('elevated usage') || failMsg.toLowerCase().includes('try again')
            if (isRateLimit && attempt < MAX_RETRIES - 1) {
              console.warn(`[Music] Udio rate-limited: ${failMsg} — will retry`)
              shouldRetry = true
              break
            }
            console.warn(`[Music] Udio generation failed: ${failMsg}`)
            return null
          }
          if (item.extra_message === 'All generated successfully.' && item.audio_url?.trim()) {
            console.log(`[Music] Udio track ready for videoId=${videoId}: ${item.audio_url.slice(0, 60)}...`)
            return item.audio_url.trim()
          }
        }
        if (shouldRetry) break
      }

      if (shouldRetry) continue

      console.warn('[Music] Udio poll timed out before track was ready')
      return null
    } catch (err) {
      console.error(`[Music] Udio error (attempt ${attempt + 1}):`, err instanceof Error ? err.message : err)
      if (attempt < MAX_RETRIES - 1) continue
      return null
    }
  }

  return null
}

/**
 * Stub for Udio-based narration voice. Currently returns an empty map so the
 * orchestrator will fall back to OpenAI TTS for narration. This keeps the code
 * compiling without requiring Udio to succeed.
 */
export async function generateNarrationAudioViaUdio(
  _narration: DocumentaryNarration
): Promise<Map<number, Buffer>> {
  console.warn('[Udio Narration] Stub called – returning empty map so OpenAI TTS can handle narration.')
  return new Map()
}

