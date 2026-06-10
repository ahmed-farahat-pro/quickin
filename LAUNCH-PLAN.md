# QuickIn — Launch Readiness Sheet (Web · iOS · Android)

Step-by-step, organized into **parallel tracks** so Web, iOS, and Android can move at the same time.
Legend:  ✅ done · ⚙️ do now (no blockers) · 🔑 needs a key/account only you can create

---

## ✅ Where we are today (all running, local, no Supabase)
- **DB**: local PostgreSQL `quickin_local` — listings, users, bookings. Working end‑to‑end.
- **Web** (`:3000`): browse, live search (location/dates/guests + availability), price‑pin map (+ X close),
  reserve, My Reservations, login/signup (email), header (logo · Log in/Sign up · Become a host), footer, admin (`:3001`).
- **iOS & Android**: logo zoom splash, browse‑before‑login, search, **custom branded date picker**,
  price‑pin map (+ X close), reserve, My Reservations tab, Profile, email auth.
- **Auth**: email/password is REAL; Google/Apple are wired and verify tokens — they just need keys.

---

## 🟢 Completed this pass (Vercel deploy prep — ran all 4 tracks in parallel)
- **Backend**: migrated data layer **psql‑CLI → `pg` driver** (Vercel/Neon‑ready, parameterized) — verified listings/search/login/booking/reservations all work. Added `local-backend/init.sql` (prod schema+seed), build‑resilience flags in `next.config.ts`, and **`next build` passes (exit 0)** → deployable. See **DEPLOY-VERCEL.md**.
- **Web**: per‑page SEO metadata + OG/favicon, error & 404 states, error banner, mobile‑responsive grids, fixed a `/sitemap.xml` 500.
- **iOS**: app **icon** (QUICK IN mark), `Config.apiBaseURL` now DEBUG=local / RELEASE=Vercel‑URL placeholder, builds clean.
- **Android**: adaptive app **icon**, `BuildConfig.API_BASE_URL` (debug=10.0.2.2 / release=Vercel placeholder), **release keystore + signed release APK**, both builds pass.

## 🔑 PHASE 0 — Accounts & keys to create first (these unblock everything)
> Only you can make these (they're tied to your billing/Apple identity). ~30–60 min total.
- [ ] **Google Cloud project** + enable **billing**.
- [ ] **Google Maps API key** → enable *Maps JavaScript API*, *Maps SDK for Android*, *Maps SDK for iOS*.
- [ ] **Google OAuth client IDs** → *Web app* (origin `http://localhost:3000` + your domain), *iOS* (`com.quickin.app`), *Android* (`com.quickin.app` + SHA‑1).
- [ ] **Apple Developer Program** ($99/yr) → App ID `com.quickin.app` + *Sign in with Apple* capability + a **Team**.
- [ ] **Production database** (managed Postgres: Neon / Supabase / RDS) — or keep local for dev.
- [ ] **Domain + HTTPS** (needed for production web AND Apple sign‑in on web/Android).

Full how‑to is already in **SETUP.md** and **OAUTH-SETUP.md**.

---

## ⚙️ TRACK A — Backend / Infra (shared; start now)
1. ⚙️ Swap the local **psql‑CLI** data layer for a pooled **`pg`** client (production‑grade) in `src/lib/local/*`.
2. ⚙️ Harden env: strong `AUTH_SECRET`, move all secrets to `.env` (prod), never commit keys.
3. ⚙️ Add a one‑command **schema + seed** script for a fresh DB (`local-backend/schema_seed.sql` + users/bookings).
4. 🔑 Provision the **production Postgres**; run schema + import real data.
5. ⚙️ **Deploy** web + API (Vercel / Render / Fly). Set `DATABASE_URL`, `AUTH_SECRET`, Google/Maps keys as env.
6. ⚙️ Decide the **public API base URL** → the value mobile apps will point to.
7. ◻️ (Later) Payments for booking (Stripe), image upload/host for listings, backups, monitoring, rate‑limiting.

## ⚙️ TRACK B — Web (start now)
1. ⚙️ Polish states: loading / empty / error / 404, mobile responsiveness on `/explore`, `/login`, `/signup`, `/reservations`.
2. ⚙️ SEO & branding: page `<title>`/meta, **og‑image = logo**, favicon, `robots`/`sitemap`.
3. 🔑 Flip the map to **Google Maps** → paste `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (already wired).
4. 🔑 Turn on **Google login** → `GOOGLE_CLIENT_ID` + `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.  🔑 **Apple** → Services ID + HTTPS domain.
5. ⚙️ Replace demo listings with **real data** via the admin panel; add listing **photo upload**.
6. ⚙️ Accessibility pass; ⚙️ deploy to the domain.

## ⚙️ TRACK C — iOS (start now)
1. ⚙️ App icon from the logo (done) + launch screen polish + set version/build numbers.
2. ⚙️ Point `Config.apiBaseURL` to the **production API** (build‑config: local vs prod).
3. 🔑 Xcode → Signing: set your **Team**; add **Sign in with Apple** capability → real Apple login.
4. 🔑 (If using Google Maps) add **Google Maps iOS SDK** (SPM) + `Config.googleMapsAPIKey`. Else MapKit stays.
5. 🔑 Add **Google iOS client id** to `Config.googleClientID` → real Google login.
6. ⚙️ Test on a **real device**; fix any device‑only issues.
7. 🔑 App Store: screenshots, description, privacy nutrition labels → **TestFlight** → submit for review.

## ⚙️ TRACK D — Android (start now)
1. ⚙️ App icon from the logo + version code/name.
2. ⚙️ Point `Config.API_BASE_URL` to the **production API** (build variant: debug→`10.0.2.2`, release→prod).
3. 🔑 Add **Google Maps key** (manifest `MAPS_API_KEY` / `Config.MAPS_API_KEY`) → flips from osmdroid (already wired).
4. 🔑 Add **Google client id** + register **debug & release SHA‑1** → real Google login.
5. ⚙️ Create a **release keystore**; produce a **signed release** AAB (not the debug APK).
6. ⚙️ Test on a **real device**.
7. 🔑 Play Console: store listing assets, privacy, data‑safety → **internal testing** → submit.

---

## 🚀 Do NOW, in parallel (no keys required)
- **Backend**: tasks A1–A3, A6  → make it deploy‑ready.
- **Web**: tasks B1, B2, B5, B6  → polish, SEO, real data.
- **iOS**: tasks C1, C2, C6  → icon, prod‑URL config, device test.
- **Android**: tasks D1, D2, D5, D6  → icon, prod‑URL config, signed release.
Then, as each **🔑 key** arrives, flip on Maps + Google/Apple login on all three.

## Definition of "ready to ship"
- [ ] Web live on the domain (HTTPS), real data, Google Maps + Google/Apple login working.
- [ ] iOS on TestFlight (signed, real login + maps), passing on a device.
- [ ] Android signed release on Play internal testing (real login + maps), passing on a device.
- [ ] Production DB with backups; mobile apps pointed at the production API.
