package com.quickin.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Guards [CommentRules] — listing comments replaced host ⇄ guest messaging, and these rules decide
 * what a comment notification opens and what a push tap carries into the app. The regression this
 * exists for: an old `message` notification must never route anywhere (there is no chat screen
 * left to open), while `comment` / `comment_reply` must land on the listing's comments.
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

    // ---- Links --------------------------------------------------------------------

    @Test
    fun `listing id is read from every link shape`() {
        assertEquals("abc-123", CommentRules.listingIdFromLink("/explore/abc-123#comments"))
        assertEquals("abc-123", CommentRules.listingIdFromLink("/explore/abc-123"))
        assertEquals("abc-123", CommentRules.listingIdFromLink("https://quickin-frontend.vercel.app/explore/abc-123#comments"))
        assertEquals("abc-123", CommentRules.listingIdFromLink("quickin://explore/abc-123#comments"))
        assertEquals("abc-123", CommentRules.listingIdFromLink("/explore/abc-123?focus=comments"))
    }

    @Test
    fun `non-listing links yield no id`() {
        assertNull(CommentRules.listingIdFromLink(null))
        assertNull(CommentRules.listingIdFromLink(""))
        assertNull(CommentRules.listingIdFromLink("/explore"))
        assertNull(CommentRules.listingIdFromLink("/messages?c=1"))
        assertNull(CommentRules.listingIdFromLink("/reservation/r1"))
    }

    // ---- In-app notification rows ---------------------------------------------------

    @Test
    fun `comment and reply notifications open the listing`() {
        assertEquals("L9", CommentRules.notificationListingId("comment", "/explore/L9#comments"))
        assertEquals("L9", CommentRules.notificationListingId("comment_reply", "/explore/L9#comments"))
        assertEquals("L9", CommentRules.notificationListingId("COMMENT", "/explore/L9#comments"))
    }

    @Test
    fun `old message notifications open nothing`() {
        assertNull(CommentRules.notificationListingId("message", "/explore/L9"))
        assertNull(CommentRules.notificationListingId("message", "/messages?conversation=x"))
        assertNull(CommentRules.notificationListingId("booking", "/explore/L9"))
        assertNull(CommentRules.notificationListingId(null, "/explore/L9"))
    }

    // ---- Push taps ------------------------------------------------------------------

    @Test
    fun `a relative push link becomes an app-scheme link`() {
        assertEquals("quickin://explore/L9#comments", CommentRules.pushLink("comment", "/explore/L9#comments"))
        assertEquals("quickin://explore/L9#comments", CommentRules.pushLink("comment_reply", "/explore/L9#comments"))
        // Absolute links pass through untouched.
        assertEquals(
            "https://quickin-frontend.vercel.app/reservation/r1",
            CommentRules.pushLink("booking", "https://quickin-frontend.vercel.app/reservation/r1")
        )
    }

    @Test
    fun `a message push carries no link`() {
        assertNull(CommentRules.pushLink("message", "/messages?conversation=x"))
        assertNull(CommentRules.pushLink("comment", null))
        assertNull(CommentRules.pushLink("comment", "  "))
    }

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
