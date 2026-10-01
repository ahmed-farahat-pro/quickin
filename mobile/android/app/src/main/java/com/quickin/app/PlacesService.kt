package com.quickin.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Place-suggestion typeahead for the Explore search (`GET /api/local/places?q=…` → { places:[…] }).
 * Public endpoint — no auth header. Best-effort: any failure yields an empty list so the search
 * field never breaks on a network hiccup.
 */
object PlacesService {
    suspend fun suggest(query: String): List<String> = withContext(Dispatchers.IO) {
        val q = URLEncoder.encode(query, "UTF-8")
        val conn = (URL("${Config.API_BASE_URL}/api/local/places?q=$q").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 15_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
        }
        try {
            val code = conn.responseCode
            if (code !in 200..299) return@withContext emptyList()
            val text = conn.inputStream?.bufferedReader()?.use { it.readText() }.orEmpty()
            val arr = JSONObject(text).optJSONArray("places") ?: JSONArray()
            val out = ArrayList<String>(arr.length())
            for (i in 0 until arr.length()) {
                val s = arr.optString(i)
                if (s.isNotBlank()) out.add(s)
            }
            out
        } catch (e: Exception) {
            emptyList()
        } finally {
            conn.disconnect()
        }
    }
}
