// Unit tests for Sources/ListingPhotoUpload.swift — how a new listing's photos are split
// across requests.
//
// The reported defect: **"Couldn't create the listing (413)."** A host filled the wizard in,
// attached the 10 photos the wizard offers, tapped Submit for review and got a 413 with no
// explanation. The cause is not in our code at all: the backend runs as a Vercel function and
// the platform refuses a request body over ~4.5 MB *before the function runs*, so ten base64'd
// JPEGs in one JSON body never reached anything that could answer with a sentence. Measured
// against the deployed backend: 4.19 MB → 401 (ours), 4.61 MB → 413 (Vercel's).
//
// So the tests below are mostly about a size ceiling, and about the two things that must not
// break while enforcing it: the create request keeps at least one photo (the backend refuses a
// listing without one) and the host's chosen order survives being cut into pieces.
//
// This app has no XCTest target, so the suite is a plain executable over the same pure file the
// app compiles — no UIKit, no SwiftUI, no simulator:
//
//     cd mobile/ios && ./Tests/run.sh
//
// Exits non-zero if anything failed. `Tests/` is outside the target's `sources:` in project.yml,
// so none of this is compiled into the app.
import Foundation

var failures = 0
var checks = 0

func check(_ condition: Bool, _ label: String) {
    checks += 1
    if condition {
        print("  PASS \(label)")
    } else {
        print("  FAIL \(label)")
        failures += 1
    }
}

/// A stand-in data URL of a given payload size, shaped like the real thing so the byte maths
/// under test is the byte maths that runs in the app.
func photo(_ bytes: Int) -> String {
    "data:image/jpeg;base64," + String(repeating: "A", count: max(0, bytes - 23))
}

/// What `QKAvatarImage.makeDataURL(maxDimension: 1600, quality: 0.8)` actually produces for a
/// phone photo, at the top of its range — this is the size that broke the wizard.
let BIG = 700_000
/// …and at the bottom of it, a small or flat-coloured photo.
let SMALL = 180_000

/// Every request a plan turns into, measured the way the planner measures.
func requestSizes(_ plan: ListingPhotoUpload.Plan, fixedBytes: Int, docBytes: Int) -> [Int] {
    var sizes = [plan.withCreate.reduce(fixedBytes + (plan.docDeferred ? 0 : docBytes)) {
        $0 + ListingPhotoUpload.bodyBytes($1)
    }]
    for batch in plan.appended {
        sizes.append(batch.reduce(ListingPhotoUpload.appendOverheadBytes) {
            $0 + ListingPhotoUpload.bodyBytes($1)
        })
    }
    if plan.docDeferred { sizes.append(docBytes + 64) }
    return sizes
}

// ---------------------------------------------------------------------------
print("\nthe reported defect: ten photos no longer travel in one body")
// ---------------------------------------------------------------------------

let ten = (0..<10).map { _ in photo(BIG) }
let tenPlan = ListingPhotoUpload.plan(photos: ten, fixedBytes: 2_000)

check(tenPlan.withCreate.count + tenPlan.appendedCount == 10,
      "all ten photos are still sent, just not all at once")
check(tenPlan.appended.count >= 1, "the overflow goes into append requests")
check(requestSizes(tenPlan, fixedBytes: 2_000, docBytes: 0)
        .allSatisfy { $0 <= ListingPhotoUpload.maxRequestBytes },
      "every request the plan makes is under the budget")
check(ListingPhotoUpload.maxRequestBytes < 4_190_000,
      "the budget stays under the smallest body measured to reach the function")

// ---------------------------------------------------------------------------
print("\nthe create request always carries a photo (the backend refuses a listing without one)")
// ---------------------------------------------------------------------------

check(!tenPlan.withCreate.isEmpty, "ten big photos still leave one in the create body")
check(tenPlan.withCreate.first == ten.first, "and it is the cover, not whichever one fit")

// A photo bigger on its own than the whole budget: sent anyway, so the server answers with a
// reason ("That image is too large") instead of the host meeting a silent refusal here.
let huge = ListingPhotoUpload.plan(photos: [photo(5_000_000)], fixedBytes: 2_000)
check(huge.withCreate.count == 1 && huge.appended.isEmpty,
      "one over-budget photo is still sent rather than dropped")

check(ListingPhotoUpload.plan(photos: [], fixedBytes: 2_000)
        == ListingPhotoUpload.Plan(withCreate: [], appended: [], docDeferred: false),
      "no photos means no photo requests at all")

// ---------------------------------------------------------------------------
print("\norder is display order — the cover is the cover, and the rest follow it")
// ---------------------------------------------------------------------------

let ordered = (0..<9).map { "data:image/jpeg;base64," + String(repeating: "\($0)", count: BIG) }
let orderedPlan = ListingPhotoUpload.plan(photos: ordered, fixedBytes: 2_000)
check(orderedPlan.withCreate + orderedPlan.appended.flatMap { $0 } == ordered,
      "flattening the plan gives back exactly the order the host arranged")

// ---------------------------------------------------------------------------
print("\nthe ordinary listing is still one request")
// ---------------------------------------------------------------------------

let few = ListingPhotoUpload.plan(photos: (0..<4).map { _ in photo(SMALL) }, fixedBytes: 2_000)
check(few.appended.isEmpty && few.withCreate.count == 4,
      "four ordinary photos: nothing is split, nothing extra is sent")

let fourBig = ListingPhotoUpload.plan(photos: (0..<4).map { _ in photo(BIG) }, fixedBytes: 2_000)
check(fourBig.appended.isEmpty && fourBig.withCreate.count == 4,
      "four big photos (2.8 MB) still fit one request")
let fiveBig = ListingPhotoUpload.plan(photos: (0..<5).map { _ in photo(BIG) }, fixedBytes: 2_000)
check(fiveBig.withCreate.count == 4 && fiveBig.appendedCount == 1,
      "the fifth big photo is what tips it into a second request")

// ---------------------------------------------------------------------------
print("\nthe ownership document, which is the other multi-MB thing in the body")
// ---------------------------------------------------------------------------

// A small photo + a small doc: both ride along, because an operator opening the moderation queue
// should find the document already there.
let withDoc = ListingPhotoUpload.plan(photos: [photo(SMALL)], docBytes: 400_000, fixedBytes: 2_000)
check(!withDoc.docDeferred, "a document that fits travels with the create request")

// The picker's cap is 3.5M chars — a document that big cannot share a body with a photo.
let bigDoc = ListingPhotoUpload.plan(photos: [photo(BIG), photo(BIG)],
                                     docBytes: 3_400_000, fixedBytes: 2_000)
check(bigDoc.docDeferred, "a 3.4 MB document is deferred to its own PATCH")
check(bigDoc.withCreate.count == 2 && bigDoc.appendedCount == 0,
      "and the photos keep the body the document just vacated")
check(requestSizes(bigDoc, fixedBytes: 2_000, docBytes: 3_400_000)
        .allSatisfy { $0 <= ListingPhotoUpload.maxRequestBytes },
      "every request is still under the budget, document included")

// ---------------------------------------------------------------------------
print("\nbatching on its own — what the host editor uses when adding photos to a live listing")
// ---------------------------------------------------------------------------

let batched = ListingPhotoUpload.batches((0..<10).map { _ in photo(BIG) })
check(batched.count >= 2, "ten big photos are more than one append request")
check(batched.allSatisfy { !$0.isEmpty }, "no empty batch is ever produced")
check(batched.allSatisfy { batch in
        batch.reduce(ListingPhotoUpload.appendOverheadBytes) { $0 + ListingPhotoUpload.bodyBytes($1) }
            <= ListingPhotoUpload.maxRequestBytes
      }, "each batch fits the budget")
check(ListingPhotoUpload.batches([]).isEmpty, "nothing to append means no request")
check(ListingPhotoUpload.batches([photo(SMALL)]) == [[photo(SMALL)]],
      "one photo is one batch, unchanged")

// A byte budget, not a photo count: the same 10 photos are one request when they are small.
check(ListingPhotoUpload.batches((0..<10).map { _ in photo(SMALL) }).count == 1,
      "ten small photos still go in a single append")

// ---------------------------------------------------------------------------
print(failures == 0 ? "\n✅ ALL \(checks) PASSED\n" : "\n❌ \(failures) of \(checks) FAILED\n")
exit(failures == 0 ? 0 : 1)
