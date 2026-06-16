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
        .task {
            if !hasLoaded { await load() }
        }
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
