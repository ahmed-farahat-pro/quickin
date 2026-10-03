package com.quickin.app

/**
 * A Flash (useflash.app) hosted card/wallet checkout for one booking, as
 * `POST|GET /api/local/bookings/:id/flash-checkout` reports it.
 *
 * [paid] is **the server's verdict on the booking**, not Flash's word on the order: the backend
 * only sets it once the booking is actually paid (by any method), after checking the amount Flash
 * says it collected covers the order. [status] is Flash's own order status, kept for the UI's
 * "failed / expired" copy — never read it as "paid".
 *
 * [paymentLink] is only present while the order is open (pending/processing); the server sends
 * null otherwise.
 */
data class FlashCheckout(
    /** pending | processing | succeeded | failed | canceled | refunded | expired | none. */
    val status: String,
    val paid: Boolean,
    val paymentLink: String?,
    val expiresAt: String?,
    val amountCents: Long?,
    val orderId: String?
)

/**
 * The decisions the pay sheet makes about a Flash checkout, kept out of Compose and away from
 * `org.json` so the JVM unit test ([FlashCheckoutRulesTest]) runs them directly.
 *
 * Flash has no return URL, so the app never hears "the guest finished paying". It opens the hosted
 * page, then polls the GET endpoint (every [POLL_INTERVAL_MS], and again whenever the app comes
 * back to the foreground) until the server says [FlashCheckout.paid], the order closes, or
 * [POLL_TIMEOUT_MS] passes. Mirrors `normalizeFlashStatus` / `isOpenFlashStatus` in the backend's
 * `src/lib/local/flash-core.ts`.
 */
object FlashCheckoutRules {

    const val POLL_INTERVAL_MS = 3_000L

    /** A Flash order is valid for 30 minutes; give up polling well before a guest gives up on us. */
    const val POLL_TIMEOUT_MS = 15 * 60 * 1_000L

    private val STATUSES = setOf(
        "pending", "processing", "succeeded", "failed", "canceled", "refunded", "expired", "none",
    )

    /**
     * Flash's status in our vocabulary. Unknown words read as `pending`, as they do server-side:
     * an unrecognised status must never look paid, and must never close a checkout either. A
     * missing one is `none` — there is no checkout yet.
     */
    fun normalizeStatus(raw: String?): String {
        val v = raw?.trim()?.lowercase().orEmpty()
        if (v.isEmpty() || v == "null") return "none"
        if (v == "cancelled") return "canceled"
        if (v == "success" || v == "paid") return "succeeded"
        return if (v in STATUSES) v else "pending"
    }

    /**
     * Builds a [FlashCheckout] from the raw response fields. Blank strings collapse to null, and a
     * link that isn't http(s) is dropped — it is handed straight to a browser.
     */
    fun of(
        status: String?,
        paid: Boolean?,
        paymentLink: String?,
        expiresAt: String?,
        amountCents: Long?,
        orderId: String?
    ): FlashCheckout = FlashCheckout(
        status = normalizeStatus(status),
        paid = paid == true,
        paymentLink = paymentLink?.trim()
            ?.takeIf { it.startsWith("https://") || it.startsWith("http://") },
        expiresAt = expiresAt.clean(),
        amountCents = amountCents?.takeIf { it >= 0 },
        orderId = orderId.clean()
    )

    private fun String?.clean(): String? =
        this?.trim()?.takeIf { it.isNotEmpty() && !it.equals("null", ignoreCase = true) }

    /** What the Flash panel shows. */
    enum class Phase {
        /** No checkout yet — offer the "Pay EGP X" button. */
        Idle,

        /** A checkout is open (or Flash took the money and the booking hasn't caught up) — keep polling. */
        Waiting,

        /** The booking is paid. */
        Paid,

        /** The order failed, was canceled, expired or refunded. Paying again mints a fresh link. */
        Retry,
    }

    fun phase(c: FlashCheckout?): Phase {
        if (c == null) return Phase.Idle
        if (c.paid) return Phase.Paid
        return when (c.status) {
            "none" -> Phase.Idle
            "failed", "canceled", "expired", "refunded" -> Phase.Retry
            // pending / processing — the guest is on Flash's page. `succeeded` without `paid` is
            // the webhook and the booking row racing; the next poll settles it.
            else -> Phase.Waiting
        }
    }

    /** Whether to keep polling: only while waiting, and only until [POLL_TIMEOUT_MS] has passed. */
    fun shouldPoll(phase: Phase, startedAtMs: Long?, nowMs: Long): Boolean =
        phase == Phase.Waiting && startedAtMs != null && nowMs - startedAtMs < POLL_TIMEOUT_MS
}
