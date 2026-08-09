package com.quickin.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Guest disputes — raising an issue about a stay, and following it.
 *
 *   GET  {base}/api/local/disputes            -> { disputes, categories }
 *   GET  {base}/api/local/disputes?id=…       -> { dispute, events }
 *   GET  {base}/api/local/disputes?eligible=1 -> { eligible[], existing{} }
 *   POST {base}/api/local/disputes            -> 201 { dispute }
 *        { bookingId, category, description, photos[] }
 *
 * NOT `/bookings/:id/dispute` — that path is the *payment* dispute ("the host
 * rejected my proof and I did pay"), a different thing with its own lifecycle.
 *
 * The category list comes from the server so it can grow without a Play release;
 * [DisputeCategory.FALLBACK] covers a cold start with no network.
 */
object DisputeService {

    /** One category a guest can file under. */
    data class DisputeCategory(val key: String, val label: String) {
        companion object {
            /** Mirrors DISPUTE_CATEGORIES in the server's disputes-core. */
            val FALLBACK = listOf(
                DisputeCategory("not_as_described", "Listing not as described"),
                DisputeCategory("cleanliness", "Cleanliness"),
                DisputeCategory("checkin", "Check-in or access problem"),
                DisputeCategory("host_unresponsive", "Host unresponsive"),
                DisputeCategory("safety", "Safety or security concern"),
                DisputeCategory("overcharged", "Overcharged / refund request"),
                DisputeCategory("damage", "Damage or missing items"),
                DisputeCategory("other", "Other"),
            )
        }
    }

    data class Dispute(
        val id: String,
        val bookingId: String,
        val category: String,
        val description: String,
        val photos: List<String>,
        val status: String,
        val resolution: String?,
        val createdAt: String,
        val listingTitle: String?,
    ) {
        /** "QK-1A2B3C" — the same short handle /ops shows, derived from the id. */
        val reference: String
            get() {
                val hex = id.replace("-", "").take(6).uppercase()
                return if (hex.isEmpty()) "—" else "QK-$hex"
            }

        val statusLabel: String get() = statusLabelOf(status)
        val categoryLabel: String
            get() = DisputeCategory.FALLBACK.firstOrNull { it.key == category }?.label ?: "Other"
    }

    data class DisputeEvent(
        val id: String,
        val fromStatus: String?,
        val toStatus: String,
        val note: String?,
        val actorName: String?,
        val createdAt: String,
    ) {
        /** "Dispute filed" for the opening row, "Open → In review" thereafter. */
        val summary: String
            get() = if (fromStatus == null) "Dispute filed"
                    else "${statusLabelOf(fromStatus)} → ${statusLabelOf(toStatus)}"
    }

    fun statusLabelOf(status: String): String = when (status) {
        "open" -> "Open"
        "in_review" -> "In review"
        "resolved" -> "Resolved"
        "closed" -> "Closed"
        else -> status.replaceFirstChar { it.uppercase() }
    }

    /** Every dispute this guest has filed, plus the category list. */
    suspend fun fetch(token: String): Pair<List<Dispute>, List<DisputeCategory>> = withContext(Dispatchers.IO) {
        val o = JSONObject(get(token, "/api/local/disputes"))
        val disputes = parseDisputes(o.optJSONArray("disputes"))
        val cats = o.optJSONArray("categories")
        val categories = if (cats == null) DisputeCategory.FALLBACK else buildList {
            for (i in 0 until cats.length()) {
                val c = cats.getJSONObject(i)
                add(DisputeCategory(c.optString("key"), c.optString("label")))
            }
        }.ifEmpty { DisputeCategory.FALLBACK }
        disputes to categories
    }

    /** One dispute with its full history. */
    suspend fun detail(token: String, id: String): Pair<Dispute, List<DisputeEvent>> = withContext(Dispatchers.IO) {
        val o = JSONObject(get(token, "/api/local/disputes?id=$id"))
        val dispute = parseDispute(o.getJSONObject("dispute"))
        val arr = o.optJSONArray("events")
        val events = buildList {
            for (i in 0 until (arr?.length() ?: 0)) {
                val e = arr!!.getJSONObject(i)
                add(
                    DisputeEvent(
                        id = e.optString("id"),
                        fromStatus = if (e.isNull("from_status")) null else e.optString("from_status"),
                        toStatus = e.optString("to_status"),
                        note = if (e.isNull("note")) null else e.optString("note"),
                        actorName = if (e.isNull("actor_name")) null else e.optString("actor_name"),
                        createdAt = e.optString("created_at"),
                    )
                )
            }
        }
        dispute to events
    }

    /** Which bookings can still be disputed, and which already have one. */
    suspend fun eligibility(token: String): Pair<Set<String>, Map<String, String>> = withContext(Dispatchers.IO) {
        val o = JSONObject(get(token, "/api/local/disputes?eligible=1"))
        val arr = o.optJSONArray("eligible")
        val eligible = buildSet { for (i in 0 until (arr?.length() ?: 0)) add(arr!!.getString(i)) }
        val ex = o.optJSONObject("existing")
        val existing = buildMap {
            ex?.keys()?.forEach { k -> put(k, ex.optString(k)) }
        }
        eligible to existing
    }

    /**
     * File a dispute. A 400 carries the server's own wording ("please add a bit
     * more detail"), written to be shown to the guest verbatim.
     */
    suspend fun file(
        token: String,
        bookingId: String,
        category: String,
        description: String,
        photos: List<String>,
    ): Dispute = withContext(Dispatchers.IO) {
        val payload = JSONObject().apply {
            put("bookingId", bookingId)
            put("category", category)
            put("description", description)
            put("photos", JSONArray(photos))
        }
        val text = send(token, "/api/local/disputes", payload)
        parseDispute(JSONObject(text).getJSONObject("dispute"))
    }

    // ---- Parsing --------------------------------------------------------------

    private fun parseDisputes(arr: JSONArray?): List<Dispute> = buildList {
        for (i in 0 until (arr?.length() ?: 0)) add(parseDispute(arr!!.getJSONObject(i)))
    }

    private fun parseDispute(o: JSONObject): Dispute {
        val photosArr = o.optJSONArray("photos")
        return Dispute(
            id = o.optString("id"),
            bookingId = o.optString("booking_id"),
            category = o.optString("category"),
            description = o.optString("description"),
            photos = buildList { for (i in 0 until (photosArr?.length() ?: 0)) add(photosArr!!.getString(i)) },
            status = o.optString("status"),
            resolution = if (o.isNull("resolution")) null else o.optString("resolution"),
            createdAt = o.optString("created_at"),
            listingTitle = if (o.isNull("listing_title")) null else o.optString("listing_title"),
        )
    }

    // ---- HTTP -----------------------------------------------------------------

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
            if (code !in 200..299) throw BookingService.HttpError(code, extractError(text, code))
            return text
        } finally {
            conn.disconnect()
        }
    }

    private fun send(token: String, path: String, body: JSONObject): String {
        val conn = (URL("${Config.API_BASE_URL}$path").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            // Photos can be several MB of base64, so allow longer than a plain POST.
            readTimeout = 60_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $token")
        }
        try {
            conn.outputStream.use { out -> out.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            val text = readBody(conn, code)
            if (code !in 200..299) throw BookingService.HttpError(code, extractError(text, code))
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
        val parsed = runCatching {
            val v = JSONObject(text).optString("error")
            v.ifEmpty { null }
        }.getOrNull()
        return parsed ?: "Request failed ($code)"
    }
}
