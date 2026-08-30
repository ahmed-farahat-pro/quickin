// Unit tests for Sources/PaymentFlowRules.swift — the Swift mirror of the backend's
// src/lib/local/payment-flow-core.ts (`paymentStageFor` / `canPay`).
//
// The reported defect: **[iOS] Payment rejection reason is not displayed to the guest.**
// An admin turned a transfer down with a written reason, and the reservation screen went
// straight back to a bare "Pay now" card — the same card it shows a guest who has never
// paid at all. Nothing said the screenshot had been rejected, and nothing said why, so
// the guest's only move was to upload the identical unreadable photo again.
//
// The cause was iOS deciding payment state by hand: `payment_status == "submitted"` was
// the only case it knew, so `rejected` fell through the `else` into "Pay now". This file
// pins the stage rule instead, and in particular that `rejected` is BOTH its own stage
// (so the screen can explain it) and still payable (so the reservation survives it).
//
// This app has no XCTest target, so the suite is a plain executable over the same pure
// file the app compiles — no UIKit, no SwiftUI, no simulator:
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

/// A booking as the API returns one. Named arguments keep each case readable —
/// the whole point is which COMBINATION of columns produces which stage.
func snap(
    status: String? = "confirmed",
    paymentState: String? = nil,
    proofStatus: String? = nil,
    paidAt: String? = nil
) -> PaymentFlowRules.Snapshot {
    PaymentFlowRules.Snapshot(
        status: status, paymentState: paymentState, proofStatus: proofStatus, paidAt: paidAt
    )
}

func stage(_ s: PaymentFlowRules.Snapshot) -> PaymentFlowRules.Stage {
    PaymentFlowRules.stage(for: s)
}

// ---------------------------------------------------------------------------
print("\nthe bug this file exists for — a rejection is not \"unpaid\"")
// ---------------------------------------------------------------------------

// Either column alone is enough. A half-applied write (rollup updated, proof not, or the
// reverse) is still a rejection the guest has to be told about.
check(stage(snap(paymentState: "rejected")) == .rejected,
      "payment_status 'rejected' is its own stage, not awaitingPayment")
check(stage(snap(proofStatus: "rejected")) == .rejected,
      "a rejected proof is a rejection even when the rollup never landed")
check(stage(snap(paymentState: "rejected", proofStatus: "rejected")) == .rejected,
      "both columns agreeing reads the same way")

// The distinction the old code could not draw: these two are NOT the same screen.
check(stage(snap(paymentState: "unpaid")) == .awaitingPayment,
      "never paid is awaitingPayment")
check(stage(snap(paymentState: "rejected")) != stage(snap(paymentState: "unpaid")),
      "a rejected transfer and a never-paid one are different stages")

// And the other half of the fix: rejecting a blurry photo must not kill the booking.
check(PaymentFlowRules.canPay(snap(paymentState: "rejected")),
      "a rejected payment is still payable — the guest re-uploads")

// ---------------------------------------------------------------------------
print("\nthe rest of the ladder, in the server's order")
// ---------------------------------------------------------------------------

check(stage(snap(paymentState: "paid")) == .paid, "paid rollup is paid")
check(stage(snap(proofStatus: "approved")) == .paid, "an approved proof is paid")
check(stage(snap(paidAt: "2026-08-20T10:00:00Z")) == .paid, "a paid_at stamp is paid")
check(stage(snap(paymentState: "submitted")) == .underReview, "a submitted transfer is under review")
check(stage(snap(proofStatus: "submitted")) == .underReview, "a submitted proof is under review")

// An escalated dispute is still with us, not back with the guest — offering "Pay now"
// there invites a second transfer for a booking that may be about to be marked paid.
check(stage(snap(paymentState: "disputed")) == .underReview, "a disputed payment is under review")
check(stage(snap(proofStatus: "disputed")) == .underReview, "a disputed proof is under review")
check(!PaymentFlowRules.canPay(snap(paymentState: "disputed")), "a dispute under review is not payable")

// Paid wins over everything above it — an approval after a dispute is the final word.
check(stage(snap(paymentState: "paid", proofStatus: "disputed")) == .paid, "paid outranks a disputed proof")
check(stage(snap(paymentState: "rejected", proofStatus: "approved")) == .paid, "an approved proof outranks a stale rejection")

// ---------------------------------------------------------------------------
print("\nwho may pay at all")
// ---------------------------------------------------------------------------

// Payment opens at the host's approval, not at the request.
check(stage(snap(status: "pending")) == .notPayable, "a pending request is not payable")
check(stage(snap(status: "pending", paymentState: "unpaid")) == .notPayable, "…whatever its payment columns say")

// A booking that is gone can't be paid, even carrying a live rejection.
for gone in ["cancelled", "rejected"] {
    check(stage(snap(status: gone, paymentState: "rejected")) == .notPayable,
          "a \(gone) booking is not payable")
    check(!PaymentFlowRules.canPay(snap(status: gone, paymentState: "rejected")),
          "…and offers no pay button")
}
// …but a cancelled booking that was genuinely paid still reads as paid, so a refund
// screen is never told the money never arrived.
check(stage(snap(status: "cancelled", paymentState: "paid")) == .paid,
      "a cancelled booking that was paid is still paid")

// ---------------------------------------------------------------------------
print("\nsloppy input, from older rows and other writers")
// ---------------------------------------------------------------------------

check(stage(snap(paymentState: nil, proofStatus: nil)) == .awaitingPayment,
      "missing payment columns read as unpaid, not as a rejection")
check(stage(snap(paymentState: "  REJECTED  ")) == .rejected, "case and padding are normalized")
check(stage(snap(paymentState: "garbage")) == .awaitingPayment, "an unknown state falls back to unpaid")
check(stage(snap(proofStatus: "garbage")) == .awaitingPayment, "an unknown proof status is no proof at all")
// The retired Paymob path still wrote these; none of them means "rejected by a reviewer".
for legacy in ["pending", "failed", "refunded", "voided"] {
    check(stage(snap(paymentState: legacy)) == .awaitingPayment,
          "legacy gateway state '\(legacy)' is not a rejection")
}
// JSON null collapsing to the string "null" is how /stay/null shipped once already.
check(stage(snap(paidAt: "null")) == .awaitingPayment, "a \"null\" paid_at is not a payment")
check(stage(snap(paidAt: "   ")) == .awaitingPayment, "a blank paid_at is not a payment")

// ---------------------------------------------------------------------------
print("\nthe reason itself")
// ---------------------------------------------------------------------------

check(PaymentFlowRules.rejectReasonText("The amount doesn't match") == "The amount doesn't match",
      "the admin's words are passed through verbatim")
check(PaymentFlowRules.rejectReasonText("  screenshot is unreadable  ") == "screenshot is unreadable",
      "surrounding whitespace is trimmed")
// Each of these must fall back to the generic line rather than printing itself at the guest.
for empty in [nil, "", "   ", "null", "NULL"] {
    check(PaymentFlowRules.rejectReasonText(empty) == nil,
          "\(empty.map { "\"\($0)\"" } ?? "nil") is no reason at all")
}

// ---------------------------------------------------------------------------
print(failures == 0 ? "\n✅ ALL \(checks) PASSED\n" : "\n❌ \(failures) of \(checks) FAILED\n")
exit(failures == 0 ? 0 : 1)
