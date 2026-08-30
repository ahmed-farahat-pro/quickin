package com.quickin.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Kotlin mirror of the backend's `test/unit/listing-capacity-policy.test.mjs` (and of the
 * web repo's copy of the same suite). Those two guard `listing-capacity-policy.ts`; this one
 * guards [ListingCapacityPolicy], which is the hand-written Kotlin translation — so a change to
 * the floor belongs in all of them, and this suite is what notices when it isn't.
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
                maxGuests = "2", bedrooms = "0", beds = "0", bathrooms = "1"
            )
        )
    }

    @Test
    fun `one is the floor and anything above it is fine`() {
        assertEquals(1, ListingCapacityPolicy.MINIMUM)
        assertTrue(ListingCapacityPolicy.isValid("1"))
        assertTrue(ListingCapacityPolicy.isValid("12"))
        // No upper bound in the rule — an unusually large villa is not an error.
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
                maxGuests = "4", bedrooms = "2", beds = "3", bathrooms = "1"
            )
        )
        for (i in 0..3) {
            val v = MutableList(4) { "1" }
            v[i] = "0"
            assertFalse(
                "count $i at zero must fail",
                ListingCapacityPolicy.allValid(v[0], v[1], v[2], v[3])
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
    }
}
