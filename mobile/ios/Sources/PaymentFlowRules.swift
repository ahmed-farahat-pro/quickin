import Foundation

/// Where a booking sits in the manual-transfer payment flow.
///
/// The Swift twin of `paymentStageFor` / `canPay` in the backend's
/// `payment-flow-core.ts` — the same file the website's pay page and the API
/// both run. Keeping one rule on both sides is the point: the reported defect
/// was iOS deciding payment state by hand (`payment_status == "submitted"`) and
/// getting a THIRD answer that neither the server nor the web agreed with.
///
/// Two columns describe the same thing and can disagree, which is why this is a
/// rule and not a comparison:
///   • `bookings.payment_status` — the rollup written on every decision.
///   • the latest `payment_proofs.status` — the screenshot's own verdict.
/// A booking whose proof was rejected but whose rollup never landed (an older
/// row, a half-applied write) is still a rejection, and vice versa.
///
/// Pure: no SwiftUI, no network, no formatting. Screens turn a stage into copy;
/// this decides only which stage a reservation is at.
enum PaymentFlowRules {

    // MARK: - Vocabulary

    /// `bookings.payment_status`. Anything unrecognised — including the values
    /// only the retired Paymob path ever wrote — reads as `unpaid`, matching
    /// `normalizePaymentState` server-side.
    static let paymentStates: Set<String> = [
        "unpaid", "submitted", "paid", "rejected", "disputed",
        "pending", "failed", "refunded", "voided",
    ]

    /// `payment_proofs.status`. The column is plain text with no CHECK
    /// constraint, so this list is the only thing keeping the vocabulary honest.
    static let proofStatuses: Set<String> = ["submitted", "approved", "rejected", "disputed"]

    static func normalizePaymentState(_ raw: String?) -> String {
        let v = (raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return paymentStates.contains(v) ? v : "unpaid"
    }

    /// `nil` when there is no proof at all — which is NOT the same as a proof
    /// whose status we don't recognise, and not the same as a rejected one.
    static func normalizeProofStatus(_ raw: String?) -> String? {
        let v = (raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return proofStatuses.contains(v) ? v : nil
    }

    // MARK: - The stage

    /// The five states the guest-facing UI cares about.
    ///
    /// `rejected` is the one that was missing on iOS: a booking whose transfer
    /// an admin turned down looked identical to one that had never been paid,
    /// so the guest was shown a bare "Pay now" card and never told why their
    /// last screenshot failed.
    enum Stage: String {
        /// Not confirmed yet, or gone — there is nothing to pay.
        case notPayable
        /// Confirmed and waiting on the guest's transfer.
        case awaitingPayment
        /// A screenshot is with the reviewers (or escalated to a dispute).
        case underReview
        case paid
        /// A screenshot was turned down. Still payable — the guest re-uploads.
        case rejected
    }

    /// What the rule reads off a booking. Every field is optional because older
    /// responses omit some of them, and a missing field must never be mistaken
    /// for a decision.
    struct Snapshot {
        /// `bookings.status` — pending | confirmed | cancelled | rejected | completed.
        var status: String?
        /// The raw `bookings.payment_status`.
        var paymentState: String?
        /// The latest `payment_proofs.status`, `nil` when no proof exists.
        var proofStatus: String?
        /// Set once the payment is confirmed.
        var paidAt: String?

        init(status: String?, paymentState: String?, proofStatus: String?, paidAt: String?) {
            self.status = status
            self.paymentState = paymentState
            self.proofStatus = proofStatus
            self.paidAt = paidAt
        }
    }

    /// Which stage a booking is at. Order matters, and mirrors the server's:
    /// paid wins over everything, then an in-flight review, then a rejection the
    /// guest can fix, then payability.
    static func stage(for b: Snapshot) -> Stage {
        let state = normalizePaymentState(b.paymentState)
        let proof = normalizeProofStatus(b.proofStatus)
        let status = (b.status ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let paidAt = (b.paidAt ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

        if state == "paid" || proof == "approved" || (!paidAt.isEmpty && paidAt.lowercased() != "null") {
            return .paid
        }
        // A booking that is gone can't be paid, whatever its payment columns say.
        if status == "cancelled" || status == "rejected" { return .notPayable }
        // Submitted or escalated — the guest has done their part and is waiting on us.
        if state == "submitted" || state == "disputed" || proof == "submitted" || proof == "disputed" {
            return .underReview
        }
        if state == "rejected" || proof == "rejected" { return .rejected }
        // Payment only opens once the host has accepted the reservation.
        return status == "confirmed" ? .awaitingPayment : .notPayable
    }

    /// The single predicate the pay card, the Pay-now button and the upload API
    /// all share, so they cannot disagree about whether a booking is payable.
    ///
    /// A rejected screenshot IS payable — the guest re-uploads a better photo.
    /// Turning down a blurry transfer must not kill the reservation.
    static func canPay(_ b: Snapshot) -> Bool {
        let s = stage(for: b)
        return s == .awaitingPayment || s == .rejected
    }

    // MARK: - The stay pass

    /// THE rule for "this reservation's stay pass is live" — the QR, the Apple
    /// Wallet pass, the public `/stay/<code>` page and the host-authored guide
    /// behind it. The Swift twin of `isLiveStayPass` in the backend's
    /// `payment-flow-core.ts`, mirrored again as `Reservation.isLiveStayPass` on
    /// Android, so one reservation looks the same on every surface.
    ///
    /// The rule is `confirmed` **AND paid**, plus `completed` unconditionally:
    ///   • `confirmed` alone is NOT enough. It only means the host accepted the
    ///     request — the reservation code is minted right at that transition and
    ///     the guest pays *afterwards*. Gating on the status alone put a working
    ///     QR on the host's and the guest's screen the instant Approve was
    ///     tapped, for a stay nobody had paid for.
    ///   • Payment must be APPROVED, not merely submitted — which is why this
    ///     asks `stage(for:)` rather than comparing a column.
    ///   • `completed` keeps its pass whatever the payment columns say. The stay
    ///     already happened, so the pass is the guest's receipt of it, and rows
    ///     predating this rule must not lose it retroactively.
    ///   • `pending` never had a code; `cancelled`/`rejected` keep the code they
    ///     were issued but the pass is dead.
    ///
    /// Says nothing about `reservation_code`: that is the other half of the gate
    /// and the caller owns it (see `ReservationDetail.hasStayPass`).
    static func isLiveStayPass(_ b: Snapshot) -> Bool {
        let status = (b.status ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        // The stay happened — the pass is a receipt now, not an entitlement.
        if status == "completed" { return true }
        guard status == "confirmed" else { return false }
        return stage(for: b) == .paid
    }

    // MARK: - Did money ever arrive?

    /// Whether money ever reached us on this booking — which is NOT the question
    /// `stage(for:)` answers. That one asks "can this be paid now?", and the two part
    /// company on exactly the rows that matter: a cancelled booking is `.notPayable`
    /// whatever was paid for it, and a refunded one has had its paid marker wiped.
    ///
    /// ⚠️ THE `paid_at` TRAP (the same one `analytics-core.ts` warns about). A refund
    /// sets `paid_at = NULL`, so testing it answers "never paid" for exactly the
    /// bookings a refund question is about. The payment column is checked first, and
    /// `paid_at` only ever adds to the answer — it can never be what denies it.
    ///
    /// `refunded` and `voided` are terminal states from the retired Paymob path: money
    /// went out and came back, so it certainly arrived first.
    ///
    /// This exists because `bookings.refund_percent` is stamped from the listing's
    /// cancellation policy whenever a guest cancels, WITHOUT regard to whether anything
    /// was ever paid. So a never-paid booking cancelled a fortnight out carries
    /// `refund_percent = 100`, and any UI that splits a cancellation on that column
    /// alone will call it "Refunded" — money back that was never money in.
    ///
    /// The Swift twin of `everPaid` in `payment-flow-core.ts`.
    static func everPaid(_ b: Snapshot) -> Bool {
        let state = normalizePaymentState(b.paymentState)
        if state == "paid" || state == "refunded" || state == "voided" { return true }
        if normalizeProofStatus(b.proofStatus) == "approved" { return true }
        let paidAt = (b.paidAt ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return !paidAt.isEmpty && paidAt.lowercased() != "null"
    }

    /// The admin's note, trimmed, or `nil` when they left one off (the reason is
    /// required on a fresh rejection but older rows and dispute outcomes have
    /// none). Only ever meaningful at `.rejected` — the caller checks the stage,
    /// so a stale reason from an earlier round can't leak onto a paid booking.
    static func rejectReasonText(_ raw: String?) -> String? {
        let v = (raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if v.isEmpty || v.lowercased() == "null" { return nil }
        return v
    }
}
