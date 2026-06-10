# QuickIn — Real Google & Apple Sign-In setup

The code for Google and Apple sign-in is **real** (no mocking): the backend verifies
the provider's signed ID token against its public JWKS before creating a session.
What's missing to make it actually sign in is **your provider credentials**. This is
the only thing you must supply — there's nothing else to build.

---

## 1. Google Sign-In  ✅ (works on web + iOS + Android once you add a Client ID)

### a) Create the OAuth client
1. Go to <https://console.cloud.google.com/apis/credentials> (create a project if needed).
2. Configure the **OAuth consent screen** (External, add your email as a test user).
3. **Create Credentials → OAuth client ID:**
   - **Web application** (for the website + as the server "audience"):
     - Authorized JavaScript origins: `http://localhost:3000`
     - Copy the **Client ID** (looks like `xxxx.apps.googleusercontent.com`).
   - **iOS** client (for the iOS app): bundle id `com.quickin.app`. Copy its Client ID.
   - **Android** client (for the Android app): package `com.quickin.app` + your debug
     **SHA-1** (`keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android`).

### b) Paste the IDs
| Where | File | Value |
|------|------|-------|
| Website (server verify) | `.env.local` | `GOOGLE_CLIENT_ID=<web client id>` |
| Website (button)        | `.env.local` | `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<web client id>` |
| iOS app                 | `mobile/ios/Sources/Config.swift` | `googleClientID = "<ios client id>"` |
| Android app             | `mobile/android/app/src/main/java/com/quickin/app/Config.kt` | `GOOGLE_CLIENT_ID = "<client id>"` |

Then **restart the web dev server** (`.env.local` is read at startup) and rebuild the apps.
That's it — the buttons become live; the backend (`/api/auth/google`) verifies every token.

> Tip: the website alone works with just the two `.env.local` values. Mobile additionally
> needs its own client id (and Android the SHA-1) because Google ties tokens to the app.

---

## 2. Sign in with Apple  🍎 (needs a paid Apple Developer account)

Apple sign-in **cannot** run without an Apple Developer Program membership ($99/yr).

### iOS (native — already wired)
1. In the **Apple Developer** portal: App ID `com.quickin.app` → enable **Sign in with Apple**.
2. In **Xcode** (open `mobile/ios/QuickIn.xcodeproj`): select the target → **Signing & Capabilities**
   → set your **Team**, then **+ Capability → Sign in with Apple**.
3. Put your app's bundle id (or a Services ID) in `.env.local` as `APPLE_CLIENT_ID=com.quickin.app`
   so the backend (`/api/auth/apple`) accepts the token's audience.
4. Rebuild. The native "Sign in with Apple" button now authorizes for real.

### Web / Android (web flow — extra setup)
Apple has **no native Android SDK**, and web Apple sign-in requires **HTTPS + a registered
domain** (it won't work on `http://localhost`). To enable it later you'd need:
- An **Services ID** + a **Sign in with Apple key** in the Apple portal.
- A public **HTTPS domain** with the return URL registered.
- (Android) launch that web flow in a Custom Tab.

So: **Apple works on iOS now** (with your Team); web/Android Apple is a later step that
needs a real HTTPS domain. The Apple button on web currently shows this note instead of mocking.

---

## 3. Quick checklist — what to do to "make it run right now"

- [ ] Create a Google **Web** OAuth client → put the id in `.env.local`
      (`GOOGLE_CLIENT_ID` + `NEXT_PUBLIC_GOOGLE_CLIENT_ID`) → restart `npm run dev`.
      → **Google sign-in works on the website immediately.**
- [ ] (Mobile Google) create iOS + Android OAuth clients → put ids in the apps' `Config` files → rebuild.
- [ ] (Apple, iOS) join Apple Developer → enable the capability + set your Team in Xcode →
      set `APPLE_CLIENT_ID` in `.env.local` → rebuild.
- [ ] (Apple web/Android) only once you have an HTTPS domain — optional for local dev.

Until you add these, the buttons are present and honest: Google shows "add your client id",
Apple shows "needs Apple Developer setup". **Email/password sign-in already works everywhere
with no setup** (demo login `layla@email.com` / `secret123`).
