package com.quickin.app

/**
 * Where a booking sits in the manual-transfer payment flow.
 *
 * The Kotlin twin of `paymentStageFor` / `canPay` in the backend's
 * `src/lib/local/payment-flow-core.ts` — the file the website's pay page and the API both run —
 * and of iOS's `PaymentFlowRules.swift`. Keeping one rule on all three sides is the point: the
 * reported defect was each app deciding payment state by hand (`payment_status == "submitted"`)
 * and arriving at an answer neither the server nor the web agreed with.
 *
 * Two columns describe the same thing and can disagree, which is why this is a rule and not a
 * comparison:
 *  - `bookings.payment_status` — the rollup written on every decision.
 *  - the latest `payment_proofs.status` — the screenshot's own verdict.
 *
 * A booking whose proof was rejected but whose rollup never landed (an older row, a half-applied
 * write) is still a rejection, and vice versa.
 *
 * Pure Kotlin: no Android imports, no Compose, no network, so the JVM unit test
 * ([PaymentFlowRulesTest]) runs it directly. Screens turn a stage into a string resource; this
 * decides only which stage a reservation is at.
 */
object PaymentFlowRules {

    // ---- Vocabulary ---------------------------------------------------------

    /**
     * `bookings.payment_status`. Anything unrecognised — including the values only the retired
     * Paymob path ever wrote — reads as `unpaid`, matching `normalizePaymentState` server-side.
     */
    private val PAYMENT_STATES = setOf(
        "unpaid", "submitted", "paid", "rejected", "disputed",
        "pending", "failed", "refunded", "voided",
    )

    /**
     * `payment_proofs.status`. The column is plain text with no CHECK constraint, so this list is
     * the only thing keeping the vocabulary honest.
     */
    private val PROOF_STATUSES = setOf("submitted", "approved", "rejected", "disputed")

    fun normalizePaymentState(raw: String?): String {
        val v = raw?.trim()?.lowercase().orEmpty()
        return if (v in PAYMENT_STATES) v else "unpaid"
    }

    /**
     * Null when there is no proof at all — which is NOT the same as a proof whose status we don't
     * recognise, and not the same as a rejected one.
     */
    fun normalizeProofStatus(raw: String?): String? {
        val v = raw?.trim()?.lowercase().orEmpty()
        return if (v in PROOF_STATUSES) v else null
    }

    // ---- The stage ----------------------------------------------------------

    /**
     * The five states the guest-facing UI cares about.
     *
     * [Rejected] is the one that was missing on both phones: a booking whose transfer an admin
     * turned down looked identical to one that had never been paid, so the guest was shown a bare
     * "Pay now" button and never told why their last screenshot failed.
     */
    enum class Stage {
        /** Not confirmed yet, or gone — there is nothing to pay. */
        NotPayable,

        /** Confirmed and waiting on the guest's transfer. */
        AwaitingPayment,

        /** A screenshot is with the reviewers (or escalated to a dispute). */
        UnderReview,

        Paid,

        /** A screenshot was turned down. Still payable — the guest re-uploads. */
        Rejected,
    }

    /**
     * Which stage a booking is at. Order matters, and mirrors the server's: paid wins over
     * everything, then an in-flight review, then a rejection the guest can fix, then payability.
     *
     * Every argument is nullable because older responses omit some of them, and a missing field
     * must never be mistaken for a decision.
     *
     * @param status `bookings.status` — pending | confirmed | cancelled | rejected | completed.
     * @param paymentState the raw `bookings.payment_status`.
     * @param proofStatus the latest `payment_proofs.status`, null when no proof exists.
     * @param paidAt set once the payment is confirmed.
     */
    fun stage(
        status: String?,
        paymentState: String?,
        proofStatus: String?,
        paidAt: String?,
    ): Stage {
        val state = normalizePaymentState(paymentState)
        val proof = normalizeProofStatus(proofStatus)
        val bookingStatus = status?.trim()?.lowercase().orEmpty()
        // A JSON null that reached us as the literal "null" is not a timestamp — that mistake
        // shipped once already as the /stay/null page.
        val paid = paidAt?.trim()?.let { it.isNotEmpty() && !it.equals("null", ignoreCase = true) } == true

        if (state == "paid" || proof == "approved" || paid) return Stage.Paid
        // A booking that is gone can't be paid, whatever its payment columns say.
        if (bookingStatus == "cancelled" || bookingStatus == "canceled" || bookingStatus == "rejected") {
            return Stage.NotPayable
        }
        // Submitted or escalated — the guest has done their part and is waiting on us.
        if (state == "submitted" || state == "disputed" || proof == "submitted" || proof == "disputed") {
            return Stage.UnderReview
        }
        if (state == "rejected" || proof == "rejected") return Stage.Rejected
        // Payment only opens once the host has accepted the reservation.
        return if (bookingStatus == "confirmed") Stage.AwaitingPayment else Stage.NotPayable
    }

    /**
     * The single predicate the pay button, the payment card and the upload API all share, so they
     * cannot disagree about whether a booking is payable.
     *
     * A rejected screenshot IS payable — the guest re-uploads a better photo. Turning down a blurry
     * transfer must not kill the reservation.
     */
    fun canPay(stage: Stage): Boolean = stage == Stage.AwaitingPayment || stage == Stage.Rejected

    /**
     * The admin's note, trimmed, or null when they left one off (a reason is required on a fresh
     * rejection, but older rows and dispute outcomes carry none). Only ever meaningful at
     * [Stage.Rejected] — the caller checks the stage, so a reason left on the row from an earlier
     * round can't leak onto a payment that has since been accepted.
     */
    fun rejectReasonText(raw: String?): String? =
        raw?.trim()?.takeIf { it.isNotEmpty() && !it.equals("null", ignoreCase = true) }

    // ---- Did money ever arrive? ---------------------------------------------

    /**
     * Whether money ever reached us on this booking — which is NOT the question [stage] answers.
     * That one asks "can this be paid now?", and the two part company on exactly the rows that
     * matter: a cancelled booking is [Stage.NotPayable] whatever was paid for it, and a refunded
     * one has had its paid marker wiped.
     *
     * ⚠️ THE `paid_at` TRAP (the same one `analytics-core.ts` warns about). A refund sets
     * `paid_at = NULL`, so testing it answers "never paid" for exactly the bookings a refund
     * question is about. The payment column is checked first, and `paid_at` only ever adds to the
     * answer — it can never be what denies it.
     *
     * `refunded` and `voided` are terminal states from the retired Paymob path: money went out and
     * came back, so it certainly arrived first.
     *
     * This exists because `bookings.refund_percent` is stamped from the listing's cancellation
     * policy whenever a guest cancels, WITHOUT regard to whether anything was ever paid. So a
     * never-paid booking cancelled a fortnight out carries `refund_percent = 100`, and any UI that
     * splits a cancellation on that column alone will call it "Refunded" — money back that was
     * never money in.
     *
     * The Kotlin twin of `everPaid` in `payment-flow-core.ts`.
     */
    fun everPaid(
        paymentState: String?,
        proofStatus: String? = null,
        paidAt: String? = null,
    ): Boolean {
        val state = normalizePaymentState(paymentState)
        if (state == "paid" || state == "refunded" || state == "voided") return true
        if (normalizeProofStatus(proofStatus) == "approved") return true
        val at = paidAt?.trim().orEmpty()
        return at.isNotEmpty() && at.lowercase() != "null"
    }
}
