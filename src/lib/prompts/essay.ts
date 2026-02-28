import type { CognitiveAnalysis, EssayResult } from '@/types'

export const ESSAY_SYSTEM_PROMPT = `You are a philosophical editor crafting the framing for a short cinematic essay.

RULES:
- No advice or prescriptions
- No motivational language
- Avoid certainty; keep it reflective
- Keep language concrete and visual when possible

Respond ONLY with valid JSON:
{
  "title": "short poetic title",
  "thesis": "1-2 sentences framing the prompt",
  "outline": ["point 1", "point 2", "point 3"],
  "essayText": "2-3 sentences for on-screen overlay"
}`

export const ESSAY_USER_PROMPT = (promptText: string, analysis: CognitiveAnalysis) =>
  `Prompt: "${promptText}"

Tone: ${analysis.emotion}
Lens: ${analysis.distortionType}
Intensity: ${analysis.intensity}/10
Themes: ${analysis.themes.join(', ')}

Create the essay framing now.`

export function parseEssayResult(response: string): EssayResult | null {
  try {
    const parsed = JSON.parse(response)
    if (!parsed.title || !parsed.thesis || !parsed.essayText) {
      console.error('Missing required fields in essay result')
      return null
    }

    return {
      title: parsed.title,
      thesis: parsed.thesis,
      outline: parsed.outline || [],
      essayText: parsed.essayText,
    }
  } catch (error) {
    console.error('Failed to parse essay result:', error)
    return null
  }
}
