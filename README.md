# Orbit

**AI Creative Director** — Turn a single thought into a documentary-style short film. You type one sentence (a worry, a question, a reflection); Orbit generates a ~2-minute film with structure, narration, and AI-generated visuals in a calm, observational style.

![Orbit](https://img.shields.io/badge/Status-MVP-green)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)

## Features

- **Thought in, film out**: One input text → deep understanding, perspective selection, and a full short film
- **Documentary-style narration**: Natural, flowing script (Planet Earth / contemplative film feel) with optional voice (ElevenLabs)
- **Multi-model pipeline**: Understanding (Claude), shot planning, narration, music (Udio), and video (Runway / Google Veo)
- **History & auth**: Save thoughts and videos; sign in with Google (NextAuth)
- **Crisis awareness**: Detection of crisis language with resource referrals

## Tech Stack

- **Frontend**: Next.js 16, React, Tailwind CSS, Framer Motion
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM (e.g. Neon)
- **Auth**: NextAuth.js with Google OAuth
- **AI / media**:
  - **Claude (Anthropic)**: Deep understanding, essay framing, documentary narration
  - **OpenAI**: Cognitive analysis, reframing, quotes
  - **ElevenLabs**: Narration TTS
  - **Runway / Google Veo**: Text-to-video per shot
  - **Udio**: Optional background music
  - **FFmpeg**: Final assembly (video + voice + music)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (e.g. [Neon](https://neon.tech))
- API keys: OpenAI, Anthropic; optionally Runway/Veo, ElevenLabs, Udio (see `.env.example`)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/siddiqueakber/ai-creative-director.git
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
│   │   ├── auth/[...nextauth]/   # NextAuth
│   │   ├── thought/              # Thought analysis & essay
│   │   ├── video/                # Video CRUD & pipeline trigger
│   │   ├── videos/background/    # Background video API
│   │   ├── runway/               # Runway task status
│   │   └── microfacts/           # Microfacts API
│   ├── auth/                     # Sign-in / error pages
│   └── page.tsx                  # Main app
├── components/                    # ThoughtInput, ReframeCard, VideoPlayer, etc.
├── lib/
│   ├── pipeline/                 # Orbit film pipeline
│   │   ├── layers/               # 01-understanding → 07-assembly
│   │   ├── providers/            # Runway, Vertex/Veo, storage
│   │   ├── orchestrator.ts       # Runs full pipeline
│   │   └── types.ts
│   ├── prompts/                  # Essay, quotes, documentary, etc.
│   ├── services/                 # Cognitive analysis, essay, quotes, reframe
│   ├── db.ts                     # Prisma client
│   └── rate-limit.ts
└── types/
```

## Pipeline (high level)

1. **Understanding** — Emotion, stakes, thought anchors (Claude)
2. **Perspective** — Perceptual target, posture (e.g. grounded_endurance, quiet_awe)
3. **Director brief** — Visual tone, constraints
4. **Master timeline** — Beats and durations
5. **Shot planning** — Per-shot prompts for video
6. **Narration** — Documentary-style script per beat (Claude)
7. **Music** — Optional track (Udio)
8. **Video generation** — Per-shot (Runway or Veo)
9. **Assembly** — FFmpeg: video + voice + music → final film

## Ethical Considerations

Orbit is designed with reflection and mental wellness in mind:

1. **Not therapy**: Clear disclaimers; this is a creative reflection tool, not a replacement for professional care.
2. **Validation first**: Reframes acknowledge emotions before offering perspective.
3. **Crisis detection**: Automatic detection of crisis situations with resource referrals.
4. **Rate limiting**: Built-in limits to prevent over-dependence.

## License

MIT License — see LICENSE file for details.

## Contributing

Contributions are welcome. Open an issue or PR on [GitHub](https://github.com/siddiqueakber/ai-creative-director).

## Disclaimer

Orbit is a creative and reflection tool. It is not intended to provide medical advice, diagnosis, or treatment. If you are in a mental health crisis, please contact a professional or crisis service.

**Crisis resources:**
- 988 Suicide & Crisis Lifeline (US): Call or text 988
- Crisis Text Line: Text HOME to 741741
- [International Association for Suicide Prevention](https://www.iasp.info/resources/Crisis_Centres/)
