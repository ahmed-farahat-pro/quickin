package com.quickin.app

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** State for a single booking's chat thread (`/api/local/bookings/:id/messages`). */
data class ChatUiState(
    /** True only for the very first load (drives the centered spinner). */
    val isLoading: Boolean = false,
    val messages: List<ChatMessage> = emptyList(),
    /** Signed-in user's id (from prefs); used to right-align "my" bubbles. */
    val myId: String? = null,
    /** A load/refresh error to show (kept off the bubble list). */
    val error: String? = null,
    /** True while a POST is in flight (disables the Send button + input). */
    val isSending: Boolean = false,
    /** The booking this thread belongs to, so polling/sends target the right id. */
    val bookingId: String? = null
)

/**
 * Drives the per-booking CHAT screen (host ↔ guest). Reads the bearer token and the
 * signed-in user's id straight from SharedPreferences ("qk_auth") — the same store
 * [AuthViewModel] / [HostViewModel] use — so no token plumbing through composables.
 *
 *   GET  /api/local/bookings/:id/messages  -> [{id, sender_id, sender_name, body, created_at}]
 *   POST /api/local/bookings/:id/messages  {body} -> the created message
 *
 * The screen calls [start] once (with the bookingId), [refresh] on a ~4s poll, and
 * [send] from the input bar. A single VM instance is reused across bookings, so
 * [start] resets state whenever the booking changes.
 */
class ChatViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences(
        AuthViewModel.PREFS_NAME, Context.MODE_PRIVATE
    )

    private val _state = MutableStateFlow(ChatUiState())
    val state: StateFlow<ChatUiState> = _state.asStateFlow()

    private fun token(): String? = prefs.getString(AuthViewModel.KEY_TOKEN, null)
    private fun myId(): String? = prefs.getString(AuthViewModel.KEY_USER_ID, null)

    /**
     * Binds the thread to [bookingId] and performs the first load. If the screen is
     * re-opened for a different booking, state is reset; re-opening the same booking
     * keeps the existing messages and just refreshes.
     */
    fun start(bookingId: String) {
        if (_state.value.bookingId == bookingId && _state.value.messages.isNotEmpty()) {
            refresh()
            return
        }
        _state.value = ChatUiState(
            isLoading = true,
            myId = myId(),
            bookingId = bookingId
        )
        load(bookingId, initial = true)
    }

    /** Silent re-fetch used by the polling loop (no spinner, errors swallowed). */
    fun refresh() {
        val bookingId = _state.value.bookingId ?: return
        load(bookingId, initial = false)
    }

    private fun load(bookingId: String, initial: Boolean) {
        val token = token() ?: run {
            _state.value = _state.value.copy(isLoading = false, error = "Please sign in.")
            return
        }
        viewModelScope.launch {
            try {
                val list = BookingService.fetchMessages(token, bookingId)
                // A stale response (booking changed mid-flight) is ignored.
                if (_state.value.bookingId != bookingId) return@launch
                _state.value = _state.value.copy(
                    isLoading = false,
                    messages = list,
                    error = null
                )
            } catch (e: Exception) {
                if (_state.value.bookingId != bookingId) return@launch
                // Only surface errors on the first load; background polls fail quietly.
                if (initial) {
                    _state.value = _state.value.copy(
                        isLoading = false,
                        error = e.message ?: "Couldn't load messages."
                    )
                }
            }
        }
    }

    /** Sends [body] then reloads the thread so the new message appears in order. */
    fun send(body: String) {
        val text = body.trim()
        if (text.isEmpty() || _state.value.isSending) return
        val bookingId = _state.value.bookingId ?: return
        val token = token() ?: run {
            _state.value = _state.value.copy(error = "Please sign in.")
            return
        }
        _state.value = _state.value.copy(isSending = true, error = null)
        viewModelScope.launch {
            try {
                BookingService.sendMessage(token, bookingId, text)
                val list = BookingService.fetchMessages(token, bookingId)
                if (_state.value.bookingId != bookingId) return@launch
                _state.value = _state.value.copy(isSending = false, messages = list)
            } catch (e: Exception) {
                if (_state.value.bookingId != bookingId) return@launch
                _state.value = _state.value.copy(
                    isSending = false,
                    error = e.message ?: "Couldn't send the message."
                )
            }
        }
    }

    /** Dismisses a transient error banner (e.g. a failed send) without retrying. */
    fun clearError() {
        if (_state.value.error != null) {
            _state.value = _state.value.copy(error = null)
        }
    }
}
