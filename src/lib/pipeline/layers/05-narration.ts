import openai from '@/lib/openai'
import anthropic from '@/lib/anthropic'
import type {
  DeepUnderstandingResult,
  PerspectivePostureResult,
  DocumentaryNarrationSegment,
  DocumentaryNarration,
  DocumentaryStructure,
  MasterTimelineData,
  TimelineBeat,
  NarrationStyle,
  NarrationMotif,
  ShotTypeHint,
  ScaleType,
  SceneSetting,
  AvoidList,
  DirectorBrief,
  PerceptualTarget,
  PerspectivePosture,
} from '../types'
import {
  NATURAL_WORLD_MIRACLE_PROMPTS,
  NON_HUMAN_TIME_EXAMPLES,
} from '../orbit-visual-spec'

// ============================================
// BANNED LANGUAGE CHECKER
// ============================================

const BANNED_WORDS = [
  'inspire',
  'inspired',
  'inspiring',
  'inspiration',
  'succeed',
  'success',
  'successful',
  'overcome',
  'overcame',
  'win',
  'winning',
  'winner',
  'greatness',
  'great',
  'everything will be okay',
  'it will be okay',
  'be grateful',
  'grateful',
  'gratitude',
  'others have it worse',
  'could be worse',
  'at least',
  'silver lining',
  'blessing in disguise',
  'everything happens for a reason',
  'meant to be',
  'stay positive',
  'think positive',
  'positive vibes',
  'good vibes',
  'manifest',
  'manifesting',
]

const BANNED_PHRASES = [
  'others have it worse',
  'could be worse',
  'be grateful',
  'everything happens for a reason',
  'stay positive',
  'think positive',
  'pale blue dot',
  'mote of dust',
]

const BANNED_PATTERNS: { label: string; regex: RegExp }[] = [
  { label: 'imperative: you should', regex: /\byou\s+should\b/i },
  { label: 'imperative: you must', regex: /\byou\s+must\b/i },
  { label: 'imperative: try to', regex: /\btry\s+to\b/i },
  { label: 'imperative: remember to', regex: /\bremember\s+to\b/i },
  { label: 'certainty: the answer is', regex: /\bthe\s+answer\s+is\b/i },
  { label: 'certainty: this means', regex: /\bthis\s+means\b/i },
  { label: 'certainty: the truth is', regex: /\bthe\s+truth\s+is\b/i },
  { label: 'self-help: heal', regex: /\bheal\b/i },
  { label: 'self-help: fix yourself', regex: /\bfix\s+yourself\b/i },
  { label: 'self-help: be your best', regex: /\bbe\s+your\s+best\b/i },
  { label: 'self-help: choose happiness', regex: /\bchoose\s+happiness\b/i },
  { label: 'inspirational: destiny', regex: /\bdestiny\b/i },
  { label: 'inspirational: meant to', regex: /\bmeant\s+to\b/i },
  { label: 'inspirational: everything happens', regex: /\beverything\s+happens\b/i },
  { label: 'inspirational: journey', regex: /\bjourney\b/i },
]

const ALLOWED_MOTIFS: NarrationMotif[] = [
  'earth_from_space',
  'starfield',
  'city_lights',
  'human_labor',
  'struggle_survival',
  'quiet_return',
  'shared_continuance',
  'ocean_current',
  'mountain_ridge',
  'urban_night',
  'desert_stillness',
  'forest_canopy',
  'domestic_detail',
  'crowd_motion',
  'industrial_hum',
]

const ALLOWED_SHOT_TYPES: ShotTypeHint[] = [
  'wide',
  'macro',
  'aerial',
  'static',
  'slow_drift',
]

const ALLOWED_SETTINGS: SceneSetting[] = [
  'urban',
  'suburban',
  'rural',
  'interior',
  'transit',
  'workplace',
  'public_space',
  'space',
]

// PerceptualTarget and posture phrasing: explicit verb sets so tone varies by user state.
const PERCEPTUAL_TARGET_PHRASING: Record<PerceptualTarget, string> = {
  present_continuation: 'Favor: still, holding, entering, reaching, continuing. Avoid: urgency, resolution, lesson.',
  forward_flow: 'Favor: movement, carrying, next, onward. Avoid: stuck, frozen, loop.',
  embodied_sensation: 'Favor: warmth, weight, breath, skin, pulse, gravity. Avoid: abstraction, explanation.',
  parallel_existence: 'Favor: alongside, elsewhere, others continuing, world without you. Avoid: centrality, spotlight.',
  autonomous_processes: 'Favor: independent, without permission, already moving. Avoid: control, fixing.',
  scale_displacement: 'Favor: zoom out then in, vast then intimate, collapse. Avoid: single scale.',
}

const POSTURE_PHRASING: Record<PerspectivePosture, string> = {
  humbling_continuity: 'Favor: scale, smallness, ongoing. Tone: quiet, unheroic.',
  grounded_endurance: 'Favor: weight, steadiness, carrying, floor, breath. Tone: patient, unheroic.',
  quiet_awe: 'Favor: stillness, allowing, softness, light. Tone: receptive, not striving.',
  embodied_fragility: 'Favor: body, limits, sensation, holding. Tone: tender, not fixing.',
  patient_return: 'Favor: resumption, room, senses, continuation. Tone: calm re-entry.',
}

export function validateNarrationText(text: string): {
  valid: boolean
  violations: string[]
} {
  const violations: string[] = []
  const lowerText = text.toLowerCase()

  BANNED_WORDS.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'i')
    if (regex.test(lowerText)) {
      violations.push(word)
    }
  })

  BANNED_PHRASES.forEach((phrase) => {
    if (lowerText.includes(phrase.toLowerCase())) {
      violations.push(`phrase: "${phrase}"`)
    }
  })

  BANNED_PATTERNS.forEach((pattern) => {
    if (pattern.regex.test(lowerText)) {
      violations.push(pattern.label)
    }
  })

  return {
    valid: violations.length === 0,
    violations,
  }
}

/**
 * Remove sentences containing banned words/phrases from text rather than replacing the whole segment.
 */
function removeBannedSentences(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const clean = sentences.filter((s) => {
    const { valid } = validateNarrationText(s)
    return valid
  })
  return clean.join(' ').trim()
}

/**
 * Trim text to maxWords but avoid incomplete sentences. Prefer cutting at the last sentence
 * boundary (. ! ?) within the limit; otherwise cut at word boundary and strip trailing
 * comma so we never get "in your hands,." or "expands and."
 */
function trimToCompleteSentence(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/)
  if (words.length <= maxWords) {
    const t = text.trim()
    if (t.endsWith('.') || t.endsWith('!') || t.endsWith('?')) return t
    if (t.endsWith(',')) return t.slice(0, -1) + '.'
    return t
  }
  const slice = words.slice(0, maxWords)
  let lastSentenceEnd = -1
  for (let i = slice.length - 1; i >= 0; i--) {
    const w = slice[i]
    if (/[.!?]$/.test(w)) {
      lastSentenceEnd = i
      break
    }
  }
  let out: string
  if (lastSentenceEnd >= 0) {
    out = slice.slice(0, lastSentenceEnd + 1).join(' ')
  } else {
    out = slice.join(' ').replace(/[,;]\s*$/, '').trim()
    if (!out.endsWith('.') && !out.endsWith('!') && !out.endsWith('?')) out += '.'
  }
  return out
}

// ============================================
// DYNAMIC ORBIT NARRATION PROMPT
// ============================================

const ORBIT_NARRATION_PROMPT = `You are the narrator of an Orbit documentary -- a short, contemplative film made for one person's thought.

ORBIT RITUAL (4 acts, always this order):
0. VAST — cosmic or planetary scale. Silence, distance, no humans. The user's concern seen from impossibly far away.
1. LIVING_DOT — earth-scale life: ecosystems, animals, crowds, cities. Life continuing without commentary.
2. MIRACLE_OF_YOU — intimate, personal scale. Warmth, texture, quiet sensation. Being alive in a body, right now.
3. RETURN — ordinary life resumes. Streets, commutes, kitchens. Patience and continuation, not resolution.

VOICE (documentary style):
- Style: calm, observant documentary narrator (nature docs, contemplative films). Speaks in clear, complete sentences. You may briefly name what we see (place, movement, scale) and then reflect on it in one line. Avoid listing or explaining; observe, then land one clear feeling or idea.
- You can name what we see in a short phrase (e.g. "A whale surfaces" or "The city from above") and add one reflection. Do not list details or explain; observe and reflect. The narrator guides the viewer through a journey — sometimes ahead of the image, sometimes with it.
- No advice, motivation, definitions, heroic arcs, or transformational language. Avoid addressing "you" directly in early acts. In RETURN, shift to somatic/body language.

EMOTIONAL DEPTH:
- Write lines the listener will feel in their chest, not just hear.
- Use BODY language: warmth, weight, pressure, breath, pulse, skin, gravity.
- Name specific textures and sensations: "the warmth at the back of your neck," "the weight of your hands resting," "the sound of your own breathing in a quiet room."
- Favor RECOGNITION over beauty — the best line is one where the viewer thinks "yes, that's exactly what that feels like" without being told to feel it.
- Never be clever. Never be poetic for its own sake. Be honest and plain.
- One powerful plain sentence beats three beautiful vague ones.
- Avoid repeating structural patterns across segments. If one line starts with "Something…" the next must not. Vary rhythm: short declarative, then long flowing, then a single word.
- Prefer concrete words (water, light, breath, distance, floor, weight) over abstract ones (meaning, existence, purpose) when both fit. The viewer should feel they are being shown something, not given a philosophy lecture.

THROUGH-LINE:
- The whole film should feel like one continuous observation or reflection. Later lines can echo an image or idea from earlier (e.g. "that distance," "this stillness," "what was moving"). Avoid standalone one-liners; build a single journey. Each segment should feel like the next sentence in a calm monologue.

SCALE COLLAPSE:
- The most powerful moments juxtapose vast with intimate in a single beat.
- After a cosmic observation, drop to something tiny and physical.
- Example: "Galaxies drift apart over millions of years. …Your shirt is warm from the dryer."
- This is what makes the viewer's breath catch.

GOLDEN LINE:
- One segment (usually Act 2 or early Act 3) must contain the "heart-stop" line — the single sentence the viewer will remember tomorrow.
- This line should be: under 10 words, physically specific, and hit the listener with an unexpected truth drawn from their own thought.
- Build the surrounding segments to lead toward and away from this moment.
- Mark this segment with breathingAfter: true so it lands in silence.

PERCEPTUAL TARGET: {perceptualTarget}
{perceptualPostureSnippet}
- All narration lines should work toward this perceptual shift.

SCRIPT PACING (calm documentary — Interstellar / Planet Earth feel):
- Speak in complete sentences. Use ellipses (…) sparingly — only for a genuine pause before a turn in thought. Avoid choppy, single-phrase lines. The rhythm should be even and unhurried, like a real documentary narrator. Prefer full sentences over fragments.
- Example: "The planet turns in silence. Half in light, half in shadow. Somewhere below, life continues without an audience."
- The delivery should feel slow, spacious, and deeply calm — the kind of voice that is felt inside the viewer's heart, not just heard. Let words breathe.

RETURN ACT (last 15-20 seconds):
- Shift from external scale to BODILY STABILITY.
- Do NOT discuss: purpose, destiny, universe, humanity, insight, lessons.
- ONLY: continuation language. Body. Room. Senses.
- Examples: "The floor is still holding you." / "The air is still entering." / "Light is still reaching your eyes."
- Final 6-10 seconds: SILENCE. No narration. Ambient only.

SEGMENT LENGTH: Each segment must have enough words to fill its duration at ~2.0 words/second of slow, calm delivery (the voice speaks at 0.78x speed). Segments that are too short leave the viewer in silence. Write 12-18 words per segment minimum, using ellipses and pauses for pacing. Do NOT write short 5-word segments.

WHAT MAKES THIS UNIQUE:
- Draw imagery and metaphors FROM the user's specific thought. Reference their actual concerns, words, or emotional landscape indirectly through concrete visuals.
- Each segment's visual must feel designed for THIS thought, not a generic template.
- Vary your sentence structure, rhythm, and imagery from run to run. Avoid formulaic patterns.
- Prefer surprising, specific, filmable images over common ones (e.g. prefer "a dishcloth drying on a radiator" over "steam rising from a cup").

OUTPUT FORMAT (JSON only, no markdown):
{
  "segments": [
    {
      "text": "The narration line (observational, grounded, no advice)",
      "visualDescription": "A detailed, filmable scene description (50-150 chars). This will become the Veo video prompt. Be concrete: subject, action, lighting, camera behavior. Prefer recognizable natural-world imagery: cosmos, Earth from space (day and night), oceans and marine life (e.g. whales), birds (e.g. falcons), volcanoes, coral reefs, aurora, natural landscapes and wildlife. Prefer non-human time and process (e.g. ${NON_HUMAN_TIME_EXAMPLES.join(', ')}) and show change over time (growth, flow, cycles), not one-off events. Avoid abstract vapor, breath fog, droplets on glass, or steam-like close-ups; favor realistic, documentary-style natural views. Visuals must obey Orbit rules: no close human subjects, no indoor, no street-level human activity; humans never primary subject. Do not include any words, titles, or phrases that could be rendered as on-screen text — visual imagery only.",
      "visualCue": "Short tag for the visual (10-30 chars)",
      "motif": "one of: ${ALLOWED_MOTIFS.join(', ')}",
      "scaleType": "cosmic | global | human | personal",
      "shotType": "wide | macro | aerial | static | slow_drift",
      "settingHint": "space | urban | suburban | rural | interior | transit | workplace | public_space",
      "actIndex": 0,
      "breathingAfter": false
    }
  ]
}

RULES:
- Set breathingAfter to true for 2-3 segments (especially after emotionally dense lines or between act transitions). These become visual-only beats with no narration.
- The final segment MUST be actIndex 3 (RETURN) and normalize patience/continuation.
- JSON only, no preamble, no markdown fences.`

function getNarrationSystemPrompt(perspective: PerspectivePostureResult): string {
  const target = perspective.perceptualTarget || 'present_continuation'
  const snippet =
    PERCEPTUAL_TARGET_PHRASING[target as PerceptualTarget] +
    '\n' +
    POSTURE_PHRASING[perspective.posture]
  return ORBIT_NARRATION_PROMPT.replace('{perceptualTarget}', target).replace(
    '{perceptualPostureSnippet}',
    snippet
  )
}

function getTimelineNarrationSystemPrompt(perspective: PerspectivePostureResult): string {
  const target = perspective.perceptualTarget || 'present_continuation'
  const snippet =
    PERCEPTUAL_TARGET_PHRASING[target as PerceptualTarget] +
    '\n' +
    POSTURE_PHRASING[perspective.posture]
  return NARRATION_FOR_TIMELINE_PROMPT.replace('{perceptualTarget}', target).replace(
    '{perceptualPostureSnippet}',
    snippet
  )
}

// ============================================
// INTENSITY-AWARE CONSTRAINTS (relaxed)
// ============================================

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

function normalizeMotif(value: unknown, actIndex: number): NarrationMotif {
  if (typeof value === 'string' && ALLOWED_MOTIFS.includes(value as NarrationMotif)) {
    return value as NarrationMotif
  }

  switch (actIndex) {
    case 0:
      return 'earth_from_space'
    case 1:
      return 'human_labor'
    case 2:
      return 'shared_continuance'
    case 3:
      return 'quiet_return'
    default:
      return 'shared_continuance'
  }
}

function normalizeScaleType(value: unknown, actIndex: number, structure: DocumentaryStructure): ScaleType {
  if (typeof value === 'string') {
    const lower = value.toLowerCase()
    if (lower === 'cosmic' || lower === 'global' || lower === 'human' || lower === 'personal') {
      return lower as ScaleType
    }
  }
  return structure.acts[actIndex]?.scaleType || 'human'
}

function normalizeShotType(value: unknown, scaleType: ScaleType): ShotTypeHint {
  if (typeof value === 'string' && ALLOWED_SHOT_TYPES.includes(value as ShotTypeHint)) {
    return value as ShotTypeHint
  }

  if (scaleType === 'cosmic') return 'slow_drift'
  if (scaleType === 'global') return 'aerial'
  if (scaleType === 'personal') return 'macro'
  return 'wide'
}

function normalizeSettingHint(value: unknown, motif: NarrationMotif): SceneSetting {
  if (typeof value === 'string' && ALLOWED_SETTINGS.includes(value as SceneSetting)) {
    return value as SceneSetting
  }

  if (motif === 'earth_from_space' || motif === 'starfield') return 'space'
  if (motif === 'city_lights' || motif === 'urban_night') return 'urban'
  if (motif === 'human_labor' || motif === 'shared_continuance' || motif === 'industrial_hum') return 'workplace'
  if (motif === 'struggle_survival' || motif === 'crowd_motion') return 'public_space'
  if (motif === 'domestic_detail') return 'interior'
  if (motif === 'ocean_current' || motif === 'forest_canopy' || motif === 'mountain_ridge' || motif === 'desert_stillness') return 'rural'
  return 'urban'
}

function isFilmableCue(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed.length < 10) return false
  return true
}

// Salient visual nouns that must not appear literally in narration when they appear in the paired visual (perceptual primer discipline).
const SALIENT_VISUAL_NOUNS = new Set([
  'whale', 'whales', 'humpback', 'falcon', 'falcons', 'ocean', 'oceans', 'earth', 'aurora', 'volcano', 'volcanic', 'coral', 'reef', 'reefs',
  'city', 'cities', 'traffic', 'galaxy', 'galaxies', 'starfield', 'stars', 'embryo', 'lava', 'canyon', 'canyons', 'river', 'rivers', 'forest', 'forests',
  'mountain', 'mountains', 'desert', 'deserts', 'tide', 'tides', 'migration', 'glacier', 'clouds', 'wetlands', 'delta', 'tractor', 'breaching',
  'bioluminescence', 'terminator', 'milky', 'sunlight', 'planet', 'orbit', 'space', 'underwater', 'sunrise', 'sunset',
])

function hasLiteralVisualOverlap(text: string, visualDescription: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
  const textWords = new Set(normalize(text))
  const visualWords = normalize(visualDescription)
  return visualWords.some((w) => SALIENT_VISUAL_NOUNS.has(w) && textWords.has(w))
}

// ============================================
// FALLBACK POOLS (multiple alternatives per act, picked randomly)
// ============================================

const VAST_FALLBACKS = [
  { text: 'From far away, the world turns in silence.', cue: 'Earth seen from orbit, slow drift, quiet light', motif: 'earth_from_space' as NarrationMotif },
  { text: 'Somewhere past the atmosphere, the noise stops.', cue: 'Stars slowly wheeling behind the dark curve of the planet', motif: 'starfield' as NarrationMotif },
  { text: 'Light takes eight minutes to cross from the sun to here.', cue: 'Sunlight creeping across the terminator line on a blue planet', motif: 'earth_from_space' as NarrationMotif },
  { text: 'No one out there is keeping score.', cue: 'Deep field stars drifting in absolute stillness', motif: 'starfield' as NarrationMotif },
  { text: 'The galaxy turns without urgency, without audience.', cue: 'Milky Way arm rotating in time-lapse from a mountain summit', motif: 'starfield' as NarrationMotif },
  { text: 'The planet turns in silence. Half in light, half in shadow.', cue: 'Earth from space, day-night terminator, slow drift', motif: 'earth_from_space' as NarrationMotif },
]

const LIVING_DOT_FALLBACKS = [
  { text: 'On the surface, life moves through water, soil, and streets.', cue: 'River delta feeding wetlands with birds in motion', motif: 'human_labor' as NarrationMotif },
  { text: 'Roots push through concrete. Tides fill and empty.', cue: 'Weeds growing through cracks in an old parking lot at dawn', motif: 'forest_canopy' as NarrationMotif },
  { text: 'Cities hum with ten million unfinished conversations.', cue: 'Aerial view of rush-hour traffic flowing like blood cells', motif: 'crowd_motion' as NarrationMotif },
  { text: 'A whale surfaces, breathes, and descends again.', cue: 'Humpback whale breaching in grey open ocean', motif: 'ocean_current' as NarrationMotif },
  { text: 'Somewhere a field is being plowed before anyone wakes.', cue: 'Tractor headlights cutting through pre-dawn mist over flat farmland', motif: 'human_labor' as NarrationMotif },
  { text: 'Below, the lights of the city pulse. Life continues without an audience.', cue: 'City lights at night from above, slow drift', motif: 'city_lights' as NarrationMotif },
]

const MIRACLE_FALLBACKS = [
  { text: 'A whale moves through silence, unhurried.', cue: NATURAL_WORLD_MIRACLE_PROMPTS[0], motif: 'ocean_current' as NarrationMotif },
  { text: 'A falcon rides the wind above the canyon, patient.', cue: NATURAL_WORLD_MIRACLE_PROMPTS[1], motif: 'mountain_ridge' as NarrationMotif },
  { text: 'The planet turns. Half in darkness, half in light.', cue: NATURAL_WORLD_MIRACLE_PROMPTS[2], motif: 'earth_from_space' as NarrationMotif },
  { text: 'In the deep, light comes from living things.', cue: NATURAL_WORLD_MIRACLE_PROMPTS[3], motif: 'ocean_current' as NarrationMotif },
  { text: 'Fire meets the sea. The earth is still becoming.', cue: NATURAL_WORLD_MIRACLE_PROMPTS[4], motif: 'mountain_ridge' as NarrationMotif },
  { text: 'The sun breaks through. Everything is lit from behind.', cue: NATURAL_WORLD_MIRACLE_PROMPTS[5], motif: 'ocean_current' as NarrationMotif },
  { text: 'Something surfaces, breathes, and goes back under.', cue: NATURAL_WORLD_MIRACLE_PROMPTS[6], motif: 'ocean_current' as NarrationMotif },
  { text: 'The canyon holds the wind. Something moves through it without asking.', cue: NATURAL_WORLD_MIRACLE_PROMPTS[1], motif: 'mountain_ridge' as NarrationMotif },
]

const RETURN_FALLBACKS = [
  { text: 'The floor… is still holding you.', cue: 'Soft natural light falling across a wooden floor, dust motes drifting', motif: 'quiet_return' as NarrationMotif },
  { text: 'The air… is still entering.', cue: 'Wind moving through tall grass at golden hour, slow and steady', motif: 'quiet_return' as NarrationMotif },
  { text: 'Light… is still reaching your eyes.', cue: 'Morning sunlight slowly crossing a stone wall, warm and unhurried', motif: 'quiet_return' as NarrationMotif },
  { text: 'Nothing here… has paused to wait for you to understand it.', cue: 'Wide shot of a river continuing downstream through a quiet valley', motif: 'quiet_return' as NarrationMotif },
  { text: 'You can just notice now.', cue: 'A single tree standing in open landscape under soft overcast sky', motif: 'quiet_return' as NarrationMotif },
  { text: 'The floor is still there. The air is still coming in. You can notice that.', cue: 'Soft natural light on a floor, dust motes, calm', motif: 'quiet_return' as NarrationMotif },
]

const FALLBACK_POOLS = [VAST_FALLBACKS, LIVING_DOT_FALLBACKS, MIRACLE_FALLBACKS, RETURN_FALLBACKS]

function getRandomFallback(actIndex: number) {
  const pool = FALLBACK_POOLS[actIndex] || RETURN_FALLBACKS
  const pick = pool[Math.floor(Math.random() * pool.length)]
  const scaleMap: Record<number, ScaleType> = { 0: 'cosmic', 1: 'global', 2: 'personal', 3: 'human' }
  const shotMap: Record<number, ShotTypeHint> = { 0: 'slow_drift', 1: 'aerial', 2: 'macro', 3: 'wide' }
  const settingMap: Record<number, SceneSetting> = { 0: 'space', 1: 'rural', 2: 'interior', 3: 'urban' }
  return {
    text: pick.text,
    visualCue: pick.cue,
    visualDescription: pick.cue,
    motif: pick.motif,
    scaleType: scaleMap[actIndex] ?? 'human',
    shotType: shotMap[actIndex] ?? 'wide',
    settingHint: settingMap[actIndex] ?? 'urban',
  }
}

function allocateActOrder(maxSegments: number): number[] {
  const total = Math.min(8, Math.max(4, maxSegments))
  if (total >= 8) return [0, 0, 1, 1, 2, 2, 3, 3]
  if (total >= 7) return [0, 1, 1, 2, 2, 3, 3]
  if (total >= 6) return [0, 1, 1, 2, 2, 3]
  if (total === 5) return [0, 1, 1, 2, 3]
  return [0, 1, 2, 3]
}

// ============================================
// DOCUMENTARY NARRATION GENERATION
// ============================================

export async function generateDocumentaryNarration(
  thought: string,
  understanding: DeepUnderstandingResult,
  perspective: PerspectivePostureResult,
  documentaryStructure: DocumentaryStructure,
  directorBriefInput?: DirectorBrief,
  avoidList?: AvoidList,
  previousNarrationTexts?: string[]
): Promise<DocumentaryNarration> {
  const constraints = getNarrationConstraints(documentaryStructure.narrationStyle)
  const actOrder = allocateActOrder(constraints.segmentCount[1])
  const totalSegments = actOrder.length

  let directorBrief = directorBriefInput
    ? `DIRECTOR BRIEF (creative direction): ${directorBriefInput.oneLiner}
Tone: ${directorBriefInput.tone}
Key metaphors to touch: ${directorBriefInput.keyMetaphors.join(', ')}
Pacing: ${directorBriefInput.avoidPacing}${directorBriefInput.visualGrammar ? `\nVisual grammar (match pacing): ${directorBriefInput.visualGrammar.pacingStyle} pacing, ${directorBriefInput.visualGrammar.motionStyle} motion.` : ''}

`
  : ''
  directorBrief += `DIRECTOR BRIEF (orbit):
- Guiding question: ${understanding.guidingQuestion}
- Human stakes: ${understanding.humanStakes}
- Primary need: ${understanding.orbitIntent.primaryNeed}
- Secondary need: ${understanding.orbitIntent.secondaryNeed || 'none'}
- Avoid: ${[...understanding.orbitIntent.avoid, ...perspective.avoid].join(', ')}
- Posture: ${perspective.posture}
- Narration bias: ${perspective.narrationBias.join(', ')}
- Pacing bias: ${perspective.pacingBias}
- Reinforce acts: ${perspective.reinforceActs.join(', ')}
- Ending rule: ${understanding.orbitIntent.endingRule}

ACT GOALS:
0 VAST: cosmic scale, silence, distance, no humans.
1 LIVING_DOT: earth life continuity, ecosystems, animals, humans observed neutrally.
2 MIRACLE_OF_YOU: biological/developmental process (e.g. embryology, non-human or abstract) or body-as-rhythm (breath, sensation); no domestic interior, no productivity framing.
3 RETURN: bodily stability and environmental re-attunement. Do NOT discuss purpose, destiny, universe, humanity, insight, or lessons. ONLY continuation language: body, room, senses. Final 6-10 seconds: SILENCE.

CONSTRAINTS:
- Total segments: ${totalSegments} (acts in order: ${actOrder.join(', ')})
- Max total words: ${constraints.maxWords}
- Max words per segment: ${constraints.maxWordsPerSegment}
- Each segment must be one or more complete sentences; do not end on a comma or an incomplete clause.
- Pause after each segment: ${constraints.pauseDuration[0]}-${constraints.pauseDuration[1]}s`

  const thoughtAnchors = understanding.thoughtAnchors
  if (thoughtAnchors && thoughtAnchors.length > 0) {
    directorBrief += `\n\nThought anchors (weave at least one indirectly into imagery; do not name them literally in narration): ${thoughtAnchors.slice(0, 5).join(', ')}.`
  }

  if (avoidList && (avoidList.promptSnippets.length > 0 || avoidList.microActions.length > 0)) {
    const avoidParts: string[] = []
    if (avoidList.promptSnippets.length > 0) {
      avoidParts.push('phrases/snippets: ' + avoidList.promptSnippets.slice(0, 15).join('; '))
    }
    if (avoidList.microActions.length > 0) {
      avoidParts.push('micro-actions: ' + avoidList.microActions.slice(0, 10).join(', '))
    }
    directorBrief += `\n\nDo not repeat these recent motifs or phrases: ${avoidParts.join('. ')}`
  }

  if (previousNarrationTexts && previousNarrationTexts.length > 0) {
    directorBrief += `\n\nPREVIOUS NARRATIONS (do NOT reuse these sentences, metaphors, or imagery patterns — find fresh angles):\n${previousNarrationTexts.map((t, i) => `${i + 1}. "${t}"`).join('\n')}`
  }

  try {
    const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-4-6'

    const sanitizeAnthropicModel = (model: string) => {
      const lower = model.toLowerCase()
      if (lower.endsWith('-latest')) return DEFAULT_ANTHROPIC_MODEL
      if (lower.includes('claude-opus-4')) return DEFAULT_ANTHROPIC_MODEL
      if (lower.includes('claude-3-5-sonnet')) return DEFAULT_ANTHROPIC_MODEL
      if (lower.includes('claude-3-5')) return DEFAULT_ANTHROPIC_MODEL
      return model
    }

    const envModelRaw = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL
    const anthropicModel = sanitizeAnthropicModel(envModelRaw)

    let response;
    try {
      response = await anthropic.messages.create({
        model: anthropicModel,
        max_tokens: 2000,
        temperature: 0.55,
        system: getNarrationSystemPrompt(perspective) + "\n\nCRITICAL: Respond ONLY with a valid JSON object. No preamble, no markdown. Format: { \"segments\": [ ... ] }",
        messages: [
          {
            role: 'user',
            content: `${directorBrief}

USER'S THOUGHT (draw imagery and metaphors from this — make the visuals feel specific to their words):
"${thought}"`,
          },
        ],
      })
    } catch (err: any) {
      const msg = String(err?.message || '')
      if (err?.status === 404 && msg.includes('model:')) {
        try {
          response = await anthropic.messages.create({
            model: 'claude-opus-4-6',
            max_tokens: 2000,
            temperature: 0.55,
            system: getNarrationSystemPrompt(perspective) + '\n\nCRITICAL: Respond ONLY with a valid JSON object. No preamble, no markdown.',
            messages: [
              {
                role: 'user',
                content: `${directorBrief}\n\nUSER'S THOUGHT:\n"${thought}"`,
              },
            ],
          })
        } catch (retryErr: any) {
          console.warn('Anthropic retry failed, falling back to OpenAI:', retryErr.message)
          
          const gptResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: getNarrationSystemPrompt(perspective) },
              {
                role: 'user',
                content: `${directorBrief}\n\nUSER'S THOUGHT (draw imagery and metaphors from this):\n"${thought}"`,
              },
            ],
            temperature: 0.5,
            response_format: { type: 'json_object' },
          })

          response = {
            content: [{ type: 'text', text: gptResponse.choices[0].message.content || '' }]
          } as any
        }
      } else {
        console.warn('Anthropic API unavailable, using OpenAI fallback. Reason:', err.message)
        
        const gptResponse = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: getNarrationSystemPrompt(perspective) },
            {
              role: 'user',
              content: `${directorBrief}\n\nUSER'S THOUGHT (draw imagery and metaphors from this):\n"${thought}"`,
            },
          ],
          temperature: 0.5,
          response_format: { type: 'json_object' },
        })

        response = {
          content: [{ type: 'text', text: gptResponse.choices[0].message.content || '' }]
        } as any
      }
    }

    const content = response.content[0].type === 'text' ? response.content[0].text : ''
    if (!content) {
      return createFallbackNarration(documentaryStructure, perspective)
    }

    const jsonString = content.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(jsonString)
    const rawSegments = parsed.segments || []

    // Build segments: use LLM output as primary, only fallback when totally empty/unparseable
    const segments: DocumentaryNarrationSegment[] = []
    let currentTime = 0

    for (let i = 0; i < actOrder.length; i++) {
      const actIndex = actOrder[i]
      const rawSegment = rawSegments[i]
      let text = typeof rawSegment?.text === 'string' ? rawSegment.text.trim() : ''

      // If text is empty, use fallback
      if (!text) {
        const fb = getRandomFallback(actIndex)
        text = fb.text
      }

      // Instead of wholesale fallback on banned words: remove only the offending sentences
      const validation = validateNarrationText(text)
      if (!validation.valid) {
        const cleaned = removeBannedSentences(text)
        text = cleaned || getRandomFallback(actIndex).text
      }

      // Trim over-length segments at sentence boundaries to avoid incomplete sentences
      text = trimToCompleteSentence(text, constraints.maxWordsPerSegment)

      // Use LLM's visualDescription as primary; fall back to visualCue or random fallback
      const visualDescription = typeof rawSegment?.visualDescription === 'string' && rawSegment.visualDescription.trim().length >= 10
        ? rawSegment.visualDescription.trim()
        : (isFilmableCue(rawSegment?.visualCue) ? rawSegment.visualCue.trim() : getRandomFallback(actIndex).visualCue)

      const wordCount = text.trim().split(/\s+/).length

      const visualCue = typeof rawSegment?.visualCue === 'string' && rawSegment.visualCue.trim().length >= 5
        ? rawSegment.visualCue.trim()
        : visualDescription.slice(0, 40)

      const motif = normalizeMotif(rawSegment?.motif, actIndex)
      const scaleType = normalizeScaleType(rawSegment?.scaleType, actIndex, documentaryStructure)
      const shotType = normalizeShotType(rawSegment?.shotType, scaleType)
      const settingHint = normalizeSettingHint(rawSegment?.settingHint, motif)
      const breathingAfter = rawSegment?.breathingAfter === true

      // 2.0 wps accounts for ElevenLabs 0.78x delivery speed
      const duration = Math.ceil(wordCount / 2.0)
      const pauseAfter = constraints.pauseDuration[0]

      segments.push({
        text,
        startTime: currentTime,
        duration,
        actIndex,
        pauseAfter,
        wordCount,
        status: 'pending',
        beatIndex: segments.length,
        visualCue,
        visualDescription,
        breathingAfter,
        motif,
        scaleType,
        shotType,
        settingHint,
      })

      currentTime += duration + pauseAfter
    }

    // Soft total-word trim: if over limit, trim longest segments by cutting words (not replacing)
    let totalWordCount = segments.reduce((sum, s) => sum + s.wordCount, 0)
    while (totalWordCount > constraints.maxWords) {
      const longest = segments
        .map((s, idx) => ({ idx, words: s.wordCount }))
        .sort((a, b) => b.words - a.words)[0]
      if (!longest || longest.words <= 5) break
      const seg = segments[longest.idx]
      const trimmedText = trimToCompleteSentence(seg.text, Math.max(5, seg.wordCount - 2))
      const trimmedWordCount = trimmedText.trim().split(/\s+/).length
      segments[longest.idx] = {
        ...seg,
        text: trimmedText,
        wordCount: trimmedWordCount,
        duration: Math.ceil(trimmedWordCount / 2.0),
      }
      totalWordCount = segments.reduce((sum, s) => sum + s.wordCount, 0)
    }

    const finalTotalWordCount = segments.reduce((sum, s) => sum + s.wordCount, 0)
    const avgPauseDuration =
      segments.reduce((sum, s) => sum + s.pauseAfter, 0) / segments.length

    return {
      segments,
      totalWordCount: finalTotalWordCount,
      avgPauseDuration,
    }
  } catch (error) {
    console.error('Layer 5 (Documentary Narration) failed:', error)
    return createFallbackNarration(documentaryStructure, perspective)
  }
}

// ============================================
// FALLBACK NARRATION
// ============================================

function createFallbackNarration(
  documentaryStructure: DocumentaryStructure,
  perspective: PerspectivePostureResult
): DocumentaryNarration {
  const constraints = getNarrationConstraints(documentaryStructure.narrationStyle)
  const segments: DocumentaryNarrationSegment[] = []
  let currentTime = 0

  const actOrder = allocateActOrder(constraints.segmentCount[1])

  for (let i = 0; i < actOrder.length; i++) {
    const actIndex = actOrder[i]
    const fb = getRandomFallback(actIndex)
    const text = fb.text
    const wordCount = text.split(/\s+/).length
    const duration = Math.ceil(wordCount / 2.0)
    const pauseAfter = constraints.pauseDuration[0]

    segments.push({
      text,
      startTime: currentTime,
      duration,
      actIndex,
      pauseAfter,
      wordCount,
      status: 'pending',
      beatIndex: segments.length,
      visualCue: fb.visualCue,
      visualDescription: fb.visualDescription,
      breathingAfter: actIndex === 0 || actIndex === 2,
      motif: fb.motif,
      scaleType: fb.scaleType,
      shotType: fb.shotType,
      settingHint: fb.settingHint,
    })

    currentTime += duration + pauseAfter
  }

  return {
    segments,
    totalWordCount: segments.reduce((sum, s) => sum + s.wordCount, 0),
    avgPauseDuration: constraints.pauseDuration[0],
  }
}

/**
 * Beat-aligned fallback: creates one narration segment per beat using fallback text,
 * ensuring every beat has narration even when the LLM call fails or returns too few segments.
 */
function createBeatAlignedFallback(
  beats: TimelineBeat[],
  documentaryStructure: DocumentaryStructure
): DocumentaryNarration {
  const nActs = documentaryStructure.acts.length
  const segments: DocumentaryNarrationSegment[] = []

  for (const beat of beats) {
    const safeActIndex = Math.min(beat.actIndex, nActs - 1)
    const act = documentaryStructure.acts[safeActIndex]
    const fb = getRandomFallback(safeActIndex)
    const scaleType: ScaleType = act?.scaleType ?? (safeActIndex === 0 ? 'cosmic' : safeActIndex === nActs - 1 ? 'human' : 'global')
    const shotType: ShotTypeHint = scaleType === 'cosmic' ? 'slow_drift' : scaleType === 'global' ? 'aerial' : scaleType === 'personal' ? 'macro' : 'wide'
    const wordCount = fb.text.split(/\s+/).length

    segments.push({
      text: fb.text,
      startTime: beat.startSec,
      duration: beat.durationSec,
      actIndex: beat.actIndex,
      pauseAfter: 1,
      wordCount,
      status: 'pending',
      beatIndex: beat.beatIndex,
      visualCue: fb.visualCue,
      visualDescription: fb.visualDescription,
      breathingAfter: false,
      motif: fb.motif,
      scaleType,
      shotType,
      settingHint: fb.settingHint,
    })
  }

  return {
    segments,
    totalWordCount: segments.reduce((sum, s) => sum + s.wordCount, 0),
    avgPauseDuration: 1,
  }
}

// ============================================
// NARRATION FITTED TO TIMELINE (timeline-first flow)
// ============================================

const NARRATION_FOR_TIMELINE_PROMPT = `You are the narrator of an Orbit documentary. You are given a TIMELINE of beats. Write one calm narration segment for EVERY narrated beat, in order (one spoken line per shot). For breathing beats, write empty text (""). Each segment must fit its beat's duration (≈2.0 words per second). No advice, no motivation.

CRITICAL — DOCUMENTARY VOICE:
- Style: calm, observant documentary narrator (nature docs, contemplative films). Speaks in clear, complete sentences. You may briefly name what we see (place, movement, scale) and then reflect on it in one line. Observe, then land one clear feeling or idea.
- You can name what we see in a short phrase (e.g. "A whale surfaces" or "The city from above") and add one reflection. Do not list details or explain. The narrator guides the viewer through a journey — sometimes ahead of the image, sometimes with it.
- Examples (documentary-style): For a whale shot: "Something large moves through the water, unhurried. It has been doing this long before you arrived." For a falcon shot: "The air carries weight. Not just yours. Something else is riding it." For city traffic: "Movement does not always mean urgency."

EMOTIONAL DEPTH:
- Write lines the listener will feel in their chest, not just hear.
- Use BODY language: warmth, weight, pressure, breath, pulse, skin, gravity.
- Name specific textures and sensations: "the warmth at the back of your neck," "the weight of your hands resting," "the sound of your own breathing in a quiet room."
- Favor RECOGNITION over beauty — the best line is one where the viewer thinks "yes, that's exactly what that feels like" without being told to feel it.
- Never be clever. Never be poetic for its own sake. Be honest and plain.
- One powerful plain sentence beats three beautiful vague ones.
- Avoid repeating structural patterns across segments. If one line starts with "Something…" the next must not. Vary rhythm: short declarative, then long flowing, then a single word.
- Prefer concrete words (water, light, breath, distance, floor, weight) over abstract ones (meaning, existence, purpose) when both fit. The viewer should feel they are being shown something, not given a philosophy lecture.

THROUGH-LINE:
- The whole film should feel like one continuous observation or reflection. Later lines can echo an image or idea from earlier (e.g. "that distance," "this stillness," "what was moving"). Avoid standalone one-liners; build a single journey. Each segment should feel like the next sentence in a calm monologue.

SCALE COLLAPSE:
- The most powerful moments juxtapose vast with intimate in a single beat.
- After a cosmic observation, drop to something tiny and physical.
- Example: "Galaxies drift apart over millions of years. …Your shirt is warm from the dryer."
- This is what makes the viewer's breath catch.

GOLDEN LINE:
- One segment (usually Act 2 or early Act 3) must contain the "heart-stop" line — the single sentence the viewer will remember tomorrow.
- This line should be: under 10 words, physically specific, and hit the listener with an unexpected truth drawn from their own thought.
- Build the surrounding segments to lead toward and away from this moment.

PERCEPTUAL TARGET: {perceptualTarget}
{perceptualPostureSnippet}
- All narration lines should work toward this perceptual shift.

SCRIPT PACING (calm documentary): Speak in complete sentences. Use ellipses (…) sparingly — only for a genuine pause before a turn in thought. Avoid choppy, single-phrase lines. The rhythm should be even and unhurried, like a real documentary narrator. Prefer full sentences over fragments. The delivery should feel slow, spacious, and deeply calm — the kind of voice that is felt inside the viewer's heart, not just heard. Let words breathe.

CRITICAL — SEGMENT LENGTH: Each segment must USE THE FULL BEAT DURATION. Write approximately 2.0 words per second of the beat's duration (the voice speaks at 0.78x speed, so fewer words fill more time). An 8-second beat needs ~16 words, a 6-second beat needs ~12 words. Do NOT write short 5-word segments — that leaves the film silent for most of the beat. Each segment must be one or more complete sentences; do not end on a comma or an incomplete clause. Fill the time with calm, spaced phrasing and ellipses. The total narration should cover most of the 2-minute film.

RETURN ACT (last 15-20 seconds):
- Shift from external scale to BODILY STABILITY.
- Do NOT discuss: purpose, destiny, universe, humanity, insight, lessons.
- ONLY: continuation language. Body. Room. Senses.
- Examples: "The floor is still holding you." / "The air is still entering." / "Light is still reaching your eyes."
- Final 6-10 seconds: SILENCE. Write empty text for the last breathing beat.

ORBIT ACTS: Acts may be 4 or more (zoom-driven). Typical: self scale → social/biological → planetary → cosmic → return. The last act is always RETURN (back to human scale).

Output JSON only: { "segments": [ { "text": "...", "visualDescription": "filmable shot under 150 chars" }, ... ] }
One object per beat, in the same order as the beats list. visualDescription will become the video prompt for that beat. Prefer recognizable natural-world imagery: cosmos, Earth from space, oceans, whales, falcons, volcanoes, coral reefs, aurora, natural landscapes and wildlife. Favor non-human time and process over events. Avoid abstract vapor, breath fog, droplets on glass, or steam-like close-ups; favor realistic, documentary-style natural views. Visuals must be filmable within Orbit rules (no close humans, no indoor, no street-level). Do not include any words, titles, or on-screen text in visualDescription — visual imagery only.`

/**
 * Generate narration segments that fit the timeline (one segment per beat = one per shot).
 * Used in timeline-first flow: every shot gets a calm spoken narration line.
 */
export async function generateDocumentaryNarrationForTimeline(
  thought: string,
  understanding: DeepUnderstandingResult,
  perspective: PerspectivePostureResult,
  documentaryStructure: DocumentaryStructure,
  directorBrief: DirectorBrief,
  masterTimeline: MasterTimelineData,
  avoidList?: AvoidList,
  previousNarrationTexts?: string[]
): Promise<DocumentaryNarration> {
  const allBeats = masterTimeline.beats as TimelineBeat[]
  if (allBeats.length === 0) {
    return createFallbackNarration(documentaryStructure, perspective)
  }

  const numActs = documentaryStructure.acts.length
  const actScaleLabels = documentaryStructure.acts.map((a, i) => `Act ${i}: ${a.zoomLevel ?? a.actType}`).join(', ')
  const beatSlots = allBeats.map((b, i) => `Slot ${i}: act ${b.actIndex} (${documentaryStructure.acts[Math.min(b.actIndex, numActs - 1)]?.zoomLevel ?? documentaryStructure.acts[Math.min(b.actIndex, numActs - 1)]?.actType ?? '?'}), startSec ${b.startSec}, durationSec ${b.durationSec} (target ~${Math.round(b.durationSec * 2.0)} words minimum)`)
  const directorStr = `Tone: ${directorBrief.tone}. One-liner: ${directorBrief.oneLiner}. Key metaphors: ${directorBrief.keyMetaphors.join(', ')}.${directorBrief.visualGrammar ? ` Pacing: ${directorBrief.visualGrammar.pacingStyle}.` : ''}`
  let userContent = `DIRECTOR: ${directorStr}

ACT SCALES (describe scale transitions, not the thought): ${actScaleLabels}. Last act is always return (back to human scale).

Guiding question: ${understanding.guidingQuestion}. Posture: ${perspective.posture}. Perceptual target: ${perspective.perceptualTarget || 'present_continuation'}.

BEATS (write exactly ${allBeats.length} segments, one per shot, in this order; prepare the viewer's attention for each visual):
${beatSlots.join('\n')}

USER'S THOUGHT (reference indirectly; your job is to open sensory expectation—not to explain, advise, or describe):
"${thought.slice(0, 600)}"
`
  const thoughtAnchorsTimeline = understanding.thoughtAnchors
  if (thoughtAnchorsTimeline && thoughtAnchorsTimeline.length > 0) {
    userContent += `\n\nThought anchors (weave at least one indirectly into imagery; do not name them literally in narration): ${thoughtAnchorsTimeline.slice(0, 5).join(', ')}.`
  }
  if (avoidList && (avoidList.promptSnippets.length > 0 || avoidList.microActions.length > 0)) {
    userContent += `\n\nDo not repeat: ${avoidList.promptSnippets.slice(0, 10).join('; ')}`
  }
  if (previousNarrationTexts && previousNarrationTexts.length > 0) {
    userContent += `\n\nPrevious narrations (do NOT reuse): ${previousNarrationTexts.slice(0, 3).map((t) => `"${t.slice(0, 80)}"`).join('; ')}`
  }
  userContent += '\n\nOutput JSON with "segments" array: one { "text", "visualDescription" } per slot.'

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      temperature: 0.5,
      system: getTimelineNarrationSystemPrompt(perspective) + '\n\nCRITICAL: Respond ONLY with valid JSON. No preamble, no markdown. Format: { "segments": [ { "text": "...", "visualDescription": "..." }, ... ] }',
      messages: [{ role: 'user', content: userContent }],
    })
    const textContent = response.content.find((c) => c.type === 'text')
    const raw = typeof textContent?.type === 'string' && 'text' in textContent ? (textContent as { text: string }).text : ''
    if (!raw.trim()) throw new Error('Empty narration response')
    const jsonString = raw.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(jsonString) as {
      segments?: Array<{
        text?: string
        visualDescription?: string
        motif?: string
        settingHint?: string
      }>
    }
    const rawSegments = Array.isArray(parsed.segments) ? parsed.segments : []

    const segments: DocumentaryNarrationSegment[] = []
    const structure = documentaryStructure
    const nActs = structure.acts.length

    for (let i = 0; i < allBeats.length; i++) {
      const beat = allBeats[i]
      const rawSegment = rawSegments[i]
      const safeActIndex = Math.min(beat.actIndex, nActs - 1)
      const act = structure.acts[safeActIndex]
      const scaleType: ScaleType = act?.scaleType ?? (safeActIndex === 0 ? 'cosmic' : safeActIndex === nActs - 1 ? 'human' : 'global')
      const shotType: ShotTypeHint = scaleType === 'cosmic' ? 'slow_drift' : scaleType === 'global' ? 'aerial' : scaleType === 'personal' ? 'macro' : 'wide'

      let text = typeof rawSegment?.text === 'string' ? rawSegment.text.trim() : ''
      if (!text) text = getRandomFallback(safeActIndex).text
      const validation = validateNarrationText(text)
      if (!validation.valid) {
        const cleaned = removeBannedSentences(text)
        text = cleaned || getRandomFallback(safeActIndex).text
      }
      const maxWords = Math.max(8, Math.round(beat.durationSec * 2.0))
      text = trimToCompleteSentence(text, maxWords)
      const visualDescription = typeof rawSegment?.visualDescription === 'string' && rawSegment.visualDescription.trim().length >= 10
        ? rawSegment.visualDescription.trim()
        : getRandomFallback(safeActIndex).visualCue
      const wordCount = text.trim().split(/\s+/).length
      const visualCue = visualDescription.slice(0, 40)
      const motif = normalizeMotif(rawSegment?.motif, safeActIndex)
      const settingHintNorm = normalizeSettingHint(rawSegment?.settingHint, motif)

      segments.push({
        text,
        startTime: beat.startSec,
        duration: beat.durationSec,
        actIndex: beat.actIndex,
        pauseAfter: 1,
        wordCount,
        status: 'pending',
        beatIndex: beat.beatIndex,
        visualCue,
        visualDescription,
        breathingAfter: false,
        motif,
        scaleType,
        shotType,
        settingHint: settingHintNorm,
      })
    }

    const totalWordCount = segments.reduce((sum, s) => sum + s.wordCount, 0)
    const avgPauseDuration = segments.length ? segments.reduce((sum, s) => sum + s.pauseAfter, 0) / segments.length : 1
    return { segments, totalWordCount, avgPauseDuration }
  } catch (err) {
    console.warn('[generateDocumentaryNarrationForTimeline] failed, using beat-aligned fallback:', err instanceof Error ? err.message : err)
    return createBeatAlignedFallback(allBeats, documentaryStructure)
  }
}

// ============================================
// TTS GENERATION
// ============================================

export async function generateNarrationAudio(
  narration: DocumentaryNarration,
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'onyx'
): Promise<Map<number, Buffer>> {
  const audioMap = new Map<number, Buffer>()

  for (let i = 0; i < narration.segments.length; i++) {
    const segment = narration.segments[i]

    try {
      const response = await openai.audio.speech.create({
        model: 'tts-1-hd',
        voice,
        input: segment.text,
        speed: 0.78,
      })

      const arrayBuffer = await response.arrayBuffer()
      audioMap.set(i, Buffer.from(arrayBuffer))
    } catch (error) {
      console.error(`TTS failed for segment ${i}:`, error)
      audioMap.set(i, Buffer.alloc(0))
    }
  }

  return audioMap
}

// ============================================
// ELEVENLABS TTS
// ============================================

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'

/**
 * Generate narration audio via ElevenLabs text-to-speech. Same contract as generateNarrationAudio:
 * returns Map<segmentIndex, Buffer>. Returns empty Map if env is not set or on failure per segment.
 */
export async function generateNarrationAudioElevenLabs(
  narration: DocumentaryNarration
): Promise<Map<number, Buffer>> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim()
  if (!apiKey || !voiceId) {
    return new Map()
  }

  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || 'eleven_multilingual_v2'
  const stability =
    process.env.ELEVENLABS_STABILITY != null ? Number(process.env.ELEVENLABS_STABILITY) : 0.60
  const similarityBoost =
    process.env.ELEVENLABS_SIMILARITY_BOOST != null
      ? Number(process.env.ELEVENLABS_SIMILARITY_BOOST)
      : 0.75
  const styleExaggeration =
    process.env.ELEVENLABS_STYLE_EXAGGERATION != null
      ? Number(process.env.ELEVENLABS_STYLE_EXAGGERATION)
      : 0.25
  const useSpeakerBoost =
    process.env.ELEVENLABS_SPEAKER_BOOST !== undefined
      ? process.env.ELEVENLABS_SPEAKER_BOOST === 'true' || process.env.ELEVENLABS_SPEAKER_BOOST === '1'
      : true
  const speed = process.env.ELEVENLABS_SPEED != null ? Number(process.env.ELEVENLABS_SPEED) : 0.75

  const voiceSettings = {
    stability,
    similarity_boost: similarityBoost,
    style: styleExaggeration,
    use_speaker_boost: useSpeakerBoost,
  }

  const url = `${ELEVENLABS_BASE}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`
  const headers: Record<string, string> = {
    'xi-api-key': apiKey,
    'Content-Type': 'application/json',
  }

  // ElevenLabs free/starter tier allows max 3 concurrent requests. Process sequentially
  // to avoid 429 "concurrent_limit_exceeded" and ensure narration audio is generated.
  const CONCURRENCY = 2
  const audioMap = new Map<number, Buffer>()

  const fetchSegment = async (i: number, segment: DocumentaryNarrationSegment): Promise<Buffer> => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: segment.text,
          model_id: modelId,
          voice_settings: voiceSettings,
          speed,
        }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.error(`[ElevenLabs] TTS segment ${i} failed: ${res.status} ${text}`)
        return Buffer.alloc(0)
      }
      const arrayBuffer = await res.arrayBuffer()
      return Buffer.from(arrayBuffer)
    } catch (err) {
      console.error(`[ElevenLabs] TTS segment ${i} error:`, err instanceof Error ? err.message : err)
      return Buffer.alloc(0)
    }
  }

  for (let i = 0; i < narration.segments.length; i += CONCURRENCY) {
    const batch = narration.segments
      .slice(i, i + CONCURRENCY)
      .map((seg, j) => fetchSegment(i + j, seg))
    const results = await Promise.all(batch)
    results.forEach((buf, j) => {
      if (buf.length > 0) audioMap.set(i + j, buf)
    })
    // Small delay between batches to stay under rate limits
    if (i + CONCURRENCY < narration.segments.length) {
      await new Promise((r) => setTimeout(r, 300))
    }
  }
  return audioMap
}

// ============================================
// LEGACY COMPATIBILITY WRAPPERS
// ============================================

export interface NarrationSegmentResult {
  segmentType: string
  text: string
  audioUrl?: string
  duration?: number
  startTime?: number
  status: 'pending' | 'processing' | 'ready' | 'failed'
}

export async function generateNarrationSegments(
  thought: string,
  understanding: DeepUnderstandingResult,
  perspective: PerspectivePostureResult
): Promise<NarrationSegmentResult[]> {
  return [
    { segmentType: 'validation', text: 'Life is effort.', status: 'ready' },
    { segmentType: 'shared_perspective', text: 'Many carry weight that remains unseen.', status: 'ready' },
    { segmentType: 'agency', text: 'The world continues.', status: 'ready' },
  ]
}
