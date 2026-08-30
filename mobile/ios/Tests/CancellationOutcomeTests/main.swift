// Unit tests for Sources/CancellationOutcome.swift — the Swift mirror of the backend's
// refundOutcomeFor (test/unit/cancellation-core.test.mjs) and of Android's
// CancellationOutcomeTest.kt.
//
// The reported defect: **a cancelled reservation did not say what happened to the money.**
// A guest who cancelled 10 days out and got everything back, one who cancelled 2 days out
// and got half, and one who cancelled on the morning of check-in and got nothing all read
// "Cancelled" — on their own screen and on the host's.
//
// The case that is easy to get wrong, and is tested hardest here, is the UNPAID one: the
// refund ladder quotes a percentage for every cancellation whether or not any money was
// ever transferred, so a pending request called off early is "owed" 100% of nothing.
//
// This app has no XCTest target, so the suite is a plain executable over the same pure file
// the app compiles — no UIKit, no SwiftUI, no simulator:
//
//     cd mobile/ios && ./Tests/run.sh
//
// Exits non-zero if any check fails. `Tests/` is outside the target's `sources:` in
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

func outcome(_ status: String?, _ percent: Int?, paid: Bool) -> CancellationOutcome {
    CancellationOutcome.of(status: status, refundPercent: percent, paid: paid)
}

print("A live booking has no ending to show")
for status in ["pending", "confirmed", "completed", "rejected", nil] {
    check(outcome(status, 100, paid: true) == .open, "\(status ?? "nil") → open")
}

print("\nWhat came back decides the word")
check(outcome("cancelled", 100, paid: true) == .refunded, "100% → refunded")
check(outcome("cancelled", 50, paid: true) == .partiallyRefunded, "50% → partially refunded")
check(outcome("cancelled", 99, paid: true) == .partiallyRefunded, "99% → partially refunded")
check(outcome("cancelled", 1, paid: true) == .partiallyRefunded, "1% → partially refunded")
check(outcome("cancelled", 0, paid: true) == .cancelled, "0% → plain cancelled")

print("\nAn UNPAID cancellation is plain 'cancelled', whatever the ladder quoted")
// The ladder answers a percentage for every cancellation, paid or not. Telling a guest
// who never transferred anything that they were "Refunded" claims money came back that
// was never taken.
check(outcome("cancelled", 100, paid: false) == .cancelled, "100% but never paid → cancelled")
check(outcome("cancelled", 50, paid: false) == .cancelled, "50% but never paid → cancelled")

print("\nA missing refund is no refund, never an invented one")
// Admin cancellations and rows written before refund_percent existed. Guessing here is
// the one mistake with a cash cost.
check(outcome("cancelled", nil, paid: true) == .cancelled, "nil percent → cancelled")

print("\nThe status is read leniently")
check(outcome("  Cancelled  ", 100, paid: true) == .refunded, "padded + capitalised")
check(outcome("canceled", 100, paid: true) == .refunded, "the one-l spelling counts too")

print("\nOnly the money endings replace the plain badge")
check(CancellationOutcome.refunded.isRefund, "refunded is a refund")
check(CancellationOutcome.partiallyRefunded.isRefund, "partially refunded is a refund")
check(!CancellationOutcome.cancelled.isRefund, "a no-refund cancellation is not")
check(!CancellationOutcome.open.isRefund, "a live booking is not")
check(CancellationOutcome.open.labelKey == nil, "open has no label of its own")
check(CancellationOutcome.refunded.labelKey == "status.refunded", "refunded's key")
check(CancellationOutcome.partiallyRefunded.labelKey == "status.partiallyRefunded", "partial's key")

print("\n\(checks - failures)/\(checks) checks passed")
if failures > 0 {
    print("\(failures) FAILED")
    exit(1)
}
