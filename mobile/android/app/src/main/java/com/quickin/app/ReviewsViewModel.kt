package com.quickin.app

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** State for a listing's public reviews section (`GET /api/local/reviews?listing_id=`). */
data class ListingReviewsUiState(
    val isLoading: Boolean = false,
    val reviews: List<Review> = emptyList(),
    val error: String? = null,
    val loadedListingId: String? = null
)

/**
 * State for submitting a review on a completed stay. [reviewableIds] is the set of booking ids the
 * user is still allowed to review (drives the "Leave a review" affordance on the Trips list).
 * [submitting] guards the in-flight POST; [submittedBookingId] is set on success so the UI can
 * confirm and dismiss; [error] surfaces a 400 (e.g. "already reviewed").
 */
data class ReviewSubmitUiState(
    val reviewableIds: Set<String> = emptySet(),
    val submitting: Boolean = false,
    val submittedBookingId: String? = null,
    val error: String? = null
)

/**
 * State for the host's "Review your guests" surface (`GET /api/local/guest-reviews` with the
 * bearer token). [guests] is the list of still-reviewable past guests; [actingOn] is the booking
 * id whose POST is in flight; [error] surfaces a load/submit failure inline.
 */
data class ReviewGuestsUiState(
    val isLoading: Boolean = false,
    val loaded: Boolean = false,
    val guests: List<ReviewableGuest> = emptyList(),
    val actingOn: String? = null,
    val error: String? = null
)

/**
 * State for the reviews a guest has *received* (`GET /api/local/guest-reviews?guest_id=`),
 * shown on the user's own profile. [reviews] are newest-first; [averageRating] / [count] back the
 * header summary.
 */
data class ReceivedReviewsUiState(
    val isLoading: Boolean = false,
    val reviews: List<GuestReview> = emptyList(),
    val error: String? = null,
    val loadedGuestId: String? = null
) {
    /** Number of received reviews. */
    val count: Int get() = reviews.size

    /** Average of the received ratings (0.0 when none). */
    val averageRating: Double
        get() = if (reviews.isEmpty()) 0.0
        else reviews.sumOf { it.rating }.toDouble() / reviews.size
}

/**
 * Owns review reads (a listing's public reviews) and the review mutation (rate a completed stay).
 * Reads the bearer token straight from SharedPreferences ("qk_auth" / "token") for the
 * authenticated calls, matching the other view-models.
 */
class ReviewsViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences(
        AuthViewModel.PREFS_NAME, Context.MODE_PRIVATE
    )

    private val _listingReviews = MutableStateFlow(ListingReviewsUiState())
    val listingReviews: StateFlow<ListingReviewsUiState> = _listingReviews.asStateFlow()

    private val _submit = MutableStateFlow(ReviewSubmitUiState())
    val submit: StateFlow<ReviewSubmitUiState> = _submit.asStateFlow()

    private val _reviewGuests = MutableStateFlow(ReviewGuestsUiState())
    val reviewGuests: StateFlow<ReviewGuestsUiState> = _reviewGuests.asStateFlow()

    private val _receivedReviews = MutableStateFlow(ReceivedReviewsUiState())
    val receivedReviews: StateFlow<ReceivedReviewsUiState> = _receivedReviews.asStateFlow()

    private fun token(): String? = prefs.getString(AuthViewModel.KEY_TOKEN, null)

    /** Loads a listing's public reviews for the detail screen's Reviews section. */
    fun loadListingReviews(listingId: String) {
        if (listingId.isBlank()) return
        _listingReviews.value = ListingReviewsUiState(isLoading = true, loadedListingId = listingId)
        viewModelScope.launch {
            try {
                val reviews = ReviewService.fetchListingReviews(listingId)
                _listingReviews.value = ListingReviewsUiState(
                    isLoading = false,
                    reviews = reviews,
                    loadedListingId = listingId
                )
            } catch (e: Exception) {
                _listingReviews.value = ListingReviewsUiState(
                    isLoading = false,
                    loadedListingId = listingId,
                    error = e.message ?: "Could not load reviews."
                )
            }
        }
    }

    /** Clears the listing-reviews state when leaving the detail screen. */
    fun clearListingReviews() {
        _listingReviews.value = ListingReviewsUiState()
    }

    /**
     * Refreshes the set of stays the user can still review, so the Trips list can show a
     * "Leave a review" affordance only where it's allowed. No-op when signed out.
     */
    fun loadReviewable() {
        val token = token()
        if (token == null) {
            _submit.value = _submit.value.copy(reviewableIds = emptySet())
            return
        }
        viewModelScope.launch {
            runCatching { ReviewService.fetchReviewableStays(token) }
                .onSuccess { stays ->
                    _submit.value = _submit.value.copy(reviewableIds = stays.map { it.bookingId }.toSet())
                }
        }
    }

    /** True when [bookingId] is still eligible for a review. */
    fun canReview(bookingId: String): Boolean = _submit.value.reviewableIds.contains(bookingId)

    /**
     * Submits a [rating] (1–5) + optional [comment] + optional [photos] (`data:`/`http` URL
     * strings, ≤6) for a completed [bookingId]. On success the booking id is removed from the
     * reviewable set and [submittedBookingId] is set so the UI can confirm. A 400 (already
     * reviewed / not eligible) surfaces as an inline [error].
     */
    fun submitReview(bookingId: String, rating: Int, comment: String?, photos: List<String> = emptyList()) {
        if (_submit.value.submitting) return
        val token = token() ?: return
        _submit.value = _submit.value.copy(submitting = true, error = null, submittedBookingId = null)
        viewModelScope.launch {
            try {
                ReviewService.submitReview(token, bookingId, rating, comment, photos)
                _submit.value = _submit.value.copy(
                    submitting = false,
                    submittedBookingId = bookingId,
                    reviewableIds = _submit.value.reviewableIds - bookingId,
                    error = null
                )
            } catch (e: Exception) {
                _submit.value = _submit.value.copy(
                    submitting = false,
                    error = e.message ?: "Could not submit your review."
                )
            }
        }
    }

    // ---- Host → guest reviews -------------------------------------------------

    /** Loads the past guests the signed-in host can still review. No-op when signed out. */
    fun loadReviewableGuests() {
        val token = token()
        if (token == null) {
            _reviewGuests.value = ReviewGuestsUiState(loaded = true)
            return
        }
        _reviewGuests.value = _reviewGuests.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            try {
                val guests = ReviewService.fetchReviewableGuests(token)
                _reviewGuests.value = ReviewGuestsUiState(loaded = true, guests = guests)
            } catch (e: Exception) {
                _reviewGuests.value = _reviewGuests.value.copy(
                    isLoading = false,
                    loaded = true,
                    error = e.message ?: "Could not load your guests."
                )
            }
        }
    }

    /**
     * Submits a host's [rating] (1–5) + optional [comment] about the guest on [bookingId]. On
     * success the guest is removed from the reviewable list. A failure surfaces as an inline error.
     */
    fun submitGuestReview(bookingId: String, rating: Int, comment: String?) {
        if (_reviewGuests.value.actingOn != null) return
        val token = token() ?: return
        _reviewGuests.value = _reviewGuests.value.copy(actingOn = bookingId, error = null)
        viewModelScope.launch {
            try {
                ReviewService.submitGuestReview(token, bookingId, rating, comment)
                _reviewGuests.value = _reviewGuests.value.copy(
                    actingOn = null,
                    guests = _reviewGuests.value.guests.filterNot { it.bookingId == bookingId }
                )
            } catch (e: Exception) {
                _reviewGuests.value = _reviewGuests.value.copy(
                    actingOn = null,
                    error = e.message ?: "Could not submit your review."
                )
            }
        }
    }

    // ---- Reviews received about a guest (own profile) -------------------------

    /** Loads the reviews left about [guestId] (the signed-in user) for their profile. */
    fun loadReceivedReviews(guestId: String?) {
        if (guestId.isNullOrBlank()) {
            _receivedReviews.value = ReceivedReviewsUiState()
            return
        }
        _receivedReviews.value = ReceivedReviewsUiState(isLoading = true, loadedGuestId = guestId)
        viewModelScope.launch {
            try {
                val reviews = ReviewService.fetchGuestReviews(guestId)
                _receivedReviews.value = ReceivedReviewsUiState(
                    isLoading = false,
                    reviews = reviews,
                    loadedGuestId = guestId
                )
            } catch (e: Exception) {
                _receivedReviews.value = ReceivedReviewsUiState(
                    isLoading = false,
                    loadedGuestId = guestId,
                    error = e.message ?: "Could not load reviews."
                )
            }
        }
    }

    /** Clears the post-submit ack + any error (called after the success/error is shown). */
    fun acknowledgeSubmit() {
        _submit.value = _submit.value.copy(submittedBookingId = null, error = null)
    }

    /** Wipes review state on logout. */
    fun clear() {
        _listingReviews.value = ListingReviewsUiState()
        _submit.value = ReviewSubmitUiState()
        _reviewGuests.value = ReviewGuestsUiState()
        _receivedReviews.value = ReceivedReviewsUiState()
    }
}
