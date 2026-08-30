import Foundation

/// Which bucket a GUEST's reservation sits in, and which chips the Trips filter row
/// offers.
///
/// The Swift twin of `reservation-filter-core.ts` in the web repo and
/// `ReservationFilterRules` on Android — and the guest-side sibling of
/// `HostBookingFilterRules`, which does the same job for the host's inbox.
///
/// ## What the guest needs that the host does not
///
/// The two modules answer the same question for different readers, so they share their
/// fold everywhere they can and part in exactly two places:
///
///  * **Payment under review** is a chip here, folded into *Awaiting payment* there. To
///    a host those are one to-do ("no money yet"); to the GUEST they are opposites —
///    one means "send the transfer", the other means "we have it, sit tight". A guest
///    shown "Awaiting payment" for a screenshot they already uploaded pays twice.
///  * **Completed** is a chip here, folded into *Confirmed* there. A guest's finished
///    stays are their trip history, which people go looking for; a host's are old rows.
///
/// Everything else — the cancelled/refunded split, the clamping, the unknown-status
/// fallback — is the SAME rule as `HostBookingFilterRules`, on purpose. A host and a
/// guest looking at one reservation must never see it filed differently.
///
/// The payment stage is passed IN rather than derived here, exactly as in the host
/// module: `PaymentFlowRules` is already the single source of truth for that, and a
/// second opinion beside it is the defect that rule exists to prevent.
///
/// Pure Foundation, and no `L.t` anywhere in this file: the chip labels are resolved at
/// render time in ReservationsView.swift, because `Localization.swift` imports SwiftUI
/// and this file has to compile on its own for `Tests/run.sh` (the project has no
/// XCTest target — see the note at the top of `ListingPricingRules.swift`).
enum ReservationFilterRules {

    /// The bucket a reservation is shown under. A reservation is in exactly one, so the
    /// counts always sum to the total.
    enum Bucket: String, CaseIterable, Equatable {
        case pending
        case awaitingPayment
        case underReview
        case confirmed
        case completed
        case rejected
        case cancelled
        case refunded
        case partiallyRefunded
    }

    /// What the fold needs to know about one reservation. Every field is optional
    /// because older responses omit some of them, and a missing field must never be
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
        /// No default value, deliberately: a default would let a call site keep the
        /// bug by saying nothing. Same field, same reason, as the host module.
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
    /// Order matters, and it is the guest's reading order:
    ///
    ///  1. Rejected and cancelled are terminal, so they are read BEFORE payment — a
    ///     dead reservation must never surface under "Awaiting payment", which is a
    ///     list of money the guest still owes.
    ///  2. A cancellation splits three ways on the refund.
    ///  3. `completed` is read before the payment split: the stay happened, and what
    ///     its payment columns say now cannot change that.
    ///  4. Everything still alive splits on the payment stage — and unlike the host
    ///     module, `.underReview` keeps a bucket of its own.
    ///
    /// An unrecognised status reads as `.pending` rather than being dropped, matching
    /// the host module. The column has no check constraint and the failure modes are
    /// not symmetric: a row behind no chip is a reservation the guest never finds
    /// again, while one under Pending is merely a row they glance at.
    static func bucket(for b: Snapshot) -> Bucket {
        let status = (b.status ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        if status == "rejected" { return .rejected }
        if status == "cancelled" || status == "canceled" {
            return cancelledBucket(refundPercent: b.refundPercent, wasPaid: b.wasPaid)
        }
        // The stay happened. A completed booking is the guest's trip history whatever
        // the payment columns say now — historical rows must not lose it retroactively.
        if status == "completed" { return .completed }
        if status == "confirmed" {
            switch b.paymentStage {
            case .paid: return .confirmed
            // The guest has uploaded their transfer and is waiting on US. Calling this
            // "awaiting payment" is what makes people pay a second time.
            case .underReview: return .underReview
            // `.awaitingPayment`, `.rejected` (re-upload a clearer screenshot — still
            // payable, per `PaymentFlowRules.canPay`), the `.notPayable` a confirmed
            // booking should never reach, and a stage the caller could not supply.
            default: return .awaitingPayment
            }
        }
        // "pending", and anything the vocabulary does not cover.
        return .pending
    }

    /// How a cancellation splits between Cancelled / Refunded / Partially refunded.
    ///
    /// Character-for-character the rule in `HostBookingFilterRules`, and that is the
    /// point — a host and a guest looking at the same cancelled reservation must read
    /// the same word.
    ///
    /// `refund_percent` is a PERCENT OF THE TOTAL, not a flag — 100 means the whole
    /// stay came back, 1–99 means the policy kept a slice, and 0 (the strict-policy or
    /// day-of-check-in case) means nothing came back at all.
    ///
    /// A `nil` percent is a cancellation from before the refund ladder shipped. It
    /// reads as plain "Cancelled", the honest answer — no refund was ever recorded.
    /// Percents outside 0–100 are clamped rather than trusted.
    private static func cancelledBucket(refundPercent: Int?, wasPaid: Bool) -> Bucket {
        // `wasPaid` is asked FIRST, and it is why this is not a one-line column read.
        // `refund_percent` is stamped from the listing's cancellation policy the moment
        // a guest cancels, whether or not a single pound was ever paid — so a pending,
        // never-paid booking cancelled a fortnight out carries 100. Splitting on the
        // column alone told that guest their stay had been "Refunded".
        guard wasPaid else { return .cancelled }
        guard let raw = refundPercent else { return .cancelled }
        let pct = max(0, min(100, raw))
        if pct >= 100 { return .refunded }
        if pct > 0 { return .partiallyRefunded }
        return .cancelled
    }

    /// How many reservations sit behind each bucket. Every bucket gets an entry, zeros
    /// included, so a chip can never read a missing count.
    static func counts(_ buckets: [Bucket]) -> [Bucket: Int] {
        var counts: [Bucket: Int] = [:]
        for bucket in Bucket.allCases { counts[bucket] = 0 }
        for bucket in buckets { counts[bucket, default: 0] += 1 }
        return counts
    }
}

/// The chips over the guest's Trips list, in display order — the reservation lifecycle
/// left to right: waiting on the host, waiting on their own transfer, waiting on us,
/// live, done, then the ways it ends.
///
/// "Rejected" (the host declined) stays its own chip rather than folding into
/// "Cancelled", for the same reason it does on the host side: they are separate values
/// in the database, a host caused one and the guest the other, and `StatusBadge` has
/// always rendered them apart.
enum ReservationFilter: String, CaseIterable, Identifiable, Equatable {
    case all
    case pending
    case awaitingPayment
    case underReview
    case confirmed
    case completed
    case rejected
    case cancelled
    case refunded
    case partiallyRefunded

    var id: String { rawValue }

    /// The bucket this chip selects; `nil` for the catch-all, which selects every one.
    var bucket: ReservationFilterRules.Bucket? {
        switch self {
        case .all:               return nil
        case .pending:           return .pending
        case .awaitingPayment:   return .awaitingPayment
        case .underReview:       return .underReview
        case .confirmed:         return .confirmed
        case .completed:         return .completed
        case .rejected:          return .rejected
        case .cancelled:         return .cancelled
        case .refunded:          return .refunded
        case .partiallyRefunded: return .partiallyRefunded
        }
    }

    /// `true` when a reservation in `bucket` belongs behind this chip.
    func matches(_ bucket: ReservationFilterRules.Bucket) -> Bool {
        self == .all || self.bucket == bucket
    }
}
