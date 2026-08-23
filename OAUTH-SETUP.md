# QuickIn — Real Google Sign-In setup

The code for Google sign-in is **real** (no mocking): the backend verifies Google's
signed ID token against its public JWKS before creating a session. What's missing to
make it actually sign in is **your Google credentials**. This is the only thing you
must supply — there's nothing else to build.

> **Sign in with Apple was removed** from web, iOS and Android. There is no Apple
> button, no `/api/auth/apple` endpoint and no `APPLE_CLIENT_ID`. Google and
> email/password are the only sign-in paths.

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

## 2. Quick checklist — what to do to "make it run right now"

- [ ] Create a Google **Web** OAuth client → put the id in `.env.local`
      (`GOOGLE_CLIENT_ID` + `NEXT_PUBLIC_GOOGLE_CLIENT_ID`) → restart `npm run dev`.
      → **Google sign-in works on the website immediately.**
- [ ] (Mobile Google) create iOS + Android OAuth clients → put ids in the apps' `Config` files → rebuild.

Until you add these, the Google button is present and honest: it shows "add your client id".
**Email/password sign-in already works everywhere with no setup**
(demo login `layla@email.com` / `secret123`).
