import anthropic from '@/lib/anthropic'
import type { CognitiveAnalysis } from '@/types'
import type { DeepUnderstandingResult, ScaleNeedClassification, ScaleNeedType } from '../types'

const SCALE_NEED_TYPES: ScaleNeedType[] = [
  'PERSONAL',
  'TEMPORAL',
  'BIOLOGICAL',
  'CIVILIZATIONAL',
  'PLANETARY',
  'COSMIC',
]

const SCALE_NEED_CLASSIFIER_PROMPT = `You are classifying what scale of reality a person's thought needs to be re-framed in.

SCALE NEED TYPES (choose 1 or 2 that best fit the thought):
- PERSONAL: self, identity, body, daily life, intimate scope
- TEMPORAL: time, lifespan, history, urgency, deadlines, aging
- BIOLOGICAL: evolution, body, nature, animals, ecosystems, life continuity
- CIVILIZATIONAL: society, economy, institutions, career, systems, human collective
- PLANETARY: earth as a whole, climate, planet-scale processes
- COSMIC: universe, stars, galaxies, cosmic scale, existence

EXAMPLES:
- Career anxiety → TEMPORAL, CIVILIZATIONAL
- Existence doubt / meaninglessness → COSMIC
- Loneliness / disconnection → BIOLOGICAL, PERSONAL
- Fear of failure → CIVILIZATIONAL
- Climate despair → PLANETARY, CIVILIZATIONAL
- Mortality / aging → TEMPORAL, BIOLOGICAL
- Identity crisis → PERSONAL, BIOLOGICAL

Respond with JSON only:
{ "scaleNeedTypes": ["TYPE1", "TYPE2"] }
Use 1 or 2 types. Order by relevance (primary first). Use only the exact strings: PERSONAL, TEMPORAL, BIOLOGICAL, CIVILIZATIONAL, PLANETARY, COSMIC.`

function normalizeScaleNeedTypes(raw: unknown): ScaleNeedType[] {
  if (!Array.isArray(raw) || raw.length === 0) return ['PERSONAL']
  const out: ScaleNeedType[] = []
  for (const item of raw.slice(0, 2)) {
    const s = String(item).toUpperCase()
    if (SCALE_NEED_TYPES.includes(s as ScaleNeedType)) {
      out.push(s as ScaleNeedType)
    }
  }
  return out.length > 0 ? out : ['PERSONAL']
}

export async function classifyScaleNeed(
  understanding: DeepUnderstandingResult,
  analysis: CognitiveAnalysis
): Promise<ScaleNeedClassification> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 200,
      system:
        SCALE_NEED_CLASSIFIER_PROMPT +
        '\n\nCRITICAL: Respond ONLY with a valid JSON object. No preamble or markdown.',
      messages: [
        {
          role: 'user',
          content: `Thought context:
- Core tension: ${understanding.coreTension}
- Guiding question: ${understanding.guidingQuestion}
- Narrative angle: ${understanding.narrativeAngle}
- Emotion: ${analysis.emotion}, intensity: ${analysis.intensity}/10
- Themes: ${analysis.themes.join(', ')}

Classify scale need(s).`,
        },
      ],
      temperature: 0.2,
    })

    const content = response.content[0].type === 'text' ? response.content[0].text : ''
    if (!content) return { scaleNeedTypes: ['PERSONAL'] }

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    const jsonString = jsonMatch ? jsonMatch[0] : content
    const parsed = JSON.parse(jsonString)

    const scaleNeedTypes = normalizeScaleNeedTypes(parsed.scaleNeedTypes)
    return { scaleNeedTypes }
  } catch (err) {
    console.error('[ScaleNeedClassifier]', err)
    return { scaleNeedTypes: ['PERSONAL'] }
  }
}
