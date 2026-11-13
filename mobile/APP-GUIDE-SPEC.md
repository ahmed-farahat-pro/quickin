# App guide (onboarding walkthrough) — shared spec

One spec for iOS, Android and web. The copy and step order are the same everywhere;
only the anchors differ per surface.

## Decisions (made by the owner, 2026-11-13)

- Surfaces: **iOS + Android + web**.
- "First time" is remembered **on the device** (UserDefaults / SharedPreferences /
  localStorage). No backend, no migration. A reinstall shows it again.
- The **main tour** starts by itself on first launch, signed in OR signed out (adapted).
- The **host tour** never starts by itself. It is offered on the main tour's last step,
  and can be started anytime from Profile → Help.
- Both tours can be restarted from the beginning from **Profile → "App guide"**.

## Persistence

- Key: `qk.guide.main.v1.seen` (web: localStorage `qk_guide_main_v1_seen`).
- Set to true when the main tour ends in ANY way: finished, Skip, or X.
- Starting a tour from the Help entry ignores the flag (always starts at step 1).
- The host tour has no seen flag.
- Auto-start waits until nothing else is on screen: splash, the signup completion
  screen, the notification primer, any sheet. If something is up, try again later
  (next appearance of Explore); never stack on top of a sheet.

## Overlay UI

- Dim the screen (black ~55%) with a rounded **cutout** around the target (8pt padding,
  12pt corner radius) and a 2pt brand-colour ring around the cutout.
- A **tooltip card** sits above or below the target, whichever has more room, with:
  - step indicator: "3 of 8" text + a row of dots (current dot filled/wider)
  - title (bold) and body (1–3 lines)
  - **X** close button top-trailing (accessibility label "Close guide")
  - footer: **Skip** (plain text, leading) · **Back** (only from step 2) · **Next**
    (primary; reads **Done** on the last step)
- A step with no target, or whose target is not on screen, shows the card **centred**,
  with no cutout.
- Tapping the cutout:
  - on a **tab/nav** target: perform that navigation (switch tab / open the page) and
    advance — this is the "tap the highlighted element to proceed" behaviour.
  - on any other target: same as Next (don't open the search sheet etc. under the tour).
- Tapping the dimmed area outside the cutout does nothing (X, Skip are always there).
- Animate the cutout moving between steps (~0.25s ease). Respect Reduce Motion.
- RTL in Arabic: mirror the layout; step text comes from localisation.
- Accessibility: the card is the focus target; read "Step 3 of 8. <title>. <body>".
  Web: Escape closes, focus trapped in the card, `role="dialog"`, `aria-modal`.

## Main tour

| # | id | anchor | title | body |
|---|----|--------|-------|------|
| 1 | welcome | — | Welcome to QuickIn | Here's a quick tour of the essentials. It takes under a minute. |
| 2 | search | Explore search bar | Find your stay | Search by destination, then pick your dates and number of guests. |
| 3 | regions | Explore region rail | Browse by region | Pick a region, then a resort, to narrow down the stays. |
| 4 | filters | filter / sort control | Filter and sort | Narrow results by price, property type and more. |
| 5 | wishlist | Wishlist tab (web: Saved link) | Save your favourites | Tap the heart on any stay to keep it here for later. |
| 6 | trips | Trips tab (web: Reservations link) | Your trips | Your bookings, payments and receipts all live here. |
| 7 | profile | Profile tab (web: account/menu) | Your profile | Edit your details, change language and currency, get help — and become a host. |
| 7′ | profile (signed out) | same anchor | Sign in to do more | Sign in or create an account to book, save stays and host. |
| 8 | finish | — | You're all set | Want to earn from your place? We can show you how to become a host. |
| 8′ | finish (already a host) | — | You're all set | Manage your listings anytime from your profile. |

Step 8 buttons: **Show me how** (ends this tour, marks it seen, starts the host tour) and
**Done**. Step 8′ shows only **Done**.

Steps 2–4 run on Explore; the tour switches to Explore first if it isn't there. Steps
5–7 highlight tabs; tapping the highlighted tab switches to it and advances. When the
tour ends, go back to Explore.

## Host tour

| # | id | anchor | title | body |
|---|----|--------|-------|------|
| 1 | host.intro | — | Become a host | List your place on QuickIn in three steps: apply, get approved, publish. |
| 2 | host.profileTab | Profile tab | Start from your profile | Everything about hosting starts on your profile. |
| 3 | host.becomeHost | "Become a host" card | Apply to host | Tap here to open the host application. |
| 3′ | (signed out) | sign-in button on Profile | Sign in first | You need a QuickIn account before you can apply to host. |
| 3″ | (application pending) | the pending status card | Application under review | We've got your application. You'll be notified as soon as our team decides. |
| 3‴ | (already a host) | host dashboard entry | You're already a host | Open your host dashboard to manage listings, prices and bookings. |
| 4 | host.requirements | — | What you'll need | (checklist below) |
| 5 | host.review | — | Review and approval | Our team checks your details and ID, usually within a day or two. You'll get a notification when you're approved. |
| 6 | host.afterApproval | — | After you're approved | Open the host dashboard from your profile to add a listing, set your prices and add a payout method to get paid. |

Requirements checklist (step 4), one row each with a check icon:
- Host type — individual, company or brokerage
- Full name and national ID number
- An Egyptian mobile number
- Your address
- Photos of the front and back of your ID (national ID, passport or residence permit)

Step 6 buttons: **Apply now** (only for a signed-in guest with no pending application —
opens the existing host application sheet/page) and **Done**. Signed out: **Sign in**
instead of Apply now.

Step 2 tapping the Profile tab switches to it and advances. Step 3 on a guest: tapping
the card = Next (do NOT open the application under the tour; "Apply now" at the end does).

## Help entry

On Profile (in the support/legal area), a row **App guide** — subtitle "Replay the tour
or learn how to host" — opening a small chooser:
- **Take the app tour** → main tour from step 1
- **How to become a host** → host tour from step 1

Web: the same chooser on `/account` and an "App guide" row in the header/mobile menu
(so signed-out visitors can reach it too).

## Arabic copy

| id | title | body |
|----|-------|------|
| welcome | أهلاً بك في QuickIn | جولة سريعة على أهم الأشياء، لن تستغرق أكثر من دقيقة. |
| search | ابحث عن إقامتك | ابحث بالوجهة، ثم اختر التواريخ وعدد الضيوف. |
| regions | تصفّح حسب المنطقة | اختر منطقة ثم منتجعاً لتضييق نطاق الأماكن. |
| filters | التصفية والترتيب | ضيّق النتائج حسب السعر ونوع العقار والمزيد. |
| wishlist | احفظ المفضلة | اضغط على القلب في أي مكان لتحتفظ به هنا لوقت لاحق. |
| trips | رحلاتك | حجوزاتك ومدفوعاتك وإيصالاتك كلها هنا. |
| profile | ملفك الشخصي | عدّل بياناتك، وغيّر اللغة والعملة، واحصل على المساعدة — وكن مضيفاً. |
| profile (signed out) | سجّل الدخول لتفعل المزيد | سجّل الدخول أو أنشئ حساباً لتحجز وتحفظ الأماكن وتستضيف. |
| finish | أنت جاهز الآن | هل تريد أن تربح من مكانك؟ يمكننا أن نريك كيف تصبح مضيفاً. |
| finish (host) | أنت جاهز الآن | أدِر إعلاناتك في أي وقت من ملفك الشخصي. |
| host.intro | كن مضيفاً | اعرض مكانك على QuickIn في ثلاث خطوات: قدّم طلبك، احصل على الموافقة، ثم انشر. |
| host.profileTab | ابدأ من ملفك الشخصي | كل ما يخص الاستضافة يبدأ من ملفك الشخصي. |
| host.becomeHost | قدّم طلب استضافة | اضغط هنا لفتح طلب الاستضافة. |
| (signed out) | سجّل الدخول أولاً | تحتاج إلى حساب على QuickIn قبل أن تقدّم طلب استضافة. |
| (pending) | طلبك قيد المراجعة | استلمنا طلبك، وسنخطرك فور أن يتخذ فريقنا قراره. |
| (host) | أنت مضيف بالفعل | افتح لوحة المضيف لإدارة إعلاناتك وأسعارك وحجوزاتك. |
| host.requirements | ما ستحتاجه | |
| host.review | المراجعة والموافقة | يراجع فريقنا بياناتك وهويتك، عادةً خلال يوم أو يومين. ستصلك إشعار عند الموافقة. |
| host.afterApproval | بعد الموافقة | افتح لوحة المضيف من ملفك الشخصي لتضيف إعلاناً وتحدد أسعارك وتضيف وسيلة استلام الأرباح. |

Checklist (ar): نوع المضيف — فرد أو شركة أو وساطة · الاسم الكامل والرقم القومي · رقم موبايل مصري · عنوانك · صور لوجه وظهر بطاقتك (بطاقة رقم قومي أو جواز سفر أو إقامة)

Buttons (en / ar): Next / التالي · Back / رجوع · Skip / تخطٍّ · Done / تم ·
Show me how / أرني كيف · Apply now / قدّم الآن · Sign in / تسجيل الدخول ·
Close guide / إغلاق الدليل · "%d of %d" / "%d من %d" ·
App guide / دليل التطبيق · Replay the tour or learn how to host / أعد الجولة أو تعرّف على طريقة الاستضافة ·
Take the app tour / خذ جولة في التطبيق · How to become a host / كيف تصبح مضيفاً

Other locales an app already ships (e.g. Android es/fr): translate in-language.

## Rules file + tests

Keep the step-list logic pure and unit-tested on each surface:
`steps(tour, signedIn, isHost, hostApplicationPending) -> [Step]`,
`shouldAutoStart(seen, blockingUIShown) -> Bool`, and the final-step buttons.
