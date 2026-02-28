import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET returns current video state only. The pipeline runs in the background
 * after POST /api/video (fire-and-forget). Do NOT run the pipeline here,
 * or each poll would block for minutes and duplicate pipeline runs.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const video = await prisma.video.findUnique({
      where: { id },
      include: {
        scenes: {
          orderBy: { sceneIndex: 'asc' },
        },
        narrationSegments: true,
      },
    })

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    const currentLayer = (() => {
      switch (video.pipelineStatus) {
        case 'pending':
        case 'understanding':
          return 1
        case 'blueprint':
          return 3
        case 'generating':
          return 6
        case 'assembling':
          return 7
        case 'ready':
          return 7
        case 'failed':
          return video.errorLayer || 0
        default:
          return 0
      }
    })()

    return NextResponse.json({
      id: video.id,
      status: video.pipelineStatus,
      finalVideoUrl: video.finalVideoUrl,
      thumbnailUrl: video.thumbnailUrl,
      totalDuration: video.totalDuration,
      errorMessage: video.errorMessage || undefined,
      errorLayer: video.errorLayer || undefined,
      progress: {
        currentLayer,
        scenes: video.scenes.map((scene) => ({
          index: scene.sceneIndex,
          status: scene.status,
          videoUrl: scene.runwayVideoUrl || undefined,
          prompt: scene.runwayPrompt || undefined,
        })),
        narration: video.narrationSegments.reduce<Record<string, any>>((acc, segment) => {
          acc[segment.segmentType] = {
            status: segment.status,
            audioUrl: segment.audioUrl || undefined,
          }
          return acc
        }, {}),
      },
    })

  } catch (error) {
    console.error('Video status check error:', error)
    return NextResponse.json(
      { error: 'Failed to check video status' },
      { status: 500 }
    )
  }
}
