package com.quickin.app

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** State for the host's "Reservation requests" list (`GET /api/local/host/bookings`). */
data class HostBookingsUiState(
    val isLoading: Boolean = false,
    val bookings: List<HostBooking> = emptyList(),
    val error: String? = null,
    val loaded: Boolean = false,
    /** Id of the booking currently being confirmed/rejected (drives a per-row spinner). */
    val actingOn: String? = null,
    /** Set after a successful confirm/reject, e.g. "Reservation confirmed". */
    val actionMessage: String? = null
)

/** State for the "Add listing" form (`POST /api/local/listings`). */
data class CreateListingUiState(
    val isSubmitting: Boolean = false,
    val error: String? = null,
    /** Set on a 201; carries the created listing so the form can show success. */
    val created: Listing? = null
)

/** State for the host's own listings (`GET /api/local/host/listings`). */
data class HostListingsUiState(
    val isLoading: Boolean = false,
    val listings: List<Listing> = emptyList(),
    val error: String? = null,
    val loaded: Boolean = false
)

/**
 * State for the host editing a listing's cancellation policy
 * (`PATCH /api/local/listings/:id {cancellation_policy}`), from the listing detail's manager.
 * [listingId] tags which listing is being edited; [savedPolicy] holds the value after a
 * successful PATCH so the detail row updates immediately.
 */
data class CancellationPolicyUiState(
    val listingId: String? = null,
    val isSaving: Boolean = false,
    val error: String? = null,
    /** The policy value last saved successfully (drives the row + selection), or null. */
    val savedPolicy: String? = null
)

/**
 * State for the host editing a listing's length-of-stay discounts
 * (`PATCH /api/local/listings/:id {weekly_discount, monthly_discount}`), from the inline editor on
 * a host listing card. [listingId] tags which listing is being saved (drives a per-card spinner);
 * [savedId] is set after a successful PATCH so the card can show a confirmation.
 */
data class StayDiscountUiState(
    val listingId: String? = null,
    val isSaving: Boolean = false,
    val error: String? = null,
    /** Id of the listing whose discounts were just saved successfully, or null. */
    val savedId: String? = null
)

/**
 * State for the host (re)submitting a listing's ownership/proof document
 * (`PATCH /api/local/listings/:id {ownership_doc}`), from a pending/rejected listing card.
 * [listingId] tags which listing is uploading (drives a per-card spinner); [submittedId] is set
 * after a successful re-queue so the card can show a confirmation.
 */
data class OwnershipDocUiState(
    val listingId: String? = null,
    val isSubmitting: Boolean = false,
    val error: String? = null,
    /** Id of the listing whose doc was just (re)submitted successfully, or null. */
    val submittedId: String? = null
)

/**
 * State for the AI listing-description writer in the Add-listing flow (Section 10,
 * `POST /api/local/ai/listing-description`). [isWriting] drives the button's loading state;
 * [generated] carries the freshly-written description for the wizard to drop into the editable
 * field (then consumed via [HostViewModel.consumeGeneratedDescription]); [error] surfaces a note.
 */
data class AiWriterUiState(
    val isWriting: Boolean = false,
    /** The AI-written description, pending insertion into the form; null once consumed. */
    val generated: String? = null,
    val error: String? = null
)

/** State for the host analytics dashboard (Section 10, `GET /api/local/host/analytics`). */
data class HostAnalyticsUiState(
    val isLoading: Boolean = false,
    val analytics: HostAnalytics? = null,
    val error: String? = null,
    val loaded: Boolean = false
)

/**
 * Drives the host-only area reached from the Profile tab (role == "host"):
 *  • the "Add listing" form, and
 *  • the "Reservation requests" list with Confirm / Reject on pending requests.
 *
 * Reads the bearer token directly from SharedPreferences ("qk_auth" / "token") — the
 * same store [AuthViewModel] / [BookingsViewModel] use — so it works without plumbing
 * the token through composables.
 */
class HostViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences(
        AuthViewModel.PREFS_NAME, Context.MODE_PRIVATE
    )

    private val _bookings = MutableStateFlow(HostBookingsUiState())
    val bookings: StateFlow<HostBookingsUiState> = _bookings.asStateFlow()

    private val _create = MutableStateFlow(CreateListingUiState())
    val create: StateFlow<CreateListingUiState> = _create.asStateFlow()

    private val _listings = MutableStateFlow(HostListingsUiState())
    val listings: StateFlow<HostListingsUiState> = _listings.asStateFlow()

    private val _policy = MutableStateFlow(CancellationPolicyUiState())
    val policy: StateFlow<CancellationPolicyUiState> = _policy.asStateFlow()

    private val _ownershipDoc = MutableStateFlow(OwnershipDocUiState())
    val ownershipDoc: StateFlow<OwnershipDocUiState> = _ownershipDoc.asStateFlow()

    private val _stayDiscount = MutableStateFlow(StayDiscountUiState())
    val stayDiscount: StateFlow<StayDiscountUiState> = _stayDiscount.asStateFlow()

    private val _aiWriter = MutableStateFlow(AiWriterUiState())
    val aiWriter: StateFlow<AiWriterUiState> = _aiWriter.asStateFlow()

    private val _analytics = MutableStateFlow(HostAnalyticsUiState())
    val analytics: StateFlow<HostAnalyticsUiState> = _analytics.asStateFlow()

    private fun token(): String? = prefs.getString(AuthViewModel.KEY_TOKEN, null)

    // ---- Own listings ---------------------------------------------------------

    /** Loads the signed-in host's own listings (`GET /api/local/host/listings`). */
    fun loadHostListings() {
        val token = token() ?: run {
            _listings.value = HostListingsUiState(loaded = true, error = "Please sign in.")
            return
        }
        _listings.value = _listings.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            try {
                val list = BookingService.fetchHostListings(token)
                _listings.value = HostListingsUiState(listings = list, loaded = true)
            } catch (e: Exception) {
                _listings.value = HostListingsUiState(
                    loaded = true,
                    error = e.message ?: "Could not load your listings."
                )
            }
        }
    }

    // ---- Reservation requests -------------------------------------------------

    /** Loads reservation requests across the host's listings. */
    fun loadHostBookings() {
        val token = token() ?: run {
            _bookings.value = HostBookingsUiState(loaded = true, error = "Please sign in.")
            return
        }
        _bookings.value = _bookings.value.copy(isLoading = true, error = null, actionMessage = null)
        viewModelScope.launch {
            try {
                val list = BookingService.fetchHostBookings(token)
                _bookings.value = HostBookingsUiState(bookings = list, loaded = true)
            } catch (e: Exception) {
                _bookings.value = HostBookingsUiState(
                    loaded = true,
                    error = e.message ?: "Could not load reservation requests."
                )
            }
        }
    }

    /**
     * Confirms or rejects a pending request. [action] must be "confirm" or "reject"
     * (the PATCH body's `status`). Updates the row in place on success.
     */
    fun act(bookingId: String, action: String) {
        if (_bookings.value.actingOn != null) return
        val token = token() ?: return
        _bookings.value = _bookings.value.copy(actingOn = bookingId, error = null, actionMessage = null)
        viewModelScope.launch {
            try {
                val updated = BookingService.updateBookingStatus(token, bookingId, action)
                val merged = _bookings.value.bookings.map { if (it.id == updated.id) updated else it }
                _bookings.value = _bookings.value.copy(
                    bookings = merged,
                    actingOn = null,
                    actionMessage = if (action == "confirm") "Reservation confirmed" else "Reservation rejected"
                )
            } catch (e: Exception) {
                _bookings.value = _bookings.value.copy(
                    actingOn = null,
                    error = e.message ?: "Couldn't update the reservation."
                )
            }
        }
    }

    // ---- Add listing ----------------------------------------------------------

    /**
     * Creates a listing as the signed-in host. Numeric fields are parsed leniently
     * (defaults: price 0, guests/bedrooms/beds/baths 1) and clamped to sane minimums.
     */
    fun createListing(
        title: String,
        description: String,
        location: String,
        country: String,
        pricePerNight: String,
        maxGuests: String,
        bedrooms: String,
        beds: String,
        bathrooms: String,
        propertyType: String,
        imageUrl: String,
        amenities: List<String> = emptyList(),
        lat: Double? = null,
        lng: Double? = null,
        region: String? = null,
        cancellationPolicy: String = "moderate",
        ownershipDoc: String? = null,
        weeklyDiscount: String = "0",
        monthlyDiscount: String = "0"
    ) {
        if (_create.value.isSubmitting) return
        val token = token() ?: run {
            _create.value = CreateListingUiState(error = "Please sign in as a host.")
            return
        }
        if (title.isBlank() || location.isBlank()) {
            _create.value = CreateListingUiState(error = "Title and location are required.")
            return
        }
        if (region.isNullOrBlank()) {
            _create.value = CreateListingUiState(error = "Please choose an area.")
            return
        }
        _create.value = CreateListingUiState(isSubmitting = true)
        viewModelScope.launch {
            try {
                val listing = BookingService.createListing(
                    token = token,
                    title = title.trim(),
                    description = description.trim(),
                    location = location.trim(),
                    country = country.trim(),
                    pricePerNight = pricePerNight.toDoubleOrNull()?.coerceAtLeast(0.0) ?: 0.0,
                    bedrooms = bedrooms.toIntOrNull()?.coerceAtLeast(0) ?: 1,
                    beds = beds.toIntOrNull()?.coerceAtLeast(0) ?: 1,
                    bathrooms = bathrooms.toIntOrNull()?.coerceAtLeast(0) ?: 1,
                    maxGuests = maxGuests.toIntOrNull()?.coerceAtLeast(1) ?: 1,
                    propertyType = propertyType.trim().ifBlank { "House" },
                    imageUrl = imageUrl.trim().ifBlank { null },
                    amenities = amenities,
                    lat = lat,
                    lng = lng,
                    region = region.trim(),
                    cancellationPolicy = cancellationPolicy,
                    ownershipDoc = ownershipDoc,
                    weeklyDiscount = weeklyDiscount.toIntOrNull()?.coerceIn(0, 100) ?: 0,
                    monthlyDiscount = monthlyDiscount.toIntOrNull()?.coerceIn(0, 100) ?: 0
                )
                _create.value = CreateListingUiState(created = listing)
                // Surface the new listing in the host's "Listings" tab immediately.
                _listings.value = _listings.value.copy(
                    listings = listOf(listing) + _listings.value.listings,
                    loaded = true
                )
            } catch (e: Exception) {
                _create.value = CreateListingUiState(error = e.message ?: "Couldn't publish the listing.")
            }
        }
    }

    /** Resets the create-listing form (after dismissing success, to add another). */
    fun resetCreate() {
        _create.value = CreateListingUiState()
    }

    // ---- Edit cancellation policy ---------------------------------------------

    /**
     * Updates [listingId]'s cancellation policy ([policy] = flexible|moderate|strict) as the host
     * (`PATCH /api/local/listings/:id`). On success folds the new value into the host's listings
     * list and publishes [savedPolicy] so the detail row reflects it. Surfaces [error] on failure.
     */
    fun setCancellationPolicy(listingId: String, policy: String) {
        if (_policy.value.isSaving) return
        val token = token() ?: run {
            _policy.value = CancellationPolicyUiState(listingId = listingId, error = "Please sign in as the host.")
            return
        }
        _policy.value = CancellationPolicyUiState(listingId = listingId, isSaving = true)
        viewModelScope.launch {
            try {
                val updated = BookingService.updateCancellationPolicy(token, listingId, policy)
                _policy.value = CancellationPolicyUiState(
                    listingId = listingId,
                    savedPolicy = updated.cancellationPolicy
                )
                // Keep the host's own-listings cache in sync so reopening shows the new policy.
                _listings.value = _listings.value.copy(
                    listings = _listings.value.listings.map {
                        if (it.id == listingId) it.copy(cancellationPolicy = updated.cancellationPolicy) else it
                    }
                )
            } catch (e: Exception) {
                _policy.value = CancellationPolicyUiState(
                    listingId = listingId,
                    error = e.message ?: "Couldn't update the cancellation policy."
                )
            }
        }
    }

    /** Clears the policy-edit state (when leaving the listing detail). */
    fun clearPolicy() {
        _policy.value = CancellationPolicyUiState()
    }

    // ---- Edit length-of-stay discounts ----------------------------------------

    /**
     * Updates [listingId]'s weekly/monthly length-of-stay discounts (% off) as the host
     * (`PATCH /api/local/listings/:id {weekly_discount, monthly_discount}`). On success folds the
     * new values into the host's listings cache and publishes [StayDiscountUiState.savedId] so the
     * card can confirm. Surfaces [error] on failure.
     */
    fun setStayDiscounts(listingId: String, weeklyDiscount: Int, monthlyDiscount: Int) {
        if (_stayDiscount.value.isSaving) return
        val token = token() ?: run {
            _stayDiscount.value = StayDiscountUiState(listingId = listingId, error = "Please sign in as the host.")
            return
        }
        _stayDiscount.value = StayDiscountUiState(listingId = listingId, isSaving = true)
        viewModelScope.launch {
            try {
                val updated = BookingService.updateStayDiscounts(token, listingId, weeklyDiscount, monthlyDiscount)
                _stayDiscount.value = StayDiscountUiState(listingId = listingId, savedId = listingId)
                // Keep the host's own-listings cache in sync so the card reflects the new discounts.
                _listings.value = _listings.value.copy(
                    listings = _listings.value.listings.map {
                        if (it.id == listingId) {
                            it.copy(
                                weeklyDiscount = updated.weeklyDiscount,
                                monthlyDiscount = updated.monthlyDiscount
                            )
                        } else it
                    }
                )
            } catch (e: Exception) {
                _stayDiscount.value = StayDiscountUiState(
                    listingId = listingId,
                    error = e.message ?: "Couldn't update the discounts."
                )
            }
        }
    }

    /** Clears the stay-discount edit state (after showing the confirmation / error). */
    fun clearStayDiscount() {
        _stayDiscount.value = StayDiscountUiState()
    }

    // ---- (Re)submit ownership document ----------------------------------------

    /**
     * (Re)submits [listingId]'s ownership/proof document as the host
     * (`PATCH /api/local/listings/:id {ownership_doc}`). [ownershipDoc] is a `data:image/...;base64`
     * data URL. On success the listing is re-queued to "pending"; we fold the updated approval state
     * into the host's own-listings cache so the badge flips to "Pending review" immediately.
     */
    fun reuploadOwnershipDoc(listingId: String, ownershipDoc: String) {
        if (_ownershipDoc.value.isSubmitting) return
        val token = token() ?: run {
            _ownershipDoc.value = OwnershipDocUiState(listingId = listingId, error = "Please sign in as the host.")
            return
        }
        if (ownershipDoc.isBlank()) {
            _ownershipDoc.value = OwnershipDocUiState(listingId = listingId, error = "Couldn't read that image.")
            return
        }
        _ownershipDoc.value = OwnershipDocUiState(listingId = listingId, isSubmitting = true)
        viewModelScope.launch {
            try {
                val updated = BookingService.updateOwnershipDoc(token, listingId, ownershipDoc)
                _ownershipDoc.value = OwnershipDocUiState(listingId = listingId, submittedId = listingId)
                // Keep the host's own-listings cache in sync so the approval badge updates in place.
                _listings.value = _listings.value.copy(
                    listings = _listings.value.listings.map {
                        if (it.id == listingId) it.copy(approvalStatus = updated.approvalStatus) else it
                    }
                )
            } catch (e: Exception) {
                _ownershipDoc.value = OwnershipDocUiState(
                    listingId = listingId,
                    error = e.message ?: "Couldn't submit the document."
                )
            }
        }
    }

    /** Clears the ownership-doc submission state (after showing the confirmation / error). */
    fun clearOwnershipDoc() {
        _ownershipDoc.value = OwnershipDocUiState()
    }

    // ---- AI listing-description writer (Section 10) ----------------------------

    /**
     * Generates a listing description from the details the host has filled so far
     * (`POST /api/local/ai/listing-description`). On success publishes [AiWriterUiState.generated]
     * for the wizard to drop into the editable Description field; on failure surfaces [error]. A
     * blank [title] short-circuits with a friendly note (the writer needs something to work with).
     */
    fun generateDescription(
        title: String,
        location: String,
        region: String,
        propertyType: String,
        bedrooms: Int,
        maxGuests: Int,
        amenities: List<String>,
        notes: String
    ) {
        if (_aiWriter.value.isWriting) return
        val token = token() ?: run {
            _aiWriter.value = AiWriterUiState(error = "Please sign in as a host.")
            return
        }
        if (title.isBlank()) {
            _aiWriter.value = AiWriterUiState(error = "Add a title first so the AI has something to write about.")
            return
        }
        _aiWriter.value = AiWriterUiState(isWriting = true)
        viewModelScope.launch {
            try {
                val description = BookingService.generateListingDescription(
                    token = token,
                    title = title.trim(),
                    location = location.trim(),
                    region = region.trim(),
                    propertyType = propertyType.trim(),
                    bedrooms = bedrooms,
                    maxGuests = maxGuests,
                    amenities = amenities,
                    notes = notes.trim()
                )
                if (description.isBlank()) {
                    _aiWriter.value = AiWriterUiState(error = "The AI didn't return anything. Please try again.")
                } else {
                    _aiWriter.value = AiWriterUiState(generated = description)
                }
            } catch (e: Exception) {
                _aiWriter.value = AiWriterUiState(error = e.message ?: "Couldn't write the description.")
            }
        }
    }

    /** Consumed by the wizard once the generated description has been dropped into the form. */
    fun consumeGeneratedDescription() {
        if (_aiWriter.value.generated != null) {
            _aiWriter.value = _aiWriter.value.copy(generated = null)
        }
    }

    /** Clears the AI-writer state (e.g. on leaving the Add-listing flow). */
    fun clearAiWriter() {
        _aiWriter.value = AiWriterUiState()
    }

    // ---- Host analytics (Section 10) ------------------------------------------

    /** Loads the host's performance dashboard (`GET /api/local/host/analytics`). */
    fun loadAnalytics() {
        val token = token() ?: run {
            _analytics.value = HostAnalyticsUiState(loaded = true, error = "Please sign in as a host.")
            return
        }
        _analytics.value = _analytics.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            try {
                val data = BookingService.fetchHostAnalytics(token)
                _analytics.value = HostAnalyticsUiState(analytics = data, loaded = true)
            } catch (e: Exception) {
                _analytics.value = HostAnalyticsUiState(
                    loaded = true,
                    error = e.message ?: "Could not load your analytics."
                )
            }
        }
    }
}
