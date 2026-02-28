import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { validateMasterTimeline } from '../master-timeline-validator'
import type { MasterTimelineData, TimelineBeat } from '../types'

function makeBeat(
  beatIndex: number,
  startSec: number,
  durationSec: number,
  beatType: 'narrated' | 'breathing' | 'transition' = 'narrated'
): TimelineBeat {
  return {
    beatIndex,
    actIndex: 0,
    startSec,
    endSec: startSec + durationSec,
    durationSec,
    beatType,
    visualCategory: 'earth',
    cameraGrammar: { motion: 'slow_drift', framing: 'wide', lens: 'normal' },
    lighting: { timeOfDay: 'day', contrast: 'low' },
    transitionOut: 'cut',
    veoPrompt: 'A test shot.',
  }
}

describe('validateMasterTimeline', () => {
  it('passes for valid 120s timeline with 15 beats (4 breathing)', () => {
    const beats: TimelineBeat[] = []
    let t = 0
    for (let i = 0; i < 15; i++) {
      const dur = 8
      const isBreathing = i === 2 || i === 5 || i === 9 || i === 12
      beats.push(makeBeat(i, t, dur, isBreathing ? 'breathing' : 'narrated'))
      t += dur
    }
    const data: MasterTimelineData = { totalDurationSec: 120, beats }
    const result = validateMasterTimeline(data)
    assert.equal(result.valid, true)
    assert.equal(result.errors.length, 0)
  })

  it('fails when totalDurationSec is not 120', () => {
    const beats = [
      makeBeat(0, 0, 6),
      makeBeat(1, 6, 6),
      makeBeat(2, 12, 6),
      makeBeat(3, 18, 6),
      makeBeat(4, 24, 6),
      makeBeat(5, 30, 6),
      makeBeat(6, 36, 6),
      makeBeat(7, 42, 6),
      makeBeat(8, 48, 6),
      makeBeat(9, 54, 6),
    ]
    const data: MasterTimelineData = { totalDurationSec: 30, beats }
    const result = validateMasterTimeline(data)
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((e) => e.includes('totalDurationSec')))
  })

  it('fails when beat count is less than minimum', () => {
    const beats = [
      makeBeat(0, 0, 8),
      makeBeat(1, 8, 8),
      makeBeat(2, 16, 8),
      makeBeat(3, 24, 8),
      makeBeat(4, 32, 8),
      makeBeat(5, 40, 20),
    ]
    const data: MasterTimelineData = { totalDurationSec: 120, beats }
    const result = validateMasterTimeline(data)
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((e) => e.includes('beats count') || e.includes('duration')))
  })

  it('fails when 0 breathing beats (MIN_BREATHING_BEATS=4)', () => {
    const beats: TimelineBeat[] = []
    let t = 0
    for (let i = 0; i < 15; i++) {
      const dur = 8
      beats.push(makeBeat(i, t, dur, 'narrated'))
      t += dur
    }
    const data: MasterTimelineData = { totalDurationSec: 120, beats }
    const result = validateMasterTimeline(data)
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((e) => e.includes('breathing')))
  })

  it('fails when only 1 breathing beat (MIN_BREATHING_BEATS=4)', () => {
    const beats: TimelineBeat[] = []
    let t = 0
    for (let i = 0; i < 15; i++) {
      const dur = 8
      const isBreathing = i === 7
      beats.push(makeBeat(i, t, dur, isBreathing ? 'breathing' : 'narrated'))
      t += dur
    }
    const data: MasterTimelineData = { totalDurationSec: 120, beats }
    const result = validateMasterTimeline(data)
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((e) => e.includes('breathing')))
  })

  it('fails when a beat has durationSec not in {6, 8}', () => {
    const beats: TimelineBeat[] = []
    let t = 0
    const durs = [8, 8, 8, 5, 8, 8, 8, 6, 8, 8, 8, 8, 8, 8, 8] // one 5s (invalid), rest 6 or 8; sum = 13*8+6+5 = 115
    for (let i = 0; i < durs.length; i++) {
      const dur = durs[i]
      beats.push(makeBeat(i, t, dur as 6 | 8, i === 2 || i === 8 ? 'breathing' : 'narrated'))
      t += dur
    }
    const data: MasterTimelineData = { totalDurationSec: 120, beats }
    const result = validateMasterTimeline(data)
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((e) => e.includes('durationSec must be 6 or 8') || e.includes('sum of beat durations')))
  })

  it('fails when sum of beat durations is not 120', () => {
    const beats: TimelineBeat[] = []
    let t = 0
    for (let i = 0; i < 20; i++) {
      beats.push(makeBeat(i, t, 5, i === 2 || i === 6 ? 'breathing' : 'narrated'))
      t += 5
    }
    const data: MasterTimelineData = { totalDurationSec: 120, beats }
    const result = validateMasterTimeline(data)
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((e) => e.includes('sum of beat durations')))
  })
})
