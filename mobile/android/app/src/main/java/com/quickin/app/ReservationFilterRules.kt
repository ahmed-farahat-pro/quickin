package com.quickin.app

/**
 * Which bucket a GUEST's reservation sits in, and which chips the Trips filter row offers.
 *
 * The Kotlin twin of `reservation-filter-core.ts` in the web repo and `ReservationFilterRules` on
 * iOS — and the guest-side sibling of [HostBookingFilterRules], which does the same job for the
 * host's inbox.
 *
 * ## What the guest needs that the host does not
 *
 * The two modules answer the same question for different readers, so they share their fold
 * everywhere they can and part in exactly two places:
 *
 *  * **Payment under review** is a chip here, folded into *Awaiting payment* there. To a host
 *    those are one to-do ("no money yet"); to the GUEST they are opposites — one means "send the
 *    transfer", the other means "we have it, sit tight". A guest shown "Awaiting payment" for a
 *    screenshot they already uploaded pays twice.
 *  * **Completed** is a chip here, folded into *Confirmed* there. A guest's finished stays are
 *    their trip history, which people go looking for; a host's are just old rows.
 *
 * Everything else — the cancelled/refunded split, the clamping, the unknown-status fallback — is
 * the SAME rule as [HostBookingFilterRules], on purpose. A host and a guest looking at one
 * reservation must never see it filed differently.
 *
 * The payment stage is passed IN rather than derived here, exactly as in the host module:
 * [PaymentFlowRules] is already the single source of truth for that, and a second opinion beside
 * it is the defect that rule exists to prevent.
 *
 * Pure: no Compose, no network, no string resources. The chip labels are resolved at render time
 * from [ReservationFilter.labelRes], so the row follows the app's locale and stays RTL-safe.
 */
object ReservationFilterRules {

    /**
     * The bucket a reservation is shown under. A reservation is in exactly one, so the counts
     * always sum to the total.
     */
    enum class Bucket {
        Pending,
        AwaitingPayment,
        UnderReview,
        Confirmed,
        Completed,
        Rejected,
        Cancelled,
        Refunded,
        PartiallyRefunded,
    }

    /**
     * Which bucket a reservation belongs in.
     *
     * Order matters, and it is the guest's reading order:
     *
     *  1. Rejected and cancelled are terminal, so they are read BEFORE payment — a dead
     *     reservation must never surface under "Awaiting payment", which is a list of money the
     *     guest still owes.
     *  2. A cancellation splits three ways on the refund — see [cancelledBucket].
     *  3. `completed` is read before the payment split: the stay happened, and what its payment
     *     columns say now cannot change that.
     *  4. Everything still alive splits on the payment stage — and unlike the host module,
     *     [Bucket.UnderReview] keeps a bucket of its own.
     *
     * An unrecognised status reads as [Bucket.Pending] rather than being dropped, matching the
     * host module. The column has no check constraint, and the failure modes are not symmetric: a
     * row behind no chip is a reservation the guest never finds again, while one under Pending is
     * merely a row they glance at.
     *
     * @param paymentStage the stage from [PaymentFlowRules.stage] — never re-derived here. Null
     *   when the caller has no payment columns to offer, which reads as "not paid", never as paid.
     * @param wasPaid whether money ever reached us, from [PaymentFlowRules.everPaid] — a different
     *   question from [paymentStage], which calls everything cancelled [PaymentFlowRules.Stage.NotPayable]
     *   and so cannot answer it. No default value, deliberately: one would let a call site keep
     *   the never-paid-cancellation bug by saying nothing.
     */
    fun bucketFor(
        status: String?,
        paymentStage: PaymentFlowRules.Stage?,
        refundPercent: Int?,
        wasPaid: Boolean,
    ): Bucket {
        return when (status?.trim()?.lowercase().orEmpty()) {
            "rejected" -> Bucket.Rejected
            "cancelled", "canceled" -> cancelledBucket(refundPercent, wasPaid)
            // The stay happened. A completed booking is the guest's trip history whatever the
            // payment columns say now — historical rows must not lose it retroactively.
            "completed" -> Bucket.Completed
            "confirmed" -> when (paymentStage) {
                PaymentFlowRules.Stage.Paid -> Bucket.Confirmed
                // The guest has uploaded their transfer and is waiting on US. Calling this
                // "awaiting payment" is what makes people pay a second time.
                PaymentFlowRules.Stage.UnderReview -> Bucket.UnderReview
                // AwaitingPayment, Rejected (re-upload a clearer screenshot — still payable, per
                // PaymentFlowRules.canPay), the NotPayable a confirmed booking should never
                // reach, and a stage the caller could not supply.
                else -> Bucket.AwaitingPayment
            }
            // "pending", and anything the vocabulary does not cover.
            else -> Bucket.Pending
        }
    }

    /**
     * How a cancellation splits between Cancelled / Refunded / Partially refunded.
     *
     * Line for line the rule in [HostBookingFilterRules], and that is the point — a host and a
     * guest looking at the same cancelled reservation must read the same word.
     *
     * `refund_percent` is a PERCENT OF THE TOTAL, not a flag — 100 means the whole stay came
     * back, 1–99 means the policy kept a slice, and 0 (the strict-policy or day-of-check-in case)
     * means nothing came back at all.
     *
     * A null percent is a cancellation from before the refund ladder shipped. It reads as plain
     * "Cancelled", which is the honest answer — no refund was ever recorded. Percents outside
     * 0–100 are clamped rather than trusted.
     */
    private fun cancelledBucket(refundPercent: Int?, wasPaid: Boolean): Bucket {
        // [wasPaid] is asked FIRST, and it is why this is not a one-line column read.
        // `refund_percent` is stamped from the listing's cancellation policy the moment a guest
        // cancels, whether or not a single pound was ever paid — so a pending, never-paid booking
        // cancelled a fortnight out carries 100. Splitting on the column alone called that
        // "Refunded": money back that was never money in, told to the guest who never paid it.
        if (!wasPaid) return Bucket.Cancelled
        val pct = refundPercent?.coerceIn(0, 100) ?: return Bucket.Cancelled
        return when {
            pct >= 100 -> Bucket.Refunded
            pct > 0 -> Bucket.PartiallyRefunded
            else -> Bucket.Cancelled
        }
    }

    /**
     * How many reservations sit behind each bucket. Every bucket gets an entry, zeros included,
     * so a chip can never read a missing count.
     */
    fun counts(buckets: List<Bucket>): Map<Bucket, Int> =
        Bucket.entries.associateWith { bucket -> buckets.count { it == bucket } }
}

/**
 * The chips over the guest's Trips list, in display order — the reservation lifecycle left to
 * right: waiting on the host, waiting on their own transfer, waiting on us, live, done, then the
 * ways it ends.
 *
 * "Declined" (the host turned the request down) is its own chip rather than being folded into
 * "Cancelled", for the same reason it is on the host side: they are separate values in the
 * database, a host caused one and the guest the other, and the status badge shows them apart.
 *
 * [labelRes] is resolved at render time so the chip row follows the app's locale and stays
 * RTL-safe, matching [HostBookingFilter].
 */
enum class ReservationFilter(
    @androidx.annotation.StringRes val labelRes: Int,
    /** The bucket this chip selects, or null for the "All" catch-all. */
    val bucket: ReservationFilterRules.Bucket?,
    /** Muted note shown when the guest has reservations but none in this status. */
    @androidx.annotation.StringRes val emptyMessageRes: Int,
) {
    All(R.string.filter_all, null, R.string.reservation_filter_empty_all),
    Pending(
        R.string.reservation_filter_pending,
        ReservationFilterRules.Bucket.Pending,
        R.string.reservation_filter_empty_pending,
    ),
    AwaitingPayment(
        R.string.reservation_filter_awaiting_payment,
        ReservationFilterRules.Bucket.AwaitingPayment,
        R.string.reservation_filter_empty_awaiting_payment,
    ),
    UnderReview(
        R.string.reservation_filter_under_review,
        ReservationFilterRules.Bucket.UnderReview,
        R.string.reservation_filter_empty_under_review,
    ),
    Confirmed(
        R.string.reservation_filter_confirmed,
        ReservationFilterRules.Bucket.Confirmed,
        R.string.reservation_filter_empty_confirmed,
    ),
    Completed(
        R.string.reservation_filter_completed,
        ReservationFilterRules.Bucket.Completed,
        R.string.reservation_filter_empty_completed,
    ),
    Rejected(
        R.string.reservation_filter_rejected,
        ReservationFilterRules.Bucket.Rejected,
        R.string.reservation_filter_empty_rejected,
    ),
    Cancelled(
        R.string.reservation_filter_cancelled,
        ReservationFilterRules.Bucket.Cancelled,
        R.string.reservation_filter_empty_cancelled,
    ),
    Refunded(
        R.string.reservation_filter_refunded,
        ReservationFilterRules.Bucket.Refunded,
        R.string.reservation_filter_empty_refunded,
    ),
    PartiallyRefunded(
        R.string.reservation_filter_partially_refunded,
        ReservationFilterRules.Bucket.PartiallyRefunded,
        R.string.reservation_filter_empty_partially_refunded,
    );

    /** True when a reservation in [bucket] belongs under this chip. */
    fun matches(bucket: ReservationFilterRules.Bucket): Boolean =
        this == All || this.bucket == bucket
}
