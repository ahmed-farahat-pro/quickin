// Unit tests for Sources/BookingCalendarRules.swift — the Swift mirror of the web's
// test/unit/booking-calendar-core.test.mjs and of Android's BookingCalendarRulesTest.kt.
//
// The nightly price painted under each day of the guest reserve calendar: how it is
// written, which colour it takes against the base rate, and which months are fetched.
//
//     cd mobile/ios && ./Tests/run.sh
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

typealias R = BookingCalendarRules

check(R.tone(price: 2500, base: 2500) == .base, "base price is base")
check(R.tone(price: 3500, base: 2500) == .higher, "weekend above base is higher")
check(R.tone(price: 2000, base: 2500) == .lower, "custom below base is lower")
check(R.tone(price: 2501, base: 2500) == .base, "a rounding step is still base")
check(R.tone(price: 2500, base: 0) == .base, "no base never paints a deal")
check(R.tone(price: .nan, base: 2500) == .base, "junk price is base")

check(R.formatPrice(2500) == "2,500", "groups thousands")
check(R.formatPrice(12500) == "12,500", "five digits")
check(R.formatPrice(52.4) == "52", "drops fractions")
check(R.formatPrice(.nan) == "", "blank for junk")

check(R.monthKey(year: 2026, month: 11) == "2026-11", "monthKey")
check(R.monthKey(year: 2026, month: 13) == "2027-01", "monthKey rolls the year")
check(R.monthWindow("2026-11") == ("2026-11-01", "2026-11-30"), "November window")
check(R.monthWindow("2028-02") == ("2028-02-01", "2028-02-29"), "leap February")
check(R.monthWindow("2026-12") == ("2026-12-01", "2026-12-31"), "December window")
check(R.monthsToLoad(year: 2026, month: 12) == ["2026-12", "2027-01"], "visible + next")

print("\n\(checks - failures)/\(checks) passed")
exit(failures == 0 ? 0 : 1)
