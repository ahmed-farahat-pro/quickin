// Unit tests for Sources/ListingPricingRules.swift — the Swift mirror of the backend's
// test/unit/listing-pricing-core.test.mjs and of Android's ListingPricingRulesTest.kt.
//
// The reported defect: **Weekend and Seasonal pricing accepted `0`.** A host typed 0, continued,
// and the listing saved — with no weekend rate at all. Every layer read the text the same lenient
// way (`Double(text) ?? 0` then `> 0 ? value : nil`), which cannot tell a typed zero from an empty
// field, so the rate was dropped in silence on the phone, in the request, and again in the API.
//
// The two halves of the rule are tested separately on purpose. Refusing `0` is the fix; still
// ACCEPTING an empty field is what must not break with it, because empty is how a host turns
// weekend pricing off and how a month goes back to the base nightly price.
//
// This app has no XCTest target, so the suite is a plain executable over the same pure file the
// app compiles — no UIKit, no SwiftUI, no simulator:
//
//     cd mobile/ios && ./Tests/run.sh
//
// Exits non-zero on the first failure. `Tests/` is outside the target's `sources:` in project.yml,
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

/// The rejection under test; fails loudly if the value was accepted instead.
func problemOf(_ text: String) -> ListingPricingRules.Problem? {
    if case .failure(let problem) = ListingPricingRules.checkPrice(text) { return problem }
    return nil
}

/// The accepted value under test; `.some(nil)` is "empty, i.e. no rate".
func valueOf(_ text: String) -> Double?? {
    if case .success(let value) = ListingPricingRules.checkPrice(text) { return value }
    return nil
}

// ---------------------------------------------------------------------------
print("checkPrice — the bug this file exists for")
// ---------------------------------------------------------------------------

check(problemOf("0") == .notPositive, "0 is refused, not read as no rate")
for text in ["0", "00", "0.0", " 0 ", "-200", "-1"] {
    check(problemOf(text) == .notPositive, "\"\(text)\" is refused as not a price")
}
// The field filters to digits, so these arrive by paste or from a seeded value — and a rule that
// only the keyboard enforces is not a rule.
for text in ["abc", "1,500", "--", "1.2.3"] {
    check(problemOf(text) == .notANumber, "\"\(text)\" is refused as not a number")
}

// ---------------------------------------------------------------------------
print("checkPrice — empty still means \"no rate\"")
// ---------------------------------------------------------------------------

// If either of these started failing, a host could no longer turn weekend pricing off — a worse
// bug than the one being fixed.
check(valueOf("") == .some(nil), "an empty field is no rate, without an error")
check(valueOf("   ") == .some(nil), "a blank field is no rate, without an error")

// ---------------------------------------------------------------------------
print("checkPrice — a real rate still gets through")
// ---------------------------------------------------------------------------

check(valueOf("1500") == 1500, "a typed rate is kept")
check(valueOf(" 1500 ") == 1500, "surrounding space is not part of the rate")
// Rounded the way the server stores it, so a preview here matches the quote.
check(valueOf("4999.6") == 5000, "a fractional rate is rounded to whole EGP")
check(valueOf("1") == 1, "1 is the smallest rate that is still a rate")

// ---------------------------------------------------------------------------
print("checkMonths — the twelve seasonal rates")
// ---------------------------------------------------------------------------

func monthsOf(_ input: [String: String]) -> [String: Double]? {
    if case .success(let out) = ListingPricingRules.checkMonths(input) { return out }
    return nil
}

check(monthsOf(["7": "8500", "8": "", "9": "   "]) == ["7": 8500],
      "only the months the host priced are sent")
check(monthsOf([:]) == [:], "no months at all is normal, not an error")

let zeroMonth = ListingPricingRules.failingMonth(["8": "0"])
check(zeroMonth?.month == 8 && zeroMonth?.problem == .notPositive,
      "a month typed as zero is refused and named")

// A dictionary has no order of its own, so the rule has to impose one: the host reads their form
// top to bottom, and March is the field they will find first.
let twoBad = ListingPricingRules.failingMonth(["10": "0", "3": "0"])
check(twoBad?.month == 3, "the month reported is the first on the screen, not the first enumerated")

// They cannot be reached by the pricing ladder, so there is nothing to tell the host about them —
// and a junk key held in state must not make the screen unsaveable.
check(monthsOf(["0": "900", "13": "0", "": "900", "6": "900"]) == ["6": 900],
      "months outside 1...12 are dropped rather than reported")

var everyMonth: [String: String] = [:]
for month in 1...12 { everyMonth[String(month)] = String(month * 100) }
check(monthsOf(everyMonth)?.count == 12, "every month of the year is reachable")

// ---------------------------------------------------------------------------
print("…and the pair with the day rule")
// ---------------------------------------------------------------------------

// WeekendSchedule.resolve answers "no days, no error" to a rate of 0 — correctly, since it is only
// ever handed a rate that already passed checkPrice. This records WHY the price is checked first:
// ask the day rule about a raw 0 and it says everything is fine.
check(problemOf("0") == .notPositive, "the price rule is the one that catches a zero")

// ---------------------------------------------------------------------------
print(failures == 0 ? "\n✅ ALL \(checks) PASSED\n" : "\n❌ \(failures) of \(checks) FAILED\n")
exit(failures == 0 ? 0 : 1)
