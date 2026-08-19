package com.quickin.app

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import com.google.android.gms.auth.api.signin.GoogleSignIn as GmsGoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import java.security.MessageDigest

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
 *
 * ## What has to be true off-device
 *
 * [Config.GOOGLE_CLIENT_ID] is the **web** client id — the audience the backend verifies. But
 * Play services also checks the *caller*: the app's package name plus the SHA-1 of the
 * certificate it was signed with must match an OAuth client of type **Android** in the same
 * Google Cloud project as that web client. Miss that and every attempt dies with
 * DEVELOPER_ERROR (10) the moment an account is picked — see [GoogleSignInErrors].
 *
 * That is why `app/debug.keystore` is committed: it pins one fingerprint across every machine
 * and every CI runner, so there is a single value to register. [signingSha1] reports whatever
 * the running build is actually signed with, which is the number to paste into the console.
 */
object GoogleSignIn {
    private const val TAG = "GoogleSignIn"

    val isConfigured: Boolean get() = Config.GOOGLE_CLIENT_ID.isNotBlank()

    /** Kept for API compatibility with AuthScreen; not used by the legacy sign-in flow. */
    fun newNonce(): String = java.util.UUID.randomUUID().toString().replace("-", "")

    private fun options(): GoogleSignInOptions =
        GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(Config.GOOGLE_CLIENT_ID)
            .requestEmail()
            .build()

    /** Returns the Intent to launch, or null if not configured. */
    fun signInIntent(context: Context): Intent? {
        if (!isConfigured) return null
        return GmsGoogleSignIn.getClient(context, options()).signInIntent
    }

    /**
     * Extracts the Google ID token from an Activity result Intent.
     * Returns (token, null) on success, (null, errorMessage) on failure, and (null, null) when
     * the user simply backed out — the caller stays quiet for that.
     *
     * Uses getResult(ApiException) so failures surface a real status code instead of silently
     * returning null (the old isSuccessful pattern swallowed every error), then translates the
     * code into something a tester can act on rather than a bare number.
     */
    fun idTokenFromResult(context: Context?, data: Intent?): Pair<String?, String?> {
        return try {
            val task = GmsGoogleSignIn.getSignedInAccountFromIntent(data)
            val account = task.getResult(ApiException::class.java)
            val token = account?.idToken
            if (token.isNullOrBlank()) {
                // Signed in, but Google returned no ID token — almost always a bad/absent
                // requestIdToken client id, which the backend could never verify anyway.
                Log.w(TAG, "Google returned an account with no ID token")
                Pair(null, GoogleSignInErrors.message(GoogleSignInErrors.DEVELOPER_ERROR, signingSha1(context)))
            } else {
                Pair(token, null)
            }
        } catch (e: ApiException) {
            val sha1 = signingSha1(context)
            Log.w(TAG, "Google sign-in failed: status=${e.statusCode} sha1=$sha1", e)
            if (GoogleSignInErrors.isCancellation(e.statusCode)) Pair(null, null)
            else Pair(null, GoogleSignInErrors.message(e.statusCode, sha1))
        } catch (e: Exception) {
            Pair(null, humanError(e, "Google sign-in failed"))
        }
    }

    /** Signs the current account out so the picker always shows next time. */
    fun signOut(context: Context) {
        if (!isConfigured) return
        GmsGoogleSignIn.getClient(context, options()).signOut()
    }

    /**
     * SHA-1 of the certificate this build was signed with, formatted the way the Google Cloud
     * console shows it (`AB:CD:…`). Null if it can't be read — never a reason to fail sign-in.
     */
    @Suppress("DEPRECATION")
    fun signingSha1(context: Context?): String? {
        val ctx = context ?: return null
        return try {
            val pm = ctx.packageManager
            val certs: Array<android.content.pm.Signature> =
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    val info = pm.getPackageInfo(ctx.packageName, PackageManager.GET_SIGNING_CERTIFICATES)
                    info.signingInfo?.apkContentsSigners ?: return null
                } else {
                    pm.getPackageInfo(ctx.packageName, PackageManager.GET_SIGNATURES).signatures ?: return null
                }
            val cert = certs.firstOrNull() ?: return null
            MessageDigest.getInstance("SHA-1")
                .digest(cert.toByteArray())
                .joinToString(":") { "%02X".format(it) }
        } catch (e: Exception) {
            Log.w(TAG, "Could not read the signing certificate", e)
            null
        }
    }
}
