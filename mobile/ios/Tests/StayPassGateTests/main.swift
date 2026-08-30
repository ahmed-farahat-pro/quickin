// Unit tests for `PaymentFlowRules.isLiveStayPass` — THE rule deciding whether a
// reservation has a stay pass (the QR, the Apple Wallet pass, the public /stay/<code>
// page, and the host-authored guide behind it).
//
// The reported defect: **[iOS] Host receives reservation pass before guest completes
// payment.** A guest requested a stay, the host tapped Approve, and the pass was there
// immediately — on the host's screen and the guest's — with no money transferred.
//
// The cause was the gate reading `status == confirmed`. That status only means the host
// accepted the request: the reservation code is minted at exactly that transition and
// the guest pays AFTERWARDS (the backend refuses to take payment on a pending booking).
// So `confirmed` is the moment the pass USED to appear and precisely the moment it must
// not. This file pins the corrected rule — confirmed AND paid, or completed.
//
// The Swift copy of the backend's `test/unit/stay-pass-core.test.mjs` (and of the web
// repo's copy of it), with Android carrying a fourth in `StayPassGateTest.kt`. A change
// to the rule belongs in all of them, and these suites are what notice when it isn't.
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

/// A booking as the API returns one. Defaults to the exact shape the bug report
/// describes: the host has approved, and nothing has been paid.
func snap(
    status: String? = "confirmed",
    paymentState: String? = "unpaid",
    proofStatus: String? = nil,
    paidAt: String? = nil
) -> PaymentFlowRules.Snapshot {
    PaymentFlowRules.Snapshot(
        status: status, paymentState: paymentState, proofStatus: proofStatus, paidAt: paidAt
    )
}

let live = PaymentFlowRules.isLiveStayPass

// ---------------------------------------------------------------------------
print("\nthe host-approved-but-unpaid hole — the reported defect")
// ---------------------------------------------------------------------------

check(live(snap()) == false,
      "a host-approved booking with nothing paid has NO pass")
// Money in the ops queue is not money in the account.
check(live(snap(paymentState: "submitted")) == false,
      "a screenshot merely submitted does not open the pass")
check(live(snap(proofStatus: "submitted")) == false,
      "…nor does a proof row still awaiting review")
check(live(snap(paymentState: "disputed")) == false,
      "an escalated dispute does not open the pass")
check(live(snap(paymentState: "rejected")) == false,
      "a turned-down transfer does not open the pass")
check(live(snap(proofStatus: "rejected")) == false,
      "…nor does a rejected proof whose rollup never landed")

// ---------------------------------------------------------------------------
print("\nwhat DOES open it")
// ---------------------------------------------------------------------------

check(live(snap(paymentState: "paid")) == true,
      "an approved payment opens the pass")
check(live(snap(proofStatus: "approved")) == true,
      "an approved proof opens it even if the rollup never landed")
check(live(snap(paidAt: "2026-08-26T10:00:00Z")) == true,
      "a stamped paid_at opens it on its own")

// ---------------------------------------------------------------------------
print("\nbooking status")
// ---------------------------------------------------------------------------

check(live(snap(status: "pending")) == false,
      "a pending request has no pass")
check(live(snap(status: "pending", paymentState: "paid")) == false,
      "…and cannot buy one: the host hasn't accepted yet")
for gone in ["cancelled", "rejected"] {
    check(live(snap(status: gone, paymentState: "paid")) == false,
          "a \(gone) booking keeps its code but loses the pass, even when paid")
}
// Deliberate: the pass is the guest's receipt of a stay that is over, and rows
// predating this rule must not lose it retroactively.
check(live(snap(status: "completed", paymentState: "unpaid")) == true,
      "completed keeps its pass unconditionally — the stay happened")
check(live(snap(status: "completed", paymentState: "paid")) == true,
      "…paid or not")

// ---------------------------------------------------------------------------
print("\nsloppy inputs")
// ---------------------------------------------------------------------------

check(live(snap(status: " CONFIRMED ", paymentState: "paid")) == true,
      "status is compared case- and whitespace-insensitively")
check(live(snap(status: "Completed")) == true, "…so is completed")
for junk in [nil, "", "garbage"] {
    check(live(snap(status: junk, paymentState: "paid")) == false,
          "\(junk.map { "\"\($0)\"" } ?? "nil") is not a status that has a pass")
}
// JSON null collapsing to the string "null" is how /stay/null shipped once already.
check(live(snap(paidAt: "null")) == false, "a \"null\" paid_at does not open the pass")
check(live(snap(paidAt: "   ")) == false, "a blank paid_at does not open the pass")

// ---------------------------------------------------------------------------
print(failures == 0 ? "\n✅ ALL \(checks) PASSED\n" : "\n❌ \(failures) of \(checks) FAILED\n")
exit(failures == 0 ? 0 : 1)
