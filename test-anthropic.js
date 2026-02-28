// Test script to verify Anthropic API key
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.log('❌ ERROR: ANTHROPIC_API_KEY not found in .env file!\n');
  process.exit(1);
}

console.log('🔍 Testing Anthropic API Key...\n');
console.log('Key format check:');
console.log('  ✓ Key starts with:', apiKey.substring(0, 15) + '...');
console.log('  ✓ Key length:', apiKey.length, 'characters');
console.log('  ✓ Valid prefix:', apiKey.startsWith('sk-ant-') ? '✅ Yes' : '❌ No');
console.log('\n🚀 Making test API call to Claude...\n');

const anthropic = new Anthropic({ apiKey });

async function testAnthropicKey() {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: 'Say "API key is working!" in one sentence.'
        }
      ]
    });

    console.log('✅ SUCCESS! Anthropic API is working!\n');
    console.log('Response from Claude:');
    console.log('  Model:', message.model);
    console.log('  Message:', message.content[0].text);
    console.log('  Tokens used:', message.usage.input_tokens, 'input +', message.usage.output_tokens, 'output');
    console.log('\n✅ Your Anthropic API key is valid and working correctly!\n');
    
  } catch (error) {
    console.log('❌ ERROR: Anthropic API call failed!\n');
    
    if (error.status === 401) {
      console.log('  Error: Invalid API key (401 Unauthorized)');
      console.log('  The API key is not valid or has been revoked.');
      console.log('  Please check your key at: https://console.anthropic.com/settings/keys');
    } else if (error.status === 429) {
      console.log('  Error: Rate limit exceeded (429)');
      console.log('  You\'ve made too many requests. Wait a moment and try again.');
    } else if (error.status === 400) {
      console.log('  Error: Bad request (400)');
      console.log('  Message:', error.message);
    } else {
      console.log('  Error type:', error.constructor.name);
      console.log('  Status:', error.status);
      console.log('  Message:', error.message);
    }
    
    console.log('\n❌ Your Anthropic API key is NOT working!\n');
  }
}

testAnthropicKey();
