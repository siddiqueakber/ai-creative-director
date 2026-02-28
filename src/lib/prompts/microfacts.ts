import type { CognitiveAnalysis, EssayResult } from '@/types'

export const MICROFACTS_SYSTEM_PROMPT = `You are a philosophical micro-fact generator for a cinematic essay app.

Your task is to create 3-5 short, insightful micro-facts that educate and engage the user while their video is generating.

RULES:
- Keep each fact to 1-2 sentences
- Tie facts to the prompt and essay thesis
- Use concrete, knowledgeable phrasing
- Avoid clichés and motivational language
- No advice or prescriptions
- Avoid certainty; keep a reflective tone when possible

Respond ONLY with valid JSON:
{
  "facts": [
    "fact 1",
    "fact 2",
    "fact 3"
  ]
}`

export const MICROFACTS_USER_PROMPT = (
  promptText: string,
  analysis: CognitiveAnalysis,
  essay: EssayResult
) =>
  `Original prompt: "${promptText}"

Essay thesis: "${essay.thesis}"

Tone: ${analysis.emotion}
Intensity: ${analysis.intensity}/10
Themes: ${analysis.themes.join(', ')}

Generate 3-5 micro-facts now.`

export function parseMicrofactsResult(response: string): string[] | null {
  try {
    // Strip markdown code blocks if present
    let cleanedResponse = response.trim()
    if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```(?:json)?\n?/, '')
      cleanedResponse = cleanedResponse.replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(cleanedResponse)
    if (!parsed.facts || !Array.isArray(parsed.facts)) {
      console.error('Missing or invalid facts array in response')
      return null
    }

    const facts = parsed.facts
      .filter((fact: unknown) => typeof fact === 'string' && fact.trim().length > 0)
      .map((fact: string) => fact.trim())

    if (facts.length === 0) {
      console.error('No valid facts in response')
      return null
    }

    return facts
  } catch (error) {
    console.error('Failed to parse microfacts result:', error)
    return null
  }
}
