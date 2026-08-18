package com.quickin.app

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

data class AuthUiState(
    val isAuthenticated: Boolean = false,
    val isLoading: Boolean = false,
    val error: String? = null,
    /**
     * Id of the signed-in user. Surfaced so the UI can key per-account state (e.g. reload the
     * profile when the id changes after switching accounts) and never show a previous account's data.
     */
    val userId: String? = null,
    val userName: String? = null,
    val email: String? = null,
    val provider: String? = null,
    val role: String? = null,
    /**
     * Whether the signed-in account has become a host. One account per person: a host keeps every
     * guest ability and reaches host features (manage listings + reservations) from their profile.
     * ONLY the server decides this — [AuthViewModel.refreshSession] re-reads it on every launch and
     * the host surfaces gate on it alone (never on a local flag).
     */
    val isHost: Boolean = false,
    /**
     * The account's host-application state: "none" | "pending" | "rejected" | "approved"
     * (see the HOST_STATUS_* constants). Drives which of the four states the profile's host card
     * renders; "approved" always implies [isHost].
     */
    val hostStatus: String = HOST_STATUS_NONE,
    /** The applicant's host type ("individual" | "company" | "brokerage"), or null when unset. */
    val hostType: String? = null,
    /** The admin's reason when [hostStatus] is "rejected"; null otherwise. */
    val hostReviewNote: String? = null,
    /**
     * Set to the email awaiting OTP verification after a sign-up (or an unverified
     * login). Non-null drives the OTP screen; cleared once verified or cancelled.
     */
    val pendingEmail: String? = null,
    /** Seconds left before "Resend code" is allowed again (mirrors the server cooldown). */
    val otpResendCooldown: Int = 0
)

/**
 * State for the standalone "Forgot password" flow (a full-screen route reached from the
 * sign-in form). [step] advances from entering an email to entering the emailed code + a new
 * password. [isLoading]/[error] are local to this flow so they don't collide with the main
 * auth form's spinner/error. On success the session is persisted via the shared auth state.
 */
data class ForgotPasswordUiState(
    val step: Step = Step.EnterEmail,
    val email: String = "",
    val isLoading: Boolean = false,
    val error: String? = null
) {
    enum class Step { EnterEmail, EnterCode }
}

/**
 * State for the "Apply to host" form (`POST /api/local/host/apply`). Kept separate from the main
 * auth spinner/error so the form's own submission doesn't fight other loads. [submitted] flips
 * true once the application is on file — the caller closes the form and the profile card switches
 * to the read-only "under review" state.
 */
data class HostApplyUiState(
    val isSubmitting: Boolean = false,
    /** Inline error for the form (the server's message), or null. */
    val error: String? = null,
    val submitted: Boolean = false
)

/**
 * Holds auth state and persists the bearer token in SharedPreferences ("qk_auth" / "token")
 * so the user stays signed in across launches. `isAuthenticated` is true whenever a token exists.
 *
 * Registration is a two-step flow: [signup] emails a code and moves state to
 * `pendingEmail`, then [verifyOtp] exchanges the code for a session. An unverified
 * [login] is funnelled through the same OTP screen (a fresh code is sent first).
 */
class AuthViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    // Seeded from SharedPreferences so the first frame after a cold start isn't empty. The host
    // fields here are a CACHE ONLY — [refreshSession] immediately re-reads them from the server and
    // overwrites whatever is stored (including a cached `is_host = true` that is now false).
    private val _state = MutableStateFlow(
        AuthUiState(
            isAuthenticated = prefs.getString(KEY_TOKEN, null) != null,
            userId = prefs.getString(KEY_USER_ID, null),
            userName = prefs.getString(KEY_NAME, null),
            email = prefs.getString(KEY_EMAIL, null),
            provider = prefs.getString(KEY_PROVIDER, null),
            role = prefs.getString(KEY_ROLE, null),
            isHost = prefs.getBoolean(KEY_IS_HOST, false),
            // An app upgraded from a build that only cached `is_host` has no stored status yet —
            // treat an existing host as approved rather than flashing the "Become a host" pitch.
            hostStatus = prefs.getString(KEY_HOST_STATUS, null)
                ?: if (prefs.getBoolean(KEY_IS_HOST, false)) HOST_STATUS_APPROVED else HOST_STATUS_NONE,
            hostType = prefs.getString(KEY_HOST_TYPE, null),
            hostReviewNote = prefs.getString(KEY_HOST_REVIEW_NOTE, null)
        )
    )
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    private val _forgot = MutableStateFlow(ForgotPasswordUiState())
    /** Drives the standalone "Forgot password" route (email → code + new password). */
    val forgot: StateFlow<ForgotPasswordUiState> = _forgot.asStateFlow()

    /**
     * Set to the freshly-completed session right after an email/password-derived login (password,
     * OTP verify, or password reset) so the auth screen can offer "Enable biometric sign-in". Null
     * the rest of the time — and never set for a biometric restore (no point re-offering). Consumed
     * once the user enables or declines the offer (see [enableBiometric] / [declineBiometricOffer]).
     */
    private val _biometricEnrollOffer = MutableStateFlow<AuthResult?>(null)
    val biometricEnrollOffer: StateFlow<AuthResult?> = _biometricEnrollOffer.asStateFlow()

    /**
     * Email/password login. One account per person — there is no role selection; the backend
     * returns the account's `is_host` flag. Routes to the OTP screen if the account isn't verified
     * yet.
     */
    fun login(email: String, password: String) =
        runOutcome { AuthService.login(email.trim(), password) }

    /**
     * Registers a normal account and moves to OTP verification — there is no host registration; a
     * user can become a host in-app later.
     */
    fun signup(name: String, email: String, password: String) =
        runOutcome { AuthService.signup(name.trim(), email.trim(), password) }

    // ---- Authoritative host state (the source of truth on every launch) --------

    /**
     * Re-reads the signed-in account from `GET /api/auth/me` and lets the SERVER win.
     *
     * The SharedPreferences copy is only a cache for the first paint: whatever comes back here
     * replaces it — including flipping a cached `is_host = true` back to false when an approval
     * was never granted (or was revoked). That is the whole restart bug: without this, the host
     * surfaces survived a relaunch on nothing but a local flag.
     *
     * A 401 means the session is gone server-side, so the local one is cleared. A transport
     * failure (offline launch) keeps the cached state and is never surfaced as an error.
     */
    fun refreshSession() {
        val token = currentToken() ?: return
        viewModelScope.launch {
            try {
                persistUser(AuthService.fetchMe(token))
            } catch (e: AuthService.HttpError) {
                if (e.code == 401) logout()
            } catch (_: Exception) {
                // Offline / unreachable — keep the cached state for this launch.
            }
        }
    }

    // ---- Become a host (application → admin review) ----------------------------

    /**
     * Drives the "Apply to host" form: submitting spinner, inline error, and the one-shot
     * `submitted` flag the screen closes itself on.
     */
    private val _hostApply = MutableStateFlow(HostApplyUiState())
    val hostApply: StateFlow<HostApplyUiState> = _hostApply.asStateFlow()

    /**
     * Submits — or, after a rejection, re-submits — the account's host application via
     * `POST /api/local/host/apply`. Hosting is NEVER granted here: the application lands in the
     * admin queue as "pending" and only an approval flips `is_host`. On success the cached host
     * state moves to the returned status (clearing any previous rejection note) so the profile
     * card switches to "under review" without waiting for the next launch.
     *
     * The required fields are already gated by the form's submit button; the blank guard here is
     * belt-and-braces. A 409 ("already a host" / "already under review") means our cached state is
     * stale, so we re-read the truth from the server before surfacing the message.
     */
    fun submitHostApplication(
        fullName: String,
        nationalId: String,
        phone: String,
        address: String,
        company: String?,
        hostType: String,
        notes: String?
    ) {
        if (_hostApply.value.isSubmitting || !_state.value.isAuthenticated) return
        if (fullName.isBlank() || nationalId.isBlank() || phone.isBlank() || address.isBlank()) return
        val token = currentToken() ?: return
        _hostApply.value = HostApplyUiState(isSubmitting = true)
        viewModelScope.launch {
            try {
                val status = AuthService.applyToHost(
                    token = token,
                    fullName = fullName,
                    nationalId = nationalId,
                    phone = phone,
                    address = address,
                    company = company,
                    hostType = hostType,
                    notes = notes
                )
                prefs.edit()
                    .putString(KEY_HOST_STATUS, status)
                    .putString(KEY_HOST_TYPE, hostType)
                    .remove(KEY_HOST_REVIEW_NOTE)
                    .apply()
                _state.value = _state.value.copy(
                    hostStatus = status,
                    hostType = hostType,
                    hostReviewNote = null
                )
                _hostApply.value = HostApplyUiState(submitted = true)
            } catch (e: Exception) {
                if (e is AuthService.HttpError && e.code == 409) refreshSession()
                _hostApply.value = HostApplyUiState(
                    error = humanError(e, "Couldn't submit your application.")
                )
            }
        }
    }

    /** Resets the apply form (on close, or once the submitted application has been acknowledged). */
    fun resetHostApply() {
        _hostApply.value = HostApplyUiState()
    }

    // ---- Delete account (Google Play account-deletion requirement) ------------

    /**
     * Whether an account deletion is in flight (drives the confirm dialog's spinner / disables the
     * destructive button). Separate from the main auth spinner so it doesn't fight other loads.
     */
    private val _deletingAccount = MutableStateFlow(false)
    val deletingAccount: StateFlow<Boolean> = _deletingAccount.asStateFlow()

    /**
     * Permanently deletes the signed-in account and all of its data via `DELETE /api/local/account`
     * (Bearer token). On success the local session is cleared exactly as [logout] does (which the
     * UI reacts to by tearing down per-account state and returning to the auth screen), then
     * [onDeleted] runs so the caller can dismiss the settings screen. On failure the message is
     * surfaced in [AuthUiState.error]. No-op when signed out or already deleting.
     */
    fun deleteAccount(onDeleted: () -> Unit = {}) {
        if (_deletingAccount.value || !_state.value.isAuthenticated) return
        val token = currentToken() ?: return
        _deletingAccount.value = true
        viewModelScope.launch {
            try {
                AuthService.deleteAccount(token)
                // The account is gone server-side: drop the saved biometric session too so a
                // fingerprint can't restore the deleted account, then clear the local session.
                BiometricAuthManager.clear(getApplication())
                logout()
                onDeleted()
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = humanError(e, "Couldn't delete your account."))
            } finally {
                _deletingAccount.value = false
            }
        }
    }

    /** Verifies the 6-digit [code] for the pending email and completes login on success. */
    fun verifyOtp(code: String) {
        val email = _state.value.pendingEmail ?: return
        runAuth({ AuthService.verifyOtp(email, code.trim()) }, viaPassword = true)
    }

    /** Requests a fresh OTP for the pending email (no-op if nothing is pending). */
    fun resendOtp() {
        val email = _state.value.pendingEmail ?: return
        if (_state.value.isLoading || _state.value.otpResendCooldown > 0) return
        _state.value = _state.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            try {
                AuthService.resendOtp(email)
                _state.value = _state.value.copy(isLoading = false)
                startOtpCooldown()
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = humanError(e, "Couldn't resend the code.")
                )
            }
        }
    }

    /** 30-second countdown that disables "Resend code" (mirrors the server cooldown). */
    private fun startOtpCooldown() {
        viewModelScope.launch {
            for (s in 30 downTo 1) {
                _state.value = _state.value.copy(otpResendCooldown = s)
                delay(1000)
            }
            _state.value = _state.value.copy(otpResendCooldown = 0)
        }
    }

    /** Abandons the pending OTP step and returns the user to the sign-in form. */
    fun cancelVerification() {
        _state.value = _state.value.copy(pendingEmail = null, error = null, isLoading = false)
    }

    /** Exchanges a Google ID token for a session via the backend. */
    fun googleSignIn(idToken: String) =
        runAuth({ AuthService.googleSignIn(idToken) })

    // ---- Forgot password (standalone route) -----------------------------------

    /**
     * Step 1: emails a 6-digit reset code to [email] and, on success, advances the flow to the
     * code-entry step (remembering the email so step 2 can reuse it). Inline error on failure.
     */
    fun sendResetCode(email: String) {
        if (_forgot.value.isLoading) return
        val trimmed = email.trim()
        if (trimmed.isBlank()) {
            _forgot.value = _forgot.value.copy(error = "Enter your email address.")
            return
        }
        _forgot.value = _forgot.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            try {
                AuthService.forgotPassword(trimmed)
                _forgot.value = _forgot.value.copy(
                    isLoading = false,
                    error = null,
                    step = ForgotPasswordUiState.Step.EnterCode,
                    email = trimmed
                )
            } catch (e: Exception) {
                _forgot.value = _forgot.value.copy(
                    isLoading = false,
                    error = humanError(e, "Couldn't send the reset code.")
                )
            }
        }
    }

    /**
     * Step 2: submits the emailed [code] + [newPassword] for the remembered email. On success the
     * returned session is persisted (the user ends up signed in) and the flow is reset; the shared
     * `isAuthenticated` flip then dismisses the route. A 400 surfaces as an inline error.
     */
    fun resetPassword(code: String, newPassword: String) {
        if (_forgot.value.isLoading) return
        val email = _forgot.value.email
        _forgot.value = _forgot.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            try {
                val result = AuthService.resetPassword(email, code.trim(), newPassword)
                _forgot.value = ForgotPasswordUiState()
                persistSession(result, viaPassword = true)
            } catch (e: Exception) {
                _forgot.value = _forgot.value.copy(
                    isLoading = false,
                    error = humanError(e, "Couldn't reset your password.")
                )
            }
        }
    }

    /** Clears just the forgot-flow's inline error (e.g. when the user edits a field). */
    fun clearForgotError() {
        if (_forgot.value.error != null) {
            _forgot.value = _forgot.value.copy(error = null)
        }
    }

    /** Abandons the forgot-password flow and resets it to the initial (email) step. */
    fun cancelForgotPassword() {
        _forgot.value = ForgotPasswordUiState()
    }

    /** Surfaces a message in the auth UI without performing a network call. */
    fun showAuthMessage(message: String) {
        _state.value = _state.value.copy(error = message, isLoading = false)
    }

    /**
     * Reflects a profile edit in the cached, signed-in user immediately. Called from the
     * profile-save success path so the Profile tab (and any greeting) shows the new [name]
     * without waiting for the next sign-in. Updates BOTH the in-memory [AuthUiState] and the
     * persisted name in SharedPreferences ("qk_auth"/qk_user → name) so it survives relaunch.
     * A blank [name] is ignored (the backend keeps the prior name in that case).
     */
    fun applyProfileName(name: String) {
        val trimmed = name.trim()
        if (trimmed.isBlank() || !_state.value.isAuthenticated) return
        prefs.edit().putString(KEY_NAME, trimmed).apply()
        _state.value = _state.value.copy(userName = trimmed)
    }

    /**
     * Clears ALL cached per-user auth state — token, user id/name/email/provider/role — from both
     * SharedPreferences and the in-memory state, then flips to signed-out. The biometric session
     * (a separate encrypted store) is cleared too so a fingerprint can't restore the old account.
     * Callers also clear the other per-user view-models (wishlist, reviews, reservations, …) so
     * signing in with a DIFFERENT account never surfaces the previous account's data.
     */
    fun logout() {
        prefs.edit()
            .remove(KEY_TOKEN)
            .remove(KEY_USER_ID)
            .remove(KEY_NAME)
            .remove(KEY_EMAIL)
            .remove(KEY_PROVIDER)
            .remove(KEY_ROLE)
            .remove(KEY_IS_HOST)
            .remove(KEY_HOST_STATUS)
            .remove(KEY_HOST_TYPE)
            .remove(KEY_HOST_REVIEW_NOTE)
            .apply()
        // Keep the biometric session so the fingerprint button appears on the next login.
        // Drop any pending "enable biometric" offer too.
        _biometricEnrollOffer.value = null
        _hostApply.value = HostApplyUiState()
        _state.value = AuthUiState(isAuthenticated = false)
    }

    fun clearError() {
        if (_state.value.error != null) {
            _state.value = _state.value.copy(error = null)
        }
    }

    /** The persisted bearer token, or null when signed out. For Authorization headers. */
    fun currentToken(): String? = prefs.getString(KEY_TOKEN, null)

    /**
     * Runs a sign-up / login call that may end in either a session ([AuthOutcome.Success])
     * or a pending OTP step ([AuthOutcome.NeedsVerification]). For the unverified branch we
     * eagerly send a fresh code so the OTP screen opens with a code already on its way.
     */
    private fun runOutcome(call: suspend () -> AuthOutcome) {
        if (_state.value.isLoading) return
        _state.value = _state.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            try {
                when (val outcome = call()) {
                    // A direct login is email/password-derived → eligible for biometric enrollment.
                    is AuthOutcome.Success -> persistSession(outcome.result, viaPassword = true)
                    is AuthOutcome.NeedsVerification -> {
                        // Make sure a code is in the user's inbox before showing the screen.
                        runCatching { AuthService.resendOtp(outcome.email) }
                        _state.value = _state.value.copy(
                            isLoading = false,
                            error = null,
                            pendingEmail = outcome.email
                        )
                    }
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = humanError(e, "Something went wrong.")
                )
            }
        }
    }

    /**
     * Runs an auth call that always yields a session (OTP verify / Google). [viaPassword] marks
     * email/password-derived sessions (OTP verify) so [persistSession] can offer biometric
     * enrollment; Google sign-in passes false (the task offers biometrics for email/password).
     */
    private fun runAuth(call: suspend () -> AuthResult, viaPassword: Boolean = false) {
        if (_state.value.isLoading) return
        _state.value = _state.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            try {
                persistSession(call(), viaPassword = viaPassword)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = humanError(e, "Something went wrong.")
                )
            }
        }
    }

    /**
     * Persists token + profile and flips state to authenticated. When [viaPassword] is true (an
     * email/password-derived login: password, OTP verify, or reset) the completed session is also
     * published on [biometricEnrollOffer] so the auth screen can offer to enable biometric sign-in.
     */
    private fun persistSession(result: AuthResult, viaPassword: Boolean = false) {
        prefs.edit()
            .putString(KEY_TOKEN, result.token)
            .putString(KEY_USER_ID, result.userId)
            .putString(KEY_NAME, result.userName)
            .putString(KEY_EMAIL, result.email)
            .putString(KEY_PROVIDER, result.provider)
            .putString(KEY_ROLE, result.role)
            .putBoolean(KEY_IS_HOST, result.isHost)
            .putString(KEY_HOST_STATUS, hostStatusOf(result))
            .putString(KEY_HOST_TYPE, result.hostType)
            .putString(KEY_HOST_REVIEW_NOTE, result.hostReviewNote)
            .apply()
        _state.value = AuthUiState(
            isAuthenticated = true,
            isLoading = false,
            userId = result.userId.takeUnless { it.isBlank() },
            userName = result.userName,
            email = result.email,
            provider = result.provider,
            role = result.role,
            isHost = result.isHost,
            hostStatus = hostStatusOf(result),
            hostType = result.hostType,
            hostReviewNote = result.hostReviewNote,
            pendingEmail = null
        )
        // Offer biometric enrollment only for password-derived logins, and only when the device can
        // actually run a prompt — and not if this exact session is already the stored one.
        _biometricEnrollOffer.value =
            if (viaPassword &&
                BiometricAuthManager.canAuthenticate(getApplication()) &&
                !isSessionAlreadyEnrolled(result)
            ) result else null
    }

    /**
     * Applies the account state returned by `GET /api/auth/me` over the cached one, keeping the
     * current token (that response carries none) and leaving the OTP / biometric-offer state alone.
     * Everything else — including `is_host` — is replaced, never merged: the server always wins.
     */
    private fun persistUser(result: AuthResult) {
        prefs.edit()
            .putString(KEY_USER_ID, result.userId)
            .putString(KEY_NAME, result.userName)
            .putString(KEY_EMAIL, result.email)
            .putString(KEY_PROVIDER, result.provider)
            .putString(KEY_ROLE, result.role)
            .putBoolean(KEY_IS_HOST, result.isHost)
            .putString(KEY_HOST_STATUS, hostStatusOf(result))
            .putString(KEY_HOST_TYPE, result.hostType)
            .putString(KEY_HOST_REVIEW_NOTE, result.hostReviewNote)
            .apply()
        _state.value = _state.value.copy(
            userId = result.userId.takeUnless { it.isBlank() },
            userName = result.userName,
            email = result.email,
            provider = result.provider,
            role = result.role,
            isHost = result.isHost,
            hostStatus = hostStatusOf(result),
            hostType = result.hostType,
            hostReviewNote = result.hostReviewNote
        )
    }

    /**
     * The host state to cache for [result]: `is_host = true` ALWAYS means "approved", so a host
     * with no application row at all (or a biometric session restored without the derived field)
     * can never fall back to the "Become a host" CTA.
     */
    private fun hostStatusOf(result: AuthResult): String =
        if (result.isHost) HOST_STATUS_APPROVED else result.hostStatus

    /** True when [result] is already the session stored for biometric login (avoid re-offering). */
    private fun isSessionAlreadyEnrolled(result: AuthResult): Boolean {
        val stored = BiometricAuthManager.readSession(getApplication()) ?: return false
        return stored.token == result.token
    }

    /**
     * Stores the just-completed session in the encrypted biometric store and clears the pending
     * offer. Called when the user taps "Enable biometric sign-in" after a password login.
     */
    fun enableBiometric() {
        val result = _biometricEnrollOffer.value ?: return
        BiometricAuthManager.enable(getApplication(), result)
        _biometricEnrollOffer.value = null
    }

    /** Dismisses the biometric-enrollment offer without storing anything ("Not now"). */
    fun declineBiometricOffer() {
        _biometricEnrollOffer.value = null
    }

    /**
     * Restores a session from a previously-stored biometric login (token + user JSON kept in
     * EncryptedSharedPreferences). Persists it into the normal "qk_auth" store and flips to
     * authenticated — exactly as a fresh login would — so the rest of the app (token reads,
     * per-account loads) behaves identically. Surfaces an error in the auth UI if no session
     * is stored (e.g. it was cleared on a prior logout).
     */
    fun loginWithBiometricSession() {
        val saved = BiometricAuthManager.readSession(getApplication()) ?: run {
            _state.value = _state.value.copy(
                isLoading = false,
                error = "No saved sign-in found. Use your password."
            )
            return
        }
        persistSession(saved)
    }

    companion object {
        const val PREFS_NAME = "qk_auth"
        const val KEY_TOKEN = "token"
        const val KEY_USER_ID = "user_id"
        const val KEY_NAME = "name"
        const val KEY_EMAIL = "email"
        const val KEY_PROVIDER = "provider"
        const val KEY_ROLE = "role"
        const val KEY_IS_HOST = "is_host"
        const val KEY_HOST_STATUS = "host_status"
        const val KEY_HOST_TYPE = "host_type"
        const val KEY_HOST_REVIEW_NOTE = "host_review_note"
    }
}
