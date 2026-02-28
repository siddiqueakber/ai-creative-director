---
name: extend-video-to-120s
overview: Extend the Orbit pipeline from 60-second videos to 120-second videos while keeping the same narration density and 4-act structure, adjusting all time-based components consistently (structure, master timeline, QC, music, and assembly).
todos: []
isProject: false
---

# Extend Video Duration to 120 Seconds

## Goal

Increase the total documentary duration from **60s → 120s** while:

- Keeping the same **4-act structure** (VAST → LIVING_DOT → MIRACLE_OF_YOU → RETURN)
- Preserving roughly the **same narration density** (similar ratio of speech to silence)
- Keeping Veo clip durations compatible (still 4/6/8 seconds)
- Ensuring all layers (structure, timeline, QC, music, assembly) agree on the new duration.

## High-Level Approach

- Introduce a **single source-of-truth duration parameter** (e.g. `targetDurationSec`) used by:
  - Documentary structure generation (`DocumentaryStructure.totalDuration`)
  - Master timeline generation (`MasterTimelineData.totalDurationSec`)
  - QC checks that assume 60s
  - Music plan (`MusicPlan.targetDurationSec`)
- Set that target to **120 seconds** for Orbit runs (with the option to change later), then:
  - Adjust act durations so they sum to 120s, keeping their **relative proportions** similar to the 60s version.
  - Allow more beats/clips in the master timeline (and thus more Veo shots) but keep 4/6/8s constraints.
  - Maintain roughly the same narration word-count per second; just allow more segments/longer pauses.

## Detailed Plan

### 1. Make total duration configurable

**Files:**

- `[src/lib/pipeline/types.ts](src/lib/pipeline/types.ts)` – `DocumentaryStructure`, `MasterTimelineData`, `MusicPlan`.
- `[src/lib/pipeline/layers/02b-documentary-director.ts](src/lib/pipeline/layers/02b-documentary-director.ts)` – structure generation.
- `[src/lib/pipeline/layers/master-timeline.ts](src/lib/pipeline/layers/master-timeline.ts)` – master timeline.
- `[src/lib/pipeline/orchestrator.ts](src/lib/pipeline/orchestrator.ts)` – wiring.

**Steps:**

- Introduce a `**TARGET_DURATION_SEC` constant** (or env-driven helper) used wherever `60` is currently hard-coded.
  - Set default to `120` for now.
- Ensure `DocumentaryStructure.totalDuration` is computed from act durations and equals `TARGET_DURATION_SEC`.
- Ensure `MasterTimelineData.totalDurationSec` and timeline validation/normalization target the same value.
- Ensure `MusicPlan.targetDurationSec` is derived from `DocumentaryStructure.totalDuration` (already mostly true).

### 2. Scale act durations to 120s

**File:**

- `[src/lib/pipeline/layers/02b-documentary-director.ts](src/lib/pipeline/layers/02b-documentary-director.ts)`

**Steps:**

- Identify current default act durations (e.g. 12 / 18 / 20 / 10 = 60s total) and compute their **fractions**.
- Multiply each fraction by `TARGET_DURATION_SEC` (120) to get new defaults (e.g. ~24 / 36 / 40 / 20) and round reasonably.
- Keep silence rules (e.g. min opening silence in VAST) but update any hard-coded 60s assumptions.
- Update any QC expectations that assume specific act durations (e.g. in `05b-qc.ts`), to rely on `structure.totalDuration` instead of literal `60`.

### 3. Update master timeline constraints for 120s

**File:**

- `[src/lib/pipeline/layers/master-timeline.ts](src/lib/pipeline/layers/master-timeline.ts)`

**Steps:**

- Replace `TOTAL_DURATION_SEC = 60` with `TARGET_DURATION_SEC`.
- Adjust constraints:
  - Allow more beats (e.g. `MIN_BEATS` ~12, `MAX_BEATS` ~24) to keep beat lengths reasonable.
  - Keep `durationSec` restricted to 4/6/8.
- Update the LLM system prompt to say **120s** instead of 60s and update examples accordingly.
- Ensure the `normalizeSumToXX` helper (currently for 60s) now targets 120s, and validation logic in `master-timeline-validator.ts` is consistent.

### 4. Keep narration density similar but stretched

**Files:**

- `[src/lib/pipeline/layers/05-narration.ts](src/lib/pipeline/layers/05-narration.ts)`
- `[src/lib/pipeline/layers/05b-qc.ts](src/lib/pipeline/layers/05b-qc.ts)`

**Steps:**

- For each `NarrationStyle` (`minimal`, `moderate`, `sparse`), increase:
  - `maxWords` (roughly 2×, but can be tuned)
  - `segmentCount` upper bounds (e.g. allow 6–8 segments instead of 4–5)
  - Keep `pauseDuration` ranges similar so the feel stays the same.
- Ensure QC’s narration constraints use the **same values** as narration generation (no 60s-specific caps).
- Do **not** drastically increase speech fraction; aim for similar words-per-second as the 60s version.

### 5. QC and assembly updates

**Files:**

- `[src/lib/pipeline/layers/05b-qc.ts](src/lib/pipeline/layers/05b-qc.ts)` – structure & timeline checks.
- `[src/lib/pipeline/layers/07-assembly.ts](src/lib/pipeline/layers/07-assembly.ts)` – duration alignment checks.

**Steps:**

- Update QC checks that currently assert `structure.totalDuration === 60` or similar to assert `=== TARGET_DURATION_SEC`.
- Update any timeline QC (beat durations, breathing counts) where assumptions about number of beats or average duration implicitly assume 60s; scale thresholds where appropriate.
- In assembly, update any duration validation that compares summed scene durations to structure duration so it expects ~120s instead of 60s (using `structure.totalDuration`).

### 6. Music and Udio integration alignment

**Files:**

- `[src/lib/pipeline/layers/05c-music.ts](src/lib/pipeline/layers/05c-music.ts)` – music plan + Udio integration.

**Steps:**

- Ensure `musicPlan.targetDurationSec` is now 120 and is passed to Udio API’s `duration` parameter (already mostly done).
- Confirm the short style prompt still makes sense for a 120s piece (may only need wording like “~~120 seconds” instead of “~~60”).

### 7. Testing strategy

**Steps:**

- Add or update a **unit test** (or at least a small script) to:
  - Build a `DocumentaryStructure` with 120s total and confirm act durations sum correctly.
  - Generate a master timeline and assert:
    - Sum of beat durations == 120s
    - Beat durations are in {4, 6, 8}
    - Breathing beats count is still reasonable (scaled or same absolute minimum).
- Run an end-to-end generation locally and:
  - Measure final video duration with ffmpeg (should be ~120s, allow 1–2s tolerance).
  - Visually confirm narration density feels similar (not wall-to-wall speech).

## Result

After these changes, the pipeline will treat **120 seconds** as the standard length for Orbit videos, with all major components (structure, timeline, narration, QC, music, assembly) aligned on that duration. The feel and pacing of the documentary should remain similar to the current 60s version, just stretched to a full 2 minutes, and it will remain configurable if you want to reintroduce a 60s mode later by changing a single duration parameter.