package com.quickin.app.ui

import java.util.Locale
import org.junit.Assert.assertEquals
import org.junit.Test

/** The map-pin warning names the country in the app language; the stored value stays English. */
class LocalizedCountryNameTest {

    @Test
    fun egyptReadsInArabic() {
        assertEquals("مصر", localizedCountryName("Egypt", Locale("ar")))
    }

    @Test
    fun englishStaysEnglish() {
        assertEquals("Saudi Arabia", localizedCountryName("Saudi Arabia", Locale.ENGLISH))
    }

    @Test
    fun matchIgnoresCase() {
        assertEquals("Égypte", localizedCountryName("egypt", Locale.FRENCH))
    }

    @Test
    fun unknownNameIsReturnedUnchanged() {
        assertEquals("Atlantis", localizedCountryName("Atlantis", Locale("ar")))
    }
}
