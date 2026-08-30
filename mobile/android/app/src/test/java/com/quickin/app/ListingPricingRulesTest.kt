package com.quickin.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Kotlin mirror of the backend's `test/unit/listing-pricing-core.test.mjs` (and of the web
 * repo's copy of the same suite), for the half of that file [ListingPricingRules] translates:
 * what a host may type into the weekend rate and the twelve per-month rates.
 *
 * The reported defect: **Weekend and Seasonal pricing accepted `0`.** A host typed 0, continued,
 * and the listing saved — with no weekend rate at all. Every layer read the text the same lenient
 * way (`toDoubleOrNull()?.takeIf { it > 0.0 }`), which cannot tell a typed zero from an empty
 * field, so the rate was dropped in silence on the phone, in the request, and again in the API.
 *
 * The two halves of the rule are tested separately on purpose. Refusing `0` is the fix; still
 * ACCEPTING an empty field is what must not break with it, because empty is how a host turns
 * weekend pricing off and how a month goes back to the base nightly price.
 *
 * Plain JVM, no emulator: `./gradlew testDebugUnitTest`.
 */
class ListingPricingRulesTest {

    // ---- The bug: a rate the host typed has to be money --------------------------------------

    @Test
    fun `zero is refused, not read as no rate`() {
        val problem = (ListingPricingRules.checkPrice("0").exceptionOrNull() as ListingPriceException).problem
        assertEquals(ListingPricingRules.Problem.NOT_POSITIVE, problem)
    }

    @Test
    fun `zero in every shape a field can produce it`() {
        for (text in listOf("0", "00", "0.0", " 0 ", "-200", "-1")) {
            assertEquals(
                "\"$text\" was accepted",
                ListingPricingRules.Problem.NOT_POSITIVE,
                ListingPricingRules.problemWith(text)
            )
        }
    }

    @Test
    fun `text that is not a number is refused as such`() {
        // The field filters to digits, so these arrive by paste or from a seeded value — and a
        // rule that only the keyboard enforces is not a rule.
        for (text in listOf("abc", "1,500", "--", "1.2.3")) {
            assertEquals(
                "\"$text\" was accepted",
                ListingPricingRules.Problem.NOT_A_NUMBER,
                ListingPricingRules.problemWith(text)
            )
        }
    }

    // ---- The half that must not break: empty still clears -------------------------------------

    @Test
    fun `an empty field is no rate, and never an error`() {
        for (text in listOf("", "   ")) {
            val checked = ListingPricingRules.checkPrice(text)
            assertTrue("\"$text\" was rejected", checked.isSuccess)
            assertNull(checked.getOrThrow())
        }
    }

    @Test
    fun `a real rate is kept, as a whole number`() {
        assertEquals(1500.0, ListingPricingRules.checkPrice("1500").getOrThrow())
        assertEquals(1500.0, ListingPricingRules.checkPrice(" 1500 ").getOrThrow())
        // Rounded the way the server stores it, so a preview here matches the quote.
        assertEquals(5000.0, ListingPricingRules.checkPrice("4999.6").getOrThrow())
        // The smallest rate that is still a rate.
        assertEquals(1.0, ListingPricingRules.checkPrice("1").getOrThrow())
    }

    // ---- The twelve months --------------------------------------------------------------------

    @Test
    fun `only the months the host priced are sent`() {
        val checked = ListingPricingRules.checkMonths(mapOf("7" to "8500", "8" to "", "9" to "   "))
        assertEquals(mapOf("7" to 8500.0), checked.getOrThrow())
    }

    @Test
    fun `no months at all is normal, not an error`() {
        assertEquals(emptyMap<String, Double>(), ListingPricingRules.checkMonths(emptyMap()).getOrThrow())
    }

    @Test
    fun `a month typed as zero is refused and named`() {
        val failure = ListingPricingRules.failingMonth(mapOf("8" to "0"))!!
        assertEquals(8, failure.month)
        assertEquals(ListingPricingRules.Problem.NOT_POSITIVE, failure.problem)
    }

    @Test
    fun `the month reported is the first one on the screen, not the first enumerated`() {
        // A LinkedHashMap seeded in this order enumerates October first; the host reads their form
        // top to bottom, so March is the one to point at.
        val failure = ListingPricingRules.failingMonth(linkedMapOf("10" to "0", "3" to "0"))!!
        assertEquals(3, failure.month)
    }

    @Test
    fun `months outside 1 to 12 are dropped rather than reported`() {
        // The pricing ladder can never reach them, so there is nothing to tell the host about —
        // and a junk key held in state must not make the screen unsaveable.
        val checked = ListingPricingRules.checkMonths(mapOf("0" to "900", "13" to "0", "" to "900", "6" to "900"))
        assertEquals(mapOf("6" to 900.0), checked.getOrThrow())
    }

    @Test
    fun `every month of the year is reachable`() {
        val all = (1..ListingPricingRules.MONTHS_IN_YEAR).associate { it.toString() to (it * 100).toString() }
        assertEquals(ListingPricingRules.MONTHS_IN_YEAR, ListingPricingRules.checkMonths(all).getOrThrow().size)
    }

    // ---- …and the pair with the day rule ------------------------------------------------------

    @Test
    fun `a zero rate never reaches the day rule at all`() {
        // WeekendSchedule.resolve answers "no days, no error" to a rate of 0 — correctly, since it
        // is only ever handed a rate that already passed checkPrice. This records why the price is
        // checked FIRST: ask the day rule about a raw 0 and it says everything is fine.
        assertTrue(WeekendSchedule.resolve(0.0, emptySet()).isSuccess)
        assertNull(WeekendSchedule.resolve(0.0, emptySet()).getOrThrow())
        assertEquals(ListingPricingRules.Problem.NOT_POSITIVE, ListingPricingRules.problemWith("0"))
    }
}
