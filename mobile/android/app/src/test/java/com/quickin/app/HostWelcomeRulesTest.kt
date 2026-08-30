package com.quickin.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Kotlin mirror of iOS's `Tests/HostWelcomeRulesTests/main.swift`. Both guard the same
 * decision, and a host must not be congratulated on one phone and ignored on the other.
 *
 * The reported defect: **the Host Dashboard was not discoverable after host approval.** An admin
 * approving the application flipped `is_host` server-side and the app looked identical — the
 * dashboard sat in a "Hosting" section below Account, Receipts, Messages and Currency. Persistent
 * entry points fix where it lives; this rule fixes the moment, pointing an approved host at it
 * once.
 *
 * Plain JVM, no emulator: `./gradlew testDebugUnitTest`.
 */
class HostWelcomeRulesTest {

    @Test
    fun `a freshly approved host is welcomed, once`() {
        assertTrue(HostWelcomeRules.shouldWelcome(isHost = true, userId = "user-1", shownFor = null))
        assertFalse(HostWelcomeRules.shouldWelcome(isHost = true, userId = "user-1", shownFor = "user-1"))
    }

    @Test
    fun `a guest is never welcomed`() {
        assertFalse(HostWelcomeRules.shouldWelcome(isHost = false, userId = "user-1", shownFor = null))
        assertFalse(HostWelcomeRules.shouldWelcome(isHost = false, userId = "user-1", shownFor = "user-1"))
        // An application under review is not an approval: only `is_host` may open this door.
        assertFalse(HostWelcomeRules.shouldWelcome(isHost = false, userId = "user-2", shownFor = "user-1"))
    }

    @Test
    fun `one device, several accounts — the welcome is per account`() {
        // The failure a device-wide boolean would cause: the second host to sign in on a shared
        // phone silently never gets welcomed.
        assertTrue(HostWelcomeRules.shouldWelcome(isHost = true, userId = "user-2", shownFor = "user-1"))
        assertFalse(HostWelcomeRules.shouldWelcome(isHost = true, userId = "user-2", shownFor = "user-2"))
    }

    @Test
    fun `an account we cannot name is not welcomed`() {
        // With no id there is nothing to write down, so showing it would mean showing it on every
        // launch forever — the one failure mode worse than never showing it.
        assertFalse(HostWelcomeRules.shouldWelcome(isHost = true, userId = null, shownFor = null))
        assertFalse(HostWelcomeRules.shouldWelcome(isHost = true, userId = "", shownFor = null))
        assertFalse(HostWelcomeRules.shouldWelcome(isHost = true, userId = "   ", shownFor = null))
    }

    @Test
    fun `padding is noise, not a different account`() {
        assertFalse(HostWelcomeRules.shouldWelcome(isHost = true, userId = "  user-1  ", shownFor = "user-1"))
        assertFalse(HostWelcomeRules.shouldWelcome(isHost = true, userId = "user-1", shownFor = "  user-1 "))
    }

    @Test
    fun `what gets written down after showing it`() {
        assertEquals("user-1", HostWelcomeRules.shownFor("user-1"))
        assertEquals("user-1", HostWelcomeRules.shownFor(" user-1 "))
        assertNull(HostWelcomeRules.shownFor(null))
        assertNull(HostWelcomeRules.shownFor("  "))
    }

    @Test
    fun `writing then reading back never re-shows it`() {
        // Storing an untrimmed id would make the next launch's comparison fail and re-show the
        // welcome, so the write and the read must normalize identically.
        val stored = HostWelcomeRules.shownFor("  user-9  ")
        assertFalse(HostWelcomeRules.shouldWelcome(isHost = true, userId = "  user-9  ", shownFor = stored))
    }
}
