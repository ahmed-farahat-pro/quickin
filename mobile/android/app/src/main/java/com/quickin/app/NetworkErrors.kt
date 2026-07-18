package com.quickin.app

import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLException

/**
 * Maps a raw network exception to a clear, actionable message for the empty-state UI.
 *
 * The most confusing real-world failure is a TLS "chain validation" error caused by a **wrong
 * device clock**: when the device's date is outside the server certificate's validity window
 * (e.g. an emulator restored from an old snapshot, or a phone with the wrong date), Android
 * rejects the certificate and surfaces a meaningless raw message like "Chain validation failed".
 * We detect certificate/SSL problems anywhere in the cause chain and tell the user to check their
 * date & time. Offline and timeout get their own copy; anything else falls back to the original
 * message (or a generic one).
 *
 * NOTE: This only improves the *message* — it never weakens TLS validation. A wrong device clock
 * must be fixed on the device; bypassing certificate checks would make the app insecure.
 */
fun humanNetworkError(e: Throwable): String {
    var t: Throwable? = e
    while (t != null) {
        val msg = t.message?.lowercase().orEmpty()
        val looksLikeCert = t is SSLException ||
            t is java.security.cert.CertificateException ||
            t is java.security.cert.CertPathValidatorException ||
            "chain validation" in msg ||
            "trust anchor" in msg ||
            "not yet valid" in msg ||
            "certificate has expired" in msg ||
            ("certificate" in msg && "valid" in msg)
        if (looksLikeCert) {
            return "Couldn't establish a secure connection. Please check that your device's date & time are correct, then try again."
        }
        t = t.cause
    }
    return when (e) {
        is UnknownHostException ->
            "You appear to be offline. Check your internet connection and try again."
        is SocketTimeoutException ->
            "The connection timed out. Please try again."
        else -> e.message ?: "Something went wrong."
    }
}
