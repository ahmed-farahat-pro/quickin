import Foundation

/// What a host may type into a seasonal price field — the weekend nightly rate,
/// and the twelve per-month rates under it.
///
/// The Swift twin of `checkWeekendPrice` / `checkMonthlyPrices` in
/// `listing-pricing-core.ts`, the file the website's host forms and the API both
/// run. `WeekendSchedule` (Models.swift) is the twin of the other half of that
/// file — which DAYS the weekend rate is charged on — and the two are asked
/// together on every save.
///
/// The rule is one sentence: **an empty field clears the rate, and a rate the
/// host actually typed has to be money.**
///
/// Both halves matter. Empty is how weekend pricing is turned off and how a
/// month goes back to the base nightly price, so it can never be an error. `0`
/// is the opposite — it is a typo or a misread field, and it used to be coerced
/// into the first: `parseWeekend` answered `nil` for anything ≤ 0, the request
/// went out with `weekend_price: null`, and the API's own `cleanPrice` would
/// have dropped it anyway. The listing saved, the screen reopened blank, and
/// nothing anywhere said the rate had gone. Refusing is the only honest answer.
///
/// Pure: no SwiftUI, no network, no formatting. The screens turn a `Problem`
/// into a localized sentence; this decides only what is wrong.
enum ListingPricingRules {
    /// How a typed rate can fail. Screens switch on this, not on text.
    enum Problem: Error {
        /// Not a number at all — `abc`, `1,500`, `--`.
        case notANumber
        /// A number, but not a price — `0`, `-200`.
        case notPositive

        /// The localization key for this problem on the WEEKEND field.
        var weekendKey: String {
            self == .notPositive ? "pricing.weekendPrice.notPositive" : "pricing.weekendPrice.notANumber"
        }

        /// The localization key for this problem on a MONTH field. The message
        /// takes the month's name, so the host is told which of twelve to fix.
        var monthKey: String {
            self == .notPositive ? "pricing.monthPrice.notPositive" : "pricing.monthPrice.notANumber"
        }
    }

    /// A rejected month, as the month itself (`1`…`12`) and what is wrong with it.
    struct MonthFailure: Error {
        let month: Int
        let problem: Problem
    }

    /// Judge one typed rate.
    ///
    /// - `.success(nil)` — the field is empty, i.e. no rate. This is what CLEARS
    ///   a stored one, and it is the resting state of most listings.
    /// - `.success(rate)` — a real nightly rate, rounded to whole EGP the way
    ///   the server stores it.
    /// - `.failure` — the host typed something that is not a price.
    static func checkPrice(_ text: String) -> Result<Double?, Problem> {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return .success(nil) }
        guard let value = Double(trimmed), value.isFinite else { return .failure(.notANumber) }
        guard value > 0 else { return .failure(.notPositive) }
        return .success(value.rounded())
    }

    /// Judge the twelve month fields together, in calendar order.
    ///
    /// Answers only the months the host actually priced — a blank month has no
    /// opinion and falls through to the base nightly price, so it is dropped
    /// rather than reported. Keys outside 1…12 are dropped too: the pricing
    /// ladder can never reach them, so there is nothing to tell the host.
    ///
    /// Ordered so the month reported back is the FIRST bad one on the screen
    /// rather than whichever the dictionary happened to enumerate first — the
    /// host reads their form top to bottom.
    static func checkMonths(_ months: [String: String]) -> Result<[String: Double], MonthFailure> {
        var out: [String: Double] = [:]
        for month in 1...12 {
            let key = String(month)
            guard let text = months[key] else { continue }
            switch checkPrice(text) {
            case .failure(let problem):
                return .failure(MonthFailure(month: month, problem: problem))
            case .success(let value):
                if let value { out[key] = value }
            }
        }
        return .success(out)
    }

    /// Which month, if any, the host has to fix right now — the question the
    /// month rows ask themselves as they render, so a bad field is marked where
    /// it is rather than only when Save is pressed.
    static func failingMonth(_ months: [String: String]) -> MonthFailure? {
        if case .failure(let failure) = checkMonths(months) { return failure }
        return nil
    }
}
