import SwiftUI
import Combine

/// The two languages QuickIn ships with. Arabic flips the whole UI to RTL.
enum AppLang: String, CaseIterable, Identifiable {
    case en
    case ar

    var id: String { rawValue }

    /// The name shown in the language picker, each written in its own script.
    var nativeName: String {
        switch self {
        case .en: return "English"
        case .ar: return "العربية"
        }
    }

    /// BCP-47 identifier used to drive `Locale` (number formatting, etc.).
    var localeIdentifier: String {
        switch self {
        case .en: return "en_US"
        case .ar: return "ar"
        }
    }

    var layoutDirection: LayoutDirection {
        self == .ar ? .rightToLeft : .leftToRight
    }
}

/// App-wide language + RTL controller.
///
/// Holds the active `AppLang` (persisted to `UserDefaults`), exposes `t(_:)`
/// for key → string lookup against the in-file `en` / `ar` dictionaries, and is
/// injected at the app root via `.environmentObject`. Views observe it so the
/// whole tree re-renders (and flips RTL) the instant the language changes.
///
/// A shared singleton is also held in `L.shared` so non-`View` types — the
/// model enums whose `label` is shown in the UI (`ListingSort`,
/// `ListingsViewMode`, `BookingStatus`, `AccountRole`) — can localize without an
/// environment. SwiftUI still re-renders those because the views that read the
/// labels observe the same published `lang`.
@MainActor
final class LocalizationManager: ObservableObject {
    static let shared = LocalizationManager()

    private static let storageKey = "app_language"

    @Published var lang: AppLang {
        didSet {
            UserDefaults.standard.set(lang.rawValue, forKey: Self.storageKey)
        }
    }

    init() {
        if let saved = UserDefaults.standard.string(forKey: Self.storageKey),
           let parsed = AppLang(rawValue: saved) {
            lang = parsed
        } else {
            // First launch: follow the device language when it's Arabic,
            // otherwise default to English.
            let preferred = Locale.preferredLanguages.first ?? "en"
            lang = preferred.lowercased().hasPrefix("ar") ? .ar : .en
        }
    }

    /// Look up a localized string for `key` in the active language. Falls back to
    /// the English value, then the raw key, so a missing translation never shows
    /// blank.
    func t(_ key: String) -> String {
        let table = lang == .ar ? Strings.ar : Strings.en
        return table[key] ?? Strings.en[key] ?? key
    }
}

/// Tiny global accessor so value types (the model enums) can localize via
/// `L.t("key")` without an `@EnvironmentObject`. Views that display the result
/// still observe `LocalizationManager`, so they refresh on a language switch.
enum L {
    @MainActor static func t(_ key: String) -> String {
        LocalizationManager.shared.t(key)
    }
}

/// The string tables. Keys are dot-namespaced by screen. Arabic is
/// Egyptian-friendly Modern Standard Arabic.
enum Strings {
    static let en: [String: String] = [
        // Tabs — guest
        "tab.explore": "Explore",
        "tab.services": "Services",
        "tab.wishlist": "Wishlist",
        "notif.prompt.title": "Turn on notifications",
        "notif.prompt.body": "Get instant updates on your bookings, host messages, and new stays.",
        "notif.prompt.allow": "Allow notifications",
        "notif.prompt.later": "Not now",
        "notif.prompt.b1": "Instant booking & reservation updates",
        "notif.prompt.b2": "Messages from your host or guests",
        "notif.prompt.b3": "New stays, offers & price drops",
        "tab.trips": "Trips",
        "tab.profile": "Profile",
        // Tabs — host
        "tab.listings": "Listings",
        "tab.reservations": "Reservations",

        // Common buttons / words
        "common.search": "Search",
        "common.cancel": "Cancel",
        "common.save": "Save",
        "common.confirm": "Confirm",
        "common.clear": "Clear",
        "common.done": "Done",
        "common.retry": "Retry",
        "common.or": "or",
        "common.guest": "Guest",
        "common.host": "Host",
        "common.night": "night",
        "common.total": "Total",
        "common.past": "Past",

        // Auth
        "auth.tagline": "Boutique stays, booked in a tap.",
        "auth.signIn": "Sign In",
        "auth.signUp": "Sign Up",
        "auth.joinAs": "I want to join as",
        "auth.signInAs": "Sign in as",
        "auth.registerAs": "Register as %@",
        "auth.role.guest.subtitle": "Book stays",
        "auth.role.host.subtitle": "List a place",
        "auth.fullName": "Full name",
        "auth.fullName.placeholder": "Layla Hassan",
        "auth.email": "Email",
        "auth.password": "Password",
        "auth.forgotPassword": "Forgot password?",
        "auth.createAccount": "Create account",
        "signup.country": "Country you're from",
        "auth.continueWithGoogle": "Continue with Google",
        "auth.googleNote": "Add your Google iOS client id in Config.swift to enable Google sign-in",
        "auth.showPassword": "Show password",
        "auth.hidePassword": "Hide password",

        // Biometric sign-in (Face ID / Touch ID)
        "biometric.faceID": "Face ID",
        "biometric.touchID": "Touch ID",
        "biometric.generic": "Biometrics",
        // %@ = "Face ID" / "Touch ID"
        "biometric.signInWith": "Sign in with %@",
        "biometric.reason": "Sign in to QuickIn",
        "biometric.enableTitle": "Enable %@?",
        "biometric.enableMessage": "Sign in faster next time using %@ instead of your password.",
        "biometric.enable": "Enable %@",
        "biometric.notNow": "Not now",
        "biometric.failed": "Couldn't verify with %@. Sign in with your password.",
        "biometric.sessionExpired": "Your saved session expired. Sign in with your password.",
        "biometric.b1": "Sign in instantly — no password to type",
        "biometric.b2": "Stays on this device, never synced",
        "biometric.b3": "Turn it off anytime in Profile settings",

        // OTP
        "otp.title": "Verify your email",
        "otp.subtitle": "Enter the 6-digit code we sent to",
        "otp.verify": "Verify",
        "otp.didntGet": "Didn't get it?",
        "otp.resend": "Resend code",
        "otp.resent": "A new code is on its way.",

        // Password strength meter + requirements checklist
        "password.strength.label": "Password strength",
        "password.strength.weak": "Weak",
        "password.strength.fair": "Fair",
        "password.strength.good": "Good",
        "password.strength.strong": "Strong",
        "password.rule.length": "At least 8 characters",
        "password.rule.uppercase": "Uppercase letter",
        "password.rule.lowercase": "Lowercase letter",
        "password.rule.number": "Number",
        "password.rule.special": "Special character",

        // Sign-in CTA
        "cta.profile.title": "Sign in to manage your trips",
        "cta.profile.subtitle": "Save favorites, book stays, and keep your reservations in one place.",
        "cta.reservations.title": "Sign in to see your reservations",
        "cta.reservations.subtitle": "Your upcoming and past trips live here once you're signed in.",
        "cta.button": "Sign in or create account",

        // Explore / listings search
        "explore.title": "QuickIn",
        "explore.searchStays": "Search stays",
        "explore.whereTo": "Where to?",
        "explore.whereToPlaceholder": "Where to? (city or place)",
        "explore.anytime": "Anytime",
        "explore.addGuests": "Add guests",
        "explore.dates": "Dates",
        "explore.addDates": "Add dates",
        "explore.guests": "Guests",
        "explore.guest": "%lld guest",
        "explore.guests.plural": "%lld guests",
        "explore.collapse": "Collapse search",
        "explore.openProfile": "Open profile",
        "explore.signIn": "Sign in",
        "explore.region.all": "All",
        "explore.empty.noMatch": "No stays match",
        "explore.empty.nothing": "Nothing to show yet",
        "explore.empty.nothingMsg": "Nothing to show yet.",
        "explore.clearSearch": "Clear search",
        "explore.guestFavorite": "Guest favorite",

        // Discovery filters (Filters sheet + "Search this area")
        "filters.title": "Filters",
        "filters.button": "Filters",
        "filters.amenities": "Amenities",
        "filters.propertyType": "Property type",
        "filters.anyType": "Any type",
        "filters.clear": "Clear",
        "filters.apply": "Apply",
        "filters.applyCount": "Show stays",
        "filters.searchThisArea": "Search this area",
        "propertyType.Apartment": "Apartment",
        "propertyType.Chalet": "Chalet",
        "propertyType.House": "House",
        "propertyType.Villa": "Villa",

        // AI travel concierge
        "ai.title": "Travel concierge",
        "ai.subtitle": "Your AI guide to Egypt",
        "ai.button.label": "Ask the AI travel concierge",
        "ai.greeting.title": "Hi! I'm your travel concierge.",
        "ai.greeting.body": "Ask me anything about where to go, when to travel, and what to do across Egypt — beaches, family trips, diving and more.",
        "ai.input.placeholder": "Ask about your next trip…",
        "ai.send": "Send",
        "ai.typing": "Concierge is typing",
        "ai.suggest.beach": "Best beach for a calm weekend?",
        "ai.suggest.summer": "Where to go in summer?",
        "ai.suggest.family": "Family trip ideas",
        "ai.suggest.dive": "Where can I dive?",
        "ai.error.generic": "Something went wrong. Please try again.",
        "ai.error.unavailable": "The AI concierge isn't available right now. Please try again later.",
        "ai.error.signIn": "Sign in to use this feature.",

        // Section 10 — AI writer + natural-language search
        "ai.writeWithAI": "Write with AI",
        "ai.writing": "Writing…",
        "ai.writerHint": "Add a title, property type, and amenities first for the best result. You can edit the text after.",
        "ai.aiSearch": "Ask AI",
        "ai.aiSearchTitle": "Search with AI",
        "ai.aiSearchPlaceholder": "Try “sea-view villa in North Coast for 6”",
        "ai.searching": "Searching…",
        "ai.parsedFilters": "Understood as",
        "ai.search.empty": "No stays matched. Try rephrasing your search.",
        "ai.search.prompt": "Describe your perfect stay in your own words and let AI find it.",
        "ai.search.clear": "Clear AI search",
        "ai.search.resultsCount": "%@ stays found",

        // Section 10 — Host analytics
        "analytics.title": "Analytics",
        "analytics.subtitle": "Your performance at a glance",
        "analytics.listings": "Listings",
        "analytics.bookings": "Total bookings",
        "analytics.paidBookings": "Paid bookings",
        "analytics.cancelled": "Cancelled",
        "analytics.revenue": "Revenue",
        "analytics.avgRating": "Avg. rating",
        "analytics.conversion": "Conversion",
        "analytics.reviews": "%@ reviews",
        "analytics.monthlyTrend": "Monthly trend",
        "analytics.topListings": "Top listings",
        "analytics.bookingsCount": "%@ bookings",
        "analytics.noData": "No analytics yet. Once guests book your places, your stats appear here.",

        // View mode + sort
        "viewmode.list": "List",
        "viewmode.map": "Map",
        "sort.recommended": "Recommended",
        "sort.priceAsc": "Price ↑",
        "sort.priceDesc": "Price ↓",
        "sort.newest": "Newest",

        // Listing detail
        "detail.about": "About this place",
        "detail.offers": "What this place offers",
        "detail.reserveStay": "Reserve your stay",
        "detail.dates": "Dates",
        "detail.reserve": "Reserve",
        "detail.signInToReserve": "Sign in to reserve",
        "detail.perNight": "/ night",
        "detail.spec.guests": "guests",
        "detail.spec.bedrooms": "bedrooms",
        "detail.spec.beds": "beds",
        "detail.spec.baths": "baths",
        "detail.requestSent": "Request sent",
        "detail.reservationConfirmed": "Reservation confirmed",
        "detail.hostedBy": "Hosted by %@",
        "detail.moreFromHost": "More from this host",

        // Host profile (public)
        "host.profile.viewProfile": "View host profile",
        "host.profile.openHint": "Opens the host's profile",
        "host.profile.subtitle": "Host on QuickIn",
        "host.profile.about": "About the host",
        "host.profile.rating": "Host rating",
        "host.profile.memberSince": "Member since",
        "host.profile.listings": "Their listings",
        "host.profile.reviews": "Guest reviews",
        "host.profile.reviews.empty": "No reviews yet for this host's places.",

        // Wishlist toast
        "wishlist.added": "Added to wishlist",
        "wishlist.removed": "Removed from wishlist",

        // Payment (mock)
        "common.nights": "nights",
        "pay.title": "Payment",
        "pay.subtitle": "Pay securely to confirm your reservation.",
        "pay.serviceFee": "Service fee (10%)",
        "pay.payAmount": "Pay EGP %@",
        "pay.payNow": "Pay now",
        "pay.demoNote": "Demo payment — no real charge",
        "pay.processing": "Processing…",
        "pay.confirmed": "Booking confirmed & paid",
        "pay.reference": "Reference",
        "pay.totalPaid": "EGP %@ paid",
        "pay.continue": "Continue to reservation",
        // Payment method selector (card +5% / bank transfer −5%)
        "pay.method.title": "Payment method",
        "pay.method.card": "Card (+5%)",
        "pay.method.bank": "Bank transfer (−5%)",
        "pay.method.cardSurcharge": "Card surcharge (5%)",
        "pay.method.bankDiscount": "Bank transfer discount (5%)",

        // Stay pass (QR + host notes)
        "pass.reservationCode": "Reservation code",
        "pass.scanOrTap": "Scan or tap to open your stay pass",
        "pass.fromHost": "From your host",
        "pass.noHostNotes": "Your host hasn't added any notes yet.",
        "pass.hostNotes.title": "Notes for your guest",
        "pass.hostNotes.subtitle": "Check-in tips, Wi-Fi, directions — your guest sees this.",
        "pass.hostNotes.placeholder": "Add check-in details, the Wi-Fi password, parking, or a warm welcome…",
        "pass.hostNotes.saved": "Saved",

        // Reviews
        "reviews.new": "New",
        "reviews.title": "Reviews",
        "reviews.count": "%lld review",
        "reviews.count.plural": "%lld reviews",
        "reviews.empty": "No reviews yet. Be the first to stay and share your experience.",
        "reviews.aGuest": "A guest",
        "reviews.leave.title": "Leave a review",
        "reviews.leave.subtitle": "Tell other guests about your stay.",
        "reviews.leave.prompt": "How was your stay? Tap to rate.",
        "reviews.leave.commentLabel": "Your review",
        "reviews.leave.commentPlaceholder": "Share a few words about your stay (optional)…",
        "reviews.leave.submit": "Submit review",
        "reviews.leave.thanks": "Thanks for your review!",
        "reviews.leave.thanksSubtitle": "Your feedback helps other guests.",
        // Review photos
        "reviews.addPhotos": "Add photos",
        "reviews.photos": "Photos",
        "reviews.removePhoto": "Remove photo",
        // Two-way reviews
        "reviews.aHost": "A host",
        "reviews.submit": "Submit",
        "reviews.yourRating": "Your rating",
        "reviews.guestCommentPlaceholder": "How was hosting this guest? (optional)…",
        "reviews.reviewGuests": "Review your guests",
        "reviews.reviewGuests.subtitle": "Rate the guests who stayed with you.",
        "reviews.reviewGuests.empty": "No guests to review yet. They'll appear here after their stay ends.",
        "reviews.signInHost": "Sign in as a host to review your guests.",
        "reviews.aboutYou": "Reviews about you",
        "reviews.guestRating": "Guest rating",
        "reviews.noGuestReviews": "No reviews from hosts yet. They'll appear here after your stays.",

        // Saved / wishlist
        "saved.title": "Saved",
        "saved.subtitle": "Your favorite stays & experiences.",
        "saved.stays": "STAYS",
        "saved.services": "EXPERIENCES",
        "saved.empty.title": "Nothing saved yet",
        "saved.empty.msg": "Tap the heart on any stay or experience to save it here.",
        "saved.error.title": "Couldn't load saved items",
        "saved.signedOut.title": "Sign in to view your wishlist",
        "saved.signInPrompt": "Sign in to see your saved items",

        // Brand travel header — eyebrows + subtitles per root tab
        "home.eyebrow": "Discover · Stay · Explore",
        "home.subtitle": "Boutique stays across Egypt.",
        "reservations.eyebrow": "Your journeys",
        "reservations.subtitle": "Every trip you've booked, in one place.",
        "profile.eyebrow": "Your account",
        "profile.subtitle": "Profile, settings & language.",
        "saved.eyebrow": "Your collection",
        "notifications.title": "Notifications",

        // Services
        "services.title": "Services",
        "services.eyebrow": "North Coast · Egypt",
        "services.subtitle": "Add experiences to your stay — on the water, in the sand, at your table.",
        "services.perExperience": "per experience",
        "services.hostedBy": "Hosted by %@",
        "services.empty.nothing": "Nothing to show yet",
        "services.empty.nothingMsg": "No experiences to show yet.",

        // Reservations
        "reservations.title": "Reservations",
        "reservations.mySubscriptions": "My subscriptions",
        "reservations.mySubscriptions.subtitle": "Track the experiences you've requested.",
        "reservations.empty.title": "No reservations yet",
        "reservations.empty.msg": "When you book a stay, it'll show up here. Pull down to refresh.",
        "reservations.error.title": "Couldn't load reservations",
        "reservations.error.session": "We couldn't load your trips. Pull to refresh to try again.",
        "reservations.reservation": "Reservation",

        // Booking status
        "status.pending": "Pending",
        "status.confirmed": "Confirmed",
        "status.rejected": "Rejected",
        "status.cancelled": "Cancelled",
        "status.completed": "Completed",

        // Profile
        "profile.title": "Profile",
        "profile.editProfile": "Edit profile",
        "profile.editProfile.subtitle": "Update your photo, bio, name & details.",
        "profile.hostDashboard": "Host dashboard",
        "profile.hostDashboard.subtitle": "Add listings & manage reservation requests.",
        "profile.logout": "Log out",
        "profile.language": "Language",

        // Profile settings (edit profile)
        "settings.fullName": "Full name",
        "settings.fullName.placeholder": "Your full name",
        "settings.age": "Age",
        "settings.age.placeholder": "e.g. 29",
        "settings.id": "ID / Passport",
        "settings.id.placeholder": "ID or passport number",
        "settings.phone": "Phone",
        "settings.phone.placeholder": "Phone number",
        "settings.bio": "Bio",
        "settings.bio.placeholder": "Tell guests a little about yourself…",
        "settings.country": "Country",
        "settings.country.placeholder": "Select your country",
        "settings.photo": "Add photo",
        "settings.changePhoto": "Change photo",
        "settings.photo.error": "Couldn't use that photo. Try another.",
        "settings.saveChanges": "Save changes",
        "settings.saved": "Saved",
        "settings.changePassword": "Change password",
        "settings.currentPassword": "Current password",
        "settings.newPassword": "New password",
        "settings.newPassword.placeholder": "At least 8 characters",
        "settings.updatePassword": "Update password",
        "settings.passwordUpdated": "Password updated.",
        "settings.security": "Security",
        "settings.biometric.subtitle": "Skip your password next time you sign in.",

        // Host tabs
        "host.listings.title": "Listings",
        "host.yourListings": "Your listings",
        "host.addListing": "Add a listing",
        "host.addListing.subtitle": "List a new place for guests to book.",
        "host.loadingListings": "Loading your listings…",
        "host.listings.empty": "You haven't published a listing yet. Tap “Add a listing” to get started.",
        "host.loadingRequests": "Loading requests…",
        "host.requests.empty": "No requests yet. They'll appear here when a guest books one of your places.",
        "host.stats.thisMonth": "Your place",
        "host.stats.listings": "Listings",
        "host.stats.pending": "Pending",
        "host.stats.requests": "Requests",
        "host.action.confirm": "Confirm",
        "host.action.reject": "Reject",
        "host.message": "Message",
        "host.status.live": "Live",

        // Listing approval queue + ownership document
        "approval.pending": "Pending review",
        "approval.approved": "Approved",
        "approval.rejected": "Rejected",
        "approval.ownershipDoc": "Ownership document",
        "approval.ownershipIntro": "Upload a document that proves you own or are authorised to list this place (e.g. a title deed or utility bill). Our team reviews it before your listing goes live.",
        "approval.uploadDoc": "Upload ownership document",
        "approval.changeDoc": "Change",
        "approval.docAttached": "Document attached",
        "approval.docMissing": "Not added",
        "approval.reupload": "Re-upload ownership document",
        "approval.reviewNotice": "Your listing won't be public right away. After you submit, our team reviews your ownership document and approves the listing.",
        "approval.submitForReview": "Submit for review",
        "approval.submittedForReview": "Submitted for review",

        // Availability (live calendar + host block/unblock)
        "availability.unavailable": "Unavailable",
        "availability.manage": "Manage availability",
        "availability.blockDates": "Block dates",
        "availability.blocked": "Blocked dates",
        "availability.booked": "Booked",
        "availability.addBlock": "Block dates",
        "availability.remove": "Remove",
        "availability.noBlocks": "No blocked dates yet. Pick a range above to make dates unavailable to guests.",
        "availability.pickRange": "Select dates to block",

        // Cancellation policy + guest cancel
        "cancel.policy": "Cancellation policy",
        "cancel.policyLabel": "Policy",
        "cancel.flexible": "Flexible",
        "cancel.moderate": "Moderate",
        "cancel.strict": "Strict",
        "cancel.flexibleDesc": "Full refund if you cancel at least 1 day before check-in. After that, no refund.",
        "cancel.moderateDesc": "Full refund if you cancel at least 5 days before check-in. After that, 50% refund.",
        "cancel.strictDesc": "50% refund if you cancel at least 7 days before check-in. After that, no refund.",
        "cancel.choosePolicy": "Cancellation policy",
        "cancel.choosePolicyHint": "Choose how flexible cancellations are for guests. You can change this anytime.",
        "cancel.savePolicy": "Save policy",
        "cancel.policySaved": "Policy saved",
        "cancel.cancelReservation": "Cancel reservation",
        "cancel.refundQuote": "Refund summary",
        "cancel.youWillReceive": "You'll receive",
        "cancel.refundPercentLabel": "Refund (%@%% of total)",
        "cancel.keepReservation": "Keep reservation",
        "cancel.confirm": "Confirm cancellation",
        "cancel.confirmTitle": "Cancel this reservation?",
        "cancel.confirmBody": "Based on the %1$@ policy and your check-in date, here's what you'll get back.",
        "cancel.noRefund": "This cancellation isn't eligible for a refund.",
        "cancel.cancelled": "Reservation cancelled",
        "cancel.cancelledBody": "This reservation has been cancelled.",
        "cancel.refunded": "Refunded",
        "cancel.daysUntil": "%@ days until check-in",
        "cancel.cannotCancel": "This reservation can no longer be cancelled.",

        // Growth — length-of-stay discounts (host)
        "growth.lengthOfStayDiscounts": "Length-of-stay discounts",
        "growth.discountsIntro": "Offer a lower nightly rate for longer stays. Discounts apply automatically at checkout.",
        "growth.discountsHint": "Set a discount for weekly and monthly stays. You can change these anytime.",
        "growth.weeklyDiscount": "Weekly discount",
        "growth.monthlyDiscount": "Monthly discount",
        "growth.weeklyHint": "Off stays of 7+ nights",
        "growth.monthlyHint": "Off stays of 28+ nights",
        "growth.weeklyShort": "Weekly −%@%%",
        "growth.monthlyShort": "Monthly −%@%%",
        "growth.discountOff": "%@%% off",
        "growth.saveDiscounts": "Save discounts",
        "growth.discountsSaved": "Discounts saved",
        "growth.noDiscounts": "None",
        "growth.noDiscountsYet": "No discounts yet",

        // Seasonal / variable pricing (host + guest)
        "pricing.seasonal": "Seasonal pricing",
        "pricing.seasonalIntro": "Charge more on weekends or in peak months. Leave a field blank to use your base nightly price.",
        "pricing.seasonalHint": "Set a weekend rate and per-month rates. Blank months keep your base nightly price.",
        "pricing.weekendPrice": "Weekend price",
        "pricing.weekendHint": "Applied on Fri + Sat nights",
        "pricing.monthlyPrices": "Monthly prices",
        "pricing.weekendSummary": "Weekend %@",
        "pricing.monthsSummary": "%@ months",
        "pricing.noSeasonalYet": "No seasonal rates yet",
        "pricing.save": "Save pricing",
        "pricing.saved": "Pricing saved",
        "pricing.seasonalNote": "Weekend & seasonal rates apply",
        "pricing.perNightAvg": "avg / night",
        "pricing.night": "%@ night",
        "pricing.nights": "%@ nights",

        // Growth — promo codes (checkout)
        "promo.code": "Promo code",
        "promo.placeholder": "Enter a code",
        "promo.apply": "Apply",
        "promo.remove": "Remove",
        "promo.applied": "Code applied — EGP %@ off",
        "promo.invalid": "That code isn't valid.",
        "promo.discount": "Promo discount",

        // Growth — referrals
        "referral.title": "Refer friends",
        "referral.subtitle": "Share your code and earn rewards",
        "referral.heroTitle": "Invite friends, earn rewards",
        "referral.heroBody": "Share your referral code. When a friend signs up with it, you both get rewarded.",
        "referral.yourCode": "Your referral code",
        "referral.copy": "Copy",
        "referral.copied": "Copied",
        "referral.invited": "Friends invited",
        "referral.reward": "Total reward",
        "referral.friendsTitle": "Friends who joined",
        "referral.empty": "No referrals yet. Share your code to get started.",
        "referral.aFriend": "A friend",
        "referral.signupField": "Referral code (optional)",
        "referral.signupPlaceholder": "Enter a friend's code",

        // Share + deep links
        "share.label": "Share",
        "common.close": "Close",
        "share.listing.title": "%@ — QuickIn",
        "share.listing.message": "Check out this stay on QuickIn.",
        "share.service.title": "%@ — QuickIn",
        "share.service.message": "Check out this experience on QuickIn.",
        "share.reservation.title": "%@ — QuickIn",
        "share.reservation.titleFallback": "My reservation — QuickIn",
        "share.reservation.message": "Here's my QuickIn reservation.",

        // Trust & safety — identity verification
        "trust.verify": "Verify your identity",
        "trust.verifyIntro": "Add a photo of your ID to earn a verified badge and build trust with hosts and guests.",
        "trust.uploadId": "Upload ID photo",
        "trust.uploadError": "We couldn't process that photo. Please try another.",
        "trust.pending": "Your ID is under review. This usually takes a little while.",
        "trust.verified": "Your identity is verified. Thanks for helping keep QuickIn safe.",
        "trust.rejected": "We couldn't verify your last submission. Please upload a clearer photo of your ID.",
        "trust.status.unverified": "Unverified",
        "trust.status.pending": "Pending",
        "trust.status.verified": "Verified",
        "trust.status.rejected": "Rejected",

        // Trust & safety — badges
        "badge.verified": "Verified",
        "badge.verifiedHost": "Verified host",
        "badge.superhost": "Superhost",
        "badge.newHost": "New host",

        // Trust & safety — reporting
        "report.report": "Report",
        "report.reportListing": "Report this listing",
        "report.reason": "Why are you reporting this?",
        "report.reason.inaccurate": "Inaccurate listing",
        "report.reason.scam": "Scam or fraud",
        "report.reason.offensive": "Offensive content",
        "report.reason.other": "Something else",
        "report.details": "Add details (optional)",
        "report.details.placeholder": "Tell us what happened…",
        "report.submit": "Submit report",
        "report.thanks": "Thanks for letting us know",
        "report.thanks.body": "Our team will review your report and take action if needed.",

        // Money (Section 9) — host earnings / payouts
        "money.earnings": "Earnings",
        "money.earnings.subtitle": "Your payouts & pending balance",
        "money.totalEarned": "Total earned",
        "money.paidOut": "Paid out",
        "money.pending": "Pending",
        "money.payouts": "Payouts",
        "money.net": "Net",
        "money.bookingsCount": "Across %@ bookings",
        "money.statusPaidOut": "Paid out",
        "money.statusUpcoming": "Upcoming",
        "money.noEarnings": "No earnings yet. Your payouts will appear here once guests book and pay.",
        "money.signInHost": "Sign in as a host to see your earnings.",
        // Money — guest receipts
        "money.receipts": "Receipts",
        "money.receipts.subtitle": "Your paid bookings, itemized",
        "money.receipt": "Receipt",
        "money.subtotal": "Subtotal",
        "money.serviceFee": "Service fee",
        "money.methodFee": "Payment method fee",
        "money.promoDiscount": "Promo discount",
        "money.total": "Total",
        "money.paidOn": "Paid %@",
        "money.noReceipts": "No receipts yet. Paid bookings will show up here.",
        "money.signIn": "Sign in to see your receipts.",
        // Money — multi-currency
        "money.currency": "Currency",
        "money.currency.subtitle": "Choose your display currency",
        "money.currencyNote": "Prices show in your chosen currency. Bookings are always charged in EGP.",
        "currency.egp": "Egyptian Pound",
        "currency.usd": "US Dollar",
        "currency.eur": "Euro",
        "currency.gbp": "British Pound",
        "currency.sar": "Saudi Riyal",
        "currency.aed": "UAE Dirham",
    ]

    static let ar: [String: String] = [
        // Tabs — guest
        "tab.explore": "استكشف",
        "tab.services": "الخدمات",
        "tab.wishlist": "المفضلة",
        "notif.prompt.title": "فعّل الإشعارات",
        "notif.prompt.body": "تابع حجوزاتك ورسائل المضيف والأماكن الجديدة لحظة بلحظة.",
        "notif.prompt.allow": "السماح بالإشعارات",
        "notif.prompt.later": "ليس الآن",
        "notif.prompt.b1": "تحديثات فورية للحجوزات والتأكيدات",
        "notif.prompt.b2": "رسائل من المضيف أو الضيوف",
        "notif.prompt.b3": "أماكن جديدة وعروض وتخفيضات",
        "tab.trips": "رحلاتي",
        "tab.profile": "حسابي",
        // Tabs — host
        "tab.listings": "إعلاناتي",
        "tab.reservations": "الحجوزات",

        // Common buttons / words
        "common.search": "بحث",
        "common.cancel": "إلغاء",
        "common.save": "حفظ",
        "common.confirm": "تأكيد",
        "common.clear": "مسح",
        "common.done": "تم",
        "common.retry": "إعادة المحاولة",
        "common.or": "أو",
        "common.guest": "ضيف",
        "common.host": "مضيف",
        "common.night": "الليلة",
        "common.total": "الإجمالي",
        "common.past": "السابقة",

        // Auth
        "auth.tagline": "إقامات مميزة، تحجزها بلمسة.",
        "auth.signIn": "تسجيل الدخول",
        "auth.signUp": "إنشاء حساب",
        "auth.joinAs": "أريد الانضمام كـ",
        "auth.signInAs": "سجّل الدخول كـ",
        "auth.registerAs": "سجّل كـ %@",
        "auth.role.guest.subtitle": "احجز إقامات",
        "auth.role.host.subtitle": "أضف مكانك",
        "auth.fullName": "الاسم الكامل",
        "auth.fullName.placeholder": "ليلى حسن",
        "auth.email": "البريد الإلكتروني",
        "auth.password": "كلمة المرور",
        "auth.forgotPassword": "نسيت كلمة المرور؟",
        "auth.createAccount": "إنشاء الحساب",
        "signup.country": "البلد الذي تنتمي إليه",
        "auth.continueWithGoogle": "المتابعة عبر Google",
        "auth.googleNote": "أضف معرّف عميل Google لنظام iOS في Config.swift لتفعيل تسجيل الدخول عبر Google",
        "auth.showPassword": "إظهار كلمة المرور",
        "auth.hidePassword": "إخفاء كلمة المرور",

        // Biometric sign-in (Face ID / Touch ID)
        "biometric.faceID": "بصمة الوجه",
        "biometric.touchID": "بصمة الإصبع",
        "biometric.generic": "السمات الحيوية",
        // %@ = "بصمة الوجه" / "بصمة الإصبع"
        "biometric.signInWith": "تسجيل الدخول بـ%@",
        "biometric.reason": "تسجيل الدخول إلى QuickIn",
        "biometric.enableTitle": "تفعيل %@؟",
        "biometric.enableMessage": "سجّل الدخول بسرعة في المرة القادمة باستخدام %@ بدلاً من كلمة المرور.",
        "biometric.enable": "تفعيل %@",
        "biometric.notNow": "ليس الآن",
        "biometric.failed": "تعذّر التحقق بـ%@. سجّل الدخول بكلمة المرور.",
        "biometric.sessionExpired": "انتهت صلاحية جلستك المحفوظة. سجّل الدخول بكلمة المرور.",
        "biometric.b1": "سجّل الدخول فورًا — دون كتابة كلمة المرور",
        "biometric.b2": "يبقى على هذا الجهاز فقط، ولا يُزامَن",
        "biometric.b3": "يمكنك إيقافه في أي وقت من إعدادات الحساب",

        // OTP
        "otp.title": "تأكيد بريدك الإلكتروني",
        "otp.subtitle": "أدخل الرمز المكوّن من 6 أرقام الذي أرسلناه إلى",
        "otp.verify": "تأكيد",
        "otp.didntGet": "لم يصلك الرمز؟",
        "otp.resend": "إعادة إرسال الرمز",
        "otp.resent": "تم إرسال رمز جديد.",

        // Password strength meter + requirements checklist
        "password.strength.label": "قوة كلمة المرور",
        "password.strength.weak": "ضعيفة",
        "password.strength.fair": "مقبولة",
        "password.strength.good": "جيدة",
        "password.strength.strong": "قوية",
        "password.rule.length": "٨ أحرف على الأقل",
        "password.rule.uppercase": "حرف كبير",
        "password.rule.lowercase": "حرف صغير",
        "password.rule.number": "رقم",
        "password.rule.special": "رمز خاص",

        // Sign-in CTA
        "cta.profile.title": "سجّل الدخول لإدارة رحلاتك",
        "cta.profile.subtitle": "احفظ المفضلة، واحجز الإقامات، واحتفظ بكل حجوزاتك في مكان واحد.",
        "cta.reservations.title": "سجّل الدخول لعرض حجوزاتك",
        "cta.reservations.subtitle": "رحلاتك القادمة والسابقة تظهر هنا بمجرد تسجيل الدخول.",
        "cta.button": "تسجيل الدخول أو إنشاء حساب",

        // Explore / listings search
        "explore.title": "QuickIn",
        "explore.searchStays": "ابحث عن إقامات",
        "explore.whereTo": "إلى أين؟",
        "explore.whereToPlaceholder": "إلى أين؟ (مدينة أو مكان)",
        "explore.anytime": "أي وقت",
        "explore.addGuests": "أضف الضيوف",
        "explore.dates": "التواريخ",
        "explore.addDates": "أضف التواريخ",
        "explore.guests": "الضيوف",
        "explore.guest": "%lld ضيف",
        "explore.guests.plural": "%lld ضيوف",
        "explore.collapse": "إغلاق البحث",
        "explore.openProfile": "فتح الحساب",
        "explore.signIn": "تسجيل الدخول",
        "explore.region.all": "الكل",
        "explore.empty.noMatch": "لا توجد إقامات مطابقة",
        "explore.empty.nothing": "لا يوجد ما نعرضه بعد",
        "explore.empty.nothingMsg": "لا يوجد ما نعرضه بعد.",
        "explore.clearSearch": "مسح البحث",
        "explore.guestFavorite": "المفضّلة لدى الضيوف",

        // Discovery filters (Filters sheet + "Search this area")
        "filters.title": "عوامل التصفية",
        "filters.button": "تصفية",
        "filters.amenities": "وسائل الراحة",
        "filters.propertyType": "نوع العقار",
        "filters.anyType": "أي نوع",
        "filters.clear": "مسح",
        "filters.apply": "تطبيق",
        "filters.applyCount": "عرض الإقامات",
        "filters.searchThisArea": "ابحث في هذه المنطقة",
        "propertyType.Apartment": "شقة",
        "propertyType.Chalet": "شاليه",
        "propertyType.House": "منزل",
        "propertyType.Villa": "فيلا",

        // AI travel concierge
        "ai.title": "مرشد السفر",
        "ai.subtitle": "دليلك الذكي في مصر",
        "ai.button.label": "اسأل مرشد السفر الذكي",
        "ai.greeting.title": "أهلًا! أنا مرشد السفر الخاص بك.",
        "ai.greeting.body": "اسألني عن أي شيء — إلى أين تذهب، ومتى تسافر، وماذا تفعل في أنحاء مصر: الشواطئ، ورحلات العائلة، والغوص والمزيد.",
        "ai.input.placeholder": "اسأل عن رحلتك القادمة…",
        "ai.send": "إرسال",
        "ai.typing": "المرشد يكتب",
        "ai.suggest.beach": "أفضل شاطئ لعطلة هادئة؟",
        "ai.suggest.summer": "إلى أين أذهب في الصيف؟",
        "ai.suggest.family": "أفكار لرحلة عائلية",
        "ai.suggest.dive": "أين يمكنني الغوص؟",
        "ai.error.generic": "حدث خطأ ما. من فضلك حاول مرة أخرى.",
        "ai.error.unavailable": "مرشد السفر الذكي غير متاح حاليًا. حاول مرة أخرى لاحقًا.",
        "ai.error.signIn": "سجّل الدخول لاستخدام هذه الميزة.",

        // القسم 10 — كاتب الوصف الذكي والبحث بالّلغة الطبيعية
        "ai.writeWithAI": "اكتب بالذكاء الاصطناعي",
        "ai.writing": "جارٍ الكتابة…",
        "ai.writerHint": "أضِف عنوانًا ونوع العقار والمرافق أولًا للحصول على أفضل نتيجة. يمكنك تعديل النص بعد ذلك.",
        "ai.aiSearch": "اسأل الذكاء",
        "ai.aiSearchTitle": "ابحث بالذكاء الاصطناعي",
        "ai.aiSearchPlaceholder": "جرّب «فيلا بإطلالة بحرية في الساحل الشمالي لـ٦ أشخاص»",
        "ai.searching": "جارٍ البحث…",
        "ai.parsedFilters": "فُهِم كالتالي",
        "ai.search.empty": "لا توجد أماكن مطابقة. حاول إعادة صياغة بحثك.",
        "ai.search.prompt": "صِف إقامتك المثالية بكلماتك ودع الذكاء الاصطناعي يجدها.",
        "ai.search.clear": "مسح البحث الذكي",
        "ai.search.resultsCount": "تم العثور على %@ مكان",

        // القسم 10 — تحليلات المضيف
        "analytics.title": "التحليلات",
        "analytics.subtitle": "أداؤك في لمحة",
        "analytics.listings": "العقارات",
        "analytics.bookings": "إجمالي الحجوزات",
        "analytics.paidBookings": "الحجوزات المدفوعة",
        "analytics.cancelled": "الملغاة",
        "analytics.revenue": "الإيرادات",
        "analytics.avgRating": "متوسط التقييم",
        "analytics.conversion": "معدل التحويل",
        "analytics.reviews": "%@ تقييم",
        "analytics.monthlyTrend": "الاتجاه الشهري",
        "analytics.topListings": "أفضل العقارات",
        "analytics.bookingsCount": "%@ حجز",
        "analytics.noData": "لا توجد تحليلات بعد. بمجرد أن يحجز الضيوف أماكنك، ستظهر إحصاءاتك هنا.",

        // View mode + sort
        "viewmode.list": "قائمة",
        "viewmode.map": "خريطة",
        "sort.recommended": "موصى به",
        "sort.priceAsc": "السعر ↑",
        "sort.priceDesc": "السعر ↓",
        "sort.newest": "الأحدث",

        // Listing detail
        "detail.about": "عن هذا المكان",
        "detail.offers": "ما يوفّره هذا المكان",
        "detail.reserveStay": "احجز إقامتك",
        "detail.dates": "التواريخ",
        "detail.reserve": "احجز",
        "detail.signInToReserve": "سجّل الدخول للحجز",
        "detail.perNight": "/ الليلة",
        "detail.spec.guests": "ضيوف",
        "detail.spec.bedrooms": "غرف نوم",
        "detail.spec.beds": "أسرّة",
        "detail.spec.baths": "حمّامات",
        "detail.requestSent": "تم إرسال الطلب",
        "detail.reservationConfirmed": "تم تأكيد الحجز",
        "detail.hostedBy": "يستضيفك %@",
        "detail.moreFromHost": "المزيد من هذا المضيف",

        // Host profile (public)
        "host.profile.viewProfile": "عرض ملف المضيف",
        "host.profile.openHint": "يفتح ملف المضيف",
        "host.profile.subtitle": "مضيف على QuickIn",
        "host.profile.about": "عن المضيف",
        "host.profile.rating": "تقييم المضيف",
        "host.profile.memberSince": "عضو منذ",
        "host.profile.listings": "أماكنه",
        "host.profile.reviews": "تقييمات الضيوف",
        "host.profile.reviews.empty": "لا توجد تقييمات لأماكن هذا المضيف بعد.",

        // Wishlist toast
        "wishlist.added": "تمت الإضافة إلى المفضلة",
        "wishlist.removed": "تمت الإزالة من المفضلة",

        // Payment (mock)
        "common.nights": "ليالٍ",
        "pay.title": "الدفع",
        "pay.subtitle": "ادفع بأمان لتأكيد حجزك.",
        "pay.serviceFee": "رسوم الخدمة (10%)",
        "pay.payAmount": "ادفع %@ ج.م",
        "pay.payNow": "ادفع الآن",
        "pay.demoNote": "دفعة تجريبية — لا يوجد خصم فعلي",
        "pay.processing": "جارٍ المعالجة…",
        "pay.confirmed": "تم تأكيد الحجز والدفع",
        "pay.reference": "الرقم المرجعي",
        "pay.totalPaid": "تم دفع %@ ج.م",
        "pay.continue": "المتابعة إلى الحجز",
        // Payment method selector (card +5% / bank transfer −5%)
        "pay.method.title": "طريقة الدفع",
        "pay.method.card": "بطاقة (+٥٪)",
        "pay.method.bank": "تحويل بنكي (−٥٪)",
        "pay.method.cardSurcharge": "رسوم البطاقة (٥٪)",
        "pay.method.bankDiscount": "خصم التحويل البنكي (٥٪)",

        // Stay pass (QR + host notes)
        "pass.reservationCode": "رمز الحجز",
        "pass.scanOrTap": "امسح أو اضغط لفتح تصريح إقامتك",
        "pass.fromHost": "من مضيفك",
        "pass.noHostNotes": "لم يضف مضيفك أي ملاحظات بعد.",
        "pass.hostNotes.title": "ملاحظات لضيفك",
        "pass.hostNotes.subtitle": "نصائح الوصول، وكلمة الواي فاي، والاتجاهات — يراها ضيفك.",
        "pass.hostNotes.placeholder": "أضف تفاصيل الوصول، وكلمة مرور الواي فاي، ومواقف السيارات، أو ترحيبًا لطيفًا…",
        "pass.hostNotes.saved": "تم الحفظ",

        // Reviews
        "reviews.new": "جديد",
        "reviews.title": "التقييمات",
        "reviews.count": "%lld تقييم",
        "reviews.count.plural": "%lld تقييمات",
        "reviews.empty": "لا توجد تقييمات بعد. كن أول من يقيم بعد إقامته.",
        "reviews.aGuest": "أحد الضيوف",
        "reviews.leave.title": "اكتب تقييمًا",
        "reviews.leave.subtitle": "شارك الضيوف الآخرين تجربتك في الإقامة.",
        "reviews.leave.prompt": "كيف كانت إقامتك؟ اضغط للتقييم.",
        "reviews.leave.commentLabel": "تقييمك",
        "reviews.leave.commentPlaceholder": "شارك بعض الكلمات عن إقامتك (اختياري)…",
        "reviews.leave.submit": "إرسال التقييم",
        "reviews.leave.thanks": "شكرًا على تقييمك!",
        "reviews.leave.thanksSubtitle": "ملاحظاتك تساعد بقية الضيوف.",
        // Review photos
        "reviews.addPhotos": "أضف صورًا",
        "reviews.photos": "الصور",
        "reviews.removePhoto": "إزالة الصورة",
        // Two-way reviews
        "reviews.aHost": "أحد المضيفين",
        "reviews.submit": "إرسال",
        "reviews.yourRating": "تقييمك",
        "reviews.guestCommentPlaceholder": "كيف كانت استضافة هذا الضيف؟ (اختياري)…",
        "reviews.reviewGuests": "قيّم ضيوفك",
        "reviews.reviewGuests.subtitle": "قيّم الضيوف الذين أقاموا معك.",
        "reviews.reviewGuests.empty": "لا يوجد ضيوف لتقييمهم بعد. سيظهرون هنا بعد انتهاء إقامتهم.",
        "reviews.signInHost": "سجّل الدخول كمضيف لتقييم ضيوفك.",
        "reviews.aboutYou": "التقييمات عنك",
        "reviews.guestRating": "تقييم الضيف",
        "reviews.noGuestReviews": "لا توجد تقييمات من المضيفين بعد. ستظهر هنا بعد إقاماتك.",

        // Saved / wishlist
        "saved.title": "المحفوظات",
        "saved.subtitle": "إقاماتك وتجاربك المفضّلة.",
        "saved.stays": "الإقامات",
        "saved.services": "التجارب",
        "saved.empty.title": "لا يوجد محفوظات بعد",
        "saved.empty.msg": "اضغط على القلب في أي إقامة أو تجربة لحفظها هنا.",
        "saved.error.title": "تعذّر تحميل المحفوظات",
        "saved.signedOut.title": "سجّل الدخول لعرض قائمة رغباتك",
        "saved.signInPrompt": "سجّل الدخول لعرض المحفوظات",

        // Brand travel header — eyebrows + subtitles per root tab
        "home.eyebrow": "اكتشف · أقم · استكشف",
        "home.subtitle": "إقامات مميّزة في أنحاء مصر.",
        "reservations.eyebrow": "رحلاتك",
        "reservations.subtitle": "كل رحلة حجزتها في مكان واحد.",
        "profile.eyebrow": "حسابك",
        "profile.subtitle": "الملف الشخصي والإعدادات واللغة.",
        "saved.eyebrow": "مجموعتك",
        "notifications.title": "الإشعارات",

        // Services
        "services.title": "الخدمات",
        "services.eyebrow": "الساحل الشمالي · مصر",
        "services.subtitle": "أضف تجارب إلى إقامتك — على الماء، وفي الرمال، وعلى مائدتك.",
        "services.perExperience": "لكل تجربة",
        "services.hostedBy": "يقدّمها %@",
        "services.empty.nothing": "لا يوجد ما نعرضه بعد",
        "services.empty.nothingMsg": "لا توجد تجارب لعرضها بعد.",

        // Reservations
        "reservations.title": "الحجوزات",
        "reservations.mySubscriptions": "اشتراكاتي",
        "reservations.mySubscriptions.subtitle": "تابع التجارب التي طلبتها.",
        "reservations.empty.title": "لا توجد حجوزات بعد",
        "reservations.empty.msg": "عند حجز إقامة، ستظهر هنا. اسحب للأسفل للتحديث.",
        "reservations.error.title": "تعذّر تحميل الحجوزات",
        "reservations.error.session": "تعذّر تحميل رحلاتك. اسحب للأسفل للتحديث وحاول مرة أخرى.",
        "reservations.reservation": "حجز",

        // Booking status
        "status.pending": "قيد الانتظار",
        "status.confirmed": "مؤكَّد",
        "status.rejected": "مرفوض",
        "status.cancelled": "ملغى",
        "status.completed": "مكتمل",

        // Profile
        "profile.title": "حسابي",
        "profile.editProfile": "تعديل الملف الشخصي",
        "profile.editProfile.subtitle": "حدّث صورتك ونبذتك واسمك وبياناتك.",
        "profile.hostDashboard": "لوحة المضيف",
        "profile.hostDashboard.subtitle": "أضف الإعلانات وأدر طلبات الحجز.",
        "profile.logout": "تسجيل الخروج",
        "profile.language": "اللغة",

        // Profile settings (edit profile)
        "settings.fullName": "الاسم الكامل",
        "settings.fullName.placeholder": "اسمك الكامل",
        "settings.age": "العمر",
        "settings.age.placeholder": "مثال: ٢٩",
        "settings.id": "الهوية / جواز السفر",
        "settings.id.placeholder": "رقم الهوية أو جواز السفر",
        "settings.phone": "الهاتف",
        "settings.phone.placeholder": "رقم الهاتف",
        "settings.bio": "نبذة",
        "settings.bio.placeholder": "عرّف الضيوف بنفسك قليلًا…",
        "settings.country": "البلد",
        "settings.country.placeholder": "اختر بلدك",
        "settings.photo": "أضف صورة",
        "settings.changePhoto": "تغيير الصورة",
        "settings.photo.error": "تعذّر استخدام هذه الصورة. جرّب صورة أخرى.",
        "settings.saveChanges": "حفظ التغييرات",
        "settings.saved": "تم الحفظ",
        "settings.changePassword": "تغيير كلمة المرور",
        "settings.currentPassword": "كلمة المرور الحالية",
        "settings.newPassword": "كلمة المرور الجديدة",
        "settings.newPassword.placeholder": "٨ أحرف على الأقل",
        "settings.updatePassword": "تحديث كلمة المرور",
        "settings.passwordUpdated": "تم تحديث كلمة المرور.",
        "settings.security": "الأمان",
        "settings.biometric.subtitle": "تخطَّ كلمة المرور في المرة القادمة عند تسجيل الدخول.",

        // Host tabs
        "host.listings.title": "إعلاناتي",
        "host.yourListings": "إعلاناتك",
        "host.addListing": "أضف إعلانًا",
        "host.addListing.subtitle": "أضف مكانًا جديدًا ليحجزه الضيوف.",
        "host.loadingListings": "جارٍ تحميل إعلاناتك…",
        "host.listings.empty": "لم تنشر أي إعلان بعد. اضغط على «أضف إعلانًا» للبدء.",
        "host.loadingRequests": "جارٍ تحميل الطلبات…",
        "host.requests.empty": "لا توجد طلبات بعد. ستظهر هنا عندما يحجز ضيف أحد أماكنك.",
        "host.stats.thisMonth": "مكانك",
        "host.stats.listings": "الإعلانات",
        "host.stats.pending": "قيد الانتظار",
        "host.stats.requests": "الطلبات",
        "host.action.confirm": "تأكيد",
        "host.action.reject": "رفض",
        "host.message": "مراسلة",
        "host.status.live": "منشور",

        // Listing approval queue + ownership document
        "approval.pending": "قيد المراجعة",
        "approval.approved": "تمت الموافقة",
        "approval.rejected": "مرفوض",
        "approval.ownershipDoc": "مستند إثبات الملكية",
        "approval.ownershipIntro": "ارفع مستندًا يثبت ملكيتك للمكان أو تفويضك بإدراجه (مثل عقد الملكية أو فاتورة مرافق). يراجعه فريقنا قبل نشر إعلانك.",
        "approval.uploadDoc": "رفع مستند إثبات الملكية",
        "approval.changeDoc": "تغيير",
        "approval.docAttached": "تم إرفاق المستند",
        "approval.docMissing": "غير مُضاف",
        "approval.reupload": "إعادة رفع مستند الملكية",
        "approval.reviewNotice": "لن يظهر إعلانك للعامة على الفور. بعد الإرسال، يراجع فريقنا مستند الملكية ثم يوافق على الإعلان.",
        "approval.submitForReview": "إرسال للمراجعة",
        "approval.submittedForReview": "تم الإرسال للمراجعة",

        // Availability (live calendar + host block/unblock)
        "availability.unavailable": "غير متاح",
        "availability.manage": "إدارة التوفر",
        "availability.blockDates": "حظر تواريخ",
        "availability.blocked": "التواريخ المحظورة",
        "availability.booked": "محجوزة",
        "availability.addBlock": "حظر التواريخ",
        "availability.remove": "إزالة",
        "availability.noBlocks": "لا توجد تواريخ محظورة بعد. اختر نطاقًا بالأعلى لجعل التواريخ غير متاحة للضيوف.",
        "availability.pickRange": "اختر تواريخ للحظر",

        // Cancellation policy + guest cancel
        "cancel.policy": "سياسة الإلغاء",
        "cancel.policyLabel": "السياسة",
        "cancel.flexible": "مرنة",
        "cancel.moderate": "معتدلة",
        "cancel.strict": "صارمة",
        "cancel.flexibleDesc": "استرداد كامل إذا ألغيت قبل موعد الوصول بيوم واحد على الأقل. بعد ذلك لا يوجد استرداد.",
        "cancel.moderateDesc": "استرداد كامل إذا ألغيت قبل موعد الوصول بخمسة أيام على الأقل. بعد ذلك استرداد ٥٠٪.",
        "cancel.strictDesc": "استرداد ٥٠٪ إذا ألغيت قبل موعد الوصول بسبعة أيام على الأقل. بعد ذلك لا يوجد استرداد.",
        "cancel.choosePolicy": "سياسة الإلغاء",
        "cancel.choosePolicyHint": "اختر مدى مرونة الإلغاء بالنسبة للضيوف. يمكنك تغيير ذلك في أي وقت.",
        "cancel.savePolicy": "حفظ السياسة",
        "cancel.policySaved": "تم حفظ السياسة",
        "cancel.cancelReservation": "إلغاء الحجز",
        "cancel.refundQuote": "ملخص الاسترداد",
        "cancel.youWillReceive": "ستسترد",
        "cancel.refundPercentLabel": "الاسترداد (%@٪ من الإجمالي)",
        "cancel.keepReservation": "الاحتفاظ بالحجز",
        "cancel.confirm": "تأكيد الإلغاء",
        "cancel.confirmTitle": "إلغاء هذا الحجز؟",
        "cancel.confirmBody": "بناءً على سياسة %1$@ وتاريخ وصولك، إليك ما ستسترده.",
        "cancel.noRefund": "هذا الإلغاء غير مؤهل لأي استرداد.",
        "cancel.cancelled": "تم إلغاء الحجز",
        "cancel.cancelledBody": "تم إلغاء هذا الحجز.",
        "cancel.refunded": "تم الاسترداد",
        "cancel.daysUntil": "%@ يوم حتى موعد الوصول",
        "cancel.cannotCancel": "لم يعد بالإمكان إلغاء هذا الحجز.",

        // Growth — length-of-stay discounts (host)
        "growth.lengthOfStayDiscounts": "خصومات الإقامة الطويلة",
        "growth.discountsIntro": "قدّم سعرًا أقل لليلة للإقامات الأطول. تُطبَّق الخصومات تلقائيًا عند الدفع.",
        "growth.discountsHint": "حدّد خصمًا للإقامات الأسبوعية والشهرية. يمكنك تغيير ذلك في أي وقت.",
        "growth.weeklyDiscount": "خصم أسبوعي",
        "growth.monthlyDiscount": "خصم شهري",
        "growth.weeklyHint": "على الإقامات من ٧ ليالٍ فأكثر",
        "growth.monthlyHint": "على الإقامات من ٢٨ ليلة فأكثر",
        "growth.weeklyShort": "أسبوعي −%@٪",
        "growth.monthlyShort": "شهري −%@٪",
        "growth.discountOff": "خصم %@٪",
        "growth.saveDiscounts": "حفظ الخصومات",
        "growth.discountsSaved": "تم حفظ الخصومات",
        "growth.noDiscounts": "لا يوجد",
        "growth.noDiscountsYet": "لا توجد خصومات بعد",

        // Seasonal / variable pricing (host + guest)
        "pricing.seasonal": "التسعير الموسمي",
        "pricing.seasonalIntro": "احصل على سعر أعلى في عطلات نهاية الأسبوع أو أشهر الذروة. اترك الحقل فارغًا لاستخدام سعر ليلتك الأساسي.",
        "pricing.seasonalHint": "حدّد سعر عطلة نهاية الأسبوع وأسعارًا لكل شهر. الأشهر الفارغة تبقى على سعرك الأساسي.",
        "pricing.weekendPrice": "سعر عطلة نهاية الأسبوع",
        "pricing.weekendHint": "يُطبَّق ليلتَي الجمعة والسبت",
        "pricing.monthlyPrices": "الأسعار الشهرية",
        "pricing.weekendSummary": "نهاية الأسبوع %@",
        "pricing.monthsSummary": "%@ أشهر",
        "pricing.noSeasonalYet": "لا توجد أسعار موسمية بعد",
        "pricing.save": "حفظ التسعير",
        "pricing.saved": "تم حفظ التسعير",
        "pricing.seasonalNote": "تُطبَّق أسعار عطلة نهاية الأسبوع والأسعار الموسمية",
        "pricing.perNightAvg": "متوسط / الليلة",
        "pricing.night": "ليلة %@",
        "pricing.nights": "%@ ليالٍ",

        // Growth — promo codes (checkout)
        "promo.code": "كود الخصم",
        "promo.placeholder": "أدخل الكود",
        "promo.apply": "تطبيق",
        "promo.remove": "إزالة",
        "promo.applied": "تم تطبيق الكود — خصم %@ ج.م",
        "promo.invalid": "هذا الكود غير صالح.",
        "promo.discount": "خصم الكود",

        // Growth — referrals
        "referral.title": "ادعُ أصدقاءك",
        "referral.subtitle": "شارك كودك واكسب مكافآت",
        "referral.heroTitle": "ادعُ أصدقاءك واكسب مكافآت",
        "referral.heroBody": "شارك كود الدعوة الخاص بك. عندما يسجّل صديق باستخدامه، تحصلان كلاكما على مكافأة.",
        "referral.yourCode": "كود الدعوة الخاص بك",
        "referral.copy": "نسخ",
        "referral.copied": "تم النسخ",
        "referral.invited": "الأصدقاء المدعوون",
        "referral.reward": "إجمالي المكافأة",
        "referral.friendsTitle": "الأصدقاء الذين انضموا",
        "referral.empty": "لا توجد دعوات بعد. شارك كودك للبدء.",
        "referral.aFriend": "صديق",
        "referral.signupField": "كود الدعوة (اختياري)",
        "referral.signupPlaceholder": "أدخل كود صديق",

        // Share + deep links
        "share.label": "مشاركة",
        "common.close": "إغلاق",
        "share.listing.title": "%@ — QuickIn",
        "share.listing.message": "شاهد هذه الإقامة على QuickIn.",
        "share.service.title": "%@ — QuickIn",
        "share.service.message": "شاهد هذه التجربة على QuickIn.",
        "share.reservation.title": "%@ — QuickIn",
        "share.reservation.titleFallback": "حجزي — QuickIn",
        "share.reservation.message": "إليك حجزي على QuickIn.",

        // Trust & safety — identity verification
        "trust.verify": "تحقّق من هويتك",
        "trust.verifyIntro": "أضِف صورة من بطاقة هويتك للحصول على شارة التحقق وبناء الثقة مع المُضيفين والضيوف.",
        "trust.uploadId": "رفع صورة الهوية",
        "trust.uploadError": "تعذّر معالجة هذه الصورة. من فضلك جرّب صورة أخرى.",
        "trust.pending": "بطاقتك قيد المراجعة. عادةً ما يستغرق ذلك بعض الوقت.",
        "trust.verified": "تم التحقق من هويتك. شكرًا لمساعدتك في الحفاظ على أمان QuickIn.",
        "trust.rejected": "تعذّر التحقق من طلبك الأخير. من فضلك ارفع صورة أوضح لبطاقة هويتك.",
        "trust.status.unverified": "غير موثّق",
        "trust.status.pending": "قيد المراجعة",
        "trust.status.verified": "موثّق",
        "trust.status.rejected": "مرفوض",

        // Trust & safety — badges
        "badge.verified": "موثّق",
        "badge.verifiedHost": "مُضيف موثّق",
        "badge.superhost": "مُضيف متميّز",
        "badge.newHost": "مُضيف جديد",

        // Trust & safety — reporting
        "report.report": "إبلاغ",
        "report.reportListing": "الإبلاغ عن هذا الإعلان",
        "report.reason": "لماذا تُبلّغ عن هذا؟",
        "report.reason.inaccurate": "إعلان غير دقيق",
        "report.reason.scam": "احتيال أو نصب",
        "report.reason.offensive": "محتوى مُسيء",
        "report.reason.other": "شيء آخر",
        "report.details": "أضِف تفاصيل (اختياري)",
        "report.details.placeholder": "أخبِرنا بما حدث…",
        "report.submit": "إرسال البلاغ",
        "report.thanks": "شكرًا لإبلاغك",
        "report.thanks.body": "سيراجع فريقنا بلاغك وسيتخذ الإجراء اللازم عند الحاجة.",

        // Money (Section 9) — host earnings / payouts
        "money.earnings": "الأرباح",
        "money.earnings.subtitle": "أرباحك والرصيد المعلّق",
        "money.totalEarned": "إجمالي الأرباح",
        "money.paidOut": "المدفوع",
        "money.pending": "قيد الانتظار",
        "money.payouts": "المدفوعات",
        "money.net": "الصافي",
        "money.bookingsCount": "عبر %@ حجوزات",
        "money.statusPaidOut": "مدفوع",
        "money.statusUpcoming": "قادم",
        "money.noEarnings": "لا توجد أرباح بعد. ستظهر مدفوعاتك هنا بمجرد أن يحجز الضيوف ويدفعوا.",
        "money.signInHost": "سجّل الدخول كمُضيف لعرض أرباحك.",
        // Money — guest receipts
        "money.receipts": "الإيصالات",
        "money.receipts.subtitle": "حجوزاتك المدفوعة بالتفصيل",
        "money.receipt": "إيصال",
        "money.subtotal": "الإجمالي الفرعي",
        "money.serviceFee": "رسوم الخدمة",
        "money.methodFee": "رسوم وسيلة الدفع",
        "money.promoDiscount": "خصم الكود",
        "money.total": "الإجمالي",
        "money.paidOn": "دُفِع في %@",
        "money.noReceipts": "لا توجد إيصالات بعد. ستظهر حجوزاتك المدفوعة هنا.",
        "money.signIn": "سجّل الدخول لعرض إيصالاتك.",
        // Money — multi-currency
        "money.currency": "العملة",
        "money.currency.subtitle": "اختر عملة العرض",
        "money.currencyNote": "تُعرض الأسعار بالعملة التي تختارها. تتم محاسبة الحجوزات دائمًا بالجنيه المصري.",
        "currency.egp": "جنيه مصري",
        "currency.usd": "دولار أمريكي",
        "currency.eur": "يورو",
        "currency.gbp": "جنيه إسترليني",
        "currency.sar": "ريال سعودي",
        "currency.aed": "درهم إماراتي",
    ]
}
