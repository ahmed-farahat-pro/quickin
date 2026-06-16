package com.quickin.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Minimal HTTP client for the local Next.js **notifications** API. Mirrors
 * [BookingService]: no third-party HTTP/JSON libraries (HttpURLConnection +
 * org.json on Dispatchers.IO), and the caller supplies the bearer token (read
 * from SharedPreferences "qk_auth" / "token") sent as `Authorization: Bearer <token>`.
 *
 *   GET   {base}/api/local/notifications          (auth) -> { notifications: Notif[], unreadCount }
 *   PATCH {base}/api/local/notifications/:id       (auth) -> { ok: true }   (mark one read)
 *   POST  {base}/api/local/notifications/read-all  (auth) -> { ok: true }   (mark all read)
 *
 * Notif = { id, type, title, body?, link?, read, created_at }
 */
object NotificationService {

    /** Thrown so callers can distinguish "sign in" (401) from other failures. */
    class HttpError(val code: Int, message: String) : RuntimeException(message)

    /**
     * Loads the signed-in user's notifications, newest-first, paired with the
     * server's unread count. Throws [HttpError] (401 when not signed in).
     */
    suspend fun fetchNotifications(token: String): Pair<List<AppNotification>, Int> =
        withContext(Dispatchers.IO) {
            val text = get(token, "/api/local/notifications")
            val root = JSONObject(text)
            val arr = root.optJSONArray("notifications") ?: JSONArray()
            val list = ArrayList<AppNotification>(arr.length())
            for (i in 0 until arr.length()) list.add(parseNotification(arr.getJSONObject(i)))
            val unread = root.optInt("unreadCount", list.count { !it.read })
            list to unread
        }

    /** Marks a single notification read (`PATCH /api/local/notifications/:id`). */
    suspend fun markRead(token: String, id: String) = withContext(Dispatchers.IO) {
        // Body is unused by the endpoint, but send an empty JSON object so the
        // Content-Type is honored consistently with the app's other writes.
        send("PATCH", token, "/api/local/notifications/$id", JSONObject())
        Unit
    }

    /** Marks every notification read (`POST /api/local/notifications/read-all`). */
    suspend fun markAllRead(token: String) = withContext(Dispatchers.IO) {
        send("POST", token, "/api/local/notifications/read-all", JSONObject())
        Unit
    }

    /**
     * Registers this device's push token with the backend so the user can receive push
     * notifications (`POST /api/local/notifications/device { device_token, platform }`).
     * Best-effort — callers wrap this in runCatching so a missing endpoint / offline device
     * never blocks sign-in. Returns Unit on success; throws [HttpError] on a non-2xx.
     */
    suspend fun registerDeviceToken(token: String, deviceToken: String) =
        withContext(Dispatchers.IO) {
            val body = JSONObject().apply {
                put("device_token", deviceToken)
                put("platform", "android")
            }
            send("POST", token, "/api/local/notifications/device", body)
            Unit
        }

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

    /** Authenticated [method] (POST/PATCH) with a JSON body; returns the body or throws [HttpError]. */
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

    private fun parseNotification(o: JSONObject): AppNotification = AppNotification(
        id = o.optString("id"),
        type = o.optString("type"),
        title = o.optString("title"),
        body = o.optString("body").ifBlank { null },
        link = o.optString("link").ifBlank { null },
        read = o.optBoolean("read", false),
        createdAt = o.optString("created_at")
    )
}
