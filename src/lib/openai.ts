import OpenAI from 'openai'
import path from 'path'
import dotenv from 'dotenv'

// Prefer .env file over system env (override so OPENAI_API_KEY from .env wins)
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })

// Use only the first line (avoids duplicated paste or trailing newline)
const raw = process.env.OPENAI_API_KEY?.trim() ?? ''
const OPENAI_API_KEY = raw.split(/\r?\n/)[0]?.trim() ?? ''

// Do not truncate keys; OpenAI key lengths can vary by format.
const keyToUse = OPENAI_API_KEY
const keySuffix = keyToUse ? keyToUse.slice(-4) : ''

if (!OPENAI_API_KEY) {
  console.warn('Warning: OPENAI_API_KEY is not set')
} else if (!OPENAI_API_KEY.startsWith('sk-')) {
  console.warn('Warning: OPENAI_API_KEY should start with sk- (check for typos or wrong variable)')
} else {
  console.log('OpenAI: API key loaded (length', OPENAI_API_KEY.length, ', suffix', keySuffix + ')')
}

export const openai = new OpenAI({
  apiKey: keyToUse || undefined,
})

export default openai
