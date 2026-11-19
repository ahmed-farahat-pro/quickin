import SwiftUI

/// The host's day-by-day calendar for one listing: what each night costs, where
/// that price came from, and whether the night is still sellable. The native
/// port of the web's `src/app/host/[id]/calendar/calendar-editor.tsx`.
///
/// One month at a time on an iPhone, two side by side on a regular-width iPad.
/// Months page with the arrows, a sideways swipe on the grid (mirrored in
/// Arabic), the "Today" button, or the month title, which opens a picker over
/// the whole 24-month horizon.
///
/// Selection is "tap start, tap end" — rules and tests in
/// `HostCalendarSelection.swift`:
///   • tap a day, then another → the range between them is selected;
///   • tap the first day again → keep just that day;
///   • tap a selected day      → remove it.
/// The editor then sits in a bottom panel and prices, resets, blocks or opens
/// everything selected in one request.
///
/// Prices shown are the host's RAW rates — the numbers they type and are paid —
/// with the guest-inclusive figure alongside, matching the pricing fields in
/// `AvailabilityManagerView`. Booked and past days are inert.
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

    private typealias Sel = HostCalendarSelection

    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.dismiss) private var dismiss
    @Environment(\.horizontalSizeClass) private var sizeClass
    /// The app's language decides the direction, not the environment: this view
    /// is presented as a sheet, and the hosts present it without passing the
    /// root's `layoutDirection` on, so Arabic would otherwise lay out left to right.
    private var layoutDirection: LayoutDirection { loc.lang.layoutDirection }

    /// `yyyy-MM-dd` → the day, as the server last described it.
    @State private var days: [String: CalendarDay] = [:]
    @State private var selected: Set<String> = []
    /// The first day of a range still waiting for its end.
    @State private var anchor: String?
    /// The first visible month, as an offset from this month. Clamped on read.
    @State private var offset = 0
    /// Which way the last page turn went, so the months slide in from that side.
    @State private var pagedForward = true
    @State private var pickerOpen = false
    @State private var priceText: String = ""
    @FocusState private var priceFocused: Bool
    @State private var isSaving = false
    @State private var errorMessage: String?
    /// The short-lived confirmation after a save.
    @State private var notice: String?
    @State private var commissionRate: Double = 0

    /// Months (their first day) already fetched or being fetched, so paging back
    /// and forth doesn't refetch.
    @State private var loadedMonths: Set<String> = []
    @State private var loadingMonths: Set<String> = []

    /// Set while a sideways drag is under way, so the day the finger lifts on
    /// isn't also toggled by the tap.
    @State private var swiping = false

    private static let cellHeight: CGFloat = 52
    private static let band = Theme.burgundy.opacity(0.12)
    private static let line = Theme.burgundy.opacity(0.12)
    private static let customGold = Color(hex: 0xF3C66B)

    // MARK: - Calendar maths
    //
    // All of it in UTC on a Gregorian calendar, deliberately: a night belongs to
    // a calendar day, not an instant, and a device in a half-hour timezone (or
    // on a Hijri calendar) must not shift which day a price lands on.

    /// Today in the LISTING's timezone, not the device's. A host in another
    /// country must not be told tonight is in the past, and the API answers the
    /// same question in Cairo.
    private static var today: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.timeZone = TimeZone(identifier: "Africa/Cairo") ?? TimeZone(identifier: "UTC")!
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    /// 0 = no panel, 1 = slim (a range half-made), 2 = the full editor.
    private var panelMode: Int { selected.isEmpty ? 0 : (anchor == nil ? 2 : 1) }

    private var visible: Int { sizeClass == .regular ? 2 : 1 }
    private var page: Int { Sel.clampMonthOffset(offset, visible: visible) }
    private var lastPage: Int { Sel.clampMonthOffset(Int.max / 2, visible: visible) }

    /// The first day of each month on screen.
    private var months: [String] {
        let today = Self.today
        return (0..<visible).map { Sel.monthStart(today, page + $0) }
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
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        header
                        monthNav.id("nav")
                        legend
                        monthsView
                        if selected.isEmpty { howTo }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 10)
                    .padding(.bottom, 16)
                }
                .scrollDismissesKeyboard(.interactively)
                // The panel floats over the bottom of the page; insetting by it
                // means the last week of the month can always be scrolled clear.
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    if !selected.isEmpty { panel }
                }
                .onChange(of: panelMode) { _, mode in
                    // When the panel arrives or grows, bring the month up under
                    // the navigation so as much of the grid as fits stays above
                    // it — never past the arrows.
                    guard mode > 0 else { return }
                    Task { @MainActor in
                        // Let the panel lay out first so the inset is current.
                        try? await Task.sleep(for: .milliseconds(280))
                        withAnimation(.easeOut(duration: 0.25)) { proxy.scrollTo("nav", anchor: .top) }
                    }
                }
            }
            .background(Theme.cream.ignoresSafeArea())
            .overlay(alignment: .bottom) { toast }
            .navigationTitle(loc.t("calendar.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(loc.t("common.done")) { dismiss() }
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button(loc.t("common.done")) { priceFocused = false }
                }
            }
            .sheet(isPresented: $pickerOpen) { monthPicker }
        }
        .environment(\.layoutDirection, layoutDirection)
        // Lazy: the visible month(s) plus one ahead, on every page change.
        .task(id: "\(page)-\(visible)") { await loadPage() }
        .task(id: notice) {
            guard notice != nil else { return }
            try? await Task.sleep(for: .seconds(4))
            withAnimation { notice = nil }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(listing.title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.ink)
                .lineLimit(1)
            Text(loc.t("calendar.subtitle")
                .replacingOccurrences(of: "{base}", with: Sel.grouped(listing.pricePerNight))
                .replacingOccurrences(of: "{currency}", with: currency))
                .font(.system(size: 13))
                .foregroundStyle(Theme.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Month navigation

    private var monthNav: some View {
        HStack(spacing: 6) {
            arrowButton(next: false)
            Button { pickerOpen = true } label: {
                HStack(spacing: 6) {
                    Text(navTitle)
                        .font(.system(size: 19, weight: .bold, design: .serif))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 11, weight: .bold))
                        .opacity(0.7)
                }
                .foregroundStyle(Theme.burgundy)
                .padding(.horizontal, 10)
                .frame(minHeight: 44)
                .frame(maxWidth: .infinity)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(loc.t("calendar.jumpToMonth"))
            .accessibilityValue(navTitle)
            arrowButton(next: true)
            Button { goTo(0) } label: {
                Text(loc.t("calendar.today"))
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                    .padding(.horizontal, 12)
                    .frame(minHeight: 36)
                    .background(Capsule().fill(.white))
                    .overlay(Capsule().stroke(Self.line, lineWidth: 1))
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(page == 0)
            .opacity(page == 0 ? 0.45 : 1)
        }
    }

    private func arrowButton(next: Bool) -> some View {
        let enabled = next ? page < lastPage : page > 0
        return Button { goTo(page + (next ? 1 : -1)) } label: {
            // backward/forward symbols flip on their own in right-to-left.
            Image(systemName: next ? "chevron.forward" : "chevron.backward")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.burgundy)
                .frame(width: 44, height: 44)
                .background(Circle().fill(.white))
                .overlay(Circle().stroke(Self.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.35)
        .accessibilityLabel(loc.t(next ? "calendar.nextMonth" : "calendar.prevMonth"))
    }

    private var navTitle: String {
        if months.count > 1, let first = months.first, let last = months.last {
            return "\(monthLabel(first, template: "MMMyyyy")) – \(monthLabel(last, template: "MMMyyyy"))"
        }
        return monthLabel(months.first ?? Sel.monthStart(Self.today, 0), template: "MMMMyyyy")
    }

    private func goTo(_ to: Int) {
        let target = Sel.clampMonthOffset(to, visible: visible)
        pickerOpen = false
        guard target != page else { return }
        pagedForward = target > page
        withAnimation(.easeInOut(duration: 0.22)) { offset = target }
    }

    // MARK: - Legend

    private var legend: some View {
        // Wraps onto two lines on a phone rather than truncating.
        let items: [AnyView] = [
            AnyView(legendSwatch(fill: .white, label: loc.t("calendar.legend.default"))),
            AnyView(HStack(spacing: 5) {
                Text("1,500").font(.system(size: 11, weight: .heavy)).foregroundStyle(Theme.goldDeep)
                Text(loc.t("calendar.legend.custom")).font(.system(size: 12)).foregroundStyle(Theme.muted)
            }),
            AnyView(legendSwatch(fill: Theme.burgundy, label: loc.t("calendar.legend.selected"), stroke: Theme.burgundy)),
            AnyView(HStack(spacing: 5) {
                ZStack {
                    RoundedRectangle(cornerRadius: 4).fill(.white)
                    Hatch().stroke(Theme.ink.opacity(0.18), lineWidth: 1.5)
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                }
                .overlay(RoundedRectangle(cornerRadius: 4).stroke(Self.line, lineWidth: 1))
                .frame(width: 14, height: 14)
                Text(loc.t("calendar.legend.blocked")).font(.system(size: 12)).foregroundStyle(Theme.muted)
            }),
            AnyView(legendSwatch(fill: Theme.ink.opacity(0.10), label: loc.t("calendar.legend.booked"))),
        ]
        return FlowRow(spacing: 14, lineSpacing: 6) {
            ForEach(items.indices, id: \.self) { items[$0] }
        }
    }

    private func legendSwatch(fill: Color, label: String, stroke: Color = Self.line) -> some View {
        HStack(spacing: 5) {
            RoundedRectangle(cornerRadius: 4)
                .fill(fill)
                .overlay(RoundedRectangle(cornerRadius: 4).stroke(stroke, lineWidth: 1))
                .frame(width: 14, height: 14)
            Text(label).font(.system(size: 12)).foregroundStyle(Theme.muted)
        }
    }

    // MARK: - Months

    private var monthsView: some View {
        HStack(alignment: .top, spacing: 24) {
            ForEach(months, id: \.self) { first in
                monthSection(first)
            }
        }
        .id(months.joined())
        .transition(.push(from: pagedForward ? .trailing : .leading))
        .contentShape(Rectangle())
        // A sideways swipe pages; simultaneous so the ScrollView keeps its
        // vertical scroll and the day buttons keep their taps.
        .simultaneousGesture(
            DragGesture(minimumDistance: 16)
                .onChanged { value in
                    let dx = value.translation.width, dy = value.translation.height
                    if abs(dx) > 12 && abs(dx) > abs(dy) { swiping = true }
                }
                .onEnded { value in
                    let dir = Sel.swipeDirection(
                        dx: value.translation.width,
                        dy: value.translation.height,
                        rtl: layoutDirection == .rightToLeft
                    )
                    if let dir { goTo(page + (dir == .next ? 1 : -1)) }
                    Task { @MainActor in
                        try? await Task.sleep(for: .milliseconds(300))
                        swiping = false
                    }
                }
        )
    }

    private func monthSection(_ first: String) -> some View {
        let editable = Sel.monthDays(first).filter(isEditable)
        let full = Sel.isMonthFullySelected(selected, editable: editable)
        let cells = Sel.monthGrid(first)
        let padded = cells + Array(repeating: nil, count: (7 - cells.count % 7) % 7)
        let rows = stride(from: 0, to: padded.count, by: 7).map { Array(padded[$0..<$0 + 7]) }
        let loading = loadingMonths.contains(first)

        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                // The navigation already names the month on a phone.
                if visible > 1 {
                    Text(monthLabel(first, template: "MMMMyyyy"))
                        .font(.system(size: 17, weight: .bold, design: .serif))
                        .foregroundStyle(Theme.burgundy)
                }
                Spacer()
                if !editable.isEmpty {
                    Button(loc.t(full ? "calendar.unselectMonth" : "calendar.selectMonth")) { toggleMonth(editable) }
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.burgundy)
                        .underline(true, color: Theme.burgundy.opacity(0.3))
                        .frame(minHeight: 32)
                }
            }

            HStack(spacing: 0) {
                ForEach(Array(weekdayInitials.enumerated()), id: \.offset) { _, name in
                    Text(name)
                        .font(.system(size: 11.5, weight: .bold))
                        .foregroundStyle(Theme.muted)
                        .frame(maxWidth: .infinity)
                }
            }
            .accessibilityHidden(true)

            VStack(spacing: 4) {
                ForEach(rows.indices, id: \.self) { r in
                    HStack(spacing: 0) {
                        ForEach(0..<7, id: \.self) { c in
                            if let key = rows[r][c] {
                                dayCell(key, column: c)
                            } else {
                                Color.clear.frame(maxWidth: .infinity).frame(height: Self.cellHeight)
                            }
                        }
                    }
                }
            }
            .opacity(loading ? 0.55 : 1)
            .animation(.easeInOut(duration: 0.3), value: loading)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Day cell

    private func dayCell(_ key: String, column: Int) -> some View {
        let day = days[key]
        let position = Sel.runPosition(selected, key)
        let past = key < Self.today
        let booked = day?.status == .booked
        let blocked = day?.status == .blocked
        let custom = day?.source == .custom
        let editable = isEditable(key)
        let solid = position == .single || position == .start || position == .end
        let middle = position == .middle
        let isToday = key == Self.today
        let pending = anchor == key
        let firstOfMonth = key.hasSuffix("-01")
        let lastOfMonth = Sel.addDays(key, 1)?.hasSuffix("-01") ?? false
        let rowStart = column == 0 || firstOfMonth
        let rowEnd = column == 6 || lastOfMonth

        let textColor: Color = solid ? .white : middle ? Theme.burgundy : (past || booked ? Theme.muted : Theme.ink)
        let priceColor: Color = solid ? .white.opacity(0.92) : middle ? Theme.burgundy : (custom ? Theme.goldDeep : Theme.muted)

        return Button {
            tap(key)
        } label: {
            ZStack(alignment: .topTrailing) {
                VStack(spacing: 2) {
                    Text(String(Int(key.suffix(2)) ?? 0))
                        .font(.system(size: 13.5, weight: .bold))
                        .foregroundStyle(isToday && !solid ? Theme.burgundy : textColor)
                    if let day, !past, !booked {
                        Text(Sel.compactPrice(day.price))
                            .font(.system(size: 10.5, weight: custom ? .heavy : .medium))
                            .monospacedDigit()
                            .strikethrough(blocked, color: priceColor)
                            .foregroundStyle(priceColor)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                    }
                    if booked {
                        Text("●").font(.system(size: 9)).foregroundStyle(Theme.muted)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                if custom && !past && !booked {
                    Circle()
                        .fill(solid ? Self.customGold : Theme.goldDeep)
                        .frame(width: 6, height: 6)
                        .padding(5)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: Self.cellHeight)
            .background(dayFill(solid: solid, middle: middle, blocked: blocked, inert: past || booked))
            .overlay {
                if isToday && !solid {
                    RoundedRectangle(cornerRadius: 12).strokeBorder(Theme.burgundy.opacity(0.45), lineWidth: 2)
                }
            }
            .overlay {
                if pending {
                    // A ring around the day waiting for its range's end.
                    ZStack {
                        RoundedRectangle(cornerRadius: 13).stroke(.white, lineWidth: 2).padding(-1)
                        RoundedRectangle(cornerRadius: 15).stroke(Theme.burgundy, lineWidth: 2).padding(-3)
                    }
                }
            }
            .contentShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(DayPressStyle())
        .allowsHitTesting(editable)
        .padding(.horizontal, 2)
        .frame(maxWidth: .infinity)
        .background(bandBackground(position, rowStart: rowStart, rowEnd: rowEnd))
        .accessibilityLabel(accessibilityLabel(key: key, day: day, booked: booked, blocked: blocked, custom: custom, past: past))
        .accessibilityAddTraits(position != nil ? [.isSelected, .isButton] : .isButton)
    }

    @ViewBuilder
    private func dayFill(solid: Bool, middle: Bool, blocked: Bool, inert: Bool) -> some View {
        let shape = RoundedRectangle(cornerRadius: 12)
        if solid {
            shape.fill(Theme.burgundy)
        } else if middle {
            Color.clear
        } else if inert {
            shape.fill(Theme.ink.opacity(0.05))
        } else if blocked {
            ZStack {
                shape.fill(.white)
                Hatch().stroke(Theme.ink.opacity(0.09), lineWidth: 3.5).clipShape(shape)
                shape.stroke(Self.line, lineWidth: 1)
            }
        } else {
            ZStack {
                shape.fill(.white)
                shape.stroke(Self.line, lineWidth: 1)
            }
        }
    }

    /// The connected band behind a selected run: full under a middle day, half
    /// (toward its neighbour) under a run's ends, rounded where a week row or
    /// the month breaks it. HStack halves and leading/trailing radii mirror in
    /// right-to-left on their own.
    @ViewBuilder
    private func bandBackground(_ position: Sel.RunPosition?, rowStart: Bool, rowEnd: Bool) -> some View {
        switch position {
        case .middle:
            UnevenRoundedRectangle(
                topLeadingRadius: rowStart ? 12 : 0,
                bottomLeadingRadius: rowStart ? 12 : 0,
                bottomTrailingRadius: rowEnd ? 12 : 0,
                topTrailingRadius: rowEnd ? 12 : 0
            )
            .fill(Self.band)
        case .start where !rowEnd:
            HStack(spacing: 0) { Color.clear; Self.band }
        case .end where !rowStart:
            HStack(spacing: 0) { Self.band; Color.clear }
        default:
            Color.clear
        }
    }

    private func accessibilityLabel(key: String, day: CalendarDay?, booked: Bool, blocked: Bool, custom: Bool, past: Bool) -> String {
        var parts = [fullDay(key)]
        if booked { parts.append(loc.t("calendar.legend.booked")) }
        else if blocked { parts.append(loc.t("calendar.legend.blocked")) }
        if custom { parts.append(loc.t("calendar.legend.custom")) }
        if let day, !past { parts.append("\(Sel.grouped(day.price)) \(currency)") }
        return parts.joined(separator: " — ")
    }

    // MARK: - Empty state

    private var howTo: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(loc.t("calendar.emptyTitle"))
                .font(.system(size: 17, weight: .bold, design: .serif))
                .foregroundStyle(Theme.burgundy)
            ForEach(Array(["calendar.howTo.start", "calendar.howTo.end", "calendar.howTo.price"].enumerated()), id: \.offset) { i, key in
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("\(i + 1).").font(.system(size: 13.5, weight: .semibold))
                    Text(loc.t(key)).font(.system(size: 13.5)).fixedSize(horizontal: false, vertical: true)
                }
                .foregroundStyle(Theme.muted)
            }
            Text(loc.t("calendar.howTo.more"))
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.muted)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 2)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(.white))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Self.line, lineWidth: 1))
    }

    // MARK: - Editor panel

    private var panel: some View {
        let stats = selectionStats
        let sortedSel = selected.sorted()
        let span = Sel.priceSpan(sortedSel) { days[$0]?.price }

        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(loc.t("calendar.nightsSelected").replacingOccurrences(of: "{count}", with: "\(stats.total)"))
                    .font(.system(size: 15.5, weight: .bold))
                    .foregroundStyle(Theme.ink)
                Spacer()
                Button(loc.t("calendar.clear")) { clearSelection() }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.muted)
                    .frame(minHeight: 32)
            }

            if let anchor {
                // Slim while a range is half-made: just say what to do next.
                Text(loc.t("calendar.pendingHint").replacingOccurrences(of: "{date}", with: shortDay(anchor)))
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 10).padding(.vertical, 8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Theme.cream))
            } else {
                summary(span: span, dates: sortedSel)
                editor(stats: stats, span: span)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color(hex: 0xB3261E))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            UnevenRoundedRectangle(topLeadingRadius: 20, topTrailingRadius: 20)
                .fill(.white)
                .shadow(color: Theme.ink.opacity(0.16), radius: 15, y: -6)
                .ignoresSafeArea(edges: .bottom)
        )
        .animation(.easeOut(duration: 0.2), value: anchor == nil)
    }

    private func summary(span: (min: Double, max: Double)?, dates: [String]) -> some View {
        let runs = Sel.selectionRuns(dates)
        var text = runs.prefix(3).map { r in
            r.days == 1 ? shortDay(r.start) : "\(shortDay(r.start)) – \(shortDay(r.end))"
        }.joined(separator: " · ")
        if runs.count > 3 {
            text += " · " + loc.t("calendar.moreRanges").replacingOccurrences(of: "{count}", with: "\(runs.count - 3)")
        }
        return VStack(alignment: .leading, spacing: 2) {
            Text(text)
            if let span {
                Text(span.min == span.max
                     ? loc.t("calendar.currently")
                        .replacingOccurrences(of: "{amount}", with: Sel.grouped(span.min))
                        .replacingOccurrences(of: "{currency}", with: currency)
                     : loc.t("calendar.currentlyRange")
                        .replacingOccurrences(of: "{min}", with: Sel.grouped(span.min))
                        .replacingOccurrences(of: "{max}", with: Sel.grouped(span.max))
                        .replacingOccurrences(of: "{currency}", with: currency))
            }
        }
        .font(.system(size: 13))
        .foregroundStyle(Theme.muted)
        .fixedSize(horizontal: false, vertical: true)
    }

    private func editor(stats: (total: Int, blocked: Int, custom: Int), span: (min: Double, max: Double)?) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                TextField(span.map { Sel.grouped($0.min) } ?? loc.t("calendar.pricePlaceholder"), text: $priceText)
                    .keyboardType(.numberPad)
                    .focused($priceFocused)
                    .font(.system(size: 16, weight: .semibold))
                    .padding(.horizontal, 12)
                    .frame(height: 46)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Theme.cream))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(priceFocused ? Theme.burgundy : Self.line, lineWidth: priceFocused ? 2 : 1))
                    .onChange(of: priceText) { _, _ in errorMessage = nil }
                    .accessibilityLabel(loc.t("calendar.pricePlaceholder"))

                Button {
                    Task { await applyPrice() }
                } label: {
                    Text(isSaving ? loc.t("calendar.saving") : loc.t("calendar.setPrice"))
                        .font(.system(size: 14, weight: .bold))
                        .lineLimit(1)
                        .padding(.horizontal, 16)
                        .frame(height: 46)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.burgundy))
                        .foregroundStyle(.white)
                }
                .buttonStyle(.plain)
                .disabled(isSaving)
                .opacity(isSaving ? 0.55 : 1)
            }

            if let guestPreview {
                Text(loc.t("calendar.guestsPay")
                    .replacingOccurrences(of: "{amount}", with: Sel.grouped(guestPreview))
                    .replacingOccurrences(of: "{currency}", with: currency))
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.muted)
            }

            // Only the actions that would actually change something. Offering
            // "Open" for a selection with nothing blocked in it invites a host
            // to press a button that can only be a no-op.
            if stats.custom > 0 || stats.blocked < stats.total || stats.blocked > 0 {
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
                .padding(.top, 2)
            }
        }
    }

    private func secondaryButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13.5, weight: .bold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .padding(.horizontal, 12)
                .frame(minHeight: 44)
                .background(RoundedRectangle(cornerRadius: 12).fill(.white))
                .foregroundStyle(Theme.ink)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Self.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .disabled(isSaving)
        .opacity(isSaving ? 0.55 : 1)
    }

    // MARK: - Toast

    @ViewBuilder
    private var toast: some View {
        if let notice {
            Text(notice)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 18).padding(.vertical, 12)
                .background(RoundedRectangle(cornerRadius: 12).fill(Theme.ink))
                .shadow(color: .black.opacity(0.2), radius: 12, y: 6)
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .accessibilityAddTraits(.updatesFrequently)
                .onAppear { UIAccessibility.post(notification: .announcement, argument: notice) }
        }
    }

    // MARK: - Month picker

    private var monthPicker: some View {
        let today = Self.today
        let all = (0..<Sel.maxMonthsAhead).map { (i: $0, first: Sel.monthStart(today, $0)) }
        let years = all.map { String($0.first.prefix(4)) }.reduce(into: [String]()) { if !$0.contains($1) { $0.append($1) } }
        // Which months carry custom prices or part of the selection — a dot each,
        // so the picker doubles as an overview of the horizon.
        var customMonths = Set<String>()
        for (key, day) in days where day.source == .custom && key >= today { customMonths.insert(String(key.prefix(7))) }
        let selectedMonths = Set(selected.map { String($0.prefix(7)) })

        return NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(years, id: \.self) { year in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(year)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(Theme.muted)
                            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 4), spacing: 6) {
                                ForEach(all.filter { $0.first.hasPrefix(year) }, id: \.i) { m in
                                    pickerMonth(
                                        index: m.i,
                                        first: m.first,
                                        custom: customMonths.contains(String(m.first.prefix(7))),
                                        hasSelection: selectedMonths.contains(String(m.first.prefix(7)))
                                    )
                                }
                            }
                        }
                    }
                }
                .padding(16)
            }
            .background(Theme.cream.ignoresSafeArea())
            .navigationTitle(loc.t("calendar.jumpToMonth"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(loc.t("common.done")) { pickerOpen = false }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .environment(\.layoutDirection, layoutDirection)
    }

    private func pickerMonth(index: Int, first: String, custom: Bool, hasSelection: Bool) -> some View {
        let onPage = index >= page && index < page + visible
        return Button { goTo(index) } label: {
            VStack(spacing: 4) {
                Text(monthLabel(first, template: "MMM"))
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(onPage ? .white : Theme.ink)
                HStack(spacing: 3) {
                    if hasSelection { Circle().fill(onPage ? .white : Theme.burgundy).frame(width: 5, height: 5) }
                    if custom { Circle().fill(onPage ? Self.customGold : Theme.goldDeep).frame(width: 5, height: 5) }
                }
                .frame(height: 5)
            }
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(RoundedRectangle(cornerRadius: 10).fill(onPage ? Theme.burgundy : .white))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(onPage ? Theme.burgundy : Self.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(monthLabel(first, template: "MMMMyyyy"))
        .accessibilityAddTraits(onPage ? .isSelected : [])
    }

    // MARK: - Selection

    private func tap(_ key: String) {
        guard !swiping else { return }
        notice = nil
        let r = Sel.tapDay(selected: selected, anchor: anchor, date: key, isEditable: isEditable)
        if r.tooLong {
            errorMessage = loc.t("calendar.errors.tooLong")
                .replacingOccurrences(of: "{max}", with: "\(Sel.maxDatesPerRequest)")
            return
        }
        errorMessage = nil
        withAnimation(.easeOut(duration: 0.12)) {
            selected = r.selected
            anchor = r.anchor
        }
        if selected.isEmpty { priceText = "" }
    }

    private func toggleMonth(_ editable: [String]) {
        selected = Sel.toggleMonth(selected, editable: editable)
        anchor = nil
        errorMessage = nil
        notice = nil
    }

    private func clearSelection() {
        selected.removeAll()
        anchor = nil
        priceText = ""
        errorMessage = nil
        priceFocused = false
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

    /// Fetch the visible month(s) plus one ahead, in one request spanning them.
    private func loadPage() async {
        let today = Self.today
        let want = Sel.offsetsToLoad(page: page, visible: visible)
            .map { Sel.monthStart(today, $0) }
            .filter { !loadedMonths.contains($0) }
        guard let firstMonth = want.first, let lastMonth = want.last,
              let end = Sel.monthDays(lastMonth).last else { return }
        loadedMonths.formUnion(want)
        loadingMonths.formUnion(want)
        defer { loadingMonths.subtract(want) }
        // The past isn't priced; start the window today.
        let start = firstMonth < today ? today : firstMonth
        do {
            let calendar = try await BookingService.shared.fetchCalendar(
                listingID: listing.id, start: start, end: end
            )
            commissionRate = calendar.commissionRate
            for day in calendar.days { days[day.date] = day }
        } catch {
            // A month that fails to load shows its days unpriced and stays
            // editable; a later visit retries it.
            loadedMonths.subtract(want)
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
        priceFocused = false
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
            clearSelection()
            withAnimation {
                notice = result.skipped.isEmpty
                    ? loc.t("calendar.saved").replacingOccurrences(of: "{count}", with: "\(result.updated)")
                    : loc.t("calendar.savedWithSkips")
                        .replacingOccurrences(of: "{count}", with: "\(result.updated)")
                        .replacingOccurrences(of: "{skipped}", with: "\(result.skipped.count)")
            }
        } catch BookingError.notSignedIn {
            errorMessage = loc.t("calendar.errors.signIn")
        } catch let BookingError.message(text) {
            errorMessage = text
        } catch {
            errorMessage = loc.t("calendar.errors.saveFailed")
        }
    }

    // MARK: - Formatting

    private func formatter(_ template: String) -> DateFormatter {
        let f = DateFormatter()
        f.locale = Locale(identifier: loc.lang.localeIdentifier)
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        f.calendar = cal
        f.timeZone = TimeZone(identifier: "UTC")
        f.setLocalizedDateFormatFromTemplate(template)
        return f
    }

    private func monthLabel(_ first: String, template: String) -> String {
        guard let d = Sel.date(first) else { return first }
        return formatter(template).string(from: d)
    }

    /// "Nov 22" in the app's language — the run summary and the pending hint.
    private func shortDay(_ key: String) -> String {
        guard let d = Sel.date(key) else { return key }
        return formatter("MMMd").string(from: d)
    }

    private func fullDay(_ key: String) -> String {
        guard let d = Sel.date(key) else { return key }
        return formatter("EEEEMMMMdyyyy").string(from: d)
    }

    /// Sunday-first weekday initials in the app's language.
    private var weekdayInitials: [String] {
        let f = formatter("EEEEE")
        let symbols = f.veryShortStandaloneWeekdaySymbols ?? f.shortWeekdaySymbols ?? []
        return symbols.count == 7 ? symbols : Array(repeating: "", count: 7)
    }
}

// MARK: - Pieces

/// Diagonal stripes for a blocked day — the web's 135° hatching.
private struct Hatch: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        var x = -rect.height
        while x < rect.width {
            p.move(to: CGPoint(x: x, y: rect.height))
            p.addLine(to: CGPoint(x: x + rect.height, y: 0))
            x += 9
        }
        return p
    }
}

/// A day's press feedback: a small squeeze, no system highlight.
private struct DayPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.95 : 1)
            .animation(.easeOut(duration: 0.08), value: configuration.isPressed)
    }
}

/// Lays its children left to right (leading to trailing), wrapping onto new
/// lines — the legend on a narrow phone.
private struct FlowRow: Layout {
    var spacing: CGFloat = 12
    var lineSpacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, lineHeight: CGFloat = 0, widest: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x > 0 && x + s.width > width {
                y += lineHeight + lineSpacing
                x = 0
                lineHeight = 0
            }
            x += s.width + spacing
            widest = max(widest, x - spacing)
            lineHeight = max(lineHeight, s.height)
        }
        return CGSize(width: proposal.width ?? widest, height: y + lineHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, lineHeight: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x > bounds.minX && x + s.width > bounds.maxX {
                y += lineHeight + lineSpacing
                x = bounds.minX
                lineHeight = 0
            }
            v.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(s))
            x += s.width + spacing
            lineHeight = max(lineHeight, s.height)
        }
    }
}
