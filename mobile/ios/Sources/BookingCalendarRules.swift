import Foundation

/// The guest booking calendar's nightly prices — the pure rules behind them.
///
/// The reserve `DateRangePicker` paints each day's price from the public
/// `GET /api/local/listings/:id/calendar`, one month per request. The server owns
/// every price (commission included); this only decides what a cell looks like
/// and which months to ask for. Swift mirror of the web's
/// `booking-calendar-core.ts` and Android's `BookingCalendarRules.kt`, tested by
/// `Tests/BookingCalendarRulesTests` (no UIKit, no SwiftUI).
enum BookingCalendarRules {
    /// How a night's price compares to the listing's standard nightly rate.
    enum Tone: Equatable { case lower, base, higher }

    /// Compare a night to the base rate, not to its neighbours: a weekend in a
    /// cheap month is still "cheaper than usual". Within 1 EGP counts as base,
    /// so a server rounding step never paints a plain night as a deal.
    static func tone(price: Double, base: Double) -> Tone {
        guard price.isFinite, base.isFinite, base > 0 else { return .base }
        if price < base - 1 { return .lower }
        if price > base + 1 { return .higher }
        return .base
    }

    /// `2500` → `"2,500"`. Whole units only — the cell has no room for piasters.
    static func formatPrice(_ amount: Double) -> String {
        guard amount.isFinite else { return "" }
        let f = NumberFormatter()
        f.locale = Locale(identifier: "en_US")
        f.numberStyle = .decimal
        f.maximumFractionDigits = 0
        return f.string(from: NSNumber(value: amount.rounded())) ?? ""
    }

    /// `yyyy-MM` for a year and 1-based month, rolling over the year.
    static func monthKey(year: Int, month: Int) -> String {
        let zeroBased = year * 12 + (month - 1)
        return String(format: "%04d-%02d", zeroBased / 12, zeroBased % 12 + 1)
    }

    /// First and last day of a `yyyy-MM` month, inclusive — the `start`/`end` the
    /// calendar endpoint takes.
    static func monthWindow(_ key: String) -> (start: String, end: String) {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 2 else { return ("\(key)-01", "\(key)-01") }
        let (y, m) = (parts[0], parts[1])
        let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
        let lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        return ("\(key)-01", String(format: "%@-%02d", key, lengths[m - 1]))
    }

    /// The month on screen plus the next one, so paging forward lands on prices
    /// that are already there.
    static func monthsToLoad(year: Int, month: Int) -> [String] {
        [monthKey(year: year, month: month), monthKey(year: year, month: month + 1)]
    }
}
