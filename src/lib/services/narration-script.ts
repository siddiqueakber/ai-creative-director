import openai from '@/lib/openai'
import type { CognitiveAnalysis, ReframeResult } from '@/types'
import type { DeepUnderstanding, PerspectiveSelection } from './deep-understanding'

export interface NarrationPhase {
  phase: 1 | 2 | 3 | 4
  name: 'validation' | 'contrast' | 'reframe' | 'encouragement'
  duration: number // seconds
  text: string
}

export interface NarrationScript {
  phases: NarrationPhase[]
  totalDuration: number
  disclaimer: string
}

// ============================================
// NEW: MINIMAL NARRATION (Documentary Style)
// ============================================

/**
 * Minimal narration for documentary-style videos
 * Three parts only: Validation → Shared Perspective → Agency
 * Total ~30-45 seconds of spoken word
 */
export interface MinimalNarration {
  validation: string      // Acknowledge the weight (8-12 seconds)
  sharedPerspective: string  // Broader human truth (15-20 seconds)
  agency: string          // "You're still here" (8-10 seconds)
  totalDuration: number
  disclaimer: string
}

const MINIMAL_NARRATION_PROMPT = `You are writing a brief, quiet narration for a documentary-style reflection video.

STYLE:
- Quiet, observational, like a voiceover in a documentary
- NO motivational speaker energy
- NO "you can do this" cheerleading
- Short sentences. Breathing space between thoughts.
- Second person ("you") but not demanding

STRUCTURE (exactly 3 parts):
1. VALIDATION (8-12 seconds spoken): Name the weight they're carrying. Build trust. Don't fix.
2. SHARED PERSPECTIVE (15-20 seconds): A broader truth about human experience. NOT "others have it worse." NOT comparison. Just shared humanity.
3. AGENCY (8-10 seconds): Acknowledge they're still here. One small possible step. No promises.

RULES (non-negotiable):
- NO comparison of suffering
- NO "be grateful" language
- NO empty promises
- NO toxic positivity
- NO "everything happens for a reason"
- The word "but" should rarely appear after validation

Respond with JSON: {"validation": "...", "sharedPerspective": "...", "agency": "..."}`

const NARRATION_SYSTEM_PROMPT = `You are a compassionate narrator for therapeutic reflection videos. Your voice is warm, calm, and grounded—like a trusted friend, not a motivational speaker.

CRITICAL RULES:
1. NEVER use "others have it worse" or any comparison of suffering
2. NEVER use guilt-based gratitude ("be grateful because...")
3. NEVER dismiss or minimize the feeling
4. ALWAYS validate first, then gently widen perspective
5. Focus on AGENCY and SELF-COMPASSION, not shame
6. Use "you" language—speak directly to the person
7. Keep sentences short and breathing-paced
8. End with ONE small, actionable step—not grand transformation

PHASE STRUCTURE:
- Phase 1 (Validation): Acknowledge the weight they're carrying. Build trust.
- Phase 2 (Contrast): Gently show that struggle is universal—NOT to diminish theirs, but to reduce isolation.
- Phase 3 (Reframe): Offer a new perspective on their specific situation.
- Phase 4 (Encouragement): Give them agency. One small step. Not "fix everything."

Respond with JSON containing four phases, each with "phase", "name", "duration", and "text" fields.`

const NARRATION_USER_PROMPT = (
  originalThought: string,
  analysis: CognitiveAnalysis,
  reframe: ReframeResult
) => `Create a 4-phase narration script for this person's experience:

ORIGINAL THOUGHT:
"${originalThought}"

EMOTION: ${analysis.emotion}
INTENSITY: ${analysis.intensity}/10
THEMES: ${analysis.themes.join(', ')}

VALIDATION STATEMENT (use as inspiration for Phase 1):
"${reframe.validationStatement}"

REFRAMED PERSPECTIVE (use for Phase 3):
"${reframe.reframedText}"

PERSPECTIVE SHIFTS:
${(reframe.perspectiveShifts ?? []).map((s: string | { from: string; to: string }, i: number) => `${i + 1}. ${typeof s === 'string' ? s : s.from}`).join('\n')}

Generate the 4-phase narration script. Each phase should be natural, flowing, and speakable in the given duration.

Phase durations:
- Phase 1 (Validation): 12 seconds
- Phase 2 (Contrast): 25 seconds  
- Phase 3 (Reframe): 18 seconds
- Phase 4 (Encouragement): 12 seconds

Remember: Phase 2 is about showing RESILIENCE in everyday life, not suffering. Show people carrying invisible weight with quiet dignity—not to compare pain, but to remind the viewer they are not alone in struggling.`

export async function generateNarrationScript(
  originalThought: string,
  analysis: CognitiveAnalysis,
  reframe: ReframeResult
): Promise<NarrationScript> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: NARRATION_SYSTEM_PROMPT },
        { role: 'user', content: NARRATION_USER_PROMPT(originalThought, analysis, reframe) }
      ],
      temperature: 0.7,
      max_completion_tokens: 1000,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Empty response from OpenAI')
    }

    const parsed = JSON.parse(content)
    const phases: NarrationPhase[] = parsed.phases || []

    // Validate and normalize phases
    const normalizedPhases = normalizePhases(phases)

    return {
      phases: normalizedPhases,
      totalDuration: normalizedPhases.reduce((sum, p) => sum + p.duration, 0),
      disclaimer: 'This experience is meant to support reflection, not replace professional care.'
    }
  } catch (error) {
    console.error('Narration script generation failed:', error)
    return generateFallbackScript(analysis, reframe)
  }
}

function normalizePhases(phases: NarrationPhase[]): NarrationPhase[] {
  const phaseDefaults: Array<{ name: NarrationPhase['name']; duration: number }> = [
    { name: 'validation', duration: 12 },
    { name: 'contrast', duration: 25 },
    { name: 'reframe', duration: 18 },
    { name: 'encouragement', duration: 12 }
  ]

  return phaseDefaults.map((def, index) => {
    const existingPhase = phases.find(p => p.phase === index + 1 || p.name === def.name)
    return {
      phase: (index + 1) as 1 | 2 | 3 | 4,
      name: def.name,
      duration: existingPhase?.duration || def.duration,
      text: existingPhase?.text || ''
    }
  })
}

function generateFallbackScript(
  analysis: CognitiveAnalysis,
  reframe: ReframeResult
): NarrationScript {
  const emotionResponses: Record<string, { validation: string; contrast: string }> = {
    shame: {
      validation: "Right now, something feels deeply wrong. Like you're carrying a weight that others can't see. That feeling is real, and it's heavy.",
      contrast: "All around you, people wake up each day carrying their own invisible weights. The colleague who smiles through exhaustion. The stranger on the bus lost in thought. We all carry what we don't show."
    },
    fear: {
      validation: "There's an uncertainty pressing on you. A worry that won't quiet down. Your mind is trying to protect you, even when it feels overwhelming.",
      contrast: "Every day, countless people step into uncertainty. The first day at a new job. A difficult conversation ahead. Fear walks with us all—it's how we keep moving that matters."
    },
    anxiety: {
      validation: "Your thoughts are racing, circling, demanding attention. It feels like standing in a storm that only you can feel.",
      contrast: "Right now, millions of people are breathing through their own storms. The student before an exam. The parent waiting for news. Anxiety visits us all—you're not alone in this."
    },
    sadness: {
      validation: "There's a heaviness in you right now. A weight that makes even simple things feel hard. This feeling is valid.",
      contrast: "Across the world, people carry quiet sadnesses. Losses that don't show. Hopes that feel distant. We grieve in private, together."
    },
    hopelessness: {
      validation: "It feels like nothing will change. Like you've tried, and tried, and the path forward has disappeared.",
      contrast: "Every morning, people rise without knowing how the day will go. The night-shift worker heading home. The student starting over. They don't have certainty—just the next step."
    },
    overwhelm: {
      validation: "Everything feels like too much. The list never ends, and you're running on empty.",
      contrast: "All around you, people are learning to pause. To breathe between tasks. To accept that done is better than perfect. Rest isn't giving up—it's how we keep going."
    },
    loneliness: {
      validation: "There's an ache that comes from feeling unseen. Like you're in a crowd but somehow separate.",
      contrast: "In coffee shops and quiet rooms, people sit with their own solitude. Connection isn't always visible. Sometimes it's a stranger's nod, a shared silence, a moment of being seen."
    },
    frustration: {
      validation: "Something isn't working the way it should. You've given effort, and it feels like nothing moves.",
      contrast: "Every day, people practice patience they don't feel. The artist starting over. The worker fixing the same mistake. Progress hides in repetition."
    },
    anger: {
      validation: "There's a fire in you that demands attention. Something feels deeply unfair, and that anger is telling you something matters.",
      contrast: "Across every city, people channel their fire into motion. The advocate working late. The parent protecting what matters. Anger, held wisely, can become purpose."
    },
    guilt: {
      validation: "You're carrying something you wish you could undo. The weight of 'I should have' presses on you.",
      contrast: "Every person alive carries regrets they don't speak. Mistakes that taught them. Moments they'd choose differently. Being imperfect is the most human thing there is."
    }
  }

  const emotionData = emotionResponses[analysis.emotion] || emotionResponses.overwhelm

  return {
    phases: [
      {
        phase: 1,
        name: 'validation',
        duration: 12,
        text: emotionData.validation
      },
      {
        phase: 2,
        name: 'contrast',
        duration: 25,
        text: emotionData.contrast
      },
      {
        phase: 3,
        name: 'reframe',
        duration: 18,
        text: reframe.reframedText ?? reframe.essayText ?? ''
      },
      {
        phase: 4,
        name: 'encouragement',
        duration: 12,
        text: "You don't need to fix everything today. Just take one honest step forward. One breath. One small action. That's how lives change—not all at once, but moment by moment."
      }
    ],
    totalDuration: 67,
    disclaimer: 'This experience is meant to support reflection, not replace professional care.'
  }
}

// Generate TTS audio for each phase
export async function generatePhaseAudio(
  phases: NarrationPhase[],
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova'
): Promise<Map<number, Buffer>> {
  const audioMap = new Map<number, Buffer>()

  for (const phase of phases) {
    if (!phase.text) continue

    try {
      const response = await openai.audio.speech.create({
        model: 'tts-1-hd',
        voice: voice,
        input: phase.text,
        speed: 0.85, // Slower for calming effect
      })

      const arrayBuffer = await response.arrayBuffer()
      audioMap.set(phase.phase, Buffer.from(arrayBuffer))
    } catch (error) {
      console.error(`TTS generation failed for phase ${phase.phase}:`, error)
    }
  }

  return audioMap
}

// ============================================
// MINIMAL NARRATION GENERATION (Documentary Style)
// ============================================

/**
 * Generate minimal narration using deep understanding
 * This is the new preferred method for documentary-style videos
 */
export async function generateMinimalNarration(
  originalThought: string,
  understanding: DeepUnderstanding,
  perspective: PerspectiveSelection
): Promise<MinimalNarration> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: MINIMAL_NARRATION_PROMPT },
        { role: 'user', content: `Create minimal narration for this person:

THEIR THOUGHT:
"${originalThought}"

DEEP UNDERSTANDING (not visible to them):
- Core loss: ${understanding.coreLoss}
- Hidden fear: ${understanding.hiddenFear}
- Emotional state: ${understanding.emotionalState.join(', ')}
- Existential question: ${understanding.existentialQuestion}

PERSPECTIVE TO CONVEY:
Type: ${perspective.perspectiveType}
Message: ${perspective.message}

THINGS TO AVOID (specific to this person):
${perspective.avoid.map(a => `- ${a}`).join('\n')}

Create the 3-part minimal narration.` }
      ],
      temperature: 0.6,
      max_completion_tokens: 500,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Empty response')
    }

    const parsed = JSON.parse(content)

    return {
      validation: parsed.validation || "This is hard. What you're feeling is real.",
      sharedPerspective: parsed.sharedPerspective || perspective.message,
      agency: parsed.agency || "You're still here. That matters.",
      totalDuration: estimateNarrationDuration(
        [parsed.validation, parsed.sharedPerspective, parsed.agency].join(' ')
      ),
      disclaimer: 'This experience supports reflection, not professional care.'
    }
  } catch (error) {
    console.error('Minimal narration generation failed:', error)
    return generateMinimalFallback(understanding, perspective)
  }
}

function generateMinimalFallback(
  understanding: DeepUnderstanding,
  perspective: PerspectiveSelection
): MinimalNarration {
  // Map emotional states to validation text
  const validationTemplates: Record<string, string> = {
    shame: "You're carrying something that feels too heavy to name. That weight is real.",
    grief: "Something has been lost. The ache of it doesn't need explaining.",
    exhaustion: "You've been running on empty. The tiredness isn't weakness—it's honest.",
    rage: "Something feels deeply wrong. That fire in you is paying attention.",
    despair: "The path forward has gone dark. You're not sure it exists anymore.",
    loneliness: "You're surrounded, but somehow unreached. That invisibility hurts.",
    fear: "Uncertainty presses in. Your mind won't stop searching for safety.",
    guilt: "You're carrying something you wish you could undo. It loops in your mind.",
    confusion: "Nothing makes sense right now. The ground keeps shifting.",
    numbness: "Feeling nothing can be its own kind of heavy. You're still here."
  }

  // Get validation based on primary emotional state
  const primaryEmotion = understanding.emotionalState[0] || 'exhaustion'
  const validation = validationTemplates[primaryEmotion] || 
    "What you're experiencing is real. It doesn't need to be justified."

  // Map perspective types to shared perspective text
  const sharedPerspectives: Record<string, string> = {
    shared_human_struggle: "All around you, people carry weights that don't show. Different burdens, different contexts—but the act of carrying is universal. This doesn't minimize yours. It means you're not alone in struggling.",
    universal_uncertainty: "No one really knows if they're doing it right. The confident faces you see are often hiding the same prompts you're carrying. Doubt is not your failure—it's the human condition.",
    common_silent_burden: "Millions wake up tired today. Millions pause at windows, wondering. You're not defective for feeling this—you're human. The struggle is shared, even when invisible.",
    collective_perseverance: "People keep moving without certainty. The early commute. The late shift. No guarantees—just the next moment. Persistence doesn't require clarity. Just presence.",
    impermanence_of_states: "This feeling is real, but it is not permanent. States shift. What feels endless rarely is. You've survived difficult moments before, even when you couldn't see the way through.",
    dignity_in_effort: "The effort itself has meaning. Not because it's rewarded, but because you chose to try. That choice—repeated daily, often invisibly—is where dignity lives."
  }

  const sharedPerspective = sharedPerspectives[perspective.perspectiveType] || 
    perspective.message

  // Agency statement
  const agency = "You're still here. Not because everything is okay—but because you keep showing up. One breath. One moment. That's enough for now."

  return {
    validation,
    sharedPerspective,
    agency,
    totalDuration: 40, // Approximate
    disclaimer: 'This experience supports reflection, not professional care.'
  }
}

function estimateNarrationDuration(text: string): number {
  // Average speaking rate: ~130-150 words per minute for calm narration
  // We use 140 WPM = ~2.3 words per second
  const words = text.split(/\s+/).length
  const seconds = Math.ceil(words / 2.3)
  return seconds
}

// Generate TTS for minimal narration
export async function generateMinimalNarrationAudio(
  narration: MinimalNarration,
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova'
): Promise<{
  validation?: Buffer
  sharedPerspective?: Buffer
  agency?: Buffer
}> {
  const result: {
    validation?: Buffer
    sharedPerspective?: Buffer
    agency?: Buffer
  } = {}

  const parts = [
    { key: 'validation' as const, text: narration.validation },
    { key: 'sharedPerspective' as const, text: narration.sharedPerspective },
    { key: 'agency' as const, text: narration.agency }
  ]

  for (const part of parts) {
    if (!part.text) continue

    try {
      const response = await openai.audio.speech.create({
        model: 'tts-1-hd',
        voice: voice,
        input: part.text,
        speed: 0.8, // Slower for documentary style
      })

      const arrayBuffer = await response.arrayBuffer()
      result[part.key] = Buffer.from(arrayBuffer)
    } catch (error) {
      console.error(`TTS generation failed for ${part.key}:`, error)
    }
  }

  return result
}
