package com.quickin.app

/**
 * Pure rules for listing comments and their notifications — no Android types, so they run under
 * plain JVM tests (`CommentRulesTest`).
 */
object CommentRules {

    /** Server limit for a comment or a reply body (POST / PUT answer 400 above this). */
    const val MAX_BODY = 1000

    /** Notification types that point at a listing's comments (`link: /explore/<id>#comments`). */
    private val COMMENT_TYPES = setOf("comment", "comment_reply")

    /**
     * True when [text] is worth sending: something left after trimming, within [MAX_BODY].
     * Contact-detail checks stay server-side — its 400 wording is shown verbatim.
     */
    fun canSubmit(text: String): Boolean {
        val t = text.trim()
        return t.isNotEmpty() && t.length <= MAX_BODY
    }

    fun isCommentNotification(type: String?): Boolean = type?.trim()?.lowercase() in COMMENT_TYPES

    /**
     * The listing id in a link shaped like `/explore/<id>#comments`, `https://host/explore/<id>`
     * or `quickin://explore/<id>`; null when the link is not a listing link.
     */
    fun listingIdFromLink(link: String?): String? {
        var s = link?.trim().orEmpty()
        if (s.isEmpty()) return null
        s = s.substringBefore('#').substringBefore('?')
        val schemeEnd = s.indexOf("://")
        if (schemeEnd >= 0) {
            val rest = s.substring(schemeEnd + 3)
            val scheme = s.substring(0, schemeEnd).lowercase()
            // quickin://explore/<id> — the route sits in the authority; https://host/explore/<id> — it doesn't.
            s = if (scheme == "http" || scheme == "https") "/" + rest.substringAfter('/', "") else "/$rest"
        }
        val segs = s.split('/').filter { it.isNotBlank() }
        if (segs.size < 2) return null
        return if (segs[0].lowercase() in setOf("explore", "listing", "listings")) segs[1] else null
    }

    /**
     * Where an in-app notification row opens: the listing id for `comment` / `comment_reply`,
     * else null (the row just marks itself read — old `message` rows never open a chat).
     */
    fun notificationListingId(type: String?, link: String?): String? =
        if (isCommentNotification(type)) listingIdFromLink(link) else null

    /**
     * The URI a push notification tap should carry into MainActivity, or null to just open the
     * app. `message` pushes (messaging was removed) never carry their link. A relative server
     * link (`/explore/<id>#comments`) is rewritten to the app scheme
     * (`quickin://explore/<id>#comments`) so [DeepLink.parse] understands it.
     */
    fun pushLink(type: String?, link: String?): String? {
        if (type?.trim()?.lowercase() == "message") return null
        val l = link?.trim().orEmpty()
        if (l.isEmpty()) return null
        if (l.startsWith("/")) return "${Config.DEEP_LINK_SCHEME}://" + l.trimStart('/')
        return l
    }

    /** True when a deep link's fragment/query asks for the comments section. */
    fun wantsComments(fragment: String?, focusParam: String?): Boolean =
        fragment.equals("comments", ignoreCase = true) || focusParam.equals("comments", ignoreCase = true)

    /** [list] with the comment whose id matches [updated] swapped in (order kept). */
    fun replace(list: List<ListingComment>, updated: ListingComment): List<ListingComment> =
        list.map { if (it.id == updated.id) it.copy(reply = updated.reply, body = updated.body) else it }

}
