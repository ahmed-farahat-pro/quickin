package com.quickin.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Guards [NotificationLinkRules] — what a notification row / push tap opens. The regression this
 * exists for: only `comment` / `comment_reply` used to route anywhere; every reservation, host,
 * account and subscription notification just marked itself read. The link alone decides now.
 *
 * Plain JVM, no emulator: `./gradlew testDebugUnitTest`.
 */
class NotificationLinkRulesTest {

    private fun dest(link: String?) = NotificationLinkRules.destination(link)

    // ---- Listings -------------------------------------------------------------------

    @Test
    fun `listing links open the listing, comments focus from the fragment or query`() {
        assertEquals(DeepLink.Listing("L9", focusComments = true), dest("/explore/L9#comments"))
        assertEquals(DeepLink.Listing("L9", focusComments = false), dest("/explore/L9"))
        assertEquals(DeepLink.Listing("L9", focusComments = true), dest("/explore/L9?focus=comments"))
        assertEquals(DeepLink.Listing("L9", focusComments = true), dest("/explore/L9/#comments"))
        assertEquals(DeepLink.Listing("abc-123", focusComments = true),
            dest("https://quickin-frontend.vercel.app/explore/abc-123#comments"))
        assertEquals(DeepLink.Listing("abc-123", focusComments = true), dest("quickin://explore/abc-123#comments"))
        assertEquals(DeepLink.Listing("L9"), dest("  /EXPLORE/L9  "))
        // A bare /explore has no listing to open.
        assertNull(dest("/explore"))
    }

    @Test
    fun `the type never matters - a listing link routes whatever the notification type`() {
        for (type in listOf("comment", "comment_reply", "booking", "message", "review", null)) {
            assertEquals(DeepLink.Listing("L9"), NotificationLinkRules.destination("/explore/L9"))
            assertEquals("quickin://explore/L9", NotificationLinkRules.pushLink(type, "/explore/L9"))
        }
    }

    // ---- Reservations -----------------------------------------------------------------

    @Test
    fun `reservation links open the reservation detail, the list opens Trips`() {
        assertEquals(DeepLink.Reservation("b-1"), dest("/reservation/b-1"))
        assertEquals(DeepLink.Reservation("b-1"), dest("/reservation/b-1?x=1"))
        assertEquals(DeepLink.Tab("reservations"), dest("/reservations"))
        assertEquals(DeepLink.Tab("reservations"), dest("/reservations/"))
        assertNull(dest("/reservation"))
    }

    // ---- Tabs and screens ---------------------------------------------------------------

    @Test
    fun `host, account, verify-id and subscriptions map to their screens`() {
        assertEquals(DeepLink.Tab("host"), dest("/host"))
        assertEquals(DeepLink.Tab("profile"), dest("/account"))
        // No standalone ID-verification screen on Android: its card lives on Profile.
        assertEquals(DeepLink.Tab("profile"), dest("/verify-id"))
        assertEquals(DeepLink.Tab("subscriptions"), dest("/subscriptions"))
    }

    @Test
    fun `messages, ops, blank and unknown links route nowhere`() {
        assertNull(dest(null))
        assertNull(dest(""))
        assertNull(dest("   "))
        assertNull(dest("/"))
        assertNull(dest("/messages"))
        assertNull(dest("/messages?conversation=x"))
        assertNull(dest("/ops"))
        assertNull(dest("/ops/disputes/1"))
        assertNull(dest("/something-new"))
        assertNull(dest("mailto:x@y.z"))
        assertNull(dest("ftp://host/explore/L9"))
    }

    // ---- Push taps ------------------------------------------------------------------------

    @Test
    fun `push links become canonical app-scheme links`() {
        assertEquals("quickin://explore/L9#comments", NotificationLinkRules.pushLink("comment", "/explore/L9#comments"))
        assertEquals("quickin://explore/L9#comments", NotificationLinkRules.pushLink("comment", "/explore/L9?focus=comments"))
        assertEquals("quickin://reservation/b-1", NotificationLinkRules.pushLink("booking", "/reservation/b-1"))
        assertEquals("quickin://reservation/b-1",
            NotificationLinkRules.pushLink("booking", "https://quickin-frontend.vercel.app/reservation/b-1"))
        assertEquals("quickin://reservations", NotificationLinkRules.pushLink("booking", "/reservations"))
        assertEquals("quickin://host", NotificationLinkRules.pushLink("booking_request", "/host"))
        assertEquals("quickin://profile", NotificationLinkRules.pushLink("host_status", "/account"))
        assertEquals("quickin://profile", NotificationLinkRules.pushLink("verification", "/verify-id"))
        assertEquals("quickin://subscriptions", NotificationLinkRules.pushLink("service", "/subscriptions"))
    }

    @Test
    fun `unroutable pushes carry no link`() {
        assertNull(NotificationLinkRules.pushLink("message", "/messages?conversation=x"))
        assertNull(NotificationLinkRules.pushLink("dispute", "/ops"))
        assertNull(NotificationLinkRules.pushLink("comment", null))
        assertNull(NotificationLinkRules.pushLink("comment", "  "))
    }

    @Test
    fun `every tab a push can carry is one DeepLink parse accepts as a bare route`() {
        val links = listOf("/reservations", "/host", "/account", "/verify-id", "/subscriptions")
        for (link in links) {
            val tab = dest(link) as DeepLink.Tab
            assertTrue("${tab.key} must be a DeepLink tab key", tab.key in DeepLink.TAB_KEYS)
        }
    }

    @Test
    fun `a canonical push link reads back to the same destination`() {
        val links = listOf(
            "/explore/L9#comments", "/explore/L9", "/reservation/b-1", "/reservations",
            "/host", "/account", "/verify-id", "/subscriptions",
        )
        for (link in links) {
            val d = dest(link)!!
            assertEquals(d, dest(NotificationLinkRules.toUri(d)))
        }
    }
}
