package com.quickin.app

import java.text.NumberFormat
import java.time.YearMonth
import java.util.Locale
import kotlin.math.roundToLong

/**
 * The guest booking calendar's nightly prices — the pure rules behind them.
 *
 * The reserve [com.quickin.app.ui.DateRangePickerSheet] paints each day's price from the public
 * `GET /api/local/listings/:id/calendar`, one month per request. The server owns every price
 * (commission included); this only decides what a cell looks like and which months to ask for.
 * Kotlin mirror of the web's `booking-calendar-core.ts` and iOS's `BookingCalendarRules.swift`,
 * tested by `BookingCalendarRulesTest`.
 */
object BookingCalendarRules {
    /** How a night's price compares to the listing's standard nightly rate. */
    enum class Tone { LOWER, BASE, HIGHER }

    /**
     * Compare a night to the base rate, not to its neighbours: a weekend in a cheap month is still
     * "cheaper than usual". Within 1 EGP counts as base, so a server rounding step never paints a
     * plain night as a deal.
     */
    fun tone(price: Double, base: Double): Tone {
        if (!price.isFinite() || !base.isFinite() || base <= 0) return Tone.BASE
        if (price < base - 1) return Tone.LOWER
        if (price > base + 1) return Tone.HIGHER
        return Tone.BASE
    }

    /** `2500` → `"2,500"`. Whole units only — the cell has no room for piasters. */
    fun formatPrice(amount: Double): String {
        if (!amount.isFinite()) return ""
        return NumberFormat.getIntegerInstance(Locale.US).format(amount.roundToLong())
    }

    /** First and last day of a month, inclusive, as yyyy-MM-dd — what the endpoint takes. */
    fun monthWindow(month: YearMonth): Pair<String, String> =
        month.atDay(1).toString() to month.atEndOfMonth().toString()

    /** The month on screen plus the next one, so paging forward lands on prices already there. */
    fun monthsToLoad(month: YearMonth): List<YearMonth> = listOf(month, month.plusMonths(1))
}
