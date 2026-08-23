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

    // ---- A name is letters and nothing else --------------------------------

    @Test
    fun `digits alone are not a name`() {
        // `12345` used to become a real display name — the one a host reads next
        // to a booking request and an operator matches against an ID document.
        for (raw in listOf("12345", "0100", "٠١٢٣", "...", "42")) {
            assertTrue(raw, problem(raw) is NameRules.Problem.InvalidCharacters)
            assertFalse(raw, NameRules.isValid(raw))
        }
    }

    @Test
    fun `one digit is enough to refuse an otherwise ordinary name`() {
        // The rule is not "mostly letters" — the field is matched against an ID
        // document, and `Layla2` is not what the document says.
        for (raw in listOf("Layla2", "Ahmed01", "Layla Hassan 2", "محمد2")) {
            assertTrue(raw, problem(raw) is NameRules.Problem.InvalidCharacters)
            assertFalse(raw, NameRules.isValid(raw))
        }
    }

    @Test
    fun `Franco-Arabic spellings are refused - this is the rule that changed`() {
        // These were deliberately accepted by the first version of this policy,
        // which asked only that a name contain some letter. A guest who writes
        // `Ma7moud` is now asked for `Mahmoud`, the spelling on the ID.
        for (raw in listOf("Ma7moud", "3omar", "Mo7amed Ali", "7abiba")) {
            assertTrue(raw, problem(raw) is NameRules.Problem.InvalidCharacters)
            assertFalse(raw, NameRules.isValid(raw))
        }
    }

    @Test
    fun `symbols, punctuation and emoji are refused`() {
        for (raw in listOf("j.doe", "Layla_Hassan", "layla@mail.com", "😀😀", "Layla 😀", "<b>Layla</b>")) {
            assertTrue(raw, problem(raw) is NameRules.Problem.InvalidCharacters)
            assertFalse(raw, NameRules.isValid(raw))
        }
    }

    @Test
    fun `a name of legal punctuation only has no letters in it`() {
        // The one case InvalidCharacters cannot catch: every character is
        // allowed, and there is no name in there anyway.
        for (raw in listOf("----", "'''", "- '")) {
            assertTrue(raw, problem(raw) is NameRules.Problem.NoLetters)
            assertFalse(raw, NameRules.isValid(raw))
        }
    }

    @Test
    fun `letters in any script count`() {
        for (raw in listOf("ليلى حسن", "Ольга", "李雷", "Ægir", "Zoë")) {
            assertNull(raw, problem(raw))
            assertTrue(raw, NameRules.isValid(raw))
        }
    }

    @Test
    fun `the accent and the harakat travel as combining marks, and belong in a name`() {
        // A keyboard can send `José` as `e` + U+0301 rather than as `é`, and
        // Arabic typed with diacritics carries a mark after most letters.
        // Neither is a letter to Character.isLetter, and refusing them would
        // refuse the scripts this rule exists to serve.
        for (raw in listOf("José Ángel", "مُحَمَّد")) {
            assertNull(raw, problem(raw))
            assertTrue(raw, NameRules.isValid(raw))
        }
    }

    @Test
    fun `the hyphen and apostrophe a keyboard actually sends`() {
        // Smart punctuation rewrites `'` to `’` as it is typed, and a name
        // pasted from a document carries the typographic hyphens with it.
        for (raw in listOf("Jean-Luc", "O'Brien", "O’Brien", "Jean‐Luc", "Jean‑Luc")) {
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
        // A letter outside the BMP is one character to whoever typed it;
        // counting UTF-16 units would make a 60-character name read as 120 and
        // refuse it — and would split that letter into two halves, neither of
        // which is a letter at all.
        val sixty = "a".repeat(NameRules.MAX_LENGTH)
        assertNull(sixty, problem(sixty))
        assertTrue(problem("a".repeat(NameRules.MAX_LENGTH + 1)) is NameRules.Problem.TooLong)
        val gothic = "𐌰".repeat(NameRules.MAX_LENGTH)
        assertNull(gothic, problem(gothic))
        assertTrue(problem(gothic + "𐌰") is NameRules.Problem.TooLong)
    }

    @Test
    fun `the character verdict is reached before the too-short one`() {
        // Order matters: `5` is told the thing that is actually wrong with it,
        // not sent back to type a second digit.
        assertTrue(problem("5") is NameRules.Problem.InvalidCharacters)
        assertTrue(problem("A1") is NameRules.Problem.InvalidCharacters)
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
