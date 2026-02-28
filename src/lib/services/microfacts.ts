import anthropic from '@/lib/anthropic'
import {
  MICROFACTS_SYSTEM_PROMPT,
  MICROFACTS_USER_PROMPT,
  parseMicrofactsResult,
} from '@/lib/prompts/microfacts'
import type { CognitiveAnalysis, EssayResult } from '@/types'

export async function generateMicrofacts(
  promptText: string,
  analysis: CognitiveAnalysis,
  essay: EssayResult
): Promise<string[]> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 500,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: `${MICROFACTS_SYSTEM_PROMPT}\n\n${MICROFACTS_USER_PROMPT(promptText, analysis, essay)}`,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    const facts = parseMicrofactsResult(content.text)
    if (!facts || facts.length === 0) {
      throw new Error('Failed to parse microfacts from Claude')
    }

    return facts
  } catch (error) {
    console.error('Microfacts generation failed:', error)
    return []
  }
}
