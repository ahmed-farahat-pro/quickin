// Unit tests for Sources/ReservationFilter.swift — the Swift mirror of the web's
// test/unit/reservation-filter-core.test.mjs and of Android's ReservationFilterTest.kt.
//
// The reported defect: **the guest's Trips list had no status filters at all.** Every
// reservation — waiting on the host, waiting on a transfer, paid, cancelled, refunded —
// rendered in one flat list, so the only way to find one was to scroll past the rest.
//
// Two halves matter here and are tested apart on purpose:
//
//   • What this module does DIFFERENTLY from HostBookingFilterRules: `.underReview` and
//     `.completed` are buckets of their own rather than folded away. Those two are the
//     whole reason a separate module exists rather than a reused one.
//   • What it does IDENTICALLY: the cancelled/refunded split, the clamping, the
//     unknown-status fallback. The last section holds the two side by side and asserts
//     they agree everywhere else, because a host and a guest reading one reservation
//     must never see it filed differently.
//
// This app has no XCTest target, so the suite is a plain executable over the same pure
// files the app compiles — no UIKit, no SwiftUI, no simulator:
//
//     cd mobile/ios && ./Tests/run.sh
//
// Exits non-zero on the first failure. `Tests/` is outside the target's `sources:` in
// project.yml, so none of this is compiled into the app.
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

typealias Rules = ReservationFilterRules
typealias Bucket = ReservationFilterRules.Bucket

/// The bucket under test, with the defaults most cases don't care about.
///
/// `wasPaid` defaults to TRUE so every case written before it existed keeps the meaning
/// it was written with ("a paid stay that was later refunded"). The never-paid half —
/// the bug the argument was added for — is spelled out explicitly below.
func bucketOf(
    _ status: String?,
    stage: PaymentFlowRules.Stage? = nil,
    refund: Int? = nil,
    wasPaid: Bool = true
) -> Bucket {
    Rules.bucket(for: Rules.Snapshot(
        status: status, paymentStage: stage, refundPercent: refund, wasPaid: wasPaid
    ))
}

/// Every stage `PaymentFlowRules` can produce — walked wherever "for any stage" matters.
let allStages: [PaymentFlowRules.Stage] = [.notPayable, .awaitingPayment, .underReview, .paid, .rejected]

// ---------------------------------------------------------------------------
print("the chip row")
// ---------------------------------------------------------------------------

check(ReservationFilter.allCases == [
    .all, .pending, .awaitingPayment, .underReview, .confirmed,
    .completed, .rejected, .cancelled, .refunded, .partiallyRefunded,
], "leads with All and walks the guest lifecycle to the ways it ends")

check(ReservationFilter.all.bucket == nil, "All selects no single bucket")
check(ReservationFilter.allCases.compactMap(\.bucket).count == Bucket.allCases.count,
      "every bucket has exactly one chip")

// A host caused one, the guest the other, and StatusBadge renders them apart.
check(ReservationFilter.allCases.contains(.rejected) && ReservationFilter.allCases.contains(.cancelled),
      "Rejected stays a chip of its own, not folded into Cancelled")

// ---------------------------------------------------------------------------
print("\nthe statuses")
// ---------------------------------------------------------------------------

check(bucketOf("pending") == .pending, "pending files by status")
check(bucketOf("rejected", stage: .awaitingPayment) == .rejected, "rejected files by status, ahead of any payment reading")

// A guest can upload a transfer before the host has even replied.
check(bucketOf("pending", stage: .underReview) == .pending, "a pending booking is pending whatever its stage says")
check(bucketOf("pending", stage: .paid) == .pending, "…including one already paid")

check(bucketOf("  PENDING ") == .pending, "status is read case- and whitespace-insensitively")
check(bucketOf("Cancelled", refund: 100) == .refunded, "…on the cancelled branch too")
check(bucketOf("canceled", refund: 100) == .refunded, "the American spelling is still a cancellation")

// Asymmetric failure modes: a row behind no chip is a booking the guest never finds.
for status in ["archived", "", nil] {
    check(bucketOf(status) == .pending, "\"\(status ?? "nil")\" reads as Pending rather than vanishing off every chip")
}

// ---------------------------------------------------------------------------
print("\nwhat the guest needs and the host does not")
// ---------------------------------------------------------------------------

check(bucketOf("confirmed", stage: .underReview) == .underReview,
      "a submitted screenshot is Under review, NOT Awaiting payment")
check(bucketOf("completed", stage: .paid) == .completed,
      "completed is its own chip — a guest goes looking for their trip history")
check(allStages.allSatisfy { bucketOf("completed", stage: $0) == .completed },
      "a completed stay keeps its chip whatever the payment stage now says")

// ---------------------------------------------------------------------------
print("\nthe confirmed split")
// ---------------------------------------------------------------------------

check(bucketOf("confirmed", stage: .paid) == .confirmed, "confirmed and paid is Confirmed")
for stage in [PaymentFlowRules.Stage.awaitingPayment, .rejected, .notPayable] {
    check(bucketOf("confirmed", stage: stage) == .awaitingPayment,
          "\(stage) on a confirmed booking means the guest still owes")
}
check(bucketOf("confirmed", stage: nil) == .awaitingPayment,
      "a missing stage is not a decision — it reads as still owing, never as paid")
check(allStages.allSatisfy { Bucket.allCases.contains(bucketOf("confirmed", stage: $0)) },
      "every stage the payment core can produce lands somewhere")

// ---------------------------------------------------------------------------
print("\nhow a cancellation splits")
// ---------------------------------------------------------------------------

check(bucketOf("cancelled", refund: 100) == .refunded, "100% back is Refunded")
for pct in [1, 25, 50, 99] {
    check(bucketOf("cancelled", refund: pct) == .partiallyRefunded, "\(pct)% back is Partially refunded")
}
check(bucketOf("cancelled", refund: 0) == .cancelled, "nothing back is a plain Cancelled, not a refund of zero")
check(bucketOf("cancelled", refund: nil) == .cancelled,
      "a cancellation from before the refund ladder shipped reads as Cancelled")
check(bucketOf("cancelled", refund: 140) == .refunded, "a percentage over 100 clamps rather than mis-filing")
check(bucketOf("cancelled", refund: -20) == .cancelled, "a negative percentage clamps to nothing back")

// ---------------------------------------------------------------------------
print("\na cancellation of a booking the guest never paid for")
// ---------------------------------------------------------------------------

// ⚠️ The bug `wasPaid` was added for. `refund_percent` is stamped from the listing's
// cancellation policy the moment a guest cancels, whether or not anything was ever paid
// — verified against the live endpoint: cancelling a pending, UNPAID booking a fortnight
// out wrote `refund_percent = 100`, and the guest's own Trips list told them the stay
// had been "Refunded". Money back that was never money in.
for pct in [1, 50, 99, 100] {
    check(bucketOf("cancelled", refund: pct, wasPaid: false) == .cancelled,
          "\(pct)% of nothing is a plain cancellation, not a refund")
}

check(bucketOf("confirmed", stage: .paid, wasPaid: false) == .confirmed,
      "wasPaid gates only the refund chips — it cannot move a live booking")
check(bucketOf("completed", stage: .paid, wasPaid: false) == .completed, "…nor a finished stay")
check(bucketOf("pending", wasPaid: false) == .pending, "…nor a pending one")
check(bucketOf("rejected", wasPaid: false) == .rejected, "…nor a declined one")

// And the host agrees, on both halves — the fix landed on one shared rule, not two.
check(hostBucketOf("cancelled", stage: .notPayable, refund: 100, wasPaid: false) == .cancelled,
      "the host reads a never-paid cancellation the same way")

// ---------------------------------------------------------------------------
print("\nmatches")
// ---------------------------------------------------------------------------

check(Bucket.allCases.allSatisfy { ReservationFilter.all.matches($0) }, "All takes every bucket")
check(ReservationFilter.confirmed.matches(.confirmed), "a chip takes its own bucket")
check(ReservationFilter.awaitingPayment.matches(.underReview) == false, "…and only its own")
check(ReservationFilter.cancelled.matches(.refunded) == false,
      "the refund chips do not double as Cancelled — the buckets partition All")

// ---------------------------------------------------------------------------
print("\ncounts")
// ---------------------------------------------------------------------------

let sample: [Bucket] = [
    bucketOf("pending"),
    bucketOf("pending"),
    bucketOf("confirmed", stage: .awaitingPayment),
    bucketOf("confirmed", stage: .underReview),
    bucketOf("confirmed", stage: .paid),
    bucketOf("completed", stage: .paid),
    bucketOf("rejected"),
    bucketOf("cancelled", refund: 0),
    bucketOf("cancelled", refund: 50),
    bucketOf("cancelled", refund: 100),
]
let counts = Rules.counts(sample)
check(counts[.pending] == 2, "pending counts 2")
check(counts[.awaitingPayment] == 1, "awaiting payment counts 1")
check(counts[.underReview] == 1, "under review counts 1")
check(counts[.confirmed] == 1, "confirmed counts 1")
check(counts[.completed] == 1, "completed counts 1")
check(counts[.rejected] == 1, "rejected counts 1")
check(counts[.cancelled] == 1, "cancelled counts 1")
check(counts[.partiallyRefunded] == 1, "partially refunded counts 1")
check(counts[.refunded] == 1, "refunded counts 1")

// A chip badged 0 is the answer; a chip badged nothing is one the guest has to tap.
let onlyPaid = Rules.counts([bucketOf("confirmed", stage: .paid)])
check(Bucket.allCases.allSatisfy { onlyPaid[$0] != nil }, "every bucket has a count, zeros included")
check(onlyPaid[.refunded] == 0, "an empty bucket reads 0 rather than going missing")

let none = Rules.counts([])
check(Bucket.allCases.allSatisfy { none[$0] == 0 }, "no reservations at all means every chip reads zero")

// The property that keeps the badge honest: what a chip says is what it shows.
for filter in ReservationFilter.allCases {
    let shown = sample.filter { filter.matches($0) }.count
    let badged = filter == .all ? sample.count : (counts[filter.bucket!] ?? 0)
    check(badged == shown, "\(filter.rawValue) is badged what it would actually show")
}

let partition = Bucket.allCases.reduce(0) { $0 + (counts[$1] ?? 0) }
check(partition == sample.count, "the buckets partition All — every reservation is behind exactly one chip")

// ---------------------------------------------------------------------------
print("\nthe guest and host folds agree wherever they must")
// ---------------------------------------------------------------------------

func hostBucketOf(_ status: String?, stage: PaymentFlowRules.Stage?, refund: Int?, wasPaid: Bool = true) -> HostBookingFilterRules.Bucket {
    HostBookingFilterRules.bucket(for: HostBookingFilterRules.Snapshot(
        status: status, paymentStage: stage, refundPercent: refund, wasPaid: wasPaid
    ))
}

/// The host bucket a guest bucket should equal, where the two vocabularies overlap.
func hostTwin(of bucket: Bucket) -> HostBookingFilterRules.Bucket? {
    switch bucket {
    case .pending:           return .pending
    case .awaitingPayment:   return .awaitingPayment
    case .confirmed:         return .confirmed
    case .rejected:          return .rejected
    case .cancelled:         return .cancelled
    case .refunded:          return .refunded
    case .partiallyRefunded: return .partiallyRefunded
    // The two the guest has and the host does not.
    case .underReview, .completed: return nil
    }
}

let statuses: [String?] = ["pending", "confirmed", "completed", "rejected", "cancelled", "canceled", "archived", "", nil]
let refunds: [Int?] = [nil, 0, 1, 50, 99, 100, 140, -20]
var divergences: [String] = []
var compared = 0
for status in statuses {
    for stage in allStages {
        for refund in refunds {
        for paid in [true, false] {
            let guest = bucketOf(status, stage: stage, refund: refund, wasPaid: paid)
            let host = hostBucketOf(status, stage: stage, refund: refund, wasPaid: paid)
            compared += 1
            // The two deliberate divergences, and nothing else.
            let s = (status ?? "").lowercased()
            if s == "completed" || (s == "confirmed" && stage == .underReview) { continue }
            if hostTwin(of: guest) != host {
                divergences.append("\(status ?? "nil")/\(stage)/\(String(describing: refund))/\(paid): \(guest) vs \(host)")
            }
        }
        }
    }
}
check(compared == statuses.count * allStages.count * refunds.count * 2, "the whole matrix was walked")
check(divergences.isEmpty,
      "the two folds agree everywhere but the two documented divergences"
      + (divergences.isEmpty ? "" : " — \(divergences.prefix(4).joined(separator: "; "))"))

// The divergences themselves, asserted rather than merely tolerated: if either ever
// starts agreeing, the guest has silently lost a chip this module was written to give.
check(bucketOf("confirmed", stage: .underReview) == .underReview
      && hostBucketOf("confirmed", stage: .underReview, refund: nil) == .awaitingPayment,
      "DIVERGES on under review: a chip for the guest, awaiting payment for the host")
check(bucketOf("completed", stage: .paid) == .completed
      && hostBucketOf("completed", stage: .paid, refund: nil) == .confirmed,
      "DIVERGES on completed: a chip for the guest, folded into confirmed for the host")

// ---------------------------------------------------------------------------
print(failures == 0 ? "\n✅ ALL \(checks) PASSED\n" : "\n❌ \(failures) of \(checks) FAILED\n")
exit(failures == 0 ? 0 : 1)
