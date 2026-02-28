import type { RunwayJobResult } from '../types'

const RUNWAY_API_BASE = 'https://api.dev.runwayml.com'
const RUNWAY_API_VERSION = '2024-11-06'
const RUNWAY_TEXT_TO_VIDEO_MODEL = process.env.RUNWAY_TEXT_TO_VIDEO_MODEL || 'veo3.1'
const RUNWAY_TEXT_TO_VIDEO_RATIO = process.env.RUNWAY_TEXT_TO_VIDEO_RATIO || '1280:720'
const RUNWAY_TEXT_TO_VIDEO_MAX_DURATION_SECONDS = Number(
  process.env.RUNWAY_TEXT_TO_VIDEO_MAX_DURATION_SECONDS || '8'
)
const RUNWAY_MODEL_DURATION_MAP: Record<string, number[]> = {
  'gen4.5': [5, 8, 10],
  gen3a_turbo: [5, 8, 10],
  veo3: [4, 6, 8],
  'veo3.1': [4, 6, 8],
  veo3_1_fast: [4, 6, 8],
  'veo3.1_fast': [4, 6, 8],
}

function getAllowedDurations(model: string): number[] {
  return RUNWAY_MODEL_DURATION_MAP[model] || [5, 8, 10]
}

function normalizeRunwayDuration(duration: number, model: string): number {
  const allowed = getAllowedDurations(model)
  if (!Number.isFinite(duration) || duration <= 0) return allowed[0]
  const clamped = Math.min(duration, RUNWAY_TEXT_TO_VIDEO_MAX_DURATION_SECONDS)
  return allowed.reduce((nearest, current) =>
    Math.abs(current - clamped) < Math.abs(nearest - clamped) ? current : nearest
  )
}

function mapRunwayStatus(runwayStatus: string): RunwayJobResult['status'] {
  switch (runwayStatus) {
    case 'SUCCEEDED':
    case 'SUCCESS':
    case 'COMPLETED':
      return 'ready'
    case 'FAILED':
    case 'ERROR':
    case 'CANCELLED':
      return 'failed'
    case 'PENDING':
    case 'RUNNING':
    case 'IN_PROGRESS':
      return 'processing'
    default:
      return 'pending'
  }
}

function extractRunwayVideoUrl(data: any): string | undefined {
  return (
    data?.output?.[0]?.url ||
    data?.output?.url ||
    data?.output?.video?.url ||
    data?.outputs?.[0]?.url ||
    data?.result?.url ||
    data?.result?.[0]?.url ||
    data?.video?.url ||
    data?.artifacts?.[0]?.url ||
    data?.asset?.url ||
    data?.assets?.[0]?.url
  )
}

export async function startRunwayJob(prompt: string, duration: number): Promise<RunwayJobResult> {
  const apiKey = process.env.RUNWAY_API_KEY
  if (!apiKey) {
    return {
      jobId: `placeholder_${Date.now()}`,
      status: 'ready',
      videoUrl: `/api/placeholder-video?type=documentary&scene=calm&duration=${duration}`,
    }
  }

  const response = await fetch(`${RUNWAY_API_BASE}/v1/text_to_video`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Runway-Version': RUNWAY_API_VERSION,
    },
    body: JSON.stringify({
      model: RUNWAY_TEXT_TO_VIDEO_MODEL,
      promptText: prompt,
      duration: normalizeRunwayDuration(duration, RUNWAY_TEXT_TO_VIDEO_MODEL),
      ratio: RUNWAY_TEXT_TO_VIDEO_RATIO,
      audio: false, // Optional: enable audio generation
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    return {
      jobId: `error_${Date.now()}`,
      status: 'failed',
      errorMessage: errorText || 'Runway API error',
    }
  }

  const data = await response.json()
  return {
    jobId: data.id || data.taskId || data.jobId || data.uuid || 'unknown',
    status: 'processing',
  }
}

export async function checkRunwayJob(jobId: string): Promise<RunwayJobResult> {
  const apiKey = process.env.RUNWAY_API_KEY
  if (!apiKey) {
    return { jobId, status: 'failed', errorMessage: 'Runway API not configured' }
  }

  try {
    const tryUrls = [
      `${RUNWAY_API_BASE}/v1/tasks/${jobId}`,
      `${RUNWAY_API_BASE}/v1/generations/${jobId}`,
    ]

    let response: Response | undefined
    let lastErrorText = ''
    for (const url of tryUrls) {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'X-Runway-Version': RUNWAY_API_VERSION,
        },
      })
      if (response.ok) break
      lastErrorText = await response.text()
    }

    if (!response || !response.ok) {
      return {
        jobId,
        status: 'failed',
        errorMessage: lastErrorText || 'Failed to check video status',
      }
    }

    const data = await response.json()
    const status = mapRunwayStatus(data.status)
    const videoUrl = extractRunwayVideoUrl(data) || data.videoUrl
    const errorMessage = data.failure_reason || data.error

    if (process.env.RUNWAY_DEBUG === 'true') {
      console.warn('Runway task response:', {
        jobId,
        status: data.status,
        videoUrl: videoUrl ? 'present' : 'missing',
        errorMessage,
      })
    }

    if (status === 'ready' && !videoUrl) {
      console.warn('Runway task completed but no video URL returned:', data)
    }

    return {
      jobId,
      status,
      videoUrl,
      errorMessage,
    }
  } catch (error) {
    console.error('Runway status check failed:', error)
    return { jobId, status: 'failed', errorMessage: 'Connection error' }
  }
}
