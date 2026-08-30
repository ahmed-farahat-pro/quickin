// Unit tests for Sources/HostBookingFilterRules.swift — the Swift mirror of the web's
// src/lib/local/host-booking-filter-core.ts.
//
// The reported defect: **[Android] Reservation filters are missing for Host.** A host had
// no way to narrow their reservations by status — but the fix was never only a chip row.
// Three of the buckets a host thinks in (Awaiting payment, Refunded, Partially refunded)
// are NOT values of `bookings.status`; they are folded out of `payment_status`, the
// latest payment proof, and `refund_percent`. Three clients each hand-rolling that fold
// is how a host ends up with three different answers to "how many reservations are
// waiting on payment", so the fold is one rule, ported, and pinned here.
//
// The checks that matter most are the ones asserting a cancelled or rejected reservation
// NEVER lands under "Awaiting payment". That chip is a to-do list of money still owed;
// a dead booking sitting in it is a host chasing a guest for a stay that no longer exists.
//
// This app has no XCTest target, so the suite is a plain executable over the same pure
// files the app compiles — no UIKit, no SwiftUI, no simulator:
//
//     cd mobile/ios && ./Tests/run.sh
//
// Exits non-zero if anything fails. `Tests/` is outside the target's `sources:` in
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

/// A reservation as the fold sees one. Named arguments keep each case readable —
/// the whole point is which COMBINATION of columns produces which bucket.
/// `wasPaid` defaults to TRUE here so every case written before it existed keeps the
/// meaning it was written with ("a paid stay that was later refunded"). The never-paid
/// half — the bug the argument was added for — is spelled out explicitly below.
func snap(
    status: String? = "confirmed",
    stage: PaymentFlowRules.Stage? = nil,
    refundPercent: Int? = nil,
    wasPaid: Bool = true
) -> HostBookingFilterRules.Snapshot {
    HostBookingFilterRules.Snapshot(
        status: status, paymentStage: stage, refundPercent: refundPercent, wasPaid: wasPaid
    )
}

func bucket(_ s: HostBookingFilterRules.Snapshot) -> HostBookingFilterRules.Bucket {
    HostBookingFilterRules.bucket(for: s)
}

// ---------------------------------------------------------------------------
print("\nthe chip row")
// ---------------------------------------------------------------------------

check(HostBookingFilter.allCases.map(\.rawValue) == [
    "all", "pending", "awaitingPayment", "confirmed",
    "rejected", "cancelled", "refunded", "partiallyRefunded",
], "leads with All, then the host lifecycle in reading order")

// A host declined the one and a guest cancelled the other. Folding them together
// would make both counts lie.
check(HostBookingFilter.allCases.contains(.rejected), "declined is its own chip")
check(HostBookingFilter.allCases.contains(.cancelled), "cancelled is its own chip")

check(HostBookingFilter.all.bucket == nil, "All maps to no single bucket")
for chip in HostBookingFilter.allCases where chip != .all {
    check(chip.bucket != nil, "the \(chip.rawValue) chip names a bucket")
}

// Every bucket must be reachable, or a chip sits there selecting nothing forever.
let reachable: Set<HostBookingFilterRules.Bucket> = [
    bucket(snap(status: "pending")),
    bucket(snap(status: "confirmed", stage: .awaitingPayment)),
    bucket(snap(status: "confirmed", stage: .paid)),
    bucket(snap(status: "rejected")),
    bucket(snap(status: "cancelled", refundPercent: 0)),
    bucket(snap(status: "cancelled", refundPercent: 100)),
    bucket(snap(status: "cancelled", refundPercent: 50)),
]
for case let b in HostBookingFilterRules.Bucket.allCases {
    check(reachable.contains(b), "some reservation can reach the \(b.rawValue) bucket")
}

// ---------------------------------------------------------------------------
print("\nwhich bucket a reservation lands in")
// ---------------------------------------------------------------------------

check(bucket(snap(status: "pending")) == .pending, "a request waiting on the host is pending")
// A guest can upload a transfer screenshot before the host has replied. That is
// still a request waiting on the host, not money waiting on the guest.
check(bucket(snap(status: "pending", stage: .underReview)) == .pending,
      "pending wins even when a transfer is already under review")

check(bucket(snap(status: "confirmed", stage: .paid)) == .confirmed, "confirmed and paid is confirmed")
for stage: PaymentFlowRules.Stage in [.awaitingPayment, .underReview, .rejected, .notPayable] {
    check(bucket(snap(status: "confirmed", stage: stage)) == .awaitingPayment,
          "confirmed at stage \(stage.rawValue) is awaiting payment")
}

// A client that has not wired the payment columns through must not have every
// confirmed reservation silently claim the money arrived.
check(bucket(snap(status: "confirmed", stage: nil)) == .awaitingPayment,
      "a missing payment stage reads as unpaid, not paid")

check(bucket(snap(status: "completed", stage: .paid)) == .confirmed, "completed folds into confirmed")

check(bucket(snap(status: "rejected")) == .rejected, "a host decline is rejected")
check(bucket(snap(status: "rejected", stage: .paid)) == .rejected,
      "a host decline stays rejected even if the money had landed")

// The regression this whole ordering exists to prevent.
for status in ["cancelled", "rejected"] {
    for stage: PaymentFlowRules.Stage in [.notPayable, .awaitingPayment, .underReview, .paid, .rejected] {
        check(bucket(snap(status: status, stage: stage, refundPercent: 40)) != .awaitingPayment,
              "a \(status) reservation at stage \(stage.rawValue) is never awaiting payment")
    }
}

// bookings.status has no check constraint. A row that matches no chip is a
// reservation the host never sees; one under Pending is one they dismiss.
for unknown in ["expired", "", "   "] {
    check(bucket(snap(status: unknown)) == .pending,
          "the unknown status \"\(unknown)\" reads as pending rather than vanishing")
}
check(bucket(snap(status: nil)) == .pending, "a missing status reads as pending")

check(bucket(snap(status: "  Cancelled ")) == .cancelled, "status is trimmed and lowercased")
check(bucket(snap(status: "REJECTED")) == .rejected, "status case does not matter")
check(bucket(snap(status: "canceled", refundPercent: 100)) == .refunded,
      "the American spelling of cancelled is understood")

// ---------------------------------------------------------------------------
print("\nhow a cancellation splits on the refund")
// ---------------------------------------------------------------------------

check(bucket(snap(status: "cancelled", refundPercent: 100)) == .refunded, "a full refund is refunded")
for pct in [1, 25, 50, 99] {
    check(bucket(snap(status: "cancelled", refundPercent: pct)) == .partiallyRefunded,
          "\(pct)% back is partially refunded")
}
check(bucket(snap(status: "cancelled", refundPercent: 0)) == .cancelled,
      "a strict-policy cancellation with nothing back is plain cancelled")
// Legacy rows have no refund_percent. Reporting them as "Refunded" would tell the
// host money moved when nothing was ever recorded.
check(bucket(snap(status: "cancelled", refundPercent: nil)) == .cancelled,
      "a cancellation from before the refund ladder is plain cancelled")
check(bucket(snap(status: "cancelled", refundPercent: 140)) == .refunded, "an over-100 percent is clamped")
check(bucket(snap(status: "cancelled", refundPercent: -5)) == .cancelled, "a negative percent is clamped")

// refund_percent is only ever written alongside a cancellation, but a stray value
// must not pull a live reservation out of its bucket.
check(bucket(snap(status: "confirmed", stage: .paid, refundPercent: 100)) == .confirmed,
      "the refund never splits a live confirmed booking")
check(bucket(snap(status: "pending", refundPercent: 50)) == .pending,
      "the refund never splits a pending request")

// ---------------------------------------------------------------------------
print("\nwhat each chip selects")
// ---------------------------------------------------------------------------

for b in HostBookingFilterRules.Bucket.allCases {
    check(HostBookingFilter.all.matches(b), "All takes the \(b.rawValue) bucket")
}
check(HostBookingFilter.refunded.matches(.refunded), "the Refunded chip takes refunded")
check(!HostBookingFilter.refunded.matches(.partiallyRefunded),
      "the Refunded chip does NOT take partially refunded")
check(!HostBookingFilter.cancelled.matches(.rejected), "the Cancelled chip does NOT take declined")

// ---------------------------------------------------------------------------
print("\nthe counts behind each chip")
// ---------------------------------------------------------------------------

let tally = HostBookingFilterRules.counts([
    .pending, .pending, .awaitingPayment, .confirmed, .confirmed, .confirmed,
    .rejected, .cancelled, .refunded, .partiallyRefunded,
])
check(tally[.pending] == 2, "pending counts 2")
check(tally[.awaitingPayment] == 1, "awaiting payment counts 1")
check(tally[.confirmed] == 3, "confirmed counts 3")
check(tally[.rejected] == 1, "declined counts 1")
check(tally[.cancelled] == 1, "cancelled counts 1")
check(tally[.refunded] == 1, "refunded counts 1")
check(tally[.partiallyRefunded] == 1, "partially refunded counts 1")
check(tally.values.reduce(0, +) == 10,
      "the buckets sum to the total — every reservation is in exactly one")

// A chip whose count is missing renders blank; a chip whose count is zero says so.
let sparse = HostBookingFilterRules.counts([.pending])
for b in HostBookingFilterRules.Bucket.allCases {
    check(sparse[b] != nil, "the \(b.rawValue) chip reads a count rather than nothing")
}
check(sparse[.refunded] == 0, "a chip with nothing behind it reads zero")

let none = HostBookingFilterRules.counts([])
check(none.values.reduce(0, +) == 0, "an empty list counts zero everywhere")

// ---------------------------------------------------------------------------
print("\nend to end, against the real payment fold")
// ---------------------------------------------------------------------------

/// Composing `PaymentFlowRules.stage(for:)` with the bucket fold is how the screen
/// uses this, so the seam gets its own coverage rather than only the halves.
func endToEnd(
    status: String,
    paymentState: String? = nil,
    proofStatus: String? = nil,
    paidAt: String? = nil,
    refundPercent: Int? = nil
) -> HostBookingFilterRules.Bucket {
    let stage = PaymentFlowRules.stage(for: PaymentFlowRules.Snapshot(
        status: status, paymentState: paymentState, proofStatus: proofStatus, paidAt: paidAt
    ))
    let snapshot = PaymentFlowRules.Snapshot(
        status: status, paymentState: paymentState, proofStatus: proofStatus, paidAt: paidAt
    )
    return HostBookingFilterRules.bucket(for: HostBookingFilterRules.Snapshot(
        status: status, paymentStage: stage, refundPercent: refundPercent,
        wasPaid: PaymentFlowRules.everPaid(snapshot)
    ))
}

check(endToEnd(status: "confirmed", paymentState: "submitted", proofStatus: "submitted") == .awaitingPayment,
      "a guest who has transferred but not been reviewed is still awaiting payment")
check(endToEnd(status: "confirmed", paymentState: "paid", paidAt: "2026-08-01T00:00:00Z") == .confirmed,
      "an approved transfer moves the reservation to confirmed")
// Turning down a blurry transfer must not read as the host rejecting the stay.
check(endToEnd(status: "confirmed", paymentState: "rejected", proofStatus: "rejected") == .awaitingPayment,
      "a declined screenshot leaves the reservation awaiting payment, not declined")
check(endToEnd(status: "cancelled", paymentState: "paid", paidAt: "2026-08-01T00:00:00Z", refundPercent: 50)
        == .partiallyRefunded,
      "a paid stay the guest later cancelled reads by its refund")

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
print("\na cancellation of a booking nobody ever paid for")
// ---------------------------------------------------------------------------

// ⚠️ The bug `wasPaid` was added for. `refund_percent` is stamped from the listing's
// cancellation policy the moment a guest cancels, whether or not anything was ever paid
// — verified against the live endpoint: cancelling a pending, UNPAID booking a fortnight
// out wrote `refund_percent = 100`, and the chip read "Refunded" to a host who had never
// received a pound.
for pct in [1, 50, 99, 100] {
    check(bucket(snap(status: "cancelled", refundPercent: pct, wasPaid: false)) == .cancelled,
          "\(pct)% of nothing is a plain cancellation, not a refund")
}

check(bucket(snap(status: "confirmed", stage: .paid, wasPaid: false)) == .confirmed,
      "wasPaid gates only the refund chips — it cannot move a live booking")
check(bucket(snap(status: "pending", wasPaid: false)) == .pending, "…nor a pending one")
check(bucket(snap(status: "rejected", wasPaid: false)) == .rejected, "…nor a declined one")

// End to end, in the shape the database actually produces.
check(endToEnd(status: "cancelled", paymentState: "unpaid", refundPercent: 100) == .cancelled,
      "a booking cancelled before anyone paid is cancelled, not refunded")
// ⚠️ The paid_at trap through the whole composition: a refund clears paid_at, so the
// payment column is the only thing that still knows money moved.
check(endToEnd(status: "cancelled", paymentState: "refunded", paidAt: nil, refundPercent: 100) == .refunded,
      "a legacy refunded booking is still found once paid_at has been wiped")

print(failures == 0 ? "\n✅ ALL \(checks) PASSED\n" : "\n❌ \(failures) of \(checks) FAILED\n")
exit(failures == 0 ? 0 : 1)
