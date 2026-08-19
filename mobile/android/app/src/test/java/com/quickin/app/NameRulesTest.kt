package com.quickin.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for [NameRules] — the name policy the sign-up button is gated on.
 *
 * Filed as "[Android] Account Can Be Created Without Entering Full Name": the
 * Create Account form gated its button on the address and the password only, so
 * leaving Full name empty and filling everything else created a real account.
 * The server does not close this one either — a signup with no `full_name`
 * falls back to the local part of the address, because a social login
 * legitimately arrives without a name — so this form is the only door that can
 * refuse it, and the only place a test can prove it stays refused.
 *
 * The cases below mirror the backend's `test/unit/name-policy.test.mjs`, which
 * the web shares byte for byte, and the iOS `NameRules` twin. All four guard the
 * same `users.full_name`; a change made on one side and not the others fails
 * here rather than in QA. Pure value logic — no Android framework, no network —
 * so this runs on the desktop JVM via `./gradlew :app:testDebugUnitTest`.
 */
class NameRulesTest {

    private fun problem(raw: String) = NameRules.problemWith(raw)

    // ---- The reported bug: no name at all ---------------------------------

    @Test
    fun `an empty name is required, not accepted`() {
        for (raw in listOf("", " ", "   ", "\t", "\n")) {
            assertTrue(raw, problem(raw) is NameRules.Problem.Required)
            assertFalse(raw, NameRules.isValid(raw))
        }
    }

    @Test
    fun `a name of only invisible characters reads as empty`() {
        // The soft hyphen, zero-width space, bidi marks and the BOM survive a
        // trim and render as nothing — a form that only checks isNotBlank lets
        // every one of these through as a "name".
        for (raw in listOf("­", "​", "​‌‍", "﻿", "‪‮")) {
            assertTrue(raw, problem(raw) is NameRules.Problem.Required)
            assertFalse(raw, NameRules.isValid(raw))
        }
    }

    // ---- A name has to contain letters ------------------------------------

    @Test
    fun `digits alone are not a name`() {
        // `12345` used to become a real display name — the one a host reads next
        // to a booking request and an operator matches against an ID document.
        for (raw in listOf("12345", "0100", "٠١٢٣", "----", "...", "42")) {
            assertTrue(raw, problem(raw) is NameRules.Problem.NoLetters)
            assertFalse(raw, NameRules.isValid(raw))
        }
    }

    @Test
    fun `Franco-Arabic names with numerals are accepted`() {
        // Deliberately NOT "no digits": `Ma7moud` and `3omar` are how real names
        // are written by exactly the guests this app is built for.
        for (raw in listOf("Ma7moud", "3omar", "Mo7amed Ali", "7abiba")) {
            assertNull(raw, problem(raw))
            assertTrue(raw, NameRules.isValid(raw))
        }
    }

    @Test
    fun `letters in any script count`() {
        for (raw in listOf("ليلى حسن", "Ольга", "李雷", "Ægir", "Zoë")) {
            assertNull(raw, problem(raw))
            assertTrue(raw, NameRules.isValid(raw))
        }
    }

    // ---- Length ------------------------------------------------------------

    @Test
    fun `a single letter is too short`() {
        for (raw in listOf("L", "ل", "  A  ")) {
            assertTrue(raw, problem(raw) is NameRules.Problem.TooShort)
            assertFalse(raw, NameRules.isValid(raw))
        }
    }

    @Test
    fun `two letters is enough`() {
        for (raw in listOf("Al", "Jo", "علي")) {
            assertNull(raw, problem(raw))
        }
    }

    @Test
    fun `a name is measured in code points, not UTF-16 units`() {
        // An emoji is one character to whoever typed it; counting UTF-16 units
        // would make a 60-character Arabic name read as 120 and refuse it.
        val sixty = "a".repeat(NameRules.MAX_LENGTH)
        assertNull(sixty, problem(sixty))
        assertTrue(problem("a".repeat(NameRules.MAX_LENGTH + 1)) is NameRules.Problem.TooLong)
        assertNull(problem("😀".repeat(NameRules.MAX_LENGTH - 2) + "Jo"))
    }

    @Test
    fun `the no-letters verdict is reached before the too-short one`() {
        // Order matters: `5` is told the thing that is actually wrong with it,
        // not sent back to type a second digit.
        assertTrue(problem("5") is NameRules.Problem.NoLetters)
    }

    // ---- Normalization: what actually gets sent ----------------------------

    @Test
    fun `whitespace runs collapse and ends are trimmed`() {
        assertEquals("Layla Hassan", NameRules.normalized("  Layla   Hassan  "))
        assertEquals("Layla Hassan", NameRules.normalized("Layla\tHassan"))
        assertEquals("Layla Hassan", NameRules.normalized("Layla\n\nHassan"))
    }

    @Test
    fun `a non-breaking space is whitespace too`() {
        // `\s` is ASCII-only in java.util.regex unless UNICODE_CHARACTER_CLASS
        // is on; without it a pasted NBSP would survive here and be collapsed by
        // the server, so the two would disagree about what the stored name is.
        assertEquals("Layla Hassan", NameRules.normalized("Layla Hassan"))
    }

    @Test
    fun `invisible characters are dropped rather than stored`() {
        assertEquals("LaylaHassan", NameRules.normalized("Layla​Hassan"))
        assertEquals("Layla Hassan", NameRules.normalized("﻿Layla Hassan­"))
    }
}
