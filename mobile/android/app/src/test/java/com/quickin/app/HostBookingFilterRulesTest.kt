package com.quickin.app

import com.quickin.app.HostBookingFilterRules.Bucket
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Covers the host reservations status filter: which bucket a reservation falls into, what each
 * chip selects, and the count each chip is badged with.
 *
 * The Kotlin mirror of the web's `test/unit/host-booking-filter-core.test.mjs` and iOS's
 * `Tests/HostBookingFilterRulesTests`. The three suites are what keep the fold from drifting
 * apart, so a change to one belongs in all three.
 *
 * The reported defect was "[Android] Reservation filters are missing for Host" — but the fix was
 * never only a chip row. Three of the buckets a host thinks in (Awaiting payment, Refunded,
 * Partially refunded) are NOT values of `bookings.status`; they are folded out of
 * `payment_status`, the latest payment proof, and `refund_percent`.
 *
 * The tests that matter most are the ones asserting a cancelled or rejected reservation NEVER
 * lands under "Awaiting payment". That chip is a to-do list of money still owed to the host; a
 * dead booking sitting in it is a host chasing a guest for a stay that no longer exists.
 */
class HostBookingFilterRulesTest {

    private fun bucket(
        status: String?,
        stage: PaymentFlowRules.Stage? = null,
        refundPercent: Int? = null,
        wasPaid: Boolean = true,
    ): Bucket = HostBookingFilterRules.bucketFor(status, stage, refundPercent, wasPaid)

    // ---- The chip row -------------------------------------------------------

    @Test
    fun `leads with All, then the host lifecycle in reading order`() {
        assertEquals(
            listOf(
                HostBookingFilter.All,
                HostBookingFilter.Pending,
                HostBookingFilter.AwaitingPayment,
                HostBookingFilter.Confirmed,
                HostBookingFilter.Rejected,
                HostBookingFilter.Cancelled,
                HostBookingFilter.Refunded,
                HostBookingFilter.PartiallyRefunded,
            ),
            HostBookingFilter.entries.toList()
        )
    }

    @Test
    fun `declined and cancelled are separate chips`() {
        // A host declined the one and a guest cancelled the other. Folding them together would
        // make both counts lie.
        assertNotEquals(HostBookingFilter.Rejected.bucket, HostBookingFilter.Cancelled.bucket)
        assertFalse(HostBookingFilter.Cancelled.matches(Bucket.Rejected))
        assertFalse(HostBookingFilter.Rejected.matches(Bucket.Cancelled))
    }

    @Test
    fun `All maps to no single bucket, every other chip names one`() {
        assertEquals(null, HostBookingFilter.All.bucket)
        for (chip in HostBookingFilter.entries.filter { it != HostBookingFilter.All }) {
            assertNotNull(chip.name, chip.bucket)
        }
    }

    @Test
    fun `every bucket is reachable — no chip selects nothing forever`() {
        val reachable = setOf(
            bucket("pending"),
            bucket("confirmed", PaymentFlowRules.Stage.AwaitingPayment),
            bucket("confirmed", PaymentFlowRules.Stage.Paid),
            bucket("rejected"),
            bucket("cancelled", refundPercent = 0),
            bucket("cancelled", refundPercent = 100),
            bucket("cancelled", refundPercent = 50),
        )
        for (b in Bucket.entries) assertTrue(b.name, reachable.contains(b))
    }

    @Test
    fun `the status vocabulary matches the backend list`() {
        // Mirrored from BOOKING_STATUSES in the backend's admin.ts, which is what the write path
        // validates against.
        assertEquals(
            setOf("pending", "confirmed", "completed", "rejected", "cancelled"),
            HostBookingFilterRules.BOOKING_STATUSES
        )
    }

    // ---- Which bucket a reservation lands in --------------------------------

    @Test
    fun `a request waiting on the host is pending`() {
        assertEquals(Bucket.Pending, bucket("pending"))
    }

    @Test
    fun `pending wins even when a transfer is already under review`() {
        // A guest can upload a transfer screenshot before the host has replied. That is still a
        // request waiting on the host, not money waiting on the guest.
        assertEquals(Bucket.Pending, bucket("pending", PaymentFlowRules.Stage.UnderReview))
    }

    @Test
    fun `confirmed and paid is confirmed`() {
        assertEquals(Bucket.Confirmed, bucket("confirmed", PaymentFlowRules.Stage.Paid))
    }

    @Test
    fun `confirmed but not paid is awaiting payment`() {
        for (stage in listOf(
            PaymentFlowRules.Stage.AwaitingPayment,
            PaymentFlowRules.Stage.UnderReview,
            PaymentFlowRules.Stage.Rejected,
            PaymentFlowRules.Stage.NotPayable,
        )) {
            assertEquals(stage.name, Bucket.AwaitingPayment, bucket("confirmed", stage))
        }
    }

    @Test
    fun `a missing payment stage reads as unpaid, not paid`() {
        // A client that has not wired the payment columns through must not have every confirmed
        // reservation silently claim the money arrived.
        assertEquals(Bucket.AwaitingPayment, bucket("confirmed", null))
    }

    @Test
    fun `completed folds into confirmed`() {
        assertEquals(Bucket.Confirmed, bucket("completed", PaymentFlowRules.Stage.Paid))
    }

    @Test
    fun `a host decline is rejected, whatever the payment said`() {
        assertEquals(Bucket.Rejected, bucket("rejected"))
        assertEquals(Bucket.Rejected, bucket("rejected", PaymentFlowRules.Stage.Paid))
    }

    @Test
    fun `a dead reservation is never awaiting payment`() {
        // The regression this whole ordering exists to prevent.
        for (status in listOf("cancelled", "rejected")) {
            for (stage in PaymentFlowRules.Stage.entries) {
                assertNotEquals(
                    "$status + $stage",
                    Bucket.AwaitingPayment,
                    bucket(status, stage, refundPercent = 40)
                )
            }
        }
    }

    @Test
    fun `an unknown status reads as pending rather than vanishing`() {
        // bookings.status has no check constraint. A row that matches no chip is a reservation
        // the host never sees; one under Pending is one they glance at and dismiss.
        assertEquals(Bucket.Pending, bucket("expired"))
        assertEquals(Bucket.Pending, bucket(""))
        assertEquals(Bucket.Pending, bucket(null))
    }

    @Test
    fun `status is read case- and whitespace-insensitively`() {
        assertEquals(Bucket.Cancelled, bucket("  Cancelled "))
        assertEquals(Bucket.Rejected, bucket("REJECTED"))
    }

    @Test
    fun `the American spelling of cancelled is understood`() {
        assertEquals(Bucket.Refunded, bucket("canceled", refundPercent = 100))
    }

    // ---- How a cancellation splits on the refund ----------------------------

    @Test
    fun `a full refund is refunded`() {
        assertEquals(Bucket.Refunded, bucket("cancelled", refundPercent = 100))
    }

    @Test
    fun `a partial refund is partially refunded`() {
        for (pct in listOf(1, 25, 50, 99)) {
            assertEquals("$pct%", Bucket.PartiallyRefunded, bucket("cancelled", refundPercent = pct))
        }
    }

    @Test
    fun `a strict-policy cancellation with nothing back is plain cancelled`() {
        assertEquals(Bucket.Cancelled, bucket("cancelled", refundPercent = 0))
    }

    @Test
    fun `a cancellation from before the refund ladder is plain cancelled`() {
        // Legacy rows have no refund_percent. Reporting them as "Refunded" would tell the host
        // money moved when nothing was ever recorded.
        assertEquals(Bucket.Cancelled, bucket("cancelled", refundPercent = null))
    }

    @Test
    fun `a nonsense percent is clamped, not trusted`() {
        assertEquals(Bucket.Refunded, bucket("cancelled", refundPercent = 140))
        assertEquals(Bucket.Cancelled, bucket("cancelled", refundPercent = -5))
    }

    @Test
    fun `the refund only splits a cancellation, never a live booking`() {
        // refund_percent is only ever written alongside a cancellation, but a stray value must
        // not pull a live reservation out of its bucket.
        assertEquals(
            Bucket.Confirmed,
            bucket("confirmed", PaymentFlowRules.Stage.Paid, refundPercent = 100)
        )
        assertEquals(Bucket.Pending, bucket("pending", refundPercent = 50))
    }

    // ---- What each chip selects, and its count ------------------------------

    @Test
    fun `All takes every bucket`() {
        for (b in Bucket.entries) assertTrue(b.name, HostBookingFilter.All.matches(b))
    }

    @Test
    fun `a chip takes only its own bucket`() {
        assertTrue(HostBookingFilter.Refunded.matches(Bucket.Refunded))
        assertFalse(HostBookingFilter.Refunded.matches(Bucket.PartiallyRefunded))
    }

    @Test
    fun `each chip is counted, and the buckets sum to the total`() {
        val counts = HostBookingFilterRules.counts(
            listOf(
                Bucket.Pending, Bucket.Pending,
                Bucket.AwaitingPayment,
                Bucket.Confirmed, Bucket.Confirmed, Bucket.Confirmed,
                Bucket.Rejected,
                Bucket.Cancelled,
                Bucket.Refunded,
                Bucket.PartiallyRefunded,
            )
        )
        assertEquals(2, counts[Bucket.Pending])
        assertEquals(1, counts[Bucket.AwaitingPayment])
        assertEquals(3, counts[Bucket.Confirmed])
        assertEquals(1, counts[Bucket.Rejected])
        assertEquals(1, counts[Bucket.Cancelled])
        assertEquals(1, counts[Bucket.Refunded])
        assertEquals(1, counts[Bucket.PartiallyRefunded])
        // Every reservation is in exactly one bucket.
        assertEquals(10, counts.values.sum())
    }

    @Test
    fun `a bucket with nothing in it reads zero rather than going missing`() {
        val counts = HostBookingFilterRules.counts(listOf(Bucket.Pending))
        for (b in Bucket.entries) assertNotNull(b.name, counts[b])
        assertEquals(0, counts[Bucket.Refunded])
    }

    @Test
    fun `an empty list counts zero everywhere`() {
        val counts = HostBookingFilterRules.counts(emptyList())
        for (b in Bucket.entries) assertEquals(b.name, 0, counts[b])
    }

    // ---- End to end, through the HostBooking model --------------------------

    private fun booking(
        status: String,
        paymentState: String? = null,
        proofStatus: String? = null,
        paidAt: String? = null,
        refundPercent: Int? = null,
    ) = HostBooking(
        id = "b1", reservationCode = null, title = "Sea view", location = null,
        checkIn = "2026-09-01", checkOut = "2026-09-04", guests = 2, totalPrice = 4000.0,
        status = status, paymentState = paymentState, paymentProofStatus = proofStatus,
        paidAt = paidAt, refundPercent = refundPercent,
    )

    @Test
    fun `a guest who has transferred but not been reviewed is still awaiting payment`() {
        assertEquals(
            Bucket.AwaitingPayment,
            booking("confirmed", paymentState = "submitted", proofStatus = "submitted").filterBucket
        )
    }

    @Test
    fun `an approved transfer moves the reservation to confirmed`() {
        assertEquals(
            Bucket.Confirmed,
            booking("confirmed", paymentState = "paid", paidAt = "2026-08-01T00:00:00Z").filterBucket
        )
    }

    @Test
    fun `a declined screenshot leaves the reservation awaiting payment, not declined`() {
        // Turning down a blurry transfer must not read as the host rejecting the stay.
        assertEquals(
            Bucket.AwaitingPayment,
            booking("confirmed", paymentState = "rejected", proofStatus = "rejected").filterBucket
        )
    }

    @Test
    fun `a paid stay the guest later cancelled reads by its refund`() {
        assertEquals(
            Bucket.PartiallyRefunded,
            booking(
                "cancelled", paymentState = "paid",
                paidAt = "2026-08-01T00:00:00Z", refundPercent = 50
            ).filterBucket
        )
    }

    @Test
    fun `a booking parsed without the payment columns is not silently paid`() {
        // An older backend response, or a field the parser has not wired through.
        assertEquals(Bucket.AwaitingPayment, booking("confirmed").filterBucket)
    }
}
