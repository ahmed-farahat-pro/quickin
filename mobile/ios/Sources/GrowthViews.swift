import SwiftUI
import UIKit

// MARK: - Section 8 (Growth): length-of-stay discounts, promo codes, referrals
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
//   • `ReferralView` — the "Refer friends" surface (code + copy + stats + list).
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

/// The host-facing seasonal pricing inputs, shared by the Add-listing flow and
/// the seasonal-pricing editor sheet: a single weekend nightly-rate field plus a
/// compact 12-month list of optional nightly-rate fields. All amounts are EGP
/// whole numbers; an empty field clears that month/weekend (no override).
///
/// State is held by the parent as `weekend: String` and `months: [String:String]`
/// (month "1".."12" → text), so both the wizard and the editor stay in sync.
struct SeasonalPricingFields: View {
    /// Weekend (Fri + Sat) nightly-rate text. Empty = no weekend override.
    @Binding var weekend: String
    /// Per-month nightly-rate text, keyed by month "1".."12". A missing/empty
    /// entry means that month uses the base nightly price.
    @Binding var months: [String: String]

    @EnvironmentObject private var loc: LocalizationManager

    var body: some View {
        VStack(spacing: 12) {
            // Weekend rate
            priceField(
                title: loc.t("pricing.weekendPrice"),
                subtitle: loc.t("pricing.weekendHint"),
                text: Binding(
                    get: { weekend },
                    set: { weekend = Self.sanitize($0) }
                )
            )

            Divider()

            // Per-month rates — one compact row each.
            let symbols = qkShortMonthSymbols(loc)
            ForEach(1...12, id: \.self) { month in
                let key = String(month)
                priceField(
                    title: symbols[month - 1],
                    subtitle: nil,
                    text: Binding(
                        get: { months[key] ?? "" },
                        set: { months[key] = Self.sanitize($0) }
                    )
                )
                if month < 12 { Divider() }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Color.qkCream)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    /// A single labeled "EGP [____] / night" numeric field row.
    private func priceField(title: String, subtitle: String?, text: Binding<String>) -> some View {
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
    /// Parse a weekend-rate text field into an optional EGP `Double` (`nil` when
    /// blank or ≤0). Shared by the wizard + editor when building the request.
    static func parseWeekend(_ text: String) -> Double? {
        let value = Double(text.trimmingCharacters(in: .whitespaces)) ?? 0
        return value > 0 ? value : nil
    }

    /// Parse the per-month text map into `{ "1": 8500, … }`, dropping blank /
    /// non-positive entries. Shared by the wizard + editor when building the request.
    static func parseMonths(_ months: [String: String]) -> [String: Double] {
        var out: [String: Double] = [:]
        for (key, text) in months {
            let value = Double(text.trimmingCharacters(in: .whitespaces)) ?? 0
            if value > 0 { out[key] = value }
        }
        return out
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
    @State private var months: [String: String]
    @State private var isSaving = false
    @State private var saved = false
    @State private var errorMessage: String?

    /// Seeds the fields from explicit weekend/months values (so a parent that
    /// tracks edits locally can re-open at the latest values); falls back to the
    /// listing's own seasonal rates when omitted.
    init(listing: Listing, weekend: String? = nil, months: [String: String]? = nil, onSaved: @escaping (Listing) -> Void) {
        self.listing = listing
        self.onSaved = onSaved
        _weekend = State(initialValue: weekend ?? listing.weekendPrice.map { String(Int($0.rounded())) } ?? "")
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

                        SeasonalPricingFields(weekend: $weekend, months: $months)
                            .environmentObject(loc)
                            .onChange(of: weekend) { _, _ in saved = false }
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
        do {
            let updated = try await BookingService.shared.setSeasonalPricing(
                listingID: listing.id,
                weekendPrice: SeasonalPricingFields.parseWeekend(weekend),
                monthlyPrices: SeasonalPricingFields.parseMonths(months)
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

// MARK: - Referrals ("Refer friends")

/// The "Refer friends" surface, pushed from `ProfileView`. GETs
/// `/api/local/referrals`, then shows the user's referral code (with a
/// copy-to-clipboard button), the invite count, the total reward, and the list
/// of friends who joined.
struct ReferralView: View {
    @EnvironmentObject private var loc: LocalizationManager

    @State private var summary: ReferralSummary?
    @State private var isLoading = false
    @State private var hasLoaded = false
    @State private var errorMessage: String?
    @State private var didCopy = false

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()
            content
        }
        .navigationTitle(loc.t("referral.title"))
        .navigationBarTitleDisplayMode(.inline)
        .tint(.qkBurgundy)
        .task { await load() }
    }

    @ViewBuilder
    private var content: some View {
        if isLoading && summary == nil {
            ProgressView().tint(.qkBurgundy)
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    hero
                    if let summary {
                        codeCard(summary)
                        statsRow(summary)
                        invitedSection(summary)
                    } else if let errorMessage {
                        errorCard(errorMessage)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 32)
            }
            .refreshable { await reload() }
        }
    }

    // MARK: Pieces

    private var hero: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: "gift.fill")
                .font(.system(size: 30))
                .foregroundStyle(Color.qkBurgundy)
            Text(loc.t("referral.heroTitle"))
                .font(.system(.title3, design: .serif).weight(.semibold))
                .foregroundStyle(Color.qkInk)
            Text(loc.t("referral.heroBody"))
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The user's referral code with a copy-to-clipboard button.
    private func codeCard(_ summary: ReferralSummary) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(loc.t("referral.yourCode"))
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.qkMuted)
            HStack(spacing: 12) {
                Text(summary.code.isEmpty ? "—" : summary.code)
                    .font(.system(.title2, design: .monospaced).weight(.bold))
                    .foregroundStyle(Color.qkInk)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .textSelection(.enabled)
                Spacer(minLength: 8)
                Button {
                    copyCode(summary.code)
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: didCopy ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 13, weight: .semibold))
                        Text(loc.t(didCopy ? "referral.copied" : "referral.copy"))
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundStyle(Color.qkCream)
                    .padding(.horizontal, 14)
                    .frame(height: 40)
                    .background(LinearGradient.qkBurgundyCTA)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.qkTap)
                .disabled(summary.code.isEmpty)
                .accessibilityLabel(loc.t(didCopy ? "referral.copied" : "referral.copy"))
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .qkCard(cornerRadius: 20)
    }

    /// Two stat tiles: invited count + total reward earned.
    private func statsRow(_ summary: ReferralSummary) -> some View {
        HStack(spacing: 12) {
            statTile(
                icon: "person.2.fill",
                value: "\(summary.count)",
                label: loc.t("referral.invited")
            )
            statTile(
                icon: "banknote.fill",
                value: summary.rewardTotalText,
                label: loc.t("referral.reward")
            )
        }
    }

    private func statTile(icon: String, value: String, label: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.qkBurgundy)
            Text(value)
                .font(.system(size: 22, weight: .heavy))
                .foregroundStyle(Color.qkInk)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(.caption)
                .foregroundStyle(Color.qkMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .qkCard(cornerRadius: 18)
    }

    /// The list of friends who signed up via the code, or an empty hint.
    @ViewBuilder
    private func invitedSection(_ summary: ReferralSummary) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(loc.t("referral.friendsTitle"))
                .font(.system(.title3, design: .serif).weight(.semibold))
                .foregroundStyle(Color.qkInk)

            if summary.referred.isEmpty {
                HStack(spacing: 12) {
                    Image(systemName: "person.crop.circle.badge.plus")
                        .font(.title3)
                        .foregroundStyle(Color.qkBurgundy.opacity(0.6))
                    Text(loc.t("referral.empty"))
                        .font(.subheadline)
                        .foregroundStyle(Color.qkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .qkCard(cornerRadius: 18)
            } else {
                ForEach(summary.referred) { friend in
                    friendRow(friend)
                }
            }
        }
    }

    private func friendRow(_ friend: ReferredFriend) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "person.fill")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.qkBurgundy)
                .frame(width: 40, height: 40)
                .background(Color.qkTan)
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(friend.displayName)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.qkInk)
                if !friend.monthText.isEmpty {
                    Text(friend.monthText)
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                }
            }
            Spacer(minLength: 8)
            if friend.rewardAmount > 0 {
                Text("+\(friend.rewardText)")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.qkSuccess)
            }
        }
        .padding(12)
        .qkCard(cornerRadius: 18)
    }

    private func errorCard(_ message: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color.qkBurgundy)
            Text(message)
                .font(.footnote)
                .foregroundStyle(Color.qkMuted)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .qkCard(cornerRadius: 18)
    }

    // MARK: Actions

    private func copyCode(_ code: String) {
        guard !code.isEmpty else { return }
        UIPasteboard.general.string = code
        withAnimation(.easeInOut(duration: 0.2)) { didCopy = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
            withAnimation(.easeInOut(duration: 0.2)) { didCopy = false }
        }
    }

    @MainActor
    private func load() async {
        isLoading = true
        await fetch()
        isLoading = false
        hasLoaded = true
    }

    @MainActor
    private func reload() async {
        await fetch()
    }

    @MainActor
    private func fetch() async {
        do {
            summary = try await BookingService.shared.fetchReferrals()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
