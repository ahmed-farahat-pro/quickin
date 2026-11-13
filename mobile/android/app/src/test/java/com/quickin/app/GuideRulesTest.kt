package com.quickin.app

import com.quickin.app.GuideRules.Anchor
import com.quickin.app.GuideRules.FinalButton
import com.quickin.app.GuideRules.Screen
import com.quickin.app.GuideRules.StepId
import com.quickin.app.GuideRules.Tour
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The App guide's decisions, against `mobile/APP-GUIDE-SPEC.md`: the step tables (with their
 * signed-out / pending / host variants), the auto-start gate and the last step's buttons.
 *
 * Plain JVM, no emulator: `./gradlew testDebugUnitTest`.
 */
class GuideRulesTest {

    private fun ids(tour: Tour, signedIn: Boolean, isHost: Boolean = false, pending: Boolean = false) =
        GuideRules.steps(tour, signedIn, isHost, pending).map { it.id }

    @Test
    fun `main tour for a signed-in guest is the eight steps of the table`() {
        assertEquals(
            listOf(
                StepId.WELCOME, StepId.SEARCH, StepId.REGIONS, StepId.FILTERS,
                StepId.WISHLIST, StepId.TRIPS, StepId.PROFILE, StepId.FINISH
            ),
            ids(Tour.MAIN, signedIn = true)
        )
    }

    @Test
    fun `main tour adapts to signed out and to an existing host`() {
        val signedOut = ids(Tour.MAIN, signedIn = false)
        assertEquals(StepId.PROFILE_SIGNED_OUT, signedOut[6])
        assertEquals(StepId.FINISH, signedOut[7])

        val host = ids(Tour.MAIN, signedIn = true, isHost = true)
        assertEquals(StepId.PROFILE, host[6])
        assertEquals(StepId.FINISH_HOST, host[7])
        // A stale cached host flag on a signed-out session must not skip the host pitch.
        assertEquals(StepId.FINISH, ids(Tour.MAIN, signedIn = false, isHost = true)[7])
    }

    @Test
    fun `the tours keep a fixed length whatever the account`() {
        for (signedIn in listOf(true, false)) for (host in listOf(true, false)) for (pending in listOf(true, false)) {
            assertEquals(8, GuideRules.steps(Tour.MAIN, signedIn, host, pending).size)
            assertEquals(6, GuideRules.steps(Tour.HOST, signedIn, host, pending).size)
        }
    }

    @Test
    fun `steps two to four run on Explore, five to seven highlight tabs`() {
        val steps = GuideRules.steps(Tour.MAIN, signedIn = true, isHost = false, hostApplicationPending = false)
        assertEquals(
            listOf(Anchor.EXPLORE_SEARCH, Anchor.EXPLORE_REGIONS, Anchor.EXPLORE_FILTERS),
            steps.subList(1, 4).map { it.anchor }
        )
        assertTrue(steps.subList(0, 4).all { it.screen == Screen.EXPLORE })
        assertEquals(
            listOf(Anchor.TAB_WISHLIST, Anchor.TAB_TRIPS, Anchor.TAB_PROFILE),
            steps.subList(4, 7).map { it.anchor }
        )
        assertEquals(Anchor.NONE, steps.first().anchor)
        assertEquals(Anchor.NONE, steps.last().anchor)
    }

    @Test
    fun `host tour step three picks the variant for the account`() {
        assertEquals(StepId.HOST_BECOME_HOST, ids(Tour.HOST, signedIn = true)[2])
        assertEquals(StepId.HOST_SIGN_IN_FIRST, ids(Tour.HOST, signedIn = false)[2])
        assertEquals(StepId.HOST_PENDING, ids(Tour.HOST, signedIn = true, pending = true)[2])
        assertEquals(StepId.HOST_ALREADY_HOST, ids(Tour.HOST, signedIn = true, isHost = true)[2])
        // Signed out wins over any cached flag.
        assertEquals(StepId.HOST_SIGN_IN_FIRST, ids(Tour.HOST, signedIn = false, isHost = true, pending = true)[2])

        val guest = GuideRules.steps(Tour.HOST, signedIn = true, isHost = false, hostApplicationPending = false)
        assertEquals(Anchor.PROFILE_HOST_CARD, guest[2].anchor)
        assertEquals(Screen.PROFILE, guest[2].screen)
        assertEquals(Anchor.TAB_PROFILE, guest[1].anchor)
        assertEquals(
            listOf(StepId.HOST_INTRO, StepId.HOST_PROFILE_TAB),
            guest.take(2).map { it.id }
        )
        assertEquals(
            listOf(StepId.HOST_REQUIREMENTS, StepId.HOST_REVIEW, StepId.HOST_AFTER_APPROVAL),
            guest.drop(3).map { it.id }
        )
        assertEquals(
            Anchor.PROFILE_SIGN_IN,
            GuideRules.steps(Tour.HOST, signedIn = false, isHost = false, hostApplicationPending = false)[2].anchor
        )
        assertEquals(
            Anchor.PROFILE_HOST_DASHBOARD,
            GuideRules.steps(Tour.HOST, signedIn = true, isHost = true, hostApplicationPending = false)[2].anchor
        )
    }

    @Test
    fun `auto-start only when never seen and nothing else is up`() {
        assertTrue(GuideRules.shouldAutoStart(seen = false, blockingUIShown = false))
        assertFalse(GuideRules.shouldAutoStart(seen = false, blockingUIShown = true))
        assertFalse(GuideRules.shouldAutoStart(seen = true, blockingUIShown = false))
        assertFalse(GuideRules.shouldAutoStart(seen = true, blockingUIShown = true))
    }

    @Test
    fun `main tour last step offers the host tour unless already a host`() {
        assertEquals(
            listOf(FinalButton.SHOW_ME_HOW, FinalButton.DONE),
            GuideRules.finalButtons(StepId.FINISH, signedIn = true, isHost = false, hostApplicationPending = false)
        )
        assertEquals(
            listOf(FinalButton.SHOW_ME_HOW, FinalButton.DONE),
            GuideRules.finalButtons(StepId.FINISH, signedIn = false, isHost = false, hostApplicationPending = false)
        )
        assertEquals(
            listOf(FinalButton.DONE),
            GuideRules.finalButtons(StepId.FINISH_HOST, signedIn = true, isHost = true, hostApplicationPending = false)
        )
    }

    @Test
    fun `host tour last step - apply now only for a signed-in guest with nothing pending`() {
        fun last(signedIn: Boolean, isHost: Boolean, pending: Boolean) =
            GuideRules.finalButtons(StepId.HOST_AFTER_APPROVAL, signedIn, isHost, pending)
        assertEquals(listOf(FinalButton.APPLY_NOW, FinalButton.DONE), last(true, false, false))
        assertEquals(listOf(FinalButton.SIGN_IN, FinalButton.DONE), last(false, false, false))
        assertEquals(listOf(FinalButton.DONE), last(true, false, true))
        assertEquals(listOf(FinalButton.DONE), last(true, true, false))
    }

    @Test
    fun `a step that is not the last has no final buttons`() {
        for (id in StepId.entries) {
            if (id in setOf(StepId.FINISH, StepId.FINISH_HOST, StepId.HOST_AFTER_APPROVAL)) continue
            assertTrue(GuideRules.finalButtons(id, true, false, false).isEmpty())
        }
    }

    @Test
    fun `tapping a tab target navigates, anything else is just Next`() {
        assertEquals("wishlist", GuideRules.tabForTap(Anchor.TAB_WISHLIST))
        assertEquals("Trips", GuideRules.tabForTap(Anchor.TAB_TRIPS))
        assertEquals("Profile", GuideRules.tabForTap(Anchor.TAB_PROFILE))
        assertNull(GuideRules.tabForTap(Anchor.EXPLORE_SEARCH))
        assertNull(GuideRules.tabForTap(Anchor.PROFILE_HOST_CARD))
        assertNull(GuideRules.tabForTap(Anchor.NONE))
    }

    @Test
    fun `the seen key matches the spec`() {
        assertEquals("qk.guide.main.v1.seen", GuideRules.SEEN_KEY)
    }
}
