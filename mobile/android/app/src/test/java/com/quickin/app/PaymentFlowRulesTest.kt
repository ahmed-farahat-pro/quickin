package com.quickin.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Kotlin mirror of the backend's `test/unit/payment-flow-core.test.mjs` and of iOS's
 * `Tests/PaymentFlowRulesTests/main.swift`. All three guard the same rule — `paymentStageFor` in
 * `src/lib/local/payment-flow-core.ts` — so a change to it belongs in all three, and these suites
 * are what notice when it isn't.
 *
 * THE regression this file exists for: **the payment rejection reason was never shown to the
 * guest.** An admin turned a transfer down with a written reason and the reservation went straight
 * back to a bare "Pay now" button — the same button shown to a guest who had never paid at all.
 * Nothing said the screenshot had been rejected, and nothing said why, so the guest's only move was
 * to upload the identical unreadable photo again.
 *
 * The cause was the app deciding payment state by hand: `payment_status == "submitted"` was the
 * only case it knew, so `rejected` fell through into "Pay now". This suite pins the stage rule
 * instead, and in particular that `rejected` is BOTH its own stage (so the screen can explain it)
 * and still payable (so the reservation survives it).
 *
 * Plain JVM, no emulator: `./gradlew testDebugUnitTest`.
 */
class PaymentFlowRulesTest {

    private fun stage(
        status: String? = "confirmed",
        paymentState: String? = null,
        proofStatus: String? = null,
        paidAt: String? = null,
    ) = PaymentFlowRules.stage(status, paymentState, proofStatus, paidAt)

    // ---- The bug this file exists for ---------------------------------------

    @Test
    fun `a rejected payment is its own stage, not awaiting payment`() {
        // Either column alone is enough. A half-applied write (rollup updated, proof not, or the
        // reverse) is still a rejection the guest has to be told about.
        assertEquals(PaymentFlowRules.Stage.Rejected, stage(paymentState = "rejected"))
        assertEquals(PaymentFlowRules.Stage.Rejected, stage(proofStatus = "rejected"))
        assertEquals(
            PaymentFlowRules.Stage.Rejected,
            stage(paymentState = "rejected", proofStatus = "rejected"),
        )
    }

    @Test
    fun `a rejected transfer and a never-paid one are different screens`() {
        assertEquals(PaymentFlowRules.Stage.AwaitingPayment, stage(paymentState = "unpaid"))
        assertNotEquals(stage(paymentState = "rejected"), stage(paymentState = "unpaid"))
    }

    @Test
    fun `a rejected payment is still payable - the guest re-uploads`() {
        // The other half of the fix: turning down a blurry photo must not kill the booking.
        assertTrue(PaymentFlowRules.canPay(stage(paymentState = "rejected")))
    }

    @Test
    fun `the reason is passed through verbatim, and blanks fall back`() {
        assertEquals(
            "The amount doesn't match",
            PaymentFlowRules.rejectReasonText("The amount doesn't match"),
        )
        assertEquals(
            "screenshot is unreadable",
            PaymentFlowRules.rejectReasonText("  screenshot is unreadable  "),
        )
        // Each of these must reach the generic line rather than printing itself at the guest.
        for (empty in listOf(null, "", "   ", "null", "NULL")) {
            assertNull("\"$empty\" is no reason at all", PaymentFlowRules.rejectReasonText(empty))
        }
    }

    // ---- The rest of the ladder, in the server's order -----------------------

    @Test
    fun `paid wins over everything`() {
        assertEquals(PaymentFlowRules.Stage.Paid, stage(paymentState = "paid"))
        assertEquals(PaymentFlowRules.Stage.Paid, stage(proofStatus = "approved"))
        assertEquals(PaymentFlowRules.Stage.Paid, stage(paidAt = "2026-08-20T10:00:00Z"))
        assertEquals(
            PaymentFlowRules.Stage.Paid,
            stage(paymentState = "paid", proofStatus = "disputed"),
        )
        // An approval after a rejection is the final word — no stale rejection card on a paid stay.
        assertEquals(
            PaymentFlowRules.Stage.Paid,
            stage(paymentState = "rejected", proofStatus = "approved"),
        )
    }

    @Test
    fun `a submitted or disputed transfer is under review`() {
        assertEquals(PaymentFlowRules.Stage.UnderReview, stage(paymentState = "submitted"))
        assertEquals(PaymentFlowRules.Stage.UnderReview, stage(proofStatus = "submitted"))
        // An escalated dispute is still with us, not back with the guest — offering "Pay now" there
        // invites a second transfer for a booking that may be about to be marked paid.
        assertEquals(PaymentFlowRules.Stage.UnderReview, stage(paymentState = "disputed"))
        assertEquals(PaymentFlowRules.Stage.UnderReview, stage(proofStatus = "disputed"))
        assertFalse(PaymentFlowRules.canPay(stage(paymentState = "disputed")))
    }

    // ---- Who may pay at all -------------------------------------------------

    @Test
    fun `payment opens at the host's approval, not at the request`() {
        assertEquals(PaymentFlowRules.Stage.NotPayable, stage(status = "pending"))
        assertEquals(
            PaymentFlowRules.Stage.NotPayable,
            stage(status = "pending", paymentState = "unpaid"),
        )
    }

    @Test
    fun `a booking that is gone is not payable, even carrying a live rejection`() {
        for (gone in listOf("cancelled", "canceled", "rejected")) {
            assertEquals(
                "a $gone booking is not payable",
                PaymentFlowRules.Stage.NotPayable,
                stage(status = gone, paymentState = "rejected"),
            )
            assertFalse(PaymentFlowRules.canPay(stage(status = gone, paymentState = "rejected")))
        }
        // …but one that was genuinely paid still reads as paid, so a refund screen is never told
        // the money never arrived.
        assertEquals(
            PaymentFlowRules.Stage.Paid,
            stage(status = "cancelled", paymentState = "paid"),
        )
    }

    // ---- Sloppy input, from older rows and other writers ---------------------

    @Test
    fun `missing payment columns read as unpaid, not as a rejection`() {
        assertEquals(
            PaymentFlowRules.Stage.AwaitingPayment,
            stage(paymentState = null, proofStatus = null),
        )
    }

    @Test
    fun `case and padding are normalized`() {
        assertEquals(PaymentFlowRules.Stage.Rejected, stage(paymentState = "  REJECTED  "))
    }

    @Test
    fun `unknown values fall back rather than inventing a stage`() {
        assertEquals(PaymentFlowRules.Stage.AwaitingPayment, stage(paymentState = "garbage"))
        assertEquals(PaymentFlowRules.Stage.AwaitingPayment, stage(proofStatus = "garbage"))
        // The retired Paymob path still wrote these; none of them is "rejected by a reviewer".
        for (legacy in listOf("pending", "failed", "refunded", "voided")) {
            assertEquals(
                "legacy gateway state '$legacy' is not a rejection",
                PaymentFlowRules.Stage.AwaitingPayment,
                stage(paymentState = legacy),
            )
        }
    }

    @Test
    fun `a null-ish paid_at is not a payment`() {
        // JSONObject#optString hands back the literal "null" for a JSON null — that mistake shipped
        // once already as the /stay/null page.
        assertEquals(PaymentFlowRules.Stage.AwaitingPayment, stage(paidAt = "null"))
        assertEquals(PaymentFlowRules.Stage.AwaitingPayment, stage(paidAt = "   "))
    }

    // ---- What the screen actually reads off a Reservation --------------------

    private fun reservation(
        status: String = "confirmed",
        paymentStatus: String = "unpaid",
        paymentProofStatus: String? = null,
        paymentRejectReason: String? = null,
        paidAt: String? = null,
    ) = Reservation(
        id = "b1",
        reservationCode = "QK-7F3K9Q",
        status = status,
        title = "Villa",
        location = "Sahel",
        checkIn = "2026-09-01",
        checkOut = "2026-09-04",
        guests = 2,
        totalPrice = 4200.0,
        paymentStatus = paymentStatus,
        paymentProofStatus = paymentProofStatus,
        paymentRejectReason = paymentRejectReason,
        paidAt = paidAt,
    )

    @Test
    fun `a rejected reservation exposes the reason and still offers a retry`() {
        val r = reservation(
            paymentStatus = "rejected",
            paymentProofStatus = "rejected",
            paymentRejectReason = "The amount doesn't match your stay total.",
        )
        assertEquals(PaymentFlowRules.Stage.Rejected, r.paymentStage)
        assertEquals("The amount doesn't match your stay total.", r.paymentRejectReasonText)
        assertTrue(r.canPay)
        assertFalse(r.isPaid)
    }

    @Test
    fun `a reason left over from an earlier round never shows on a paid stay`() {
        // The row keeps the note from the round that was rejected; gating on the stage is what
        // stops "we couldn't confirm your transfer" appearing beside a payment we since accepted.
        val r = reservation(
            paymentStatus = "paid",
            paymentProofStatus = "approved",
            paymentRejectReason = "Blurry screenshot",
            paidAt = "2026-08-20T10:00:00Z",
        )
        assertEquals(PaymentFlowRules.Stage.Paid, r.paymentStage)
        assertNull(r.paymentRejectReasonText)
        assertFalse(r.canPay)
    }

    @Test
    fun `a rejected payment keeps the reservation alive but takes the pass away`() {
        val r = reservation(paymentStatus = "rejected", paymentProofStatus = "rejected")
        // The booking is still confirmed — rejecting a screenshot must not cancel a real stay…
        assertTrue(r.isApproved)
        // …but no money has arrived, so there is no live pass and no QR.
        assertFalse(r.isPaymentApproved)
        assertFalse(r.isLiveStayPass)
    }

    @Test
    fun `an approved proof alone is enough to open the pass`() {
        // The rollup can lag the proof; the pass gate reads the rule, not one column.
        val r = reservation(paymentStatus = "unpaid", paymentProofStatus = "approved")
        assertTrue(r.isPaymentApproved)
        assertTrue(r.isLiveStayPass)
    }
}
