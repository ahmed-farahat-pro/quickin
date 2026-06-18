package com.quickin.app

import android.content.Context
import android.content.Intent
import com.google.android.gms.auth.api.signin.GoogleSignIn as GmsGoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException

/**
 * Legacy Google Sign-In via play-services-auth.
 *
 * Works on all devices and all OAuth consent-screen modes (Testing / Published)
 * without requiring the account to be whitelisted as a test user.
 *
 * Usage:
 *  1. Call [signInIntent] to get an Intent.
 *  2. Launch it with ActivityResultContracts.StartActivityForResult.
 *  3. Pass the result data to [idTokenFromResult].
 */
object GoogleSignIn {
    val isConfigured: Boolean get() = Config.GOOGLE_CLIENT_ID.isNotBlank()

    /** Kept for API compatibility with AuthScreen; not used by the legacy sign-in flow. */
    fun newNonce(): String = java.util.UUID.randomUUID().toString().replace("-", "")

    /** Returns the Intent to launch, or null if not configured. */
    fun signInIntent(context: Context): Intent? {
        if (!isConfigured) return null
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(Config.GOOGLE_CLIENT_ID)
            .requestEmail()
            .build()
        return GmsGoogleSignIn.getClient(context, gso).signInIntent
    }

    /**
     * Extracts the Google ID token from an Activity result Intent.
     * Returns (token, null) on success, (null, errorMessage) on failure.
     * Uses getResult(ApiException) so failures surface a real status code instead of
     * silently returning null (the old isSuccessful pattern swallowed every error).
     */
    fun idTokenFromResult(data: Intent?): Pair<String?, String?> {
        return try {
            val task = GmsGoogleSignIn.getSignedInAccountFromIntent(data)
            val account = task.getResult(ApiException::class.java)
            Pair(account?.idToken, null)
        } catch (e: ApiException) {
            Pair(null, "Google sign-in failed (code ${e.statusCode})")
        } catch (e: Exception) {
            Pair(null, e.message ?: "Google sign-in failed")
        }
    }

    /** Signs the current account out so the picker always shows next time. */
    fun signOut(context: Context) {
        if (!isConfigured) return
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(Config.GOOGLE_CLIENT_ID)
            .requestEmail()
            .build()
        GmsGoogleSignIn.getClient(context, gso).signOut()
    }
}
