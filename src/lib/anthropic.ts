import Anthropic from '@anthropic-ai/sdk'

const apiKey = process.env.ANTHROPIC_API_KEY

if (!apiKey) {
  console.warn('Warning: ANTHROPIC_API_KEY is not set')
}

// #region agent log
fetch('http://127.0.0.1:7244/ingest/cc753ceb-2d6f-47c8-83eb-d7e573a1c6a0', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'debug-session',
    runId: 'anthropic-init',
    hypothesisId: 'H1',
    location: 'src/lib/anthropic.ts',
    message: 'Anthropic client init',
    data: {
      hasKey: Boolean(apiKey),
      keyLength: apiKey ? apiKey.length : 0,
      keyPrefixValid: apiKey ? apiKey.startsWith('sk-ant-') : false,
    },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

export const anthropic = new Anthropic({
  apiKey,
})

export default anthropic
