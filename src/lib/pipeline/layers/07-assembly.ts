import ffmpeg, { type FfmpegCommand } from 'fluent-ffmpeg'
import { writeFile, readFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { DocumentaryNarration, MasterTimelineData, TimelineBeat } from '../types'

// Resolve ffmpeg binary path at runtime to avoid Turbopack \ROOT rewriting
function resolveFfmpegPath(): string {
  // 1. Try the ffmpeg-static package path directly
  const staticPath = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')
  if (existsSync(staticPath)) return staticPath

  // 2. Try without .exe (Linux/macOS)
  const staticPathUnix = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg')
  if (existsSync(staticPathUnix)) return staticPathUnix

  // 3. Fall back to system ffmpeg
  return 'ffmpeg'
}

ffmpeg.setFfmpegPath(resolveFfmpegPath())

// ============================================
// UTILITIES
// ============================================

function dataUrlToBuffer(dataUrl: string): Buffer {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/)
  if (!match) throw new Error('Invalid data URL')
  return Buffer.from(match[2], 'base64')
}

async function downloadToFile(url: string, filePath: string): Promise<void> {
  if (url.startsWith('data:')) {
    const buffer = dataUrlToBuffer(url)
    await writeFile(filePath, buffer)
    return
  }
  // Local public path (e.g. /generated/veo_scenes/xyz.mp4 from Vertex base64 output)
  if (url.startsWith('/') && !url.startsWith('//')) {
    const localPath = path.join(process.cwd(), 'public', url)
    const buffer = await readFile(localPath)
    await writeFile(filePath, buffer)
    return
  }
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to download ${url}: ${res.status} ${text}`)
  }
  const arrayBuffer = await res.arrayBuffer()
  await writeFile(filePath, Buffer.from(arrayBuffer))
}

const FFMPEG_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes max per ffmpeg step

function runFfmpeg(command: FfmpegCommand, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`ffmpeg timed out after ${FFMPEG_TIMEOUT_MS / 60000} minutes (output: ${outputPath})`))
      try {
        ;(command as FfmpegCommand & { kill(signal?: string): void }).kill('SIGKILL')
      } catch {
        // ignore
      }
    }, FFMPEG_TIMEOUT_MS)
    command
      .on('end', () => {
        clearTimeout(timeout)
        resolve()
      })
      .on('error', (err: Error) => {
        clearTimeout(timeout)
        reject(err)
      })
      .save(outputPath)
  })
}

function videoHasAudioStream(videoPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpegPath = resolveFfmpegPath()
    const { execFile } = require('node:child_process') as typeof import('node:child_process')
    execFile(ffmpegPath, ['-i', videoPath], { timeout: 10000 }, (_err: Error | null, _stdout: string, stderr: string) => {
      const output = stderr || ''
      resolve(/Stream\s+#\d+:\d+.*Audio/.test(output))
    })
  })
}

function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    const ffmpegPath = resolveFfmpegPath()
    const { execFile } = require('node:child_process') as typeof import('node:child_process')
    // Use ffmpeg itself (not ffprobe) to read duration — ffprobe is not shipped with ffmpeg-static
    execFile(ffmpegPath, ['-i', filePath, '-f', 'null', '-'], { timeout: 15000 }, (err: Error | null, _stdout: string, stderr: string) => {
      // ffmpeg writes media info to stderr even on "error" (exit code 1 for -f null)
      const output = stderr || ''
      const match = output.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/)
      if (match) {
        const hours = parseInt(match[1], 10)
        const minutes = parseInt(match[2], 10)
        const seconds = parseInt(match[3], 10)
        const centiseconds = parseInt(match[4], 10)
        const total = hours * 3600 + minutes * 60 + seconds + centiseconds / 100
        if (total > 0) {
          resolve(total)
          return
        }
      }
      if (err) {
        console.warn(`[Assembly] ffmpeg duration probe failed for ${filePath}:`, err.message?.slice(0, 100))
      } else {
        console.warn(`[Assembly] Could not parse duration from ffmpeg output for ${filePath}`)
      }
      resolve(0)
    })
  })
}

// ============================================
// CLIP NORMALIZATION (trim/pad to timeline beat durations)
// ============================================

interface NormalizeResult {
  files: string[]
  actualDurations: number[]
  clipStartPositions: number[]
}

async function normalizeSceneClipsToTimeline(
  workDir: string,
  sceneFiles: string[],
  masterTimeline: MasterTimelineData
): Promise<NormalizeResult> {
  const beats = masterTimeline.beats as TimelineBeat[]
  const count = Math.min(sceneFiles.length, beats.length)
  const normalized: string[] = []
  const actualDurations: number[] = []

  console.log(`[Assembly] Normalizing ${count} clips to timeline beat durations (${sceneFiles.length} clips, ${beats.length} beats)`)

  for (let i = 0; i < count; i++) {
    const targetSec = beats[i].durationSec
    const actualSec = await getVideoDuration(sceneFiles[i])
    const outPath = path.join(workDir, `scene_${i}_normalized.mp4`)
    const diff = targetSec - actualSec
    const hasAudio = await videoHasAudioStream(sceneFiles[i])

    if (actualSec > 0 && Math.abs(diff) < 0.1) {
      console.log(`[Assembly] Clip ${i}: ${actualSec.toFixed(2)}s ≈ target ${targetSec}s, copying as-is`)
      normalized.push(sceneFiles[i])
      actualDurations.push(actualSec)
      continue
    }

    if (actualSec > 0 && actualSec >= targetSec) {
      console.log(`[Assembly] Clip ${i}: ${actualSec.toFixed(2)}s > target ${targetSec}s, trimming`)
      await runFfmpeg(
        ffmpeg(sceneFiles[i])
          .outputOptions([`-t ${targetSec}`, '-c copy']),
        outPath
      )
      normalized.push(outPath)
      actualDurations.push(targetSec)
      continue
    }

    const padDuration = actualSec > 0 ? diff : targetSec
    console.log(`[Assembly] Clip ${i}: ${actualSec.toFixed(2)}s < target ${targetSec}s, padding +${padDuration.toFixed(2)}s`)

    const filters: string[] = [
      `[0:v]tpad=stop_mode=clone:stop_duration=${padDuration}[v]`,
    ]

    if (hasAudio) {
      filters.push(`[0:a]apad=whole_dur=${targetSec}[a]`)
    } else {
      filters.push(`anullsrc=r=44100:cl=stereo[a_gen]`, `[a_gen]atrim=duration=${targetSec}[a]`)
    }

    const cmd = ffmpeg(sceneFiles[i])
      .complexFilter(filters)
      .outputOptions([
        '-map [v]',
        '-map [a]',
        '-c:v libx264',
        '-preset fast',
        '-crf 18',
        '-c:a aac',
        '-b:a 192k',
        '-pix_fmt yuv420p',
      ])

    await runFfmpeg(cmd, outPath)
    normalized.push(outPath)
    actualDurations.push(targetSec)
  }

  // Handle extra clips that have no matching beat (when scenes > beats): keep them as-is
  for (let i = count; i < sceneFiles.length; i++) {
    const dur = await getVideoDuration(sceneFiles[i])
    normalized.push(sceneFiles[i])
    actualDurations.push(dur > 0 ? dur : 6)
    console.log(`[Assembly] Extra clip ${i} (no beat): ${dur.toFixed(2)}s, keeping as-is`)
  }

  // Compute real start positions from actual durations
  const clipStartPositions: number[] = []
  let cursor = 0
  for (const dur of actualDurations) {
    clipStartPositions.push(cursor)
    cursor += dur
  }

  console.log(`[Assembly] Normalized total duration: ${cursor.toFixed(2)}s, clip starts: [${clipStartPositions.map(s => s.toFixed(1)).join(', ')}]`)
  return { files: normalized, actualDurations, clipStartPositions }
}

/**
 * Measure actual durations of raw clip files (no normalization).
 * Used when masterTimeline is missing or doesn't match scene count.
 */
async function measureClipDurations(sceneFiles: string[]): Promise<NormalizeResult> {
  const actualDurations: number[] = []
  const clipStartPositions: number[] = []
  let cursor = 0

  for (const file of sceneFiles) {
    const dur = await getVideoDuration(file)
    const safeDur = dur > 0 ? dur : 6
    actualDurations.push(safeDur)
    clipStartPositions.push(cursor)
    cursor += safeDur
  }

  console.log(`[Assembly] Measured clip durations (no normalization), total: ${cursor.toFixed(2)}s`)
  return { files: sceneFiles, actualDurations, clipStartPositions }
}

// ============================================
// DOCUMENTARY-STYLE COLOR GRADING (per-act)
// ============================================

const GLOBAL_COLOR_GRADE_FILTERS = [
  'eq=saturation=0.85:contrast=1.05',
  'curves=r=\'0/0 0.5/0.48 1/1\':g=\'0/0 0.5/0.50 1/1\':b=\'0/0 0.5/0.52 1/1\'',
  'unsharp=5:5:0.5:3:3:0.0',
]

const ACT_GRADE_FILTERS: Record<string, string[]> = {
  vast: [
    'eq=saturation=0.75:contrast=1.10',
    'curves=r=\'0/0 0.5/0.46 1/0.95\':g=\'0/0 0.5/0.48 1/0.97\':b=\'0/0 0.5/0.54 1/1\'',
    'unsharp=5:5:0.5:3:3:0.0',
  ],
  living_dot: [
    'eq=saturation=0.85:contrast=1.05',
    'curves=r=\'0/0 0.5/0.48 1/1\':g=\'0/0 0.5/0.50 1/1\':b=\'0/0 0.5/0.52 1/1\'',
    'unsharp=5:5:0.5:3:3:0.0',
  ],
  miracle_of_you: [
    'eq=saturation=0.90:contrast=1.00:brightness=0.02',
    'curves=r=\'0/0 0.5/0.52 1/1\':g=\'0/0 0.5/0.50 1/1\':b=\'0/0 0.5/0.46 1/0.96\'',
    'unsharp=5:5:0.3:3:3:0.0',
  ],
  return: [
    'eq=saturation=0.82:contrast=1.03',
    'curves=r=\'0/0 0.5/0.50 1/1\':g=\'0/0 0.5/0.50 1/1\':b=\'0/0 0.5/0.50 1/1\'',
    'unsharp=5:5:0.4:3:3:0.0',
  ],
}

const FILM_GRAIN_FILTER = 'noise=alls=2:allf=t'

const XFADE_DURATION = 0.5
const DIP_TO_BLACK_DURATION = 0.3

// ============================================
// HELPERS: act boundaries and xfade concat
// ============================================

interface ActBoundary {
  actIndex: number
  actType: string
  startSec: number
  endSec: number
}

function computeActBoundaries(beats: TimelineBeat[]): ActBoundary[] {
  const boundaries: ActBoundary[] = []
  let currentActIndex = -1
  for (const beat of beats) {
    if (beat.actIndex !== currentActIndex) {
      if (boundaries.length > 0) {
        boundaries[boundaries.length - 1].endSec = beat.startSec
      }
      const actTypes = ['vast', 'living_dot', 'miracle_of_you', 'return']
      boundaries.push({
        actIndex: beat.actIndex,
        actType: actTypes[beat.actIndex] ?? 'return',
        startSec: beat.startSec,
        endSec: beat.endSec,
      })
      currentActIndex = beat.actIndex
    } else if (boundaries.length > 0) {
      boundaries[boundaries.length - 1].endSec = beat.endSec
    }
  }
  return boundaries
}

async function concatenateWithXfade(
  workDir: string,
  clipFiles: string[],
  beats: TimelineBeat[],
  clipDurations: number[]
): Promise<string> {
  const n = clipFiles.length
  if (n <= 1) {
    return clipFiles[0]
  }

  const dissolveIndices: number[] = []
  for (let i = 0; i < n - 1; i++) {
    if (beats[i]?.transitionOut === 'dissolve') {
      dissolveIndices.push(i)
    }
  }

  if (dissolveIndices.length === 0) {
    return ''
  }

  const trimFrom: number[] = new Array(n).fill(0)
  const trimEnd: number[] = new Array(n).fill(0)
  for (const idx of dissolveIndices) {
    trimEnd[idx] += XFADE_DURATION / 2
    trimFrom[idx + 1] += XFADE_DURATION / 2
  }

  const trimmedFiles: string[] = []
  const trimmedDurations: number[] = []
  for (let i = 0; i < n; i++) {
    const startTrim = trimFrom[i]
    const endTrim = trimEnd[i]
    if (startTrim === 0 && endTrim === 0) {
      trimmedFiles.push(clipFiles[i])
      trimmedDurations.push(clipDurations[i])
      continue
    }
    const outPath = path.join(workDir, `clip_trimmed_${i}.mp4`)
    const newDuration = clipDurations[i] - startTrim - endTrim
    const opts: string[] = []
    if (startTrim > 0) opts.push(`-ss ${startTrim.toFixed(3)}`)
    opts.push(`-t ${Math.max(0.5, newDuration).toFixed(3)}`)
    opts.push('-c:v libx264', '-preset fast', '-crf 18', '-c:a aac', '-pix_fmt yuv420p')
    await runFfmpeg(
      ffmpeg(clipFiles[i]).outputOptions(opts),
      outPath
    )
    trimmedFiles.push(outPath)
    trimmedDurations.push(Math.max(0.5, newDuration))
  }

  const filterParts: string[] = []
  for (let i = 0; i < n; i++) {
    filterParts.push(`[${i}:v][${i}:a]`)
  }

  let prevVideoLabel = '0:v'
  let prevAudioLabel = '0:a'
  let accumulatedOffset = trimmedDurations[0] - XFADE_DURATION
  const xfadeFilters: string[] = []

  for (let step = 0; step < n - 1; step++) {
    const nextIdx = step + 1
    const isDissolve = dissolveIndices.includes(step)

    if (isDissolve) {
      const vOut = `v${step}`
      const aOut = `a${step}`
      xfadeFilters.push(
        `[${prevVideoLabel}][${nextIdx}:v]xfade=transition=fade:duration=${XFADE_DURATION}:offset=${Math.max(0, accumulatedOffset).toFixed(3)}[${vOut}]`
      )
      xfadeFilters.push(
        `[${prevAudioLabel}][${nextIdx}:a]acrossfade=d=${XFADE_DURATION}[${aOut}]`
      )
      prevVideoLabel = vOut
      prevAudioLabel = aOut
      accumulatedOffset = accumulatedOffset + trimmedDurations[nextIdx] - XFADE_DURATION
    } else {
      const vOut = `v${step}`
      const aOut = `a${step}`
      xfadeFilters.push(
        `[${prevVideoLabel}][${nextIdx}:v]xfade=transition=fade:duration=0:offset=${Math.max(0, accumulatedOffset + XFADE_DURATION).toFixed(3)}[${vOut}]`
      )
      xfadeFilters.push(
        `[${prevAudioLabel}][${nextIdx}:a]concat=n=2:v=0:a=1[${aOut}]`
      )
      prevVideoLabel = vOut
      prevAudioLabel = aOut
      accumulatedOffset = accumulatedOffset + XFADE_DURATION + trimmedDurations[nextIdx] - XFADE_DURATION
    }
  }

  const outputPath = path.join(workDir, 'video_xfade.mp4')

  try {
    let cmd = ffmpeg()
    for (const f of trimmedFiles) {
      cmd = cmd.input(f)
    }
    await runFfmpeg(
      cmd
        .complexFilter(xfadeFilters)
        .outputOptions([
          `-map [${prevVideoLabel}]`,
          `-map [${prevAudioLabel}]`,
          '-c:v libx264', '-preset fast', '-crf 18',
          '-c:a aac', '-b:a 192k', '-pix_fmt yuv420p',
        ]),
      outputPath
    )
    console.log(`[Assembly] xfade concat done (${dissolveIndices.length} dissolves)`)
    return outputPath
  } catch (err) {
    console.warn('[Assembly] xfade failed, falling back to simple concat:', err instanceof Error ? err.message : err)
    return ''
  }
}

function buildDipToBlackFilter(actBoundaries: ActBoundary[]): string {
  const halfDip = DIP_TO_BLACK_DURATION / 2
  const conditions: string[] = []
  for (let i = 1; i < actBoundaries.length; i++) {
    const t = actBoundaries[i].startSec
    const fadeOut = `between(t,${(t - halfDip).toFixed(3)},${t.toFixed(3)})`
    const fadeIn = `between(t,${t.toFixed(3)},${(t + halfDip).toFixed(3)})`
    conditions.push(
      `if(${fadeOut}, (${t.toFixed(3)}-t)/${halfDip.toFixed(3)}, if(${fadeIn}, (t-${t.toFixed(3)})/${halfDip.toFixed(3)}, __REST__))`
    )
  }
  if (conditions.length === 0) return ''
  let expr = '1'
  for (let i = conditions.length - 1; i >= 0; i--) {
    expr = conditions[i].replace('__REST__', expr)
  }
  return `geq=lum='lum(X,Y)*${expr}':cb='cb(X,Y)':cr='cr(X,Y)'`
}

async function applyPerActGrading(
  workDir: string,
  videoPath: string,
  actBoundaries: ActBoundary[]
): Promise<string> {
  try {
    const segmentFiles: string[] = []
    for (let i = 0; i < actBoundaries.length; i++) {
      const act = actBoundaries[i]
      const duration = act.endSec - act.startSec
      if (duration <= 0) continue

      const segPath = path.join(workDir, `act_seg_${i}.mp4`)
      const gradeFilters = ACT_GRADE_FILTERS[act.actType] ?? GLOBAL_COLOR_GRADE_FILTERS
      await runFfmpeg(
        ffmpeg(videoPath)
          .inputOptions([`-ss ${act.startSec}`])
          .outputOptions([`-t ${duration}`])
          .videoFilters([...gradeFilters, FILM_GRAIN_FILTER])
          .outputOptions(['-c:v libx264', '-preset fast', '-crf 18', '-c:a aac', '-b:a 192k', '-pix_fmt yuv420p']),
        segPath
      )
      segmentFiles.push(segPath)
    }

    if (segmentFiles.length === 0) {
      const fallback = path.join(workDir, 'video_graded.mp4')
      await runFfmpeg(
        ffmpeg(videoPath)
          .videoFilters([...GLOBAL_COLOR_GRADE_FILTERS, FILM_GRAIN_FILTER])
          .outputOptions(['-c:v libx264', '-preset slow', '-crf 18', '-c:a copy']),
        fallback
      )
      return fallback
    }

    const listPath = path.join(workDir, 'act_segments.txt')
    await writeFile(
      listPath,
      segmentFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n')
    )
    const gradedOutput = path.join(workDir, 'video_graded.mp4')
    await runFfmpeg(
      ffmpeg()
        .input(listPath)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions(['-c:v libx264', '-c:a aac', '-pix_fmt yuv420p']),
      gradedOutput
    )
    console.log(`[Assembly] Per-act grading applied (${segmentFiles.length} acts)`)
    return gradedOutput
  } catch (err) {
    console.warn('[Assembly] Per-act grading failed, falling back to global:', err instanceof Error ? err.message : err)
    const fallback = path.join(workDir, 'video_graded.mp4')
    await runFfmpeg(
      ffmpeg(videoPath)
        .videoFilters([...GLOBAL_COLOR_GRADE_FILTERS, FILM_GRAIN_FILTER])
        .outputOptions(['-c:v libx264', '-preset slow', '-crf 18', '-c:a copy']),
      fallback
    )
    return fallback
  }
}

// ============================================
// ADVANCED ASSEMBLY WITH NARRATION TIMING
// ============================================

export async function assembleFinalVideo(params: {
  sceneVideoUrls: string[]
  narrationAudioUrls?: string[]
  narration?: DocumentaryNarration
  masterTimeline?: MasterTimelineData
  musicUrl?: string | null
}): Promise<Buffer> {
  const workDir = path.join(tmpdir(), `pipeline_${Date.now()}`)
  await mkdir(workDir, { recursive: true })

  try {
    // sceneVideoUrls are already in timeline beat order (sceneIndex) when masterTimeline is used
    console.log(`[Assembly] Starting: ${params.sceneVideoUrls.length} scenes`)
    const sceneFiles: string[] = []
    for (let i = 0; i < params.sceneVideoUrls.length; i++) {
      const filePath = path.join(workDir, `scene_${i}.mp4`)
      await downloadToFile(params.sceneVideoUrls[i], filePath)
      sceneFiles.push(filePath)
    }
    console.log('[Assembly] Scene files downloaded, normalizing clip durations...')

    // Normalize clip durations to match timeline beat boundaries so narration aligns with scene changes.
    // Always normalize when masterTimeline is present (even if counts differ — normalizeSceneClipsToTimeline
    // uses min(clips, beats) and keeps extras). When no timeline, still measure durations for narration alignment.
    let normalizeResult: NormalizeResult
    if (params.masterTimeline) {
      normalizeResult = await normalizeSceneClipsToTimeline(workDir, sceneFiles, params.masterTimeline)
    } else {
      normalizeResult = await measureClipDurations(sceneFiles)
    }
    const filesForConcat = normalizeResult.files

    console.log('[Assembly] Concatenating...')

    // Try xfade-based concat when dissolves exist; fall back to simple concat
    const beats = params.masterTimeline?.beats as TimelineBeat[] | undefined
    let concatenatedVideo = ''

    if (beats && beats.length > 0) {
      concatenatedVideo = await concatenateWithXfade(
        workDir, filesForConcat, beats, normalizeResult.actualDurations
      )
    }

    if (!concatenatedVideo) {
      const videoListPath = path.join(workDir, 'videos.txt')
      await writeFile(
        videoListPath,
        filesForConcat.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n')
      )
      concatenatedVideo = path.join(workDir, 'video_concat.mp4')
      await runFfmpeg(
        ffmpeg()
          .input(videoListPath)
          .inputOptions(['-f concat', '-safe 0'])
          .outputOptions(['-c:v libx264', '-c:a aac', '-pix_fmt yuv420p']),
        concatenatedVideo
      )
    }
    console.log('[Assembly] Concat done, applying color grading...')

    // Compute act boundaries for dip-to-black and per-act grading
    const actBoundaries = beats ? computeActBoundaries(beats) : []

    // Apply per-act color grading (or global fallback) + film grain
    let gradedVideo: string
    if (actBoundaries.length > 1) {
      gradedVideo = await applyPerActGrading(workDir, concatenatedVideo, actBoundaries)
    } else {
      gradedVideo = path.join(workDir, 'video_graded.mp4')
      await runFfmpeg(
        ffmpeg(concatenatedVideo)
          .videoFilters([...GLOBAL_COLOR_GRADE_FILTERS, FILM_GRAIN_FILTER])
          .outputOptions(['-c:v libx264', '-preset slow', '-crf 18', '-c:a copy']),
        gradedVideo
      )
    }

    // Apply dip-to-black at act boundaries.
    // Write the geq filter to a file and use -filter_script:v to avoid Windows command-line length limits.
    if (actBoundaries.length > 1) {
      const dipFilter = buildDipToBlackFilter(actBoundaries)
      if (dipFilter) {
        const dippedVideo = path.join(workDir, 'video_dipped.mp4')
        const filterScriptPath = path.join(workDir, 'dip_filter.txt')
        try {
          await writeFile(filterScriptPath, dipFilter)
          await runFfmpeg(
            ffmpeg(gradedVideo)
              .outputOptions([
                '-filter_script:v', filterScriptPath,
                '-c:v libx264', '-preset fast', '-crf 18', '-c:a copy',
              ]),
            dippedVideo
          )
          gradedVideo = dippedVideo
          console.log(`[Assembly] Applied dip-to-black at ${actBoundaries.length - 1} act boundaries`)
        } catch (dipErr) {
          console.warn('[Assembly] Dip-to-black filter failed, continuing without:', dipErr instanceof Error ? dipErr.message : dipErr)
        }
      }
    }

    console.log('[Assembly] Grading done, adding narration...')

    // Handle narration with precise timing (1:1 segment-to-audio URL alignment).
    // When masterTimeline is provided, narration plays only over "narrated" beats; breathing beats get silence.
    if (
      params.narration &&
      params.narration.segments.length > 0 &&
      params.narrationAudioUrls &&
      params.narrationAudioUrls.length === params.narration.segments.length
    ) {
      const narrationResult = await addNarrationWithTiming(
        workDir,
        gradedVideo,
        params.narrationAudioUrls,
        params.narration,
        params.masterTimeline,
        normalizeResult
      )
      const baseForMusic = narrationResult.videoPath
      if (params.musicUrl) {
        const finalWithMusic = await addMusicTrack(workDir, baseForMusic, params.musicUrl, true, params.masterTimeline, normalizeResult.clipStartPositions, normalizeResult.actualDurations, narrationResult.narrationWindows)
        const finalBuffer = await readFile(finalWithMusic)
        return finalBuffer
      }
      const finalBuffer = await readFile(baseForMusic)
      return finalBuffer
    }

    // Legacy path: simple audio concatenation (when 1:1 alignment not used)
    const nonEmptyNarrationUrls =
      params.narrationAudioUrls?.filter((u) => u && String(u).trim() !== '') ?? []
    if (nonEmptyNarrationUrls.length > 0) {
      const audioFiles: string[] = []
      for (let i = 0; i < nonEmptyNarrationUrls.length; i++) {
        const filePath = path.join(workDir, `audio_${i}.mp3`)
        await downloadToFile(nonEmptyNarrationUrls[i], filePath)
        audioFiles.push(filePath)
      }

      const audioListPath = path.join(workDir, 'audio.txt')
      await writeFile(
        audioListPath,
        audioFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n')
      )

      const concatenatedAudio = path.join(workDir, 'audio_concat.mp3')
      await runFfmpeg(
        ffmpeg()
          .input(audioListPath)
          .inputOptions(['-f concat', '-safe 0'])
          .outputOptions(['-c copy']),
        concatenatedAudio
      )

      const finalOutput = path.join(workDir, 'final.mp4')
      await runFfmpeg(
        ffmpeg()
          .input(gradedVideo)
          .input(concatenatedAudio)
          .outputOptions(['-c:v copy', '-c:a aac', '-shortest']),
        finalOutput
      )

      // If music is available, mix it under the combined video+narration.
      if (params.musicUrl) {
        const finalWithMusic = await addMusicTrack(workDir, finalOutput, params.musicUrl, undefined, params.masterTimeline, normalizeResult.clipStartPositions, normalizeResult.actualDurations)
        const finalBuffer = await readFile(finalWithMusic)
        return finalBuffer
      }

      const finalBuffer = await readFile(finalOutput)
      return finalBuffer
    }

    // No narration - but possibly music only
    if (params.musicUrl) {
      const finalWithMusic = await addMusicTrack(workDir, gradedVideo, params.musicUrl, undefined, params.masterTimeline, normalizeResult.clipStartPositions, normalizeResult.actualDurations)
      const finalBuffer = await readFile(finalWithMusic)
      return finalBuffer
    }

    const finalBuffer = await readFile(gradedVideo)
    return finalBuffer
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

// ============================================
// PRECISE NARRATION TIMING
// ============================================

const SCENE_SILENCE_SEC = 2
const MIN_SILENCE_GAP_SEC = 1.5

interface NarrationWindow {
  startSec: number
  endSec: number
}

interface NarrationTimingResult {
  videoPath: string
  narrationWindows: NarrationWindow[]
}

async function addNarrationWithTiming(
  workDir: string,
  videoPath: string,
  narrationAudioUrls: string[],
  narration: DocumentaryNarration,
  masterTimeline?: MasterTimelineData,
  clipInfo?: NormalizeResult
): Promise<NarrationTimingResult> {
  // 1:1 alignment: only process segments where narrationAudioUrls[i] is non-empty
  const segmentsWithAudio: { segment: (typeof narration.segments)[0]; segmentIndex: number; inputIndex: number }[] = []
  let inputIndex = 1 // 1-based (0 = video)
  for (let i = 0; i < narration.segments.length; i++) {
    const url = narrationAudioUrls[i]
    if (!url || String(url).trim() === '') continue
    segmentsWithAudio.push({ segment: narration.segments[i], segmentIndex: i, inputIndex: inputIndex++ })
  }

  if (segmentsWithAudio.length === 0) {
    console.log('[Assembly] No narration segments have audio URLs, skipping narration')
    return { videoPath, narrationWindows: [] }
  }

  // Download only segments that have audio (skip if download fails) and measure actual TTS duration
  const validAudioSegments: Array<{
    segment: (typeof narration.segments)[0]
    segmentIndex: number
    inputIndex: number
    filePath: string
    actualAudioDuration: number
  }> = []
  let actualInputIndex = 1 // 1-based (0 = video)
  for (let i = 0; i < segmentsWithAudio.length; i++) {
    const segIdx = narration.segments.indexOf(segmentsWithAudio[i].segment)
    const url = narrationAudioUrls[segIdx]
    const filePath = path.join(workDir, `narration_${i}.mp3`)
    try {
      await downloadToFile(url, filePath)
      const { stat } = await import('node:fs/promises')
      const stats = await stat(filePath)
      if (stats.size > 0) {
        const audioDur = await getAudioDuration(filePath)
        validAudioSegments.push({
          segment: segmentsWithAudio[i].segment,
          segmentIndex: segmentsWithAudio[i].segmentIndex,
          inputIndex: actualInputIndex++,
          filePath,
          actualAudioDuration: audioDur,
        })
      } else {
        console.warn(`[Assembly] Skipping empty narration file: ${filePath}`)
      }
    } catch (error) {
      console.warn(`[Assembly] Failed to download narration segment ${i}, skipping:`, error instanceof Error ? error.message : error)
    }
  }

  if (validAudioSegments.length === 0) {
    console.log('[Assembly] No narration audio available, returning video without narration')
    return { videoPath, narrationWindows: [] }
  }

  console.log(`[Assembly] Adding narration (${validAudioSegments.length} segments with audio)`)

  // Use actual clip start positions (from normalized/measured clips) for narration placement.
  // This ensures narration aligns with the REAL video, not the theoretical timeline.
  const clipStarts = clipInfo?.clipStartPositions ?? []
  const clipDurations = clipInfo?.actualDurations ?? []

  // Get total video duration from actual clips (ground truth) instead of from timeline
  const totalVideoDuration = await getVideoDuration(videoPath)
  const padWholeDur = Math.ceil(totalVideoDuration > 0 ? totalVideoDuration : 120) + 2

  // Build complex filter: position each narration after a silence offset from scene start.
  // Let narration play to its full natural duration (no trim to clip boundary).
  // Ensure a minimum silence gap between the end of one narration and the start of the next.
  const filterComplex: string[] = []
  const narrationWindows: NarrationWindow[] = []
  const N = validAudioSegments.length
  let previousNarrationEndSec = 0

  // Estimate total narration time needed to detect if we'll run out of space.
  // If so, progressively reduce silence offsets for later segments.
  const totalNarrationTime = validAudioSegments.reduce((sum, s) => sum + s.actualAudioDuration, 0)
  const totalGapTime = N * SCENE_SILENCE_SEC + (N - 1) * MIN_SILENCE_GAP_SEC
  const budgetTight = (totalNarrationTime + totalGapTime) > totalVideoDuration * 0.95

  for (let j = 0; j < N; j++) {
    const { segment, segmentIndex, inputIndex: inIdx, actualAudioDuration } = validAudioSegments[j]

    const clipStartSec = segmentIndex < clipStarts.length
      ? clipStarts[segmentIndex]
      : (segment.startTime ?? 0)

    // Remaining time and segments — reduce silence offsets when budget is tight
    const remainingTime = totalVideoDuration - previousNarrationEndSec
    const remainingSegments = N - j
    const remainingAudio = validAudioSegments.slice(j).reduce((sum, s) => sum + s.actualAudioDuration, 0)
    const remainingGapBudget = remainingTime - remainingAudio

    let silenceOffset = SCENE_SILENCE_SEC
    let gapSec = MIN_SILENCE_GAP_SEC

    if (budgetTight && remainingSegments > 0) {
      const avgGapBudget = Math.max(0, remainingGapBudget / (remainingSegments * 2))
      silenceOffset = Math.min(SCENE_SILENCE_SEC, Math.max(0.5, avgGapBudget))
      gapSec = Math.min(MIN_SILENCE_GAP_SEC, Math.max(0.3, avgGapBudget))
    }

    const scheduledStartSec = clipStartSec + silenceOffset

    const earliestStartSec = j > 0
      ? previousNarrationEndSec + gapSec
      : 0

    const startSec = Math.max(scheduledStartSec, earliestStartSec)

    const maxFromVideoEnd = Math.max(1, totalVideoDuration - startSec)
    const trimDuration = Math.min(actualAudioDuration, maxFromVideoEnd)

    const delayMs = Math.max(0, Math.round(startSec * 1000))
    previousNarrationEndSec = startSec + trimDuration

    narrationWindows.push({ startSec: startSec, endSec: previousNarrationEndSec })

    console.log(`[Assembly] Segment ${segmentIndex}: start=${startSec.toFixed(1)}s (scene@${clipStartSec.toFixed(1)}s +${silenceOffset.toFixed(1)}s silence), audioDur=${actualAudioDuration.toFixed(1)}s, trim=${trimDuration.toFixed(1)}s`)

    filterComplex.push(`[${inIdx}:a]atrim=0:${trimDuration.toFixed(2)},asetpts=PTS-STARTPTS[trimmed${j}]`)
    filterComplex.push(`[trimmed${j}]adelay=${delayMs}|${delayMs}[delayed${j}]`)
    filterComplex.push(`[delayed${j}]apad=whole_dur=${padWholeDur}[padded${j}]`)
  }
  const paddedInputs = validAudioSegments.map((_, j) => `[padded${j}]`).join('')
  filterComplex.push(
    `${paddedInputs}amix=inputs=${N}:duration=first:dropout_transition=0,volume=${N}[narration]`
  )

  const hasVideoAudio = await videoHasAudioStream(videoPath)
  if (hasVideoAudio) {
    filterComplex.push('[0:a][narration]amix=inputs=2:duration=longest,volume=2[final_audio]')
  }

  const finalOutput = path.join(workDir, 'final_with_narration.mp4')
  let command = ffmpeg(videoPath)
  validAudioSegments.forEach(({ filePath }) => {
    command = command.input(filePath)
  })

  const mapAudio = hasVideoAudio ? '[final_audio]' : '[narration]'
  await runFfmpeg(
    command
      .complexFilter(filterComplex)
      .outputOptions([
        '-map 0:v',
        `-map ${mapAudio}`,
        '-c:v copy',
        '-c:a aac',
        '-b:a 192k',
      ]),
    finalOutput
  )

  return { videoPath: finalOutput, narrationWindows }
}

/** Measure the actual duration of an audio file using ffmpeg. */
function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    const ffmpegPath = resolveFfmpegPath()
    const { execFile } = require('node:child_process') as typeof import('node:child_process')
    execFile(ffmpegPath, ['-i', filePath], { timeout: 10000 }, (_err: Error | null, _stdout: string, stderr: string) => {
      const output = stderr || ''
      const match = output.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/)
      if (match) {
        const hours = parseInt(match[1], 10)
        const minutes = parseInt(match[2], 10)
        const seconds = parseInt(match[3], 10)
        const centiseconds = parseInt(match[4], 10)
        const total = hours * 3600 + minutes * 60 + seconds + centiseconds / 100
        if (total > 0) { resolve(total); return }
      }
      resolve(6) // safe fallback
    })
  })
}

// ============================================
// MUSIC MIXING WITH DUCKING AND ACT CONTOUR
// ============================================

const MUSIC_BASE_VOLUME = 0.12
const MUSIC_DUCK_VOLUME = 0.10
const MUSIC_VAST_VOLUME = 0.02
const MUSIC_BREATHING_VOLUME = 0.10
const MUSIC_SILENCE_VOLUME = 0.20
const MUSIC_FADE_SEC = 0.5
const RETURN_FADE_DURATION = 20

function buildMusicVolumeExpression(
  beats: TimelineBeat[],
  clipStarts: number[],
  clipDurations: number[],
  actBoundaries: ActBoundary[],
  narrationWindows?: NarrationWindow[]
): string {
  if (beats.length === 0 || clipStarts.length === 0) {
    return String(MUSIC_BASE_VOLUME)
  }

  const returnAct = actBoundaries.find((a) => a.actType === 'return')
  const returnStart = returnAct?.startSec ?? 120
  const returnEnd = returnAct?.endSec ?? 120

  // When narration windows are available, duck/raise music based on actual voice timing
  // rather than beat boundaries. Music rises during silence gaps and ducks when voice plays.
  if (narrationWindows && narrationWindows.length > 0) {
    const segments: string[] = []

    for (const win of narrationWindows) {
      const fadeInStart = Math.max(0, win.startSec - MUSIC_FADE_SEC)
      const fadeOutEnd = win.endSec + MUSIC_FADE_SEC

      // Fade down into narration (MUSIC_SILENCE_VOLUME -> MUSIC_DUCK_VOLUME over 0.5s)
      segments.push(
        `if(between(t,${fadeInStart.toFixed(2)},${win.startSec.toFixed(2)}), ${MUSIC_SILENCE_VOLUME}+(${MUSIC_DUCK_VOLUME}-${MUSIC_SILENCE_VOLUME})*(t-${fadeInStart.toFixed(2)})/${MUSIC_FADE_SEC.toFixed(2)}, __REST__)`
      )

      // Ducked during narration
      segments.push(
        `if(between(t,${win.startSec.toFixed(2)},${win.endSec.toFixed(2)}), ${MUSIC_DUCK_VOLUME}, __REST__)`
      )

      // Fade up out of narration (MUSIC_DUCK_VOLUME -> MUSIC_SILENCE_VOLUME over 0.5s)
      segments.push(
        `if(between(t,${win.endSec.toFixed(2)},${fadeOutEnd.toFixed(2)}), ${MUSIC_DUCK_VOLUME}+(${MUSIC_SILENCE_VOLUME}-${MUSIC_DUCK_VOLUME})*(t-${win.endSec.toFixed(2)})/${MUSIC_FADE_SEC.toFixed(2)}, __REST__)`
      )
    }

    // Default volume during silence (no narration playing): raised so music is clearly audible
    let expr = String(MUSIC_SILENCE_VOLUME)
    for (let i = segments.length - 1; i >= 0; i--) {
      expr = segments[i].replace('__REST__', expr)
    }

    // Multiply by return-act fade-out so music fades to zero at the very end
    if (returnEnd - returnStart > 0) {
      const fadeDur = Math.min(RETURN_FADE_DURATION, returnEnd - returnStart)
      const fadeStart = returnEnd - fadeDur
      return `(${expr})*if(gt(t,${fadeStart.toFixed(2)}),max(0,(${returnEnd.toFixed(2)}-t)/${fadeDur.toFixed(2)}),1)`
    }

    return expr
  }

  // Fallback: beat-based ducking (no narration windows available)
  const segments: string[] = []
  for (let i = 0; i < beats.length && i < clipStarts.length; i++) {
    const beat = beats[i]
    const start = clipStarts[i]
    const dur = i < clipDurations.length ? clipDurations[i] : beat.durationSec
    const end = start + dur

    const actBound = actBoundaries.find((a) => a.actIndex === beat.actIndex)
    const actType = actBound?.actType ?? 'return'

    let vol: number
    if (actType === 'vast') {
      vol = MUSIC_VAST_VOLUME
    } else if (beat.beatType === 'breathing') {
      vol = MUSIC_BREATHING_VOLUME
    } else if (beat.beatType === 'narrated') {
      vol = MUSIC_DUCK_VOLUME
    } else {
      vol = MUSIC_BASE_VOLUME
    }

    if (actType === 'return' && returnEnd - returnStart > 0) {
      const fadeDur = Math.min(RETURN_FADE_DURATION, returnEnd - returnStart)
      const fadeStart = returnEnd - fadeDur
      segments.push(
        `if(between(t,${start.toFixed(2)},${end.toFixed(2)}), if(gt(t,${fadeStart.toFixed(2)}), ${vol}*max(0,(${returnEnd.toFixed(2)}-t)/${fadeDur.toFixed(2)}), ${vol}), __REST__)`
      )
    } else {
      segments.push(
        `if(between(t,${start.toFixed(2)},${end.toFixed(2)}), ${vol}, __REST__)`
      )
    }
  }

  let expr = String(MUSIC_DUCK_VOLUME)
  for (let i = segments.length - 1; i >= 0; i--) {
    expr = segments[i].replace('__REST__', expr)
  }

  return expr
}

async function addMusicTrack(
  workDir: string,
  videoPath: string,
  musicUrl: string,
  assumeVideoHasAudio?: boolean,
  masterTimeline?: MasterTimelineData,
  clipStarts?: number[],
  clipDurations?: number[],
  narrationWindows?: NarrationWindow[]
): Promise<string> {
  try {
    console.log(`[Assembly] Adding music track from URL: ${musicUrl}`)
    const musicFile = path.join(workDir, 'music_track.mp3')
    await downloadToFile(musicUrl, musicFile)

    const { stat } = await import('node:fs/promises')
    const musicStats = await stat(musicFile)
    console.log(`[Assembly] Music file downloaded: ${musicStats.size} bytes`)

    if (musicStats.size === 0) {
      throw new Error('Music file is empty')
    }

    const detectedAudio = await videoHasAudioStream(videoPath)
    const hasVideoAudio = detectedAudio || assumeVideoHasAudio === true
    const finalOutput = path.join(workDir, 'final_with_music.mp4')

    let volumeExpr: string
    const beats = masterTimeline?.beats as TimelineBeat[] | undefined
    if (beats && clipStarts && clipDurations && beats.length > 0) {
      const actBoundaries = computeActBoundaries(beats)
      volumeExpr = buildMusicVolumeExpression(beats, clipStarts, clipDurations, actBoundaries, narrationWindows)
      console.log(`[Assembly] Music: ${narrationWindows?.length ? 'narration-aware' : 'act-aware'} ducking (${actBoundaries.length} acts, ${beats.length} beats)`)
    } else {
      volumeExpr = String(MUSIC_BASE_VOLUME)
    }

    const command = ffmpeg()
      .input(videoPath)
      .input(musicFile)

    const filterComplex: string[] = []
    filterComplex.push(`[1:a]volume='${volumeExpr}':eval=frame[music_shaped]`)

    if (hasVideoAudio) {
      filterComplex.push('[0:a][music_shaped]amix=inputs=2:duration=longest:dropout_transition=2,volume=2[final_audio]')
    } else {
      filterComplex.push('[music_shaped]anull[final_audio]')
    }

    console.log(`[Assembly] Mixing music with video (hasVideoAudio=${hasVideoAudio}, detected=${detectedAudio}, assume=${assumeVideoHasAudio === true})`)
    await runFfmpeg(
      command
        .complexFilter(filterComplex)
        .outputOptions([
          '-map 0:v',
          '-map [final_audio]',
          '-c:v copy',
          '-c:a aac',
          '-b:a 192k',
          '-shortest',
        ]),
      finalOutput
    )

    console.log(`[Assembly] Music track successfully added to video`)
    return finalOutput
  } catch (error) {
    console.error('[Assembly] Failed to add music track, returning video without music:', error)
    return videoPath
  }
}

// ============================================
// QUALITY PRESETS
// ============================================

export const QUALITY_PRESETS = {
  // For final delivery
  high: {
    preset: 'slow',
    crf: 18,
    audioBitrate: '192k',
  },
  // For previews/testing
  medium: {
    preset: 'medium',
    crf: 23,
    audioBitrate: '128k',
  },
  // For quick iterations
  fast: {
    preset: 'fast',
    crf: 26,
    audioBitrate: '96k',
  },
}
