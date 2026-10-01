package com.quickin.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** The listing host's single reply under a [ListingComment]. */
data class CommentReply(val body: String, val createdAt: String?)

/**
 * One public comment on a listing (`GET /api/local/listings/:id/comments`). [mine] is true when
 * the signed-in caller wrote it (shows "Delete"). [listingTitle] / [listingImage] are only filled
 * by the host's cross-listing feed (`GET /api/local/host/comments`).
 */
data class ListingComment(
    val id: String,
    val listingId: String,
    val userId: String?,
    val authorName: String,
    val authorAvatar: String?,
    val body: String,
    val createdAt: String?,
    val mine: Boolean,
    val reply: CommentReply?,
    val listingTitle: String? = null,
    val listingImage: String? = null,
) {
    val isAnswered: Boolean get() = reply != null
}

/** A listing's comments plus what the caller may do with them. */
data class ListingCommentsPage(
    val comments: List<ListingComment>,
    /** The caller is this listing's host — show the reply controls, no top-level input. */
    val isHost: Boolean,
    /** Signed in AND not the host — show the "Ask a question" input. */
    val canComment: Boolean,
)

/** The host's "Guest questions" feed: unanswered first, then newest. */
data class HostCommentsPage(val comments: List<ListingComment>, val unanswered: Int)

/**
 * HTTP client for public listing comments (the replacement for host ⇄ guest messaging). Mirrors
 * [ReviewService]: HttpURLConnection + org.json on Dispatchers.IO, no third-party libraries.
 *
 *   GET    {base}/api/local/listings/:id/comments                 (auth optional)
 *   POST   {base}/api/local/listings/:id/comments {body}          (auth)
 *   DELETE {base}/api/local/listings/:id/comments/:cid            (author / admin)
 *   PUT    {base}/api/local/listings/:id/comments/:cid/reply {body} (listing host)
 *   DELETE {base}/api/local/listings/:id/comments/:cid/reply      (listing host)
 *   GET    {base}/api/local/host/comments                         (auth, host)
 *
 * Non-2xx answers throw [HttpError] carrying the server's `error` text verbatim (the 400
 * contact-details wording, the 429 rate limit, the 403 host-on-own-listing). A 409 carrying a
 * policy warning throws [PolicyWarningRequired] instead, so the screen can show the gate.
 */
object CommentService {

    class HttpError(val code: Int, message: String) : RuntimeException(message)

    /** A listing's comments. [token] is optional — signed out still reads, it just can't post. */
    suspend fun fetchListingComments(token: String?, listingId: String): ListingCommentsPage =
        withContext(Dispatchers.IO) {
            val o = JSONObject(request("GET", token, "/api/local/listings/${enc(listingId)}/comments", null))
            ListingCommentsPage(
                comments = parseList(o.optJSONArray("comments"), listingId),
                isHost = o.optBoolean("is_host", false),
                canComment = o.optBoolean("can_comment", false),
            )
        }

    suspend fun postComment(token: String, listingId: String, body: String): ListingComment =
        withContext(Dispatchers.IO) {
            val payload = JSONObject().apply { put("body", body) }
            val o = JSONObject(request("POST", token, "/api/local/listings/${enc(listingId)}/comments", payload))
            parseComment(o.optJSONObject("comment") ?: o, listingId)
        }

    suspend fun deleteComment(token: String, listingId: String, commentId: String): Unit =
        withContext(Dispatchers.IO) {
            request("DELETE", token, "/api/local/listings/${enc(listingId)}/comments/${enc(commentId)}", null)
            Unit
        }

    /** Creates or replaces the host's reply. Returns the comment with its reply filled. */
    suspend fun putReply(token: String, listingId: String, commentId: String, body: String): ListingComment =
        withContext(Dispatchers.IO) {
            val payload = JSONObject().apply { put("body", body) }
            val o = JSONObject(
                request("PUT", token, "/api/local/listings/${enc(listingId)}/comments/${enc(commentId)}/reply", payload)
            )
            parseComment(o.optJSONObject("comment") ?: o, listingId)
        }

    /** Removes the host's reply. Returns the comment with `reply = null`. */
    suspend fun deleteReply(token: String, listingId: String, commentId: String): ListingComment =
        withContext(Dispatchers.IO) {
            val o = JSONObject(
                request("DELETE", token, "/api/local/listings/${enc(listingId)}/comments/${enc(commentId)}/reply", null)
            )
            parseComment(o.optJSONObject("comment") ?: o, listingId)
        }

    /** The signed-in host's questions across all their listings. */
    suspend fun fetchHostComments(token: String): HostCommentsPage = withContext(Dispatchers.IO) {
        val o = JSONObject(request("GET", token, "/api/local/host/comments", null))
        val list = parseList(o.optJSONArray("comments"), null)
        HostCommentsPage(
            comments = list,
            unanswered = if (o.has("unanswered")) o.optInt("unanswered", 0) else list.count { !it.isAnswered },
        )
    }

    // ---- HTTP -------------------------------------------------------------------

    private fun enc(s: String): String = URLEncoder.encode(s, "UTF-8")

    private fun request(method: String, token: String?, path: String, body: JSONObject?): String {
        val conn = (URL("${Config.API_BASE_URL}$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
            if (!token.isNullOrBlank()) setRequestProperty("Authorization", "Bearer $token")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }
        try {
            if (body != null) {
                conn.outputStream.use { out -> out.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (code !in 200..299) {
                if (code == PolicyWarningApi.GATE_STATUS) {
                    PolicyWarningApi.parse(text)?.let { (id, message) -> throw PolicyWarningRequired(id, message) }
                }
                val parsed = runCatching { JSONObject(text).optString("error") }.getOrNull()
                throw HttpError(code, if (!parsed.isNullOrBlank()) parsed else "Request failed ($code)")
            }
            return text
        } finally {
            conn.disconnect()
        }
    }

    // ---- Parsing ----------------------------------------------------------------

    private fun parseList(arr: JSONArray?, listingId: String?): List<ListingComment> {
        if (arr == null) return emptyList()
        val out = ArrayList<ListingComment>(arr.length())
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            val c = parseComment(o, listingId)
            if (c.id.isNotBlank()) out.add(c)
        }
        return out
    }

    private fun parseComment(o: JSONObject, listingId: String?): ListingComment {
        val r = o.optJSONObject("reply")
        val reply = r?.optStringOrNull("body")?.let { CommentReply(it, r.optStringOrNull("created_at")) }
        return ListingComment(
            id = o.optString("id"),
            listingId = o.optStringOrNull("listing_id") ?: listingId.orEmpty(),
            userId = o.optStringOrNull("user_id"),
            authorName = o.optStringOrNull("author_name") ?: "QuickIn guest",
            authorAvatar = o.optStringOrNull("author_avatar"),
            body = o.optString("body"),
            createdAt = o.optStringOrNull("created_at"),
            mine = o.optBoolean("mine", false),
            reply = reply,
            listingTitle = o.optStringOrNull("listing_title"),
            listingImage = o.optStringOrNull("listing_image"),
        )
    }
}
