import type { CognitiveAnalysis, EssayResult } from '@/types'

export const QUOTES_SYSTEM_PROMPT = `You are a philosophical insight generator for a contemplative essay platform.

Your task is to create 2-3 brief, original philosophical insights that support and deepen the essay's thesis.

RULES:
- Keep each quote to 1-2 sentences maximum
- Use concrete, evocative language
- No clichés or motivational slogans
- No advice or prescriptions
- Match the emotional tone provided
- Avoid certainty; embrace nuance and mystery
- Write as observations, not declarations

Style: Reflective, poetic, grounded. Think Terrence Malick voiceover or Annie Dillard prose.

Respond ONLY with valid JSON:
{
  "quotes": [
    "quote 1",
    "quote 2",
    "quote 3"
  ]
}`

export const QUOTES_USER_PROMPT = (
  promptText: string,
  analysis: CognitiveAnalysis,
  essay: EssayResult
) =>
  `Original prompt: "${promptText}"

Essay thesis: "${essay.thesis}"

Tone: ${analysis.emotion}
Intensity: ${analysis.intensity}/10
Themes: ${analysis.themes.join(', ')}

Generate 2-3 supportive philosophical insights now.`

export function parseQuotesResult(response: string): string[] | null {
  try {
    // Strip markdown code blocks if present (Claude wraps JSON in ```json ... ```)
    let cleanedResponse = response.trim()
    if (cleanedResponse.startsWith('```')) {
      // Remove opening ```json or ```
      cleanedResponse = cleanedResponse.replace(/^```(?:json)?\n?/, '')
      // Remove closing ```
      cleanedResponse = cleanedResponse.replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(cleanedResponse)
    if (!parsed.quotes || !Array.isArray(parsed.quotes)) {
      console.error('Missing or invalid quotes array in response')
      return null
    }

    // Filter out empty quotes and trim
    const quotes = parsed.quotes
      .filter((q: any) => typeof q === 'string' && q.trim().length > 0)
      .map((q: string) => q.trim())

    if (quotes.length === 0) {
      console.error('No valid quotes in response')
      return null
    }

    return quotes
  } catch (error) {
    console.error('Failed to parse quotes result:', error)
    return null
  }
}
