// Core types for Orbit

export type EmotionType =
  | 'awe'
  | 'uncertainty'
  | 'mortality'
  | 'meaning'
  | 'consciousness'
  | 'time'
  | 'suffering'
  | 'hope'
  | 'isolation'
  | 'humanity'
  | 'hopelessness'
  | 'overwhelm'
  | 'anxiety'
  | 'sadness'
  | 'loneliness'
  | 'shame'
  | 'guilt'
  | 'fear'
  | 'anger'
  | 'frustration'

export type CognitiveDistortion =
  | 'scale_shift'
  | 'embodiment'
  | 'impermanence'
  | 'paradox'
  | 'continuity'
  | 'mystery'
  | 'agency'
  | 'finitude'

export type VideoStatus =
  | 'pending'
  | 'understanding'
  | 'blueprint'
  | 'generating'
  | 'assembling'
  | 'processing'
  | 'ready'
  | 'failed';

export type InputType = 'text';

export interface CognitiveAnalysis {
  emotion: EmotionType; // Philosophical tone
  distortionType: CognitiveDistortion; // Narrative lens
  intensity: number; // 1-10
  themes: string[];
  isCrisis: boolean;
  summary: string;
}

export interface EssayResult {
  title: string;
  thesis: string;
  outline: string[];
  essayText: string;
  quotes?: string[]; // AI-generated supporting quotes
  /** Reframe / validation flow */
  validationStatement?: string;
  reframedText?: string;
  perspectiveShifts?: (string | { from: string; to: string })[];
}

// Legacy alias for compatibility
export type ReframeResult = EssayResult;

export interface SceneDescription {
  visualPrompt: string;
  emotionalTone: 'calm' | 'hopeful' | 'grounding' | 'empowering' | 'warm';
  colorPalette: string[];
  suggestedDuration: number;
}

// 4-Phase Video Structure
export type VideoPhase = 1 | 2 | 3 | 4;
export type VideoPhaseName = 'validation' | 'contrast' | 'reframe' | 'encouragement';

export interface PhaseSceneDescription {
  phase: VideoPhase;
  phaseName: VideoPhaseName;
  visualPrompt: string;
  emotionalTone: SceneDescription['emotionalTone'];
  duration: number;
  colorPalette: string[];
}

export interface MultiPhaseVideoRequest {
  thoughtId?: string;
  originalThought: string;
  analysis: CognitiveAnalysis;
  reframe: EssayResult;
  includeNarration: boolean;
}

export interface MultiPhaseVideoResponse {
  id: string;
  status: VideoStatus;
  phases: {
    phase: VideoPhase;
    videoUrl?: string;
    narrationUrl?: string;
    status: VideoStatus;
  }[];
  compositeVideoUrl?: string;
  errorMessage?: string;
}

export interface ThoughtInput {
  promptText: string;
  inputType: InputType;
}

export interface ThoughtResponse {
  id: string;
  analysis: CognitiveAnalysis;
  essay: EssayResult;
  videoId?: string;
}

export interface VideoGenerationRequest {
  thoughtId: string;
  reframedText: string;
  scene: SceneDescription;
  includeNarration: boolean;
}

export interface VideoResponse {
  id: string;
  status: VideoStatus;
  videoUrl?: string;
  narrationUrl?: string;
  thumbnailUrl?: string;
  errorMessage?: string;
}

// User preferences
export interface UserPreferences {
  preferNarration: boolean;
  preferredVoice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  hasAcceptedDisclaimer: boolean;
}

// API response wrappers
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// DOCUMENTARY VIDEO PIPELINE TYPES
// ============================================

// Deep Understanding Layer (Layer 1)
export interface DeepUnderstandingType {
  coreTension: string;
  centralParadox: string;
  humanStakes: string;
  keyConcepts: string[];
  guidingQuestion: string;
  narrativeAngle: string;
}

// Perspective Selection (Layer 2)
export type PerspectiveType =
  | 'cosmic_awe'
  | 'human_condition'
  | 'struggle_and_survival'
  | 'search_for_meaning'
  | 'mystery_of_being'
  | 'shared_continuance';

export interface PerspectiveSelectionType {
  perspectiveType: PerspectiveType;
  message: string;
  avoid: string[];
}

// Scene Blueprint (Layer 3)
export interface SceneStyleType {
  visual: 'photorealistic';
  camera: 'handheld, imperfect framing';
  lighting: 'natural, slightly muted';
  pace: 'slow';
  mood: 'quiet, observational';
  colorGrade: 'slightly desaturated, warm shadows';
  texture: '35mm film grain';
}

export type TimeOfDay = 'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk' | 'evening' | 'night';
export type SceneSetting = 'urban' | 'suburban' | 'rural' | 'interior' | 'transit' | 'workplace' | 'public_space';

export interface SceneType {
  description: string;
  symbolism: string;
  duration: number;
  timeOfDay: TimeOfDay;
  setting: SceneSetting;
}

export interface SceneBlueprintType {
  style: SceneStyleType;
  scenes: SceneType[];
  constraints: string[];
  totalDuration: number;
}

// Documentary Video Result
export interface DocumentarySceneJob {
  sceneIndex: number;
  description: string;
  jobId: string;
  status: VideoStatus;
  videoUrl?: string;
  duration: number;
}

export interface MinimalNarrationType {
  validation: string;
  sharedPerspective: string;
  agency: string;
  totalDuration: number;
  disclaimer: string;
}

export interface DocumentaryVideoResultType {
  id: string;
  status: VideoStatus;
  blueprint: SceneBlueprintType;
  scenes: DocumentarySceneJob[];
  narration?: MinimalNarrationType;
  totalDuration: number;
  errorMessage?: string;
}

// Crisis resources
export interface CrisisResource {
  name: string;
  phone?: string;
  url?: string;
  description: string;
}

export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    name: '988 Suicide & Crisis Lifeline',
    phone: '988',
    url: 'https://988lifeline.org',
    description: '24/7 free and confidential support'
  },
  {
    name: 'Crisis Text Line',
    phone: 'Text HOME to 741741',
    url: 'https://www.crisistextline.org',
    description: 'Free 24/7 crisis support via text'
  },
  {
    name: 'International Association for Suicide Prevention',
    url: 'https://www.iasp.info/resources/Crisis_Centres/',
    description: 'Find crisis centers in your country'
  }
];
