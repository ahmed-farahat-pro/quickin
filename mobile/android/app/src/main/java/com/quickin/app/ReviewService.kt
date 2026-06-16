package com.quickin.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Minimal HTTP client for the local Next.js **reviews** API. Mirrors [BookingService]:
 * no third-party HTTP/JSON libraries (HttpURLConnection + org.json on Dispatchers.IO).
 *
 *   GET  {base}/api/local/reviews?listing_id=ID          (public) -> Review[]
 *   GET  {base}/api/local/reviews                         (auth)   -> ReviewableStay[]
 *   POST {base}/api/local/reviews { booking_id, rating, comment } (auth) -> 201
 */
object ReviewService {

    /** Thrown so callers can distinguish "sign in" (401) from validation (400). */
    class HttpError(val code: Int, message: String) : RuntimeException(message)

    /** Public list of a listing's guest reviews (newest-first). No auth required. */
    suspend fun fetchListingReviews(listingId: String): List<Review> = withContext(Dispatchers.IO) {
        val q = URLEncoder.encode(listingId, "UTF-8")
        val text = getPublic("/api/local/reviews?listing_id=$q")
        parseReviews(text)
    }

    /**
     * Stays the signed-in user can review (confirmed, past checkout, not yet reviewed).
     * Throws [HttpError] (401 when signed out).
     */
    suspend fun fetchReviewableStays(token: String): List<ReviewableStay> =
        withContext(Dispatchers.IO) {
            val text = get(token, "/api/local/reviews")
            parseReviewableStays(text)
        }

    /**
     * Submits a review for a completed [bookingId] (`POST /api/local/reviews`). [rating] is 1–5.
     * [photos] are `data:image/…` or `http(s)` URL strings (≤6 sent). Throws [HttpError]
     * (401 not signed in, 400 already reviewed / not eligible).
     */
    suspend fun submitReview(
        token: String,
        bookingId: String,
        rating: Int,
        comment: String?,
        photos: List<String> = emptyList()
    ): Unit = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("booking_id", bookingId)
            put("rating", rating.coerceIn(1, 5))
            if (!comment.isNullOrBlank()) put("comment", comment.trim())
            put("photos", JSONArray(photos.take(6)))
        }
        send("POST", token, "/api/local/reviews", body)
        Unit
    }

    // ---- Guest reviews (host → guest) -----------------------------------------

    /** Public list of reviews left about a guest (newest-first). No auth required. */
    suspend fun fetchGuestReviews(guestId: String): List<GuestReview> = withContext(Dispatchers.IO) {
        val q = URLEncoder.encode(guestId, "UTF-8")
        val text = getPublic("/api/local/guest-reviews?guest_id=$q")
        parseGuestReviews(text)
    }

    /**
     * Past guests the signed-in host can still review (completed stays, not yet reviewed).
     * Throws [HttpError] (401 when signed out / not a host).
     */
    suspend fun fetchReviewableGuests(token: String): List<ReviewableGuest> =
        withContext(Dispatchers.IO) {
            val text = get(token, "/api/local/guest-reviews")
            parseReviewableGuests(text)
        }

    /**
     * Submits a host's review of the guest on a completed [bookingId]
     * (`POST /api/local/guest-reviews`). [rating] is 1–5. Throws [HttpError] (401/400).
     */
    suspend fun submitGuestReview(
        token: String,
        bookingId: String,
        rating: Int,
        comment: String?
    ): Unit = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("booking_id", bookingId)
            put("rating", rating.coerceIn(1, 5))
            if (!comment.isNullOrBlank()) put("comment", comment.trim())
        }
        send("POST", token, "/api/local/guest-reviews", body)
        Unit
    }

    // ---- HTTP helpers (mirror BookingService) ---------------------------------

    private fun getPublic(path: String): String {
        val conn = (URL("${Config.API_BASE_URL}$path").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 15_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
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

    // ---- Parsing --------------------------------------------------------------

    private fun parseReviews(json: String): List<Review> {
        val arr = JSONArray(json)
        val out = ArrayList<Review>(arr.length())
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            out.add(
                Review(
                    rating = o.optInt("rating", 0),
                    comment = o.optString("comment").ifBlank { null },
                    reviewerName = o.optString("reviewer_name").ifBlank { null },
                    createdAt = o.optString("created_at").ifBlank { null },
                    photos = parseStringArray(o.opt("photos"))
                )
            )
        }
        return out
    }

    /** Coerces a "photos" value (JSON array, or null/absent) into a list of non-blank URL strings. */
    private fun parseStringArray(value: Any?): List<String> {
        val arr = value as? JSONArray ?: return emptyList()
        val out = ArrayList<String>(arr.length())
        for (i in 0 until arr.length()) {
            val s = arr.optString(i).trim()
            if (s.isNotEmpty()) out.add(s)
        }
        return out
    }

    private fun parseGuestReviews(json: String): List<GuestReview> {
        val arr = JSONArray(json)
        val out = ArrayList<GuestReview>(arr.length())
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            out.add(
                GuestReview(
                    id = o.optString("id"),
                    bookingId = o.optString("booking_id").ifBlank { null },
                    guestId = o.optString("guest_id").ifBlank { null },
                    hostId = o.optString("host_id").ifBlank { null },
                    rating = o.optInt("rating", 0),
                    comment = o.optString("comment").ifBlank { null },
                    createdAt = o.optString("created_at").ifBlank { null },
                    hostName = o.optString("host_name").ifBlank { null }
                )
            )
        }
        return out
    }

    private fun parseReviewableGuests(json: String): List<ReviewableGuest> {
        val arr = JSONArray(json)
        val out = ArrayList<ReviewableGuest>(arr.length())
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            val bookingId = o.optString("booking_id").ifBlank { o.optString("id") }
            if (bookingId.isBlank()) continue
            out.add(
                ReviewableGuest(
                    bookingId = bookingId,
                    listingId = o.optString("listing_id").ifBlank { null },
                    title = o.optString("title").ifBlank { "Your listing" },
                    guestName = o.optString("guest_name").ifBlank { null },
                    checkOut = o.optString("check_out").ifBlank { null }
                )
            )
        }
        return out
    }

    private fun parseReviewableStays(json: String): List<ReviewableStay> {
        val arr = JSONArray(json)
        val out = ArrayList<ReviewableStay>(arr.length())
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            // The id used to POST a review is the booking id; tolerate either key.
            val bookingId = o.optString("booking_id").ifBlank { o.optString("id") }
            if (bookingId.isBlank()) continue
            out.add(
                ReviewableStay(
                    bookingId = bookingId,
                    listingId = o.optString("listing_id").ifBlank { null },
                    title = o.optString("title").ifBlank { "Your stay" },
                    location = o.optString("location").ifBlank { null },
                    image = o.optString("image").ifBlank { null },
                    checkIn = o.optString("check_in").ifBlank { null },
                    checkOut = o.optString("check_out").ifBlank { null }
                )
            )
        }
        return out
    }
}
