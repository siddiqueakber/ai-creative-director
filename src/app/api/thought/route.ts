import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'
import { analyzeThought } from '@/lib/services/cognitive-analysis'
import { generateEssay } from '@/lib/services/essay'
import { generateQuotes } from '@/lib/services/quotes'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()
    const { text, inputType } = body

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Invalid prompt text' },
        { status: 400 }
      )
    }
    if (text.length > 1000) {
      return NextResponse.json(
        { error: 'Prompt too long (max 1000 characters)' },
        { status: 400 }
      )
    }

    // Step 1: Analyze the prompt
    const analysis = await analyzeThought(text)
    const resolvedIntensity =
      typeof analysis.intensity === 'number'
        ? Math.min(10, Math.max(1, Math.round(analysis.intensity)))
        : 5
    analysis.intensity = resolvedIntensity

    // Step 2: Generate essay framing
    const essay = await generateEssay(text, analysis)

    // Step 2b: Generate supportive quotes (optional enhancement)
    try {
      console.log('🎯 Starting quote generation with Claude...')
      console.log('Essay thesis:', essay.thesis)
      const quotes = await generateQuotes(text, analysis, essay, 'claude')
      console.log('✅ Quotes generated successfully:', quotes)
      essay.quotes = quotes
    } catch (quoteError) {
      console.error('❌ Quote generation failed (non-critical):', quoteError)
      console.error('Error details:', quoteError instanceof Error ? quoteError.message : quoteError)
      // Continue without quotes - not critical to the experience
    }

    // Step 3: Save to database if user is logged in
    let thoughtId: string | undefined
    if (session?.user?.id) {
      try {
        const thought = await prisma.thought.create({
          data: {
            userId: session.user.id,
            originalText: text,
            inputType: inputType || 'text',
            emotion: analysis.emotion,
            distortionType: analysis.distortionType,
            intensity: resolvedIntensity,
            themes: [...(analysis.themes || [])],
            reframedText: essay.essayText,
          }
        })
        thoughtId = thought.id

        // Update daily use count
        await prisma.user.update({
          where: { id: session.user.id },
          data: {
            dailyUseCount: { increment: 1 },
            lastUseDate: new Date(),
          }
        })
      } catch (dbError) {
        console.error('Database error:', dbError)
        // Continue without saving - don't fail the request
      }
    }

    return NextResponse.json({
      success: true,
      thoughtId,
      analysis: {
        emotion: analysis.emotion,
        distortionType: analysis.distortionType,
        intensity: resolvedIntensity,
        themes: analysis.themes,
        summary: analysis.summary,
      },
      essay: {
        title: essay.title,
        thesis: essay.thesis,
        outline: essay.outline,
        essayText: essay.essayText,
        quotes: essay.quotes,
      }
    })

  } catch (error) {
    console.error('Prompt processing error:', error)
    return NextResponse.json(
      { error: 'Failed to process prompt' },
      { status: 500 }
    )
  }
}
