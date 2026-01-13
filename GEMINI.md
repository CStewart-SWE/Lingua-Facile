# GEMINI.md

This file serves as the primary context and instructional guide for Gemini agents working on the **Lingua Facile** project.

## 1. Project Overview

**Lingua Facile** is a cross-platform mobile language learning application built with **React Native (Expo)**. It focuses on helping users understand and master languages through:
- **CEFR Complexity Analysis:** Analyzing text difficulty.
- **Translation:** Multi-language support via DeepL.
- **Verb Analysis & Conjugation:** Detailed breakdown of verbs.
- **AI Chat Tutoring:** Interactive chat with voice support (TTS/STT).

## 2. Technology Stack

- **Framework:** React Native 0.79.x / Expo SDK 54
- **Language:** TypeScript (~5.x)
- **Navigation:** Expo Router (File-based routing in `app/`)
- **Backend / BaaS:** Supabase
    - **Auth:** Supabase Auth
    - **Database:** PostgreSQL
    - **Edge Functions:** Deno-based (in `supabase/functions/`)
- **State Management:**
    - `zustand` (Global app state, e.g., CEFR settings)
    - `AsyncStorage` (Persisted user preferences)
    - React Context (Theme)
- **Styling:** Themed components (`components/ThemedText`, `ThemedView`) using `react-native-reanimated` and `moti` for animations.
- **Translation:** DeepL API.
- **Monetization:** RevenueCat (`react-native-purchases`).
- **AI/LLM:** OpenAI (via Supabase Edge Functions).

## 3. Architecture & File Structure

### Frontend (`app/`)
The project uses **Expo Router**.
- `app/_layout.tsx`: Root layout (providers, auth check).
- `app/(tabs)/`: Main app screens via Bottom Tabs.
    - `CEFRChecker.tsx`: Text analysis.
    - `translator.tsx`: Translation tool.
    - `ChatScreen.tsx`: AI Tutor.
- `components/`: Reusable UI components.
    - `cefr/`, `translator/`, `subscription/`: Domain-specific components.
- `services/`: Business logic and API wrappers.
    - **Pattern:** strict separation of API calls from UI.
    - `supabase.ts`: Supabase client initialization.

### Backend (`supabase/`)
Supabase is used for logic and data.
- `migrations/`: SQL migrations for the Postgres DB.
- `functions/`: Edge functions (TypeScript/Deno).
    - `analyze-verbs`: GPT-4o based verb parsing.
    - `conjugate-verb`: Conjugation logic.
    - `detect-language`: Language detection.
    - `call-openai`: Generic OpenAI wrapper.
- `config.toml`: Local Supabase configuration (ports, auth settings).

## 4. Development Workflow

### Standard Commands
```bash
npm install          # Install dependencies
npm start            # Start Expo Metro bundler
npm run android      # Run on Android emulator
npm run ios          # Run on iOS simulator
npm run web          # Run in browser
npm run lint         # Lint files
npm run reset-project # Reset app directory (careful!)
```

### Environment Variables
Managed via `app.config.js` and `.env` files.
**Required Keys:**
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_DEEPL_API_KEY`
- `REVENUECAT_IOS_API_KEY` / `REVENUECAT_ANDROID_API_KEY`
- Edge Function URLs: `EXPO_PUBLIC_SUPABASE_CALL_...`

## 5. Coding Conventions

- **Strict TypeScript:** `tsconfig.json` enables `strict: true`. Use defined interfaces.
- **Path Aliases:** Use `@/` to import from root (e.g., `@/components/Ui`).
- **Component Style:** Functional components with hooks. Use `ThemedText` and `ThemedView` for dark/light mode compatibility.
- **State:** Prefer `zustand` for complex global state, local state for UI interactions.
- **Async Logic:** Encapsulate in `services/`. Do not make raw API calls inside components.

## 6. Supported Languages (Translation)
EN, ES, FR, DE, IT, PT, RU, JA, KO, ZH.
