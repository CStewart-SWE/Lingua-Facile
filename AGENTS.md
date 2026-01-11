# Repository Guidelines

## Project Structure & Module Organization
This is an Expo React Native app using Expo Router. Key paths:
- `app/` for screen routes and layouts (see `app/_layout.tsx` and `app/(tabs)/`).
- `components/`, `hooks/`, `utils/`, and `constants/` for shared UI and helpers.
- `services/` for API/logic (e.g., translation, CEFR analysis, verb helpers).
- `supabase/functions/` for edge functions.
- `assets/` for icons/images/fonts.
- `scripts/` for local utilities (e.g., `scripts/reset-project.js`).

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm start` runs the Expo dev server.
- `npm run ios` / `npm run android` / `npm run web` run platform-specific dev builds.
- `npm run lint` runs ESLint via Expo.
- `node ./scripts/reset-project.js` resets project state when needed.

## Coding Style & Naming Conventions
- Use TypeScript/JavaScript and follow existing formatting (2-space indentation in JS/TS).
- Components are PascalCase; hooks are camelCase with a `use` prefix (e.g., `useCEFRSettings`).
- Route files follow Expo Router conventions (screen files in `app/`, group folders like `app/(tabs)/`).
- Prefer keeping styles colocated in the component file; use `expo lint` before pushing.

## Testing Guidelines
- No automated test runner is configured in `package.json`.
- Validate changes with manual runs on iOS/Android via Expo and keep UI changes visible in screenshots.

## Commit & Pull Request Guidelines
- Commit messages in history are short, imperative, and capitalized (e.g., "Add EAS configuration", "Update app.json").
- PRs should include a clear description, linked issues (if any), and platform testing notes.
- Include before/after screenshots or recordings for UI changes.

## Security & Configuration Tips
- Secrets live in `.env` / `.env.development`; do not commit real keys.
- App config is in `app.config.js`, and build config is in `eas.json`.
- Supabase edge functions are under `supabase/functions/` and should be updated in tandem with client changes.
