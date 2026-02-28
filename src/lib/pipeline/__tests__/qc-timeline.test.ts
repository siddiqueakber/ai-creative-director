import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { runQualityControlPreGen } from '../layers/05b-qc'
import type { DocumentaryStructure, MasterTimelineData, TimelineBeat } from '../types'

function makeBeat(
  beatIndex: number,
  startSec: number,
  durationSec: number,
  beatType: 'narrated' | 'breathing' | 'transition' = 'narrated',
  actIndex = 0
): TimelineBeat {
  return {
    beatIndex,
    actIndex,
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

const minimalStructure: DocumentaryStructure = {
  acts: [
    { actType: 'vast', duration: 24, scaleType: 'cosmic', visualRequirements: [], narrationTiming: [], silenceDuration: 2 },
    { actType: 'living_dot', duration: 36, scaleType: 'global', visualRequirements: [], narrationTiming: [], silenceDuration: 0 },
    { actType: 'miracle_of_you', duration: 40, scaleType: 'personal', visualRequirements: [], narrationTiming: [], silenceDuration: 0 },
    { actType: 'return', duration: 20, scaleType: 'human', visualRequirements: [], narrationTiming: [], silenceDuration: 0 },
  ],
  totalDuration: 120,
  intensityLevel: 5,
  narrationStyle: 'moderate',
}

const minimalNarration = {
  segments: [
    { text: 'From far away.', startTime: 0, duration: 3, actIndex: 0, pauseAfter: 1, wordCount: 3, status: 'ready' as const, visualCue: '', motif: 'earth_from_space' as const, scaleType: 'cosmic' as const, shotType: 'wide' as const, settingHint: 'space' as const },
    { text: 'Life continues.', startTime: 12, duration: 3, actIndex: 1, pauseAfter: 1, wordCount: 2, status: 'ready' as const, visualCue: '', motif: 'human_labor' as const, scaleType: 'global' as const, shotType: 'aerial' as const, settingHint: 'rural' as const },
    { text: 'Here and now.', startTime: 30, duration: 3, actIndex: 2, pauseAfter: 1, wordCount: 3, status: 'ready' as const, visualCue: '', motif: 'shared_continuance' as const, scaleType: 'personal' as const, shotType: 'macro' as const, settingHint: 'interior' as const },
    { text: 'Ordinary life.', startTime: 50, duration: 3, actIndex: 3, pauseAfter: 1, wordCount: 2, status: 'ready' as const, visualCue: '', motif: 'quiet_return' as const, scaleType: 'human' as const, shotType: 'wide' as const, settingHint: 'urban' as const },
  ],
  totalWordCount: 10,
  avgPauseDuration: 1,
}

const minimalShotPlan = [
  { actIndex: 0, clipIndex: 0, duration: 6, description: '', microAction: '', runwayPrompt: '', styleModifiers: [], timeOfDay: 'dawn' as const, setting: 'space' as const, source: 'GEN' as const },
  { actIndex: 0, clipIndex: 1, duration: 6, description: '', microAction: '', runwayPrompt: '', styleModifiers: [], timeOfDay: 'dawn' as const, setting: 'rural' as const, source: 'GEN' as const },
  { actIndex: 1, clipIndex: 2, duration: 6, description: '', microAction: '', runwayPrompt: '', styleModifiers: [], timeOfDay: 'midday' as const, setting: 'rural' as const, source: 'GEN' as const },
  { actIndex: 1, clipIndex: 3, duration: 6, description: '', microAction: '', runwayPrompt: '', styleModifiers: [], timeOfDay: 'midday' as const, setting: 'urban' as const, source: 'GEN' as const },
  { actIndex: 2, clipIndex: 4, duration: 6, description: '', microAction: '', runwayPrompt: '', styleModifiers: [], timeOfDay: 'morning' as const, setting: 'interior' as const, source: 'GEN' as const },
  { actIndex: 2, clipIndex: 5, duration: 6, description: '', microAction: '', runwayPrompt: '', styleModifiers: [], timeOfDay: 'morning' as const, setting: 'interior' as const, source: 'GEN' as const },
  { actIndex: 3, clipIndex: 6, duration: 6, description: '', microAction: '', runwayPrompt: '', styleModifiers: [], timeOfDay: 'dusk' as const, setting: 'urban' as const, source: 'GEN' as const },
  { actIndex: 3, clipIndex: 7, duration: 6, description: '', microAction: '', runwayPrompt: '', styleModifiers: [], timeOfDay: 'dusk' as const, setting: 'urban' as const, source: 'GEN' as const },
]

describe('runQualityControlPreGen with masterTimeline', () => {
  it('fails when timeline has 0 breathing beats (MIN_BREATHING_BEATS=4)', () => {
    const beats: TimelineBeat[] = []
    let t = 0
    for (let i = 0; i < 15; i++) {
      beats.push(makeBeat(i, t, 8, 'narrated'))
      t += 8
    }
    const masterTimeline: MasterTimelineData = { totalDurationSec: 120, beats }
    const result = runQualityControlPreGen({
      structure: minimalStructure,
      narration: minimalNarration,
      shotPlan: minimalShotPlan,
      masterTimeline,
    })
    const breathingCheck = result.report.checks.find((c) => c.id === 'timeline_breathing_beats')
    assert.ok(breathingCheck)
    assert.equal(breathingCheck.passed, false)
  })

  it('fails when timeline has only 1 breathing beat (MIN_BREATHING_BEATS=4)', () => {
    const beats: TimelineBeat[] = []
    let t = 0
    for (let i = 0; i < 15; i++) {
      const isBreathing = i === 7
      beats.push(makeBeat(i, t, 8, isBreathing ? 'breathing' : 'narrated'))
      t += 8
    }
    const masterTimeline: MasterTimelineData = { totalDurationSec: 120, beats }
    const result = runQualityControlPreGen({
      structure: minimalStructure,
      narration: minimalNarration,
      shotPlan: minimalShotPlan,
      masterTimeline,
    })
    const breathingCheck = result.report.checks.find((c) => c.id === 'timeline_breathing_beats')
    assert.ok(breathingCheck)
    assert.equal(breathingCheck.passed, false)
  })

  it('fails when timeline has more than 2 consecutive short beats (duration < 8)', () => {
    const beats: TimelineBeat[] = []
    let t = 0
    // 18 beats summing to 120: three consecutive 6s (indices 1,2,3) -> maxConsecutiveShort = 3
    const durs = [8, 6, 6, 6, 8, 8, 8, 8, 8, 6, 6, 6, 6, 6, 6, 6, 6, 6]
    for (let i = 0; i < durs.length; i++) {
      const d = durs[i]
      beats.push(makeBeat(i, t, d, i === 2 || i === 8 ? 'breathing' : 'narrated'))
      t += d
    }
    const masterTimeline: MasterTimelineData = { totalDurationSec: 120, beats }
    const result = runQualityControlPreGen({
      structure: minimalStructure,
      narration: minimalNarration,
      shotPlan: minimalShotPlan,
      masterTimeline,
    })
    const rapidCheck = result.report.checks.find((c) => c.id === 'timeline_no_rapid_cuts')
    assert.ok(rapidCheck)
    assert.equal(rapidCheck.passed, false)
  })

  it('passes when timeline has 2+ breathing beats and valid durations', () => {
    const beats: TimelineBeat[] = []
    let t = 0
    for (let i = 0; i < 20; i++) {
      const isBreathing = i === 2 || i === 6 || i === 12 || i === 16
      beats.push(makeBeat(i, t, 6, isBreathing ? 'breathing' : 'narrated'))
      t += 6
    }
    const masterTimeline: MasterTimelineData = { totalDurationSec: 120, beats }
    const result = runQualityControlPreGen({
      structure: minimalStructure,
      narration: minimalNarration,
      shotPlan: minimalShotPlan,
      masterTimeline,
    })
    const breathingCheck = result.report.checks.find((c) => c.id === 'timeline_breathing_beats')
    assert.ok(breathingCheck)
    assert.equal(breathingCheck.passed, true)
  })
})
