import SwiftUI

/// The host's day-by-day calendar for one listing: what each night costs, where
/// that price came from, and whether the night is still sellable.
///
/// Selection is Airbnb-style and multi-day:
///   • tap a day to add or remove it,
///   • drag across days to sweep a range in or out,
///   • the bar at the bottom then prices, resets, blocks or opens everything
///     selected in one request.
///
/// Prices shown are the host's RAW rates — the numbers they type and are paid —
/// with the guest-inclusive figure alongside, matching the pricing fields in
/// `AvailabilityManagerView`. Booked days are inert: they can't be selected, so
/// the action bar can never be aimed at a night a guest already holds.
///
/// The server is the source of truth for what a day costs. Every save takes the
/// days back from the response rather than patching locally, because a day whose
/// pin was just reset gets its new price from the weekend/month/base ladder,
/// which only the server can evaluate.
struct HostCalendarView: View {
    let listing: Listing

    /// The listing's currency, or the platform default. `Listing.currency` is
    /// optional on rows written before the column existed.
    private var currency: String { listing.currency ?? "EGP" }

    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.dismiss) private var dismiss

    /// `yyyy-MM-dd` → the day, as the server last described it.
    @State private var days: [String: CalendarDay] = [:]
    @State private var selected: Set<String> = []
    @State private var priceText: String = ""
    @State private var isLoading = false
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var notice: String?
    @State private var commissionRate: Double = 0

    /// The day a drag started on, and whether that drag adds or removes. Fixed
    /// when the finger goes down so sweeping back and forth over a day doesn't
    /// flip it repeatedly.
    @State private var dragAnchor: String?
    @State private var dragAdds = true

    /// How many months the grid paints. The API caps a single window, so the
    /// months load in chunks as they come into view.
    private static let monthsVisible = 12

    /// Months already fetched, keyed by their first day, so scrolling back and
    /// forth doesn't refetch.
    @State private var loadedMonths: Set<String> = []

    // MARK: - Calendar maths
    //
    // All of it in UTC on a Gregorian calendar, deliberately: a night belongs to
    // a calendar day, not an instant, and a device in a half-hour timezone (or
    // on a Hijri calendar) must not shift which day a price lands on. This is
    // the same rule `date-pricing-core.ts` follows on the server.

    private static var utcCalendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        c.locale = Locale(identifier: "en_US_POSIX")
        return c
    }()

    private static let apiFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = utcCalendar
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private static func key(_ date: Date) -> String { apiFormatter.string(from: date) }
    private static func date(_ key: String) -> Date? { apiFormatter.date(from: key) }

    /// Today in the LISTING's timezone, not the device's. A host in another
    /// country must not be told tonight is in the past, and the API answers the
    /// same question in Cairo.
    private static var today: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = utcCalendar
        f.timeZone = TimeZone(identifier: "Africa/Cairo") ?? TimeZone(identifier: "UTC")!
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    /// The first day of each month the grid paints, starting with this one.
    private var months: [Date] {
        let cal = Self.utcCalendar
        let now = Self.date(Self.today) ?? Date()
        let firstOfThis = cal.date(from: cal.dateComponents([.year, .month], from: now)) ?? now
        return (0..<Self.monthsVisible).compactMap { cal.date(byAdding: .month, value: $0, to: firstOfThis) }
    }

    /// A month's days, plus the leading blanks that put the 1st under its
    /// weekday column. Sunday-first, matching the server's `extract(dow)`.
    private func grid(for month: Date) -> [Date?] {
        let cal = Self.utcCalendar
        guard let range = cal.range(of: .day, in: .month, for: month) else { return [] }
        // `weekday` is 1-based with Sunday = 1, so subtracting 1 gives the number
        // of blanks before the 1st in a Sunday-first grid.
        let leading = cal.component(.weekday, from: month) - 1
        var cells: [Date?] = Array(repeating: nil, count: max(0, leading))
        for offset in 0..<range.count {
            cells.append(cal.date(byAdding: .day, value: offset, to: month))
        }
        return cells
    }

    /// Every day from `from` to `to`, inclusive — a swept range.
    private func expand(from: String, to: String) -> [String] {
        guard let a = Self.date(from), let b = Self.date(to) else { return [] }
        let (lo, hi) = a <= b ? (a, b) : (b, a)
        var out: [String] = []
        var cursor = lo
        // Bounded by the visible year; the guard stops a corrupt pair spinning.
        while cursor <= hi && out.count < 800 {
            out.append(Self.key(cursor))
            guard let next = Self.utcCalendar.date(byAdding: .day, value: 1, to: cursor) else { break }
            cursor = next
        }
        return out
    }

    /// A day the host may act on: not in the past, not held by a reservation.
    /// A day we have no data for yet counts as editable, so a month still
    /// loading doesn't look permanently locked.
    private func isEditable(_ key: String) -> Bool {
        guard key >= Self.today else { return false }
        return days[key]?.isEditable ?? true
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                Theme.cream.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        header
                        legend
                        ForEach(months, id: \.self) { month in
                            monthSection(month)
                        }
                        // Room for the action bar so the last month isn't stuck
                        // underneath it.
                        Color.clear.frame(height: selected.isEmpty ? 12 : 190)
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 12)
                }

                if !selected.isEmpty { actionBar }
            }
            .navigationTitle(loc.t("calendar.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(loc.t("common.done")) { dismiss() }
                }
            }
        }
        .task { await loadVisibleMonths() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(listing.title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.ink)
            Text(loc.t("calendar.subtitle")
                .replacingOccurrences(of: "{base}", with: money(listing.pricePerNight))
                .replacingOccurrences(of: "{currency}", with: currency))
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.muted)
            if isLoading {
                ProgressView().controlSize(.small)
            }
            if let notice {
                Text(notice)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.burgundy)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var legend: some View {
        HStack(spacing: 14) {
            legendItem(color: .white, label: loc.t("calendar.legend.default"))
            HStack(spacing: 5) {
                Text("1,500").font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.goldDeep)
                Text(loc.t("calendar.legend.custom")).font(.system(size: 11.5)).foregroundStyle(Theme.muted)
            }
            legendItem(color: Theme.tan3, label: loc.t("calendar.legend.blocked"))
            legendItem(color: Theme.tan2, label: loc.t("calendar.legend.booked"))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func legendItem(color: Color, label: String) -> some View {
        HStack(spacing: 5) {
            RoundedRectangle(cornerRadius: 4)
                .fill(color)
                .overlay(RoundedRectangle(cornerRadius: 4).stroke(Theme.tan3, lineWidth: 1))
                .frame(width: 13, height: 13)
            Text(label).font(.system(size: 11.5)).foregroundStyle(Theme.muted)
        }
    }

    // MARK: - Month

    private func monthSection(_ month: Date) -> some View {
        let cells = grid(for: month)
        let monthKey = Self.key(month)
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(monthLabel(month))
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Theme.burgundy)
                Spacer()
                Button(loc.t("calendar.selectMonth")) { toggleMonth(cells) }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.burgundy)
            }

            HStack(spacing: 4) {
                ForEach(weekdayInitials, id: \.self) { name in
                    Text(name)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Theme.muted)
                        .frame(maxWidth: .infinity)
                }
            }

            // A single drag gesture over the whole month, rather than one per
            // cell: a gesture attached to a cell only ever sees its own bounds,
            // so a finger moving to the next day would end the sweep instead of
            // extending it. The grid resolves which cell is under the finger.
            GeometryReader { geo in
                let columnWidth = geo.size.width / 7
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7), spacing: 4) {
                    ForEach(Array(cells.enumerated()), id: \.offset) { _, cell in
                        if let cell {
                            dayCell(Self.key(cell))
                        } else {
                            Color.clear.frame(height: Self.cellHeight)
                        }
                    }
                }
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            guard let key = dayKey(at: value.location, cells: cells, columnWidth: columnWidth) else { return }
                            if dragAnchor == nil { beginSweep(at: key) }
                            extendSweep(to: key)
                        }
                        .onEnded { _ in dragAnchor = nil }
                )
            }
            .frame(height: gridHeight(cells.count))
            .task(id: monthKey) { await loadMonth(month) }
        }
    }

    private static let cellHeight: CGFloat = 58

    private func gridHeight(_ cellCount: Int) -> CGFloat {
        let rows = Int(ceil(Double(cellCount) / 7.0))
        return CGFloat(rows) * Self.cellHeight + CGFloat(max(0, rows - 1)) * 4
    }

    /// Which day sits under a point in the month grid. Returns nil for the
    /// leading blanks and for a finger that has strayed outside the grid.
    private func dayKey(at point: CGPoint, cells: [Date?], columnWidth: CGFloat) -> String? {
        guard columnWidth > 0 else { return nil }
        let column = Int(point.x / columnWidth)
        let row = Int(point.y / (Self.cellHeight + 4))
        guard column >= 0, column < 7, row >= 0 else { return nil }
        let index = row * 7 + column
        guard index >= 0, index < cells.count, let cell = cells[index] else { return nil }
        return Self.key(cell)
    }

    private func dayCell(_ key: String) -> some View {
        let day = days[key]
        let isSelected = selected.contains(key)
        let past = key < Self.today
        let booked = day?.status == .booked
        let blocked = day?.status == .blocked
        let custom = day?.source == .custom

        return VStack(spacing: 2) {
            Text(String(key.suffix(2)))
                .font(.system(size: 13, weight: .bold))
            if let day, !past {
                Text(money(day.price))
                    .font(.system(size: 10, weight: custom ? .bold : .regular))
                    .foregroundStyle(isSelected ? .white.opacity(0.92) : (custom ? Theme.goldDeep : Theme.muted))
            }
            if booked {
                Circle().fill(isSelected ? Color.white : Theme.muted).frame(width: 4, height: 4)
            } else if blocked {
                Text("✕").font(.system(size: 9, weight: .bold))
                    .foregroundStyle(isSelected ? .white : Theme.muted)
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: Self.cellHeight)
        .background(cellBackground(isSelected: isSelected, past: past, booked: booked, blocked: blocked))
        .foregroundStyle(isSelected ? .white : (past || booked ? Theme.muted : Theme.ink))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(isSelected ? Theme.burgundy : Theme.tan3, lineWidth: 1)
        )
        .accessibilityLabel(accessibilityLabel(key: key, day: day, booked: booked, blocked: blocked))
        .accessibilityAddTraits(isSelected ? [.isSelected, .isButton] : .isButton)
    }

    private func cellBackground(isSelected: Bool, past: Bool, booked: Bool, blocked: Bool) -> Color {
        if isSelected { return Theme.burgundy }
        if booked { return Theme.tan2 }
        if past { return Theme.cream2 }
        if blocked { return Theme.tan3 }
        return .white
    }

    private func accessibilityLabel(key: String, day: CalendarDay?, booked: Bool, blocked: Bool) -> String {
        var parts = [key]
        if booked { parts.append(loc.t("calendar.legend.booked")) }
        else if blocked { parts.append(loc.t("calendar.legend.blocked")) }
        if let day { parts.append("\(money(day.price)) \(currency)") }
        return parts.joined(separator: " — ")
    }

    // MARK: - Action bar

    private var actionBar: some View {
        let stats = selectionStats
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(loc.t("calendar.nightsSelected").replacingOccurrences(of: "{count}", with: "\(stats.total)"))
                    .font(.system(size: 14.5, weight: .semibold))
                Spacer()
                Button(loc.t("calendar.clear")) { clearSelection() }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.muted)
            }

            HStack(spacing: 8) {
                TextField(loc.t("calendar.pricePlaceholder"), text: $priceText)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(.plain)
                    .padding(.horizontal, 12).padding(.vertical, 10)
                    .background(Theme.cream)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.tan3, lineWidth: 1))

                Button {
                    Task { await applyPrice() }
                } label: {
                    Text(isSaving ? loc.t("calendar.saving") : loc.t("calendar.setPrice"))
                        .font(.system(size: 14, weight: .bold))
                        .padding(.horizontal, 14).padding(.vertical, 11)
                        .background(Theme.burgundy)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .disabled(isSaving)
            }

            if let guestPreview {
                Text(loc.t("calendar.guestsPay")
                    .replacingOccurrences(of: "{amount}", with: money(guestPreview))
                    .replacingOccurrences(of: "{currency}", with: currency))
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.muted)
            }

            // Only the actions that would actually change something. Offering
            // "Open" for a selection with nothing blocked in it invites a host
            // to press a button that can only be a no-op.
            HStack(spacing: 8) {
                if stats.custom > 0 {
                    secondaryButton(loc.t("calendar.resetPrice")) { Task { await save(price: .reset) } }
                }
                if stats.blocked < stats.total {
                    secondaryButton(loc.t("calendar.block")) { Task { await save(blocked: true) } }
                }
                if stats.blocked > 0 {
                    secondaryButton(loc.t("calendar.unblock")) { Task { await save(blocked: false) } }
                }
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.errorCoral)
            }
        }
        .padding(14)
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.12), radius: 14, y: -4)
        .padding(.horizontal, 14)
        .padding(.bottom, 10)
    }

    private func secondaryButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13.5, weight: .bold))
                .padding(.horizontal, 12).padding(.vertical, 9)
                .background(Theme.cream)
                .foregroundStyle(Theme.ink)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.tan3, lineWidth: 1))
        }
        .disabled(isSaving)
    }

    // MARK: - Selection

    private func beginSweep(at key: String) {
        guard isEditable(key) else { return }
        dragAnchor = key
        dragAdds = !selected.contains(key)
    }

    private func extendSweep(to key: String) {
        guard let anchor = dragAnchor else { return }
        // The sweep replaces itself from the anchor every time rather than
        // accumulating, so dragging back shortens the range instead of leaving
        // a trail of days the host has already moved off.
        let span = expand(from: anchor, to: key).filter(isEditable)
        if dragAdds {
            selected.formUnion(span)
        } else {
            selected.subtract(span)
        }
        errorMessage = nil
    }

    private func toggleMonth(_ cells: [Date?]) {
        let editable = cells.compactMap { $0 }.map(Self.key).filter(isEditable)
        guard !editable.isEmpty else { return }
        // A second press on a fully-selected month clears it, so a mis-tap
        // doesn't cost the host a month of manual deselection.
        if editable.allSatisfy(selected.contains) {
            selected.subtract(editable)
        } else {
            selected.formUnion(editable)
        }
        errorMessage = nil
    }

    private func clearSelection() {
        selected.removeAll()
        priceText = ""
        errorMessage = nil
    }

    private var selectionStats: (total: Int, blocked: Int, custom: Int) {
        var blocked = 0
        var custom = 0
        for key in selected {
            guard let day = days[key] else { continue }
            if day.status == .blocked { blocked += 1 }
            if day.source == .custom { custom += 1 }
        }
        return (selected.count, blocked, custom)
    }

    /// What a guest would see for the price being typed. Mirrors the server's
    /// `withCommission`: mark up, then round UP to the nearest 10.
    private var guestPreview: Double? {
        guard commissionRate > 0, let raw = Double(priceText.trimmingCharacters(in: .whitespaces)), raw > 0 else {
            return nil
        }
        let settled = (raw * (1 + commissionRate) * 100).rounded() / 100
        return (settled / 10).rounded(.up) * 10
    }

    // MARK: - Networking

    private func loadVisibleMonths() async {
        guard let first = months.first else { return }
        await loadMonth(first)
    }

    private func loadMonth(_ month: Date) async {
        let monthKey = Self.key(month)
        guard !loadedMonths.contains(monthKey) else { return }
        loadedMonths.insert(monthKey)
        let cal = Self.utcCalendar
        guard let range = cal.range(of: .day, in: .month, for: month),
              let last = cal.date(byAdding: .day, value: range.count - 1, to: month) else { return }

        isLoading = true
        defer { isLoading = false }
        do {
            let calendar = try await BookingService.shared.fetchCalendar(
                listingID: listing.id, start: monthKey, end: Self.key(last)
            )
            commissionRate = calendar.commissionRate
            for day in calendar.days { days[day.date] = day }
        } catch {
            // A month that fails to load shows its days unpriced and stays
            // editable; the host can leave and come back. Let it be retried.
            loadedMonths.remove(monthKey)
        }
    }

    private func applyPrice() async {
        let raw = priceText.trimmingCharacters(in: .whitespaces)
        guard !raw.isEmpty else {
            // An empty box with "Set price" is an unfinished thought, not a
            // reset — resetting has its own button, which says so.
            errorMessage = loc.t("calendar.errors.priceRequired")
            return
        }
        guard let amount = Double(raw), amount > 0 else {
            errorMessage = loc.t("calendar.errors.priceInvalid")
            return
        }
        await save(price: .set(amount))
    }

    private func save(price: CalendarPriceChange = .unchanged, blocked: Bool? = nil) async {
        guard !selected.isEmpty else { return }
        isSaving = true
        errorMessage = nil
        notice = nil
        defer { isSaving = false }
        do {
            let result = try await BookingService.shared.updateCalendar(
                listingID: listing.id,
                dates: selected.sorted(),
                price: price,
                blocked: blocked
            )
            // Take the days back from the server: a reset day's new price comes
            // from the weekend/month/base ladder, which only it can evaluate.
            for day in result.calendar.days { days[day.date] = day }
            commissionRate = result.calendar.commissionRate
            notice = result.skipped.isEmpty
                ? loc.t("calendar.saved").replacingOccurrences(of: "{count}", with: "\(result.updated)")
                : loc.t("calendar.savedWithSkips")
                    .replacingOccurrences(of: "{count}", with: "\(result.updated)")
                    .replacingOccurrences(of: "{skipped}", with: "\(result.skipped.count)")
            clearSelection()
        } catch BookingError.notSignedIn {
            errorMessage = loc.t("calendar.errors.signIn")
        } catch let BookingError.message(text) {
            errorMessage = text
        } catch {
            errorMessage = loc.t("calendar.errors.saveFailed")
        }
    }

    // MARK: - Formatting

    private func money(_ amount: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.maximumFractionDigits = 0
        f.locale = Locale(identifier: "en_US")
        return f.string(from: NSNumber(value: amount)) ?? String(Int(amount.rounded()))
    }

    private func monthLabel(_ month: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: loc.lang.localeIdentifier)
        f.calendar = Self.utcCalendar
        f.timeZone = TimeZone(identifier: "UTC")
        f.setLocalizedDateFormatFromTemplate("MMMM yyyy")
        return f.string(from: month)
    }

    /// Sunday-first weekday initials in the app's language.
    private var weekdayInitials: [String] {
        let f = DateFormatter()
        f.locale = Locale(identifier: loc.lang.localeIdentifier)
        f.calendar = Self.utcCalendar
        // 2023-01-01 was a Sunday — a fixed anchor, so the header can't shift
        // with the current date.
        var out: [String] = []
        var comps = DateComponents()
        comps.year = 2023; comps.month = 1; comps.day = 1
        guard let sunday = Self.utcCalendar.date(from: comps) else { return [] }
        for i in 0..<7 {
            guard let d = Self.utcCalendar.date(byAdding: .day, value: i, to: sunday) else { continue }
            let symbols = f.veryShortStandaloneWeekdaySymbols ?? f.shortWeekdaySymbols ?? []
            let index = Self.utcCalendar.component(.weekday, from: d) - 1
            out.append(index < symbols.count ? symbols[index] : "")
        }
        return out
    }
}
