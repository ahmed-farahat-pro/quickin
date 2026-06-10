# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**QuickIn** — a boutique vacation rental platform (Airbnb-style prototype) built with Next.js 16 App Router, Supabase (PostgreSQL + Auth + RLS), and TypeScript in strict mode. React 19, Zod 4, Zustand 5.

## Commands

```bash
npm run dev          # Dev server at localhost:3000
npm run build        # Production build
npm run lint         # ESLint (flat config, eslint 9)
npm run gen-types    # Regenerate src/types/supabase.ts from live Supabase schema
npm run check:i18n   # Validate translation keys match between en.json and ar.json
```

No test runner is configured. Package manager is **npm** (package-lock.json tracked).

## Architecture

### Routing (App Router)

- `src/app/(main)/*` — Public site (homepage, listings, services)
- `src/app/(dashboard)/*` — Authenticated user/host dashboard (redirects unauthenticated to login)
- `src/app/admin/*` — Staff-only admin panel (gated by `staff_profiles`)
- `src/app/auth/*` — OAuth callback, invite, password reset
- `src/app/api/*` — Route handlers (AI chat, cron jobs, admin endpoints)
- `src/app/actions/*` — Server actions (best-offers, calendar)

### Data Layer (Supabase)

- **Server client**: `src/lib/supabase/server.ts` — use in server components, route handlers, server actions
- **Browser client**: `src/lib/supabase/client.ts` — use in client components
- **Admin client**: `src/lib/supabase/admin.ts` and `src/lib/supabase/server.ts` both export `createAdminClient()` using service role key for privileged operations
- **Reads**: centralized in `src/lib/supabase/queries.ts`
- **Mutations**: spread across `src/lib/supabase/*.ts` (bookings.ts, reviews.ts, wishlists.ts, auth-actions.ts, admin.ts, etc.)
- **Migrations**: `supabase/migrations/*.sql` (60+ numbered migration files)
- **Generated types**: `src/types/supabase.ts` (run `npm run gen-types` after schema changes)
- **Hand-maintained types**: `src/types/database.ts`

### Session & Auth

- Supabase Auth (email/password + OAuth via Google/GitHub) + Firebase (legacy integration)
- Middleware at `src/lib/supabase/middleware.ts` refreshes sessions via cookies and protects `/dashboard/*` routes
- **Critical**: do not add code between `createServerClient()` and `supabase.auth.getUser()` in middleware — causes random logouts
- Auth mutations (`signUp`, `signIn`, `signOut`) are server actions in `src/lib/supabase/auth-actions.ts` — all call `revalidatePath('/', 'layout')` after auth changes
- `createClient()` in server.ts returns `null` if Supabase env vars are missing (supports dev without DB)
- `createAdminClient()` uses `@supabase/supabase-js` directly (not SSR) to bypass RLS

### UI & Styling

- **shadcn/ui** (New York style, Radix primitives) — components in `src/components/ui/`
- **Tailwind CSS 4** with CSS variable theming in `src/app/globals.css`
- **RTL support** enabled (shadcn `rtl: true` in components.json)
- **Icons**: Lucide React (primary), Tabler icons (secondary)
- Feature components: `src/components/features/{listings,search,dashboard,host,auth,ai,verification,reviews,wishlists}/`
- Layout components: `src/components/layout/` (navbar, footer, promo banner)
- Admin components: `src/components/admin/`
- **Design tokens** in globals.css: warm boutique palette (burgundy primary `#5B0F16`, cream background `#F6F1E6`, tan secondary `#EFE6D8`)
- **Custom CSS classes**: `.glass` / `.glass-strong` (frosted glass), `.card-shadow`, `.rounded-card` (28px), `.rounded-button` (20px), `.rounded-input` (18px), `.rounded-modal` (32px)
- **Fonts**: DM_Sans (body), Noto_Sans_Arabic (Arabic body), Playfair_Display (hero), Amiri (Arabic hero), Geist_Mono — set in root layout

### State Management

Zustand stores in `src/stores/` (auth-store, search-store, ui-store), re-exported from `src/stores/index.ts`.

### Internationalization (next-intl)

- Locales: English (`en`), Arabic (`ar` with RTL)
- Translation files: `src/messages/{en,ar}.json`
- Config: `src/i18n/config.ts`, request locale: `src/i18n/request.ts`
- Plugin configured in `next.config.ts` via `createNextIntlPlugin`
- Locale cookie: `NEXT_LOCALE` — detection order: path → header → cookie → Accept-Language
- BCP47 mapping: `ar` → `ar-EG-u-nu-latn`, `en` → `en-US`
- After adding/removing translation keys, run `npm run check:i18n` to verify both locales are in sync

### Forms & Validation

react-hook-form + Zod schemas (in `src/lib/validations/`) + `@hookform/resolvers`.

### Key Integrations

- **AI Chat**: Google Gemini via `src/lib/gemini/client.ts`, served at `src/app/api/chat/route.ts`
- **Maps**: React Leaflet for location display
- **Cron**: Vercel cron for booking timeouts (`/api/cron/booking-timeouts`, daily at midnight — see `vercel.json`)

### Root Layout Providers

`src/app/layout.tsx` wraps the app with: `NextIntlClientProvider` → `AppDirectionProvider` (Radix RTL) → Sonner `Toaster` (top-center) + `RouteProgressBar` + `GlobalLoadingBar`.

### Layout Groups

- `(main)` layout — fetches `site_settings` (navbar/footer config) + attributes cache; renders Navbar, PromoBanner, Footer, ChatWidget, AuthModal
- `(dashboard)` layout — checks auth (redirects to `/login?redirect=/dashboard`), fetches profile + staff role, renders UserSidebar with breadcrumbs
- `admin` layout — checks `staff_profiles.is_active`, redirects non-staff to `/`, renders AdminSidebar

### Utilities

- `cn()` in `src/lib/utils.ts` — clsx + tailwind-merge
- `parsePostGISHex()` in `src/lib/utils.ts` — converts PostGIS EWKB hex to `{lat, lng}` (used for `location_geo` fields)

### Data Patterns

- **Reads**: centralized in `queries.ts` using Next.js `cache()` for deduplication
- **Mutations**: call `revalidatePath()` after writes to bust cache
- **Server Components by default** — only add `'use client'` when needed

## Import Alias

`@/*` maps to `src/*` (tsconfig paths).

## Environment Variables

See `docs/env-setup.md`. Required:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase connection
- `SUPABASE_SERVICE_ROLE_KEY` — server-only admin operations
- `GEMINI_API_KEY` — AI chat

## Deployment

Vercel. See `docs/DEPLOYMENT.md`.

## Image Domains

Remote patterns configured in `next.config.ts`: `images.unsplash.com`, `*.supabase.co`.
