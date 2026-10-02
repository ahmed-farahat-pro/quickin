package com.quickin.app

/**
 * Pure rules for listing comments — no Android types, so they run under plain JVM tests
 * (`CommentRulesTest`). Where a comment notification opens lives in [NotificationLinkRules].
 */
object CommentRules {

    /** Server limit for a comment or a reply body (POST / PUT answer 400 above this). */
    const val MAX_BODY = 1000

    /**
     * True when [text] is worth sending: something left after trimming, within [MAX_BODY].
     * Contact-detail checks stay server-side — its 400 wording is shown verbatim.
     */
    fun canSubmit(text: String): Boolean {
        val t = text.trim()
        return t.isNotEmpty() && t.length <= MAX_BODY
    }

    /** True when a deep link's fragment/query asks for the comments section. */
    fun wantsComments(fragment: String?, focusParam: String?): Boolean =
        fragment.equals("comments", ignoreCase = true) || focusParam.equals("comments", ignoreCase = true)

    /** [list] with the comment whose id matches [updated] swapped in (order kept). */
    fun replace(list: List<ListingComment>, updated: ListingComment): List<ListingComment> =
        list.map { if (it.id == updated.id) it.copy(reply = updated.reply, body = updated.body) else it }

}
