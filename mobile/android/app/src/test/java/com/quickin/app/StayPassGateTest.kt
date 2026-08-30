package com.quickin.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Kotlin mirror of the backend's `test/unit/stay-pass-core.test.mjs` (and of the web repo's
 * copy of it), which guards `isLiveStayPass` in `payment-flow-core.ts`. This one guards
 * [Reservation.isLiveStayPass], the hand-written Kotlin translation — iOS carries a third copy of
 * the rule in `ReservationDetail.isLiveStayPass`. A change to the rule belongs in all of them, and
 * this suite is what notices when it isn't.
 *
 * THE regression this file exists for: a host tapped Approve and the pass appeared immediately, on
 * both the host's and the guest's screen, before the guest had transferred a piastre. `confirmed`
 * means "the host accepted" — the reservation code is minted at that transition and payment happens
 * AFTERWARDS — so `confirmed` alone must never open the pass.
 *
 * Plain JVM, no emulator: `./gradlew testDebugUnitTest`.
 */
class StayPassGateTest {

    private fun reservation(
        status: String = "confirmed",
        paymentStatus: String = "unpaid",
        paidAt: String? = null,
        reservationCode: String? = "QK-7F3K9Q",
    ) = Reservation(
        id = "b1",
        reservationCode = reservationCode,
        status = status,
        title = "Villa",
        location = "Sahel",
        checkIn = "2026-09-01",
        checkOut = "2026-09-04",
        guests = 2,
        totalPrice = 4200.0,
        paymentStatus = paymentStatus,
        paidAt = paidAt,
    )

    // ---- The host-approved-but-unpaid hole ----------------------------------

    @Test
    fun `a confirmed booking with no payment has no pass`() {
        val r = reservation()
        assertFalse(r.isLiveStayPass)
        assertFalse(r.hasStayPass)
    }

    @Test
    fun `a submitted or disputed transfer does not open the pass`() {
        // Money in the ops queue is not money in the account.
        assertFalse(reservation(paymentStatus = "submitted").hasStayPass)
        assertFalse(reservation(paymentStatus = "disputed").hasStayPass)
    }

    @Test
    fun `a rejected payment does not open the pass`() {
        assertFalse(reservation(paymentStatus = "rejected").hasStayPass)
    }

    @Test
    fun `the pass opens once the payment is approved`() {
        assertTrue(reservation(paymentStatus = "paid").hasStayPass)
        assertTrue(reservation(paidAt = "2026-08-26T10:00:00Z").hasStayPass)
    }

    @Test
    fun `a JSON null stringified into paidAt is not a payment`() {
        // JSONObject#optString hands back "null" for a JSON null — see ShareLinks.stay.
        assertFalse(reservation(paidAt = "null").hasStayPass)
        assertFalse(reservation(paidAt = "  ").hasStayPass)
    }

    // ---- Booking status ------------------------------------------------------

    @Test
    fun `pending never has a pass, however the payment columns read`() {
        assertFalse(reservation(status = "pending").hasStayPass)
        assertFalse(reservation(status = "pending", paymentStatus = "paid").hasStayPass)
    }

    @Test
    fun `cancelled and rejected lose the pass even when paid`() {
        for (status in listOf("cancelled", "rejected")) {
            assertFalse(status, reservation(status = status, paymentStatus = "paid").hasStayPass)
        }
    }

    @Test
    fun `completed keeps its pass unconditionally`() {
        // Deliberate: the pass is the guest's receipt of a stay that is over, and rows predating
        // this rule must not lose it retroactively.
        assertTrue(reservation(status = "completed").hasStayPass)
        assertTrue(reservation(status = "completed", paymentStatus = "unpaid").hasStayPass)
    }

    // ---- The code half of the gate ------------------------------------------

    // `stayPassUrl` itself is not asserted here: it goes through ShareLinks.stay → android.net.Uri,
    // which is not available to a plain JVM test. `hasStayPass` carries the same two halves.
    @Test
    fun `a paid booking with no code still renders nothing`() {
        assertTrue(reservation(paymentStatus = "paid", reservationCode = null).isLiveStayPass)
        assertFalse(reservation(paymentStatus = "paid", reservationCode = null).hasStayPass)
        assertFalse(reservation(paymentStatus = "paid", reservationCode = "null").hasStayPass)
    }

    // ---- What the placeholder says ------------------------------------------

    @Test
    fun `the unpaid wait is attributed to the payment, the pending wait to the host`() {
        val unpaid = reservation()
        assertTrue(unpaid.isAwaitingPaymentForPass)
        assertFalse(unpaid.isAwaitingApproval)

        val pending = reservation(status = "pending")
        assertFalse(pending.isAwaitingPaymentForPass)
        assertTrue(pending.isAwaitingApproval)

        val paid = reservation(paymentStatus = "paid")
        assertFalse(paid.isAwaitingPaymentForPass)
    }

    // ---- The host's editor is deliberately looser ----------------------------

    @Test
    fun `the host may edit the guide while the guest pays, but not once it is completed`() {
        // The backend's stay-guide INSERT requires status = 'confirmed'; payment is irrelevant to
        // it, so the host can prepare check-in notes during the wait.
        assertTrue(reservation().canEditStayGuide)
        assertFalse(reservation(status = "completed").canEditStayGuide)
        assertFalse(reservation(status = "pending").canEditStayGuide)
    }
}
