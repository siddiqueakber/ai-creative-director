import type { PrismaClient } from '@prisma/client'
import type { AvoidList, VideoFingerprint } from './types'

const MAX_SNIPPET_LENGTH = 60
const MAX_SNIPPETS = 30

function extractSnippet(text: string | null | undefined): string | null {
  if (!text || typeof text !== 'string') return null
  const trimmed = text.trim()
  if (trimmed.length === 0) return null
  if (trimmed.length <= MAX_SNIPPET_LENGTH) return trimmed
  const firstWords = trimmed.split(/\s+/).slice(0, 8).join(' ')
  return firstWords.length > MAX_SNIPPET_LENGTH
    ? firstWords.slice(0, MAX_SNIPPET_LENGTH - 3) + '...'
    : firstWords
}

/**
 * Load avoid list and optional fingerprints from last N completed videos.
 * Used to reduce repetition across runs (same user or global).
 */
export async function getAvoidListFromLastNVideos(
  prisma: PrismaClient,
  userId: string | null,
  N: number
): Promise<AvoidList> {
  const where: { pipelineStatus: string; thought?: { userId: string } } = {
    pipelineStatus: 'ready',
  }
  if (userId) {
    where.thought = { userId }
  }

  const videos = await prisma.video.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: N,
    include: { scenes: true },
  })

  const actTypes = new Set<string>()
  const settings = new Set<string>()
  const microActions = new Set<string>()
  const promptSnippets = new Set<string>()

  for (const video of videos) {
    for (const scene of video.scenes) {
      if (scene.actType) actTypes.add(scene.actType)
      if (scene.setting) settings.add(scene.setting)
      if (scene.microAction) microActions.add(scene.microAction)
      const snippet =
        extractSnippet(scene.runwayPrompt) || extractSnippet(scene.description)
      if (snippet) promptSnippets.add(snippet)
    }
  }

  const snippetArray = Array.from(promptSnippets).slice(0, MAX_SNIPPETS)
  return {
    actTypes: Array.from(actTypes),
    settings: Array.from(settings),
    microActions: Array.from(microActions),
    promptSnippets: snippetArray,
  }
}

/**
 * Fetch the narration texts from the last N completed videos (for narration avoidance).
 * Returns an array of full narration strings (all segments concatenated per video).
 */
export async function getPreviousNarrationTexts(
  prisma: PrismaClient,
  userId: string | null,
  N: number
): Promise<string[]> {
  const where: { pipelineStatus: string; thought?: { userId: string } } = {
    pipelineStatus: 'ready',
  }
  if (userId) {
    where.thought = { userId }
  }

  const videos = await prisma.video.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: N,
    include: { narrationSegments: { orderBy: { actIndex: 'asc' } } },
  })

  return videos
    .map((video) =>
      video.narrationSegments
        .map((seg) => seg.text)
        .filter(Boolean)
        .join(' ')
    )
    .filter((text) => text.length > 0)
}

/**
 * Build fingerprints from the same last N videos for novelty scoring.
 */
export async function getLastNFingerprints(
  prisma: PrismaClient,
  userId: string | null,
  N: number
): Promise<VideoFingerprint[]> {
  const where: { pipelineStatus: string; thought?: { userId: string } } = {
    pipelineStatus: 'ready',
  }
  if (userId) {
    where.thought = { userId }
  }

  const videos = await prisma.video.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: N,
    include: { scenes: true },
  })

  return videos.map((video) => {
    const motifs = new Set<string>()
    const actTypes = new Set<string>()
    const settings = new Set<string>()
    for (const scene of video.scenes) {
      if (scene.description) motifs.add(scene.description.trim().slice(0, 80))
      if (scene.actType) actTypes.add(scene.actType)
      if (scene.setting) settings.add(scene.setting)
    }
    return {
      motifs: Array.from(motifs),
      actTypes: Array.from(actTypes),
      settings: Array.from(settings),
    }
  })
}
