import SwiftUI

/// A custom, branded date-range picker presented as a `.sheet`.
///
/// Deliberately does **not** use SwiftUI's built-in `DatePicker` (graphical /
/// wheel). It renders a month-grid calendar in the QuickIn palette and lets the
/// user pick a check-in / check-out range, returning the chosen dates on Apply.
///
/// Reusable from both the Explore search header and the listing-detail reserve
/// panel via the same binding-driven API:
/// ```swift
/// .sheet(isPresented: $showCalendar) {
///     DateRangePicker(checkIn: $checkIn, checkOut: $checkOut) { ci, co in … }
/// }
/// ```
struct DateRangePicker: View {
    /// Bound check-in date (nil = not yet chosen). Written on Apply.
    @Binding var checkIn: Date?
    /// Bound check-out date (nil = not yet chosen). Written on Apply.
    @Binding var checkOut: Date?
    /// Called after Apply / Clear with the committed selection (nil, nil on clear).
    var onApply: (Date?, Date?) -> Void

    /// Booked / host-blocked spans for the listing (half-open `[start, end)`).
    /// Days inside any span are greyed out and unselectable, and a candidate
    /// check-in→check-out range that straddles one is rejected. Empty when used
    /// from the Explore search header (no specific listing).
    var unavailableRanges: [AvailabilityRange] = []

    @Environment(\.dismiss) private var dismiss

    // Local working selection — only pushed to the bindings on Apply so the
    // caller's state isn't mutated until the user commits.
    @State private var draftIn: Date?
    @State private var draftOut: Date?
    /// First day of the month currently shown in the grid.
    @State private var visibleMonth: Date

    private let calendar = DateRangePicker.makeCalendar()

    /// The set of unavailable days (each normalized to start-of-day), expanded
    /// from `unavailableRanges` once at init so cell rendering / selection stay
    /// O(1) per day. A day is unavailable when `start <= day < end` for any span.
    private let unavailableDays: Set<Date>

    init(checkIn: Binding<Date?>,
         checkOut: Binding<Date?>,
         unavailableRanges: [AvailabilityRange] = [],
         onApply: @escaping (Date?, Date?) -> Void) {
        self._checkIn = checkIn
        self._checkOut = checkOut
        self.unavailableRanges = unavailableRanges
        self.onApply = onApply

        let cal = DateRangePicker.makeCalendar()
        let today = cal.startOfDay(for: Date())
        let initialIn = checkIn.wrappedValue.map { cal.startOfDay(for: $0) }
        let initialOut = checkOut.wrappedValue.map { cal.startOfDay(for: $0) }
        _draftIn = State(initialValue: initialIn)
        _draftOut = State(initialValue: initialOut)
        // Open on the month of the existing check-in, else the current month.
        let anchor = initialIn ?? today
        _visibleMonth = State(initialValue: cal.monthStart(for: anchor))

        // Expand every [start, end) span into the individual local days it
        // covers. We compare on local start-of-day, so we read the API's
        // calendar components (UTC) and rebuild each day in this calendar —
        // avoiding any timezone drift between the parsed UTC date and the grid.
        var days = Set<Date>()
        for range in unavailableRanges {
            guard let startUTC = range.startDate, let endUTC = range.endDate else { continue }
            guard var cursor = AvailabilityRange.localDay(from: startUTC, in: cal) else { continue }
            guard let endLocal = AvailabilityRange.localDay(from: endUTC, in: cal) else { continue }
            // Half-open: include start up to (but not including) end.
            while cursor < endLocal {
                days.insert(cursor)
                guard let next = cal.date(byAdding: .day, value: 1, to: cursor) else { break }
                cursor = next
            }
        }
        unavailableDays = days
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            grabber
            header
            weekdayRow
            grid
            Spacer(minLength: 8)
            footer
        }
        .background(Color.qkCream.ignoresSafeArea())
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.hidden)
    }

    private var grabber: some View {
        Capsule()
            .fill(Color.qkMuted.opacity(0.35))
            .frame(width: 40, height: 5)
            .padding(.top, 10)
            .padding(.bottom, 6)
    }

    // MARK: - Month header (‹ Month Year ›)

    private var header: some View {
        HStack {
            chevron(systemName: "chevron.left", enabled: canGoPrev) {
                shiftMonth(by: -1)
            }
            Spacer()
            VStack(spacing: 2) {
                Text(monthTitle)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Color.qkInk)
                Text(yearTitle)
                    .font(.subheadline)
                    .foregroundStyle(Color.qkMuted)
            }
            .animation(.easeInOut(duration: 0.15), value: visibleMonth)
            Spacer()
            chevron(systemName: "chevron.right", enabled: true) {
                shiftMonth(by: 1)
            }
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 12)
    }

    private func chevron(systemName: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(enabled ? Color.qkBurgundy : Color.qkMuted.opacity(0.3))
                .frame(width: 40, height: 40)
                .background(Color.white)
                .clipShape(Circle())
                .shadow(color: .black.opacity(enabled ? 0.06 : 0), radius: 4, x: 0, y: 2)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .accessibilityLabel(systemName == "chevron.left" ? "Previous month" : "Next month")
    }

    // MARK: - Weekday header row (S M T W T F S)

    private var weekdayRow: some View {
        HStack(spacing: 0) {
            ForEach(Array(weekdaySymbols.enumerated()), id: \.offset) { _, symbol in
                Text(symbol)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.qkMuted)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 6)
    }

    // MARK: - Month grid

    private var grid: some View {
        let columns = Array(repeating: GridItem(.flexible(), spacing: 0), count: 7)
        return LazyVGrid(columns: columns, spacing: 4) {
            ForEach(Array(monthCells.enumerated()), id: \.offset) { _, day in
                if let day {
                    dayCell(day)
                } else {
                    Color.clear.frame(height: 44)
                }
            }
        }
        .padding(.horizontal, 16)
        .animation(.easeInOut(duration: 0.15), value: visibleMonth)
    }

    /// One day cell — a ~40pt tappable circle with range-aware styling.
    private func dayCell(_ day: Date) -> some View {
        let isPast = day < today
        let isUnavailable = isUnavailable(day)
        let isStart = draftIn.map { calendar.isDate($0, inSameDayAs: day) } ?? false
        let isEnd = draftOut.map { calendar.isDate($0, inSameDayAs: day) } ?? false
        let isBetween = isInRange(day) && !isStart && !isEnd
        let isToday = calendar.isDate(day, inSameDayAs: today)
        let isEndpoint = isStart || isEnd
        // Booked / blocked days are unselectable, like past days.
        let isDisabled = isPast || isUnavailable

        return Button {
            select(day)
        } label: {
            ZStack {
                // Continuous tan band behind in-between days (and the inner
                // edge of each endpoint) so the range reads as one strip.
                rangeBand(isStart: isStart, isEnd: isEnd, isBetween: isBetween)

                // Endpoint solid burgundy circle.
                if isEndpoint {
                    Circle()
                        .fill(Color.qkBurgundy)
                        .frame(width: 40, height: 40)
                }

                // Today ring (only when not selected).
                if isToday && !isEndpoint {
                    Circle()
                        .strokeBorder(Color.qkBurgundy.opacity(0.5), lineWidth: 1.5)
                        .frame(width: 40, height: 40)
                }

                Text("\(calendar.component(.day, from: day))")
                    .font(.system(size: 16, weight: isEndpoint ? .bold : .regular))
                    .foregroundStyle(dayTextColor(isEndpoint: isEndpoint, isBetween: isBetween, isPast: isPast, isUnavailable: isUnavailable))
                    // A thin strike-through marks booked/blocked days so they
                    // read as taken even for color-blind users.
                    .strikethrough(isUnavailable && !isEndpoint, color: Color.qkMuted.opacity(0.5))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .accessibilityLabel(accessibilityLabel(for: day))
        .accessibilityHint(isUnavailable ? L.t("availability.unavailable") : "")
    }

    /// The tan strip behind a day. For endpoints we fill only the inner half so
    /// the burgundy circle blends into the band.
    @ViewBuilder
    private func rangeBand(isStart: Bool, isEnd: Bool, isBetween: Bool) -> some View {
        if isBetween {
            Rectangle()
                .fill(Color.qkTan)
                .frame(height: 40)
        } else if isStart && draftOut != nil {
            // Band extends to the right (toward the range).
            HStack(spacing: 0) {
                Color.clear
                Rectangle().fill(Color.qkTan)
            }
            .frame(height: 40)
        } else if isEnd && draftIn != nil && !(draftIn.map { calendar.isDate($0, inSameDayAs: endDay) } ?? false) {
            // Band extends to the left.
            HStack(spacing: 0) {
                Rectangle().fill(Color.qkTan)
                Color.clear
            }
            .frame(height: 40)
        }
    }

    private var endDay: Date { draftOut ?? today }

    private func dayTextColor(isEndpoint: Bool, isBetween: Bool, isPast: Bool, isUnavailable: Bool) -> Color {
        if isEndpoint { return .white }
        if isPast { return Color.qkMuted.opacity(0.35) }
        // Booked / blocked days are greyed out identically to past days.
        if isUnavailable { return Color.qkMuted.opacity(0.35) }
        if isBetween { return Color.qkInk }
        return Color.qkInk
    }

    /// `true` when `day` falls inside any booked / blocked span (`[start, end)`).
    private func isUnavailable(_ day: Date) -> Bool {
        unavailableDays.contains(calendar.startOfDay(for: day))
    }

    // MARK: - Footer (summary + Clear / Apply)

    private var footer: some View {
        VStack(spacing: 14) {
            Text(summaryText)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(draftIn == nil ? Color.qkMuted : Color.qkInk)
                .frame(maxWidth: .infinity, alignment: .center)

            HStack(spacing: 14) {
                Button {
                    draftIn = nil
                    draftOut = nil
                } label: {
                    Text("Clear")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Color.qkMuted)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                }
                .buttonStyle(.plain)

                Button {
                    checkIn = draftIn
                    checkOut = draftOut
                    onApply(draftIn, draftOut)
                    dismiss()
                } label: {
                    QKPrimaryButtonLabel(title: "Apply", height: 50)
                }
                .buttonStyle(QKPressStyle())
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 16)
        .background(
            Color.white
                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                .shadow(color: .black.opacity(0.05), radius: 12, x: 0, y: -4)
                .ignoresSafeArea(edges: .bottom)
        )
    }

    // MARK: - Selection logic

    /// Range selection: 1st tap = check-in, 2nd tap = check-out (if after
    /// check-in), else restart from the tapped day.
    ///
    /// Availability-aware: tapping a booked/blocked day does nothing, and a
    /// candidate range that would straddle an unavailable span is rejected —
    /// instead we restart a fresh range from the tapped day. The span is
    /// half-open, so the nights stayed are `[checkIn, checkOut)`; a checkout that
    /// lands exactly on a booked span's start (or a check-in on a span's end) is
    /// allowed because that night is free.
    private func select(_ day: Date) {
        let d = calendar.startOfDay(for: day)
        guard d >= today else { return }       // past days disabled
        guard !isUnavailable(d) else { return } // booked / blocked days disabled

        if draftIn == nil || draftOut != nil {
            // Start a fresh range.
            draftIn = d
            draftOut = nil
        } else if let start = draftIn {
            if d > start, !rangeStraddlesUnavailable(from: start, to: d) {
                draftOut = d
            } else {
                // Tapped before / on the start, or the range crosses a taken
                // span → restart from the tapped day.
                draftIn = d
                draftOut = nil
            }
        }
    }

    /// `true` when any night in `[start, end)` is unavailable, so a guest may not
    /// book straight through a booked/blocked span.
    private func rangeStraddlesUnavailable(from start: Date, to end: Date) -> Bool {
        guard !unavailableDays.isEmpty else { return false }
        var night = calendar.startOfDay(for: start)
        let checkout = calendar.startOfDay(for: end)
        while night < checkout {
            if unavailableDays.contains(night) { return true }
            guard let next = calendar.date(byAdding: .day, value: 1, to: night) else { break }
            night = next
        }
        return false
    }

    private func isInRange(_ day: Date) -> Bool {
        guard let start = draftIn, let end = draftOut else { return false }
        let d = calendar.startOfDay(for: day)
        return d > start && d < end
    }

    // MARK: - Month paging

    private func shiftMonth(by months: Int) {
        guard let next = calendar.date(byAdding: .month, value: months, to: visibleMonth) else { return }
        let nextStart = calendar.monthStart(for: next)
        // Never page before the current month.
        if nextStart >= currentMonthStart {
            withAnimation(.easeInOut(duration: 0.15)) { visibleMonth = nextStart }
        }
    }

    private var canGoPrev: Bool {
        visibleMonth > currentMonthStart
    }

    // MARK: - Derived values

    private var today: Date { calendar.startOfDay(for: Date()) }
    private var currentMonthStart: Date { calendar.monthStart(for: today) }

    private var monthTitle: String {
        let f = DateFormatter()
        f.calendar = calendar
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "MMMM"
        return f.string(from: visibleMonth)
    }

    private var yearTitle: String {
        let f = DateFormatter()
        f.calendar = calendar
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "yyyy"
        return f.string(from: visibleMonth)
    }

    /// Single-letter weekday symbols ordered to match the calendar's first day
    /// (Sunday-first → S M T W T F S).
    private var weekdaySymbols: [String] {
        ["S", "M", "T", "W", "T", "F", "S"]
    }

    /// Cells for the visible month: leading nils pad to the first weekday, then
    /// one `Date` per day of the month.
    private var monthCells: [Date?] {
        guard let range = calendar.range(of: .day, in: .month, for: visibleMonth) else { return [] }
        let firstWeekday = calendar.component(.weekday, from: visibleMonth) // 1 = Sunday
        let leadingBlanks = (firstWeekday - calendar.firstWeekday + 7) % 7
        var cells: [Date?] = Array(repeating: nil, count: leadingBlanks)
        for dayOffset in 0..<range.count {
            if let day = calendar.date(byAdding: .day, value: dayOffset, to: visibleMonth) {
                cells.append(calendar.startOfDay(for: day))
            }
        }
        return cells
    }

    private var summaryText: String {
        guard let start = draftIn else { return "Select dates" }
        let f = DateFormatter()
        f.calendar = calendar
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "MMM d"
        guard let end = draftOut else {
            return "\(f.string(from: start)) → Select check-out"
        }
        let n = nights(from: start, to: end)
        return "\(f.string(from: start)) → \(f.string(from: end)) · \(n) night\(n == 1 ? "" : "s")"
    }

    private func nights(from start: Date, to end: Date) -> Int {
        max(calendar.dateComponents([.day], from: start, to: end).day ?? 0, 0)
    }

    private func accessibilityLabel(for day: Date) -> String {
        let f = DateFormatter()
        f.calendar = calendar
        f.locale = Locale(identifier: "en_US")
        f.dateStyle = .full
        return f.string(from: day)
    }

    // MARK: - Calendar factory

    private static func makeCalendar() -> Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.firstWeekday = 1 // Sunday
        cal.locale = Locale(identifier: "en_US")
        return cal
    }
}

private extension Calendar {
    /// First moment of the month containing `date`.
    func monthStart(for date: Date) -> Date {
        let comps = dateComponents([.year, .month], from: date)
        return self.date(from: comps) ?? startOfDay(for: date)
    }
}
