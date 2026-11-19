package com.quickin.app

import java.text.NumberFormat
import java.time.LocalDate
import java.time.format.DateTimeParseException
import java.time.temporal.ChronoUnit
import java.util.Locale

/**
 * The host pricing calendar's selection and paging rules — the Kotlin mirror of the web's
 * `src/lib/local/calendar-selection-core.ts` (tests: `test/unit/calendar-selection-core.test.mjs`,
 * mirrored by `HostCalendarSelectionTest`). Pure: no Android, no Compose, so the JVM tests can
 * hold it to the same rules the web and iOS follow.
 *
 * Selection is "tap start, tap end":
 *
 *   • tap an unselected day   → it is selected and becomes the pending ANCHOR;
 *   • tap another day         → every editable day between the anchor and it is added, and the
 *                               anchor is cleared;
 *   • tap the anchor again    → it stays selected on its own (a single day), so a host can still
 *                               pick days that aren't consecutive;
 *   • tap a selected day while nothing is pending → it is removed.
 *
 * Selections ACCUMULATE: finishing one range and tapping a fresh day starts the next range beside
 * it. Booked and past days inside a range are skipped, never refused — a host pricing "all of
 * December" routinely crosses a booking.
 *
 * Dates are `yyyy-MM-dd` strings throughout, compared lexically like the web, and interpreted as
 * calendar days (ISO chronology, no timezone) — a night belongs to a day, not an instant.
 */
object HostCalendarSelection {

    /** Most days one save may touch. Mirrors `MAX_DATES_PER_REQUEST` in date-pricing-core. */
    const val MAX_DATES_PER_REQUEST = 800

    /** How far ahead the calendar reaches, in months. Mirrors `MAX_MONTHS_AHEAD`. */
    const val MAX_MONTHS_AHEAD = 24

    data class TapResult(
        val selected: Set<String>,
        /** The first day of a range still waiting for its end, or null. */
        val anchor: String?,
        /**
         * The range the tap would have made is longer than one save accepts. The selection is
         * left unchanged and the anchor stays pending.
         */
        val tooLong: Boolean = false
    )

    data class SelectionRun(val start: String, val end: String, val days: Int)

    /** Where a selected day sits in its run, for drawing a range as one connected band. */
    enum class RunPosition { SINGLE, START, MIDDLE, END }

    data class PriceSpan(val min: Double, val max: Double)

    enum class SwipeDirection { NEXT, PREV }

    fun parse(date: String): LocalDate? {
        if (date.length != 10) return null
        return try {
            LocalDate.parse(date)
        } catch (e: DateTimeParseException) {
            null
        }
    }

    fun isIsoDate(date: String): Boolean = parse(date) != null

    fun addDays(date: String, n: Long): String? = parse(date)?.plusDays(n)?.toString()

    /**
     * Every editable day from [a] to [b] inclusive, in either order. Empty when the span exceeds
     * [maxDays] or either end isn't a date — the caller decides what to say about that.
     */
    fun rangeDays(a: String, b: String, isEditable: (String) -> Boolean, maxDays: Int): List<String> {
        val da = parse(a) ?: return emptyList()
        val db = parse(b) ?: return emptyList()
        val (from, to) = if (da <= db) da to db else db to da
        val n = ChronoUnit.DAYS.between(from, to)
        if (n + 1 > maxDays) return emptyList()
        val out = ArrayList<String>((n + 1).toInt())
        for (i in 0..n) {
            val d = from.plusDays(i).toString()
            if (isEditable(d)) out += d
        }
        return out
    }

    /** Apply one tap to the selection. See the header for the rules. Never mutates [selected]. */
    fun tapDay(
        selected: Set<String>,
        anchor: String?,
        date: String,
        isEditable: (String) -> Boolean,
        maxDays: Int = MAX_DATES_PER_REQUEST
    ): TapResult {
        val next = LinkedHashSet(selected)
        if (!isEditable(date)) return TapResult(next, anchor)

        // An anchor that is no longer selected (cleared by "Select month", say) is not pending.
        val pending = anchor?.takeIf { it in next }

        if (pending == null) {
            if (date in next) {
                next -= date
                return TapResult(next, null)
            }
            next += date
            return TapResult(next, date)
        }

        if (date == pending) return TapResult(next, null)

        val from = minOf(pending, date)
        val to = maxOf(pending, date)
        val a = parse(from)
        val b = parse(to)
        if (a == null || b == null) return TapResult(next, pending)
        if (ChronoUnit.DAYS.between(a, b) + 1 > maxDays) return TapResult(next, pending, tooLong = true)
        next += rangeDays(from, to, isEditable, maxDays)
        return TapResult(next, null)
    }

    /** Consecutive selected days grouped into runs, earliest first — "Dec 20 – Dec 27". */
    fun selectionRuns(dates: Iterable<String>): List<SelectionRun> {
        val sorted = dates.toSet().filter(::isIsoDate).sorted()
        val runs = ArrayList<SelectionRun>()
        for (d in sorted) {
            val last = runs.lastOrNull()
            if (last != null && addDays(last.end, 1) == d) {
                runs[runs.size - 1] = last.copy(end = d, days = last.days + 1)
            } else {
                runs += SelectionRun(d, d, 1)
            }
        }
        return runs
    }

    /**
     * Where [date] sits in its run, or null when it isn't selected. Week rows break the band
     * visually, so the caller rounds row edges itself.
     */
    fun runPosition(selected: Set<String>, date: String): RunPosition? {
        if (date !in selected || !isIsoDate(date)) return null
        val prev = addDays(date, -1) in selected
        val next = addDays(date, 1) in selected
        return when {
            prev && next -> RunPosition.MIDDLE
            prev -> RunPosition.END
            next -> RunPosition.START
            else -> RunPosition.SINGLE
        }
    }

    /**
     * Lowest and highest current nightly price across the selection, so the panel can say
     * "Currently 3,500 – 4,200" before the host types anything. Days not loaded yet are ignored.
     */
    fun priceSpan(dates: Iterable<String>, priceOf: (String) -> Double?): PriceSpan? {
        var min = Double.POSITIVE_INFINITY
        var max = Double.NEGATIVE_INFINITY
        for (d in dates) {
            val p = priceOf(d) ?: continue
            if (!p.isFinite()) continue
            if (p < min) min = p
            if (p > max) max = p
        }
        return if (min == Double.POSITIVE_INFINITY) null else PriceSpan(min, max)
    }

    /**
     * The first month the calendar may show, as an offset from the current month. With [visible]
     * months side by side, the last page must still end inside the horizon — so two-up stops one
     * page earlier than one-up.
     */
    fun clampMonthOffset(offset: Int, visible: Int, horizon: Int = MAX_MONTHS_AHEAD): Int {
        val max = maxOf(0, horizon - maxOf(1, visible))
        return offset.coerceIn(0, max)
    }

    /**
     * A finished horizontal gesture → which way to page, or null for "not a swipe". Horizontal
     * travel must pass [threshold] AND dominate vertical travel, so a slightly diagonal scroll
     * never flips the month. In a right-to-left layout the calendar reads the other way.
     */
    fun swipeDirection(dx: Float, dy: Float, rtl: Boolean = false, threshold: Float = 48f): SwipeDirection? {
        if (kotlin.math.abs(dx) < threshold || kotlin.math.abs(dx) < kotlin.math.abs(dy) * 1.5f) return null
        val leftward = dx < 0
        return if (leftward != rtl) SwipeDirection.NEXT else SwipeDirection.PREV
    }

    /**
     * "Select month" is a toggle: a month whose editable days are all selected is cleared,
     * anything else gains them all. A month with nothing editable is left alone.
     */
    fun toggleMonth(selected: Set<String>, editableDays: List<String>): Set<String> {
        if (editableDays.isEmpty()) return selected
        return if (editableDays.all { it in selected }) selected - editableDays.toSet() else selected + editableDays
    }

    /** Whether the month's toggle should read "Unselect month". */
    fun isMonthFullySelected(selected: Set<String>, editableDays: List<String>): Boolean =
        editableDays.isNotEmpty() && editableDays.all { it in selected }

    /**
     * A nightly price as it fits a phone-width day cell: grouped en-US digits, and six-digit rates
     * abbreviated — 125,000 → "125k".
     */
    fun compactPrice(amount: Double): String {
        val f = NumberFormat.getNumberInstance(Locale.US)
        f.maximumFractionDigits = 0
        return if (amount >= 100_000) "${f.format(Math.round(amount / 1000.0))}k" else f.format(amount)
    }
}
