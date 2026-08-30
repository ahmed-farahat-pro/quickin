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

/**
 * The resort / compound catalog behind the host location step's picker
 * (`GET /api/local/resorts?region=`).
 *
 * [region] is the area the list belongs to, so a stale catalog is never shown under a newly picked
 * chip. An empty [resorts] with [isLoading] false means either "this area has no catalog entries
 * yet" or "the fetch failed" — the picker treats both the same way, offering the free-text "Other"
 * path, because a catalog that didn't arrive must not stop a host finishing a listing.
 */
data class ResortCatalogUiState(
    val region: String? = null,
    val isLoading: Boolean = false,
    val resorts: List<ResortOption> = emptyList(),
    /** True once a fetch for [region] has come back — including one that came back empty, which is
     *  what stops an area with no catalog entries being re-requested on every recomposition. */
    val loaded: Boolean = false
)

/**
 * State for the host's full listing edit (`PATCH /api/local/listings/:id`) — every field plus the
 * photo set, saved in one request. [listingId] tags which listing is being saved; [saved] carries
 * the listing the backend returned, which is already back to `approval_status = "pending"` and
 * unpublished, so the editor can confirm with the same "Under review" chip the host listings
 * screen uses.
 */
data class EditListingUiState(
    val listingId: String? = null,
    val isSaving: Boolean = false,
    val error: String? = null,
    /** Set on a successful save; carries the re-queued (now under-review) listing. */
    val saved: Listing? = null
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
 * State for the host taking one of their own listings off the market, or putting it back
 * (`PATCH /api/local/host/listings/:id/visibility`).
 *
 * [listingId] tags which card is acting (drives a per-card spinner). [message] is what ACTUALLY
 * happened, in the host's words — "3 booking requests were declined", or "reactivated, but it
 * stays hidden until…" — because a reactivate can legitimately come back still hidden and saying
 * "it's live again" then would be a lie.
 */
data class ListingVisibilityUiState(
    val listingId: String? = null,
    val isSubmitting: Boolean = false,
    val error: String? = null,
    /** Outcome line for the card, or null when there is nothing worth saying. */
    val message: String? = null
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

/**
 * State for "See it as a guest" — the host opening one of their own listings the way a guest
 * meets it, which is the only way to check a listing that is still waiting on approval.
 *
 * [listingId] tags which card is loading (per-card spinner). [listing] is the GUEST projection
 * fetched from `GET /api/local/listings/:id`, deliberately NOT the copy the dashboard already
 * holds: host reads come back from the backend's `LISTING_COLS_HOST`, whose prices are the
 * host's own raw amounts, while a guest is quoted those plus the platform commission. Previewing
 * the local object showed the host a nightly rate no guest will ever be offered — the single
 * number the preview exists to check.
 */
data class GuestPreviewUiState(
    val listingId: String? = null,
    val isLoading: Boolean = false,
    /** The guest-projection listing, ready to present; null until the read lands. */
    val listing: Listing? = null,
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

    private val _resorts = MutableStateFlow(ResortCatalogUiState())
    val resorts: StateFlow<ResortCatalogUiState> = _resorts.asStateFlow()

    private val _listings = MutableStateFlow(HostListingsUiState())
    val listings: StateFlow<HostListingsUiState> = _listings.asStateFlow()

    /**
     * The platform commission, so the add/edit-listing screens can show a host what a guest
     * will pay for the price they are typing. Null until loaded. Advisory only — the server
     * prices the listing either way — so a failed fetch just leaves the hint hidden.
     */
    private val _commission = MutableStateFlow<Commission?>(null)
    val commission: StateFlow<Commission?> = _commission.asStateFlow()

    /**
     * Whether this host may add a listing. Defaults to allowed so a failed fetch never
     * locks a legitimate host out — the server refuses the write regardless.
     */
    private val _listingGate = MutableStateFlow(ListingGate.UNKNOWN)
    val listingGate: StateFlow<ListingGate> = _listingGate.asStateFlow()

    /** Loads the listing gate (`GET /api/local/host/listing-gate`). Silent on failure. */
    fun loadListingGate() {
        val token = token() ?: return
        viewModelScope.launch {
            runCatching { BookingService.fetchListingGate(token) }
                .onSuccess { _listingGate.value = it }
        }
    }

    /** Loads the platform commission (`GET /api/local/host/commission`). Silent on failure. */
    fun loadCommission() {
        if (_commission.value != null) return
        val token = token() ?: return
        viewModelScope.launch {
            runCatching { BookingService.fetchCommission(token) }
                .onSuccess { _commission.value = it }
        }
    }

    private val _edit = MutableStateFlow(EditListingUiState())
    val edit: StateFlow<EditListingUiState> = _edit.asStateFlow()

    private val _policy = MutableStateFlow(CancellationPolicyUiState())
    val policy: StateFlow<CancellationPolicyUiState> = _policy.asStateFlow()

    private val _ownershipDoc = MutableStateFlow(OwnershipDocUiState())
    val ownershipDoc: StateFlow<OwnershipDocUiState> = _ownershipDoc.asStateFlow()

    private val _visibility = MutableStateFlow(ListingVisibilityUiState())
    val visibility: StateFlow<ListingVisibilityUiState> = _visibility.asStateFlow()

    private val _aiWriter = MutableStateFlow(AiWriterUiState())
    val aiWriter: StateFlow<AiWriterUiState> = _aiWriter.asStateFlow()

    private val _analytics = MutableStateFlow(HostAnalyticsUiState())
    val analytics: StateFlow<HostAnalyticsUiState> = _analytics.asStateFlow()

    private val _guestPreview = MutableStateFlow(GuestPreviewUiState())
    val guestPreview: StateFlow<GuestPreviewUiState> = _guestPreview.asStateFlow()

    private fun token(): String? = prefs.getString(AuthViewModel.KEY_TOKEN, null)

    // ---- "See it as a guest" --------------------------------------------------

    /**
     * Loads [listingId] as a GUEST sees it, for the host to preview.
     *
     * Authenticated, because the route 404s an unpublished listing to everyone but its owner —
     * and every listing still in the review queue is unpublished, which is exactly the case the
     * preview is for. No `?asHost`, because the prices have to be the guest's. See
     * [GuestPreviewUiState].
     */
    fun openGuestPreview(listingId: String) {
        val token = token()
        _guestPreview.value = GuestPreviewUiState(listingId = listingId, isLoading = true)
        viewModelScope.launch {
            val listing = SupabaseService.fetchListing(listingId, token)
            _guestPreview.value = if (listing != null) {
                GuestPreviewUiState(listingId = listingId, listing = listing)
            } else {
                GuestPreviewUiState(
                    listingId = listingId,
                    error = getApplication<Application>().getString(R.string.preview_guest_failed)
                )
            }
        }
    }

    /** Clears the preview — once the UI has presented it, and when the host closes it. */
    fun clearGuestPreview() {
        _guestPreview.value = GuestPreviewUiState()
    }

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
                    error = humanError(e, "Could not load your listings.")
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
                    error = humanError(e, "Could not load reservation requests.")
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
                // PATCH /bookings/:id answers with the plain booking projection, which carries no
                // `guest_name` — only the host inbox query joins it. Replacing the row wholesale
                // would therefore blank the guest's name the moment the host acted on the request,
                // so the name already on screen is kept unless the response actually supplies one.
                val merged = _bookings.value.bookings.map {
                    if (it.id == updated.id) updated.copy(guestName = updated.guestName ?: it.guestName) else it
                }
                _bookings.value = _bookings.value.copy(
                    bookings = merged,
                    actingOn = null,
                    actionMessage = if (action == "confirm") "Reservation confirmed" else "Reservation rejected"
                )
            } catch (e: Exception) {
                _bookings.value = _bookings.value.copy(
                    actingOn = null,
                    error = humanError(e, "Couldn't update the reservation.")
                )
            }
        }
    }

    // ---- Add listing ----------------------------------------------------------

    /**
     * Creates a listing as the signed-in host. Numeric fields are parsed leniently
     * (defaults: price 0, guests/bedrooms/beds/baths 1).
     *
     * The four capacity counts are clamped to [ListingCapacityPolicy.MINIMUM], not to 0 —
     * bedrooms, beds and bathrooms used to floor at zero here, which is how a chalet with
     * nowhere to sleep reached the API. The wizard already refuses to advance past a
     * below-floor count, so this clamp is the belt to that screen's braces rather than the
     * rule itself; the API refuses a 0 outright either way.
     */
    /**
     * Load the compounds for one curated area, for the host location step's picker. Re-requesting
     * the area already held is a no-op, so the composable can call this on every recomposition.
     *
     * Public and unauthenticated server-side, and best-effort here: a failure answers an empty
     * catalog rather than an error, because the resort question is optional and the "Other" path
     * still works without a list.
     */
    fun loadResorts(region: String?) {
        val area = region?.trim().orEmpty()
        if (area.isEmpty()) {
            _resorts.value = ResortCatalogUiState()
            return
        }
        val current = _resorts.value
        if (current.region == area && (current.isLoading || current.loaded)) return
        _resorts.value = ResortCatalogUiState(region = area, isLoading = true)
        viewModelScope.launch {
            val loaded = SupabaseService.fetchResorts(area)
            // Guard against a slow response for an area the host has since moved off.
            if (_resorts.value.region == area) {
                _resorts.value = ResortCatalogUiState(
                    region = area, isLoading = false, resorts = loaded, loaded = true
                )
            }
        }
    }

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
        images: List<String>,
        amenities: List<String> = emptyList(),
        lat: Double? = null,
        lng: Double? = null,
        region: String? = null,
        /** The resort / compound the host picked, or [ResortChoice.Selection.NONE] when the place
         *  isn't in one — a complete answer, and the wizard's default. */
        resort: ResortChoice.Selection = ResortChoice.Selection.NONE,
        cancellationPolicy: String = "moderate",
        ownershipDoc: String? = null,
        weeklyDiscount: String = "0",
        monthlyDiscount: String = "0",
        weekendPrice: String = "",
        weekendDays: Collection<Int> = WeekendSchedule.defaultDays,
        monthlyPrices: Map<String, Double> = emptyMap()
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
        // "Other" with nothing typed is not "no resort": the server cannot tell the two apart, so
        // it would save the listing with none at all and throw the host's answer away silently.
        ResortChoice.blocker(resort)?.let {
            _create.value = CreateListingUiState(error = it)
            return
        }
        // The seasonal rates and the days the weekend rate applies to, judged as one thing — the
        // API refuses a zero rate, a zero month, the whole week and a rate with no day left lit,
        // so the host is told here rather than by a 400 after the form has been filled in.
        seasonalProblem(weekendPrice, weekendDays, monthlyPrices)?.let {
            _create.value = CreateListingUiState(error = it)
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
                    bedrooms = bedrooms.toIntOrNull()?.coerceAtLeast(ListingCapacityPolicy.MINIMUM) ?: 1,
                    beds = beds.toIntOrNull()?.coerceAtLeast(ListingCapacityPolicy.MINIMUM) ?: 1,
                    bathrooms = bathrooms.toIntOrNull()?.coerceAtLeast(ListingCapacityPolicy.MINIMUM) ?: 1,
                    maxGuests = maxGuests.toIntOrNull()?.coerceAtLeast(ListingCapacityPolicy.MINIMUM) ?: 1,
                    propertyType = propertyType.trim().ifBlank { "House" },
                    images = images,
                    amenities = amenities,
                    lat = lat,
                    lng = lng,
                    region = region.trim(),
                    resort = resort,
                    cancellationPolicy = cancellationPolicy,
                    ownershipDoc = ownershipDoc,
                    weeklyDiscount = weeklyDiscount.toIntOrNull()?.coerceIn(0, 100) ?: 0,
                    monthlyDiscount = monthlyDiscount.toIntOrNull()?.coerceIn(0, 100) ?: 0,
                    weekendPrice = ListingPricingRules.checkPrice(weekendPrice).getOrNull(),
                    weekendDays = weekendDays,
                    monthlyPrices = monthlyPrices.filterValues { it > 0.0 }
                )
                _create.value = CreateListingUiState(created = listing)
                // Surface the new listing in the host's "Listings" tab immediately.
                _listings.value = _listings.value.copy(
                    listings = listOf(listing) + _listings.value.listings,
                    loaded = true
                )
            } catch (e: Exception) {
                _create.value = CreateListingUiState(error = humanError(e, "Couldn't publish the listing."))
            }
        }
    }

    /** Resets the create-listing form (after dismissing success, to add another). */
    fun resetCreate() {
        _create.value = CreateListingUiState()
    }

    /**
     * Drops a finished publish's success card, but deliberately LEAVES a failed attempt's error
     * alone. This state outlives every host screen (the view-model is activity-scoped), and the
     * two halves want opposite lifetimes: the error describes the draft the host still has in
     * [com.quickin.app.ui.FormDraftsViewModel], so it belongs with that draft, while [created]
     * describes a listing that is already filed. Without this, publishing from the dashboard's
     * "Add listing" tab and coming back showed the "Submitted for review" card again instead of
     * the wizard — a screen the returning host can do nothing with.
     */
    fun clearCreated() {
        if (_create.value.created != null) _create.value = CreateListingUiState()
    }

    // ---- Edit listing (full edit → back to review) -----------------------------

    /**
     * Saves the host's full edit of [listingId] (`PATCH /api/local/listings/:id`). Numeric fields
     * are parsed with the same lenient rules as [createListing] so the two forms can't drift.
     *
     * [images] is the full photo set in display order (index 0 = cover), or null when the host
     * didn't touch the photos — the editor stages add / delete / reorder / set-cover locally and
     * persists them here, so one Save is one re-review.
     *
     * The backend sends the listing back to the admin queue on every successful edit, so the
     * response is already `approval_status = "pending"`; we fold it into the host's own-listings
     * cache, which flips the card's approval chip to "Under review" without a refetch.
     */
    fun updateListing(
        listingId: String,
        title: String,
        description: String,
        location: String,
        country: String,
        region: String?,
        /** The resort / compound, or null when the host never touched the field — the two columns
         *  are then left exactly as they are. */
        resort: ResortChoice.Selection?,
        pricePerNight: String,
        maxGuests: String,
        bedrooms: String,
        beds: String,
        bathrooms: String,
        propertyType: String,
        amenities: List<String>,
        lat: Double?,
        lng: Double?,
        cancellationPolicy: String,
        weeklyDiscount: String,
        monthlyDiscount: String,
        weekendPrice: String,
        weekendDays: Collection<Int>,
        monthlyPrices: Map<String, Double>,
        images: List<String>?,
        ownershipDoc: String?
    ) {
        if (_edit.value.isSaving) return
        val token = token() ?: run {
            _edit.value = EditListingUiState(listingId = listingId, error = "Please sign in as the host.")
            return
        }
        // Same required-field rules the backend enforces on a PATCH, checked here so the host sees
        // the problem without a round trip.
        if (title.isBlank() || description.isBlank() || location.isBlank()) {
            _edit.value = EditListingUiState(
                listingId = listingId,
                error = "Title, description and location are required."
            )
            return
        }
        if (region.isNullOrBlank()) {
            _edit.value = EditListingUiState(listingId = listingId, error = "Please choose an area.")
            return
        }
        resort?.let { ResortChoice.blocker(it) }?.let {
            _edit.value = EditListingUiState(listingId = listingId, error = it)
            return
        }
        seasonalProblem(weekendPrice, weekendDays, monthlyPrices)?.let {
            _edit.value = EditListingUiState(listingId = listingId, error = it)
            return
        }
        val price = pricePerNight.toDoubleOrNull() ?: 0.0
        if (price <= 0.0) {
            _edit.value = EditListingUiState(
                listingId = listingId,
                error = "Price per night must be greater than 0."
            )
            return
        }
        _edit.value = EditListingUiState(listingId = listingId, isSaving = true)
        viewModelScope.launch {
            try {
                val updated = BookingService.updateListing(
                    token = token,
                    listingId = listingId,
                    title = title.trim(),
                    description = description.trim(),
                    location = location.trim(),
                    country = country.trim(),
                    region = region.trim(),
                    resort = resort,
                    pricePerNight = price,
                    // Same floor on the edit door: a listing may not be edited down to a
                    // place with no bedroom, bed or bathroom. See ListingCapacityPolicy.
                    maxGuests = maxGuests.toIntOrNull()?.coerceAtLeast(ListingCapacityPolicy.MINIMUM) ?: 1,
                    bedrooms = bedrooms.toIntOrNull()?.coerceAtLeast(ListingCapacityPolicy.MINIMUM) ?: 1,
                    beds = beds.toIntOrNull()?.coerceAtLeast(ListingCapacityPolicy.MINIMUM) ?: 1,
                    bathrooms = bathrooms.toIntOrNull()?.coerceAtLeast(ListingCapacityPolicy.MINIMUM) ?: 1,
                    propertyType = propertyType.trim().ifBlank { "House" },
                    amenities = amenities,
                    lat = lat,
                    lng = lng,
                    cancellationPolicy = cancellationPolicy,
                    weeklyDiscount = weeklyDiscount.toIntOrNull()?.coerceIn(0, 100) ?: 0,
                    monthlyDiscount = monthlyDiscount.toIntOrNull()?.coerceIn(0, 100) ?: 0,
                    weekendPrice = ListingPricingRules.checkPrice(weekendPrice).getOrNull(),
                    weekendDays = weekendDays,
                    monthlyPrices = monthlyPrices.filterValues { it > 0.0 },
                    images = images,
                    ownershipDoc = ownershipDoc
                )
                _edit.value = EditListingUiState(listingId = listingId, saved = updated)
                // The edit put the listing back in review — reflect that on the host's card in place.
                _listings.value = _listings.value.copy(
                    listings = _listings.value.listings.map { if (it.id == updated.id) updated else it }
                )
            } catch (e: Exception) {
                _edit.value = EditListingUiState(
                    listingId = listingId,
                    error = humanError(e, "Couldn't save your changes.")
                )
            }
        }
    }

    /** Clears the edit state (on leaving the editor / after the saved confirmation). */
    fun resetEdit() {
        _edit.value = EditListingUiState()
    }

    // ---- Listing visibility (the host's own takedown) --------------------------

    /**
     * Takes [listingId] off the market, or puts it back
     * (`PATCH /api/local/host/listings/:id/visibility`).
     *
     * This is QuickIn's "delete my listing" and it deletes nothing: bookings, reviews, messages
     * and payment records all point at the listing id, so the row survives and `is_published`
     * carries the meaning instead. Reservations the host already confirmed are untouched.
     *
     * **Deactivating declines every booking request still waiting on this host.** The screen
     * confirms with the count from [Listing.pendingRequestCount] BEFORE calling this; here we
     * only report how many actually went.
     *
     * The response is folded into the listings cache, so the card's badge, its button and the
     * status filter all follow without a refetch — and it is folded from what the server ACTUALLY
     * did, not from what was asked, because a reactivate comes back still hidden when an account
     * block, the identity gate or the review queue is also holding the listing.
     */
    fun setListingPublished(listingId: String, isPublished: Boolean) {
        if (_visibility.value.isSubmitting) return
        val token = token() ?: run {
            _visibility.value = ListingVisibilityUiState(listingId = listingId, error = "Please sign in as the host.")
            return
        }
        _visibility.value = ListingVisibilityUiState(listingId = listingId, isSubmitting = true)
        viewModelScope.launch {
            try {
                val result = BookingService.setListingPublished(token, listingId, isPublished)
                _visibility.value = ListingVisibilityUiState(
                    listingId = listingId,
                    message = visibilityMessage(isPublished, result)
                )
                _listings.value = _listings.value.copy(
                    listings = _listings.value.listings.map {
                        if (it.id != listingId) it
                        // Prefer the listing the server echoed — it carries the fresh approval
                        // state and pending count too. The local patch is the fallback for a
                        // response that omitted it.
                        else result.listing ?: it.copy(
                            isPublished = result.isPublished,
                            unpublishedByHost = !isPublished,
                            pendingRequestCount = if (isPublished) it.pendingRequestCount else 0
                        )
                    }
                )
            } catch (e: Exception) {
                _visibility.value = ListingVisibilityUiState(
                    listingId = listingId,
                    error = humanError(
                        e,
                        if (isPublished) "Couldn't reactivate this listing." else "Couldn't deactivate this listing."
                    )
                )
            }
        }
    }

    /**
     * The one line the card shows after a visibility change, or null when the outcome speaks for
     * itself (a clean reactivate, or a deactivate that had no requests waiting).
     */
    private fun visibilityMessage(
        asked: Boolean,
        result: BookingService.ListingVisibilityResult
    ): String? = when {
        // Asked to go live and did not: name who is still holding it. The server's own sentence
        // is the fallback for a code this build has no wording for.
        asked && !result.isPublished -> when (result.blockedBy) {
            "verification" -> "Reactivated — but your listing stays hidden until your identity is verified again."
            "staff" -> "Reactivated — but your listing stays hidden while our team reviews it. Contact support for details."
            "rejected" -> "Reactivated — but your listing stays hidden because it wasn't approved. Fix the points in the review note and resubmit."
            "under_review" -> "Reactivated — your listing goes live as soon as our team approves it."
            else -> result.blockedMessage?.takeIf { it.isNotBlank() }
        }
        !asked && result.declinedRequests > 0 ->
            if (result.declinedRequests == 1) "1 booking request was declined."
            else "${result.declinedRequests} booking requests were declined."
        else -> null
    }

    /** Clears the visibility outcome (after the card has shown it). */
    fun clearVisibilityMessage() {
        _visibility.value = ListingVisibilityUiState()
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
                    error = humanError(e, "Couldn't update the cancellation policy.")
                )
            }
        }
    }

    /** Clears the policy-edit state (when leaving the listing detail). */
    fun clearPolicy() {
        _policy.value = CancellationPolicyUiState()
    }

    // ---- The weekend rate and the days it applies to ---------------------------

    /**
     * The message for a (rate, days) pair the API would refuse, or null when it is fine.
     *
     * English here, like every other guard in this view model — the screens carry the localized
     * copy beside the day pills and stop before they ever reach this. This is the backstop for a
     * caller that didn't, and its wording matches what the server would have answered.
     */
    /**
     * Everything that can be wrong with a listing's seasonal pricing, as one sentence, or null.
     *
     * A backstop behind the screens, which say the same things in the host's own language beside
     * the offending field (see ListingPricingRules + the `blocker` chains in the wizard and the
     * editor). It exists because this used to be the LAST place a `0` could have been caught and
     * it did the opposite: `toDoubleOrNull()?.takeIf { it > 0.0 }` read a typed zero and an empty
     * field as the same thing, sent `weekend_price: null`, and the listing saved with no weekend
     * rate at all.
     *
     * Order matters: the rate is judged before the days, because WeekendSchedule.resolve answers
     * "no rate, no days, no problem" to a 0 — correctly, since it may only ever be handed a rate
     * that is already known to be one.
     */
    private fun seasonalProblem(
        weekendPrice: String,
        weekendDays: Collection<Int>,
        monthlyPrices: Map<String, Double> = emptyMap()
    ): String? {
        ListingPricingRules.problemWith(weekendPrice)?.let { return weekendPriceProblemMessage(it) }
        val rate = ListingPricingRules.checkPrice(weekendPrice).getOrNull()
        // The months arrive already parsed, so a zero here is a caller that skipped its own gate.
        monthlyPrices.entries.sortedBy { it.key.toIntOrNull() ?: 0 }.firstOrNull { it.value <= 0.0 }
            ?.let { return "The rate for month ${it.key} must be greater than 0, or leave it empty." }
        val err = WeekendSchedule.resolve(rate, weekendDays).exceptionOrNull() ?: return null
        return weekendProblemMessage((err as WeekendDaysException).problem)
    }

    private fun weekendPriceProblemMessage(problem: ListingPricingRules.Problem): String =
        when (problem) {
            ListingPricingRules.Problem.NOT_POSITIVE ->
                "Weekend price must be greater than 0, or leave it empty."
            ListingPricingRules.Problem.NOT_A_NUMBER ->
                "Weekend price must be a number, or leave it empty."
        }

    private fun weekendProblemMessage(problem: WeekendSchedule.Problem): String = when (problem) {
        WeekendSchedule.Problem.WHOLE_WEEK ->
            "Weekend pricing cannot apply to all seven days — set the nightly price instead."
        WeekendSchedule.Problem.NO_DAYS_CHOSEN ->
            "Pick at least one weekend day, or clear the weekend price."
    }

    // ---- (Re)submit ownership document ----------------------------------------

    /**
     * (Re)submits [listingId]'s ownership/proof document as the host
     * (`PATCH /api/local/listings/:id {ownership_doc}`). [ownershipDoc] is an image or
     * `application/pdf` base64 data URL, already checked by [OwnershipDocLoader] — a deed reaches a
     * host as either. On success the listing is re-queued to "pending"; we fold the updated approval state
     * into the host's own-listings cache so the badge flips to "Pending review" immediately.
     */
    fun reuploadOwnershipDoc(listingId: String, ownershipDoc: String) {
        if (_ownershipDoc.value.isSubmitting) return
        val token = token() ?: run {
            _ownershipDoc.value = OwnershipDocUiState(listingId = listingId, error = "Please sign in as the host.")
            return
        }
        if (ownershipDoc.isBlank()) {
            _ownershipDoc.value = OwnershipDocUiState(listingId = listingId, error = "Couldn't read that document.")
            return
        }
        _ownershipDoc.value = OwnershipDocUiState(listingId = listingId, isSubmitting = true)
        viewModelScope.launch {
            try {
                val updated = BookingService.updateOwnershipDoc(token, listingId, ownershipDoc)
                _ownershipDoc.value = OwnershipDocUiState(listingId = listingId, submittedId = listingId)
                // Keep the host's own-listings cache in sync so the approval badge updates in
                // place — and so does the button, which now certainly has a document to
                // re-upload whatever the (guest-projection) PATCH response says.
                _listings.value = _listings.value.copy(
                    listings = _listings.value.listings.map {
                        if (it.id == listingId) {
                            it.copy(approvalStatus = updated.approvalStatus, hasOwnershipDoc = true)
                        } else it
                    }
                )
            } catch (e: Exception) {
                _ownershipDoc.value = OwnershipDocUiState(
                    listingId = listingId,
                    error = humanError(e, "Couldn't submit the document.")
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
                _aiWriter.value = AiWriterUiState(error = humanError(e, "Couldn't write the description."))
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
                    error = humanError(e, "Could not load your analytics.")
                )
            }
        }
    }
}
