# QuickIn Web App (`src/`)

The Next.js 16 (App Router, React 19, TypeScript strict) web app for QuickIn — a boutique
vacation-rental platform.

> **Read this first — the data layer is NOT Supabase.** Older docs (and `CLAUDE.md`) describe a
> Supabase stack; that is **stale** for the live site. The deployed web app runs on a **"local
> stack"**: a `node-postgres` Pool against a Neon Postgres DB, with stateless HMAC `qk_token`
> cookies for auth. The Supabase code under `src/lib/supabase/*` and the `(main)` / `(dashboard)` /
> `admin` route groups are **legacy** and largely dormant in production (the proxy redirects `/` →
> `/explore`). The **active** pages are the unprefixed standalone routes (`/explore`, `/host`,
> `/account`, `/login`, `/signup`, `/saved`, `/reservations`, `/ops`, `/verify-id`, `/plan`,
> `/progress`) that import from `@/lib/local/*`.

---

## 1. Directory map of `src/`

```
src/
  app/                  App Router (see §2)
  components/
    features/           Feature components by domain (see below)
    layout/             navbar, footer, banners, locale-switcher, dashboard-footer
    admin/              Legacy Supabase admin-panel components
    ui/                 shadcn/ui (New York style, Radix)
    providers/          app-direction-provider (Radix RTL)
    notifications/      notification UI
    *.tsx               sidebar/data-table/chart scaffolding (mostly legacy dashboard)
  lib/
    local/              ★ ACTIVE data + auth layer (Postgres) — see §3
    supabase/           ✗ LEGACY Supabase client/queries/mutations
    i18n/               pathname.ts (locale prefix helpers), format.ts
    gemini/             Google Gemini client (AI chat)
    firebase/           legacy / push
    validations/        Zod schemas
    actions/            misc server actions
    constants.ts, utils.ts (cn, parsePostGISHex, getBaseUrl)
  messages/             en.json, ar.json, fr.json, es.json (next-intl catalogs)
  i18n/                 config.ts, request.ts, request-locale.ts, messages.ts
  stores/               Zustand: auth-store, search-store, ui-store (+ index.ts)
  hooks/                React hooks
  types/                database.ts (hand), supabase.ts (generated, legacy)
  proxy.ts              ★ middleware: locale routing + / → /explore redirect
```

### `components/features/*`
| Dir | Purpose |
|---|---|
| `ai/` | `chat-widget.tsx` (Gemini help chat) |
| `auth/` | `auth-modal`, `auth-notification`, MFA enroll/verify |
| `cms/` | `dynamic-page-renderer` + widgets (legacy CMS pages) |
| `comments/` | comment form/item/section |
| `dashboard/` | dashboard nav/search (legacy) |
| `host/` | `listing-wizard`, `availability-calendar`, `photo-uploader`, `location-picker`, `price-adjustments`, `conditions-picker` |
| `listings/` | `listing-card`, `listing-detail`, `listing-gallery`, `listing-map`, `listings-explorer`, `booking-widget`, `category-bar` |
| `reviews/` | review form/list/stats/chat |
| `search/` | `search-bar`, `search-filters`, `search-modal`, `destination-bar`, maps |
| `verification/` | `EgyptianIDScanner`, `identity-verification-form`, `verification-gate` |
| `wishlists/` | wishlist card/modal/detail-header |

---

## 2. App Router — route groups & key pages

There are two parallel UIs. The **standalone unprefixed routes** are the live local-stack app; the
**route groups** `(main)`/`(dashboard)`/`admin` are legacy Supabase.

### Active (local-stack) pages — `src/app/<route>/page.tsx`
| Route | File | Purpose |
|---|---|---|
| `/explore` | `app/explore/page.tsx` + `explore-client.tsx` | Home/browse grid (search, map, wishlist). `/` and `/listings` redirect here. |
| `/explore/[id]` | `app/explore/[id]/` | Listing detail |
| `/login`, `/signup` | `app/login`, `app/signup` | Email + OAuth auth (own layouts) |
| `/account` | `app/account/` | Profile + security forms |
| `/saved` | `app/saved/` | Wishlist |
| `/reservations` | `app/reservations/` | Guest bookings (+ `reservation-actions.tsx`) |
| `/host` | `app/host/` | Host dashboard; `host/apply`, `host/new` (create listing) |
| `/verify-id` | `app/verify-id/` | ID verification submission |
| `/plan`, `/progress` | `app/plan`, `app/progress` | Static info pages |
| `/ops` | `app/ops/page.tsx` | ★ Key-gated admin console (see §5) |
| `/pay/...`, `/[slug]` | under `(main)` | payment + CMS slug pages (legacy-ish) |

### Route groups (legacy Supabase)
| Group | Layout | Notes |
|---|---|---|
| `(main)` | `app/(main)/layout.tsx` | Navbar + Footer + ChatWidget + AuthModal; fetches `site_settings` via Supabase. Home (`(main)/page.tsx`), `listings/[id]`, `pay/[id]`, `hosts/[id]`, `services`. |
| `(dashboard)` | `app/(dashboard)/layout.tsx` | Supabase `auth.getUser()`, redirect to `/login` if absent; `UserSidebar`. Pages: dashboard, listings, bookings, trips, wishlists, profile, balance. |
| `admin` | `app/admin/layout.tsx` | Supabase staff-gated (`staff_profiles`); ~30 admin subpages. **Distinct from `/ops`.** |
| `auth` | — | `auth/callback`, `auth/invite`, `auth/reset-password` (Supabase OAuth/invite). |

### API routes — `src/app/api/`
| Group | Routes | Backed by |
|---|---|---|
| `api/auth/*` | `signup`, `login`, `verify-otp`, `resend-otp`, `logout`, `me`, `change-password`, `google`, `apple`, `social` | local-stack (`lib/local/*`) |
| `api/local/*` | `listings`, `bookings/[id]/{pay,cancel}`, `wishlists`, `reviews`, `guest-reviews`, `notifications/*`, `host/{apply,become,bookings}`, `verification`, `promo/validate`, `referrals`, `users/[id]`, `xmaildiag` | local-stack |
| `api/local/admin/*` | `stats`, `users`, `listings`, `bookings`, `host-applications`, `verifications` | local-stack, **key-gated** (feeds `/ops`) |
| `api/ai/help-chat`, `api/chat` | AI chat | Gemini |
| `api/cron/booking-timeouts` | Vercel cron (booking expiry) | — |
| `api/admin/*`, `api/id-scan`, `api/test-fcm` | legacy / misc | Supabase / Firebase |

Local-stack route conventions: `export const dynamic = 'force-dynamic'`, a `CORS` header object
(`Access-Control-Allow-Origin: '*'`, `Cache-Control: no-store`) so the **mobile apps** can call
them, and JSON request/response bodies. Mobile apps point at the **backend** project, but these
routes share the same shapes.

### App-level files
`app/layout.tsx` (root), `error.tsx`, `global-error.tsx`, `not-found.tsx`, `loading.tsx`,
`robots.ts`, `sitemap.ts`, `search-actions.ts`.

---

## 3. Data layer — `src/lib/local/`

| File | Purpose |
|---|---|
| `pool.ts` | Single shared `pg` Pool. Connection string resolved from first valid `postgres(ql)://` URL among `DATABASE_URL`, `quickin_DATABASE_URL`, `POSTGRES_URL`, `quickin_POSTGRES_URL`, `*_UNPOOLED`; else local default `postgresql://ahmedfarahat@127.0.0.1:5432/quickin_local`. TLS on for managed PG, off for localhost. `max: 5`, cached on `globalThis` across hot-reloads/lambdas. Exports `pool` + `query<T>(text, params)`. |
| `db.ts` | **All reads + mutations** (~1300 lines). Listings, bookings (create/pay/cancel/patch/quote), notifications + push tokens, OTP codes (`createOtpCode`/`verifyOtpCode`/`markEmailVerified`), verification, reviews + guest reviews, host applications, wishlists, profile, host listings/profile, `createListing`, promo, referrals, and the `admin*` helpers (`adminStats`, `adminListUsers/Listings/Bookings`, `adminSetListingPublished`, `adminDelete*`, `adminActivateUser`, `getPendingHostApplications`, `reviewHostApplication`, `getPendingVerifications`, `reviewVerification`). |
| `auth.ts` | Passwords (scrypt: `hashPassword`/`verifyPassword`), stateless HMAC tokens (`signToken`/`verifyToken`, 30-day TTL, `AUTH_SECRET`), `getUserFromRequest` (Bearer header OR `qk_token` cookie), user ops (`getUserRowByEmail`, `createUser`, `upsertSocialUser`, `becomeHost`, `updatePassword`, `publicUser`), email validation + disposable-domain blocklist, in-memory per-process `rateLimit`, `clientIp`, `generateOtp`, `isAdminKey` (the `/ops` gate). |
| `email.ts` | `sendOtpEmail(to, code)` — delegates to the **backend mail relay** (`POST {MAIL_BACKEND_URL}/api/mail/send-otp` with `x-relay-secret: MAIL_RELAY_SECRET`). Never throws; logs the code to console when relay env is unset (offline dev). |
| `oauth.ts` | Real Google/Apple ID-token verification (no SDKs): fetches provider JWKS, verifies RS256 sig + `iss`/`aud`/`exp`. `verifyGoogleIdToken`, `verifyAppleIdToken`. |

Schema lives in `local-backend/init.sql` (sibling repo / dir), not in `src/`.

---

## 4. Auth + OTP + `email_verified` flow (web)

1. **Signup** `POST /api/auth/signup` → validates email (rejects disposable domains), creates an
   **unverified** user (`email_verified=false`), generates a 6-digit OTP (`createOtpCode`, 10-min
   TTL, ≤5 attempts), sends via `sendOtpEmail`, returns `{ pending: true, email }`. If the email
   already exists but is unverified, it re-issues a code and returns
   `{ pending, needsVerification, email }` (no dead-end). Rate-limited 5/min/IP.
2. **Login** `POST /api/auth/login` → verifies scrypt password. If correct **but unverified** →
   `403 { needsVerification: true, email }` and re-sends an OTP (client shows OTP screen). If
   verified → issues `qk_token` and sets it as an httpOnly cookie. Rate-limited 10/5min per IP+email.
3. **Verify** `POST /api/auth/verify-otp { email, code }` → `verifyOtpCode` (consumes on success),
   `markEmailVerified`, then issues `qk_token` cookie + returns `{ token, user }`.
4. **Session** = stateless HMAC `qk_token` (httpOnly, `sameSite=lax`, `secure` in prod, 30-day
   maxAge). `GET /api/auth/me` resolves the user from Bearer header (mobile) or cookie (web).
   `POST /api/auth/logout` clears it.
5. **OAuth** `POST /api/auth/google|apple` → verifies the provider ID token via `oauth.ts`,
   `upsertSocialUser` (created social users are `email_verified=true`), issues token.

`email_verified` is the login gate. The OTP table is `otp_codes` (one row per email, upserted on
`ON CONFLICT (email)`).

---

## 5. `/ops` admin console

- File: `app/ops/page.tsx` — a single self-contained **client** component (~38 KB).
- Operator pastes an **admin key** (stored in `localStorage['qk_ops_key']`, never hardcoded). The
  key must equal `ADMIN_OPS_KEY` (dev fallback `QuickInAdmin2026`), checked server-side by
  `isAdminKey` in `lib/local/auth.ts`.
- Tabs: **Overview** (stats), **Users** (activate/delete), **Listings** (publish/hide/delete),
  **Bookings**, **Applications** (approve/reject host apps), **Verifications** (approve/reject IDs).
- Every request hits `api/local/admin/*` and is key-gated: the key is passed as `?key=` query param
  **and** `x-admin-key` header; the route does `if (!isAdminKey(keyOf(req))) → 403`.
- It reads the **real (Neon) data**. This is the active admin surface — distinct from the legacy
  Supabase `app/admin/*` route group.

---

## 6. Internationalization (next-intl)

- Locales: `en` (default), `ar` (RTL), `fr`, `es` — `src/i18n/config.ts`.
- Catalogs: `src/messages/{en,ar,fr,es}.json`, aggregated in `src/i18n/messages.ts`. `en.json` is
  the source of truth (`AppMessages` type).
- Request config: `src/i18n/request.ts` (uses `getRequestLocale`); BCP47 map `ar →
  ar-EG-u-nu-latn`, `fr → fr-FR`, `es → es-ES`, `en → en-US`; `getDirection` (only `ar` is RTL).
- Routing is **path-prefix based** via `src/proxy.ts` (middleware): URLs are `/en/...`, `/ar/...`,
  etc. Detection order: cookie `NEXT_LOCALE` → `x-locale` header → `Accept-Language`. The middleware
  redirects unprefixed localizable paths to the prefixed form, rewrites prefixed paths internally
  (stripping the prefix), and sets the `NEXT_LOCALE` cookie.
- Parity is enforced: `npm run check:i18n` (`scripts/check-i18n-keys.mjs`).
- Provider: root layout wraps the tree in `NextIntlClientProvider` with `timeZone="Africa/Cairo"`.

---

## 7. Styling & design tokens

- **Tailwind CSS 4** with CSS-variable theming in `src/app/globals.css`. shadcn/ui (New York),
  Radix, RTL enabled.
- **Boutique palette**:
  - Burgundy primary `#5B0F16` (`--primary`, `--ring`, `--sidebar-primary`, `--chart-1`)
  - Cream background `#F6F1E6` (`--background`, `--primary-foreground`)
  - Tan secondary `#EFE6D8` (`--secondary`, `--muted`, `--accent`, `--background-secondary`)
  - Ink text `#2B2B2B` (`--foreground`); card `#FFFFFF`. Dark mode flips to warm
    `#1A1512`/`#242018` with a tan-gold `#D4A574` primary.
  - `/ops` re-declares the same palette as JS consts (`BURGUNDY`, `CREAM`, `TAN`, `INK`, `MUTED`,
    `GREEN`) since it's a self-contained page.
- **Custom utility classes** (globals.css): `.glass` / `.glass-strong` (frosted glass),
  `.card-shadow`, `.glass-card-wrapper`/`.glass-card-inner`, and radii `.rounded-card` (28px),
  `.rounded-button` (20px), `.rounded-input` (18px), `.rounded-modal` (32px).
- **Fonts** (root layout, `next/font/google`): DM_Sans (body), Noto_Sans_Arabic (Arabic body),
  Playfair_Display (hero), Amiri (Arabic hero), Geist_Mono.
- Root layout provider stack: `NextIntlClientProvider` → `AppDirectionProvider` (Radix RTL) →
  `RouteProgressBar` + `GlobalLoadingBar` + Sonner `Toaster` (top-center) + `AuthNotification`.

---

## 8. Conventions & how-to

- **Import alias** `@/*` → `src/*`. Server Components by default; add `'use client'` only when needed.
- **Use the local stack, not Supabase**, for any new feature. Reads/mutations go in
  `src/lib/local/db.ts`; auth helpers in `src/lib/local/auth.ts`.

**Add an API route** (local-stack):
1. Create `src/app/api/local/<name>/route.ts`.
2. `export const dynamic = 'force-dynamic'` and define the `CORS` header object.
3. Resolve the user with `getUserFromRequest(req)` from `@/lib/local/auth` (Bearer or cookie); for
   admin routes gate with `isAdminKey(keyOf(req))` (key from `?key=` or `x-admin-key`).
4. Do DB work via a function in `db.ts` (parameterized `pool.query`). Return `NextResponse.json(...,
   { headers: CORS })`.

**Add a page** (active app):
1. Create `src/app/<route>/page.tsx` (an **unprefixed** standalone route — these are the live ones).
   The `proxy.ts` matcher handles locale prefixing automatically.
2. Server component: fetch via `lib/local/db.ts`; resolve session by reading the `qk_token` cookie
   and calling `verifyToken` + `getUserRowByEmail`. Use `getTranslations`/`getRequestLocale` for i18n.
3. Avoid the `(main)`/`(dashboard)`/`admin` groups unless intentionally touching legacy Supabase UI.

**Add a translation:**
1. Add the key to **`src/messages/en.json`** first, then to `ar`, `fr`, `es`.
2. Run `npm run check:i18n` to verify parity.
3. Use via `useTranslations('namespace')` (client) or `getTranslations('namespace')` (server).

**Commands:** `npm run dev`, `npm run build` (`next build --webpack`), `npm run lint`,
`npm run check:i18n`. (`npm run gen-types` is for the legacy Supabase schema.)

---

## 9. Gotchas

- **Supabase docs are stale.** The live data/auth layer is `lib/local/*` (Postgres + `qk_token`),
  not Supabase. `lib/supabase/*` and the `(main)`/`(dashboard)`/`admin` groups are legacy; the proxy
  redirects `/` and `/listings` → `/explore`, so the legacy home is unreachable on the live site.
- **Two admin surfaces.** `/ops` (key-gated, local-stack, **active**) vs `app/admin/*` (Supabase
  staff-gated, **legacy**). Don't confuse them.
- **`pool.ts` env precedence:** a non-postgres value (e.g. a stale Vercel-encrypted blob) in
  `DATABASE_URL` is **ignored** by the `isPgUrl` filter — it falls through to the next candidate or
  the localhost default. If the live DB seems wrong, check which env var actually holds a valid URL.
- **OTP email needs the backend relay.** `email.ts` requires `MAIL_BACKEND_URL` +
  `MAIL_RELAY_SECRET` (matching the backend's). When unset, OTPs are only **logged to console**
  (fine for dev, broken delivery in prod if misconfigured). `sendOtpEmail` never throws, so a relay
  failure silently degrades signup — check server logs.
- **`getUserRowByEmail` degrades pre-migration:** if `is_host`/`email_verified` columns are missing
  it falls back to treating users as `email_verified=true` to avoid lock-outs mid-deploy.
- **Rate limiting is in-memory & per-process** (`auth.ts`) — it resets on redeploy and isn't shared
  across serverless instances. It's best-effort, not a hard security control.
- **Admin key fallback:** `isAdminKey` falls back to `QuickInAdmin2026` if `ADMIN_OPS_KEY` is unset
  — set the env var in prod.
- **CORS `*` on auth/local routes** is intentional (the mobile apps call the same shapes), but means
  these endpoints are open cross-origin — rely on `qk_token`/admin-key, not origin.
- **Middleware = `proxy.ts`** (not the conventional `middleware.ts`); it still imports the legacy
  Supabase `updateSession` for unprefixed paths. Don't reorder code around `auth.getUser()` there.
</content>
</invoke>
