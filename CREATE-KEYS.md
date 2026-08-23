# Create the keys — step by step (with your values)

Do them in this order. Each step says exactly **where to paste** the value.
Your generated values (ready to use):
- **AUTH_SECRET** = `d83b6ef120737720b23dfdb44bf7496b1cb08292972ad4d7648bdfc2c9fe185e`
- **Android debug SHA‑1** = `F8:75:B3:76:03:E2:E7:6E:B6:9D:8B:3A:5B:34:5C:B3:79:76:03:1E`
- **Android release SHA‑1** = `CF:06:44:0F:D0:83:8B:7A:FF:1C:13:FB:B8:28:63:7F:7A:C9:86:E3`

---

## 1) Vercel Postgres + deploy the web (fastest; no billing needed)
1. Go to **https://vercel.com** → sign in with GitHub.
2. Push this repo to GitHub, then **Add New → Project → import** it. Framework auto‑detects **Next.js**. (Don't deploy yet, or redeploy after step 4.)
3. **Storage → Create Database → Postgres** → pick a region → Create. Open it → **`.env.local` / Quickstart** tab → copy the **`DATABASE_URL`** (the pooled string, ends with `?sslmode=require`).
4. Seed it once from your machine:
   ```bash
   psql "PASTE_DATABASE_URL" -f local-backend/init.sql
   ```
5. Project → **Settings → Environment Variables**, add:
   - `DATABASE_URL` = the string from step 3
   - `AUTH_SECRET` = `d83b6ef120737720b23dfdb44bf7496b1cb08292972ad4d7648bdfc2c9fe185e`
6. **Deploy.** You get `https://quickin-xxxx.vercel.app`. Open it → it shows `/explore` with your data.
   → **Web is live.** (Email/password login + browse/search/reserve all work now.)

---

## 2) Google Cloud project (foundation for Maps + Google login)
1. Go to **https://console.cloud.google.com** → sign in.
2. Top bar **project dropdown → New Project** → name `QuickIn` → **Create** → select it.
3. **Billing**: left menu → Billing → link a card. *(Maps needs billing — it has a large free monthly credit; Google login does NOT need billing.)*

## 3) Google Maps API key
1. In the project: **APIs & Services → Library** → search & **Enable** each:
   - **Maps JavaScript API** (web) · **Maps SDK for Android** · **Maps SDK for iOS**
2. **APIs & Services → Credentials → + Create credentials → API key** → copy the key.
3. Click the key → restrict it (recommended): *API restrictions* → the 3 Maps APIs. *(Add app/referrer restrictions before production.)*
4. Paste it:
   - **Web** → `.env.local`: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...` (also `GOOGLE_MAPS_API_KEY=...`). On Vercel add the same env var. Restart `npm run dev`.
   - **Android** → `mobile/android/app/build.gradle.kts` (the `MAPS_API_KEY` manifest placeholder / a `-PMAPS_API_KEY=` gradle prop) **and** `Config.kt` `MAPS_API_KEY`.
   - **iOS** → `mobile/ios/Sources/Config.swift` `googleMapsAPIKey` (+ add the GoogleMaps SDK via Swift Package Manager when you want it on iOS).
   → Maps switch from OpenStreetMap to **Google Maps**.

## 4) Google OAuth client IDs (real "Continue with Google")
1. **APIs & Services → OAuth consent screen** → **External** → fill App name `QuickIn`, your support + developer email → Save. While in *Testing*, add your Google address under **Test users**.
2. **APIs & Services → Credentials → + Create credentials → OAuth client ID**, make THREE:
   - **Web application** — name `QuickIn Web`.
     - *Authorized JavaScript origins*: `http://localhost:3000` **and** your `https://quickin-xxxx.vercel.app`.
     - Copy the **Client ID** → `.env.local`: `GOOGLE_CLIENT_ID=...` **and** `NEXT_PUBLIC_GOOGLE_CLIENT_ID=...` (same value). Add both on Vercel. Restart.
   - **iOS** — bundle ID `com.quickin.app`. Copy the iOS Client ID → `mobile/ios/Sources/Config.swift` `googleClientID`.
   - **Android** — package `com.quickin.app`, add **both** SHA‑1s:
     - debug: `F8:75:B3:76:03:E2:E7:6E:B6:9D:8B:3A:5B:34:5C:B3:79:76:03:1E`
     - release: `CF:06:44:0F:D0:83:8B:7A:FF:1C:13:FB:B8:28:63:7F:7A:C9:86:E3`
     - Copy the Client ID → `mobile/android/.../Config.kt` `GOOGLE_CLIENT_ID`.
   → Google login becomes real on all three.

## 5) Apple Developer (iOS distribution only)
1. **https://developer.apple.com/account** → enroll in the **Apple Developer Program** ($99/yr). Approval can take a day.
2. **Certificates, Identifiers & Profiles → Identifiers → +** → App IDs → App → Bundle ID `com.quickin.app` → Register.
3. In **Xcode** (`mobile/ios/QuickIn.xcodeproj`) → target **Signing & Capabilities** → choose your **Team**.
   → Needed to build, sign and ship to TestFlight/the App Store. *(Sign in with Apple is not offered — the app signs in with email/password or Google.)*

## 6) Domain + HTTPS (optional now)
- Simplest: use the free **`*.vercel.app`** URL — HTTPS is automatic.
- Custom domain: buy one (Cloudflare/Namecheap) → Vercel → **Settings → Domains → Add** → set the DNS records Vercel shows → HTTPS is provisioned automatically.

---

### After adding keys — make them live
- **Web**: re‑add the env vars on Vercel and **redeploy** (env is read at build/runtime).
- **iOS**: rebuild after editing `Config.swift`; set your Team in Xcode for signing.
- **Android**: rebuild after editing `Config.kt` / `build.gradle.kts`.

### Minimum to "go live" fast
Just **Step 1 (Vercel + DB)** → the web is live with email login. Add **Step 4 Web** for Google login, **Step 3 Web** for Google Maps. Mobile store submission comes after.
