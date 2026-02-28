import openai from '@/lib/openai'
import anthropic from '@/lib/anthropic'
import type { CognitiveAnalysis } from '@/types'
import type { DeepUnderstandingResult, OrbitIntent } from '../types'

function validateActWeights(weights: { vast: number; earth: number; embryology: number; return: number }): boolean {
  const sum = weights.vast + weights.earth + weights.embryology + weights.return
  return Math.abs(sum - 1.0) < 0.01
}

function normalizeActWeights(weights: { vast: number; earth: number; embryology: number; return: number }): { vast: number; earth: number; embryology: number; return: number } {
  const sum = weights.vast + weights.earth + weights.embryology + weights.return
  if (sum === 0) {
    return { vast: 0.25, earth: 0.25, embryology: 0.25, return: 0.25 }
  }
  return {
    vast: weights.vast / sum,
    earth: weights.earth / sum,
    embryology: weights.embryology / sum,
    return: weights.return / sum,
  }
}

function createFallbackOrbitIntent(): OrbitIntent {
  return {
    primaryNeed: "broaden-perspective",
    secondaryNeed: null,
    avoid: ["advice", "definitions", "productivity framing", "preachy tone"],
    actWeights: { vast: 0.25, earth: 0.25, embryology: 0.25, return: 0.25 },
    endingRule: "return-to-ordinary-life"
  }
}

const ORBIT_UNDERSTANDING_PROMPT = `You are a philosophical director routing a user's prompt through Orbit's fixed four-act structure.

ORBIT STRUCTURE (NEVER CHANGES):
1. VAST: Universe scale, cosmic context (e.g., starfields, earth from space, cosmic vastness)
2. LIVING DOT: Earth + life continuity (e.g., biosphere, evolutionary persistence, life's thread)
3. MIRACLE OF YOU: Intimate presence, warmth, quiet sensation (e.g., morning light on surfaces, steam from tea, rain on glass, textures of daily life)
4. RETURN: Ordinary life integration (e.g., returning to daily routine with shifted perspective, quiet re-entry)

Your job is to FRAME the prompt as a director would and extract routing signals. You are NOT answering the prompt.

Extract the following (respond with JSON only):

1. "coreTension": The main conflict or tension in the prompt.
2. "centralParadox": The paradox or unresolved duality at the heart of it.
3. "humanStakes": Why this prompt matters for lived human experience.
4. "keyConcepts": 3-5 key concepts (single words or short phrases).
5. "guidingQuestion": A sharpened version of the prompt (1 sentence).
6. "narrativeAngle": The essay angle (e.g., scale shift, embodiment, memory, mortality).
7. "orbitIntent": {
     "primaryNeed": one of ["broaden-perspective", "reduce-future-fear", "dissolve-hopelessness", "restore-agency", "soften-ego", "reduce-numbness", "accept-struggle"]
     "secondaryNeed": optional second need from the same list (or null)
     "avoid": array that MUST include ["advice", "definitions", "productivity framing", "preachy tone"]
     "actWeights": { "vast": number, "earth": number, "embryology": number, "return": number } 
                    (must sum to 1.0, each between 0.0-1.0)
     "endingRule": "return-to-ordinary-life"
   }
8. "cognitiveState": {
     "attentionBias": one of ["future_locked", "past_anchored", "present_dissociated", "self_focused", "other_focused"],
     "temporalFixation": one of ["forward_projection", "retrospective_loop", "frozen_present"],
     "agencyDistortion": one of ["outcome_dependence", "control_fixation", "learned_helplessness", "none"]
   }
9. "thoughtAnchors": 3-5 concrete nouns or short phrases from the user's thought (objects, places, sensations, or times) that can be woven into imagery — e.g. "radiator", "4am", "weight of the door", "empty street". No abstract concepts; prefer filmable, sensory details.

COGNITIVE STATE RULES:
- future_locked: user is stuck projecting forward (anxiety, planning, "what if")
- past_anchored: user is stuck in retrospection (regret, nostalgia, loss)
- present_dissociated: user feels disconnected from now (numbness, unreality)
- self_focused: user is trapped in self-reference (identity crisis, self-doubt)
- other_focused: user is consumed by others' expectations or judgments

ROUTING RULES FOR actWeights:
- Existential dread or meaninglessness → higher vast weight (0.35-0.4)
- Numbness, disconnection, or dissociation → higher embryology weight (0.35-0.4)
- Future anxiety or climate despair → balance earth + return (0.3 each)
- Identity crisis or self-doubt → higher embryology + return (0.35 + 0.3)
- Loss of agency or powerlessness → balance all four, slight emphasis on return (0.3)
- Always reserve minimum 0.15 for return (integration back to ordinary life is mandatory)

Be precise. Be observational. This is framing and routing, not advice.`

export async function generateDeepUnderstanding(
  thought: string,
  analysis: CognitiveAnalysis
): Promise<DeepUnderstandingResult> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1500,
      system: ORBIT_UNDERSTANDING_PROMPT + "\n\nCRITICAL: Respond ONLY with a valid JSON object. Do not include any preamble, commentary, or markdown formatting.",
      messages: [
        {
          role: 'user',
          content: `Interpret this prompt:\n\n"${thought}"\n\nContext: tone ${analysis.emotion}, intensity ${analysis.intensity}/10, themes: ${analysis.themes.join(', ')}`
        }
      ],
      temperature: 0.3,
    })

    const content = response.content[0].type === 'text' ? response.content[0].text : ''
    if (!content) throw new Error('Empty response')
    
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    const jsonString = jsonMatch ? jsonMatch[0] : content
    const parsed = JSON.parse(jsonString)

    // Validate and normalize actWeights if present
    let orbitIntent = parsed.orbitIntent || createFallbackOrbitIntent()
    if (orbitIntent.actWeights && !validateActWeights(orbitIntent.actWeights)) {
      console.warn('ActWeights do not sum to 1.0, normalizing...')
      orbitIntent.actWeights = normalizeActWeights(orbitIntent.actWeights)
    }

    const validAttentionBiases = ['future_locked', 'past_anchored', 'present_dissociated', 'self_focused', 'other_focused'] as const
    const validTemporalFixations = ['forward_projection', 'retrospective_loop', 'frozen_present'] as const
    const validAgencyDistortions = ['outcome_dependence', 'control_fixation', 'learned_helplessness', 'none'] as const

    const rawCognitive = parsed.cognitiveState || {}
    const cognitiveState = {
      attentionBias: (validAttentionBiases as readonly string[]).includes(rawCognitive.attentionBias)
        ? rawCognitive.attentionBias as typeof validAttentionBiases[number]
        : 'future_locked' as const,
      temporalFixation: (validTemporalFixations as readonly string[]).includes(rawCognitive.temporalFixation)
        ? rawCognitive.temporalFixation as typeof validTemporalFixations[number]
        : 'forward_projection' as const,
      agencyDistortion: (validAgencyDistortions as readonly string[]).includes(rawCognitive.agencyDistortion)
        ? rawCognitive.agencyDistortion as typeof validAgencyDistortions[number]
        : 'none' as const,
    }

    return {
      coreTension: parsed.coreTension || 'an unanswered tension',
      centralParadox: parsed.centralParadox || 'a prompt that contains its own contradiction',
      humanStakes: parsed.humanStakes || 'why this prompt touches ordinary lives',
      keyConcepts: parsed.keyConcepts || analysis.themes || [],
      guidingQuestion: parsed.guidingQuestion || thought,
      narrativeAngle: parsed.narrativeAngle || analysis.distortionType,
      orbitIntent: orbitIntent,
      cognitiveState,
      thoughtAnchors: parsed.thoughtAnchors ?? [],
    }
  } catch (error) {
    console.error('Layer 1 (Deep Understanding) failed (Anthropic), falling back to GPT-4o:', error)
    
    // Fallback to GPT-4o
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-5.2',
        messages: [
          { role: 'system', content: ORBIT_UNDERSTANDING_PROMPT },
          {
            role: 'user',
          content: `Interpret this prompt:\n\n"${thought}"\n\nContext: tone ${analysis.emotion}, intensity ${analysis.intensity}/10, themes: ${analysis.themes.join(', ')}`
          }
        ],
        temperature: 0.3,
        max_completion_tokens: 800,
        response_format: { type: 'json_object' }
      })

      const content = response.choices[0]?.message?.content
      if (!content) throw new Error('Empty GPT fallback response')
      const parsed = JSON.parse(content)

      // Validate and normalize actWeights if present
      let orbitIntent = parsed.orbitIntent || createFallbackOrbitIntent()
      if (orbitIntent.actWeights && !validateActWeights(orbitIntent.actWeights)) {
        console.warn('ActWeights do not sum to 1.0 in GPT fallback, normalizing...')
        orbitIntent.actWeights = normalizeActWeights(orbitIntent.actWeights)
      }

      const rawCog2 = parsed.cognitiveState || {}
      const fallbackCognitive = {
        attentionBias: (['future_locked', 'past_anchored', 'present_dissociated', 'self_focused', 'other_focused'] as string[]).includes(rawCog2.attentionBias) ? rawCog2.attentionBias : 'future_locked',
        temporalFixation: (['forward_projection', 'retrospective_loop', 'frozen_present'] as string[]).includes(rawCog2.temporalFixation) ? rawCog2.temporalFixation : 'forward_projection',
        agencyDistortion: (['outcome_dependence', 'control_fixation', 'learned_helplessness', 'none'] as string[]).includes(rawCog2.agencyDistortion) ? rawCog2.agencyDistortion : 'none',
      } as import('../types').CognitiveState

      return {
        coreTension: parsed.coreTension || 'a prompt without a final answer',
        centralParadox: parsed.centralParadox || 'the need to know in a world of limits',
        humanStakes: parsed.humanStakes || 'how people live with uncertainty',
        keyConcepts: parsed.keyConcepts || analysis.themes || [],
        guidingQuestion: parsed.guidingQuestion || thought,
        narrativeAngle: parsed.narrativeAngle || analysis.distortionType,
        orbitIntent: orbitIntent,
        cognitiveState: fallbackCognitive,
        thoughtAnchors: parsed.thoughtAnchors ?? [],
      }
    } catch (fallbackError) {
      console.error('Layer 1 fallback also failed:', fallbackError)
      return {
        coreTension: 'a prompt without a final answer',
        centralParadox: 'certainty versus ambiguity',
        humanStakes: 'how people carry unanswered prompts',
        keyConcepts: analysis.themes || [],
        guidingQuestion: thought,
        narrativeAngle: analysis.distortionType,
        orbitIntent: createFallbackOrbitIntent(),
        cognitiveState: { attentionBias: 'future_locked', temporalFixation: 'forward_projection', agencyDistortion: 'none' },
        thoughtAnchors: [],
      }
    }
  }
}
