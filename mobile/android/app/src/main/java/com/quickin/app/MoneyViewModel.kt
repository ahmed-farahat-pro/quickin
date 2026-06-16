package com.quickin.app

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** State for the host "Earnings & payouts" screen (`GET /api/local/host/earnings`). */
data class HostEarningsUiState(
    val isLoading: Boolean = false,
    val earnings: HostEarnings? = null,
    val error: String? = null,
    val loaded: Boolean = false
)

/** State for the guest "Receipts" screen (`GET /api/local/receipts`). */
data class ReceiptsUiState(
    val isLoading: Boolean = false,
    val receipts: List<GuestReceipt> = emptyList(),
    val error: String? = null,
    val loaded: Boolean = false
)

/**
 * Drives the two MOCK money views (Section 9):
 *  • the host's earnings/payouts summary (reached from the host area), and
 *  • the guest's itemized receipts (reached from the Profile tab).
 *
 * Reads the bearer token directly from SharedPreferences ("qk_auth" / "token") — the same store the
 * other view-models use — so it works without plumbing the token through composables.
 */
class MoneyViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences(
        AuthViewModel.PREFS_NAME, Context.MODE_PRIVATE
    )

    private val _earnings = MutableStateFlow(HostEarningsUiState())
    val earnings: StateFlow<HostEarningsUiState> = _earnings.asStateFlow()

    private val _receipts = MutableStateFlow(ReceiptsUiState())
    val receipts: StateFlow<ReceiptsUiState> = _receipts.asStateFlow()

    private fun token(): String? = prefs.getString(AuthViewModel.KEY_TOKEN, null)

    /** Loads the host's earnings + payouts summary. */
    fun loadEarnings() {
        val token = token() ?: run {
            _earnings.value = HostEarningsUiState(loaded = true, error = "Please sign in.")
            return
        }
        _earnings.value = _earnings.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            try {
                val data = BookingService.fetchHostEarnings(token)
                _earnings.value = HostEarningsUiState(earnings = data, loaded = true)
            } catch (e: Exception) {
                _earnings.value = HostEarningsUiState(
                    loaded = true,
                    error = e.message ?: "Could not load your earnings."
                )
            }
        }
    }

    /** Loads the guest's itemized receipts for paid stays. */
    fun loadReceipts() {
        val token = token() ?: run {
            _receipts.value = ReceiptsUiState(loaded = true, error = "Please sign in.")
            return
        }
        _receipts.value = _receipts.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            try {
                val list = BookingService.fetchReceipts(token)
                _receipts.value = ReceiptsUiState(receipts = list, loaded = true)
            } catch (e: Exception) {
                _receipts.value = ReceiptsUiState(
                    loaded = true,
                    error = e.message ?: "Could not load your receipts."
                )
            }
        }
    }

    /** Clears both money states (e.g. on logout, so the next account never sees stale figures). */
    fun clear() {
        _earnings.value = HostEarningsUiState()
        _receipts.value = ReceiptsUiState()
    }
}
