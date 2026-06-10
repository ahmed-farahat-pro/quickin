# Deploy QuickIn to Vercel (free tier)

The data layer now uses **node-postgres** (`pg`) — Vercel-serverless compatible (the old
`psql`-CLI is gone). Web + API deploy to Vercel; the database is **Vercel Postgres** (Neon).

## 1) Create the production database
- In the Vercel dashboard → **Storage → Create → Postgres** (free tier). Copy its **`DATABASE_URL`**
  (the pooled connection string, includes `sslmode=require`).
- Initialise the schema + demo listings (run once, from your machine):
  ```bash
  psql "PASTE_YOUR_DATABASE_URL" -f local-backend/init.sql
  ```
  (Creates `listings`, `listing_images`, `users`, `bookings` and seeds the 8 stays. Users are created on sign-up.)

## 2) Push the repo & import to Vercel
- Commit & push this repo to GitHub.
- Vercel → **New Project → import the repo**. Framework: **Next.js** (auto-detected). Root: the repo root. Build: default (`next build`).

## 3) Set Environment Variables (Vercel → Project → Settings → Environment Variables)
Required:
- `DATABASE_URL` = the Vercel Postgres URL from step 1
- `AUTH_SECRET` = a long random string (e.g. `openssl rand -hex 32`)

Optional (flip features on — see SETUP.md):
- `GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` → real Google login
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_API_KEY` → Google Maps tiles
- `APPLE_CLIENT_ID` → Apple login

## 4) Deploy
- Click **Deploy**. You'll get a URL like `https://quickin-xxxx.vercel.app`.
- Open it → it redirects to `/explore` (the live local-stack site, served from Vercel Postgres).
- Admin panel (`local-backend/admin-server.mjs`) is a separate local tool — for production, manage
  listings via SQL or wire a protected admin route later.

## 5) Point the mobile apps at the deployed API
- **iOS** — `mobile/ios/Sources/Config.swift`: set the release `apiBaseURL` to your Vercel URL
  (the `#else` branch). Build a Release scheme.
- **Android** — `mobile/android/app/build.gradle.kts`: replace `https://REPLACE-WITH-YOUR-VERCEL-URL`
  in the `release` `buildConfigField("API_BASE_URL", ...)`. Build `:app:assembleRelease`.

## 6) If using Google login/maps
- Add your Vercel URL to the Google OAuth client's **Authorized JavaScript origins** and the
  Maps key's allowed referrers. Update the iOS/Android client ids per SETUP.md.

## Notes
- `next.config.ts` sets `typescript.ignoreBuildErrors` + `eslint.ignoreDuringBuilds` so pre-existing
  issues in the **legacy Supabase** parts of the repo don't block the Vercel build of the live pages.
  The homepage redirects to `/explore`; the legacy Supabase pages are unused (they'd need Supabase env).
- Free Vercel Postgres has limited connections — the pool is capped at 5; fine for early traffic.
