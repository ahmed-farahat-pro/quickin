package com.quickin.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** Search filters for the listings endpoint. Blank/null fields are omitted from the query. */
data class ListingQuery(
    val location: String? = null,
    val guests: Int? = null,
    val checkIn: String? = null,  // yyyy-MM-dd
    val checkOut: String? = null  // yyyy-MM-dd
) {
    val isActive: Boolean
        get() = !location.isNullOrBlank() || (guests != null && guests > 0) ||
            !checkIn.isNullOrBlank() || !checkOut.isNullOrBlank()
}

/**
 * Minimal HTTP client for the local Next.js API — just enough to browse + search listings.
 * No third-party HTTP/JSON libraries: HttpURLConnection + org.json.
 */
object SupabaseService {

    suspend fun fetchListings(query: ListingQuery = ListingQuery()): List<Listing> = withContext(Dispatchers.IO) {
        val urlStr = "${Config.API_BASE_URL}/api/local/listings" + buildQueryString(query)

        val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 15_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
        }

        try {
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
            if (code !in 200..299) {
                throw RuntimeException("Server error $code: $body")
            }
            parseListings(body)
        } finally {
            conn.disconnect()
        }
    }

    private fun parseListings(json: String): List<Listing> {
        val arr = JSONArray(json)
        val result = ArrayList<Listing>(arr.length())
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            val imagesArr = o.optJSONArray("listing_images")
            val images = ArrayList<ListingImage>()
            if (imagesArr != null) {
                for (j in 0 until imagesArr.length()) {
                    val img = imagesArr.getJSONObject(j)
                    images.add(
                        ListingImage(
                            url = img.optString("url"),
                            order = img.optInt("order", 0)
                        )
                    )
                }
            }
            result.add(
                Listing(
                    id = o.optString("id"),
                    title = o.optString("title"),
                    description = o.optStringOrNull("description"),
                    location = o.optStringOrNull("location"),
                    pricePerNight = o.optDouble("price_per_night", 0.0),
                    currency = o.optStringOrNull("currency"),
                    bedrooms = o.optIntOrNull("bedrooms"),
                    beds = o.optIntOrNull("beds"),
                    bathrooms = o.optIntOrNull("bathrooms"),
                    maxGuests = o.optIntOrNull("max_guests"),
                    isGuestFavorite = o.optBoolean("is_guest_favorite", false),
                    listingCode = o.optStringOrNull("listing_code"),
                    lat = o.optDoubleOrNull("lat"),
                    lng = o.optDoubleOrNull("lng"),
                    images = images
                )
            )
        }
        return result
    }
}

/** Builds "?location=...&guests=...&checkIn=...&checkOut=..." from the active filters. */
private fun buildQueryString(query: ListingQuery): String {
    val params = ArrayList<String>(4)
    fun add(key: String, value: String?) {
        if (!value.isNullOrBlank()) {
            params.add("$key=${URLEncoder.encode(value, "UTF-8")}")
        }
    }
    add("location", query.location?.trim())
    if (query.guests != null && query.guests > 0) add("guests", query.guests.toString())
    add("checkIn", query.checkIn)
    add("checkOut", query.checkOut)
    return if (params.isEmpty()) "" else "?" + params.joinToString("&")
}

private fun org.json.JSONObject.optStringOrNull(key: String): String? =
    if (isNull(key)) null else optString(key).ifEmpty { null }

private fun org.json.JSONObject.optIntOrNull(key: String): Int? =
    if (isNull(key) || !has(key)) null else optInt(key)

private fun org.json.JSONObject.optDoubleOrNull(key: String): Double? =
    if (isNull(key) || !has(key)) null else optDouble(key).takeUnless { it.isNaN() }
