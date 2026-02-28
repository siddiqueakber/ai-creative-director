---
name: Narration layer improvements
overview: "Implement three improvements to the narration layer: (1) PerceptualTarget and posture-specific phrasing in the system prompt, (2) a visual-text cohesion validator to prevent narration from literally describing the image, and (3) thought-anchored imagery via extraction in the understanding layer and injection into the director brief."
todos: []
isProject: false
---

# Narration Layer: Perceptual/Posture Phrasing, Visual-Text Cohesion, Thought Anchors

## Scope

- **Files:** [src/lib/pipeline/types.ts](src/lib/pipeline/types.ts), [src/lib/pipeline/layers/01-understanding.ts](src/lib/pipeline/layers/01-understanding.ts), [src/lib/pipeline/layers/05-narration.ts](src/lib/pipeline/layers/05-narration.ts)
- **Flows:** Both `generateDocumentaryNarration` (segment-first) and `generateDocumentaryNarrationForTimeline` (timeline-first, used by orchestrator) must receive the same improvements where applicable.

---

## 1. PerceptualTarget + posture phrasing (prompt-only)

**Goal:** Give the model explicit verb sets and phrasing guidance per `perceptualTarget` and per `posture` so tone and word choice vary by user state.

**Implementation:**

- In [05-narration.ts](src/lib/pipeline/layers/05-narration.ts), add two small lookup maps (constants) near the top of the file (after imports / before `ORBIT_NARRATION_PROMPT`):
  - `PERCEPTUAL_TARGET_PHRASING: Record<PerceptualTarget, string>` — one short line per value from [types.ts](src/lib/pipeline/types.ts) (e.g. `present_continuation`: "Favor: still, holding, entering, reaching, continuing. Avoid: urgency, resolution, lesson."; `forward_flow`: "Favor: movement, carrying, next, onward. Avoid: stuck, frozen, loop."; etc. for all 6 values).
  - `POSTURE_PHRASING: Record<PerspectivePosture, string>` — one short line per posture (e.g. `grounded_endurance`: "Favor: weight, steadiness, carrying, floor, breath. Tone: patient, unheroic."; `quiet_awe`: "Favor: stillness, allowing, softness, light. Tone: receptive, not striving."; etc. for all 5 postures).
- Build a dynamic snippet string when building the system prompt, e.g.  
`const perceptualSnippet = PERCEPTUAL_TARGET_PHRASING[perspective.perceptualTarget] + '\n' + POSTURE_PHRASING[perspective.posture]`
- In `ORBIT_NARRATION_PROMPT`, replace the single line  
`PERCEPTUAL TARGET: {perceptualTarget}`  
with a block that includes `{perceptualTarget}` plus the injected snippet (e.g. "PERCEPTUAL TARGET: {perceptualTarget}\n{perceptualPostureSnippet}" and pass `perceptualPostureSnippet` when calling `.replace()`).
- Ensure the system string is built with both placeholders replaced: keep `{perceptualTarget}` for readability and add a second placeholder for the snippet, or inline the snippet in one replace. Use the same snippet in all places that build the system prompt (main Anthropic call, 404 retry, OpenAI fallback).
- In `NARRATION_FOR_TIMELINE_PROMPT`, add the same "PERCEPTUAL TARGET" block with placeholders and inject the same snippet when calling this prompt (one place: `generateDocumentaryNarrationForTimeline`).

**Types:** Import `PerceptualTarget` and `PerspectivePosture` from `../types` in 05-narration if not already present; the maps are internal to 05-narration.

---

## 2. Visual–text cohesion (validator + fallback)

**Goal:** If narration text and `visualDescription` share the same salient noun (e.g. "whale", "falcon"), the narrator is describing the image; replace or rephrase so the line stays a perceptual primer.

**Implementation:**

- In [05-narration.ts](src/lib/pipeline/layers/05-narration.ts), add a constant list of **salient visual nouns** that commonly appear in Veo prompts and must not appear literally in the paired narration (e.g. whale, whales, falcon, ocean, earth, aurora, volcano, coral, reef, city, traffic, galaxy, starfield, embryo, lava, canyon, river, forest, mountain, desert, tide, migration, etc.). Normalize for plural/singular and case when checking.
- Add a function `hasLiteralVisualOverlap(text: string, visualDescription: string): boolean` that:
  - Normalizes both strings (lowercase, strip punctuation for word boundaries).
  - Checks whether any word from the salient-noun list appears in both `text` and `visualDescription` (whole-word match).
  - Returns true if there is overlap (narration is "describing" the image).
- In **segment-building loops**:
  - In `generateDocumentaryNarration`: after computing `visualDescription` and final `text` for the segment, if `hasLiteralVisualOverlap(text, visualDescription)` then replace `text` with the act-appropriate fallback from `getRandomFallback(actIndex).text` (same as when text is empty or banned). Optionally log a short debug line when this happens.
  - In `generateDocumentaryNarrationForTimeline`: same check after `text` and `visualDescription` are set; if overlap, set `text = getRandomFallback(safeActIndex).text`.
- Do not change `visualDescription`; only replace narration text to preserve perceptual-primer discipline.

---

## 3. Thought-anchored imagery (understanding + director brief)

**Goal:** Pass 3–5 concrete "thought anchors" (objects, places, sensations) from the user's thought into the director brief so the narrator can weave them into imagery and make each film feel specific to the thought.

**Implementation:**

- **Types:** In [types.ts](src/lib/pipeline/types.ts), add to `DeepUnderstandingResult`:  
`thoughtAnchors?: string[]`  
(optional so existing callers and fallbacks remain valid).
- **Understanding layer:** In [01-understanding.ts](src/lib/pipeline/layers/01-understanding.ts):
  - Extend `ORBIT_UNDERSTANDING_PROMPT` with one more JSON field:  
  `"thoughtAnchors": 3-5 concrete nouns or short phrases from the user's thought (objects, places, sensations, or times) that can be woven into imagery — e.g. "radiator", "4am", "weight of the door", "empty street". No abstract concepts; prefer filmable, sensory details.`
  - In both the main and fallback return paths, set  
  `thoughtAnchors: parsed.thoughtAnchors ?? []`  
  (and in the final catch fallback, set `thoughtAnchors: []`).
- **Narration layer:** In [05-narration.ts](src/lib/pipeline/layers/05-narration.ts):
  - In `generateDocumentaryNarration`, when building `directorBrief`, if `understanding.thoughtAnchors?.length > 0`, append a line:  
  `Thought anchors (weave at least one indirectly into imagery; do not name them literally in narration): ${understanding.thoughtAnchors.slice(0, 5).join(', ')}.`
  - In `generateDocumentaryNarrationForTimeline`, add the same line to the user content (or director string) when `understanding.thoughtAnchors?.length > 0`.
- No change to the timeline-first flow’s API; it already receives `understanding`.

---

## Order of implementation

1. **PerceptualTarget + posture phrasing** — constants, snippet builder, and prompt edits in 05-narration (both prompts).
2. **Visual–text cohesion** — salient-noun list, `hasLiteralVisualOverlap`, and use in both segment-building loops in 05-narration.
3. **Thought anchors** — types.ts, 01-understanding (prompt + parse + fallbacks), then 05-narration (director brief in both entry points).

---

## Testing / verification

- Run the pipeline for 2–3 different thoughts and confirm: (a) narration tone differs when posture/perceptualTarget differ, (b) no narration line literally names the main subject of its visual (e.g. "whale" in text when visual is whale), (c) when thoughtAnchors are present, at least one appears indirectly in imagery or visual descriptions.
- Existing call sites (orchestrator using `generateDocumentaryNarrationForTimeline`, and any using `generateDocumentaryNarration`) require no signature changes; only `DeepUnderstandingResult` gains an optional field.

