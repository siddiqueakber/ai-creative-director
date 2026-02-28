# MindShift AI

An AI-powered cognitive reframing tool with emotional visualization. Transform negative thoughts into balanced perspectives with personalized videos.

![MindShift](https://img.shields.io/badge/Status-MVP-green)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)

## Features

- **Thought Intake**: Text or voice input for sharing challenging thoughts
- **Cognitive Analysis**: GPT-4 powered emotion detection and cognitive distortion identification
- **Compassionate Reframing**: Validation-first approach with multiple perspective shifts
- **Video Generation**: AI-generated emotional reset videos with optional narration
- **History Tracking**: Save and review past reframes
- **Crisis Detection**: Automatic detection of crisis situations with resource referrals

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, Framer Motion
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js with Google OAuth
- **AI Services**:
  - OpenAI GPT-4 (analysis, reframing)
  - OpenAI Whisper (voice transcription)
  - OpenAI TTS (narration)
  - Runway ML / Pika Labs (video generation)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- API keys for OpenAI and optionally Runway ML

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ai-creative-director.git
cd ai-creative-director
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables: copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```
   Edit `.env` with your database URL, API keys, and OAuth credentials. `.env.example` lists all supported variables (required and optional). **Never commit `.env` or paste real API keys into the repo** — it is ignored by Git.

4. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Security

Do not commit `.env` or any file containing real API keys or secrets. The repository is configured so `.env` and other env files are ignored (see `.gitignore`). Use `.env.example` as a template only; keep your actual credentials local.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/    # NextAuth configuration
│   │   ├── thought/               # Thought processing API
│   │   ├── video/                 # Video generation API
│   │   └── transcribe/            # Voice transcription API
│   ├── auth/                      # Auth pages
│   ├── history/                   # History page
│   └── page.tsx                   # Main app page
├── components/
│   ├── ThoughtInput.tsx           # Text/voice input
│   ├── VoiceRecorder.tsx          # Voice recording
│   ├── ReframeCard.tsx            # Reframe display
│   ├── VideoPlayer.tsx            # Video player
│   ├── EmotionIndicator.tsx       # Emotion visualization
│   └── DisclaimerModal.tsx        # First-use disclaimer
├── lib/
│   ├── openai.ts                  # OpenAI client
│   ├── prompts/                   # AI prompts
│   │   ├── analysis.ts            # Cognitive analysis
│   │   ├── reframe.ts             # Reframing prompts
│   │   └── scene.ts               # Video scene generation
│   ├── services/
│   │   ├── cognitive-analysis.ts  # Analysis service
│   │   ├── reframe.ts             # Reframing service
│   │   ├── scene-generator.ts     # Scene generation
│   │   └── video-generator.ts     # Video generation
│   ├── db.ts                      # Prisma client
│   └── rate-limit.ts              # Rate limiting
└── types/
    └── index.ts                   # TypeScript types
```

## Ethical Considerations

MindShift is designed with mental wellness ethics in mind:

1. **Not Therapy**: Clear disclaimers that this is a mindset coaching tool, not a replacement for professional mental health care.

2. **Validation First**: All reframes acknowledge emotions before offering perspective shifts. No toxic positivity.

3. **Crisis Detection**: Automatic detection of suicidal ideation or crisis situations with immediate resource referrals.

4. **Research Grounding**: Reframes are grounded in psychology research via Perplexity to avoid hallucinated advice.

5. **Rate Limiting**: Built-in daily limits to prevent over-dependence (3 free / 10 authenticated per day).

## API Costs

Approximate costs per reframe:
- GPT-4 Analysis + Reframe: ~$0.03-0.05
- Whisper Transcription: ~$0.006/minute
- TTS Narration: ~$0.015/1000 chars
- Perplexity Research: ~$0.005
- Video Generation: Varies by provider

Estimated cost per full reframe with video: $0.10-0.30

## License

MIT License - See LICENSE file for details.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

## Disclaimer

MindShift is a mindset coaching and reflection tool. It is not intended to provide medical advice, diagnosis, or treatment. If you are experiencing a mental health crisis, please contact a mental health professional or crisis hotline immediately.

**Crisis Resources:**
- 988 Suicide & Crisis Lifeline (US): Call or text 988
- Crisis Text Line: Text HOME to 741741
- International Association for Suicide Prevention: https://www.iasp.info/resources/Crisis_Centres/
