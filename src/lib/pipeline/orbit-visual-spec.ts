/**
 * Orbit visual spec: single source of truth for Veo prompt rules.
 * Non-human time bias, process over events, no forbidden content.
 */

import type { DocumentaryActType } from './types'

export const NON_HUMAN_TIME_EXAMPLES = [
  'glacier drift',
  'ocean tides',
  'cloud formation',
  'animal migration',
  'forest growth',
  'planetary rotation',
  'erosion',
  'coral development',
  'whale movement',
  'seasonal cycles',
  'deep ocean',
  'bioluminescence',
  'volcanic flow',
  'falcon in flight',
  'Earth from orbit',
  'day-night terminator',
] as const

export const VISUAL_RULES_SHORT =
  'Observational, slow movement, process over events, change across time. Humans never primary subject. No close-ups of people, no indoor environments, no street-level human activity, no dialogue. Cities only from aerial or orbital view as systems (e.g. traffic flow).'

export const BANNED_VISUAL_PHRASES = [
  'person walking',
  'close-up of',
  'indoor',
  'kitchen',
  'street-level',
  'two people talking',
  'commuters',
  'residential street',
  'close-up of palm',
  'close-up of bare',
  'bus stop',
  'single person walking',
  'breath fogging',
  'light through skin',
  'vapor on',
  'steam rising from a cup',
  'droplets on glass',
  'candle flame',
].map((p) => p.toLowerCase())

export const MIRACLE_EMBRYOLOGY_PROMPTS = {
  nonHuman:
    'Time-lapse of an embryo developing inside an egg, natural history documentary style, soft light, no humans.',
  abstractDevelopment:
    'Abstract representation of biological development over time, soft light, cellular to form, scientific visualization style, no humans.',
  fallbacks: [
    'Rain droplets on still water, macro, natural light. Calm, observational.',
  ],
} as const

export const NATURAL_WORLD_MIRACLE_PROMPTS = [
  'Whale moving through deep blue ocean, natural history documentary style, soft underwater light. No humans.',
  'Falcon soaring over a canyon at golden hour, wide shot, stabilized camera. No humans.',
  'Earth from space at night, city lights and day-night terminator, slow drift. No humans.',
  'Underwater bioluminescence in deep ocean, calm movement, soft blue light. No humans.',
  'Volcanic lava flow meeting the ocean at dusk, wide shot, natural light. No humans.',
  'Sun breaking through clouds over open ocean, time-lapse, observational. No humans.',
  'Humpback whale breaching in grey open ocean, natural history style, stabilized camera. No humans.',
  'Coral reef teeming with life, slow drift, underwater documentary style, soft light. No humans.',
  'Aurora borealis over a frozen landscape, slow movement, wide shot. No humans.',
  'Time-lapse of an embryo developing inside an egg, natural history documentary style, soft light, no humans.',
  'Rain droplets on still water, macro, natural light. Calm, observational. No humans.',
] as const

const ORBIT_NEGATIVE_LIST =
  'no close-up human subjects, no faces, no indoor environments, no street-level human activity, no dialogue, no social interaction, humans must not be primary subject'

export function getOrbitNegativeSuffix(): string {
  return ORBIT_NEGATIVE_LIST
}

export function isVeoPromptAllowed(prompt: string): boolean {
  const lower = prompt.toLowerCase()
  return !BANNED_VISUAL_PHRASES.some((phrase) => lower.includes(phrase))
}

const VAST_SAFE = 'Starfield or Earth from space, slow drift, cosmic scale. No humans.'
const LIVING_DOT_SAFE =
  'Wide view of a green valley with a river flowing through it at golden hour. Steady camera. Natural light.'
const RETURN_SAFE =
  'Wide aerial view of city lights at night, traffic flow like circulation. No street-level, no close humans.'

export function replaceWithFallback(actType: DocumentaryActType, _prompt: string): string {
  switch (actType) {
    case 'vast':
      return VAST_SAFE
    case 'living_dot':
      return LIVING_DOT_SAFE
    case 'miracle_of_you':
      return NATURAL_WORLD_MIRACLE_PROMPTS[0]
    case 'return':
      return RETURN_SAFE
    default:
      return NATURAL_WORLD_MIRACLE_PROMPTS[0]
  }
}
