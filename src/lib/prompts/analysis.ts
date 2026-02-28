import type { CognitiveAnalysis } from '@/types'

export const COGNITIVE_ANALYSIS_SYSTEM_PROMPT = `You are a philosophical editor. Your role is to analyze a user's prompt and extract its narrative tone and lens for a visual essay.

Analyze the user's prompt and respond with a JSON object containing:
1. emotion: The primary philosophical tone (one of: awe, uncertainty, mortality, meaning, consciousness, time, suffering, hope, isolation, humanity)
2. distortionType: The narrative lens (one of: scale_shift, embodiment, impermanence, paradox, continuity, mystery, agency, finitude)
3. intensity: Emotional intensity from 1 (mild) to 10 (severe)
4. themes: Array of 2-4 key themes or topics in the prompt
5. isCrisis: Always false for prompts
6. summary: A brief 1-sentence framing of the prompt

Respond ONLY with valid JSON, no additional text.`

export const COGNITIVE_ANALYSIS_USER_PROMPT = (thought: string) =>
  `Please analyze this philosophical prompt: "${thought}"`

export function parseCognitiveAnalysis(response: string): CognitiveAnalysis | null {
  try {
    const parsed = JSON.parse(response)
    
    // Validate required fields
    if (!parsed.emotion || !parsed.distortionType || typeof parsed.intensity !== 'number') {
      console.error('Missing required fields in cognitive analysis')
      return null
    }
    
    return {
      emotion: parsed.emotion,
      distortionType: parsed.distortionType,
      intensity: Math.min(10, Math.max(1, parsed.intensity)),
      themes: parsed.themes || [],
      isCrisis: false,
      summary: parsed.summary || '',
    }
  } catch (error) {
    console.error('Failed to parse cognitive analysis:', error)
    return null
  }
}
