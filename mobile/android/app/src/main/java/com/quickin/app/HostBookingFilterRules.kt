package com.quickin.app

/**
 * Which bucket a host's reservation sits in, and which chips the filter row offers.
 *
 * The Kotlin twin of `host-booking-filter-core.ts` in the web repo and `HostBookingFilterRules`
 * on iOS. Keeping one rule on all three sides is the point: a bucket is not a column, it is a
 * fold, and three hand-rolled folds would give a host three different answers to "how many
 * reservations are waiting on payment".
 *
 * ## Why this is not just `bookings.status`
 *
 * `bookings.status` holds only five values (pending | confirmed | completed | rejected |
 * cancelled). Three of the buckets a host actually thinks in come from other columns:
 *
 *  * **Awaiting payment** — confirmed, but the money has not landed. That lives in
 *    `payment_status` against the latest `payment_proofs` row, which [PaymentFlowRules] already
 *    folds into a stage.
 *  * **Refunded** / **Partially refunded** — a cancellation carries `refund_percent` (0–100),
 *    written from the listing's cancellation policy at the moment the guest cancels.
 *
 * So a bucket is a function of (status, payment stage, refund percent). This object owns that
 * fold and nothing else re-derives it.
 *
 * Pure: no Compose, no network, no string resources. The chip labels are resolved at render time
 * from [HostBookingFilter.labelRes], so the row follows the app's locale and stays RTL-safe.
 */
object HostBookingFilterRules {

    /**
     * The bucket a reservation is shown under. A reservation is in exactly one, so the counts
     * always sum to the total.
     */
    enum class Bucket {
        Pending,
        AwaitingPayment,
        Confirmed,
        Rejected,
        Cancelled,
        Refunded,
        PartiallyRefunded,
    }

    /**
     * The five values `bookings.status` is allowed to hold, mirrored from `BOOKING_STATUSES` in
     * the backend's `admin.ts`.
     *
     * The column is plain text with NO check constraint, so this is advisory — [bucketFor] treats
     * an unrecognised value as [Bucket.Pending] rather than dropping the row.
     */
    val BOOKING_STATUSES = setOf("pending", "confirmed", "completed", "rejected", "cancelled")

    /**
     * Which bucket a reservation belongs in.
     *
     * Order matters, and it is the host's reading order rather than the database's:
     *
     *  1. Pending wins outright — a request waiting on the host is the one thing they must act
     *     on, whatever its payment columns say. (A guest can upload a transfer screenshot before
     *     the host has even replied.)
     *  2. Rejected and cancelled are terminal, so they are read BEFORE payment: a dead
     *     reservation must never surface under "Awaiting payment", which is a to-do list of money
     *     that is still coming.
     *  3. A cancellation splits three ways on the refund — see [cancelledBucket].
     *  4. Everything still alive splits on the payment stage.
     *
     * `completed` folds into [Bucket.Confirmed]. A completed stay is a confirmed one that has
     * finished — it is reachable only from confirmed, the guest has paid, and finished stays were
     * not asked for as a chip of their own. If a "Past" bucket is ever wanted, it splits off here
     * and nowhere else.
     *
     * An unrecognised status reads as [Bucket.Pending] rather than being dropped. The column has
     * no check constraint, and the failure modes are not symmetric: a row that matches no chip is
     * a reservation the host never learns about, while one under Pending is merely a row they
     * glance at and dismiss.
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
            "confirmed", "completed" ->
                if (paymentStage == PaymentFlowRules.Stage.Paid) Bucket.Confirmed
                else Bucket.AwaitingPayment
            // "pending", and anything the vocabulary does not cover.
            else -> Bucket.Pending
        }
    }

    /**
     * How a cancellation splits between Cancelled / Refunded / Partially refunded.
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
        // "Refunded": money back that was never money in, shown to a host who never received it.
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
 * The status filter above the host's reservations: All · Awaiting your reply · Awaiting payment ·
 * Confirmed · Declined · Cancelled · Refunded · Partially refunded.
 *
 * "Declined" (the host turned the request down) is its own chip rather than being folded into
 * "Cancelled". They are separate values in the database, a host caused one and a guest the other,
 * and [ui.StatusBadge] has always shown them apart — merging them would make both counts lie.
 *
 * [labelRes] is resolved at render time so the chip row follows the app's locale and stays
 * RTL-safe, matching [HostType] and the rest of the host area.
 */
enum class HostBookingFilter(
    @androidx.annotation.StringRes val labelRes: Int,
    /** The bucket this chip selects, or null for the "All" catch-all. */
    val bucket: HostBookingFilterRules.Bucket?,
) {
    All(R.string.filter_all, null),
    Pending(R.string.host_booking_filter_pending, HostBookingFilterRules.Bucket.Pending),
    AwaitingPayment(
        R.string.host_booking_filter_awaiting_payment,
        HostBookingFilterRules.Bucket.AwaitingPayment,
    ),
    Confirmed(R.string.host_booking_filter_confirmed, HostBookingFilterRules.Bucket.Confirmed),
    Rejected(R.string.host_booking_filter_rejected, HostBookingFilterRules.Bucket.Rejected),
    Cancelled(R.string.host_booking_filter_cancelled, HostBookingFilterRules.Bucket.Cancelled),
    Refunded(R.string.host_booking_filter_refunded, HostBookingFilterRules.Bucket.Refunded),
    PartiallyRefunded(
        R.string.host_booking_filter_partially_refunded,
        HostBookingFilterRules.Bucket.PartiallyRefunded,
    );

    /** True when a reservation in [bucket] belongs under this chip. */
    fun matches(bucket: HostBookingFilterRules.Bucket): Boolean =
        this == All || this.bucket == bucket

    /** Short muted note shown when the host has reservations but none in this status. */
    @get:androidx.annotation.StringRes
    val emptyMessageRes: Int
        get() = if (this == All) R.string.host_booking_filter_empty_all
        else R.string.host_booking_filter_empty_filtered
}
