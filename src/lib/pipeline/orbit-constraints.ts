import type { DeepUnderstandingResult } from './types'
import type { OrbitArchetype, ShotConstraints } from './types'

/**
 * Select a single archetype per run from understanding and intensity.
 * Pure function, no LLM.
 */
export function selectArchetype(
  understanding: DeepUnderstandingResult,
  intensity: number
): OrbitArchetype {
  const need = understanding.orbitIntent.primaryNeed
  const highIntensity = intensity >= 7
  const lowIntensity = intensity <= 3

  switch (need) {
    case 'broaden-perspective':
      return highIntensity ? 'cosmic_first' : 'parallel_lives'
    case 'accept-struggle':
      return 'human_first'
    case 'reduce-future-fear':
      return highIntensity ? 'cosmic_first' : 'abstract'
    case 'dissolve-hopelessness':
      return highIntensity ? 'human_first' : 'parallel_lives'
    case 'restore-agency':
      return 'human_first'
    case 'soften-ego':
      return lowIntensity ? 'abstract' : 'parallel_lives'
    case 'reduce-numbness':
      return highIntensity ? 'conflict' : 'human_first'
    default:
      return 'parallel_lives'
  }
}

/**
 * Return shot constraints for the given archetype.
 * Deterministic; e.g. cosmic_first → stricter no-repeat.
 */
export function getShotConstraints(archetype: OrbitArchetype): ShotConstraints {
  switch (archetype) {
    case 'cosmic_first':
      return {
        noRepeatMotifInRow: true,
        minMetaphorShotsPerAct: 1,
        maxShotsSameType: 2,
      }
    case 'human_first':
      return {
        noRepeatMotifInRow: true,
        minMetaphorShotsPerAct: 1,
        maxShotsSameType: 3,
      }
    case 'parallel_lives':
      return {
        noRepeatMotifInRow: true,
        minMetaphorShotsPerAct: 0,
        maxShotsSameType: 3,
      }
    case 'conflict':
      return {
        noRepeatMotifInRow: true,
        minMetaphorShotsPerAct: 1,
        maxShotsSameType: 2,
      }
    case 'abstract':
      return {
        noRepeatMotifInRow: true,
        minMetaphorShotsPerAct: 2,
        maxShotsSameType: 2,
      }
    default:
      return {
        noRepeatMotifInRow: true,
        minMetaphorShotsPerAct: 0,
        maxShotsSameType: 3,
      }
  }
}
