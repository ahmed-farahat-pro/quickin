package com.quickin.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Guards [Reservation.isViewerHost] — "is the signed-in account the host OF THIS RESERVATION",
 * which is the gate on every host-only control on the reservation detail screen (the stay-guide
 * builder and the editable "From your host" notes). iOS carries the same rule in
 * `ReservationDetailView.isHost(_:)`; a change to one belongs in both.
 *
 * THE regression this file exists for: the screen gated those controls on `AuthUiState.isHost`, an
 * ACCOUNT-level flag meaning "this account owns at least one listing". Under the unified account
 * every host is also an ordinary guest, so a host opening their OWN accepted trip — or any guest
 * who happens to host something — was handed the host's Stay Guide Builder for a listing they do
 * not own. [Reservation.canEditStayGuide] never had anything to say about it: it answers whether
 * the BOOKING is in a writable state, not whether the VIEWER may write it. Both halves are needed.
 *
 * Plain JVM, no emulator: `./gradlew testDebugUnitTest`.
 */
class ReservationHostGateTest {

    private val host = "11111111-1111-1111-1111-111111111111"
    private val guest = "22222222-2222-2222-2222-222222222222"

    private fun reservation(hostId: String? = host) = Reservation(
        id = "b1",
        reservationCode = "QK-7F3K9Q",
        status = "confirmed",
        title = "Villa",
        location = "Sahel",
        checkIn = "2026-09-01",
        checkOut = "2026-09-04",
        guests = 2,
        totalPrice = 4200.0,
        paymentStatus = "paid",
        hostId = hostId,
    )

    // ---- The reported bug ----------------------------------------------------

    @Test
    fun `a guest who hosts elsewhere is not the host of this stay`() {
        // The exact ticket: signed in as a guest whose account owns a listing of its own, on a
        // reservation the host has just accepted. `accountIsHost` is true and must not matter.
        assertFalse(reservation().isViewerHost(guest, accountIsHost = true))
    }

    @Test
    fun `an accepted booking does not make its guest the host`() {
        // canEditStayGuide goes true at exactly this transition — which is why the builder appeared
        // "after the reservation is accepted". It is the viewer half that has to say no.
        val accepted = reservation()
        assertTrue(accepted.canEditStayGuide)
        assertFalse(accepted.isViewerHost(guest, accountIsHost = true))
    }

    @Test
    fun `the listing's own host is the host`() {
        assertTrue(reservation().isViewerHost(host, accountIsHost = true))
        // Reachable on Android through a reservation deep link, where the account flag may not have
        // been refreshed yet: the id is enough on its own.
        assertTrue(reservation().isViewerHost(host, accountIsHost = false))
    }

    @Test
    fun `a host who booked their own listing keeps the builder`() {
        assertTrue(reservation(hostId = host).isViewerHost(host, accountIsHost = false))
    }

    // ---- Nobody signed in, and ids that aren't ids ---------------------------

    @Test
    fun `a missing viewer id is never the host`() {
        for (viewer in listOf(null, "", "   ", "null")) {
            assertFalse("viewer=$viewer", reservation().isViewerHost(viewer, accountIsHost = true))
        }
    }

    @Test
    fun `two absent ids do not match each other`() {
        // JSONObject#optString hands back the literal "null" for a JSON null — see optStringOrNull.
        // Comparing raw strings would make a codeless host and a signed-out viewer the same person.
        assertFalse(reservation(hostId = "null").isViewerHost("null", accountIsHost = false))
        assertFalse(reservation(hostId = "  ").isViewerHost("  ", accountIsHost = false))
    }

    @Test
    fun `ids match case-insensitively`() {
        assertTrue(reservation(hostId = host.uppercase()).isViewerHost(host, accountIsHost = false))
        assertTrue(reservation(hostId = " $host ").isViewerHost(host, accountIsHost = false))
    }

    // ---- The fallback --------------------------------------------------------

    @Test
    fun `the account flag only stands in when the backend omits host_id`() {
        // Mirrors iOS. The backend always sends it (BOOKING_COLS selects l.host_id), so this is a
        // compatibility path — and it is the ONLY path on which the account flag decides anything.
        assertTrue(reservation(hostId = null).isViewerHost(guest, accountIsHost = true))
        assertFalse(reservation(hostId = null).isViewerHost(guest, accountIsHost = false))
    }

    @Test
    fun `a present host_id always outranks the account flag`() {
        assertFalse(reservation(hostId = host).isViewerHost(guest, accountIsHost = true))
        assertTrue(reservation(hostId = guest).isViewerHost(guest, accountIsHost = false))
    }
}
