package com.quickin.app

import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import java.security.SecureRandom

/**
 * Real, config-gated Google sign-in launcher.
 *
 * When [Config.GOOGLE_CLIENT_ID] is set, this opens Google's OAuth 2.0 consent
 * screen in a Chrome Custom Tab. Google redirects back to the app via the custom
 * scheme `com.quickin.app:/oauth2redirect` (registered as an intent-filter on
 * [MainActivity]); the resulting `id_token` is then posted to the backend
 * (`/api/auth/google`) by the caller.
 *
 * We use the OAuth *implicit* flow (`response_type=id_token`) so the app receives
 * the id_token directly in the redirect fragment without needing a client secret.
 */
object GoogleSignIn {

    /** Custom scheme registered in AndroidManifest for the OAuth redirect. */
    const val REDIRECT_URI = "com.quickin.app:/oauth2redirect"

    /** True when a Google client id has been configured in Config.kt. */
    val isConfigured: Boolean get() = Config.GOOGLE_CLIENT_ID.isNotBlank()

    /** A short random value to guard against replay; echoed back in the redirect. */
    fun newNonce(): String {
        val bytes = ByteArray(16)
        SecureRandom().nextBytes(bytes)
        return bytes.joinToString("") { "%02x".format(it) }
    }

    /**
     * Opens the Google OAuth consent screen in a Custom Tab.
     * Caller must verify [isConfigured] first.
     */
    fun launch(context: Context, nonce: String, state: String) {
        val authUri = Uri.parse("https://accounts.google.com/o/oauth2/v2/auth").buildUpon()
            .appendQueryParameter("client_id", Config.GOOGLE_CLIENT_ID)
            .appendQueryParameter("redirect_uri", REDIRECT_URI)
            .appendQueryParameter("response_type", "id_token")
            .appendQueryParameter("scope", "openid email profile")
            .appendQueryParameter("nonce", nonce)
            .appendQueryParameter("state", state)
            .appendQueryParameter("prompt", "select_account")
            .build()

        CustomTabsIntent.Builder()
            .setShowTitle(true)
            .build()
            .launchUrl(context, authUri)
    }

    /**
     * Extracts the `id_token` from an OAuth redirect Uri, if present.
     * Google returns it in the URL fragment (e.g. `...#id_token=...&state=...`).
     */
    fun parseIdToken(uri: Uri): String? {
        val fragment = uri.fragment ?: return null
        return fragment.split("&")
            .firstOrNull { it.startsWith("id_token=") }
            ?.substringAfter("id_token=")
            ?.let { Uri.decode(it) }
            ?.takeIf { it.isNotBlank() }
    }
}
