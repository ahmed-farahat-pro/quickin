package com.quickin.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for [OwnershipDocRules] — the Kotlin mirror of the backend's
 * `test/unit/ownership-doc-core.test.mjs` and of iOS's `Tests/OwnershipDocRulesTests`.
 *
 * The reported defect: **both ownership-document upload entry points on iOS and Android accepted
 * only image files**, so a host holding a PDF deed — the shape a registry, developer or utility
 * actually issues — had to photograph it off their screen. The web has taken images AND
 * `application/pdf` since 2026-08-19, and the API stores either. These tests pin the three
 * answers the phone now has to give the same way the web does: what counts as a PDF, what stays
 * refused, and where the size cap bites.
 *
 *     ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :app:testDebugUnitTest
 */
class OwnershipDocRulesTest {

    private val pdfBytes = "%PDF-1.7\nreal deed bytes".toByteArray(Charsets.US_ASCII)
    private val realPdf = "data:application/pdf;base64,JVBERi0xLjcKcmVhbCBkZWVkIGJ5dGVz"
    private val jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=="

    // ---- A PDF is a document — the whole point of the fix ----------------------------------

    @Test
    fun `pdf bytes are recognised by their first five bytes`() {
        assertTrue(OwnershipDocRules.isPdfBytes(pdfBytes))
        assertFalse(OwnershipDocRules.isPdfBytes("PKzip".toByteArray()))
        assertFalse(OwnershipDocRules.isPdfBytes(ByteArray(0)))
        assertFalse(OwnershipDocRules.isPdfBytes("%PD".toByteArray()))
    }

    @Test
    fun `a pdf data url is a storable ownership document`() {
        assertTrue(OwnershipDocRules.isPdfDataUrl(realPdf))
        assertTrue(OwnershipDocRules.isOwnershipDocSrc(realPdf))
        assertNull(OwnershipDocRules.check(realPdf))
    }

    @Test
    fun `the mime label alone is not trusted - the payload decides`() {
        // A .docx (or anything else) the picker labelled as a PDF: the payload is not `%PDF-`.
        val fake = "data:application/pdf;base64,UEsDBG5vdCBhIHBkZg=="
        assertFalse(OwnershipDocRules.isPdfDataUrl(fake))
        assertEquals(OwnershipDocRules.Problem.UNSUPPORTED, OwnershipDocRules.check(fake))
    }

    // ---- Photos still work — the fix ADDS a shape, it replaces nothing ----------------------

    @Test
    fun `images and http links are still accepted`() {
        assertTrue(OwnershipDocRules.isImageDataUrl(jpeg))
        assertNull(OwnershipDocRules.check(jpeg))
        assertNull(OwnershipDocRules.check("https://example.com/deed.pdf"))
    }

    // ---- What stays refused -----------------------------------------------------------------

    @Test
    fun `svg is refused - ops will not render one`() {
        assertFalse(OwnershipDocRules.isImageDataUrl("data:image/svg+xml;base64,PHN2Zz4="))
        assertEquals(
            OwnershipDocRules.Problem.UNSUPPORTED,
            OwnershipDocRules.check("data:image/svg+xml;base64,PHN2Zz4=")
        )
    }

    @Test
    fun `a word document is refused - an operator could not open it`() {
        assertEquals(
            OwnershipDocRules.Problem.UNSUPPORTED,
            OwnershipDocRules.check("data:application/msword;base64,0M8R4A==")
        )
    }

    @Test
    fun `nothing attached is missing, not unsupported`() {
        assertEquals(OwnershipDocRules.Problem.MISSING, OwnershipDocRules.check(""))
        assertEquals(OwnershipDocRules.Problem.MISSING, OwnershipDocRules.check("   "))
        assertEquals(OwnershipDocRules.Problem.MISSING, OwnershipDocRules.check(null))
        assertEquals(OwnershipDocRules.Problem.UNSUPPORTED, OwnershipDocRules.check("deed.pdf"))
    }

    // ---- The size cap, and the order the questions are asked in ------------------------------

    @Test
    fun `an oversized pdf is too large, not unsupported`() {
        val oversized = "data:application/pdf;base64,JVBERi0" + "A".repeat(OwnershipDocRules.MAX_CHARS)
        assertEquals(OwnershipDocRules.Problem.TOO_LARGE, OwnershipDocRules.check(oversized))
    }

    @Test
    fun `an oversized non-document is still unsupported`() {
        val oversized = "data:application/msword;base64," + "A".repeat(OwnershipDocRules.MAX_CHARS)
        assertEquals(OwnershipDocRules.Problem.UNSUPPORTED, OwnershipDocRules.check(oversized))
    }

    @Test
    fun `the cap is the one the api enforces`() {
        assertEquals(3_500_000, OwnershipDocRules.MAX_CHARS)
    }
}
