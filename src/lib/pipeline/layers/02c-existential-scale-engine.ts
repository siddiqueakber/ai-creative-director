import anthropic from '@/lib/anthropic'
import type {
  DeepUnderstandingResult,
  PerspectivePostureResult,
  ScaleNeedClassification,
  ZoomPath,
} from '../types'

const RETURN_TO_SELF = 'return to self'

const ZOOM_PATH_PROMPT = `You are the Existential Scale Engine. Your job is to produce a ZOOM PATH: an ordered list of "scale steps" that take the viewer from their immediate concern outward through layers of reality, then back to themselves.

RULES:
1. Output a JSON array of short step labels (strings). Example: ["self", "daily routine", "human lifespan", "economic systems", "civilization", "industrial history", "planetary timeline", "return to self"]
2. The path MUST end with exactly "${RETURN_TO_SELF}" (literally that string). Do not omit it.
3. Steps should be 1-4 words each: concrete, filmable scales (self, body, room, street, city, species, earth, solar system, galaxy, cosmic timeline, etc.).
4. Length: typically 6-10 steps including "${RETURN_TO_SELF}".
5. Order: start at the personal/immediate, zoom out through the scale(s) suggested by scaleNeedTypes, then end with "${RETURN_TO_SELF}".

EXAMPLES BY SCALE NEED:
- TEMPORAL + CIVILIZATIONAL (e.g. career anxiety): self → daily routine → human lifespan → economic systems → civilization → industrial history → planetary timeline → return to self
- COSMIC (e.g. existence doubt): self → body → biological evolution → earth → solar system → galaxy → cosmic timeline → return to self
- BIOLOGICAL + PERSONAL (e.g. loneliness): self → body → family → species → ecosystem → earth → return to self

Respond ONLY with a JSON array of strings. No explanation. No markdown.`

function ensureReturnToSelf(steps: string[]): ZoomPath {
  const trimmed = steps.map((s) => String(s).trim()).filter(Boolean)
  const last = trimmed[trimmed.length - 1]?.toLowerCase()
  if (last === RETURN_TO_SELF.toLowerCase()) return trimmed as ZoomPath
  return [...trimmed, RETURN_TO_SELF] as ZoomPath
}

export async function generateZoomPath(
  scaleNeed: ScaleNeedClassification,
  understanding: DeepUnderstandingResult,
  perspective: PerspectivePostureResult
): Promise<ZoomPath> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 400,
      system: ZOOM_PATH_PROMPT + '\n\nCRITICAL: Respond ONLY with a JSON array. No preamble or markdown.',
      messages: [
        {
          role: 'user',
          content: `Scale need types: ${scaleNeed.scaleNeedTypes.join(', ')}

Guiding question: ${understanding.guidingQuestion}
Core tension: ${understanding.coreTension}
Narrative angle: ${understanding.narrativeAngle}

Perspective posture: ${perspective.posture}

Generate the zoom path array.`,
        },
      ],
      temperature: 0.3,
    })

    const content = response.content[0].type === 'text' ? response.content[0].text : ''
    if (!content) return [RETURN_TO_SELF] as ZoomPath

    const arrayMatch = content.match(/\[[\s\S]*\]/)
    const jsonString = arrayMatch ? arrayMatch[0] : content
    const parsed = JSON.parse(jsonString) as unknown

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [RETURN_TO_SELF] as ZoomPath
    }

    return ensureReturnToSelf(parsed as string[])
  } catch (err) {
    console.error('[ExistentialScaleEngine]', err)
    return [RETURN_TO_SELF] as ZoomPath
  }
}
