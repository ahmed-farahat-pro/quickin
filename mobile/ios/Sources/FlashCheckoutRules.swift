import Foundation

/// What the payment sheet shows for a **Flash** checkout (the automatic card /
/// wallet method), and when it should keep asking the server about it.
///
/// Flash has no return URL: the guest pays on a hosted page in an in-app Safari
/// sheet and nothing calls the app back. So the sheet polls
/// `GET /api/local/bookings/:id/flash-checkout`, and this file decides what each
/// answer means and whether another poll is worth making.
///
/// `paid` is the server's verdict and always wins over `status` — a refunded or
/// odd-status row that the server still calls paid is paid.
///
/// Pure: no SwiftUI, no network. Tested by `Tests/FlashCheckoutRulesTests`.
enum FlashCheckoutRules {

    /// The `status` vocabulary the backend sends. Anything else reads as `none`.
    enum Status: String {
        case pending, processing, succeeded, failed, canceled, refunded, expired, none
    }

    static func normalizeStatus(_ raw: String?) -> Status {
        let v = (raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        // Flash's own spelling drifts between the two; the server normalizes to
        // "canceled", but an older row may still carry the British one.
        if v == "cancelled" { return .canceled }
        return Status(rawValue: v) ?? .none
    }

    /// The four states the sheet renders.
    enum Stage: Equatable {
        /// No checkout yet — show "Pay EGP X".
        case start
        /// A link is out and the guest may be paying — show the waiting card.
        case waiting
        /// Done. Show success and refresh the reservation.
        case paid
        /// The last attempt ended without money moving — show why, and "Pay" again
        /// (a fresh POST mints a new link).
        case retry
    }

    static func stage(status raw: String?, paid: Bool) -> Stage {
        if paid { return .paid }
        switch normalizeStatus(raw) {
        case .none: return .start
        // `succeeded` without `paid` is the server still settling it — keep waiting
        // rather than claim a payment the booking doesn't show yet.
        case .pending, .processing, .succeeded: return .waiting
        case .failed, .canceled, .expired, .refunded: return .retry
        }
    }

    /// Whether the guest may start (or restart) a checkout from this stage.
    static func canStartCheckout(_ stage: Stage) -> Bool {
        stage == .start || stage == .retry
    }

    /// Localization key explaining a `retry` stage, or `nil` when there is nothing
    /// to explain.
    static func messageKey(status raw: String?, paid: Bool) -> String? {
        guard !paid else { return nil }
        switch normalizeStatus(raw) {
        case .failed: return "flash.failed"
        case .canceled: return "flash.canceled"
        case .expired: return "flash.expired"
        case .refunded: return "flash.refunded"
        default: return nil
        }
    }

    // MARK: - Polling

    /// Seconds between status checks while a checkout is in play.
    static let pollInterval: TimeInterval = 3
    /// Give up polling after this long; the "Check payment status" button still works.
    static let pollTimeout: TimeInterval = 15 * 60

    /// Whether to make another status check.
    ///
    /// While the hosted page is still open the guest may be retrying a declined
    /// card on that same page, so a `failed` there is not final — keep polling
    /// until they close it. Once it is closed, only a checkout still in flight is
    /// worth asking about again.
    static func shouldKeepPolling(stage: Stage, elapsed: TimeInterval, checkoutOpen: Bool) -> Bool {
        if stage == .paid { return false }
        if elapsed >= pollTimeout { return false }
        if checkoutOpen { return true }
        return stage == .waiting
    }

    /// The payment link as a URL, https only — anything else is treated as no link,
    /// so the app never opens an arbitrary scheme handed back in a response.
    static func checkoutURL(_ raw: String?) -> URL? {
        let s = (raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard s.lowercased().hasPrefix("https://"), let url = URL(string: s), url.host != nil else {
            return nil
        }
        return url
    }
}
