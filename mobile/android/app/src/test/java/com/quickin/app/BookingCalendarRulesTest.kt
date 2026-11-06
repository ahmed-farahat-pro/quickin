package com.quickin.app

import com.quickin.app.BookingCalendarRules.Tone
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.YearMonth

/**
 * The Kotlin mirror of the web's `test/unit/booking-calendar-core.test.mjs` and of iOS's
 * `Tests/BookingCalendarRulesTests`: the nightly price painted under each day of the guest
 * reserve calendar — how it is written, which colour it takes, and which months are fetched.
 *
 * Plain JVM, no emulator: `./gradlew testDebugUnitTest`.
 */
class BookingCalendarRulesTest {

    @Test
    fun `tone compares against the base rate`() {
        assertEquals(Tone.BASE, BookingCalendarRules.tone(2500.0, 2500.0))
        assertEquals(Tone.HIGHER, BookingCalendarRules.tone(3500.0, 2500.0))
        assertEquals(Tone.LOWER, BookingCalendarRules.tone(2000.0, 2500.0))
    }

    @Test
    fun `a rounding step is still the base price`() {
        assertEquals(Tone.BASE, BookingCalendarRules.tone(2501.0, 2500.0))
        assertEquals(Tone.BASE, BookingCalendarRules.tone(2499.0, 2500.0))
    }

    @Test
    fun `a missing base never paints a day as a deal`() {
        assertEquals(Tone.BASE, BookingCalendarRules.tone(2500.0, 0.0))
        assertEquals(Tone.BASE, BookingCalendarRules.tone(Double.NaN, 2500.0))
    }

    @Test
    fun `prices are whole and grouped`() {
        assertEquals("2,500", BookingCalendarRules.formatPrice(2500.0))
        assertEquals("12,500", BookingCalendarRules.formatPrice(12500.0))
        assertEquals("52", BookingCalendarRules.formatPrice(52.4))
        assertEquals("", BookingCalendarRules.formatPrice(Double.NaN))
    }

    @Test
    fun `month windows cover the whole month`() {
        assertEquals("2026-11-01" to "2026-11-30", BookingCalendarRules.monthWindow(YearMonth.of(2026, 11)))
        assertEquals("2028-02-01" to "2028-02-29", BookingCalendarRules.monthWindow(YearMonth.of(2028, 2)))
    }

    @Test
    fun `the visible month and the next one are loaded`() {
        assertEquals(
            listOf(YearMonth.of(2026, 12), YearMonth.of(2027, 1)),
            BookingCalendarRules.monthsToLoad(YearMonth.of(2026, 12))
        )
    }
}
