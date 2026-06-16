package com.quickin.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** One turn in the travel-concierge conversation (`role` is "user" or "assistant"). */
data class AiMessage(val role: String, val content: String)

/**
 * Streaming client for the public AI **travel concierge** endpoint. Mirrors
 * [NotificationService] (HttpURLConnection + org.json on Dispatchers.IO, no
 * third-party HTTP/JSON libs) but reads a **Server-Sent Events** body instead of
 * a single JSON document, emitting each token as it arrives.
 *
 *   POST {base}/api/local/ai/chat   { messages: [{role, content}, …] }   (no auth)
 *     -> text/event-stream:
 *          data: {"delta":"…"}\n\n   (repeated; append delta to the reply)
 *          data: [DONE]\n\n          (once, at the end)
 *          data: {"error":"…"}\n\n   (on a mid-stream failure, then close)
 *     A non-200 may instead return JSON {"error":"…"} (e.g. 503 when the AI key
 *     isn't configured) — surfaced as an [HttpError] the UI shows as a friendly note.
 */
object AITravelChatService {

    /** Thrown on a non-2xx response (or a mid-stream `{"error":…}`) so the UI can show it inline. */
    class HttpError(val code: Int, message: String) : RuntimeException(message)

    /**
     * Opens the SSE stream for [messages] and invokes [onDelta] once per token
     * (already hopped back to the caller's context is the caller's job — this runs
     * the network read on Dispatchers.IO and calls [onDelta] from there). Returns
     * normally on `[DONE]`; throws [HttpError] on a non-2xx or a streamed error.
     */
    suspend fun stream(messages: List<AiMessage>, onDelta: (String) -> Unit) =
        withContext(Dispatchers.IO) {
            val body = JSONObject().apply {
                val arr = JSONArray()
                for (m in messages) {
                    arr.put(JSONObject().apply {
                        put("role", m.role)
                        put("content", m.content)
                    })
                }
                put("messages", arr)
            }

            val conn = (URL("${Config.API_BASE_URL}/api/local/ai/chat").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 15_000
                // Token-by-token streams can pause between deltas; keep the read
                // timeout generous so a thinking model doesn't trip it.
                readTimeout = 60_000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Accept", "text/event-stream")
            }

            try {
                conn.outputStream.use { out -> out.write(body.toString().toByteArray(Charsets.UTF_8)) }

                val code = conn.responseCode
                if (code !in 200..299) {
                    val text = conn.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
                    throw HttpError(code, extractError(text, code))
                }

                conn.inputStream.bufferedReader().use { reader ->
                    reader.lineSequence().forEach { raw ->
                        val line = raw.trim()
                        // SSE frames are blank-line separated; only `data:` lines carry payload.
                        if (!line.startsWith("data:")) return@forEach
                        val payload = line.removePrefix("data:").trim()
                        if (payload.isEmpty()) return@forEach
                        if (payload == "[DONE]") return@use   // graceful end of stream

                        // Each data line is a tiny JSON object: {"delta":…} or {"error":…}.
                        val obj = runCatching { JSONObject(payload) }.getOrNull() ?: return@forEach
                        val streamedError = obj.optString("error")
                        if (streamedError.isNotBlank()) throw HttpError(200, streamedError)
                        val delta = obj.optString("delta")
                        if (delta.isNotEmpty()) onDelta(delta)
                    }
                }
            } finally {
                conn.disconnect()
            }
        }

    private fun extractError(text: String, code: Int): String {
        val parsed = runCatching { JSONObject(text).optString("error") }.getOrNull()
        return if (!parsed.isNullOrBlank()) parsed else "Request failed ($code)"
    }
}
