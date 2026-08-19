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
   - **Android** client (for the Android app): package `com.quickin.app` + the SHA-1 below.
     It must be created **in the same Cloud project as the Web client above** — Play services
     resolves the caller against that project, so an Android client filed under a different
     project is invisible and sign-in dies with DEVELOPER_ERROR (10).

     > ⚠️ Do **not** use `~/.android/debug.keystore` here, whatever an older copy of this doc
     > said. That keystore is generated per machine, so it gave every developer — and every
     > fresh CI runner — a different fingerprint, and the APKs in `publishs/` could never be
     > registered against anything. The repo now pins one keystore for all debug builds,
     > `mobile/android/app/debug.keystore`, whose fingerprint is:
     >
     > ```
     > D1:2E:E0:C1:DB:FD:18:9A:E4:27:54:0A:99:49:53:CF:A6:27:C6:87
     > ```
     >
     > Re-read it any time with:
     > ```
     > keytool -list -v -keystore mobile/android/app/debug.keystore -alias androiddebugkey -storepass android
     > ```

     Register **three** SHA-1s on that one Android client, or Google sign-in will work in some
     builds and not others:
     | Build | Fingerprint to register |
     |---|---|
     | Debug (local + the CI APKs in `publishs/`) | the pinned SHA-1 above |
     | Release APK signed locally | `keytool -list -v -keystore mobile/android/app/release.keystore -alias quickin` |
     | Play Store builds | the **App signing key** SHA-1 from Play Console → *Release → Setup → App integrity*. Google re-signs uploads, so the upload key's fingerprint is **not** the one that reaches users' devices. |

### b) Paste the IDs
| Where | File | Value |
|------|------|-------|
| Website (server verify) | `.env.local` | `GOOGLE_CLIENT_ID=<web client id>` |
| Website (button)        | `.env.local` | `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<web client id>` |
| iOS app                 | `mobile/ios/Sources/Config.swift` | `googleClientID = "<ios client id>"` |
| Android app             | `mobile/android/app/src/main/java/com/quickin/app/Config.kt` | `GOOGLE_CLIENT_ID = "<**web** client id>"` |

Note the Android row: it takes the **web** client id, not the Android one. That id is only the
*audience* the backend verifies — the Android client is never named in code, it is matched
behind the scenes by package name + signing SHA-1. Both must be right, and they fail
differently: a wrong id here → the backend rejects the token ("Audience mismatch"); a missing
Android client → Play services rejects the app (DEVELOPER_ERROR, status 10) before the backend
is ever called. The app now says which of the two happened.

`GOOGLE_CLIENT_ID` on the server accepts a comma-separated list, so list every platform's id:
`GOOGLE_CLIENT_ID=<web-id>,<ios-id>`.

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
