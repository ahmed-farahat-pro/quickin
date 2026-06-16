package com.quickin.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Minimal HTTP client for the local Next.js **services** API. Mirrors [BookingService]:
 * no third-party HTTP/JSON libraries (HttpURLConnection + org.json on Dispatchers.IO),
 * and the caller supplies the bearer token (read from SharedPreferences "qk_auth" / "token").
 *
 * "Services" = standalone experiences (jet ski, diving, yacht…). A host posts a service;
 * a user "subscribes" (a service-request) → pending → the host confirms / rejects.
 *
 *   GET   {base}/api/local/services                    -> Service[]      (public browse)
 *   GET   {base}/api/local/services/:id                -> Service
 *   POST  {base}/api/local/services            (host)  -> 201 Service
 *   POST  {base}/api/local/service-requests    (user)  -> 201            (subscribe)
 *   GET   {base}/api/local/service-requests    (user)  -> ServiceRequest[]   (my subs)
 *   PATCH {base}/api/local/service-requests/:id (host) -> ServiceRequest
 *   GET   {base}/api/local/host/services       (host)  -> Service[]
 *   GET   {base}/api/local/host/service-requests (host)-> ServiceRequest[]   (host inbox)
 */
object ServiceService {

    /** Thrown so callers can distinguish "sign in to subscribe" (401) from validation (400). */
    class HttpError(val code: Int, message: String) : RuntimeException(message)

    // ---- Browse (public) ------------------------------------------------------

    /** Lists all published services for the public browse feed (no auth required). */
    suspend fun fetchServices(): List<Service> = withContext(Dispatchers.IO) {
        val text = getPublic("/api/local/services")
        parseServices(text)
    }

    /** Fetches a single service by [serviceId] (`GET /api/local/services/:id`). */
    suspend fun fetchService(serviceId: String): Service = withContext(Dispatchers.IO) {
        val text = getPublic("/api/local/services/$serviceId")
        parseService(JSONObject(text))
    }

    // ---- Subscribe (user) -----------------------------------------------------

    /**
     * Subscribes the signed-in user to [serviceId] (`POST /api/local/service-requests`).
     * Returns the created [ServiceRequest] (201). Throws [HttpError] (401 not signed in,
     * 400 on validation).
     */
    suspend fun subscribe(
        token: String,
        serviceId: String,
        note: String? = null,
        preferredDate: String? = null
    ): ServiceRequest = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("service_id", serviceId)
            if (!note.isNullOrBlank()) put("note", note.trim())
            if (!preferredDate.isNullOrBlank()) put("preferred_date", preferredDate)
        }
        val text = send("POST", token, "/api/local/service-requests", body)
        parseServiceRequest(JSONObject(text))
    }

    /** Lists the signed-in user's service subscriptions. Throws [HttpError] (401 when signed out). */
    suspend fun myServiceRequests(token: String): List<ServiceRequest> =
        withContext(Dispatchers.IO) {
            val text = get(token, "/api/local/service-requests")
            parseServiceRequests(text)
        }

    // ---- Host -----------------------------------------------------------------

    /**
     * Creates a service as the signed-in host (`POST /api/local/services`).
     * Returns the created [Service] (201). Throws [HttpError] (403 when role != host,
     * 400 on validation).
     */
    suspend fun createService(
        token: String,
        title: String,
        description: String?,
        category: String?,
        location: String?,
        price: Double,
        imageUrl: String?,
        lat: Double? = null,
        lng: Double? = null
    ): Service = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("title", title)
            if (!description.isNullOrBlank()) put("description", description.trim())
            if (!category.isNullOrBlank()) put("category", category.trim())
            if (!location.isNullOrBlank()) put("location", location.trim())
            put("price", price)
            if (!imageUrl.isNullOrBlank()) put("image_url", imageUrl.trim())
            if (lat != null && lng != null) {
                put("lat", lat)
                put("lng", lng)
            }
        }
        val text = send("POST", token, "/api/local/services", body)
        parseService(JSONObject(text))
    }

    /** The host's own services (`GET /api/local/host/services`). Throws [HttpError] (401 / 403). */
    suspend fun hostServices(token: String): List<Service> = withContext(Dispatchers.IO) {
        val text = get(token, "/api/local/host/services")
        parseServices(text)
    }

    /**
     * Service-request inbox across the host's services (`GET /api/local/host/service-requests`).
     * Throws [HttpError] (401 not signed in, 403 when the account isn't a host).
     */
    suspend fun hostServiceRequests(token: String): List<ServiceRequest> =
        withContext(Dispatchers.IO) {
            val text = get(token, "/api/local/host/service-requests")
            parseServiceRequests(text)
        }

    /**
     * Confirms or rejects a pending subscription as the host
     * (`PATCH /api/local/service-requests/:id {status:"confirm"|"reject"}`).
     * Returns the updated [ServiceRequest]. Throws [HttpError] (401 / 403 / 400).
     */
    suspend fun setRequestStatus(
        token: String,
        requestId: String,
        action: String
    ): ServiceRequest = withContext(Dispatchers.IO) {
        val body = JSONObject().apply { put("status", action) }
        val text = send("PATCH", token, "/api/local/service-requests/$requestId", body)
        parseServiceRequest(JSONObject(text))
    }

    // ---- HTTP helpers (mirror BookingService) ---------------------------------

    /** Unauthenticated GET (public browse); returns the body text or throws [HttpError]. */
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

    // ---- Parsing --------------------------------------------------------------

    private fun parseServices(json: String): List<Service> {
        val arr = JSONArray(json)
        val result = ArrayList<Service>(arr.length())
        for (i in 0 until arr.length()) result.add(parseService(arr.getJSONObject(i)))
        return result
    }

    /** Parses one service object. Internal so [WishlistService] can reuse the same shape. */
    internal fun parseService(o: JSONObject): Service = Service(
        id = o.optString("id"),
        hostId = o.optString("host_id").ifBlank { null },
        hostName = o.optString("host_name").ifBlank { null },
        title = o.optString("title"),
        description = o.optString("description").ifBlank { null },
        category = o.optString("category").ifBlank { null },
        location = o.optString("location").ifBlank { null },
        price = o.optDouble("price", 0.0),
        currency = o.optString("currency").ifBlank { null },
        imageUrl = o.optString("image_url").ifBlank { null },
        lat = o.optDouble("lat").takeUnless { it.isNaN() },
        lng = o.optDouble("lng").takeUnless { it.isNaN() },
        isPublished = o.optBoolean("is_published", true)
    )

    private fun parseServiceRequests(json: String): List<ServiceRequest> {
        val arr = JSONArray(json)
        val result = ArrayList<ServiceRequest>(arr.length())
        for (i in 0 until arr.length()) result.add(parseServiceRequest(arr.getJSONObject(i)))
        return result
    }

    private fun parseServiceRequest(o: JSONObject): ServiceRequest = ServiceRequest(
        id = o.optString("id"),
        serviceId = o.optString("service_id"),
        userId = o.optString("user_id").ifBlank { null },
        status = o.optString("status").ifBlank { "pending" },
        preferredDate = o.optString("preferred_date").ifBlank { null },
        note = o.optString("note").ifBlank { null },
        requestCode = o.optString("request_code").ifBlank { null },
        serviceTitle = o.optString("service_title"),
        serviceCategory = o.optString("service_category").ifBlank { null },
        serviceImage = o.optString("service_image").ifBlank { null },
        servicePrice = o.optDouble("service_price", 0.0),
        serviceCurrency = o.optString("service_currency").ifBlank { null },
        serviceLocation = o.optString("service_location").ifBlank { null },
        hostId = o.optString("host_id").ifBlank { null },
        hostName = o.optString("host_name").ifBlank { null },
        requesterName = o.optString("requester_name").ifBlank { null },
        requesterEmail = o.optString("requester_email").ifBlank { null }
    )
}
