package com.quickin.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Guards [CommentRules] — listing comments replaced host ⇄ guest messaging. What a comment
 * notification (or any other) opens is covered by `NotificationLinkRulesTest`.
 *
 * Plain JVM, no emulator: `./gradlew testDebugUnitTest`.
 */
class CommentRulesTest {

    private fun comment(id: String, answered: Boolean, createdAt: String) = ListingComment(
        id = id,
        listingId = "L1",
        userId = "u",
        authorName = "Sara A.",
        authorAvatar = null,
        body = "Is the pool heated?",
        createdAt = createdAt,
        mine = false,
        reply = if (answered) CommentReply("Yes", createdAt) else null,
    )

    // ---- Body ---------------------------------------------------------------------

    @Test
    fun `blank and over-long bodies cannot be sent`() {
        assertFalse(CommentRules.canSubmit(""))
        assertFalse(CommentRules.canSubmit("   \n "))
        assertTrue(CommentRules.canSubmit("Is parking included?"))
        assertTrue(CommentRules.canSubmit("a".repeat(CommentRules.MAX_BODY)))
        assertFalse(CommentRules.canSubmit("a".repeat(CommentRules.MAX_BODY + 1)))
        // Surrounding whitespace doesn't count against the limit.
        assertTrue(CommentRules.canSubmit("  " + "a".repeat(CommentRules.MAX_BODY) + "  "))
    }

    // ---- Deep-link focus -------------------------------------------------------------

    @Test
    fun `comments focus is read from fragment or query`() {
        assertTrue(CommentRules.wantsComments("comments", null))
        assertTrue(CommentRules.wantsComments(null, "comments"))
        assertFalse(CommentRules.wantsComments(null, null))
        assertFalse(CommentRules.wantsComments("reviews", null))
    }

    // ---- List bookkeeping -------------------------------------------------------------

    @Test
    fun `replace swaps the reply in place and keeps order`() {
        val list = listOf(comment("a", false, "2026-10-02T10:00:00Z"), comment("b", false, "2026-10-01T10:00:00Z"))
        val updated = comment("b", true, "2026-10-01T10:00:00Z")
        val out = CommentRules.replace(list, updated)
        assertEquals(listOf("a", "b"), out.map { it.id })
        assertTrue(out[1].isAnswered)
        assertFalse(out[0].isAnswered)
        // Removing a reply is the same swap with reply = null.
        val cleared = CommentRules.replace(out, updated.copy(reply = null))
        assertFalse(cleared[1].isAnswered)
    }
}
