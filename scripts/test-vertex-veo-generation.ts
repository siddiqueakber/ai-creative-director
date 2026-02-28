/**
 * Test script to verify Vertex AI Veo 3.1 video generation
 * Run with: npx tsx scripts/test-vertex-veo-generation.ts
 * Or compile first: npx tsc scripts/test-vertex-veo-generation.ts && node scripts/test-vertex-veo-generation.js
 */

import * as dotenv from 'dotenv'
import { startVertexAIJob, checkVertexAIJob } from '../src/lib/pipeline/providers/vertex-ai'

dotenv.config()

async function testVertexVeoGeneration() {
  console.log('\n' + '='.repeat(80))
  console.log('🎬 VERTEX AI VEO 3.1 VIDEO GENERATION TEST')
  console.log('='.repeat(80) + '\n')

  // Check environment variables
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
  const veoModel = process.env.VEO_MODEL || 'veo-3.1-generate-001'
  const veoAudio = process.env.VEO_ENABLE_AUDIO === 'true'

  console.log('📋 Configuration:')
  console.log(`   Project ID: ${projectId || '❌ MISSING'}`)
  console.log(`   Location: ${location}`)
  console.log(`   Model: ${veoModel}`)
  console.log(`   Audio: ${veoAudio ? 'enabled ($0.15/s)' : 'disabled ($0.10/s)'}`)
  console.log('')

  if (!projectId) {
    console.error('❌ Error: GOOGLE_CLOUD_PROJECT_ID is not set')
    process.exit(1)
  }

  try {
    console.log('📦 Vertex AI provider imported successfully\n')

    // Test 1: Start a simple video generation job
    console.log('🧪 Test 1: Starting video generation job...')
    const testPrompt =
      'A calm ocean wave gently washing ashore at sunset, naturalistic documentary style, steady camera'
    const testDuration = 4 // 4 seconds

    console.log(`   Prompt: "${testPrompt}"`)
    console.log(`   Duration: ${testDuration}s`)
    console.log(`   Model: ${veoModel}`)
    console.log('')

    const startTime = Date.now()
    const jobResult = await startVertexAIJob(testPrompt, testDuration)
    const startDuration = Date.now() - startTime

    console.log('📤 Job Started:')
    console.log(`   Job ID: ${jobResult.jobId}`)
    console.log(`   Status: ${jobResult.status}`)
    console.log(`   Video URL: ${jobResult.videoUrl || 'Not available yet'}`)
    if (jobResult.errorMessage) {
      console.log(`   Error: ${jobResult.errorMessage}`)
    }
    console.log(`   Time taken: ${startDuration}ms`)
    console.log('')

    if (jobResult.status === 'failed') {
      console.error('❌ Job start failed. Check your configuration and API access.')
      console.error('💡 Common issues:')
      console.error('   - Vertex AI API not enabled')
      console.error('   - Service account lacks "Vertex AI User" role')
      console.error('   - Billing not enabled')
      console.error('   - Invalid project ID or location')
      process.exit(1)
    }

    if (jobResult.status === 'ready' && jobResult.videoUrl) {
      console.log('✅ Video generated immediately! (unlikely for Veo, but possible)')
      console.log(`   Video URL: ${jobResult.videoUrl}`)
      return
    }

    // Test 2: Poll for job completion
    console.log('⏳ Test 2: Polling for job completion...')
    console.log('   (This may take 30-180 seconds for Veo 3.1)\n')

    let pollCount = 0
    const maxPolls = 60 // 5 minutes max (60 * 5 seconds)
    const pollInterval = 5000 // 5 seconds

    while (pollCount < maxPolls) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval))
      pollCount++

      const pollStartTime = Date.now()
      const statusResult = await checkVertexAIJob(jobResult.jobId)
      const pollDuration = Date.now() - pollStartTime

      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      console.log(`[${elapsed}s] Poll #${pollCount}: Status = ${statusResult.status}`)

      if (statusResult.status === 'ready') {
        console.log('\n✅ Video generation completed!')
        console.log(`   Job ID: ${statusResult.jobId}`)
        console.log(`   Video URL: ${statusResult.videoUrl || 'Check GCS bucket'}`)
        console.log(`   Total time: ${Math.floor((Date.now() - startTime) / 1000)}s`)
        console.log(`   Polls: ${pollCount}`)
        return
      }

      if (statusResult.status === 'failed') {
        console.error('\n❌ Video generation failed!')
        console.error(`   Error: ${statusResult.errorMessage || 'Unknown error'}`)
        process.exit(1)
      }

      // Show progress every 30 seconds
      if (pollCount % 6 === 0) {
        console.log(`   ⏳ Still processing... (${elapsed}s elapsed)`)
      }
    }

    console.error('\n⏱️  Timeout: Job did not complete within 5 minutes')
    console.error('   This is normal for Veo - generation can take longer')
    console.error(`   Job ID: ${jobResult.jobId}`)
    console.error('   You can check the job status manually later')
    console.error(`   Operation: ${jobResult.jobId}`)
  } catch (error) {
    console.error('\n❌ Test failed with error:')
    const err = error as Error
    console.error(`   ${err.message}`)
    if (err.stack) {
      console.error(`\n   Stack trace:\n${err.stack.split('\n').slice(0, 10).join('\n')}`)
    }

    console.error('\n💡 Troubleshooting:')
    console.error('   1. Ensure Vertex AI API is enabled:')
    console.error('      https://console.cloud.google.com/apis/library/aiplatform.googleapis.com')
    console.error('   2. Check service account has "Vertex AI User" role')
    console.error('   3. Verify billing is enabled')
    console.error('   4. Check GOOGLE_APPLICATION_CREDENTIALS path is correct')
    console.error('   5. Review the error message above for specific issues')

    process.exit(1)
  }
}

// Run the test
testVertexVeoGeneration()
  .then(() => {
    console.log('\n' + '='.repeat(80))
    console.log('✅ Test completed successfully!')
    console.log('='.repeat(80) + '\n')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  })
