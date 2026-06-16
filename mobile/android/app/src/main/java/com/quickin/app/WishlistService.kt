package com.quickin.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Minimal HTTP client for the local Next.js **wishlist** API. Mirrors [BookingService]:
 * no third-party HTTP/JSON libraries (HttpURLConnection + org.json on Dispatchers.IO),
 * and the caller supplies the bearer token (read from SharedPreferences "qk_auth" / "token").
 *
 *   GET  {base}/api/local/wishlist  (auth) -> { listings, services, listingIds, serviceIds }
 *   POST {base}/api/local/wishlist  (auth) { item_type:'listing'|'service', item_id, action? }
 *                                          -> { saved: Boolean }
 */
object WishlistService {

    /** Thrown so callers can distinguish "sign in to save" (401) from other failures. */
    class HttpError(val code: Int, message: String) : RuntimeException(message)

    /** Item kinds the wishlist accepts. [apiValue] is sent as `item_type`. */
    enum class ItemType(val apiValue: String) { LISTING("listing"), SERVICE("service") }

    /** Loads the signed-in user's saved listings + services. Throws [HttpError] (401 when signed out). */
    suspend fun fetchWishlist(token: String): WishlistData = withContext(Dispatchers.IO) {
        val text = get(token, "/api/local/wishlist")
        parseWishlist(text)
    }

    /**
     * Toggles (or sets) the saved state of an item. When [action] is null the backend flips the
     * current state; pass "save"/"unsave" to set it explicitly. Returns the resulting saved flag.
     * Throws [HttpError] (401 not signed in).
     */
    suspend fun toggle(
        token: String,
        type: ItemType,
        itemId: String,
        action: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("item_type", type.apiValue)
            put("item_id", itemId)
            if (!action.isNullOrBlank()) put("action", action)
        }
        val text = send("POST", token, "/api/local/wishlist", body)
        // The endpoint answers { saved: true|false }; default to true on a 2xx without the flag.
        runCatching { JSONObject(text).optBoolean("saved", true) }.getOrDefault(true)
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

    // ---- Parsing --------------------------------------------------------------

    private fun parseWishlist(text: String): WishlistData {
        val root = JSONObject(text)

        val listings = root.optJSONArray("listings")?.let { SupabaseService.parseListings(it.toString()) }
            ?: emptyList()
        val services = root.optJSONArray("services")?.let { parseServicesArray(it) } ?: emptyList()

        // Prefer the explicit id arrays; fall back to the ids on the embedded objects.
        val listingIds = root.optJSONArray("listingIds")?.toStringSet()
            ?: listings.mapNotNull { it.id.ifBlank { null } }.toSet()
        val serviceIds = root.optJSONArray("serviceIds")?.toStringSet()
            ?: services.mapNotNull { it.id.ifBlank { null } }.toSet()

        return WishlistData(
            listings = listings,
            services = services,
            listingIds = listingIds,
            serviceIds = serviceIds
        )
    }

    private fun parseServicesArray(arr: JSONArray): List<Service> {
        val out = ArrayList<Service>(arr.length())
        for (i in 0 until arr.length()) out.add(ServiceService.parseService(arr.getJSONObject(i)))
        return out
    }

    private fun JSONArray.toStringSet(): Set<String> {
        val out = HashSet<String>(length())
        for (i in 0 until length()) optString(i).takeUnless { it.isBlank() }?.let { out.add(it) }
        return out
    }
}
