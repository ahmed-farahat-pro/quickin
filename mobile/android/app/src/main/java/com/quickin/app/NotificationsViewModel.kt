package com.quickin.app

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** State for the in-app notifications feed (`GET /api/local/notifications`). */
data class NotificationsUiState(
    val isLoading: Boolean = false,
    val notifications: List<AppNotification> = emptyList(),
    val unreadCount: Int = 0,
    val error: String? = null,
    val loaded: Boolean = false
)

/**
 * Owns the notifications feed + unread badge. Reads the bearer token straight from
 * SharedPreferences ("qk_auth" / "token") — the same store [AuthViewModel] /
 * [BookingsViewModel] use — so the bell badge and the feed work regardless of which
 * screen triggers a load.
 *
 *   [load]        — refresh the list + unread count (no-op, friendly state, when signed out)
 *   [markRead]    — mark one read, then reload (keeps the badge in sync)
 *   [markAllRead] — mark every notification read, then reload
 *   [clear]       — wipe state on logout so a new user doesn't see stale notifications
 */
class NotificationsViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences(
        AuthViewModel.PREFS_NAME, Context.MODE_PRIVATE
    )

    private val _state = MutableStateFlow(NotificationsUiState())
    val state: StateFlow<NotificationsUiState> = _state.asStateFlow()

    private fun token(): String? = prefs.getString(AuthViewModel.KEY_TOKEN, null)

    /** Loads the signed-in user's notifications. No-op (with a friendly state) when signed out. */
    fun load() {
        val token = token()
        if (token == null) {
            _state.value = NotificationsUiState(loaded = true)
            return
        }
        _state.value = _state.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            try {
                val (list, unread) = NotificationService.fetchNotifications(token)
                _state.value = NotificationsUiState(
                    isLoading = false,
                    notifications = list,
                    unreadCount = unread,
                    loaded = true,
                    error = null
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    loaded = true,
                    error = e.message ?: "Could not load notifications."
                )
            }
        }
    }

    /** Marks [id] read then reloads so the unread dot + badge update. */
    fun markRead(id: String) {
        val token = token() ?: return
        // Optimistically flip the row + badge so the dot disappears instantly.
        val current = _state.value
        val already = current.notifications.firstOrNull { it.id == id }?.read == true
        if (!already) {
            _state.value = current.copy(
                notifications = current.notifications.map {
                    if (it.id == id) it.copy(read = true) else it
                },
                unreadCount = (current.unreadCount - 1).coerceAtLeast(0)
            )
        }
        viewModelScope.launch {
            try {
                NotificationService.markRead(token, id)
            } catch (_: Exception) {
                // Swallow; the next load reconciles with the server.
            }
            load()
        }
    }

    /** Marks every notification read then reloads. */
    fun markAllRead() {
        val token = token() ?: return
        val current = _state.value
        if (current.unreadCount == 0 && current.notifications.all { it.read }) return
        // Optimistic flip of the whole list + badge.
        _state.value = current.copy(
            notifications = current.notifications.map { it.copy(read = true) },
            unreadCount = 0
        )
        viewModelScope.launch {
            try {
                NotificationService.markAllRead(token)
            } catch (_: Exception) {
                // Swallow; the next load reconciles with the server.
            }
            load()
        }
    }

    /**
     * Registers this device's push token with the backend after sign-in, so the user can receive
     * push notifications (`POST /api/local/notifications/device`). The live FCM token comes from
     * [PushTokenManager]; if it isn't ready yet we fall back to the most recent token cached by
     * [QuickInMessagingService.onNewToken] (it may have been minted while signed out). Entirely
     * best-effort: any failure is swallowed and never blocks the signed-in experience.
     */
    fun registerDeviceToken() {
        val token = token() ?: return
        viewModelScope.launch {
            // Prefer a fresh live token; fall back to the last token FCM handed us (cached at
            // onNewToken) so a not-yet-ready first fetch still registers something.
            val deviceToken = runCatching { PushTokenManager.currentToken() }.getOrNull()
                ?: prefs.getString(QuickInMessagingService.KEY_PENDING_PUSH_TOKEN, null)
            if (deviceToken.isNullOrBlank()) return@launch
            runCatching { NotificationService.registerDeviceToken(token, deviceToken) }
        }
    }

    /** Clears notification state on logout so a new user doesn't see stale data. */
    fun clear() {
        _state.value = NotificationsUiState()
    }
}
