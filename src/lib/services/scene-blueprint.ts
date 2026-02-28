import openai from '@/lib/openai'
import type { DeepUnderstanding, PerspectiveSelection } from './deep-understanding'
import type { CognitiveAnalysis } from '@/types'

// ============================================
// SCENE BLUEPRINT GENERATOR
// Creates observational, documentary-style scenes
// Rule: Video depicts the world, NOT the user's exact life
// ============================================

export interface SceneStyle {
  visual: 'photorealistic'
  camera: 'handheld, imperfect framing'
  lighting: 'natural, slightly muted'
  pace: 'slow'
  mood: 'quiet, observational'
  colorGrade: 'slightly desaturated, warm shadows'
  texture: '35mm film grain'
}

export interface Scene {
  description: string
  symbolism: string  // What this scene represents (internal use)
  duration: number   // Seconds
  timeOfDay: 'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk' | 'evening' | 'night'
  setting: 'urban' | 'suburban' | 'rural' | 'interior' | 'transit' | 'workplace' | 'public_space'
}

export interface SceneBlueprint {
  style: SceneStyle
  scenes: Scene[]
  constraints: string[]
  totalDuration: number
}

// Documentary style constraints - NON-NEGOTIABLE
const DOCUMENTARY_CONSTRAINTS = [
  'no dramatic expressions',
  'no hero narrative',
  'no poverty exploitation',
  'no identifiable faces in distress',
  'no cinematic effects',
  'no idealized happiness',
  'no motivational imagery',
  'no before/after transformation',
  'handheld imperfect framing always',
  'natural lighting only',
  'quiet observational mood',
  'no text or graphics overlaid',
  'no slow motion drama'
]

const SCENE_BLUEPRINT_PROMPT = `You are a documentary filmmaker creating observational footage that shows everyday reality - NOT the user's specific life.

Your footage should feel like it was captured unintentionally, witnessing life as it happens.

CORE RULE: The video never depicts the user's exact situation. It depicts the world continuing, quietly, truthfully.

Create 4 scenes that form a visual essay on shared human experience related to their struggle.

STYLE (mandatory for all scenes):
- Visual: Photorealistic
- Camera: Handheld, imperfect framing (slightly off-center, natural wobble)
- Lighting: Natural, slightly muted
- Pace: Slow, contemplative
- Mood: Quiet, observational (NOT melancholic, NOT uplifting)
- Color: Slightly desaturated, warm shadows
- Texture: 35mm film grain

SCENE REQUIREMENTS:
1. Scene 1: Opening - Life in motion, ordinary effort
2. Scene 2: Universal moment - Something everyone experiences
3. Scene 3: Quiet pause - Brief rest or reflection in daily life
4. Scene 4: Continuation - Life moves forward, open-ended

For each scene provide:
- "description": What the camera sees (be specific, visual, filmable)
- "symbolism": What this represents (internal use only)
- "duration": Seconds (12-20 per scene)
- "timeOfDay": When this happens
- "setting": Where this happens

Respond with JSON containing a "scenes" array.`

// Map perspectives to scene themes
const PERSPECTIVE_SCENE_THEMES: Record<string, string[]> = {
  shared_human_struggle: [
    'workers commuting in early morning light',
    'hands at work, repetitive motion',
    'public transit, parallel lives in motion',
    'evening walk home, ordinary persistence'
  ],
  universal_uncertainty: [
    'crossroads or intersection, multiple paths',
    'person pausing at window, thinking',
    'changing weather, clouds moving',
    'new day beginning, uncertain light'
  ],
  common_silent_burden: [
    'tired hands resting briefly',
    'quiet coffee shop, people alone together',
    'end of workday, shoulders relaxing',
    'walking slowly, carrying invisible weight'
  ],
  collective_perseverance: [
    'early morning routine, preparing for day',
    'steady work, focused hands',
    'brief pause, then continuing',
    'lights in windows at dusk, life continuing'
  ],
  impermanence_of_states: [
    'weather changing, clouds parting slightly',
    'seasons visible in nature',
    'time passing on ordinary objects',
    'dawn light replacing night'
  ],
  dignity_in_effort: [
    'careful hands at work',
    'simple task done with attention',
    'workspace at end of day',
    'tools put away, work complete'
  ]
}

export async function generateSceneBlueprint(
  thought: string,
  analysis: CognitiveAnalysis,
  understanding: DeepUnderstanding,
  perspective: PerspectiveSelection
): Promise<SceneBlueprint> {
  try {
    // Get theme suggestions based on perspective
    const themeHints = PERSPECTIVE_SCENE_THEMES[perspective.perspectiveType] || 
                       PERSPECTIVE_SCENE_THEMES.shared_human_struggle

    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: SCENE_BLUEPRINT_PROMPT },
        { role: 'user', content: `Create a scene blueprint for this context:

USER'S THOUGHT (for context only - do NOT depict their specific situation):
"${thought}"

DEEP UNDERSTANDING (internal):
- Hidden fear: ${understanding.hiddenFear}
- Existential question: ${understanding.existentialQuestion}
- Emotional state: ${understanding.emotionalState.join(', ')}

PERSPECTIVE TO CONVEY:
Type: ${perspective.perspectiveType}
Message: ${perspective.message}

SUGGESTED VISUAL THEMES (for inspiration):
${themeHints.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Create 4 observational scenes that embody "${perspective.message}" without depicting the user's specific life.` }
      ],
      temperature: 0.7,
      max_completion_tokens: 800,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Empty response')
    }

    const parsed = JSON.parse(content)
    const scenes: Scene[] = (parsed.scenes || []).map((s: Partial<Scene>, i: number) => ({
      description: s.description || themeHints[i] || 'Quiet urban scene',
      symbolism: s.symbolism || 'Shared human experience',
      duration: s.duration || 15,
      timeOfDay: s.timeOfDay || 'morning',
      setting: s.setting || 'urban'
    }))

    // Ensure we have 4 scenes
    while (scenes.length < 4) {
      scenes.push({
        description: themeHints[scenes.length] || 'Ordinary life continuing',
        symbolism: 'Life persists',
        duration: 15,
        timeOfDay: 'morning',
        setting: 'urban'
      })
    }

    return {
      style: {
        visual: 'photorealistic',
        camera: 'handheld, imperfect framing',
        lighting: 'natural, slightly muted',
        pace: 'slow',
        mood: 'quiet, observational',
        colorGrade: 'slightly desaturated, warm shadows',
        texture: '35mm film grain'
      },
      scenes: scenes.slice(0, 4),
      constraints: DOCUMENTARY_CONSTRAINTS,
      totalDuration: scenes.slice(0, 4).reduce((sum, s) => sum + s.duration, 0)
    }
  } catch (error) {
    console.error('Scene blueprint generation failed:', error)
    return generateFallbackBlueprint(perspective)
  }
}

function generateFallbackBlueprint(perspective: PerspectiveSelection): SceneBlueprint {
  const themes = PERSPECTIVE_SCENE_THEMES[perspective.perspectiveType] || 
                 PERSPECTIVE_SCENE_THEMES.shared_human_struggle

  return {
    style: {
      visual: 'photorealistic',
      camera: 'handheld, imperfect framing',
      lighting: 'natural, slightly muted',
      pace: 'slow',
      mood: 'quiet, observational',
      colorGrade: 'slightly desaturated, warm shadows',
      texture: '35mm film grain'
    },
    scenes: [
      {
        description: themes[0],
        symbolism: 'Life in motion',
        duration: 15,
        timeOfDay: 'dawn',
        setting: 'urban'
      },
      {
        description: themes[1],
        symbolism: 'Universal experience',
        duration: 18,
        timeOfDay: 'morning',
        setting: 'public_space'
      },
      {
        description: themes[2],
        symbolism: 'Brief pause',
        duration: 15,
        timeOfDay: 'afternoon',
        setting: 'workplace'
      },
      {
        description: themes[3],
        symbolism: 'Continuation',
        duration: 12,
        timeOfDay: 'dusk',
        setting: 'urban'
      }
    ],
    constraints: DOCUMENTARY_CONSTRAINTS,
    totalDuration: 60
  }
}

// Export constraints for use in video generator
export { DOCUMENTARY_CONSTRAINTS }
