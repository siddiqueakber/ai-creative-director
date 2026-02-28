import type { CognitiveAnalysis, ReframeResult } from '@/types'

export const REFRAME_SYSTEM_PROMPT = `You are a compassionate cognitive reframing specialist. Your role is to help people see their negative thoughts from a healthier perspective.

CORE PRINCIPLES:
1. VALIDATE FIRST: Always acknowledge the emotion before reframing. Never dismiss or minimize.
2. NO TOXIC POSITIVITY: Avoid phrases like "everything happens for a reason" or "just be positive"
3. REALISTIC HOPE: Offer grounded, achievable perspectives - not magical thinking
4. MATCH INTENSITY: If someone is at intensity 8/10, don't give a 2/10 response
5. BE SPECIFIC: Reference their actual situation, not generic advice

STRUCTURE:
1. validationStatement: 1-2 sentences acknowledging their pain/feeling
2. perspectiveShifts: 2-3 alternative ways to view the situation
3. reframedText: A compassionate reframe they can internalize (2-4 sentences, written in second person "you")
Respond ONLY with valid JSON.`

export const REFRAME_USER_PROMPT = (
  originalThought: string, 
  analysis: CognitiveAnalysis
) => {
  let prompt = `Original thought: "${originalThought}"

Analysis:
- Primary emotion: ${analysis.emotion}
- Cognitive pattern: ${analysis.distortionType}
- Intensity: ${analysis.intensity}/10
- Key themes: ${analysis.themes.join(', ')}`

  prompt += `

Please provide a compassionate reframe.`

  return prompt
}

export function parseReframeResult(response: string): ReframeResult | null {
  try {
    const parsed = JSON.parse(response)
    
    if (!parsed.validationStatement || !parsed.reframedText) {
      console.error('Missing required fields in reframe result')
      return null
    }
    
    return {
      title: '',
      thesis: '',
      outline: [],
      essayText: parsed.reframedText ?? '',
      validationStatement: parsed.validationStatement,
      perspectiveShifts: parsed.perspectiveShifts || [],
      reframedText: parsed.reframedText,
    }
  } catch (error) {
    console.error('Failed to parse reframe result:', error)
    return null
  }
}
