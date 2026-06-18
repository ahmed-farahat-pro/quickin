package com.quickin.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * The editable profile fields shown on the profile-settings screen
 * (`GET /api/local/profile`). All optional — any may be blank/absent server-side.
 */
data class Profile(
    val fullName: String = "",
    val email: String = "",
    val age: Int? = null,
    val idDocument: String = "",
    val phone: String = "",
    /** Free-text "about me" blurb. Blank when unset server-side. */
    val bio: String = "",
    /** The country the user is from (English display name). Blank when unset server-side. */
    val country: String = "",
    /**
     * Avatar image source: an `http(s)` URL or an inline `data:image/...;base64,…` data URL
     * (Coil's [coil.compose.AsyncImage] decodes both). Null when the user has no photo.
     */
    val avatarUrl: String? = null,
    /**
     * Identity-verification state for this account (parsed from "verification_status";
     * defaults to "unverified"): "unverified" | "pending" | "verified" | "rejected". Drives the
     * "Verify your identity" card on the profile-settings screen.
     */
    val verificationStatus: String = "unverified"
)

/**
 * Minimal HTTP client for the signed-in user's profile. Mirrors [BookingService] /
 * [ServiceService]: HttpURLConnection + org.json on Dispatchers.IO, bearer-token auth.
 *
 *   GET   {base}/api/local/profile  -> { full_name, email, age, id_document, phone, bio, avatar_url }
 *   PATCH {base}/api/local/profile  { full_name, age, id_document, phone, bio, avatar_url } -> updated profile
 */
object ProfileService {

    /** Thrown so callers can distinguish "sign in" (401) from validation (400). */
    class HttpError(val code: Int, message: String) : RuntimeException(message)

    /** Loads the signed-in user's editable profile. Throws [HttpError] (401 when signed out). */
    suspend fun fetchProfile(token: String): Profile = withContext(Dispatchers.IO) {
        val text = get(token, "/api/local/profile")
        parseProfile(JSONObject(text))
    }

    /**
     * Saves the editable profile fields (`PATCH /api/local/profile`). [age] is sent as JSON null
     * when null. [avatarUrl] is sent as JSON null when null (clears the photo) — otherwise the
     * `http(s)` URL or `data:image/jpeg;base64,…` data URL the edit screen produced. Returns the
     * updated [Profile]. Throws [HttpError] (401 / 400 on validation).
     */
    suspend fun updateProfile(
        token: String,
        fullName: String,
        age: Int?,
        idDocument: String,
        phone: String,
        bio: String,
        avatarUrl: String?,
        country: String
    ): Profile = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("full_name", fullName.trim())
            if (age != null) put("age", age) else put("age", JSONObject.NULL)
            put("id_document", idDocument.trim())
            put("phone", phone.trim())
            put("bio", bio.trim())
            if (avatarUrl != null) put("avatar_url", avatarUrl) else put("avatar_url", JSONObject.NULL)
            put("country", country.trim())
        }
        val text = send("PATCH", token, "/api/local/profile", body)
        parseProfile(JSONObject(text))
    }

    /**
     * Changes the signed-in user's password (`POST /api/local/change-password`). Sends the
     * [currentPassword] (verified server-side) and the [newPassword]. Returns Unit on the 200
     * `{ok:true}`; throws [HttpError] on 400 (wrong current password / weak new password) or
     * 401 (signed out), carrying the server's `{error}` message.
     */
    suspend fun changePassword(
        token: String,
        currentPassword: String,
        newPassword: String
    ): Unit = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("current_password", currentPassword)
            put("new_password", newPassword)
        }
        send("POST", token, "/api/local/change-password", body)
    }

    // ---- HTTP helpers (mirror BookingService) ---------------------------------

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

    /**
     * Parses the profile object. Some responses nest the row under a `profile`/`user` key, so
     * unwrap that first. Accepts a couple of alternate field names for the ID document and age.
     */
    private fun parseProfile(raw: JSONObject): Profile {
        val o = raw.optJSONObject("profile") ?: raw.optJSONObject("user") ?: raw
        val idDoc = o.optString("id_document").ifBlank {
            o.optString("id_passport").ifBlank { o.optString("passport") }
        }
        val ageValue = if (o.has("age") && !o.isNull("age")) o.optInt("age").takeIf { it > 0 } else null
        val avatar = if (o.has("avatar_url") && !o.isNull("avatar_url")) {
            o.optString("avatar_url").takeIf { it.isNotBlank() }
        } else null
        return Profile(
            fullName = o.optString("full_name").ifBlank { o.optString("name") },
            email = o.optString("email"),
            age = ageValue,
            idDocument = idDoc,
            // optString returns the literal "null" for a JSON null, so guard with isNull
            // first — otherwise an unset phone/bio/country renders as the text "null".
            phone = if (o.isNull("phone")) "" else o.optString("phone"),
            bio = if (o.isNull("bio")) "" else o.optString("bio"),
            country = if (o.isNull("country")) "" else o.optString("country"),
            avatarUrl = avatar,
            verificationStatus = o.optString("verification_status").ifBlank { "unverified" }
        )
    }
}
