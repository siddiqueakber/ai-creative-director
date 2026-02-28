import openai from '@/lib/openai'
import { 
  REFRAME_SYSTEM_PROMPT, 
  REFRAME_USER_PROMPT,
  parseReframeResult 
} from '@/lib/prompts/reframe'
import type { CognitiveAnalysis, ReframeResult } from '@/types'

export async function generateReframe(
  originalThought: string,
  analysis: CognitiveAnalysis
): Promise<ReframeResult> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: REFRAME_SYSTEM_PROMPT },
        { role: 'user', content: REFRAME_USER_PROMPT(originalThought, analysis) }
      ],
      temperature: 0.7,
      max_completion_tokens: 800,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Empty response from OpenAI')
    }

    const reframe = parseReframeResult(content)
    if (!reframe) {
      throw new Error('Failed to parse reframe')
    }

    return reframe
  } catch (error) {
    console.error('Reframe generation failed:', error)
    
    // Return a compassionate fallback
    return {
      title: '',
      thesis: '',
      outline: [],
      essayText: '',
      validationStatement: `What you're feeling is real and valid. ${analysis.emotion} is a natural human response to difficult circumstances.`,
      perspectiveShifts: [
        'This feeling is temporary, even when it doesn\'t feel that way',
        'Many others have felt exactly this way and found their way through',
        'You are more than this moment'
      ],
      reframedText: `It's okay to feel ${analysis.emotion} right now. This doesn't define you or your future. You're in the middle of a challenging moment, but moments pass. Take a breath. You're still here, still trying, and that matters.`,
    }
  }
}
