package com.quickin.app

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AuthUiState(
    val isAuthenticated: Boolean = false,
    val isLoading: Boolean = false,
    val error: String? = null,
    val userName: String? = null,
    val email: String? = null,
    val provider: String? = null
)

/**
 * Holds auth state and persists the bearer token in SharedPreferences ("qk_auth" / "token")
 * so the user stays signed in across launches. `isAuthenticated` is true whenever a token exists.
 */
class AuthViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val _state = MutableStateFlow(
        AuthUiState(
            isAuthenticated = prefs.getString(KEY_TOKEN, null) != null,
            userName = prefs.getString(KEY_NAME, null),
            email = prefs.getString(KEY_EMAIL, null),
            provider = prefs.getString(KEY_PROVIDER, null)
        )
    )
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    fun login(email: String, password: String) =
        run { AuthService.login(email.trim(), password) }

    fun signup(name: String, email: String, password: String) =
        run { AuthService.signup(name.trim(), email.trim(), password) }

    /** Exchanges a Google ID token for a session via the backend. */
    fun googleSignIn(idToken: String) =
        run { AuthService.googleSignIn(idToken) }

    /** Surfaces a message in the auth UI without performing a network call. */
    fun showAuthMessage(message: String) {
        _state.value = _state.value.copy(error = message, isLoading = false)
    }

    fun logout() {
        prefs.edit()
            .remove(KEY_TOKEN)
            .remove(KEY_NAME)
            .remove(KEY_EMAIL)
            .remove(KEY_PROVIDER)
            .apply()
        _state.value = AuthUiState(isAuthenticated = false)
    }

    fun clearError() {
        if (_state.value.error != null) {
            _state.value = _state.value.copy(error = null)
        }
    }

    /** The persisted bearer token, or null when signed out. For Authorization headers. */
    fun currentToken(): String? = prefs.getString(KEY_TOKEN, null)

    /** Runs an auth call, persisting token + profile on success and surfacing errors in state. */
    private fun run(call: suspend () -> AuthResult) {
        if (_state.value.isLoading) return
        _state.value = _state.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            try {
                val result = call()
                prefs.edit()
                    .putString(KEY_TOKEN, result.token)
                    .putString(KEY_NAME, result.userName)
                    .putString(KEY_EMAIL, result.email)
                    .putString(KEY_PROVIDER, result.provider)
                    .apply()
                _state.value = AuthUiState(
                    isAuthenticated = true,
                    isLoading = false,
                    userName = result.userName,
                    email = result.email,
                    provider = result.provider
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = e.message ?: "Something went wrong."
                )
            }
        }
    }

    companion object {
        const val PREFS_NAME = "qk_auth"
        const val KEY_TOKEN = "token"
        const val KEY_NAME = "name"
        const val KEY_EMAIL = "email"
        const val KEY_PROVIDER = "provider"
    }
}
