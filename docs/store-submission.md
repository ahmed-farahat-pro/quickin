# QuickIn — Store Submission Readiness (v1, payment-deferred)

_Last updated: 2026-06-27. Scope: iOS (`mobile/ios`, SwiftUI) + Android (`mobile/android`, Kotlin/Compose), both calling `https://quickin-backend.vercel.app`. v1 ships WITHOUT real payment._

---

## TL;DR — the payment verdict

- **You will NOT be rejected for "not using IAP / Play Billing."** A vacation rental is a real-world service consumed outside the app. Apple **forbids** IAP here (Guideline **3.1.3(e)** / **3.1.5(a)**) and Google **forbids** Play Billing here (Payments policy: physical goods/services exemption). You owe Apple/Google **0% commission** on bookings — same as Airbnb/Booking.com/Vrbo.
- **You WILL likely be rejected for the MOCK payment screen as it stands.** A card-style checkout (the `•••• 4242` row) plus a "Pay" button that completes a booking while charging nothing reads as **placeholder / non-functional / misleading content** under Apple **2.1** (App Completeness) + **2.3.1** (hidden/undocumented features) and Google **Broken Functionality** + **Deceptive Behavior**. Reviewers test the booking→pay flow end-to-end. The current "Demo payment — no real charge" banner helps but does not fully remove the risk.
- **v1 fix:** ship a **"Request to book" → "Pay at property / arrange with host"** model. Remove the decorative card UI, relabel the CTA to **"Confirm reservation (no charge)"**, keep a prominent "Payment is arranged directly with the host" note, and explain the off-platform model in App Review notes. **Never collect card numbers you don't process.** (Today you don't — keep it that way.) **Note: the bigger actual blocker than payment is the missing account-deletion feature and the iOS ID-scan-over-HTTP dead-end — see below.**

---

## Payment: what Apple & Google require + the exact fix

### Why neither IAP nor Play Billing applies

A booking is a "physical good or **service consumed outside the app**."

- **Apple** — Guideline **3.1.3(e)** (Goods/Services Outside the App): such purchases **"must use purchase methods other than in-app purchase … such as Apple Pay or traditional credit card entry."** **3.1.5(a)** reinforces this. So a real third-party processor (Stripe/Adyen/Paymob/Apple Pay) **later** is the correct and required path. IAP is not just unnecessary here — it is **prohibited**.
- **Google** — Payments policy lists "purchases of physical services (transportation, airfare, gym memberships, food delivery)" as **not supported by Play Billing**; you **must** use an alternative processor. Play Billing is mandatory only for in-app **digital** goods.

### Why the MOCK still risks rejection

The pay flow is a true end-to-end mock with **no card data collected** (good) but a card-styled UI and a button that "succeeds" without charging:

- iOS — `mobile/ios/Sources/PaymentSheet.swift`: decorative disabled card row `•••• •••• •••• 4242` at **lines 413/430–431** (`allowsHitTesting(false)`, `accessibilityHidden(true)`); "Pay" CTA → `BookingService.shared.pay()` at **line 549**; demo banner `demoNote` at **lines 388–393**.
- iOS network — `mobile/ios/Sources/BookingService.swift` POSTs to `{base}/api/local/bookings/{id}/pay`.
- Android — `mobile/android/app/src/main/java/com/quickin/app/ui/PaymentSheet.kt`: `DecorativeCardRow` at **lines 623–653** (masked `•••• 4242`, non-interactive); demo note `R.string.pay_demo_note` at **lines 275–287**; "Pay" → `onPay(method.api)` (`card`/`bank_transfer`) at **lines 294–313**.
- Android network — `mobile/android/app/src/main/java/com/quickin/app/BookingService.kt` `pay()` at **lines 93–107**.
- Backend — `src/app/api/local/bookings/[id]/pay/route.ts`: header comment confirms **"Mock payment (no real gateway) … records payment (paid_at) without changing status."** No Stripe/Paymob/card SDK anywhere in the repo.

**Verdict:** Apple **2.1 / 2.3.1**, Google **Broken Functionality / Deceptive Behavior**. Reviewers **do** walk this flow; with demo guest + host accounts they reach approve→pay. The card-looking UI is the trigger, not the mock itself.

### The recommended v1 fix (per platform)

Goal: make the post-approval step **unambiguously a confirmation, not a charge.**

**iOS — `mobile/ios/Sources/PaymentSheet.swift`**
1. **Remove `DecorativeCardRow` (the `•••• 4242` block, ~lines 407–432).** A fake card is the single biggest "deceptive/placeholder" signal — delete it, don't just disable it.
2. **Relabel the CTA** from "Pay" to **"Confirm reservation (no charge)"** (new localized key, e.g. `pay.confirmCta`).
3. **Promote the demo note** (`pay.demoNote`, lines 388–403) to primary copy: **"Payment is arranged directly with the host (pay at property). No charge is taken in the app."**
4. Keep the price **breakdown** (subtotal/fees) as an informational estimate — that's fine; it's the card field + "charge" framing that's the problem.
5. `BookingService.shared.pay()` (line 549) and the backend route can stay — they flip the booking to confirmed, which now reads honestly as "reservation confirmed."

**Android — `mobile/android/app/src/main/java/com/quickin/app/ui/PaymentSheet.kt`**
1. **Remove `DecorativeCardRow` (lines 623–653).**
2. **Relabel** the "Pay" button to **"Confirm reservation (no charge)"** (string resource).
3. **Promote `R.string.pay_demo_note` (lines 275–287)** to primary, non-collapsed copy with the same "arranged with host / pay at property" wording.
4. Drop or relabel the ±5% card/bank "method fee" selector — a card-method fee implies card processing. For request-to-book, present one path.

**Both / metadata**
- Store listing copy and screenshots must **never** claim real card processing or "secure payments."
- One line in App Review notes (see §5): _"Bookings are request-to-book; payment is arranged directly with the host (pay at property). No in-app charge occurs in v1. A real processor will be added in a later release; per Apple 3.1.3(e) / Google Payments policy this real-world service will use a third-party processor, not IAP/Play Billing."_

---

## Apple App Store checklist

| Item | Status in our app | Action needed | Severity |
|---|---|---|---|
| **Payment (3.1.3(e) / 2.1 / 2.3.1)** | Mock checkout with decorative card row + "Pay" CTA that confirms without charging (`PaymentSheet.swift` 407–432, 549). IAP correctly NOT used. | Remove decorative card row; relabel CTA to "Confirm reservation (no charge)"; promote no-charge note; explain in review notes. | **Blocker** |
| **ID verification over HTTP (2.1 + ATS + 5.1.1)** | `EgyptianIDScanView.swift` (from `ProfileSettingsView.swift:202–206`) POSTs a National-ID photo to `Config.idOcrBaseURL` = `http://192.168.8.24:8000` (`Config.swift:62`) — hardcoded LAN, plaintext, no DEBUG guard. Unreachable on review network → functional dead-end; ships sensitive ID images in cleartext. | Route OCR through the HTTPS backend, **or** remove the scan for v1 and use the existing manual-entry fallback in the same view. Do not ship ID upload over HTTP. | **Blocker** |
| **Account deletion (5.1.1(v))** | **MISSING.** No in-app delete-account action, no DELETE call (`ProfileView.swift:375–381` has logout only; `ProfileSettingsView` has no delete). Repo grep for delete/deactivate found nothing in app code. | Add in-app "Delete my account" that deletes account + data (or starts the deletion request). Required because the app supports account creation (email + Apple + Google). | **Blocker** |
| **Sign in with Apple (4.8)** | **Present & real.** `AuthView.swift:409` `SignInWithAppleButton`, handler `:552`; Google also offered. Apple's equal-prominence requirement satisfied. | Confirm the "Sign in with Apple" capability is enabled in the App ID/entitlements for the release build. | Should |
| **Permission strings** | Present in `mobile/ios/Generated/Info.plist`: `NSCameraUsageDescription`, `NSFaceIDUsageDescription`, `NSLocationWhenInUseUsageDescription`, `NSPhotoLibraryUsageDescription`. | Verify each string is specific/user-facing (why you need camera = ID scan, etc.). | Should |
| **ATS / HTTP (App Transport Security)** | `Info.plist` sets only `NSAllowsLocalNetworking=true`. Main API is HTTPS (`Config.swift:19/21` → `https://quickin-backend.vercel.app`) — good. The HTTP ID-OCR endpoint won't work and isn't whitelisted anyway. | No arbitrary-loads exception needed once ID-OCR is on HTTPS. Keep ATS strict. | Should |
| **Privacy policy + App Privacy labels** | App collects email, name, photo, location, and (via scan) National ID. Privacy policy URL + App Privacy "nutrition labels" must be filled in App Store Connect. | Publish a privacy policy URL; complete App Privacy labels to match actual collection (incl. ID images if scan ships; note "no payment data collected"). | **Blocker** (ASC submission gate) |
| **Demo account** | Demo accounts exist (Demo12345). | Provide guest **and** host demo logins in review notes so reviewer can reach approve→confirm. | Should |
| **Metadata / screenshots** | TBD. | Ensure copy/screenshots never imply real payment; show booking/host flows. | Should |
| **Completeness / no dead-ends (2.1)** | Aside from ID-OCR + payment, confirm no other "coming soon"/placeholder screens. | Walk every primary flow on-device. | Should |

---

## Google Play checklist

| Item | Status in our app | Action needed | Severity |
|---|---|---|---|
| **Payment (Payments policy / Broken Functionality / Deceptive Behavior)** | Mock checkout with `DecorativeCardRow` (`PaymentSheet.kt:623–653`) + "Pay" CTA (`294–313`) that confirms without charging. Play Billing correctly NOT used (forbidden for rentals). | Remove decorative card row; relabel CTA to "Confirm reservation (no charge)"; promote `pay_demo_note`; drop card-method fee framing. | **Blocker** |
| **Account deletion (in-app + web URL)** | **MISSING.** No in-app delete action, no delete API call (`ProfileSettingsScreen.kt` has no delete control; repo grep empty). | Add (a) in-app account+data deletion path **and** (b) a publicly reachable **web URL** to request deletion, then declare the URL in the Play Console Data Safety form. Mandatory since 2024 for apps with account creation. | **Blocker** |
| **Data Safety form** | Not yet completed. App collects email, name, location, photos, National ID; **no payment data**. | Complete Data Safety: list data types, "collected/shared", encryption-in-transit, and the deletion URL. Must match actual behavior. | **Blocker** (submission gate) |
| **Target API level** | `targetSdk = 35`, `compileSdk = 35`, `minSdk = 26` (`app/build.gradle`). Meets the current Play target-API requirement. | None. | OK |
| **Cleartext traffic** | `network_security_config.xml` permits cleartext only to dev hosts (`10.0.2.2`, `localhost`, `127.0.0.1`, `192.168.8.24`). Main API is HTTPS. The ID-OCR call to those LAN IPs dead-ends on the review network (same functional issue as iOS). | Move ID-OCR to HTTPS or remove the scan for v1; then strip the LAN/dev domains from `network_security_config.xml` so the release build has no cleartext exceptions. | **Blocker** (ID-OCR) / Should (cleanup) |
| **Privacy policy** | URL required in Play Console + linked in-app. | Publish and link a privacy policy. | **Blocker** (submission gate) |
| **Permissions** | Manifest: `INTERNET`, `ACCESS_FINE/COARSE_LOCATION`, `POST_NOTIFICATIONS`, `USE_BIOMETRIC`, `CAMERA`. All have plausible use. | Confirm each is actually used; justify location/camera in Data Safety. No high-risk perms (no SMS/Contacts). | Should |
| **Completeness / Broken Functionality** | Same ID-OCR + payment dead-ends as iOS. | Walk booking, host, profile, scan flows on a real device / Play Internal Testing track. | Should |

---

## App Review notes (copy-paste)

> **Demo logins** (password for all: `Demo12345`)
> - Guest: `guest@quickin.demo`
> - Host: `host@quickin.demo`
> _(Substitute your actual seeded demo emails — all share password `Demo12345`.)_
>
> **How to exercise the app:** Sign in as the guest, open a listing, choose dates, and tap **Request to book**. Then sign in as the host to **approve** the request. Back as the guest, the booking shows as **confirmed**. You can also browse listings, view host profiles, leave a review on a completed stay, and edit profile settings.
>
> **Payment:** This is a vacation-rental marketplace (a real-world service consumed outside the app), so per Apple Guideline 3.1.3(e) / Google's Payments policy it does **not** use In-App Purchase or Google Play Billing. In v1, bookings are **request-to-book** and **payment is arranged directly with the host (pay at property)** — **no charge is taken inside the app.** A third-party payment processor will be added in a later release.
>
> **ID verification:** _(Include only if the scan ships)_ Optional ID verification uses the device camera; a manual-entry fallback is available. No payment card data is collected anywhere in the app.

**Internal only — do NOT put in review notes or share with reviewers:** the admin/ops console password `QuickInAdmin2026` is for internal staff use only.

---

## Prioritized action plan

### BLOCKERS — fix before submitting
1. **Add account deletion (both apps).** iOS: add a "Delete my account" action in `ProfileView.swift` / `ProfileSettingsView.swift` calling a new DELETE endpoint. Android: add the control in `ProfileSettingsScreen.kt` + a **public web deletion URL** for the Play Data Safety form. _(Apple 5.1.1(v); Google account-deletion policy.)_
2. **Fix the iOS ID-scan-over-HTTP dead-end.** `Config.swift:62` (`http://192.168.8.24:8000`) and `EgyptianIDScanService.scan()` in `EgyptianIDScanView.swift` — route OCR through the HTTPS backend, or remove the scan for v1 and keep the manual-entry fallback. Mirror on Android (`network_security_config.xml` LAN hosts + IDScanService BASE_URL).
3. **De-mock the payment UI.** iOS `PaymentSheet.swift` (remove decorative card 407–432, relabel CTA, promote no-charge note). Android `PaymentSheet.kt` (remove `DecorativeCardRow` 623–653, relabel CTA, promote `pay_demo_note`, drop card-fee framing).
4. **Publish privacy policy URL** and complete **Apple App Privacy labels** + **Google Data Safety** form (incl. account-deletion URL); ensure "no payment data collected."

### SHOULD-fix before submitting
5. Provide **guest + host demo logins** in review notes (above).
6. Verify **iOS permission usage strings** are specific (`Generated/Info.plist`) and **Sign in with Apple** capability is enabled in the release App ID.
7. Strip dev/LAN cleartext domains from Android `network_security_config.xml` after ID-OCR is on HTTPS; keep iOS ATS strict (no arbitrary-loads exception).
8. Audit all primary flows on-device/Internal Testing for any other placeholder or dead-end screens (Apple 2.1 / Google Broken Functionality).
9. Ensure store **screenshots/copy never imply real card payment**.

### Nice-to-have
10. Add a short in-app "How payment works" explainer on the confirmation screen ("You'll arrange payment with your host").
11. Add a deletion **grace-period / confirmation** dialog so account deletion isn't a one-tap accident.
12. Plan the real processor (Stripe/Adyen/Paymob/Apple Pay) for v1.1 — wire it as a **third-party processor, never as IAP/Play Billing**.
