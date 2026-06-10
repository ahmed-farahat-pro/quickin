# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Common commands
This is a Next.js (App Router) + TypeScript repo managed with npm (has `package-lock.json`).

### Install dependencies
```bash
npm ci
```

### Run locally
```bash
npm run dev
```
Dev server defaults to `http://localhost:3000`.

### Production build / start
```bash
npm run build
npm run start
```

### Lint
```bash
npm run lint
```

### Generate Supabase types
```bash
npm run gen-types
```
This runs `supabase gen types …` and overwrites `src/types/supabase.ts`.

### Tests
No test runner/config was found in this repo (no `test` script, no `*.test.*`/`*.spec.*`, no Jest/Vitest/Playwright config).

## Environment variables
See `docs/env-setup.md`.

Expected variables (names only):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; used by admin endpoints)
- `GEMINI_API_KEY`

## High-level architecture

### Next.js App Router structure (`src/app`)
- Root app shell: `src/app/layout.tsx`
  - Defines global fonts, imports `src/app/globals.css`, and mounts the toast system.
- Public site routes: `src/app/(main)/*`
  - `src/app/(main)/layout.tsx` composes the global marketing/app chrome (navbar/footer) and mounts:
    - AI chat widget (`@/components/features/ai`)
    - Auth modal (`@/components/features/auth`)
- Auth routes: `src/app/auth/*`
  - OAuth callback handler: `src/app/auth/callback/route.ts` (exchanges `code` for a Supabase session).
- Signed-in user dashboard: `src/app/(dashboard)/*`
  - `src/app/(dashboard)/layout.tsx` is an async server layout that:
    - creates a Supabase server client
    - redirects to `/login` when unauthenticated
    - loads `profiles` and (optionally) `staff_profiles` to drive sidebar UI
- Staff/admin UI: `src/app/admin/*`
  - `src/app/admin/layout.tsx` enforces staff access via `staff_profiles`.
- API routes: `src/app/api/**/route.ts`
  - Public AI endpoint: `src/app/api/chat/route.ts` (Gemini-powered chat; enriches prompt with recent listings).
  - Admin endpoints under `src/app/api/admin/**` (staff-gated operations + audit logging).

### Auth + session plumbing
- `src/middleware.ts` delegates to `@/lib/supabase/middleware.updateSession`.
  - Handles session refresh via cookies.
  - Protects `/dashboard/*` routes by redirecting unauthenticated users.

### Data access layer (Supabase)
Key pattern: server components/actions use the server client from `@/lib/supabase/server`; client components use `@/lib/supabase/client`.

- Supabase clients:
  - `src/lib/supabase/server.ts`: `createClient()` for server components / route handlers (returns `null` if env vars missing).
  - `src/lib/supabase/client.ts`: `createClient()` for browser usage.
  - `src/lib/supabase/admin.ts`: `createAdminClient()` uses `SUPABASE_SERVICE_ROLE_KEY` for privileged server-only operations.
- Query/read functions live in `src/lib/supabase/queries.ts` (listings, reviews, availability, pricing, etc.).
- Mutations are mostly implemented as Next.js Server Actions under `src/lib/supabase/*.ts` (e.g. `auth-actions.ts`, `bookings.ts`, `favorites.ts`, `reviews.ts`).
- Database schema is tracked as SQL migrations in `supabase/migrations/*.sql`.

### AI assistant (Gemini)
- `src/lib/gemini/client.ts` owns Gemini model setup + `buildSystemPrompt()`.
- `src/app/api/chat/route.ts` is the server entrypoint for chat requests.

### UI/component organization
- `src/components/ui/*`: shadcn/ui components (Radix-based primitives).
- `src/components/features/*`: feature modules (listings, search, auth, dashboard, admin, verification, AI, etc.), usually with `index.ts` barrels.
- `src/components/layout/*`: layout chrome (navbar/footer/etc.), with an `index.ts` barrel.
- Styling/theme tokens live in `src/app/globals.css` (Tailwind v4 + `@theme` tokens). `components.json` configures shadcn + import aliases.

### State management
- Zustand stores live in `src/stores/*` and are re-exported from `src/stores/index.ts`.

### Types
- Hand-maintained domain types: `src/types/database.ts` (re-exported via `src/types/index.ts`).
- Generated Supabase types: `src/types/supabase.ts` (updated via `npm run gen-types`).

### Import aliases
- TypeScript path alias: `@/*` → `src/*` (see `tsconfig.json`).
- shadcn aliases (see `components.json`): `@/components`, `@/components/ui`, `@/lib`, `@/hooks`, etc.

## Deployment
See `docs/DEPLOYMENT.md` for Vercel deployment notes and required environment variables.