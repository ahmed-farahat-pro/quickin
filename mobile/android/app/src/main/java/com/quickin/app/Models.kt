package com.quickin.app

/**
 * The rules for the weekend rung of the pricing ladder: which weekdays a listing's
 * [Listing.weekendPrice] is charged on, and what a (rate, days) pair may be.
 *
 * The Kotlin twin of `listing-pricing-core.ts` on the server, which is the file the website and
 * the API both run. Keep the answers below in step with `resolveWeekendSchedule` there — the API
 * refuses the same two sets this refuses, and a host should be told by the screen they are typing
 * into rather than by a save that comes back 400.
 */
object WeekendSchedule {
    /** Egypt's weekend, and the fallback when a host never chose (`weekend_days` is NULL). */
    val defaultDays: List<Int> = listOf(5, 6)

    /** Days in a week — the ceiling a weekend has to stay under. */
    const val DAYS_IN_WEEK = 7

    /** Why a chosen day set cannot be saved. */
    enum class Problem {
        /** All seven days, which leaves the nightly price applying to no night. */
        WHOLE_WEEK,

        /** A rate was typed with no day left lit to charge it on. */
        NO_DAYS_CHOSEN
    }

    /** Keep whole days in 0..6, drop repeats, sort ascending. */
    fun normalize(raw: Collection<Int>): List<Int> =
        raw.filter { it in 0 until DAYS_IN_WEEK }.distinct().sorted()

    /**
     * The days a listing actually prices at its weekend rate — the host's own set, or the default
     * when they never chose. What the server's ladder does, so a preview here matches the quote.
     */
    fun effective(days: List<Int>?): List<Int> =
        if (days.isNullOrEmpty()) defaultDays else normalize(days)

    /**
     * Judge a (rate, days) pair as ONE thing, the way the API does.
     *
     * - no rate → no days, and never an error: clearing the weekend price is how a host turns
     *   weekend pricing off, and refusing that save would strand them on a form they are in the
     *   middle of fixing.
     * - all seven days → [Problem.WHOLE_WEEK].
     * - no days under a real rate → [Problem.NO_DAYS_CHOSEN].
     */
    fun resolve(price: Double?, days: Collection<Int>): Result<List<Int>?> {
        if (price == null || price <= 0.0) return Result.success(null)
        val cleaned = normalize(days)
        if (cleaned.size >= DAYS_IN_WEEK) return Result.failure(WeekendDaysException(Problem.WHOLE_WEEK))
        if (cleaned.isEmpty()) return Result.failure(WeekendDaysException(Problem.NO_DAYS_CHOSEN))
        return Result.success(cleaned)
    }
}

/** Carries a [WeekendSchedule.Problem] out of [WeekendSchedule.resolve] as a `Result` failure. */
class WeekendDaysException(val problem: WeekendSchedule.Problem) : Exception(problem.name)

/** A photo attached to a listing (from the `listing_images` table). */
data class ListingImage(
    val url: String,
    val order: Int = 0
)

/** A QuickIn listing (subset of columns needed for browse + detail). */
data class Listing(
    val id: String,
    val title: String,
    val description: String?,
    val location: String?,
    /**
     * The listing's country (parsed from "country"); null when the backend omits it. Only the
     * host's own edit form surfaces it — guests see the [location] line.
     */
    val country: String? = null,
    /** Id of the host that owns this listing (parsed from "host_id"); null when absent. */
    val hostId: String? = null,
    /** Display name of the host (parsed from "host_name"); null when absent. */
    val hostName: String? = null,
    /** Curated area the listing belongs to (e.g. "North Coast", "El Gouna"); null when unset. */
    val region: String? = null,
    /**
     * The catalog resort this listing belongs to (parsed from "resort_id"); null when the host
     * typed their own compound name or picked none — the two are mutually exclusive server-side.
     * Seeds the host editor's resort picker.
     */
    val resortId: String? = null,
    /**
     * The resort / compound to SHOW: the catalog resort's name when [resortId] is set, otherwise
     * whatever the host typed (parsed from the API's derived "resort" field, not from a column).
     * Null when the place isn't in one.
     */
    val resort: String? = null,
    /**
     * The listing's property type (e.g. "Apartment", "Villa", "Chalet", "House"); null when unset.
     * Parsed from the JSON key "property_type" (see SupabaseService.parseListing). Surfaced as a
     * small labeled chip near the title on the detail screen.
     */
    val propertyType: String? = null,
    val pricePerNight: Double,
    val currency: String?,
    val bedrooms: Int?,
    val beds: Int?,
    val bathrooms: Int?,
    val maxGuests: Int?,
    val isGuestFavorite: Boolean,
    val listingCode: String?,
    val lat: Double? = null,
    val lng: Double? = null,
    val images: List<ListingImage>,
    /** Amenity labels offered by the place (e.g. "WiFi", "Pool"). Empty when omitted. */
    val amenities: List<String> = emptyList(),
    /** Average guest rating (0.0 when the stay has no reviews yet). Parsed from "rating". */
    val rating: Double = 0.0,
    /** Number of guest reviews backing [rating]. Parsed from "review_count". */
    val reviewCount: Int = 0,
    /**
     * The host-set cancellation policy: "flexible" | "moderate" | "strict"
     * (parsed from "cancellation_policy"; defaults to "moderate"). Drives the policy row on
     * the detail screen and the refund a guest is quoted on cancel.
     */
    val cancellationPolicy: String = "moderate",
    /**
     * True when this listing's host has a verified identity (parsed from "host_verified";
     * defaults to false). Drives the "Verified ✓" trust chip shown next to the host.
     */
    val hostVerified: Boolean = false,
    /**
     * The listing's moderation state: "pending" | "approved" | "rejected" (parsed from
     * "approval_status"; defaults to "approved" so existing/public listings without the field
     * read as live). New listings are created "pending" until a staff member approves them.
     * Drives the approval badge + "Re-upload ownership document" action on the host's own listings.
     */
    val approvalStatus: String = "approved",
    /**
     * Host-set length-of-stay discount applied to stays of ≥7 nights, as a whole percent off
     * (parsed from "weekly_discount"; defaults to 0 = none). The backend applies it to the total
     * server-side; the detail screen surfaces it as a "Weekly −X%" note near the price.
     */
    val weeklyDiscount: Int = 0,
    /**
     * Host-set length-of-stay discount applied to stays of ≥28 nights, as a whole percent off
     * (parsed from "monthly_discount"; defaults to 0 = none). Takes precedence over the weekly
     * discount when both apply. Surfaced as a "Monthly −Y%" note near the price.
     */
    val monthlyDiscount: Int = 0,
    /**
     * Host-set weekend nightly rate in EGP (parsed from "weekend_price"; null when the host hasn't
     * set one). When present, weekend nights are quoted at this rate instead of [pricePerNight].
     * Drives the "weekend & seasonal rates apply" note. Which nights count is [weekendDays] — NOT
     * a fixed Friday + Saturday.
     */
    val weekendPrice: Double? = null,
    /**
     * Which weekdays [weekendPrice] is charged on, `0`=Sun … `6`=Sat (parsed from "weekend_days";
     * null when the host never chose, which means the default weekend applies — see
     * [WeekendSchedule.effective]).
     *
     * A weekend is not Friday and Saturday everywhere, nor for every property, so this is the
     * host's answer and not a constant. Both apps used to have no picker at all and told the host
     * the rate applied "(Fri–Sat)"; the column existed and the backend simply never sent it.
     */
    val weekendDays: List<Int>? = null,
    /**
     * Host-set per-month nightly overrides in EGP, keyed by month number "1".."12" (parsed from the
     * "monthly_prices" JSON object; empty when none). A night that falls in a listed month is quoted
     * at that month's rate (weekend rate still wins over it). The authoritative quote endpoint
     * resolves the exact total; this just surfaces that seasonal pricing exists.
     */
    val monthlyPrices: Map<String, Double> = emptyMap(),
    /**
     * ISO-8601 timestamp the listing was created, e.g. "2026-07-27T10:28:00Z" (parsed from
     * "created_at"); null when the backend omits the column. Surfaced as the muted
     * "Listed 27 Jul 2026" line on the host's own listing cards, so a host can tell at a glance
     * when a place went up (and how long a pending one has been waiting).
     */
    val createdAt: String? = null,
    /**
     * Why staff rejected this listing (parsed from "review_note"); null when they rejected
     * without writing a reason (the note is optional), on listings rejected before the reason
     * was stored at all, and on every guest read — the backend returns the column only in the
     * host projection, since it is staff-authored text about this host. Rendered under the
     * "Rejected" badge on the host's own listing cards, which fall back to generic guidance
     * when it is null. Cleared server-side the moment the listing goes back to "pending".
     */
    val reviewNote: String? = null,
    /**
     * Whether guests can see this listing at all (parsed from "is_published"; defaults to true,
     * because a public read only ever returns published listings and defaulting to false there
     * would badge every one of them "hidden").
     *
     * QuickIn has no host-facing delete and will not have one: bookings, reviews, messages and
     * payment records all point at the listing id, so "remove my listing" is this flag going
     * false — search drops the listing, its public page 404s, no new booking can be made — while
     * every existing reservation stays exactly as it was.
     */
    val isPublished: Boolean = true,
    /**
     * The HOST took this listing down themselves (parsed from "unpublished_by_host"). HOST READS
     * ONLY — absent on a guest feed, where false is the honest answer.
     *
     * Four parties can hold a listing off the market (the host, an operator, an account block,
     * the identity gate) and each may only release its own grip, so this is a dedicated flag
     * rather than an inference from [isPublished]. It is the one the host can clear, and the one
     * the Deactivate / Reactivate button acts on.
     */
    val unpublishedByHost: Boolean = false,
    /** HOST READS ONLY. An account block hid it; only a staff restore undoes it. */
    val unpublishedByAdmin: Boolean = false,
    /** HOST READS ONLY. The identity gate hid it; only re-verifying undoes it. */
    val unpublishedByVerification: Boolean = false,
    /**
     * HOST READS ONLY. Booking requests still waiting on this host (parsed from
     * "pending_request_count"; 0 when absent). Deactivating declines all of them, so the
     * confirmation dialog names this number BEFORE the host commits.
     */
    val pendingRequestCount: Int = 0,
    /**
     * HOST READS ONLY. Whether a proof-of-ownership document is on file (parsed from
     * "has_ownership_doc"; false when absent). A flag, never the document — that stays
     * admin-only and is served one at a time from an audited endpoint.
     *
     * A different question from [approvalStatus]: the document is OPTIONAL at create time, so a
     * listing reaches the moderation queue as "pending" with nothing attached. This is what lets
     * the host card offer "Upload ownership document" instead of "Re-upload ownership document"
     * to a host who has never uploaded one. Defaulting to false asks for the document either
     * way, which is the safe direction — the wrong "Re-upload" claims one is already on file.
     */
    val hasOwnershipDoc: Boolean = false
) {
    /**
     * Photo URLs sorted by their order. Empty when the listing has no photos — callers
     * render a [com.quickin.app.ui.PhotoPlaceholder] instead of loading a stock image.
     */
    val sortedImageUrls: List<String>
        get() = images.sortedBy { it.order }.map { it.url }

    /** Prices are shown in Egyptian Pounds across the app. */
    val currencySymbol: String
        get() = "EGP "

    val priceText: String
        get() = "$currencySymbol${pricePerNight.toInt()}"

    /** True once at least one guest has reviewed this stay. */
    val hasRating: Boolean
        get() = reviewCount > 0 && rating > 0.0

    /** Rating formatted to one decimal for the gold rating row, e.g. "4.9". */
    val ratingText: String
        get() = String.format(java.util.Locale.US, "%.1f", rating)

    /** The parsed moderation state for the approval badge / re-upload action. */
    val approval: ListingApproval
        get() = ListingApproval.from(approvalStatus)

    /** True while this listing is awaiting staff review (not yet publicly visible). */
    val isPendingApproval: Boolean
        get() = approval == ListingApproval.Pending

    /** True when staff rejected the ownership document and the listing needs a resubmission. */
    val isRejected: Boolean
        get() = approval == ListingApproval.Rejected

    /**
     * The single state the host's own listing row is shown in — moderation and visibility folded
     * together, because from the host's side "why can nobody see this?" has one answer, not two,
     * and a listing can be approved and hidden at the same time.
     *
     * Mirrors `hostVisibilityState()` in the backend's `host-visibility-core.ts`, the module the
     * API enforces the same rules from, so the badge, the filter chip and the button can never
     * disagree with the write.
     */
    val hostVisibility: HostVisibility
        get() = when {
            // The host's own decision outranks the moderation states: it is what the button acts
            // on, and it is why the listing will STAY hidden even after the queue approves it.
            unpublishedByHost -> HostVisibility.Deactivated
            approval == ListingApproval.Rejected -> HostVisibility.Rejected
            approval == ListingApproval.Pending -> HostVisibility.UnderReview
            isPublished -> HostVisibility.Live
            // Unpublished, approved, and not by the host: an operator takedown, an account block,
            // or the identity gate. Nothing the host can undo.
            else -> HostVisibility.Blocked
        }

    /** True when the host offers any length-of-stay discount (weekly or monthly). */
    val hasStayDiscount: Boolean
        get() = weeklyDiscount > 0 || monthlyDiscount > 0

    /**
     * True when the host set any seasonal/variable pricing — a weekend rate or at least one
     * per-month override. Drives the "Weekend & seasonal rates apply" note on the detail screen.
     */
    val hasSeasonalPricing: Boolean
        get() = (weekendPrice != null && weekendPrice > 0.0) || monthlyPrices.isNotEmpty()
}

/**
 * An authoritative stay quote for a chosen date range (from
 * `POST /api/local/listings/:id/quote { checkIn, checkOut }`, public). The backend resolves the
 * exact price honoring the weekend rate, per-month overrides, and the length-of-stay discount —
 * the guest reserve panel shows this breakdown and uses [total] rather than a base estimate.
 *
 * All money is in [currency] (EGP). [subtotal] is the sum of the resolved nightly rates before any
 * discount, [discountPercent] the whole-percent length-of-stay discount applied (0 when none),
 * [total] the final price net of it, and [nightlyAvg] the effective per-night average
 * ([total] / [nights]). [hasSeasonalPricing] echoes whether weekend/monthly rates were in play.
 */
data class StayQuote(
    val nights: Int,
    val subtotal: Double,
    val discountPercent: Int,
    val total: Double,
    val nightlyAvg: Double,
    val currency: String = "EGP",
    val hasSeasonalPricing: Boolean = false,
    /**
     * Every night of the stay, priced and labelled — what the booking summary itemises. Empty on
     * a backend that predates the host calendar, which is why the UI falls back to the single
     * blended line rather than showing an empty list.
     */
    val nightsBreakdown: List<QuoteNight> = emptyList(),
    /** True when at least one night was pinned on the host's calendar. */
    val hasCustomNights: Boolean = false
) {
    /** True when a length-of-stay discount actually reduced this quote. */
    val hasDiscount: Boolean
        get() = discountPercent > 0

    /**
     * Whether the nights are priced differently from one another — the only case where listing
     * them adds anything. A stay at one flat rate reads better as the blended line alone than as
     * the same number repeated.
     */
    val nightlyPricesVary: Boolean
        get() = nightsBreakdown.isNotEmpty() && nightsBreakdown.any { it.price != nightsBreakdown[0].price }
}

/**
 * One priced night inside a [StayQuote]. [price] is commission-inclusive, like every other figure
 * on the quote. [date] is `yyyy-MM-dd` and the night STARTS on it — a stay never includes the
 * checkout day, so a guest is not charged for the morning they leave.
 */
data class QuoteNight(
    val date: String,
    val price: Double,
    val source: PriceSource
)

/**
 * Which rung of the pricing ladder set a night's rate. A price the host pinned on an exact day
 * beats every seasonal rule:
 *
 *     CUSTOM → WEEKEND → that month's rate → BASE
 */
enum class PriceSource(val apiValue: String) {
    /** Pinned by the host on this exact day. */
    CUSTOM("custom"),
    /** The listing's weekend rate. */
    WEEKEND("weekend"),
    /** That month's rate. */
    MONTHLY("monthly"),
    /** `price_per_night` — the listing's default. */
    BASE("base");

    companion object {
        /**
         * An unknown value from a newer backend reads as [BASE] rather than throwing: a calendar
         * that won't parse is worse than one rung mislabelled.
         */
        fun from(raw: String?): PriceSource =
            entries.firstOrNull { it.apiValue.equals(raw, ignoreCase = true) } ?: BASE
    }
}

/** Whether the host may still edit a day on the calendar. */
enum class DayStatus(val apiValue: String) {
    /** Sellable, and the host may price or close it. */
    AVAILABLE("available"),
    /** Closed by the host. Still editable — that is how they reopen it. */
    BLOCKED("blocked"),
    /**
     * Held by a reservation. Read-only: the price a guest agreed to is snapshotted on their
     * booking and must not be restated underneath them.
     */
    BOOKED("booked");

    companion object {
        fun from(raw: String?): DayStatus =
            entries.firstOrNull { it.apiValue.equals(raw, ignoreCase = true) } ?: AVAILABLE
    }
}

/**
 * One night of one listing's calendar. [price] is the host's RAW rate when the caller is the
 * listing's host (with [guestPrice] alongside), and the commission-inclusive figure for anyone
 * else — decided by the server from the bearer token, exactly like the listing projections.
 */
data class CalendarDay(
    /** `yyyy-MM-dd`. Doubles as the identity — one row per day. */
    val date: String,
    val price: Double,
    /** What a guest pays for this night. Null unless the caller is the host. */
    val guestPrice: Double? = null,
    val source: PriceSource = PriceSource.BASE,
    val status: DayStatus = DayStatus.AVAILABLE,
    /** The host's note on the block covering this day. Host reads only. */
    val note: String? = null
) {
    /** The host may act on any day that is not held by a reservation. */
    val isEditable: Boolean
        get() = status != DayStatus.BOOKED
}

/** A listing's calendar over a window, from `GET /api/local/listings/:id/calendar?start=&end=`. */
data class ListingCalendar(
    val listingId: String,
    val currency: String = "EGP",
    /** The platform markup in force, as a fraction (0.1 = 10%). */
    val commissionRate: Double = 0.0,
    /** `price_per_night`, in the same raw/guest terms as [days]. */
    val basePrice: Double = 0.0,
    val start: String = "",
    /** INCLUSIVE — the last day in [days], not a half-open bound. */
    val end: String = "",
    val days: List<CalendarDay> = emptyList()
)

/** What one calendar edit did, from `PUT …/calendar`. */
data class CalendarUpdateResult(
    /** Days actually written. */
    val updated: Int,
    /**
     * Days the host selected that we refused, and why. Never silent: a day left unchanged without
     * saying so is one the host believes they priced.
     */
    val skipped: List<SkippedDay>,
    /** The calendar after the edit, over the days that were selected. */
    val calendar: ListingCalendar
) {
    data class SkippedDay(val date: String, val reason: String)
}

/**
 * What a calendar edit does to the selected days' prices. Three states, because "set 3,500",
 * "clear the pin" and "don't touch prices" are three different edits and a plain `Double?` can
 * only express two of them.
 */
sealed interface CalendarPriceChange {
    /** Leave prices as they are (used when only blocking or unblocking). */
    data object Unchanged : CalendarPriceChange
    /** Delete the pinned rates so the days follow the listing's normal pricing. */
    data object Reset : CalendarPriceChange
    /** Pin this raw nightly rate on every selected day. */
    data class Set(val amount: Double) : CalendarPriceChange
}

/**
 * A listing's moderation state with its localized badge label + chip color resolved at render
 * time (string-resource ids follow the app's en/ar locale and stay RTL-safe). [apiValue] is the
 * raw "approval_status" the backend uses.
 *
 *  • pending  — submitted, awaiting staff review; the listing is not publicly visible yet.
 *  • approved — live and discoverable.
 *  • rejected — the ownership document was declined; the host may re-upload to re-queue.
 */
enum class ListingApproval(
    val apiValue: String,
    @androidx.annotation.StringRes val labelRes: Int
) {
    Pending("pending", R.string.approval_pending),
    Approved("approved", R.string.approval_approved),
    Rejected("rejected", R.string.approval_rejected);

    companion object {
        /** Maps a raw "approval_status" value to the enum; unknown / null → [Approved]. */
        fun from(raw: String?): ListingApproval = when (raw?.trim()?.lowercase()) {
            "pending" -> Pending
            "rejected" -> Rejected
            else -> Approved
        }
    }
}

/**
 * What a host is shown for one of their OWN listings: the union of moderation state and
 * visibility. Mirrors `HostVisibility` in the backend's `host-visibility-core.ts`.
 *
 * [Deactivated] is the host's own takedown — the only one they can undo, and the state the
 * Deactivate / Reactivate button acts on. [Blocked] is "unpublished, but not by you": an
 * operator takedown, an account block, or the identity gate. The host cannot clear it, so the
 * row says so instead of looking live or offering a button the API would refuse.
 */
enum class HostVisibility {
    Live,
    Deactivated,
    UnderReview,
    Rejected,
    Blocked;

    /** Whether the host may take this listing down — true unless they already have, or unless
     *  someone else is holding it, which is not theirs to compound. */
    val canDeactivate: Boolean
        get() = this != Deactivated && this != Blocked

    /** Whether the host may put it back. Only what they hid themselves. */
    val canReactivate: Boolean
        get() = this == Deactivated
}

/**
 * A single guest review for a listing (from `GET /api/local/reviews?listing_id=ID`).
 * [createdAt] is an ISO-8601 timestamp; the UI shows the short date.
 * [photos] are the reviewer's attached photo URLs (each a `data:image/…` data URL or an
 * `http(s)` URL); empty when the review has none.
 */
data class Review(
    val rating: Int,
    val comment: String?,
    val reviewerName: String?,
    val createdAt: String?,
    val photos: List<String> = emptyList()
)

/**
 * A review a host left about one of their past guests
 * (from `GET /api/local/guest-reviews?guest_id=ID`, public). Shown on the guest's own profile.
 * [createdAt] is an ISO-8601 timestamp; [hostName] is the reviewing host's display name.
 */
data class GuestReview(
    val id: String,
    val bookingId: String?,
    val guestId: String?,
    val hostId: String?,
    val rating: Int,
    val comment: String?,
    val createdAt: String?,
    val hostName: String?
)

/**
 * A past guest the signed-in host is eligible to review (from `GET /api/local/guest-reviews`
 * with the bearer token): a completed stay on one of the host's listings the host hasn't reviewed
 * the guest for yet. Carries the [bookingId] used to POST the guest review plus a summary.
 */
data class ReviewableGuest(
    val bookingId: String,
    val listingId: String?,
    val title: String,
    val guestName: String?,
    val checkOut: String?
)

/**
 * A stay the signed-in user is eligible to review (from `GET /api/local/reviews` with the
 * bearer token): a confirmed booking past checkout that hasn't been reviewed yet. Carries the
 * [bookingId] used to POST the review plus a listing summary for the prompt.
 */
data class ReviewableStay(
    val bookingId: String,
    val listingId: String?,
    val title: String,
    val location: String?,
    val image: String?,
    val checkIn: String?,
    val checkOut: String?
) {
    /** The listing photo URL, or null when there is none (render a placeholder instead). */
    val imageUrl: String?
        get() = image?.takeUnless { it.isBlank() }
}

/**
 * One resort / compound from `GET /api/local/resorts` (optionally narrowed to a region), e.g.
 * {"id":"…","name":"Marassi","region":"North Coast"}. Drives the host location step's resort
 * picker. Only ACTIVE resorts are returned — a retired one stays valid on the listings that
 * already point at it, but is no longer offered.
 */
data class ResortOption(
    val id: String,
    val name: String,
    /** The curated area the resort belongs to. Picking the resort is what sets the listing's
     *  region server-side, which is the point of the pairing. */
    val region: String
)

/**
 * A curated browse region with its live listing count (from `GET /api/local/regions`),
 * e.g. {"region": "Ain Sokhna", "count": 2}. Rendered as a filter chip ("Ain Sokhna · 2")
 * in the explore screen.
 */
data class Region(
    val region: String,
    val count: Int
) {
    /** Chip label, e.g. "Ain Sokhna · 2". */
    val chipLabel: String
        get() = "$region · $count"
}

/** A reservation (from `GET /api/local/bookings`), with a joined listing summary. */
data class Booking(
    val id: String,
    val listingId: String,
    val checkIn: String,
    val checkOut: String,
    val guests: Int,
    val totalPrice: Double,
    val status: String?,
    val title: String,
    val location: String?,
    val image: String?,
    /** Payment state, "unpaid" | "paid" (parsed from "payment_status"); defaults to "unpaid". */
    val paymentStatus: String = "unpaid",
    /**
     * The latest transfer screenshot's own verdict — "submitted" | "approved" | "rejected" |
     * "disputed" (from "payment_proof_status"); null when the guest has never uploaded one. Read
     * together with [paymentStatus] by [PaymentFlowRules]: neither column alone tells the whole
     * story.
     */
    val paymentProofStatus: String? = null,
    /** Why the reviewer turned the last screenshot down (from "payment_reject_reason"); null unless rejected. */
    val paymentRejectReason: String? = null,
    /** ISO-8601 timestamp the booking was paid, or null when still unpaid (from "paid_at"). */
    val paidAt: String? = null,
    /** The listing's city / curated area (parsed from "region"); null when absent. */
    val region: String? = null,
    /** Free-text notes the host attached for the guest (parsed from "host_notes"); null when none. */
    val hostNotes: String? = null,
    /**
     * The listing's cancellation policy at booking time: "flexible" | "moderate" | "strict"
     * (parsed from "cancellation_policy"; defaults to "moderate").
     */
    val cancellationPolicy: String = "moderate",
    /** ISO-8601 timestamp the booking was cancelled, or null when still active (from "cancelled_at"). */
    val cancelledAt: String? = null,
    /** Percent of the total refunded on cancel (0–100), or null when never cancelled (from "refund_percent"). */
    val refundPercent: Int? = null
) {
    /** The listing photo URL, or null when there is none (render a placeholder instead). */
    val imageUrl: String?
        get() = image?.takeUnless { it.isBlank() }

    val totalText: String
        get() = "EGP " + totalPrice.toInt()

    /** "2027-03-10 → 2027-03-14" */
    val dateRangeText: String
        get() = "$checkIn → $checkOut"

    /** Where this booking sits in the payment flow — the shared rule, not a column comparison. */
    val paymentStage: PaymentFlowRules.Stage
        get() = PaymentFlowRules.stage(status, paymentStatus, paymentProofStatus, paidAt)

    /**
     * True once the payment has gone through. Asks [PaymentFlowRules] rather than comparing
     * `payment_status` by hand, so an approved proof whose rollup never landed still reads as paid
     * — exactly as the server sees it.
     */
    val isPaid: Boolean
        get() = paymentStage == PaymentFlowRules.Stage.Paid

    /** True once this booking has been cancelled (so the cancel action is hidden). */
    val isCancelled: Boolean
        get() = status.equals("cancelled", ignoreCase = true) ||
            status.equals("canceled", ignoreCase = true)

    /**
     * True when the guest may still cancel: an upcoming reservation that is pending or confirmed
     * (i.e. not already cancelled / rejected / completed). The backend has the authoritative say
     * (it returns 400 otherwise), this just gates whether the button is offered.
     */
    val isCancellable: Boolean
        get() = !isCancelled && (
            status.equals("pending", ignoreCase = true) ||
                status.equals("confirmed", ignoreCase = true)
            )
}

/**
 * The mock-payment receipt returned by `POST /api/local/bookings/:id/pay`.
 * There is no real gateway yet — this just mimics paying so the booking flow completes.
 * Amounts are in EGP; [reference] is the generated "QK-…" code shown on the paid confirmation.
 */
data class PaymentReceipt(
    val currency: String,
    val nights: Int,
    val nightly: Int,
    val subtotal: Int,
    val serviceFee: Int,
    val total: Int,
    val reference: String,
    val paidAt: String,
    val method: String,
    /**
     * Signed payment-method adjustment in EGP applied to the subtotal: positive for the
     * card surcharge (+5%), negative for the bank-transfer discount (−5%), 0 for "mock".
     * Parsed from "methodFee".
     */
    val methodFee: Int = 0,
    /**
     * The promo code that was applied at checkout (parsed from "promoCode"), or null when none
     * was used. Echoed on the receipt so the paid confirmation can show the redeemed code.
     */
    val promoCode: String? = null,
    /**
     * Amount discounted by the applied promo code, in EGP (parsed from "promoDiscount"; 0 when no
     * promo). The [total] already nets this — it's surfaced as its own line on the receipt.
     */
    val promoDiscount: Int = 0
) {
    /** "EGP 1234" — the total formatted for the pay button / confirmation. */
    val totalText: String
        get() = "$currency $total"

    /** True when a promo code was applied and actually reduced the total. */
    val hasPromo: Boolean
        get() = !promoCode.isNullOrBlank() && promoDiscount > 0
}

/**
 * A promo-code preview from `POST /api/local/promo/validate { code, subtotal }`. Returned before
 * paying so the guest can see what a code is worth without committing. [valid] gates whether the
 * code applies; [discount] is the EGP amount it would knock off the [subtotal] it was quoted
 * against, and [message] carries the backend's human-readable note (e.g. "10% off" or "Expired").
 *
 * [kind] / [value] describe the code's shape ("percent" + a percent value, or "fixed" + an EGP
 * amount) for an optional richer label; the resolved [discount] is what actually matters at pay.
 */
data class PromoQuote(
    val valid: Boolean,
    val code: String,
    /** "percent" | "fixed" (parsed from "kind"); null when the backend omits it. */
    val kind: String? = null,
    /** The code's raw magnitude (percent points or EGP, per [kind]); 0 when absent. */
    val value: Double = 0.0,
    /** EGP amount this code discounts off the quoted subtotal (0 when invalid). */
    val discount: Int = 0,
    /** The backend's human-readable note shown under the field. */
    val message: String? = null
) {
    /** "−EGP 120" — the discount formatted for the applied-promo line. */
    val discountText: String
        get() = "−EGP $discount"
}

/**
 * The signed-in user's referral summary from `GET /api/local/referrals` (Bearer). Drives the
 * "Refer friends" surface on the Profile tab: the user's shareable [code], how many friends they've
 * [count] referred, the total reward earned ([rewardTotal], EGP), and the [referred] list of
 * friends who signed up with the code.
 */
data class ReferralSummary(
    val code: String,
    val count: Int,
    val rewardTotal: Double,
    val referred: List<ReferredFriend> = emptyList()
) {
    /** "EGP 250" — the total reward formatted for the stat row. */
    val rewardTotalText: String
        get() = "EGP ${rewardTotal.toInt()}"
}

/**
 * One friend a user has referred (an entry in [ReferralSummary.referred]). [name] is the friend's
 * display name, [createdAt] an ISO-8601 signup timestamp, and [rewardAmount] the EGP credited for
 * that referral.
 */
data class ReferredFriend(
    val name: String,
    val createdAt: String?,
    val rewardAmount: Double
) {
    /** "EGP 50" — this referral's reward formatted for its row, or null when nothing was credited. */
    val rewardText: String?
        get() = rewardAmount.takeIf { it > 0 }?.let { "EGP ${it.toInt()}" }
}

/**
 * Full reservation detail (from `GET /api/local/bookings/:id`). Adds the
 * [reservationCode] used to generate the in-app QR card; the user's list endpoint
 * doesn't carry the code, so the detail screen fetches this richer shape.
 *
 * [reservationCode] is **nullable on purpose**: the backend only assigns a code when the host
 * approves the request, so a pending (or rejected/cancelled) booking genuinely has none. Read it
 * through [stayPassUrl] / [hasStayPass] rather than assuming a code is there.
 */
data class Reservation(
    val id: String,
    /** The "QK-…" code, or null while the booking has not been approved (no code issued yet). */
    val reservationCode: String?,
    val status: String,
    val title: String,
    val location: String?,
    val checkIn: String,
    val checkOut: String,
    val guests: Int,
    val totalPrice: Double,
    /** Payment state, "unpaid" | "paid" (parsed from "payment_status"); defaults to "unpaid". */
    val paymentStatus: String = "unpaid",
    /**
     * The latest transfer screenshot's own verdict — "submitted" | "approved" | "rejected" |
     * "disputed" (from "payment_proof_status"); null when the guest has never uploaded one.
     */
    val paymentProofStatus: String? = null,
    /**
     * Why the reviewer turned the last screenshot down (from "payment_reject_reason"); null unless
     * the payment was rejected. This is the admin's own words and the only explanation the guest
     * ever gets — without it a rejection is indistinguishable from never having paid.
     */
    val paymentRejectReason: String? = null,
    /** ISO-8601 timestamp the booking was paid, or null when still unpaid (from "paid_at"). */
    val paidAt: String? = null,
    /** The listing's city / curated area (parsed from "region"); null when absent. */
    val region: String? = null,
    /** Free-text notes the host attached for the guest (parsed from "host_notes"); null when none. */
    val hostNotes: String? = null,
    /**
     * The cancellation policy for this stay: "flexible" | "moderate" | "strict"
     * (parsed from "cancellation_policy"; defaults to "moderate").
     */
    val cancellationPolicy: String = "moderate",
    /** ISO-8601 timestamp the booking was cancelled, or null when still active (from "cancelled_at"). */
    val cancelledAt: String? = null,
    /** Percent of the total refunded on cancel (0–100), or null when never cancelled (from "refund_percent"). */
    val refundPercent: Int? = null
) {
    val totalText: String
        get() = "EGP " + totalPrice.toInt()

    val dateRangeText: String
        get() = "$checkIn → $checkOut"

    /** City shown on the pass: the curated [region] when present, otherwise the [location]. */
    val cityText: String?
        get() = region?.takeUnless { it.isBlank() } ?: location?.takeUnless { it.isBlank() }

    /**
     * Where this reservation sits in the payment flow, decided by [PaymentFlowRules] — the Kotlin
     * twin of the backend's `paymentStageFor`, and the only thing the payment card is allowed to
     * branch on. Testing `payment_status` by hand is what hid a rejection behind a bare "Pay now".
     */
    val paymentStage: PaymentFlowRules.Stage
        get() = PaymentFlowRules.stage(status, paymentStatus, paymentProofStatus, paidAt)

    /** True once the payment has gone through. Unpaid reservations can offer "Pay now". */
    val isPaid: Boolean
        get() = paymentStage == PaymentFlowRules.Stage.Paid

    /** True when the guest may (re)submit a transfer — a rejected screenshot is payable. */
    val canPay: Boolean
        get() = PaymentFlowRules.canPay(paymentStage)

    /**
     * The reviewer's own words on why the last transfer was turned down, shown verbatim to the
     * guest. Null unless this reservation is actually at [PaymentFlowRules.Stage.Rejected], so a
     * reason left on the row from an earlier round can never surface beside a payment that has
     * since been accepted.
     */
    val paymentRejectReasonText: String?
        get() = if (paymentStage == PaymentFlowRules.Stage.Rejected) {
            PaymentFlowRules.rejectReasonText(paymentRejectReason)
        } else {
            null
        }

    /** True while the request is still waiting on the host — no code, and therefore no QR, yet. */
    val isAwaitingApproval: Boolean
        get() = BookingStatus.from(status) == BookingStatus.Pending

    /**
     * True once the host has APPROVED this reservation. NOT the pass gate — see [isLiveStayPass].
     * Approval mints the reservation code, but the guest pays afterwards, so an approved
     * reservation can still owe every piastre.
     */
    val isApproved: Boolean
        get() = when (BookingStatus.from(status)) {
            BookingStatus.Confirmed, BookingStatus.Completed -> true
            else -> false
        }

    /**
     * True once the payment has been APPROVED, per [PaymentFlowRules] — the same rule the server
     * runs. `payment_status == "paid"` is what the backend writes, but [paidAt] is stamped in the
     * same statement and an approved `payment_proofs` row proves it too, so any of the three is
     * enough. A screenshot merely `submitted` (or `disputed`) is not money in the account and is
     * none of them.
     */
    val isPaymentApproved: Boolean
        get() = paymentStage == PaymentFlowRules.Stage.Paid

    /**
     * THE rule for "this reservation's stay pass is live", mirroring the backend's
     * `isLiveStayPass` (src/lib/local/payment-flow-core.ts) and iOS's
     * `ReservationDetail.isLiveStayPass`. One definition on every surface.
     *
     * `confirmed` **AND paid**, plus `completed` unconditionally:
     *  - `confirmed` alone is NOT enough. It only means the host accepted the request; the code is
     *    minted at that transition and payment happens afterwards. Gating on the status alone put a
     *    working QR on the host's and the guest's screen the instant Approve was tapped, for a stay
     *    nobody had paid for.
     *  - `completed` keeps its pass whatever the payment columns say — the stay happened, so the
     *    pass is the guest's receipt of it.
     *  - `pending` never had a code; `cancelled`/`rejected` keep theirs but the pass is dead.
     */
    val isLiveStayPass: Boolean
        get() = when (BookingStatus.from(status)) {
            BookingStatus.Completed -> true
            BookingStatus.Confirmed -> isPaymentApproved
            else -> false
        }

    /**
     * The public stay-pass URL this reservation's QR encodes, or **null when no pass exists yet**.
     * This is the single gate for the QR card, the "open stay pass" tap target and the guest's view
     * of the stay guide: both halves of the rule live here — the booking must be [isLiveStayPass]
     * AND carry a real [reservationCode] (never blank, never the literal "null" — see
     * [ShareLinks.stay]). Anything else shows a placeholder instead.
     */
    val stayPassUrl: String?
        get() = if (isLiveStayPass) ShareLinks.stay(reservationCode) else null

    /**
     * True when [reservationCode] is a usable code — not blank, not the literal "null" that
     * `JSONObject#optString` hands back for a JSON null. The string half of the pass gate, and
     * deliberately the same test [ShareLinks.stay] applies before building a URL. Kept free of
     * `android.net.Uri` so the gate stays assertable in a plain JVM unit test.
     */
    val hasReservationCode: Boolean
        get() = reservationCode?.trim()?.let { it.isNotEmpty() && !it.equals("null", true) } == true

    /** True when there is a real pass to render (QR + code + stay link + guide). */
    val hasStayPass: Boolean
        get() = isLiveStayPass && hasReservationCode

    /**
     * True when the pass is held up by the PAYMENT rather than by the host — the host has approved
     * and the money is what's outstanding. Lets the placeholder say something the guest can act on.
     */
    val isAwaitingPaymentForPass: Boolean
        get() = !hasStayPass && BookingStatus.from(status) == BookingStatus.Confirmed

    /**
     * True when the HOST may still edit the stay guide. Deliberately LOOSER than [hasStayPass] on
     * payment and narrower on status: the backend's stay-guide INSERT requires
     * `b.status = 'confirmed'`, so a `completed` booking would show controls whose Save returns 403,
     * while an unpaid one is fine — the host should be writing their check-in notes while the guest
     * pays. The guest's read-only view stays on [hasStayPass], so nothing reaches them early.
     */
    val canEditStayGuide: Boolean
        get() = BookingStatus.from(status) == BookingStatus.Confirmed && hasReservationCode

    /** True once this reservation has been cancelled. */
    val isCancelled: Boolean
        get() = status.equals("cancelled", ignoreCase = true) ||
            status.equals("canceled", ignoreCase = true)

    /**
     * True when the guest may still cancel: a pending or confirmed reservation that hasn't been
     * cancelled. The backend is authoritative (400 if past check-in / not cancellable); this only
     * gates whether the "Cancel reservation" button is offered.
     */
    val isCancellable: Boolean
        get() = !isCancelled && (
            status.equals("pending", ignoreCase = true) ||
                status.equals("confirmed", ignoreCase = true)
            )

    /** The refunded amount in EGP once cancelled, derived from [refundPercent] × [totalPrice]. */
    val refundedAmount: Int?
        get() = refundPercent?.let { (totalPrice * it / 100.0).toInt() }
}

/**
 * What a [StayGuideItem] is. The four kinds the backend accepts — anything else is rejected there
 * and dropped here, so an unrecognized kind never reaches the UI. [apiValue] is the canonical
 * string sent to / read from the API; [labelRes] is resolved at render time so the host editor's
 * kind picker follows the app's locale and stays RTL-safe.
 */
enum class StayGuideKind(
    val apiValue: String,
    @androidx.annotation.StringRes val labelRes: Int
) {
    /** A titled block of text: check-in steps, Wi-Fi, house rules… */
    Info("info", R.string.stay_guide_kind_info),

    /** A photo for the guide gallery (a `data:` URL from the device picker, or an http(s) image). */
    Photo("photo", R.string.stay_guide_kind_photo),

    /** A link to a place the guest should visit — rendered as a scannable QR plus a tappable button. */
    PlaceQr("place_qr", R.string.stay_guide_kind_place_qr),

    /** A downloadable file (menu, contract, map…) — a `data:` URL or an http(s) link. */
    Attachment("attachment", R.string.stay_guide_kind_attachment);

    /** True when this kind is meaningless without a [StayGuideItem.url]. */
    val requiresUrl: Boolean
        get() = this != Info

    /**
     * Client-side mirror of the backend's URL rules, so the editor can block a bad item before it
     * costs a round trip (the server stays authoritative):
     *  • [Photo] / [Attachment] — a `data:` URL or `http(s)://`, at most [MAX_URL_LENGTH] chars.
     *  • [PlaceQr] — `http(s)://` only. It is a link the guest's phone will OPEN, so an inline
     *    `data:` payload (or anything else, notably `javascript:`) is refused.
     *  • [Info] — carries no URL at all.
     */
    fun isValidUrl(url: String?): Boolean {
        val u = url?.trim().orEmpty()
        if (u.isEmpty()) return !requiresUrl
        if (u.length > MAX_URL_LENGTH) return false
        return when (this) {
            Info -> false
            PlaceQr -> u.startsWith("http://", true) || u.startsWith("https://", true)
            Photo, Attachment ->
                u.startsWith("data:", true) || u.startsWith("http://", true) || u.startsWith("https://", true)
        }
    }

    companion object {
        /** Longest URL/data-URL the backend stores (matches its 3,500,000-char cap). */
        const val MAX_URL_LENGTH = 3_500_000

        /** Longest title/body the editor accepts (the backend caps these too). */
        const val MAX_TITLE_LENGTH = 120
        const val MAX_BODY_LENGTH = 2000

        /** Maps a raw "kind" value to the enum, or **null** when it isn't one of the four. */
        fun from(raw: String?): StayGuideKind? = when (raw?.trim()?.lowercase()) {
            "info" -> Info
            "photo" -> Photo
            "place_qr" -> PlaceQr
            "attachment" -> Attachment
            else -> null
        }
    }
}

/**
 * One host-authored entry on a confirmed booking's stay guide (from
 * `GET /api/local/bookings/:id/stay-guide`). The host builds these on an approved reservation; the
 * guest sees them on the reservation detail and on the public `/stay/<code>` page.
 *
 * [title] / [body] are plain text (never HTML — they are rendered to strangers), [url] carries the
 * photo/attachment payload or the place link, and [order] is the host's chosen position.
 */
data class StayGuideItem(
    val id: String,
    val kind: StayGuideKind,
    val title: String? = null,
    val body: String? = null,
    val url: String? = null,
    val order: Int = 0
) {
    /** The heading to show, falling back to the kind's own label when the host left it blank. */
    val hasTitle: Boolean
        get() = !title.isNullOrBlank()

    /** True when this item points at something a phone can open in a browser (place QR links). */
    val isOpenableLink: Boolean
        get() = kind == StayGuideKind.PlaceQr && !url.isNullOrBlank()
}

/**
 * The host-set cancellation policy for a listing, with its localized name + one-line
 * explanation (string-resource ids resolved at render time via stringResource, so they follow
 * the app's en/ar locale and stay RTL-safe). The canonical [apiValue] is what's sent to / read
 * from the backend.
 *
 * Copy semantics:
 *  • flexible — full refund if cancelled ≥1 day before check-in, else no refund.
 *  • moderate — full refund if cancelled ≥5 days before check-in, else 50%.
 *  • strict   — 50% refund if cancelled ≥7 days before check-in, else no refund.
 */
enum class CancellationPolicy(
    val apiValue: String,
    @androidx.annotation.StringRes val labelRes: Int,
    @androidx.annotation.StringRes val descRes: Int
) {
    Flexible("flexible", R.string.cancel_flexible, R.string.cancel_flexible_desc),
    Moderate("moderate", R.string.cancel_moderate, R.string.cancel_moderate_desc),
    Strict("strict", R.string.cancel_strict, R.string.cancel_strict_desc);

    companion object {
        /** Maps a raw "cancellation_policy" value to the enum; unknown / null → [Moderate]. */
        fun from(raw: String?): CancellationPolicy = when (raw?.trim()?.lowercase()) {
            "flexible" -> Flexible
            "strict" -> Strict
            else -> Moderate
        }
    }
}

/**
 * A cancellation refund quote (from `GET /api/local/bookings/:id/cancel`, no mutation). Tells the
 * guest what they'd get back before they confirm cancelling: the resolved [policy], how many days
 * remain until check-in, the [refundPercent] (0–100) and the matching [refundAmount] in [currency],
 * against the booking [total].
 */
data class CancellationQuote(
    val policy: String,
    val daysUntilCheckIn: Int,
    val refundPercent: Int,
    val refundAmount: Double,
    val total: Double,
    val currency: String
) {
    /** "EGP 1234" — the refund amount formatted for the confirm dialog. */
    val refundAmountText: String
        get() = "$currency ${refundAmount.toInt()}"

    /** "EGP 1500" — the total formatted for the confirm dialog. */
    val totalText: String
        get() = "$currency ${total.toInt()}"
}

/**
 * A reservation request seen by a host (from `GET /api/local/host/bookings`),
 * across all of the host's listings. Carries the [reservationCode] and the
 * guest-facing listing summary so the host can confirm / reject pending requests.
 *
 * [reservationCode] is null on a request the host hasn't approved yet — codes are issued at
 * confirmation, so most rows in the "pending" bucket legitimately have none.
 */
data class HostBooking(
    val id: String,
    /** The "QK-…" code, or null while this request is still pending (no code issued yet). */
    val reservationCode: String?,
    val title: String,
    val location: String?,
    val checkIn: String,
    val checkOut: String,
    val guests: Int,
    val totalPrice: Double,
    val status: String,
    /**
     * The raw `bookings.payment_status` rollup ("unpaid" | "submitted" | "paid" | "rejected" |
     * "disputed", plus the retired gateway's values). Null on an older response that omitted it.
     */
    val paymentState: String? = null,
    /**
     * The latest `payment_proofs.status` — the screenshot's own verdict; null when the guest has
     * never uploaded one. Two columns describe the same thing and can disagree, which is why
     * [PaymentFlowRules] reads both rather than comparing one.
     */
    val paymentProofStatus: String? = null,
    /** Stamped when the payment was approved; null while it is outstanding. */
    val paidAt: String? = null,
    /**
     * Percent of the total refunded on cancel (0–100); null when never cancelled. Splits the
     * Cancelled chip into Cancelled / Refunded / Partially refunded.
     */
    val refundPercent: Int? = null
) {
    val totalText: String
        get() = "EGP " + totalPrice.toInt()

    val dateRangeText: String
        get() = "$checkIn → $checkOut"

    /** Only pending requests get Confirm / Reject actions. */
    val isPending: Boolean
        get() = status.equals("pending", ignoreCase = true)

    /**
     * Where this reservation's money stands, from the one rule the server, the web and iOS all
     * run. Never compare the payment columns by hand — that is how the guest UI once asked for
     * payment a second time on a transfer already under review.
     */
    val paymentStage: PaymentFlowRules.Stage
        get() = PaymentFlowRules.stage(
            status = status,
            paymentState = paymentState,
            proofStatus = paymentProofStatus,
            paidAt = paidAt,
        )

    /** Which status chip this reservation is filed behind. */
    val filterBucket: HostBookingFilterRules.Bucket
        get() = HostBookingFilterRules.bucketFor(
            status = status,
            paymentStage = paymentStage,
            refundPercent = refundPercent,
            // A separate question from the stage, which calls everything cancelled
            // NotPayable and so cannot tell a refund from a booking nobody ever paid for.
            wasPaid = PaymentFlowRules.everPaid(paymentState, paymentProofStatus, paidAt),
        )
}

/**
 * A single chat message on a booking thread (from
 * `GET /api/local/bookings/:id/messages`, oldest-first). The screen decides
 * left/right alignment by comparing [senderId] to the signed-in user's id.
 */
data class ChatMessage(
    val id: String,
    val senderId: String,
    val senderName: String,
    val body: String,
    val createdAt: String
) {
    /** True when this message was sent by the user whose id is [myId]. */
    fun isMine(myId: String?): Boolean = !myId.isNullOrBlank() && senderId == myId
}

/**
 * A standalone bookable experience (jet ski, diving, yacht…) from
 * `GET /api/local/services`. Users "subscribe" to a service, which creates a
 * pending [ServiceRequest] the host then confirms / rejects — mirroring bookings.
 */
data class Service(
    val id: String,
    val hostId: String?,
    val hostName: String?,
    val title: String,
    val description: String?,
    val category: String?,
    val location: String?,
    val price: Double,
    val currency: String?,
    val imageUrl: String?,
    val lat: Double? = null,
    val lng: Double? = null,
    val isPublished: Boolean = true,
    /**
     * The HOST took this service down themselves (parsed from "unpublished_by_host"). HOST READS
     * ONLY — absent on a public feed, where false is the honest answer.
     *
     * The services twin of [Listing.unpublishedByHost], and for the same reason: `service_requests`
     * point at this row, so there is no host-facing delete. "Remove my service" is [isPublished]
     * going false, which the browse list and the request endpoint both honour. Kept as its own
     * flag rather than inferred, so a service STAFF hid is not one the host can republish.
     */
    val unpublishedByHost: Boolean = false,
    /**
     * HOST READS ONLY. Requests still waiting on this host (parsed from "pending_request_count";
     * 0 when absent). Deactivating declines all of them, so the confirmation names this number
     * BEFORE the host commits.
     */
    val pendingRequestCount: Int = 0
) {
    /** The experience photo URL, or null when there is none (render a placeholder instead). */
    val image: String?
        get() = imageUrl?.takeUnless { it.isBlank() }

    /** Prices are shown in Egyptian Pounds across the app. */
    val currencySymbol: String
        get() = "EGP "

    val priceText: String
        get() = "$currencySymbol${price.toInt()}"
}

/**
 * A user's subscription to a [Service] (from `GET /api/local/service-requests` for
 * the user, or `GET /api/local/host/service-requests` for the host inbox). Carries a
 * joined service summary plus the requester's identity so the host can act on it.
 */
data class ServiceRequest(
    val id: String,
    val serviceId: String,
    val userId: String?,
    val status: String,
    val preferredDate: String?,
    val note: String?,
    val requestCode: String?,
    val serviceTitle: String,
    val serviceCategory: String?,
    val serviceImage: String?,
    val servicePrice: Double,
    val serviceCurrency: String?,
    val serviceLocation: String?,
    val hostId: String?,
    val hostName: String?,
    val requesterName: String?,
    val requesterEmail: String?
) {
    /** The experience photo URL, or null when there is none (render a placeholder instead). */
    val imageUrl: String?
        get() = serviceImage?.takeUnless { it.isBlank() }

    /** Prices are shown in Egyptian Pounds across the app. */
    val currencySymbol: String
        get() = "EGP "

    val priceText: String
        get() = "$currencySymbol${servicePrice.toInt()}"

    /** Only pending requests get Accept / Reject actions in the host inbox. */
    val isPending: Boolean
        get() = status.equals("pending", ignoreCase = true)
}

/**
 * An in-app notification (from `GET /api/local/notifications`). The feed shows an
 * unread dot when [read] is false, the [title]/[body], and a relative time derived
 * from [createdAt] — an ISO-8601 timestamp such as `2026-07-27T10:28:00Z`, null when
 * the API omits it (the row then simply shows no time). [link] is an optional in-app
 * deep link the row could route to (currently unused by the Android feed — tapping
 * just marks it read).
 */
data class AppNotification(
    val id: String,
    val type: String,
    val title: String,
    val body: String?,
    val link: String?,
    val read: Boolean,
    val createdAt: String?
)

/**
 * The signed-in user's saved items (from `GET /api/local/wishlist`):
 * the full saved [listings] and [services] (rendered as the redesigned cards) plus the flat
 * id sets used to light up the heart toggles on the browse/detail screens.
 */
data class WishlistData(
    val listings: List<Listing> = emptyList(),
    val services: List<Service> = emptyList(),
    val listingIds: Set<String> = emptySet(),
    val serviceIds: Set<String> = emptySet()
) {
    val isEmpty: Boolean
        get() = listings.isEmpty() && services.isEmpty()
}

/**
 * One unavailable span on a listing's calendar (from
 * `GET /api/local/listings/:id/availability`). The span is half-open `[start, end)` — a stay
 * that checks out on [end] frees that day again — so a day is unavailable iff
 * `start <= day < end`. Dates are `yyyy-MM-dd`.
 *
 * [kind] is `"booked"` (a confirmed/pending guest reservation, read-only for the host) or
 * `"blocked"` (a manual host block, which the host can remove). [note] is an optional host memo
 * shown on blocked spans.
 */
data class AvailabilityRange(
    val id: String,
    val start: String,
    val end: String,
    val kind: String,
    val note: String? = null
) {
    /** True for a manual host block (removable); false for a guest booking (read-only). */
    val isBlock: Boolean
        get() = kind.equals("blocked", ignoreCase = true)

    /** "2030-01-10 → 2030-01-15" (the half-open end day is shown as the checkout date). */
    val dateRangeText: String
        get() = "$start → $end"
}

/**
 * Trust signals attached to a public profile (from `GET /api/local/users/:id`'s `badges`
 * object). Every flag defaults to a safe "off" value so a missing/partial badges object simply
 * renders no chips. Used to render the reusable trust-badge chips on the listing detail.
 */
data class TrustBadges(
    /** The user completed identity verification (`verified`). Drives the "Verified ✓" chip. */
    val verified: Boolean = false,
    /** A highly-rated, experienced host (`superhost`). Drives the "Superhost" chip. */
    val superhost: Boolean = false,
    /** A recently-joined host with few/no stays yet (`newHost`). Drives the "New host" chip. */
    val newHost: Boolean = false,
    /** True when this account hosts at least one listing (`isHost`). */
    val isHost: Boolean = false,
    /** Number of completed stays the host has hosted (`completedStays`). */
    val completedStays: Int = 0,
    /** Number of reviews backing the host's rating (`reviewCount`). */
    val reviewCount: Int = 0,
    /** The host's average rating, 0.0 when unrated (`hostRating`). */
    val hostRating: Double = 0.0,
    /** ISO-8601 timestamp the account was created, or null when absent (`memberSince`). */
    val memberSince: String? = null
)

/**
 * A public, privacy-safe view of another user (from `GET /api/local/users/:id`). Carries NO
 * email / phone / id — only what's safe to show a guest browsing a host: display name, avatar,
 * bio, the guest-facing [verificationStatus], the host's [guestRating] summary, and the
 * computed [badges] used to render trust chips.
 */
data class PublicProfile(
    val id: String,
    val fullName: String?,
    val avatarUrl: String?,
    val bio: String?,
    /** "unverified" | "pending" | "verified" | "rejected" (parsed from "verification_status"). */
    val verificationStatus: String = "unverified",
    /** The host's average guest rating, 0.0 when unrated (parsed from "guest_rating"). */
    val guestRating: Double = 0.0,
    /** Number of guest reviews backing [guestRating] (parsed from "guest_review_count"). */
    val guestReviewCount: Int = 0,
    val badges: TrustBadges = TrustBadges()
)

/**
 * One review written about a host's listings (from `GET /api/local/users/:id/reviews`, public).
 * Shown on the host profile so a guest can read what past guests said across the host's stays.
 * [createdAt] is an ISO-8601 timestamp; [reviewerName] is the guest who wrote it; [listingTitle]
 * is the stay the review is about (so the card can show "· {listing}"). [photos] are the
 * reviewer's attached photo URLs (each a `data:image/…` data URL or an `http(s)` URL), empty when none.
 */
data class HostReview(
    val id: String,
    val rating: Int,
    val comment: String?,
    val photos: List<String> = emptyList(),
    val createdAt: String?,
    val reviewerName: String?,
    val listingId: String?,
    val listingTitle: String?
)

// ---- Money views (Section 9 — all MOCK) -------------------------------------

/**
 * Whether this host may add a listing, and if not, why (`GET /api/local/host/listing-gate`).
 *
 * The create endpoint enforces the same rule and returns the same [code] on 403; this
 * exists so the app can say so BEFORE the host fills in a whole listing. Switch on
 * [code], never on [message] — the wording is server-owned and shared with the website,
 * but the call to action differs per case.
 */
data class ListingGate(
    val allowed: Boolean = true,
    /** ok | not_host | verification_missing | verification_pending | verification_rejected */
    val code: String = "ok",
    /** Shown to the host verbatim. */
    val message: String = "",
    /** The reviewer's reason. Present only when the documents were rejected. */
    val reason: String? = null,
) {
    /** A short heading for the blocked state. */
    val title: String
        get() = when (code) {
            "not_host" -> "Become a host first"
            "verification_pending" -> "We're reviewing your documents"
            "verification_rejected" -> "Your documents need another look"
            else -> "Verify your identity to start listing"
        }

    companion object {
        /** Assume allowed until told otherwise: a failed fetch must not lock a legitimate
         *  host out of their own app. The server refuses the write regardless. */
        val UNKNOWN = ListingGate()
    }
}

/**
 * The platform commission (`GET /api/local/host/commission`).
 *
 * QuickIn takes its cut as a MARKUP, not a deduction: a host names the price they want to
 * receive and is paid it in full; a guest is quoted `raw × (1 + rate)`, rounded UP to the
 * nearest 10 EGP. This exists so the add/edit-listing screens can show the host that second
 * number as they type.
 *
 * [guestPrice] must round exactly as the server does — the rule lives in
 * `src/lib/local/commission-core.ts` (`withCommission` / `roundUpToStep`) in both
 * quickin-backend and quickin-frontend. Change it there and you must change it here and in
 * the iOS `CommissionInfo` too.
 */
data class Commission(
    /** The commission as a fraction, e.g. 0.1 = 10%. */
    val rate: Double = 0.0,
    /** The same value as a percentage, e.g. 10.0. */
    val percent: Double = 0.0,
) {
    /**
     * What a guest is quoted for a host's raw price, or null when no price is set yet — the
     * caller shows nothing rather than "EGP 0".
     */
    fun guestPrice(raw: Double): Double? {
        if (raw <= 0.0 || raw.isNaN()) return null
        // Settle to piasters before rounding up: `100 * 1.1` is 110.00000000000001 in binary
        // floating point, and a naive ceil would bill 120.
        val settled = Math.round(raw * (1 + rate) * 100.0) / 100.0
        return Math.ceil(settled / 10.0) * 10.0
    }

    /** The commission as a whole percent for display, e.g. "10". */
    val percentText: String
        get() = if (percent == Math.floor(percent)) percent.toInt().toString() else percent.toString()
}

/**
 * The signed-in host's earnings summary (from `GET /api/local/host/earnings`, Bearer). All amounts
 * are in EGP (the platform base currency); the UI converts them for display via [CurrencyManager].
 * [totalEarned] is what the HOST earns across paid-out + upcoming stays, [paidOut] what's already
 * been released, [pending] what's still upcoming, and [commissionRate] the live platform rate as a
 * fraction (e.g. 0.1). Nothing here is reduced by it: the commission is charged on top to the guest,
 * never withheld from the host, so [guestPaid] minus [totalEarned] is the platform's cut.
 * [recent] is the per-booking breakdown shown under the stat cards, which now INCLUDES cancelled
 * bookings the host kept money on — a cancellation refunds a share of the stay, not all of it, so
 * dropping the row (which the backend used to do) deducted earnings for a refund that never happened.
 */
data class HostEarnings(
    val currency: String = "EGP",
    val totalEarned: Double = 0.0,
    val paidOut: Double = 0.0,
    val pending: Double = 0.0,
    val bookingsCount: Int = 0,
    /** The live platform rate (e.g. 0.1 = 10%). Shown to the host as "guests pay N% above your
     *  price" — it is NOT deducted from any figure here. */
    val commissionRate: Double = 0.0,
    /** What guests paid in total across the same bookings. */
    val guestPaid: Double = 0.0,
    val recent: List<HostEarningItem> = emptyList()
) {
    /** The commission cut formatted as a whole percent, e.g. "10%". */
    val commissionPercentText: String
        get() = "${(commissionRate * 100).toInt()}%"
}

/**
 * One booking in a host's earnings breakdown (an entry in [HostEarnings.recent]). [gross] is what
 * the guest paid (commission-inclusive) and [net] what this host earns — under the markup model
 * their FULL raw price, so `gross - net` is the platform's cut, not a deduction. Both EGP. [status] is "paid_out"
 * (already released) or "upcoming" (still pending); [paidAt] is the ISO-8601 payout timestamp,
 * null while upcoming.
 *
 * When [cancelled] is true both amounts are already net of [refundPercent] — a cancellation the
 * guest was refunded 50% of leaves half the stay's money behind, and the host keeps half of their
 * price. Such a row always reads "paid_out": the stay will never happen, so nothing is pending.
 */
data class HostEarningItem(
    val bookingId: String,
    val title: String,
    val checkIn: String,
    val checkOut: String,
    val gross: Double,
    val net: Double,
    /** "paid_out" | "upcoming" (parsed from "status"); defaults to "upcoming". */
    val status: String = "upcoming",
    /** ISO-8601 payout timestamp, or null while the stay is still upcoming (from "paid_at"). */
    val paidAt: String? = null,
    /** True when the booking was cancelled and the host still kept part (or all) of it. Absent on
     *  older backends, which never returned cancelled rows at all — so `false` is the right default. */
    val cancelled: Boolean = false,
    /** Share of the guest's money returned, 0–100. Only meaningful when [cancelled]. */
    val refundPercent: Int = 0
) {
    /** True for a cancellation the guest was refunded nothing on — the host keeps their full price. */
    val keptInFull: Boolean
        get() = cancelled && refundPercent <= 0

    /** "2027-03-10 → 2027-03-14" */
    val dateRangeText: String
        get() = "$checkIn → $checkOut"

    /** True once this booking's net has been released to the host. */
    val isPaidOut: Boolean
        get() = status.equals("paid_out", ignoreCase = true)
}

/**
 * A guest's itemized receipt for a paid stay (an entry in `GET /api/local/receipts`, Bearer). All
 * amounts are EGP; the UI converts them for display via [CurrencyManager]. Mirrors the booking
 * receipt: [subtotal] (nights × nightly), [serviceFee] (10%), the signed [methodFee] (card +5% /
 * bank −5%), an optional [promoDiscount] for [promoCode], and the net [total]. [reservationCode]
 * is the "QK-…" code and [paidAt] the ISO-8601 payment timestamp.
 */
data class GuestReceipt(
    val bookingId: String,
    /** The "QK-…" code; null on the rare receipt whose booking never had one assigned. */
    val reservationCode: String?,
    val title: String,
    val checkIn: String,
    val checkOut: String,
    val nights: Int,
    val subtotal: Double,
    val serviceFee: Double,
    /** The payment method ("card" | "bank_transfer" | "mock"); defaults to "mock". */
    val method: String = "mock",
    /** Signed payment-method adjustment in EGP (+ card surcharge / − bank discount); 0 for mock. */
    val methodFee: Double = 0.0,
    /** The applied promo code, or null when none was used. */
    val promoCode: String? = null,
    /** EGP discounted by the applied promo (0 when none); the [total] already nets this. */
    val promoDiscount: Double = 0.0,
    val total: Double,
    /** ISO-8601 payment timestamp (from "paidAt"). */
    val paidAt: String? = null,
    val currency: String = "EGP"
) {
    /** "2027-03-10 → 2027-03-14" */
    val dateRangeText: String
        get() = "$checkIn → $checkOut"

    /** True when a promo code was applied and actually reduced the total. */
    val hasPromo: Boolean
        get() = !promoCode.isNullOrBlank() && promoDiscount > 0.0
}

/**
 * Static FX rates for multi-currency DISPLAY (from `GET /api/local/currencies`). [base] is the
 * platform currency (EGP) and [rates] maps each supported code to the multiplier applied to an EGP
 * amount, i.e. `amountInTarget = amountEgp * rates[target]`. Used by [CurrencyManager]; bookings and
 * payments always stay in EGP regardless of the chosen display currency.
 */
data class CurrencyRates(
    val base: String = "EGP",
    val rates: Map<String, Double> = emptyMap()
)

// ---- Section 10 — AI writer + NL search + host analytics --------------------

/**
 * The signed-in host's performance dashboard (from `GET /api/local/host/analytics`, Bearer). All
 * money amounts are in EGP (the platform base currency); the UI converts them for display via
 * [CurrencyManager]. [conversionRate] is the share of total bookings that ended up paid, as a
 * fraction (e.g. 0.42 = 42%). [byMonth] is the recent monthly trend (oldest→newest) drawn as a
 * simple bar chart, and [topListings] the host's best-performing stays by bookings/revenue.
 */
data class HostAnalytics(
    val currency: String = "EGP",
    /** Number of the host's published listings. */
    val listings: Int = 0,
    /** Every booking across the host's listings (any status). */
    val totalBookings: Int = 0,
    /** Bookings that have been paid (the conversion numerator). */
    val paidBookings: Int = 0,
    /** Bookings the guest/host cancelled. */
    val cancelledBookings: Int = 0,
    /** Gross revenue from paid stays, in [currency]. */
    val revenue: Double = 0.0,
    /** Average guest rating across the host's listings, 0.0 when unrated. */
    val avgRating: Double = 0.0,
    /** Number of reviews backing [avgRating]. */
    val reviewCount: Int = 0,
    /** Share of total bookings that converted to paid, as a fraction 0..1 (e.g. 0.42). */
    val conversionRate: Double = 0.0,
    /** Recent monthly trend (oldest→newest) for the bar chart. */
    val byMonth: List<AnalyticsMonth> = emptyList(),
    /** The host's best-performing listings (by bookings/revenue). */
    val topListings: List<TopListing> = emptyList()
) {
    /** "4.9" — the average rating to one decimal for the stat card. */
    val avgRatingText: String
        get() = String.format(java.util.Locale.US, "%.1f", avgRating)

    /** "42%" — the conversion rate as a whole percent for the stat card. */
    val conversionPercentText: String
        get() = "${Math.round(conversionRate * 100).toInt()}%"

    /** True when there is no activity at all (no listings + no bookings) — drives the empty state. */
    val isEmpty: Boolean
        get() = listings == 0 && totalBookings == 0
}

/**
 * One month in the host's [HostAnalytics.byMonth] trend. [month] is a short label the backend
 * supplies (e.g. "2027-03" or "Mar"), [bookings] the count that month, and [revenue] the EGP that
 * month — the bar height is derived from these against the max in the series.
 */
data class AnalyticsMonth(
    val month: String,
    val bookings: Int = 0,
    val revenue: Double = 0.0
)

/**
 * One of the host's best-performing listings (an entry in [HostAnalytics.topListings]): the stay's
 * [title] with its [bookings] count and [revenue] (EGP) over the analytics window.
 */
data class TopListing(
    val title: String,
    val bookings: Int = 0,
    val revenue: Double = 0.0
)

/**
 * The filters the AI parsed out of a guest's plain-language search (a subset of [ListingQuery]'s
 * fields, from `POST /api/local/ai/search`). Every field is optional — only the ones the AI could
 * infer are set. Rendered as chips above the results so the guest can see how their words were
 * understood. [hasAny] gates whether the chip row shows at all.
 */
data class AiSearchFilters(
    /** Free-text keyword the AI kept (`q`); null when none. */
    val q: String? = null,
    /** Curated region the AI matched (e.g. "North Coast"); null when none. */
    val region: String? = null,
    /** Guest count the AI inferred; null when unstated. */
    val guests: Int? = null,
    /** Minimum nightly price in EGP; null when unstated. */
    val minPrice: Int? = null,
    /** Maximum nightly price in EGP; null when unstated. */
    val maxPrice: Int? = null,
    /** Property type the AI matched (Apartment | Chalet | House | Villa); null when none. */
    val propertyType: String? = null,
    /** Amenities the AI required (e.g. "WiFi", "Pool"); empty when none. */
    val amenities: List<String> = emptyList()
) {
    /** True when the AI inferred at least one filter (so the chip row is worth showing). */
    val hasAny: Boolean
        get() = !q.isNullOrBlank() || !region.isNullOrBlank() || (guests != null && guests > 0) ||
            minPrice != null || maxPrice != null || !propertyType.isNullOrBlank() || amenities.isNotEmpty()
}

/**
 * The result of a natural-language search (`POST /api/local/ai/search`): the [filters] the AI
 * parsed from the guest's prose and the matching [listings] (same shape as the explore feed).
 */
data class AiSearchResult(
    val filters: AiSearchFilters = AiSearchFilters(),
    val listings: List<Listing> = emptyList()
)

/** Normalized booking/reservation status, for a colored status badge. */
enum class BookingStatus(val label: String) {
    Pending("Pending"),
    Confirmed("Confirmed"),
    Rejected("Rejected"),
    Cancelled("Cancelled"),
    Completed("Completed"),
    Other("");

    companion object {
        fun from(raw: String?): BookingStatus = when (raw?.trim()?.lowercase()) {
            "pending" -> Pending
            "confirmed" -> Confirmed
            "rejected", "declined" -> Rejected
            "cancelled", "canceled" -> Cancelled
            "completed" -> Completed
            else -> Other
        }
    }
}

/**
 * What kind of host an applicant is, chosen on the "Apply to host" form and stored as the
 * account's `host_type`. [apiValue] is the canonical value the backend accepts
 * ("individual" | "company" | "brokerage"); [labelRes] is resolved at render time so the picker
 * follows the app's locale and stays RTL-safe.
 */
enum class HostType(
    val apiValue: String,
    @androidx.annotation.StringRes val labelRes: Int
) {
    Individual("individual", R.string.host_type_individual),
    Company("company", R.string.host_type_company),
    Brokerage("brokerage", R.string.host_type_brokerage);

    companion object {
        /** Maps a raw "host_type" value to the enum; unknown / null → [Individual]. */
        fun from(raw: String?): HostType = when (raw?.trim()?.lowercase()) {
            "company" -> Company
            "brokerage" -> Brokerage
            else -> Individual
        }
    }
}
