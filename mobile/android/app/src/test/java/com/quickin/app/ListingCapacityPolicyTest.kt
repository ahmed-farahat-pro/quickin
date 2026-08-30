package com.quickin.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Kotlin mirror of the backend's `test/unit/listing-capacity-policy.test.mjs` (and of the
 * web repo's copy of the same suite, and of iOS's Tests/ListingCapacityPolicyTests). Those guard
 * `listing-capacity-policy.ts`; this one guards [ListingCapacityPolicy], which is the
 * hand-written Kotlin translation — so a change to the floor or to the per-type bedroom table
 * belongs in all of them, and this suite is what notices when it isn't.
 *
 * Plain JVM, no emulator: `./gradlew testDebugUnitTest`.
 */
class ListingCapacityPolicyTest {

    @Test
    fun `zero is refused for every count`() {
        // The reported defect: bedrooms 0 and beds 0 walked through the add-listing wizard and
        // published a listing with nowhere to sleep.
        assertFalse(ListingCapacityPolicy.isValid("0"))
        assertFalse(
            ListingCapacityPolicy.allValid(
                maxGuests = "2", bedrooms = "0", beds = "0", bathrooms = "1",
                propertyType = "Villa"
            )
        )
    }

    @Test
    fun `one is the floor, and isValid is only ever the floor half`() {
        assertEquals(1, ListingCapacityPolicy.MINIMUM)
        assertTrue(ListingCapacityPolicy.isValid("1"))
        assertTrue(ListingCapacityPolicy.isValid("12"))
        // isValid answers "is this at least the floor" and nothing else — the ceiling depends on
        // which field and which property type, which one string cannot say. allValid is the gate.
        assertTrue(ListingCapacityPolicy.isValid("400"))
    }

    @Test
    fun `a blank or non-numeric field is invalid rather than silently the floor`() {
        // `value.toIntOrNull() ?: min` used to read an empty field as the minimum, which is how
        // a number nobody typed reached the API.
        assertFalse(ListingCapacityPolicy.isValid(""))
        assertFalse(ListingCapacityPolicy.isValid("   "))
        assertFalse(ListingCapacityPolicy.isValid(null))
        assertFalse(ListingCapacityPolicy.isValid("two"))
        assertFalse(ListingCapacityPolicy.isValid("1.5"))
        assertFalse(ListingCapacityPolicy.isValid("-3"))
    }

    @Test
    fun `surrounding whitespace does not decide the answer`() {
        assertTrue(ListingCapacityPolicy.isValid(" 2 "))
        assertFalse(ListingCapacityPolicy.isValid(" 0 "))
    }

    @Test
    fun `allValid needs all four counts, not most of them`() {
        assertTrue(
            ListingCapacityPolicy.allValid(
                maxGuests = "4", bedrooms = "2", beds = "3", bathrooms = "1",
                propertyType = "Villa"
            )
        )
        for (i in 0..3) {
            val v = MutableList(4) { "1" }
            v[i] = "0"
            assertFalse(
                "count $i at zero must fail",
                ListingCapacityPolicy.allValid(v[0], v[1], v[2], v[3], "Villa")
            )
        }
    }

    @Test
    fun `seeding the editor tells a missing count apart from a zero one`() {
        // NULL is a question nobody asked — it opens at the floor rather than putting a 0 in
        // the host's mouth and then refusing them for it.
        assertEquals("1", ListingCapacityPolicy.seed(null))
        // A stored 0 was published by some host before this rule existed. It is shown as it is,
        // so the editor can block Save and say why.
        assertEquals("0", ListingCapacityPolicy.seed(0))
        assertEquals("3", ListingCapacityPolicy.seed(3))
        // Same for a stored count over the ceiling — shown as it is, so the host can see what to
        // fix rather than having it silently rewritten to 3.
        assertEquals("27373", ListingCapacityPolicy.seed(27373))
    }

    // -- The bedroom ceiling: the defect this half of the policy exists for ------------------

    /**
     * Product's table, transcribed so a change to the policy has to be a deliberate change here
     * too. Studio is the one row that is not a straight copy: product wrote "must be 0", meaning
     * no separate bedroom, and the floor is 1 — so the rule is "exactly 1".
     */
    private val table = listOf(
        "Apartment" to 5, "House" to 6, "Villa" to 8, "Cabin" to 3, "Studio" to 1,
        "Loft" to 3, "Chalet" to 6, "Cottage" to 4, "Guest suite" to 2
    )

    /** A listing that is fine apart from the bedroom count under test. */
    private fun validWith(bedrooms: Int, type: String) =
        ListingCapacityPolicy.allValid("2", bedrooms.toString(), "1", "1", type)

    @Test
    fun `Cabin and Chalet refuse an unrealistic room count`() {
        // Steps to reproduce, as filed: pick Cabin or Chalet, type a big number, submit. Both
        // used to go through, and both of these are real rows on Neon.
        assertFalse(validWith(40, "Cabin"))
        assertFalse(validWith(40, "Chalet"))
        assertFalse(validWith(12, "Chalet"))
        assertFalse(validWith(27373, "Studio"))
    }

    @Test
    fun `every property type accepts its maximum and refuses one more`() {
        for ((type, max) in table) {
            assertTrue("$type should accept $max", validWith(max, type))
            assertFalse("$type should refuse ${max + 1}", validWith(max + 1, type))
            assertEquals(max, ListingCapacityPolicy.maxBedrooms(type))
        }
    }

    @Test
    fun `the floor still applies underneath the ceiling`() {
        for ((type, _) in table) {
            assertFalse("$type should still refuse 0", validWith(0, type))
            assertTrue("$type should still accept 1", validWith(1, type))
        }
    }

    @Test
    fun `a Studio is exactly one room`() {
        // Product's "must be 0" and the platform floor of 1 are the same statement: the single
        // room IS the bedroom. What must not happen is a studio claiming a second one.
        assertTrue(validWith(1, "Studio"))
        assertFalse(validWith(2, "Studio"))
        assertEquals(ListingCapacityPolicy.MINIMUM, ListingCapacityPolicy.maxBedrooms("Studio"))
    }

    @Test
    fun `the type is matched however the client cased or spaced it`() {
        // property_type is stored in English and written by web, iOS, Android and the API.
        for (spelling in listOf("cabin", "CABIN", " Cabin ", "CaBiN")) {
            assertEquals(spelling, 3, ListingCapacityPolicy.maxBedrooms(spelling))
        }
        for (spelling in listOf("Guest suite", "guest suite", "GUEST SUITE", "Guest  suite")) {
            assertEquals(spelling, 2, ListingCapacityPolicy.maxBedrooms(spelling))
        }
        assertEquals("guest suite", ListingCapacityPolicy.normalizeKey("Guest  Suite"))
        assertEquals(null, ListingCapacityPolicy.normalizeKey("   "))
        assertEquals(null, ListingCapacityPolicy.normalizeKey(null))
    }

    @Test
    fun `a type nobody has ruled on gets the most permissive number`() {
        // 'Guest House' is in this app's own picker and absent from product's table. Judging it
        // HARDER than a type they did rule on would refuse listings over a rule that doesn't
        // exist.
        assertEquals(
            ListingCapacityPolicy.DEFAULT_MAX_BEDROOMS,
            ListingCapacityPolicy.maxBedrooms("Guest House")
        )
        assertEquals(
            ListingCapacityPolicy.DEFAULT_MAX_BEDROOMS,
            ListingCapacityPolicy.maxBedrooms(null)
        )
        assertEquals(
            "the fallback must stay the most permissive number in the table",
            table.maxOf { it.second },
            ListingCapacityPolicy.DEFAULT_MAX_BEDROOMS
        )
        // …and it is not named in the sentence, which would state a rule it has no part in.
        assertEquals(null, ListingCapacityPolicy.namedType("Guest House"))
        assertEquals("Cabin", ListingCapacityPolicy.namedType("cabin"))
        assertEquals("Guest suite", ListingCapacityPolicy.namedType("guest suite"))
    }

    @Test
    fun `the other three counts are bounded too, and ignore the property type`() {
        // Only bedrooms has a table — a Cabin does not get fewer bathrooms than a Villa. But the
        // same keypad types into all four, so leaving these open would move 27,373 one field
        // to the right.
        assertTrue(ListingCapacityPolicy.allValid("32", "3", "30", "20", "Cabin"))
        assertFalse(ListingCapacityPolicy.allValid("33", "3", "30", "20", "Cabin"))
        assertFalse(ListingCapacityPolicy.allValid("32", "3", "31", "20", "Cabin"))
        assertFalse(ListingCapacityPolicy.allValid("32", "3", "30", "21", "Cabin"))
        assertTrue(ListingCapacityPolicy.exceedsOtherCeiling("99", "1", "1"))
        assertFalse(ListingCapacityPolicy.exceedsOtherCeiling("2", "1", "1"))
    }

    @Test
    fun `which half of the rule was broken decides which sentence is shown`() {
        // A count that is too HIGH must not be reported as too low, and vice versa — they are
        // different things to fix.
        assertTrue(ListingCapacityPolicy.isBelowFloor("2", "0", "1", "1"))
        assertFalse(ListingCapacityPolicy.isBelowFloor("2", "40", "1", "1"))
        assertTrue(ListingCapacityPolicy.exceedsBedroomCeiling("40", "Cabin"))
        assertFalse(ListingCapacityPolicy.exceedsBedroomCeiling("3", "Cabin"))
        // A blank field is below the floor, not above the ceiling.
        assertFalse(ListingCapacityPolicy.exceedsBedroomCeiling("", "Cabin"))
        assertTrue(ListingCapacityPolicy.isBelowFloor("2", "", "1", "1"))
    }

    @Test
    fun `ordinary listings still pass — the half a bad cap would break`() {
        assertTrue(validWith(3, "Chalet"))
        assertTrue(validWith(2, "Apartment"))
        assertTrue(validWith(1, "Cabin"))
    }
}
