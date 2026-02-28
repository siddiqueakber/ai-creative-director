export type PipelineStatus =
  | 'pending'
  | 'understanding'
  | 'blueprint'
  | 'generating'
  | 'assembling'
  | 'ready'
  | 'failed'

export type OrbitNeed =
  | "broaden-perspective"
  | "reduce-future-fear"
  | "dissolve-hopelessness"
  | "restore-agency"
  | "soften-ego"
  | "reduce-numbness"
  | "accept-struggle"

export interface OrbitIntent {
  primaryNeed: OrbitNeed
  secondaryNeed: OrbitNeed | null
  avoid: string[] // Must include: "advice", "definitions", "productivity framing", "preachy tone"
  actWeights: {
    vast: number      // VAST (universe scale)
    earth: number     // LIVING DOT (earth + life continuity)
    embryology: number // MIRACLE OF YOU (embodiment/breath/senses)
    return: number    // RETURN (ordinary life integration)
  } // Must sum to 1.0
  endingRule: "return-to-ordinary-life"
}

export type AttentionBias = 'future_locked' | 'past_anchored' | 'present_dissociated' | 'self_focused' | 'other_focused'
export type TemporalFixation = 'forward_projection' | 'retrospective_loop' | 'frozen_present'
export type AgencyDistortion = 'outcome_dependence' | 'control_fixation' | 'learned_helplessness' | 'none'

export interface CognitiveState {
  attentionBias: AttentionBias
  temporalFixation: TemporalFixation
  agencyDistortion: AgencyDistortion
}

export type PerceptualTarget =
  | 'present_continuation'
  | 'forward_flow'
  | 'embodied_sensation'
  | 'parallel_existence'
  | 'autonomous_processes'
  | 'scale_displacement'

export interface DeepUnderstandingResult {
  coreTension: string
  centralParadox: string
  humanStakes: string
  keyConcepts: string[]
  guidingQuestion: string
  narrativeAngle: string
  orbitIntent: OrbitIntent
  cognitiveState: CognitiveState
  /** 3–5 concrete nouns/phrases from the user's thought for imagery (optional). */
  thoughtAnchors?: string[]
}

export type PerspectivePosture =
  | "humbling_continuity"
  | "grounded_endurance"
  | "quiet_awe"
  | "embodied_fragility"
  | "patient_return"

export type PacingBias = 
  | "slow_opening_slow_close"
  | "slow_opening_quiet_close"
  | "even_pacing"

export interface PerspectivePostureResult {
  posture: PerspectivePosture
  emotionalTone: string // e.g. "awe → grounded", "quiet → accepting"
  cameraBias: string[] // e.g. ["wide", "slow", "observational"]
  narrationBias: string[] // e.g. ["descriptive", "non-authoritative", "patient"]
  pacingBias: PacingBias
  reinforceActs: string[] // subset of ["vast", "earth", "embryology", "return"]
  avoid: string[] // must include: ["advice", "definitions", "productivity framing", "preachy tone"]
  perceptualTarget: PerceptualTarget
  // Backward compatibility (deprecated)
  perspectiveType?: any
  message?: string
}

export type PerspectiveType =
  | 'cosmic_awe'
  | 'human_condition'
  | 'struggle_and_survival'
  | 'search_for_meaning'
  | 'mystery_of_being'
  | 'shared_continuance'

export interface PerspectiveSelectionResult {
  perspectiveType: PerspectiveType
  message: string
  avoid: string[]
}

export interface SceneStyle {
  visual: 'photorealistic'
  camera: 'handheld, imperfect framing'
  lighting: 'natural, slightly muted'
  pace: 'slow'
  mood: 'quiet, observational'
  colorGrade: 'slightly desaturated, warm shadows'
  texture: '35mm film grain'
}

export type SceneTimeOfDay =
  | 'dawn'
  | 'morning'
  | 'midday'
  | 'afternoon'
  | 'dusk'
  | 'evening'
  | 'night'

export type SceneSetting =
  | 'urban'
  | 'suburban'
  | 'rural'
  | 'interior'
  | 'transit'
  | 'workplace'
  | 'public_space'
  | 'space'

export type SceneSource = 'GEN' | 'STOCK' | 'HOLD'

export interface SceneBlueprintItem {
  description: string
  symbolism: string
  duration: number
  timeOfDay: SceneTimeOfDay
  setting: SceneSetting
  sceneSource: SceneSource
  actType: DocumentaryActType
  reuseFrom?: number
  beatIndex?: number
  motif?: NarrationMotif
  scaleType?: ScaleType
  shotType?: ShotTypeHint
  visualCue?: string
}

export interface SceneBlueprintResult {
  style: SceneStyle
  scenes: SceneBlueprintItem[]
  constraints: string[]
  totalDuration: number
}

export interface NarrationSegmentResult {
  segmentType: 'validation' | 'shared_perspective' | 'agency'
  text: string
  audioUrl?: string
  duration?: number
  startTime?: number
  status: 'pending' | 'processing' | 'ready' | 'failed'
}

export interface RunwayJobResult {
  jobId: string
  status: 'pending' | 'processing' | 'ready' | 'failed'
  videoUrl?: string
  errorMessage?: string
}

// Hybrid Director: avoid list from last N videos
export interface AvoidList {
  actTypes: string[]
  settings: string[]
  microActions: string[]
  promptSnippets: string[]
}

// Fingerprint for novelty check (one per video)
export interface VideoFingerprint {
  motifs: string[]
  actTypes: string[]
  settings: string[]
}

// Hybrid Director: archetype and shot constraints
export type OrbitArchetype =
  | 'cosmic_first'
  | 'human_first'
  | 'parallel_lives'
  | 'conflict'
  | 'abstract'

export interface ShotConstraints {
  noRepeatMotifInRow: boolean
  minMetaphorShotsPerAct: number
  maxShotsSameType: number
}

// Visual Grammar: how the film looks and moves; all downstream steps obey this.
export type MotionStyle = 'slow_cinematic_drift' | 'locked_off' | 'handheld_subtle'
export type LensStyle = 'wide_angle' | 'normal' | 'mixed'
export type TransitionStyle = 'dissolve' | 'cut' | 'match_cut'
export type PacingStyle = 'contemplative' | 'even' | 'slow_open_quiet_close'

export interface VisualGrammar {
  motionStyle: MotionStyle
  lensStyle: LensStyle
  transitionStyle: TransitionStyle
  pacingStyle: PacingStyle
}

// Director Brief (one GPT-4o call per run)
export interface DirectorBrief {
  tone: string
  keyMetaphors: string[]
  avoidPacing: string
  oneLiner: string
  visualGrammar?: VisualGrammar
}

// ============================================
// EXISTENTIAL SCALE ENGINE TYPES
// ============================================

export type ScaleNeedType =
  | 'PERSONAL'
  | 'TEMPORAL'
  | 'BIOLOGICAL'
  | 'CIVILIZATIONAL'
  | 'PLANETARY'
  | 'COSMIC'

export interface ScaleNeedClassification {
  scaleNeedTypes: ScaleNeedType[]
}

/** Ordered zoom steps; must end with "return to self". */
export type ZoomPath = string[]

export type ZoomLevel =
  | 'self'
  | 'social'
  | 'biological'
  | 'planetary'
  | 'cosmic'
  | 'return'

// ============================================
// DOCUMENTARY DIRECTOR TYPES
// ============================================

export type DocumentaryActType =
  | 'vast'
  | 'living_dot'
  | 'miracle_of_you'
  | 'return'

export type ScaleType = 'cosmic' | 'global' | 'human' | 'personal'

export type NarrationStyle = 'sparse' | 'moderate' | 'minimal'

export type NarrationMotif =
  | 'earth_from_space'
  | 'starfield'
  | 'city_lights'
  | 'human_labor'
  | 'struggle_survival'
  | 'quiet_return'
  | 'shared_continuance'
  | 'ocean_current'
  | 'mountain_ridge'
  | 'urban_night'
  | 'desert_stillness'
  | 'forest_canopy'
  | 'domestic_detail'
  | 'crowd_motion'
  | 'industrial_hum'

export type ShotTypeHint = 'wide' | 'macro' | 'aerial' | 'static' | 'slow_drift'

export interface NarrationTiming {
  startTime: number
  allowedDuration: number
}

// Act-level choreography for timeline (emotional phase, pacing, camera, narration presence).
export type EmotionalPhase = 'awe' | 'human_reality' | 'reflection' | 'return'
export type ActPacingSpeed = 'slow' | 'medium' | 'quiet_close'
export type NarrationPresence = 'minimal' | 'active' | 'sparse'

export interface DocumentaryAct {
  actType: DocumentaryActType
  duration: number
  scaleType: ScaleType
  visualRequirements: string[]
  narrationTiming: NarrationTiming[]
  silenceDuration: number
  // Optional choreography for timeline generator (emotional phase, pacing, camera, narration).
  emotionalPhase?: EmotionalPhase
  pacingSpeed?: ActPacingSpeed
  cameraBias?: string
  narrationPresence?: NarrationPresence
  shotLengthRange?: [number, number]
  // Existential Scale Engine: zoom-driven acts
  zoomLevel?: ZoomLevel
  zoomStepLabel?: string
}

export interface DocumentaryStructure {
  acts: DocumentaryAct[]
  totalDuration: number
  intensityLevel: number
  narrationStyle: NarrationStyle
}

export interface ShotPlan {
  actIndex: number
  clipIndex: number
  duration: number
  description: string
  microAction: string
  runwayPrompt: string
  styleModifiers: string[]
  timeOfDay: SceneTimeOfDay
  setting: SceneSetting
  source: SceneSource
  reuseFrom?: number
  actType?: DocumentaryActType
  beatIndex?: number
  motif?: NarrationMotif
  scaleType?: ScaleType
  shotType?: ShotTypeHint
  visualCue?: string
  /** From Existential Scale Engine; used for scale-appropriate visuals. */
  zoomLevel?: ZoomLevel
}

export interface DocumentaryNarrationSegment {
  text: string
  startTime: number
  duration: number
  actIndex: number
  pauseAfter: number
  audioUrl?: string
  wordCount: number
  status: 'pending' | 'processing' | 'ready' | 'failed'
  beatIndex?: number
  visualCue: string
  visualDescription?: string // detailed filmable scene description for Veo prompt derivation
  breathingAfter?: boolean   // suggest a breathing beat after this segment
  motif: NarrationMotif
  scaleType: ScaleType
  shotType: ShotTypeHint
  settingHint: SceneSetting
  coveredByClipIndices?: number[]
}

export interface DocumentaryNarration {
  segments: DocumentaryNarrationSegment[]
  totalWordCount: number
  avgPauseDuration: number
}

// ============================================
// MASTER TIMELINE TYPES
// ============================================

export type TimelineBeatType = 'narrated' | 'breathing' | 'transition'

export type TimelineVisualCategory =
  | 'cosmos'
  | 'earth'
  | 'human'
  | 'nature'
  | 'abstract'
  | 'conflict'
  | 'ocean'
  | 'domestic'
  | 'industrial'
  | 'desert'

export type CameraMotion = 'slow_drift' | 'slow_push' | 'locked_off' | 'handheld'
export type CameraFraming = 'wide' | 'medium' | 'close'
export type CameraLens = 'wide' | 'normal' | 'tele'

export interface CameraGrammar {
  motion: CameraMotion
  framing: CameraFraming
  lens: CameraLens
}

export type LightingTimeOfDay = 'night' | 'dawn' | 'day' | 'dusk'
export type LightingContrast = 'low' | 'medium' | 'high'

export interface TimelineLighting {
  timeOfDay: LightingTimeOfDay
  contrast: LightingContrast
}

export type TransitionOut = 'cut' | 'dissolve' | 'match_cut'

export interface TimelineBeat {
  beatIndex: number
  actIndex: number
  startSec: number
  endSec: number
  durationSec: number
  beatType: TimelineBeatType
  visualCategory: TimelineVisualCategory
  cameraGrammar: CameraGrammar
  lighting: TimelineLighting
  transitionOut: TransitionOut
  narrationText?: string
  narrationSegmentIds?: string[]
  veoPrompt: string
  videoSceneId?: string
  emotionalPhase?: EmotionalPhase
  pacingSpeed?: ActPacingSpeed
}

export interface MasterTimelineData {
  totalDurationSec: number
  beats: TimelineBeat[]
}

// ============================================
// MUSIC PLAN TYPES
// ============================================

export interface MusicActPlan {
  index: number
  actType: DocumentaryActType
  startSec: number
  endSec: number
  mood: string
  intensityCurveHint: string
}

export interface MusicBeatPlan {
  startSec: number
  durationSec: number
  type: TimelineBeatType
  actIndex: number
  hasNarration: boolean
}

export interface MusicPlan {
  targetDurationSec: number
  acts: MusicActPlan[]
  beats: MusicBeatPlan[]
}

// ============================================
// QUALITY CONTROL TYPES
// ============================================

export type QCCategory =
  | 'structure'
  | 'narration'
  | 'scenes'
  | 'runway'
  | 'assembly'

export type QCSeverity = 'info' | 'warn' | 'error'

export interface QCFix {
  id: string
  description: string
  before?: unknown
  after?: unknown
}

export interface QCCheck {
  id: string
  category: QCCategory
  severity: QCSeverity
  passed: boolean
  message: string
  details?: Record<string, unknown>
}

export interface QCReport {
  runId: string
  stage: 'pre_gen' | 'post_gen'
  createdAt: string
  checks: QCCheck[]
  warnings: QCCheck[]
  fixesApplied: QCFix[]
  summary: {
    total: number
    passed: number
    failed: number
    warnings: number
  }
}