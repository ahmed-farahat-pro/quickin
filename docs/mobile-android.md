# QuickIn — Android App

The native Android client for QuickIn (a boutique vacation-rental platform). 100% Kotlin +
Jetpack Compose (Material 3), single-Activity, state-driven navigation (no Navigation-Compose /
back-stack). It talks to the **separate backend** Vercel project (`quickin-backend`), not Supabase.

- **Module root:** `mobile/android/`
- **Package:** `com.quickin.app` (everything lives in one flat package + a `ui/` sub-package)
- **Min/Target/Compile SDK:** 26 / 35 / 35 · JDK 17 · `versionName "1.0"` / `versionCode 1`
- **Architecture:** Compose UI → `*ViewModel` (StateFlow) → `*Service` (object, HttpURLConnection)

---

## 1. Directory map

```
mobile/android/
├── build.gradle.kts                 # root: plugin classpath only
├── settings.gradle.kts              # repos (Google Maven, Maven Central) + include(":app")
├── gradle.properties                # AndroidX / Kotlin flags
├── local.properties                 # SDK path (per-machine, git-ignored)
├── gradle/wrapper/…                 # Gradle wrapper
└── app/
    ├── build.gradle.kts             # module config: BuildConfig fields, signing, deps  ← §2,§6
    ├── google-services.json         # Firebase/FCM config (read by google-services plugin)
    ├── release.keystore             # self-signed dev keystore (git-ignored)
    └── src/main/
        ├── AndroidManifest.xml      # perms, MainActivity, deep links, FCM service  ← §3,§8
        ├── res/
        │   ├── values/strings.xml          # default (English) strings
        │   ├── values-ar|fr|es/strings.xml # Arabic / French / Spanish
        │   ├── xml/network_security_config.xml  # cleartext allowlist (dev IPs)  ← §8
        │   ├── xml/shortcuts.xml           # launcher long-press / Assistant shortcuts
        │   ├── drawable/, mipmap-*/, values/themes.xml
        └── java/com/quickin/app/
            ├── MainActivity.kt             # the ONLY Activity: intents, AppRoot, MainApp router  ← §3,§4
            ├── Config.kt                   # base URLs, OAuth/Maps keys, share/deeplink consts  ← §2
            ├── Models.kt                   # all data classes (Listing, Service, Booking, …)
            │   ── Services (object, HttpURLConnection) ───────────────────────────  ← §5
            ├── AuthService.kt              # signup/login/OTP/Google/reset/becomeHost  ← §3
            ├── SupabaseService.kt          # listings browse/search (name is legacy)
            ├── BookingService.kt           # bookings, pay, host, earnings, availability, AI writer
            ├── ServiceService.kt           # experiences/services feed + subscribe + host services
            ├── ReviewService.kt            # listing reviews + two-way (host↔guest) reviews
            ├── WishlistService.kt          # saved listings/services
            ├── TrustService.kt             # ID verification, host badges, host profile, reports
            ├── ProfileService.kt           # editable profile load/save, change password
            ├── NotificationService.kt      # in-app notifications feed + device-token register
            ├── AITravelChatService.kt      # AI travel concierge (public, no auth)
            ├── IDScanService.kt            # Egyptian National ID OCR (local Python :8000 server)
            ├── GoogleSignIn.kt             # play-services-auth wrapper (id_token capture)
            │   ── ViewModels (AndroidViewModel, StateFlow) ───────────────────────  ← §4
            ├── AuthViewModel.kt            # the central auth state machine  ← §3
            ├── ListingsViewModel.kt, BookingsViewModel.kt, HostViewModel.kt,
            ├── ServicesViewModel.kt, ReviewsViewModel.kt, WishlistViewModel.kt,
            ├── TrustViewModel.kt, NotificationsViewModel.kt, ProfileSettingsViewModel.kt,
            ├── MoneyViewModel.kt, ChatViewModel.kt, AvailabilityViewModel.kt, AiTravelViewModel.kt
            │   ── Managers / helpers ─────────────────────────────────────────────
            ├── BiometricAuthManager.kt     # BiometricPrompt + EncryptedSharedPreferences session
            ├── LocaleManager.kt            # in-app language switch (AppCompat per-app locales)
            ├── CurrencyManager.kt          # multi-currency display + FX refresh
            ├── PushTokenManager.kt, QuickInMessagingService.kt  # FCM token + incoming messages
            ├── Share.kt                    # ShareLinks + shareText + DeepLink.parse  ← §8
            ├── Qr.kt, AvatarImage.kt
            └── ui/                         # ~45 @Composable screens/components  ← §4
                ├── AuthScreen.kt, OtpScreen.kt, ForgotPasswordScreen.kt, SplashScreen.kt
                ├── ListingsScreen.kt, ListingDetailScreen.kt, ListingsMap.kt
                ├── ServicesScreen.kt, ReservationsScreen.kt, ReservationDetailScreen.kt
                ├── HostScreen.kt, HostServicesScreen.kt, AnalyticsScreen.kt, MoneyScreens.kt
                ├── ProfileScreen.kt, ProfileSettingsScreen.kt, HostProfileScreen.kt
                ├── WishlistScreen.kt, NotificationsScreen.kt, ChatScreen.kt, AiTravelChatScreen.kt
                ├── EgyptianIDScanScreen.kt, TrustUi.kt, PaymentSheet.kt, MySubscriptionsScreen.kt
                ├── UiKit.kt (GradientButton, qkSwap, helpers), Skeletons.kt, theme/Theme.kt
                └── CountryPicker.kt, DateRangePickerSheet.kt, StatusBadge.kt, PasswordStrength.kt …
```

> **Naming note:** `SupabaseService.kt` is a legacy name only — the app does NOT use Supabase. It is
> a plain HttpURLConnection client hitting `${Config.API_BASE_URL}/api/local/listings`.

---

## 2. Configuration — `Config.kt` + `build.gradle.kts` BuildConfig

`Config.kt` is the single source of truth for endpoints and keys. The API base URL is **not** a
constant — it is injected per build type via `BuildConfig.API_BASE_URL`:

`Config.kt:13`
```kotlin
object Config {
    val API_BASE_URL: String = BuildConfig.API_BASE_URL   // build-type dependent
```

`app/build.gradle.kts:49-66` sets the field per build type:

| Build type | `API_BASE_URL` source | Default value |
|---|---|---|
| `debug`   | `-PDEV_API_BASE_URL=…` override, else default | `https://quickin-backend.vercel.app` |
| `release` | hardcoded | `https://quickin-backend.vercel.app` |

> **Gotcha (drift vs. the doc comment):** `Config.kt:6-11` documents debug as
> `http://10.0.2.2:3000` and release as the prod Vercel URL. The **actual** `build.gradle.kts`
> default for debug is the **live backend** (`quickin-backend.vercel.app`) so the app shows real
> data on a fresh emulator with no local server. To point debug at a local `npm run dev`, override
> at build time:
> ```
> ./gradlew assembleDebug -PDEV_API_BASE_URL=http://10.0.2.2:3000        # emulator → host machine
> ./gradlew assembleDebug -PDEV_API_BASE_URL=http://192.168.8.24:3000    # real phone on Wi-Fi
> ```
> Any cleartext (http) IP used here must be listed in `res/xml/network_security_config.xml`.
> `10.0.2.2` is the emulator's alias for the host machine's `localhost`.

Other `Config.kt` constants:

- **`SHARE_WEB_BASE_URL` = `https://quickin-frontend.vercel.app`** (`Config.kt:64`) and
  **`SHARE_WEB_HOST` = `quickin-frontend.vercel.app`** (`Config.kt:67`). Deliberately the public
  **website** origin, NOT the API origin — so shared links land a recipient on the site (and open
  the app via App Links if installed). Used by `ShareLinks` (`Share.kt`). `SHARE_WEB_HOST` is
  mirrored by the App Links `<intent-filter>` in the manifest.
- **`DEEP_LINK_SCHEME` = `quickin`** (`Config.kt:70`) — custom-scheme fallback, e.g.
  `quickin://explore/{id}`.
- **`ID_OCR_BASE_URL` = `http://192.168.8.24:8000`** (`Config.kt:25`) — local Python/EasyOCR server
  for Egyptian National ID scanning. Hardcoded LAN IP; **must be kept in sync** with the cleartext
  allowlist in `network_security_config.xml` and re-set when the dev Mac's IP changes.
- **`GOOGLE_CLIENT_ID`** (`Config.kt:36`) — Google OAuth **web** client id (the backend verifies
  the returned id_token against the same id). Blank disables the Google button.
- **`MAPS_API_KEY`** (`Config.kt:52`) — selects the native Google Maps Explore map at runtime.
  Must line up with the `MAPS_API_KEY` manifest placeholder in `build.gradle.kts:26-27`
  (default already filled in). Empty → app falls back to the osmdroid OpenStreetMap price-pill map.

`buildFeatures { compose = true; buildConfig = true }` (`build.gradle.kts:76-79`) — `buildConfig`
must be on for `BuildConfig.API_BASE_URL` to generate.

---

## 3. Auth layer

The OTP-gated, single-account auth flow is the most important part of the app. Files:
`AuthService.kt`, `AuthViewModel.kt`, `ui/OtpScreen.kt`, `ui/AuthScreen.kt`,
`ui/ForgotPasswordScreen.kt`, with routing in `MainActivity.kt`.

### Backend contract (`AuthService.kt:43-48`)

```
POST {base}/api/auth/signup      {email,password,full_name[,country]} → {pending:true,email,role} | {error}
POST {base}/api/auth/verify-otp  {email,code[,referral_code]}         → {token,user} | {error}
POST {base}/api/auth/resend-otp  {email}                              → {pending:true,email}
POST {base}/api/auth/login       {email,password}                     → {token,user}
                                                                       | 403 {needsVerification:true,email}
                                                                       | {error}
POST {base}/api/auth/google      {id_token}                           → {token,user} | {error} (501 if unconfigured)
POST {base}/api/auth/forgot-password {email}                          → 200 {sent:true} (never reveals existence)
POST {base}/api/auth/reset-password  {email,code,password}            → {token,user}
POST {base}/api/local/host/become    (Bearer)                         → {ok,user} (no token — reuse current)
```

### `AuthService.kt` — the data shapes

- **`AuthResult`** (`AuthService.kt:16-25`) — a successful session: `token, userId, userName, email,
  provider, role, isHost`. `isHost` (parsed from the user JSON's `is_host`) is the source of truth
  for host abilities; `role` ("host"|"guest") is only a display pill, derived from `isHost` when
  absent (`parseAuth`, `AuthService.kt:226-253`).
- **`AuthOutcome`** sealed interface (`AuthService.kt:32-38`):
  - `Success(result: AuthResult)` — login / Google / verified OTP completed with a token.
  - `NeedsVerification(email, role?)` — email not yet verified; caller must route to the OTP screen.
- **`login()`** (`AuthService.kt:59-74`): on HTTP 403 it calls `needsVerification(text)` and returns
  `NeedsVerification` instead of throwing — that is how an unverified login is funnelled into the
  OTP flow.
- **`signup()`** (`AuthService.kt:84-104`): **always** returns `NeedsVerification` (signup never
  returns a token; the backend emails a 6-digit OTP). Sends optional `country`.
- Parsing helpers:
  - **`needsVerification(text)`** (`AuthService.kt:220-221`): `JSONObject(text).optBoolean("needsVerification", false)`, wrapped in `runCatching`.
  - **`optEmail(text)`** (`AuthService.kt:223-224`): `JSONObject(text).optString("email")` or null if blank.
- **`becomeHost(token)`** (`AuthService.kt:262-287`): `POST /api/local/host/become` with the Bearer
  token; idempotent; flips `is_host`; response has **no fresh token** so the existing token is reused.

### `AuthViewModel.kt` — the state machine

- **`AuthUiState`** (`AuthViewModel.kt:13-39`): `isAuthenticated, isLoading, error, userId, userName,
  email, provider, role, isHost, pendingEmail, otpResendCooldown`. `pendingEmail` non-null drives the
  OTP screen.
- Token + profile are persisted in `SharedPreferences("qk_auth")` (keys at
  `AuthViewModel.kt:455-464`: `token, user_id, name, email, provider, role, is_host`). Initial state
  is rehydrated from prefs at construction (`AuthViewModel.kt:68-78`) so the user stays signed in
  across launches; `currentToken()` (`:325`) reads the token for Authorization headers.
- **`runOutcome { … }`** (`AuthViewModel.kt:332-357`) — runs a call returning `AuthOutcome`. Used by
  `login()` and `signup()`. On `Success` → `persistSession(viaPassword=true)`. On `NeedsVerification`
  it **eagerly fires `AuthService.resendOtp(email)`** so a code is already on its way, then sets
  `pendingEmail` (which makes `MainApp` render `OtpScreen`).
- **`runAuth { … }`** (`AuthViewModel.kt:364-377`) — runs a call that always yields a session
  (`verifyOtp`, `googleSignIn`).
- **`pendingEmail`** lives in `AuthUiState`; **`pendingReferralCode`** is a private field
  (`AuthViewModel.kt:90`) held from signup until the OTP step, then forwarded to `verify-otp`.
- `verifyOtp(code)` (`:163-167`) reads `pendingEmail`, calls `runAuth` with `viaPassword=true`.
  `resendOtp()` (`:170-186`) enforces a client-side 30-second cooldown via `startOtpCooldown()`
  (`:189-197`). `cancelVerification()` (`:200-203`) clears `pendingEmail` and returns to the form.
- **Biometric:** after any password-derived login, `persistSession(viaPassword=true)` publishes a
  `biometricEnrollOffer` (`:98-99`, `:409-413`) when the device can run a prompt and the session
  isn't already enrolled. `enableBiometric()`/`loginWithBiometricSession()` use `BiometricAuthManager`
  (EncryptedSharedPreferences, separate from `qk_auth`).
- **Forgot password** is a self-contained sub-flow with its own `ForgotPasswordUiState`
  (`:47-54`, two steps EnterEmail → EnterCode) so its spinner/error don't collide with the main form.

### `ui/OtpScreen.kt`

A single-column Compose screen (`OtpScreen.kt:64-187`). 6-digit field
(`OTP_LENGTH = 6`, digits-only filter, `NumberPassword` keyboard), a "Verify" `GradientButton`
enabled only when `code.length == 6`, and a "Resend code" `TextButton` disabled while
`otpResendCooldown > 0` (label "Resend in {n}s"). Props: `onVerify(code)`, `onResend`, `onBack`.

### `MainActivity.kt` routing for auth

`MainApp()` is a giant precedence-ordered `if (…) { … ; return }` ladder of full-screen overlays.
The auth-relevant order (highest first) near the bottom of the ladder:

1. **OTP screen** (`MainActivity.kt:1171-1181`): shown when `authState.pendingEmail != null &&
   !authState.isAuthenticated`. Takes priority over the auth form.
2. **Forgot-password** (`:1186-1198`): `showForgot && !isAuthenticated`.
3. **Auth form** (`:1201-1232`): `showAuth && !isAuthenticated`. The `onLogin`/`onSignup` lambdas
   ignore any role argument (unified account). Google launches via `ActivityResultContracts`
   (`googleSignInLauncher`, `:434-451`) and the captured id_token is exchanged in a `LaunchedEffect`.

A successful sign-in flips `authState.isAuthenticated`, and `LaunchedEffect(authState.isAuthenticated)`
(`:586-588`) drops `showAuth`. Sign-in also triggers per-account data loads + clears on sign-out
(`:617-670`) so a different account never sees the previous account's data.

---

## 4. Major screens / composables

State-driven, single Activity. `MainActivity.onCreate` → `AppRoot()` (`:280`, splash for ~1.6s) →
`MainApp()` (`:303`). `MainApp` instantiates ~13 ViewModels via `viewModel()`, collects their
StateFlows, then renders **either** a full-screen overlay (early `return`) **or** the tabbed
`Scaffold`.

**Bottom tabs** — one unified set for every account (`GUEST_TABS`, `MainActivity.kt:179-185`):
`Explore · Services · Wishlist · Trips · Profile`. Rendered by the custom `GlossyTabBar`
(`:191-277`, raised white pill for the selected tab). Host features are reached from the **Profile**
tab, not a separate tab set — the tab set never changes on role.

**Tabbed screens** (in the `Scaffold` `when(tabs[i].key)`, `:1254-1399`):
- `ListingsScreen` (Explore) — feed, search, region chips, sort, filters, "Search this area",
  the notifications bell, the "Ask AI" search, and a FAB → AI travel concierge.
- `ServicesScreen` — public bookable experiences feed.
- `WishlistScreen` — saved stays + experiences (signed-out → sign-in prompt).
- `ReservationsScreen` (Trips) — the user's own bookings.
- `ProfileScreen` — avatar/bio, received reviews, ID verification, "Become a host", referrals, and
  the entry points to host/settings/subscriptions/receipts/earnings/analytics screens.

**Full-screen overlays** (each an `if (…) return` in precedence order, `:737-1198`):
`PaymentSheet` (mock) → `HostProfileScreen` → `ListingDetailScreen` → `ServiceDetailScreen` →
`MySubscriptionsScreen` → `ReceiptsScreen` → `HostEarningsScreen` → `HostAnalyticsScreen` →
`ProfileSettingsScreen` → `HostServicesScreen` → `AiTravelChatScreen` → `ChatScreen` →
`ReservationDetailScreen` (QR card) → `AddListingScreen` → `HostScreen` → `NotificationsScreen` →
`OtpScreen` → `ForgotPasswordScreen` → `AuthScreen`.

**System BACK** is handled by a single `BackHandler` (`:707-735`) that pops whichever overlay is on
top, mirroring the render precedence (there is no Compose back stack).

**Maps:** `ui/ListingsMap.kt` renders osmdroid (OpenStreetMap, no key) by default with burgundy
price pills; switches to native Google Maps (`maps-compose`) only when `Config.MAPS_API_KEY` is set.

**Other notable composables:** `EgyptianIDScanScreen` (CameraX live ID scan), `TrustUi` (verification
+ host badges + report), `UiKit.kt` (`GradientButton`, the `qkSwap` tab transition), `theme/Theme.kt`
(burgundy/cream boutique palette), `Skeletons.kt` (loading shimmers).

---

## 5. Networking pattern (HttpURLConnection)

There is **no Retrofit/OkHttp/Moshi**. Every network call uses `java.net.HttpURLConnection` +
`org.json`, wrapped in `withContext(Dispatchers.IO)`. The pattern is repeated per service `object`
(`AuthService`, `SupabaseService`, `BookingService`, `ServiceService`, `ReviewService`, …).

Canonical authenticated GET (`BookingService.kt:657-673`):
```kotlin
private fun get(token: String, path: String): String {
    val conn = (URL("${Config.API_BASE_URL}$path").openConnection() as HttpURLConnection).apply {
        requestMethod = "GET"
        connectTimeout = 15_000; readTimeout = 15_000
        setRequestProperty("Accept", "application/json")
        setRequestProperty("Authorization", "Bearer $token")
    }
    try {
        val code = conn.responseCode
        val text = readBody(conn, code)          // inputStream on 2xx, else errorStream
        if (code !in 200..299) throw HttpError(code, extractError(text, code))
        return text
    } finally { conn.disconnect() }
}
```

Key conventions:
- **Auth:** `setRequestProperty("Authorization", "Bearer $token")` — the token comes from
  `AuthViewModel.currentToken()` (the `qk_auth` SharedPreferences token). Public endpoints
  (`SupabaseService.fetchListings`, `AITravelChatService`, services feed) omit it.
- **Write requests** (`send("POST"|"PATCH", …)`, `BookingService.kt:676-695`): `doOutput=true`,
  `Content-Type: application/json`, body written as UTF-8 from a `JSONObject`.
- **Error handling:** `AuthService` returns a raw `(statusCode, text)` pair and inspects status
  manually (so it can branch on 403 → `NeedsVerification`). The other services throw
  `BookingService.HttpError(code, message)` (`BookingService.kt:22`) on non-2xx, with the message
  pulled from the JSON `{error}` field via `extractError`.
- **Parsing:** hand-written `org.json` parsers (`parseListing`, `parseAuth`, `parseHostAnalytics`,
  `parseReceipt`, …), all using `optString/optInt/optDouble` with `.takeUnless { it.isNaN() }`
  defaults — tolerant of missing/null fields.
- **Query strings:** built manually with `URLEncoder` (`SupabaseService.buildQueryString`).
- **Timeouts:** 15s connect + 15s read everywhere.

---

## 6. Build / run + flavors

**No product flavors** — only the two default build types `debug` and `release` (they differ in
`API_BASE_URL` default and signing/minify; see §2).

```bash
cd mobile/android

# Debug (defaults to the LIVE quickin-backend; real data, no local server needed)
./gradlew assembleDebug
./gradlew installDebug           # install to a connected device/emulator

# Debug against a LOCAL Next.js dev server
./gradlew installDebug -PDEV_API_BASE_URL=http://10.0.2.2:3000        # emulator
./gradlew installDebug -PDEV_API_BASE_URL=http://192.168.8.24:3000    # real phone on Wi-Fi

# Release APK / AAB (signed with the bundled dev keystore by default)
./gradlew assembleRelease
./gradlew bundleRelease
```

**Signing** (`build.gradle.kts:30-47`): the `release` config points at `app/release.keystore`
(self-signed dev keystore, git-ignored). Default passwords (`quickin123`, alias `quickin`) are the
committed fallbacks; override via `-PRELEASE_STORE_FILE / -PRELEASE_STORE_PASSWORD /
-PRELEASE_KEY_ALIAS / -PRELEASE_KEY_PASSWORD` or `~/.gradle/gradle.properties`.

**Release notes:** `isMinifyEnabled = false` (ProGuard rules referenced but not stripping). Requires
`app/google-services.json` (the `com.google.gms.google-services` plugin reads it at build time for
FCM); without a valid one the build fails or FCM no-ops.

**Maps:** pass `-PMAPS_API_KEY=…` (feeds the manifest placeholder) **and** set `Config.MAPS_API_KEY`
to the same value to enable native Google Maps; otherwise osmdroid is used.

---

## 7. How it talks to the backend

- **All app/business API calls** go to `${Config.API_BASE_URL}` = the **`quickin-backend`** Vercel
  project (`https://quickin-backend.vercel.app` in both debug-default and release). This is the same
  backend the web app's mobile-facing API and OTP mail relay live in; both Vercel projects share one
  Neon Postgres DB.
- **Endpoint families:**
  - `/api/auth/*` — signup, verify-otp, resend-otp, login, google, forgot/reset-password (§3).
  - `/api/local/*` — everything else: `listings`, `bookings` (+ `/pay`, `/messages`, `/:id`),
    `host/bookings`, `host/listings`, `host/earnings`, `host/analytics`, `host/become`, `receipts`,
    `referrals`, `promo/validate`, `listings/:id/availability`, `ai/chat`, `ai/listing-description`,
    services, reviews, wishlist, trust/verification, profile, notifications.
- **Auth token:** stateless bearer token returned by the backend, persisted in `qk_auth`
  SharedPreferences, sent as `Authorization: Bearer <token>`. (This mirrors the web's HMAC
  `qk_token` cookie, but on Android it's an explicit header, not a cookie.)
- **OTP email:** the **backend** sends the 6-digit OTP via its own SMTP. The app just POSTs to
  `/api/auth/signup` / `/api/auth/resend-otp` and shows the OTP screen.
- **Push:** FCM device token (resolved by `PushTokenManager`) is registered with the backend after
  sign-in via `NotificationsViewModel.registerDeviceToken()`; incoming messages handled by
  `QuickInMessagingService`.
- **ID OCR (separate host):** `IDScanService` hits `Config.ID_OCR_BASE_URL`
  (`http://192.168.8.24:8000`), a local Python/EasyOCR server — NOT the Vercel backend.
- **Share links** point at the **website** (`SHARE_WEB_BASE_URL = quickin-frontend.vercel.app`), not
  the API; App Links re-open them in the app.

---

## 8. Gotchas

1. **Debug ≠ local by default.** Despite the `Config.kt` doc comment saying debug = `10.0.2.2:3000`,
   the real `build.gradle.kts:56-58` default for debug is the **live backend**. Pass
   `-PDEV_API_BASE_URL=…` to hit a local server. (Two places disagree — trust `build.gradle.kts`.)
2. **`SupabaseService` is a misnomer.** No Supabase anywhere — it's a plain HttpURLConnection client
   for `/api/local/listings`. The web/mobile stack moved off Supabase; the class name is stale.
3. **Cleartext allowlist must be kept current.** Any `http://` dev IP (`DEV_API_BASE_URL` or
   `ID_OCR_BASE_URL`) must appear in `res/xml/network_security_config.xml`
   (currently `10.0.2.2`, `localhost`, `127.0.0.1`, `192.168.8.24`). HTTPS production hosts work
   without it; a new LAN IP that isn't listed will fail with a cleartext-blocked error.
4. **Hardcoded LAN IP `192.168.8.24`** appears in both `Config.ID_OCR_BASE_URL` and the network
   config — update both (and re-run `ipconfig getifaddr en0`) when the dev Mac's IP changes.
5. **No back stack.** Navigation is `var` state in `MainApp` + an ordered `if/return` ladder + a
   single `BackHandler`. Adding a screen means inserting it at the correct precedence in **both** the
   render ladder (`MainActivity.kt:737-1198`) and the `BackHandler` (`:707-735`), or BACK will skip it.
6. **Unverified login is not an error.** `AuthService.login` returns `AuthOutcome.NeedsVerification`
   on HTTP **403** with `needsVerification:true` — don't treat 403 as a failure; it routes to OTP.
   `runOutcome` then *eagerly resends* an OTP before showing the screen
   (`AuthViewModel.kt:340-348`), so a code is already in the inbox.
7. **`becomeHost` returns no token.** `/api/local/host/become` returns `{ok,user}` only; the existing
   bearer token is reused (`AuthService.kt:267`). Don't expect a fresh session.
8. **Two SharedPreferences stores.** The normal session is in `qk_auth`; the biometric session is a
   **separate** EncryptedSharedPreferences store (`BiometricAuthManager`). `logout()` deliberately
   **keeps** the biometric store (so the fingerprint button reappears) — it only clears `qk_auth`
   (`AuthViewModel.kt:302-316`).
9. **`MainActivity` is `singleTask` + `AppCompatActivity`.** singleTask means OAuth redirects and
   deep links arrive via `onNewIntent` (`MainActivity.kt:143-147`), not a new instance.
   AppCompatActivity (not ComponentActivity) is required for both per-app locales
   (`AppCompatDelegate.setApplicationLocales`) and `BiometricPrompt`.
10. **osmdroid needs a User-Agent.** `MainActivity.onCreate` sets
    `Configuration.getInstance().userAgentValue = packageName` before any MapView, or OSM tile
    servers reject requests (`MainActivity.kt:132`).
11. **App Links need `assetlinks.json`.** The `autoVerify` https intent-filter
    (host `quickin-frontend.vercel.app`) only opens the app once the website serves a matching
    `/.well-known/assetlinks.json` listing this package + the release signing SHA-256. Until then
    https links just open in the browser (land on the site) — never broken. The `quickin://` scheme
    is the no-verification fallback.
12. **Committed secrets.** `Config.kt` ships real-looking `GOOGLE_CLIENT_ID` and `MAPS_API_KEY`
    values, and the dev keystore passwords are committed defaults in `build.gradle.kts`. Fine for a
    prototype; rotate before any real release.
