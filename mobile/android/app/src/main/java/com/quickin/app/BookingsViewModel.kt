package com.quickin.app

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** State for the "My Reservations" tab list. */
data class ReservationsUiState(
    val isLoading: Boolean = false,
    val bookings: List<Booking> = emptyList(),
    val error: String? = null,
    val loaded: Boolean = false
)

/** State for a single reserve action on the listing detail screen. */
data class ReserveUiState(
    val isSubmitting: Boolean = false,
    val error: String? = null,
    /**
     * Set on a 201; carries the just-created booking. Bookings now start as 'pending'
     * (awaiting host confirmation), so the success card shows a "request sent" message.
     */
    val confirmed: Booking? = null,
    /** True when the user tried to reserve while signed out. */
    val needsSignIn: Boolean = false
)

/** State for the reservation DETAIL screen (`GET /api/local/bookings/:id`, with QR code). */
data class ReservationDetailUiState(
    val isLoading: Boolean = false,
    val reservation: Reservation? = null,
    val error: String? = null,
    /** True while a host is saving notes (`PATCH …/bookings/:id {host_notes}`). */
    val savingNotes: Boolean = false,
    /** Error from the last host-notes save, or null. */
    val notesError: String? = null,
    /** True while fetching the refund quote (`GET …/bookings/:id/cancel`) before confirming. */
    val loadingQuote: Boolean = false,
    /** The refund quote to confirm against, or null when no cancel dialog is open. */
    val cancelQuote: CancellationQuote? = null,
    /** True while the cancel POST is in flight. */
    val cancelling: Boolean = false,
    /** Error from quoting / cancelling, or null. */
    val cancelError: String? = null
)

/**
 * State for the MOCK payment sheet (`POST /api/local/bookings/:id/pay`). The sheet's
 * *visibility* is owned by MainActivity (it tracks which booking is being paid + the amounts);
 * this state only tracks the in-flight request, the resulting [PaymentReceipt] on success, and
 * any error. There is no real gateway — the backend always succeeds for the booking owner.
 */
data class PaymentUiState(
    val isPaying: Boolean = false,
    /** Set on success; the receipt drives the "Booking confirmed & paid" confirmation. */
    val receipt: PaymentReceipt? = null,
    val error: String? = null,
    /** True while a promo code is being previewed (`POST /api/local/promo/validate`). */
    val validatingPromo: Boolean = false,
    /**
     * The last promo preview for the code the guest entered, or null when none has been applied /
     * the field was cleared. A [PromoQuote.valid] quote nets its [PromoQuote.discount] off the
     * shown total and its code is sent at pay; an invalid quote just shows its message.
     */
    val promo: PromoQuote? = null
)

/**
 * State for the "Refer friends" surface on the Profile tab (`GET /api/local/referrals`).
 * [summary] carries the user's code + stats once loaded.
 */
data class ReferralUiState(
    val isLoading: Boolean = false,
    val summary: ReferralSummary? = null,
    val error: String? = null,
    val loaded: Boolean = false
)

/**
 * Owns reservation reads (the Reservations tab) and the reserve mutation (detail screen).
 * Reads the bearer token directly from SharedPreferences ("qk_auth" / "token") for the
 * Authorization header, so it works regardless of which screen triggers it.
 */
class BookingsViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences(
        AuthViewModel.PREFS_NAME, Context.MODE_PRIVATE
    )

    private val _reservations = MutableStateFlow(ReservationsUiState())
    val reservations: StateFlow<ReservationsUiState> = _reservations.asStateFlow()

    private val _reserve = MutableStateFlow(ReserveUiState())
    val reserve: StateFlow<ReserveUiState> = _reserve.asStateFlow()

    private val _detail = MutableStateFlow(ReservationDetailUiState())
    val detail: StateFlow<ReservationDetailUiState> = _detail.asStateFlow()

    private val _payment = MutableStateFlow(PaymentUiState())
    val payment: StateFlow<PaymentUiState> = _payment.asStateFlow()

    private val _referrals = MutableStateFlow(ReferralUiState())
    val referrals: StateFlow<ReferralUiState> = _referrals.asStateFlow()

    private fun token(): String? = prefs.getString(AuthViewModel.KEY_TOKEN, null)

    /** Loads the signed-in user's reservations. No-op (with a friendly state) when signed out. */
    fun loadReservations() {
        val token = token()
        if (token == null) {
            _reservations.value = ReservationsUiState(loaded = true)
            return
        }
        _reservations.value = _reservations.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            try {
                val bookings = BookingService.fetchBookings(token)
                _reservations.value = ReservationsUiState(
                    isLoading = false,
                    bookings = bookings,
                    loaded = true,
                    error = null
                )
            } catch (e: Exception) {
                _reservations.value = ReservationsUiState(
                    isLoading = false,
                    loaded = true,
                    error = e.message ?: "Could not load reservations."
                )
            }
        }
    }

    /** Clears reservation state on logout so a new user doesn't see stale data. */
    fun clearReservations() {
        _reservations.value = ReservationsUiState()
    }

    /**
     * Reserves [listingId] for the given range. Surfaces:
     *  • needsSignIn = true when no token (and on a 401 from the server),
     *  • error = {message} on a 400 (e.g. "Those dates are not available"),
     *  • confirmed = booking on 201.
     */
    fun createBooking(listingId: String, checkIn: String, checkOut: String, guests: Int) {
        if (_reserve.value.isSubmitting) return

        val token = token()
        if (token == null) {
            _reserve.value = ReserveUiState(needsSignIn = true)
            return
        }

        _reserve.value = ReserveUiState(isSubmitting = true)
        viewModelScope.launch {
            try {
                val booking = BookingService.createBooking(token, listingId, checkIn, checkOut, guests)
                _reserve.value = ReserveUiState(confirmed = booking)
                // Keep the Reservations tab fresh for the next visit.
                loadReservations()
            } catch (e: BookingService.HttpError) {
                if (e.code == 401) {
                    _reserve.value = ReserveUiState(needsSignIn = true)
                } else {
                    _reserve.value = ReserveUiState(error = e.message ?: "Could not reserve.")
                }
            } catch (e: Exception) {
                _reserve.value = ReserveUiState(error = e.message ?: "Could not reserve.")
            }
        }
    }

    /** Resets the reserve panel (after dismissing a success/error, or when leaving the screen). */
    fun resetReserve() {
        _reserve.value = ReserveUiState()
    }

    /**
     * Runs the MOCK payment for [bookingId]. On success the booking is paid + confirmed and the
     * [PaymentReceipt] is published (the sheet shows a paid confirmation). The Reservations tab is
     * refreshed so the stay reflects its new paid/confirmed state. There is no real charge.
     */
    fun pay(bookingId: String, method: String) {
        if (_payment.value.isPaying) return
        val token = token() ?: run {
            _payment.value = _payment.value.copy(error = "Please sign in to pay.")
            return
        }
        // Only send a code that previewed as valid; an invalid/blank preview is ignored.
        val promoCode = _payment.value.promo?.takeIf { it.valid }?.code
        _payment.value = _payment.value.copy(isPaying = true, error = null)
        viewModelScope.launch {
            try {
                val receipt = BookingService.pay(token, bookingId, method, promoCode)
                _payment.value = _payment.value.copy(isPaying = false, receipt = receipt, error = null)
                // Reflect the now paid + confirmed booking across the Trips tab + any open detail.
                loadReservations()
                if (_detail.value.reservation?.id == bookingId) loadReservation(bookingId)
            } catch (e: Exception) {
                _payment.value = _payment.value.copy(
                    isPaying = false,
                    error = e.message ?: "Payment failed. Please try again."
                )
            }
        }
    }

    /**
     * Previews [code] against [subtotal] (`POST /api/local/promo/validate`) so the pay sheet can
     * show what it's worth before the guest pays. A valid quote is folded into [PaymentUiState.promo]
     * (nets its discount off the shown total and is sent at pay); an invalid one surfaces its
     * message. A blank code clears any applied promo.
     */
    fun validatePromo(code: String, subtotal: Int) {
        val trimmed = code.trim()
        if (trimmed.isBlank()) {
            _payment.value = _payment.value.copy(promo = null, validatingPromo = false)
            return
        }
        if (_payment.value.validatingPromo) return
        val token = token() ?: run {
            _payment.value = _payment.value.copy(error = "Please sign in to use a promo code.")
            return
        }
        _payment.value = _payment.value.copy(validatingPromo = true, error = null)
        viewModelScope.launch {
            try {
                val quote = BookingService.validatePromo(token, trimmed, subtotal)
                _payment.value = _payment.value.copy(validatingPromo = false, promo = quote)
            } catch (e: Exception) {
                // Surface a not-valid quote so the sheet shows an inline message under the field.
                _payment.value = _payment.value.copy(
                    validatingPromo = false,
                    promo = PromoQuote(
                        valid = false,
                        code = trimmed,
                        message = e.message ?: "Couldn't validate that code."
                    )
                )
            }
        }
    }

    /** Clears just the applied/previewed promo (e.g. when the guest edits or removes the code). */
    fun clearPromo() {
        if (_payment.value.promo != null || _payment.value.validatingPromo) {
            _payment.value = _payment.value.copy(promo = null, validatingPromo = false)
        }
    }

    /** Clears payment state (when the sheet closes, or before opening it for a new booking). */
    fun resetPayment() {
        _payment.value = PaymentUiState()
    }

    // ---- Referrals ------------------------------------------------------------

    /** Loads the signed-in user's referral summary (`GET /api/local/referrals`). */
    fun loadReferrals() {
        val token = token() ?: run {
            _referrals.value = ReferralUiState(loaded = true, error = "Please sign in.")
            return
        }
        _referrals.value = _referrals.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            try {
                val summary = BookingService.fetchReferrals(token)
                _referrals.value = ReferralUiState(summary = summary, loaded = true)
            } catch (e: Exception) {
                _referrals.value = ReferralUiState(
                    loaded = true,
                    error = e.message ?: "Couldn't load your referrals."
                )
            }
        }
    }

    /** Clears referral state on logout so a new user doesn't see stale data. */
    fun clearReferrals() {
        _referrals.value = ReferralUiState()
    }

    /** Loads a single reservation (with reservation_code) for the detail / QR-card screen. */
    fun loadReservation(bookingId: String) {
        val token = token() ?: run {
            _detail.value = ReservationDetailUiState(error = "Please sign in to view this reservation.")
            return
        }
        _detail.value = ReservationDetailUiState(isLoading = true)
        viewModelScope.launch {
            try {
                val reservation = BookingService.fetchReservation(token, bookingId)
                _detail.value = ReservationDetailUiState(reservation = reservation)
            } catch (e: Exception) {
                _detail.value = ReservationDetailUiState(
                    error = e.message ?: "Could not load this reservation."
                )
            }
        }
    }

    /** Clears the reservation-detail screen state (when navigating back). */
    fun clearReservationDetail() {
        _detail.value = ReservationDetailUiState()
    }

    /**
     * Host-only: saves [notes] on [bookingId] (`PATCH …/bookings/:id {host_notes}`) and
     * folds the updated notes into the open reservation so the editor + "From your host"
     * card reflect the save immediately. Surfaces [notesError] on failure.
     */
    fun setHostNotes(bookingId: String, notes: String) {
        if (_detail.value.savingNotes) return
        val token = token() ?: run {
            _detail.value = _detail.value.copy(notesError = "Please sign in to edit notes.")
            return
        }
        _detail.value = _detail.value.copy(savingNotes = true, notesError = null)
        viewModelScope.launch {
            try {
                val updated = BookingService.setHostNotes(token, bookingId, notes)
                _detail.value = _detail.value.copy(
                    savingNotes = false,
                    notesError = null,
                    // Reflect the saved notes on the open reservation (the PATCH returns a Booking).
                    reservation = _detail.value.reservation?.copy(hostNotes = updated.hostNotes)
                )
            } catch (e: Exception) {
                _detail.value = _detail.value.copy(
                    savingNotes = false,
                    notesError = e.message ?: "Could not save your notes."
                )
            }
        }
    }

    // ---- Guest cancellation (quote + cancel) ----------------------------------

    /**
     * Fetches the refund quote for cancelling [bookingId] (`GET …/bookings/:id/cancel`, no
     * mutation) and opens the confirm dialog by publishing [cancelQuote]. Surfaces [cancelError]
     * on failure (e.g. the stay is no longer cancellable).
     */
    fun loadCancellationQuote(bookingId: String) {
        if (_detail.value.loadingQuote || _detail.value.cancelling) return
        val token = token() ?: run {
            _detail.value = _detail.value.copy(cancelError = "Please sign in to cancel.")
            return
        }
        _detail.value = _detail.value.copy(loadingQuote = true, cancelError = null, cancelQuote = null)
        viewModelScope.launch {
            try {
                val quote = BookingService.cancellationQuote(token, bookingId)
                _detail.value = _detail.value.copy(loadingQuote = false, cancelQuote = quote)
            } catch (e: Exception) {
                _detail.value = _detail.value.copy(
                    loadingQuote = false,
                    cancelError = e.message ?: "Couldn't load the refund details."
                )
            }
        }
    }

    /** Dismisses the cancel confirm dialog without cancelling (clears the quote + any error). */
    fun dismissCancelQuote() {
        _detail.value = _detail.value.copy(cancelQuote = null, cancelError = null, loadingQuote = false)
    }

    /**
     * Cancels [bookingId] (`POST …/bookings/:id/cancel`). On success folds the cancelled status +
     * refund percent into the open reservation, closes the dialog, and refreshes the Trips list so
     * the cancelled stay reflects everywhere. Surfaces [cancelError] on failure.
     */
    fun cancelReservation(bookingId: String) {
        if (_detail.value.cancelling) return
        val token = token() ?: run {
            _detail.value = _detail.value.copy(cancelError = "Please sign in to cancel.")
            return
        }
        _detail.value = _detail.value.copy(cancelling = true, cancelError = null)
        viewModelScope.launch {
            try {
                val cancelled = BookingService.cancelBooking(token, bookingId)
                _detail.value = _detail.value.copy(
                    cancelling = false,
                    cancelQuote = null,
                    cancelError = null,
                    reservation = _detail.value.reservation?.copy(
                        status = cancelled.status ?: "cancelled",
                        cancelledAt = cancelled.cancelledAt,
                        refundPercent = cancelled.refundPercent
                    )
                )
                // Reflect the cancelled stay across the Trips tab.
                loadReservations()
            } catch (e: Exception) {
                _detail.value = _detail.value.copy(
                    cancelling = false,
                    cancelError = e.message ?: "Couldn't cancel this reservation."
                )
            }
        }
    }
}
