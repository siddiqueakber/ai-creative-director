import openai from '@/lib/openai'
import {
  ESSAY_SYSTEM_PROMPT,
  ESSAY_USER_PROMPT,
  parseEssayResult,
} from '@/lib/prompts/essay'
import type { CognitiveAnalysis, EssayResult } from '@/types'

export async function generateEssay(
  promptText: string,
  analysis: CognitiveAnalysis
): Promise<EssayResult> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: ESSAY_SYSTEM_PROMPT },
        { role: 'user', content: ESSAY_USER_PROMPT(promptText, analysis) },
      ],
      temperature: 0.6,
      max_completion_tokens: 600,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Empty response from OpenAI')
    }

    const essay = parseEssayResult(content)
    if (!essay) {
      throw new Error('Failed to parse essay')
    }

    return essay
  } catch (error) {
    console.error('Essay generation failed:', error)
    return {
      title: 'A prompt we carry',
      thesis: 'The prompt stays with us because it touches the shape of a human life.',
      outline: [
        'The scale of the prompt',
        'What it asks of ordinary lives',
        'Why the answer remains open',
      ],
      essayText: 'Some prompts do not end. They widen. We live inside them.',
    }
  }
}
