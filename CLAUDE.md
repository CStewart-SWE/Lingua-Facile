# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lingua Facile is a cross-platform mobile language learning application built with React Native and Expo. It provides CEFR text complexity analysis, multi-language translation, verb analysis/conjugation, and AI chat tutoring with voice support.

## Development Commands

```bash
npm install          # Install dependencies
npm start            # Start Expo dev server (press 'a' for Android, 'i' for iOS, 'w' for web)
npm run android      # Start with Android emulator
npm run ios          # Start with iOS simulator
npm run web          # Start in web browser
npm run lint         # Run ESLint via expo lint
```

## Architecture

### App Structure (Expo Router file-based routing)
- `app/_layout.tsx` - Root layout with Supabase auth check and voice initialization
- `app/(tabs)/_layout.tsx` - Bottom tab navigator with 3 main screens
- `app/(tabs)/CEFRChecker.tsx` - CEFR complexity analysis (main screen)
- `app/(tabs)/translator.tsx` - Multi-language translation via DeepL
- `app/(tabs)/ChatScreen.tsx` - AI chat interface (in development)
- `app/LoginScreen.tsx` - Email/password authentication
- `app/Settings.tsx` - Settings modal
- `app/voice-picker-screen.tsx` - Per-language voice selection

### Services Layer (`services/`)
API integrations and business logic:
- `deeplService.ts` - DeepL translation API
- `cefrService.ts` - CEFR level analysis
- `detectLanguage.ts` - Language detection via Supabase edge function
- `analyzeVerbs.ts`, `conjugateVerbService.ts`, `getVerbData.ts` - Verb analysis system
- `verbCache.ts` - Caching layer for verb data

### Supabase Edge Functions (`supabase/functions/`)
Deno-based serverless functions:
- `detect-language/` - Uses franc library with GPT-4o fallback
- `analyze-verbs/` - GPT-4o verb parsing
- `conjugate-verb/` - GPT-4o conjugation with language templates
- `call-openai/` - OpenAI integration layer

### State Management
- **Zustand** - `app/store/useCEFRSettings.ts` for CEFR level preferences
- **AsyncStorage** - User preferences (languages, theme)
- **React Context** - Theme (light/dark mode)

### Key Dependencies
- React Native 0.79.5 with Expo 53
- expo-router 5.x for navigation
- expo-speech for TTS, expo-clipboard for clipboard monitoring
- @supabase/supabase-js for auth and edge function calls
- zustand for state management
- moti + react-native-reanimated for animations

## Configuration

- `app.config.js` - Environment variables (Supabase URLs, API keys)
- `app.json` - Expo app config (bundle IDs, splash screens, plugins)
- `eas.json` - EAS build channels (development, preview, production)

## Supported Languages

Translation supports: EN, ES, FR, DE, IT, PT, RU, JA, KO, ZH (10 languages)
