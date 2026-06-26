package com.quickin.app

import android.content.Context
import android.content.SharedPreferences
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONObject

/**
 * Biometric (fingerprint / face) sign-in.
 *
 * Two responsibilities:
 *  1. Securely persist the signed-in session — the bearer token + the user JSON — in
 *     [EncryptedSharedPreferences] (backed by an AES key in the Android Keystore), so it can be
 *     restored later behind a biometric check without ever re-entering a password.
 *  2. Drive the system [BiometricPrompt] from a [FragmentActivity] (MainActivity extends
 *     AppCompatActivity, which is a FragmentActivity) and report success/failure to the caller.
 *
 * The encrypted store is SEPARATE from the plaintext "qk_auth" prefs the rest of the app reads:
 * enabling biometric copies the session in here; restoring copies it back out into "qk_auth"
 * (via [AuthViewModel.loginWithBiometricSession]); logout wipes it via [clear].
 */
object BiometricAuthManager {

    private const val SECURE_PREFS = "qk_biometric"
    private const val KEY_TOKEN = "qk_token"
    private const val KEY_USER = "qk_user"

    /** Biometric authenticators we accept: any enrolled fingerprint/face/iris (strong or weak). */
    private const val AUTHENTICATORS =
        BiometricManager.Authenticators.BIOMETRIC_STRONG or
            BiometricManager.Authenticators.BIOMETRIC_WEAK

    /**
     * True only when the device has hardware AND the user has enrolled a biometric, so we can
     * actually run a prompt. Anything else (no hardware, none enrolled, temporarily unavailable)
     * returns false, so the UI simply never offers the biometric affordance.
     */
    fun canAuthenticate(context: Context): Boolean =
        BiometricManager.from(context).canAuthenticate(AUTHENTICATORS) ==
            BiometricManager.BIOMETRIC_SUCCESS

    /** True when a biometric session has been stored (i.e. the user enabled it after a login). */
    fun hasStoredSession(context: Context): Boolean =
        runCatching {
            val prefs = securePrefs(context)
            !prefs.getString(KEY_TOKEN, null).isNullOrBlank() &&
                !prefs.getString(KEY_USER, null).isNullOrBlank()
        }.getOrDefault(false)

    /**
     * True when the device can run a biometric prompt AND we have a stored session to restore —
     * i.e. the only condition under which the auth screen should show the biometric button.
     */
    fun canOfferBiometricLogin(context: Context): Boolean =
        canAuthenticate(context) && hasStoredSession(context)

    /**
     * Persists [result] (token + the full user profile) into the encrypted store so a later
     * biometric check can restore it. Called from the "Enable biometric sign-in" path right after
     * a successful email/password login.
     */
    fun enable(context: Context, result: AuthResult) {
        val userJson = JSONObject().apply {
            put("id", result.userId)
            put("full_name", result.userName)
            put("email", result.email)
            put("provider", result.provider)
            put("role", result.role)
            put("is_host", result.isHost)
        }
        runCatching {
            securePrefs(context).edit()
                .putString(KEY_TOKEN, result.token)
                .putString(KEY_USER, userJson.toString())
                .apply()
        }
    }

    /**
     * Reads the stored session back into an [AuthResult], or null when none is stored / it can't be
     * decrypted. Used by [AuthViewModel.loginWithBiometricSession] after a successful prompt.
     */
    fun readSession(context: Context): AuthResult? = runCatching {
        val prefs = securePrefs(context)
        val token = prefs.getString(KEY_TOKEN, null)?.takeUnless { it.isBlank() } ?: return null
        val userRaw = prefs.getString(KEY_USER, null)?.takeUnless { it.isBlank() } ?: return null
        val user = JSONObject(userRaw)
        val email = user.optString("email")
        val name = user.optString("full_name").takeUnless { it.isBlank() }
            ?: email.takeUnless { it.isBlank() }
            ?: "Guest"
        AuthResult(
            token = token,
            userId = user.optString("id"),
            userName = name,
            email = email,
            provider = user.optString("provider").takeUnless { it.isBlank() } ?: "email",
            role = user.optString("role").takeUnless { it.isBlank() } ?: "guest",
            isHost = user.optBoolean("is_host", false)
        )
    }.getOrNull()

    /** Wipes the stored biometric session (called on logout). Safe to call when nothing is stored. */
    fun clear(context: Context) {
        runCatching { securePrefs(context).edit().clear().apply() }
    }

    /**
     * Shows the system biometric prompt. On a successful authentication [onSuccess] fires; on a
     * user cancel/negative-button [onCancel] fires (so the caller can fall back to the password
     * form); a hard error (lockout, etc.) routes to [onError] with a human-readable message.
     *
     * Must be called with a [FragmentActivity] host (MainActivity qualifies).
     */
    fun prompt(
        activity: FragmentActivity,
        title: String,
        subtitle: String,
        negativeButton: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit,
        onCancel: () -> Unit
    ) {
        val executor = ContextCompat.getMainExecutor(activity)
        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                onSuccess()
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                // Treat user-initiated dismissals as a cancel (fall back to password), and anything
                // else (lockout, no biometrics, hardware error) as a surfaced error.
                when (errorCode) {
                    BiometricPrompt.ERROR_USER_CANCELED,
                    BiometricPrompt.ERROR_NEGATIVE_BUTTON,
                    BiometricPrompt.ERROR_CANCELED -> onCancel()
                    else -> onError(errString.toString())
                }
            }

            // onAuthenticationFailed (a non-matching finger) is intentionally not terminal — the
            // system prompt lets the user retry; we only act on success/error/cancel above.
        }

        val prompt = BiometricPrompt(activity, executor, callback)
        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setNegativeButtonText(negativeButton)
            .setAllowedAuthenticators(AUTHENTICATORS)
            .setConfirmationRequired(false)
            .build()
        prompt.authenticate(info)
    }

    private fun securePrefs(context: Context): SharedPreferences {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            context,
            SECURE_PREFS,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }
}
