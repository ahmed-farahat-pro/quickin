package com.quickin.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * A moderator issued a policy warning about sharing contact details, and the API
 * is refusing this user's messages until they confirm they have read it.
 *
 * Thrown by the chat services when a send answers **HTTP 409** with a
 * `{ error, policyWarning: { id, message } }` body. The screen swaps its composer
 * for [PolicyWarningBanner] and keeps the typed draft — acknowledging reopens the
 * composer with the text still in it.
 *
 * Nothing else notifies the user (no email, no push, by design), so this is the
 * delivery mechanism as well as the gate.
 */
class PolicyWarningRequired(val warningId: String, message: String) : RuntimeException(message)

object PolicyWarningApi {
    /** HTTP status the API uses for the gate. 409, not 403 — 403 already means
     *  "blocked account" on these routes and the apps route that elsewhere. */
    const val GATE_STATUS = 409

    /**
     * Pulls `policyWarning` out of an error body, or null for any other shape so
     * the caller can fall through to its normal error handling.
     */
    fun parse(text: String): Pair<String, String>? = runCatching {
        val w = JSONObject(text).optJSONObject("policyWarning") ?: return null
        val id = w.optString("id")
        val message = w.optString("message")
        if (id.isEmpty() || message.isEmpty()) null else id to message
    }.getOrNull()

    /**
     * Confirm the warning was read (`POST /api/local/policy-warning { id }`).
     * Throws on a non-2xx so the caller keeps the banner up rather than dropping
     * the gate locally and bouncing the next message off the same 409.
     */
    suspend fun acknowledge(token: String, id: String): Unit = withContext(Dispatchers.IO) {
        val conn = (URL("${Config.API_BASE_URL}/api/local/policy-warning").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 15_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $token")
        }
        try {
            val payload = JSONObject().apply { put("id", id) }
            conn.outputStream.use { out -> out.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            if (code !in 200..299) throw RuntimeException("Couldn't save that. Please try again.")
        } finally {
            conn.disconnect()
        }
    }
}
