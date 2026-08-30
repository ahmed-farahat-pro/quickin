import Foundation

/// Which bucket a host's reservation sits in, and which chips the filter row
/// offers.
///
/// The Swift twin of `host-booking-filter-core.ts` in the web repo, mirrored
/// again as `HostBookingFilter` on Android. Keeping one rule on all three sides
/// is the point: the bucket is not a column, it is a fold, and three hand-rolled
/// folds would give a host three different answers to "how many reservations are
/// waiting on payment".
///
/// WHY THIS IS NOT JUST `bookings.status`
/// --------------------------------------
/// `bookings.status` holds only five values (pending | confirmed | completed |
/// rejected | cancelled). Three of the buckets a host actually thinks in come
/// from other columns:
///
///   • "Awaiting payment"      — confirmed, but the money has not landed. That
///                               lives in `payment_status` against the latest
///                               `payment_proofs` row, which `PaymentFlowRules`
///                               already folds into a stage.
///   • "Refunded" and          — a cancellation carries `refund_percent` (0–100),
///     "Partially refunded"      written from the listing's cancellation policy
///                               at the moment the guest cancels.
///
/// So a bucket is a function of (status, payment stage, refund percent). This
/// type owns that fold and nothing else re-derives it.
///
/// Pure: no SwiftUI, no network, no localization. The chip labels live in an
/// extension over in `HostDashboardView.swift`, so this file stays loadable by
/// `Tests/run.sh` (which builds plain executables with no app frameworks).
enum HostBookingFilterRules {

    // MARK: - Buckets

    /// The bucket a reservation is shown under. A reservation is in exactly one,
    /// so the counts always sum to the total.
    enum Bucket: String, CaseIterable, Equatable {
        case pending
        case awaitingPayment
        case confirmed
        case rejected
        case cancelled
        case refunded
        case partiallyRefunded
    }

    /// The five values `bookings.status` is allowed to hold, mirrored from
    /// `BOOKING_STATUSES` in the backend's `admin.ts`.
    ///
    /// The column is plain text with NO check constraint, so this is advisory —
    /// `bucket(for:)` treats an unrecognised value as pending rather than
    /// dropping the row.
    static let bookingStatuses: Set<String> = [
        "pending", "confirmed", "completed", "rejected", "cancelled",
    ]

    /// What the fold reads off one reservation. Every field is optional because
    /// older responses omit some of them, and a missing field must never be
    /// mistaken for a decision.
    struct Snapshot {
        /// `bookings.status`.
        var status: String?
        /// The stage from `PaymentFlowRules.stage(for:)` — never re-derived here.
        /// `nil` when the caller has no payment columns to offer.
        var paymentStage: PaymentFlowRules.Stage?
        /// `bookings.refund_percent` (0–100); `nil` when never cancelled.
        var refundPercent: Int?
        /// Whether money ever reached us — from `PaymentFlowRules.everPaid`, never
        /// re-derived here and never guessed from `paymentStage`, which says
        /// `.notPayable` for everything cancelled and so cannot answer this.
        ///
        /// No default value, deliberately: it was added after a never-paid cancellation
        /// was found filing under "Refunded", and a default would have let a call site
        /// keep the bug by saying nothing.
        var wasPaid: Bool

        init(status: String?, paymentStage: PaymentFlowRules.Stage?, refundPercent: Int?, wasPaid: Bool) {
            self.status = status
            self.paymentStage = paymentStage
            self.refundPercent = refundPercent
            self.wasPaid = wasPaid
        }
    }

    /// Which bucket a reservation belongs in.
    ///
    /// Order matters, and it is the host's reading order rather than the
    /// database's:
    ///
    ///  1. Pending wins outright — a request waiting on the host is the one
    ///     thing they must act on, whatever its payment columns say. (A guest
    ///     can upload a transfer before the host has even replied.)
    ///  2. Rejected and cancelled are terminal, so they are read BEFORE payment:
    ///     a dead reservation must never surface under "Awaiting payment", which
    ///     is a to-do list of money still coming.
    ///  3. A cancellation splits three ways on the refund.
    ///  4. Everything still alive splits on the payment stage.
    ///
    /// `completed` folds into `.confirmed`. A completed stay is a confirmed one
    /// that has finished — it is reachable only from confirmed, the guest has
    /// paid, and finished stays were not asked for as a chip of their own. If a
    /// "Past" bucket is ever wanted, it splits off here and nowhere else.
    ///
    /// An unrecognised status reads as `.pending` rather than being dropped. The
    /// column has no check constraint and the failure modes are not symmetric: a
    /// row that matches no chip is a reservation the host never learns about,
    /// while one under Pending is merely a row they glance at and dismiss.
    static func bucket(for b: Snapshot) -> Bucket {
        let status = (b.status ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        if status == "rejected" { return .rejected }
        if status == "cancelled" || status == "canceled" {
            return cancelledBucket(refundPercent: b.refundPercent, wasPaid: b.wasPaid)
        }
        if status == "confirmed" || status == "completed" {
            return b.paymentStage == .paid ? .confirmed : .awaitingPayment
        }
        return .pending
    }

    /// How a cancellation splits between Cancelled / Refunded / Partially refunded.
    ///
    /// `refund_percent` is a PERCENT OF THE TOTAL, not a flag — 100 means the
    /// whole stay came back, 1–99 means the policy kept a slice, and 0 (the
    /// strict-policy or day-of-check-in case) means nothing came back at all.
    ///
    /// A `nil` percent is a cancellation from before the refund ladder shipped.
    /// It reads as plain "Cancelled", which is the honest answer — no refund was
    /// ever recorded. Percents outside 0–100 are clamped rather than trusted.
    private static func cancelledBucket(refundPercent: Int?, wasPaid: Bool) -> Bucket {
        // `wasPaid` is asked FIRST, and it is why this is not a one-line column read.
        // `refund_percent` is stamped from the listing's cancellation policy the moment
        // a guest cancels, whether or not a single pound was ever paid — so a pending,
        // never-paid booking cancelled a fortnight out carries 100. Splitting on the
        // column alone called that "Refunded": money back that was never money in.
        guard wasPaid else { return .cancelled }
        guard let raw = refundPercent else { return .cancelled }
        let pct = max(0, min(100, raw))
        if pct >= 100 { return .refunded }
        if pct > 0 { return .partiallyRefunded }
        return .cancelled
    }

    /// How many reservations sit behind each bucket. Every bucket gets an entry,
    /// zeros included, so a chip can never read a missing count.
    static func counts(_ buckets: [Bucket]) -> [Bucket: Int] {
        var out: [Bucket: Int] = [:]
        for bucket in Bucket.allCases { out[bucket] = 0 }
        for bucket in buckets { out[bucket, default: 0] += 1 }
        return out
    }
}

// MARK: - The chip row

/// The status filter above the host's reservations: All · Awaiting your reply ·
/// Awaiting payment · Confirmed · Declined · Cancelled · Refunded · Partially
/// refunded.
///
/// "Declined" (the host turned the request down) is its own chip rather than
/// being folded into "Cancelled". They are separate values in the database, a
/// host caused one and a guest the other, and the row badges have always shown
/// them apart — merging them would make both counts lie.
///
/// The `label` and `emptyMessage` properties live in `HostDashboardView.swift`,
/// where the localization table is available; this declaration stays pure so
/// `Tests/run.sh` can build it without the app.
enum HostBookingFilter: String, CaseIterable, Identifiable, Equatable {
    case all
    case pending
    case awaitingPayment
    case confirmed
    case rejected
    case cancelled
    case refunded
    case partiallyRefunded

    var id: String { rawValue }

    /// The bucket this chip selects, or `nil` for the "All" catch-all.
    var bucket: HostBookingFilterRules.Bucket? {
        switch self {
        case .all:               return nil
        case .pending:           return .pending
        case .awaitingPayment:   return .awaitingPayment
        case .confirmed:         return .confirmed
        case .rejected:          return .rejected
        case .cancelled:         return .cancelled
        case .refunded:          return .refunded
        case .partiallyRefunded: return .partiallyRefunded
        }
    }

    /// `true` when a reservation in `bucket` belongs under this chip.
    func matches(_ bucket: HostBookingFilterRules.Bucket) -> Bool {
        self == .all || self.bucket == bucket
    }
}
