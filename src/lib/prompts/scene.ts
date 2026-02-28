import type { CognitiveAnalysis, SceneDescription, PhaseSceneDescription, VideoPhase, EmotionType } from '@/types'

// Ethical guardrails added to ALL prompts
const ETHICAL_GUARDRAILS = `
CRITICAL ETHICAL RULES (NON-NEGOTIABLE):
- NO graphic suffering or distress
- NO exploitation imagery (poverty porn, crisis situations)
- NO faces showing anguish, crying, or despair
- NO children in difficult situations
- NO war, medical crisis, or disaster imagery
- FOCUS on quiet resilience, dignity, and strength
- SHOW everyday perseverance, not hardship comparison
- WARM, respectful, dignified portrayals only`

// ============================================
// PHASE-SPECIFIC SCENE TEMPLATES
// ============================================

export const PHASE_1_VALIDATION_PROMPT = `You are creating a visual scene for Phase 1: VALIDATION (10-15 seconds).

Purpose: Acknowledge the emotional weight. Build trust through visual empathy.

Visual approach:
- Abstract visuals matching the emotional heaviness
- Slow, weighted movements transitioning to stillness
- Colors that acknowledge the feeling (muted for sadness, warm amber for shame, cool blues for anxiety)
- No resolution yet—just presence and acknowledgment
- Examples: slow-motion rain on window, heavy clouds, dim light gradually appearing

${ETHICAL_GUARDRAILS}

Respond with JSON: { visualPrompt, emotionalTone, duration, colorPalette }`

export const PHASE_2_CONTRAST_PROMPT = `You are creating a visual scene for Phase 2: REAL-WORLD CONTRAST (20-30 seconds).

Purpose: Widen perspective by showing everyday resilience—NOT suffering comparison.

Visual approach:
- Show DIGNITY and quiet determination, not hardship
- Everyday workers, students, parents in their routines
- Transit scenes: morning commuters, people walking purposefully  
- Practice/effort: hands at work, focused activity
- Shared human experience: busy streets, coffee shops, libraries
- NO faces in distress—show calm, focused, or neutral expressions
- Focus on the universal experience of carrying on

${ETHICAL_GUARDRAILS}

CRITICAL: This is NOT about "others have it worse." It's about "you are not alone in struggling."

Respond with JSON: { visualPrompt, emotionalTone, duration, colorPalette }`

export const PHASE_3_REFRAME_PROMPT = `You are creating a visual scene for Phase 3: PERSPECTIVE REFRAME (15-20 seconds).

Purpose: Visual metaphor for the cognitive shift. Transition from external to personal.

Visual approach:
- Light breaking through—dawn, clouds parting, sun emerging
- Paths opening—trails through forests, doors opening, roads ahead
- Personal focus—hands in warm light, personal space, intimate moments
- Transition imagery—seasonal change, weather clearing, tide shifting
- Gentle but noticeable transformation

${ETHICAL_GUARDRAILS}

Respond with JSON: { visualPrompt, emotionalTone, duration, colorPalette }`

export const PHASE_4_ENCOURAGEMENT_PROMPT = `You are creating a visual scene for Phase 4: ENCOURAGEMENT + AGENCY (10-15 seconds).

Purpose: Activate agency. ONE small step forward. Grounded hope.

Visual approach:
- Single step forward—footstep, hand reaching, beginning of motion
- Open doors, new beginnings—but subtle, not grandiose
- First light of morning, not full sunrise—beginnings, not arrivals
- Grounded optimism—plants growing, steady progress, small victories
- End on possibility, not false promise

${ETHICAL_GUARDRAILS}

Respond with JSON: { visualPrompt, emotionalTone, duration, colorPalette }`

// ============================================
// EMOTION-TO-SCENE MAPPING (Phase 2 specific)
// ============================================

export interface EmotionSceneTheme {
  theme: string
  visualElements: string[]
  avoidElements: string[]
  colorMood: string
  suggestedSettings: string[]
}

export const EMOTION_SCENE_THEMES: Partial<Record<EmotionType, EmotionSceneTheme>> & { overwhelm: EmotionSceneTheme } = {
  hopelessness: {
    theme: 'Dawn workers, new beginnings',
    visualElements: ['slow sunrise', 'early morning workers', 'first light', 'empty streets coming alive', 'coffee being poured'],
    avoidElements: ['exhaustion', 'struggle', 'difficulty'],
    colorMood: 'warm amber transitioning to soft gold',
    suggestedSettings: ['bakery at dawn', 'city at 5am', 'fishing boats at sunrise', 'morning commute']
  },
  anxiety: {
    theme: 'Grounding and stability',
    visualElements: ['steady hands at work', 'rhythmic patterns', 'nature stability', 'calm water', 'trees rooted firmly'],
    avoidElements: ['chaos', 'crowds', 'rushing'],
    colorMood: 'cool blues and greens, earth tones',
    suggestedSettings: ['forest floor', 'pottery wheel', 'calm lake', 'garden work']
  },
  sadness: {
    theme: 'Quiet connection and warmth',
    visualElements: ['warm interiors', 'shared spaces', 'gentle light', 'comfort objects', 'peaceful solitude'],
    avoidElements: ['loneliness', 'isolation', 'darkness'],
    colorMood: 'warm amber and soft cream',
    suggestedSettings: ['cozy cafe', 'library corner', 'warm kitchen', 'reading nook']
  },
  loneliness: {
    theme: 'Crowds with quiet connections',
    visualElements: ['busy public spaces', 'strangers sharing moments', 'parallel lives', 'community without words'],
    avoidElements: ['isolation', 'empty spaces', 'disconnection'],
    colorMood: 'warm community tones',
    suggestedSettings: ['coffee shop', 'park bench', 'bookstore', 'public transit']
  },
  shame: {
    theme: 'Gentle self-care and privacy',
    visualElements: ['warm private spaces', 'self-tending moments', 'soft light on hands', 'personal rituals'],
    avoidElements: ['exposure', 'judgment', 'scrutiny'],
    colorMood: 'warm golden hour, honey tones',
    suggestedSettings: ['home sanctuary', 'bath time', 'journaling', 'quiet morning routine']
  },
  guilt: {
    theme: 'Imperfection and humanity',
    visualElements: ['mending and repair', 'gentle corrections', 'learning moments', 'growth from cracks'],
    avoidElements: ['punishment', 'consequences', 'damage'],
    colorMood: 'soft healing greens and warm wood tones',
    suggestedSettings: ['garden tending', 'craft repair', 'cooking adjustments', 'pottery mending']
  },
  fear: {
    theme: 'Calm preparation and steady hands',
    visualElements: ['focused work', 'methodical preparation', 'steady breathing', 'controlled environment'],
    avoidElements: ['danger', 'uncertainty visuals', 'darkness'],
    colorMood: 'grounding earth and reassuring blues',
    suggestedSettings: ['workshop', 'kitchen prep', 'artist studio', 'instrument tuning']
  },
  anger: {
    theme: 'Purposeful energy and release',
    visualElements: ['physical movement', 'creative expression', 'controlled power', 'waves releasing'],
    avoidElements: ['aggression', 'destruction', 'confrontation'],
    colorMood: 'cooling blues transitioning from warm',
    suggestedSettings: ['ocean waves', 'dance movement', 'running paths', 'creative work']
  },
  frustration: {
    theme: 'Practice and repetition',
    visualElements: ['athletes practicing', 'musicians rehearsing', 'craftspeople at work', 'patient effort'],
    avoidElements: ['failure', 'mistakes', 'struggle'],
    colorMood: 'determined warm tones',
    suggestedSettings: ['sports practice', 'music room', 'craft studio', 'training ground']
  },
  overwhelm: {
    theme: 'Rest and breathing space',
    visualElements: ['peaceful pauses', 'breathing moments', 'organized spaces', 'one thing at a time'],
    avoidElements: ['chaos', 'multitasking', 'clutter'],
    colorMood: 'calm neutrals and soft whites',
    suggestedSettings: ['meditation space', 'organized desk', 'quiet nature', 'simple room']
  }
}

// ============================================
// PHASE SCENE GENERATORS
// ============================================

export function generatePhasePrompts(
  analysis: CognitiveAnalysis,
  reframedText: string
): Record<VideoPhase, string> {
  const emotionTheme = EMOTION_SCENE_THEMES[analysis.emotion] || EMOTION_SCENE_THEMES.overwhelm

  return {
    1: `${PHASE_1_VALIDATION_PROMPT}

Context:
- Emotion: ${analysis.emotion} (intensity ${analysis.intensity}/10)
- Themes: ${analysis.themes.join(', ')}

Create a validation scene that acknowledges the weight of ${analysis.emotion}.`,

    2: `${PHASE_2_CONTRAST_PROMPT}

Emotion-specific theme: ${emotionTheme.theme}
Suggested visual elements: ${emotionTheme.visualElements.join(', ')}
Suggested settings: ${emotionTheme.suggestedSettings.join(', ')}
Color mood: ${emotionTheme.colorMood}
AVOID: ${emotionTheme.avoidElements.join(', ')}

Show everyday resilience related to ${analysis.themes.join(' and ')}.`,

    3: `${PHASE_3_REFRAME_PROMPT}

The reframed perspective: "${reframedText}"

Create visuals that embody this shift in thinking. The scene should feel like the emotional equivalent of the reframe.`,

    4: `${PHASE_4_ENCOURAGEMENT_PROMPT}

Context: Moving from ${analysis.emotion} toward agency and one small step.

Create a scene that feels like the beginning of movement—not the destination, just the first step.`
  }
}

// ============================================
// FALLBACK PHASE SCENES
// ============================================

export const FALLBACK_PHASE_SCENES: Record<VideoPhase, Partial<Record<EmotionType, PhaseSceneDescription>> & { overwhelm: PhaseSceneDescription }> = {
  1: {
    // Phase 1: Validation scenes for each emotion
    hopelessness: {
      phase: 1, phaseName: 'validation', duration: 12,
      visualPrompt: 'Heavy grey clouds over still water, muted colors, slow camera drift, weight of stillness, dim light barely visible at horizon edge',
      emotionalTone: 'grounding', colorPalette: ['#4A5568', '#718096', '#A0AEC0', '#E2E8F0']
    },
    anxiety: {
      phase: 1, phaseName: 'validation', duration: 12,
      visualPrompt: 'Raindrops on glass window, blurred city lights beyond, slow motion water trails, intimate and contained feeling',
      emotionalTone: 'calm', colorPalette: ['#4299E1', '#63B3ED', '#90CDF4', '#E2E8F0']
    },
    sadness: {
      phase: 1, phaseName: 'validation', duration: 12,
      visualPrompt: 'Late afternoon light through sheer curtains, dust particles floating slowly, quiet empty room, soft blue-grey tones',
      emotionalTone: 'warm', colorPalette: ['#A0AEC0', '#CBD5E0', '#E8D5B7', '#F7FAFC']
    },
    shame: {
      phase: 1, phaseName: 'validation', duration: 12,
      visualPrompt: 'Warm lamplight in dim room, soft shadows, intimate corner space, gentle amber glow on wood surfaces',
      emotionalTone: 'warm', colorPalette: ['#D69E2E', '#ECC94B', '#F6E05E', '#FFFFF0']
    },
    fear: {
      phase: 1, phaseName: 'validation', duration: 12,
      visualPrompt: 'Fog slowly moving through pine forest, diffused light, mysterious but not threatening, quiet atmosphere',
      emotionalTone: 'grounding', colorPalette: ['#2D3748', '#4A5568', '#718096', '#A0AEC0']
    },
    anger: {
      phase: 1, phaseName: 'validation', duration: 12,
      visualPrompt: 'Storm clouds building over ocean, waves with contained power, deep colors, energy held in tension',
      emotionalTone: 'grounding', colorPalette: ['#2B6CB0', '#3182CE', '#4299E1', '#63B3ED']
    },
    guilt: {
      phase: 1, phaseName: 'validation', duration: 12,
      visualPrompt: 'Twilight through old window, weathered wood textures, imperfect beauty, soft fading light',
      emotionalTone: 'warm', colorPalette: ['#8B5A2B', '#A67B5B', '#C4A77D', '#E8D5B7']
    },
    loneliness: {
      phase: 1, phaseName: 'validation', duration: 12,
      visualPrompt: 'Single light in window at dusk, quiet neighborhood, blue hour stillness, contained warmth within',
      emotionalTone: 'warm', colorPalette: ['#2D3748', '#4A5568', '#ECC94B', '#F6E05E']
    },
    frustration: {
      phase: 1, phaseName: 'validation', duration: 12,
      visualPrompt: 'Tangled yarn or threads, abstract texture, complex patterns, waiting to be understood',
      emotionalTone: 'grounding', colorPalette: ['#744210', '#975A16', '#D69E2E', '#ECC94B']
    },
    overwhelm: {
      phase: 1, phaseName: 'validation', duration: 12,
      visualPrompt: 'Gentle rain on leaves, many droplets, natural complexity, soft focus on abundance',
      emotionalTone: 'calm', colorPalette: ['#276749', '#38A169', '#68D391', '#C6F6D5']
    }
  },
  2: {
    // Phase 2: Real-world contrast scenes (resilience, NOT suffering)
    hopelessness: {
      phase: 2, phaseName: 'contrast', duration: 25,
      visualPrompt: 'Early morning city, 5am light, bakery worker arranging bread, street cleaner finishing shift, first commuters with coffee, quiet determination, warm morning glow beginning',
      emotionalTone: 'hopeful', colorPalette: ['#ED8936', '#F6AD55', '#FBD38D', '#FFFFF0']
    },
    anxiety: {
      phase: 2, phaseName: 'contrast', duration: 25,
      visualPrompt: 'Hands of potter shaping clay on wheel, steady rhythmic motion, focused calm work, grounding physical activity, warm studio light',
      emotionalTone: 'grounding', colorPalette: ['#8B5A2B', '#A67B5B', '#C4A77D', '#E8D5B7']
    },
    sadness: {
      phase: 2, phaseName: 'contrast', duration: 25,
      visualPrompt: 'Warm coffee shop, different people reading alone together, shared quiet space, afternoon light through windows, gentle activity',
      emotionalTone: 'warm', colorPalette: ['#D69E2E', '#ECC94B', '#F6E05E', '#FAF5FF']
    },
    shame: {
      phase: 2, phaseName: 'contrast', duration: 25,
      visualPrompt: 'Morning self-care rituals, hands preparing tea, making bed, quiet personal moments, warm home light, dignity in routine',
      emotionalTone: 'warm', colorPalette: ['#D69E2E', '#ECC94B', '#F6E05E', '#FFFFF0']
    },
    fear: {
      phase: 2, phaseName: 'contrast', duration: 25,
      visualPrompt: 'Musician tuning instrument with steady hands, chef preparing ingredients methodically, focused calm preparation, warm task lighting',
      emotionalTone: 'grounding', colorPalette: ['#2D3748', '#4A5568', '#ECC94B', '#F6E05E']
    },
    anger: {
      phase: 2, phaseName: 'contrast', duration: 25,
      visualPrompt: 'Dancer in empty studio, controlled powerful movements, channeled energy, morning light through tall windows, purposeful motion',
      emotionalTone: 'empowering', colorPalette: ['#E53E3E', '#FC8181', '#FEB2B2', '#FFF5F5']
    },
    guilt: {
      phase: 2, phaseName: 'contrast', duration: 25,
      visualPrompt: 'Hands gently mending fabric, kintsugi pottery repair with gold, imperfection becoming beautiful, patient restoration work',
      emotionalTone: 'warm', colorPalette: ['#D69E2E', '#ECC94B', '#38A169', '#68D391']
    },
    loneliness: {
      phase: 2, phaseName: 'contrast', duration: 25,
      visualPrompt: 'Public library, strangers reading near each other, shared silence, parallel solitudes, warm afternoon light, quiet community',
      emotionalTone: 'warm', colorPalette: ['#8B5A2B', '#A67B5B', '#ECC94B', '#FAF5FF']
    },
    frustration: {
      phase: 2, phaseName: 'contrast', duration: 25,
      visualPrompt: 'Athlete practicing same movement repeatedly, musician playing scales, craftsperson sanding wood, patient repetition, mastery through practice',
      emotionalTone: 'grounding', colorPalette: ['#2D3748', '#4A5568', '#ED8936', '#F6AD55']
    },
    overwhelm: {
      phase: 2, phaseName: 'contrast', duration: 25,
      visualPrompt: 'Person taking one deliberate breath, organizing one small space, completing one simple task, calm focus on single action',
      emotionalTone: 'calm', colorPalette: ['#E2E8F0', '#CBD5E0', '#A0AEC0', '#718096']
    }
  },
  3: {
    // Phase 3: Perspective reframe scenes
    hopelessness: {
      phase: 3, phaseName: 'reframe', duration: 18,
      visualPrompt: 'Sun breaking through heavy clouds, golden rays spreading across landscape, storm passing, light reclaiming the scene',
      emotionalTone: 'hopeful', colorPalette: ['#F6AD55', '#FBD38D', '#4299E1', '#90CDF4']
    },
    anxiety: {
      phase: 3, phaseName: 'reframe', duration: 18,
      visualPrompt: 'Ripples on water settling into stillness, chaos becoming calm, natural settling process, peaceful resolution',
      emotionalTone: 'calm', colorPalette: ['#4299E1', '#63B3ED', '#90CDF4', '#E2E8F0']
    },
    sadness: {
      phase: 3, phaseName: 'reframe', duration: 18,
      visualPrompt: 'Window opening to fresh air, curtains moving gently, new light entering room, gentle transition',
      emotionalTone: 'warm', colorPalette: ['#E8D5B7', '#F6E05E', '#68D391', '#9AE6B4']
    },
    shame: {
      phase: 3, phaseName: 'reframe', duration: 18,
      visualPrompt: 'Hands in warm light, self-embrace gesture, soft focus on skin in golden hour, tenderness toward self',
      emotionalTone: 'warm', colorPalette: ['#D69E2E', '#ECC94B', '#F6E05E', '#FFFFF0']
    },
    fear: {
      phase: 3, phaseName: 'reframe', duration: 18,
      visualPrompt: 'Path through forest clearing, light visible ahead, trees opening up, safe passage revealed',
      emotionalTone: 'grounding', colorPalette: ['#276749', '#38A169', '#68D391', '#F6E05E']
    },
    anger: {
      phase: 3, phaseName: 'reframe', duration: 18,
      visualPrompt: 'Ocean wave releasing on shore, energy transforming into foam, powerful becoming peaceful, natural cycle',
      emotionalTone: 'calm', colorPalette: ['#2B6CB0', '#4299E1', '#90CDF4', '#E2E8F0']
    },
    guilt: {
      phase: 3, phaseName: 'reframe', duration: 18,
      visualPrompt: 'New growth from old tree stump, green shoots in morning light, life continuing, renewal from what was',
      emotionalTone: 'hopeful', colorPalette: ['#276749', '#38A169', '#68D391', '#C6F6D5']
    },
    loneliness: {
      phase: 3, phaseName: 'reframe', duration: 18,
      visualPrompt: 'Door opening to warm lit room, threshold moment, welcome space ahead, connection available',
      emotionalTone: 'warm', colorPalette: ['#8B5A2B', '#D69E2E', '#ECC94B', '#FFFFF0']
    },
    frustration: {
      phase: 3, phaseName: 'reframe', duration: 18,
      visualPrompt: 'Puzzle piece finding its place, lock clicking open, mechanism working smoothly, resolution moment',
      emotionalTone: 'empowering', colorPalette: ['#4A5568', '#ED8936', '#F6AD55', '#FBD38D']
    },
    overwhelm: {
      phase: 3, phaseName: 'reframe', duration: 18,
      visualPrompt: 'Cluttered desk becoming organized, one item at a time, space emerging, clarity arriving gradually',
      emotionalTone: 'calm', colorPalette: ['#E2E8F0', '#CBD5E0', '#68D391', '#C6F6D5']
    }
  },
  4: {
    // Phase 4: Encouragement/agency scenes
    hopelessness: {
      phase: 4, phaseName: 'encouragement', duration: 12,
      visualPrompt: 'Single footstep on morning path, first step forward, dewy grass, new day beginning, simple movement',
      emotionalTone: 'hopeful', colorPalette: ['#68D391', '#9AE6B4', '#F6E05E', '#FBD38D']
    },
    anxiety: {
      phase: 4, phaseName: 'encouragement', duration: 12,
      visualPrompt: 'Hand turning door handle, simple action, gentle movement, beginning of entry, calm initiation',
      emotionalTone: 'calm', colorPalette: ['#E8D5B7', '#ECC94B', '#68D391', '#9AE6B4']
    },
    sadness: {
      phase: 4, phaseName: 'encouragement', duration: 12,
      visualPrompt: 'Hand reaching toward window light, gentle motion, warmth approaching, soft beginning',
      emotionalTone: 'warm', colorPalette: ['#F6E05E', '#FBD38D', '#FFFFF0', '#FAF5FF']
    },
    shame: {
      phase: 4, phaseName: 'encouragement', duration: 12,
      visualPrompt: 'Looking up at open sky, face toward light, gentle upward tilt, quiet strength, self-acceptance',
      emotionalTone: 'warm', colorPalette: ['#ECC94B', '#F6E05E', '#90CDF4', '#E2E8F0']
    },
    fear: {
      phase: 4, phaseName: 'encouragement', duration: 12,
      visualPrompt: 'Hand on steady surface, grounded touch, secure contact, stable foundation, ready position',
      emotionalTone: 'grounding', colorPalette: ['#8B5A2B', '#A67B5B', '#68D391', '#9AE6B4']
    },
    anger: {
      phase: 4, phaseName: 'encouragement', duration: 12,
      visualPrompt: 'Deep breath visible in cool air, release and renewal, controlled exhale, purposeful pause',
      emotionalTone: 'calm', colorPalette: ['#4299E1', '#90CDF4', '#E2E8F0', '#F7FAFC']
    },
    guilt: {
      phase: 4, phaseName: 'encouragement', duration: 12,
      visualPrompt: 'Hand planting small seed, simple action, future-focused gesture, beginning of growth',
      emotionalTone: 'hopeful', colorPalette: ['#276749', '#38A169', '#68D391', '#C6F6D5']
    },
    loneliness: {
      phase: 4, phaseName: 'encouragement', duration: 12,
      visualPrompt: 'Hand writing first word in journal, beginning of expression, personal action, self-connection',
      emotionalTone: 'warm', colorPalette: ['#E8D5B7', '#ECC94B', '#F6E05E', '#FFFFF0']
    },
    frustration: {
      phase: 4, phaseName: 'encouragement', duration: 12,
      visualPrompt: 'Hands beginning again, fresh start, new attempt with calm determination, patient restart',
      emotionalTone: 'grounding', colorPalette: ['#4A5568', '#718096', '#F6AD55', '#FBD38D']
    },
    overwhelm: {
      phase: 4, phaseName: 'encouragement', duration: 12,
      visualPrompt: 'Single candle being lit, one light in space, simple singular action, manageable beginning',
      emotionalTone: 'warm', colorPalette: ['#D69E2E', '#ECC94B', '#F6E05E', '#FFFFF0']
    }
  }
}

// Helper to get fallback scenes for an emotion
export function getFallbackPhaseScenes(emotion: EmotionType): PhaseSceneDescription[] {
  return [
    FALLBACK_PHASE_SCENES[1][emotion] || FALLBACK_PHASE_SCENES[1].overwhelm,
    FALLBACK_PHASE_SCENES[2][emotion] || FALLBACK_PHASE_SCENES[2].overwhelm,
    FALLBACK_PHASE_SCENES[3][emotion] || FALLBACK_PHASE_SCENES[3].overwhelm,
    FALLBACK_PHASE_SCENES[4][emotion] || FALLBACK_PHASE_SCENES[4].overwhelm
  ]
}

// Legacy support - single scene generation
export const SCENE_GENERATION_SYSTEM_PROMPT = `You are a visual therapist who creates calming, emotionally resonant scene descriptions for AI video generation.

${ETHICAL_GUARDRAILS}

Your scenes should:
1. Match the emotional need (e.g., anxiety needs calming visuals, hopelessness needs gentle hope)
2. Use nature and abstract visuals that feel safe and grounding
3. Avoid faces in distress, text, or anything potentially triggering
4. Focus on movement and transition (e.g., clouds parting, water flowing, light emerging)

Respond with JSON containing:
1. visualPrompt: A detailed video generation prompt (50-100 words)
2. emotionalTone: One of "calm", "hopeful", "grounding", "empowering", "warm"
3. colorPalette: Array of 3-4 hex colors that match the mood
4. suggestedDuration: Duration in seconds (30-90)`

export const SCENE_GENERATION_USER_PROMPT = (
  reframedText: string,
  analysis: CognitiveAnalysis
) => `Create a visual scene for this reframed perspective:

"${reframedText}"

Emotional context:
- Original emotion: ${analysis.emotion} (intensity ${analysis.intensity}/10)
- Key themes: ${analysis.themes.join(', ')}

The video should help the viewer FEEL the reframe, not just read it.`

export function parseSceneDescription(response: string): SceneDescription | null {
  try {
    const parsed = JSON.parse(response)
    
    if (!parsed.visualPrompt || !parsed.emotionalTone) {
      console.error('Missing required fields in scene description')
      return null
    }
    
    return {
      visualPrompt: parsed.visualPrompt,
      emotionalTone: parsed.emotionalTone,
      colorPalette: parsed.colorPalette || ['#4A90A4', '#7CB9A8', '#F4E8C1'],
      suggestedDuration: parsed.suggestedDuration || 45,
    }
  } catch (error) {
    console.error('Failed to parse scene description:', error)
    return null
  }
}

// Legacy fallback scenes
export const FALLBACK_SCENES: Record<string, SceneDescription> = {
  calm: {
    visualPrompt: 'Serene lake at dawn with gentle mist rising, soft pink and gold reflections on still water, slow camera drift forward, peaceful morning atmosphere',
    emotionalTone: 'calm',
    colorPalette: ['#7CA5B8', '#E8D5B7', '#F5E6D3', '#2C3E50'],
    suggestedDuration: 45,
  },
  hopeful: {
    visualPrompt: 'Sun breaking through storm clouds over rolling hills, golden light rays spreading across green meadow, birds taking flight, cinematic slow motion',
    emotionalTone: 'hopeful',
    colorPalette: ['#F4D03F', '#5DADE2', '#58D68D', '#2C3E50'],
    suggestedDuration: 45,
  },
  grounding: {
    visualPrompt: 'Ancient forest with sunlight filtering through leaves, gentle breeze moving branches, moss-covered rocks, peaceful woodland atmosphere',
    emotionalTone: 'grounding',
    colorPalette: ['#2E7D32', '#8D6E63', '#A5D6A7', '#3E2723'],
    suggestedDuration: 45,
  },
  warm: {
    visualPrompt: 'Cozy interior with warm golden hour light streaming through windows, gentle dust particles floating, soft blankets and plants, intimate safe space',
    emotionalTone: 'warm',
    colorPalette: ['#D4A574', '#E8D5B7', '#8B5A2B', '#FFF8E7'],
    suggestedDuration: 45,
  },
  empowering: {
    visualPrompt: 'Mountain summit at sunrise, vast landscape stretching to horizon, eagles soaring, triumphant golden light, endless possibilities',
    emotionalTone: 'empowering',
    colorPalette: ['#FF6B35', '#4A90A4', '#2C3E50', '#F4D03F'],
    suggestedDuration: 45,
  },
}
