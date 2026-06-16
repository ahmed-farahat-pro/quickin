package com.quickin.app

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Live availability for the currently-open listing: the unavailable spans (booked + host-blocked)
 * used to grey out days in the guest reserve picker. Fetched publicly (no auth) per listing.
 * [listingId] tags which listing the [ranges] belong to, so a stale fetch for a previously-open
 * listing can be ignored.
 */
data class AvailabilityUiState(
    val listingId: String? = null,
    val isLoading: Boolean = false,
    val ranges: List<AvailabilityRange> = emptyList()
)

/**
 * State for the host's "Manage availability" sheet: the current spans (booked are read-only,
 * blocked are removable), plus the in-flight add/remove flags and any error.
 */
data class HostAvailabilityUiState(
    val listingId: String? = null,
    val isLoading: Boolean = false,
    val ranges: List<AvailabilityRange> = emptyList(),
    val error: String? = null,
    /** True while a "Block dates" POST is in flight. */
    val isAdding: Boolean = false,
    /** Id of the block currently being removed (drives a per-row spinner), or null. */
    val removingId: String? = null
) {
    /** Manual host blocks (removable), oldest start first. */
    val blocks: List<AvailabilityRange>
        get() = ranges.filter { it.isBlock }.sortedBy { it.start }

    /** Guest reservations (read-only), oldest start first. */
    val booked: List<AvailabilityRange>
        get() = ranges.filter { !it.isBlock }.sortedBy { it.start }
}

/**
 * Owns availability reads for the guest reserve picker and the host block/unblock mutations.
 *
 * The guest side ([guest] / [loadForListing]) uses the public availability endpoint so even a
 * signed-out browser sees booked + blocked days greyed out. The host side ([host] / [loadHost],
 * [addBlock], [removeBlock]) reads the bearer token directly from SharedPreferences
 * ("qk_auth" / "token") — the same store the other view-models use.
 */
class AvailabilityViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences(
        AuthViewModel.PREFS_NAME, Context.MODE_PRIVATE
    )

    private fun token(): String? = prefs.getString(AuthViewModel.KEY_TOKEN, null)

    // ---- Guest reserve picker -------------------------------------------------

    private val _guest = MutableStateFlow(AvailabilityUiState())
    val guest: StateFlow<AvailabilityUiState> = _guest.asStateFlow()

    /**
     * Loads the unavailable spans for [listingId] (public). Clears any prior listing's spans
     * immediately so an old listing's greyed days never linger, then refetches. A blank id
     * just clears the state. Best-effort — failures yield no spans (every day selectable).
     */
    fun loadForListing(listingId: String?) {
        val id = listingId?.takeIf { it.isNotBlank() }
        _guest.value = AvailabilityUiState(listingId = id, isLoading = id != null)
        if (id == null) return
        viewModelScope.launch {
            val ranges = SupabaseService.fetchAvailability(id)
            // Ignore a result that arrived after the user opened a different listing.
            if (_guest.value.listingId == id) {
                _guest.value = AvailabilityUiState(listingId = id, isLoading = false, ranges = ranges)
            }
        }
    }

    /** Clears the guest picker's availability (on leaving the detail screen). */
    fun clearGuest() {
        _guest.value = AvailabilityUiState()
    }

    // ---- Host availability manager --------------------------------------------

    private val _host = MutableStateFlow(HostAvailabilityUiState())
    val host: StateFlow<HostAvailabilityUiState> = _host.asStateFlow()

    /** Loads the host's view of [listingId]'s spans (booked read-only + blocked removable). */
    fun loadHost(listingId: String) {
        val token = token() ?: run {
            _host.value = HostAvailabilityUiState(listingId = listingId, error = "Please sign in.")
            return
        }
        _host.value = _host.value.copy(listingId = listingId, isLoading = true, error = null)
        viewModelScope.launch {
            try {
                val ranges = BookingService.fetchAvailability(token, listingId)
                _host.value = HostAvailabilityUiState(listingId = listingId, ranges = ranges)
            } catch (e: Exception) {
                _host.value = HostAvailabilityUiState(
                    listingId = listingId,
                    error = e.message ?: "Could not load availability."
                )
            }
        }
    }

    /**
     * Blocks [start, end) (yyyy-MM-dd, half-open) on [listingId] as the host, then refreshes the
     * list so the new block (and any guest's view) reflects it. Surfaces [error] on failure.
     */
    fun addBlock(listingId: String, start: String, end: String, note: String?) {
        if (_host.value.isAdding) return
        val token = token() ?: run {
            _host.value = _host.value.copy(error = "Please sign in as the host.")
            return
        }
        _host.value = _host.value.copy(isAdding = true, error = null)
        viewModelScope.launch {
            try {
                BookingService.addAvailabilityBlock(token, listingId, start, end, note)
                // Refetch so booked + blocked stay authoritative (and ids are server-assigned).
                val ranges = BookingService.fetchAvailability(token, listingId)
                _host.value = _host.value.copy(isAdding = false, ranges = ranges, error = null)
                // Keep the guest picker in sync if it's showing this same listing.
                if (_guest.value.listingId == listingId) {
                    _guest.value = _guest.value.copy(ranges = ranges)
                }
            } catch (e: Exception) {
                _host.value = _host.value.copy(
                    isAdding = false,
                    error = e.message ?: "Could not block those dates."
                )
            }
        }
    }

    /** Removes a host block by [blockId] on [listingId], then refreshes the list. */
    fun removeBlock(listingId: String, blockId: String) {
        if (_host.value.removingId != null) return
        val token = token() ?: run {
            _host.value = _host.value.copy(error = "Please sign in as the host.")
            return
        }
        _host.value = _host.value.copy(removingId = blockId, error = null)
        viewModelScope.launch {
            try {
                BookingService.removeAvailabilityBlock(token, listingId, blockId)
                val ranges = BookingService.fetchAvailability(token, listingId)
                _host.value = _host.value.copy(removingId = null, ranges = ranges, error = null)
                if (_guest.value.listingId == listingId) {
                    _guest.value = _guest.value.copy(ranges = ranges)
                }
            } catch (e: Exception) {
                _host.value = _host.value.copy(
                    removingId = null,
                    error = e.message ?: "Could not remove that block."
                )
            }
        }
    }

    /** Clears the host manager state (when the sheet closes). */
    fun clearHost() {
        _host.value = HostAvailabilityUiState()
    }
}
