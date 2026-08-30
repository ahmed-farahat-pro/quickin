package com.quickin.app.ui

import android.net.Uri
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.ViewModel
import com.google.android.gms.maps.model.LatLng
import com.quickin.app.CancellationPolicy
import com.quickin.app.ResortChoice
import com.quickin.app.WeekendSchedule

/**
 * The app's in-progress form drafts, held OUTSIDE the composables that edit them.
 *
 * Both wizards used to keep every field in a plain `remember { mutableStateOf(...) }`, which ties
 * the typed text to the composable's lifetime. Neither host screen is a navigation graph: the tab
 * bodies are a bare `when (tab) { ... }` and the app's bottom bar swaps whole screens through
 * `AnimatedContent`, so leaving the tab REMOVES the wizard from composition and every `remember`
 * in it is discarded. A host who tapped "Requests" to check a booking came back to an empty form
 * with four steps of typing gone — the reported bug.
 *
 * A [ViewModel] is the thing whose lifetime matches what a host expects a draft to have: it is
 * scoped to the activity, so it outlives any composable, any tab switch, and a rotation, and it is
 * cleared when the activity is really finished. The wizards read and write these fields directly —
 * they are Compose state objects, so a write still recomposes exactly what it used to.
 *
 * A draft is deliberately NOT dropped when the host backs out of the wizard: backing out is how
 * you go and look something up. It is cleared once the listing/service is actually created, so
 * "Add another" opens an empty form rather than the one just published.
 */
class FormDraftsViewModel : ViewModel() {
    /** The "Add a listing" wizard's draft (both entry points share this one instance). */
    val listing = ListingDraft()

    /** The "Add service" form's draft. */
    val service = ServiceDraft()

    /** The Profile tab's ID-verification card (three photo picks + the ID number). */
    val verification = VerificationDraft()

    /**
     * Drop every draft. Called on sign-out: a draft outlives a screen ON PURPOSE, but it must not
     * outlive the ACCOUNT that typed it — the next person to sign in on this device would open the
     * wizard on someone else's half-written listing, or find their ID photos staged for upload.
     */
    fun clearAll() {
        listing.clear()
        service.clear()
        verification.clear()
    }
}

/**
 * Every field of the four-step add-a-listing wizard, plus which step is open.
 *
 * Transient, non-typed state (the "encoding photos…" spinner, the doc-processing flag) stays in
 * the composable: it describes work in flight, not something the host would be sad to lose.
 */
class ListingDraft {
    /** Which wizard step is open, 0..3. Kept so returning lands where the host left off. */
    val step = mutableIntStateOf(0)

    val title: MutableState<String> = mutableStateOf("")
    val description: MutableState<String> = mutableStateOf("")
    val location: MutableState<String> = mutableStateOf("")
    val country: MutableState<String> = mutableStateOf(DEFAULT_COUNTRY)
    val price: MutableState<String> = mutableStateOf("")

    /** Length-of-stay discounts (% off); "0" means none. */
    val weeklyDiscount: MutableState<String> = mutableStateOf("0")
    val monthlyDiscount: MutableState<String> = mutableStateOf("0")

    /** Weekend nightly rate (blank = none) and the days it is charged on (0=Sun … 6=Sat). */
    val weekendPrice: MutableState<String> = mutableStateOf("")
    val weekendDays = mutableStateListOf<Int>().apply { addAll(WeekendSchedule.defaultDays) }

    /** Per-month nightly overrides keyed by month "1".."12"; blank months are dropped on create. */
    val monthlyPrices = mutableStateMapOf<String, String>()

    val maxGuests: MutableState<String> = mutableStateOf(DEFAULT_MAX_GUESTS)
    val bedrooms: MutableState<String> = mutableStateOf(DEFAULT_COUNT)
    val beds: MutableState<String> = mutableStateOf(DEFAULT_COUNT)
    val bathrooms: MutableState<String> = mutableStateOf(DEFAULT_COUNT)
    val propertyType: MutableState<String> = mutableStateOf(PROPERTY_TYPES.first())

    /** Photos as `data:image/jpeg` URLs in pick order; the first is the cover. */
    val photos = mutableStateListOf<String>()

    /** Chosen amenity labels, in tap order. */
    val selectedAmenities = mutableStateListOf<String>()

    val cancellationPolicy: MutableState<String> =
        mutableStateOf(CancellationPolicy.Moderate.apiValue)

    /** Ownership/proof document as an image or `application/pdf` data URL, or null until one is
     *  picked — [com.quickin.app.OwnershipDocLoader] decides which and enforces the size cap.
     *  (Written without the mime wildcard on purpose — Kotlin block comments nest, so a literal
     *  slash-star inside a KDoc opens a comment that never closes.) */
    val ownershipDoc: MutableState<String?> = mutableStateOf(null)

    /** Curated browse area, null until the host picks one (required on step 2). */
    val region: MutableState<String?> = mutableStateOf(null)

    /** The resort / compound (step 2): a catalog id, a name the host typed, or neither. Optional —
     *  [ResortChoice.Selection.NONE] ("not in a compound") is a complete answer. */
    val resort: MutableState<ResortChoice.Selection> = mutableStateOf(ResortChoice.Selection.NONE)

    /** Map pin, null until the host places one (required on step 2). */
    val pickedLatLng: MutableState<LatLng?> = mutableStateOf(null)

    /** True while the host has typed nothing worth keeping — every field still at its default. */
    val isPristine: Boolean
        get() = step.intValue == 0 &&
            title.value.isEmpty() &&
            description.value.isEmpty() &&
            location.value.isEmpty() &&
            country.value == DEFAULT_COUNTRY &&
            price.value.isEmpty() &&
            weeklyDiscount.value == "0" &&
            monthlyDiscount.value == "0" &&
            weekendPrice.value.isEmpty() &&
            weekendDays.toList() == WeekendSchedule.defaultDays &&
            monthlyPrices.isEmpty() &&
            maxGuests.value == DEFAULT_MAX_GUESTS &&
            bedrooms.value == DEFAULT_COUNT &&
            beds.value == DEFAULT_COUNT &&
            bathrooms.value == DEFAULT_COUNT &&
            propertyType.value == PROPERTY_TYPES.first() &&
            photos.isEmpty() &&
            selectedAmenities.isEmpty() &&
            cancellationPolicy.value == CancellationPolicy.Moderate.apiValue &&
            ownershipDoc.value == null &&
            region.value == null &&
            resort.value == ResortChoice.Selection.NONE &&
            pickedLatLng.value == null

    /** Back to a blank wizard. Called once a listing has actually been created. */
    fun clear() {
        step.intValue = 0
        title.value = ""
        description.value = ""
        location.value = ""
        country.value = DEFAULT_COUNTRY
        price.value = ""
        weeklyDiscount.value = "0"
        monthlyDiscount.value = "0"
        weekendPrice.value = ""
        weekendDays.clear()
        weekendDays.addAll(WeekendSchedule.defaultDays)
        monthlyPrices.clear()
        maxGuests.value = DEFAULT_MAX_GUESTS
        bedrooms.value = DEFAULT_COUNT
        beds.value = DEFAULT_COUNT
        bathrooms.value = DEFAULT_COUNT
        propertyType.value = PROPERTY_TYPES.first()
        photos.clear()
        selectedAmenities.clear()
        cancellationPolicy.value = CancellationPolicy.Moderate.apiValue
        ownershipDoc.value = null
        region.value = null
        resort.value = ResortChoice.Selection.NONE
        pickedLatLng.value = null
    }

    private companion object {
        const val DEFAULT_COUNTRY = "Egypt"
        const val DEFAULT_MAX_GUESTS = "2"
        const val DEFAULT_COUNT = "1"
    }
}

/** Every field of the host's one-page "Add service" form. */
class ServiceDraft {
    val title: MutableState<String> = mutableStateOf("")
    val category: MutableState<String> = mutableStateOf("")
    val description: MutableState<String> = mutableStateOf("")
    val location: MutableState<String> = mutableStateOf("")
    val price: MutableState<String> = mutableStateOf("")
    val imageUrl: MutableState<String> = mutableStateOf("")

    /** True while the host has typed nothing worth keeping. */
    val isPristine: Boolean
        get() = title.value.isEmpty() &&
            category.value.isEmpty() &&
            description.value.isEmpty() &&
            location.value.isEmpty() &&
            price.value.isEmpty() &&
            imageUrl.value.isEmpty()

    /** Back to a blank form. Called once a service has actually been created. */
    fun clear() {
        title.value = ""
        category.value = ""
        description.value = ""
        location.value = ""
        price.value = ""
        imageUrl.value = ""
    }
}

/**
 * The Profile tab's identity-verification card: the three staged photo picks and the typed ID
 * number.
 *
 * This one is the reported bug at its plainest — the card is rendered INSIDE the Profile tab, and
 * the bottom bar swaps tab bodies through `AnimatedContent`, so a glance at Trips used to throw
 * away three photo picks. The submitted photos are cleared by the card itself once the account
 * leaves a submittable status.
 */
class VerificationDraft {
    val frontUri: MutableState<Uri?> = mutableStateOf(null)
    val backUri: MutableState<Uri?> = mutableStateOf(null)
    val selfieUri: MutableState<Uri?> = mutableStateOf(null)
    val idNumber: MutableState<String> = mutableStateOf("")

    /** True while nothing has been staged. */
    val isPristine: Boolean
        get() = frontUri.value == null &&
            backUri.value == null &&
            selfieUri.value == null &&
            idNumber.value.isEmpty()

    /** Drop the staged documents. Called once a submission has been accepted. */
    fun clear() {
        frontUri.value = null
        backUri.value = null
        selfieUri.value = null
        idNumber.value = ""
    }
}
