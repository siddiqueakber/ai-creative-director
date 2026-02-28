/**
 * Centralized timeline duration constants. Used by validator, master-timeline, QC, and vertex-ai
 * so allowed durations stay in sync. Prefer 6–8s beats for fewer cuts and more cinematic pacing.
 */
export const TOTAL_DURATION_SEC = 120
export const ALLOWED_DURATIONS = [6, 8] as const
export type AllowedDuration = (typeof ALLOWED_DURATIONS)[number]
export const MIN_BEATS = 12
export const MAX_BEATS = 18
/** At least 4 breathing beats for temporal silence — ambient only, no voice — preventing semantic overload. */
export const MIN_BREATHING_BEATS = 4

export function getAllowedDurationsList(): number[] {
  return [...ALLOWED_DURATIONS]
}
