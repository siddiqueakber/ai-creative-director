import type { RunwayJobResult, ShotPlan } from '../types'
import { startVertexAIJob, checkVertexAIJob } from '../providers/vertex-ai'
import { isVeoPromptAllowed, replaceWithFallback } from '../orbit-visual-spec'

// ============================================
// ORBIT STYLE LOCKS
// ============================================

const ACT_STYLE_LOCKS: Record<string, string> = {
  vast:
    'Stabilized slow drift. Archival space documentary feel. No handheld. Natural quiet light.',
  living_dot:
    'Steady observational camera. Minimal shake. Natural light. Quiet continuity.',
  miracle_of_you:
    'Intimate close-up of everyday objects and textures. Warm natural light. Stabilized camera. No stylization.',
  return:
    'Ordinary street realism. Steady or static camera. No beauty lighting.',
}

const ORBIT_NEGATIVE_BLOCK =
  'cinematic lighting, epic composition, inspirational tone, motivational imagery, hero narrative, idealized happiness, perfect symmetry, text overlays, titles, logos, slow motion drama, no words in frame, no on-screen text, no watermark, no branding, no letters or captions'

// ============================================
// STYLE LOCK + NEGATIVE APPLICATION
// ============================================

function resolveActType(shot: ShotPlan): NonNullable<ShotPlan['actType']> {
  if (shot.actType) return shot.actType
  switch (shot.actIndex) {
    case 0:
      return 'vast'
    case 1:
      return 'living_dot'
    case 2:
      return 'miracle_of_you'
    case 3:
      return 'return'
    default:
      return 'return'
  }
}

function applyStyleAndNegatives(basePrompt: string, actType: ShotPlan['actType']): string {
  let prompt = basePrompt.trim()
  const styleLock = ACT_STYLE_LOCKS[actType || 'return'] || ACT_STYLE_LOCKS.return
  const hasStyleLock = prompt.includes(styleLock)
  const hasNegative = prompt.includes(ORBIT_NEGATIVE_BLOCK)

  const additions: string[] = []
  if (!hasStyleLock) additions.push(styleLock)
  if (!hasNegative) additions.push(ORBIT_NEGATIVE_BLOCK)

  if (additions.length === 0) return prompt

  const additionsText = additions.join(' ')
  if (prompt.length + additionsText.length + 1 > 950) {
    const maxPromptLength = 950 - additionsText.length - 1
    prompt = `${prompt.substring(0, Math.max(0, maxPromptLength)).trim()}.`
  }

  return `${prompt} ${additionsText}`.trim()
}

function getVeoModel(): string {
  return process.env.VEO_MODEL || 'veo-3.1-generate-001'
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function jitterDelay(): number {
  return 250 + Math.floor(Math.random() * 350)
}

function isRetryableError(error: unknown): boolean {
  if (!error) return false
  const message = error instanceof Error ? error.message : String(error)
  return /rate|limit|timeout|timed? out|429|5\d\d|econnreset|network/i.test(message)
}

// ============================================
// VIDEO GENERATION FOR SHOT PLANS
// ============================================

export async function generateShotVideo(shot: ShotPlan): Promise<RunwayJobResult> {
  const actType = resolveActType(shot)
  let basePrompt = shot.runwayPrompt
  if (!isVeoPromptAllowed(basePrompt)) {
    basePrompt = replaceWithFallback(actType ?? 'return', basePrompt)
  }
  const promptWithStyleLock = applyStyleAndNegatives(basePrompt, actType)

  console.log(`Generating shot ${shot.actIndex}-${shot.clipIndex}:`, {
    source: shot.source,
    actType,
    shotKey: `${shot.actIndex}-${shot.clipIndex}`,
    duration: shot.duration,
    microAction: shot.microAction,
    promptLength: promptWithStyleLock.length,
  })

  return startVertexAIJob(promptWithStyleLock, shot.duration)
}

// ============================================
// BATCH GENERATION
// ============================================

export async function generateMultipleShots(
  shots: ShotPlan[]
): Promise<Map<string, RunwayJobResult>> {
  const results = new Map<string, RunwayJobResult>()
  const promptCache = new Map<string, RunwayJobResult>()
  const model = getVeoModel()

  // Generate shots sequentially to avoid rate limiting
  // In production, you might want to batch these with delays
  for (const shot of shots) {
    const shotKey = `${shot.actIndex}-${shot.clipIndex}`
    const actType = resolveActType(shot)
    let basePrompt = shot.runwayPrompt
    if (!isVeoPromptAllowed(basePrompt)) {
      basePrompt = replaceWithFallback(actType ?? 'return', basePrompt)
    }
    const promptWithLock = applyStyleAndNegatives(basePrompt, actType)
    const cacheKey = `${model}|${shot.duration}|${promptWithLock}`

    try {
      if (promptCache.has(cacheKey)) {
        const cached = promptCache.get(cacheKey)!
        results.set(shotKey, cached)
        console.log(`Reusing cached Runway job for ${shotKey}:`, {
          source: shot.source,
          actType,
          shotKey,
          duration: shot.duration,
          promptLength: promptWithLock.length,
        })
        await sleep(jitterDelay())
        continue
      }

      let attempt = 0
      let result: RunwayJobResult | null = null
      const maxAttempts = 3

      while (attempt < maxAttempts) {
        try {
          result = await startVertexAIJob(promptWithLock, shot.duration)
          break
        } catch (error) {
          attempt += 1
          if (!isRetryableError(error) || attempt >= maxAttempts) {
            throw error
          }
          const backoff = Math.min(2000, 300 * 2 ** attempt)
          await sleep(backoff + jitterDelay())
        }
      }

      if (!result) {
        throw new Error('Runway job did not return a result.')
      }

      results.set(shotKey, result)
      promptCache.set(cacheKey, result)

      // Small jitter delay to avoid rate limiting
      await sleep(jitterDelay())
    } catch (error) {
      console.error(`Failed to generate shot ${shotKey}:`, error)
      results.set(shotKey, {
        jobId: `error_${Date.now()}`,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return results
}

// ============================================
// LEGACY COMPATIBILITY
// ============================================

export async function generateSceneVideo(
  prompt: string,
  duration: number
): Promise<RunwayJobResult> {
  const promptWithLock = applyStyleAndNegatives(prompt, 'return')
  return startVertexAIJob(promptWithLock, duration)
}

export async function pollSceneVideo(jobId: string): Promise<RunwayJobResult> {
  return checkVertexAIJob(jobId)
}
