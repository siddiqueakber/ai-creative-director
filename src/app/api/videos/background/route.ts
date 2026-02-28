import { NextResponse } from 'next/server'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

const MAX_BACKGROUND_VIDEOS = 10

function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

async function getLocalVideoUrls(): Promise<string[]> {
  try {
    const publicDir = join(process.cwd(), 'public', 'generated')
    const files = await readdir(publicDir)
    const mp4 = files.filter((f) => f.toLowerCase().endsWith('.mp4'))
    return mp4.slice(0, MAX_BACKGROUND_VIDEOS).map((f) => `/generated/${f}`)
  } catch {
    return []
  }
}

/**
 * GET returns a list of recent completed video URLs for use as background.
 * Uses DB first; if DB fails (e.g. quota), falls back to .mp4 files in public/generated/.
 */
export async function GET() {
  let urls: string[] = []

  try {
    const videos = await prisma.video.findMany({
      where: {
        pipelineStatus: 'ready',
        finalVideoUrl: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_BACKGROUND_VIDEOS,
      select: { finalVideoUrl: true },
    })

    urls = videos
      .map((v) => v.finalVideoUrl)
      .filter((url): url is string => url != null && url.length > 0)
      .map(normalizeUrl)
  } catch (err: unknown) {
    const isQuotaOrAdapter =
      err instanceof Error &&
      (err.name === 'DriverAdapterError' || /quota|data transfer|exceeded/i.test(err.message))
    if (isQuotaOrAdapter) {
      console.warn('[API /videos/background] Database quota exceeded, using local files.')
    } else {
      console.error('[API /videos/background]', err)
    }
  }

  if (urls.length === 0) {
    urls = await getLocalVideoUrls()
  }

  return NextResponse.json({ urls })
}
