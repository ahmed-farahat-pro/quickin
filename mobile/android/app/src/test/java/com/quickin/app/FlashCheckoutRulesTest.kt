package com.quickin.app

import com.quickin.app.BookingService.PaymentMethod as pm
import com.quickin.app.FlashCheckoutRules.Phase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Flash (card/wallet) checkout rules the pay sheet runs: how a `flash-checkout` response is
 * read, which panel it maps to, and when to stop polling. The status vocabulary mirrors
 * `normalizeFlashStatus` in the backend's `src/lib/local/flash-core.ts`.
 *
 * Also pins the one rule that keeps the two payment paths apart: the screenshot upload can never
 * send `method: "flash"`.
 *
 * Plain JVM, no emulator: `./gradlew testDebugUnitTest`.
 */
class FlashCheckoutRulesTest {

    private fun checkout(
        status: String? = "pending",
        paid: Boolean? = false,
        link: String? = "https://pay.useflash.app/o/abc",
    ) = FlashCheckoutRules.of(status, paid, link, "2026-10-03T12:30:00Z", 125_000L, "ord_1")

    // ---- Parsing ------------------------------------------------------------

    @Test
    fun `a pending checkout keeps its link and fields`() {
        val c = checkout()
        assertEquals("pending", c.status)
        assertFalse(c.paid)
        assertEquals("https://pay.useflash.app/o/abc", c.paymentLink)
        assertEquals("2026-10-03T12:30:00Z", c.expiresAt)
        assertEquals(125_000L, c.amountCents)
        assertEquals("ord_1", c.orderId)
    }

    @Test
    fun `status is normalized the way the server does it`() {
        assertEquals("succeeded", FlashCheckoutRules.normalizeStatus("SUCCEEDED"))
        assertEquals("succeeded", FlashCheckoutRules.normalizeStatus("paid"))
        assertEquals("canceled", FlashCheckoutRules.normalizeStatus("Cancelled"))
        assertEquals("expired", FlashCheckoutRules.normalizeStatus(" expired "))
        assertEquals("none", FlashCheckoutRules.normalizeStatus("none"))
        // Absent means there is no checkout yet.
        assertEquals("none", FlashCheckoutRules.normalizeStatus(null))
        assertEquals("none", FlashCheckoutRules.normalizeStatus("null"))
        // An unknown word must never look paid, nor close the checkout.
        assertEquals("pending", FlashCheckoutRules.normalizeStatus("authorised"))
    }

    @Test
    fun `blank and non-web links are dropped`() {
        assertNull(checkout(link = null).paymentLink)
        assertNull(checkout(link = "  ").paymentLink)
        assertNull(checkout(link = "javascript:alert(1)").paymentLink)
        assertNull(checkout(link = "intent://pay").paymentLink)
    }

    @Test
    fun `a missing paid flag is not paid`() {
        assertFalse(checkout(paid = null).paid)
    }

    // ---- Phase --------------------------------------------------------------

    @Test
    fun `paid wins over every status`() {
        for (s in listOf("pending", "processing", "succeeded", "failed", "expired", "none")) {
            assertEquals(s, Phase.Paid, FlashCheckoutRules.phase(checkout(status = s, paid = true)))
        }
    }

    @Test
    fun `an open order is waiting`() {
        assertEquals(Phase.Waiting, FlashCheckoutRules.phase(checkout(status = "pending")))
        assertEquals(Phase.Waiting, FlashCheckoutRules.phase(checkout(status = "processing")))
    }

    @Test
    fun `succeeded without paid keeps waiting - the booking has not caught up`() {
        // `paid` is the server's verdict on the booking; Flash's own "succeeded" is not enough.
        assertEquals(Phase.Waiting, FlashCheckoutRules.phase(checkout(status = "succeeded", paid = false)))
    }

    @Test
    fun `a closed unpaid order offers a retry`() {
        for (s in listOf("failed", "canceled", "cancelled", "expired", "refunded")) {
            assertEquals(s, Phase.Retry, FlashCheckoutRules.phase(checkout(status = s, link = null)))
        }
    }

    @Test
    fun `no checkout yet is idle`() {
        assertEquals(Phase.Idle, FlashCheckoutRules.phase(null))
        assertEquals(Phase.Idle, FlashCheckoutRules.phase(checkout(status = "none", link = null)))
    }

    // ---- Polling ------------------------------------------------------------

    @Test
    fun `polls only while waiting and inside the window`() {
        val t0 = 1_000_000L
        assertTrue(FlashCheckoutRules.shouldPoll(Phase.Waiting, t0, t0))
        assertTrue(FlashCheckoutRules.shouldPoll(Phase.Waiting, t0, t0 + FlashCheckoutRules.POLL_TIMEOUT_MS - 1))
        assertFalse(FlashCheckoutRules.shouldPoll(Phase.Waiting, t0, t0 + FlashCheckoutRules.POLL_TIMEOUT_MS))
        assertFalse(FlashCheckoutRules.shouldPoll(Phase.Waiting, null, t0))
        assertFalse(FlashCheckoutRules.shouldPoll(Phase.Paid, t0, t0))
        assertFalse(FlashCheckoutRules.shouldPoll(Phase.Retry, t0, t0))
        assertFalse(FlashCheckoutRules.shouldPoll(Phase.Idle, t0, t0))
    }

    // ---- Method vocabulary --------------------------------------------------

    @Test
    fun `flash is a known method and the only automatic one`() {
        assertEquals(BookingService.PaymentMethod.FLASH, BookingService.PaymentMethod.fromWire("flash"))
        assertFalse(BookingService.PaymentMethod.FLASH.isManual)
        assertTrue(BookingService.PaymentMethod.INSTAPAY.isManual)
        assertTrue(BookingService.PaymentMethod.BANK_TRANSFER.isManual)
        assertNull(BookingService.PaymentMethod.fromWire("paymob"))
    }

    @Test
    fun `the screenshot upload never sends flash`() {
        val all = listOf(
            BookingService.PaymentMethod.FLASH,
            BookingService.PaymentMethod.INSTAPAY,
            BookingService.PaymentMethod.BANK_TRANSFER,
        )
        assertEquals(pm.INSTAPAY, pm.Companion.forProof(pm.FLASH, all))
        assertEquals(pm.BANK_TRANSFER, pm.Companion.forProof(pm.BANK_TRANSFER, all))
        assertEquals(pm.BANK_TRANSFER, pm.Companion.forProof(null, listOf(pm.FLASH, pm.BANK_TRANSFER)))
        // A pick the server no longer offers falls back to what it does offer.
        assertEquals(pm.BANK_TRANSFER, pm.Companion.forProof(pm.INSTAPAY, listOf(pm.FLASH, pm.BANK_TRANSFER)))
        // Flash-only (or nothing loaded) still never yields flash.
        assertEquals(pm.INSTAPAY, pm.Companion.forProof(pm.FLASH, listOf(pm.FLASH)))
        assertEquals(pm.INSTAPAY, pm.Companion.forProof(null, emptyList()))
    }
}
