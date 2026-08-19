# CLAUDE.md

Guidance for Claude Code / AI agents working in this repo.

## ⚠️ Read this first

- **This repo is the mobile monorepo.** It holds the canonical iOS and Android
  apps and nothing else. The web app that used to live in `src/` was a stale fork
  of `../quickin-frontend` and was deleted on 2026-08-19 — edit the web there.
- **Nothing here uses Supabase.** The platform runs on node-postgres → **Neon**.
  Auth is a bearer `qk_token` (mobile) / httpOnly cookie (web). The Android
  `SupabaseService.kt` is misnamed legacy — it calls `/api/local/*` like
  everything else. Don't add Supabase calls or assume RLS.
- **Both apps call `quickin-backend`**, not the website. There is no card
  gateway: payment is Instapay only (transfer + screenshot + host review).

## The three codebases

| Path | What it is | Deploys to |
|---|---|---|
| `mobile/ios`, `mobile/android` (this repo) | SwiftUI (XcodeGen) + Kotlin/Compose. Both point their API base at **quickin-backend**. | App Store / Play (TestFlight) |
| `../backend/quickin-backend` | The **API the mobile apps call** + the OTP mail relay + working SMTP (nodemailer). | Vercel **quickin-backend** → https://quickin-backend.vercel.app |
| `../quickin-frontend` | The live website and the `/ops` admin console. | Vercel **quickin-frontend** (the live site) |

Both Vercel projects **share ONE Neon database**, so a user created via mobile is
visible to the web `/ops` console and vice-versa.

## Mobile

- **iOS** — `mobile/ios/Sources/`. `Config.swift` `apiBaseURL` is
  `https://quickin-backend.vercel.app` in **both** DEBUG and RELEASE, so the
  Simulator works with no local server; switch DEBUG to `http://127.0.0.1:3000`
  for local work. Auth in `AuthService.swift` (`AuthStore`,
  `AuthOutcome.needsVerification`) → `OTPVerificationView`. Build via XcodeGen
  `project.yml`.
- **Android** — `mobile/android/app/src/main/java/com/quickin/app/`.
  `BuildConfig.API_BASE_URL` (in `build.gradle.kts`): release = quickin-backend,
  debug takes `-PDEV_API_BASE_URL` (e.g. `http://10.0.2.2:3000` for the
  emulator). Auth in `AuthService.kt` (`AuthOutcome.NeedsVerification`) +
  `AuthViewModel` (`pendingEmail`) → `OtpScreen`.
- Both apps handle `needsVerification` / `pending` by routing to their OTP
  screen — keep emitting those signals from whichever API they hit.
- **Localization** — iOS keeps all four locales in `Sources/Localization.swift`
  (one dictionary per locale, key sets must stay identical). Android uses
  `res/values{,-ar,-fr,-es}/strings.xml`.
- **Email rules are GENERATED, not hand-written.** `mobile/scripts/gen-email-rules.mjs`
  reads the backend's `src/lib/local/email-core.ts` — the trusted-provider
  allowlist, the IANA root zone and the disposable blocklist — and writes
  `ios/Sources/EmailData.swift` and `android/.../EmailData.kt`. Both are marked
  DO NOT EDIT. The decision logic beside them (`EmailRules.swift` /
  `EmailRules.kt`) is hand-written and mirrors `checkEmail` tier for tier, so
  the phone refuses exactly what the API would refuse, one round trip earlier.
  Re-run the generator after the root zone is refreshed on the web
  (`npm run check:tlds`), and commit what it produces.
  Note the two entry points differ on purpose: sign-up applies the full policy
  (temp-mail included), while sign-in and password reset use `isValid`, which
  tolerates a disposable domain because they only ever touch an account that
  already exists. The backend draws the same line — see its README, *The address
  has to be one mail can reach*.

## Auth + OTP contract (shared with the backend)

- Signup creates an **unverified** user (`users.email_verified=false`) and emails
  a 6-digit OTP; returns `{pending:true,email}` (no session yet). Social logins
  are auto-verified.
- **`verify-otp`** checks the code, sets `email_verified=true`, issues the token.
- **Login of an unverified account → HTTP 403 `{needsVerification:true,email}`**
  and re-sends a code. Both apps route to the OTP screen on this. Don't change
  that contract without shipping both apps.

## Local development

`local-backend/init.sql` + `schema_seed.sql` hold a local schema and seed;
`local-backend/admin-server.mjs` is a small standalone local admin tool. See
`SETUP.md`. The real schema of record is the Neon database, migrated from
`../backend/quickin-backend/scripts/migrate-*.mjs`.

## Deploying

- **Apps:** `.github/workflows/ios-testflight.yml` and
  `android-publish-apk.yml`. Signing notes in `CREATE-KEYS.md`.
- **Backend / web:** `git push` in their own repos (Vercel auto-deploys).
- **DB migrations:** write an idempotent `migrate-*.mjs` in
  `../backend/quickin-backend/scripts/`, run it against Neon **before** deploying
  code that reads the new columns. Vercel has no shell.

## Docs

`docs/README.md` links everything. Several docs still describe the deleted web
tree and the retired Paymob gateway — trust this file and the code over them.
