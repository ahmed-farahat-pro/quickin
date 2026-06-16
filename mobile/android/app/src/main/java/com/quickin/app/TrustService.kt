package com.quickin.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * The signed-in user's identity-verification state (from `GET /api/local/verification`).
 * [status] is "unverified" | "pending" | "verified" | "rejected"; [verifiedAt] is the ISO-8601
 * timestamp the account was verified, or null when it never was.
 */
data class VerificationState(
    val status: String = "unverified",
    val verifiedAt: String? = null
)

/**
 * Minimal HTTP client for QuickIn's Trust & Safety endpoints. Mirrors [BookingService] /
 * [ProfileService]: HttpURLConnection + org.json on Dispatchers.IO, bearer-token auth, and an
 * [HttpError] so callers can distinguish 401 (sign in) from 400 (validation).
 *
 *   GET  {base}/api/local/verification        -> { status, verified_at }
 *   POST {base}/api/local/verification {doc}   -> { status: "pending", ... }   (submit ID image)
 *   GET  {base}/api/local/users/:id            -> public profile + trust badges (no auth, no PII)
 *   POST {base}/api/local/reports {...}         -> file a report on a listing/user/review
 */
object TrustService {

    /** Thrown so callers can distinguish "sign in" (401) from validation (400). */
    class HttpError(val code: Int, message: String) : RuntimeException(message)

    // ---- Identity verification (signed-in user) -------------------------------

    /** Loads the signed-in user's verification status. Throws [HttpError] (401 when signed out). */
    suspend fun fetchVerification(token: String): VerificationState = withContext(Dispatchers.IO) {
        val text = get(token, "/api/local/verification")
        parseVerification(JSONObject(text))
    }

    /**
     * Submits an ID image for verification (`POST /api/local/verification {doc}`). [doc] is a
     * `data:image/...;base64,…` data URL produced off the main thread via
     * [AvatarImage.loadDownscaledJpegDataUrl] (maxDim 1024). Returns the resulting state (status
     * flips to "pending"). Throws [HttpError] (401 not signed in, 400 on validation).
     */
    suspend fun submitVerification(token: String, doc: String): VerificationState =
        withContext(Dispatchers.IO) {
            val body = JSONObject().apply { put("doc", doc) }
            val text = send("POST", token, "/api/local/verification", body)
            parseVerification(JSONObject(text))
        }

    // ---- Public profile + trust badges (no auth, no PII) ----------------------

    /**
     * Fetches another user's public profile + computed trust badges
     * (`GET /api/local/users/:id`). Privacy-safe — carries no email/phone/id. Returns null on any
     * failure (or a blank id) so callers can simply fall back to the listing's own [Listing.hostVerified].
     */
    suspend fun fetchPublicProfile(userId: String): PublicProfile? = withContext(Dispatchers.IO) {
        if (userId.isBlank()) return@withContext null
        runCatching {
            val urlStr = "${Config.API_BASE_URL}/api/local/users/${URLEncoder.encode(userId, "UTF-8")}"
            val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 15_000
                readTimeout = 15_000
                setRequestProperty("Accept", "application/json")
            }
            try {
                val code = conn.responseCode
                if (code !in 200..299) return@runCatching null
                val text = conn.inputStream.bufferedReader().use { it.readText() }
                parsePublicProfile(JSONObject(text))
            } finally {
                conn.disconnect()
            }
        }.getOrNull()
    }

    /**
     * Fetches the reviews written about a host's listings (`GET /api/local/users/:id/reviews`).
     * Public — no auth, no PII (carries only the reviewer's display name + the listing title).
     * Returns an empty list on any failure (or a blank id) so the host profile can simply hide
     * the reviews section.
     */
    suspend fun fetchHostReviews(userId: String): List<HostReview> = withContext(Dispatchers.IO) {
        if (userId.isBlank()) return@withContext emptyList()
        runCatching {
            val urlStr = "${Config.API_BASE_URL}/api/local/users/${URLEncoder.encode(userId, "UTF-8")}/reviews"
            val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 15_000
                readTimeout = 15_000
                setRequestProperty("Accept", "application/json")
            }
            try {
                val code = conn.responseCode
                if (code !in 200..299) return@runCatching emptyList<HostReview>()
                val text = conn.inputStream.bufferedReader().use { it.readText() }
                parseHostReviews(text)
            } finally {
                conn.disconnect()
            }
        }.getOrElse { emptyList() }
    }

    // ---- Reporting (signed-in user) -------------------------------------------

    /**
     * Files a report (`POST /api/local/reports`). [targetType] is "listing" | "user" | "review";
     * [targetId] identifies the reported object; [reason] is the chosen reason code; [details] is
     * the optional free-text note (omitted when blank). Returns Unit on success. Throws [HttpError]
     * (401 not signed in, 400 on validation).
     */
    suspend fun submitReport(
        token: String,
        targetType: String,
        targetId: String,
        reason: String,
        details: String?
    ): Unit = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("target_type", targetType)
            put("target_id", targetId)
            put("reason", reason)
            if (!details.isNullOrBlank()) put("details", details.trim())
        }
        send("POST", token, "/api/local/reports", body)
    }

    // ---- Parsers --------------------------------------------------------------

    private fun parseVerification(raw: JSONObject): VerificationState {
        // Some envelopes nest the row under a key; unwrap defensively.
        val o = raw.optJSONObject("verification") ?: raw
        return VerificationState(
            status = o.optString("status").ifBlank { "unverified" },
            verifiedAt = o.optString("verified_at").ifBlank { null }
        )
    }

    private fun parseHostReviews(json: String): List<HostReview> {
        val arr = JSONArray(json)
        val out = ArrayList<HostReview>(arr.length())
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            out.add(
                HostReview(
                    id = o.optString("id"),
                    rating = o.optInt("rating", 0),
                    comment = o.optString("comment").ifBlank { null },
                    photos = parsePhotoArray(o.opt("photos")),
                    createdAt = o.optString("created_at").ifBlank { null },
                    reviewerName = o.optString("reviewer_name").ifBlank { null },
                    listingId = o.optString("listing_id").ifBlank { null },
                    listingTitle = o.optString("listing_title").ifBlank { null }
                )
            )
        }
        return out
    }

    /** Coerces a "photos" value (JSON array, or null/absent) into a list of non-blank URL strings. */
    private fun parsePhotoArray(value: Any?): List<String> {
        val arr = value as? JSONArray ?: return emptyList()
        val out = ArrayList<String>(arr.length())
        for (i in 0 until arr.length()) {
            val s = arr.optString(i).trim()
            if (s.isNotEmpty()) out.add(s)
        }
        return out
    }

    private fun parsePublicProfile(raw: JSONObject): PublicProfile {
        val o = raw.optJSONObject("user") ?: raw.optJSONObject("profile") ?: raw
        val badgesObj = o.optJSONObject("badges")
        val badges = if (badgesObj != null) {
            TrustBadges(
                verified = badgesObj.optBoolean("verified", false),
                superhost = badgesObj.optBoolean("superhost", false),
                newHost = badgesObj.optBoolean("newHost", false),
                isHost = badgesObj.optBoolean("isHost", false),
                completedStays = badgesObj.optInt("completedStays", 0),
                reviewCount = badgesObj.optInt("reviewCount", 0),
                hostRating = badgesObj.optDouble("hostRating", 0.0).takeUnless { it.isNaN() } ?: 0.0,
                memberSince = badgesObj.optString("memberSince").ifBlank { null }
            )
        } else {
            TrustBadges()
        }
        val avatar = if (o.has("avatar_url") && !o.isNull("avatar_url")) {
            o.optString("avatar_url").takeIf { it.isNotBlank() }
        } else null
        return PublicProfile(
            id = o.optString("id"),
            fullName = o.optString("full_name").ifBlank { null },
            avatarUrl = avatar,
            bio = o.optString("bio").ifBlank { null },
            verificationStatus = o.optString("verification_status").ifBlank { "unverified" },
            guestRating = o.optDouble("guest_rating", 0.0).takeUnless { it.isNaN() } ?: 0.0,
            guestReviewCount = o.optInt("guest_review_count", 0),
            badges = badges
        )
    }

    // ---- HTTP helpers (mirror BookingService / ProfileService) ----------------

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
}
