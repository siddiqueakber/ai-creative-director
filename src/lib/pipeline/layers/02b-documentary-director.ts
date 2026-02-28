import type {
  DeepUnderstandingResult,
  PerspectivePostureResult,
  DocumentaryStructure,
  DocumentaryAct,
  EmotionalPhase,
  ActPacingSpeed,
  NarrationPresence,
  NarrationStyle,
  DocumentaryActType,
  ScaleType,
  ZoomPath,
  ZoomLevel,
} from '../types'

// ============================================
// DOCUMENTARY ACT REQUIREMENTS
// ============================================

interface ActRequirements {
  requiredElements: string[]
  cameraBehavior: string
  durationRange: [number, number]
  openingSilence?: [number, number]
  clipCount?: [number, number]
}

const ORBIT_ACT_RULES: Record<DocumentaryActType, ActRequirements> = {
  vast: {
    requiredElements: [
      'starfield slowly rotating',
      'earth from space',
      'cosmic vastness',
      'galaxies',
      'universe scale'
    ],
    cameraBehavior: 'static or extremely slow drift',
    durationRange: [10, 18],
    openingSilence: [3, 5],
    clipCount: [2, 3],
  },
  living_dot: {
    requiredElements: [
      'earth biosphere from orbit',
      'ecosystems',
      'animals in nature',
      'forests breathing',
      'life continuity',
      'evolutionary persistence'
    ],
    cameraBehavior: 'slow observational',
    durationRange: [12, 20],
    clipCount: [3, 4],
  },
  miracle_of_you: {
    requiredElements: [
      'warmth and texture',
      'quiet domestic detail',
      'morning light on surfaces',
      'steam or condensation',
      'natural elements close-up',
      'sensory stillness',
      'intimate everyday presence'
    ],
    cameraBehavior: 'intimate close-up of objects and textures, stabilized',
    durationRange: [12, 22],
    clipCount: [3, 4],
  },
  return: {
    requiredElements: [
      'ordinary street scene',
      'people walking',
      'daily routine resuming',
      'morning light',
      'life continuing',
      'normalcy'
    ],
    cameraBehavior: 'observational, grounded',
    durationRange: [8, 15],
    clipCount: [2, 3],
  },
}

// ============================================
// SCALE TYPE MAPPING
// ============================================

const ORBIT_SCALE_TYPES: Record<DocumentaryActType, ScaleType> = {
  vast: 'cosmic',
  living_dot: 'global',
  miracle_of_you: 'personal',
  return: 'human',
}

// ============================================
// INTENSITY-AWARE NARRATION STYLE
// ============================================

function determineNarrationStyle(intensity: number): NarrationStyle {
  if (intensity >= 8) return 'minimal'
  if (intensity >= 4) return 'moderate'
  return 'sparse'
}

function getNarrationConstraints(style: NarrationStyle) {
  switch (style) {
    case 'minimal':
      return {
        maxWords: 30,
        pauseDuration: [3, 5],
        segmentCount: [2, 3],
      }
    case 'moderate':
      return {
        maxWords: 50,
        pauseDuration: [2, 3],
        segmentCount: [3, 4],
      }
    case 'sparse':
      return {
        maxWords: 70,
        pauseDuration: [1, 2],
        segmentCount: [4, 5],
      }
  }
}

function calculateSilence(actType: DocumentaryActType, intensity: number): number {
  switch (actType) {
    case 'vast':
      return intensity >= 8 ? 5 : intensity >= 5 ? 4 : 3
    case 'living_dot':
      return intensity >= 7 ? 2 : 1
    case 'miracle_of_you':
      return intensity >= 8 ? 1 : 0.5
    case 'return':
      return intensity >= 6 ? 3 : 2
  }
}

// ============================================
// NARRATION TIMING DISTRIBUTION
// ============================================

function distributeOrbitNarration(
  acts: DocumentaryAct[],
  totalSegments: number,
  reinforceActs: string[]
): DocumentaryAct[] {
  // Orbit-specific narration distribution
  // VAST: Minimal (0-1 segment), starts after silence
  // LIVING_DOT: Moderate (1-2 segments), observational
  // MIRACLE_OF_YOU: Concentrated (2-3 segments), descriptive
  // RETURN: Minimal (0-1 segment), normalizing tone

  const distribution: Record<DocumentaryActType, number> = {
    vast: reinforceActs.includes('vast') ? 1 : 0,
    living_dot: reinforceActs.includes('earth') ? 2 : 1,
    miracle_of_you: reinforceActs.includes('embryology') ? 3 : 2,
    return: reinforceActs.includes('return') ? 1 : 0,
  }

  // Ensure we hit totalSegments
  const currentTotal = Object.values(distribution).reduce((a, b) => a + b, 0)
  if (currentTotal < totalSegments) {
    // Add to primary reinforced act (first in reinforceActs or default to miracle_of_you)
    const primaryAct = reinforceActs[0] === 'vast' ? 'vast' 
      : reinforceActs[0] === 'earth' ? 'living_dot'
      : reinforceActs[0] === 'embryology' ? 'miracle_of_you'
      : reinforceActs[0] === 'return' ? 'return'
      : 'miracle_of_you'
    distribution[primaryAct] += totalSegments - currentTotal
  }

  let currentTime = 0

  return acts.map((act) => {
    const segmentsForAct = distribution[act.actType] || 0
    const narrationTiming = []

    if (segmentsForAct > 0) {
      const actDuration = act.duration
      const silenceDuration = act.silenceDuration

      // Distribute narration evenly within the act
      for (let i = 0; i < segmentsForAct; i++) {
        const startTime =
          currentTime +
          silenceDuration +
          (actDuration - silenceDuration) * (i / segmentsForAct)
        const allowedDuration =
          (actDuration - silenceDuration) / segmentsForAct - 2 // Leave 2s for pauses

        narrationTiming.push({
          startTime: Math.floor(startTime),
          allowedDuration: Math.floor(allowedDuration),
        })
      }
    }

    currentTime += act.duration
    return { ...act, narrationTiming }
  })
}

// ============================================
// ZOOM PATH → DOCUMENTARY STRUCTURE
// ============================================

const RETURN_TO_SELF = 'return to self'

/** Pacing by zoom level (spec): use 6/8 sec beats, allocate more beats for longer levels. Total 120s. */
const ZOOM_LEVEL_DURATION: Record<ZoomLevel, number> = {
  self: 8,
  social: 16,
  biological: 16,
  planetary: 24,
  cosmic: 24,
  return: 16,
}

/** Map zoom step label to ZoomLevel for grouping. */
function stepToZoomLevel(step: string): ZoomLevel {
  const s = step.toLowerCase().trim()
  if (s.includes('return') && (s.includes('self') || s.includes('to'))) return 'return'
  if (/^(self|room|desk|face|daily|routine|intimate|personal)$/.test(s) || s.includes('self')) return 'self'
  if (/^(street|crowd|city|economic|civilization|industrial|society|human lifespan|systems)$/.test(s) || s.includes('civilization') || s.includes('economic')) return 'social'
  if (/^(body|biological|evolution|animal|forest|ecosystem|species|life)$/.test(s) || s.includes('evolution') || s.includes('biological')) return 'biological'
  if (/^(earth|planet|planetary)$/.test(s) || s.includes('planetary') || s.includes('earth')) return 'planetary'
  if (/^(solar|galaxy|cosmic|star|universe)$/.test(s) || s.includes('cosmic') || s.includes('galaxy')) return 'cosmic'
  return 'self'
}

/** ZoomLevel → DocumentaryActType for backward compatibility. */
function zoomLevelToActType(level: ZoomLevel): DocumentaryActType {
  switch (level) {
    case 'self': return 'miracle_of_you'
    case 'social':
    case 'biological': return 'living_dot'
    case 'planetary':
    case 'cosmic': return 'vast'
    case 'return': return 'return'
  }
}

/** Visual requirements by zoom level (for shot planning). */
const ZOOM_LEVEL_VISUALS: Record<ZoomLevel, string[]> = {
  self: ['room', 'face', 'desk', 'quiet domestic detail', 'morning light on surfaces'],
  social: ['streets', 'crowds', 'city lights', 'human labor', 'daily routine'],
  biological: ['forests', 'animals', 'ecosystems', 'life continuity', 'evolutionary persistence'],
  planetary: ['earth from orbit', 'earth biosphere', 'planet view'],
  cosmic: ['starfield', 'galaxies', 'cosmic vastness', 'universe scale'],
  return: ['ordinary street scene', 'people walking', 'daily routine resuming', 'life continuing', 'normalcy'],
}

/** Choreography by zoom level. */
const ZOOM_LEVEL_CHOREO: Record<ZoomLevel, { emotionalPhase: EmotionalPhase; pacingSpeed: ActPacingSpeed; cameraBias: string; narrationPresence: NarrationPresence; shotLengthRange: [number, number] }> = {
  self: { emotionalPhase: 'reflection', pacingSpeed: 'slow', cameraBias: 'intimate', narrationPresence: 'sparse', shotLengthRange: [6, 8] },
  social: { emotionalPhase: 'human_reality', pacingSpeed: 'medium', cameraBias: 'slow_drift', narrationPresence: 'active', shotLengthRange: [8, 10] },
  biological: { emotionalPhase: 'human_reality', pacingSpeed: 'medium', cameraBias: 'slow_drift', narrationPresence: 'active', shotLengthRange: [8, 10] },
  planetary: { emotionalPhase: 'awe', pacingSpeed: 'slow', cameraBias: 'slow_drift', narrationPresence: 'minimal', shotLengthRange: [10, 12] },
  cosmic: { emotionalPhase: 'awe', pacingSpeed: 'slow', cameraBias: 'slow_drift', narrationPresence: 'minimal', shotLengthRange: [12, 14] },
  return: { emotionalPhase: 'return', pacingSpeed: 'quiet_close', cameraBias: 'stable', narrationPresence: 'sparse', shotLengthRange: [8, 10] },
}

export function buildDocumentaryStructureFromZoomPath(
  zoomPath: ZoomPath,
  understanding: DeepUnderstandingResult,
  perspective: PerspectivePostureResult,
  intensity: number
): DocumentaryStructure {
  const narrationStyle = determineNarrationStyle(intensity)
  const constraints = getNarrationConstraints(narrationStyle)
  const totalDuration = 120

  if (zoomPath.length === 0) {
    return generateDocumentaryStructure(understanding, perspective, intensity)
  }

  // Group consecutive steps by ZoomLevel
  const groups: { level: ZoomLevel; steps: string[] }[] = []
  for (const step of zoomPath) {
    const level = stepToZoomLevel(step)
    if (groups.length > 0 && groups[groups.length - 1].level === level) {
      groups[groups.length - 1].steps.push(step)
    } else {
      groups.push({ level, steps: [step] })
    }
  }

  // Ensure last group is return
  if (groups.length > 0 && groups[groups.length - 1].level !== 'return') {
    groups.push({ level: 'return', steps: [RETURN_TO_SELF] })
  }

  // Allocate duration across groups (proportional to ZOOM_LEVEL_DURATION, sum = 120)
  const levelDurations = { ...ZOOM_LEVEL_DURATION }
  let sum = groups.reduce((s, g) => s + levelDurations[g.level], 0)
  const scale = totalDuration / sum
  const rawDurations = groups.map((g) => Math.round(levelDurations[g.level] * scale))
  sum = rawDurations.reduce((a, b) => a + b, 0)
  const durations = rawDurations.slice()
  if (sum !== totalDuration && durations.length > 0) {
    durations[durations.length - 1] += totalDuration - sum
  }

  const acts: DocumentaryAct[] = groups.map((group, i) => {
    const duration = Math.max(6, Math.min(40, durations[i] ?? 8))
    const actType = zoomLevelToActType(group.level)
    const scaleType = ORBIT_SCALE_TYPES[actType]
    const choreo = ZOOM_LEVEL_CHOREO[group.level]
    const silenceDuration = calculateSilence(actType, intensity)

    return {
      actType,
      duration,
      scaleType,
      visualRequirements: ZOOM_LEVEL_VISUALS[group.level],
      narrationTiming: [],
      silenceDuration,
      emotionalPhase: choreo.emotionalPhase,
      pacingSpeed: choreo.pacingSpeed,
      cameraBias: choreo.cameraBias,
      narrationPresence: choreo.narrationPresence,
      shotLengthRange: choreo.shotLengthRange,
      zoomLevel: group.level,
      zoomStepLabel: group.steps[0],
    }
  })

  const withNarration = distributeOrbitNarration(acts, constraints.segmentCount[1], perspective.reinforceActs)

  return {
    acts: withNarration,
    totalDuration,
    intensityLevel: intensity,
    narrationStyle,
  }
}

// ============================================
// ORBIT STRUCTURE GENERATION (DETERMINISTIC) — fallback when no zoom path
// ============================================

export function generateDocumentaryStructure(
  understanding: DeepUnderstandingResult,
  perspective: PerspectivePostureResult,
  intensity: number
): DocumentaryStructure {
  const narrationStyle = determineNarrationStyle(intensity)
  const constraints = getNarrationConstraints(narrationStyle)

  // Extract act weights from understanding (Orbit Intent)
  const weights = understanding.orbitIntent.actWeights

  // Fixed total duration for Orbit (extended to 120s)
  const totalDuration = 120

  // Calculate durations deterministically from actWeights
  const durations = {
    vast: Math.round(totalDuration * weights.vast),
    living_dot: Math.round(totalDuration * weights.earth),
    miracle_of_you: Math.round(totalDuration * weights.embryology),
    return: Math.round(totalDuration * weights.return),
  }

  // Enforce minimum durations (kept modest; actWeights drive most of the scaling)
  const minDurations = { vast: 8, living_dot: 10, miracle_of_you: 10, return: 6 }
  for (const act in durations) {
    durations[act as DocumentaryActType] = Math.max(
      durations[act as DocumentaryActType],
      minDurations[act as DocumentaryActType]
    )
  }

  // Adjust total to exactly totalDuration if rounding caused drift
  const actualTotal = Object.values(durations).reduce((a, b) => a + b, 0)
  if (actualTotal !== totalDuration) {
    // Adjust largest act
    const largest = (Object.keys(durations) as DocumentaryActType[]).reduce((a, b) =>
      durations[a] > durations[b] ? a : b
    )
    durations[largest] += totalDuration - actualTotal
  }

  // Build Orbit acts array in fixed order
  const actTypes: DocumentaryActType[] = ['vast', 'living_dot', 'miracle_of_you', 'return']

  // Act-level choreography for timeline (emotional phase, pacing, camera, narration presence).
  const actChoreography: Record<DocumentaryActType, { emotionalPhase: EmotionalPhase; pacingSpeed: ActPacingSpeed; cameraBias: string; narrationPresence: NarrationPresence; shotLengthRange: [number, number] }> = {
    vast: { emotionalPhase: 'awe', pacingSpeed: 'slow', cameraBias: 'slow_drift', narrationPresence: 'minimal', shotLengthRange: [10, 14] },
    living_dot: { emotionalPhase: 'human_reality', pacingSpeed: 'medium', cameraBias: 'slow_drift', narrationPresence: 'active', shotLengthRange: [7, 10] },
    miracle_of_you: { emotionalPhase: 'reflection', pacingSpeed: 'slow', cameraBias: 'intimate', narrationPresence: 'sparse', shotLengthRange: [8, 12] },
    return: { emotionalPhase: 'return', pacingSpeed: 'quiet_close', cameraBias: 'stable', narrationPresence: 'sparse', shotLengthRange: [7, 10] },
  }

  let acts: DocumentaryAct[] = actTypes.map((actType) => {
    const rules = ORBIT_ACT_RULES[actType]
    const duration = durations[actType]
    const silenceDuration = calculateSilence(actType, intensity)
    const choreo = actChoreography[actType]

    return {
      actType,
      duration,
      scaleType: ORBIT_SCALE_TYPES[actType],
      visualRequirements: rules.requiredElements,
      narrationTiming: [],
      silenceDuration,
      emotionalPhase: choreo.emotionalPhase,
      pacingSpeed: choreo.pacingSpeed,
      cameraBias: choreo.cameraBias,
      narrationPresence: choreo.narrationPresence,
      shotLengthRange: choreo.shotLengthRange,
    }
  })

  // Distribute narration timing across acts using Orbit distribution
  acts = distributeOrbitNarration(acts, constraints.segmentCount[1], perspective.reinforceActs)

  return {
    acts,
    totalDuration,
    intensityLevel: intensity,
    narrationStyle,
  }
}

