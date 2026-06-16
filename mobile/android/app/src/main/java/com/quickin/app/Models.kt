package com.quickin.app

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
    /** Id of the host that owns this listing (parsed from "host_id"); null when absent. */
    val hostId: String? = null,
    /** Display name of the host (parsed from "host_name"); null when absent. */
    val hostName: String? = null,
    /** Curated area the listing belongs to (e.g. "North Coast", "El Gouna"); null when unset. */
    val region: String? = null,
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
    val monthlyDiscount: Int = 0
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

    /** True when the host offers any length-of-stay discount (weekly or monthly). */
    val hasStayDiscount: Boolean
        get() = weeklyDiscount > 0 || monthlyDiscount > 0
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

    /** True once the (mock) payment has gone through — the booking is paid + confirmed. */
    val isPaid: Boolean
        get() = paymentStatus.equals("paid", ignoreCase = true)

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
 */
data class Reservation(
    val id: String,
    val reservationCode: String,
    val status: String,
    val title: String,
    val location: String?,
    val checkIn: String,
    val checkOut: String,
    val guests: Int,
    val totalPrice: Double,
    /** Payment state, "unpaid" | "paid" (parsed from "payment_status"); defaults to "unpaid". */
    val paymentStatus: String = "unpaid",
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

    /** True once the (mock) payment has gone through. Unpaid reservations can offer "Pay now". */
    val isPaid: Boolean
        get() = paymentStatus.equals("paid", ignoreCase = true)

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
 */
data class HostBooking(
    val id: String,
    val reservationCode: String,
    val title: String,
    val location: String?,
    val checkIn: String,
    val checkOut: String,
    val guests: Int,
    val totalPrice: Double,
    val status: String
) {
    val totalText: String
        get() = "EGP " + totalPrice.toInt()

    val dateRangeText: String
        get() = "$checkIn → $checkOut"

    /** Only pending requests get Confirm / Reject actions. */
    val isPending: Boolean
        get() = status.equals("pending", ignoreCase = true)
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
    val isPublished: Boolean = true
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
 * from [createdAt] (ISO-8601). [link] is an optional in-app deep link the row could
 * route to (currently unused by the Android feed — tapping just marks it read).
 */
data class AppNotification(
    val id: String,
    val type: String,
    val title: String,
    val body: String?,
    val link: String?,
    val read: Boolean,
    val createdAt: String
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
 * The signed-in host's earnings summary (from `GET /api/local/host/earnings`, Bearer). All amounts
 * are in EGP (the platform base currency); the UI converts them for display via [CurrencyManager].
 * [totalEarned] is the gross across paid-out + upcoming stays, [paidOut] what's already been released,
 * [pending] what's still upcoming, and [commissionRate] the platform cut as a fraction (e.g. 0.1).
 * [recent] is the per-booking breakdown shown under the stat cards.
 */
data class HostEarnings(
    val currency: String = "EGP",
    val totalEarned: Double = 0.0,
    val paidOut: Double = 0.0,
    val pending: Double = 0.0,
    val bookingsCount: Int = 0,
    /** Platform commission as a fraction of gross (e.g. 0.1 = 10%); shown as a whole percent. */
    val commissionRate: Double = 0.0,
    val recent: List<HostEarningItem> = emptyList()
) {
    /** The commission cut formatted as a whole percent, e.g. "10%". */
    val commissionPercentText: String
        get() = "${(commissionRate * 100).toInt()}%"
}

/**
 * One booking in a host's earnings breakdown (an entry in [HostEarnings.recent]). [gross] is the
 * guest's total and [net] the host's take after commission, both EGP. [status] is "paid_out"
 * (already released) or "upcoming" (still pending); [paidAt] is the ISO-8601 payout timestamp,
 * null while upcoming.
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
    val paidAt: String? = null
) {
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
    val reservationCode: String,
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
