import dotenv from 'dotenv'

/**
 * Test Script for Documentary Director Pipeline
 * 
 * Tests the full pipeline with different intensity levels:
 * - Low intensity (1-3): More words, shorter pauses, sparse narration
 * - Mid intensity (4-7): Moderate words, moderate pauses
 * - High intensity (8-10): Minimal words, long silences
 */

import type {
  DeepUnderstandingResult,
  PerspectiveSelectionResult,
} from '../src/lib/pipeline/types'

async function logDebug(payload: {
  runId: string
  hypothesisId: string
  location: string
  message: string
  data?: Record<string, unknown>
}) {
  try {
    await fetch('http://127.0.0.1:7244/ingest/cc753ceb-2d6f-47c8-83eb-d7e573a1c6a0', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        ...payload,
        timestamp: Date.now(),
      }),
    })
  } catch {
    // ignore
  }
}

// #region agent log
fetch('http://127.0.0.1:7244/ingest/cc753ceb-2d6f-47c8-83eb-d7e573a1c6a0', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'debug-session',
    runId: 'test-script',
    hypothesisId: 'H3',
    location: 'scripts/test-documentary-pipeline.ts',
    message: 'Test script loaded',
    data: {
      hasKey: Boolean(process.env.ANTHROPIC_API_KEY),
      keyLength: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.length : 0,
      keyPrefixValid: process.env.ANTHROPIC_API_KEY
        ? process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-')
        : false,
    },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

// ============================================
// TEST CASES
// ============================================

const TEST_CASES = [
  {
    name: 'Low Intensity (1-3): Career Uncertainty',
    intensity: 2,
    understanding: {
      identity: ['early career professional', 'ambitious'],
      coreLoss: 'uncertainty about future direction',
      hiddenFear: 'making the wrong choice',
      emotionalState: ['confusion', 'mild anxiety'],
      existentialQuestion: 'What if I choose wrong?',
      lifeContext: {
        timeframe: 'recent months',
        sacrifice: 'comfort of certainty',
        expectation: 'clear career path',
        reality: 'many unclear options',
      },
    } as DeepUnderstandingResult,
    perspective: {
      perspectiveType: 'universal_uncertainty' as const,
      message: 'No one knows if they are doing it right.',
      avoid: ['comparison', 'gratitude enforcement'],
    } as PerspectiveSelectionResult,
  },
  {
    name: 'Mid Intensity (4-7): Work Exhaustion',
    intensity: 5,
    understanding: {
      identity: ['worker', 'provider'],
      coreLoss: 'energy and meaning in daily effort',
      hiddenFear: 'this is all there is',
      emotionalState: ['exhaustion', 'numbness', 'mild despair'],
      existentialQuestion: 'Is this worth it?',
      lifeContext: {
        timeframe: 'years',
        sacrifice: 'personal time, health',
        expectation: 'fulfillment from work',
        reality: 'grinding repetition',
      },
    } as DeepUnderstandingResult,
    perspective: {
      perspectiveType: 'common_silent_burden' as const,
      message: 'Many carry weights that others cannot see.',
      avoid: ['toxic positivity', 'gratitude enforcement'],
    } as PerspectiveSelectionResult,
  },
  {
    name: 'High Intensity (8-10): Deep Loss',
    intensity: 9,
    understanding: {
      identity: ['bereaved', 'grieving'],
      coreLoss: 'someone irreplaceable',
      hiddenFear: 'life will never feel whole again',
      emotionalState: ['grief', 'despair', 'loneliness'],
      existentialQuestion: 'How do I continue?',
      lifeContext: {
        timeframe: 'recent',
        sacrifice: 'everything familiar',
        expectation: 'they would always be there',
        reality: 'permanent absence',
      },
    } as DeepUnderstandingResult,
    perspective: {
      perspectiveType: 'collective_perseverance' as const,
      message: 'People carry loss and still move forward.',
      avoid: [
        'everything happens for a reason',
        'time heals all wounds',
        'they would want you to be happy',
      ],
    } as PerspectiveSelectionResult,
  },
]

// ============================================
// TEST RUNNER
// ============================================

async function runTests() {
  const beforeKeyLength = process.env.ANTHROPIC_API_KEY?.length ?? 0
  const beforePrefix = process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant-') ?? false
  dotenv.config({ override: true })
  const afterKeyLength = process.env.ANTHROPIC_API_KEY?.length ?? 0
  const afterPrefix = process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant-') ?? false

  await logDebug({
    runId: 'test-script',
    hypothesisId: 'H3',
    location: 'scripts/test-documentary-pipeline.ts',
    message: 'dotenv override applied',
    data: {
      beforeKeyLength,
      beforePrefix,
      afterKeyLength,
      afterPrefix,
      envAnthropicModel: process.env.ANTHROPIC_MODEL || null,
    },
  })

  const [{ generateDocumentaryStructure }, { generateDocumentaryNarration, validateNarrationText }] =
    await Promise.all([
      import('../src/lib/pipeline/layers/02b-documentary-director'),
      import('../src/lib/pipeline/layers/05-narration'),
    ])

  await logDebug({
    runId: 'test-script',
    hypothesisId: 'H3',
    location: 'scripts/test-documentary-pipeline.ts',
    message: 'runTests start (awaited)',
    data: {
      testCaseCount: TEST_CASES.length,
      hasKey: Boolean(process.env.ANTHROPIC_API_KEY),
      keyLength: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.length : 0,
      keyPrefixValid: process.env.ANTHROPIC_API_KEY
        ? process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-')
        : false,
    },
  })
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/cc753ceb-2d6f-47c8-83eb-d7e573a1c6a0', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'test-script',
      hypothesisId: 'H3',
      location: 'scripts/test-documentary-pipeline.ts',
      message: 'runTests start',
      data: {
        testCaseCount: TEST_CASES.length,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  console.log('='.repeat(80))
  console.log('DOCUMENTARY DIRECTOR PIPELINE TESTS')
  console.log('='.repeat(80))
  console.log()

  for (const testCase of TEST_CASES) {
    console.log('─'.repeat(80))
    console.log(`TEST: ${testCase.name}`)
    console.log(`Intensity: ${testCase.intensity}/10`)
    console.log('─'.repeat(80))
    console.log()

    try {
      // Test Layer 2b: Documentary Structure
      console.log('📋 Layer 2b: Documentary Structure')
      const structure = await generateDocumentaryStructure(
        testCase.understanding,
        testCase.perspective,
        testCase.intensity
      )

      console.log(`  ✓ Total Duration: ${structure.totalDuration}s`)
      console.log(`  ✓ Narration Style: ${structure.narrationStyle}`)
      console.log(`  ✓ Acts:`)
      structure.acts.forEach((act, i) => {
        console.log(
          `    ${i + 1}. ${act.actType.toUpperCase()} (${act.duration}s, ${act.scaleType} scale)`
        )
        console.log(`       Narration slots: ${act.narrationTiming.length}`)
      })
      console.log()

      // Test Layer 5: Documentary Narration
      console.log('🎙️  Layer 5: Documentary Narration')
      const narration = await generateDocumentaryNarration(
        'Test thought',
        testCase.understanding,
        testCase.perspective,
        structure
      )

      console.log(`  ✓ Total Word Count: ${narration.totalWordCount}`)
      console.log(`  ✓ Avg Pause Duration: ${narration.avgPauseDuration.toFixed(1)}s`)
      console.log(`  ✓ Segments: ${narration.segments.length}`)
      console.log()

      // Validate each segment
      let allValid = true
      narration.segments.forEach((segment, i) => {
        const validation = validateNarrationText(segment.text)
        const icon = validation.valid ? '✓' : '✗'
        console.log(`    ${icon} Segment ${i + 1} (${segment.wordCount} words, ${segment.pauseAfter}s pause):`)
        console.log(`       "${segment.text}"`)
        if (!validation.valid) {
          console.log(`       ⚠️  BANNED LANGUAGE: ${validation.violations.join(', ')}`)
          allValid = false
        }
      })
      console.log()

      // Success criteria check
      console.log('📊 Success Criteria:')
      const checks = [
        {
          name: '5-act structure',
          pass: structure.acts.length === 5,
        },
        {
          name: 'Duration 60-75s',
          pass: structure.totalDuration >= 60 && structure.totalDuration <= 75,
        },
        {
          name: 'At least 2 scale types',
          pass: new Set(structure.acts.map((a) => a.scaleType)).size >= 2,
        },
        {
          name: 'No banned language',
          pass: allValid,
        },
        {
          name: 'Intensity-aware pacing',
          pass:
            (testCase.intensity >= 8 && narration.totalWordCount <= 30) ||
            (testCase.intensity >= 4 &&
              testCase.intensity < 8 &&
              narration.totalWordCount <= 50) ||
            (testCase.intensity < 4 && narration.totalWordCount <= 70),
        },
      ]

      checks.forEach((check) => {
        const icon = check.pass ? '✅' : '❌'
        console.log(`  ${icon} ${check.name}`)
      })

      const allPassed = checks.every((c) => c.pass)
      console.log()
      if (allPassed) {
        console.log('✅ ALL CHECKS PASSED')
      } else {
        console.log('❌ SOME CHECKS FAILED')
      }
      console.log()
    } catch (error) {
      console.error('❌ ERROR:', error)
      console.log()
    }
  }

  console.log('='.repeat(80))
  console.log('TESTS COMPLETE')
  console.log('='.repeat(80))
}

// Run if executed directly
if (require.main === module) {
  runTests().catch(console.error)
}

export { runTests }
