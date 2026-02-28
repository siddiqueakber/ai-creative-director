#!/usr/bin/env node

/**
 * Debug script to test Runway API connection
 * Run: node scripts/test-runway.js
 */

require('dotenv').config()

const RUNWAY_API_BASE = 'https://api.dev.runwayml.com'
const RUNWAY_API_VERSION = '2024-11-06'

async function testRunwayAPI() {
  console.log('\n' + '='.repeat(80))
  console.log('🎬 RUNWAY API CONNECTION TEST')
  console.log('='.repeat(80))

  // Check if API key exists
  const apiKey = process.env.RUNWAY_API_KEY
  
  console.log('\n📋 Configuration:')
  console.log(`   API Key: ${apiKey ? '✅ SET (' + apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4) + ')' : '❌ NOT SET'}`)
  console.log(`   API Base: ${RUNWAY_API_BASE}`)
  console.log(`   API Version: ${RUNWAY_API_VERSION}`)
  
  if (!apiKey) {
    console.log('\n❌ Error: RUNWAY_API_KEY not found in .env file')
    console.log('\n💡 To fix:')
    console.log('   1. Create a .env file in the project root')
    console.log('   2. Add: RUNWAY_API_KEY=your_actual_key_here')
    console.log('   3. Restart your dev server (npm run dev)')
    process.exit(1)
  }

  // Test model configuration
  const model = process.env.RUNWAY_TEXT_TO_VIDEO_MODEL || 'veo3.1'
  const ratio = process.env.RUNWAY_TEXT_TO_VIDEO_RATIO || '1280:720'
  const maxDuration = Number(process.env.RUNWAY_TEXT_TO_VIDEO_MAX_DURATION_SECONDS || '8')
  
  console.log(`   Model: ${model}`)
  console.log(`   Ratio: ${ratio}`)
  console.log(`   Max Duration: ${maxDuration}s`)

  // Test API connection
  console.log('\n⏳ Testing Runway API connection...')
  
  const testPrompt = 'A calm documentary-style handheld shot of morning sunlight filtering through window blinds onto a wooden floor'
  
  try {
    const response = await fetch(`${RUNWAY_API_BASE}/v1/text_to_video`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': RUNWAY_API_VERSION,
      },
      body: JSON.stringify({
        model: model,
        promptText: testPrompt,
        ratio: ratio,
        audio: false,
      }),
    })

    console.log(`   Response Status: ${response.status} ${response.statusText}`)
    
    const responseText = await response.text()
    let data
    
    try {
      data = JSON.parse(responseText)
    } catch (e) {
      data = responseText
    }

    if (!response.ok) {
      console.log('\n❌ API Request Failed:')
      console.log('   Status:', response.status)
      console.log('   Response:', JSON.stringify(data, null, 2))
      
      if (response.status === 401) {
        console.log('\n💡 This means your API key is invalid or expired.')
        console.log('   Check: https://app.runwayml.com/account/api-keys')
      } else if (response.status === 404) {
        console.log('\n💡 The API endpoint might have changed.')
        console.log('   Check the latest Runway API documentation.')
      } else if (response.status === 400) {
        console.log('\n💡 Bad request - check if the model name or parameters are correct.')
      }
      
      process.exit(1)
    }

    console.log('\n✅ API Connection Successful!')
    console.log('\n📦 Response:')
    console.log(JSON.stringify(data, null, 2))
    
    const jobId = data.id || data.taskId || data.jobId || data.uuid
    console.log('\n🎉 Video generation job created!')
    console.log(`   Job ID: ${jobId}`)
    console.log(`   Status: ${data.status || 'processing'}`)
    
    console.log('\n' + '='.repeat(80))
    console.log('✨ Test complete! Your Runway API is working.')
    console.log('='.repeat(80) + '\n')

  } catch (error) {
    console.log('\n❌ Connection Error:')
    console.error(error)
    console.log('\n💡 Possible causes:')
    console.log('   - Network connection issues')
    console.log('   - Firewall blocking the request')
    console.log('   - Runway API service down')
    process.exit(1)
  }
}

testRunwayAPI()
