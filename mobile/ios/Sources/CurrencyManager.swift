import Foundation
import Combine

/// App-wide multi-currency display controller.
///
/// All backend money is denominated in EGP. This manager converts an EGP amount
/// into the user's chosen display currency (EGP base + USD/EUR/GBP/SAR/AED) using
/// FX rates fetched once at launch from `GET /api/local/currencies` (falling back
/// to baked-in static rates if that call fails). Conversion is **display-only** —
/// bookings are always created and charged in EGP.
///
/// Injected at the app root via `.environmentObject`, mirroring how
/// `LocalizationManager` is provided, so views observe the same source and the
/// whole tree re-renders the instant the user switches currency or the rates
/// finish loading. The chosen currency persists in `UserDefaults` under
/// `qk_currency` (default "EGP").
@MainActor
final class CurrencyManager: ObservableObject {
    static let shared = CurrencyManager()

    /// `UserDefaults` key the chosen display currency persists under.
    static let storageKey = "qk_currency"

    /// The currency prices are displayed in. Persisted on every change.
    @Published var currency: DisplayCurrency {
        didSet {
            UserDefaults.standard.set(currency.rawValue, forKey: Self.storageKey)
        }
    }

    /// The active FX rates. Starts with the baked-in static table so prices
    /// convert correctly even before the network fetch resolves; replaced by the
    /// fetched rates on success.
    @Published private(set) var rates: CurrencyRates = .fallback

    init() {
        if let saved = UserDefaults.standard.string(forKey: Self.storageKey),
           let parsed = DisplayCurrency(rawValue: saved) {
            currency = parsed
        } else {
            currency = .egp
        }
    }

    /// Fetch the live FX rates from the backend, replacing the baked-in defaults
    /// on success. Fails silently — the static `CurrencyRates.fallback` stays in
    /// place so the switcher still works offline. Safe to call repeatedly (e.g.
    /// at app launch).
    func refreshRates() async {
        guard let fetched = try? await HostService.shared.fetchCurrencyRates() else { return }
        // Keep whatever we have if the payload somehow arrived empty.
        guard !fetched.rates.isEmpty else { return }
        rates = fetched
    }

    /// Convert an EGP amount into the chosen currency's value: `egp * rate`.
    /// Falls back to the base amount when the chosen currency has no rate.
    func convert(_ egp: Double) -> Double {
        let rate = rates.rates[currency.code] ?? (currency == .egp ? 1 : 1)
        return egp * rate
    }

    /// Convert + format an EGP amount in the chosen currency, e.g. "EGP 1,100",
    /// "$22.33", "€20.68". Used for the most visible prices across the app
    /// (listing card, listing detail, reserve/receipt totals).
    func format(_ egp: Double) -> String {
        let value = convert(egp)
        let number = NSNumber(value: value)
        let formatted = Self.numberFormatter(for: currency).string(from: number)
            ?? String(format: "%.\(currency.fractionDigits)f", value)
        return "\(currency.symbol)\(formatted)"
    }

    /// Grouped number formatter (thousands separators) for a currency's fraction
    /// digits. Cached per fraction-digit count so we don't rebuild it per row.
    private static func numberFormatter(for currency: DisplayCurrency) -> NumberFormatter {
        if let cached = formatterCache[currency.fractionDigits] { return cached }
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.locale = Locale(identifier: "en_US_POSIX")
        f.minimumFractionDigits = currency.fractionDigits
        f.maximumFractionDigits = currency.fractionDigits
        f.usesGroupingSeparator = true
        formatterCache[currency.fractionDigits] = f
        return f
    }

    private static var formatterCache: [Int: NumberFormatter] = [:]
}
