package com.quickin.app.ui

import com.quickin.app.HostVisibility
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Covers the host listings status filter: what each chip selects, and the count each chip is
 * badged with — so a host can see how many listings are waiting on review without clicking the
 * chip to find out, and can see that a status is empty without clicking at all.
 */
class HostListingFilterTest {

    @Test
    fun `All takes every state, blocked listings included`() {
        for (state in HostVisibility.entries) {
            assertTrue(state.name, HostListingFilter.All.matches(state))
        }
    }

    @Test
    fun `a status chip takes only its own state`() {
        assertTrue(HostListingFilter.Published.matches(HostVisibility.Live))
        assertFalse(HostListingFilter.Published.matches(HostVisibility.Deactivated))
        assertTrue(HostListingFilter.UnderReview.matches(HostVisibility.UnderReview))
        assertFalse(HostListingFilter.UnderReview.matches(HostVisibility.Rejected))
    }

    @Test
    fun `blocked has no chip of its own`() {
        val chips = HostListingFilter.entries.filter { it != HostListingFilter.All }
        assertTrue(chips.none { it.matches(HostVisibility.Blocked) })
    }

    @Test
    fun `each chip is counted, and All holds the total`() {
        val counts = hostListingFilterCounts(
            listOf(
                HostVisibility.Live,
                HostVisibility.Live,
                HostVisibility.UnderReview,
                HostVisibility.Rejected,
                HostVisibility.Deactivated,
                HostVisibility.Deactivated,
                HostVisibility.Deactivated
            )
        )
        assertEquals(7, counts[HostListingFilter.All])
        assertEquals(2, counts[HostListingFilter.Published])
        assertEquals(1, counts[HostListingFilter.UnderReview])
        assertEquals(1, counts[HostListingFilter.Rejected])
        assertEquals(3, counts[HostListingFilter.Deactivated])
    }

    @Test
    fun `a status with nothing in it reads zero rather than going missing`() {
        val counts = hostListingFilterCounts(listOf(HostVisibility.Live))
        for (filter in HostListingFilter.entries) {
            assertEquals("no count for $filter", true, counts.containsKey(filter))
        }
        assertEquals(0, counts[HostListingFilter.UnderReview])
        assertEquals(0, counts[HostListingFilter.Rejected])
        assertEquals(0, counts[HostListingFilter.Deactivated])
    }

    @Test
    fun `no listings at all means every chip reads zero`() {
        val counts = hostListingFilterCounts(emptyList())
        assertTrue(counts.values.all { it == 0 })
        assertEquals(HostListingFilter.entries.size, counts.size)
    }

    @Test
    fun `a blocked listing counts under All but under no chip of its own`() {
        val counts = hostListingFilterCounts(listOf(HostVisibility.Live, HostVisibility.Blocked))
        assertEquals(2, counts[HostListingFilter.All])
        assertEquals(1, counts[HostListingFilter.Published])
        val chipped = HostListingFilter.entries
            .filter { it != HostListingFilter.All }
            .sumOf { counts[it] ?: 0 }
        assertEquals(1, chipped)
    }

    @Test
    fun `every count matches what its chip would actually show`() {
        val states = listOf(
            HostVisibility.Live,
            HostVisibility.Rejected,
            HostVisibility.Rejected,
            HostVisibility.Blocked,
            HostVisibility.UnderReview
        )
        val counts = hostListingFilterCounts(states)
        for (filter in HostListingFilter.entries) {
            assertEquals(filter.name, states.count { filter.matches(it) }, counts[filter])
        }
    }
}
