# CLAUDE.md

Guidance for Claude Code / AI agents working in this repo. **Read `docs/ARCHITECTURE.md` and `docs/README.md` before non-trivial work.**

## ⚠️ Read this first — things that cause wrong assumptions

- **The live app does NOT use Supabase.** It runs on a hand-rolled "local stack": **node-postgres → Neon Postgres**. Auth is a stateless HMAC `qk_token` httpOnly cookie. Any `src/lib/supabase/*` and `src/app/admin/*` (Supabase staff panel) are **legacy/dormant** — the live admin is **`/ops`** (local-stack). Don't add Supabase calls or assume RLS.
- **There are 4 codebases and 2 Vercel projects** (see below). The web app you edit here (`quickin-master`) is **not** what mobile talks to — mobile calls the separate **`quickin-backend`** project.
- **Deploy with `git push`**, not the Vercel CLI, when the CLI errors with "Upload aborted" (free-tier upload cap ~5000 files/day). Both Vercel projects auto-deploy from their GitHub `main`.

## The 4 codebases

| Path | What it is | Deploys to |
|---|---|---|
| `quickin-master` (this repo) | **Source of truth you edit.** Web in `src/` (Next.js 16 App Router), mobile in `mobile/ios` + `mobile/android`, schema in `local-backend/init.sql`. | — (working repo) |
| `../quickin-frontend` | Deployed web mirror. `src/` is **rsync'd here from `quickin-master/src`**, then `git push`. | Vercel **quickin-frontend** → https://quickin-frontend.vercel.app (the live site) |
| `../quickin-backend` | Separate Next.js repo. The **API that the mobile apps call** + the OTP mail relay + working SMTP (nodemailer). | Vercel **quickin-backend** → https://quickin-backend.vercel.app |
| (inside this repo) `mobile/ios`, `mobile/android` | SwiftUI (XcodeGen) + Kotlin/Compose apps. Both point their API base at **quickin-backend**. | App Store / Play (TestFlight) |

Both Vercel projects **share ONE Neon database**, so a user created via mobile (backend) is visible to the web `/ops` admin and vice-versa.

## Commands

```bash
npm run dev          # Dev server at localhost:3000 (uses local Postgres + .env)
npm run build        # Production build
npm run lint         # ESLint (flat config, eslint 9)
npm run check:i18n   # Validate en/ar/fr/es translation-key parity (REQUIRED after touching messages)
npx tsc --noEmit     # Typecheck (note: `quickin-local/` has pre-existing unrelated errors — ignore those)
```

No test runner is configured. Package manager: **npm**.

## Web architecture (`src/`)

- **Routing** — App Router under `src/app/`:
  - `(main)/*` public site, `(dashboard)/*` authed user area, `admin/*` legacy Supabase panel (dormant), `ops/page.tsx` the **live key-gated admin console**.
  - `api/auth/*` — signup, login, verify-otp, resend-otp, me, logout, google, apple, social.
  - `api/local/*` — app data (listings, bookings, reviews, wishlist, host/*, admin/*, notifications, …).
  - Locale-prefixed: `/en`, `/ar`, `/fr`, `/es` (next-intl).
- **Data layer** — `src/lib/local/`:
  - `pool.ts` — the node-postgres `Pool` (reads `DATABASE_URL` / Neon vars).
  - `db.ts` — all SQL (reads + mutations). `auth.ts` — users, password hashing, token, `getUserRowByEmail`, `publicUser`, OTP helpers, `isAdminKey`. `email.ts` — `sendOtpEmail` (delegates to the backend relay).
  - Schema lives in `local-backend/init.sql` (the canonical table definitions).
- **Auth + OTP + the email gate**:
  - Signup creates an **unverified** user (`users.email_verified=false`) and emails a 6-digit OTP; returns `{pending:true,email}` (no session yet). Social logins are auto-verified.
  - **`verify-otp`** checks the code, sets `email_verified=true`, issues the session cookie.
  - **Login of an unverified account → HTTP 403 `{needsVerification:true,email}`** + re-sends a code. Web login page + both mobile apps route to the OTP screen on this.
  - **Email is sent by the backend** — `email.ts` POSTs to `quickin-backend` `/api/mail/send-otp` with `x-relay-secret: $MAIL_RELAY_SECRET` (env `MAIL_BACKEND_URL` + `MAIL_RELAY_SECRET`). The frontend has no SMTP of its own.
- **`/ops` admin console** — one client page, key-gated by password **`QuickInAdmin2026`** (env `ADMIN_OPS_KEY`, dev fallback in `auth.ts`). Tabs: Overview, Users (activate / **delete**), Listings (hide / delete), Bookings, Host applications, ID verifications. Backed by key-gated `src/app/api/local/admin/*` routes.
- **i18n** — next-intl, `src/messages/{en,ar,fr,es}.json`; keep parity (`npm run check:i18n`).
- **Styling** — Tailwind 4 + shadcn/ui; boutique palette: burgundy `#5B0F16`, cream `#F6F1E6`, tan `#EFE6D8`, ink `#2A2220`, muted `#6B6055`. RTL enabled.
- **Import alias** — `@/*` → `src/*`.

## Mobile (`mobile/`)

- **iOS** — `mobile/ios/Sources/`. `Config.swift` `apiBaseURL` = `https://quickin-backend.vercel.app` (DEBUG can point at `127.0.0.1:3000`). Auth in `AuthService.swift` (`AuthStore`, `AuthOutcome.needsVerification`) → `OTPVerificationView`. Build via XcodeGen `project.yml`.
- **Android** — `mobile/android/app/src/main/java/com/quickin/app/`. `BuildConfig.API_BASE_URL` (in `build.gradle.kts`): release = quickin-backend, debug = `http://10.0.2.2:3000`. Auth in `AuthService.kt` (`AuthOutcome.NeedsVerification`) + `AuthViewModel` (`pendingEmail`) → `OtpScreen`.
- Both apps **already handle `needsVerification`/`pending`** by routing to their OTP screen — keep emitting those signals from whichever API they hit.

## Backend (`../quickin-backend`) — important divergence

It's a full sibling API used by mobile. **It still uses the OLDER dual `(email, role)` account model** (`getUserRowByEmailRole`, OTP stored on the user row via `setUserOtp`) — different from the web's unified `is_host` + `otp_codes`-table model — but it **also** has `email_verified` and gates unverified login the same way, and it owns the working SMTP. See `docs/backend.md`.

## Deploying & migrations

- **Web:** edit `quickin-master/src` → `rsync -a src/ ../quickin-frontend/src/` → commit + `git push` in `../quickin-frontend` (Vercel auto-deploys). Also commit in `quickin-master`. Before pushing: `npx tsc --noEmit` + `npm run check:i18n`.
- **Backend:** edit `../quickin-backend` → `git push` (Vercel auto-deploys).
- **DB migrations:** add a temporary key-gated route `src/app/api/local/xmigN/route.ts` that runs idempotent `ALTER TABLE … IF NOT EXISTS`, deploy, hit it once, then **delete it** and redeploy. Also update `local-backend/init.sql`. (Same pattern for one-off admin SQL.) Env vars are **encrypted/sensitive** in Vercel — set with `vercel env add`; never paste `vercel env pull` output back as a value (it's ciphertext).
- Full details: **`docs/DEPLOYMENT.md`**.

## Docs index

`docs/README.md` links everything. Key: `docs/ARCHITECTURE.md` (system), `docs/DEPLOYMENT.md`, `docs/web.md`, `docs/backend.md`, `docs/mobile-ios.md`, `docs/mobile-android.md`.
