#!/usr/bin/env node

/**
 * Debug script to test Scene Blueprint generation
 * Run: node scripts/debug-blueprint.js "Your thought here"
 */

require('dotenv').config()

const openai = require('openai').default

const client = new openai({
  apiKey: process.env.OPENAI_API_KEY,
})

const thought = process.argv[2] || "I feel like I've wasted years of my life chasing something that didn't matter"

const UNDERSTANDING_PROMPT = `You are a depth psychologist analyzing a person's expressed thought to understand the MEANING beneath their words.

Your job is NOT to help or advise. It is to UNDERSTAND.

Extract the following (respond with JSON only):

1. "identity": Array of identity contexts visible in their words (immigrant, parent, worker, student, etc.)

2. "coreLoss": The actual loss they're experiencing beneath the surface words. Not what they said, but what they MEAN.
   Examples: "expectations vs reality", "unmet potential", "wasted sacrifice", "loss of meaning"

3. "hiddenFear": What they're afraid is true but haven't said directly.
   Examples: "my effort was meaningless", "I'm not enough", "I made the wrong choice", "it's too late"

4. "emotionalState": Array of emotions present (be specific, not generic).
   Use: shame, grief, exhaustion, rage, despair, loneliness, humiliation, betrayal, confusion, numbness, guilt, fear

5. "existentialQuestion": The unspoken question their thought is really asking.
   Examples: "Was it worth it?", "Am I enough?", "Did I fail?", "What now?", "Who am I if not this?"

6. "lifeContext": Object with optional fields:
   - "timeframe": how long this has been happening
   - "sacrifice": what they gave up
   - "expectation": what they hoped would happen
   - "reality": what actually happened

Be precise. Be honest. This is for understanding, not comfort.`

const PERSPECTIVE_PROMPT = `Based on the deep understanding of this person's struggle, select the BROADER HUMAN TRUTH that helps contextualize their pain WITHOUT invalidating it.

RULES (non-negotiable):
- NO comparison ("others have it worse")
- NO gratitude enforcement ("be grateful")
- NO toxic positivity ("everything happens for a reason")
- NO dismissal ("it's not that bad")
- ONLY shared humanity and universal experience

Select ONE perspective type that fits:
- "shared_human_struggle": Many carry invisible burdens
- "universal_uncertainty": No one knows if they're doing it right
- "common_silent_burden": Fatigue and doubt are universal
- "collective_perseverance": People keep going without answers
- "impermanence_of_states": This feeling is real but not permanent
- "dignity_in_effort": The trying itself has meaning

Respond with JSON:
{
  "perspectiveType": "<selected type>",
  "message": "<one sentence of shared truth - NOT advice, NOT comparison>",
  "avoid": ["<specific things NOT to say for this person>"]
}`

const BLUEPRINT_PROMPT = `You are a documentary filmmaker creating observational footage that shows everyday reality - NOT the user's specific life.

Your footage should feel like it was captured unintentionally, witnessing life as it happens.

CORE RULE: The video never depicts the user's exact situation. It depicts the world continuing, quietly, truthfully.

Create 4 scenes that form a visual essay on shared human experience related to their struggle.

STYLE (mandatory for all scenes):
- Visual: Photorealistic
- Camera: Handheld, imperfect framing (slightly off-center, natural wobble)
- Lighting: Natural, slightly muted
- Pace: Slow, contemplative
- Mood: Quiet, observational (NOT melancholic, NOT uplifting)
- Color: Slightly desaturated, warm shadows
- Texture: 35mm film grain

SCENE REQUIREMENTS:
1. Scene 1: Opening - Life in motion, ordinary effort
2. Scene 2: Universal moment - Something everyone experiences
3. Scene 3: Quiet pause - Brief rest or reflection in daily life
4. Scene 4: Continuation - Life moves forward, open-ended

For each scene provide:
- "description": What the camera sees (be specific, visual, filmable)
- "symbolism": What this represents (internal use only)
- "duration": Seconds (12-20 per scene)
- "timeOfDay": When this happens
- "setting": Where this happens

Respond with JSON containing a "scenes" array.`

async function debugBlueprint() {
  console.log('\n' + '='.repeat(80))
  console.log('🎬 DOCUMENTARY SCENE BLUEPRINT GENERATOR - DEBUG MODE')
  console.log('='.repeat(80))

  console.log('\n📝 Input Thought:')
  console.log(`   "${thought}"`)

  console.log('\nMock Analysis:')
  console.log(`   Emotion: sadness`)
  console.log(`   Distortion: catastrophizing`)
  console.log(`   Intensity: 8/10`)
  console.log(`   Themes: failure, wasted time, regret`)

  try {
    // Layer 1: Deep Understanding
    console.log('\n⏳ Layer 1: Extracting Deep Understanding...')
    const understandingResponse = await client.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: UNDERSTANDING_PROMPT },
        {
          role: 'user',
          content: `Analyze this thought: "${thought}"`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const understanding = JSON.parse(understandingResponse.choices[0].message.content)
    console.log('✅ Understanding Complete:')
    console.log(`   Core Loss: ${understanding.coreLoss}`)
    console.log(`   Hidden Fear: ${understanding.hiddenFear}`)
    console.log(`   Existential Question: ${understanding.existentialQuestion}`)
    console.log(`   Emotional State: ${understanding.emotionalState.join(', ')}`)
    console.log(`   Identity: ${(understanding.identity || []).join(', ') || '(none detected)'}`)

    // Layer 2: Perspective Selection
    console.log('\n⏳ Layer 2: Selecting Perspective...')
    const perspectiveResponse = await client.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: PERSPECTIVE_PROMPT },
        {
          role: 'user',
          content: `Original thought: "${thought}"

Deep understanding:
- Core loss: ${understanding.coreLoss}
- Hidden fear: ${understanding.hiddenFear}
- Emotional state: ${understanding.emotionalState.join(', ')}

Select the appropriate perspective.`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    })

    const perspective = JSON.parse(perspectiveResponse.choices[0].message.content)
    console.log('✅ Perspective Selected:')
    console.log(`   Type: ${perspective.perspectiveType}`)
    console.log(`   Message: "${perspective.message}"`)
    console.log(`   Avoid: ${(perspective.avoid || []).join(', ')}`)

    // Layer 3: Scene Blueprint
    console.log('\n⏳ Layer 3: Generating Scene Blueprint...')
    const blueprintResponse = await client.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: BLUEPRINT_PROMPT },
        {
          role: 'user',
          content: `Create a scene blueprint for this context:

USER'S THOUGHT:
"${thought}"

DEEP UNDERSTANDING:
- Hidden fear: ${understanding.hiddenFear}
- Existential question: ${understanding.existentialQuestion}
- Emotional state: ${understanding.emotionalState.join(', ')}

PERSPECTIVE TO CONVEY:
Type: ${perspective.perspectiveType}
Message: ${perspective.message}

Create 4 observational scenes that embody "${perspective.message}".`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    })

    const blueprint = JSON.parse(blueprintResponse.choices[0].message.content)

    console.log('✅ Blueprint Generated:')
    console.log(`   Style: quiet, observational`)
    const totalDuration = (blueprint.scenes || []).reduce((sum, s) => sum + (s.duration || 15), 0)
    console.log(`   Total Duration: ${totalDuration}s`)
    console.log(`   Total Scenes: ${(blueprint.scenes || []).length}`)

    console.log('\n' + '-'.repeat(80))
    console.log('🎬 SCENES:')
    console.log('-'.repeat(80))

    ;(blueprint.scenes || []).forEach((scene, index) => {
      console.log(`\n📹 Scene ${index + 1}:`)
      console.log(`   Description: ${scene.description}`)
      console.log(`   Symbolism: ${scene.symbolism}`)
      console.log(`   Duration: ${scene.duration || 15}s`)
      console.log(`   Time of Day: ${scene.timeOfDay || 'morning'}`)
      console.log(`   Setting: ${scene.setting || 'urban'}`)
    })

    console.log('\n' + '-'.repeat(80))
    console.log('📋 DOCUMENTARY CONSTRAINTS:')
    console.log('-'.repeat(80))
    const constraints = [
      'no dramatic expressions',
      'no hero narrative',
      'no poverty exploitation',
      'no identifiable faces in distress',
      'no cinematic effects',
      'no idealized happiness',
      'no motivational imagery',
      'no before/after transformation',
      'handheld imperfect framing always',
      'natural lighting only',
      'quiet observational mood',
      'no text or graphics overlaid',
      'no slow motion drama',
    ]
    constraints.forEach((constraint) => {
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
