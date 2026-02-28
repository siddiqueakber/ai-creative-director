import type { MasterTimelineData, TimelineBeat } from './types'
import {
  TOTAL_DURATION_SEC,
  ALLOWED_DURATIONS,
  MIN_BEATS,
  MAX_BEATS,
  MIN_BREATHING_BEATS,
} from './timeline-durations'

export interface TimelineValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validates a master timeline: ordering, no gaps/overlaps, total duration,
 * each duration in {6, 8}, 12–18 beats (for 120s). MIN_BREATHING_BEATS may be 0 for per-shot narration.
 * When maxActIndex is provided (e.g. documentaryStructure.acts.length - 1), each beat's actIndex must be in [0, maxActIndex].
 */
export function validateMasterTimeline(
  data: MasterTimelineData,
  maxActIndex?: number
): TimelineValidationResult {
  const errors: string[] = []

  if (data.totalDurationSec !== TOTAL_DURATION_SEC) {
    errors.push(`totalDurationSec must be ${TOTAL_DURATION_SEC}, got ${data.totalDurationSec}`)
  }

  const beats = data.beats
  if (!Array.isArray(beats)) {
    errors.push('beats must be an array')
    return { valid: false, errors }
  }

  if (beats.length < MIN_BEATS || beats.length > MAX_BEATS) {
    errors.push(`beats count must be between ${MIN_BEATS} and ${MAX_BEATS}, got ${beats.length}`)
  }

  const breathingCount = beats.filter((b: TimelineBeat) => b.beatType === 'breathing').length
  if (breathingCount < MIN_BREATHING_BEATS) {
    errors.push(`at least ${MIN_BREATHING_BEATS} breathing beats required, got ${breathingCount}`)
  }

  let sumDuration = 0
  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i] as TimelineBeat
    if (!beat || typeof beat.durationSec !== 'number') {
      errors.push(`beat ${i}: missing or invalid durationSec`)
      continue
    }
    if (!(ALLOWED_DURATIONS as readonly number[]).includes(beat.durationSec)) {
      errors.push(`beat ${i}: durationSec must be 6 or 8, got ${beat.durationSec}`)
    }
    if (typeof maxActIndex === 'number' && (beat.actIndex < 0 || beat.actIndex > maxActIndex)) {
      errors.push(`beat ${i}: actIndex must be in [0, ${maxActIndex}], got ${beat.actIndex}`)
    }
    sumDuration += beat.durationSec

    const expectedStart = i === 0 ? 0 : (beats[i - 1] as TimelineBeat).endSec
    const expectedEnd = expectedStart + beat.durationSec
    if (typeof beat.startSec === 'number' && Math.abs(beat.startSec - expectedStart) > 0.01) {
      errors.push(`beat ${i}: startSec should be ${expectedStart}, got ${beat.startSec}`)
    }
    if (typeof beat.endSec === 'number' && Math.abs(beat.endSec - expectedEnd) > 0.01) {
      errors.push(`beat ${i}: endSec should be ${expectedEnd}, got ${beat.endSec}`)
    }
  }

  if (Math.abs(sumDuration - TOTAL_DURATION_SEC) > 0.01) {
    errors.push(`sum of beat durations is ${sumDuration}, must equal ${TOTAL_DURATION_SEC}`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
