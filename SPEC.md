# AGENT-READY PRODUCT SPECIFICATION
## BiteBuddy
### Group Restaurant Matching App

Version 1.2 - Weekly Progress Aligned Spec  
Sprint history and delivery plan through May 1, 2026  
Stack: Expo/React Native, Next.js Route Handlers, Supabase Postgres/Auth/Realtime, Google Places API  
Last Updated: April 23, 2026

Read this entire specification before writing code. This document is the source of truth for coding agents working in this repository.

If the spec and implementation conflict, preserve user-visible behavior and add a `// SPEC QUESTION:` or `// SPEC ERROR:` comment in code where needed.

## Table of Contents
1. Product Overview
2. Tech Stack
3. Project File Structure
4. Data Models
5. Sprint History Through April 23, 2026
6. Sprint Plan: March 14 - May 1, 2026 (Actual + Remaining)
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
  .github/
    workflows/
      api-contract.yml          # OpenAPI contract generation and sync check
      tests.yml                 # Vitest unit test runner
  apps/
    api/
      src/
        app/
          api/
            auth/{signup,login,me,logout}/route.ts
            profile/route.ts
            friends/{route,search,request,respond,requests,requests/sent}/route.ts
            restaurants/discover/route.ts
            sessions/
              route.ts
              recent-matches/route.ts
              join-by-code/route.ts    # Join session via 6-char invite code
              [id]/
                route.ts
                invite/route.ts
                join/route.ts
                start/route.ts
                swipe/route.ts
                restaurants/route.ts
                results/route.ts
                cancel/route.ts        # Host cancels a session
                leave/route.ts         # Member leaves a session
                discover/route.ts      # Per-session location-aware restaurant discovery
            health/route.ts
            docs/route.ts
        lib/
          auth.ts
          supabase.ts
          yelp.ts
          __tests__/yelp.test.ts       # Vitest unit tests for Places adapter
        middleware.ts
      public/openapi.json
      next.config.ts
      vercel.json
      vitest.config.ts
    mobile/
      app/
        (auth)/
          _layout.tsx
          index.tsx              # Auth landing/splash screen
          login.tsx
          signup.tsx
          profile-setup.tsx
          forgot-password.tsx    # Request password reset email
          reset-password.tsx     # Deep-link handler for password reset
        (tabs)/
          _layout.tsx
          index.tsx              # Home: active/waiting sessions + join by invite code
          friends.tsx
          history.tsx            # Completed/cancelled session history
          profile.tsx
          sessions.tsx           # Sessions tab (active sessions view)
        session/
          create.tsx
          [id]/
            lobby.tsx            # Pre-start lobby with MapView for member locations
            swipe.tsx
            results.tsx
        _layout.tsx
      components/{SessionCard,FriendCard,RestaurantCard,CompactRestaurantCard,MatchModal}.tsx
      contexts/AuthContext.tsx
      lib/{api.ts,supabase.ts,shadows.ts}
      app.json
      vercel.json
    docs/api-contract/{README.md,openapi.json}
  packages/
    shared/
      src/
        database.ts
        api.ts
        geolocation.ts          # calculateCentroid, calculateDistance utilities
        index.ts
        __tests__/
          api.test.ts
          geolocation.test.ts   # Vitest unit tests for geolocation utilities
      vitest.config.ts
  scripts/
    generate-openapi.cjs
    openapi/contract-definitions.cjs
  supabase/
    migrations/
      001_create_profiles.sql
      002_create_friendships.sql
      003_create_sessions.sql
      004_create_swipes_matches.sql
      005_match_detection.sql
      006_enable_realtime.sql
      007_create_avatars_bucket.sql
      008_add_invite_code.sql           # invite_code column + generate_invite_code()
      009_add_cancelled_status.sql      # 'cancelled' added to sessions.status check
      010_invite_lookup_and_leave_policy.sql
      011_complete_session_function.sql
      012_store_user_location_function.sql  # Per-user location storage for centroid
      013_performance_indexes.sql           # Partial index on liked swipes; user_id index on session_members
  Weekly Progress/
  BiteBuddy_Scalability_Audit.pdf   # Performance analysis and index justification
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
status text not null default 'waiting' check (status in ('waiting','active','completed','cancelled'))
latitude float8 not null
longitude float8 not null
radius_meters int not null default 5000
price_filter text[] null
category_filter text null
invite_code text unique          -- 6-character alphanumeric code, generated on create
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
- `generate_invite_code()`: returns a random 6-character alphanumeric string; called on session create.
- `store_user_location(lat, lng)`: stores calling user's last known location; used by the lobby to compute group centroid for restaurant discovery.

### 4.10 Performance Indexes (migration 013)
Two targeted indexes added to address hot paths identified in the scalability audit:
- `swipes_match_check_idx` — partial index on `swipes(session_id, restaurant_id) WHERE liked = true`. Speeds up the `check_for_match()` trigger, which counts liked swipes per restaurant on every swipe insert.
- `session_members_user_id_idx` — index on `session_members(user_id)`. Allows RLS policy subqueries of the form `session_id IN (SELECT session_id FROM session_members WHERE user_id = auth.uid())` to use an index instead of a full scan. The existing unique index leads with `session_id`, so it could not serve user-id-only lookups.

### 4.9 Realtime and Storage
- Realtime publication includes `sessions`, `session_members`, `swipes`, `matches`.
- Public `avatars` storage bucket with per-user write/update/delete policies.

## 5. Sprint History Through April 23, 2026
Goal: capture what actually happened based on weekly reports, meeting minutes, and current repository state.

### 5.1 Completed Timeline
| Sprint / Week | Dates | What Actually Happened | Tangible Deliverables |
|---|---|---|---|
| Kickoff / Week 1 | Feb 9 - Feb 13, 2026 | Team roles were assigned, the proposal and milestone list were defined, and the project direction was set around a restaurant-matching mobile app. Early planning still referenced Yelp, midpoint logic, and a solo MVP bootstrap to reduce merge conflicts. | Project proposal, elevator pitch, role assignments, milestone list, initial repo/process expectations. |
| Build Sprint / Week 2 | Feb 16 - Feb 20, 2026 | The team completed an initial MVP pass and shifted the restaurant integration from Yelp to Google Places / Google Maps. The monorepo, auth, friends, sessions, restaurant search, deployment, and realtime baseline were stood up while design and architecture work was assigned to the rest of the team. | Working monorepo MVP, Vercel deployment, GitHub project board, Google Cloud setup, initial Figma/design research, architecture research. |
| Hardening Sprint / Week 3 | Feb 23 - Feb 27, 2026 | Infrastructure and environment issues were cleaned up. Google OAuth and callback configuration were fixed, GCP/Vercel permissions were stabilized, API-contract automation was introduced, the mobile app was connected to the backend, and the first architecture and wireframe artifacts were produced. | OAuth fixes, Google Places integration progress, OpenAPI automation, distance/midpoint filtering work, working Expo-to-API connection, system architecture artifact, first wireframes. |
| Alignment Sprint / Week 4 | Feb 27 - Mar 6, 2026 | The team focused on documentation, UI planning, and cost-awareness. The professor-requested `SPEC.md` work started, more wireframes and use-case work were completed, session/home UI implementation began, and Google Places image costs were analyzed after real billing impact was observed. | `SPEC.md` draft, use case diagram, expanded wireframes, session/home screen implementation, cost-reduction research for Google Places photo usage, mobile deployment research. |
| Standup Sprint / Week 5 | Mar 9 - Mar 13, 2026 | Work continued without major blockers. No major scope change was recorded; the team stayed focused on the current implementation, documentation, and polish tasks already in flight. | Ongoing integration work, continued documentation, no new blockers reported. |
| Forgot Password / Week 6 | Mar 14 - Mar 27, 2026 | Added the full forgot-password and reset-password flow. The mobile app gained two new auth screens (`forgot-password.tsx`, `reset-password.tsx`) and the auth context was updated to handle the deep-link token. | Working password-reset email flow, deep-link reset handler, updated `AuthContext`. |
| Invite Code + Cancel/Leave + UI / Week 7 | Mar 28 - Apr 3, 2026 | Major week of feature delivery. Shareable 6-character invite codes were added to sessions so users can join without being manually invited by the host. Cancel session (host-only) and leave session (member) actions were added. The session history tab was fixed to actually show completed/cancelled sessions. A large UI overhaul touched every major screen. Several bug fixes landed for Google Places, join codes, swiping, and RLS permissions. | `invite_code` column (migration 008), `cancelled` status (migration 009), `join-by-code` API route, `cancel` and `leave` API routes, invite-code UI in lobby and home, major mobile screen redesign, history screen working. |
| Location and Discovery / Week 8 | Apr 4 - Apr 10, 2026 | Per-session location-aware restaurant discovery was implemented. The lobby now shows a MapView with pinned member locations. A `store_user_location` DB function stores each member's last known coordinates. A new `POST /sessions/{id}/discover` route computes the group centroid from stored member locations (using `calculateCentroid` from the new `packages/shared/src/geolocation.ts` module) and searches Google Places around that midpoint. Additional RLS fixes were made for invite-code joins. | `sessions/[id]/discover` route, `geolocation.ts` shared utilities (`calculateCentroid`, `calculateDistance`), MapView in lobby, migration 012 (user location storage). |
| Unit Testing + CI/CD / Week 9 | Apr 11 - Apr 16, 2026 | Unit tests were added for the Places adapter (`yelp.test.ts`), shared API types (`api.test.ts`), and geolocation utilities (`geolocation.test.ts`) using Vitest. A new GitHub Actions workflow (`tests.yml`) runs the test suite on every push, alongside the existing OpenAPI contract check. | Vitest test suites in `apps/api` and `packages/shared`, `tests.yml` CI workflow, CI passing on merge. |
| Performance + Scalability / Week 10 | Apr 17 - Apr 23, 2026 | A scalability audit was completed and documented (`BiteBuddy_Scalability_Audit.pdf`). Two performance indexes were added in migration 013: a partial index on liked swipes to speed up the `check_for_match()` trigger, and a `user_id` index on `session_members` to make RLS policy subqueries index-scannable. Documentation updated with Week 8 and Week 9 progress reports. `SPEC.md` brought up to date. | Migration 013 (performance indexes), `BiteBuddy_Scalability_Audit.pdf`, updated weekly progress PDFs, updated `SPEC.md`. |

### 5.2 Current Repository Snapshot (as of April 23, 2026)
- Auth, profile, and friends API routes are fully implemented and deployed.
- Session routes cover creation, join, invite (user ID list), join-by-code, start, swipe, restaurant queue, results, recent matches, cancel, and leave.
- A per-session location-aware discovery route (`POST /sessions/{id}/discover`) computes the group centroid and queries Google Places.
- Mobile screens cover the full core loop: auth (login, signup, forgot/reset password), profile setup, tab home with invite-code entry, friends, history (completed/cancelled), profile, session create with MapView, lobby with member location map, swipe, and results.
- 13 Supabase migrations are in place covering all domain tables, realtime publication, avatar storage, invite codes, cancelled status, RLS policy updates, user location storage, and performance indexes.
- Two GitHub Actions CI workflows run on every push: OpenAPI contract check and Vitest unit tests.
- Shared geolocation utilities (`calculateCentroid`, `calculateDistance`) live in `@bitebuddy/shared` and are covered by unit tests.

### 5.3 What Is Still Pending Before Final Demo
- End-to-end or integration tests do not yet exist; only unit tests covering pure functions are in place.
- Mobile beta release prep (EAS / TestFlight distribution) has not been formalized.
- Final UI polish and empty/error states across all screens are still being finished.
- Final demo rehearsal and documentation cleanup are planned for the last week.

## 6. Sprint Plan: March 14 - May 1, 2026 (Actual + Remaining)

### 6.1 Sprint 4 - Core Flow Stabilization ✅ COMPLETED
Dates: March 14 - March 27, 2026

What happened:
- Forgot password / reset password flow fully implemented (new auth screens, deep-link handler, AuthContext updates).
- Ongoing end-to-end stabilization and bug triage continued.

Delivered:
- Working password-reset email flow.
- Updated `AuthContext` with token handling for deep-link resets.

### 6.2 Sprint 5 - Features, UI, and CI ✅ COMPLETED
Dates: March 28 - April 10, 2026

What happened:
- Shareable invite codes shipped: sessions now generate a 6-character code on creation; users can enter the code from the Home screen to join without a manual invite.
- Cancel session (host) and leave session (member) actions were added and wired to new API routes.
- History tab was fixed to correctly display completed and cancelled sessions.
- Major UI overhaul across every core screen: auth, home, lobby, swipe, history, profile, and session create.
- Location-aware restaurant discovery landed: lobby shows a MapView with member pins; `POST /sessions/{id}/discover` computes the group centroid and queries Google Places around it.
- Shared geolocation utilities (`calculateCentroid`, `calculateDistance`) added to `@bitebuddy/shared`.
- Bug fixes for Google Places calls, RLS policies on invite-code joins, and swipe edge cases.
- CI expanded: Vitest unit tests added for the Places adapter and geolocation utilities; `tests.yml` workflow runs on every push.

Delivered:
- `invite_code` column (migration 008), `cancelled` status (migration 009), invite/leave/cancel API routes.
- `sessions/[id]/discover` route and `geolocation.ts` shared module.
- MapView in lobby, invite-code entry on Home.
- Vitest suites in `apps/api` and `packages/shared`, `tests.yml` CI workflow.

### 6.3 Final Delivery Window
Dates: April 25 - May 1, 2026

Focus:
- Freeze scope to critical bugs only.
- Rehearse the final demo from a clean environment and confirm the scripted happy path succeeds end-to-end.
- Polish remaining empty and error states so the demo fails gracefully rather than confusingly.
- Clean up repo-facing documentation: README, setup instructions, API docs, architecture references, and final spec accuracy.
- Prepare final presentation artifacts, screenshots, and ownership summary needed for handoff.

Expected deliverables:
- Demo-ready build and backend deployment confirmed stable.
- Finalized documentation set (README, SPEC, OpenAPI).
- Final presentation/demo assets and handoff notes.

## 7. Delivery Priorities for Final Week
When time is limited, use this priority order.

### 7.1 Priority 0 - Must Be Stable Before Final Demo
- Auth/login/signup/logout and protected-route behavior. ✅ Done
- Session create/join (by invite list or invite code)/start flow. ✅ Done
- Shared restaurant queue, swipe persistence, and match detection. ✅ Done
- Results/history visibility after a completed or cancelled session. ✅ Done
- Google Places usage guardrails so the demo does not create avoidable costs. ✅ Done (photo proxy removed; direct Places calls gated per session)
- Forgot/reset password flow. ✅ Done
- Cancel and leave session. ✅ Done

### 7.2 Priority 1 - Remaining Before Demo
- Consistent API/frontend error messaging and graceful empty states (partially done; still polish needed).
- Full end-to-end demo rehearsal from a clean install on a real device.
- Final documentation cleanup (README, setup guide, SPEC).

### 7.3 Priority 2 - Stretch Work (Only If Time Allows)
- Background push notifications for invites or matches.
- Supabase observability / analytics surface in-app.
- Richer restaurant details deep-link or in-app sheet.
- Rematch convenience feature.
- Monetization research.

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
  - Optional query: `status in {waiting,active,completed,cancelled}`.
- `POST /sessions` (protected)
  - Body: `{ name, latitude, longitude, radius_meters?, price_filter?, category_filter? }`
  - Success: created session with generated `invite_code` (`201`).
- `GET /sessions/recent-matches` (protected)
  - Optional query: `limit` (1..50, default 10).
- `POST /sessions/join-by-code` (protected)
  - Body: `{ invite_code: string }`
  - Looks up session by the 6-character code and upserts the user as a member.
  - Success: `{ session }` (`201`).
  - Errors: `400`, `404`.
- `GET /sessions/{id}` (protected) -> details + members + counts.
- `POST /sessions/{id}/invite` (protected)
  - Body: `{ user_ids: uuid[] }`
  - Success: upserted session member rows (`201`).
- `POST /sessions/{id}/join` (protected) -> upsert current user membership (`201`).
- `POST /sessions/{id}/start` (protected)
  - Host-only; loads restaurants and flips status to `active`.
  - Errors: `400`, `401`, `403`, `404`, `502`.
- `POST /sessions/{id}/discover` (protected)
  - Computes group centroid from stored member locations and queries Google Places.
  - Success: `{ restaurants: PlaceBusiness[] }`.
  - Errors: `400`, `401`, `403`, `404`, `502`.
- `GET /sessions/{id}/restaurants` (protected) -> session queue rows.
- `POST /sessions/{id}/swipe` (protected)
  - Body: `{ restaurant_id, liked }`
  - Success: `{ swipe_id, is_match, match? }`.
- `GET /sessions/{id}/results` (protected)
  - Success: `{ matches, total_restaurants, swipe_progress }`.
- `POST /sessions/{id}/cancel` (protected)
  - Host-only; flips session status to `cancelled`.
  - Errors: `400`, `401`, `403`, `404`.
- `POST /sessions/{id}/leave` (protected)
  - Removes calling user from `session_members`.
  - Errors: `400`, `401`, `404`.

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

End of Specification - BiteBuddy v1.2 (Weekly Progress Aligned) - April 23, 2026
