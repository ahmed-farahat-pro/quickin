# QuickIn — Deployment

How to ship each piece of QuickIn. For the system map (4 codebases, 2 Vercel projects, 1
shared Neon DB) read [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) first.

| Piece | Source repo | Target | Mechanism |
|---|---|---|---|
| **Web** (live site) | `quickin-master/src` → `quickin-frontend` | Vercel **quickin-frontend** → `quickin-frontend.vercel.app` | rsync, then `git push` |
| **Backend** (mobile API + OTP relay) | `quickin-backend` | Vercel **quickin-backend** → `quickin-backend.vercel.app` | `git push` |
| **iOS** | `quickin-master/mobile/ios` | App Store / TestFlight | Xcode archive (see `mobile/ios/TESTFLIGHT.md`) |
| **Android** | `quickin-master/mobile/android` | Play / APK | Gradle (`./gradlew bundleRelease`) |

> **You edit `quickin-master`.** It is the source repo and is **not** itself wired to Vercel.
> The live website is the separate `quickin-frontend` repo, which receives web code via rsync.

---

## 1. Pre-deploy checks (web)

Run these in `quickin-master` (or `quickin-frontend`) before shipping web changes:

```bash
npm run check:i18n     # translation-key parity across en/ar/fr/es (src/messages/*.json)
npx tsc --noEmit       # TypeScript strict typecheck (no separate "typecheck" script)
npm run lint           # ESLint flat config
npm run build          # next build --webpack — the real gate; reproduce the Vercel build locally
```

- `check:i18n` (`scripts/check-i18n-keys.mjs`) fails if any locale is missing keys present in
  `en.json`. Add new keys to **`en.json` first**, then `ar`/`fr`/`es`.
- `npm run build` is the most reliable way to catch what Vercel will catch. Run it locally
  before pushing — it's faster than a failed remote build.

---

## 2. Deploy the WEB (quickin-frontend)

The web app is authored in `quickin-master/src` and **rsync'd** into the deployed
`quickin-frontend` repo, which Vercel builds on push.

### Preferred: rsync → git push

```bash
# 1) Sync the web source from master into the deployed repo.
#    Sync src/ (and any changed config: package.json, next.config, messages, public, scripts).
rsync -av --delete \
  /Users/ahmedfarahat/Downloads/quickin-master/src/ \
  /Users/ahmedfarahat/Downloads/quickin-frontend/src/

# 2) Verify the build in the deployed repo (same env Vercel uses).
cd /Users/ahmedfarahat/Downloads/quickin-frontend
npm install        # only if deps changed
npm run check:i18n && npm run build

# 3) Ship.
git add -A
git commit -m "Web: <what changed>"
git push origin main     # → Vercel auto-builds quickin-frontend
```

`git push origin main` triggers the Vercel production deploy automatically. This is the
**recommended** path.

### Alternative: Vercel CLI (mind the upload cap)

```bash
cd /Users/ahmedfarahat/Downloads/quickin-frontend
vercel build           # local production build
vercel deploy --prebuilt --prod
```

> **Upload-cap caveat.** The Vercel free tier caps CLI uploads at ~5000 files/day. A large
> deploy can abort with **"Upload aborted"**. When that happens, fall back to **`git push`**
> (Vercel builds server-side, no per-file upload limit).

### If the build breaks
- A stale **`next.config.mjs`** in the deployed repo has broken builds before — keep
  `next.config.ts`/`.mjs` consistent with master; remove the stale one.
- "Wrong DB / no data" → the connection string is in a different env var. `src/lib/local/pool.ts`
  picks the **first valid `postgres://` URL** among `DATABASE_URL`, `quickin_DATABASE_URL`,
  `POSTGRES_URL`, `quickin_POSTGRES_URL`, `*_UNPOOLED`; **non-URL values (e.g. stale
  Vercel-encrypted blobs) are silently ignored**. Check which var actually holds a valid URL in
  the Vercel project settings.

---

## 3. Deploy the BACKEND (quickin-backend)

The backend is edited directly (no rsync) and pushed:

```bash
cd /Users/ahmedfarahat/Downloads/quickin-backend
npm run build            # verify locally
git add -A
git commit -m "Backend: <what changed>"
git push origin main     # → Vercel auto-builds quickin-backend
```

CLI (`vercel build && vercel deploy --prebuilt --prod`) also works, with the same ~5000
files/day upload cap — prefer `git push`.

> The backend's `package.json` runs `next dev`/`next start` on port **4000** locally; the
> port is irrelevant on Vercel.

---

## 4. Environment variables

Set per Vercel project (Settings → Environment Variables). The shared values **must match**
across projects. See [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) §6 for the full inventory.

**Must match between frontend and backend:**
- `AUTH_SECRET` — both sign/verify the same `qk_token`.
- `MAIL_RELAY_SECRET` — the web's `x-relay-secret` must equal the backend's.
- `DATABASE_URL` — both point at the same Neon DB.

**quickin-frontend extras:** `MAIL_BACKEND_URL` (the backend's URL), `ADMIN_OPS_KEY`
(the `/ops` gate), `GOOGLE_CLIENT_ID`, `APPLE_CLIENT_ID`, `GEMINI_API_KEY`.

**quickin-backend extras:** `SMTP_HOST/PORT/USER/PASS/FROM`, `ADMIN_USERNAME`/`ADMIN_PASSWORD`,
`OPENAI_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`, `WEB_URL`, Apple Wallet `PASS_*`.

> If `MAIL_BACKEND_URL`/`MAIL_RELAY_SECRET` are unset on the web, OTPs are only
> `console.log`'d — signup "succeeds" but no email is sent. If SMTP is unconfigured on the
> backend, same thing. Always set these in prod.

---

## 5. Running DB migrations (the temp endpoint pattern)

There is **no migration framework and no psql access from CI** — both Vercel projects just
hold a `node-postgres` Pool against one Neon DB. The full schema is in
`quickin-master/local-backend/init.sql` (idempotent: `CREATE TABLE IF NOT EXISTS …`, guarded
`ALTER`s, seed-only-if-empty).

### Option A — direct psql (if you have the DATABASE_URL)

```bash
# First-time init (creates all tables + seeds 8 demo listings; safe to re-run):
psql "$DATABASE_URL" -f /Users/ahmedfarahat/Downloads/quickin-master/local-backend/init.sql

# A one-off ALTER:
psql "$DATABASE_URL" -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS new_col text;"
```

### Option B — temp key-gated `/api/local/xmigN` endpoint (serverless, no psql)

When you can't reach the DB directly, ship a **temporary, key-protected route** that runs the
SQL from inside a deployed Vercel function (which *does* have the Pool). This mirrors the
existing diagnostic route `src/app/api/local/xmaildiag/route.ts` — note the `x`-prefix naming,
the hardcoded `KEY`, and `force-dynamic`:

```ts
// src/app/api/local/xmig1/route.ts  — TEMPORARY. Key-protected. REMOVE after use.
import { NextResponse } from 'next/server'
import { pool } from '@/lib/local/pool'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const KEY = 'qk-mig1-<random>'

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key')
  if (key !== KEY) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS new_col text;`)
  return NextResponse.json({ ok: true })
}
```

Then:
1. Add the route, deploy (rsync → push for web, or push for the backend).
2. Hit it once: `curl "https://quickin-frontend.vercel.app/api/local/xmig1?key=qk-mig1-<random>"`.
3. **Delete the route and redeploy** — these endpoints are throwaway. Keep migrations
   idempotent (`IF NOT EXISTS`) so a re-run is harmless.

> Because the two apps share one DB **and** read it with two different auth schemas (web =
> unified `is_host` + `otp_codes` table; backend = dual `(email, role)` + OTP on the user
> row), the `users` row must carry the **union** of both schemas' columns. A migration that
> drops/renames a column one app relies on will break the other — see [backend.md](backend.md) §7.

---

## 6. One-off SQL / admin actions

- **Via the `/ops` console (no SQL):** for routine user/listing/booking moderation, host-app
  approvals, and ID verifications, use `https://quickin-frontend.vercel.app/ops` — paste the
  `ADMIN_OPS_KEY` (stored in `localStorage['qk_ops_key']`). It hits `/api/local/admin/*`,
  key-gated by `isAdminKey`. This is the **active** admin surface (`app/admin/*` is legacy
  Supabase — ignore it).
- **Via psql:** any ad-hoc query — `psql "$DATABASE_URL" -c "…"`.
- **Via a temp endpoint:** when psql isn't available, the `xmigN` pattern above runs arbitrary
  SQL from a deployed function. Remember to delete it after.
- **Local Node admin:** `local-backend/admin-server.mjs` is a localhost-only admin used during
  local development (not deployed).

---

## 7. Mobile (summary)

Mobile lives in `quickin-master/mobile/*` and does not deploy to Vercel.

- **iOS:** `cd mobile/ios && xcodegen generate` then archive in Xcode. Use signing team
  `U4NBL42U65` for dev/device; switch to `97DNR5Y3Y5` (mafesh) **only** when archiving for
  TestFlight. Full steps: `mobile/ios/TESTFLIGHT.md` and [mobile-ios.md](mobile-ios.md) §6.
- **Android:** `cd mobile/android && ./gradlew bundleRelease` (signed with the bundled dev
  keystore by default). See [mobile-android.md](mobile-android.md) §6.

Both apps target the **backend** project (`quickin-backend.vercel.app`) by default, so a
mobile release picks up backend API changes automatically — no app rebuild needed for
server-side fixes.
