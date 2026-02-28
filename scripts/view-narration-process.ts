/**
 * Documentary Narration Generation Process
 * 
 * Shows how user thoughts and emotions are transformed into
 * perspective-shifting documentary narration
 */

import { generateDeepUnderstanding } from '../src/lib/pipeline/layers/01-understanding'
import { generatePerspectivePosture } from '../src/lib/pipeline/layers/02-perspective'
import { generateDocumentaryStructure } from '../src/lib/pipeline/layers/02b-documentary-director'
import { generateDocumentaryNarration, validateNarrationText } from '../src/lib/pipeline/layers/05-narration'
import type { CognitiveAnalysis } from '../src/types'

const SAMPLE_THOUGHT = "I've been working so hard for years but I still feel like I'm going nowhere. Everyone else seems to have it figured out."

const SAMPLE_ANALYSIS: CognitiveAnalysis = {
  emotion: 'uncertainty',
  distortionType: 'continuity',
  intensity: 6,
  themes: ['work', 'progress', 'comparison'],
  isCrisis: false,
  summary: 'Feeling stuck despite effort',
}

async function viewNarrationProcess() {
  console.log('\n' + '═'.repeat(100))
  console.log('🎙️  DOCUMENTARY NARRATION GENERATION PROCESS')
  console.log('═'.repeat(100))
  
  console.log('\n' + '─'.repeat(100))
  console.log('STEP 1: USER INPUT')
  console.log('─'.repeat(100))
  console.log(`\n💭 User's Original Thought:`)
  console.log(`   "${SAMPLE_THOUGHT}"`)
  console.log(`\n📊 Surface Analysis:`)
  console.log(`   Emotion: ${SAMPLE_ANALYSIS.emotion}`)
  console.log(`   Intensity: ${SAMPLE_ANALYSIS.intensity}/10`)
  console.log(`   Distortion Type: ${SAMPLE_ANALYSIS.distortionType}`)
  console.log(`   Themes: ${SAMPLE_ANALYSIS.themes.join(', ')}`)
  
  try {
    // Step 2: Deep Understanding
    console.log('\n' + '─'.repeat(100))
    console.log('STEP 2: ORBIT UNDERSTANDING')
    console.log('─'.repeat(100))
    console.log('\n🤖 Model: GPT-4o (OpenAI)')
    console.log('🎯 Purpose: Frame and route (not answer)')
    console.log('📝 Prompt Type: Orbit Director Brief\n')
    
    const understanding = await generateDeepUnderstanding(SAMPLE_THOUGHT, SAMPLE_ANALYSIS)
    
    console.log('✓ Deep Understanding Generated:')
    console.log(`\n   ⚡ Core Tension:`)
    console.log(`      "${understanding.coreTension}"`)
    console.log(`\n   ⚖️  Central Paradox:`)
    console.log(`      "${understanding.centralParadox}"`)
    console.log(`\n   🌍 Human Stakes:`)
    console.log(`      "${understanding.humanStakes}"`)
    console.log(`\n   🔑 Key Concepts:`)
    console.log(`      ${understanding.keyConcepts.join(', ')}`)
    console.log(`\n   ❓ Guiding Question:`)
    console.log(`      "${understanding.guidingQuestion}"`)
    console.log(`\n   🎯 Narrative Angle:`)
    console.log(`      "${understanding.narrativeAngle}"`)
    console.log(`\n   🧭 Orbit Intent:`)
    console.log(`      Primary: ${understanding.orbitIntent.primaryNeed}`)
    console.log(`      Secondary: ${understanding.orbitIntent.secondaryNeed || 'none'}`)
    console.log(`      Act Weights: vast ${understanding.orbitIntent.actWeights.vast}, earth ${understanding.orbitIntent.actWeights.earth}, embryology ${understanding.orbitIntent.actWeights.embryology}, return ${understanding.orbitIntent.actWeights.return}`)
    
    // Step 3: Perspective Posture
    console.log('\n' + '─'.repeat(100))
    console.log('STEP 3: PERSPECTIVE POSTURE')
    console.log('─'.repeat(100))
    console.log('\n🤖 Model: GPT-4o (OpenAI)')
    console.log('🎯 Purpose: Decide how the ritual should be felt (posture)')
    console.log('📝 Prompt Type: Orbit Perspective Posture\n')
    
    const perspective = await generatePerspectivePosture(SAMPLE_THOUGHT, understanding)
    
    console.log('✓ Perspective Posture:')
    console.log(`\n   🧍 Posture: ${perspective.posture}`)
    console.log(`\n   🎧 Emotional Tone: ${perspective.emotionalTone}`)
    console.log(`\n   📷 Camera Bias: ${perspective.cameraBias.join(', ')}`)
    console.log(`\n   🗣️  Narration Bias: ${perspective.narrationBias.join(', ')}`)
    console.log(`\n   🕰️  Pacing Bias: ${perspective.pacingBias}`)
    console.log(`\n   🎬 Reinforce Acts: ${perspective.reinforceActs.join(', ')}`)
    console.log(`\n   🚫 Avoid: ${perspective.avoid.join(', ')}`)
    
    // Step 4: Documentary Structure
    console.log('\n' + '─'.repeat(100))
    console.log('STEP 4: DOCUMENTARY STRUCTURE GENERATION')
    console.log('─'.repeat(100))
    console.log('\n🤖 Model: Deterministic (no AI)')
    console.log('🎯 Purpose: Orbit ritual structure with actWeights pacing')
    console.log('📝 Prompt Type: Ritual Enforcer\n')
    
    const documentaryStructure = await generateDocumentaryStructure(
      understanding,
      perspective,
      SAMPLE_ANALYSIS.intensity
    )
    
    console.log('✓ Structure Generated:')
    console.log(`\n   ⏱️  Total Duration: ${documentaryStructure.totalDuration}s`)
    console.log(`   📊 Intensity Level: ${documentaryStructure.intensityLevel}/10`)
    console.log(`   🎙️  Narration Style: ${documentaryStructure.narrationStyle}`)
    
    // Show intensity mapping
    console.log(`\n   ✓ This video uses: ${documentaryStructure.narrationStyle} style`)
    
    // Step 5: Narration Generation
    console.log('\n' + '─'.repeat(100))
    console.log('STEP 5: DOCUMENTARY NARRATION GENERATION')
    console.log('─'.repeat(100))
    console.log('\n🤖 Model: Claude (primary) / GPT-4o (fallback)')
    console.log('🎯 Purpose: Orbit narration (observational, act-locked)')
    console.log('📝 Prompt Type: Orbit Narrator (NOT therapeutic)\n')
    
    console.log('📋 System Prompt Context: Orbit narration (act-locked, no advice/definitions)')
    
    const narration = await generateDocumentaryNarration(
      SAMPLE_THOUGHT,
      understanding,
      perspective,
      documentaryStructure
    )
    
    console.log('\n✓ Narration Generated:')
    console.log(`\n   📊 Stats:`)
    console.log(`      Total Words: ${narration.totalWordCount}`)
    console.log(`      Average Pause: ${narration.avgPauseDuration.toFixed(1)}s`)
    console.log(`      Total Segments: ${narration.segments.length}`)
    
    // Validate each segment
    console.log('\n\n' + '═'.repeat(100))
    console.log('🎙️  FINAL NARRATION (with validation)')
    console.log('═'.repeat(100))
    
    narration.segments.forEach((segment, index) => {
      const act = documentaryStructure.acts[segment.actIndex]
      const validation = validateNarrationText(segment.text)
      
      console.log(`\n${'─'.repeat(100)}`)
      console.log(`SEGMENT ${index + 1} - ${act.actType.toUpperCase()} Act`)
      console.log('─'.repeat(100))
      console.log(`\n   ⏱️  Start Time: ${segment.startTime}s`)
      console.log(`   ⏳ Duration: ${segment.duration}s`)
      console.log(`   🤫 Pause After: ${segment.pauseAfter}s`)
      console.log(`   📝 Word Count: ${segment.wordCount} words`)
      console.log(`\n   ${validation.valid ? '✅' : '❌'} Validation: ${validation.valid ? 'PASSED' : 'FAILED'}`)
      if (!validation.valid) {
        console.log(`   ⚠️  Violations: ${validation.violations.join(', ')}`)
      }
      console.log(`\n   💬 Narration Text:`)
      console.log(`      "${segment.text}"`)
      console.log(`\n   🎬 How it works:`)
      console.log(`      1. Audio plays at ${segment.startTime}s (${segment.duration}s duration)`)
      console.log(`      2. Silence for ${segment.pauseAfter}s after`)
      console.log(`      3. Visual: ${act.visualRequirements.slice(0, 2).join(', ')}`)
    })
    
    // Show transformation
    console.log('\n\n' + '═'.repeat(100))
    console.log('🔄 TRANSFORMATION SUMMARY')
    console.log('═'.repeat(100))
    console.log(`\n📥 INPUT (User's Personal Pain):`)
    console.log(`   "${SAMPLE_THOUGHT}"`)
    console.log(`   Emotion: ${SAMPLE_ANALYSIS.emotion} (${SAMPLE_ANALYSIS.intensity}/10)`)
    
    console.log(`\n🧠 UNDERSTANDING (Orbit Framing):`)
    console.log(`   Core Tension: ${understanding.coreTension}`)
    console.log(`   Central Paradox: ${understanding.centralParadox}`)
    console.log(`   Guiding Question: ${understanding.guidingQuestion}`)
    
    console.log(`\n🌍 PERSPECTIVE (Posture):`)
    console.log(`   ${perspective.posture} | ${perspective.emotionalTone}`)
    
    console.log(`\n📹 DOCUMENTARY VOICE (Observational):`)
    narration.segments.forEach((seg, i) => {
      console.log(`   ${i + 1}. "${seg.text}"`)
    })
    
    console.log(`\n✨ IMPACT:`)
    console.log(`   • Personal pain acknowledged but not centered`)
    console.log(`   • Scale shift: cosmic → human → personal`)
    console.log(`   • No advice, no fixing, no comparison`)
    console.log(`   • Truth through observation`)
    console.log(`   • Silence creates space for reflection`)
    
    // Show the prompt that generates it
    console.log('\n\n' + '═'.repeat(100))
    console.log('🤖 ACTUAL GENERATION PROMPT (Orbit Director Brief)')
    console.log('═'.repeat(100))
    console.log(`\nDIRECTOR BRIEF:
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

PROMPT:
"${SAMPLE_THOUGHT}"`)
    
    console.log('\n═'.repeat(100))
    console.log('✅ NARRATION GENERATION COMPLETE')
    console.log('═'.repeat(100))
    console.log('\n🎯 Key Principles:')
    console.log('   1. User thought → Deep understanding (psychology)')
    console.log('   2. Understanding → Orbit posture (no comparison)')
    console.log('   3. Perspective → Documentary structure (Orbit ritual, 4 acts)')
    console.log('   4. Structure → Observational narration (factual, not therapeutic)')
    console.log('   5. Validation → No banned language (inspire, succeed, overcome)')
    console.log('   6. Output → Perspective shift through truth and scale\n')
    
  } catch (error) {
    console.error('\n❌ Error:', error)
  }
}

if (require.main === module) {
  viewNarrationProcess().catch(console.error)
}

export { viewNarrationProcess }
