package com.quickin.app

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Guards [StayGuideRules.viewFor] — which face of the stay guide the reservation-detail screen
 * shows. The companion to [ReservationHostGateTest]: that one guards WHO the viewer is, this one
 * guards WHAT they are shown once their role is known.
 *
 * THE regression this file exists for: on a REJECTED reservation the screen still rendered the
 * host's "You can build the stay guide once you approve this reservation" note. The reported
 * sighting was a guest's — the screen was reading an account-level `is_host`, fixed by
 * [Reservation.isViewerHost] — but the note is wrong on a rejected booking for the real host too:
 * it promises an unlock that turning the request down already ruled out.
 *
 * Plain JVM, no emulator: `./gradlew testDebugUnitTest`.
 */
class StayGuideRulesTest {

    /** A reader with a live pass and something to read; overridden per case. */
    private fun view(
        isHost: Boolean = false,
        hasStayPass: Boolean = true,
        canEdit: Boolean = false,
        awaitingApproval: Boolean = false,
        itemCount: Int = 1,
        loading: Boolean = false,
    ) = StayGuideRules.viewFor(
        isHost = isHost,
        hasStayPass = hasStayPass,
        canEdit = canEdit,
        awaitingApproval = awaitingApproval,
        itemCount = itemCount,
        loading = loading
    )

    // ---- The reported bug ----------------------------------------------------

    @Test
    fun `a rejected reservation says nothing about approving it`() {
        // Rejected: no pass, nothing writable, and approval is behind this booking rather than
        // ahead of it (`awaitingApproval` is false — only a pending request is awaiting one).
        // Neither side gets the note: not the guest who reported it, and not the host either.
        val rejected = { isHost: Boolean ->
            view(
                isHost = isHost,
                hasStayPass = false,
                canEdit = false,
                awaitingApproval = false,
                itemCount = 0
            )
        }
        assertEquals(StayGuideRules.View.Hidden, rejected(true))
        assertEquals(StayGuideRules.View.Hidden, rejected(false))
    }

    @Test
    fun `a guest never sees the host's approval note`() {
        // The ticket's exact screen: a guest on a reservation with no guide of any kind.
        assertEquals(
            StayGuideRules.View.Hidden,
            view(isHost = false, hasStayPass = false, awaitingApproval = true, itemCount = 0)
        )
    }

    @Test
    fun `a pending request still tells its host to approve it`() {
        // The one state where the note is true: the host has not answered yet.
        assertEquals(
            StayGuideRules.View.AwaitingApproval,
            view(isHost = true, hasStayPass = false, awaitingApproval = true, itemCount = 0)
        )
    }

    // ---- The host's builder ---------------------------------------------------

    @Test
    fun `the host gets the builder as soon as the booking is writable`() {
        // Approved but unpaid: no pass yet, and that is the point — the host writes the check-in
        // notes while the guest pays.
        assertEquals(
            StayGuideRules.View.Editor,
            view(isHost = true, hasStayPass = false, canEdit = true, itemCount = 0)
        )
    }

    @Test
    fun `an empty guide still opens the builder for its host`() {
        assertEquals(StayGuideRules.View.Editor, view(isHost = true, canEdit = true, itemCount = 0))
    }

    @Test
    fun `a host who can no longer edit reads it like a guest`() {
        // Checked out: the backend refuses writes, so the controls would only 403.
        assertEquals(StayGuideRules.View.ReadOnly, view(isHost = true, canEdit = false))
        assertEquals(
            StayGuideRules.View.Hidden,
            view(isHost = true, canEdit = false, itemCount = 0)
        )
    }

    // ---- The guest's copy -----------------------------------------------------

    @Test
    fun `the guest reads the guide once the pass is live`() {
        assertEquals(StayGuideRules.View.ReadOnly, view())
    }

    @Test
    fun `no pass, no guide — whatever the guide holds`() {
        // The same gate as the QR: the guide is what the pass leads to (gate codes, Wi-Fi), so an
        // unpaid stay must not open it. The server agrees — it returns an empty guide here.
        assertEquals(StayGuideRules.View.Hidden, view(hasStayPass = false, itemCount = 3))
    }

    @Test
    fun `an empty guide shows a guest nothing at all`() {
        // No empty state for content that isn't theirs to add.
        assertEquals(StayGuideRules.View.Hidden, view(itemCount = 0))
    }

    @Test
    fun `a still-loading guide keeps its card so the spinner has a home`() {
        assertEquals(StayGuideRules.View.ReadOnly, view(itemCount = 0, loading = true))
    }
}
