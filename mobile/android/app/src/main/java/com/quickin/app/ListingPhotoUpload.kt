package com.quickin.app

/**
 * How a listing's photos and its ownership document are split across requests, so that no single
 * request is refused for being too big.
 *
 * **The bug this exists for.** The wizard let a host attach up to 10 photos and then posted all of
 * them, base64'd into one JSON body, to `POST /api/local/listings`. The backend runs as a Vercel
 * function, and the platform refuses a request body over ~4.5 MB **before the function runs at
 * all** — so nothing server-side saw the request, there was no `{"error"}` to show, and the host
 * got a bare `413` they could do nothing with. Measured against the deployed backend: a 4.19 MB
 * body reaches the function (401 from our own auth), a 4.61 MB body comes back 413.
 *
 * Android downscales to 1024 px before encoding, which put it just under the wall most of the
 * time rather than over it — the same latent bug, reported on iOS first because iOS keeps 1600 px.
 * The host editor is the worse door here: it sends the FULL replacement photo set, and an
 * ownership document on top of it.
 *
 * **The fix.** One request per bundle that fits under [MAX_REQUEST_BYTES]: the create (or the edit
 * PATCH) carries the first slice, `POST /listings/:id/images` appends the rest, and a large
 * ownership document travels in its own PATCH. Photo quality is untouched — re-encoding smaller
 * was the other way to make ten photos fit, and it makes every listing worse to serve a limit that
 * has nothing to do with photos.
 *
 * Two rules the plan cannot break:
 *
 * 1. **The first request always carries at least one photo.** The backend's
 *    `checkListingCompleteness` refuses a listing with none, so "send an empty set, then append
 *    everything" answers 400.
 * 2. **Order is display order.** The appended photos are the TAIL of the wanted order and the
 *    append endpoint puts each batch after the previous one, so the order a host arranged survives
 *    being cut into pieces — including on the editor's replacement path, where the first request
 *    replaces the set with the prefix and the appends rebuild the rest of it.
 *
 * Pure Kotlin: no Android imports, no network — it decides only what goes in which request. Tested
 * by `app/src/test/java/com/quickin/app/ListingPhotoUploadTest.kt` (`./gradlew testDebugUnitTest`).
 *
 * KEEP IN SYNC — iOS's `ListingPhotoUpload.swift` and the web's `listing-photo-upload.ts` answer
 * the same question with the same numbers.
 */
object ListingPhotoUpload {

    /**
     * The most JSON one request may carry, in bytes.
     *
     * The wall measured on the deployed backend sits between 4.19 MB (passes) and 4.61 MB (413) —
     * i.e. Vercel's documented 4.5 MB body limit. This is deliberately well under it: the margin
     * covers the JSON scaffolding around the photos, and a smaller body is also a shorter upload,
     * which matters more than the extra round trip on the mobile data most hosts list from.
     */
    const val MAX_REQUEST_BYTES = 3_500_000

    /** What `{"images":[…]}` costs around the photos themselves. */
    const val APPEND_OVERHEAD_BYTES = 64

    /**
     * What one data URL costs inside a JSON array: the string, its two quotes and the comma after
     * it. Data URLs are base64, so nothing in them escapes.
     */
    fun bodyBytes(url: String): Int = url.toByteArray(Charsets.UTF_8).size + 3

    /**
     * Which photos ride along with the first request, which follow in append requests, and whether
     * the ownership document needs its own PATCH.
     */
    data class Plan(
        /** Photos to send as `images` in the create POST / edit PATCH. Non-empty whenever the host
         *  attached any — see rule 1 above. */
        val withRequest: List<String>,
        /** Follow-up `POST /listings/:id/images` batches, in display order. */
        val appended: List<List<String>>,
        /** True when the document did not fit alongside the first body and has to be sent as
         *  `PATCH /listings/:id { ownership_doc }` afterwards. */
        val docDeferred: Boolean
    ) {
        /** Photos that are not in the first request. */
        val appendedCount: Int get() = appended.sumOf { it.size }
    }

    /**
     * Plan the requests for one create or one full photo-set replacement.
     *
     * @param photos every photo, in display order (first = cover).
     * @param docBytes [bodyBytes] of the ownership document, or 0 when none.
     * @param fixedBytes the rest of the body — title, address, prices, amenities and so on.
     *   Measured by the caller rather than guessed, because a description is host-written and has
     *   no useful upper bound.
     * @param budget request ceiling, defaults to [MAX_REQUEST_BYTES].
     */
    fun plan(
        photos: List<String>,
        docBytes: Int = 0,
        fixedBytes: Int = 0,
        budget: Int = MAX_REQUEST_BYTES
    ): Plan {
        val remaining = ArrayDeque(photos)
        val withRequest = mutableListOf<String>()
        var used = fixedBytes

        // The cover goes first and unconditionally: a listing with no photo is refused outright, so
        // a photo too big to fit the budget is still better sent — and refused for its own, sayable
        // reason — than withheld here.
        remaining.removeFirstOrNull()?.let {
            withRequest.add(it)
            used += bodyBytes(it)
        }

        // The document is what an operator opens to approve the listing, so it travels with the
        // first request whenever it fits — a listing that reaches the queue without it reads as
        // "Ownership document: not added" until the follow-up PATCH lands.
        var docDeferred = docBytes > 0
        if (docBytes > 0 && used + docBytes <= budget) {
            used += docBytes
            docDeferred = false
        }

        // Then as many more photos as fit, so the common case (a few photos, no document) is still
        // exactly one request.
        while (remaining.isNotEmpty() && used + bodyBytes(remaining.first()) <= budget) {
            val next = remaining.removeFirst()
            withRequest.add(next)
            used += bodyBytes(next)
        }

        return Plan(withRequest, batches(remaining.toList(), budget), docDeferred)
    }

    /**
     * Split photos into `POST /listings/:id/images` batches that each fit the budget, preserving
     * order. A photo bigger than the budget on its own gets a batch to itself rather than being
     * dropped — the server then answers with a reason the host can read.
     */
    fun batches(photos: List<String>, budget: Int = MAX_REQUEST_BYTES): List<List<String>> {
        val out = mutableListOf<List<String>>()
        var current = mutableListOf<String>()
        var used = APPEND_OVERHEAD_BYTES

        for (url in photos) {
            val cost = bodyBytes(url)
            if (current.isNotEmpty() && used + cost > budget) {
                out.add(current)
                current = mutableListOf()
                used = APPEND_OVERHEAD_BYTES
            }
            current.add(url)
            used += cost
        }
        if (current.isNotEmpty()) out.add(current)
        return out
    }
}
