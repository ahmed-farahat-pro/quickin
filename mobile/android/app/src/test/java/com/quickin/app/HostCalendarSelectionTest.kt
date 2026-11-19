package com.quickin.app

import com.quickin.app.HostCalendarSelection.PriceSpan
import com.quickin.app.HostCalendarSelection.RunPosition
import com.quickin.app.HostCalendarSelection.SelectionRun
import com.quickin.app.HostCalendarSelection.SwipeDirection
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Kotlin mirror of the web's `test/unit/calendar-selection-core.test.mjs`: the host pricing
 * calendar's tap-start/tap-end selection, run grouping and month paging, without a device.
 *
 * Plain JVM, no emulator: `./gradlew testDebugUnitTest`.
 */
class HostCalendarSelectionTest {

    private val all: (String) -> Boolean = { true }
    private val cap = 800
    private fun sorted(s: Set<String>) = s.sorted()

    // ---- tapDay ---------------------------------------------------------------

    @Test
    fun `first tap selects the day and makes it the pending anchor`() {
        val r = HostCalendarSelection.tapDay(emptySet(), null, "2026-12-20", all, cap)
        assertEquals(listOf("2026-12-20"), sorted(r.selected))
        assertEquals("2026-12-20", r.anchor)
    }

    @Test
    fun `second tap fills the range and clears the anchor`() {
        val r = HostCalendarSelection.tapDay(setOf("2026-12-20"), "2026-12-20", "2026-12-23", all, cap)
        assertEquals(listOf("2026-12-20", "2026-12-21", "2026-12-22", "2026-12-23"), sorted(r.selected))
        assertNull(r.anchor)
    }

    @Test
    fun `the end may come before the anchor`() {
        val r = HostCalendarSelection.tapDay(setOf("2026-12-23"), "2026-12-23", "2026-12-21", all, cap)
        assertEquals(listOf("2026-12-21", "2026-12-22", "2026-12-23"), sorted(r.selected))
    }

    @Test
    fun `tapping the anchor again keeps it as a single day`() {
        val r = HostCalendarSelection.tapDay(setOf("2026-12-20"), "2026-12-20", "2026-12-20", all, cap)
        assertEquals(listOf("2026-12-20"), sorted(r.selected))
        assertNull(r.anchor)
    }

    @Test
    fun `with nothing pending, tapping a selected day removes it`() {
        val r = HostCalendarSelection.tapDay(setOf("2026-12-20", "2026-12-21"), null, "2026-12-21", all, cap)
        assertEquals(listOf("2026-12-20"), sorted(r.selected))
        assertNull(r.anchor)
    }

    @Test
    fun `ranges accumulate - a fresh tap starts a second range beside the first`() {
        val r = HostCalendarSelection.tapDay(setOf("2026-12-01", "2026-12-02"), null, "2026-12-10", all, cap)
        assertEquals(listOf("2026-12-01", "2026-12-02", "2026-12-10"), sorted(r.selected))
        assertEquals("2026-12-10", r.anchor)
    }

    @Test
    fun `booked days inside a range are skipped, not refused`() {
        val editable: (String) -> Boolean = { it != "2026-12-22" }
        val r = HostCalendarSelection.tapDay(setOf("2026-12-20"), "2026-12-20", "2026-12-24", editable, cap)
        assertEquals(listOf("2026-12-20", "2026-12-21", "2026-12-23", "2026-12-24"), sorted(r.selected))
    }

    @Test
    fun `tapping an uneditable day changes nothing`() {
        val r = HostCalendarSelection.tapDay(setOf("2026-12-20"), "2026-12-20", "2026-12-22", { it != "2026-12-22" }, cap)
        assertEquals(listOf("2026-12-20"), sorted(r.selected))
        assertEquals("2026-12-20", r.anchor)
    }

    @Test
    fun `a stale anchor (no longer selected) is ignored`() {
        val r = HostCalendarSelection.tapDay(emptySet(), "2026-12-20", "2026-12-25", all, cap)
        assertEquals(listOf("2026-12-25"), sorted(r.selected))
        assertEquals("2026-12-25", r.anchor)
    }

    @Test
    fun `a range past the per-save cap is refused and the anchor stays pending`() {
        val r = HostCalendarSelection.tapDay(setOf("2026-12-01"), "2026-12-01", "2026-12-11", all, 5)
        assertTrue(r.tooLong)
        assertEquals(listOf("2026-12-01"), sorted(r.selected))
        assertEquals("2026-12-01", r.anchor)
    }

    @Test
    fun `the real cap is 800 days`() {
        assertEquals(800, HostCalendarSelection.MAX_DATES_PER_REQUEST)
        // 2026-01-01 + 799 days is the 800th day: allowed. One more is refused.
        val end800 = HostCalendarSelection.addDays("2026-01-01", 799)!!
        val ok = HostCalendarSelection.tapDay(setOf("2026-01-01"), "2026-01-01", end800, all)
        assertFalse(ok.tooLong)
        assertEquals(800, ok.selected.size)
        val end801 = HostCalendarSelection.addDays("2026-01-01", 800)!!
        assertTrue(HostCalendarSelection.tapDay(setOf("2026-01-01"), "2026-01-01", end801, all).tooLong)
    }

    @Test
    fun `does not mutate the input set`() {
        val before = setOf("2026-12-20")
        HostCalendarSelection.tapDay(before, "2026-12-20", "2026-12-22", all, cap)
        assertEquals(listOf("2026-12-20"), sorted(before))
    }

    // ---- rangeDays ------------------------------------------------------------

    @Test
    fun `rangeDays is inclusive, order-independent, and crosses month ends`() {
        assertEquals(
            listOf("2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"),
            HostCalendarSelection.rangeDays("2027-01-02", "2026-12-30", all, cap)
        )
    }

    @Test
    fun `rangeDays is empty past the cap or for bad input`() {
        assertEquals(emptyList<String>(), HostCalendarSelection.rangeDays("2026-12-01", "2026-12-10", all, 3))
        assertEquals(emptyList<String>(), HostCalendarSelection.rangeDays("nope", "2026-12-10", all, cap))
        assertEquals(emptyList<String>(), HostCalendarSelection.rangeDays("2026-02-30", "2026-03-01", all, cap))
    }

    // ---- selectionRuns / runPosition --------------------------------------------

    @Test
    fun `groups consecutive days, across a month boundary`() {
        assertEquals(
            listOf(
                SelectionRun("2026-12-05", "2026-12-05", 1),
                SelectionRun("2026-12-30", "2027-01-01", 3)
            ),
            HostCalendarSelection.selectionRuns(listOf("2026-12-31", "2027-01-01", "2026-12-05", "2026-12-30"))
        )
        assertEquals(emptyList<SelectionRun>(), HostCalendarSelection.selectionRuns(emptyList()))
    }

    @Test
    fun `labels each day by where it sits in its run`() {
        val s = setOf("2026-12-01", "2026-12-02", "2026-12-03", "2026-12-09")
        assertEquals(RunPosition.START, HostCalendarSelection.runPosition(s, "2026-12-01"))
        assertEquals(RunPosition.MIDDLE, HostCalendarSelection.runPosition(s, "2026-12-02"))
        assertEquals(RunPosition.END, HostCalendarSelection.runPosition(s, "2026-12-03"))
        assertEquals(RunPosition.SINGLE, HostCalendarSelection.runPosition(s, "2026-12-09"))
        assertNull(HostCalendarSelection.runPosition(s, "2026-12-04"))
    }

    // ---- priceSpan --------------------------------------------------------------

    @Test
    fun `priceSpan is min and max over the selection, ignoring unloaded days`() {
        val days = mapOf("a" to 4200.0, "b" to 3500.0, "c" to null)
        assertEquals(PriceSpan(3500.0, 4200.0), HostCalendarSelection.priceSpan(listOf("a", "b", "c")) { days[it] })
        assertNull(HostCalendarSelection.priceSpan(listOf("c")) { days[it] })
    }

    // ---- clampMonthOffset ---------------------------------------------------------

    @Test
    fun `clampMonthOffset keeps the last page inside the horizon`() {
        assertEquals(0, HostCalendarSelection.clampMonthOffset(-3, 1, 24))
        assertEquals(23, HostCalendarSelection.clampMonthOffset(30, 1, 24))
        assertEquals(22, HostCalendarSelection.clampMonthOffset(30, 2, 24))
        assertEquals(5, HostCalendarSelection.clampMonthOffset(5, 2, 24))
        assertEquals(23, HostCalendarSelection.clampMonthOffset(Int.MAX_VALUE, 1))
        // A nonsense "zero months visible" still behaves like one-up.
        assertEquals(23, HostCalendarSelection.clampMonthOffset(99, 0, 24))
    }

    // ---- swipeDirection -----------------------------------------------------------

    @Test
    fun `a leftward swipe goes forward, rightward goes back`() {
        assertEquals(SwipeDirection.NEXT, HostCalendarSelection.swipeDirection(-80f, 10f))
        assertEquals(SwipeDirection.PREV, HostCalendarSelection.swipeDirection(80f, 10f))
    }

    @Test
    fun `swipes mirror in right-to-left layouts`() {
        assertEquals(SwipeDirection.PREV, HostCalendarSelection.swipeDirection(-80f, 10f, rtl = true))
        assertEquals(SwipeDirection.NEXT, HostCalendarSelection.swipeDirection(80f, 10f, rtl = true))
    }

    @Test
    fun `short or mostly-vertical gestures are not swipes`() {
        assertNull(HostCalendarSelection.swipeDirection(-30f, 0f))
        assertNull(HostCalendarSelection.swipeDirection(-80f, 70f))
    }

    // ---- month toggle + compact price ------------------------------------------------

    @Test
    fun `select month is a toggle`() {
        val month = listOf("2026-12-01", "2026-12-02")
        val on = HostCalendarSelection.toggleMonth(setOf("2026-11-30"), month)
        assertEquals(listOf("2026-11-30", "2026-12-01", "2026-12-02"), on.sorted())
        assertTrue(HostCalendarSelection.isMonthFullySelected(on, month))
        val off = HostCalendarSelection.toggleMonth(on, month)
        assertEquals(listOf("2026-11-30"), off.sorted())
        assertFalse(HostCalendarSelection.isMonthFullySelected(off, emptyList()))
    }

    @Test
    fun `six-digit prices abbreviate to k`() {
        assertEquals("1,500", HostCalendarSelection.compactPrice(1500.0))
        assertEquals("99,999", HostCalendarSelection.compactPrice(99_999.0))
        assertEquals("125k", HostCalendarSelection.compactPrice(125_000.0))
        assertEquals("1,250k", HostCalendarSelection.compactPrice(1_250_000.0))
    }
}
