package com.quickin.app

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import java.security.SecureRandom

object GoogleSignIn {
    val isConfigured: Boolean get() = Config.GOOGLE_CLIENT_ID.isNotBlank()

    fun newNonce(): String {
        val bytes = ByteArray(16)
        SecureRandom().nextBytes(bytes)
        return bytes.joinToString("") { "%02x".format(it) }
    }

    /**
     * Shows the native Google account picker via Credential Manager.
     *
     * First tries GetGoogleIdOption (fast bottom sheet for returning users).
     * Falls back to GetSignInWithGoogleOption (full chooser dialog) when no
     * cached credential is found — this always works, even for first-time users.
     *
     * Returns the Google ID token on success, null if the user cancelled.
     */
    suspend fun signIn(context: Context, nonce: String): String? {
        if (!isConfigured) return null
        val credentialManager = CredentialManager.create(context)

        // --- Fast path: bottom-sheet picker for accounts already on device ---
        try {
            val googleIdOption = GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(false)
                .setServerClientId(Config.GOOGLE_CLIENT_ID)
                .setNonce(nonce)
                .build()
            val result = credentialManager.getCredential(
                context = context,
                request = GetCredentialRequest.Builder().addCredentialOption(googleIdOption).build()
            )
            return GoogleIdTokenCredential.createFrom(result.credential.data).idToken
        } catch (_: GetCredentialCancellationException) {
            return null
        } catch (_: GetCredentialException) {
            // Fall through to the button flow below.
        }

        // --- Fallback: Sign in with Google button flow (always works) ---
        return try {
            val signInOption = GetSignInWithGoogleOption.Builder(Config.GOOGLE_CLIENT_ID)
                .setNonce(nonce)
                .build()
            val result = credentialManager.getCredential(
                context = context,
                request = GetCredentialRequest.Builder().addCredentialOption(signInOption).build()
            )
            GoogleIdTokenCredential.createFrom(result.credential.data).idToken
        } catch (_: GetCredentialCancellationException) {
            null
        }
    }
}
