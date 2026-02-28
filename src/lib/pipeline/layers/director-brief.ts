import type OpenAI from 'openai'
import type {
  DeepUnderstandingResult,
  PerspectivePostureResult,
  DirectorBrief,
  VisualGrammar,
  OrbitArchetype,
  ShotConstraints,
  AvoidList,
} from '../types'

const DIRECTOR_BRIEF_SYSTEM = `You are a documentary creative director. Given a user's thought, orbit intent, perspective, archetype, avoid list, and shot constraints, produce a SHORT Director Brief as JSON only.
Output: { "tone": string, "keyMetaphors": string[], "avoidPacing": string, "oneLiner": string, "visualGrammar": { "motionStyle": string, "lensStyle": string, "transitionStyle": string, "pacingStyle": string } }
- tone: one sentence on emotional/visual tone (e.g. "Quiet, observational; no drama.")
- keyMetaphors: 2-4 short metaphor ideas to touch in visuals/narration (e.g. "light through glass", "horizon as continuity")
- avoidPacing: one sentence on what pacing to avoid (e.g. "Avoid rushing the return act.")
- oneLiner: one sentence creative direction (e.g. "Hold the vast until it feels earned, then land in ordinary life.")
- visualGrammar: how the film looks and moves (all downstream steps obey this):
  - motionStyle: one of "slow_cinematic_drift", "locked_off", "handheld_subtle"
  - lensStyle: one of "wide_angle", "normal", "mixed"
  - transitionStyle: one of "dissolve", "cut", "match_cut"
  - pacingStyle: one of "contemplative", "even", "slow_open_quiet_close"
Keep each field brief. No preamble, only valid JSON.`

/**
 * One GPT-4o call to produce a short Director Brief from thought, understanding, perspective, archetype, avoid list, and shot constraints.
 */
export async function generateDirectorBrief(
  openai: OpenAI,
  thought: string,
  understanding: DeepUnderstandingResult,
  perspective: PerspectivePostureResult,
  archetype: OrbitArchetype,
  avoidList: AvoidList,
  shotConstraints: ShotConstraints
): Promise<DirectorBrief> {
  const userContent = `THOUGHT: "${thought.slice(0, 800)}"

ORBIT INTENT: primary need=${understanding.orbitIntent.primaryNeed}; guiding question=${understanding.guidingQuestion}; human stakes=${understanding.humanStakes}

PERSPECTIVE: posture=${perspective.posture}; emotional tone=${perspective.emotionalTone}; pacing bias=${perspective.pacingBias}

ARCHETYPE: ${archetype}

AVOID (do not repeat): act types: ${avoidList.actTypes.join(', ') || 'none'}; settings: ${avoidList.settings.join(', ') || 'none'}; snippets: ${avoidList.promptSnippets.slice(0, 5).join('; ') || 'none'}

SHOT CONSTRAINTS: no repeat motif in row=${shotConstraints.noRepeatMotifInRow}; min metaphor shots per act=${shotConstraints.minMetaphorShotsPerAct}; max same type=${shotConstraints.maxShotsSameType}

Produce the Director Brief JSON.`

  function fallbackVisualGrammar(): VisualGrammar {
    return {
      motionStyle: 'slow_cinematic_drift',
      lensStyle: 'wide_angle',
      transitionStyle: 'dissolve',
      pacingStyle: 'contemplative',
    }
  }

  function fallbackBrief(): DirectorBrief {
    const toneByArchetype: Record<OrbitArchetype, string> = {
      cosmic_first: 'Quiet, cosmic scale first; then grounded. No drama.',
      human_first: 'Grounded, human scale; observational. No drama.',
      parallel_lives: 'Quiet, observational; parallel scales. No drama.',
      conflict: 'Quiet tension, no resolution. Observational.',
      abstract: 'Quiet, metaphorical; no literal advice.',
    }
    return {
      tone: toneByArchetype[archetype] ?? 'Quiet, observational; no drama.',
      keyMetaphors: ['continuity', 'presence', 'horizon'],
      avoidPacing: 'Avoid rushing the return act.',
      oneLiner: 'Hold the vast until it feels earned, then land in ordinary life.',
      visualGrammar: fallbackVisualGrammar(),
    }
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: DIRECTOR_BRIEF_SYSTEM },
        { role: 'user', content: userContent },
      ],
      temperature: 0.4,
      max_completion_tokens: 400,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) return fallbackBrief()

    const parsed = JSON.parse(content) as Record<string, unknown>
    const vg = parsed.visualGrammar as Record<string, unknown> | undefined
    const motionStyle = (vg?.motionStyle === 'slow_cinematic_drift' || vg?.motionStyle === 'locked_off' || vg?.motionStyle === 'handheld_subtle') ? vg.motionStyle : 'slow_cinematic_drift'
    const lensStyle = (vg?.lensStyle === 'wide_angle' || vg?.lensStyle === 'normal' || vg?.lensStyle === 'mixed') ? vg.lensStyle : 'wide_angle'
    const transitionStyle = (vg?.transitionStyle === 'dissolve' || vg?.transitionStyle === 'cut' || vg?.transitionStyle === 'match_cut') ? vg.transitionStyle : 'dissolve'
    const pacingStyle = (vg?.pacingStyle === 'contemplative' || vg?.pacingStyle === 'even' || vg?.pacingStyle === 'slow_open_quiet_close') ? vg.pacingStyle : 'contemplative'
    return {
      tone: typeof parsed.tone === 'string' ? parsed.tone : fallbackBrief().tone,
      keyMetaphors: Array.isArray(parsed.keyMetaphors)
        ? (parsed.keyMetaphors as string[]).slice(0, 4)
        : ['continuity', 'presence'],
      avoidPacing: typeof parsed.avoidPacing === 'string' ? parsed.avoidPacing : 'Avoid rushing.',
      oneLiner: typeof parsed.oneLiner === 'string' ? parsed.oneLiner : fallbackBrief().oneLiner,
      visualGrammar: {
        motionStyle: motionStyle as VisualGrammar['motionStyle'],
        lensStyle: lensStyle as VisualGrammar['lensStyle'],
        transitionStyle: transitionStyle as VisualGrammar['transitionStyle'],
        pacingStyle: pacingStyle as VisualGrammar['pacingStyle'],
      },
    }
  } catch (err) {
    // e.g. 429 billing_not_active, rate limits, or network errors: use deterministic brief so pipeline continues
    console.warn('[Director Brief] OpenAI call failed, using fallback brief:', err instanceof Error ? err.message : err)
    return fallbackBrief()
  }
}
