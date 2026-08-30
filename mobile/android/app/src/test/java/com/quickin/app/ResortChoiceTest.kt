package com.quickin.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Kotlin mirror of the backend's `test/unit/resort-core.test.mjs` + `resort-choice.test.mjs`
 * (and of the web repo's copies of both). Those guard `resort-core.ts` / `resort-choice.ts`; this
 * one guards [ResortChoice], the hand-written Kotlin translation — and iOS carries a third copy in
 * `ResortChoice.swift`. A change to the floor, the length cap or the ORDER of the checks belongs in
 * all of them, and this suite is what notices when it isn't.
 *
 * Plain JVM, no emulator: `./gradlew testDebugUnitTest`.
 */
class ResortChoiceTest {

    @Test
    fun `a name with no letters is refused rather than stored`() {
        // The reported shape of the bug this rule exists for: `@@@@@` slugs to '' server-side, and
        // the write path reads a slug-less name as "no resort chosen" — so the host's answer was
        // silently discarded and the listing missed every resort filter.
        assertEquals(ResortChoice.Problem.LETTERS, ResortChoice.check("@@@@@"))
        assertEquals(ResortChoice.Problem.LETTERS, ResortChoice.check("12345"))
        assertEquals(ResortChoice.Problem.LETTERS, ResortChoice.check("-----"))
        assertFalse(ResortChoice.isValidName("!!!"))
    }

    @Test
    fun `letters is reported before tooShort`() {
        // Order matters: `@@@@@` is told the thing actually wrong with it ("write it in words")
        // rather than being sent back to add a sixth `@`.
        assertEquals(ResortChoice.Problem.LETTERS, ResortChoice.check("@@"))
        assertEquals(ResortChoice.Problem.TOO_SHORT, ResortChoice.check("A5"))
    }

    @Test
    fun `blank and whitespace-only are required, not letters`() {
        assertEquals(ResortChoice.Problem.REQUIRED, ResortChoice.check(null))
        assertEquals(ResortChoice.Problem.REQUIRED, ResortChoice.check(""))
        assertEquals(ResortChoice.Problem.REQUIRED, ResortChoice.check("   "))
        // Invisible characters survive a trim and would otherwise read as a non-empty name.
        assertEquals(ResortChoice.Problem.REQUIRED, ResortChoice.check("​​﻿"))
    }

    @Test
    fun `real compound names in any script are accepted`() {
        // Not "must be Latin" and not "no punctuation" — these are names hosts actually type.
        assertNull(ResortChoice.check("Marassi"))
        assertNull(ResortChoice.check("Marassi (North)"))
        assertNull(ResortChoice.check("Sa7el Chalet"))
        assertNull(ResortChoice.check("هاسيندا باي"))
        assertEquals(2, ResortChoice.MIN_NAME_LETTERS)
    }

    @Test
    fun `normalize collapses whitespace and caps the length but keeps the host's spelling`() {
        assertEquals("Hacienda Bay", ResortChoice.normalizeName("  Hacienda   Bay \n"))
        // Capitalisation and punctuation survive: the raw text is shown to guests as typed until
        // an admin approves a canonical spelling.
        assertEquals("aMoUaGe.", ResortChoice.normalizeName("aMoUaGe."))
        assertEquals(
            ResortChoice.MAX_NAME_LENGTH,
            ResortChoice.normalizeName("م".repeat(400))!!.length
        )
        assertNull(ResortChoice.normalizeName("   "))
    }

    @Test
    fun `only Other with no name blocks the step`() {
        // "Not in a resort" and a catalog pick are both complete answers; a host who never opened
        // the picker must not be stopped by a question they were not asked.
        assertNull(ResortChoice.blocker(ResortChoice.Selection.NONE))
        assertNull(ResortChoice.blocker(ResortChoice.Selection.catalog("d3b0…")))
        assertNull(ResortChoice.blocker(ResortChoice.Selection.other("Marassi")))
        // The one combination refused: the server cannot tell a blank name from "no resort
        // chosen", so it would save the listing with none at all.
        assertTrue(ResortChoice.blocker(ResortChoice.Selection.other("")) != null)
        assertTrue(ResortChoice.blocker(ResortChoice.Selection.other("   ")) != null)
        assertTrue(ResortChoice.blocker(ResortChoice.Selection.other("@@@@@")) != null)
    }

    @Test
    fun `the payload carries the id or the name, never both`() {
        // A CHECK constraint enforces the same thing server-side.
        val catalog = ResortChoice.payload(ResortChoice.Selection.catalog("abc"))
        assertEquals("abc", catalog.id)
        assertNull(catalog.name)

        val typed = ResortChoice.payload(ResortChoice.Selection.other("  Hacienda  Bay "))
        assertNull(typed.id)
        assertEquals("Hacienda Bay", typed.name)

        val none = ResortChoice.payload(ResortChoice.Selection.NONE)
        assertNull(none.id)
        assertNull(none.name)
    }

    @Test
    fun `NONE is not an Other with an empty name`() {
        // The two look alike and mean opposite things: one is "my place isn't in a compound", the
        // other is "it is, and I haven't typed which yet" — which is what [blocker] refuses.
        assertFalse(ResortChoice.Selection.NONE.isOther)
        assertTrue(ResortChoice.Selection.other("").isOther)
    }
}
