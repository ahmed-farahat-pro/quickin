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
    /** Set on a 201; carries the confirmed booking for the success message. */
    val confirmed: Booking? = null,
    /** True when the user tried to reserve while signed out. */
    val needsSignIn: Boolean = false
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
}
