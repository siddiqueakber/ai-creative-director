import openai from '@/lib/openai'
import { 
  COGNITIVE_ANALYSIS_SYSTEM_PROMPT, 
  COGNITIVE_ANALYSIS_USER_PROMPT,
  parseCognitiveAnalysis 
} from '@/lib/prompts/analysis'
import type { CognitiveAnalysis } from '@/types'

export async function analyzeThought(thought: string): Promise<CognitiveAnalysis> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: COGNITIVE_ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: COGNITIVE_ANALYSIS_USER_PROMPT(thought) }
      ],
      temperature: 0.3,
      max_completion_tokens: 500,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Empty response from OpenAI')
    }

    const analysis = parseCognitiveAnalysis(content)
    if (!analysis) {
      throw new Error('Failed to parse analysis')
    }

    return analysis
  } catch (error) {
    console.error('Cognitive analysis failed:', error)
    
    // Return a safe default analysis
    return {
      emotion: 'meaning',
      distortionType: 'paradox',
      intensity: 5,
      themes: ['existence'],
      isCrisis: false,
      summary: 'A broad prompt about meaning and the human condition.'
    }
  }
}

