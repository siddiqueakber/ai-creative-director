import type { NarrationSegment, VideoScene } from '@prisma/client'
import { validateNarrationText } from './05-narration'
import { MIN_BREATHING_BEATS } from '../timeline-durations'
import type {
  DocumentaryNarration,
  DocumentaryNarrationSegment,
  DocumentaryStructure,
  NarrationStyle,
  NarrationMotif,
  QCCheck,
  QCFix,
  QCReport,
  ShotPlan,
  ShotConstraints,
  VideoFingerprint,
  AvoidList,
  MasterTimelineData,
  TimelineBeat,
} from '../types'

const NOVELTY_THRESHOLD = 0.3
const MAX_CONSECUTIVE_SAME = 2
const MIN_DISTINCT_MOTIFS = 2

type PreGenQCInput = {
  structure: DocumentaryStructure
  narration: DocumentaryNarration
  shotPlan: ShotPlan[]
  shotConstraints?: ShotConstraints
  avoidList?: AvoidList
  lastNFingerprints?: VideoFingerprint[]
  masterTimeline?: MasterTimelineData
}

type PreGenQCResult = {
  report: QCReport
  structure: DocumentaryStructure
  narration: DocumentaryNarration
  shotPlan: ShotPlan[]
  passed: boolean
}

type PostGenQCInput = {
  structure: DocumentaryStructure
  scenes: VideoScene[]
  narrationSegments: NarrationSegment[]
}

type PostGenQCResult = {
  report: QCReport
}

const DEFAULT_ACT_DURATIONS: Record<string, number> = {
  vast: 12,
  living_dot: 18,
  miracle_of_you: 20,
  return: 10,
}

const VEO_MODEL_DURATION_MAP: Record<string, number[]> = {
  'veo-3.1-generate-001': [6, 8],
  'veo-3.1-fast-generate-001': [6, 8],
  // Legacy Runway model names (for backward compatibility)
  'gen4.5': [5, 8, 10],
  gen3a_turbo: [5, 8, 10],
  veo3: [6, 8],
  'veo3.1': [6, 8],
  veo3_1_fast: [6, 8],
  'veo3.1_fast': [6, 8],
}

const TIME_OF_DAY_OPTIONS = [
  'dawn',
  'morning',
  'midday',
  'afternoon',
  'dusk',
  'evening',
  'night',
] as const

const SETTING_OPTIONS = [
  'urban',
  'suburban',
  'rural',
  'interior',
  'transit',
  'workplace',
  'public_space',
] as const

function getAllowedDurations(): number[] {
  const model = process.env.VEO_MODEL || process.env.RUNWAY_TEXT_TO_VIDEO_MODEL || 'veo-3.1-generate-001'
  return VEO_MODEL_DURATION_MAP[model] || [6, 8]
}

function normalizeDuration(duration: number): number {
  const allowed = getAllowedDurations()
  if (!Number.isFinite(duration) || duration <= 0) return allowed[0]
  return allowed.reduce((nearest, current) =>
    Math.abs(current - duration) < Math.abs(nearest - duration) ? current : nearest
  )
}

function getNarrationConstraints(style: NarrationStyle) {
  switch (style) {
    case 'minimal':
      return {
        maxWords: 60,
        maxWordsPerSegment: 20,
        pauseDuration: [3, 5] as [number, number],
        segmentCount: [4, 6] as [number, number],
      }
    case 'moderate':
      return {
        maxWords: 100,
        maxWordsPerSegment: 30,
        pauseDuration: [2, 3] as [number, number],
        segmentCount: [4, 8] as [number, number],
      }
    case 'sparse':
      return {
        maxWords: 140,
        maxWordsPerSegment: 40,
        pauseDuration: [1, 2] as [number, number],
        segmentCount: [4, 8] as [number, number],
      }
  }
}

/**
 * Remove only sentences that contain banned words/patterns, rather than replacing the entire segment.
 */
function removeBannedSentencesQC(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const clean = sentences.filter((s) => {
    const v = validateNarrationText(s)
    const p = matchesBannedPattern(s)
    return v.valid && p.length === 0
  })
  return clean.join(' ').trim()
}

const BANNED_PATTERNS: { label: string; regex: RegExp }[] = [
  { label: 'imperative: you should', regex: /\byou\s+should\b/i },
  { label: 'imperative: you must', regex: /\byou\s+must\b/i },
  { label: 'imperative: you need to', regex: /\byou\s+need\s+to\b/i },
  { label: 'imperative: remember to', regex: /\bremember\s+to\b/i },
  { label: 'certainty: the answer is', regex: /\bthe\s+answer\s+is\b/i },
  { label: 'certainty: this means', regex: /\bthis\s+means\b/i },
  { label: 'certainty: the truth is', regex: /\bthe\s+truth\s+is\b/i },
  { label: 'coaching: heal', regex: /\bheal\b/i },
  { label: 'coaching: fix yourself', regex: /\bfix\s+yourself\b/i },
  { label: 'coaching: be your best', regex: /\bbe\s+your\s+best\b/i },
  { label: 'inspiration: destiny', regex: /\bdestiny\b/i },
  { label: 'inspiration: meant to', regex: /\bmeant\s+to\b/i },
  { label: 'inspiration: journey', regex: /\bjourney\b/i },
  { label: 'inspiration: manifest', regex: /\bmanifest\b/i },
]

const ORBIT_FALLBACKS = [
  {
    actIndex: 0,
    text: 'From far away, the world turns in silence.',
    visualCue: 'Earth seen from orbit, slow drift, quiet light',
    motif: 'earth_from_space',
    scaleType: 'cosmic' as const,
    shotType: 'slow_drift' as const,
    settingHint: 'space' as const,
  },
  {
    actIndex: 1,
    text: 'On the surface, life moves through water and streets.',
    visualCue: 'River delta feeding wetlands with birds in motion',
    motif: 'human_labor',
    scaleType: 'global' as const,
    shotType: 'aerial' as const,
    settingHint: 'rural' as const,
  },
  {
    actIndex: 2,
    text: 'A body learns breath and sensation, moment by moment.',
    visualCue: 'Steam rising from a warm cup in soft morning light',
    motif: 'shared_continuance',
    scaleType: 'personal' as const,
    shotType: 'macro' as const,
    settingHint: 'interior' as const,
  },
  {
    actIndex: 3,
    text: 'Ordinary life continues, patient and unfinished.',
    visualCue: 'Morning commuters crossing a quiet street',
    motif: 'quiet_return',
    scaleType: 'human' as const,
    shotType: 'wide' as const,
    settingHint: 'urban' as const,
  },
]

function getFallbackByAct(actIndex: number) {
  return ORBIT_FALLBACKS[actIndex] || ORBIT_FALLBACKS[3]
}

function matchesBannedPattern(text: string): string[] {
  const violations: string[] = []
  BANNED_PATTERNS.forEach((pattern) => {
    if (pattern.regex.test(text)) violations.push(pattern.label)
  })
  return violations
}

function allocateActOrder(maxSegments: number): number[] {
  const total = Math.min(5, Math.max(4, maxSegments))
  if (total === 5) return [0, 1, 1, 2, 3]
  return [0, 1, 2, 3]
}

function trimToWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/)
  if (words.length <= maxWords) return text.trim()
  return words.slice(0, maxWords).join(' ')
}

function isFilmableCue(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed.length < 10) return false
  const lower = trimmed.toLowerCase()
  const abstractOnly = ['meaning', 'purpose', 'truth', 'journey', 'destiny', 'future', 'past']
  const hasVisualAnchor = ['sky', 'earth', 'street', 'light', 'hand', 'window', 'ocean', 'city', 'stars'].some(
    (token) => lower.includes(token)
  )
  const hasAbstractOnly = abstractOnly.some((token) => lower.includes(token))
  return hasVisualAnchor || !hasAbstractOnly
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function createReport(stage: QCReport['stage']): QCReport {
  return {
    runId: `qc_${Date.now()}`,
    stage,
    createdAt: new Date().toISOString(),
    checks: [],
    warnings: [],
    fixesApplied: [],
    summary: { total: 0, passed: 0, failed: 0, warnings: 0 },
  }
}

function addCheck(report: QCReport, check: QCCheck) {
  report.checks.push(check)
  if (!check.passed && check.severity === 'warn') {
    report.warnings.push(check)
  }
}

function addFix(report: QCReport, fix: QCFix) {
  report.fixesApplied.push(fix)
}

function finalizeReport(report: QCReport) {
  const total = report.checks.length
  const passed = report.checks.filter((c) => c.passed).length
  const failed = total - passed
  const warnings = report.warnings.length
  report.summary = { total, passed, failed, warnings }
}

export function runQualityControlPreGen(input: PreGenQCInput): PreGenQCResult {
  const report = createReport('pre_gen')
  const structure = deepClone(input.structure)
  const narration = deepClone(input.narration)
  const shotPlan = deepClone(input.shotPlan)

  // STRUCTURE CHECKS
  addCheck(report, {
    id: 'structure_act_count',
    category: 'structure',
    severity: 'warn',
    passed: structure.acts.length === 4,
    message: 'Structure should have exactly 4 acts.',
    details: { count: structure.acts.length },
  })

  structure.acts.forEach((act, index) => {
    if (!Number.isFinite(act.duration) || act.duration <= 0) {
      const fallback = DEFAULT_ACT_DURATIONS[act.actType] || 10
      addFix(report, {
        id: `structure_duration_fix_${act.actType}`,
        description: 'Fixed invalid act duration.',
        before: act.duration,
        after: fallback,
      })
      act.duration = fallback
    }

    if (act.actType === 'vast' && act.silenceDuration < 2) {
      addFix(report, {
        id: 'structure_vast_silence',
        description: 'Adjusted vast opening silence to minimum 2s.',
        before: act.silenceDuration,
        after: 2,
      })
      act.silenceDuration = 2
    }

    if (act.silenceDuration < 0) {
      addFix(report, {
        id: `structure_silence_fix_${index}`,
        description: 'Adjusted negative silence duration to 0.',
        before: act.silenceDuration,
        after: 0,
      })
      act.silenceDuration = 0
    }
  })

  structure.totalDuration = structure.acts.reduce((sum, act) => sum + act.duration, 0)

  addCheck(report, {
    id: 'structure_total_duration',
    category: 'structure',
    severity: 'warn',
    passed: structure.totalDuration === 120,
    message: 'Total duration should be 120 seconds.',
    details: { totalDuration: structure.totalDuration },
  })

  const lastAct = structure.acts[structure.acts.length - 1]
  if (lastAct && lastAct.actType !== 'return') {
    addFix(report, {
      id: 'structure_return_last',
      description: 'Forced final act to return.',
      before: lastAct.actType,
      after: 'return',
    })
    lastAct.actType = 'return'
  }

  const scaleTypes = new Set(structure.acts.map((act) => act.scaleType))
  addCheck(report, {
    id: 'structure_scale_coverage',
    category: 'structure',
    severity: 'warn',
    passed: scaleTypes.size >= 2,
    message: 'Structure should include at least 2 scale types.',
    details: { scaleTypes: Array.from(scaleTypes) },
  })

  // NARRATION CHECKS
  // When masterTimeline is present (timeline-first flow), narration has one segment per beat (e.g. 15).
  // Validate and clean each segment in place — do NOT rebuild/reduce to 4-5 segments.
  const constraints = getNarrationConstraints(structure.narrationStyle)
  const hasTimeline = input.masterTimeline != null && (input.masterTimeline.beats as TimelineBeat[]).length > 0
  const timelineBeats = hasTimeline ? (input.masterTimeline!.beats as TimelineBeat[]) : []

  if (hasTimeline) {
    // Timeline-first: validate each segment in place, preserve 1:1 beat mapping
    for (let i = 0; i < narration.segments.length; i++) {
      const segment = narration.segments[i]
      const actIndex = segment.actIndex
      let text = segment.text?.trim() || ''

      if (!text) {
        const fallback = getFallbackByAct(Math.min(actIndex, 3))
        text = fallback.text
        addFix(report, {
          id: `narration_empty_${i}`,
          description: 'Replaced empty narration segment with fallback.',
          before: '',
          after: text,
        })
      }

      const validation = validateNarrationText(text)
      const patternViolations = matchesBannedPattern(text)
      if (!validation.valid || patternViolations.length > 0) {
        const cleaned = removeBannedSentencesQC(text)
        if (cleaned.length > 0) {
          addFix(report, {
            id: `narration_trim_${i}`,
            description: 'Trimmed offending sentences from narration segment.',
            before: text,
            after: cleaned,
          })
          text = cleaned
        } else {
          const fallback = getFallbackByAct(Math.min(actIndex, 3))
          text = fallback.text
          addFix(report, {
            id: `narration_replace_${i}`,
            description: 'Replaced fully-banned narration segment with fallback.',
            before: segment.text,
            after: text,
          })
        }
      }

      addCheck(report, {
        id: `narration_banned_${i}`,
        category: 'narration',
        severity: 'warn',
        passed: validateNarrationText(text).valid && matchesBannedPattern(text).length === 0,
        message: `Narration segment ${i} language check.`,
      })

      const wordCount = text.split(/\s+/).length
      narration.segments[i] = {
        ...segment,
        text,
        wordCount,
        duration: segment.duration,
        startTime: segment.startTime,
        beatIndex: segment.beatIndex ?? i,
      }
    }
  } else {
    // Legacy flow: rebuild segments using act allocation (4-5 segments)
    const actOrder = allocateActOrder(constraints.segmentCount[1])
    const actBuckets = new Map<number, DocumentaryNarrationSegment[]>()
    narration.segments.forEach((segment) => {
      const list = actBuckets.get(segment.actIndex) || []
      list.push(segment)
      actBuckets.set(segment.actIndex, list)
    })

    const rebuiltSegments: DocumentaryNarrationSegment[] = []
    let totalWords = 0
    let startTime = 0

    actOrder.forEach((actIndex, index) => {
      const candidates = actBuckets.get(actIndex) || []
      const candidate = candidates.shift()
      const fallback = getFallbackByAct(actIndex)
      let text = candidate?.text?.trim() || fallback.text

      const validation = validateNarrationText(text)
      const patternViolations = matchesBannedPattern(text)
      const hasBannedContent = !validation.valid || patternViolations.length > 0

      if (hasBannedContent) {
        const cleaned = removeBannedSentencesQC(text)
        if (cleaned.length > 0) {
          addCheck(report, {
            id: `narration_banned_${actIndex}_${index}`,
            category: 'narration',
            severity: 'warn',
            passed: false,
            message: 'Narration segment had banned content; offending sentences trimmed.',
            details: { violations: [...validation.violations, ...patternViolations] },
          })
          addFix(report, {
            id: `narration_trim_${actIndex}_${index}`,
            description: 'Trimmed offending sentences from narration segment.',
            before: candidate?.text,
            after: cleaned,
          })
          text = cleaned
        } else {
          addCheck(report, {
            id: `narration_banned_${actIndex}_${index}`,
            category: 'narration',
            severity: 'error',
            passed: false,
            message: 'Narration segment entirely banned; replaced with fallback.',
            details: { violations: [...validation.violations, ...patternViolations] },
          })
          addFix(report, {
            id: `narration_replace_${actIndex}_${index}`,
            description: 'Replaced fully-banned narration segment with fallback.',
            before: candidate?.text,
            after: fallback.text,
          })
          text = fallback.text
        }
      } else {
        addCheck(report, {
          id: `narration_banned_${actIndex}_${index}`,
          category: 'narration',
          severity: 'warn',
          passed: true,
          message: 'Narration segment passed language checks.',
        })
      }

      const words = text.split(/\s+/)
      if (words.length > constraints.maxWordsPerSegment) {
        text = words.slice(0, constraints.maxWordsPerSegment).join(' ')
        if (!text.endsWith('.') && !text.endsWith('!') && !text.endsWith('?')) {
          text += '.'
        }
        addFix(report, {
          id: `narration_trim_length_${actIndex}_${index}`,
          description: 'Trimmed over-length narration segment.',
          before: words.length,
          after: constraints.maxWordsPerSegment,
        })
      }

      const finalWordCount = text.split(/\s+/).length
      totalWords += finalWordCount
      const pauseAfter = constraints.pauseDuration[0]

      rebuiltSegments.push({
        text,
        startTime,
        duration: Math.ceil(finalWordCount / 2.0),
        actIndex,
        pauseAfter,
        wordCount: finalWordCount,
        status: 'pending',
        beatIndex: index,
        visualCue: isFilmableCue(candidate?.visualCue)
          ? candidate!.visualCue
          : fallback.visualCue,
        visualDescription: candidate?.visualDescription,
        breathingAfter: candidate?.breathingAfter,
        motif: (candidate?.motif || fallback.motif) as NarrationMotif,
        scaleType: candidate?.scaleType || fallback.scaleType,
        shotType: candidate?.shotType || fallback.shotType,
        settingHint: candidate?.settingHint || fallback.settingHint,
      })

      startTime += Math.ceil(finalWordCount / 2.0) + pauseAfter
    })

    narration.segments = rebuiltSegments
  }

  addCheck(report, {
    id: 'narration_segment_count',
    category: 'narration',
    severity: 'warn',
    passed: hasTimeline ? narration.segments.length === timelineBeats.length : narration.segments.length <= 8,
    message: hasTimeline
      ? `Timeline-first: narration should have ${timelineBeats.length} segments (1 per beat).`
      : 'Narration should have at most 8 segments.',
    details: { count: narration.segments.length, expected: hasTimeline ? timelineBeats.length : '<=8' },
  })

  const actCoverage = new Set(narration.segments.map((s) => s.actIndex))
  addCheck(report, {
    id: 'narration_act_coverage',
    category: 'narration',
    severity: 'warn',
    passed: actCoverage.size >= 2,
    message: 'Narration should cover multiple acts.',
    details: { actCoverage: Array.from(actCoverage) },
  })

  const lastIndex = narration.segments.length - 1
  if (lastIndex >= 0) {
    const last = narration.segments[lastIndex]
    const lastViolations = matchesBannedPattern(last.text)
    if (lastViolations.length > 0) {
      const cleaned = removeBannedSentencesQC(last.text)
      if (cleaned.length > 0) {
        narration.segments[lastIndex] = { ...last, text: cleaned, wordCount: cleaned.split(/\s+/).length, duration: last.duration }
        addFix(report, { id: 'narration_return_trim', description: 'Trimmed banned content from final segment.', before: last.text, after: cleaned })
      } else {
        const fallback = getFallbackByAct(Math.min(last.actIndex, 3))
        const wordCount = fallback.text.split(/\s+/).length
        narration.segments[lastIndex] = {
          ...last, text: fallback.text, wordCount, duration: last.duration,
          visualCue: fallback.visualCue, motif: fallback.motif as NarrationMotif,
          scaleType: fallback.scaleType, shotType: fallback.shotType, settingHint: fallback.settingHint,
        }
        addFix(report, { id: 'narration_return_last', description: 'Replaced final segment with fallback.', before: last.text, after: fallback.text })
      }
    }
    const finalValidation = validateNarrationText(narration.segments[lastIndex].text)
    const finalPatternViolations = matchesBannedPattern(narration.segments[lastIndex].text)
    addCheck(report, {
      id: 'narration_return_end',
      category: 'narration',
      severity: 'warn',
      passed: finalValidation.valid && finalPatternViolations.length === 0,
      message: 'Final narration segment should pass language checks.',
      details: finalValidation.valid
        ? undefined
        : { violations: [...finalValidation.violations, ...finalPatternViolations] },
    })
  }

  narration.totalWordCount = narration.segments.reduce((sum, seg) => sum + seg.wordCount, 0)
  narration.avgPauseDuration =
    narration.segments.reduce((sum, seg) => sum + seg.pauseAfter, 0) / narration.segments.length

  addCheck(report, {
    id: 'narration_total_words',
    category: 'narration',
    severity: 'warn',
    passed: narration.totalWordCount <= constraints.maxWords,
    message: 'Narration total word count within limit.',
    details: { total: narration.totalWordCount, max: constraints.maxWords },
  })

  // NARRATION BEAT COVERAGE CHECKS
  const beatMap = new Map<number, DocumentaryNarrationSegment>()
  narration.segments.forEach((segment, index) => {
    const beatIndex = typeof segment.beatIndex === 'number' ? segment.beatIndex : index
    segment.beatIndex = beatIndex
    beatMap.set(beatIndex, segment)
  })

  const beatCoverage = new Map<number, number[]>()
  shotPlan.forEach((shot) => {
    if (typeof shot.beatIndex === 'number') {
      const list = beatCoverage.get(shot.beatIndex) || []
      list.push(shot.clipIndex)
      beatCoverage.set(shot.beatIndex, list)
    }
  })

  beatMap.forEach((segment, beatIndex) => {
    const covered = beatCoverage.get(beatIndex) || []
    if (covered.length === 0) {
      const candidate = shotPlan.find(
        (shot) => shot.actIndex === segment.actIndex && typeof shot.beatIndex !== 'number'
      )
      if (candidate) {
        addFix(report, {
          id: `beat_coverage_assign_${beatIndex}`,
          description: 'Assigned uncovered beat to a shot in the same act.',
          before: { beatIndex: candidate.beatIndex },
          after: { beatIndex },
        })
        candidate.beatIndex = beatIndex
        beatCoverage.set(beatIndex, [candidate.clipIndex])
      }
    }

    const updatedCoverage = beatCoverage.get(beatIndex) || []
    segment.coveredByClipIndices = updatedCoverage
    addCheck(report, {
      id: `beat_coverage_${beatIndex}`,
      category: 'scenes',
      severity: 'warn',
      passed: updatedCoverage.length > 0,
      message: 'Narration beat should be covered by at least one shot.',
      details: { beatIndex, clipIndices: updatedCoverage, actIndex: segment.actIndex },
    })
  })

  // SCENE / SHOT PLAN CHECKS
  const expectedCounts: Record<string, number> = {
    vast: 2,
    living_dot: 3,
    miracle_of_you: 3,
    return: 2,
  }

  structure.acts.forEach((act, index) => {
    const count = shotPlan.filter((shot) => shot.actIndex === index).length
    const expected = expectedCounts[act.actType] || 2
    addCheck(report, {
      id: `scene_count_${act.actType}`,
      category: 'scenes',
      severity: 'warn',
      passed: count === expected,
      message: 'Act should have expected number of clips.',
      details: { actType: act.actType, expected, count },
    })
  })

  // VAST motif coverage checks
  const vastShots = shotPlan.filter((shot) => shot.actIndex === 0)
  const hasVastCosmic = vastShots.some(
    (shot) =>
      shot.motif === 'earth_from_space' ||
      shot.motif === 'starfield' ||
      shot.setting === 'space' ||
      shot.scaleType === 'cosmic'
  )
  if (!hasVastCosmic && vastShots[0]) {
    addFix(report, {
      id: 'vast_cosmic_motif',
      description: 'Injected cosmic motif into VAST act.',
      before: { motif: vastShots[0].motif, setting: vastShots[0].setting },
      after: { motif: 'earth_from_space', setting: 'space' },
    })
    vastShots[0].motif = 'earth_from_space'
    vastShots[0].setting = 'space'
    vastShots[0].scaleType = 'cosmic'
    vastShots[0].visualCue = 'Earth from space with a thin atmospheric line'
    vastShots[0].runwayPrompt = `${vastShots[0].runwayPrompt}, earth from space, thin atmosphere`
  }

  addCheck(report, {
    id: 'vast_cosmic_presence',
    category: 'scenes',
    severity: 'warn',
    passed: hasVastCosmic || vastShots.length === 0,
    message: 'VAST should include a cosmic motif.',
    details: { shotCount: vastShots.length },
  })

  const miracleShots = shotPlan.filter((shot) => shot.actIndex === 2)
  const hasEmbodiment = miracleShots.some(
    (shot) => shot.scaleType === 'personal' || shot.shotType === 'macro' || shot.setting === 'interior'
  )
  if (!hasEmbodiment && miracleShots[0]) {
    addFix(report, {
      id: 'miracle_embodiment_motif',
      description: 'Injected embodiment motif into MIRACLE_OF_YOU act.',
      before: { setting: miracleShots[0].setting, shotType: miracleShots[0].shotType },
      after: { setting: 'interior', shotType: 'macro' },
    })
    miracleShots[0].setting = 'interior'
    miracleShots[0].shotType = 'macro'
    miracleShots[0].scaleType = 'personal'
    miracleShots[0].visualCue = 'Steam rising from a warm cup in soft morning light'
    if (miracleShots[0].runwayPrompt) {
      miracleShots[0].runwayPrompt = `${miracleShots[0].runwayPrompt}, macro close-up, steady`
    }
  }

  addCheck(report, {
    id: 'miracle_embodiment_presence',
    category: 'scenes',
    severity: 'warn',
    passed: hasEmbodiment || miracleShots.length === 0,
    message: 'MIRACLE_OF_YOU should include embodiment cues.',
    details: { shotCount: miracleShots.length },
  })

  const returnShots = shotPlan.filter((shot) => shot.actIndex === 3)
  const hasReturnMotif = returnShots.some(
    (shot) =>
      shot.motif === 'quiet_return' ||
      shot.motif === 'shared_continuance'
  )
  if (!hasReturnMotif && returnShots[0]) {
    addFix(report, {
      id: 'return_motif',
      description: 'Injected return motif into RETURN act.',
      before: { motif: returnShots[0].motif },
      after: { motif: 'quiet_return' },
    })
    returnShots[0].motif = 'quiet_return'
  }

  const hasReturnSpace = returnShots.some((shot) => shot.setting === 'space')
  if (hasReturnSpace && returnShots[0]) {
    addFix(report, {
      id: 'return_no_space',
      description: 'Removed space setting from RETURN act.',
      before: { setting: returnShots[0].setting },
      after: { setting: 'urban' },
    })
    returnShots[0].setting = 'urban'
  }

  const promptCounts = new Map<string, number>()
  shotPlan.forEach((shot, index) => {
    if (shot.source !== 'GEN') {
      return
    }

    if (!shot.microAction) {
      addFix(report, {
        id: `shot_micro_action_${index}`,
        description: 'Added default micro-action.',
        before: shot.microAction,
        after: 'subtle shift of posture',
      })
      shot.microAction = 'subtle shift of posture'
    }

    const normalizedDuration = normalizeDuration(shot.duration)
    if (normalizedDuration !== shot.duration) {
      addFix(report, {
        id: `shot_duration_${index}`,
        description: 'Normalized shot duration to allowed values.',
        before: shot.duration,
        after: normalizedDuration,
      })
      shot.duration = normalizedDuration
    }

    if (!shot.runwayPrompt) {
      addFix(report, {
        id: `shot_prompt_missing_${index}`,
        description: 'Added missing runway prompt for GEN shot.',
        before: shot.runwayPrompt,
        after: `observational scene, ${shot.description}`,
      })
      shot.runwayPrompt = `observational scene, ${shot.description}`
    }

    const promptKey = shot.runwayPrompt.trim()
    const seen = promptCounts.get(promptKey) || 0
    if (seen > 0) {
      const timeOfDay = TIME_OF_DAY_OPTIONS[(index + seen) % TIME_OF_DAY_OPTIONS.length]
      const setting = SETTING_OPTIONS[(index + seen) % SETTING_OPTIONS.length]
      const updatedPrompt = `${shot.runwayPrompt}, ${timeOfDay} light, ${setting} setting, ${shot.microAction}`
      addFix(report, {
        id: `shot_prompt_dedupe_${index}`,
        description: 'Adjusted duplicate prompt to be unique.',
        before: shot.runwayPrompt,
        after: updatedPrompt,
      })
      shot.runwayPrompt = updatedPrompt
    }
    promptCounts.set(promptKey, seen + 1)
  })

  const genShotCount = shotPlan.filter((shot) => shot.source === 'GEN').length
  addCheck(report, {
    id: 'shot_prompt_uniqueness',
    category: 'scenes',
    severity: 'warn',
    passed: promptCounts.size === genShotCount,
    message: 'GEN shot prompts should be unique.',
    details: { uniqueCount: promptCounts.size, total: genShotCount },
  })

  // Novelty vs last N videos
  let noveltyPassed = true
  if (input.lastNFingerprints && input.lastNFingerprints.length > 0) {
    const currentMotifs = new Set<string>()
    shotPlan.forEach((shot) => {
      const m = (shot.description || '').trim().slice(0, 80)
      if (m) currentMotifs.add(m)
      const p = (shot.runwayPrompt || '').trim().slice(0, 60)
      if (p) currentMotifs.add(p)
    })
    const allPrevious = new Set<string>()
    input.lastNFingerprints.forEach((fp) => {
      fp.motifs.forEach((m) => allPrevious.add(m))
      fp.actTypes.forEach((a) => allPrevious.add(a))
      fp.settings.forEach((s) => allPrevious.add(s))
    })
    const currentArr = Array.from(currentMotifs)
    const newCount = currentArr.filter((m) => !allPrevious.has(m)).length
    const noveltyScore = currentArr.length > 0 ? newCount / currentArr.length : 1
    noveltyPassed = noveltyScore >= NOVELTY_THRESHOLD
    addCheck(report, {
      id: 'novelty_vs_last_n',
      category: 'scenes',
      severity: 'error',
      passed: noveltyPassed,
      message: `Novelty vs last N videos: ${(noveltyScore * 100).toFixed(0)}% new (threshold ${NOVELTY_THRESHOLD * 100}%).`,
      details: { noveltyScore, threshold: NOVELTY_THRESHOLD },
    })
  }

  // Shot diversity: no more than MAX_CONSECUTIVE_SAME consecutive same actType or same setting
  let diversityConsecutivePassed = true
  let runAct = 1
  let runSetting = 1
  for (let i = 1; i < shotPlan.length; i++) {
    const prev = shotPlan[i - 1]
    const curr = shotPlan[i]
    runAct = prev.actType === curr.actType ? runAct + 1 : 1
    runSetting = prev.setting === curr.setting ? runSetting + 1 : 1
    if (runAct > MAX_CONSECUTIVE_SAME || runSetting > MAX_CONSECUTIVE_SAME) {
      diversityConsecutivePassed = false
      break
    }
  }
  addCheck(report, {
    id: 'diversity_no_repeat_consecutive',
    category: 'scenes',
    severity: 'error',
    passed: diversityConsecutivePassed,
    message: `No more than ${MAX_CONSECUTIVE_SAME} consecutive shots with same actType or same setting.`,
  })

  const distinctMotifs = new Set(shotPlan.map((s) => s.motif ?? s.description ?? '').filter(Boolean))
  const diversityMotifsPassed = distinctMotifs.size >= MIN_DISTINCT_MOTIFS
  addCheck(report, {
    id: 'diversity_distinct_motifs',
    category: 'scenes',
    severity: 'error',
    passed: diversityMotifsPassed,
    message: `At least ${MIN_DISTINCT_MOTIFS} distinct motifs in shot plan.`,
    details: { distinctMotifs: distinctMotifs.size },
  })

  // MASTER TIMELINE CHECKS (when present)
  let timelinePassed = true
  if (input.masterTimeline) {
    const timeline = input.masterTimeline
    const beats = timeline.beats as TimelineBeat[]

    const allowedDurationsList = getAllowedDurations()
    const avgDuration = beats.length > 0 ? beats.reduce((s, b) => s + b.durationSec, 0) / beats.length : 0
    const avgDurationOk = avgDuration >= 6 && beats.every((b) => allowedDurationsList.includes(b.durationSec))
    addCheck(report, {
      id: 'timeline_beat_duration',
      category: 'structure',
      severity: 'error',
      passed: avgDurationOk,
      message: 'Timeline: beat durations must be 6 or 8s only; average >= 6.',
      details: { avgDuration, beatCount: beats.length },
    })
    if (!avgDurationOk) timelinePassed = false

    const breathingCount = beats.filter((b) => b.beatType === 'breathing').length
    const breathingOk = breathingCount >= MIN_BREATHING_BEATS
    addCheck(report, {
      id: 'timeline_breathing_beats',
      category: 'structure',
      severity: 'error',
      passed: breathingOk,
      message: `Timeline: at least ${MIN_BREATHING_BEATS} breathing beat(s) required (0 allowed for per-shot narration).`,
      details: { breathingCount },
    })
    if (!breathingOk) timelinePassed = false

    let consecutiveShort = 0
    let maxConsecutiveShort = 0
    for (const b of beats) {
      if (b.durationSec < 8) {
        consecutiveShort++
        maxConsecutiveShort = Math.max(maxConsecutiveShort, consecutiveShort)
      } else {
        consecutiveShort = 0
      }
    }
    const noRapidCutsOk = maxConsecutiveShort <= 2
    addCheck(report, {
      id: 'timeline_no_rapid_cuts',
      category: 'structure',
      severity: 'warn',
      passed: noRapidCutsOk,
      message: 'Timeline: no more than 2 consecutive beats with duration < 8s.',
      details: { maxConsecutiveShort },
    })
    if (!noRapidCutsOk) timelinePassed = false

    const actIndices = new Set(beats.map((b) => b.actIndex))
    let continuityOk = true
    for (const actIdx of actIndices) {
      const actBeats = beats.filter((b) => b.actIndex === actIdx)
      if (actBeats.length <= 1) continue
      const motions = new Set(actBeats.map((b) => b.cameraGrammar?.motion).filter(Boolean))
      const timeOfDays = new Set(actBeats.map((b) => b.lighting?.timeOfDay).filter(Boolean))
      if (motions.size > 1 || timeOfDays.size > 1) continuityOk = false
    }
    addCheck(report, {
      id: 'timeline_camera_lighting_continuity',
      category: 'structure',
      severity: 'warn',
      passed: continuityOk,
      message: 'Timeline: within each act, use a single camera motion and a single lighting/timeOfDay.',
    })
    if (!continuityOk) timelinePassed = false

    // Timeline-narration alignment: each narrated beat should have non-empty narrationText
    const narratedBeats = beats.filter((b) => b.beatType === 'narrated')
    const misaligned = narratedBeats.filter((b) => !b.narrationText || b.narrationText.trim().length === 0)
    const alignmentOk = misaligned.length === 0
    addCheck(report, {
      id: 'timeline_narration_alignment',
      category: 'narration',
      severity: 'warn',
      passed: alignmentOk,
      message: 'Timeline: each narrated beat must have non-empty narrationText.',
      details: { narratedCount: narratedBeats.length, misalignedCount: misaligned.length },
    })
  }

  const hardFailed =
    !noveltyPassed ||
    !diversityConsecutivePassed ||
    !diversityMotifsPassed ||
    (input.masterTimeline != null && !timelinePassed)
  const passed = !hardFailed

  finalizeReport(report)
  return { report, structure, narration, shotPlan, passed }
}

export function runQualityControlPostGen(input: PostGenQCInput): PostGenQCResult {
  const report = createReport('post_gen')
  const allowedDurations = getAllowedDurations()

  // RUNWAY CHECKS
  const expectedTotalScenes = input.structure.acts.reduce((sum, act) => {
    if (act.actType === 'living_dot') return sum + 3
    if (act.actType === 'miracle_of_you') return sum + 3
    return sum + 2
  }, 0)

  addCheck(report, {
    id: 'runway_scene_count',
    category: 'runway',
    severity: 'warn',
    passed: input.scenes.length === expectedTotalScenes,
    message: 'Scene count should match expected shot plan size.',
    details: { expected: expectedTotalScenes, actual: input.scenes.length },
  })

  input.scenes.forEach((scene, index) => {
    addCheck(report, {
      id: `runway_url_${index}`,
      category: 'runway',
      severity: 'warn',
      passed: Boolean(scene.runwayVideoUrl),
      message: 'Scene should have a Runway video URL.',
      details: { status: scene.status, runwayJobId: scene.runwayJobId },
    })

    addCheck(report, {
      id: `runway_duration_${index}`,
      category: 'runway',
      severity: 'warn',
      passed: allowedDurations.includes(scene.duration),
      message: 'Scene duration should match Veo allowed durations (6 or 8 seconds).',
      details: { duration: scene.duration, allowedDurations },
    })
  })

  // ASSEMBLY CHECKS
  const sceneDurationTotal = input.scenes.reduce((sum, scene) => sum + (scene.duration || 0), 0)
  const expectedTotal = input.structure.totalDuration
  addCheck(report, {
    id: 'assembly_total_duration',
    category: 'assembly',
    severity: 'warn',
    passed: Math.abs(sceneDurationTotal - expectedTotal) <= 5,
    message: 'Total scene duration should align with documentary structure.',
    details: { sceneDurationTotal, expectedTotal },
  })

  // Narration timing alignment
  const actWindows: Array<{ start: number; end: number }> = []
  let cursor = 0
  input.structure.acts.forEach((act) => {
    actWindows.push({ start: cursor, end: cursor + act.duration })
    cursor += act.duration
  })

  input.narrationSegments.forEach((segment, index) => {
    const actIndex = segment.actIndex ?? 0
    const window = actWindows[actIndex]
    const startTime = segment.startTime ?? 0
    const inRange = window ? startTime >= window.start && startTime <= window.end : false
    addCheck(report, {
      id: `assembly_narration_window_${index}`,
      category: 'assembly',
      severity: 'warn',
      passed: inRange,
      message: 'Narration segment should align with its act window.',
      details: { actIndex, startTime, window },
    })
  })

  finalizeReport(report)
  return { report }
}
