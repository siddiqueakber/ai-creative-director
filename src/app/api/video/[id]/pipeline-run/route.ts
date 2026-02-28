import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/video/[id]/pipeline-run
 * Returns the full pipeline run history for a video (observability / debug).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        id: true,
        pipelineStatus: true,
        errorMessage: true,
        errorLayer: true,
      },
    })

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    const steps = await prisma.pipelineStep.findMany({
      where: { videoId },
      orderBy: { createdAt: 'asc' },
      select: {
        layer: true,
        step: true,
        durationMs: true,
        payload: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      videoId: video.id,
      pipelineStatus: video.pipelineStatus,
      errorMessage: video.errorMessage,
      errorLayer: video.errorLayer,
      steps: steps.map((s) => ({
        layer: s.layer,
        step: s.step,
        durationMs: s.durationMs,
        payload: s.payload,
        createdAt: s.createdAt,
      })),
    })
  } catch (err) {
    console.error('[PipelineRun] GET failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
