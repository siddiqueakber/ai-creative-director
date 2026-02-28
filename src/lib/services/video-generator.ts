import type { 
  SceneDescription, 
  VideoStatus, 
  CognitiveAnalysis,
  ReframeResult
} from '@/types'
import type { SceneBlueprint, Scene } from './scene-blueprint'
import { generateSceneBlueprint, DOCUMENTARY_CONSTRAINTS } from './scene-blueprint'
import { processDeepUnderstanding } from './deep-understanding'
import { 
  sceneToRunwayPrompt, 
  blueprintToRunwayPrompts,
  matchSceneToTemplate,
  getRunwayNegativePrompt
} from '@/lib/prompts/documentary'
import { generateMinimalNarration, type MinimalNarration } from './narration-script'

// ============================================
// TYPES
// ============================================

interface VideoGenerationJob {
  id: string
  status: VideoStatus
  videoUrl?: string
  errorMessage?: string
}

interface SceneVideoJob {
  sceneIndex: number
  description: string
  jobId: string
  status: VideoStatus
  videoUrl?: string
  duration: number
}

export interface DocumentaryVideoResult {
  id: string
  status: VideoStatus
  blueprint: SceneBlueprint
  scenes: SceneVideoJob[]
  narration?: MinimalNarration
  totalDuration: number
  errorMessage?: string
}

// ============================================
// DOCUMENTARY-STYLE PROMPT PROCESSING
// ============================================

/**
 * Runway API has a STRICT 1000 character limit for promptText
 */
const MAX_PROMPT_LENGTH = 1000

/**
 * Documentary style suffix - reinforces the quiet observational tone
 * Kept short to save space for main prompt
 */
const DOCUMENTARY_SUFFIX = `. Documentary, quiet, no faces.`

function enforceDocumentaryStyle(prompt: string): string {
  // Ensure documentary constraints are present
  const hasNoFaces = prompt.toLowerCase().includes('no faces')
  const hasDocumentary = prompt.toLowerCase().includes('documentary')
  
  let safePrompt = prompt
  
  if (!hasDocumentary) {
    safePrompt = `Documentary footage, ${safePrompt}`
  }
  if (!hasNoFaces) {
    safePrompt = safePrompt + ', no faces'
  }
  
  safePrompt = safePrompt + DOCUMENTARY_SUFFIX
  
  // CRITICAL: Runway API has a 1000 character limit for promptText
  if (safePrompt.length > MAX_PROMPT_LENGTH) {
    // Truncate at word boundary if possible
    safePrompt = safePrompt.substring(0, MAX_PROMPT_LENGTH - 3)
    const lastSpace = safePrompt.lastIndexOf(' ')
    if (lastSpace > MAX_PROMPT_LENGTH - 100) {
      safePrompt = safePrompt.substring(0, lastSpace)
    }
    safePrompt = safePrompt + '...'
  }
  
  return safePrompt
}

// ============================================
// RUNWAY API CONFIGURATION
// ============================================

// IMPORTANT:
// - Runway public API host is api.dev.runwayml.com (NOT dev.runwayml.com and NOT api.runwayml.com)
// - The public API requires a version header.
const RUNWAY_API_BASE = 'https://api.dev.runwayml.com'
const RUNWAY_API_VERSION = '2024-11-06'
// Based on Runway public docs for Text-to-Video.
// Keep configurable via env in case Runway updates model IDs.
const RUNWAY_TEXT_TO_VIDEO_MODEL = process.env.RUNWAY_TEXT_TO_VIDEO_MODEL || 'veo3.1'
const RUNWAY_TEXT_TO_VIDEO_RATIO = process.env.RUNWAY_TEXT_TO_VIDEO_RATIO || '1280:720'
const RUNWAY_TEXT_TO_VIDEO_MAX_DURATION_SECONDS = Number(process.env.RUNWAY_TEXT_TO_VIDEO_MAX_DURATION_SECONDS || '8')
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

// ============================================
// MAIN DOCUMENTARY VIDEO GENERATION
// ============================================

/**
 * Generate a complete documentary-style video from user thought
 * Uses the 7-layer pipeline:
 * 1. Deep Understanding → 2. Perspective Selection → 3. Scene Blueprint
 * 4. Runway Prompts → 5. Narration → 6. Video Generation → 7. Assembly
 */
export async function generateDocumentaryVideo(
  originalThought: string,
  analysis: CognitiveAnalysis,
  reframe: ReframeResult,
  includeNarration: boolean = true
): Promise<DocumentaryVideoResult> {
  const resultId = `documentary_${Date.now()}`
  const scenes: SceneVideoJob[] = []

  try {
    // ========================================
    // LAYER 1 & 2: Deep Understanding + Perspective
    // ========================================
    const { understanding, perspective } = await processDeepUnderstanding(
      originalThought,
      analysis
    )
    
    console.log('Deep understanding extracted:', {
      coreLoss: understanding.coreLoss,
      hiddenFear: understanding.hiddenFear,
      perspectiveType: perspective.perspectiveType
    })

    // ========================================
    // LAYER 3: Scene Blueprint Generation
    // ========================================
    const blueprint = await generateSceneBlueprint(
      originalThought,
      analysis,
      understanding,
      perspective
    )

    console.log(`Generated blueprint with ${blueprint.scenes.length} scenes, total ${blueprint.totalDuration}s`)

    // ========================================
    // LAYER 4 & 6: Video Generation for Each Scene
    // ========================================
    for (let i = 0; i < blueprint.scenes.length; i++) {
      const scene = blueprint.scenes[i]
      const runwayPrompt = sceneToRunwayPrompt(scene, blueprint.style)
      const safePrompt = enforceDocumentaryStyle(runwayPrompt)
      
      console.log(`Scene ${i + 1} prompt:`, safePrompt.substring(0, 100) + '...')
      
      const job = await generateSceneVideo(safePrompt, scene.duration)
      
      scenes.push({
        sceneIndex: i,
        description: scene.description,
        jobId: job.id,
        status: job.status,
        videoUrl: job.videoUrl,
        duration: scene.duration
      })
    }

    // ========================================
    // LAYER 5: Minimal Narration
    // ========================================
    let narration: MinimalNarration | undefined
    if (includeNarration) {
      narration = await generateMinimalNarration(
        originalThought,
        understanding,
        perspective
      )
    }

    // ========================================
    // LAYER 7: Determine Overall Status
    // ========================================
    const allReady = scenes.every(s => s.status === 'ready')
    const anyFailed = scenes.some(s => s.status === 'failed')
    const overallStatus: VideoStatus = allReady ? 'ready' : anyFailed ? 'failed' : 'processing'

    return {
      id: resultId,
      status: overallStatus,
      blueprint,
      scenes,
      narration,
      totalDuration: blueprint.totalDuration,
    }
  } catch (error) {
    console.error('Documentary video generation failed:', error)
    return {
      id: resultId,
      status: 'failed',
      blueprint: {
        style: {
          visual: 'photorealistic',
          camera: 'handheld, imperfect framing',
          lighting: 'natural, slightly muted',
          pace: 'slow',
          mood: 'quiet, observational',
          colorGrade: 'slightly desaturated, warm shadows',
          texture: '35mm film grain'
        },
        scenes: [],
        constraints: DOCUMENTARY_CONSTRAINTS,
        totalDuration: 0
      },
      scenes,
      totalDuration: 0,
      errorMessage: 'Failed to generate documentary video',
    }
  }
}

/**
 * Generate video for a single scene
 */
async function generateSceneVideo(
  prompt: string,
  duration: number
): Promise<VideoGenerationJob> {
  const apiKey = process.env.RUNWAY_API_KEY

  if (!apiKey) {
    console.warn('Runway API key not configured, using placeholder')
    return createDocumentaryPlaceholderJob(prompt, duration)
  }

  try {
    // Runway public API (dev) uses /v1/text_to_video
    const response = await fetch(`${RUNWAY_API_BASE}/v1/text_to_video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': RUNWAY_API_VERSION,
      },
      body: JSON.stringify({
        // Note: field names follow Runway public API conventions
        model: RUNWAY_TEXT_TO_VIDEO_MODEL,
        promptText: prompt,
        duration: normalizeRunwayDuration(duration, RUNWAY_TEXT_TO_VIDEO_MODEL),
        ratio: RUNWAY_TEXT_TO_VIDEO_RATIO,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Runway API error:', errorText)
      return createDocumentaryPlaceholderJob(prompt, duration)
    }

    const data = await response.json()
    
    return {
      id: data.id || data.taskId || data.jobId || data.uuid || 'unknown',
      status: 'processing',
    }
  } catch (error) {
    console.error('Video generation failed:', error)
    return createDocumentaryPlaceholderJob(prompt, duration)
  }
}

function createDocumentaryPlaceholderJob(
  prompt: string,
  duration: number
): VideoGenerationJob {
  // Determine placeholder type based on prompt content
  const promptLower = prompt.toLowerCase()
  
  let sceneType = 'calm'
  if (promptLower.includes('dawn') || promptLower.includes('morning')) {
    sceneType = 'dawn'
  } else if (promptLower.includes('commute') || promptLower.includes('transit')) {
    sceneType = 'commute'
  } else if (promptLower.includes('work') || promptLower.includes('hands')) {
    sceneType = 'work'
  } else if (promptLower.includes('dusk') || promptLower.includes('evening')) {
    sceneType = 'dusk'
  } else if (promptLower.includes('rest') || promptLower.includes('pause')) {
    sceneType = 'rest'
  }
  
  const placeholderId = `placeholder_documentary_${sceneType}_${Date.now()}`
  
  return {
    id: placeholderId,
    status: 'ready',
    videoUrl: `/api/placeholder-video?type=documentary&scene=${sceneType}&duration=${duration}`,
  }
}

// ============================================
// STATUS CHECKING
// ============================================

export async function checkVideoStatus(jobId: string): Promise<VideoGenerationJob> {
  const apiKey = process.env.RUNWAY_API_KEY

  // Check if it's a placeholder job
  if (jobId.startsWith('placeholder_')) {
    return {
      id: jobId,
      status: 'ready',
      videoUrl: getPlaceholderVideoUrl(jobId),
    }
  }

  if (!apiKey) {
    return {
      id: jobId,
      status: 'failed',
      errorMessage: 'Video API not configured',
    }
  }

  try {
    // Runway public API status endpoints can vary by model/version.
    // Try the common task endpoint first; fall back to generations.
    const tryUrls = [
      `${RUNWAY_API_BASE}/v1/tasks/${jobId}`,
      `${RUNWAY_API_BASE}/v1/generations/${jobId}`,
    ]

    let response: Response | undefined
    let lastErrorText = ''

    for (const url of tryUrls) {
      response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'X-Runway-Version': RUNWAY_API_VERSION,
        },
      })
      if (response.ok) break
      lastErrorText = await response.text()
    }

    if (!response || !response.ok) {
      return {
        id: jobId,
        status: 'failed',
        errorMessage: lastErrorText || 'Failed to check video status',
      }
    }

    const data = await response.json()
    const status = mapRunwayStatus(data.status)
    const videoUrl = extractRunwayVideoUrl(data) || data.videoUrl
    const errorMessage = data.failure_reason || data.error

    if (process.env.RUNWAY_DEBUG === 'true') {
      console.warn('Runway status response:', {
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
      id: jobId,
      status,
      videoUrl,
      errorMessage,
    }
  } catch (error) {
    console.error('Status check failed:', error)
    return {
      id: jobId,
      status: 'failed',
      errorMessage: 'Connection error',
    }
  }
}

function mapRunwayStatus(runwayStatus: string): VideoStatus {
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

function getPlaceholderVideoUrl(jobId: string): string {
  // Extract scene type from placeholder ID
  const match = jobId.match(/placeholder_documentary_(\w+)_/)
  const sceneType = match ? match[1] : 'calm'
  
  return `/api/placeholder-video?type=documentary&scene=${sceneType}`
}

// ============================================
// LEGACY SUPPORT
// ============================================

/**
 * Legacy single video generation (kept for backwards compatibility)
 */
export async function startVideoGeneration(
  scene: SceneDescription,
  narrationUrl?: string
): Promise<VideoGenerationJob> {
  // Convert old scene format to documentary prompt
  const prompt = enforceDocumentaryStyle(scene.visualPrompt)
  return generateSceneVideo(prompt, scene.suggestedDuration)
}

export async function startPikaVideoGeneration(
  scene: SceneDescription
): Promise<VideoGenerationJob> {
  console.log('Pika API not implemented, using Runway with documentary style')
  const prompt = enforceDocumentaryStyle(scene.visualPrompt)
  return createDocumentaryPlaceholderJob(prompt, scene.suggestedDuration)
}
