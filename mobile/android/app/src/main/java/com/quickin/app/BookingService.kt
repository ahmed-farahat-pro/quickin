package com.quickin.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Minimal HTTP client for the local Next.js bookings API.
 * No third-party HTTP/JSON libraries: HttpURLConnection + org.json, all on Dispatchers.IO.
 * The caller supplies the bearer token (read from SharedPreferences "qk_auth" / "token").
 *
 *   POST {base}/api/local/bookings  {listing_id, check_in, check_out, guests} -> 201 | {error}
 *   GET  {base}/api/local/bookings  -> [ {id, listing_id, check_in, check_out, guests,
 *                                         total_price, status, title, location, image} ]
 */
object BookingService {

    /** Thrown so callers can distinguish "sign in to reserve" (401) from validation (400). */
    class HttpError(val code: Int, message: String) : RuntimeException(message)

    /**
     * Reserves [listingId] for the given range. Dates must be yyyy-MM-dd.
     * Throws [HttpError] (401 not signed in, 400 e.g. "Those dates are not available").
     */
    suspend fun createBooking(
        token: String,
        listingId: String,
        checkIn: String,
        checkOut: String,
        guests: Int
    ): Booking = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("listing_id", listingId)
            put("check_in", checkIn)
            put("check_out", checkOut)
            put("guests", guests)
        }

        val conn = (URL("${Config.API_BASE_URL}/api/local/bookings").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 15_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $token")
        }

        try {
            conn.outputStream.use { out ->
                out.write(body.toString().toByteArray(Charsets.UTF_8))
            }
            val code = conn.responseCode
            val text = readBody(conn, code)
            if (code !in 200..299) {
                throw HttpError(code, extractError(text, code))
            }
            parseBooking(JSONObject(text))
        } finally {
            conn.disconnect()
        }
    }

    /** Lists the signed-in user's reservations. Throws [HttpError] (401 when not signed in). */
    suspend fun fetchBookings(token: String): List<Booking> = withContext(Dispatchers.IO) {
        val conn = (URL("${Config.API_BASE_URL}/api/local/bookings").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 15_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $token")
        }

        try {
            val code = conn.responseCode
            val text = readBody(conn, code)
            if (code !in 200..299) {
                throw HttpError(code, extractError(text, code))
            }
            parseBookings(text)
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

    private fun parseBookings(json: String): List<Booking> {
        val arr = JSONArray(json)
        val result = ArrayList<Booking>(arr.length())
        for (i in 0 until arr.length()) {
            result.add(parseBooking(arr.getJSONObject(i)))
        }
        return result
    }

    private fun parseBooking(o: JSONObject): Booking = Booking(
        id = o.optString("id"),
        listingId = o.optString("listing_id"),
        checkIn = o.optString("check_in"),
        checkOut = o.optString("check_out"),
        guests = o.optInt("guests", 1),
        totalPrice = o.optDouble("total_price", 0.0),
        status = o.optString("status").ifBlank { null },
        title = o.optString("title"),
        location = o.optString("location").ifBlank { null },
        image = o.optString("image").ifBlank { null }
    )
}
