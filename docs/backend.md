# QuickIn Backend (`quickin-backend`)

The **backend** is a separate Next.js 16 (App Router, React 19, TS strict) repo and
Vercel project at `https://quickin-backend.vercel.app`. It is **not** part of the web
app — it is the API the **mobile apps** (iOS + Android) talk to, plus the **OTP mail
relay** that the web frontend delegates email sending to. It shares **one Neon
Postgres database** with `quickin-frontend`.

Source repo on disk: `/Users/ahmedfarahat/Downloads/quickin-backend`
Data layer: `node-postgres` (`pg`) — no Supabase, no ORM, no psql CLI.
Auth: stateless HMAC-signed `qk_token` (Bearer header for mobile, httpOnly cookie for web).

> Heads-up: package.json says `next dev -p 4000` / `next start -p 4000`, but the
> system docs and `debug` Android config reference port `3000` for the local backend.
> On Vercel the port is irrelevant.

---

## 1. Directory map of `src/`

```
src/
├── app/
│   ├── layout.tsx, page.tsx                  # minimal landing (API-only project)
│   └── api/
│       ├── auth/                             # account + session (mobile-facing, CORS *)
│       │   ├── signup/route.ts               # POST  create unverified user + email OTP
│       │   ├── verify-otp/route.ts           # POST  activate account, return {token,user}
│       │   ├── resend-otp/route.ts           # POST  re-issue + re-send signup OTP
│       │   ├── login/route.ts                # POST  password login (+ hardcoded admin)
│       │   ├── logout/route.ts               # GET   clear qk_token cookie
│       │   ├── me/route.ts                   # GET   resolve current user from token/cookie
│       │   ├── forgot-password/route.ts      # POST  email a 6-digit reset code
│       │   ├── reset-password/route.ts       # POST  verify reset code + set new password
│       │   ├── change-password/ (see local)  # (lives under /api/local/change-password)
│       │   ├── google/route.ts               # POST  REAL Google sign-in (verify ID token)
│       │   ├── apple/route.ts                # POST  REAL Sign in with Apple (verify id_token)
│       │   ├── social/route.ts               # POST  DEMO social sign-in (no token verify)
│       │   └── smtp-status/route.ts          # GET   non-secret SMTP config probe
│       ├── local/                            # the main app API (Bearer or cookie)
│       │   ├── listings/ …                    # search, detail, create, availability, quote
│       │   ├── bookings/ …                    # create/list, detail, pay, cancel, messages
│       │   ├── host/ …                        # host dashboards (listings, bookings, earnings…)
│       │   ├── services/ + service-requests/ # standalone experiences + subscriptions
│       │   ├── reviews/ + guest-reviews/      # two-way reviews
│       │   ├── notifications/ …               # in-app feed + FCM/APNs device registration
│       │   ├── wishlist/, profile/, verification/, receipts/, referrals/
│       │   ├── promo/validate/, reports/, regions/, currencies/, stay/[code]/, users/[id]/
│       │   ├── ai/ {chat, search, listing-description}/route.ts   # OpenAI-backed
│       │   └── admin/ …                       # key-gated /ops admin console backend
│       ├── mail/send-otp/route.ts            # POST  internal OTP relay (shared secret)
│       └── wallet/pass/[bookingId]/route.ts  # GET   signed Apple Wallet .pkpass
└── lib/local/
    ├── pool.ts                  # shared pg Pool (DATABASE_URL; TLS off for localhost)
    ├── db.ts                    # listings, bookings, messages, pricing/quote, cancellation
    ├── auth.ts                  # password hashing, HMAC token, user/OTP/profile ops
    ├── mailer.ts                # nodemailer SMTP; sendOtpEmail + sendNotificationEmail
    ├── admin.ts                 # admin overview/moderation queries
    ├── ai.ts                    # OpenAI client (chat/search/description)
    ├── contentguard.ts          # phone-number blocking for booking chat
    ├── money.ts                 # currency display rates (EGP base)
    ├── notifications.ts         # createNotification (in-app feed)
    ├── push.ts                  # sendPush (FCM/APNs)
    ├── oauth.ts                 # Google/Apple ID-token verification helpers
    ├── promote.ts               # referrals (recordReferral)
    ├── reviews.ts, services.ts, wishlist.ts, trust.ts
    └── firebase-service-account.ts
```

Helper libs (`db.ts`, `auth.ts`, etc.) hold the SQL; route files are thin
(`getUserFromRequest` → call helper → JSON). Every `auth/*` and `local/*` route
sets permissive CORS (`Access-Control-Allow-Origin: *`) and an `OPTIONS` handler
because the mobile apps and the web both call cross-origin.

---

## 2. Full API surface

### `app/api/auth/*`
| Route | Method | Purpose |
|---|---|---|
| `auth/signup` | POST | Create an **unverified** `(email, role)` user, email a 6-digit OTP. Returns `{pending:true, email, role}` (no token). `devCode` included when SMTP unconfigured. |
| `auth/verify-otp` | POST | `{email, code, role?}` → activate account, return `{token, user}` + set `qk_token` cookie. Records referral if `referral_code` present. |
| `auth/resend-otp` | POST | Re-issue + re-send the signup OTP for a still-pending account. |
| `auth/login` | POST | `{email, password, role?}` password login. Handles hardcoded admin; unverified → 403 `{needsVerification, email}`. Returns `{token, user}` + cookie. |
| `auth/logout` | GET | Clear the `qk_token` cookie. |
| `auth/me` | GET | Resolve current user from Bearer token or `qk_token` cookie. |
| `auth/forgot-password` | POST | `{email}` → email a 6-digit reset code. Always `{sent:true}` (no account-existence leak). |
| `auth/reset-password` | POST | `{email, code, password}` → verify reset code, set new password (marks email verified). |
| `auth/google` | POST | REAL Google sign-in — verifies Google ID token (`credential`/`id_token`), upserts social user. |
| `auth/apple` | POST | REAL Sign in with Apple — verifies Apple `id_token`, upserts social user. |
| `auth/social` | POST | DEMO social sign-in (no real token verification — prototype path). |
| `auth/smtp-status` | GET | Non-secret SMTP diagnostics — confirms `SMTP_*` reached this runtime. |

### `app/api/local/*` — listings & search
| Route | Method | Purpose |
|---|---|---|
| `local/listings` | GET / POST | GET search (q/region/host/guests/price/amenities/bbox/sort); POST host creates a listing (enters `pending` moderation). |
| `local/listings/[id]` | GET / PATCH | GET one listing; PATCH host updates `cancellation_policy`. |
| `local/listings/[id]/availability` | GET / POST / DELETE | GET public unavailable spans; POST host blocks dates; DELETE host removes a block. |
| `local/listings/[id]/quote` | GET / POST | Authoritative stay price for a date range (weekend + monthly + LOS discount). |
| `local/regions` | GET | Canonical search regions with live published-listing counts. |
| `local/currencies` | GET | `{base:"EGP", rates:{…}}` static display-only conversion rates. |

### `app/api/local/*` — bookings
| Route | Method | Purpose |
|---|---|---|
| `local/bookings` | GET / POST | GET signed-in guest's bookings; POST create a booking (seasonal pricing, clash check). |
| `local/bookings/[id]` | GET / PATCH | GET one reservation; PATCH host confirm/reject or set host notes. |
| `local/bookings/[id]/pay` | POST | MOCK checkout — adds service fee + payment-method adjustment, marks paid/confirmed. |
| `local/bookings/[id]/cancel` | GET / POST | GET cancellation quote (mock refund per policy); POST cancel. |
| `local/bookings/[id]/messages` | GET / POST | Per-booking chat (guest/host/admin). POST is phone-number blocked via contentguard. |

### `app/api/local/*` — host
| Route | Method | Purpose |
|---|---|---|
| `local/host/listings` | GET | Signed-in host's own listings. |
| `local/host/bookings` | GET | All bookings across the host's listings. |
| `local/host/earnings` | GET | Host's mock earnings + payout summary. |
| `local/host/analytics` | GET | Host performance dashboard. |
| `local/host/services` | GET | Host's own services. |
| `local/host/service-requests` | GET | Inbox of requests across the host's services. |

### `app/api/local/*` — services, reviews, social, misc
| Route | Method | Purpose |
|---|---|---|
| `local/services` | GET / POST | GET all public services; POST host posts a service. |
| `local/services/[id]` | GET | One service (public). |
| `local/service-requests` | GET / POST | GET signed-in user's subscriptions; POST create a service request. |
| `local/service-requests/[id]` | GET / PATCH | GET one; PATCH host updates status. |
| `local/reviews` | GET / POST | GET public reviews by `listing_id` OR (Bearer) reviewable stays; POST leave/replace a review. |
| `local/guest-reviews` | GET / POST | Two-way reviews — the host's review OF the guest. |
| `local/users/[id]` | GET | Non-sensitive public profile (name, avatar, bio…). |
| `local/users/[id]/reviews` | GET | Recent reviews across this host's listings (host profile page). |
| `local/wishlist` | GET / POST / DELETE | GET wishlist; POST add/remove/toggle; DELETE remove. |
| `local/profile` | GET / PATCH | GET signed-in user's full profile; PATCH editable fields. |
| `local/change-password` | POST | Change password (requires current password). |
| `local/verification` | GET / POST | Identity verification status + submission for the signed-in user. |
| `local/receipts` | GET | Signed-in guest's paid receipts. |
| `local/referrals` | GET | Signed-in user's referral code + referred list + mock reward. |
| `local/promo/validate` | POST | Preview a promo code against a subtotal (no redemption). Public. |
| `local/reports` | POST | Report a listing/user/review for staff triage. |
| `local/stay/[code]` | GET | PUBLIC stay "pass" data by reservation code (QR target, no PII). |

### `app/api/local/notifications/*`
| Route | Method | Purpose |
|---|---|---|
| `local/notifications` | GET | `{notifications, unreadCount}` for the signed-in user. |
| `local/notifications/[id]` | PATCH | Mark one notification read. |
| `local/notifications/read-all` | POST | Mark all read. |
| `local/notifications/register-device` | POST / PATCH | Store an FCM/APNs device token `{token, platform}`. |
| `local/notifications/register` | POST / PATCH | Alias of register-device (iOS calls PATCH /register). |
| `local/notifications/device` | POST / PATCH | Alias of register-device (Android calls POST /device). |

### `app/api/local/ai/*` (OpenAI-backed; `OPENAI_API_KEY` server-only)
| Route | Method | Purpose |
|---|---|---|
| `local/ai/chat` | POST | AI travel concierge — streams reply as Server-Sent Events. |
| `local/ai/search` | POST | NL query → structured search filters + matching listings. |
| `local/ai/listing-description` | POST | AI-writes a guest-facing listing description (Bearer). |

### `app/api/local/admin/*` (backs the key-gated `/ops` console)
| Route | Method | Purpose |
|---|---|---|
| `local/admin/overview` | GET | Everything: users, listings, bookings, services, reports… |
| `local/admin/listings` | GET / POST | Moderation queue; approve/reject/hide listings. |
| `local/admin/verifications` | GET / POST | ID-verification queue + decisions. |
| `local/admin/promos` | GET / POST / DELETE | Manage promo codes. |
| `local/admin/reports` | GET / POST | Triage user reports. |
| `local/admin/notify` | POST | Fire a notification to users. |
| `local/admin/[entity]/[id]` | PATCH / DELETE | PATCH a user's role; DELETE any row by entity+id. |

### `app/api/mail/*` and `app/api/wallet/*`
| Route | Method | Purpose |
|---|---|---|
| `mail/send-otp` | POST | **Internal relay** — `{to, code}` + `x-relay-secret` header. Sends OTP via this backend's SMTP. Used by the web frontend. |
| `wallet/pass/[bookingId]` | GET | Signed Apple Wallet `.pkpass` for a confirmed reservation (passkit-generator; signing material from env). |

---

## 3. Auth model — **IMPORTANT: diverges from the web**

The backend (`src/lib/local/auth.ts`) still uses the **OLDER dual-account model**,
which is **different from the web's** (`quickin-master/src/lib/local/auth.ts`).

**Backend (this repo) — dual `(email, role)` accounts:**
- A `users` row carries a `role` column = `'user' | 'host' | 'admin'`.
- **One email can hold two separate rows**: a guest (`role='user'`) AND a host
  (`role='host'`), each with its own password, profile, and OTP.
- Lookups are keyed by `(email, role)`: `getUserRowByEmailRole(email, role)`.
  `getUserRowByEmail` exists but is back-compat (`ORDER BY (role='user') DESC LIMIT 1`).
- **OTP is stored on the user row itself**: columns `otp_code` + `otp_expires_at`,
  plus `email_verified`, `pending_role`, and a prototype `password_plain` (so the
  admin console can display it). Helpers: `createPendingUser`, `setUserOtp`,
  `verifyUserOtp`, `setResetOtp`, `resetPasswordWithOtp`, `setPendingRoleOtp`.
- Signup flow: `createPendingUser` (or `setUserOtp` if re-signing up) → `sendOtpEmail`
  → `verifyUserOtp` flips `email_verified = true`, clears the OTP, returns a token.
- `email_verified = false` gates login — unverified login returns **HTTP 403
  `{needsVerification, email}`** so the client opens the OTP screen.
- Hardcoded admin: username `admin` + `ADMIN_PASSWORD` env, token `sub='admin'`,
  no DB row.

**Web (`quickin-master/src/lib/local/auth.ts`) — UNIFIED account (newer):**
- **One account per email**; hosting is a **boolean `is_host`** flag on the row
  (no separate host row), `role` is derived (`is_host ? 'host' : 'guest'`).
- OTP lives in a **separate `otp_codes` table** (`email, code, expires_at, attempts`),
  not on the user row.

So the same Neon `users` table is read by **two different auth schemas**. See gotchas.

**Token (shared shape):** stateless `body.sig` where `body` = base64url JSON
`{sub, email, role, iat:0}` and `sig = HMAC-SHA256(body, AUTH_SECRET)`. Resolved by
`getUserFromRequest` from either `Authorization: Bearer <token>` (mobile) or the
`qk_token` httpOnly cookie (web). Passwords are scrypt `salt:hash` (node:crypto).

---

## 4. Mailer + the `/api/mail/send-otp` relay

`src/lib/local/mailer.ts` uses **nodemailer** over SMTP (defaults to Namecheap
Private Email `mail.privateemail.com:465` SSL). Config via env:
`SMTP_HOST`, `SMTP_PORT` (465 SSL / 587 STARTTLS), `SMTP_USER`, `SMTP_PASS`,
`SMTP_FROM` (defaults to `SMTP_USER`). `smtpConfigured = Boolean(USER && PASS)`.

- `sendOtpEmail(to, code)` — sends the branded 6-digit verification email.
  **If SMTP is unconfigured it logs the code instead of failing** (dev fallback);
  if configured, a real send failure **throws** so the route surfaces it.
- `sendNotificationEmail(to, subject, heading, paragraphs[], cta?)` — branded
  transactional email (booking requests/confirmations/cancellations). **Never throws**
  — a mail failure must not break the booking mutation that triggered it. Called from
  `db.ts` (`createBooking`, `setBookingStatus`, …).
- `smtpDiagnostics()` — non-secret config view (booleans, host/port, masked user)
  powering `GET /api/auth/smtp-status`.

**The relay (`POST /api/mail/send-otp`)** exists because **OTP generation/storage/
verification lives on the WEB**, but the **SMTP credentials live only here**. The web
(`quickin-master/src/lib/local/email.ts`) POSTs `{to, code}` with header
`x-relay-secret: <MAIL_RELAY_SECRET>` to this backend; the backend authorizes against
its own `MAIL_RELAY_SECRET` and calls `sendOtpEmail`. The **mobile apps don't use the
relay** — they hit `/api/auth/signup` directly and the backend sends OTP via SMTP itself.
- 403 if secret missing/mismatched; 503 if SMTP unconfigured; 502 on send failure.
- The web's side reads `MAIL_BACKEND_URL` (e.g. `https://quickin-backend.vercel.app`)
  + `MAIL_RELAY_SECRET`.

---

## 5. Which clients call the backend

- **iOS** (`mobile/ios/Sources/Config.swift`): `apiBaseURL = "https://quickin-backend.vercel.app"`
  (both debug and release). Notably registers push via **PATCH** `/api/local/notifications/register`.
- **Android** (`mobile/android/app/build.gradle.kts`): `BuildConfig.API_BASE_URL` —
  release = `https://quickin-backend.vercel.app`; debug default
  `https://quickin-backend.vercel.app` (overridable with `-PDEV_API_BASE_URL`, e.g.
  `http://10.0.2.2:3000` emulator). Registers push via **POST** `/api/local/notifications/device`.
- **Web frontend** (`quickin-frontend` / `quickin-master/src`): does **not** route
  app data through this backend (it has its own `/api/local/*` against the same DB).
  It only calls **`POST /api/mail/send-otp`** as the OTP mail relay.

The dual `register`/`device` aliases of `register-device` exist precisely because iOS
and Android use different method+path conventions.

---

## 6. Environment variables

Referenced in `src/` (`grep process.env`):

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Neon/Postgres connection (shared with frontend). Falls back to a local DSN; TLS auto-off for localhost. |
| `AUTH_SECRET` | HMAC key for `qk_token` (run `openssl rand -hex 32`). |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Hardcoded admin login for `/api/auth/login`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | nodemailer SMTP. |
| `MAIL_RELAY_SECRET` | Shared secret authorizing `POST /api/mail/send-otp`. Must match the frontend's. |
| `WEB_URL` | Base URL for links inside notification emails (default `https://quickin-frontend.vercel.app`). |
| `GOOGLE_CLIENT_ID` / `APPLE_CLIENT_ID` | Audience for verifying Google/Apple ID tokens. |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | AI chat/search/description (server-only). |
| `FX_RATES_URL` | Optional live currency-rate source (display-only). |
| `FIREBASE_SERVICE_ACCOUNT` | FCM push credentials (notifications). |
| `PASS_ORG_NAME`, `PASS_TEAM_ID`, `PASS_TYPE_ID` (+ signing assets) | Apple Wallet pass generation. |

`.env.example` documents the core set; `.env` (gitignored) holds the live values;
`.env.local` only carries Vercel's `VERCEL_OIDC_TOKEN`.

---

## 7. Gotchas

- **Two auth schemas over one `users` table.** This backend uses the OLDER
  dual-`(email, role)` model with OTP **on the user row** (`otp_code`,
  `otp_expires_at`, `pending_role`, `password_plain`). The web uses a UNIFIED
  account with a boolean **`is_host`** and a separate **`otp_codes` table**. Both
  read/write the same Neon `users` table — so the row must carry the union of both
  schemas' columns, and changing one app's auth assumptions can break the other.
- **Shared single Neon DB.** Frontend and backend write the same tables; there is no
  per-service schema isolation. A migration applied for one app affects both.
- **`password_plain` is stored** (prototype) so the admin console can display
  passwords. Do not ship this to real production.
- **Mock money everywhere.** `pay` is a fake gateway (`QK-MOCK-…` refs), refunds are
  policy-driven mock percentages, earnings/currencies are display-only. No Paymob/Stripe yet.
- **The web owns OTP, the backend owns SMTP.** OTP codes for the web are generated and
  verified on the frontend; only the *send* is delegated here via the relay. The mobile
  apps, by contrast, both generate (server) and send OTP entirely within this backend.
- **CORS is `*` on auth/local routes** with explicit `OPTIONS` handlers — required for
  cross-origin mobile + web callers.
- **Push registration has 3 routes** (`register-device`, `register`, `device`) that are
  aliases because iOS (PATCH /register) and Android (POST /device) differ.
- **Port mismatch:** package.json runs on `4000`; local-stack docs/Android-debug assume
  `3000`. Irrelevant on Vercel but a trap when running locally.
