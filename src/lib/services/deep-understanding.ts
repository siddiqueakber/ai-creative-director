import openai from '@/lib/openai'
import type { CognitiveAnalysis } from '@/types'

// ============================================
// DEEP UNDERSTANDING LAYER
// Extracts meaning, not keywords
// This layer is NEVER shown to user
// ============================================

export interface DeepUnderstanding {
  // Core identity context
  identity: string[]  // e.g., ["immigrant", "parent", "student"]
  
  // The real loss beneath the surface
  coreLoss: string  // e.g., "expectations vs reality"
  
  // What they're afraid to admit
  hiddenFear: string  // e.g., "life effort was wasted"
  
  // Emotional layers (multiple can coexist)
  emotionalState: string[]  // e.g., ["shame", "grief", "exhaustion"]
  
  // The unspoken question
  existentialQuestion: string  // e.g., "Was it worth it?"
  
  // Life context clues
  lifeContext: {
    timeframe?: string  // "years of effort", "recent", "ongoing"
    sacrifice?: string  // what they gave up
    expectation?: string  // what they hoped for
    reality?: string  // what actually happened
  }
}

export interface PerspectiveSelection {
  // Type of broader truth that applies
  perspectiveType: 
    | 'shared_human_struggle'
    | 'universal_uncertainty'
    | 'common_silent_burden'
    | 'collective_perseverance'
    | 'impermanence_of_states'
    | 'dignity_in_effort'
  
  // The message (internal use only)
  message: string
  
  // What NOT to say (guardrails)
  avoid: string[]
}

const DEEP_UNDERSTANDING_PROMPT = `You are a depth psychologist analyzing a person's expressed thought to understand the MEANING beneath their words.

Your job is NOT to help or advise. It is to UNDERSTAND.

Extract the following (respond with JSON only):

1. "identity": Array of identity contexts visible in their words (immigrant, parent, worker, student, etc.)

2. "coreLoss": The actual loss they're experiencing beneath the surface words. Not what they said, but what they MEAN.
   Examples: "expectations vs reality", "unmet potential", "wasted sacrifice", "loss of meaning"

3. "hiddenFear": What they're afraid is true but haven't said directly.
   Examples: "my effort was meaningless", "I'm not enough", "I made the wrong choice", "it's too late"

4. "emotionalState": Array of emotions present (be specific, not generic).
   Use: shame, grief, exhaustion, rage, despair, loneliness, humiliation, betrayal, confusion, numbness, guilt, fear

5. "existentialQuestion": The unspoken question their thought is really asking.
   Examples: "Was it worth it?", "Am I enough?", "Did I fail?", "What now?", "Who am I if not this?"

6. "lifeContext": Object with optional fields:
   - "timeframe": how long this has been happening
   - "sacrifice": what they gave up
   - "expectation": what they hoped would happen
   - "reality": what actually happened

Be precise. Be honest. This is for understanding, not comfort.`

const PERSPECTIVE_SELECTION_PROMPT = `Based on the deep understanding of this person's struggle, select the BROADER HUMAN TRUTH that helps contextualize their pain WITHOUT invalidating it.

RULES (non-negotiable):
- NO comparison ("others have it worse")
- NO gratitude enforcement ("be grateful")
- NO toxic positivity ("everything happens for a reason")
- NO dismissal ("it's not that bad")
- ONLY shared humanity and universal experience

Select ONE perspective type that fits:
- "shared_human_struggle": Many carry invisible burdens
- "universal_uncertainty": No one knows if they're doing it right
- "common_silent_burden": Fatigue and doubt are universal
- "collective_perseverance": People keep going without answers
- "impermanence_of_states": This feeling is real but not permanent
- "dignity_in_effort": The trying itself has meaning

Respond with JSON:
{
  "perspectiveType": "<selected type>",
  "message": "<one sentence of shared truth - NOT advice, NOT comparison>",
  "avoid": ["<specific things NOT to say for this person>"]
}`

export async function extractDeepUnderstanding(
  thought: string,
  analysis: CognitiveAnalysis
): Promise<DeepUnderstanding> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: DEEP_UNDERSTANDING_PROMPT },
        { role: 'user', content: `Analyze this thought:\n\n"${thought}"\n\nSurface analysis shows: ${analysis.emotion}, intensity ${analysis.intensity}/10, themes: ${analysis.themes.join(', ')}` }
      ],
      temperature: 0.3,
      max_completion_tokens: 600,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Empty response')
    }

    const parsed = JSON.parse(content)

    return {
      identity: parsed.identity || [],
      coreLoss: parsed.coreLoss || 'unspoken loss',
      hiddenFear: parsed.hiddenFear || 'unspoken fear',
      emotionalState: parsed.emotionalState || [analysis.emotion],
      existentialQuestion: parsed.existentialQuestion || 'What now?',
      lifeContext: parsed.lifeContext || {}
    }
  } catch (error) {
    console.error('Deep understanding extraction failed:', error)
    
    // Fallback based on surface analysis
    return {
      identity: [],
      coreLoss: 'unmet expectations',
      hiddenFear: 'this struggle defines me',
      emotionalState: [analysis.emotion],
      existentialQuestion: 'What now?',
      lifeContext: {}
    }
  }
}

export async function selectPerspective(
  thought: string,
  understanding: DeepUnderstanding
): Promise<PerspectiveSelection> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: PERSPECTIVE_SELECTION_PROMPT },
        { role: 'user', content: `Original thought: "${thought}"

Deep understanding:
- Identity: ${understanding.identity.join(', ') || 'unspecified'}
- Core loss: ${understanding.coreLoss}
- Hidden fear: ${understanding.hiddenFear}
- Emotional state: ${understanding.emotionalState.join(', ')}
- Existential question: ${understanding.existentialQuestion}
- Context: ${JSON.stringify(understanding.lifeContext)}

Select the appropriate perspective.` }
      ],
      temperature: 0.4,
      max_completion_tokens: 300,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Empty response')
    }

    const parsed = JSON.parse(content)

    return {
      perspectiveType: parsed.perspectiveType || 'shared_human_struggle',
      message: parsed.message || 'Different lives carry different weights.',
      avoid: parsed.avoid || []
    }
  } catch (error) {
    console.error('Perspective selection failed:', error)
    
    // Safe fallback
    return {
      perspectiveType: 'shared_human_struggle',
      message: 'Many carry weights that others cannot see.',
      avoid: ['comparison', 'gratitude enforcement', 'toxic positivity']
    }
  }
}

// Combined function for full Layer 1+2 processing
export async function processDeepUnderstanding(
  thought: string,
  analysis: CognitiveAnalysis
): Promise<{
  understanding: DeepUnderstanding
  perspective: PerspectiveSelection
}> {
  const understanding = await extractDeepUnderstanding(thought, analysis)
  const perspective = await selectPerspective(thought, understanding)

  return { understanding, perspective }
}
