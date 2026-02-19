# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BiteBuddy is a group dining decision app — friends swipe on restaurants together, and when everyone likes the same place, it's a match. Monorepo using npm workspaces with three packages.

## Tech Stack

- **API** (`apps/api`): Next.js 16 App Router, TypeScript, Supabase JS
- **Mobile** (`apps/mobile`): Expo 54, React Native 0.81, Expo Router, TypeScript
- **Shared** (`packages/shared`): TypeScript types shared between API and mobile
- **Database**: Supabase (PostgreSQL with RLS, Realtime, Auth)
- **Restaurant Data**: Google Places API (New)

## Common Commands

All commands run from the repo root using npm workspace flags.

```bash
npm install                                  # Install all workspace deps
npm -w @bitebuddy/api run dev                # API dev server at http://localhost:3000
npm -w @bitebuddy/api run build              # API production build
npm -w @bitebuddy/api run lint               # Lint API
npm -w @bitebuddy/mobile start               # Expo dev server
npm -w @bitebuddy/mobile run ios             # Run on iOS simulator
npm -w @bitebuddy/mobile run android         # Run on Android emulator
npx expo install <pkg> --project apps/mobile # Install Expo-compatible packages
```

## Environment Variables

**`apps/api/.env.local`** (server-only):
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase anon/public key
- `GOOGLE_PLACES_API_KEY` — Google Places API key

**`apps/mobile/.env`** (client-side, EXPO_PUBLIC_ prefix):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_URL` — defaults to `http://localhost:3000`

## Architecture

### API (`apps/api/src/`)
- `lib/auth.ts` — `getAuthenticatedClient(request)` extracts Bearer JWT, returns `{ supabase, user }` or 401. Every protected route starts with this.
- `lib/supabase.ts` — creates Supabase client with user's JWT (respects RLS)
- `lib/yelp.ts` — Google Places API client for restaurant search (file kept as yelp.ts for now)
- Routes in `app/api/`: auth (signup/login/me/logout), profile, friends (list/requests/request/respond/search), sessions (CRUD/invite/join/start/swipe/restaurants/results)

### Mobile (`apps/mobile/`)
- Expo Router file-based navigation in `app/`
- `(auth)/` — login, signup (unauthenticated)
- `(tabs)/` — home (active sessions), friends, history
- `session/` — create, [id]/lobby, [id]/swipe, [id]/results
- `contexts/AuthContext.tsx` — manages Supabase auth session, auto-refresh
- `lib/supabase.ts` — Supabase client with AsyncStorage persistence
- `lib/api.ts` — `apiGet`/`apiPost`/`apiPut` helpers that attach JWT to API calls

### Shared Types (`packages/shared/src/`)
- `database.ts` — interfaces for all DB tables (Profile, Session, Swipe, Match, etc.)
- `api.ts` — request/response types for all API endpoints
- Exported as raw TypeScript (no build step); API uses `transpilePackages` in next.config.ts

### Database (`supabase/migrations/`)
- 6 migration files run in order in Supabase SQL Editor
- `check_for_match()` trigger on swipes INSERT atomically detects matches
- Realtime enabled on sessions, session_members, swipes, matches

### Key Patterns
- Auth: mobile calls Supabase Auth directly, passes JWT to API via Authorization header
- Match detection: PostgreSQL trigger (not app code) — atomic, no race conditions
- Realtime: mobile subscribes directly to Supabase Realtime (lobby, swipe progress, matches)
- Restaurant data: denormalized from Google Places into session_restaurants per session
