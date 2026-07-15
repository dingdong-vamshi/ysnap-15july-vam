# YSnap

YSnap is a modern multilingual translation application that enables instant, context-aware translations of what you see and hear.

## Features

- **Static Onboarding Flow**: Responsive 9-slide onboarding journey with precise, immediate illustration mapping and optimized viewport sizing.
- **tactile Navigation**: Premium floating active-capsule navigation bar with Instagram-inspired transitions, haptic response, and a prominent camera action.
- **Smart Auth Flow**: Clean Email/Password sign-up and sign-in flow powered by Supabase Auth with RLS-protected profile loading and auto-initialization.
- **Audio Translator**: Metred microphone capture with live voice orb visualizations and local recording fallback capability.
- **Custom Speech Edge Functions**: Integrated ElevenLabs edge function services for voice translation, voice cloning, and text-to-speech.

## Prerequisites

- **Node.js**: Version 18 or 20+ is recommended.
- **Expo SDK**: Built on Expo Router and compatible with iOS, Android, and Web platforms.

## Installation

```bash
npm install
```

## Configuration

Copy the example environment file:
```bash
cp .env.example .env.local
```

Fill in your client-safe Supabase credentials (never commit this file):
- `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase Project URL
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Your Supabase Anon/Publishable Key
- `EXPO_PUBLIC_APP_URL`: Local application URL (default: `http://localhost:8081`)
- `EXPO_PUBLIC_AUTH_CALLBACK_PATH`: Auth callback path (default: `/auth/callback`)

### Server-Side Secrets
ElevenLabs voice generation and AI translation features rely on secrets configured in the remote Supabase project. These keys are kept secure and are **never** included in the repository or exposed to the Expo client app:
- `ELEVENLABS_API_KEY`: Remote secret configured in Supabase Edge Functions.
- `GEMINI_API_KEY`: Remote Google AI secret used by the `gemini-3.5-flash` translation, summary, and vision pipelines.

## Development

To start the Expo development server:
```bash
npx expo start
```

To run the application directly in a web browser:
```bash
npx expo start --web
```

## Verification and Builds

To run TypeScript checks and export bundles locally:
```bash
npx tsc --noEmit
npx expo-doctor
npx expo export --platform web
```
