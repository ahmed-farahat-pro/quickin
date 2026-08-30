package com.quickin.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Kotlin mirror of the backend's `test/unit/listing-pricing-core.test.mjs` (and of the web
 * repo's copy of the same suite). Those two guard `listing-pricing-core.ts`; this one guards
 * [WeekendSchedule], the hand-written Kotlin translation — so a change to the weekend rules
 * belongs in all of them, and this suite is what notices when it isn't.
 *
 * The reported defect: weekend pricing was fixed to Friday and Saturday on both apps, with no way
 * for a host to say otherwise. The column existed and the backend never wrote it.
 *
 * Plain JVM, no emulator: `./gradlew testDebugUnitTest`.
 */
class WeekendScheduleTest {

    @Test
    fun `the default weekend is Friday and Saturday`() {
        // Matches DEFAULT_WEEKEND_DAYS on the server (0=Sun … 6=Sat). If these ever disagree, a
        // host who never chose is quoted one weekend and shown another.
        assertEquals(listOf(5, 6), WeekendSchedule.defaultDays)
    }

    @Test
    fun `a host who never chose is priced on the default weekend`() {
        // NULL and an empty array both mean "never chose" — the ladder's own COALESCE/NULLIF.
        assertEquals(listOf(5, 6), WeekendSchedule.effective(null))
        assertEquals(listOf(5, 6), WeekendSchedule.effective(emptyList()))
    }

    @Test
    fun `a host who did choose keeps their own weekend`() {
        assertEquals(listOf(4, 5), WeekendSchedule.effective(listOf(5, 4)))
    }

    @Test
    fun `normalize drops repeats, junk days and disorder`() {
        // Repeats are what a whole-week set could otherwise hide behind: [5,5,6] is two days.
        assertEquals(listOf(5, 6), WeekendSchedule.normalize(listOf(6, 5, 6)))
        assertEquals(listOf(0, 2), WeekendSchedule.normalize(listOf(2, 10, 0)))
        assertEquals(listOf(6), WeekendSchedule.normalize(listOf(7, -1, 6)))
    }

    @Test
    fun `no rate means no days, and never an error`() {
        // Clearing the weekend price is how a host turns weekend pricing off. Judging the day set
        // first would refuse that save and strand them on a form they are in the middle of fixing.
        assertEquals(null, WeekendSchedule.resolve(null, listOf(0, 1, 2, 3, 4, 5, 6)).getOrThrow())
        assertEquals(null, WeekendSchedule.resolve(0.0, emptyList()).getOrThrow())
    }

    @Test
    fun `the whole week is refused`() {
        // Seven days is a nightly price wearing a weekend's name — it leaves pricePerNight
        // applying to no night at all.
        val err = WeekendSchedule.resolve(1500.0, listOf(0, 1, 2, 3, 4, 5, 6)).exceptionOrNull()
        assertTrue(err is WeekendDaysException)
        assertEquals(WeekendSchedule.Problem.WHOLE_WEEK, (err as WeekendDaysException).problem)
    }

    @Test
    fun `six of seven days is strange but honest, and gets through`() {
        // The line is drawn only where the nightly price stops existing.
        assertEquals(
            listOf(0, 1, 2, 3, 4, 5),
            WeekendSchedule.resolve(1500.0, listOf(0, 1, 2, 3, 4, 5)).getOrThrow()
        )
    }

    @Test
    fun `a rate with no day lit is refused`() {
        // Otherwise the rate stores fine and is never charged on a single night — the same silent
        // drop, arriving through the other half of the field.
        val err = WeekendSchedule.resolve(1500.0, emptyList()).exceptionOrNull()
        assertEquals(WeekendSchedule.Problem.NO_DAYS_CHOSEN, (err as WeekendDaysException).problem)
    }

    @Test
    fun `a real pair is cleaned and kept`() {
        assertEquals(listOf(1, 2), WeekendSchedule.resolve(1500.0, listOf(2, 1, 2)).getOrThrow())
    }

    @Test
    fun `resolve answers a list, not a null, whenever there is a rate`() {
        assertNull(WeekendSchedule.resolve(null, listOf(5)).getOrThrow())
        assertTrue(WeekendSchedule.resolve(10.0, listOf(5)).getOrThrow()!!.isNotEmpty())
    }
}
