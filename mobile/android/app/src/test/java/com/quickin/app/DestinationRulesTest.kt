package com.quickin.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Pure rules behind the Explore destinations rail. Plain JVM: `./gradlew testDebugUnitTest`. */
class DestinationRulesTest {

    private val northCoast = Destination(
        name = "North Coast", slug = "north-coast", nameAr = "الساحل الشمالي", icon = "waves", count = 3,
        subAreas = listOf(SubArea(id = "1", slug = "marassi", name = "Marassi", nameAr = "مراسي", kmMarker = 124.0, count = 2))
    )
    private val dahab = Destination(name = "Dahab", slug = "dahab", nameAr = "دهب", icon = "mountain")

    @Test
    fun `every backend icon key maps to its own icon`() {
        val keys = listOf("waves", "sunrise", "wind", "landmark", "building", "pyramid",
            "anchor", "umbrella", "fish", "sailboat", "shell", "mountain")
        val icons = keys.map { DestinationRules.iconFor(it) }
        assertEquals(keys.size, icons.toSet().size)
        assertTrue(DestinationIcon.PLACE !in icons)
        assertEquals(DestinationIcon.WAVES, DestinationRules.iconFor(" Waves "))
    }

    @Test
    fun `unknown or missing icon key falls back to place`() {
        assertEquals(DestinationIcon.PLACE, DestinationRules.iconFor("volcano"))
        assertEquals(DestinationIcon.PLACE, DestinationRules.iconFor(null))
        assertEquals(DestinationIcon.PLACE, DestinationRules.iconFor(""))
    }

    @Test
    fun `display name is arabic only in arabic and only when present`() {
        assertEquals("الساحل الشمالي", DestinationRules.displayName(northCoast, arabic = true))
        assertEquals("North Coast", DestinationRules.displayName(northCoast, arabic = false))
        assertEquals("Giza", DestinationRules.displayName("Giza", null, arabic = true))
        assertEquals("Giza", DestinationRules.displayName("Giza", "  ", arabic = true))
    }

    @Test
    fun `host region labels cover all twelve regions`() {
        assertEquals(12, DestinationRules.REGION_NAMES_AR.size)
        assertEquals("رأس سدر", DestinationRules.regionDisplayName("Ras Sudr", arabic = true))
        assertEquals("Ras Sudr", DestinationRules.regionDisplayName("Ras Sudr", arabic = false))
        assertEquals("Atlantis", DestinationRules.regionDisplayName("Atlantis", arabic = true))
    }

    @Test
    fun `km label drops a whole-number decimal and hides when absent`() {
        assertEquals("km 124", DestinationRules.kmLabel(124.0))
        assertEquals("km 36.5", DestinationRules.kmLabel(36.5))
        assertEquals("124", DestinationRules.kmNumber(124.0))
        assertNull(DestinationRules.kmLabel(null))
        assertNull(DestinationRules.kmLabel(Double.NaN))
        assertNull(DestinationRules.kmLabel(-1.0))
    }

    @Test
    fun `selecting a region resets the sub-area and the map box`() {
        val q = ListingQuery(region = "North Coast", area = "marassi", bbox = "1,2,3,4", q = "pool")
        val next = DestinationRules.selectRegion(q, "Dahab")
        assertEquals("Dahab", next.region)
        assertNull(next.area)
        assertNull(next.bbox)
        assertEquals("pool", next.q)
        // "All" clears both.
        val all = DestinationRules.selectRegion(q, null)
        assertNull(all.region)
        assertNull(all.area)
        // Re-selecting the same region also resets the area.
        assertNull(DestinationRules.selectRegion(q, "North Coast").area)
    }

    @Test
    fun `selecting a sub-area keeps the region`() {
        val q = ListingQuery(region = "North Coast")
        val next = DestinationRules.selectArea(q, "marassi")
        assertEquals("North Coast", next.region)
        assertEquals("marassi", next.area)
        assertNull(DestinationRules.selectArea(next, null).area)
        // No region selected: an area is meaningless and is dropped.
        assertNull(DestinationRules.selectArea(ListingQuery(), "marassi").area)
    }

    @Test
    fun `sub-area row only exists for a region that has sub-areas`() {
        val all = listOf(northCoast, dahab)
        assertEquals(1, DestinationRules.subAreasFor(all, "North Coast").size)
        assertEquals(1, DestinationRules.subAreasFor(all, "north coast").size)
        assertTrue(DestinationRules.subAreasFor(all, "Dahab").isEmpty())
        assertTrue(DestinationRules.subAreasFor(all, null).isEmpty())
        assertTrue(DestinationRules.subAreasFor(emptyList(), "North Coast").isEmpty())
    }

    @Test
    fun `the server's Other chip is just another sub-area and selects area=other`() {
        // As GET /api/local/destinations sends it for listings whose host typed their own resort.
        val other = SubArea(id = "other-north-coast", slug = "other", name = "Other", nameAr = "أخرى", count = 3)
        val tree = listOf(northCoast.copy(count = 5, subAreas = northCoast.subAreas + other))
        val chips = DestinationRules.subAreasFor(tree, "North Coast")
        assertEquals(listOf("marassi", "other"), chips.map { it.slug })
        assertEquals("أخرى", DestinationRules.displayName(chips.last(), true))
        assertNull(DestinationRules.kmNumber(chips.last().kmMarker))
        assertEquals("other", DestinationRules.selectArea(ListingQuery(region = "North Coast"), "other").area)
    }
}
