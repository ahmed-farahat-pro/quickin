// ListingCapacityPolicy.swift
//
// How small — and how large — a place is allowed to claim to be.
//
// The capacity steppers floored bedrooms, beds and bathrooms at **zero** — only
// "Max guests" had a floor of 1 — so a host could walk the wizard through with
// 0 bedrooms and 0 beds and publish a chalet whose card reads "0 bedrooms ·
// 0 beds · 0 baths". A stay with nowhere to sleep is not a stay, and those three
// numbers are what a guest filters and compares on. Android had the same hole
// (`min = 0` on the same three steppers) and so did the API, which floored the
// values at 0 on create and on PATCH.
//
// The CEILING is the other half, and it was missing everywhere. The steppers
// stopped at 20 bedrooms because that is as far as the control scrolled, not
// because anything refused a bigger number — so a client that PATCHed the API
// directly, or an older build, could store a Studio with 27,373 bedrooms (a real
// row on Neon) or a Cabin with 40. Bedrooms are now capped PER PROPERTY TYPE,
// because "too many" only means something once you know what the place is: 8
// bedrooms is an ordinary villa and an impossible guest suite.
//
// This is the Swift translation of `src/lib/local/listing-capacity-policy.ts`,
// which both web projects carry byte-identical (a parity script guards those
// two) and which the API runs on both doors. Android carries the same rule again
// in `ListingCapacityPolicy.kt`. All three mobile-facing copies are updated by
// hand, so `minimum` and `maxBedroomsByPropertyType` below are the things to
// keep in step.
//
// **A studio is 1 bedroom, not 0.** Product's table says a studio "must be 0",
// meaning it has no separate bedroom; `minimum` is 1. The two statements are the
// same statement — the single room IS the bedroom — so a studio's ceiling is
// also 1: exactly one, and never two.
//
// No SwiftUI, no UIKit, no imports at all: the create wizard, the edit screen
// and `Tests/ListingCapacityPolicyTests` all compile against this one file. See
// mobile/ios/Tests/run.sh.
enum ListingCapacityPolicy {
    /// The floor under every count. One, not zero.
    static let minimum = 1

    /// The most bedrooms each property type may claim — product's table, keyed by
    /// the stored English `property_type` lowercased. The value is stored in
    /// English on purpose (clients translate the label only), so a lowercased key
    /// is the whole normalisation this needs.
    static let maxBedroomsByPropertyType: [String: Int] = [
        "apartment": 5,
        "house": 6,
        "villa": 8,
        "cabin": 3,
        "studio": 1,
        "loft": 3,
        "chalet": 6,
        "cottage": 4,
        "guest suite": 2,
    ]

    /// The bedroom ceiling for a type the table does not name.
    ///
    /// The most permissive number product gave (Villa's 8), on purpose: an
    /// unlisted type — 'Guest House', which the API accepts, or anything a future
    /// release adds — must never be judged HARDER than a type product has
    /// actually ruled on. Add the type to the table to tighten it.
    static let defaultMaxBedrooms = 8

    /// The blanket ceiling on the three counts with no per-type table. These are
    /// the ceilings the steppers have offered all along, promoted from "as far as
    /// the control scrolls" to an actual rule.
    static let maxGuestsCeiling = 32
    static let bedsCeiling = 30
    static let bathroomsCeiling = 20

    /// The table key for a stored property type, or nil when the caller said
    /// nothing usable. Lowercased with inner runs of whitespace collapsed, so
    /// "Guest  suite" and "guest suite" are one type.
    static func normalizeKey(_ propertyType: String?) -> String? {
        guard let raw = propertyType else { return nil }
        let key = raw
            .split(whereSeparator: { $0.isWhitespace })
            .joined(separator: " ")
            .lowercased()
        return key.isEmpty ? nil : key
    }

    /// The bedroom ceiling for what this place says it is.
    static func maxBedrooms(for propertyType: String?) -> Int {
        guard let key = normalizeKey(propertyType) else { return defaultMaxBedrooms }
        return maxBedroomsByPropertyType[key] ?? defaultMaxBedrooms
    }

    /// The property type as an error sentence should spell it, or nil when it has
    /// no bearing on the ceiling. Only a type the table actually names is echoed:
    /// telling a host "a Guest House can have at most 8 bedrooms" would state a
    /// rule that does not exist for their type.
    static func namedType(_ propertyType: String?) -> String? {
        guard let key = normalizeKey(propertyType),
              maxBedroomsByPropertyType[key] != nil else { return nil }
        return key.prefix(1).uppercased() + key.dropFirst()
    }

    /// True when every count clears its floor AND its ceiling. One expression,
    /// shared by the create wizard and the edit screen, so there is a single
    /// capacity rule on iOS rather than one per screen.
    ///
    /// `propertyType` is what the listing will BE once saved — the value the host
    /// has selected, not the one already stored — because retyping a 6-bedroom
    /// Villa as a Cabin changes both halves of the rule in one edit.
    static func isValid(
        maxGuests: Int,
        bedrooms: Int,
        beds: Int,
        bathrooms: Int,
        propertyType: String?
    ) -> Bool {
        [maxGuests, bedrooms, beds, bathrooms].allSatisfy { $0 >= minimum }
            && maxGuests <= maxGuestsCeiling
            && beds <= bedsCeiling
            && bathrooms <= bathroomsCeiling
            && bedrooms <= maxBedrooms(for: propertyType)
    }

    /// True when at least one count is below the floor — the half of the rule the
    /// existing "must each be at least 1" sentence explains.
    static func isBelowFloor(maxGuests: Int, bedrooms: Int, beds: Int, bathrooms: Int) -> Bool {
        [maxGuests, bedrooms, beds, bathrooms].contains { $0 < minimum }
    }

    /// True when the bedroom count is more than this property type allows.
    static func exceedsBedroomCeiling(_ bedrooms: Int, propertyType: String?) -> Bool {
        bedrooms > maxBedrooms(for: propertyType)
    }

    /// True when one of the three blanket-capped counts is over its ceiling. Only
    /// reachable from a stored value — the steppers clamp new taps.
    static func exceedsOtherCeiling(maxGuests: Int, beds: Int, bathrooms: Int) -> Bool {
        maxGuests > maxGuestsCeiling || beds > bedsCeiling || bathrooms > bathroomsCeiling
    }

    /// What the editor should show for a stored count.
    ///
    /// A **nil** column is a question nobody asked, so it opens at the floor
    /// rather than at 0 — seeding it with 0 would put words in a host's mouth and
    /// then refuse them for it. A stored value outside the range is different:
    /// some host did press Publish on it before this rule existed, so it is shown
    /// as it is and the editor blocks Save until they correct it.
    static func seed(_ stored: Int?) -> Int {
        stored ?? minimum
    }
}
