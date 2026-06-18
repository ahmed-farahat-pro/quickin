package com.quickin.app

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import java.security.SecureRandom

/**
 * Native Google Sign-In via Android Credential Manager.
 *
 * Shows the system Google account picker bottom sheet (no browser redirect).
 * Requires Config.GOOGLE_CLIENT_ID to be set to the web OAuth client ID.
 * The resulting id_token is posted to the backend (/api/auth/google) by the caller.
 */
object GoogleSignIn {

    /** True when a Google client ID has been configured in Config.kt. */
    val isConfigured: Boolean get() = Config.GOOGLE_CLIENT_ID.isNotBlank()

    /** A short random value to guard against replay. */
    fun newNonce(): String {
        val bytes = ByteArray(16)
        SecureRandom().nextBytes(bytes)
        return bytes.joinToString("") { "%02x".format(it) }
    }

    /**
     * Shows the native Google account picker via Credential Manager.
     *
     * Returns the Google ID token on success, null if the user cancelled.
     * Throws on any other error (no accounts, network, etc.).
     */
    suspend fun signIn(context: Context, nonce: String): String? {
        if (!isConfigured) return null

        val credentialManager = CredentialManager.create(context)

        val googleIdOption = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(Config.GOOGLE_CLIENT_ID)
            .setNonce(nonce)
            .build()

        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build()

        return try {
            val result = credentialManager.getCredential(context = context, request = request)
            GoogleIdTokenCredential.createFrom(result.credential.data).idToken
        } catch (e: GetCredentialCancellationException) {
            null
        }
    }
}
