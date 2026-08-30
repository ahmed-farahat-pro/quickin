package com.quickin.app

import com.quickin.app.ReservationFilterRules.Bucket
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Covers the GUEST reservations status filter: which bucket a reservation falls into, what each
 * chip selects, and the count each chip is badged with.
 *
 * The Kotlin mirror of the web's `test/unit/reservation-filter-core.test.mjs` and iOS's
 * `Tests/ReservationFilterTests`. The three suites are what keep the fold from drifting apart, so
 * a change to one belongs in all three.
 *
 * The reported defect was "[iOS] Reservation Filters Are Missing for Guest" — the guest
 * counterpart of the host ticket [HostBookingFilterRulesTest] covers, and fixed the same way:
 * three of the buckets a guest thinks in (Awaiting payment, Refunded, Partially refunded) are NOT
 * values of `bookings.status`, they are folded out of the payment stage and `refund_percent`.
 *
 * Two halves matter here and are tested apart on purpose:
 *
 *  * What this rule does DIFFERENTLY from the host's — `UnderReview` and `Completed` are buckets
 *    of their own rather than folded away. Those two are why a separate module exists.
 *  * What it does IDENTICALLY — the cancelled/refunded split, the clamping, the unknown-status
 *    fallback. The last tests hold the two folds side by side, because a host and a guest reading
 *    one reservation must never see it filed differently.
 *
 * The test that matters most is that a submitted transfer is [Bucket.UnderReview] and not
 * [Bucket.AwaitingPayment]. "Awaiting payment" is a guest's to-do list of money they still owe; a
 * screenshot already sitting in the ops queue showing up there is what makes people pay twice.
 */
class ReservationFilterRulesTest {

    /**
     * `wasPaid` defaults to TRUE so every case written before it existed keeps the meaning it was
     * written with ("a paid stay that was later refunded"). The never-paid half — the bug the
     * argument was added for — is spelled out explicitly below.
     */
    private fun bucket(
        status: String?,
        stage: PaymentFlowRules.Stage? = null,
        refund: Int? = null,
        wasPaid: Boolean = true,
    ): Bucket = ReservationFilterRules.bucketFor(status, stage, refund, wasPaid)

    private val allStages = PaymentFlowRules.Stage.entries

    // ---- The chip row -------------------------------------------------------

    @Test
    fun `the chips lead with All and walk the guest lifecycle to the ways it ends`() {
        assertEquals(
            listOf(
                ReservationFilter.All,
                ReservationFilter.Pending,
                ReservationFilter.AwaitingPayment,
                ReservationFilter.UnderReview,
                ReservationFilter.Confirmed,
                ReservationFilter.Completed,
                ReservationFilter.Rejected,
                ReservationFilter.Cancelled,
                ReservationFilter.Refunded,
                ReservationFilter.PartiallyRefunded,
            ),
            ReservationFilter.entries.toList(),
        )
    }

    @Test
    fun `All selects no single bucket, and every bucket has exactly one chip`() {
        assertEquals(null, ReservationFilter.All.bucket)
        val chipped = ReservationFilter.entries.mapNotNull { it.bucket }
        assertEquals(Bucket.entries.toSet(), chipped.toSet())
        assertEquals(Bucket.entries.size, chipped.size)
    }

    @Test
    fun `every chip carries a label and an empty message`() {
        for (option in ReservationFilter.entries) {
            assertNotNull("${option.name} has no label", option.labelRes)
            assertTrue("${option.name} has no label", option.labelRes != 0)
            assertTrue("${option.name} has no empty message", option.emptyMessageRes != 0)
        }
    }

    // ---- The statuses -------------------------------------------------------

    @Test
    fun `pending and rejected file by status, ahead of any payment reading`() {
        assertEquals(Bucket.Pending, bucket("pending"))
        assertEquals(Bucket.Rejected, bucket("rejected", stage = PaymentFlowRules.Stage.AwaitingPayment))
    }

    @Test
    fun `a pending booking is pending whatever its stage says — the host has not answered`() {
        // A guest can upload a transfer before the host has even replied.
        assertEquals(Bucket.Pending, bucket("pending", stage = PaymentFlowRules.Stage.UnderReview))
        assertEquals(Bucket.Pending, bucket("pending", stage = PaymentFlowRules.Stage.Paid))
    }

    @Test
    fun `status is read case- and whitespace-insensitively`() {
        assertEquals(Bucket.Pending, bucket("  PENDING "))
        assertEquals(Bucket.Refunded, bucket("Cancelled", refund = 100))
    }

    @Test
    fun `the American spelling of cancelled is still a cancellation`() {
        assertEquals(Bucket.Refunded, bucket("canceled", refund = 100))
    }

    @Test
    fun `an unrecognised status reads as Pending rather than vanishing off every chip`() {
        // Asymmetric failure modes: a row behind no chip is a booking the guest never finds.
        for (status in listOf("archived", "", null)) {
            assertEquals("status=$status", Bucket.Pending, bucket(status))
        }
    }

    // ---- What the guest needs and the host does not --------------------------

    @Test
    fun `a submitted screenshot is Under review, NOT Awaiting payment`() {
        assertEquals(Bucket.UnderReview, bucket("confirmed", stage = PaymentFlowRules.Stage.UnderReview))
    }

    @Test
    fun `completed is its own chip — a guest goes looking for their trip history`() {
        assertEquals(Bucket.Completed, bucket("completed", stage = PaymentFlowRules.Stage.Paid))
    }

    @Test
    fun `a completed stay keeps its chip whatever the payment stage now says`() {
        for (stage in allStages) {
            assertEquals("stage=$stage", Bucket.Completed, bucket("completed", stage = stage))
        }
    }

    // ---- The confirmed split -------------------------------------------------

    @Test
    fun `confirmed and paid is Confirmed`() {
        assertEquals(Bucket.Confirmed, bucket("confirmed", stage = PaymentFlowRules.Stage.Paid))
    }

    @Test
    fun `every other stage on a confirmed booking means the guest still owes`() {
        for (stage in listOf(
            PaymentFlowRules.Stage.AwaitingPayment,
            PaymentFlowRules.Stage.Rejected,
            PaymentFlowRules.Stage.NotPayable,
        )) {
            assertEquals("stage=$stage", Bucket.AwaitingPayment, bucket("confirmed", stage = stage))
        }
    }

    @Test
    fun `a missing stage is not a decision — it reads as still owing, never as paid`() {
        assertEquals(Bucket.AwaitingPayment, bucket("confirmed", stage = null))
    }

    @Test
    fun `every stage the payment core can produce lands somewhere`() {
        for (stage in allStages) {
            assertTrue("stage=$stage", bucket("confirmed", stage = stage) in Bucket.entries)
        }
    }

    // ---- How a cancellation splits -------------------------------------------

    @Test
    fun `a cancellation splits on the refund percentage`() {
        assertEquals(Bucket.Refunded, bucket("cancelled", refund = 100))
        for (pct in listOf(1, 25, 50, 99)) {
            assertEquals("$pct%", Bucket.PartiallyRefunded, bucket("cancelled", refund = pct))
        }
        assertEquals(Bucket.Cancelled, bucket("cancelled", refund = 0))
    }

    @Test
    fun `a cancellation from before the refund ladder shipped reads as Cancelled`() {
        assertEquals(Bucket.Cancelled, bucket("cancelled", refund = null))
    }

    @Test
    fun `a percentage outside 0-100 clamps rather than mis-filing a row`() {
        assertEquals(Bucket.Refunded, bucket("cancelled", refund = 140))
        assertEquals(Bucket.Cancelled, bucket("cancelled", refund = -20))
    }

    @Test
    fun `a dead reservation never surfaces under Awaiting payment`() {
        // That chip is money the guest still owes; a cancelled or declined booking sitting in it
        // is a guest being chased for a stay that no longer exists.
        for (stage in allStages) {
            for (status in listOf("cancelled", "canceled", "rejected")) {
                assertFalse(
                    "$status/$stage",
                    bucket(status, stage = stage, refund = 50) == Bucket.AwaitingPayment,
                )
            }
        }
    }

    // ---- A cancellation of a booking the guest never paid for -----------------

    /**
     * ⚠️ The bug [ReservationFilterRules.bucketFor]'s `wasPaid` argument was added for.
     *
     * `refund_percent` is stamped from the listing's cancellation policy the moment a guest
     * cancels, whether or not anything was ever paid — verified against the live endpoint:
     * cancelling a pending, UNPAID booking a fortnight out wrote `refund_percent = 100`, and the
     * guest's own Trips list told them the stay had been "Refunded". Money back that was never
     * money in.
     */
    @Test
    fun `a booking cancelled before the guest ever paid is Cancelled, not Refunded`() {
        for (pct in listOf(1, 50, 99, 100)) {
            assertEquals(
                "$pct% of nothing is not a refund",
                Bucket.Cancelled,
                bucket("cancelled", refund = pct, wasPaid = false),
            )
        }
    }

    @Test
    fun `wasPaid gates only the refund chips - it cannot move a live booking`() {
        assertEquals(Bucket.Confirmed, bucket("confirmed", stage = PaymentFlowRules.Stage.Paid, wasPaid = false))
        assertEquals(Bucket.Completed, bucket("completed", stage = PaymentFlowRules.Stage.Paid, wasPaid = false))
        assertEquals(Bucket.Pending, bucket("pending", wasPaid = false))
        assertEquals(Bucket.Rejected, bucket("rejected", wasPaid = false))
    }

    @Test
    fun `the host reads a never-paid cancellation the same way - one shared rule, not two`() {
        assertEquals(
            HostBookingFilterRules.Bucket.Cancelled,
            HostBookingFilterRules.bucketFor("cancelled", PaymentFlowRules.Stage.NotPayable, 100, false),
        )
    }

    /**
     * ⚠️ THE paid_at TRAP, through [PaymentFlowRules.everPaid]: a refund clears `paid_at`, so the
     * payment column is the only thing that still knows money moved.
     */
    @Test
    fun `everPaid finds a legacy refunded booking once paid_at has been wiped`() {
        assertTrue(PaymentFlowRules.everPaid("refunded", null, null))
        assertTrue(PaymentFlowRules.everPaid("voided", null, null))
        assertTrue(PaymentFlowRules.everPaid("paid", null, null))
        assertTrue(PaymentFlowRules.everPaid("unpaid", "approved", null))
        assertTrue(PaymentFlowRules.everPaid("unpaid", null, "2026-08-01T00:00:00Z"))
        assertFalse(PaymentFlowRules.everPaid("unpaid", null, null))
        assertFalse(PaymentFlowRules.everPaid("submitted", "submitted", null))
        assertFalse(PaymentFlowRules.everPaid(null, null, "null"))
    }

    // ---- matches -------------------------------------------------------------

    @Test
    fun `All takes every bucket, a chip takes only its own`() {
        for (b in Bucket.entries) assertTrue(ReservationFilter.All.matches(b))
        assertTrue(ReservationFilter.Confirmed.matches(Bucket.Confirmed))
        assertFalse(ReservationFilter.AwaitingPayment.matches(Bucket.UnderReview))
    }

    @Test
    fun `the refund chips do not double as Cancelled — the buckets partition All`() {
        assertTrue(ReservationFilter.Refunded.matches(Bucket.Refunded))
        assertFalse(ReservationFilter.Cancelled.matches(Bucket.Refunded))
    }

    // ---- counts --------------------------------------------------------------

    private val sample = listOf(
        bucket("pending"),
        bucket("pending"),
        bucket("confirmed", stage = PaymentFlowRules.Stage.AwaitingPayment),
        bucket("confirmed", stage = PaymentFlowRules.Stage.UnderReview),
        bucket("confirmed", stage = PaymentFlowRules.Stage.Paid),
        bucket("completed", stage = PaymentFlowRules.Stage.Paid),
        bucket("rejected"),
        bucket("cancelled", refund = 0),
        bucket("cancelled", refund = 50),
        bucket("cancelled", refund = 100),
    )

    @Test
    fun `counts tally each bucket`() {
        val counts = ReservationFilterRules.counts(sample)
        assertEquals(2, counts[Bucket.Pending])
        assertEquals(1, counts[Bucket.AwaitingPayment])
        assertEquals(1, counts[Bucket.UnderReview])
        assertEquals(1, counts[Bucket.Confirmed])
        assertEquals(1, counts[Bucket.Completed])
        assertEquals(1, counts[Bucket.Rejected])
        assertEquals(1, counts[Bucket.Cancelled])
        assertEquals(1, counts[Bucket.PartiallyRefunded])
        assertEquals(1, counts[Bucket.Refunded])
    }

    @Test
    fun `a bucket with nothing in it counts zero rather than going missing`() {
        // A chip badged 0 is the answer; a chip badged nothing is one the guest has to tap.
        val counts = ReservationFilterRules.counts(listOf(bucket("confirmed", stage = PaymentFlowRules.Stage.Paid)))
        for (b in Bucket.entries) assertNotNull("$b has no count", counts[b])
        assertEquals(0, counts[Bucket.Refunded])
    }

    @Test
    fun `no reservations at all means every chip reads zero`() {
        val counts = ReservationFilterRules.counts(emptyList())
        for (b in Bucket.entries) assertEquals("$b", 0, counts[b])
    }

    @Test
    fun `every count equals what its own chip would actually render`() {
        val counts = ReservationFilterRules.counts(sample)
        for (option in ReservationFilter.entries) {
            val shown = sample.count { option.matches(it) }
            val badged = option.bucket?.let { counts[it] } ?: sample.size
            assertEquals("${option.name} is badged $badged but shows $shown", badged, shown)
        }
    }

    @Test
    fun `the buckets partition All — every reservation is behind exactly one chip`() {
        val counts = ReservationFilterRules.counts(sample)
        assertEquals(sample.size, Bucket.entries.sumOf { counts[it] ?: 0 })
    }

    // ---- Agreement with the host fold ----------------------------------------

    /** The host bucket a guest bucket should equal, where the two vocabularies overlap. */
    private fun hostTwin(bucket: Bucket): HostBookingFilterRules.Bucket? = when (bucket) {
        Bucket.Pending -> HostBookingFilterRules.Bucket.Pending
        Bucket.AwaitingPayment -> HostBookingFilterRules.Bucket.AwaitingPayment
        Bucket.Confirmed -> HostBookingFilterRules.Bucket.Confirmed
        Bucket.Rejected -> HostBookingFilterRules.Bucket.Rejected
        Bucket.Cancelled -> HostBookingFilterRules.Bucket.Cancelled
        Bucket.Refunded -> HostBookingFilterRules.Bucket.Refunded
        Bucket.PartiallyRefunded -> HostBookingFilterRules.Bucket.PartiallyRefunded
        // The two the guest has and the host does not.
        Bucket.UnderReview, Bucket.Completed -> null
    }

    @Test
    fun `the guest and host folds agree everywhere but the two documented divergences`() {
        val statuses = listOf("pending", "confirmed", "completed", "rejected", "cancelled", "canceled", "archived", "", null)
        val refunds = listOf(null, 0, 1, 50, 99, 100, 140, -20)
        val divergent = mutableListOf<String>()
        for (status in statuses) {
            for (stage in allStages) {
                for (refund in refunds) {
                    val s = status?.trim()?.lowercase().orEmpty()
                    if (s == "completed" || (s == "confirmed" && stage == PaymentFlowRules.Stage.UnderReview)) continue
                    for (paid in listOf(true, false)) {
                    val guest = ReservationFilterRules.bucketFor(status, stage, refund, paid)
                    val host = HostBookingFilterRules.bucketFor(status, stage, refund, paid)
                    if (hostTwin(guest) != host) divergent += "$status/$stage/$refund/$paid: $guest vs $host"
                    }
                }
            }
        }
        assertEquals(emptyList<String>(), divergent)
    }

    @Test
    fun `DIVERGES on under review — a chip for the guest, awaiting payment for the host`() {
        // If this ever starts agreeing, the guest has silently lost the chip that stops them
        // paying a second time.
        assertEquals(Bucket.UnderReview, bucket("confirmed", stage = PaymentFlowRules.Stage.UnderReview))
        assertEquals(
            HostBookingFilterRules.Bucket.AwaitingPayment,
            HostBookingFilterRules.bucketFor("confirmed", PaymentFlowRules.Stage.UnderReview, null, true),
        )
    }

    @Test
    fun `DIVERGES on completed — a chip for the guest, folded into confirmed for the host`() {
        assertEquals(Bucket.Completed, bucket("completed", stage = PaymentFlowRules.Stage.Paid))
        assertEquals(
            HostBookingFilterRules.Bucket.Confirmed,
            HostBookingFilterRules.bucketFor("completed", PaymentFlowRules.Stage.Paid, null, true),
        )
    }
}
