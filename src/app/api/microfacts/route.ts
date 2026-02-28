import { NextRequest, NextResponse } from 'next/server'
import { generateMicrofacts } from '@/lib/services/microfacts'
import type { CognitiveAnalysis, EssayResult } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { promptText, analysis, essay } = body as {
      promptText?: string
      analysis?: CognitiveAnalysis
      essay?: EssayResult
    }

    if (!promptText || typeof promptText !== 'string') {
      return NextResponse.json(
        { error: 'Invalid prompt text' },
        { status: 400 }
      )
    }
    if (!analysis || !essay) {
      return NextResponse.json(
        { error: 'Missing analysis or essay data' },
        { status: 400 }
      )
    }

    const facts = await generateMicrofacts(promptText, analysis, essay)

    return NextResponse.json({
      success: true,
      facts,
    })
  } catch (error) {
    console.error('Microfacts generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate microfacts' },
      { status: 500 }
    )
  }
}
