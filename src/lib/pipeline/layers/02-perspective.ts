import openai from '@/lib/openai'
import anthropic from '@/lib/anthropic'
import type { PerspectivePostureResult, DeepUnderstandingResult, AttentionBias, PerceptualTarget } from '../types'

const ATTENTION_TO_PERCEPTUAL: Record<AttentionBias, PerceptualTarget> = {
  future_locked: 'present_continuation',
  past_anchored: 'forward_flow',
  present_dissociated: 'embodied_sensation',
  self_focused: 'parallel_existence',
  other_focused: 'autonomous_processes',
}

const ORBIT_PERSPECTIVE_POSTURE_PROMPT = `You are setting the PERSPECTIVE POSTURE for an Orbit documentary session.

Orbit uses a fixed ritual structure:
VAST → LIVING DOT → MIRACLE OF YOU → RETURN

You are NOT choosing a theme or answering the prompt.
You are deciding HOW the ritual should be FELT for this session.

Base your decision strictly on the provided understanding and orbitIntent.
Do not invent new philosophies.

Respond with JSON ONLY with these fields:

- posture: one of
  ["humbling_continuity","grounded_endurance","quiet_awe","embodied_fragility","patient_return"]

- emotionalTone: short phrase (e.g. "awe → grounded", "quiet → accepting")

- cameraBias: array of allowed biases (e.g. ["wide","slow","observational"])

- narrationBias: array describing narration behavior
  (e.g. ["descriptive","non-authoritative","patient","accepting"])

- pacingBias: one of
  ["slow_opening_slow_close","slow_opening_quiet_close","even_pacing"]

- reinforceActs: array of acts to emphasize
  (subset of ["vast","earth","embryology","return"])

- avoid: array of forbidden tones or approaches
  (must include: "advice","definitions","productivity framing","preachy tone")

Rules:
- Never give advice.
- Never define life, meaning, or purpose.
- Never change or reorder acts.
- If orbitIntent.primaryNeed is "broaden-perspective", bias toward VAST + EARTH.
- If primaryNeed is "accept-struggle" or "restore-agency", bias toward EARTH + RETURN.
- If primaryNeed is "dissolve-hopelessness", bias toward EMBRYOLOGY + RETURN.
- If primaryNeed is "reduce-numbness", bias toward EMBRYOLOGY (embodiment focus).
- If primaryNeed is "soften-ego", bias toward VAST + EMBRYOLOGY (scale + fragility).
- RETURN must always be included in reinforceActs, but often lightly.`

export async function generatePerspectivePosture(
  thought: string,
  understanding: DeepUnderstandingResult
): Promise<PerspectivePostureResult> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1200,
      system: ORBIT_PERSPECTIVE_POSTURE_PROMPT + "\n\nCRITICAL: Respond ONLY with a valid JSON object. Do not include any preamble, commentary, or markdown formatting.",
      messages: [
        {
          role: 'user',
          content: `Prompt: "${thought}"

Interpretation:
- Core tension: ${understanding.coreTension}
- Central paradox: ${understanding.centralParadox}
- Human stakes: ${understanding.humanStakes}
- Key concepts: ${understanding.keyConcepts.join(', ')}
- Guiding question: ${understanding.guidingQuestion}
- Narrative angle: ${understanding.narrativeAngle}

Orbit Intent:
- Primary need: ${understanding.orbitIntent.primaryNeed}
- Secondary need: ${understanding.orbitIntent.secondaryNeed || 'none'}
- Act weights: VAST ${understanding.orbitIntent.actWeights.vast}, EARTH ${understanding.orbitIntent.actWeights.earth}, EMBRYOLOGY ${understanding.orbitIntent.actWeights.embryology}, RETURN ${understanding.orbitIntent.actWeights.return}
- Must avoid: ${understanding.orbitIntent.avoid.join(', ')}

Determine the perspective posture.`
        }
      ],
      temperature: 0.4,
    })

    const content = response.content[0].type === 'text' ? response.content[0].text : ''
    if (!content) throw new Error('Empty response')
    
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    const jsonString = jsonMatch ? jsonMatch[0] : content
    const parsed = JSON.parse(jsonString)

    const perceptualTarget = ATTENTION_TO_PERCEPTUAL[understanding.cognitiveState?.attentionBias] ?? 'present_continuation'

    return {
      posture: parsed.posture || 'grounded_endurance',
      emotionalTone: parsed.emotionalTone || 'observational → accepting',
      cameraBias: parsed.cameraBias || ['observational', 'slow'],
      narrationBias: parsed.narrationBias || ['descriptive', 'non-authoritative'],
      pacingBias: parsed.pacingBias || 'even_pacing',
      reinforceActs: parsed.reinforceActs || ['vast', 'earth', 'embryology', 'return'],
      avoid: parsed.avoid || ['advice', 'definitions', 'productivity framing', 'preachy tone'],
      perceptualTarget,
      perspectiveType: 'cosmic_awe',
      message: parsed.emotionalTone || 'Observational documentary posture.',
    } as PerspectivePostureResult
  } catch (error) {
    console.error('Layer 2 (Perspective Posture) failed (Anthropic), falling back to GPT-4o:', error)
    
    // Fallback to GPT-4o
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-5.2',
        messages: [
          { role: 'system', content: ORBIT_PERSPECTIVE_POSTURE_PROMPT },
          {
            role: 'user',
          content: `Prompt: "${thought}"

Interpretation:
- Core tension: ${understanding.coreTension}
- Central paradox: ${understanding.centralParadox}
- Human stakes: ${understanding.humanStakes}
- Key concepts: ${understanding.keyConcepts.join(', ')}
- Guiding question: ${understanding.guidingQuestion}
- Narrative angle: ${understanding.narrativeAngle}

Orbit Intent:
- Primary need: ${understanding.orbitIntent.primaryNeed}
- Secondary need: ${understanding.orbitIntent.secondaryNeed || 'none'}
- Act weights: VAST ${understanding.orbitIntent.actWeights.vast}, EARTH ${understanding.orbitIntent.actWeights.earth}, EMBRYOLOGY ${understanding.orbitIntent.actWeights.embryology}, RETURN ${understanding.orbitIntent.actWeights.return}
- Must avoid: ${understanding.orbitIntent.avoid.join(', ')}

Determine the perspective posture.`
          }
        ],
        temperature: 0.4,
        max_completion_tokens: 500,
        response_format: { type: 'json_object' }
      })

      const content = response.choices[0]?.message?.content
      if (!content) throw new Error('Empty GPT fallback response')
      const parsed = JSON.parse(content)

      const perceptualTarget2 = ATTENTION_TO_PERCEPTUAL[understanding.cognitiveState?.attentionBias] ?? 'present_continuation'

      return {
        posture: parsed.posture || 'grounded_endurance',
        emotionalTone: parsed.emotionalTone || 'observational → accepting',
        cameraBias: parsed.cameraBias || ['observational', 'slow'],
        narrationBias: parsed.narrationBias || ['descriptive', 'non-authoritative'],
        pacingBias: parsed.pacingBias || 'even_pacing',
        reinforceActs: parsed.reinforceActs || ['vast', 'earth', 'embryology', 'return'],
        avoid: parsed.avoid || ['advice', 'definitions', 'productivity framing', 'preachy tone'],
        perceptualTarget: perceptualTarget2,
        perspectiveType: 'cosmic_awe',
        message: parsed.emotionalTone || 'Observational documentary posture.',
      } as PerspectivePostureResult
    } catch (fallbackError) {
      console.error('Layer 2 fallback also failed:', fallbackError)
      return {
        posture: 'grounded_endurance',
        emotionalTone: 'observational → accepting',
        cameraBias: ['observational', 'slow'],
        narrationBias: ['descriptive', 'non-authoritative'],
        pacingBias: 'even_pacing',
        reinforceActs: ['vast', 'earth', 'embryology', 'return'],
        avoid: ['advice', 'definitions', 'productivity framing', 'preachy tone'],
        perceptualTarget: ATTENTION_TO_PERCEPTUAL[understanding.cognitiveState?.attentionBias] ?? 'present_continuation',
        perspectiveType: 'cosmic_awe',
        message: 'Observational documentary posture.',
      } as PerspectivePostureResult
    }
  }
}
