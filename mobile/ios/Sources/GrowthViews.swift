import SwiftUI
import UIKit

// MARK: - Section 8 (Growth): length-of-stay discounts, promo codes
//
// Shared UI for the growth features:
//   • `LengthOfStayDiscountFields` — two percent steppers (weekly ≥7 nights /
//     monthly ≥28 nights), used in the Add-listing Details step and the host
//     discount editor sheet.
//   • `DiscountEditorView` — host-facing editor that PATCHes a single listing's
//     `weekly_discount` / `monthly_discount` (presented from the availability
//     manager, alongside the cancellation-policy editor).
//   • `ListingDiscountNote` — the small "Weekly −X% / Monthly −Y%" badge shown
//     near the listing price on detail.
//
// All copy is localized (en + ar) and laid out leading/trailing so it mirrors
// correctly under RTL. Colors come from the DesignKit tokens.

// MARK: - Length-of-stay discount fields (shared)

/// Two labeled percent steppers — weekly (≥7 nights) and monthly (≥28 nights) —
/// bound to whole-percent values (0–90). Used by the Add-listing flow and the
/// host discount editor so both stay in sync.
struct LengthOfStayDiscountFields: View {
    @Binding var weekly: Int
    @Binding var monthly: Int

    var body: some View {
        VStack(spacing: 0) {
            PercentStepperRow(
                title: L.t("growth.weeklyDiscount"),
                subtitle: L.t("growth.weeklyHint"),
                value: $weekly
            )
            Divider()
            PercentStepperRow(
                title: L.t("growth.monthlyDiscount"),
                subtitle: L.t("growth.monthlyHint"),
                value: $monthly
            )
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 4)
        .background(Color.qkCream)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

/// A labeled −/value%/+ stepper row clamped to 0…90 in 5-point steps. Mirrors
/// the boutique stepper look used elsewhere; the value reads as "X%".
private struct PercentStepperRow: View {
    let title: String
    let subtitle: String
    @Binding var value: Int

    private let step = 5
    private let maxValue = 90

    private var canDecrement: Bool { value > 0 }
    private var canIncrement: Bool { value < maxValue }

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color.qkInk)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(Color.qkMuted)
            }
            Spacer(minLength: 8)

            HStack(spacing: 14) {
                stepButton(systemName: "minus", enabled: canDecrement) {
                    value = max(0, value - step)
                }
                Text("\(value)%")
                    .font(.body.monospacedDigit().weight(.semibold))
                    .foregroundStyle(value > 0 ? Color.qkBurgundy : Color.qkInk)
                    .frame(minWidth: 44)
                    .contentTransition(.numericText())
                    .animation(.easeInOut(duration: 0.15), value: value)
                stepButton(systemName: "plus", enabled: canIncrement) {
                    value = min(maxValue, value + step)
                }
            }
        }
        .frame(minHeight: 52)
    }

    private func stepButton(systemName: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(enabled ? Color.qkBurgundy : Color.qkMuted.opacity(0.5))
                .frame(width: 32, height: 32)
                .background(
                    Circle()
                        .stroke(enabled ? Color.qkBurgundy.opacity(0.4) : Color.qkMuted.opacity(0.25),
                                lineWidth: 1.5)
                )
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}

// MARK: - Host discount editor (sheet)

/// Host-facing editor for a single listing's length-of-stay discounts, presented
/// as a sheet from `AvailabilityManagerView`. Seeds with the listing's current
/// values and PATCHes `/api/local/listings/:id` via
/// `BookingService.setLengthOfStayDiscounts`.
struct DiscountEditorView: View {
    let listing: Listing
    /// Called with the updated listing after a successful save, so the parent can
    /// refresh what it shows.
    var onSaved: (Listing) -> Void

    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.dismiss) private var dismiss

    @State private var weekly: Int
    @State private var monthly: Int
    @State private var isSaving = false
    @State private var saved = false
    @State private var errorMessage: String?

    /// Seeds the steppers from explicit `weekly`/`monthly` values (so a parent
    /// that tracks edits locally can re-open the sheet at the latest values);
    /// falls back to the listing's own discounts when omitted.
    init(listing: Listing, weekly: Int? = nil, monthly: Int? = nil, onSaved: @escaping (Listing) -> Void) {
        self.listing = listing
        self.onSaved = onSaved
        _weekly = State(initialValue: weekly ?? listing.weeklyDiscount)
        _monthly = State(initialValue: monthly ?? listing.monthlyDiscount)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient.qkPageWash.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text(loc.t("growth.discountsHint"))
                            .font(.subheadline)
                            .foregroundStyle(Color.qkMuted)
                            .fixedSize(horizontal: false, vertical: true)

                        LengthOfStayDiscountFields(weekly: $weekly, monthly: $monthly)
                            .onChange(of: weekly) { _, _ in saved = false }
                            .onChange(of: monthly) { _, _ in saved = false }

                        if let errorMessage {
                            Text(errorMessage)
                                .font(.footnote)
                                .foregroundStyle(Color.qkBurgundy)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        Button {
                            Task { await save() }
                        } label: {
                            QKPrimaryButtonLabel(
                                title: saved ? loc.t("growth.discountsSaved") : loc.t("growth.saveDiscounts"),
                                systemImage: isSaving ? nil : (saved ? "checkmark" : "tag.fill"),
                                isLoading: isSaving,
                                height: 50
                            )
                        }
                        .buttonStyle(QKPressStyle())
                        .disabled(isSaving)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                    .padding(.bottom, 28)
                }
            }
            .navigationTitle(loc.t("growth.lengthOfStayDiscounts"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(loc.t("common.done")) { dismiss() }
                        .tint(.qkBurgundy)
                }
            }
        }
        .tint(.qkBurgundy)
    }

    @MainActor
    private func save() async {
        errorMessage = nil
        isSaving = true
        defer { isSaving = false }
        do {
            let updated = try await BookingService.shared.setLengthOfStayDiscounts(
                listingID: listing.id,
                weekly: weekly,
                monthly: monthly
            )
            saved = true
            onSaved(updated)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Seasonal / variable pricing fields (shared)

/// Localized short month names ("Jan".."Dec" / "يناير".."ديسمبر"), indexed 0–11,
/// for the per-month seasonal-price list. Uses the device calendar's short month
/// symbols via the localization manager's resolved locale so it mirrors under RTL.
@MainActor
func qkShortMonthSymbols(_ loc: LocalizationManager) -> [String] {
    let f = DateFormatter()
    f.locale = Locale(identifier: loc.lang.localeIdentifier)
    let symbols = f.shortStandaloneMonthSymbols ?? f.shortMonthSymbols
    if let symbols, symbols.count == 12 { return symbols }
    return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
}

/// Localized short weekday names, indexed 0–6 to match Postgres' DOW (`0`=Sun …
/// `6`=Sat) — which is what `weekend_days` stores, so the pill index IS the day
/// number and no conversion sits between the label and what gets saved.
///
/// Taken from the localization manager's resolved locale rather than the device
/// calendar, so the pills read in the language the rest of the screen is in and
/// mirror correctly under RTL.
@MainActor
func qkShortWeekdaySymbols(_ loc: LocalizationManager) -> [String] {
    let f = DateFormatter()
    f.locale = Locale(identifier: loc.lang.localeIdentifier)
    // `shortStandalone…` and not `veryShort…`: single letters collide badly in
    // English (T/T, S/S) and the pills are the only thing naming the day.
    let symbols = f.shortStandaloneWeekdaySymbols ?? f.shortWeekdaySymbols
    // Foundation indexes these Sunday-first too, so the array needs no rotation.
    if let symbols, symbols.count == 7 { return symbols }
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
}

/// The host-facing seasonal pricing inputs, shared by the Add-listing flow and
/// the seasonal-pricing editor sheet: a single weekend nightly-rate field plus a
/// compact 12-month list of optional nightly-rate fields. All amounts are EGP
/// whole numbers; an empty field clears that month/weekend (no override).
///
/// State is held by the parent as `weekend: String`, `weekendDays: Set<Int>` and
/// `months: [String:String]` (month "1".."12" → text), so the wizard, the edit
/// screen and the seasonal editor sheet all stay in sync.
struct SeasonalPricingFields: View {
    /// Weekend nightly-rate text. Empty = no weekend override.
    @Binding var weekend: String
    /// Which weekdays that rate is charged on (`0`=Sun … `6`=Sat). A `Set`
    /// because the pills toggle membership and order is decided on the way out
    /// by `WeekendSchedule.normalize`.
    @Binding var weekendDays: Set<Int>
    /// Per-month nightly-rate text, keyed by month "1".."12". A missing/empty
    /// entry means that month uses the base nightly price.
    @Binding var months: [String: String]

    @EnvironmentObject private var loc: LocalizationManager

    /// What the host has typed into the weekend field right now, judged by the
    /// same rule the API runs — see ListingPricingRules.
    private var weekendCheck: Result<Double?, ListingPricingRules.Problem> {
        ListingPricingRules.checkPrice(weekend)
    }

    /// The typed rate, or nil when the field is blank OR holds something that
    /// isn't a price. The day rule below asks only whether a rate EXISTS, and a
    /// `0` is answered separately (and louder) by `weekendProblem`.
    private var typedRate: Double? {
        if case .success(let rate) = weekendCheck { return rate }
        return nil
    }

    /// What is wrong with the weekend rate right now, or nil. A `0` used to be
    /// coerced to "no weekend rate" here and everywhere downstream, so the host
    /// saved a listing whose weekend pills were lit with nothing behind them.
    private var weekendProblem: ListingPricingRules.Problem? {
        if case .failure(let problem) = weekendCheck { return problem }
        return nil
    }

    /// The first month the host has to fix, or nil — marked on the month's own
    /// row rather than held back until Save, which is where twelve identical
    /// fields make an unnamed error useless.
    private var monthProblem: ListingPricingRules.MonthFailure? {
        ListingPricingRules.failingMonth(months)
    }

    /// What is wrong with the day set right now, or nil. Asked of the SAME rule
    /// the API runs, so the host is told here rather than by a 400 on save.
    private var dayProblem: WeekendSchedule.Problem? {
        if case .failure(let problem) = WeekendSchedule.resolve(price: typedRate, days: Array(weekendDays)) {
            return problem
        }
        return nil
    }

    /// One day short of the whole week — the point past which no further pill may
    /// be lit, since seven would leave the nightly price applying to no night.
    private var isFullWeek: Bool { weekendDays.count >= WeekendSchedule.daysInWeek - 1 }

    var body: some View {
        VStack(spacing: 12) {
            // Weekend rate
            priceField(
                title: loc.t("pricing.weekendPrice"),
                subtitle: loc.t("pricing.weekendHint"),
                text: Binding(
                    get: { weekend },
                    set: { weekend = Self.sanitize($0) }
                ),
                error: weekendProblem.map { loc.t($0.weekendKey) }
            )

            weekendDayPicker

            Divider()

            // Per-month rates — one compact row each.
            let symbols = qkShortMonthSymbols(loc)
            let badMonth = monthProblem
            ForEach(1...12, id: \.self) { month in
                let key = String(month)
                priceField(
                    title: symbols[month - 1],
                    subtitle: nil,
                    text: Binding(
                        get: { months[key] ?? "" },
                        set: { months[key] = Self.sanitize($0) }
                    ),
                    error: badMonth?.month == month
                        ? String(format: loc.t(badMonth!.problem.monthKey), symbols[month - 1])
                        : nil
                )
                if month < 12 { Divider() }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Color.qkCream)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    /// The day pills: which weekdays this listing treats as its weekend.
    ///
    /// A row rather than a menu because the whole point is to see the week at a
    /// glance and count the lit days — the two ways this can be wrong (all seven,
    /// or none under a rate) are both about how many are lit, and a picker that
    /// hides the rest of the week makes neither visible.
    @ViewBuilder
    private var weekendDayPicker: some View {
        let symbols = qkShortWeekdaySymbols(loc)
        VStack(alignment: .leading, spacing: 8) {
            Text(loc.t("pricing.weekendDays"))
                .font(.caption)
                .foregroundStyle(Color.qkMuted)
                .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 6) {
                ForEach(0..<WeekendSchedule.daysInWeek, id: \.self) { day in
                    let isOn = weekendDays.contains(day)
                    // The seventh pill is locked rather than hidden: a host has to
                    // be able to see that the whole week is not on offer, and why.
                    let isLocked = !isOn && isFullWeek
                    Button {
                        toggle(day)
                    } label: {
                        Text(symbols[day])
                            .font(.caption.weight(.semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                            .foregroundStyle(isOn ? Color.white : Color.qkInk)
                            .frame(maxWidth: .infinity)
                            .frame(height: 34)
                            .background(isOn ? Color.qkBurgundy : Color.qkSurface)
                            .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 9, style: .continuous)
                                    .stroke(isOn ? Color.clear : Color.qkInk.opacity(0.14), lineWidth: 1)
                            )
                            .opacity(isLocked ? 0.4 : 1)
                    }
                    .buttonStyle(.plain)
                    .disabled(isLocked)
                    .accessibilityLabel(symbols[day])
                    .accessibilityAddTraits(isOn ? [.isSelected, .isButton] : .isButton)
                }
            }

            if let dayProblem {
                Text(loc.t(dayProblem == .wholeWeek
                           ? "pricing.weekendDays.wholeWeek"
                           : "pricing.weekendDays.noDaysChosen"))
                    .font(.caption)
                    .foregroundStyle(Color.qkBurgundy)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else if isFullWeek {
                // Said before the host hits the wall, not after: the locked pills
                // are otherwise just unresponsive.
                Text(loc.t("pricing.weekendDays.wholeWeek"))
                    .font(.caption)
                    .foregroundStyle(Color.qkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.bottom, 2)
    }

    private func toggle(_ day: Int) {
        if weekendDays.contains(day) {
            weekendDays.remove(day)
        } else if !isFullWeek {
            weekendDays.insert(day)
        }
    }

    /// A single labeled "EGP [____] / night" numeric field row, with the reason
    /// it can't be saved underneath it when there is one.
    ///
    /// The message sits on the row rather than under the Save button because
    /// there are thirteen of these fields and "the rate must be more than zero"
    /// says nothing about which.
    @ViewBuilder
    private func priceField(title: String, subtitle: String?, text: Binding<String>, error: String?) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            priceRow(title: title, subtitle: subtitle, text: text, isInvalid: error != nil)
            if let error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(Color.qkBurgundy)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityLabel("\(title): \(error)")
            }
        }
    }

    /// The row itself: label on the left, "EGP [____]" on the right.
    private func priceRow(title: String, subtitle: String?, text: Binding<String>, isInvalid: Bool) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color.qkInk)
                if let subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                }
            }
            Spacer(minLength: 8)
            HStack(spacing: 6) {
                Text("EGP")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.qkMuted)
                TextField("0", text: text)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .font(.body.weight(.semibold).monospacedDigit())
                    .foregroundStyle(Color.qkInk)
                    .frame(width: 76)
            }
            .padding(.horizontal, 10)
            .frame(height: 36)
            .background(Color.qkSurface)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(isInvalid ? Color.qkBurgundy : Color.clear, lineWidth: 1)
            )
        }
        .frame(minHeight: 48)
    }

    /// Keep only digits (EGP whole numbers), so the field can't carry a stray
    /// separator/decimal that the backend would reject.
    private static func sanitize(_ raw: String) -> String {
        String(raw.filter(\.isNumber).prefix(7))
    }
}

extension SeasonalPricingFields {
    /// The rate to SHOW for a weekend-rate text field — `nil` when it is blank
    /// or holds anything that isn't a price.
    ///
    /// Display only. This is the lenient reading, and it is exactly the reading
    /// that hid the bug: it answers `nil` to a `0`, which is indistinguishable
    /// from an empty field. Anything about to be SENT goes through
    /// `ListingPricingRules.checkPrice`, which tells the two apart.
    static func displayRate(_ text: String) -> Double? {
        if case .success(let rate) = ListingPricingRules.checkPrice(text) { return rate }
        return nil
    }

    /// The months to SHOW from a per-month text map, dropping blank and invalid
    /// entries. Display only, for the same reason as `displayRate` — the save
    /// paths use `ListingPricingRules.checkMonths`.
    static func displayMonths(_ months: [String: String]) -> [String: Double] {
        if case .success(let out) = ListingPricingRules.checkMonths(months) { return out }
        var out: [String: Double] = [:]
        for (key, text) in months {
            if case .success(let value) = ListingPricingRules.checkPrice(text), let value { out[key] = value }
        }
        return out
    }

    /// Seed the day pills from a listing's decoded `weekendDays`: the host's own
    /// set, or the default weekend when they never chose one — which is the set
    /// the server is already pricing that listing on.
    static func seedWeekendDays(from listing: Listing) -> Set<Int> {
        Set(WeekendSchedule.effective(listing.weekendDays))
    }

    /// Seed the per-month text map from a listing's decoded `monthlyPrices`
    /// (EGP doubles → whole-number strings), so the editor opens pre-filled.
    static func seedMonths(from prices: [String: Double]) -> [String: String] {
        var out: [String: String] = [:]
        for (key, value) in prices where value > 0 {
            out[key] = String(Int(value.rounded()))
        }
        return out
    }
}

// MARK: - Host seasonal pricing editor (sheet)

/// Host-facing editor for a single listing's seasonal/variable pricing, presented
/// as a sheet from `AvailabilityManagerView` (alongside the discount + policy
/// editors). Seeds with the listing's current weekend + per-month rates and
/// PATCHes `/api/local/listings/:id` via `BookingService.setSeasonalPricing`.
struct SeasonalPricingEditorView: View {
    let listing: Listing
    /// Called with the updated listing after a successful save, so the parent can
    /// refresh what it shows.
    var onSaved: (Listing) -> Void

    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.dismiss) private var dismiss

    @State private var weekend: String
    @State private var weekendDays: Set<Int>
    @State private var months: [String: String]
    @State private var isSaving = false
    @State private var saved = false
    @State private var errorMessage: String?

    /// Seeds the fields from explicit weekend/days/months values (so a parent that
    /// tracks edits locally can re-open at the latest values); falls back to the
    /// listing's own seasonal rates when omitted.
    init(
        listing: Listing,
        weekend: String? = nil,
        weekendDays: Set<Int>? = nil,
        months: [String: String]? = nil,
        onSaved: @escaping (Listing) -> Void
    ) {
        self.listing = listing
        self.onSaved = onSaved
        _weekend = State(initialValue: weekend ?? listing.weekendPrice.map { String(Int($0.rounded())) } ?? "")
        _weekendDays = State(initialValue: weekendDays ?? SeasonalPricingFields.seedWeekendDays(from: listing))
        _months = State(initialValue: months ?? SeasonalPricingFields.seedMonths(from: listing.monthlyPrices))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient.qkPageWash.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text(loc.t("pricing.seasonalHint"))
                            .font(.subheadline)
                            .foregroundStyle(Color.qkMuted)
                            .fixedSize(horizontal: false, vertical: true)

                        SeasonalPricingFields(weekend: $weekend, weekendDays: $weekendDays, months: $months)
                            .environmentObject(loc)
                            .onChange(of: weekend) { _, _ in saved = false }
                            .onChange(of: weekendDays) { _, _ in saved = false }
                            .onChange(of: months) { _, _ in saved = false }

                        if let errorMessage {
                            Text(errorMessage)
                                .font(.footnote)
                                .foregroundStyle(Color.qkBurgundy)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        Button {
                            Task { await save() }
                        } label: {
                            QKPrimaryButtonLabel(
                                title: saved ? loc.t("pricing.saved") : loc.t("pricing.save"),
                                systemImage: isSaving ? nil : (saved ? "checkmark" : "calendar.badge.clock"),
                                isLoading: isSaving,
                                height: 50
                            )
                        }
                        .buttonStyle(QKPressStyle())
                        .disabled(isSaving)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                    .padding(.bottom, 28)
                }
            }
            .navigationTitle(loc.t("pricing.seasonal"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(loc.t("common.done")) { dismiss() }
                        .tint(.qkBurgundy)
                }
            }
        }
        .tint(.qkBurgundy)
    }

    @MainActor
    private func save() async {
        errorMessage = nil
        isSaving = true
        defer { isSaving = false }
        // The (rate, days) pair, judged by the same rule the API runs — a save
        // that would come back 400 is refused here, where the pills are, instead
        // of as a server message under the button.
        // The rate itself first: a `0` is a typo, not "no weekend rate", and it
        // used to be coerced into the latter here and accepted by the API.
        guard case .success(let rate) = ListingPricingRules.checkPrice(weekend) else {
            if case .failure(let problem) = ListingPricingRules.checkPrice(weekend) {
                errorMessage = loc.t(problem.weekendKey)
            }
            return
        }
        // …and the months under it, named one at a time.
        let monthsChecked = ListingPricingRules.checkMonths(months)
        guard case .success(let monthlyPrices) = monthsChecked else {
            if case .failure(let failure) = monthsChecked {
                errorMessage = String(format: loc.t(failure.problem.monthKey),
                                      qkShortMonthSymbols(loc)[failure.month - 1])
            }
            return
        }
        let schedule = WeekendSchedule.resolve(price: rate, days: Array(weekendDays))
        guard case .success(let days) = schedule else {
            if case .failure(let problem) = schedule {
                errorMessage = loc.t(problem == .wholeWeek
                                     ? "pricing.weekendDays.wholeWeek"
                                     : "pricing.weekendDays.noDaysChosen")
            }
            return
        }
        do {
            let updated = try await BookingService.shared.setSeasonalPricing(
                listingID: listing.id,
                weekendPrice: rate,
                weekendDays: days ?? WeekendSchedule.defaultDays,
                monthlyPrices: monthlyPrices
            )
            saved = true
            onSaved(updated)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Listing price discount note

/// A small "Weekly −X% · Monthly −Y%" note shown near a listing's price on the
/// detail screen when the host offers any length-of-stay discount. Renders
/// nothing when both discounts are 0.
struct ListingDiscountNote: View {
    let weekly: Int
    let monthly: Int

    @EnvironmentObject private var loc: LocalizationManager

    private var parts: [String] {
        var out: [String] = []
        if weekly > 0 { out.append(String(format: loc.t("growth.weeklyShort"), "\(weekly)")) }
        if monthly > 0 { out.append(String(format: loc.t("growth.monthlyShort"), "\(monthly)")) }
        return out
    }

    var body: some View {
        if !parts.isEmpty {
            HStack(spacing: 6) {
                Image(systemName: "tag.fill")
                    .font(.system(size: 11, weight: .bold))
                Text(parts.joined(separator: " · "))
                    .font(.system(size: 12, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            .foregroundStyle(Color.qkSuccess)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color.qkSuccess.opacity(0.12))
            .clipShape(Capsule())
            .accessibilityLabel(parts.joined(separator: ", "))
        }
    }
}

// MARK: - Seasonal rates note (guest)

/// A small "Weekend & seasonal rates apply" note shown near the price on the
/// guest detail screen when the host has set a weekend / per-month rate. Cues
/// the guest that the nightly price varies by date (the exact total comes from
/// the quote breakdown below it).
struct SeasonalRatesNote: View {
    @EnvironmentObject private var loc: LocalizationManager

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "calendar.badge.clock")
                .font(.system(size: 11, weight: .bold))
            Text(loc.t("pricing.seasonalNote"))
                .font(.system(size: 12, weight: .semibold))
                .fixedSize(horizontal: false, vertical: true)
                .multilineTextAlignment(.leading)
        }
        .foregroundStyle(Color.qkBurgundy)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.qkBurgundy.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityLabel(loc.t("pricing.seasonalNote"))
    }
}
