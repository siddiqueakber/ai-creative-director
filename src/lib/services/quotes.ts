import openai from '@/lib/openai'
import anthropic from '@/lib/anthropic'
import {
  QUOTES_SYSTEM_PROMPT,
  QUOTES_USER_PROMPT,
  parseQuotesResult,
} from '@/lib/prompts/quotes'
import type { CognitiveAnalysis, EssayResult } from '@/types'

/**
 * Generate 2-3 philosophical quotes/insights that support the essay thesis
 * using either OpenAI or Claude API
 */
export async function generateQuotes(
  promptText: string,
  analysis: CognitiveAnalysis,
  essay: EssayResult,
  provider: 'openai' | 'claude' = 'openai'
): Promise<string[]> {
  try {
    if (provider === 'claude') {
      return await generateQuotesWithClaude(promptText, analysis, essay)
    } else {
      return await generateQuotesWithOpenAI(promptText, analysis, essay)
    }
  } catch (error) {
    console.error(`Quote generation failed with ${provider}:`, error)
    // Return fallback quotes
    return [
      "Some questions don't resolve—they deepen.",
      "The answer lives in how we hold the question.",
    ]
  }
}

async function generateQuotesWithOpenAI(
  promptText: string,
  analysis: CognitiveAnalysis,
  essay: EssayResult
): Promise<string[]> {
  console.log('📡 Calling OpenAI API with model: gpt-5.2')
  const response = await openai.chat.completions.create({
    model: 'gpt-5.2',
    messages: [
      { role: 'system', content: QUOTES_SYSTEM_PROMPT },
      { role: 'user', content: QUOTES_USER_PROMPT(promptText, analysis, essay) },
    ],
    temperature: 0.7,
    max_completion_tokens: 300,
    response_format: { type: 'json_object' },
  })

  console.log('📥 OpenAI response received')
  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('Empty response from OpenAI')
  }

  console.log('📝 Raw API response:', content)
  const quotes = parseQuotesResult(content)
  if (!quotes || quotes.length === 0) {
    throw new Error('Failed to parse quotes from OpenAI')
  }

  console.log('✨ Parsed quotes:', quotes)
  return quotes
}

async function generateQuotesWithClaude(
  promptText: string,
  analysis: CognitiveAnalysis,
  essay: EssayResult
): Promise<string[]> {
  console.log('📡 Calling Claude API with model: claude-opus-4-6')
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 500,
    temperature: 0.7,
    messages: [
      {
        role: 'user',
        content: `${QUOTES_SYSTEM_PROMPT}\n\n${QUOTES_USER_PROMPT(promptText, analysis, essay)}`,
      },
    ],
  })

  console.log('📥 Claude response received')
  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  console.log('📝 Raw API response:', content.text)
  const quotes = parseQuotesResult(content.text)
  if (!quotes || quotes.length === 0) {
    throw new Error('Failed to parse quotes from Claude')
  }

  console.log('✨ Parsed quotes:', quotes)
  return quotes
}
