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
 * State for the "Payment information" card on the Profile tab
 * (`GET` / `PUT` / `DELETE /api/local/host/payout-method`).
 */
data class PayoutUiState(
    val isLoading: Boolean = false,
    val loaded: Boolean = false,
    /** The saved destination, or null when the host has not added one yet. */
    val method: HostPayoutMethod? = null,
    /** True while a save or a removal is in flight. */
    val isSubmitting: Boolean = false,
    /** Inline error for the card, or null. */
    val error: String? = null,
    /**
     * True when the server refused because the account is not a host (403). The card hides itself
     * rather than showing an error a guest cannot act on.
     */
    val hidden: Boolean = false
)

/**
 * Owns the host's payout method — where QuickIn sends their earnings.
 *
 * Reads the bearer token directly from SharedPreferences ("qk_auth" / "token"), the same store
 * [AuthViewModel] / [TrustViewModel] use, so the Profile tab can load it without extra wiring.
 */
class PayoutViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences(
        AuthViewModel.PREFS_NAME, Context.MODE_PRIVATE
    )

    private val _payout = MutableStateFlow(PayoutUiState())
    val payout: StateFlow<PayoutUiState> = _payout.asStateFlow()

    private fun token(): String? = prefs.getString(AuthViewModel.KEY_TOKEN, null)

    /** Loads the host's payout method. No-op (friendly state) when signed out. */
    fun load() {
        val token = token() ?: run {
            _payout.value = PayoutUiState(loaded = true, hidden = true)
            return
        }
        _payout.value = _payout.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            try {
                val method = PayoutService.fetch(token)
                _payout.value = _payout.value.copy(
                    isLoading = false,
                    loaded = true,
                    method = method,
                    hidden = false,
                    error = null
                )
            } catch (e: PayoutService.HttpError) {
                // 403 means "not a host" — the section simply doesn't apply to this account.
                _payout.value = _payout.value.copy(
                    isLoading = false,
                    loaded = true,
                    method = null,
                    hidden = e.code == 403 || e.code == 401,
                    error = if (e.code == 403 || e.code == 401) null else e.message
                )
            } catch (e: Exception) {
                _payout.value = _payout.value.copy(isLoading = false, loaded = true, error = e.message)
            }
        }
    }

    /**
     * Saves (or replaces) the payout method. [onSaved] runs only on success so the editor can
     * close and clear the card number it was holding.
     */
    fun save(draft: PayoutDraft, onSaved: () -> Unit = {}) {
        if (_payout.value.isSubmitting) return
        val token = token() ?: run {
            _payout.value = _payout.value.copy(error = "Please sign in.")
            return
        }
        _payout.value = _payout.value.copy(isSubmitting = true, error = null)
        viewModelScope.launch {
            try {
                val method = PayoutService.save(token, draft)
                _payout.value = _payout.value.copy(
                    isSubmitting = false,
                    loaded = true,
                    method = method,
                    error = null
                )
                onSaved()
            } catch (e: Exception) {
                _payout.value = _payout.value.copy(isSubmitting = false, error = e.message)
            }
        }
    }

    /** Removes the payout method. [onRemoved] runs only on success. */
    fun remove(onRemoved: () -> Unit = {}) {
        if (_payout.value.isSubmitting) return
        val token = token() ?: return
        _payout.value = _payout.value.copy(isSubmitting = true, error = null)
        viewModelScope.launch {
            try {
                PayoutService.remove(token)
                _payout.value = _payout.value.copy(isSubmitting = false, method = null, error = null)
                onRemoved()
            } catch (e: Exception) {
                _payout.value = _payout.value.copy(isSubmitting = false, error = e.message)
            }
        }
    }

    /** Clears the payout state on logout so the next account starts fresh. */
    fun clear() {
        _payout.value = PayoutUiState()
    }
}
