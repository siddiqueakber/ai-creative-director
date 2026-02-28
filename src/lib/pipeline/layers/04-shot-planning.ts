import type OpenAI from 'openai'
import type {
  SceneBlueprintResult,
  SceneBlueprintItem,
  SceneStyle,
  ShotPlan,
  DocumentaryStructure,
  DocumentaryNarration,
  DirectorBrief,
  AvoidList,
  ZoomLevel,
  SceneSetting,
} from '../types'

// ============================================
// MICRO-ACTIONS DATABASE
// ============================================

const MICRO_ACTIONS = {
  human: [
    'person adjusting backpack strap while walking',
    'hand wiping condensation from window',
    'person shifting weight from one foot to another',
    'fingers tapping on table',
    'person looking down then up',
    'hand pushing hair behind ear',
    'person taking a breath and exhaling',
    'shoulders relaxing slightly',
    'person walking slowly past camera',
    'hand reaching for door handle',
  ],
  nature: [
    'wind moving through tall grass',
    'leaves rustling in breeze',
    'clouds shifting shape',
    'water rippling from wind',
    'bird adjusting wings',
    'light shifting through clouds',
    'shadow moving across ground',
    'branch swaying gently',
    'dust particles floating in light',
    'steam rising from surface',
  ],
  urban: [
    'traffic light changing color',
    'person stepping off curb',
    'door slowly closing',
    'flag moving in wind',
    'paper blowing across ground',
    'streetlight flickering on',
    'bus door opening',
    'hand on railing while walking',
    'feet climbing stairs',
    'reflection changing in glass',
  ],
  cosmic: [
    'stars slowly rotating',
    'earth rotating in space',
    'clouds moving over surface',
    'terminator line moving across planet',
    'light changing on horizon',
    'atmosphere glowing',
    'satellite gliding through frame',
    'aurora moving across the poles',
    'thin atmospheric haze shifting',
  ],
  embodiment: [
    'steam curling from a warm cup of tea on a table',
    'rain droplets landing on a window pane',
    'fabric of a curtain moving in a breeze',
    'morning light slowly filling a quiet room',
    'shallow water rippling over smooth stones',
  ],
}

// ============================================
// TIME OF DAY LIGHTING
// ============================================

const TIME_OF_DAY_LIGHTING: Record<string, string> = {
  dawn: 'early dawn light, soft blue hour transitioning to warm, muted colors emerging',
  morning: 'soft morning light, gentle shadows, natural daylight beginning',
  midday: 'diffused midday light, even exposure, minimal shadows',
  afternoon: 'warm afternoon light, long soft shadows, golden undertones',
  dusk: 'golden hour fading to blue, warm streetlights beginning, transitional light',
  evening: 'blue hour, ambient city lights, quiet evening atmosphere',
  night: 'night scene, practical lights only, urban glow, no harsh contrast',
  space: 'deep black space, subtle atmospheric glow, distant sunlight rim light',
}

// ============================================
// SETTING DESCRIPTIONS
// ============================================

const SETTING_DESCRIPTIONS: Record<string, string> = {
  urban: 'city street, urban environment, everyday architecture',
  suburban: 'residential area, quiet neighborhood, ordinary homes',
  rural: 'countryside, natural landscape, open spaces',
  interior: 'indoor space, practical lighting, lived-in environment',
  transit: 'public transportation, commute scene, movement in confined space',
  workplace: 'work environment, practical space, tools of labor',
  public_space: 'public area, shared space, diverse presence',
  space: 'outer space, distant Earth, orbital view, thin atmosphere',
}

// ============================================
// DOCUMENTARY STYLE LOCK
// ============================================

const DOCUMENTARY_STYLE_LOCK_HUMAN = `Naturalistic documentary realism. Grounded observation, physically believable motion. No text, no logos, no fantasy, no cinematic hero shots. No exaggerated emotion.`
const DOCUMENTARY_STYLE_LOCK_COSMIC = `Naturalistic documentary realism. Stabilized slow drift. Archival space documentary feel, natural space lighting. No text, no logos, no fantasy, no cinematic hero shots. No exaggerated emotion.`

const ACT_CAMERA_HINTS: Record<SceneBlueprintItem['actType'], string> = {
  vast: 'static frame or slow drift, stabilized',
  living_dot: 'steady observational',
  miracle_of_you: 'intimate close-up of everyday objects and textures, stabilized',
  return: 'static or gentle follow, ordinary',
}

/** Zoom level → visuals and setting (Existential Scale Engine). Shot planning must obey scale. */
const ZOOM_VISUAL_MAP: Record<ZoomLevel, { setting: SceneSetting; visuals: string; cameraHint: string }> = {
  self: { setting: 'interior', visuals: 'room, face, desk, quiet domestic detail', cameraHint: 'intimate close-up of everyday objects and textures, stabilized' },
  social: { setting: 'urban', visuals: 'streets, crowds, city lights, human activity', cameraHint: 'steady observational' },
  biological: { setting: 'rural', visuals: 'forests, animals, ecosystems, life continuity', cameraHint: 'steady observational' },
  planetary: { setting: 'space', visuals: 'earth from orbit, earth biosphere, planet view', cameraHint: 'static frame or slow drift, stabilized' },
  cosmic: { setting: 'space', visuals: 'stars, galaxies, cosmic vastness, universe scale', cameraHint: 'static frame or slow drift, stabilized' },
  return: { setting: 'urban', visuals: 'ordinary street scene, people walking, daily routine, life continuing', cameraHint: 'static or gentle follow, ordinary' },
}

const NEGATIVE_PROMPT =
  'no cinematic lighting, no epic composition, no inspirational tone, no motivational language, no hero narrative, no idealized happiness, no text overlays, no titles, no logos, no slow motion drama'

// ============================================
// MICRO-ACTION SELECTION
// ============================================

const FRAMING_VARIATIONS = [
  'slight off-center framing',
  'subtle handheld sway',
  'static hold with gentle drift',
  'small reframing adjustment mid-shot',
  'low chest-height perspective',
  'higher eye-level perspective',
  'camera held slightly tilted',
]

function selectMicroAction(scene: SceneBlueprintItem, seed: number): string {
  const desc = scene.description.toLowerCase()
  const motif = scene.motif
  const scaleType = scene.scaleType

  // Select appropriate micro-action based on scene content
  if (
    desc.includes('space') ||
    desc.includes('earth') ||
    desc.includes('star') ||
    scene.setting === 'space' ||
    scaleType === 'cosmic' ||
    motif === 'earth_from_space' ||
    motif === 'starfield'
  ) {
    return MICRO_ACTIONS.cosmic[seed % MICRO_ACTIONS.cosmic.length]
  }

  if (scene.actType === 'miracle_of_you') {
    return MICRO_ACTIONS.embodiment[seed % MICRO_ACTIONS.embodiment.length]
  }

  if (
    desc.includes('person') ||
    desc.includes('worker') ||
    desc.includes('people') ||
    desc.includes('human')
  ) {
    return MICRO_ACTIONS.human[seed % MICRO_ACTIONS.human.length]
  }

  if (
    desc.includes('wind') ||
    desc.includes('cloud') ||
    desc.includes('water') ||
    desc.includes('nature')
  ) {
    return MICRO_ACTIONS.nature[seed % MICRO_ACTIONS.nature.length]
  }

  if (
    desc.includes('city') ||
    desc.includes('street') ||
    desc.includes('building') ||
    desc.includes('urban')
  ) {
    return MICRO_ACTIONS.urban[seed % MICRO_ACTIONS.urban.length]
  }

  // Default fallback
  return 'subtle natural movement visible in frame'
}

function selectFramingVariation(seed: number): string {
  return FRAMING_VARIATIONS[seed % FRAMING_VARIATIONS.length]
}

// ============================================
// RUNWAY DURATION NORMALIZATION
// ============================================

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

function getAllowedDurations(): number[] {
  const model = process.env.VEO_MODEL || process.env.RUNWAY_TEXT_TO_VIDEO_MODEL || 'veo-3.1-generate-001'
  return VEO_MODEL_DURATION_MAP[model] || [6, 8]
}

function normalizeRunwayDuration(duration: number): number {
  const allowed = getAllowedDurations()
  if (!Number.isFinite(duration) || duration <= 0) return allowed[0]
  return allowed.reduce((nearest, current) =>
    Math.abs(current - duration) < Math.abs(nearest - duration) ? current : nearest
  )
}

// ============================================
// SHOT-LEVEL BREAKDOWN
// ============================================

function breakSceneIntoShots(
  scene: SceneBlueprintItem,
  actIndex: number,
  baseClipIndex: number
): ShotPlan[] {
  const allowedDurations = getAllowedDurations()
  const targetShotDuration = allowedDurations[0]
  const calculatedShotCount = Math.max(1, Math.ceil(scene.duration / targetShotDuration))
  const shotCount = Math.min(2, calculatedShotCount)

  const shots: ShotPlan[] = []

  for (let i = 0; i < shotCount; i++) {
    const shotDuration = normalizeRunwayDuration(targetShotDuration)

    if (shotDuration < 1) continue // Skip very short shots

    const microAction = selectMicroAction(scene, baseClipIndex + i)
    const framingVariation = selectFramingVariation(baseClipIndex + i)

    shots.push({
      actIndex,
      clipIndex: baseClipIndex + i,
      duration: shotDuration,
      description: scene.description,
      microAction: `${microAction}; ${framingVariation}`,
      runwayPrompt: '',
      styleModifiers: [],
      timeOfDay: scene.timeOfDay,
      setting: scene.setting,
      source: 'GEN',
      reuseFrom: scene.reuseFrom,
      actType: scene.actType,
      beatIndex: scene.beatIndex,
      motif: scene.motif,
      scaleType: scene.scaleType,
      shotType: scene.shotType,
      visualCue: scene.visualCue,
    })
  }

  return shots
}

// ============================================
// RUNWAY PROMPT GENERATION
// ============================================

function generateRunwayPrompt(shot: ShotPlan, style: SceneStyle): string {
  const zoomMap = shot.zoomLevel ? ZOOM_VISUAL_MAP[shot.zoomLevel] : null
  const timeLight =
    (zoomMap?.setting ?? shot.setting) === 'space'
      ? TIME_OF_DAY_LIGHTING.space
      : TIME_OF_DAY_LIGHTING[shot.timeOfDay] || TIME_OF_DAY_LIGHTING.morning
  const settingDesc = zoomMap
    ? SETTING_DESCRIPTIONS[zoomMap.setting]
    : SETTING_DESCRIPTIONS[shot.setting] || SETTING_DESCRIPTIONS.urban
  const cameraHint = zoomMap
    ? zoomMap.cameraHint
    : (shot.actType ? ACT_CAMERA_HINTS[shot.actType] : undefined) || 'steady observational'
  const shotTypeHint = (() => {
    switch (shot.shotType) {
      case 'macro':
        return 'macro close-up'
      case 'aerial':
        return 'aerial view'
      case 'static':
        return 'static frame'
      case 'slow_drift':
        return 'slow drifting camera'
      case 'wide':
      default:
        return 'wide shot'
    }
  })()

  // Truncate description if too long
  let sceneDesc = shot.description
  if (sceneDesc.length > 150) {
    sceneDesc = sceneDesc.substring(0, 147) + '...'
  }

  // Build the prompt with micro-action emphasis; when zoom level is set, prefer its visuals
  const visualScope = zoomMap ? zoomMap.visuals : sceneDesc
  const positiveElements = [
    cameraHint,
    shotTypeHint,
    zoomMap ? visualScope : sceneDesc,
    shot.microAction,
    settingDesc,
    timeLight,
    'observational distance',
  ]

  const isCosmic =
    shot.zoomLevel === 'cosmic' ||
    shot.zoomLevel === 'planetary' ||
    shot.scaleType === 'cosmic' ||
    shot.setting === 'space' ||
    shot.motif === 'earth_from_space' ||
    shot.motif === 'starfield'

  const styleLock = isCosmic ? DOCUMENTARY_STYLE_LOCK_COSMIC : DOCUMENTARY_STYLE_LOCK_HUMAN

  const prompt = `${positiveElements.join(', ')}, ${NEGATIVE_PROMPT}. ${styleLock}`

  // Runway has a ~1000 character limit, ensure we're under it
  return prompt.length > 900 ? prompt.substring(0, 897) + '...' : prompt
}

// ============================================
// MAIN SHOT PLAN GENERATION
// ============================================

export function blueprintToShotPlan(
  blueprint: SceneBlueprintResult,
  documentaryStructure?: DocumentaryStructure
): ShotPlan[] {
  const allShots: ShotPlan[] = []
  let globalClipIndex = 0

  blueprint.scenes.forEach((scene) => {
    const actIndex = documentaryStructure
      ? Math.max(
          0,
          documentaryStructure.acts.findIndex((act) => act.actType === scene.actType)
        )
      : 0

    if (scene.sceneSource === 'STOCK') {
      allShots.push({
        actIndex,
        clipIndex: globalClipIndex,
        duration: scene.duration,
        description: scene.description,
        microAction: '',
        runwayPrompt: '',
        styleModifiers: [],
        timeOfDay: scene.timeOfDay,
        setting: scene.setting,
        source: 'STOCK',
        reuseFrom: scene.reuseFrom,
        actType: scene.actType,
        beatIndex: scene.beatIndex,
        motif: scene.motif,
        scaleType: scene.scaleType,
        shotType: scene.shotType,
        visualCue: scene.visualCue,
      })
      globalClipIndex += 1
      return
    }

    if (scene.sceneSource === 'HOLD') {
      allShots.push({
        actIndex,
        clipIndex: globalClipIndex,
        duration: scene.duration,
        description: scene.description,
        microAction: '',
        runwayPrompt: '',
        styleModifiers: [],
        timeOfDay: scene.timeOfDay,
        setting: scene.setting,
        source: 'HOLD',
        reuseFrom: scene.reuseFrom,
        actType: scene.actType,
        beatIndex: scene.beatIndex,
        motif: scene.motif,
        scaleType: scene.scaleType,
        shotType: scene.shotType,
        visualCue: scene.visualCue,
      })
      globalClipIndex += 1
      return
    }

    // GEN: Break scene into shots
    const sceneShots = breakSceneIntoShots(scene, actIndex, globalClipIndex)

    // Generate Runway prompts for each shot
    sceneShots.forEach((shot) => {
      shot.runwayPrompt = generateRunwayPrompt(shot, blueprint.style)
      shot.styleModifiers = [
        blueprint.style.texture,
        blueprint.style.colorGrade,
        blueprint.style.mood,
      ]
    })

    allShots.push(...sceneShots)
    globalClipIndex += sceneShots.length
  })

  return allShots
}

// ============================================
// OPENAI SHOT PROMPT REFINEMENT (Phase 5)
// ============================================

const SHOT_REFINE_SYSTEM = `You are a documentary cinematographer. Given a scene description, narration text, act type, director brief, and avoid list, output a single short, filmable shot prompt (under 200 characters). The visual MUST serve the narration — show what the narrator is describing. No preamble. Naturalistic, observational. No cinematic or motivational language. Do NOT include any words, phrases, or title-like text in the prompt; the image must contain zero on-screen text, no titles, no logos, no watermark. Output only the prompt text.`

/**
 * Refine each shot's runway prompt with GPT-4o for variety and alignment with the director brief.
 * When masterTimeline is provided, pass beat metadata (visualCategory, cameraGrammar, lighting) so the refiner keeps them consistent.
 * When narration is provided, include the narration text so the refiner aligns visuals to what is being said.
 * Layer 6 will still apply style lock and negative block.
 */
export async function refineShotPromptsWithOpenAI(
  openai: OpenAI,
  shots: ShotPlan[],
  directorBrief: DirectorBrief,
  avoidList: AvoidList,
  masterTimeline?: { beats: { visualCategory: string; cameraGrammar: unknown; lighting: unknown; narrationText?: string }[] },
  narration?: DocumentaryNarration
): Promise<ShotPlan[]> {
  const toRefine = shots.filter((s) => s.source === 'GEN' && s.runwayPrompt)
  if (toRefine.length === 0) return shots

  const avoidStr =
    avoidList.promptSnippets.length > 0
      ? `Avoid reusing these phrases: ${avoidList.promptSnippets.slice(0, 6).join('; ')}. `
      : ''

  const out = [...shots]
  for (let i = 0; i < toRefine.length; i++) {
    const shot = toRefine[i]
    const idx = shots.indexOf(shot)
    if (idx < 0) continue

    const beatMeta =
      masterTimeline?.beats[idx] != null
        ? ` Keep: visual ${masterTimeline.beats[idx].visualCategory}, camera ${JSON.stringify(masterTimeline.beats[idx].cameraGrammar)}, lighting ${JSON.stringify(masterTimeline.beats[idx].lighting)}.`
        : ''

    // Find the narration segment that corresponds to this shot (match by beatIndex or index)
    const narrationSeg = narration?.segments.find((s) => s.beatIndex === shot.beatIndex) ?? narration?.segments[idx]
    const narrationContext = narrationSeg
      ? `\nNarration over this shot: "${narrationSeg.text}". Visual description: "${narrationSeg.visualDescription || narrationSeg.visualCue}". The shot must visually serve this narration.`
      : ''
    const zoomConstraint = shot.zoomLevel && ZOOM_VISUAL_MAP[shot.zoomLevel]
      ? ` Zoom level: ${shot.zoomLevel}. Visuals must be scale-appropriate: ${ZOOM_VISUAL_MAP[shot.zoomLevel].visuals}.`
      : ''

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SHOT_REFINE_SYSTEM },
          {
            role: 'user',
            content: `Director brief: ${directorBrief.oneLiner}. Tone: ${directorBrief.tone}. Key metaphors: ${directorBrief.keyMetaphors.join(', ')}.${directorBrief.visualGrammar ? ` Visual grammar: ${directorBrief.visualGrammar.motionStyle}, ${directorBrief.visualGrammar.lensStyle}, ${directorBrief.visualGrammar.transitionStyle} — match this style.` : ''}

Scene: ${shot.description}. Act: ${shot.actType ?? 'unknown'}. Setting: ${shot.setting}. Micro-action: ${shot.microAction}.${zoomConstraint}${beatMeta}${narrationContext}
${avoidStr}
Output one short filmable shot prompt (under 200 chars), observational only.`,
          },
        ],
        temperature: 0.5,
        max_completion_tokens: 120,
      })
      const text = response.choices[0]?.message?.content?.trim()
      if (text && text.length <= 400) {
        out[idx] = { ...out[idx], runwayPrompt: text }
      }
    } catch (_) {
      // keep existing runwayPrompt on error
    }
  }
  return out
}

// ============================================
// LEGACY COMPATIBILITY
// ============================================

// Keep old function name for backward compatibility
export function sceneToRunwayPrompt(
  scene: SceneBlueprintItem,
  style: SceneStyle
): string {
  const shot: ShotPlan = {
    actIndex: 0,
    clipIndex: 0,
    duration: scene.duration,
    description: scene.description,
    microAction: selectMicroAction(scene, 0),
    runwayPrompt: '',
    styleModifiers: [],
    timeOfDay: scene.timeOfDay,
    setting: scene.setting,
    source: scene.sceneSource,
    reuseFrom: scene.reuseFrom,
    actType: scene.actType,
    beatIndex: scene.beatIndex,
    motif: scene.motif,
    scaleType: scene.scaleType,
    shotType: scene.shotType,
    visualCue: scene.visualCue,
  }

  return generateRunwayPrompt(shot, style)
}

export function blueprintToRunwayPrompts(blueprint: SceneBlueprintResult): string[] {
  return blueprint.scenes.map((scene) => sceneToRunwayPrompt(scene, blueprint.style))
}
