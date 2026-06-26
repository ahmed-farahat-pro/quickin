# QuickIn — System Architecture

System-wide overview of QuickIn: **4 codebases**, **2 Vercel projects**, and **1 shared
Neon Postgres database**. Read this first for the big picture; then dive into the
per-codebase docs:

- [`docs/web.md`](web.md) — the Next.js web app (`quickin-master/src`).
- [`docs/backend.md`](backend.md) — the mobile-facing API + OTP mail relay (`quickin-backend`).
- [`docs/mobile-ios.md`](mobile-ios.md) — the SwiftUI iOS app (`mobile/ios`).
- [`docs/mobile-android.md`](mobile-android.md) — the Kotlin/Compose Android app (`mobile/android`).
- Deploy steps: [`docs/DEPLOYMENT.md`](DEPLOYMENT.md). Doc index: [`docs/README.md`](README.md).

> **Stale-docs warning.** The root `CLAUDE.md` and several older `docs/*` files describe a
> **Supabase** stack. That is **stale**. The live data/auth layer is a **"local stack"**:
> a `node-postgres` Pool + a stateless HMAC `qk_token` cookie (`src/lib/local/*`). The
> `src/lib/supabase/*` code and the `(main)`/`(dashboard)`/`admin` route groups are
> **legacy** — do not build new features on them.

---

## 1. The four codebases & where they run

```
                                   ┌──────────────────────────────┐
                                   │   ONE shared Neon Postgres    │
                                   │   (schema = local-backend/    │
                                   │    init.sql; users, listings, │
                                   │    bookings, otp_codes, …)    │
                                   └──────────────┬───────────────┘
                          ┌──────────────────────┴──────────────────────┐
                          │ (both Vercel projects connect via DATABASE_URL)│
            ┌─────────────▼──────────────┐              ┌─────────────────▼─────────────────┐
            │ Vercel project              │              │ Vercel project                     │
            │ "quickin-frontend"          │  POST        │ "quickin-backend"                  │
            │ quickin-frontend.vercel.app │  /api/mail/  │ quickin-backend.vercel.app         │
            │ = the LIVE WEBSITE          │──send-otp───▶│ = mobile API + OTP SMTP relay      │
            │ src/lib/local/* (qk_token)  │  (relay)     │ src/lib/local/* + nodemailer SMTP  │
            └─────────────▲──────────────┘              └──────▲──────────────────▲───────────┘
                          │ rsync from quickin-master/src             │ Bearer qk_token    │
                          │ then `git push origin main`               │                    │
            ┌─────────────┴──────────────┐              ┌──────────────┴───┐    ┌──────────┴──────────┐
            │ quickin-master (SOURCE repo)│              │ iOS app           │    │ Android app          │
            │ you EDIT here:              │              │ mobile/ios        │    │ mobile/android       │
            │  • src/ (web app)           │              │ SwiftUI, XcodeGen │    │ Kotlin/Compose       │
            │  • mobile/ios, mobile/android              │ apiBaseURL =      │    │ API_BASE_URL =       │
            │  • local-backend/init.sql (schema)         │ quickin-backend   │    │ quickin-backend      │
            └────────────────────────────┘              └───────────────────┘    └─────────────────────┘
```

| Repo (on disk) | Role | Deploys to |
|---|---|---|
| **quickin-master** `/Users/ahmedfarahat/Downloads/quickin-master` | The **source / working repo** you edit. Web app in `src/`, mobile in `mobile/ios` & `mobile/android`, `local-backend/init.sql` (the Postgres schema) + `admin-server.mjs` (a localhost-only Node admin). | Nothing directly — code is rsync'd out (see §2). |
| **quickin-frontend** `/Users/ahmedfarahat/Downloads/quickin-frontend` | The **deployed web repo**. Web code is rsync'd here from `quickin-master/src`. | Vercel project **quickin-frontend** → `https://quickin-frontend.vercel.app`. |
| **quickin-backend** `/Users/ahmedfarahat/Downloads/quickin-backend` | A **separate** Next.js repo: the API the **mobile apps** call, the OTP **mail relay** (`POST /api/mail/send-otp`), and working SMTP (nodemailer, `mail.privateemail.com`). | Vercel project **quickin-backend** → `https://quickin-backend.vercel.app`. |
| **mobile/ios + mobile/android** (inside quickin-master) | Native clients. Point at the **backend** project. Built/shipped via Xcode (TestFlight) / Gradle. | App Store / Play (not Vercel). |

Both Vercel projects share **one Neon Postgres database** — there is no per-service
schema isolation. A migration applied for one app affects both.

---

## 2. master → frontend rsync → deploy relationship

`quickin-master` is **not** wired to Vercel. The live website is the *separate*
`quickin-frontend` repo. The release flow is:

```
edit quickin-master/src  →  rsync into quickin-frontend  →  git push origin main  →  Vercel auto-builds quickin-frontend
```

- The **backend** is simpler: edit `quickin-backend` directly → `git push origin main` →
  Vercel auto-builds **quickin-backend**.
- The **mobile apps** live in `quickin-master/mobile/*` and ship through Xcode/Gradle,
  not Vercel.

Exact commands, the Vercel CLI upload-cap caveat, and pre-deploy checks are in
[`docs/DEPLOYMENT.md`](DEPLOYMENT.md).

---

## 3. Request flow — web vs mobile

**Web (browser → quickin-frontend):**
1. Browser hits `quickin-frontend.vercel.app`. `src/proxy.ts` (the middleware) does locale
   path-prefix routing (`/en`, `/ar`, `/fr`, `/es`) and redirects `/` and `/listings` →
   `/explore`.
2. Active pages are the **unprefixed standalone routes** (`/explore`, `/host`, `/account`,
   `/login`, `/signup`, `/saved`, `/reservations`, `/ops`, `/verify-id`). They import
   `@/lib/local/*`.
3. Server components / route handlers under `src/app/api/{auth,local}/*` resolve the
   session from the `qk_token` httpOnly cookie and read/write Neon via `src/lib/local/db.ts`.

**Mobile (iOS/Android → quickin-backend):**
1. The apps set their base URL to `https://quickin-backend.vercel.app`
   (iOS `Config.apiBaseURL`, Android `BuildConfig.API_BASE_URL`).
2. They call `/api/auth/*` and `/api/local/*` on the **backend**, sending the session as
   `Authorization: Bearer <qk_token>` (not a cookie).
3. The backend resolves the user with `getUserFromRequest` (Bearer header) and reads/writes
   the **same** Neon DB via its own `src/lib/local/db.ts`.

So **web and mobile hit different Vercel projects but the same database**. The local-stack
route handlers on both projects use `export const dynamic = 'force-dynamic'`, a permissive
CORS object (`Access-Control-Allow-Origin: *`, `Cache-Control: no-store`), and JSON bodies,
so the request/response shapes are interchangeable across web and mobile.

> **Two auth schemas, one `users` table.** The **web** uses a *unified* account: one row per
> email, a boolean `is_host`, OTP in a separate `otp_codes` table. The **backend** still uses
> an *older* dual-`(email, role)` model with OTP stored on the user row (`otp_code`,
> `otp_expires_at`, `pending_role`, `password_plain`). The `qk_token` shape is shared, but the
> account model differs — see [`docs/backend.md`](backend.md) §3.

---

## 4. Auth / OTP / `email_verified` flow

`email_verified` is the login gate on both surfaces. Signup creates an **unverified** user +
a 6-digit OTP; an unverified login returns **HTTP 403 `{needsVerification, email}`** so the
client shows the OTP screen. OAuth (Google/Apple) users are auto-verified.

The split: **the web owns OTP generation/verification but delegates the email send to the
backend relay**; the **backend** generates *and* sends OTP itself (direct SMTP) for mobile.

### Web signup OTP (uses the relay)

```
Browser            quickin-frontend                         quickin-backend            SMTP
  │  POST /api/auth/signup  │                                      │                     │
  │────────────────────────▶│ createUser(email_verified=false)     │                     │
  │                         │ createOtpCode() → otp_codes (10-min)  │                     │
  │                         │ sendOtpEmail(to,code):                │                     │
  │                         │   POST /api/mail/send-otp             │                     │
  │                         │   header x-relay-secret=MAIL_RELAY_SECRET ──────────────────▶│ (relay authorizes,
  │                         │                                       │  nodemailer.send ──▶│  sends 6-digit code)
  │  { pending:true, email }│◀──────────────────────────────────────                       │
  │◀────────────────────────│                                      │                     │
  │  POST /api/auth/verify-otp {email,code}                        │                     │
  │────────────────────────▶│ verifyOtpCode() + markEmailVerified() │                     │
  │  { token, user } + Set-Cookie qk_token                         │                     │
  │◀────────────────────────│                                      │                     │
```

### Mobile signup OTP (backend sends directly)

```
iOS/Android        quickin-backend                  SMTP
  │ POST /api/auth/signup  │                          │
  │───────────────────────▶│ createPendingUser()       │
  │                        │ sendOtpEmail() ──────────▶│ (nodemailer, direct)
  │ {pending:true,email}   │◀──────────                 │
  │◀───────────────────────│                          │
  │ POST /api/auth/verify-otp {email,code[,role]}      │
  │───────────────────────▶│ verifyUserOtp() → token   │
  │ { token, user }        │◀──────────                 │
  │◀───────────────────────│  (sent later as Bearer)   │
```

If the relay env (`MAIL_BACKEND_URL` + `MAIL_RELAY_SECRET`) is unset on the web,
`sendOtpEmail` **never throws** — it only `console.log`s the code (fine for dev, silent
delivery failure in prod). On the backend, if SMTP is unconfigured the OTP is likewise
logged instead of sent.

---

## 5. Data model summary (`local-backend/init.sql`)

The schema is in `quickin-master/local-backend/init.sql` (run once against Neon; seeds 8 demo
listings). Key tables:

| Table | Purpose / notable columns |
|---|---|
| `users` | One account per email. `is_host` (boolean — becomes a host in-app), `email_verified` (OTP gate; social → true), `password_hash`, `provider`, `fcm_token`/`push_platform`. Case-insensitive `lower(email)` unique index. **The backend also writes `role`, `otp_code`, `otp_expires_at`, `pending_role`, `password_plain` onto this same row.** |
| `listings` | `title`, `location`, `country`, `price_per_night`, `bedrooms/beds/bathrooms/max_guests`, `property_type`, `is_published`, `listing_code`, `lat`/`lng`, `host_id` → `users(id)`. |
| `listing_images` | `listing_id` FK, `url`, `"order"`. |
| `saved_listings` | Wishlist — unique `(user_id, listing_id)`. |
| `bookings` | `check_in/out`, guest counts (`adults/children/infants/pets`), `total_price`, `status` (`pending → pay → confirmed`), `paid_at`, `cancelled_at`, `refund_percent`, `host_notes`. |
| `id_verifications` | One submission/user; `image_data` (base64 data URL, no blob service), `id_number`, `source` (`manual`/`structocr`), `status` (`pending`/`verified`/`rejected`). |
| `reviews` | Guest → listing. One per `(booking_id, reviewer_id)`; `rating` 1–5, `photos text[]`. |
| `guest_reviews` | Host → guest. One per `booking_id`; `host_id` nullable. |
| `notifications` | In-app feed: `type`, `title`, `body`, `link`, `read`. |
| `otp_codes` | **Web** email OTP — one row per email (`code`, `expires_at`, `attempts`), upserted on resend. |
| `host_applications` | "Become a host" submissions; admin approval flips `users.is_host`. Unique `(user_id)`. |

> The `services`/`service_requests` tables referenced by the backend live in the backend's
> own seed (`schema_seed.sql`) rather than `init.sql`.

---

## 6. Environment variable inventory

### quickin-frontend (web)
| Var | Purpose |
|---|---|
| `DATABASE_URL` (or `quickin_DATABASE_URL` / `POSTGRES_URL` / `*_UNPOOLED`) | Neon connection. `src/lib/local/pool.ts` picks the **first valid `postgres://` URL** among these (non-URL values are ignored), else a localhost default. |
| `AUTH_SECRET` | HMAC key for signing/verifying `qk_token` (30-day TTL). |
| `MAIL_BACKEND_URL` | Base URL of the backend mail relay (e.g. `https://quickin-backend.vercel.app`). |
| `MAIL_RELAY_SECRET` | Shared secret sent as `x-relay-secret` to the relay. **Must match the backend's.** |
| `ADMIN_OPS_KEY` | The `/ops` admin-console gate (dev fallback `QuickInAdmin2026`). |
| `GOOGLE_CLIENT_ID` / `APPLE_CLIENT_ID` | OAuth ID-token audiences (`src/lib/local/oauth.ts`). |
| `GEMINI_API_KEY` | AI help chat (web). |

### quickin-backend (mobile API + relay)
| Var | Purpose |
|---|---|
| `DATABASE_URL` | Same Neon DB as the frontend. |
| `AUTH_SECRET` | HMAC key for `qk_token` (same scheme as web). |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Hardcoded admin for `/api/auth/login`. |
| `SMTP_HOST/PORT/USER/PASS/FROM` | nodemailer SMTP (default `mail.privateemail.com:465`). |
| `MAIL_RELAY_SECRET` | Authorizes `POST /api/mail/send-otp`. **Must match the frontend's.** |
| `WEB_URL` | Base for links in notification emails (default `https://quickin-frontend.vercel.app`). |
| `GOOGLE_CLIENT_ID` / `APPLE_CLIENT_ID` | Audience for Google/Apple ID-token verification. |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | AI chat/search/listing-description. |
| `FIREBASE_SERVICE_ACCOUNT` | FCM push credentials. |
| `PASS_ORG_NAME` / `PASS_TEAM_ID` / `PASS_TYPE_ID` (+ signing assets) | Apple Wallet pass generation. |
| `FX_RATES_URL` | Optional live currency-rate source (display-only). |

### Mobile (build-time, not env on a server)
- **iOS** `Sources/Config.swift`: `apiBaseURL = quickin-backend.vercel.app`, `idOcrBaseURL`
  (localhost/LAN OCR :8000), `googleClientID`, `googleMapsAPIKey`.
- **Android** `app/build.gradle.kts` → `BuildConfig.API_BASE_URL` (release & debug default =
  `quickin-backend.vercel.app`; override debug with `-PDEV_API_BASE_URL=http://10.0.2.2:3000`),
  `Config.kt`: `ID_OCR_BASE_URL`, `GOOGLE_CLIENT_ID`, `MAPS_API_KEY`,
  `SHARE_WEB_BASE_URL = quickin-frontend.vercel.app`.

---

## 7. "Where do I change X?"

| Task | File(s) | Notes |
|---|---|---|
| **Add a web API endpoint** | `quickin-master/src/app/api/local/<name>/route.ts` | `export const dynamic='force-dynamic'`, CORS object, `getUserFromRequest`, DB via `src/lib/local/db.ts`. See [web.md](web.md) §8. |
| **Add a web page** | `quickin-master/src/app/<route>/page.tsx` | An **unprefixed** standalone route (live app); `proxy.ts` handles locale prefixing. Avoid the `(main)`/`(dashboard)`/`admin` groups (legacy). |
| **Add a DB read/mutation** | `quickin-master/src/lib/local/db.ts` (web) and/or `quickin-backend/src/lib/local/db.ts` | Parameterized `pool.query`. Same DB; keep shapes in sync if both surfaces use it. |
| **Change the schema** | `quickin-master/local-backend/init.sql` + run a migration on Neon | See [DEPLOYMENT.md](DEPLOYMENT.md) §"Running DB migrations" (temp key-gated `/api/local/xmig*` endpoint pattern). |
| **Change the OTP email (template/SMTP)** | `quickin-backend/src/lib/local/mailer.ts` (`sendOtpEmail`) | The web only *triggers* it via the relay (`quickin-master/src/lib/local/email.ts`). |
| **Change OTP generation/verification (web)** | `quickin-master/src/lib/local/{db.ts,auth.ts}` (`createOtpCode`/`verifyOtpCode`/`markEmailVerified`) | OTP lives in `otp_codes`. |
| **Manage users / listings / bookings (web)** | `/ops` console — `quickin-master/src/app/ops/page.tsx` → `src/app/api/local/admin/*` (key-gated by `isAdminKey`, `ADMIN_OPS_KEY`). | The **active** admin surface. `app/admin/*` (Supabase) is legacy — don't confuse them. |
| **Manage data (mobile/backend side)** | `quickin-backend/src/app/api/local/admin/*` + `src/lib/local/admin.ts` | Backs the same `/ops` console for backend-served data. |
| **Add an iOS screen** | `quickin-master/mobile/ios/Sources/*.swift` (+ a `*Service.swift` for networking); regenerate with `xcodegen generate` | Don't hand-edit `QuickIn.xcodeproj`. See [mobile-ios.md](mobile-ios.md). |
| **Add an Android screen** | `quickin-master/mobile/android/app/src/main/java/com/quickin/app/ui/*.kt` (+ a `*Service.kt`); insert into the `MainActivity.kt` render ladder **and** `BackHandler` | No back stack — precedence matters. See [mobile-android.md](mobile-android.md). |
| **Change which DB the web uses** | Vercel env on **quickin-frontend** (`DATABASE_URL` etc.) | `pool.ts` ignores non-`postgres://` values — a "wrong DB" usually means the URL is in a different env var. |
| **Change an i18n string** | `quickin-master/src/messages/{en,ar,fr,es}.json` (web), `Localization.swift` (iOS), `res/values*/strings.xml` (Android) | Web: add to `en.json` first, then run `npm run check:i18n`. |
| **Deploy the web** | rsync `quickin-master/src` → `quickin-frontend` → `git push` | See [DEPLOYMENT.md](DEPLOYMENT.md) §Web. |
| **Deploy the backend** | edit & `git push` in `quickin-backend` | See [DEPLOYMENT.md](DEPLOYMENT.md) §Backend. |

---

## 8. Cross-references

- Web app internals: [`docs/web.md`](web.md)
- Backend API + relay + mailer: [`docs/backend.md`](backend.md)
- iOS app: [`docs/mobile-ios.md`](mobile-ios.md)
- Android app: [`docs/mobile-android.md`](mobile-android.md)
- Deploying everything: [`docs/DEPLOYMENT.md`](DEPLOYMENT.md)
- Doc index / start-here: [`docs/README.md`](README.md)
