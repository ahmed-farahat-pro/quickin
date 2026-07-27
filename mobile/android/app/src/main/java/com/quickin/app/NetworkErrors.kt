package com.quickin.app

import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLException

/**
 * Maps a raw network exception to a clear, actionable message for the UI.
 *
 * The most confusing real-world failures are: (1) **no connection** — DNS resolution fails and
 * Android throws `UnknownHostException` with a raw message like "Unable to resolve host … : No
 * address associated with hostname", which must never reach the user; and (2) a TLS "chain
 * validation" error caused by a **wrong device clock** (the device date is outside the server
 * certificate's validity window). We detect certificate/SSL problems anywhere in the cause chain
 * and tell the user to check their date & time. Offline, unreachable-server, and timeout each get
 * their own copy; any other transport (I/O) failure gets a generic connection message; anything
 * that isn't a network error falls back to the original message (or a generic one).
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
        is ConnectException ->
            "Couldn't reach the server. Check your internet connection and try again."
        is SocketTimeoutException ->
            "The connection timed out. Please check your connection and try again."
        is IOException ->
            "Network error. Check your internet connection and try again."
        else -> e.message ?: "Something went wrong."
    }
}

/**
 * User-facing message for any thrown error, without ever leaking a raw transport message like
 * "Unable to resolve host … : No address associated with hostname".
 *
 * Network/transport failures (offline, unreachable server, timeout, TLS) get the friendly,
 * actionable copy from [humanNetworkError]; every other error keeps its own message — e.g. a
 * server-provided validation message carried by an `HttpError` — falling back to [fallback] when
 * it has none. This is a drop-in replacement for the `e.message ?: "…"` idiom that changes
 * behaviour *only* for network errors.
 */
fun humanError(e: Throwable, fallback: String): String =
    if (isNetworkError(e)) humanNetworkError(e) else (e.message ?: fallback)

/** True when [e] — or anything in its cause chain — is an I/O / transport failure. */
private fun isNetworkError(e: Throwable): Boolean {
    var t: Throwable? = e
    while (t != null) {
        if (t is IOException) return true
        t = t.cause
    }
    return false
}
