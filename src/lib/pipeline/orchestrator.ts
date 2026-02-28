import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import openai from '@/lib/openai'
import type { CognitiveAnalysis } from '@/types'
import { getAvoidListFromLastNVideos, getLastNFingerprints, getPreviousNarrationTexts } from './avoid-list'
import { getShotConstraints, selectArchetype } from './orbit-constraints'
import { generateDeepUnderstanding } from './layers/01-understanding'
import { classifyScaleNeed } from './layers/02a-scale-need-classifier'
import { generatePerspectivePosture } from './layers/02-perspective'
import { generateZoomPath } from './layers/02c-existential-scale-engine'
import { buildDocumentaryStructureFromZoomPath, generateDocumentaryStructure } from './layers/02b-documentary-director'
import { generateDirectorBrief } from './layers/director-brief'
import {
  generateMasterTimelineSkeleton,
  fillMasterTimelineWithNarration,
  shotPlanFromMasterTimeline,
} from './layers/master-timeline'
import { refineShotPromptsWithOpenAI } from './layers/04-shot-planning'
import { generateDocumentaryNarrationForTimeline, generateNarrationAudioElevenLabs } from './layers/05-narration'
import { runQualityControlPostGen, runQualityControlPreGen } from './layers/05b-qc'
import { generateShotVideo, pollSceneVideo } from './layers/06-video-gen'
import { assembleFinalVideo } from './layers/07-assembly'
import { buildMusicPlan, buildMusicPrompt, generateMusicTrack } from './layers/05c-music'
import { bufferToDataUrl, writePublicFile } from './providers/storage'
import type {
  DeepUnderstandingResult,
  PerspectivePostureResult,
  DocumentaryStructure,
  ShotPlan,
  AvoidList,
} from './types'
import { withLayerTiming } from './pipeline-logger'

function mapLightingToTimeOfDay(
  timeOfDay: 'night' | 'dawn' | 'day' | 'dusk'
): 'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk' | 'evening' | 'night' {
  const map = { night: 'night' as const, dawn: 'dawn' as const, day: 'midday' as const, dusk: 'dusk' as const }
  return map[timeOfDay] ?? 'morning'
}

function mapVisualCategoryToSetting(
  visualCategory: string
): 'urban' | 'suburban' | 'rural' | 'interior' | 'transit' | 'workplace' | 'public_space' | 'space' {
  const map: Record<string, 'urban' | 'rural' | 'interior' | 'public_space' | 'space' | 'workplace'> = {
    cosmos: 'space',
    earth: 'rural',
    human: 'urban',
    nature: 'rural',
    abstract: 'interior',
    conflict: 'public_space',
    ocean: 'rural',
    domestic: 'interior',
    industrial: 'workplace',
    desert: 'rural',
  }
  return map[visualCategory] ?? 'rural'
}

function mergeShotPlanIntoAvoidList(avoidList: AvoidList, shotPlan: ShotPlan[]): void {
  shotPlan.forEach((shot) => {
    if (shot.actType) avoidList.actTypes.push(shot.actType)
    if (shot.setting) avoidList.settings.push(shot.setting)
    if (shot.microAction) avoidList.microActions.push(shot.microAction)
    const snippet = (shot.runwayPrompt || shot.description || '').trim().slice(0, 60)
    if (snippet) avoidList.promptSnippets.push(snippet)
  })
  avoidList.actTypes = [...new Set(avoidList.actTypes)]
  avoidList.settings = [...new Set(avoidList.settings)]
  avoidList.microActions = [...new Set(avoidList.microActions)]
  avoidList.promptSnippets = [...new Set(avoidList.promptSnippets)].slice(0, 40)
}

export async function runPipeline(videoId: string): Promise<void> {
  console.log('[Pipeline] Starting run for videoId:', videoId)

  // Read the current status to determine resume point before the lock overwrites it
  const preVideo = await prisma.video.findUnique({ where: { id: videoId }, select: { pipelineStatus: true } })
  const isResume = preVideo?.pipelineStatus === 'generating'

  // Prevent concurrent pipeline runs for the same video.
  // Accept 'generating' because the API route sets it for smart resume (skip Layers 1-5).
  // When resuming, preserve 'generating' so the pipeline skips to Layer 6; otherwise start from 'understanding'.
  const lock = await prisma.video.updateMany({
    where: { id: videoId, pipelineStatus: { in: ['pending', 'failed', 'generating'] } },
    data: { pipelineStatus: isResume ? 'generating' : 'understanding', errorMessage: null, errorLayer: null },
  })

  if (lock.count === 0) {
    console.log('[Pipeline] Skipping – another run already in progress for', videoId)
    return
  }

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: {
      thought: true,
      scenes: true,
      narrationSegments: true,
    },
  })

  if (!video || !video.thought) {
    throw new Error('Video or thought not found')
  }

  const analysis: CognitiveAnalysis = {
    emotion: video.thought.emotion as CognitiveAnalysis['emotion'],
    distortionType: video.thought.distortionType as CognitiveAnalysis['distortionType'],
    intensity: video.thought.intensity,
    themes: video.thought.themes,
    isCrisis: false,
    summary: '',
  }

  const originalThought = video.thought.originalText

  let pipelineStatus = video.pipelineStatus
  let musicUrl: string | null = null

  // ============================================
  // LAYER 1-2: UNDERSTANDING, SCALE NEED, PERSPECTIVE, ZOOM PATH, DOCUMENTARY STRUCTURE
  // ============================================
  if (pipelineStatus === 'pending' || pipelineStatus === 'understanding') {
    await withLayerTiming(videoId, 'understanding', async () => {
      console.log('[Pipeline] Layer 1–2: Understanding, scale need, perspective, zoom path, documentary structure')
      // Reset any prior scenes/narration so new durations take effect
      await prisma.videoScene.deleteMany({ where: { videoId } })
      await prisma.narrationSegment.deleteMany({ where: { videoId } })

      const understanding = await generateDeepUnderstanding(originalThought, analysis)
      const scaleNeedClassification = await classifyScaleNeed(understanding, analysis)
      const perspective = await generatePerspectivePosture(originalThought, understanding)
      const zoomPath = await generateZoomPath(scaleNeedClassification, understanding, perspective)
      const documentaryStructure = buildDocumentaryStructureFromZoomPath(
        zoomPath,
        understanding,
        perspective,
        analysis.intensity
      )

      await prisma.video.update({
        where: { id: videoId },
        data: {
          understanding: understanding as any,
          perspective: perspective as any,
          scaleNeedClassification: scaleNeedClassification as any,
          zoomPath: zoomPath as any,
          documentaryStructure: documentaryStructure as any,
          intensityLevel: analysis.intensity,
          narrationStyle: documentaryStructure.narrationStyle,
          pipelineStatus: 'blueprint',
        },
      })
    })
    pipelineStatus = 'blueprint'
  }

  // ============================================
  // LAYER 3: DOCUMENTARY BLUEPRINT
  // ============================================
  if (pipelineStatus === 'blueprint') {
    await withLayerTiming(videoId, 'blueprint', async () => {
    const refreshed = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        understanding: true,
        perspective: true,
        documentaryStructure: true,
      },
    })

    const understanding = refreshed?.understanding as unknown as DeepUnderstandingResult
    const perspective = refreshed?.perspective as unknown as PerspectivePostureResult
    const documentaryStructure =
      refreshed?.documentaryStructure as unknown as DocumentaryStructure

    const userId = video.thought.userId ?? null
    let avoidList = await getAvoidListFromLastNVideos(prisma, userId, 5)
    const lastNFingerprints = await getLastNFingerprints(prisma, userId, 5)
    const archetype = selectArchetype(understanding, analysis.intensity)
    const shotConstraints = getShotConstraints(archetype)
    const directorBrief = await generateDirectorBrief(
      openai,
      originalThought,
      understanding,
      perspective,
      archetype,
      avoidList,
      shotConstraints
    )

    const MAX_QC_RETRIES = 2
    let narration!: Awaited<ReturnType<typeof generateDocumentaryNarrationForTimeline>>
    let masterTimeline!: Awaited<ReturnType<typeof generateMasterTimelineSkeleton>>
    let shotPlan!: ShotPlan[]
    let qcPreGen!: ReturnType<typeof runQualityControlPreGen>

    // Fetch previous narration texts for avoidance
    const previousNarrationTexts = await getPreviousNarrationTexts(prisma, userId, 5)

    for (let retry = 0; retry <= MAX_QC_RETRIES; retry++) {
      // Timeline-first: generate skeleton (no narration), then narration fitted to beats, then fill timeline
      masterTimeline = await generateMasterTimelineSkeleton(openai, {
        videoId,
        directorBrief,
        documentaryStructure,
        understanding,
        perspective,
        avoidList,
        lastNFingerprints,
      })

      narration = await generateDocumentaryNarrationForTimeline(
        originalThought,
        understanding,
        perspective,
        documentaryStructure,
        directorBrief,
        masterTimeline,
        avoidList,
        previousNarrationTexts
      )

      fillMasterTimelineWithNarration(masterTimeline, narration)

      // Persist filled timeline to DB
      if (prisma.masterTimeline) {
        await prisma.masterTimeline.upsert({
          where: { videoId },
          create: {
            videoId,
            totalDurationSec: masterTimeline.totalDurationSec,
            beats: masterTimeline.beats as object,
          },
          update: {
            totalDurationSec: masterTimeline.totalDurationSec,
            beats: masterTimeline.beats as object,
          },
        })
      }

      // Shot plan from timeline (one beat = one shot)
      shotPlan = shotPlanFromMasterTimeline(masterTimeline, documentaryStructure)
      if (directorBrief) {
        shotPlan = await refineShotPromptsWithOpenAI(openai, shotPlan, directorBrief, avoidList, masterTimeline, narration)
      }

      qcPreGen = runQualityControlPreGen({
        structure: documentaryStructure,
        narration,
        shotPlan,
        shotConstraints,
        avoidList,
        lastNFingerprints,
        masterTimeline,
      })

      shotPlan = qcPreGen.shotPlan
      narration = qcPreGen.narration

      if (qcPreGen.passed || retry === MAX_QC_RETRIES) break
      mergeShotPlanIntoAvoidList(avoidList, shotPlan)
    }

    const qcStructure = qcPreGen.structure

    // Layer 5c - Music plan and (optional) AI-generated score
    try {
      const musicPlan = buildMusicPlan(qcStructure, masterTimeline, narration)
      const musicPrompt = buildMusicPrompt(musicPlan, understanding, perspective)
      console.log(`[Pipeline] Generating music track (targetDuration=${musicPlan.targetDurationSec}s)...`)
      musicUrl = await generateMusicTrack(videoId, musicPlan, musicPrompt)
      if (musicUrl) {
        console.log(`[Pipeline] Music track generated successfully: ${musicUrl}`)
      } else {
        console.warn(`[Pipeline] Music generation returned null, video will render without music`)
      }
    } catch (error) {
      console.error('[Pipeline] Music generation failed, continuing without music:', error)
      musicUrl = null
    }

    await prisma.video.update({
      where: { id: videoId },
      data: {
        blueprint: Prisma.JsonNull,
        documentaryStructure: qcStructure as any,
        totalDuration: qcStructure.totalDuration,
        qcReport: { preGen: qcPreGen.report } as any,
        pipelineStatus: 'generating',
      },
    })
    pipelineStatus = 'generating'

    // Create scene records from timeline beats (one VideoScene per beat)
    const existingScenes = await prisma.videoScene.findMany({ where: { videoId } })
    if (existingScenes.length === 0) {
      await prisma.videoScene.createMany({
        data: masterTimeline.beats.map((beat) => ({
          videoId,
          sceneIndex: beat.beatIndex,
          description: beat.veoPrompt.slice(0, 500),
          symbolism: '',
          duration: beat.durationSec,
          timeOfDay: mapLightingToTimeOfDay(beat.lighting.timeOfDay),
          setting: mapVisualCategoryToSetting(beat.visualCategory),
          actType: documentaryStructure.acts[beat.actIndex]?.actType,
          actIndex: beat.actIndex,
          clipIndex: beat.beatIndex,
          microAction: beat.narrationText ?? '',
          runwayPrompt: beat.veoPrompt,
          status: 'pending',
        })),
      })
    }

    // Delete stale narration segments from any previous pipeline attempt, then create fresh ones
    // so segment count always matches the current timeline's beat count.
    await prisma.narrationSegment.deleteMany({ where: { videoId } })
    await prisma.narrationSegment.createMany({
      data: narration.segments.map((segment, index) => ({
        videoId,
        segmentType: `segment_${index}`,
        text: segment.text,
        startTime: segment.startTime,
        duration: segment.duration,
        actIndex: segment.actIndex,
        pauseAfter: segment.pauseAfter,
        wordCount: segment.wordCount,
        status: 'pending',
      })),
    })
    })
  }

  // ============================================
  // LAYER 6: VIDEO GENERATION
  // ============================================
  if (pipelineStatus === 'generating') {
    await withLayerTiming(videoId, 'video_gen', async () => {
    console.log('[Pipeline] Layer 6: Video generation (Vertex AI Veo)')
    const currentVideo = await prisma.video.findUnique({
      where: { id: videoId },
      include: { scenes: true, narrationSegments: true },
    })

    if (!currentVideo) return

    // Start jobs for scenes that don't have them yet (claim to avoid duplicates)
    for (const scene of currentVideo.scenes) {
      if (!scene.runwayJobId && scene.runwayPrompt && scene.status === 'pending') {
        const claim = await prisma.videoScene.updateMany({
          where: { id: scene.id, runwayJobId: null, status: 'pending' },
          data: { status: 'processing' },
        })

        if (claim.count === 0) continue

        try {
          const job = await generateShotVideo({
            actIndex: scene.actIndex ?? 0,
            clipIndex: scene.clipIndex ?? 0,
            duration: scene.duration,
            description: scene.description || '',
            microAction: scene.microAction || '',
            runwayPrompt: scene.runwayPrompt || '',
            styleModifiers: [],
            timeOfDay: (scene.timeOfDay as ShotPlan['timeOfDay']) || 'morning',
            setting: (scene.setting as ShotPlan['setting']) || 'urban',
            source: 'GEN',
            actType: (scene.actType as ShotPlan['actType']) ?? undefined,
          })

          await prisma.videoScene.update({
            where: { id: scene.id },
            data: {
              runwayJobId: job.jobId,
              status: job.status,
              runwayVideoUrl: job.videoUrl,
            },
          })
        } catch (error) {
          await prisma.videoScene.update({
            where: { id: scene.id },
            data: { status: 'failed', runwayJobId: null },
          })
          throw error
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    // Narration TTS: ElevenLabs when env is set; otherwise no narration audio. Sort by startTime so order matches timeline (one segment per shot).
    const sortedSegments = [...currentVideo.narrationSegments].sort(
      (a, b) => (a.startTime ?? 0) - (b.startTime ?? 0)
    )
    if (
      sortedSegments.length > 0 &&
      process.env.ELEVENLABS_API_KEY?.trim() &&
      process.env.ELEVENLABS_VOICE_ID?.trim()
    ) {
      const narrationForTts = {
        segments: sortedSegments.map((seg) => ({
          text: seg.text,
          startTime: seg.startTime ?? 0,
          duration: seg.duration ?? 3,
          actIndex: seg.actIndex ?? 0,
          pauseAfter: 1,
          wordCount: seg.wordCount ?? seg.text.split(/\s+/).length,
          status: 'pending' as const,
          visualCue: '',
          motif: 'quiet_return' as const,
          scaleType: 'human' as const,
          shotType: 'wide' as const,
          settingHint: 'urban' as const,
        })),
        totalWordCount: sortedSegments.reduce(
          (s, seg) => s + (seg.wordCount ?? seg.text.split(/\s+/).length),
          0
        ),
        avgPauseDuration: 1,
      }
      const audioMap = await generateNarrationAudioElevenLabs(narrationForTts)
      for (let i = 0; i < sortedSegments.length; i++) {
        const buf = audioMap.get(i)
        if (buf && buf.length > 0) {
          await prisma.narrationSegment.update({
            where: { id: sortedSegments[i].id },
            data: {
              audioUrl: bufferToDataUrl(buf, 'audio/mpeg'),
              status: 'ready',
            },
          })
        }
      }
    }

    // Safe fallback prompts for RAI-filtered scenes (indexed by actType)
    const RAI_SAFE_PROMPTS: Record<string, string[]> = {
      vast: [
        'Time-lapse of stars moving across a dark sky over a desert landscape. Static camera. Natural light.',
        'Slow aerial view of ocean waves at night under moonlight. Stabilized camera. No humans.',
      ],
      living_dot: [
        'Wide view of a green valley with a river flowing through it at golden hour. Steady camera. Natural light.',
        'Flock of birds flying in formation over wetlands at dusk. Observational camera.',
      ],
      miracle_of_you: [
        'Whale moving through deep blue ocean, natural history documentary style, soft underwater light. No humans.',
        'Falcon soaring over a canyon at golden hour, wide shot, stabilized camera. No humans.',
        'Earth from space at night, city lights and day-night terminator, slow drift. No humans.',
        'Underwater bioluminescence in deep ocean, calm movement, soft blue light. No humans.',
        'Volcanic lava flow meeting the ocean at dusk, wide shot, natural light. No humans.',
        'Sun breaking through clouds over open ocean, time-lapse, observational. No humans.',
        'Humpback whale breaching in grey open ocean, natural history style, stabilized camera. No humans.',
        'Coral reef teeming with life, slow drift, underwater documentary style, soft light. No humans.',
      ],
      return: [
        'Wide aerial view of city lights at night, traffic flow like circulation. No street-level, no close humans.',
        'Process or open system: light changing over a landscape at golden hour. No street-level humans, no indoor.',
      ],
    }

    // Track which scenes have already been retried (to avoid infinite loops)
    const retriedSceneIds = new Set<string>()

    // Poll in-flight scene jobs until all complete or one fails (Vertex Veo can take 5–10+ min per scene)
    const pollIntervalMs = 18_000 // 18s between poll rounds
    const maxWaitMs = 25 * 60 * 1000 // 25 minutes max for Layer 6
    const startedAt = Date.now()

    let updated = await prisma.videoScene.findMany({ where: { videoId } })
    let allReady = updated.every((s) => s.status === 'ready')
    let allSettled = updated.every((s) => s.status === 'ready' || s.status === 'failed')

    while (!allSettled && Date.now() - startedAt < maxWaitMs) {
      const scenes = await prisma.videoScene.findMany({ where: { videoId } })
      for (const scene of scenes) {
        if (scene.runwayJobId && scene.status !== 'ready' && scene.status !== 'failed') {
          const status = await pollSceneVideo(scene.runwayJobId)
          await prisma.videoScene.update({
            where: { id: scene.id },
            data: {
              status: status.status,
              runwayVideoUrl: status.videoUrl,
            },
          })

          // If scene was RAI-filtered, retry once with a safe prompt
          if (status.status === 'failed' && !retriedSceneIds.has(scene.id)) {
            const actType = (scene.actType || 'return') as string
            const safePrompts = RAI_SAFE_PROMPTS[actType] || RAI_SAFE_PROMPTS.return
            const safePrompt = safePrompts[(scene.clipIndex ?? 0) % safePrompts.length]

            console.log(`[Pipeline] Layer 6: Scene ${scene.sceneIndex} (${actType}) RAI-filtered, retrying with safe prompt`)
            retriedSceneIds.add(scene.id)

            try {
              const retryJob = await generateShotVideo({
                actIndex: scene.actIndex ?? 0,
                clipIndex: scene.clipIndex ?? 0,
                duration: scene.duration,
                description: safePrompt,
                microAction: '',
                runwayPrompt: safePrompt,
                styleModifiers: [],
                timeOfDay: (scene.timeOfDay as ShotPlan['timeOfDay']) || 'morning',
                setting: (scene.setting as ShotPlan['setting']) || 'urban',
                source: 'GEN',
                actType: (scene.actType as ShotPlan['actType']) ?? undefined,
              })

              await prisma.videoScene.update({
                where: { id: scene.id },
                data: {
                  runwayJobId: retryJob.jobId,
                  status: retryJob.status === 'failed' ? 'failed' : 'processing',
                  runwayVideoUrl: retryJob.videoUrl,
                  runwayPrompt: safePrompt,
                },
              })
            } catch (retryError) {
              console.error(`[Pipeline] Layer 6: Retry failed for scene ${scene.sceneIndex}:`, retryError)
            }
          }
        }
      }
      updated = await prisma.videoScene.findMany({ where: { videoId } })
      allReady = updated.every((s) => s.status === 'ready')
      allSettled = updated.every((s) => s.status === 'ready' || s.status === 'failed')
      if (!allSettled) {
        console.log('[Pipeline] Layer 6: waiting for Vertex Veo jobs…', { ready: updated.filter((s) => s.status === 'ready').length, total: updated.length })
        await new Promise((r) => setTimeout(r, pollIntervalMs))
      }
    }

    if (!allReady && Date.now() - startedAt >= maxWaitMs) {
      await prisma.video.update({
        where: { id: videoId },
        data: {
          pipelineStatus: 'failed',
          errorMessage: 'Video generation timed out (Vertex AI Veo)',
          errorLayer: 6,
        },
      })
      return
    }

    // Check how many scenes succeeded
    const readyScenes = updated.filter((s) => s.status === 'ready' && s.runwayVideoUrl)
    const failedScenes = updated.filter((s) => s.status === 'failed')

    if (readyScenes.length === 0) {
      // No scenes succeeded at all — fail
      await prisma.video.update({
        where: { id: videoId },
        data: {
          pipelineStatus: 'failed',
          errorMessage: `All ${failedScenes.length} scenes failed (content filtered or generation error)`,
          errorLayer: 6,
        },
      })
      return
    }

    if (failedScenes.length > 0) {
      console.log(`[Pipeline] Layer 6: ${failedScenes.length} scenes failed (RAI filtered or error), continuing with ${readyScenes.length} ready scenes`)
    }

    // Proceed to assembly with whatever scenes are ready
    {
      const qcPostGen = runQualityControlPostGen({
        structure: currentVideo.documentaryStructure as any,
        scenes: updated,
        narrationSegments: currentVideo.narrationSegments,
      })

      const existingQcReport =
        (currentVideo.qcReport as Record<string, unknown> | null) || {}

      await prisma.video.update({
        where: { id: videoId },
        data: {
          pipelineStatus: 'assembling',
          qcReport: { ...existingQcReport, postGen: qcPostGen.report } as any,
        },
      })
      pipelineStatus = 'assembling'
    }
    })
  }

  // ============================================
  // LAYER 7: ASSEMBLY WITH COLOR GRADING
  // ============================================
  if (pipelineStatus === 'assembling') {
    await withLayerTiming(videoId, 'assembly', async () => {
    const current = await prisma.video.findUnique({
      where: { id: videoId },
      include: { scenes: true, narrationSegments: true, masterTimeline: true },
    })
    if (!current) return

    // Order scenes by timeline beat order (sceneIndex = beatIndex when using master timeline)
    const sortedScenes = [...current.scenes].sort((a, b) => a.sceneIndex - b.sceneIndex)

    const sceneUrls = sortedScenes
      .filter((scene) => scene.runwayVideoUrl)
      .map((scene) => scene.runwayVideoUrl as string)

    if (sceneUrls.length === 0) {
      await prisma.video.update({
        where: { id: videoId },
        data: {
          pipelineStatus: 'failed',
          errorMessage: 'No scene videos available',
          errorLayer: 7,
        },
      })
      return
    }

    // Sort narration segments by startTime so order matches timeline (one segment per shot for assembly)
    const sortedNarrationSegments = [...current.narrationSegments].sort(
      (a, b) => (a.startTime ?? 0) - (b.startTime ?? 0)
    )

    // Build documentary narration and narrationAudioUrls in 1:1 order (same length, same order)
    const documentaryStructure = current.documentaryStructure as any
    const documentaryNarration = {
      segments: sortedNarrationSegments.map((seg) => ({
        text: seg.text,
        startTime: seg.startTime || 0,
        duration: seg.duration || 3,
        actIndex: seg.actIndex || 0,
        pauseAfter: seg.pauseAfter || 1,
        wordCount: seg.wordCount || seg.text.split(/\s+/).length,
        status: 'ready' as const,
        visualCue: (seg as any).visualCue ?? '',
        motif: ((seg as any).motif ?? 'quiet_return') as import('./types').NarrationMotif,
        scaleType: ((seg as any).scaleType ?? 'human') as import('./types').ScaleType,
        shotType: ((seg as any).shotType ?? 'wide') as import('./types').ShotTypeHint,
        settingHint: ((seg as any).settingHint ?? 'urban') as import('./types').SceneSetting,
      })),
      totalWordCount: sortedNarrationSegments.reduce(
        (sum, seg) => sum + (seg.wordCount || seg.text.split(/\s+/).length),
        0
      ),
      avgPauseDuration:
        sortedNarrationSegments.reduce((sum, seg) => sum + (seg.pauseAfter || 1), 0) /
        (sortedNarrationSegments.length || 1),
    }

    const narrationAudioUrls = sortedNarrationSegments.map((seg) => seg.audioUrl ?? '')
    const withAudio = narrationAudioUrls.filter((u) => u && String(u).trim() !== '').length
    console.log(`[Pipeline] Narration: ${withAudio}/${sortedNarrationSegments.length} segments have audio URLs`)

    const masterTimelineData = current.masterTimeline
      ? {
          totalDurationSec: current.masterTimeline.totalDurationSec,
          beats: current.masterTimeline.beats as unknown as import('./types').TimelineBeat[],
        }
      : undefined

    try {
      console.log(`[Pipeline] Assembling final video with musicUrl=${musicUrl || 'null'} (${sceneUrls.length} scenes)`)
      const finalBuffer = await assembleFinalVideo({
        sceneVideoUrls: sceneUrls,
        narrationAudioUrls,
        narration: documentaryNarration,
        masterTimeline: masterTimelineData,
        musicUrl,
      })

      const finalPath = await writePublicFile(finalBuffer, `generated/${videoId}.mp4`)
      console.log(`[Pipeline] Assembly complete, final video: ${finalPath}`)

      await prisma.video.update({
        where: { id: videoId },
        data: {
          finalVideoUrl: finalPath,
          pipelineStatus: 'ready',
        },
      })
    } catch (assemblyError) {
      const message = assemblyError instanceof Error ? assemblyError.message : String(assemblyError)
      console.error('[Pipeline] Layer 7 assembly failed:', message)
      await prisma.video.update({
        where: { id: videoId },
        data: {
          pipelineStatus: 'failed',
          errorMessage: `Assembly failed: ${message.slice(0, 500)}`,
          errorLayer: 7,
        },
      })
    }
    })
  }
}
