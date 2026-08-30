package com.quickin.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Kotlin mirror of the backend's `test/unit/listing-title-policy.test.mjs` (and of the web
 * repo's copy of the same suite). Those two guard `listing-title-policy.ts`; this one guards
 * [ListingTitlePolicy], which is the hand-written Kotlin translation — so a change to the rule
 * belongs in all of them, and this suite is what notices when it isn't.
 *
 * iOS carries a third translation in `AddListingView.swift` that nothing can run: that project
 * has no test target. When a case here changes, change it there by hand too.
 *
 * Plain JVM, no emulator: `./gradlew testDebugUnitTest`.
 */
class ListingTitlePolicyTest {

    // ---- The bug this policy exists for ------------------------------------------------------

    @Test
    fun `a title of only special characters is refused`() {
        // The reported defect: each of these cleared step 1 of the add-listing wizard and was
        // only refused by the API on step 4, three steps from the field that was wrong.
        for (title in listOf("@@@@@", "!!!!!", "#\u0024%^&", ".....", "-----", "???")) {
            assertEquals(title, ListingTitlePolicy.Problem.LETTERS, ListingTitlePolicy.check(title))
        }
    }

    @Test
    fun `a title of only digits is refused too`() {
        for (title in listOf("12345", "٠١٢٣٤", "2024")) {
            assertEquals(title, ListingTitlePolicy.Problem.LETTERS, ListingTitlePolicy.check(title))
        }
    }

    @Test
    fun `symbols mixed with a real title are fine - the rule is letters, not purity`() {
        for (title in listOf("Nile-view flat (2BR)", "★ Sahel chalet ★", "Villa #4 — sea view")) {
            assertNull(title, ListingTitlePolicy.check(title))
        }
    }

    // ---- The titles this app is built for ----------------------------------------------------

    @Test
    fun `Arabic titles pass`() {
        assertNull(ListingTitlePolicy.check("شقة بإطلالة على النيل"))
    }

    @Test
    fun `Franco-Arabic passes - numerals stand in for letters, but not for all of them`() {
        assertNull(ListingTitlePolicy.check("Sa7el chalet"))
        assertNull(ListingTitlePolicy.check("Sha2a fel Gouna"))
    }

    @Test
    fun `an emoji is not a letter`() {
        assertEquals(ListingTitlePolicy.Problem.LETTERS, ListingTitlePolicy.check("🏖🏖🏖"))
    }

    // ---- The other refusals ------------------------------------------------------------------

    @Test
    fun `empty, blank and whitespace-only are REQUIRED`() {
        for (title in listOf("", "   ", "\t\n", null)) {
            assertEquals(ListingTitlePolicy.Problem.REQUIRED, ListingTitlePolicy.check(title))
        }
    }

    @Test
    fun `a title made only of invisible characters is REQUIRED, not accepted`() {
        // They survive trim() and render as nothing — a listing named with them would show an
        // empty card. Zero-width space, BOM, bidi mark, soft hyphen.
        assertEquals(
            ListingTitlePolicy.Problem.REQUIRED,
            ListingTitlePolicy.check("\u200B\uFEFF\u202A\u00AD")
        )
    }

    @Test
    fun `fewer than MIN_LETTERS letters is TOO_SHORT`() {
        assertEquals(ListingTitlePolicy.Problem.TOO_SHORT, ListingTitlePolicy.check("A5"))
        assertEquals(ListingTitlePolicy.Problem.TOO_SHORT, ListingTitlePolicy.check("B"))
        // The boundary itself is accepted.
        assertNull(ListingTitlePolicy.check("Fla".take(ListingTitlePolicy.MIN_LETTERS)))
    }

    @Test
    fun `over MAX_LENGTH is TOO_LONG, counted in code points`() {
        assertNull(ListingTitlePolicy.check("a".repeat(ListingTitlePolicy.MAX_LENGTH)))
        assertEquals(
            ListingTitlePolicy.Problem.TOO_LONG,
            ListingTitlePolicy.check("a".repeat(ListingTitlePolicy.MAX_LENGTH + 1))
        )
        // 200 Arabic characters is 200 characters, not 400.
        assertNull(ListingTitlePolicy.check("ش".repeat(ListingTitlePolicy.MAX_LENGTH)))
    }

    @Test
    fun `LETTERS is reported before TOO_SHORT - say what is actually wrong`() {
        // `@@` is both letterless and short; being told to add a third `@` would be advice that
        // leads nowhere.
        assertEquals(ListingTitlePolicy.Problem.LETTERS, ListingTitlePolicy.check("@@"))
    }

    // ---- normalize ---------------------------------------------------------------------------

    @Test
    fun `normalize trims, collapses whitespace runs and drops invisibles`() {
        assertEquals("Nile view", ListingTitlePolicy.normalize("  Nile   view  "))
        assertEquals("Seaside villa", ListingTitlePolicy.normalize("Sea\u200Bside\tvilla"))
        assertEquals("Chalet", ListingTitlePolicy.normalize("\nChalet\n"))
    }

    @Test
    fun `normalize turns null into the empty string rather than the word null`() {
        assertEquals("", ListingTitlePolicy.normalize(null))
    }

    @Test
    fun `the check normalizes for you - a padded good title still passes`() {
        assertNull(ListingTitlePolicy.check("   Gouna   chalet   "))
    }

    // ---- The gate the wizard actually calls ---------------------------------------------------

    @Test
    fun `isValid is the gate on Next`() {
        assertFalse(ListingTitlePolicy.isValid("12345"))
        assertFalse(ListingTitlePolicy.isValid(""))
        assertTrue(ListingTitlePolicy.isValid("Gouna chalet"))
    }
}
