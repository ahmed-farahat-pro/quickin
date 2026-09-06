package com.quickin.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Kotlin mirror of iOS's `Tests/ListingPhotoUploadTests` — the two guard hand-written twins
 * ([ListingPhotoUpload] and `ListingPhotoUpload.swift`) that have to answer with the same numbers,
 * so a change to the budget or to the split belongs in both suites.
 *
 * The reported defect (iOS first, but the same code shape here): **"Couldn't create the listing
 * (413)."** A host attached the 10 photos the wizard offers, tapped Submit and got a 413 with no
 * explanation. The cause is not in this codebase: the backend runs as a Vercel function and the
 * platform refuses a request body over ~4.5 MB *before the function runs*, so a body of base64'd
 * JPEGs never reached anything that could answer with a sentence. Measured against the deployed
 * backend: 4.19 MB → 401 (ours), 4.61 MB → 413 (Vercel's).
 *
 * So these tests are mostly about a size ceiling, and about the two things that must not break
 * while enforcing it: the first request keeps at least one photo (the backend refuses a listing
 * with none) and the host's chosen order survives being cut into pieces.
 *
 * Plain JVM, no emulator: `./gradlew testDebugUnitTest`.
 */
class ListingPhotoUploadTest {

    /** A stand-in data URL of a given payload size, shaped like the real thing so the byte maths
     *  under test is the byte maths that runs in the app. */
    private fun photo(bytes: Int): String =
        "data:image/jpeg;base64," + "A".repeat(maxOf(0, bytes - 23))

    /** What the picker produces for a phone photo at the top of its range. */
    private val big = 700_000
    /** …and at the bottom of it, a small or flat-coloured photo. */
    private val small = 180_000

    /** Every request a plan turns into, measured the way the planner measures. */
    private fun requestSizes(
        plan: ListingPhotoUpload.Plan,
        fixedBytes: Int,
        docBytes: Int
    ): List<Int> {
        val sizes = mutableListOf(
            plan.withRequest.fold(fixedBytes + (if (plan.docDeferred) 0 else docBytes)) { acc, url ->
                acc + ListingPhotoUpload.bodyBytes(url)
            }
        )
        plan.appended.forEach { batch ->
            sizes.add(
                batch.fold(ListingPhotoUpload.APPEND_OVERHEAD_BYTES) { acc, url ->
                    acc + ListingPhotoUpload.bodyBytes(url)
                }
            )
        }
        if (plan.docDeferred) sizes.add(docBytes + 64)
        return sizes
    }

    @Test
    fun `the reported defect - ten photos no longer travel in one body`() {
        val ten = List(10) { photo(big) }
        val plan = ListingPhotoUpload.plan(photos = ten, fixedBytes = 2_000)

        assertEquals("all ten are still sent", 10, plan.withRequest.size + plan.appendedCount)
        assertTrue("the overflow goes into append requests", plan.appended.isNotEmpty())
        assertTrue(
            "every request the plan makes is under the budget",
            requestSizes(plan, 2_000, 0).all { it <= ListingPhotoUpload.MAX_REQUEST_BYTES }
        )
        assertTrue(
            "the budget stays under the smallest body measured to reach the function",
            ListingPhotoUpload.MAX_REQUEST_BYTES < 4_190_000
        )
    }

    @Test
    fun `the first request always carries a photo`() {
        // The backend refuses a listing with no photo, so an empty first request answers 400.
        val ten = List(10) { photo(big) }
        val plan = ListingPhotoUpload.plan(photos = ten, fixedBytes = 2_000)
        assertTrue(plan.withRequest.isNotEmpty())
        assertEquals("and it is the cover, not whichever one fit", ten.first(), plan.withRequest.first())

        // A photo bigger on its own than the whole budget is sent anyway, so the server answers
        // with a reason ("That image is too large") instead of a silent refusal here.
        val huge = ListingPhotoUpload.plan(photos = listOf(photo(5_000_000)), fixedBytes = 2_000)
        assertEquals(1, huge.withRequest.size)
        assertTrue(huge.appended.isEmpty())

        val none = ListingPhotoUpload.plan(photos = emptyList(), fixedBytes = 2_000)
        assertEquals(ListingPhotoUpload.Plan(emptyList(), emptyList(), false), none)
    }

    @Test
    fun `order is display order - the cover is the cover and the rest follow it`() {
        val ordered = List(9) { "data:image/jpeg;base64," + "$it".repeat(big) }
        val plan = ListingPhotoUpload.plan(photos = ordered, fixedBytes = 2_000)
        assertEquals(
            "flattening the plan gives back exactly the order the host arranged",
            ordered,
            plan.withRequest + plan.appended.flatten()
        )
    }

    @Test
    fun `the ordinary listing is still one request`() {
        val few = ListingPhotoUpload.plan(photos = List(4) { photo(small) }, fixedBytes = 2_000)
        assertTrue("nothing is split, nothing extra is sent", few.appended.isEmpty())
        assertEquals(4, few.withRequest.size)

        val fourBig = ListingPhotoUpload.plan(photos = List(4) { photo(big) }, fixedBytes = 2_000)
        assertTrue("four big photos (2.8 MB) still fit one request", fourBig.appended.isEmpty())
        assertEquals(4, fourBig.withRequest.size)

        val fiveBig = ListingPhotoUpload.plan(photos = List(5) { photo(big) }, fixedBytes = 2_000)
        assertEquals("the fifth is what tips it into a second request", 4, fiveBig.withRequest.size)
        assertEquals(1, fiveBig.appendedCount)
    }

    @Test
    fun `the ownership document, which is the other multi-MB thing in the body`() {
        // A small photo + a small doc: both ride along, because an operator opening the moderation
        // queue should find the document already there.
        val withDoc = ListingPhotoUpload.plan(
            photos = listOf(photo(small)), docBytes = 400_000, fixedBytes = 2_000
        )
        assertFalse("a document that fits travels with the first request", withDoc.docDeferred)

        // OwnershipDocRules caps a document at 3.5M chars — one that big cannot share a body.
        val bigDoc = ListingPhotoUpload.plan(
            photos = listOf(photo(big), photo(big)), docBytes = 3_400_000, fixedBytes = 2_000
        )
        assertTrue("a 3.4 MB document is deferred to its own PATCH", bigDoc.docDeferred)
        assertEquals("and the photos keep the body it vacated", 2, bigDoc.withRequest.size)
        assertEquals(0, bigDoc.appendedCount)
        assertTrue(
            "every request is still under the budget, document included",
            requestSizes(bigDoc, 2_000, 3_400_000).all { it <= ListingPhotoUpload.MAX_REQUEST_BYTES }
        )
    }

    @Test
    fun `batching on its own - what the editor uses for a listing that already exists`() {
        val batched = ListingPhotoUpload.batches(List(10) { photo(big) })
        assertTrue("ten big photos are more than one append request", batched.size >= 2)
        assertTrue("no empty batch is ever produced", batched.all { it.isNotEmpty() })
        assertTrue(
            "each batch fits the budget",
            batched.all { batch ->
                batch.fold(ListingPhotoUpload.APPEND_OVERHEAD_BYTES) { acc, url ->
                    acc + ListingPhotoUpload.bodyBytes(url)
                } <= ListingPhotoUpload.MAX_REQUEST_BYTES
            }
        )
        assertTrue("nothing to append means no request", ListingPhotoUpload.batches(emptyList()).isEmpty())
        assertEquals(listOf(listOf(photo(small))), ListingPhotoUpload.batches(listOf(photo(small))))

        // A byte budget, not a photo count: the same ten are one request when they are small.
        assertEquals(1, ListingPhotoUpload.batches(List(10) { photo(small) }).size)
    }
}
