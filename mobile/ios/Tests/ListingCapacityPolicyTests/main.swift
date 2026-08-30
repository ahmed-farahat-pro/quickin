// Unit tests for Sources/ListingCapacityPolicy.swift — the Swift mirror of the backend's
// test/unit/listing-capacity-policy.test.mjs and of Android's ListingCapacityPolicyTest.kt.
//
// The reported defect: **Cabin and Chalet accepted unrealistically high room counts.** Nothing
// refused a bedroom count from above — the stepper stopped at 20 because that is as far as the
// control scrolled, and the API had no upper bound at all — so a Chalet with 12 bedrooms and a
// Studio with 27,373 both live on Neon today. The fix is a ceiling per property type, because
// "too many" only means something once you know what the place is.
//
// The two halves of the rule are tested separately on purpose. Refusing a huge count is the fix;
// still refusing a 0 is what must not break with it, and still ACCEPTING an ordinary 3-bedroom
// villa is what must not break either — a cap that catches real listings is worse than none.
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

/// Product's table, transcribed so a change to the policy has to be a deliberate change here too.
/// Studio is the one row that is not a straight copy: product wrote "must be 0", meaning no
/// separate bedroom, and the floor is 1 — so the rule is "exactly 1".
let TABLE: [(String, Int)] = [
    ("Apartment", 5), ("House", 6), ("Villa", 8), ("Cabin", 3), ("Studio", 1),
    ("Loft", 3), ("Chalet", 6), ("Cottage", 4), ("Guest suite", 2),
]

/// A listing that is fine apart from the bedroom count under test.
func validWith(bedrooms: Int, _ type: String) -> Bool {
    ListingCapacityPolicy.isValid(
        maxGuests: 2, bedrooms: bedrooms, beds: 1, bathrooms: 1, propertyType: type
    )
}

// ---------------------------------------------------------------------------
print("the bedroom ceiling — the bug this file exists for")
// ---------------------------------------------------------------------------

check(!validWith(bedrooms: 40, "Cabin"), "a Cabin with 40 bedrooms is refused")
check(!validWith(bedrooms: 40, "Chalet"), "a Chalet with 40 bedrooms is refused")
check(!validWith(bedrooms: 27373, "Studio"), "the 27,373-bedroom Studio on Neon is refused")
check(!validWith(bedrooms: 12, "Chalet"), "the 12-bedroom Chalet on Neon is refused")

for (type, max) in TABLE {
    check(validWith(bedrooms: max, type), "\(type) accepts its maximum of \(max)")
    check(!validWith(bedrooms: max + 1, type), "\(type) refuses \(max + 1)")
    check(ListingCapacityPolicy.maxBedrooms(for: type) == max, "\(type) reads \(max) from the table")
}

// ---------------------------------------------------------------------------
print("\n…and the floor it did not replace")
// ---------------------------------------------------------------------------

for (type, _) in TABLE {
    check(!validWith(bedrooms: 0, type), "\(type) still refuses 0 bedrooms")
    check(validWith(bedrooms: 1, type), "\(type) still accepts 1 bedroom")
}
check(!ListingCapacityPolicy.isValid(maxGuests: 0, bedrooms: 1, beds: 1, bathrooms: 1,
                                     propertyType: "Villa"), "0 guests is still refused")
check(!ListingCapacityPolicy.isValid(maxGuests: 2, bedrooms: 1, beds: 0, bathrooms: 1,
                                     propertyType: "Villa"), "0 beds is still refused")
check(!ListingCapacityPolicy.isValid(maxGuests: 2, bedrooms: 1, beds: 1, bathrooms: 0,
                                     propertyType: "Villa"), "0 bathrooms is still refused")
check(ListingCapacityPolicy.isBelowFloor(maxGuests: 2, bedrooms: 0, beds: 1, bathrooms: 1),
      "isBelowFloor is what picks the 'at least 1' sentence")
check(!ListingCapacityPolicy.isBelowFloor(maxGuests: 2, bedrooms: 40, beds: 1, bathrooms: 1),
      "a count that is too HIGH is not reported as too low")

// ---------------------------------------------------------------------------
print("\na Studio is exactly one room")
// ---------------------------------------------------------------------------

check(validWith(bedrooms: 1, "Studio"), "a Studio may have its one bedroom")
check(!validWith(bedrooms: 2, "Studio"), "a Studio may not claim a second")
check(ListingCapacityPolicy.maxBedrooms(for: "Studio") == ListingCapacityPolicy.minimum,
      "the Studio ceiling and the floor are the same number")

// ---------------------------------------------------------------------------
print("\nthe type as four different clients spell it")
// ---------------------------------------------------------------------------

// property_type is stored in English and written by web, iOS, Android and the API.
for spelling in ["cabin", "CABIN", " Cabin ", "CaBiN"] {
    check(ListingCapacityPolicy.maxBedrooms(for: spelling) == 3, "\"\(spelling)\" is a Cabin")
}
for spelling in ["Guest suite", "guest suite", "GUEST SUITE", "Guest  suite"] {
    check(ListingCapacityPolicy.maxBedrooms(for: spelling) == 2, "\"\(spelling)\" is a Guest suite")
}
check(ListingCapacityPolicy.normalizeKey("Guest  Suite") == "guest suite",
      "an inner run of whitespace is collapsed, not treated as a different type")
check(ListingCapacityPolicy.normalizeKey("   ") == nil, "a blank type is no type")
check(ListingCapacityPolicy.normalizeKey(nil) == nil, "a missing type is no type")

// ---------------------------------------------------------------------------
print("\na type nobody has ruled on")
// ---------------------------------------------------------------------------

// 'Guest House' is a real stored value the API accepts and only Android offers, and it is absent
// from product's table. Judging it HARDER than a type they did rule on would refuse listings over
// a rule that does not exist.
check(ListingCapacityPolicy.maxBedrooms(for: "Guest House") == ListingCapacityPolicy.defaultMaxBedrooms,
      "an unlisted type falls back to the default")
check(ListingCapacityPolicy.maxBedrooms(for: nil) == ListingCapacityPolicy.defaultMaxBedrooms,
      "no type at all falls back to the default")
check(ListingCapacityPolicy.defaultMaxBedrooms == TABLE.map { $0.1 }.max(),
      "the fallback stays the most permissive number in the table")
check(ListingCapacityPolicy.namedType("Guest House") == nil,
      "an unlisted type is not named in the sentence — that would state a rule it has no part in")
check(ListingCapacityPolicy.namedType("cabin") == "Cabin",
      "a listed type is named the way a sentence would spell it")
check(ListingCapacityPolicy.namedType("guest suite") == "Guest suite",
      "only the first word is capitalised — 'Guest suite' is how the value is stored")

// ---------------------------------------------------------------------------
print("\nthe three counts with no per-type table")
// ---------------------------------------------------------------------------

// Only bedrooms has a table; a Cabin does not get fewer bathrooms than a Villa. But the same
// keypad types into all four, so leaving these unbounded would move 27,373 one field to the right.
check(ListingCapacityPolicy.isValid(maxGuests: 32, bedrooms: 3, beds: 30, bathrooms: 20,
                                    propertyType: "Cabin"), "each blanket ceiling is reachable")
check(!ListingCapacityPolicy.isValid(maxGuests: 33, bedrooms: 3, beds: 30, bathrooms: 20,
                                     propertyType: "Cabin"), "33 guests is over the ceiling")
check(!ListingCapacityPolicy.isValid(maxGuests: 32, bedrooms: 3, beds: 31, bathrooms: 20,
                                     propertyType: "Cabin"), "31 beds is over the ceiling")
check(!ListingCapacityPolicy.isValid(maxGuests: 32, bedrooms: 3, beds: 30, bathrooms: 21,
                                     propertyType: "Cabin"), "21 bathrooms is over the ceiling")
check(ListingCapacityPolicy.exceedsOtherCeiling(maxGuests: 99, beds: 1, bathrooms: 1),
      "exceedsOtherCeiling is what picks the blanket sentence")
check(!ListingCapacityPolicy.exceedsOtherCeiling(maxGuests: 2, beds: 1, bathrooms: 1),
      "an ordinary listing does not trip the blanket sentence")

// ---------------------------------------------------------------------------
print("\nordinary listings still pass — the half a bad cap would break")
// ---------------------------------------------------------------------------

check(validWith(bedrooms: 3, "Chalet"), "the published 3-bedroom Sea View Chalet still saves")
check(validWith(bedrooms: 2, "Apartment"), "the published 2-bedroom Amwaj apartment still saves")
check(validWith(bedrooms: 1, "Cabin"), "the 1-bedroom Cabin still saves")
check(ListingCapacityPolicy.seed(nil) == ListingCapacityPolicy.minimum,
      "a NULL column still opens at the floor, not at 0")
check(ListingCapacityPolicy.seed(27373) == 27373,
      "a stored value over the ceiling is shown as it is, so the host can see what to fix")

// ---------------------------------------------------------------------------
print(failures == 0 ? "\n✅ ALL \(checks) PASSED\n" : "\n❌ \(failures) of \(checks) FAILED\n")
exit(failures == 0 ? 0 : 1)
