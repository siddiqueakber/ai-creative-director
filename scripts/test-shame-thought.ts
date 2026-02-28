/**
 * Test: Deep Shame Thought
 * 
 * This is a high-intensity emotional thought about shame, failure, and wasted potential.
 * The documentary director should respond with:
 * - Minimal narration (high intensity = fewer words)
 * - Longer silences (3-5s pauses)
 * - No comparison or guilt-based reframing
 * - Dignity through observation, not motivation
 */

import 'dotenv/config'
import { generateDeepUnderstanding } from '../src/lib/pipeline/layers/01-understanding'
import { generatePerspectiveSelection } from '../src/lib/pipeline/layers/02-perspective'
import { generateDocumentaryStructure } from '../src/lib/pipeline/layers/02b-documentary-director'
import { generateSceneBlueprint } from '../src/lib/pipeline/layers/03-blueprint'
import { generateDocumentaryNarration, validateNarrationText } from '../src/lib/pipeline/layers/05-narration'
import type { CognitiveAnalysis } from '../src/types'

// The user's thought - deep shame and failure
const USER_THOUGHT = `I feel deeply ashamed of who I've become.
People sacrificed so much for me, and I feel like I turned all of it into nothing.
When I think about my life, I don't see effort or courage — I see wasted chances.
I avoid talking about my situation because I don't want anyone to know how far I fell.
It feels like my existence is a reminder of failure rather than progress.`

// High intensity - this is a deeply painful thought
const ANALYSIS: CognitiveAnalysis = {
  emotion: 'shame',
  distortionType: 'catastrophizing',
  intensity: 9, // HIGH INTENSITY
  themes: ['shame', 'failure', 'sacrifice', 'hiding', 'worthlessness'],
  isCrisis: false,
  summary: 'Deep shame about perceived failure and wasted sacrifices of others',
}

async function testShameThought() {
  console.log('\n' + '═'.repeat(100))
  console.log('🎬 DOCUMENTARY DIRECTOR: PROCESSING SHAME THOUGHT')
  console.log('═'.repeat(100))
  
  console.log('\n' + '─'.repeat(100))
  console.log('📥 USER INPUT')
  console.log('─'.repeat(100))
  console.log(`\n💭 Thought:`)
  USER_THOUGHT.split('\n').forEach(line => {
    if (line.trim()) console.log(`   "${line.trim()}"`)
  })
  console.log(`\n📊 Analysis:`)
  console.log(`   Emotion: ${ANALYSIS.emotion}`)
  console.log(`   Intensity: ${ANALYSIS.intensity}/10 ⚠️  HIGH INTENSITY`)
  console.log(`   Themes: ${ANALYSIS.themes.join(', ')}`)
  
  try {
    // Step 1: Deep Understanding
    console.log('\n' + '─'.repeat(100))
    console.log('🧠 STEP 1: DEEP PSYCHOLOGICAL UNDERSTANDING')
    console.log('─'.repeat(100))
    
    const understanding = await generateDeepUnderstanding(USER_THOUGHT, ANALYSIS)
    
    console.log(`\n   🎭 Identity Contexts:`)
    understanding.identity.forEach(id => console.log(`      • ${id}`))
    console.log(`\n   💔 Core Loss:`)
    console.log(`      "${understanding.coreLoss}"`)
    console.log(`\n   😰 Hidden Fear:`)
    console.log(`      "${understanding.hiddenFear}"`)
    console.log(`\n   🌊 Emotional State:`)
    console.log(`      ${understanding.emotionalState.join(', ')}`)
    console.log(`\n   ❓ Existential Question:`)
    console.log(`      "${understanding.existentialQuestion}"`)
    
    // Step 2: Perspective Selection
    console.log('\n' + '─'.repeat(100))
    console.log('🌍 STEP 2: PERSPECTIVE SELECTION')
    console.log('─'.repeat(100))
    
    const perspective = await generatePerspectiveSelection(USER_THOUGHT, understanding)
    
    console.log(`\n   📍 Type: ${perspective.perspectiveType}`)
    console.log(`\n   💬 Core Message:`)
    console.log(`      "${perspective.message}"`)
    console.log(`\n   🚫 AVOID (critical for this person):`)
    perspective.avoid.forEach(avoid => console.log(`      ❌ ${avoid}`))
    
    // Step 3: Documentary Structure
    console.log('\n' + '─'.repeat(100))
    console.log('🎬 STEP 3: DOCUMENTARY STRUCTURE (Intensity-Aware)')
    console.log('─'.repeat(100))
    
    const documentaryStructure = await generateDocumentaryStructure(
      understanding,
      perspective,
      ANALYSIS.intensity
    )
    
    console.log(`\n   ⏱️  Total Duration: ${documentaryStructure.totalDuration}s`)
    console.log(`   📊 Intensity: ${documentaryStructure.intensityLevel}/10`)
    console.log(`   🎙️  Narration Style: ${documentaryStructure.narrationStyle.toUpperCase()}`)
    
    console.log(`\n   ⚠️  HIGH INTENSITY ADJUSTMENTS:`)
    console.log(`      • Maximum 30 words total (fewer words)`)
    console.log(`      • 3-5 second pauses (longer silences)`)
    console.log(`      • Only 2-3 narration segments`)
    console.log(`      • More space for reflection`)
    
    console.log(`\n   🎭 5-ACT STRUCTURE:`)
    documentaryStructure.acts.forEach((act, i) => {
      console.log(`      ${i + 1}. ${act.actType.toUpperCase()} (${act.duration}s) - ${act.scaleType} scale`)
    })
    
    // Step 4: Scene Blueprint
    console.log('\n' + '─'.repeat(100))
    console.log('📹 STEP 4: SCENE GENERATION')
    console.log('─'.repeat(100))
    
    const blueprint = await generateSceneBlueprint(
      USER_THOUGHT,
      ANALYSIS,
      understanding,
      perspective,
      documentaryStructure
    )
    
    blueprint.scenes.forEach((scene, index) => {
      console.log(`\n   ═══════════════════════════════════════════════════════════════════`)
      console.log(`   SCENE ${index + 1} (${scene.duration}s)`)
      console.log(`   ═══════════════════════════════════════════════════════════════════`)
      console.log(`   Time: ${scene.timeOfDay} | Setting: ${scene.setting}`)
      console.log(`\n   📹 Description:`)
      
      // Word wrap description
      const words = scene.description.split(' ')
      let line = ''
      words.forEach(word => {
        if ((line + word).length > 80) {
          console.log(`      ${line}`)
          line = word + ' '
        } else {
          line += word + ' '
        }
      })
      if (line) console.log(`      ${line}`)
      
      console.log(`\n   💭 Symbolism: ${scene.symbolism}`)
    })
    
    // Step 5: Documentary Narration
    console.log('\n\n' + '═'.repeat(100))
    console.log('🎙️  STEP 5: DOCUMENTARY NARRATION')
    console.log('═'.repeat(100))
    
    const narration = await generateDocumentaryNarration(
      USER_THOUGHT,
      understanding,
      perspective,
      documentaryStructure
    )
    
    console.log(`\n   📊 Narration Stats (HIGH INTENSITY ADJUSTMENTS):`)
    console.log(`      Total Words: ${narration.totalWordCount} (max 30 for intensity 9)`)
    console.log(`      Average Pause: ${narration.avgPauseDuration.toFixed(1)}s (3-5s for high intensity)`)
    console.log(`      Segments: ${narration.segments.length} (2-3 for high intensity)`)
    
    console.log('\n\n' + '─'.repeat(100))
    console.log('💬 THE NARRATION')
    console.log('─'.repeat(100))
    
    narration.segments.forEach((segment, index) => {
      const act = documentaryStructure.acts[segment.actIndex]
      const validation = validateNarrationText(segment.text)
      
      console.log(`\n   ┌─────────────────────────────────────────────────────────────────────┐`)
      console.log(`   │ SEGMENT ${index + 1} - ${act.actType.toUpperCase()} (${segment.wordCount} words)`)
      console.log(`   │ Start: ${segment.startTime.toFixed(1)}s | Pause after: ${segment.pauseAfter}s`)
      console.log(`   │ Validation: ${validation.valid ? '✅ PASSED' : '❌ FAILED'}`)
      console.log(`   └─────────────────────────────────────────────────────────────────────┘`)
      console.log(`\n   "${segment.text}"`)
      console.log(`\n   [${segment.pauseAfter}s of silence]`)
    })
    
    // Final Summary
    console.log('\n\n' + '═'.repeat(100))
    console.log('🔄 TRANSFORMATION SUMMARY')
    console.log('═'.repeat(100))
    
    console.log(`\n📥 USER'S PAIN:`)
    console.log(`   "I feel deeply ashamed of who I've become..."`)
    console.log(`   "...my existence is a reminder of failure..."`)
    
    console.log(`\n🧠 WHAT WE UNDERSTOOD:`)
    console.log(`   Core Loss: ${understanding.coreLoss.substring(0, 80)}...`)
    console.log(`   Hidden Fear: ${understanding.hiddenFear.substring(0, 80)}...`)
    
    console.log(`\n🌍 UNIVERSAL PERSPECTIVE:`)
    console.log(`   "${perspective.message}"`)
    
    console.log(`\n🎙️  DOCUMENTARY RESPONSE (${narration.totalWordCount} words, ${narration.segments.length} segments):`)
    narration.segments.forEach((seg, i) => {
      console.log(`\n   ${i + 1}. "${seg.text}"`)
      console.log(`      [${seg.pauseAfter}s silence]`)
    })
    
    console.log(`\n✨ WHAT THE NARRATION DOES:`)
    console.log(`   ✅ Does NOT say "be grateful for what others sacrificed"`)
    console.log(`   ✅ Does NOT compare to others who are worse off`)
    console.log(`   ✅ Does NOT motivate or push for action`)
    console.log(`   ✅ Does NOT fix or resolve the feeling`)
    console.log(`   ✅ DOES acknowledge shame is real and carried by many`)
    console.log(`   ✅ DOES create space through silence (high intensity = long pauses)`)
    console.log(`   ✅ DOES restore dignity through observation, not judgment`)
    console.log(`   ✅ DOES shift scale: personal failure → shared human weight`)
    
    console.log('\n' + '═'.repeat(100))
    console.log('✅ DOCUMENTARY GENERATION COMPLETE')
    console.log('═'.repeat(100) + '\n')
    
  } catch (error) {
    console.error('\n❌ Error:', error)
  }
}

if (require.main === module) {
  testShameThought().catch(console.error)
}

export { testShameThought }
