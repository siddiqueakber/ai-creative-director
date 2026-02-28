import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'
import { runPipeline } from '@/lib/pipeline/orchestrator'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()
    const { 
      thoughtId, 
      includeNarration = true,
    } = body

    if (!thoughtId || typeof thoughtId !== 'string') {
      return NextResponse.json(
        { error: 'Missing thoughtId' },
        { status: 400 }
      )
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if a video already exists for this thought
    const existing = await prisma.video.findUnique({
      where: { thoughtId },
      include: { scenes: true },
    })

    let resumeStatus: string = 'pending'

    // Smart resume: if we already have ready scenes, resume from 'generating'
    // instead of starting over from scratch
    if (existing) {
      const readyScenes = existing.scenes.filter((s) => s.status === 'ready' && s.runwayVideoUrl)
      if (readyScenes.length > 0 && existing.pipelineStatus !== 'ready') {
        // We have partial work — resume from 'generating' to skip Layers 1-5
        resumeStatus = 'generating'
        console.log(`[Video API] Resuming from 'generating' (${readyScenes.length}/${existing.scenes.length} scenes ready)`)
      }
    }

    const video = await prisma.video.upsert({
      where: { thoughtId },
      create: {
        thoughtId,
        pipelineStatus: 'pending',
      },
      update: {
        pipelineStatus: resumeStatus,
        errorMessage: null,
        errorLayer: null,
      },
      select: { id: true, pipelineStatus: true },
    })

    // Fire-and-forget pipeline execution
    console.log('[Video API] Pipeline started in background for videoId:', video.id)
    runPipeline(video.id).catch((error) => {
      console.error('[Pipeline] Run failed:', error)
    })

    return NextResponse.json({
      success: true,
      videoId: video.id,
      status: video.pipelineStatus,
      narrationEnabled: !!includeNarration,
      message: 'Pipeline started',
    })

  } catch (error) {
    console.error('Video generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate video' },
      { status: 500 }
    )
  }
}
