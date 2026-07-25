package com.quickin.app

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** State for the profile-settings screen (`GET` / `PATCH /api/local/profile`). */
data class ProfileSettingsUiState(
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val loaded: Boolean = false,
    val profile: Profile = Profile(),
    val error: String? = null,
    /** Set to true after a successful save (drives a "Saved" confirmation). */
    val saved: Boolean = false,
    // ---- Change-password section (POST /api/local/change-password) ----
    /** True while a password change is in flight (its own spinner, separate from [isSaving]). */
    val isChangingPassword: Boolean = false,
    /** Inline error for the password section only (e.g. wrong current password). */
    val passwordError: String? = null,
    /** One-shot flag: true right after a successful password change (drives a "Saved" note). */
    val passwordChanged: Boolean = false
)

/**
 * Drives the profile-settings screen reached from the Profile tab. Loads the editable profile
 * and saves edits to full name / age / ID-passport / phone.
 *
 * Reads the bearer token directly from SharedPreferences ("qk_auth" / "token") — the same store
 * [AuthViewModel] / [HostViewModel] use — so it works without plumbing the token through composables.
 */
class ProfileSettingsViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences(
        AuthViewModel.PREFS_NAME, Context.MODE_PRIVATE
    )

    private val _state = MutableStateFlow(ProfileSettingsUiState())
    val state: StateFlow<ProfileSettingsUiState> = _state.asStateFlow()

    private fun token(): String? = prefs.getString(AuthViewModel.KEY_TOKEN, null)

    /** Loads the profile (idempotent — safe to call when the screen opens). */
    fun load() {
        val token = token() ?: run {
            _state.value = ProfileSettingsUiState(loaded = true, error = "Please sign in.")
            return
        }
        _state.value = _state.value.copy(isLoading = true, error = null, saved = false)
        viewModelScope.launch {
            try {
                val profile = ProfileService.fetchProfile(token)
                _state.value = _state.value.copy(
                    isLoading = false,
                    loaded = true,
                    profile = profile,
                    error = null
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    loaded = true,
                    error = e.message ?: "Couldn't load your profile."
                )
            }
        }
    }

    /**
     * Saves the edited fields. [age] is parsed leniently (blank/invalid -> omitted). [avatarUrl] is
     * the (possibly newly-picked) avatar source — an `http(s)` URL or a `data:image/...` data URL,
     * or null to clear the photo.
     */
    fun save(fullName: String, age: String, idDocument: String, phone: String, bio: String, avatarUrl: String?) {
        if (_state.value.isSaving) return
        val token = token() ?: run {
            _state.value = _state.value.copy(error = "Please sign in.")
            return
        }
        _state.value = _state.value.copy(isSaving = true, error = null, saved = false)
        viewModelScope.launch {
            try {
                val updated = ProfileService.updateProfile(
                    token = token,
                    fullName = fullName,
                    age = age.trim().toIntOrNull()?.takeIf { it in 1..130 },
                    idDocument = idDocument,
                    phone = phone,
                    bio = bio,
                    avatarUrl = avatarUrl
                )
                _state.value = _state.value.copy(
                    isSaving = false,
                    profile = updated,
                    saved = true,
                    error = null
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isSaving = false,
                    error = e.message ?: "Couldn't save your profile."
                )
            }
        }
    }

    /** Clears the one-shot "saved" flag once the confirmation has been shown. */
    fun acknowledgeSaved() {
        _state.value = _state.value.copy(saved = false)
    }

    /**
     * Wipes ALL cached profile state on logout so the next account that signs in never sees the
     * previous account's name / age / ID / phone. Mirrors the other view-models' [clear].
     */
    fun clear() {
        _state.value = ProfileSettingsUiState()
    }

    /**
     * Hard-resets and re-fetches the profile for a (possibly new) account. Called when the signed-in
     * user id changes: it drops the previous profile (so the edit screen can't briefly show stale
     * fields) and loads the current account's row fresh. No-op when signed out.
     */
    fun reloadForAccount() {
        if (token() == null) {
            _state.value = ProfileSettingsUiState()
            return
        }
        // Reset to a blank, not-yet-loaded state first so any open edit screen re-seeds its fields
        // from the new account's profile rather than the previous one's.
        _state.value = ProfileSettingsUiState()
        load()
    }

    /**
     * Changes the account password (`POST /api/local/change-password`). Validates the new password
     * length locally (min 6) before hitting the network. On success the `passwordChanged` flag is
     * set so the screen can confirm + clear its fields; a 400 (wrong current password) lands in
     * [ProfileSettingsUiState.passwordError].
     */
    fun changePassword(currentPassword: String, newPassword: String) {
        if (_state.value.isChangingPassword) return
        val token = token() ?: run {
            _state.value = _state.value.copy(passwordError = "Please sign in.")
            return
        }
        if (currentPassword.isBlank()) {
            _state.value = _state.value.copy(passwordError = "Enter your current password.")
            return
        }
        if (newPassword.length < 6) {
            _state.value = _state.value.copy(passwordError = "New password must be at least 6 characters.")
            return
        }
        _state.value = _state.value.copy(
            isChangingPassword = true,
            passwordError = null,
            passwordChanged = false
        )
        viewModelScope.launch {
            try {
                ProfileService.changePassword(token, currentPassword, newPassword)
                _state.value = _state.value.copy(
                    isChangingPassword = false,
                    passwordChanged = true,
                    passwordError = null
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isChangingPassword = false,
                    passwordError = e.message ?: "Couldn't change your password."
                )
            }
        }
    }

    /** Clears the one-shot "password changed" flag once its confirmation has been shown. */
    fun acknowledgePasswordChanged() {
        _state.value = _state.value.copy(passwordChanged = false)
    }
}
