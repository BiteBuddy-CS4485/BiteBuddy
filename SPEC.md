# AGENT-READY PRODUCT SPECIFICATION
## BiteBuddy
### Group Restaurant Matching App

Version 1.1 - Weekly Progress Aligned Spec  
Sprint history and delivery plan through May 1, 2026  
Stack: Expo/React Native, Next.js Route Handlers, Supabase Postgres/Auth/Realtime, Google Places API  
Last Updated: March 13, 2026

Read this entire specification before writing code. This document is the source of truth for coding agents working in this repository.

If the spec and implementation conflict, preserve user-visible behavior and add a `// SPEC QUESTION:` or `// SPEC ERROR:` comment in code where needed.

## Table of Contents
1. Product Overview
2. Tech Stack
3. Project File Structure
4. Data Models
5. Sprint History Through March 13, 2026
6. Remaining Sprint Plan: March 14 - May 1, 2026
7. Delivery Priorities for Remaining Sprints
8. API Reference (Full)
9. UI/UX Guidelines
10. Error Handling Standards
11. Non-Functional Requirements
12. Environment Variables
13. Glossary
14. Agent Instructions and Constraints

## 1. Product Overview
BiteBuddy is a mobile-first group dining app where friends swipe on the same restaurant queue and match when everyone likes the same place.

Core loop:
1. User signs in.
2. User creates or joins a session.
3. Session host starts restaurant fetch for the group.
4. Members swipe Yes/No on the same session restaurants.
5. Database trigger creates a match when all members like a restaurant.
6. Users view match results and history.

### 1.1 Target Users
- Friend groups deciding where to eat quickly.
- Students and coworkers coordinating meals near a shared area.
- Users who prefer quick, game-like group decisions over group chat debate.

### 1.2 Core Value Proposition
- Fast group decision flow with low coordination overhead.
- Fair group matching (requires consensus, not majority).
- Realtime lobby and match updates.
- Shared session history and recent match recall.

### 1.3 Product Scope and Platform
- Primary client: Expo app (`iOS`, `Android`, `Web`).
- API: Next.js app-router route handlers under `/api/*`.
- Data/auth/realtime/storage: Supabase.
- External restaurant source: Google Places API (new Places endpoint).

## 2. Tech Stack
Fixed technologies currently in repo:

| Layer | Technology | Notes / Constraints |
|---|---|---|
| Mobile client | Expo 54 + React Native 0.81 + React 19 + TypeScript | File-based routing via Expo Router. |
| API server | Next.js 16 route handlers + TypeScript | REST-style endpoints in `apps/api/src/app/api`. |
| Shared contracts | `@bitebuddy/shared` TS package | Shared DB interfaces and DTOs consumed by API and mobile. |
| Database | Supabase Postgres | SQL migrations in `supabase/migrations`. |
| Authentication | Supabase Auth | Email/password + Google OAuth. Mobile signs in directly with Supabase. |
| Authorization | Bearer JWT + Postgres RLS | API creates Supabase client with user token; RLS enforces ownership. |
| Realtime | Supabase Realtime | Used for lobby membership and match events. |
| External restaurants | Google Places API | Implemented in `apps/api/src/lib/yelp.ts` (filename retained). |
| API contract | OpenAPI 3.0.3 | Generated from route definitions and coverage checks. |
| Deploy | Vercel (API + web export) | API and mobile web deployment configs in each app workspace. |

## 3. Project File Structure
Use and extend the current monorepo layout.

```text
bitebuddy/
  apps/
    api/
      src/
        app/
          api/
            auth/{signup,login,me,logout}/route.ts
            profile/route.ts
            friends/{route,search,request,respond,requests,requests/sent}/route.ts
            restaurants/discover/route.ts
            sessions/{route,recent-matches,[id], [id]/{invite,join,start,swipe,restaurants,results}}/route.ts
            health/route.ts
            docs/route.ts
        lib/{auth.ts,supabase.ts,yelp.ts}
        middleware.ts
      public/openapi.json
      next.config.ts
      vercel.json
    mobile/
      app/
        (auth)/{login,signup,profile-setup}.tsx
        (tabs)/{index,friends,history,profile}.tsx
        session/create.tsx
        session/[id]/{lobby,swipe,results}.tsx
        _layout.tsx
      components/{SessionCard,FriendCard,RestaurantCard,CompactRestaurantCard,MatchModal}.tsx
      contexts/AuthContext.tsx
      lib/{api.ts,supabase.ts,shadows.ts}
      app.json
      vercel.json
    docs/api-contract/{README.md,openapi.json}
  packages/
    shared/
      src/{database.ts,api.ts,index.ts}
  scripts/
    generate-openapi.cjs
    openapi/contract-definitions.cjs
  supabase/
    migrations/001..007.sql
  Weekly Progress/
  README.md
  COMMANDS.md
  CLAUDE.md
```

## 4. Data Models
Database is SQL-first via Supabase migrations.

### 4.1 `profiles`
```sql
id uuid primary key references auth.users(id)
username text unique not null
display_name text not null
avatar_url text null
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### 4.2 `friendships`
```sql
id uuid primary key default uuid_generate_v4()
requester_id uuid not null references profiles(id)
addressee_id uuid not null references profiles(id)
status text not null default 'pending' check (status in ('pending','accepted','declined'))
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
unique(requester_id, addressee_id)
```

### 4.3 `sessions`
```sql
id uuid primary key default uuid_generate_v4()
created_by uuid not null references profiles(id)
name text not null
status text not null default 'waiting' check (status in ('waiting','active','completed'))
latitude float8 not null
longitude float8 not null
radius_meters int not null default 5000
price_filter text[] null
category_filter text null
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### 4.4 `session_members`
```sql
id uuid primary key default uuid_generate_v4()
session_id uuid not null references sessions(id)
user_id uuid not null references profiles(id)
joined_at timestamptz not null default now()
unique(session_id, user_id)
```

### 4.5 `session_restaurants`
```sql
id uuid primary key default uuid_generate_v4()
session_id uuid not null references sessions(id)
yelp_id text not null
name text not null
image_url text null
rating float4 null
review_count int null
price text null
categories jsonb null
address text null
latitude float8 null
longitude float8 null
phone text null
yelp_url text null
```

### 4.6 `swipes`
```sql
id uuid primary key default uuid_generate_v4()
session_id uuid not null references sessions(id)
user_id uuid not null references profiles(id)
restaurant_id uuid not null references session_restaurants(id)
liked boolean not null
created_at timestamptz not null default now()
unique(session_id, user_id, restaurant_id)
```

### 4.7 `matches`
```sql
id uuid primary key default uuid_generate_v4()
session_id uuid not null references sessions(id)
restaurant_id uuid not null references session_restaurants(id)
matched_at timestamptz not null default now()
```

### 4.8 Functions and Triggers
- `handle_new_user()`: auto-creates profile row after `auth.users` insert.
- `set_updated_at()`: common `updated_at` trigger function.
- `check_for_match()`: after `swipes` insert, inserts `matches` when `like_count >= member_count`.

### 4.9 Realtime and Storage
- Realtime publication includes `sessions`, `session_members`, `swipes`, `matches`.
- Public `avatars` storage bucket with per-user write/update/delete policies.

## 5. Sprint History Through March 13, 2026
Goal: capture what actually happened so far based on the weekly reports, meeting minutes, and current repository state.

### 5.1 Completed Timeline
| Sprint / Week | Dates | What Actually Happened | Tangible Deliverables |
|---|---|---|---|
| Kickoff / Week 1 | Feb 9 - Feb 13, 2026 | Team roles were assigned, the proposal and milestone list were defined, and the project direction was set around a restaurant-matching mobile app. Early planning still referenced Yelp, midpoint logic, and a solo MVP bootstrap to reduce merge conflicts. | Project proposal, elevator pitch, role assignments, milestone list, initial repo/process expectations. |
| Build Sprint / Week 2 | Feb 16 - Feb 20, 2026 | The team completed an initial MVP pass and shifted the restaurant integration from Yelp to Google Places / Google Maps. The monorepo, auth, friends, sessions, restaurant search, deployment, and realtime baseline were stood up while design and architecture work was assigned to the rest of the team. | Working monorepo MVP, Vercel deployment, GitHub project board, Google Cloud setup, initial Figma/design research, architecture research. |
| Hardening Sprint / Week 3 | Feb 23 - Feb 27, 2026 | Infrastructure and environment issues were cleaned up. Google OAuth and callback configuration were fixed, GCP/Vercel permissions were stabilized, API-contract automation was introduced, the mobile app was connected to the backend, and the first architecture and wireframe artifacts were produced. | OAuth fixes, Google Places integration progress, OpenAPI automation, distance/midpoint filtering work, working Expo-to-API connection, system architecture artifact, first wireframes. |
| Alignment Sprint / Week 4 | Feb 27 - Mar 6, 2026 | The team focused on documentation, UI planning, and cost-awareness. The professor-requested `SPEC.md` work started, more wireframes and use-case work were completed, session/home UI implementation began, and Google Places image costs were analyzed after real billing impact was observed. | `SPEC.md` draft, use case diagram, expanded wireframes, session/home screen implementation, cost-reduction research for Google Places photo usage, mobile deployment research. |
| Standup Sprint / Week 5 | Mar 9 - Mar 13, 2026 | Work continued without major blockers. No major scope change was recorded; the team stayed focused on the current implementation, documentation, and polish tasks already in flight. | Ongoing integration work, continued documentation, no new blockers reported. |

### 5.2 Current Repository Snapshot
The weekly reports line up with the code currently in this repository:

- Auth, profile, and friends API routes exist under `apps/api/src/app/api/auth`, `apps/api/src/app/api/profile`, and `apps/api/src/app/api/friends`.
- Session creation, join, invite, start, swipe, restaurant queue, results, and recent match routes already exist under `apps/api/src/app/api/sessions`.
- Mobile auth, tab navigation, session create/lobby/swipe/results screens, and reusable restaurant/match components already exist under `apps/mobile/app` and `apps/mobile/components`.
- Supabase migrations already cover profiles, friendships, sessions, swipes, matches, realtime enablement, and avatar storage.
- OpenAPI generation/check tooling and a GitHub Action already exist, which matches the Week 3 documentation/automation work.

### 5.3 What Is Clearly Still In Progress
- UI implementation is not yet fully caught up to the design work; the reports show wireframes and mockup work still continuing.
- Cost controls for Google Places image usage were researched, but the optimization work is not yet presented as complete.
- The repo has contract automation, but there are no obvious route or end-to-end tests yet.
- Mobile beta release prep, final QA, and final demo packaging were discussed but not finished in the weekly reports.

## 6. Remaining Sprint Plan: March 14 - May 1, 2026
Goal: spend the remaining time making the existing MVP dependable, presentable, and demo-ready rather than expanding scope too aggressively.

### 6.1 Sprint 4 - Core Flow Stabilization
Dates: March 14 - March 27, 2026

Focus:
- Finish aligning implemented screens with the wireframes for Home, Friends, Create Session, Lobby, Swipe, Results, History, and Profile/Settings.
- Stabilize the end-to-end happy path: sign in, invite/join, start session, swipe, detect match, view results/history.
- Fix the known friction points already surfaced by the team: RLS issues around invites, mobile/backend edge cases, and inconsistent session-state updates.
- Implement the first real Google Places cost-control pass using lazy image loading and session-level reuse of restaurant/media data.

Expected deliverables:
- One reliable end-to-end demo path that works on mobile and web.
- Updated `SPEC.md` and OpenAPI artifacts that reflect the implemented flow.
- Prioritized bug list split into must-fix before beta vs. nice-to-have polish.

### 6.2 Sprint 5 - QA, Reliability, and Deployment Prep
Dates: March 28 - April 10, 2026

Focus:
- Add automated coverage for the most important backend paths: auth, sessions, invites/join, swipes, and match-result retrieval.
- Expand CI beyond contract generation so the repo checks basic install/build/test health before merges.
- Standardize API error handling and frontend error messaging so demos fail gracefully instead of confusing users.
- Decide and document the mobile beta distribution path, most likely around Expo/EAS plus TestFlight-style testing.

Expected deliverables:
- First regression test suite for core backend flows.
- CI workflow for contract plus at least one additional quality gate.
- Documented beta deployment/checklist process.
- Fewer environment/setup surprises for new teammates or graders.

### 6.3 Sprint 6 - Beta Polish and Real-Device Validation
Dates: April 11 - April 24, 2026

Focus:
- Run internal test sessions across multiple users/devices and log reproducible issues.
- Polish the screens using Paola's design work: typography, spacing, colors, empty states, loading states, and clearer match/session feedback.
- Tighten the history, profile editing, and avatar flows so the app feels complete during a live walkthrough.
- Revisit stretch features only if the core loop is already stable.

Stretch features only after core stability:
- Background invite notifications.
- Password reset / forgot-password flow.
- Rematch, share code/link, or extra session convenience features.

Expected deliverables:
- Beta candidate build.
- Bug-fix log from real-device testing.
- Presentation-ready UI for the app's main screens.

### 6.4 Final Delivery Window
Dates: April 25 - May 1, 2026

Focus:
- Freeze scope except for critical bugs.
- Rehearse the final demo from a clean environment and make sure the scripted path succeeds.
- Clean up repo-facing documentation: README, setup instructions, API docs, architecture references, and final spec accuracy.
- Prepare any final presentation artifacts, screenshots, and ownership summary needed for handoff.

Expected deliverables:
- Demo-ready build and backend deployment.
- Finalized documentation set.
- Final presentation/demo assets and handoff notes.

## 7. Delivery Priorities for Remaining Sprints
When time is limited, use this priority order.

### 7.1 Priority 0 - Must Be Stable Before Final Demo
- Auth/login/signup/logout and protected-route behavior.
- Session create/join/invite/start flow.
- Shared restaurant queue, swipe persistence, and match detection.
- Results/history visibility after a completed session.
- Google Places usage guardrails so the demo does not create avoidable costs.

### 7.2 Priority 1 - Strongly Recommended Before Beta
- Tests for critical API paths.
- CI checks beyond OpenAPI artifact sync.
- Consistent API/frontend error messaging.
- Better mobile polish on the wireframed screens.
- Beta/TestFlight-style release instructions and validation steps.

### 7.3 Priority 2 - Stretch Work Only After Core Stability
- Background notifications for invites or matches.
- Password reset and deeper account-management flows.
- Advanced midpoint fairness logic or ranking improvements.
- Convenience features such as rematch, share links, or richer restaurant details.

## 8. API Reference (Full)
Base URL: `/api`  
Protected routes: `Authorization: Bearer <access_token>`  
Current envelope: success `{ "data": ... }`, failure `{ "error": "message" }`

### 8.1 Health and Docs
- `GET /health` -> API status object with timestamp.
- `GET /docs` -> Swagger UI HTML.

### 8.2 Auth Routes
- `POST /auth/signup`
  - Body: `{ email, password, username, display_name? }`
  - Success: user plus optional access/refresh tokens.
  - Errors: `400`.
- `POST /auth/login`
  - Body: `{ email, password }`
  - Success: user + access_token + refresh_token.
  - Errors: `400`, `401`.
- `GET /auth/me` (protected)
  - Success: current profile row.
  - Errors: `401`, `404`.
- `POST /auth/logout` (protected)
  - Success: signed-out message.
  - Errors: `400`, `401`.

### 8.3 Profile Route
- `PUT /profile` (protected)
  - Body: partial `{ username?, display_name?, avatar_url? }`
  - Success: updated profile row.
  - Errors: `400`, `401`.

### 8.4 Friend Routes
- `GET /friends` (protected) -> accepted friendships with `profile`.
- `POST /friends/request` (protected)
  - Body: `{ username }`
  - Errors: `400`, `404`, `409`.
- `POST /friends/respond` (protected)
  - Body: `{ friendship_id, action: "accept" | "decline" }`
  - Errors: `400`.
- `GET /friends/requests` (protected) -> incoming pending requests.
- `GET /friends/requests/sent` (protected) -> outgoing pending requests.
- `GET /friends/search?q=<query>` (protected) -> profile search results.

### 8.5 Restaurant Discovery Route
- `GET /restaurants/discover` (protected)
  - Query: `latitude`, `longitude`, optional `cuisine`, optional `radius`.
  - Success: `{ restaurants: PlaceBusiness[] }`.
  - Errors: `400`, `401`, `500`.

### 8.6 Session Routes
- `GET /sessions` (protected)
  - Optional query: `status in {waiting,active,completed}`.
- `POST /sessions` (protected)
  - Body: `{ name, latitude, longitude, radius_meters?, price_filter?, category_filter? }`
  - Success: created session (`201`).
- `GET /sessions/recent-matches` (protected)
  - Optional query: `limit` (1..50, default 10).
- `GET /sessions/{id}` (protected) -> details + members + counts.
- `POST /sessions/{id}/invite` (protected)
  - Body: `{ user_ids: uuid[] }`
  - Success: upserted session member rows (`201`).
- `POST /sessions/{id}/join` (protected) -> upsert current user membership (`201`).
- `POST /sessions/{id}/start` (protected)
  - Host-only; loads restaurants and flips status to `active`.
  - Errors: `400`, `401`, `403`, `404`, `502`.
- `GET /sessions/{id}/restaurants` (protected) -> session queue rows.
- `POST /sessions/{id}/swipe` (protected)
  - Body: `{ restaurant_id, liked }`
  - Success: `{ swipe_id, is_match, match? }`.
- `GET /sessions/{id}/results` (protected)
  - Success: `{ matches, total_restaurants, swipe_progress }`.

## 9. UI/UX Guidelines
### 9.1 Navigation and Layout
- Root auth gate routes to `(auth)` or `(tabs)` groups.
- Bottom tabs: Home, Friends, History, Profile.
- Session stack screens: Create, Lobby, Swipe, Results.
- FAB on Home opens session creation.

### 9.2 Visual System
- Primary accent: `#FF6B35`.
- Common surfaces: white cards on light gray page backgrounds (`#f8f8f8`).
- Rounded cards/buttons (12-16px radius), bold headers, compact metadata text.
- Status colors:
  - Waiting: orange-tinted.
  - Active: green-tinted.
  - Completed: neutral gray.

### 9.3 Component Rules
- Reuse existing shared cards in `apps/mobile/components`.
- Preserve loading and empty states in each screen.
- Keep controls thumb-friendly and mobile-first.
- Keep map/open-link actions explicit in result and match views.

### 9.4 Realtime UX Rules
- Lobby updates member list on `session_members` inserts.
- Swipe screen listens to `matches` inserts and opens match modal.
- Home screen listens for invited membership inserts and alerts user.

## 10. Error Handling Standards
### 10.1 Current API Shape
```json
{ "data": {} }
```
or
```json
{ "error": "message" }
```

### 10.2 Expected Status Behavior
- `400` invalid payload or operation.
- `401` missing/invalid token.
- `403` authenticated but not allowed (host-only start).
- `404` resource not found.
- `409` conflict (duplicate friendship/request).
- `500/502` upstream/provider or server failures.

### 10.3 Frontend Handling
- `apiGet/apiPost/apiPut` throw on non-OK and surface `error`.
- Most screens show `Alert` and keep fallback UI state.
- Silent fallbacks allowed for non-critical fetches (for example Home feed sections).

## 11. Non-Functional Requirements
### 11.1 Security
- Never expose server API keys to mobile/web client bundles.
- All protected API routes must use `getAuthenticatedClient`.
- Keep RLS enabled on all domain tables.
- Restrict CORS to known origins and Vercel previews for API routes.

### 11.2 Performance
- Clamp search radius and max result count in Places adapter.
- Keep payload sizes bounded (for example recent matches limit max 50).
- Avoid redundant fetch loops in screen lifecycle effects.

### 11.3 Accessibility
- Maintain readable text contrast and touch target sizes.
- Preserve clear loading, empty, and error states.
- Keep motion and visual effects optional/minimal for core actions.

### 11.4 Code Quality
- TypeScript strict mode in all workspaces.
- Shared request/response/database types live in `@bitebuddy/shared`.
- Route and contract definitions must remain in sync.
- Avoid introducing route handlers without OpenAPI contract updates.

### 11.5 Core User Flows
1. User signs up or signs in (email/password or Google OAuth).
2. User lands in tabs home and can create or join sessions.
3. Host creates session, invites friends, starts discovery.
4. Members swipe through same restaurant list.
5. Match appears in realtime; results and history persist.

## 12. Environment Variables
Use `.env.example` as canonical baseline.

### 12.1 API (`apps/api/.env.local`)
```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
GOOGLE_PLACES_API_KEY=
```

### 12.2 Mobile (`apps/mobile/.env`)
```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_URL=
```

Notes:
- `EXPO_PUBLIC_*` variables are client-exposed by design.
- Never place service-role secrets in client env.

## 13. Glossary
- Profile: user record in `profiles` linked 1:1 to `auth.users`.
- Friendship: directed relationship row (`pending`, `accepted`, `declined`).
- Session: group matching event (`waiting`, `active`, `completed`).
- Session member: membership row connecting user to a session.
- Session restaurant: denormalized restaurant candidate row for one session.
- Swipe: user decision (`liked=true/false`) for one session restaurant.
- Match: consensus result row created by DB trigger.
- Recent match: API-composed summary of recent matches across user sessions.

## 14. Agent Instructions and Constraints
### 14.1 Phase Gates
- Do not start Phase 2 changes until auth/profile/friends paths are stable.
- Do not start Phase 3 hardening until core session/match loop is stable.
- Run required DB migrations before implementing dependent features.

### 14.2 Build Order Within a Feature
1. Data model / migration changes.
2. API route logic.
3. Shared type updates.
4. Mobile UI integration.
5. Contract/docs update (`api:contract:generate` or `api:contract:check`).

### 14.3 Decision Rules
- Prefer consistency with existing app patterns over greenfield redesign.
- If ambiguous, choose simpler implementation and annotate with `// SPEC QUESTION:`.
- If architecture changes are required, annotate with `// ARCH DECISION:`.

### 14.4 Security Rules (Non-Negotiable)
- Never hardcode secrets, user IDs, or environment-specific URLs.
- Never bypass auth helper on protected routes.
- Keep RLS-compatible query patterns and ownership checks.
- Do not expose stack traces or internals in production API responses.

### 14.5 Handling Gaps
When this spec lacks detail:
1. Follow existing pattern in nearby route/screen code.
2. Choose the approach that preserves current user behavior.
3. Keep changes minimal and type-safe.
4. Document assumptions inline if they affect API/data contracts.

End of Specification - BiteBuddy v1.1 (Weekly Progress Aligned) - March 13, 2026
