# QuickIn — Run & Credentials Checklist

This app runs **fully local, no Supabase** (Next.js + Node + local PostgreSQL).
Everything below already works with **no credentials** EXCEPT the 3 things in
"What you must add" — those need keys only you can create.

---

## ▶️ How to run everything

```bash
# 1. Database (once)
brew services start postgresql@16          # local Postgres → quickin_local

# 2. Web site + API   (http://localhost:3000  → redirects to /explore)
cd /Users/ahmedfarahat/Downloads/quickin-master
npm run dev

# 3. Admin panel      (http://localhost:3001)
node local-backend/admin-server.mjs

# 4. iOS app  (Xcode 26 / iOS 26 simulator)
cd mobile/ios && xcodegen generate && open QuickIn.xcodeproj   # ▶ Run
#   or headless:
xcodebuild -project QuickIn.xcodeproj -scheme QuickIn -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build

# 5. Android app
cd mobile/android && JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home \
  ./gradlew :app:assembleDebug && \
  ~/Library/Android/sdk/platform-tools/adb install -r app/build/outputs/apk/debug/app-debug.apk
```

**Demo login:** `layla@email.com` / `secret123`  ·  Postgres conn: `postgresql://ahmedfarahat@127.0.0.1:5432/quickin_local`

Works today with zero keys: browse, search (location/dates/guests), availability,
**map with Airbnb price pins** (OpenStreetMap/Leaflet/MapKit), reserve, My Reservations,
email/password sign-in, the admin panel.

---

## ✅ What you must ADD to unlock the rest

### 1) Google Maps  — to switch the map from OpenStreetMap → Google Maps
Maps already work without this (OSM/Apple). Add a key only if you specifically want Google Maps tiles.
1. https://console.cloud.google.com/google/maps-apis → create/select a project, **enable billing**.
2. Enable: **Maps JavaScript API** (web), **Maps SDK for Android**, **Maps SDK for iOS**.
3. Create an **API key** (restrict it to those APIs).
4. Paste it:
   | Platform | Where |
   |---|---|
   | Web | `.env.local` → `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...` then restart `npm run dev` |
   | Android | `mobile/android/app/.../Config.kt` → `MAPS_API_KEY` (and `-PMAPS_API_KEY=...`), rebuild |
   | iOS | `mobile/ios/Sources/Config.swift` → `googleMapsAPIKey` (also add the GoogleMaps SDK via SPM) |

### 2) Google Sign-in  — to make the "Continue with Google" buttons real
1. https://console.cloud.google.com/apis/credentials → **Create credentials → OAuth client ID**.
2. **Web application** client: Authorized JS origin `http://localhost:3000`. Copy the Client ID.
   - `.env.local` → `GOOGLE_CLIENT_ID=...` **and** `NEXT_PUBLIC_GOOGLE_CLIENT_ID=...` → restart.  → **web Google login works.**
3. **iOS** OAuth client (bundle `com.quickin.app`) → `mobile/ios/Sources/Config.swift` → `googleClientID`.
4. **Android** OAuth client (package `com.quickin.app` + your debug SHA‑1) → `Config.kt` → `GOOGLE_CLIENT_ID`.
   - debug SHA‑1: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android`

### 3) Sign in with Apple  — needs a paid Apple Developer account ($99/yr)
1. Apple Developer portal → App ID `com.quickin.app` → enable **Sign in with Apple**.
2. **iOS**: Xcode → target → Signing & Capabilities → set your **Team** + add **Sign in with Apple**.
   `.env.local` → `APPLE_CLIENT_ID=com.quickin.app`. Rebuild. → **iOS Apple login works.**
3. **Web/Android Apple**: needs a **Services ID** + a public **HTTPS domain** (not localhost) — a later step.

### (Optional) AI chat
The legacy Supabase app's Gemini chat needs `GEMINI_API_KEY`. Not used by the local stack.

---

## TL;DR — minimum to make the headline features "real"
- **Google Maps tiles** → 1 Google Maps API key in `.env.local` (+ Config files for mobile).
- **Google login** → 1 Google OAuth Web Client ID in `.env.local` (+ iOS/Android client ids).
- **Apple login** → an Apple Developer account + your Team in Xcode.
Everything else already runs locally with no keys.
