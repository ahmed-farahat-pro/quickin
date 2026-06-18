import SwiftUI

// Section 9 — Money views (all MOCK data from the local-stack backend).
//
//   • HostEarningsView  — host earnings/payouts: total earned / paid out /
//     pending stat cards + a per-booking breakdown list.
//   • GuestReceiptsView — the guest's paid receipts, each itemized.
//   • CurrencyPickerView — switch the app-wide display currency.
//
// All amounts arrive from the backend in EGP and are converted for DISPLAY only
// via the injected `CurrencyManager`. Bilingual + RTL-safe via leading/trailing
// layout and DesignKit tokens.

// MARK: - Host earnings / payouts

/// Loads the signed-in host's earnings summary for `HostEarningsView`.
@MainActor
final class HostEarningsViewModel: ObservableObject {
    @Published var earnings: HostEarnings?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var hasLoaded = false

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            earnings = try await HostService.shared.fetchHostEarnings()
        } catch HostError.notSignedIn {
            errorMessage = L.t("money.signInHost")
        } catch let HostError.forbidden(message) {
            errorMessage = message
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
        hasLoaded = true
    }
}

/// Host earnings/payouts: three stat cards (total earned / paid out / pending)
/// plus a per-booking breakdown list (title, dates, net, paid-out/upcoming
/// badge). Reachable from the host dashboard. All prices respect the chosen
/// display currency.
struct HostEarningsView: View {
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var currency: CurrencyManager
    @StateObject private var viewModel = HostEarningsViewModel()

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()
            content
        }
        .navigationTitle(loc.t("money.earnings"))
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(Color.qkCream, for: .navigationBar)
        .tint(.qkBurgundy)
        .task { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && !viewModel.hasLoaded {
            ProgressView()
                .tint(.qkBurgundy)
                .foregroundStyle(Color.qkMuted)
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(Color.qkBurgundy)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    if let earnings = viewModel.earnings {
                        statCards(earnings)
                        breakdownSection(earnings)
                    } else if viewModel.errorMessage == nil {
                        HostEmptyHint(icon: "banknote", text: loc.t("money.noEarnings"))
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
            .refreshable { await viewModel.load() }
        }
    }

    /// The hero "total earned" card + a paid-out / pending split underneath.
    private func statCards(_ earnings: HostEarnings) -> some View {
        VStack(spacing: 12) {
            // Hero total earned (burgundy panel).
            VStack(alignment: .leading, spacing: 6) {
                QKEyebrow(text: loc.t("money.totalEarned"), color: Color.qkCream.opacity(0.85))
                Text(currency.format(earnings.totalEarned))
                    .font(.system(size: 34, weight: .heavy, design: .rounded))
                    .foregroundStyle(Color.qkCream)
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                Text(loc.t("money.bookingsCount")
                    .replacingOccurrences(of: "%@", with: "\(earnings.bookingsCount)"))
                    .font(.caption)
                    .foregroundStyle(Color.qkCream.opacity(0.82))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(18)
            .background(LinearGradient.qkBurgundyPanel)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .shadow(color: Color.qkBurgundy.opacity(0.26), radius: 14, x: 0, y: 10)

            // Paid out / pending split.
            HStack(spacing: 12) {
                MoneyStatTile(
                    icon: "checkmark.circle.fill",
                    label: loc.t("money.paidOut"),
                    value: currency.format(earnings.paidOut),
                    tint: .qkSuccess
                )
                MoneyStatTile(
                    icon: "hourglass",
                    label: loc.t("money.pending"),
                    value: currency.format(earnings.pending),
                    tint: .qkGoldDeep
                )
            }
        }
    }

    /// The "Payouts" per-booking breakdown list.
    @ViewBuilder
    private func breakdownSection(_ earnings: HostEarnings) -> some View {
        Text(loc.t("money.payouts"))
            .font(.system(.title3, design: .serif).weight(.semibold))
            .foregroundStyle(Color.qkInk)
            .padding(.top, 4)

        if earnings.recent.isEmpty {
            HostEmptyHint(icon: "tray", text: loc.t("money.noEarnings"))
        } else {
            VStack(spacing: 12) {
                ForEach(earnings.recent) { item in
                    EarningRow(item: item)
                }
            }
        }
    }
}

/// One stat tile (icon + label + value) in the paid-out / pending split. A white
/// card; the value carries the tile's tint.
private struct MoneyStatTile: View {
    let icon: String
    let label: String
    let value: String
    var tint: Color = .qkBurgundy

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(tint)
            Text(label)
                .font(.caption)
                .foregroundStyle(Color.qkMuted)
            Text(value)
                .font(.system(size: 19, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.qkInk)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .qkCard(cornerRadius: 18)
    }
}

/// One row in the host's per-booking earnings breakdown: title + dates on the
/// leading side, the net payout + a paid-out/upcoming badge trailing.
private struct EarningRow: View {
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var currency: CurrencyManager
    let item: HostEarningItem

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(item.title ?? loc.t("money.receipt"))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.qkInk)
                    .lineLimit(2)
                if !item.dateRangeText.isEmpty {
                    Text(item.dateRangeText)
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                }
                statusBadge
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 4) {
                Text(currency.format(item.net))
                    .font(.system(size: 16, weight: .heavy, design: .rounded))
                    .foregroundStyle(Color.qkBurgundy)
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                Text(loc.t("money.net"))
                    .font(.caption2)
                    .foregroundStyle(Color.qkMuted)
            }
        }
        .padding(16)
        .qkCard(cornerRadius: 18)
    }

    private var statusBadge: some View {
        let paidOut = item.isPaidOut
        let label = paidOut ? loc.t("money.statusPaidOut") : loc.t("money.statusUpcoming")
        let icon = paidOut ? "checkmark.seal.fill" : "clock.fill"
        let tint = paidOut ? Color.qkSuccess : Color.qkGoldDeep
        return HStack(spacing: 5) {
            Image(systemName: icon)
                .font(.system(size: 10, weight: .bold))
            Text(label)
                .font(.system(size: 11, weight: .bold))
        }
        .foregroundStyle(tint)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(tint.opacity(0.12))
        .clipShape(Capsule())
        .padding(.top, 2)
    }
}

// MARK: - Guest receipts

/// Loads the signed-in guest's paid receipts for `GuestReceiptsView`.
@MainActor
final class GuestReceiptsViewModel: ObservableObject {
    @Published var receipts: [GuestReceipt] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var hasLoaded = false

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            receipts = try await HostService.shared.fetchReceipts()
        } catch HostError.notSignedIn {
            errorMessage = L.t("money.signIn")
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
        hasLoaded = true
    }
}

/// The guest's paid receipts, each itemized (subtotal, service fee, method fee,
/// promo discount, total) with the reservation code + paid date. Reachable from
/// ProfileView. Prices respect the chosen display currency.
struct GuestReceiptsView: View {
    @EnvironmentObject private var loc: LocalizationManager
    @StateObject private var viewModel = GuestReceiptsViewModel()

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()
            content
        }
        .navigationTitle(loc.t("money.receipts"))
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(Color.qkCream, for: .navigationBar)
        .tint(.qkBurgundy)
        .task { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && !viewModel.hasLoaded {
            ProgressView()
                .tint(.qkBurgundy)
                .foregroundStyle(Color.qkMuted)
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(Color.qkBurgundy)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    if viewModel.receipts.isEmpty && viewModel.errorMessage == nil {
                        HostEmptyHint(icon: "doc.text", text: loc.t("money.noReceipts"))
                            .padding(.top, 4)
                    } else {
                        ForEach(viewModel.receipts) { receipt in
                            ReceiptCard(receipt: receipt)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
            .refreshable { await viewModel.load() }
        }
    }
}

/// One itemized receipt card: a header (title + reservation code + paid date),
/// then the line-item breakdown ending in a bold burgundy total. Amounts convert
/// to the chosen display currency.
private struct ReceiptCard: View {
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var currency: CurrencyManager
    let receipt: GuestReceipt

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Divider().padding(.vertical, 12)
            breakdown
        }
        .padding(16)
        .qkCard(cornerRadius: 18)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(receipt.title ?? loc.t("money.receipt"))
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Color.qkInk)
                .lineLimit(2)
            if !receipt.dateRangeText.isEmpty {
                Label(receipt.dateRangeText, systemImage: "calendar")
                    .labelStyle(.titleAndIcon)
                    .font(.caption)
                    .foregroundStyle(Color.qkMuted)
            }
            HStack(spacing: 10) {
                codeChip
                if !receipt.paidOnText.isEmpty {
                    Text(loc.t("money.paidOn")
                        .replacingOccurrences(of: "%@", with: receipt.paidOnText))
                        .font(.caption2)
                        .foregroundStyle(Color.qkMuted)
                }
            }
            .padding(.top, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var codeChip: some View {
        HStack(spacing: 5) {
            Image(systemName: "number")
                .font(.system(size: 10, weight: .bold))
            Text(receipt.codeText)
                .font(.system(size: 11, weight: .bold))
                .lineLimit(1)
        }
        .foregroundStyle(Color.qkBurgundy)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(Color.qkTan)
        .clipShape(Capsule())
    }

    /// The line items: subtotal, service fee, (method fee), (promo discount),
    /// divider, total. Method fee + promo lines appear only when non-zero.
    private var breakdown: some View {
        VStack(spacing: 0) {
            lineItem(
                label: subtotalLabel,
                value: currency.format(receipt.subtotal),
                valueColor: .qkInk
            )
            Divider()
            lineItem(
                label: loc.t("money.serviceFee"),
                value: currency.format(receipt.serviceFee),
                valueColor: .qkInk
            )
            if receipt.hasMethodFee {
                Divider()
                methodFeeLine
            }
            if receipt.hasPromo {
                Divider()
                promoLine
            }
            Divider()
            totalLine
        }
    }

    /// "Subtotal · 4 nights" when nights are known, else just "Subtotal".
    private var subtotalLabel: String {
        guard receipt.nights > 0 else { return loc.t("money.subtotal") }
        let nightsWord = loc.t(receipt.nights == 1 ? "common.night" : "common.nights")
        return "\(loc.t("money.subtotal")) · \(receipt.nights) \(nightsWord)"
    }

    /// Signed method surcharge/discount: card → burgundy "+…", bank → green "−…".
    private var methodFeeLine: some View {
        let isSurcharge = receipt.methodFee > 0
        let sign = isSurcharge ? "+" : "−"
        let valueColor = isSurcharge ? Color.qkBurgundy : Color.qkSuccess
        return lineItem(
            label: loc.t("money.methodFee"),
            value: "\(sign)\(currency.format(abs(receipt.methodFee)))",
            valueColor: valueColor
        )
    }

    /// The promo discount line (green "−…"), labelled with the applied code.
    private var promoLine: some View {
        let label: String
        if let code = receipt.promoCode?.trimmingCharacters(in: .whitespacesAndNewlines), !code.isEmpty {
            label = "\(loc.t("money.promoDiscount")) (\(code))"
        } else {
            label = loc.t("money.promoDiscount")
        }
        return lineItem(
            label: label,
            value: "−\(currency.format(receipt.promoDiscount))",
            valueColor: .qkSuccess
        )
    }

    private var totalLine: some View {
        HStack {
            Text(loc.t("money.total"))
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Color.qkInk)
            Spacer()
            Text(currency.format(receipt.total))
                .font(.system(size: 18, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.qkBurgundy)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
        }
        .padding(.vertical, 12)
    }

    private func lineItem(label: String, value: String, valueColor: Color) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(Color.qkMuted)
                .lineLimit(2)
            Spacer(minLength: 8)
            Text(value)
                .fontWeight(.semibold)
                .foregroundStyle(valueColor)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
        }
        .font(.subheadline)
        .padding(.vertical, 12)
    }
}

// MARK: - Currency picker

/// The app-wide display-currency switcher, presented from Profile. Lists every
/// `DisplayCurrency` with a sample converted price; tapping one switches the
/// whole app's displayed prices (conversion is display-only — bookings stay EGP).
struct CurrencyPickerView: View {
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var currency: CurrencyManager

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text(loc.t("money.currencyNote"))
                        .font(.footnote)
                        .foregroundStyle(Color.qkMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.bottom, 4)

                    ForEach(DisplayCurrency.allCases) { option in
                        currencyRow(option)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 32)
            }
        }
        .navigationTitle(loc.t("money.currency"))
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(Color.qkCream, for: .navigationBar)
        .tint(.qkBurgundy)
    }

    /// One selectable currency row: code + name on the leading side, a sample
    /// converted price + a check when selected, trailing.
    private func currencyRow(_ option: DisplayCurrency) -> some View {
        let isSelected = currency.currency == option
        return Button {
            withAnimation(QKAnim.swap) { currency.currency = option }
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(isSelected ? AnyShapeStyle(LinearGradient.qkBurgundyCTA)
                                         : AnyShapeStyle(Color.qkTan))
                        .frame(width: 40, height: 40)
                    Text(option.code)
                        .font(.system(size: 12, weight: .heavy))
                        .foregroundStyle(isSelected ? Color.qkCream : Color.qkBurgundy)
                        .minimumScaleFactor(0.7)
                        .lineLimit(1)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(option.displayName)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.qkInk)
                    // Sample: what 1,000 EGP looks like in this currency.
                    Text(sampleText(for: option))
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                }
                Spacer(minLength: 8)
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(Color.qkBurgundy)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
            .qkCard(cornerRadius: 18)
        }
        .buttonStyle(.qkTap)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    /// "≈ $20.30" sample for 1,000 EGP, using the row's own currency (not the
    /// active one) so each row previews itself.
    private func sampleText(for option: DisplayCurrency) -> String {
        let rate = currency.rates.rates[option.code] ?? 1
        let value = 1000.0 * rate
        let number = NSNumber(value: value)
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.locale = Locale(identifier: "en_US_POSIX")
        f.minimumFractionDigits = option.fractionDigits
        f.maximumFractionDigits = option.fractionDigits
        f.usesGroupingSeparator = true
        let formatted = f.string(from: number) ?? String(format: "%.\(option.fractionDigits)f", value)
        return "1,000 EGP ≈ \(option.symbol)\(formatted)"
    }
}
