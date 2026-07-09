package com.quickin.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * One line in a pre-booking chat thread (guest ↔ host).
 * [mine] is true when the currently signed-in user sent it (drives bubble alignment/colour).
 */
data class ChatLine(
    val id: String,
    val body: String,
    val mine: Boolean
)

/**
 * Minimal HTTP client for the pre-booking chat API used from a listing's "Message host" flow.
 * No third-party HTTP/JSON libraries: HttpURLConnection + org.json, all on Dispatchers.IO. The
 * caller supplies the bearer token (read from SharedPreferences "qk_auth" / "token"). Mirrors the
 * request pattern in [BookingService].
 *
 *   POST {base}/api/local/chat  {listingId}                 -> { conversationId }
 *   GET  {base}/api/local/chat?conversationId=…             -> { messages:[{id,sender_id,body,created_at,mine}] }
 *   POST {base}/api/local/chat  {conversationId, body}      -> { message:{…} }
 */
object ChatThreadService {

    /** Thrown so callers can distinguish auth (401) from validation (400, e.g. blocked content). */
    class HttpError(val code: Int, message: String) : RuntimeException(message)

    /**
     * Opens (or reuses) the conversation between the signed-in guest and the listing's host
     * (`POST /api/local/chat {listingId}`). Returns the conversation id. Tolerant of a few response
     * shapes ({conversationId} | {conversation:{id}} | {id}). Throws [HttpError] on a non-2xx.
     */
    suspend fun openConversation(token: String, listingId: String): String = withContext(Dispatchers.IO) {
        val body = JSONObject().apply { put("listingId", listingId) }
        val text = send("POST", token, "/api/local/chat", body)
        val o = JSONObject(text)
        o.optString("conversationId")
            .ifBlank { o.optJSONObject("conversation")?.optString("id").orEmpty() }
            .ifBlank { o.optString("id") }
    }

    /**
     * Lists the messages in [conversationId] oldest-first
     * (`GET /api/local/chat?conversationId=…`). Throws [HttpError] on a non-2xx.
     */
    suspend fun listMessages(token: String, conversationId: String): List<ChatLine> = withContext(Dispatchers.IO) {
        val cid = URLEncoder.encode(conversationId, "UTF-8")
        val text = get(token, "/api/local/chat?conversationId=$cid")
        val arr = JSONObject(text).optJSONArray("messages") ?: JSONArray()
        val result = ArrayList<ChatLine>(arr.length())
        for (i in 0 until arr.length()) {
            result.add(parseLine(arr.getJSONObject(i)))
        }
        result
    }

    /**
     * Sends [body] to [conversationId] (`POST /api/local/chat {conversationId, body}`) and returns
     * the created line. Throws [HttpError] — notably 400 when the backend's content guard rejects a
     * shared phone number, so the screen can keep the typed text and explain why.
     */
    suspend fun sendMessage(token: String, conversationId: String, body: String): ChatLine = withContext(Dispatchers.IO) {
        val payload = JSONObject().apply {
            put("conversationId", conversationId)
            put("body", body)
        }
        val text = send("POST", token, "/api/local/chat", payload)
        val o = JSONObject(text)
        parseLine(o.optJSONObject("message") ?: o)
    }

    private fun parseLine(o: JSONObject): ChatLine = ChatLine(
        id = o.optString("id"),
        body = o.optString("body"),
        mine = o.optBoolean("mine", false)
    )

    /** Authenticated GET; returns the body text or throws [HttpError] on a non-2xx. */
    private fun get(token: String, path: String): String {
        val conn = (URL("${Config.API_BASE_URL}$path").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 15_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $token")
        }
        try {
            val code = conn.responseCode
            val text = readBody(conn, code)
            if (code !in 200..299) throw HttpError(code, extractError(text, code))
            return text
        } finally {
            conn.disconnect()
        }
    }

    /** Authenticated [method] (POST) with a JSON body; returns the body or throws [HttpError]. */
    private fun send(method: String, token: String, path: String, body: JSONObject): String {
        val conn = (URL("${Config.API_BASE_URL}$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = 15_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $token")
        }
        try {
            conn.outputStream.use { out -> out.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            val text = readBody(conn, code)
            if (code !in 200..299) throw HttpError(code, extractError(text, code))
            return text
        } finally {
            conn.disconnect()
        }
    }

    private fun readBody(conn: HttpURLConnection, code: Int): String {
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
        return stream?.bufferedReader()?.use { it.readText() }.orEmpty()
    }

    private fun extractError(text: String, code: Int): String {
        val parsed = runCatching { JSONObject(text).optString("error") }.getOrNull()
        return if (!parsed.isNullOrBlank()) parsed else "Request failed ($code)"
    }
}

/**
 * Place-suggestion typeahead for the Explore search (`GET /api/local/places?q=…` → { places:[…] }).
 * Public endpoint — no auth header. Best-effort: any failure yields an empty list so the search
 * field never breaks on a network hiccup.
 */
object PlacesService {
    suspend fun suggest(query: String): List<String> = withContext(Dispatchers.IO) {
        val q = URLEncoder.encode(query, "UTF-8")
        val conn = (URL("${Config.API_BASE_URL}/api/local/places?q=$q").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 15_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
        }
        try {
            val code = conn.responseCode
            if (code !in 200..299) return@withContext emptyList()
            val text = conn.inputStream?.bufferedReader()?.use { it.readText() }.orEmpty()
            val arr = JSONObject(text).optJSONArray("places") ?: JSONArray()
            val out = ArrayList<String>(arr.length())
            for (i in 0 until arr.length()) {
                val s = arr.optString(i)
                if (s.isNotBlank()) out.add(s)
            }
            out
        } catch (e: Exception) {
            emptyList()
        } finally {
            conn.disconnect()
        }
    }
}
