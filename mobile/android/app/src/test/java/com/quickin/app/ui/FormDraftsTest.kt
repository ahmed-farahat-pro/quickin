package com.quickin.app.ui

import com.quickin.app.CancellationPolicy
import com.quickin.app.WeekendSchedule
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The add-listing / add-service drafts are what makes a half-filled host form survive leaving the
 * screen — the tab bodies are a bare `when (tab)`, so the wizard is REMOVED from composition on a
 * tab switch and anything held in a `remember` goes with it.
 *
 * These cover the two halves that can silently break the promise: the defaults a blank form opens
 * with (a wrong default reads as "my typing is still here" or wipes a legitimate value), and
 * [ListingDraft.clear] putting every single field back — a field left out of `clear` would carry
 * a published listing's value into the next one.
 */
class FormDraftsTest {

    @Test
    fun `a fresh listing draft is pristine and carries the form's defaults`() {
        val draft = ListingDraft()

        assertTrue(draft.isPristine)
        assertEquals(0, draft.step.intValue)
        assertEquals("Egypt", draft.country.value)
        assertEquals("2", draft.maxGuests.value)
        assertEquals("1", draft.bedrooms.value)
        assertEquals("1", draft.beds.value)
        assertEquals("1", draft.bathrooms.value)
        assertEquals("0", draft.weeklyDiscount.value)
        assertEquals("0", draft.monthlyDiscount.value)
        assertEquals(PROPERTY_TYPES.first(), draft.propertyType.value)
        assertEquals(CancellationPolicy.Moderate.apiValue, draft.cancellationPolicy.value)
        // A host who never opens the weekend picker still gets the weekend the screen promised.
        assertEquals(WeekendSchedule.defaultDays, draft.weekendDays.toList())
    }

    @Test
    fun `typed listing fields survive as long as nobody clears them`() {
        val draft = ListingDraft()

        draft.step.intValue = 2
        draft.title.value = "Sea-view chalet"
        draft.description.value = "A quiet chalet a minute from the water."
        draft.location.value = "Ras Sudr"
        draft.price.value = "1800"
        draft.region.value = "north-coast"
        draft.photos.add("data:image/jpeg;base64,AAAA")
        draft.selectedAmenities.add("Wi-Fi")
        draft.monthlyPrices["7"] = "2400"
        draft.weekendDays.add(4)
        draft.ownershipDoc.value = "data:image/jpeg;base64,BBBB"

        assertFalse(draft.isPristine)
        assertEquals("Sea-view chalet", draft.title.value)
        assertEquals(2, draft.step.intValue)
        assertEquals(listOf("data:image/jpeg;base64,AAAA"), draft.photos.toList())
        assertEquals("2400", draft.monthlyPrices["7"])
    }

    @Test
    fun `clearing a listing draft restores every default`() {
        val draft = ListingDraft()

        draft.step.intValue = 3
        draft.title.value = "Sea-view chalet"
        draft.description.value = "A quiet chalet a minute from the water."
        draft.location.value = "Ras Sudr"
        draft.country.value = "Greece"
        draft.price.value = "1800"
        draft.weeklyDiscount.value = "10"
        draft.monthlyDiscount.value = "20"
        draft.weekendPrice.value = "2200"
        draft.weekendDays.add(4)
        draft.monthlyPrices["7"] = "2400"
        draft.maxGuests.value = "8"
        draft.bedrooms.value = "3"
        draft.beds.value = "4"
        draft.bathrooms.value = "2"
        draft.propertyType.value = PROPERTY_TYPES.last()
        draft.photos.add("data:image/jpeg;base64,AAAA")
        draft.selectedAmenities.add("Wi-Fi")
        draft.cancellationPolicy.value = CancellationPolicy.Strict.apiValue
        draft.ownershipDoc.value = "data:image/jpeg;base64,BBBB"
        draft.region.value = "north-coast"

        draft.clear()

        // isPristine checks every field this class holds, so a field `clear` forgot fails here.
        assertTrue(draft.isPristine)
        assertEquals(WeekendSchedule.defaultDays, draft.weekendDays.toList())
        assertTrue(draft.photos.isEmpty())
        assertTrue(draft.selectedAmenities.isEmpty())
        assertTrue(draft.monthlyPrices.isEmpty())
    }

    @Test
    fun `a service draft holds its fields and clears them all`() {
        val draft = ServiceDraft()
        assertTrue(draft.isPristine)

        draft.title.value = "Sunset yacht cruise"
        draft.category.value = "Water sports"
        draft.description.value = "Two hours out of the marina."
        draft.location.value = "Hurghada"
        draft.price.value = "120"
        draft.imageUrl.value = "https://example.com/boat.jpg"
        assertFalse(draft.isPristine)

        draft.clear()
        assertTrue(draft.isPristine)
        assertEquals("", draft.title.value)
    }

    @Test
    fun `a verification draft keeps the typed id number and clears on submission`() {
        val draft = VerificationDraft()
        assertTrue(draft.isPristine)

        draft.idNumber.value = "29001011234567"
        assertFalse(draft.isPristine)

        draft.clear()
        assertTrue(draft.isPristine)
        assertEquals("", draft.idNumber.value)
    }
}
