#!/usr/bin/env node

/**
 * Debug script to test Scene Blueprint generation
 * Run: npx ts-node scripts/debug-blueprint.ts "Your thought here"
 */

import { generateUnderstanding } from '@/lib/pipeline/layers/01-understanding'
import { selectPerspective } from '@/lib/pipeline/layers/02-perspective'
import { generateBlueprint } from '@/lib/pipeline/layers/03-blueprint'
import type { CognitiveAnalysis } from '@/types'

const thought = process.argv[2] || "I feel like I've wasted years of my life chasing something that didn't matter"

const mockAnalysis: CognitiveAnalysis = {
  emotion: 'sadness',
  distortionType: 'catastrophizing',
  intensity: 8,
  themes: ['failure', 'wasted time', 'regret'],
  isCrisis: false,
  summary: 'User expressing feelings of regret and wasted effort',
}

async function debugBlueprint() {
  console.log('\n' + '='.repeat(80))
  console.log('🎬 DOCUMENTARY SCENE BLUEPRINT GENERATOR - DEBUG MODE')
  console.log('='.repeat(80))

  console.log('\n📝 Input Thought:')
  console.log(`   "${thought}"`)

  console.log('\n🧠 Analysis:')
  console.log(`   Emotion: ${mockAnalysis.emotion}`)
  console.log(`   Distortion: ${mockAnalysis.distortionType}`)
  console.log(`   Intensity: ${mockAnalysis.intensity}/10`)
  console.log(`   Themes: ${mockAnalysis.themes.join(', ')}`)

  try {
    // Layer 1: Deep Understanding
    console.log('\n⏳ Layer 1: Extracting Deep Understanding...')
    const understanding = await generateUnderstanding(thought, mockAnalysis)
    console.log('✅ Understanding Complete:')
    console.log(`   Core Loss: ${understanding.coreLoss}`)
    console.log(`   Hidden Fear: ${understanding.hiddenFear}`)
    console.log(`   Existential Question: ${understanding.existentialQuestion}`)
    console.log(`   Emotional State: ${understanding.emotionalState.join(', ')}`)
    console.log(`   Identity: ${understanding.identity.join(', ') || '(none detected)'}`)

    // Layer 2: Perspective Selection
    console.log('\n⏳ Layer 2: Selecting Perspective...')
    const perspective = await selectPerspective(thought, understanding)
    console.log('✅ Perspective Selected:')
    console.log(`   Type: ${perspective.perspectiveType}`)
    console.log(`   Message: "${perspective.message}"`)
    console.log(`   Avoid: ${perspective.avoid.join(', ')}`)

    // Layer 3: Scene Blueprint
    console.log('\n⏳ Layer 3: Generating Scene Blueprint...')
    const blueprint = await generateBlueprint(thought, mockAnalysis, understanding, perspective)

    console.log('✅ Blueprint Generated:')
    console.log(`   Style: ${blueprint.style.mood}`)
    console.log(`   Total Duration: ${blueprint.totalDuration}s`)
    console.log(`   Total Scenes: ${blueprint.scenes.length}`)

    console.log('\n' + '-'.repeat(80))
    console.log('🎬 SCENES:')
    console.log('-'.repeat(80))

    blueprint.scenes.forEach((scene, index) => {
      console.log(`\n📹 Scene ${index + 1}:`)
      console.log(`   Description: ${scene.description}`)
      console.log(`   Symbolism: ${scene.symbolism}`)
      console.log(`   Duration: ${scene.duration}s`)
      console.log(`   Time of Day: ${scene.timeOfDay}`)
      console.log(`   Setting: ${scene.setting}`)
    })

    console.log('\n' + '-'.repeat(80))
    console.log('📋 CONSTRAINTS (Documentary Rules):')
    console.log('-'.repeat(80))
    blueprint.constraints.forEach((constraint) => {
      console.log(`   ✓ ${constraint}`)
    })

    console.log('\n' + '='.repeat(80))
    console.log('✨ Blueprint generation complete!')
    console.log('='.repeat(80) + '\n')
  } catch (error) {
    console.error('\n❌ Error during blueprint generation:')
    console.error(error)
    process.exit(1)
  }
}

debugBlueprint()
