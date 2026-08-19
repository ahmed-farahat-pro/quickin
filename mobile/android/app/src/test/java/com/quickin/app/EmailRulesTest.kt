package com.quickin.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for [EmailRules] — the address policy the sign-up button is gated on.
 *
 * Filed as "[Android] Sign-Up Allows Email Addresses with Invalid Format": the
 * Create Account form took anything and let the server (which also took
 * anything) open the account. Both doors were closed on 2026-08-19, but only
 * three of the four clients that guard the SAME `users` row could prove it —
 * the backend twin has `test/unit/email-core.test.mjs` and the web shares that
 * file byte for byte, while the Kotlin copy had no coverage at all. A rule
 * nobody runs is a rule that drifts.
 *
 * The cases below are the Kotlin mirror of that backend suite, so a change on
 * one side that is not made on the other fails here rather than in QA. Pure
 * value logic — no Android framework, no network — so this runs on the desktop
 * JVM via `./gradlew :app:testDebugUnitTest`.
 */
class EmailRulesTest {

    private fun problem(raw: String) = EmailRules.problemWith(raw)

    // ---- The reported bug: malformed addresses ----------------------------

    @Test
    fun `an address with no at sign is a format problem`() {
        for (raw in listOf("notanemail", "guest.example.com", "guest example com")) {
            assertTrue(raw, problem(raw) is EmailRules.Problem.Format)
            assertFalse(raw, EmailRules.isAcceptableForSignup(raw))
        }
    }

    @Test
    fun `an at sign with nothing on one side of it is refused`() {
        for (raw in listOf("@example.com", "guest@", "@", "guest@@example.com")) {
            assertTrue(raw, problem(raw) is EmailRules.Problem.Format)
        }
    }

    @Test
    fun `a bare hostname with no dot is refused`() {
        assertTrue(problem("guest@localhost") is EmailRules.Problem.Format)
        assertTrue(problem("guest@example") is EmailRules.Problem.Format)
    }

    @Test
    fun `dots may not start, end or double up`() {
        for (raw in listOf(".guest@example.com", "guest.@example.com", "gu..est@example.com", "guest@example..com")) {
            assertTrue(raw, problem(raw) is EmailRules.Problem.Format)
        }
    }

    @Test
    fun `a domain label may not start or end with a hyphen`() {
        assertTrue(problem("guest@-example.com") is EmailRules.Problem.Format)
        assertTrue(problem("guest@example-.com") is EmailRules.Problem.Format)
    }

    @Test
    fun `spaces anywhere in the address are refused`() {
        for (raw in listOf("gu est@example.com", "guest@exa mple.com")) {
            assertTrue(raw, problem(raw) is EmailRules.Problem.Format)
        }
    }

    @Test
    fun `a numeric or one-letter extension is malformed, not unknown`() {
        assertTrue(problem("guest@example.c") is EmailRules.Problem.Format)
        assertTrue(problem("guest@example.123") is EmailRules.Problem.Format)
    }

    @Test
    fun `empty is required, not invalid`() {
        assertTrue(problem("") is EmailRules.Problem.Required)
        assertTrue(problem("   ") is EmailRules.Problem.Required)
    }

    @Test
    fun `an over-length address is refused at the SMTP limit`() {
        val long = "a".repeat(EmailRules.MAX_LENGTH) + "@gmail.com"
        assertTrue(problem(long) is EmailRules.Problem.TooLong)
    }

    // ---- Well-formed but undeliverable ------------------------------------

    @Test
    fun `rejects dot-con, the typo the whole rule exists for`() {
        val p = problem("layla@email.con")
        assertTrue(p is EmailRules.Problem.UnknownTld)
        assertEquals("con", (p as EmailRules.Problem.UnknownTld).tld)
        assertFalse(EmailRules.isValid("layla@email.con"))
    }

    @Test
    fun `rejects the other common dot-com near misses`() {
        for (tld in listOf("con", "cim", "cmo", "ocm", "xom", "vom", "comm", "cpm")) {
            assertTrue(tld, problem("guest@example.$tld") is EmailRules.Problem.UnknownTld)
        }
    }

    @Test
    fun `rejects an extension that is simply invented`() {
        assertTrue(problem("guest@quickin.notarealtld") is EmailRules.Problem.UnknownTld)
    }

    @Test
    fun `a refused address carries the domain the guest probably meant`() {
        assertEquals("gmail.com", (problem("a@gmail.con") as EmailRules.Problem.UnknownTld).suggestion)
        assertEquals("my-company.com", (problem("a@my-company.con") as EmailRules.Problem.UnknownTld).suggestion)
        assertEquals("elgouna-rentals.net", (problem("a@elgouna-rentals.ner") as EmailRules.Problem.UnknownTld).suggestion)
    }

    @Test
    fun `never suggests cn for con — the reason the search is a short list`() {
        // `con` is one deletion from `cn` (China) exactly as it is from `com`.
        // Searching the whole root zone would answer with whichever it reached first.
        assertEquals("example.com", EmailRules.suggestDomain("example.con"))
    }

    @Test
    fun `a typo in the name half is caught too`() {
        // Only via suggestDomain: `gmial.com` ends in a real TLD and is not on
        // the blocklist, so the address itself is accepted — this is a
        // did-you-mean, not a rule. Guessing here would lock out every small
        // domain that merely resembles a big one.
        assertEquals("gmail.com", EmailRules.suggestDomain("gmial.com"))
        assertEquals("hotmail.com", EmailRules.suggestDomain("hotmial.com"))
        assertEquals("yahoo.com", EmailRules.suggestDomain("yahooo.com"))
        assertNull(problem("a@gmial.com"))
    }

    @Test
    fun `offers nothing when there is no confident guess`() {
        assertNull(EmailRules.suggestDomain("quickin.notarealtld"))
        assertNull(EmailRules.suggestDomain("gmail.com"))
        assertNull((problem("a@quickin.notarealtld") as EmailRules.Problem.UnknownTld).suggestion)
    }

    @Test
    fun `a rejected address never suggests exactly what was typed`() {
        for (raw in listOf("a@gmail.con", "a@my-company.con", "a@quickin.notarealtld")) {
            val p = problem(raw) as EmailRules.Problem.UnknownTld
            assertTrue(raw, p.suggestion == null || p.suggestion != EmailRules.domainOf(raw))
        }
    }

    // ---- Temp-mail --------------------------------------------------------

    @Test
    fun `temp-mail is blocked for a new account, including through a subdomain`() {
        for (raw in listOf("x@mailinator.com", "x@sub.mailinator.com", "x@10minutemail.com")) {
            assertTrue(raw, problem(raw) is EmailRules.Problem.Disposable)
            assertFalse(raw, EmailRules.isAcceptableForSignup(raw))
        }
    }

    @Test
    fun `temp-mail is a policy call, so isValid — a shape question — still says yes`() {
        assertTrue(EmailRules.isValid("x@mailinator.com"))
    }

    @Test
    fun `the extension is checked before the blocklist`() {
        assertTrue(problem("x@mailinator.con") is EmailRules.Problem.UnknownTld)
    }

    // ---- What must keep working -------------------------------------------

    @Test
    fun `the addresses Egyptian guests actually use are accepted`() {
        val good = listOf(
            "layla@gmail.com",
            "Layla.Hassan+booking@gmail.com",
            "guest@yahoo.com",
            "guest@outlook.com",
            "guest@hotmail.com",
            "guest@icloud.com",
            "student@aucegypt.edu",
            "staff@cu.edu.eg",
            "info@quickin.eg",
            "sales@company.com.eg",
            "someone@example.co.uk",
            "hello@studio.design",
            "book@riad.travel",
        )
        for (raw in good) assertNull(raw, problem(raw))
        for (raw in good) assertTrue(raw, EmailRules.isAcceptableForSignup(raw))
    }

    @Test
    fun `surrounding whitespace and a shouted domain are tolerated`() {
        assertNull(problem("  Layla@GMAIL.COM  "))
        assertEquals("Layla@gmail.com", EmailRules.normalized("  Layla@GMAIL.COM  "))
        assertEquals("gmail.com", EmailRules.domainOf(" Layla@GMAIL.COM "))
    }

    @Test
    fun `the allowlist is a fast path, not the policy — company mail still passes`() {
        assertFalse(EmailRules.isTrustedDomain("quickin.eg"))
        assertNull(problem("info@quickin.eg"))
    }

    @Test
    fun `a lookalike of a trusted domain is not itself trusted`() {
        assertFalse(EmailRules.isTrustedDomain("gmail.com.evil.tk"))
        assertFalse(EmailRules.isTrustedDomain("notgmail.com"))
    }

    @Test
    fun `matching is case- and whitespace-insensitive, root dot included`() {
        assertTrue(EmailRules.isTrustedDomain("  GMAIL.COM  "))
        assertTrue(EmailRules.isTrustedDomain("gmail.com."))
    }

    // ---- The generated data ------------------------------------------------

    @Test
    fun `the generated tables are big enough to be the real ones`() {
        assertTrue(EmailData.validTlds.size > 1000)
        assertTrue(EmailData.trustedDomains.size > 100)
        assertTrue(EmailData.disposableDomains.size > 100)
        assertTrue(EmailData.validTlds.contains("com"))
        assertFalse(EmailData.validTlds.contains("con"))
    }

    @Test
    fun `no domain is on both the allowlist and the blocklist`() {
        val both = EmailData.trustedDomains.intersect(EmailData.disposableDomains)
        assertTrue(both.toString(), both.isEmpty())
    }

    // ---- The gate the sign-up button reads ---------------------------------

    @Test
    fun `isAcceptableForSignup is exactly problemWith being null`() {
        for (raw in listOf("notanemail", "layla@email.con", "x@mailinator.com", "layla@gmail.com", "")) {
            assertEquals(raw, problem(raw) == null, EmailRules.isAcceptableForSignup(raw))
        }
    }

    @Test
    fun `isValid tolerates temp-mail and nothing else`() {
        assertFalse(EmailRules.isValid("notanemail"))
        assertFalse(EmailRules.isValid("layla@email.con"))
        assertTrue(EmailRules.isValid("x@mailinator.com"))
        assertTrue(EmailRules.isValid("layla@gmail.com"))
    }

    @Test
    fun `every refusal carries a problem the UI can name`() {
        for (raw in listOf("", "notanemail", "layla@email.con", "x@mailinator.com")) {
            assertNotNull(raw, problem(raw))
        }
    }
}
