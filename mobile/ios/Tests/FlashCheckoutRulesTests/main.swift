// Unit tests for Sources/FlashCheckoutRules.swift — the guest's Flash (card / wallet)
// checkout in the payment sheet.
//
// Flash has no return URL, so the app learns a payment went through only by polling
// the booking's flash-checkout status. What matters here: `paid` from the server always
// wins; a declined card while the hosted page is still open is not final (the guest
// can retry on that page); and once the page is closed only an in-flight checkout is
// worth polling, never longer than 15 minutes.
//
// This app has no XCTest target, so the suite is a plain executable over the same pure
// file the app compiles — no UIKit, no SwiftUI, no simulator:
//
//     cd mobile/ios && ./Tests/run.sh
//
// Exits non-zero if any check fails.
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

typealias R = FlashCheckoutRules

print("Status vocabulary")
check(R.normalizeStatus("pending") == .pending, "pending is pending")
check(R.normalizeStatus("  SUCCEEDED ") == .succeeded, "case and padding are normalized")
check(R.normalizeStatus("cancelled") == .canceled, "the British spelling is canceled")
check(R.normalizeStatus("garbage") == .none, "an unknown status is none")
check(R.normalizeStatus(nil) == .none, "a missing status is none")

print("\nStage")
check(R.stage(status: "none", paid: false) == .start, "no checkout yet → start")
check(R.stage(status: nil, paid: false) == .start, "missing status → start")
check(R.stage(status: "pending", paid: false) == .waiting, "pending → waiting")
check(R.stage(status: "processing", paid: false) == .waiting, "processing → waiting")
check(R.stage(status: "succeeded", paid: false) == .waiting,
      "succeeded but not yet paid on the booking → still waiting, never a premature success")
for s in ["failed", "canceled", "expired", "refunded"] {
    check(R.stage(status: s, paid: false) == .retry, "\(s) with paid false → retry")
}
for s in ["succeeded", "pending", "refunded", "none", "garbage"] {
    check(R.stage(status: s, paid: true) == .paid, "paid true wins over status '\(s)'")
}

print("\nWho may start a checkout")
check(R.canStartCheckout(.start), "start may pay")
check(R.canStartCheckout(.retry), "retry may pay again (a new link is minted)")
check(!R.canStartCheckout(.waiting), "waiting may not start a second checkout")
check(!R.canStartCheckout(.paid), "paid may not pay twice")

print("\nRetry explanations")
check(R.messageKey(status: "failed", paid: false) == "flash.failed", "failed explains itself")
check(R.messageKey(status: "canceled", paid: false) == "flash.canceled", "canceled explains itself")
check(R.messageKey(status: "expired", paid: false) == "flash.expired", "expired explains itself")
check(R.messageKey(status: "refunded", paid: false) == "flash.refunded", "refunded explains itself")
check(R.messageKey(status: "pending", paid: false) == nil, "pending needs no explanation")
check(R.messageKey(status: "failed", paid: true) == nil, "nothing to explain once paid")

print("\nPolling")
check(!R.shouldKeepPolling(stage: .paid, elapsed: 10, checkoutOpen: true), "stops once paid, even with the page open")
check(R.shouldKeepPolling(stage: .waiting, elapsed: 10, checkoutOpen: false), "keeps polling a checkout in flight")
check(R.shouldKeepPolling(stage: .retry, elapsed: 10, checkoutOpen: true),
      "a decline while the page is open is not final — the guest can retry there")
check(!R.shouldKeepPolling(stage: .retry, elapsed: 10, checkoutOpen: false), "a decline after the page closed stops polling")
check(R.shouldKeepPolling(stage: .start, elapsed: 0, checkoutOpen: true), "page just opened, nothing recorded yet → poll")
check(!R.shouldKeepPolling(stage: .start, elapsed: 10, checkoutOpen: false), "no checkout and no page → nothing to poll")
check(R.shouldKeepPolling(stage: .waiting, elapsed: R.pollTimeout - 1, checkoutOpen: false), "just inside 15 min → poll")
check(!R.shouldKeepPolling(stage: .waiting, elapsed: R.pollTimeout, checkoutOpen: false), "15 min → give up")
check(!R.shouldKeepPolling(stage: .waiting, elapsed: R.pollTimeout + 60, checkoutOpen: true), "timeout applies with the page open too")
check(R.pollInterval == 3, "polls every 3 seconds")

print("\nCheckout link")
check(R.checkoutURL("https://pay.useflash.app/l/abc")?.host == "pay.useflash.app", "an https link is used")
check(R.checkoutURL("  https://pay.useflash.app/l/abc  ") != nil, "padding is trimmed")
check(R.checkoutURL("http://pay.useflash.app/l/abc") == nil, "plain http is refused")
check(R.checkoutURL("javascript:alert(1)") == nil, "a script URL is refused")
check(R.checkoutURL("") == nil, "empty is no link")
check(R.checkoutURL(nil) == nil, "missing is no link")

print(failures == 0 ? "\n✅ ALL \(checks) PASSED\n" : "\n❌ \(failures) of \(checks) FAILED\n")
exit(failures == 0 ? 0 : 1)
