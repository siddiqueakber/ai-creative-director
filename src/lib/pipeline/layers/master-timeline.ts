import type OpenAI from 'openai'
import { prisma } from '@/lib/db'
import type {
  DirectorBrief,
  DocumentaryStructure,
  DocumentaryNarration,
  DeepUnderstandingResult,
  PerspectivePostureResult,
  MasterTimelineData,
  TimelineBeat,
  TimelineBeatType,
  TimelineVisualCategory,
  CameraGrammar,
  TimelineLighting,
  TransitionOut,
  ShotPlan,
  SceneTimeOfDay,
  SceneSetting,
  DocumentaryActType,
} from '../types'
import type { AvoidList, VideoFingerprint } from '../types'
import { validateMasterTimeline } from '../master-timeline-validator'
import {
  TOTAL_DURATION_SEC,
  ALLOWED_DURATIONS,
  MIN_BEATS,
  MAX_BEATS,
  MIN_BREATHING_BEATS,
} from '../timeline-durations'
import { NATURAL_WORLD_MIRACLE_PROMPTS } from '../orbit-visual-spec'

export interface GenerateMasterTimelineParams {
  videoId: string
  directorBrief: DirectorBrief
  documentaryStructure: DocumentaryStructure
  understanding: DeepUnderstandingResult
  perspective: PerspectivePostureResult
  narration: DocumentaryNarration
  avoidList: AvoidList
  lastNFingerprints: VideoFingerprint[]
}

/** Params for timeline-first: generate skeleton without narration, then fit narration to beats. */
export interface GenerateMasterTimelineSkeletonParams {
  videoId: string
  directorBrief: DirectorBrief
  documentaryStructure: DocumentaryStructure
  understanding: DeepUnderstandingResult
  perspective: PerspectivePostureResult
  avoidList: AvoidList
  lastNFingerprints: VideoFingerprint[]
}

const CAMERA_MOTIONS = ['slow_drift', 'slow_push', 'locked_off', 'handheld']
const CAMERA_FRAMINGS = ['wide', 'medium', 'close']
const CAMERA_LENSES = ['wide', 'normal', 'tele']
const LIGHTING_TIMES = ['night', 'dawn', 'day', 'dusk']
const LIGHTING_CONTRASTS = ['low', 'medium', 'high']
const TRANSITIONS = ['cut', 'dissolve', 'match_cut']
const VISUAL_CATEGORIES = ['cosmos', 'earth', 'human', 'nature', 'abstract', 'conflict', 'ocean', 'domestic', 'industrial', 'desert']

function normalizeBeat(raw: Record<string, unknown>, index: number, startSec: number): TimelineBeat {
  const durationSec = typeof raw.durationSec === 'number' && (ALLOWED_DURATIONS as readonly number[]).includes(raw.durationSec)
    ? raw.durationSec
    : 6
  const endSec = startSec + durationSec
  const actIndex = typeof raw.actIndex === 'number' ? Math.max(0, raw.actIndex) : 0
  const beatType = (['narrated', 'breathing', 'transition'] as const).includes(raw.beatType as TimelineBeatType)
    ? (raw.beatType as TimelineBeatType)
    : 'narrated'
  const visualCategory = (VISUAL_CATEGORIES as readonly string[]).includes(raw.visualCategory as string)
    ? (raw.visualCategory as TimelineVisualCategory)
    : 'earth'
  const motion = (CAMERA_MOTIONS as readonly string[]).includes((raw.cameraGrammar as Record<string, string>)?.motion)
    ? (raw.cameraGrammar as CameraGrammar).motion
    : 'slow_drift'
  const framing = (CAMERA_FRAMINGS as readonly string[]).includes((raw.cameraGrammar as Record<string, string>)?.framing)
    ? (raw.cameraGrammar as CameraGrammar).framing
    : 'wide'
  const lens = (CAMERA_LENSES as readonly string[]).includes((raw.cameraGrammar as Record<string, string>)?.lens)
    ? (raw.cameraGrammar as CameraGrammar).lens
    : 'normal'
  const timeOfDay = (LIGHTING_TIMES as readonly string[]).includes((raw.lighting as Record<string, string>)?.timeOfDay)
    ? (raw.lighting as TimelineLighting).timeOfDay
    : 'day'
  const contrast = (LIGHTING_CONTRASTS as readonly string[]).includes((raw.lighting as Record<string, string>)?.contrast)
    ? (raw.lighting as TimelineLighting).contrast
    : 'low'
  const transitionOut = (TRANSITIONS as readonly string[]).includes(raw.transitionOut as string)
    ? (raw.transitionOut as TransitionOut)
    : 'cut'
  const emotionalPhase = (['awe', 'human_reality', 'reflection', 'return'] as const).includes(raw.emotionalPhase as 'awe' | 'human_reality' | 'reflection' | 'return')
    ? (raw.emotionalPhase as 'awe' | 'human_reality' | 'reflection' | 'return')
    : undefined
  const pacingSpeed = (['slow', 'medium', 'quiet_close'] as const).includes(raw.pacingSpeed as 'slow' | 'medium' | 'quiet_close')
    ? (raw.pacingSpeed as 'slow' | 'medium' | 'quiet_close')
    : undefined

  return {
    beatIndex: index,
    actIndex,
    startSec,
    endSec,
    durationSec,
    beatType,
    visualCategory,
    cameraGrammar: { motion, framing, lens },
    lighting: { timeOfDay, contrast },
    transitionOut,
    narrationText: typeof raw.narrationText === 'string' ? raw.narrationText : undefined,
    narrationSegmentIds: Array.isArray(raw.narrationSegmentIds) ? (raw.narrationSegmentIds as string[]) : undefined,
    veoPrompt: typeof raw.veoPrompt === 'string' ? raw.veoPrompt : '',
    videoSceneId: typeof raw.videoSceneId === 'string' ? raw.videoSceneId : undefined,
    emotionalPhase,
    pacingSpeed,
  }
}

function parseAndNormalizeBeats(beats: unknown[], totalDurationSec: number): TimelineBeat[] {
  const result: TimelineBeat[] = []
  let cursor = 0
  for (let i = 0; i < beats.length; i++) {
    const raw = beats[i] as Record<string, unknown>
    const beat = normalizeBeat(raw, i, cursor)
    beat.startSec = cursor
    beat.endSec = cursor + beat.durationSec
    cursor = beat.endSec
    result.push(beat)
  }
  return result
}

/** Adjust beat durations so they sum to TOTAL_DURATION_SEC, using only 6 or 8. Recomputes startSec/endSec. */
function normalizeSumToTotal(beats: TimelineBeat[]): TimelineBeat[] {
  const allowed = ALLOWED_DURATIONS as readonly number[]
  let sum = beats.reduce((s, b) => s + b.durationSec, 0)
  if (sum === TOTAL_DURATION_SEC) {
    return beats
  }
  const out = beats.map((b) => ({ ...b, durationSec: allowed.includes(b.durationSec) ? b.durationSec : 6 }))
  let delta = TOTAL_DURATION_SEC - sum

  while (delta !== 0 && Math.abs(delta) <= 100) {
    if (delta > 0) {
      // Need to add: upgrade 6→8 or add new beat (6 or 8)
      const canUpgrade = out.findIndex((b) => b.durationSec === 6 && delta >= 2)
      if (canUpgrade === -1) {
        if (out.length < MAX_BEATS && delta >= 6) {
          const last = out[out.length - 1]
          const addDur = delta >= 8 ? 8 : 6
          out.push({
            ...last,
            beatIndex: out.length,
            startSec: 0,
            endSec: 0,
            durationSec: addDur,
          })
          delta -= addDur
        } else break
      } else {
        const b = out[canUpgrade]
        if (b.durationSec === 6 && delta >= 2) {
          b.durationSec = 8
          delta -= 2
        } else break
      }
    } else {
      // Need to subtract: downgrade 8→6
      const canDowngrade = out.findIndex((b) => b.durationSec === 8 && delta <= -2)
      if (canDowngrade === -1) break
      const b = out[canDowngrade]
      if (b.durationSec === 8 && delta <= -2) {
        b.durationSec = 6
        delta += 2
      } else break
    }
  }

  let cursor = 0
  for (let i = 0; i < out.length; i++) {
    out[i].startSec = cursor
    out[i].endSec = cursor + out[i].durationSec
    out[i].beatIndex = i
    cursor = out[i].endSec
  }
  return out
}

/**
 * Generate a timeline skeleton first (no narration): beats with actIndex, durationSec, beatType,
 * cameraGrammar, lighting, visualCategory. narrationText and veoPrompt are placeholders; fill with
 * fillMasterTimelineWithNarration after generating narration to fit these beats.
 */
export async function generateMasterTimelineSkeleton(
  openai: OpenAI,
  params: GenerateMasterTimelineSkeletonParams
): Promise<MasterTimelineData> {
  const {
    videoId,
    directorBrief,
    documentaryStructure,
    understanding,
    perspective,
    avoidList,
    lastNFingerprints,
  } = params

  const vg = directorBrief.visualGrammar
  const visualGrammarStr = vg
    ? `Visual Grammar (obey in every beat): motion=${vg.motionStyle}, lens=${vg.lensStyle}, transition=${vg.transitionStyle}, pacing=${vg.pacingStyle}`
    : ''

  const numActs = documentaryStructure.acts.length
  const actSummary = documentaryStructure.acts
    .map(
      (act, i) => {
        const choreo = [
          act.emotionalPhase && `emotionalPhase=${act.emotionalPhase}`,
          act.pacingSpeed && `pacingSpeed=${act.pacingSpeed}`,
          act.cameraBias && `cameraBias=${act.cameraBias}`,
          act.narrationPresence && `narrationPresence=${act.narrationPresence}`,
          act.shotLengthRange && `shotLengthRange=${act.shotLengthRange[0]}-${act.shotLengthRange[1]}s`,
        ].filter(Boolean)
        const zoomLabel = act.zoomLevel ? ` zoomLevel=${act.zoomLevel}` : ''
        return `Act ${i}: ${act.actType}${zoomLabel} (${act.duration}s) – ${act.visualRequirements.slice(0, 2).join(', ')}${choreo.length ? ' | ' + choreo.join(', ') : ''}`
      }
    )
    .join('\n')

  const avoidStr =
    avoidList.promptSnippets.length > 0
      ? `Avoid reusing these prompt snippets: ${avoidList.promptSnippets.slice(0, 8).join('; ')}. `
      : ''
  const fingerprintStr =
    lastNFingerprints.length > 0
      ? `Recent videos opened with: ${lastNFingerprints.map((f) => f.motifs.slice(0, 2).join(', ')).join('; ')}. Do not repeat as first beat. `
      : ''

  const systemPrompt = `You are a documentary editor. Produce a TIMELINE SKELETON (beat-by-beat) with NO narration yet. The timeline defines WHERE narration will go and WHERE silent visual-only "breathing" beats go. Narration will be written later to fit these beats.

Output ONLY valid JSON, no markdown or explanation.

Output shape: { "totalDurationSec": ${TOTAL_DURATION_SEC}, "beats": [ ... ] }

Each beat must have:
- beatIndex: number (0-based)
- actIndex: number (0 to ${numActs - 1}, one per act)
- startSec, endSec, durationSec: number (durationSec MUST be 6 or 8 only; prefer 8. No 4s.)
- beatType: "narrated" | "breathing" | "transition"
- visualCategory: one of ${VISUAL_CATEGORIES.join(', ')}
- cameraGrammar: { "motion": one of ${CAMERA_MOTIONS.join(', ')}, "framing": one of ${CAMERA_FRAMINGS.join(', ')}, "lens": one of ${CAMERA_LENSES.join(', ')} }
- lighting: { "timeOfDay": one of ${LIGHTING_TIMES.join(', ')}, "contrast": one of ${LIGHTING_CONTRASTS.join(', ')} }
- transitionOut: one of ${TRANSITIONS.join(', ')}
- narrationText: empty string "" for every beat (will be filled later with calm narration per shot)
- veoPrompt: use "Narrated" for every beat (will be replaced when narration is written). Never include words, titles, or on-screen text in veoPrompt — visual imagery only.
- emotionalPhase, pacingSpeed: optional, from the act

RULES:
1. Allocate beats across the ${numActs} acts using the act durations above. Total = exactly ${TOTAL_DURATION_SEC}s. Between ${MIN_BEATS} and ${MAX_BEATS} beats. actIndex must be in [0, ${numActs - 1}].
2. Use exactly ${MIN_BREATHING_BEATS} breathing beats (beatType: "breathing", 8s, no narration). These are TEMPORAL SILENCE — ambient sound only, no voice. They prevent semantic overload and allow perceptual settling. Place them: one in each act, or after every 2-3 narrated beats. All other beats MUST be "narrated."
3. For acts with pacingSpeed "slow" or emotionalPhase "awe" or "reflection", set durationSec to 8 for every beat in that act. For other acts, prefer 8 over 6 when possible.
4. Within each act, use exactly ONE camera motion and exactly ONE lighting/timeOfDay for all beats in that act; only vary framing or shot size if needed. Scene continuity: same lighting mood and similar camera motion inside each act.
5. BOOKEND RULE: The first beat and the last beat must share the same visualCategory (e.g. both "earth" or both "cosmos") and the same cameraGrammar.framing (e.g. both "wide") so the film opens and closes at the same scale.
6. Sum of all durationSec must equal exactly ${TOTAL_DURATION_SEC}. Verify before outputting.`

  const userPrompt = `DIRECTOR BRIEF:
- Tone: ${directorBrief.tone}
- One-liner: ${directorBrief.oneLiner}
- Key metaphors: ${directorBrief.keyMetaphors.join(', ')}
- Avoid pacing: ${directorBrief.avoidPacing}
${visualGrammarStr ? `\n${visualGrammarStr}` : ''}

ACT STRUCTURE:
${actSummary}

${avoidStr}${fingerprintStr}

Guiding question: ${understanding.guidingQuestion}. Posture: ${perspective.posture}. Pacing: ${perspective.pacingBias}.

Produce the timeline skeleton JSON. durationSec in [6, 8] only (prefer 8), startSec/endSec contiguous, no gaps.`

  const maxRetries = 2
  let lastErrors: string[] = []

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const currentUserPrompt =
      attempt === 0
        ? userPrompt
        : `${userPrompt}\n\nPrevious attempt failed: ${lastErrors.join('; ')}. Fix and output valid JSON again.`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: currentUserPrompt },
        ],
        temperature: 0.3,
        max_completion_tokens: 4000,
        response_format: { type: 'json_object' },
      })

      const content = response.choices[0]?.message?.content
      if (!content) throw new Error('Empty LLM response')

      const parsed = JSON.parse(content) as { totalDurationSec?: number; beats?: unknown[] }
      const totalDurationSec = parsed.totalDurationSec === TOTAL_DURATION_SEC ? TOTAL_DURATION_SEC : TOTAL_DURATION_SEC
      const rawBeats = Array.isArray(parsed.beats) ? parsed.beats : []
      const parsedBeats = parseAndNormalizeBeats(rawBeats, totalDurationSec)
      const beats = normalizeSumToTotal(parsedBeats)

      const data: MasterTimelineData = { totalDurationSec, beats }
      const maxActIndex = numActs - 1
      const validation = validateMasterTimeline(data, maxActIndex)

      if (validation.valid) {
        return data
      }
      lastErrors = validation.errors
    } catch (e) {
      lastErrors = [e instanceof Error ? e.message : String(e)]
    }
  }

  throw new Error(`Master timeline skeleton validation failed after ${maxRetries} attempts: ${lastErrors.join('; ')}`)
}

/**
 * Fill skeleton timeline with narration and veoPrompts: for each narrated beat, set narrationText and
 * veoPrompt from the corresponding segment; for breathing beats, ensure veoPrompt is filmable (keep or build from beat metadata).
 */
export function fillMasterTimelineWithNarration(
  timeline: MasterTimelineData,
  narration: DocumentaryNarration
): void {
  const narratedBeats = timeline.beats.filter((b) => b.beatType === 'narrated')
  const segments = narration.segments
  const totalBeats = timeline.beats.length

  // When segment count matches total beats (1:1 with all beats including breathing),
  // map segment[i] -> beat[i] directly. When it matches narrated beats only,
  // use the original narrated-only mapping.
  if (segments.length === totalBeats && segments.length !== narratedBeats.length) {
    for (let i = 0; i < totalBeats; i++) {
      const beat = timeline.beats[i]
      const seg = segments[i]
      if (beat.beatType === 'narrated' && seg) {
        const text = typeof seg.text === 'string' ? seg.text.trim() : ''
        if (text) beat.narrationText = text
        beat.veoPrompt = (seg.visualDescription || seg.visualCue || beat.veoPrompt || 'Observational shot.').slice(0, 300)
      } else if (beat.beatType !== 'narrated') {
        if (seg?.visualDescription) {
          beat.veoPrompt = seg.visualDescription.slice(0, 300)
        } else if (!beat.veoPrompt || beat.veoPrompt === 'Narrated') {
          beat.veoPrompt = buildBreathingVeoPrompt(beat)
        }
      }
    }
    return
  }

  if (segments.length !== narratedBeats.length) {
    console.warn(
      `[fillMasterTimelineWithNarration] Segment count (${segments.length}) != narrated beat count (${narratedBeats.length}); aligning by index.`
    )
  }
  let segmentIndex = 0
  for (const beat of timeline.beats) {
    if (beat.beatType === 'narrated') {
      const seg = segments[segmentIndex]
      if (seg) {
        beat.narrationText = seg.text
        beat.veoPrompt = (seg.visualDescription || seg.visualCue || beat.veoPrompt || 'Observational shot.').slice(0, 300)
      }
      segmentIndex++
    } else {
      if (!beat.veoPrompt || beat.veoPrompt === 'Narrated') {
        beat.veoPrompt = buildBreathingVeoPrompt(beat)
      }
    }
  }
}

function buildBreathingVeoPrompt(beat: TimelineBeat): string {
  // MIRACLE_OF_YOU (actIndex 2): use natural-world prompts (whale, falcon, Earth from space, etc.)
  if (beat.actIndex === 2) {
    const idx = (beat.beatIndex ?? 0) % NATURAL_WORLD_MIRACLE_PROMPTS.length
    return NATURAL_WORLD_MIRACLE_PROMPTS[idx].slice(0, 200)
  }
  const { visualCategory, lighting, cameraGrammar } = beat
  const time = lighting.timeOfDay
  const motion = cameraGrammar.motion === 'slow_drift' ? 'slow drift' : cameraGrammar.motion
  const framing = cameraGrammar.framing
  const categoryPrompts: Record<string, string> = {
    cosmos: 'Starfield or Earth from space, atmospheric.',
    earth: 'Wide natural landscape or ecosystem, calm.',
    human: 'Distant human activity or street, observational.',
    nature: 'Nature detail or landscape, still.',
    abstract: 'Quiet interior or abstract texture.',
    domestic: 'Quiet domestic detail, warm light.',
    ocean: 'Ocean or water, slow movement.',
    desert: 'Desert or open land, vast.',
    industrial: 'Industrial or urban detail, still.',
    conflict: 'Public space, neutral.',
  }
  const base = categoryPrompts[beat.visualCategory] || 'Atmospheric observational shot.'
  return `${base} ${framing} shot, ${motion}, ${time} light.`.slice(0, 200)
}

/**
 * Generate a master timeline from narration and documentary structure.
 * Calls GPT to output JSON { totalDurationSec: 60, beats: TimelineBeat[] }, validates, persists to DB.
 */
export async function generateMasterTimeline(
  openai: OpenAI,
  params: GenerateMasterTimelineParams
): Promise<MasterTimelineData> {
  const {
    videoId,
    directorBrief,
    documentaryStructure,
    understanding,
    perspective,
    narration,
    avoidList,
    lastNFingerprints,
  } = params

  const vg = directorBrief.visualGrammar
  const visualGrammarStr = vg
    ? `Visual Grammar (obey in every beat): motion=${vg.motionStyle}, lens=${vg.lensStyle}, transition=${vg.transitionStyle}, pacing=${vg.pacingStyle}`
    : ''

  const numActsLegacy = documentaryStructure.acts.length
  const actSummaryLegacy = documentaryStructure.acts
    .map(
      (act, i) => {
        const choreo = [
          act.emotionalPhase && `emotionalPhase=${act.emotionalPhase}`,
          act.pacingSpeed && `pacingSpeed=${act.pacingSpeed}`,
          act.cameraBias && `cameraBias=${act.cameraBias}`,
          act.narrationPresence && `narrationPresence=${act.narrationPresence}`,
          act.shotLengthRange && `shotLengthRange=${act.shotLengthRange[0]}-${act.shotLengthRange[1]}s`,
        ].filter(Boolean)
        const zoomLabel = act.zoomLevel ? ` zoomLevel=${act.zoomLevel}` : ''
        return `Act ${i}: ${act.actType}${zoomLabel} (${act.duration}s) – ${act.visualRequirements.slice(0, 2).join(', ')}${choreo.length ? ' | ' + choreo.join(', ') : ''}`
      }
    )
    .join('\n')

  // Build rich narration input with visualDescription for timeline derivation
  const narrationLines = narration.segments
    .map(
      (seg, i) =>
        `Segment ${i} (act ${seg.actIndex}, ${seg.wordCount}w, breathingAfter=${seg.breathingAfter ?? false}):
  text: "${seg.text.slice(0, 120)}${seg.text.length > 120 ? '...' : ''}"
  visualDescription: "${(seg.visualDescription || seg.visualCue || '').slice(0, 200)}"
  motif: ${seg.motif}, scale: ${seg.scaleType}, shot: ${seg.shotType}, setting: ${seg.settingHint}`
    )
    .join('\n')

  const avoidStr =
    avoidList.promptSnippets.length > 0
      ? `Avoid reusing these prompt snippets: ${avoidList.promptSnippets.slice(0, 8).join('; ')}. `
      : ''
  const fingerprintStr =
    lastNFingerprints.length > 0
      ? `Recent videos opened with: ${lastNFingerprints.map((f) => f.motifs.slice(0, 2).join(', ')).join('; ')}. Do not repeat as first beat. `
      : ''

  const systemPrompt = `You are a documentary editor. Given narration segments with their visual descriptions, produce a beat-by-beat timeline.

CRITICAL RULE: Each narrated beat's veoPrompt must be a short filmable shot description DERIVED FROM the segment's visualDescription. Do NOT invent new visuals unrelated to the narration. The visuals must serve the narration. Favor non-human time and process over events; visuals must be filmable within Orbit rules (no close humans, no indoor, no street-level).

Output ONLY valid JSON, no markdown or explanation.

Output shape: { "totalDurationSec": ${TOTAL_DURATION_SEC}, "beats": [ ... ] }

Each beat must have:
- beatIndex: number (0-based)
- actIndex: number (0 to ${numActsLegacy - 1}, one per act)
- startSec, endSec, durationSec: number (durationSec MUST be 6 or 8 only; prefer 8 when possible, use 6 only when needed for pacing. No 4s beats.)
- beatType: "narrated" | "breathing" | "transition"
- visualCategory: one of ${VISUAL_CATEGORIES.join(', ')}
- cameraGrammar: { "motion": one of ${CAMERA_MOTIONS.join(', ')}, "framing": one of ${CAMERA_FRAMINGS.join(', ')}, "lens": one of ${CAMERA_LENSES.join(', ')} }
- lighting: { "timeOfDay": one of ${LIGHTING_TIMES.join(', ')}, "contrast": one of ${LIGHTING_CONTRASTS.join(', ')} }
- transitionOut: one of ${TRANSITIONS.join(', ')}
- narrationText: string or null (copy the segment text for narrated beats; null for breathing beats)
- veoPrompt: string (filmable shot derived from the segment's visualDescription, under 200 chars; visual only — no words, titles, or on-screen text in the description)
- emotionalPhase: optional string from act (awe, human_reality, reflection, return)
- pacingSpeed: optional string from act (slow, medium, quiet_close)

HOW TO BUILD THE TIMELINE:
1. For each narration segment, create one "narrated" beat. Set durationSec based on word count (≈2.0 words/sec at slow delivery speed → snap to nearest {6, 8}). Prefer 8s when possible.
2. Where a segment has breathingAfter=true OR between different act transitions, insert a "breathing" beat (8s, no narration). Breathing beats are TEMPORAL SILENCE — ambient sound only, no voice; they prevent semantic overload and allow perceptual settling. Include at least ${MIN_BREATHING_BEATS} breathing beats, spread across acts (one per act or after every 2-3 narrated beats).
3. For acts with pacingSpeed "slow" or emotionalPhase "awe" or "reflection", set durationSec to 8 for every beat in that act. For other acts, prefer 8 over 6 when possible.
4. Assign cameraGrammar and lighting per beat to follow the act's choreography (emotionalPhase, pacingSpeed, cameraBias) and the director's Visual Grammar. Within each act, use a single camera motion and a single lighting/timeOfDay; only vary framing or shot size if needed.
5. Write veoPrompt by rephrasing the segment's visualDescription into a concise filmable shot. Favor non-human time and process over events; visuals must obey Orbit rules (no close humans, no indoor, no street-level). Do not include any words, titles, or on-screen text in veoPrompt; visual imagery only.
6. BOOKEND RULE: The first beat and the last beat must share the same visualCategory and the same cameraGrammar.framing so the film opens and closes at the same scale.
7. Ensure total = exactly ${TOTAL_DURATION_SEC}s. Between ${MIN_BEATS} and ${MAX_BEATS} beats. At least ${MIN_BREATHING_BEATS} breathing beats.
8. Within each act, use exactly ONE camera motion and exactly ONE lighting/timeOfDay for all beats; only vary framing or shot size if needed. Scene continuity: same lighting mood and similar camera motion inside each act.
9. CRITICAL: The sum of all durationSec must equal exactly ${TOTAL_DURATION_SEC}. Verify before outputting.`

  const userPrompt = `DIRECTOR BRIEF:
- Tone: ${directorBrief.tone}
- One-liner: ${directorBrief.oneLiner}
- Key metaphors: ${directorBrief.keyMetaphors.join(', ')}
- Avoid pacing: ${directorBrief.avoidPacing}
${visualGrammarStr ? `\n${visualGrammarStr}` : ''}

ACT STRUCTURE (use each act's emotionalPhase, pacingSpeed, cameraBias, narrationPresence for beat design):
${actSummaryLegacy}

NARRATION SEGMENTS (derive each beat's visuals from the segment's visualDescription):
${narrationLines}

${avoidStr}${fingerprintStr}

Guiding question: ${understanding.guidingQuestion}. Posture: ${perspective.posture}. Pacing: ${perspective.pacingBias}.

Produce the JSON with totalDurationSec: ${TOTAL_DURATION_SEC} and beats array. Each narrated beat's veoPrompt must come from the segment's visualDescription. Each beat: durationSec in [6, 8] only (prefer 8), startSec/endSec contiguous, no gaps.`

  const maxRetries = 2
  let lastErrors: string[] = []

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const currentUserPrompt =
      attempt === 0
        ? userPrompt
        : `${userPrompt}\n\nPrevious attempt failed: ${lastErrors.join('; ')}. Fix and output valid JSON again.`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: currentUserPrompt },
        ],
        temperature: 0.3,
        max_completion_tokens: 4000,
        response_format: { type: 'json_object' },
      })

      const content = response.choices[0]?.message?.content
      if (!content) throw new Error('Empty LLM response')

      const parsed = JSON.parse(content) as { totalDurationSec?: number; beats?: unknown[] }
      const totalDurationSec = parsed.totalDurationSec === TOTAL_DURATION_SEC ? TOTAL_DURATION_SEC : TOTAL_DURATION_SEC
      const rawBeats = Array.isArray(parsed.beats) ? parsed.beats : []
      const parsedBeats = parseAndNormalizeBeats(rawBeats, totalDurationSec)
      const beats = normalizeSumToTotal(parsedBeats)

      const data: MasterTimelineData = { totalDurationSec, beats }
      const maxActIndexLegacy = numActsLegacy - 1
      const validation = validateMasterTimeline(data, maxActIndexLegacy)

      if (validation.valid) {
        if (!prisma.masterTimeline) {
          throw new Error(
            'Prisma client missing masterTimeline model. Run: npx prisma generate'
          )
        }
        await prisma.masterTimeline.upsert({
          where: { videoId },
          create: {
            videoId,
            totalDurationSec: data.totalDurationSec,
            beats: data.beats as object,
          },
          update: {
            totalDurationSec: data.totalDurationSec,
            beats: data.beats as object,
          },
        })
        return data
      }

      lastErrors = validation.errors
    } catch (e) {
      lastErrors = [e instanceof Error ? e.message : String(e)]
    }
  }

  throw new Error(`Master timeline validation failed after ${maxRetries} attempts: ${lastErrors.join('; ')}`)
}

// Map timeline lighting to pipeline SceneTimeOfDay
function lightingToTimeOfDay(timeOfDay: TimelineLighting['timeOfDay']): SceneTimeOfDay {
  const map: Record<TimelineLighting['timeOfDay'], SceneTimeOfDay> = {
    night: 'night',
    dawn: 'dawn',
    day: 'midday',
    dusk: 'dusk',
  }
  return map[timeOfDay] ?? 'morning'
}

// Map timeline visualCategory to pipeline SceneSetting
function visualCategoryToSetting(visualCategory: TimelineVisualCategory): SceneSetting {
  const map: Partial<Record<TimelineVisualCategory, SceneSetting>> = {
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

/**
 * Build a shot plan from a master timeline: one shot per beat, duration and veoPrompt from beat.
 */
export function shotPlanFromMasterTimeline(
  timeline: MasterTimelineData,
  documentaryStructure: DocumentaryStructure
): ShotPlan[] {
  const numActs = documentaryStructure.acts.length
  return timeline.beats.map((beat) => {
    const safeActIndex = Math.min(Math.max(0, beat.actIndex), numActs - 1)
    const act = documentaryStructure.acts[safeActIndex]
    const actType: DocumentaryActType | undefined = act?.actType
    return {
      actIndex: safeActIndex,
      clipIndex: beat.beatIndex,
      duration: beat.durationSec,
      description: beat.veoPrompt.slice(0, 200),
      microAction: beat.narrationText ?? '',
      runwayPrompt: beat.veoPrompt,
      styleModifiers: [],
      timeOfDay: lightingToTimeOfDay(beat.lighting.timeOfDay),
      setting: visualCategoryToSetting(beat.visualCategory),
      source: 'GEN',
      actType,
      beatIndex: beat.beatIndex,
      zoomLevel: act?.zoomLevel,
    }
  })
}
