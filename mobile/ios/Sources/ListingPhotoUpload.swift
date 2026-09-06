import Foundation

/// How a new listing's photos and its ownership document are split across
/// requests, so that no single request is refused for being too big.
///
/// **The bug this exists for.** The wizard let a host attach up to 10 photos and
/// then posted all of them, base64'd into one JSON body, to
/// `POST /api/local/listings`. A 1600 px JPEG at quality 0.8 is 300–700 KB once
/// base64 has added its third, so ten of them is 3–7 MB — and the backend runs as
/// a Vercel function, which refuses a request body over ~4.5 MB with a bare
/// **413** *before the function runs at all*. Nothing server-side saw the
/// request, so there was no `{"error"}` to show and the host got
/// "Couldn't create the listing (413)." with no way to act on it. Measured
/// against the deployed backend: a 4.0 MiB body reaches the function (401 from
/// our own auth), a 4.4 MiB body comes back 413.
///
/// **The fix.** One request per bundle of photos that fits under `maxRequestBytes`:
/// the create POST carries the first slice, `POST /listings/:id/images` appends
/// the rest, and a large ownership document travels in its own PATCH. Photo
/// quality is untouched — re-encoding smaller would have been the other way to
/// make ten photos fit, and it makes every listing worse to serve a limit that
/// has nothing to do with photos.
///
/// Two rules the plan cannot break:
///
/// 1. **The create request always carries at least one photo.** The backend's
///    `checkListingCompleteness` refuses a listing with no photo, so "create
///    empty, then append everything" is not an option — it would answer 400.
/// 2. **Order is display order.** The first photo of the first slice is the
///    cover, and the append endpoint puts each batch after the previous one, so
///    sending in slices preserves exactly the order the host arranged.
///
/// Pure: no UIKit, no SwiftUI, no network — it decides only what goes in which
/// request. Tested by `Tests/ListingPhotoUploadTests` (see `Tests/run.sh`).
///
/// KEEP IN SYNC — Android's add-listing flow posts the same one-shot body and
/// needs the same split; when it lands it should answer with these numbers.
enum ListingPhotoUpload {

    /// The most JSON one request may carry, in bytes.
    ///
    /// The wall measured on the deployed backend sits between 4.19 MB (passes)
    /// and 4.61 MB (413) — i.e. Vercel's documented 4.5 MB body limit. This is
    /// deliberately well under it: the margin covers the JSON scaffolding around
    /// the photos, and a smaller body is also a shorter upload, which matters
    /// more than the extra round trip on the 4G connection most hosts list from.
    static let maxRequestBytes = 3_500_000

    /// What `{"images":[…]}` costs around the photos themselves.
    static let appendOverheadBytes = 64

    /// What one data URL costs inside a JSON array: the string, its two quotes
    /// and the comma after it. Data URLs are base64, so nothing in them escapes.
    static func bodyBytes(_ url: String) -> Int { url.utf8.count + 3 }

    /// Which photos ride along with the create POST, which follow in append
    /// requests, and whether the ownership document needs its own PATCH.
    struct Plan: Equatable {
        /// Photos to send as `images` in `POST /api/local/listings`. Non-empty
        /// whenever the host attached any — see rule 1 above.
        var withCreate: [String]
        /// Follow-up `POST /listings/:id/images` batches, in display order.
        var appended: [[String]]
        /// True when the document did not fit alongside the create body and has
        /// to be sent as `PATCH /listings/:id { ownership_doc }` afterwards.
        var docDeferred: Bool

        /// Photos that are not in the create request.
        var appendedCount: Int { appended.reduce(0) { $0 + $1.count } }
    }

    /// Plan the requests for one create.
    ///
    /// - Parameters:
    ///   - photos: every photo, in display order (first = cover).
    ///   - docBytes: `bodyBytes` of the ownership document, or 0 when none.
    ///   - fixedBytes: the rest of the create body — title, address, prices,
    ///     amenities and so on. Measured by the caller rather than guessed,
    ///     because a description is host-written and has no useful upper bound.
    ///   - budget: request ceiling, defaults to `maxRequestBytes`.
    static func plan(
        photos: [String],
        docBytes: Int = 0,
        fixedBytes: Int = 0,
        budget: Int = maxRequestBytes
    ) -> Plan {
        var remaining = photos
        var withCreate: [String] = []
        var used = fixedBytes

        // The cover goes first and unconditionally: a create with no photo is
        // refused outright, so a photo too big to fit the budget is still better
        // sent (and refused for its own reason) than withheld.
        if let cover = remaining.first {
            withCreate.append(cover)
            used += bodyBytes(cover)
            remaining.removeFirst()
        }

        // The document is what an operator opens to approve the listing, so it
        // travels with the create whenever it fits — a listing that reaches the
        // queue without it reads as "Ownership document: not added" until the
        // follow-up PATCH lands.
        var docDeferred = docBytes > 0
        if docBytes > 0, used + docBytes <= budget {
            used += docBytes
            docDeferred = false
        }

        // Then as many more photos as fit, so the common case (a few photos, no
        // document) is still exactly one request.
        while let next = remaining.first, used + bodyBytes(next) <= budget {
            withCreate.append(next)
            used += bodyBytes(next)
            remaining.removeFirst()
        }

        return Plan(
            withCreate: withCreate,
            appended: batches(remaining, budget: budget),
            docDeferred: docDeferred
        )
    }

    /// Split photos into `POST /listings/:id/images` batches that each fit the
    /// budget, preserving order. A photo bigger than the budget on its own gets
    /// a batch to itself rather than being dropped — the server then answers
    /// with a reason the host can read.
    static func batches(_ photos: [String], budget: Int = maxRequestBytes) -> [[String]] {
        var out: [[String]] = []
        var current: [String] = []
        var used = appendOverheadBytes

        for url in photos {
            let cost = bodyBytes(url)
            if !current.isEmpty, used + cost > budget {
                out.append(current)
                current = []
                used = appendOverheadBytes
            }
            current.append(url)
            used += cost
        }
        if !current.isEmpty { out.append(current) }
        return out
    }
}
