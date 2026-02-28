import type { Scene, SceneBlueprint, SceneStyle } from '@/lib/services/scene-blueprint'

// ============================================
// DOCUMENTARY-STYLE PROMPT TEMPLATES
// Optimized for short visual essays
// ============================================

// Base style elements for ALL documentary prompts
const DOCUMENTARY_BASE = {
  camera: 'handheld camera, imperfect framing, slight natural movement',
  lighting: 'natural lighting, slightly muted, no artificial sources',
  color: 'slightly desaturated colors, warm shadows, cool highlights',
  texture: '35mm film grain, subtle noise',
  style: 'documentary footage, observational, candid',
  mood: 'quiet, contemplative, real',
}

// Negative prompts - what to AVOID
const DOCUMENTARY_NEGATIVES = [
  'no dramatic angles',
  'no cinematic lens flares',
  'no slow motion effects',
  'no glamorous lighting',
  'no studio setup',
  'no posed subjects',
  'no perfect symmetry',
  'no faces in focus',
  'no emotional expressions',
  'no idealized scenes',
  'no motivational imagery',
  'no text overlays',
  'no CGI effects',
  'no color grading extremes'
]

// Time of day lighting descriptions
const TIME_OF_DAY_LIGHTING: Record<string, string> = {
  dawn: 'early dawn light, soft blue hour transitioning to warm, muted colors emerging',
  morning: 'soft morning light, gentle shadows, natural daylight beginning',
  midday: 'diffused midday light, even exposure, minimal shadows',
  afternoon: 'warm afternoon light, long soft shadows, golden undertones',
  dusk: 'golden hour fading to blue, warm streetlights beginning, transitional light',
  evening: 'blue hour, ambient city lights, quiet evening atmosphere',
  night: 'night scene, practical lights only, urban glow, no harsh contrast'
}

// Setting descriptions
const SETTING_DESCRIPTIONS: Record<string, string> = {
  urban: 'city street, urban environment, everyday architecture',
  suburban: 'residential area, quiet neighborhood, ordinary homes',
  rural: 'countryside, natural landscape, open spaces',
  interior: 'indoor space, practical lighting, lived-in environment',
  transit: 'public transportation, commute scene, movement in confined space',
  workplace: 'work environment, practical space, tools of labor',
  public_space: 'public area, shared space, diverse presence'
}

/**
 * Convert a scene description to a Runway-optimized prompt
 * IMPORTANT: Must stay under 1000 characters total (Runway API limit)
 */
export function sceneToRunwayPrompt(scene: Scene, style: SceneStyle): string {
  const timeLight = TIME_OF_DAY_LIGHTING[scene.timeOfDay] || TIME_OF_DAY_LIGHTING.morning
  const settingDesc = SETTING_DESCRIPTIONS[scene.setting] || SETTING_DESCRIPTIONS.urban

  // Truncate scene description if too long (keep under 200 chars)
  let sceneDesc = scene.description
  if (sceneDesc.length > 200) {
    sceneDesc = sceneDesc.substring(0, 197) + '...'
  }

  // Build concise prompt - prioritize essential elements
  const positiveElements = [
    'Photorealistic documentary',
    'handheld camera',
    sceneDesc,
    settingDesc,
    timeLight,
    '35mm film grain'
  ]

  return `${positiveElements.join(', ')}. No faces, no drama.`
}

/**
 * Convert a full blueprint to an array of Runway prompts
 */
export function blueprintToRunwayPrompts(blueprint: SceneBlueprint): string[] {
  return blueprint.scenes.map(scene => 
    sceneToRunwayPrompt(scene, blueprint.style)
  )
}

/**
 * Get the negative prompt string for Runway (if supported)
 */
export function getRunwayNegativePrompt(): string {
  return DOCUMENTARY_NEGATIVES.join(', ')
}

// ============================================
// PRE-BUILT PROMPT TEMPLATES BY THEME
// ============================================

export const DOCUMENTARY_SCENE_TEMPLATES = {
  // Human scale scenes
  early_commute: `Photorealistic documentary footage, handheld camera, early morning city street, workers walking to jobs, natural dawn light, slightly muted colors, 35mm film grain, quiet observational mood, imperfect framing, no faces in focus, no dramatic angles.`,

  hands_at_work: `Photorealistic documentary footage, handheld camera, close-up of hands performing repetitive work, natural lighting, slightly desaturated, warm shadows, 35mm film grain, observational style, no faces visible, quiet and focused.`,

  public_transit: `Photorealistic documentary footage, handheld camera, inside public transit, passengers in their own worlds, morning commute light through windows, slightly muted colors, film grain texture, imperfect framing, candid observation.`,

  evening_walk: `Photorealistic documentary footage, handheld camera, person walking on ordinary street at dusk, warm streetlights beginning, natural shadows, 35mm film grain, quiet contemplative mood, no face visible, just movement forward.`,

  // Uncertainty scenes
  crossroads: `Photorealistic documentary footage, handheld camera, urban intersection, people moving in different directions, morning light, slightly desaturated, observational distance, no faces in focus, metaphor of choices.`,

  window_pause: `Photorealistic documentary footage, handheld camera, silhouette at window, natural daylight, interior space, quiet moment of thought, slightly muted colors, 35mm film grain, contemplative mood.`,

  weather_change: `Photorealistic documentary footage, handheld camera, sky with moving clouds, changing weather, natural light shifting, wide shot, quiet observation of time passing, no people visible.`,

  // Strain and endurance scenes
  tired_rest: `Photorealistic documentary footage, handheld camera, hands resting on lap or table, brief pause from work, natural afternoon light, warm shadows, intimate framing, quiet exhaustion without drama.`,

  coffee_shop_alone: `Photorealistic documentary footage, handheld camera, coffee shop interior, people sitting alone but together, natural window light, slightly muted colors, observational distance, quiet public solitude.`,

  end_of_day: `Photorealistic documentary footage, handheld camera, workplace at end of day, putting things away, natural evening light, slightly desaturated, tired satisfaction, no faces in focus.`,

  // Continuation scenes
  morning_routine: `Photorealistic documentary footage, handheld camera, kitchen or bathroom morning routine, natural dawn light, intimate but not intrusive, ordinary preparation, 35mm film grain, quiet determination.`,

  steady_work: `Photorealistic documentary footage, handheld camera, person engaged in focused work, natural lighting, steady hands, repetitive motion, observational without judgment, quiet dignity of labor.`,

  lights_at_dusk: `Photorealistic documentary footage, handheld camera, apartment windows lit at dusk, urban evening, warm interior glows, life continuing behind walls, wide shot, quiet observation.`,

  // Impermanence scenes
  clouds_parting: `Photorealistic documentary footage, handheld camera, sky with clouds slowly parting, natural light changing, time passing, no ground visible, just sky in transition, quiet hope without drama.`,

  seasons_visible: `Photorealistic documentary footage, handheld camera, natural scene showing seasonal transition, fallen leaves or emerging buds, natural light, observational distance, time made visible.`,

  dawn_replacing_night: `Photorealistic documentary footage, handheld camera, horizon at dawn, night blue giving way to warm light, slow transition, quiet observation of renewal, no people visible.`,

  // Dignity in effort scenes
  careful_hands: `Photorealistic documentary footage, handheld camera, close-up of hands working carefully, craft or repair, natural light, attention to simple task, 35mm film grain, dignity in small actions.`,

  workspace_end: `Photorealistic documentary footage, handheld camera, workspace after work is done, tools put away, natural evening light, quiet satisfaction, no people visible, evidence of effort.`,

  simple_completion: `Photorealistic documentary footage, handheld camera, simple task being completed, folding, closing, finishing, natural light, quiet moment of done, observational without celebration.`
}

/**
 * Get a template prompt by key
 */
export function getTemplatePrompt(key: keyof typeof DOCUMENTARY_SCENE_TEMPLATES): string {
  return DOCUMENTARY_SCENE_TEMPLATES[key]
}

/**
 * Match a scene description to the closest template (fallback)
 */
export function matchSceneToTemplate(scene: Scene): string {
  const desc = scene.description.toLowerCase()

  // Simple keyword matching
  if (desc.includes('commut') || desc.includes('walking to')) return DOCUMENTARY_SCENE_TEMPLATES.early_commute
  if (desc.includes('hands') && desc.includes('work')) return DOCUMENTARY_SCENE_TEMPLATES.hands_at_work
  if (desc.includes('transit') || desc.includes('bus') || desc.includes('train')) return DOCUMENTARY_SCENE_TEMPLATES.public_transit
  if (desc.includes('evening') && desc.includes('walk')) return DOCUMENTARY_SCENE_TEMPLATES.evening_walk
  if (desc.includes('cross') || desc.includes('intersection')) return DOCUMENTARY_SCENE_TEMPLATES.crossroads
  if (desc.includes('window')) return DOCUMENTARY_SCENE_TEMPLATES.window_pause
  if (desc.includes('cloud') || desc.includes('weather')) return DOCUMENTARY_SCENE_TEMPLATES.weather_change
  if (desc.includes('rest') || desc.includes('tired')) return DOCUMENTARY_SCENE_TEMPLATES.tired_rest
  if (desc.includes('coffee')) return DOCUMENTARY_SCENE_TEMPLATES.coffee_shop_alone
  if (desc.includes('end of day') || desc.includes('putting away')) return DOCUMENTARY_SCENE_TEMPLATES.end_of_day
  if (desc.includes('morning routine')) return DOCUMENTARY_SCENE_TEMPLATES.morning_routine
  if (desc.includes('steady') || desc.includes('focused work')) return DOCUMENTARY_SCENE_TEMPLATES.steady_work
  if (desc.includes('lights') && desc.includes('dusk')) return DOCUMENTARY_SCENE_TEMPLATES.lights_at_dusk
  if (desc.includes('dawn')) return DOCUMENTARY_SCENE_TEMPLATES.dawn_replacing_night
  if (desc.includes('careful hands')) return DOCUMENTARY_SCENE_TEMPLATES.careful_hands

  // Default fallback - generate from scene
  return sceneToRunwayPrompt(scene, {
    visual: 'photorealistic',
    camera: 'handheld, imperfect framing',
    lighting: 'natural, slightly muted',
    pace: 'slow',
    mood: 'quiet, observational',
    colorGrade: 'slightly desaturated, warm shadows',
    texture: '35mm film grain'
  })
}
