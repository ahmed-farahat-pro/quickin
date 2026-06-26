# QuickIn — Documentation Index

QuickIn is a boutique vacation-rental platform across **4 codebases**, **2 Vercel projects**,
and **1 shared Neon Postgres database**.

## Start here

**New contributor or AI agent? Read [`ARCHITECTURE.md`](ARCHITECTURE.md) first** — it's the
system overview (the 4 repos, how `quickin-master` rsyncs into `quickin-frontend`, the web-vs-
mobile request flow, the auth/OTP/email-verified sequence, the data model, env vars, and a
"where do I change X?" table). Then read the doc for whichever piece you're touching.

> **Critical, easily-missed fact:** the live web data/auth layer is the **"local stack"**
> (`src/lib/local/*` — a `node-postgres` Pool + a stateless HMAC `qk_token` cookie), **not
> Supabase**. The root `CLAUDE.md` has been corrected to reflect this; some older docs in
> this folder still describe Supabase — that is **stale**.
> `src/lib/supabase/*` and the `(main)`/`(dashboard)`/`admin` route groups are legacy. Build
> new web features on `src/lib/local/*` and the unprefixed standalone routes (`/explore`,
> `/host`, `/account`, `/ops`, …).

## Core docs (current & authoritative)

| Doc | What it covers |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System overview: 4 codebases + 2 Vercel projects + 1 Neon DB, the master→frontend rsync→deploy chain, web/mobile request flow, the auth/OTP/email_verified sequence, data-model summary, env-var inventory, "where do I change X?". |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | How to deploy each piece: web (rsync → git push, or CLI + upload-cap caveat), backend (git push), DB migrations (temp key-gated `/api/local/xmigN` endpoints), env vars, one-off SQL/admin, plus `check:i18n` + `tsc` pre-deploy checks. |
| [`web.md`](web.md) | The Next.js 16 web app (`quickin-master/src`): local-stack data layer, active vs legacy routes, `/ops` console, i18n, design tokens, conventions, gotchas. |
| [`backend.md`](backend.md) | The `quickin-backend` Vercel project: full mobile-facing API surface, the dual-`(email,role)` auth model, nodemailer SMTP + the `/api/mail/send-otp` relay, env vars, gotchas. |
| [`mobile-ios.md`](mobile-ios.md) | The SwiftUI iOS app (`mobile/ios`): `Config.swift`, auth/`AuthStore`, screens, networking, XcodeGen build + signing, gotchas. |
| [`mobile-android.md`](mobile-android.md) | The Kotlin/Compose Android app (`mobile/android`): `Config.kt`/`BuildConfig`, auth state machine, screens, HttpURLConnection networking, Gradle build, gotchas. |

## Quick orientation

- **Edit here:** `quickin-master` (web `src/`, mobile `mobile/*`, schema `local-backend/init.sql`).
- **Live website:** `quickin-frontend.vercel.app` (rsync'd from `quickin-master/src`).
- **Mobile API + OTP SMTP relay:** `quickin-backend.vercel.app` (separate repo; mobile apps point here).
- **One DB:** both Vercel projects share one Neon Postgres.
- **Auth:** stateless HMAC `qk_token` (cookie on web, Bearer on mobile); `email_verified` gates
  login; OTP is 6 digits.
- **Admin:** `/ops` (key-gated, local-stack, **active**). `app/admin/*` is legacy Supabase.
- **i18n:** next-intl, `src/messages/{en,ar,fr,es}.json`, run `npm run check:i18n`.

## Other docs in this folder

Reference/spec material, much of it **predating** the local-stack migration — trust the core
docs above (and the code) over these where they conflict:

- `env-setup.md`, `social-auth-setup.md`, `gemini-integration.md` — integration setup notes.
- `project-overview.md`, `tech-stack.md`, `QuickIn_Design_Specs.md` — early overviews/specs.
- `client_requirements_feb_2026.md`, `Attributes_and_Capabilities_Brief.md` — requirements.
- `detailed-plan.md`, `detailed-plan-v1.md`, `Updated_Airbnb_Implementation_Plan.md`,
  `progress-tracker.md`, `mobile_strategy_comparison.md` — planning artifacts.

> If a doc mentions **Supabase** as the live data layer, treat it as historical. The current
> stack is Postgres + `qk_token` (`src/lib/local/*`).
