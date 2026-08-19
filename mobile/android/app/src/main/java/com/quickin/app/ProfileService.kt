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
 * One request to change the ID number on the profile, as the server reports it back.
 * [notes] is the operator's note — on a rejection it is the reason to show the user.
 */
data class IdChangeRequest(
    val id: String = "",
    /** "pending" | "approved" | "rejected". */
    val status: String = "pending",
    val requestedValue: String = "",
    val docType: String = "national_id",
    val reason: String = "",
    val notes: String = ""
)

/**
 * The ID number on file plus whatever became of the latest request for it.
 * [canRequest] is false only while a request is waiting — the screen hides the action then.
 */
data class IdChangeState(
    val current: String = "",
    val request: IdChangeRequest? = null,
    val canRequest: Boolean = true
)

/**
 * The identity documents a change request may be filed against. Mirrors DOC_TYPES in the
 * backend's host-verification-core.ts, so a request and a verification always mean the same
 * thing by 'passport'. [labelRes] is resolved by the screen, not here.
 */
enum class IdDocumentType(val key: String, val labelRes: Int) {
    NATIONAL_ID("national_id", R.string.id_change_doc_national),
    PASSPORT("passport", R.string.id_change_doc_passport),
    RESIDENCE_PERMIT("residence_permit", R.string.id_change_doc_residence)
}

/**
 * Minimal HTTP client for the signed-in user's profile. Mirrors [BookingService] /
 * [ServiceService]: HttpURLConnection + org.json on Dispatchers.IO, bearer-token auth.
 *
 *   GET   {base}/api/local/profile  -> { full_name, email, age, id_document, phone, bio, avatar_url }
 *   PATCH {base}/api/local/profile  { full_name, age, phone, bio, avatar_url } -> updated profile
 *   GET/POST/DELETE {base}/api/local/profile/id-change -> the ID-number change request
 *
 * `id_document` is READ-ONLY: the PATCH above no longer sends it and the server refuses any
 * value that differs from what is stored. It used to be an ordinary editable field, which meant
 * any account could rewrite its own identity number with nobody reviewing it. Changing it now
 * means filing a request with a photo of the document, which an operator approves.
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
        phone: String,
        bio: String,
        avatarUrl: String?
    ): Profile = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("full_name", fullName.trim())
            if (age != null) put("age", age) else put("age", JSONObject.NULL)
            put("phone", phone.trim())
            put("bio", bio.trim())
            if (avatarUrl != null) put("avatar_url", avatarUrl) else put("avatar_url", JSONObject.NULL)
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

    // ---- ID change requests ---------------------------------------------------

    /** The current ID number and the state of any request to change it. */
    suspend fun fetchIdChangeState(token: String): IdChangeState = withContext(Dispatchers.IO) {
        parseIdChangeState(JSONObject(get(token, "/api/local/profile/id-change")))
    }

    /**
     * Asks for the ID number on the profile to be changed.
     *
     * [front] is required by the server — without a photo of the document the reviewer has
     * nothing to check the typed number against. [back] and [reason] are optional. Resubmitting
     * replaces a request that is still waiting rather than queueing a second one.
     *
     * Validation of the number itself is left to the server on purpose: the rules live in one
     * shared core that both the mobile API and the admin console read, and a copy here would be
     * a third place for them to drift. A 400 carries that core's own wording.
     */
    suspend fun requestIdChange(
        token: String,
        requestedValue: String,
        docType: String,
        front: String,
        back: String?,
        reason: String
    ): IdChangeState = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("requested_value", requestedValue.trim())
            put("doc_type", docType)
            put("front", front)
            if (!back.isNullOrBlank()) put("back", back)
            if (reason.isNotBlank()) put("reason", reason.trim())
        }
        parseIdChangeState(JSONObject(send("POST", token, "/api/local/profile/id-change", body)))
    }

    /** Withdraws a request that is still awaiting review. */
    suspend fun cancelIdChange(token: String): IdChangeState = withContext(Dispatchers.IO) {
        parseIdChangeState(JSONObject(sendNoBody("DELETE", token, "/api/local/profile/id-change")))
    }

    private fun parseIdChangeState(o: JSONObject): IdChangeState {
        val requestObj = o.optJSONObject("request")
        return IdChangeState(
            current = o.optStringOrNull("current").orEmpty(),
            request = requestObj?.let {
                IdChangeRequest(
                    id = it.optString("id"),
                    // An unknown status reads as pending: that state hides the action rather
                    // than offering a resubmit the server would refuse.
                    status = it.optStringOrNull("status") ?: "pending",
                    requestedValue = it.optStringOrNull("requested_value").orEmpty(),
                    docType = it.optStringOrNull("doc_type") ?: "national_id",
                    reason = it.optStringOrNull("reason").orEmpty(),
                    notes = it.optStringOrNull("notes").orEmpty()
                )
            },
            canRequest = if (o.has("can_request")) o.optBoolean("can_request", true) else true
        )
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

    /** Like [send] but with no request body — the DELETE that withdraws a request. */
    private fun sendNoBody(method: String, token: String, path: String): String {
        val conn = (URL("${Config.API_BASE_URL}$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method
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
        // optStringOrNull, not optString: an account with no ID on file has `id_document: null`,
        // and optString hands back the literal "null", which Edit Profile then printed as the
        // value instead of falling through to "Not on file".
        val idDoc = o.optStringOrNull("id_document")
            ?: o.optStringOrNull("id_passport")
            ?: o.optStringOrNull("passport")
            ?: ""
        val ageValue = if (o.has("age") && !o.isNull("age")) o.optInt("age").takeIf { it > 0 } else null
        val avatar = if (o.has("avatar_url") && !o.isNull("avatar_url")) {
            o.optStringOrNull("avatar_url")
        } else null
        return Profile(
            fullName = o.optString("full_name").ifBlank { o.optString("name") },
            email = o.optString("email"),
            age = ageValue,
            idDocument = idDoc,
            // optString returns the literal "null" for a JSON null, so guard with isNull
            // first — otherwise an unset phone/bio renders as the text "null".
            phone = if (o.isNull("phone")) "" else o.optString("phone"),
            bio = if (o.isNull("bio")) "" else o.optString("bio"),
            avatarUrl = avatar,
            verificationStatus = o.optString("verification_status").ifBlank { "unverified" }
        )
    }
}
