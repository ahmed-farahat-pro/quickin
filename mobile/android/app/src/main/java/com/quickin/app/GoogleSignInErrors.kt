package com.quickin.app

/**
 * Turns a Google Play services sign-in status code into copy a human can act on.
 *
 * Deliberately free of Android and Play-services imports so it runs in a plain JVM unit test
 * (`app/src/test`), the same way [humanNetworkError] in NetworkErrors.kt is testable.
 *
 * The one that matters: **10 / DEVELOPER_ERROR**. Play services authenticates the *calling app*
 * by (package name + signing certificate SHA-1) against an OAuth "Android" client registered in
 * the Google Cloud project that owns [Config.GOOGLE_CLIENT_ID]. If no client matches, sign-in
 * fails right after the account is chosen — which reads to a tester as "Google sign-in is
 * broken", with nothing in the UI pointing at the real cause. The message below names the cause
 * and carries the fingerprint of the running build, so a bug report contains the exact value
 * that has to be registered.
 */
object GoogleSignInErrors {
    // Mirrors com.google.android.gms.common.api.CommonStatusCodes /
    // GoogleSignInStatusCodes. Duplicated as plain ints so this file stays JVM-testable.
    const val SIGN_IN_REQUIRED = 4
    const val NETWORK_ERROR = 7
    const val INTERNAL_ERROR = 8
    const val DEVELOPER_ERROR = 10
    const val CANCELED = 16
    const val API_NOT_CONNECTED = 17
    const val SIGN_IN_FAILED = 12500
    const val SIGN_IN_CANCELLED = 12501
    const val SIGN_IN_CURRENTLY_IN_PROGRESS = 12502

    /**
     * @param statusCode the code carried by the ApiException.
     * @param signingSha1 this build's signing-certificate SHA-1 (colon-separated), when it could
     *        be read. Only used for [DEVELOPER_ERROR], where it is the missing piece of the puzzle.
     */
    fun message(statusCode: Int, signingSha1: String? = null): String = when (statusCode) {
        DEVELOPER_ERROR -> buildString {
            append("Google sign-in isn't set up for this build of the app. ")
            append("Its signing certificate isn't registered as an Android OAuth client ")
            append("for com.quickin.app")
            if (!signingSha1.isNullOrBlank()) append(" (SHA-1 $signingSha1)")
            append(". Please report this — it needs a fix in the Google Cloud console, ")
            append("not on your device.")
        }
        NETWORK_ERROR ->
            "Couldn't reach Google. Check your internet connection and try again."
        SIGN_IN_CURRENTLY_IN_PROGRESS ->
            "A Google sign-in is already in progress. Give it a moment and try again."
        SIGN_IN_REQUIRED, SIGN_IN_CANCELLED, CANCELED ->
            "Google sign-in was cancelled."
        API_NOT_CONNECTED ->
            "Google Play services isn't available on this device, so Google sign-in can't run. " +
                "Sign in with your email and password instead."
        INTERNAL_ERROR, SIGN_IN_FAILED ->
            "Google couldn't complete the sign-in. Please try again, or use your email and password."
        else ->
            "Google sign-in failed (code $statusCode). Please try again, or use your email and password."
    }

    /**
     * True when the failure is the user backing out rather than something going wrong.
     * The UI stays silent for these — an error banner for "I changed my mind" is noise.
     */
    fun isCancellation(statusCode: Int): Boolean =
        statusCode == SIGN_IN_CANCELLED || statusCode == CANCELED || statusCode == SIGN_IN_REQUIRED
}
