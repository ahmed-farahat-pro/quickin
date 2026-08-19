package com.quickin.app

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import com.quickin.app.ui.passwordMeetsMin

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
    val passwordChanged: Boolean = false,
    // ---- ID number (read-only here; changed only by request) ----
    /**
     * The ID number on file and the state of any request to change it. Null until the
     * separate id-change fetch lands — the profile is fully editable without it, so the
     * row falls back to showing the stored number with no request state.
     */
    val idChange: IdChangeState? = null,
    /** True while a request is being filed or withdrawn. */
    val isIdChangeBusy: Boolean = false,
    /** Inline error for the ID section only — carries the server's own validation wording. */
    val idChangeError: String? = null
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
                loadIdChange()
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    loaded = true,
                    error = humanError(e, "Couldn't load your profile.")
                )
            }
        }
    }

    /**
     * Saves the edited fields. [age] is parsed leniently (blank/invalid -> omitted). [avatarUrl] is
     * the (possibly newly-picked) avatar source — an `http(s)` URL or a `data:image/...` data URL,
     * or null to clear the photo.
     */
    fun save(fullName: String, age: String, phone: String, bio: String, avatarUrl: String?) {
        if (_state.value.isSaving) return
        val token = token() ?: run {
            _state.value = _state.value.copy(error = "Please sign in.")
            return
        }
        // The screen already gates on this and says it in the user's language; re-checking here
        // keeps the one rule in one place, so no caller can save a name the field refused. `12345`
        // used to reach the server, which is where it was — and still is — turned away.
        if (NameRules.problemWith(fullName) != null) {
            _state.value = _state.value.copy(
                error = "Please enter your name — a name contains letters, not only numbers."
            )
            return
        }
        _state.value = _state.value.copy(isSaving = true, error = null, saved = false)
        viewModelScope.launch {
            try {
                val updated = ProfileService.updateProfile(
                    token = token,
                    // Normalized the way the server normalizes it, so the name that is stored is
                    // the name that was judged.
                    fullName = NameRules.normalized(fullName),
                    age = age.trim().toIntOrNull()?.takeIf { it in 1..130 },
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
                    error = humanError(e, "Couldn't save your profile.")
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
     * locally against [passwordMeetsMin] — the same rules the checklist under the field draws and
     * the same ones the server enforces — before hitting the network. On success the `passwordChanged` flag is
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
        // The screen's button already gates on this; re-checking here keeps the one policy in
        // one place, so no caller can slip a password past the checklist the user was shown.
        if (!passwordMeetsMin(newPassword)) {
            _state.value = _state.value.copy(
                passwordError = "New password must meet all the requirements listed below."
            )
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
                    passwordError = humanError(e, "Couldn't change your password.")
                )
            }
        }
    }

    /**
     * Refreshes the ID row's request state. Failure is swallowed: the rest of the screen works
     * without it, and an error banner for a section the user may not even be looking at is worse
     * than the row simply showing the stored number.
     */
    fun loadIdChange() {
        val token = token() ?: return
        viewModelScope.launch {
            runCatching { ProfileService.fetchIdChangeState(token) }
                .onSuccess { _state.value = _state.value.copy(idChange = it) }
        }
    }

    /**
     * Files a request to change the ID number. [front] is a `data:image/...` data URL of the
     * document; the server refuses the request without one, because there would be nothing for
     * the reviewer to check the typed number against.
     *
     * The number itself is NOT validated here — those rules live in one shared core the mobile
     * API and the admin console both read, so a 400 carries that core's own wording straight to
     * [ProfileSettingsUiState.idChangeError].
     */
    fun requestIdChange(
        requestedValue: String,
        docType: String,
        front: String,
        back: String?,
        reason: String,
        onDone: () -> Unit = {}
    ) {
        if (_state.value.isIdChangeBusy) return
        val token = token() ?: run {
            _state.value = _state.value.copy(idChangeError = "Please sign in.")
            return
        }
        _state.value = _state.value.copy(isIdChangeBusy = true, idChangeError = null)
        viewModelScope.launch {
            try {
                val updated = ProfileService.requestIdChange(
                    token = token,
                    requestedValue = requestedValue,
                    docType = docType,
                    front = front,
                    back = back,
                    reason = reason
                )
                _state.value = _state.value.copy(
                    isIdChangeBusy = false,
                    idChange = updated,
                    idChangeError = null
                )
                onDone()
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isIdChangeBusy = false,
                    idChangeError = humanError(e, "Couldn't send your request.")
                )
            }
        }
    }

    /** Withdraws a request that is still awaiting review. */
    fun cancelIdChange() {
        if (_state.value.isIdChangeBusy) return
        val token = token() ?: return
        _state.value = _state.value.copy(isIdChangeBusy = true, idChangeError = null)
        viewModelScope.launch {
            try {
                val updated = ProfileService.cancelIdChange(token)
                _state.value = _state.value.copy(isIdChangeBusy = false, idChange = updated)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isIdChangeBusy = false,
                    idChangeError = humanError(e, "Couldn't withdraw your request.")
                )
            }
        }
    }

    /** Clears the ID section's inline error once it has been shown. */
    fun clearIdChangeError() {
        _state.value = _state.value.copy(idChangeError = null)
    }

    /** Clears the one-shot "password changed" flag once its confirmation has been shown. */
    fun acknowledgePasswordChanged() {
        _state.value = _state.value.copy(passwordChanged = false)
    }
}
