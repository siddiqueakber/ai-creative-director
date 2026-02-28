import openai from '@/lib/openai'
import { 
  SCENE_GENERATION_SYSTEM_PROMPT, 
  SCENE_GENERATION_USER_PROMPT,
  parseSceneDescription,
  FALLBACK_SCENES,
  generatePhasePrompts,
  getFallbackPhaseScenes
} from '@/lib/prompts/scene'
import type { 
  CognitiveAnalysis, 
  SceneDescription, 
  PhaseSceneDescription,
  VideoPhase,
  EmotionType
} from '@/types'

// Map emotions to fallback scene types (legacy support)
const EMOTION_TO_SCENE: Record<string, keyof typeof FALLBACK_SCENES> = {
  shame: 'warm',
  fear: 'calm',
  anxiety: 'calm',
  sadness: 'hopeful',
  anger: 'grounding',
  guilt: 'warm',
  loneliness: 'warm',
  frustration: 'grounding',
  hopelessness: 'hopeful',
  overwhelm: 'calm',
}

// ============================================
// MULTI-PHASE SCENE GENERATION
// ============================================

export interface MultiPhaseSceneResult {
  phases: PhaseSceneDescription[]
  totalDuration: number
}

export async function generateMultiPhaseScenes(
  originalThought: string,
  analysis: CognitiveAnalysis,
  reframedText: string
): Promise<MultiPhaseSceneResult> {
  const phasePrompts = generatePhasePrompts(analysis, reframedText)
  const phases: PhaseSceneDescription[] = []

  // Generate each phase scene
  for (const phaseNum of [1, 2, 3, 4] as VideoPhase[]) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-5.2',
        messages: [
          { role: 'user', content: phasePrompts[phaseNum] }
        ],
        temperature: 0.8,
        max_completion_tokens: 400,
        response_format: { type: 'json_object' }
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error(`Empty response for phase ${phaseNum}`)
      }

      const parsed = JSON.parse(content)
      
      const phaseNames: Record<VideoPhase, PhaseSceneDescription['phaseName']> = {
        1: 'validation',
        2: 'contrast',
        3: 'reframe',
        4: 'encouragement'
      }

      const defaultDurations: Record<VideoPhase, number> = {
        1: 12,
        2: 25,
        3: 18,
        4: 12
      }

      phases.push({
        phase: phaseNum,
        phaseName: phaseNames[phaseNum],
        visualPrompt: parsed.visualPrompt || '',
        emotionalTone: parsed.emotionalTone || 'calm',
        duration: parsed.duration || defaultDurations[phaseNum],
        colorPalette: parsed.colorPalette || ['#4A90A4', '#7CB9A8', '#F4E8C1', '#2C3E50']
      })

    } catch (error) {
      console.error(`Failed to generate phase ${phaseNum} scene:`, error)
      
      // Use fallback for this phase
      const fallbackScenes = getFallbackPhaseScenes(analysis.emotion as EmotionType)
      phases.push(fallbackScenes[phaseNum - 1])
    }
  }

  // Ensure we have all 4 phases (fill in any gaps with fallbacks)
  const fallbackScenes = getFallbackPhaseScenes(analysis.emotion as EmotionType)
  while (phases.length < 4) {
    phases.push(fallbackScenes[phases.length])
  }

  return {
    phases: phases.sort((a, b) => a.phase - b.phase),
    totalDuration: phases.reduce((sum, p) => sum + p.duration, 0)
  }
}

// ============================================
// LEGACY SINGLE SCENE GENERATION
// ============================================

export async function generateSceneDescription(
  reframedText: string,
  analysis: CognitiveAnalysis
): Promise<SceneDescription> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: SCENE_GENERATION_SYSTEM_PROMPT },
        { role: 'user', content: SCENE_GENERATION_USER_PROMPT(reframedText, analysis) }
      ],
      temperature: 0.8,
      max_completion_tokens: 400,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Empty response from OpenAI')
    }

    const scene = parseSceneDescription(content)
    if (!scene) {
      throw new Error('Failed to parse scene description')
    }

    return scene
  } catch (error) {
    console.error('Scene generation failed:', error)
    
    // Return appropriate fallback scene
    const sceneType = EMOTION_TO_SCENE[analysis.emotion] || 'calm'
    return FALLBACK_SCENES[sceneType]
  }
}

// ============================================
// NARRATION GENERATION
// ============================================

export async function generateNarration(
  text: string,
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova'
): Promise<Buffer> {
  try {
    const response = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: voice,
      input: text,
      speed: 0.85, // Slower for calming, therapeutic effect
    })

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.error('TTS generation failed:', error)
    throw new Error('Failed to generate narration')
  }
}

// Generate narration for each phase
export async function generatePhaseNarrations(
  narrationTexts: string[],
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova'
): Promise<Buffer[]> {
  const narrations: Buffer[] = []

  for (const text of narrationTexts) {
    if (!text) {
      narrations.push(Buffer.alloc(0))
      continue
    }

    try {
      const buffer = await generateNarration(text, voice)
      narrations.push(buffer)
    } catch (error) {
      console.error('Phase narration failed:', error)
      narrations.push(Buffer.alloc(0))
    }
  }

  return narrations
}
