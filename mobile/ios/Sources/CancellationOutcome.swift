import Foundation

/// How a cancelled reservation actually ENDED — the thing "Cancelled" never said.
///
/// The Swift twin of `refundOutcomeFor` in the backend's `cancellation-core.ts`
/// (and of `CancellationOutcome.kt` on Android). All three must answer the same
/// word for the same booking, or a guest and their host read different endings
/// off the same row.
///
/// The reported defect: a guest who cancelled ten days out and got everything
/// back, one who cancelled two days out and got half, and one who cancelled on
/// the morning of check-in and got nothing all showed the same badge. The refund
/// is the whole substance of a cancellation, and it was the one thing the status
/// did not carry.
///
/// The ending is DERIVED, never a status of its own: `cancelled` stays the single
/// lifecycle value the API, the host inbox and every filter already speak. Only
/// the label splits.
///
/// Pure: no SwiftUI, no network, no formatting. It decides only which of four
/// endings a row is; the badge turns that into a localized word and a colour.
enum CancellationOutcome: String {
    /// Not cancelled at all — the caller shows the plain booking status.
    case open
    /// Cancelled with nothing coming back.
    case cancelled
    /// Cancelled, some of what the guest paid comes back.
    case partiallyRefunded
    /// Cancelled, all of it comes back.
    case refunded

    /// Whether this ending is about money at all — the two endings that replace
    /// the plain "Cancelled" badge.
    var isRefund: Bool { self == .refunded || self == .partiallyRefunded }

    /// The ending to label a reservation with.
    ///
    /// - Parameters:
    ///   - status: `bookings.status`.
    ///   - refundPercent: `refund_percent`, 0–100, stamped at cancel time. `nil`
    ///     on rows an admin cancelled by hand and on anything cancelled before
    ///     the column existed.
    ///   - paid: whether the guest's money ever reached the platform.
    ///
    /// Two things must be true before a refund word is used: the policy owed the
    /// guest something, **and** the guest had actually paid. The ladder quotes a
    /// percentage for every cancellation, paid or not — most cancellations are
    /// pending requests called off before any transfer, so it happily says "100%"
    /// of nothing. Calling that "Refunded" tells a guest money came back that was
    /// never taken, which is worse than saying too little.
    ///
    /// A missing `refundPercent` reads as no refund on purpose: it means nobody
    /// recorded one, and inventing a refund for a row with no evidence of one is
    /// the single mistake here with a cash cost.
    static func of(status: String?, refundPercent: Int?, paid: Bool) -> CancellationOutcome {
        let s = (status ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        // "canceled" too: the one-l spelling has reached this app from more than one
        // place, and a booking that is gone must not read as live because of it.
        guard s == "cancelled" || s == "canceled" else { return .open }
        guard let percent = refundPercent, percent > 0, paid else { return .cancelled }
        return percent >= 100 ? .refunded : .partiallyRefunded
    }

    /// The localization key for the status badge. `open` has none — the caller
    /// falls back to the plain status label.
    var labelKey: String? {
        switch self {
        case .open:              return nil
        case .cancelled:         return "status.cancelled"
        case .partiallyRefunded: return "status.partiallyRefunded"
        case .refunded:          return "status.refunded"
        }
    }
}
