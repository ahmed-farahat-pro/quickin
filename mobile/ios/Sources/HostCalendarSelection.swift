import Foundation

/// The host pricing calendar's selection and paging rules — the Swift mirror of
/// the web's `src/lib/local/calendar-selection-core.ts`, tested by
/// `Tests/HostCalendarSelectionTests` (which mirrors its `node --test` suite).
///
/// Selection is "tap start, tap end":
///
///   • tap an unselected day   → it is selected and becomes the pending ANCHOR;
///   • tap another day         → every editable day between the anchor and it is
///                               added, and the anchor is cleared;
///   • tap the anchor again    → it stays selected on its own (a single day), so a
///                               host can still pick days that aren't consecutive;
///   • tap a selected day while nothing is pending → it is removed.
///
/// Selections ACCUMULATE: finishing one range and tapping a fresh day starts the
/// next range alongside it. Booked and past days inside a range are skipped,
/// never refused — a host pricing "all of December" routinely crosses a booking.
///
/// Pure Foundation (no SwiftUI) so `Tests/run.sh` can compile it on its own.
/// Dates are `yyyy-MM-dd` strings in UTC, the API's own shape.
enum HostCalendarSelection {

    /// How many months ahead the API accepts — the web's `MAX_MONTHS_AHEAD`.
    static let maxMonthsAhead = 24
    /// How many days one save may carry — the web's `MAX_DATES_PER_REQUEST`.
    static let maxDatesPerRequest = 800

    // MARK: - Date helpers (UTC, Gregorian)

    private static let calendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        c.locale = Locale(identifier: "en_US_POSIX")
        return c
    }()

    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = calendar
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func date(_ iso: String) -> Date? {
        guard iso.count == 10, let d = formatter.date(from: iso) else { return nil }
        // Rejects rollovers such as 2026-02-30 that a lenient parse would accept.
        return formatter.string(from: d) == iso ? d : nil
    }

    static func iso(_ date: Date) -> String { formatter.string(from: date) }

    static func addDays(_ iso: String, _ n: Int) -> String? {
        guard let d = date(iso), let out = calendar.date(byAdding: .day, value: n, to: d) else { return nil }
        return Self.iso(out)
    }

    static func daysBetween(_ from: String, _ to: String) -> Int? {
        guard let a = date(from), let b = date(to) else { return nil }
        return calendar.dateComponents([.day], from: a, to: b).day
    }

    /// The first day of the month `offset` months after the one `today` sits in.
    static func monthStart(_ today: String, _ offset: Int) -> String {
        let y = Int(today.prefix(4)) ?? 1970
        let m = Int(today.dropFirst(5).prefix(2)) ?? 1
        let total = (y * 12 + (m - 1)) + offset
        return String(format: "%04d-%02d-01", total / 12, total % 12 + 1)
    }

    /// Every day of the month starting on `first`.
    static func monthDays(_ first: String) -> [String] {
        guard let d = date(first), let range = calendar.range(of: .day, in: .month, for: d) else { return [] }
        return (0..<range.count).compactMap { addDays(first, $0) }
    }

    /// A month as Sunday-first rows: leading `nil`s put the 1st under its weekday
    /// column, matching the server's `extract(dow)`.
    static func monthGrid(_ first: String) -> [String?] {
        guard let d = date(first) else { return [] }
        let leading = calendar.component(.weekday, from: d) - 1
        return Array(repeating: nil, count: max(0, leading)) + monthDays(first).map { Optional($0) }
    }

    // MARK: - Tap selection

    struct TapResult: Equatable {
        var selected: Set<String>
        var anchor: String?
        /// The range the tap would have made is longer than one save accepts.
        /// The selection is left unchanged and the anchor stays pending.
        var tooLong = false
    }

    /// Every editable day from `a` to `b` inclusive, in either order. Empty when
    /// the span exceeds `maxDays` or either end is not a date.
    static func rangeDays(_ a: String, _ b: String, isEditable: (String) -> Bool, maxDays: Int) -> [String] {
        guard date(a) != nil, date(b) != nil else { return [] }
        let (from, to) = a <= b ? (a, b) : (b, a)
        guard let n = daysBetween(from, to), n + 1 <= maxDays else { return [] }
        return (0...n).compactMap { addDays(from, $0) }.filter(isEditable)
    }

    /// Apply one tap to the selection. See the type's header for the rules.
    static func tapDay(
        selected: Set<String>,
        anchor: String?,
        date day: String,
        isEditable: (String) -> Bool,
        maxDays: Int = maxDatesPerRequest
    ) -> TapResult {
        var selected = selected
        guard isEditable(day) else { return TapResult(selected: selected, anchor: anchor) }

        // An anchor that is no longer selected (cleared by "Select month", say)
        // is not pending any more.
        let live = anchor.flatMap { selected.contains($0) ? $0 : nil }

        guard let pending = live else {
            if selected.contains(day) {
                selected.remove(day)
                return TapResult(selected: selected, anchor: nil)
            }
            selected.insert(day)
            return TapResult(selected: selected, anchor: day)
        }

        if day == pending { return TapResult(selected: selected, anchor: nil) }

        let (from, to) = pending <= day ? (pending, day) : (day, pending)
        if let n = daysBetween(from, to), n + 1 > maxDays {
            return TapResult(selected: selected, anchor: pending, tooLong: true)
        }
        selected.formUnion(rangeDays(from, to, isEditable: isEditable, maxDays: maxDays))
        return TapResult(selected: selected, anchor: nil)
    }

    /// "Select month" as a toggle: a month whose editable days are all selected
    /// is cleared, otherwise all of them are added.
    static func toggleMonth(_ selected: Set<String>, editable: [String]) -> Set<String> {
        guard !editable.isEmpty else { return selected }
        if editable.allSatisfy(selected.contains) { return selected.subtracting(editable) }
        return selected.union(editable)
    }

    static func isMonthFullySelected(_ selected: Set<String>, editable: [String]) -> Bool {
        !editable.isEmpty && editable.allSatisfy(selected.contains)
    }

    // MARK: - Runs

    struct Run: Equatable {
        var start: String
        var end: String
        /// Days in the run — each day prices the night that starts on it.
        var days: Int
    }

    /// Consecutive selected days grouped into runs, earliest first.
    static func selectionRuns<S: Sequence>(_ dates: S) -> [Run] where S.Element == String {
        let sorted = Set(dates).filter { date($0) != nil }.sorted()
        var runs: [Run] = []
        for d in sorted {
            if let last = runs.last, addDays(last.end, 1) == d {
                runs[runs.count - 1].end = d
                runs[runs.count - 1].days += 1
            } else {
                runs.append(Run(start: d, end: d, days: 1))
            }
        }
        return runs
    }

    enum RunPosition: Equatable { case single, start, middle, end }

    /// Where a day sits in its run, for drawing a range as one connected band.
    /// Week rows break the band visually; the view rounds row edges itself.
    static func runPosition(_ selected: Set<String>, _ day: String) -> RunPosition? {
        guard selected.contains(day), date(day) != nil else { return nil }
        let prev = addDays(day, -1).map(selected.contains) ?? false
        let next = addDays(day, 1).map(selected.contains) ?? false
        switch (prev, next) {
        case (true, true): return .middle
        case (true, false): return .end
        case (false, true): return .start
        case (false, false): return .single
        }
    }

    /// Lowest and highest current nightly price across the selection, ignoring
    /// days not loaded yet. Nil when none is known.
    static func priceSpan<S: Sequence>(_ dates: S, price: (String) -> Double?) -> (min: Double, max: Double)? where S.Element == String {
        var lo = Double.infinity
        var hi = -Double.infinity
        for d in dates {
            guard let p = price(d), p.isFinite else { continue }
            lo = min(lo, p)
            hi = max(hi, p)
        }
        return lo == .infinity ? nil : (lo, hi)
    }

    // MARK: - Paging

    /// The first month the calendar may show, as an offset from the current
    /// month. With `visible` months side by side the last page must still end
    /// inside the horizon, so two-up stops one page earlier than one-up.
    static func clampMonthOffset(_ offset: Int, visible: Int, horizon: Int = maxMonthsAhead) -> Int {
        let maxOffset = max(0, horizon - max(1, visible))
        return min(maxOffset, max(0, offset))
    }

    /// The month offsets to fetch for a page: the visible ones plus one ahead,
    /// inside the horizon.
    static func offsetsToLoad(page: Int, visible: Int, horizon: Int = maxMonthsAhead) -> [Int] {
        (0...max(1, visible)).map { page + $0 }.filter { $0 >= 0 && $0 < horizon }
    }

    enum SwipeDirection: Equatable { case next, prev }

    /// A finished drag → which way to page, or nil for "not a swipe". Horizontal
    /// travel must pass `threshold` AND dominate vertical travel, so a slightly
    /// diagonal scroll never flips the month. Right-to-left layouts mirror.
    static func swipeDirection(dx: Double, dy: Double, rtl: Bool = false, threshold: Double = 48) -> SwipeDirection? {
        if abs(dx) < threshold || abs(dx) < abs(dy) * 1.5 { return nil }
        let leftward = dx < 0
        return leftward != rtl ? .next : .prev
    }

    // MARK: - Formatting

    /// `12500` → "12,500"; six-digit rates abbreviate so they fit a phone cell:
    /// `125000` → "125k".
    static func compactPrice(_ amount: Double) -> String {
        guard amount.isFinite else { return "" }
        if amount >= 100_000 { return grouped((amount / 1000).rounded()) + "k" }
        return grouped(amount)
    }

    static func grouped(_ amount: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.maximumFractionDigits = 0
        f.locale = Locale(identifier: "en_US")
        return f.string(from: NSNumber(value: amount)) ?? String(Int(amount.rounded()))
    }
}
