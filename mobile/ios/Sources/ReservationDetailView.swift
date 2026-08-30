import SwiftUI
import CoreImage
import CoreImage.CIFilterBuiltins
import PassKit
import PhotosUI
import UIKit

/// Generates a crisp QR `UIImage` from a string using CoreImage's
/// `CIQRCodeGenerator` (no third-party deps). Cached statically because the
/// filter + context are reusable.
enum QRCodeGenerator {
    private static let context = CIContext()
    private static let filter = CIFilter.qrCodeGenerator()

    /// A QR image encoding `string`, scaled up to ~`size` points and tinted
    /// burgundy on cream to match the theme. Returns `nil` if generation fails.
    static func image(from string: String, size: CGFloat = 240) -> UIImage? {
        let data = Data(string.utf8)
        filter.message = data
        filter.correctionLevel = "M"
        guard let output = filter.outputImage else { return nil }

        // Scale the tiny native output up to the requested point size.
        let scale = size / output.extent.width
        let scaled = output.transformed(by: CGAffineTransform(scaleX: scale, y: scale))

        // Recolor: dark modules → burgundy, background → cream.
        let colored = scaled.applyingFilter("CIFalseColor", parameters: [
            "inputColor0": CIColor(red: 0x5B / 255, green: 0x0F / 255, blue: 0x16 / 255),
            "inputColor1": CIColor(red: 0xF6 / 255, green: 0xF1 / 255, blue: 0xE6 / 255),
        ])

        guard let cg = context.createCGImage(colored, from: colored.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}

/// Loads a reservation's detail from `GET /api/local/bookings/:id`.
@MainActor
final class ReservationDetailViewModel: ObservableObject {
    @Published var detail: ReservationDetail?
    @Published var isLoading = false
    @Published var errorMessage: String?

    let bookingID: String

    init(bookingID: String) {
        self.bookingID = bookingID
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            detail = try await HostService.shared.fetchReservation(id: bookingID)
        } catch HostError.notSignedIn {
            errorMessage = "Sign in to view this reservation."
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

/// Reservation detail: stay summary, a QR code encoding the reservation code,
/// and an (intentionally disabled) "Add to Apple Wallet" button.
struct ReservationDetailView: View {
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.openURL) private var openURL
    @StateObject private var viewModel: ReservationDetailViewModel
    @State private var walletLoading = false
    @State private var walletError: String?
    /// Whether this reservation can be disputed, and the dispute if one exists —
    /// both resolved by the server in one call (see DisputeService.eligibility).
    @State private var disputeEligible = false
    @State private var existingDispute: Dispute?

    // Host notes editor (shown only to the listing's host). Seeded from the
    // loaded detail; `notesSaving`/`notesError`/`notesSaved` drive the Save button.
    @State private var hostNotesDraft = ""
    @State private var notesSaving = false
    @State private var notesError: String?
    @State private var notesSaved = false
    /// Locally-applied notes after a successful host save, so the read-only
    /// "From your host" card refreshes immediately without a full reload.
    @State private var savedHostNotes: String?

    // Reviews: whether this stay is eligible for a review, the sheet, and
    // whether the user just submitted one (so we can hide the entry + thank them).
    @State private var canReview = false
    @State private var didReview = false
    @State private var showingReviewSheet = false

    // Mock payment: shown for an unpaid booking ("Pay now"). The sheet flips the
    // booking to paid + confirmed; we then reload so the UI reflects it.
    @State private var showingPayment = false

    // Guest cancellation: shown for an upcoming (pending/confirmed) booking. The
    // sheet quotes the refund, then cancels; we reload so the UI reflects the
    // cancelled status + refunded amount.
    @State private var showingCancel = false

    // Stay guide: the host-authored info / photos / place QRs / files attached
    // to a confirmed booking. `guide` holds the items (guests read, the host
    // edits); `guideSheet` drives the add/edit form.
    @StateObject private var guide = StayGuideStore()
    @State private var guideSheet: StayGuideSheetTarget?
    /// A guide photo opened full-screen from the guest gallery.
    @State private var guidePhoto: StayGuidePhoto?

    /// Seeded with the list row's `Booking` so the screen renders instantly,
    /// then refined by the detail fetch.
    init(booking: Booking) {
        _viewModel = StateObject(wrappedValue: ReservationDetailViewModel(bookingID: booking.id))
    }

    /// Open straight from a reservation id — used by deep links
    /// (`/reservation/<id>`), where we only know the id. The screen fetches the
    /// full detail on appear.
    init(bookingID: String) {
        _viewModel = StateObject(wrappedValue: ReservationDetailViewModel(bookingID: bookingID))
    }

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()
            content
        }
        .navigationTitle("Reservation")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Color.qkCream, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                ShareLink(
                    item: AppLinks.reservation(viewModel.bookingID),
                    subject: Text(shareTitle),
                    message: Text(loc.t("share.reservation.message")),
                    preview: SharePreview(shareTitle)
                ) {
                    Image(systemName: "square.and.arrow.up")
                        .foregroundStyle(Color.qkBurgundy)
                }
                .accessibilityLabel(loc.t("share.label"))
            }
        }
        .task { await viewModel.load() }
        .task {
            // Ask the backend whether this stay is eligible for a review
            // (confirmed + past checkout + not yet reviewed).
            canReview = await ReviewService.shared.isReviewable(bookingID: viewModel.bookingID)
        }
        .task { await guide.load(bookingID: viewModel.bookingID) }
        .task {
            // Whether this stay can be disputed, and any dispute already on it.
            // One call for both, so the eligibility rule stays server-side.
            guard let state = try? await DisputeService.eligibility() else { return }
            disputeEligible = state.eligible.contains(viewModel.bookingID)
            if state.existing[viewModel.bookingID] != nil,
               let mine = try? await DisputeService.fetch().disputes {
                existingDispute = mine.first { $0.bookingID == viewModel.bookingID }
            }
        }
        .sheet(item: $guideSheet) { target in
            StayGuideItemSheet(
                bookingID: viewModel.bookingID,
                existing: target.item,
                nextOrder: guide.items.count
            ) {
                Task { await guide.load(bookingID: viewModel.bookingID) }
            }
            .environmentObject(loc)
        }
        .sheet(item: $guidePhoto) { photo in
            ReviewPhotoZoomSheet(urlString: photo.url)
                .environmentObject(loc)
        }
        .sheet(isPresented: $showingReviewSheet) {
            LeaveReviewSheet(
                bookingID: viewModel.bookingID,
                stayTitle: viewModel.detail?.title
            ) {
                // On success: hide the entry and remember we reviewed.
                didReview = true
                canReview = false
            }
        }
        .sheet(isPresented: $showingPayment) {
            PaymentSheet(
                bookingID: viewModel.bookingID,
                nights: paymentNights,
                total: paymentTotal
            ) {
                // Transfer screenshot submitted → reload so the status reflects
                // "under review" (and, once the host approves, "paid").
                Task { await viewModel.load() }
            }
            .environmentObject(loc)
        }
        .sheet(isPresented: $showingCancel) {
            CancelReservationSheet(
                bookingID: viewModel.bookingID,
                stayTitle: viewModel.detail?.title
            ) { _ in
                // Cancelled server-side → reload so the status badge + refund
                // card reflect the cancellation.
                Task { await viewModel.load() }
            }
            .environmentObject(loc)
        }
    }

    /// Whole nights in this stay, from the detail's check-in/check-out dates
    /// (minimum 1). Used to size the payment breakdown.
    private var paymentNights: Int {
        guard let detail = viewModel.detail else { return 1 }
        let iso = DateFormatter()
        iso.locale = Locale(identifier: "en_US_POSIX")
        iso.dateFormat = "yyyy-MM-dd"
        guard let ci = iso.date(from: detail.checkIn),
              let co = iso.date(from: detail.checkOut) else { return 1 }
        let days = Calendar.current.dateComponents([.day], from: ci, to: co).day ?? 0
        return max(days, 1)
    }

    /// The booking total in EGP the guest transfers via Instapay, from the stored
    /// `total_price`. Shown as the "amount to transfer" on the payment sheet; the
    /// host verifies the uploaded screenshot before confirming.
    private var paymentTotal: Int {
        Int((viewModel.detail?.totalPrice ?? 0).rounded())
    }

    /// "{stay} — QuickIn" for the share subject; falls back to a generic title
    /// before the detail loads.
    private var shareTitle: String {
        let stay = viewModel.detail?.title?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let stay, !stay.isEmpty {
            return String(format: loc.t("share.reservation.title"), stay)
        }
        return loc.t("share.reservation.titleFallback")
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.detail == nil {
            ProgressView("Loading reservation…")
                .tint(.qkBurgundy)
                .foregroundStyle(Color.qkMuted)
        } else if let detail = viewModel.detail {
            ScrollView {
                VStack(spacing: 20) {
                    statusHeader(detail)
                    payNowCard(detail)
                    passSection(detail)
                    fromYourHostCard(detail)
                    stayGuideCard(detail)
                    hostNotesEditor(detail)
                    stayGuideEditor(detail)
                    messagesButton
                    disputeButton(detail)
                    detailsCard(detail)
                    cancellationCard(detail)
                    reviewEntry
                    walletButton(detail)
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 32)
            }
            .refreshable { await viewModel.load() }
        } else {
            errorState
        }
    }

    // MARK: - Pieces

    /// Raise an issue about this stay, or follow one already raised.
    ///
    /// Only offered on a confirmed or completed reservation — the eligibility
    /// rule lives server-side (disputes-core), and `disputeEligible` is what it
    /// answered, not a second copy of the rule.
    @ViewBuilder
    private func disputeButton(_ detail: ReservationDetail) -> some View {
        Group { if disputeEligible {
            NavigationLink {
                DisputeView(bookingID: viewModel.bookingID, stayTitle: detail.title, existing: existingDispute)
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "exclamationmark.bubble.fill")
                        .foregroundStyle(Color.qkBurgundy)
                        .frame(width: 24)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(existingDispute == nil ? "Report an issue" : "Your reported issue")
                            .font(.headline)
                            .foregroundStyle(Color.qkInk)
                        Text(existingDispute.map { "Status: \($0.statusLabel)" }
                             ?? "Something wrong before, during or after your stay?")
                            .font(.caption)
                            .foregroundStyle(Color.qkMuted)
                    }
                    Spacer()
                    Image(systemName: "chevron.forward")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.qkTan4)
                }
                .padding(16)
                .qkCard()
            }
            .buttonStyle(.qkTap)
        } }
    }

    /// Opens the per-booking chat with the host.
    private var messagesButton: some View {
        NavigationLink {
            ChatView(bookingID: viewModel.bookingID)
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "bubble.left.and.bubble.right.fill")
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Messages")
                        .font(.headline)
                        .foregroundStyle(Color.qkInk)
                    Text("Chat with your host about this stay.")
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                }
                Spacer()
                Image(systemName: "chevron.forward")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.qkTan4)
            }
            .padding(16)
            .qkCard()
        }
        .buttonStyle(.qkTap)
    }

    /// "Leave a review" entry shown only for a reviewable stay; after the user
    /// submits, it flips to a gold "Thanks for your review" confirmation.
    @ViewBuilder
    private var reviewEntry: some View {
        if didReview {
            HStack(spacing: 12) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.title3)
                    .foregroundStyle(Color.qkGold)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 2) {
                    Text(loc.t("reviews.leave.thanks"))
                        .font(.headline)
                        .foregroundStyle(Color.qkInk)
                    Text(loc.t("reviews.leave.thanksSubtitle"))
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                }
                Spacer(minLength: 8)
            }
            .padding(16)
            .qkCard()
        } else if canReview {
            Button {
                showingReviewSheet = true
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "star.fill")
                        .font(.title3)
                        .foregroundStyle(Color.qkGold)
                        .frame(width: 24)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(loc.t("reviews.leave.title"))
                            .font(.headline)
                            .foregroundStyle(Color.qkInk)
                        Text(loc.t("reviews.leave.subtitle"))
                            .font(.caption)
                            .foregroundStyle(Color.qkMuted)
                    }
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.forward")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.qkTan4)
                }
                .padding(16)
                .qkCard()
            }
            .buttonStyle(.qkTap)
        }
    }

    /// Payment area. The flow pays *after* approval: the guest can only pay
    /// once the host has confirmed the booking (the backend rejects paying a
    /// pending booking). Which card shows is decided by `PaymentFlowRules` —
    /// the same rule the API and the website run — never by comparing
    /// `payment_status` here:
    ///   • `.awaitingPayment` → the "Pay now" card (opens `PaymentSheet`).
    ///   • `.rejected`        → why the last transfer was turned down, in the
    ///     reviewer's own words, above a "Try again" button.
    ///   • `.underReview`     → a "Payment under review" hint (the screenshot is
    ///     with us; this covers an escalated dispute too).
    ///   • `.notPayable` on a pending booking → "Awaiting host approval", no Pay.
    ///   • `.paid` / anything else → nothing.
    ///
    /// The rejected case is the one this branch exists for. It used to fall
    /// through to the plain "Pay now" card, so a guest whose transfer an admin
    /// had turned down saw the screen they saw before paying at all, with no
    /// hint that anything had happened or what to fix.
    @ViewBuilder
    private func payNowCard(_ detail: ReservationDetail) -> some View {
        switch detail.paymentStage {
        case .rejected:
            paymentRejectedCard(detail)
        case .awaitingPayment:
            payPromptCard(detail)
        case .underReview:
            underReviewCard
        case .notPayable where detail.bookingStatus == .pending:
            awaitingApprovalCard
        case .notPayable, .paid:
            EmptyView()
        }
    }

    /// "Pay now" — a confirmed booking with nothing submitted yet.
    private func payPromptCard(_ detail: ReservationDetail) -> some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                Image(systemName: "creditcard.fill")
                    .font(.title3)
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 2) {
                    Text(loc.t("pay.title"))
                        .font(.headline)
                        .foregroundStyle(Color.qkInk)
                    Text(loc.t("pay.subtitle"))
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                }
                Spacer(minLength: 8)
            }
            payButton(detail, title: loc.t("pay.payNow"))
        }
        .padding(16)
        .qkCard()
    }

    /// The rejection, in the reviewer's words, with the way forward under it.
    ///
    /// The reason is shown verbatim — it is free text an admin typed for this
    /// guest, and paraphrasing it would defeat the point. When they left one off
    /// (older rows, and dispute outcomes carry none) a generic line stands in,
    /// because "your transfer wasn't accepted" is still far more than the guest
    /// used to be told.
    private func paymentRejectedCard(_ detail: ReservationDetail) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.title3)
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 4) {
                    Text(loc.t("pay.rejected.title"))
                        .font(.headline)
                        .foregroundStyle(Color.qkInk)
                    Text(detail.paymentRejectReasonText ?? loc.t("pay.rejected.noReason"))
                        .font(.callout)
                        .foregroundStyle(Color.qkInk)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text(loc.t("pay.rejected.subtitle"))
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                Spacer(minLength: 0)
            }
            payButton(detail, title: loc.t("pay.tryAgain"))
        }
        .padding(16)
        .qkCard()
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(Color.qkBurgundy.opacity(0.35), lineWidth: 1)
        )
        // One announcement, so VoiceOver reads the reason with its heading
        // rather than stranding it as a loose paragraph.
        .accessibilityElement(children: .combine)
    }

    /// The CTA shared by the first attempt and the retry — same guard, same
    /// sheet, only the label differs.
    private func payButton(_ detail: ReservationDetail, title: String) -> some View {
        Button {
            // Defense in depth: even though these cards only render for a
            // payable booking, re-ask the rule before opening payment so the
            // pay sheet is unreachable for any other state.
            guard detail.canPay else { return }
            showingPayment = true
        } label: {
            QKPrimaryButtonLabel(
                title: title,
                systemImage: "lock.fill",
                height: 50
            )
        }
        .buttonStyle(QKPressStyle())
    }

    /// The guest has uploaded a transfer screenshot; awaiting the review.
    private var underReviewCard: some View {
        HStack(spacing: 12) {
            Image(systemName: "hourglass")
                .font(.title3)
                .foregroundStyle(Color.qkGoldDeep)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(loc.t("instapay.underReview.title"))
                    .font(.headline)
                    .foregroundStyle(Color.qkInk)
                Text(loc.t("instapay.underReview.subtitle"))
                    .font(.caption)
                    .foregroundStyle(Color.qkMuted)
            }
            Spacer(minLength: 8)
        }
        .padding(16)
        .qkCard()
    }

    /// Still pending — the host hasn't accepted the request, so there is
    /// nothing to pay yet.
    private var awaitingApprovalCard: some View {
        HStack(spacing: 12) {
            Image(systemName: "clock.badge.checkmark")
                .font(.title3)
                .foregroundStyle(Color.qkBurgundy)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(loc.t("pay.awaitingApproval.title"))
                    .font(.headline)
                    .foregroundStyle(Color.qkInk)
                Text(loc.t("pay.awaitingApproval.subtitle"))
                    .font(.caption)
                    .foregroundStyle(Color.qkMuted)
            }
            Spacer(minLength: 8)
        }
        .padding(16)
        .qkCard()
    }

    private func statusHeader(_ detail: ReservationDetail) -> some View {
        VStack(spacing: 8) {
            Text(detail.title ?? "Your stay")
                .font(.system(.title2, design: .serif).weight(.semibold))
                .foregroundStyle(Color.qkInk)
                .multilineTextAlignment(.center)
            if let location = detail.location {
                Label(location, systemImage: "mappin.and.ellipse")
                    .font(.subheadline)
                    .foregroundStyle(Color.qkMuted)
            }
            StatusBadge(status: detail.bookingStatus, onPhoto: false, paid: detail.isPaid)
                .padding(.top, 2)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 4)
    }

    /// The stay-pass area, gated on `ReservationDetail.hasStayPass` — i.e. the
    /// booking is confirmed **and paid** (or already completed) **and** the
    /// backend has issued a real `reservation_code`.
    ///
    /// This screen is shared by the guest and the listing's host, so the gate is
    /// deliberately one rule for both: the host tapping Approve used to reveal a
    /// working QR here immediately, before the guest had transferred anything.
    ///
    ///   • pass live    → the QR card (below).
    ///   • pending      → "your QR code will appear once your reservation is
    ///     confirmed".
    ///   • confirmed & unpaid → "…once your payment is confirmed". No QR, no
    ///     link, nothing tappable in either case.
    ///   • cancelled / rejected → nothing at all; that pass is never coming.
    @ViewBuilder
    private func passSection(_ detail: ReservationDetail) -> some View {
        if let url = detail.stayPassURL, let code = detail.qrPayload {
            qrCard(url: url, code: code)
        } else if detail.isAwaitingStayPass {
            awaitingPassCard(detail)
        }
    }

    /// Shown instead of the QR while the reservation is waiting for the host's
    /// approval, or for the guest's payment. Deliberately inert — there is no
    /// code to encode and no URL to open, so rendering one would point the guest
    /// at a dead `/stay/null` page.
    private func awaitingPassCard(_ detail: ReservationDetail) -> some View {
        // Which of the two holds it up decides the copy: an unpaid stay is
        // waiting on the guest and should say so, a pending one on the host.
        let waitingOnPayment = detail.isAwaitingPaymentForPass
        return VStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.qkTan)
                    .frame(width: 160, height: 160)
                Image(systemName: "qrcode")
                    .font(.system(size: 52))
                    .foregroundStyle(Color.qkTan4)
            }
            Text(loc.t(waitingOnPayment ? "pass.awaitingPayment.title" : "pass.awaiting.title"))
                .font(.headline)
                .foregroundStyle(Color.qkInk)
            Text(loc.t(waitingOnPayment ? "pass.awaitingPayment.body" : "pass.awaiting.body"))
                .font(.footnote)
                .foregroundStyle(Color.qkMuted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(20)
        .qkCard()
        .accessibilityElement(children: .combine)
    }

    /// The QR / stay pass. The QR encodes the **public pass URL**
    /// (`…/stay/<code>`), and the whole pass is tappable → opens that URL so the
    /// guest (or whoever scans it) lands on the deployed pass page. Only ever
    /// built from a real reservation code — see `passSection`.
    private func qrCard(url: URL, code: String) -> some View {
        Button {
            openURL(url)
        } label: {
            VStack(spacing: 14) {
                if let qr = QRCodeGenerator.image(from: url.absoluteString) {
                    Image(uiImage: qr)
                        .interpolation(.none)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 220, height: 220)
                        .padding(12)
                        .background(Color.qkCream)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .strokeBorder(Color.qkGold.opacity(0.4), lineWidth: 1.5)
                        )
                } else {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Color.qkTan)
                        .frame(width: 220, height: 220)
                        .overlay(Image(systemName: "qrcode").font(.system(size: 48)).foregroundStyle(Color.qkMuted))
                }
                VStack(spacing: 2) {
                    Text(loc.t("pass.reservationCode"))
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                    Text(code)
                        .font(.system(.headline, design: .monospaced))
                        .foregroundStyle(Color.qkInk)
                        .textSelection(.enabled)
                }
                Label(loc.t("pass.scanOrTap"), systemImage: "qrcode.viewfinder")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Color.qkBurgundy)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(20)
            .qkCard()
        }
        .buttonStyle(.qkTap)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(loc.t("pass.scanOrTap"))
        .accessibilityAddTraits(.isLink)
    }

    // MARK: - From your host (city + notes)

    /// `true` when the signed-in account is the host of this reservation's
    /// listing. Prefers an exact id match against the detail's `host_id`; when
    /// the backend omits it, falls back to the account's `host` role.
    private func isHost(_ detail: ReservationDetail) -> Bool {
        if let hostId = detail.hostId, !hostId.isEmpty {
            return hostId == auth.user?.id
        }
        return auth.user?.role?.lowercased() == "host"
    }

    /// The notes to display read-only: the locally-saved value (right after a
    /// host edit) wins over the freshly-fetched detail.
    private func displayedHostNotes(_ detail: ReservationDetail) -> String? {
        if let savedHostNotes {
            let trimmed = savedHostNotes.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : trimmed
        }
        return detail.hostNotesText
    }

    /// A tasteful "From your host" card showing the stay's city and, when the
    /// host has written any, their notes. Shown to **guests** (and to the host as
    /// a preview alongside the editor). Hidden when there's neither city nor note.
    @ViewBuilder
    private func fromYourHostCard(_ detail: ReservationDetail) -> some View {
        let city = detail.cityText
        let notes = displayedHostNotes(detail)
        if !city.isEmpty || notes != nil {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 10) {
                    Image(systemName: "house.fill")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.qkGold)
                        .frame(width: 24)
                    Text(loc.t("pass.fromHost"))
                        .font(.headline)
                        .foregroundStyle(Color.qkInk)
                    Spacer(minLength: 8)
                }
                if !city.isEmpty {
                    Label(city, systemImage: "mappin.and.ellipse")
                        .font(.subheadline)
                        .foregroundStyle(Color.qkMuted)
                }
                if let notes {
                    Text(notes)
                        .font(.subheadline)
                        .foregroundStyle(Color.qkInk)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .multilineTextAlignment(.leading)
                } else if !isHost(detail) {
                    Text(loc.t("pass.noHostNotes"))
                        .font(.footnote)
                        .foregroundStyle(Color.qkMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .qkCard()
        }
    }

    // MARK: - Host notes editor (host only)

    /// A multiline editor for the host to write/update the notes the guest sees.
    /// Rendered only when `isHost` is true; guests never see it. Saving calls
    /// `BookingService.setHostNotes` and refreshes the read-only card above.
    @ViewBuilder
    private func hostNotesEditor(_ detail: ReservationDetail) -> some View {
        if isHost(detail) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 10) {
                    Image(systemName: "square.and.pencil")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.qkBurgundy)
                        .frame(width: 24)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(loc.t("pass.hostNotes.title"))
                            .font(.headline)
                            .foregroundStyle(Color.qkInk)
                        Text(loc.t("pass.hostNotes.subtitle"))
                            .font(.caption)
                            .foregroundStyle(Color.qkMuted)
                    }
                    Spacer(minLength: 8)
                }

                ZStack(alignment: .topLeading) {
                    if hostNotesDraft.isEmpty {
                        Text(loc.t("pass.hostNotes.placeholder"))
                            .font(.subheadline)
                            .foregroundStyle(Color.qkMuted)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .allowsHitTesting(false)
                    }
                    TextField("", text: $hostNotesDraft, axis: .vertical)
                        .font(.subheadline)
                        .foregroundStyle(Color.qkInk)
                        .lineLimit(3...8)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .onChange(of: hostNotesDraft) { _, _ in notesSaved = false }
                }
                .background(Color.qkCream)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(Color.qkInk.opacity(0.08), lineWidth: 1)
                )

                if let notesError {
                    Text(notesError)
                        .font(.caption)
                        .foregroundStyle(Color.qkBurgundy)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                    Task { await saveHostNotes() }
                } label: {
                    QKPrimaryButtonLabel(
                        title: notesSaved ? loc.t("pass.hostNotes.saved") : loc.t("common.save"),
                        systemImage: notesSaving ? nil : (notesSaved ? "checkmark" : "tray.and.arrow.down.fill"),
                        isLoading: notesSaving,
                        height: 50
                    )
                }
                .buttonStyle(QKPressStyle())
                .disabled(notesSaving)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .qkCard()
            .onAppear { seedHostNotesDraft(detail) }
        }
    }

    /// Seed the editor with the current notes once, the first time it appears.
    private func seedHostNotesDraft(_ detail: ReservationDetail) {
        guard savedHostNotes == nil else { return }
        hostNotesDraft = detail.hostNotesText ?? ""
    }

    /// PATCH the host's notes, then update the local copy so both the editor and
    /// the read-only card reflect the change immediately.
    @MainActor
    private func saveHostNotes() async {
        notesError = nil
        notesSaving = true
        defer { notesSaving = false }
        let trimmed = hostNotesDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            let updated = try await BookingService.shared.setHostNotes(
                bookingId: viewModel.bookingID,
                notes: trimmed
            )
            savedHostNotes = updated.hostNotes ?? trimmed
            hostNotesDraft = (updated.hostNotes ?? trimmed)
            notesSaved = true
        } catch {
            notesError = error.localizedDescription
        }
    }

    // MARK: - Stay guide — guest view

    /// The host-authored stay guide as the **guest** sees it: info blocks, a
    /// photo gallery, scannable place QRs and file links, in that order. Hidden
    /// entirely when the host hasn't added anything (the host still gets the
    /// editor below).
    ///
    /// Gated on `hasStayPass`, the same rule as the QR — the guide IS what the
    /// pass leads to (gate codes, Wi-Fi, directions), so it must not open before
    /// the payment does. The backend enforces this too (`listStayGuide` returns
    /// an empty guide to a guest without a live pass); this is the local half so
    /// a stale in-memory list can't flash it either.
    @ViewBuilder
    private func stayGuideCard(_ detail: ReservationDetail) -> some View {
        if detail.hasStayPass, !guide.items.isEmpty {
            VStack(alignment: .leading, spacing: 18) {
                HStack(spacing: 10) {
                    Image(systemName: "book.closed.fill")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.qkGold)
                        .frame(width: 24)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(loc.t("guide.title"))
                            .font(.headline)
                            .foregroundStyle(Color.qkInk)
                        Text(loc.t("guide.subtitle"))
                            .font(.caption)
                            .foregroundStyle(Color.qkMuted)
                    }
                    Spacer(minLength: 8)
                }

                ForEach(StayGuideKind.allCases) { kind in
                    let group = guide.items.filter { $0.guideKind == kind }
                    if !group.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(kind.sectionTitle)
                                .font(.footnote.weight(.bold))
                                .foregroundStyle(Color.qkMuted)
                                .textCase(.uppercase)
                            guideSection(kind: kind, items: group)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .qkCard()
        }
    }

    /// One kind's worth of guide content, laid out the way that kind reads best.
    @ViewBuilder
    private func guideSection(kind: StayGuideKind, items: [StayGuideItem]) -> some View {
        switch kind {
        case .info:
            VStack(alignment: .leading, spacing: 14) {
                ForEach(items) { item in
                    VStack(alignment: .leading, spacing: 4) {
                        if let title = item.titleText {
                            Text(title)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Color.qkInk)
                        }
                        if let body = item.bodyText {
                            Text(body)
                                .font(.subheadline)
                                .foregroundStyle(Color.qkMuted)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }

        case .photo:
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 12) {
                    ForEach(items) { item in
                        if let source = item.imageSource {
                            Button {
                                guidePhoto = StayGuidePhoto(url: source)
                            } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    ReviewPhotoThumbnail(urlString: source, size: 132)
                                    if let caption = item.titleText ?? item.bodyText {
                                        Text(caption)
                                            .font(.caption)
                                            .foregroundStyle(Color.qkMuted)
                                            .lineLimit(2)
                                            .frame(width: 132, alignment: .leading)
                                    }
                                }
                            }
                            .buttonStyle(.qkTap)
                        }
                    }
                }
                .padding(.vertical, 2)
            }

        case .placeQR:
            VStack(spacing: 12) {
                ForEach(items) { item in
                    if let link = item.placeLink {
                        placeQRRow(item: item, link: link)
                    }
                }
            }

        case .attachment:
            VStack(spacing: 10) {
                ForEach(items) { item in
                    attachmentRow(item)
                }
            }
        }
    }

    /// A place the host wants the guest to find: a scannable QR of the link
    /// plus a tappable "Open" button. Only `http(s)` links reach here — see
    /// `StayGuideItem.placeLink`.
    private func placeQRRow(item: StayGuideItem, link: URL) -> some View {
        HStack(alignment: .top, spacing: 14) {
            if let qr = QRCodeGenerator.image(from: link.absoluteString, size: 180) {
                Image(uiImage: qr)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 92, height: 92)
                    .padding(6)
                    .background(Color.qkCream)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .strokeBorder(Color.qkGold.opacity(0.4), lineWidth: 1)
                    )
            }
            VStack(alignment: .leading, spacing: 6) {
                Text(item.titleText ?? link.host ?? loc.t("guide.kind.placeQR"))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.qkInk)
                if let body = item.bodyText {
                    Text(body)
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Button {
                    openURL(link)
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.up.forward.app.fill")
                            .font(.system(size: 13, weight: .semibold))
                        Text(loc.t("guide.open"))
                            .font(.footnote.weight(.semibold))
                    }
                    .foregroundStyle(Color.qkBurgundy)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.qkTan)
                    .clipShape(Capsule())
                }
                .buttonStyle(.qkTap)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// A file the host attached. A remote (`https`) file opens in the browser;
    /// an inline image opens full-screen in-app.
    @ViewBuilder
    private func attachmentRow(_ item: StayGuideItem) -> some View {
        let inlineImage = item.attachmentLink == nil ? item.imageSource : nil
        Button {
            if let link = item.attachmentLink {
                openURL(link)
            } else if let inlineImage {
                guidePhoto = StayGuidePhoto(url: inlineImage)
            }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "paperclip")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.titleText ?? loc.t("guide.kind.attachment"))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.qkInk)
                    if let body = item.bodyText {
                        Text(body)
                            .font(.caption)
                            .foregroundStyle(Color.qkMuted)
                            .lineLimit(2)
                    }
                }
                Spacer(minLength: 8)
                if item.attachmentLink != nil || inlineImage != nil {
                    Image(systemName: "chevron.forward")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.qkTan4)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 11)
            .frame(maxWidth: .infinity)
            .background(Color.qkTan.opacity(0.55))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.qkTap)
        .disabled(item.attachmentLink == nil && inlineImage == nil)
    }

    // MARK: - Stay guide — host editor

    /// The host's stay-guide editor. Rendered only for the listing's host, and
    /// unlocked once the booking is **confirmed** — deliberately looser than the
    /// pass gate, so the host can write their check-in notes while the guest
    /// pays. The guest still sees nothing until the pass goes live (see
    /// `stayGuideCard` and the backend's `listStayGuide`). A host looking at a
    /// still-pending request sees why it's locked instead.
    @ViewBuilder
    private func stayGuideEditor(_ detail: ReservationDetail) -> some View {
        if isHost(detail) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 10) {
                    Image(systemName: "book.closed.fill")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.qkBurgundy)
                        .frame(width: 24)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(loc.t("guide.editor.title"))
                            .font(.headline)
                            .foregroundStyle(Color.qkInk)
                        Text(loc.t("guide.editor.subtitle"))
                            .font(.caption)
                            .foregroundStyle(Color.qkMuted)
                    }
                    Spacer(minLength: 8)
                }

                if detail.bookingStatus == .confirmed {
                    if guide.items.isEmpty {
                        Text(loc.t("guide.editor.empty"))
                            .font(.footnote)
                            .foregroundStyle(Color.qkMuted)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        VStack(spacing: 8) {
                            ForEach(Array(guide.items.enumerated()), id: \.element.id) { index, item in
                                guideEditorRow(item, index: index, total: guide.items.count)
                            }
                        }
                    }

                    if let error = guide.errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(Color.qkBurgundy)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Button {
                        guideSheet = .new
                    } label: {
                        QKPrimaryButtonLabel(
                            title: loc.t("guide.editor.add"),
                            systemImage: guide.isBusy ? nil : "plus.circle.fill",
                            isLoading: guide.isBusy,
                            height: 50
                        )
                    }
                    .buttonStyle(QKPressStyle())
                    .disabled(guide.isBusy)
                } else {
                    Text(loc.t("guide.editor.locked"))
                        .font(.footnote)
                        .foregroundStyle(Color.qkMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .qkCard()
        }
    }

    /// One editable row: tap to edit, plus reorder + remove controls.
    private func guideEditorRow(_ item: StayGuideItem, index: Int, total: Int) -> some View {
        HStack(spacing: 10) {
            Button {
                guideSheet = .edit(item)
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: item.guideKind.systemImage)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.qkBurgundy)
                        .frame(width: 22)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.titleText ?? item.guideKind.label)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Color.qkInk)
                            .lineLimit(1)
                        if let subtitle = item.bodyText ?? item.urlText {
                            Text(subtitle)
                                .font(.caption)
                                .foregroundStyle(Color.qkMuted)
                                .lineLimit(1)
                        }
                    }
                    Spacer(minLength: 4)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            guideRowControl(systemImage: "chevron.up",
                            label: loc.t("guide.editor.moveUp"),
                            disabled: index == 0 || guide.isBusy) {
                Task { await guide.move(bookingID: viewModel.bookingID, from: index, to: index - 1) }
            }
            guideRowControl(systemImage: "chevron.down",
                            label: loc.t("guide.editor.moveDown"),
                            disabled: index >= total - 1 || guide.isBusy) {
                Task { await guide.move(bookingID: viewModel.bookingID, from: index, to: index + 1) }
            }
            guideRowControl(systemImage: "trash",
                            label: loc.t("guide.editor.delete"),
                            disabled: guide.isBusy) {
                Task { await guide.remove(bookingID: viewModel.bookingID, item: item) }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color.qkTan.opacity(0.55))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    /// A small square icon control used by the editor rows.
    private func guideRowControl(
        systemImage: String,
        label: String,
        disabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(disabled ? Color.qkTan4 : Color.qkBurgundy)
                .frame(width: 30, height: 30)
                .background(Color.qkCream)
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .accessibilityLabel(label)
    }

    private func detailsCard(_ detail: ReservationDetail) -> some View {
        VStack(spacing: 0) {
            detailRow(icon: "calendar", label: "Dates", value: detail.dateRangeText)
            Divider()
            detailRow(icon: "person.2.fill", label: "Guests", value: "\(detail.guests) guest\(detail.guests == 1 ? "" : "s")")
            Divider()
            detailRow(icon: "creditcard.fill", label: "Total", value: detail.totalText)
        }
        .padding(.vertical, 4)
        .padding(.horizontal, 16)
        .qkCard()
    }

    private func detailRow(icon: String, label: String, value: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(Color.qkBurgundy)
                .frame(width: 24)
            Text(label)
                .foregroundStyle(Color.qkMuted)
            Spacer()
            Text(value)
                .fontWeight(.semibold)
                .foregroundStyle(Color.qkInk)
        }
        .font(.subheadline)
        .padding(.vertical, 14)
    }

    // MARK: - Cancellation

    /// Cancellation card. For an upcoming (pending/confirmed) booking it shows
    /// the policy + a "Cancel reservation" button that opens the quote/confirm
    /// sheet. For an already-cancelled booking it shows the policy + the refunded
    /// amount instead. Hidden for completed / rejected bookings.
    @ViewBuilder
    private func cancellationCard(_ detail: ReservationDetail) -> some View {
        if detail.isCancelled {
            cancelledCard(detail)
        } else if detail.isCancellable {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 10) {
                    Image(systemName: detail.policy.systemImage)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.qkBurgundy)
                        .frame(width: 24)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(loc.t("cancel.policy"))
                            .font(.headline)
                            .foregroundStyle(Color.qkInk)
                        Text(detail.policy.name)
                            .font(.caption)
                            .foregroundStyle(Color.qkMuted)
                    }
                    Spacer(minLength: 8)
                }
                Text(detail.policy.explanation)
                    .font(.subheadline)
                    .foregroundStyle(Color.qkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Button {
                    showingCancel = true
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "xmark.circle")
                            .font(.system(size: 16, weight: .semibold))
                        Text(loc.t("cancel.cancelReservation"))
                            .fontWeight(.semibold)
                        Spacer()
                        Image(systemName: "chevron.forward")
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundStyle(Color.qkBurgundy)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 13)
                    .frame(maxWidth: .infinity)
                    .background(Color.qkTan)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.qkTap)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .qkCard()
        }
    }

    /// Read-only card for an already-cancelled booking: the policy + the refund
    /// percentage that was applied.
    private func cancelledCard(_ detail: ReservationDetail) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: "slash.circle.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color.qkBurgundyLight)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 2) {
                    Text(loc.t("cancel.cancelled"))
                        .font(.headline)
                        .foregroundStyle(Color.qkInk)
                    Text(loc.t("cancel.cancelledBody"))
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                }
                Spacer(minLength: 8)
            }

            VStack(spacing: 0) {
                detailRow(icon: detail.policy.systemImage,
                          label: loc.t("cancel.policyLabel"),
                          value: detail.policy.name)
                if let percent = detail.refundPercent {
                    Divider()
                    detailRow(icon: "arrow.uturn.backward.circle.fill",
                              label: loc.t("cancel.refunded"),
                              value: "\(percent)%")
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .qkCard()
    }

    /// Real "Add to Apple Wallet": downloads the signed .pkpass from the backend
    /// and presents the system add-pass sheet. Gated on `canAddToWallet` — the
    /// same rule the backend enforces (confirmed **and paid**, plus a real
    /// reservation code), so an unconfirmed or unpaid booking is never offered a
    /// pass it can't be given.
    @ViewBuilder
    private func walletButton(_ detail: ReservationDetail) -> some View {
        VStack(spacing: 6) {
            if detail.canAddToWallet {
                // Themed burgundy "Add to Apple Wallet" button with a clean
                // wallet glyph, replacing the stock PassKit badge.
                Button {
                    Task { await addToWallet() }
                } label: {
                    QKPrimaryButtonLabel(
                        title: loc.t("pass.wallet.add"),
                        systemImage: walletSymbol,
                        isLoading: walletLoading,
                        height: 50
                    )
                }
                .buttonStyle(QKPressStyle())
                .disabled(walletLoading)

                if let walletError {
                    Text(walletError)
                        .font(.caption)
                        .foregroundStyle(Color.qkBurgundy)
                        .multilineTextAlignment(.center)
                }
            } else if detail.isAwaitingStayPass {
                Text(loc.t(detail.isAwaitingPaymentForPass
                           ? "pass.wallet.lockedPayment"
                           : "pass.wallet.locked"))
                    .font(.caption)
                    .foregroundStyle(Color.qkMuted)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.top, 4)
    }

    /// Leading wallet glyph for the Add-to-Wallet button. Prefers the iOS 17+
    /// `wallet.bifold.fill`, falling back to `creditcard.fill` on older OSes.
    private var walletSymbol: String {
        if #available(iOS 17.0, *) {
            return "wallet.bifold.fill"
        }
        return "creditcard.fill"
    }

    /// Fetch the signed pass and present PKAddPassesViewController.
    @MainActor
    private func addToWallet() async {
        walletError = nil
        walletLoading = true
        defer { walletLoading = false }
        // Defense in depth: the button only renders for a booking that has a
        // pass, but never ask the backend to mint one for an unconfirmed or
        // unpaid stay — it answers 400 for both.
        guard viewModel.detail?.canAddToWallet == true else { return }
        guard PKPassLibrary.isPassLibraryAvailable() else {
            walletError = "Wallet isn't available on this device."
            return
        }
        guard let url = URL(string: "\(Config.apiBaseURL)/api/wallet/pass/\(viewModel.bookingID)") else { return }
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                walletError = "Couldn't create the pass. Please try again."
                return
            }
            let pass = try PKPass(data: data)
            guard let addVC = PKAddPassesViewController(pass: pass) else {
                walletError = "Couldn't open Wallet."
                return
            }
            Self.topViewController()?.present(addVC, animated: true)
        } catch {
            walletError = "Couldn't add to Wallet. Please try again."
        }
    }

    /// Topmost presented view controller from the active foreground scene.
    @MainActor
    private static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .first { $0.activationState == .foregroundActive } as? UIWindowScene
        var top = scene?.keyWindow?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }

    private var errorState: some View {
        VStack(spacing: 14) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 44))
                .foregroundStyle(Color.qkBurgundy.opacity(0.6))
            Text("Couldn't load reservation")
                .font(.headline)
                .foregroundStyle(Color.qkInk)
            if let error = viewModel.errorMessage {
                Text(error)
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Color.qkMuted)
                    .padding(.horizontal, 32)
            }
            Button {
                Task { await viewModel.load() }
            } label: {
                Text("Retry")
                    .fontWeight(.semibold)
                    .foregroundStyle(Color.qkCream)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 11)
                    .background(LinearGradient.qkBurgundyCTA)
                    .clipShape(Capsule())
            }
            .buttonStyle(QKPressStyle())
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Stay guide plumbing

/// A guide photo opened full-screen, wrapped so it can drive `.sheet(item:)`.
struct StayGuidePhoto: Identifiable {
    let url: String
    var id: String { url }
}

/// What the add/edit sheet is currently doing.
enum StayGuideSheetTarget: Identifiable {
    case new
    case edit(StayGuideItem)

    var id: String {
        switch self {
        case .new:            return "new"
        case let .edit(item): return item.id
        }
    }

    /// The item being edited, or `nil` when creating a new one.
    var item: StayGuideItem? {
        if case let .edit(item) = self { return item }
        return nil
    }
}

/// Loads and mutates one booking's host-authored stay guide.
///
/// Reads are best-effort: a guest whose host wrote nothing and a backend that
/// doesn't serve the guide yet both mean "no guide", so a failed load simply
/// leaves the list empty rather than putting an error in front of the guest.
/// Writes (host only) do surface their error inline.
@MainActor
final class StayGuideStore: ObservableObject {
    /// The guide in display order.
    @Published private(set) var items: [StayGuideItem] = []
    /// True while a create/update/delete/reorder is in flight.
    @Published private(set) var isBusy = false
    /// The last write error, shown under the host editor.
    @Published var errorMessage: String?

    func load(bookingID: String) async {
        do {
            items = try await HostService.shared.fetchStayGuide(bookingID: bookingID).sortedForDisplay
        } catch {
            items = []
        }
    }

    /// Remove an item, then refresh from the server.
    func remove(bookingID: String, item: StayGuideItem) async {
        await mutate(bookingID: bookingID) {
            try await HostService.shared.deleteStayGuideItem(bookingID: bookingID, itemID: item.id)
        }
    }

    /// Move the item at `from` to `to`, renumbering the whole guide so the order
    /// stays stable (older rows can all share `order = 0`). Only the rows whose
    /// position actually changed are PATCHed.
    func move(bookingID: String, from: Int, to: Int) async {
        guard items.indices.contains(from), items.indices.contains(to), from != to else { return }
        var reordered = items
        let moved = reordered.remove(at: from)
        reordered.insert(moved, at: to)

        // Optimistic: show the new order immediately, then persist.
        let previous = items
        items = reordered
        await mutate(bookingID: bookingID, onFailure: { self.items = previous }) {
            for (index, item) in reordered.enumerated() where item.order != index {
                try await HostService.shared.setStayGuideOrder(
                    bookingID: bookingID,
                    itemID: item.id,
                    order: index
                )
            }
        }
    }

    /// Run a write, then reload. Any error is surfaced to the host editor.
    private func mutate(
        bookingID: String,
        onFailure: (() -> Void)? = nil,
        _ work: () async throws -> Void
    ) async {
        errorMessage = nil
        isBusy = true
        defer { isBusy = false }
        do {
            try await work()
            await load(bookingID: bookingID)
        } catch {
            onFailure?()
            errorMessage = error.localizedDescription
        }
    }
}

/// Add / edit one stay-guide item. The type picker switches which field the
/// host fills in: free text for an info block, a picked photo for a photo or an
/// attached file, and an `https://` link for a place QR.
struct StayGuideItemSheet: View {
    /// The booking this item belongs to.
    let bookingID: String
    /// The item being edited, or `nil` when adding a new one.
    let existing: StayGuideItem?
    /// Position to file a newly-created item at (the end of the guide).
    let nextOrder: Int
    /// Called after a successful save so the caller can reload the guide.
    var onSaved: () -> Void

    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.dismiss) private var dismiss

    @State private var kind: StayGuideKind
    @State private var title = ""
    @State private var draftBody = ""
    @State private var link = ""
    /// The picked photo, kept as a `data:` URL ready to send.
    @State private var pickedDataURL = ""
    @State private var pickerItem: PhotosPickerItem?
    @State private var isEncoding = false
    @State private var isSaving = false
    @State private var errorMessage: String?
    /// Fields are seeded from `existing` exactly once, so a host who clears a
    /// field doesn't get it refilled when the view reappears.
    @State private var didSeed = false

    init(bookingID: String, existing: StayGuideItem?, nextOrder: Int, onSaved: @escaping () -> Void) {
        self.bookingID = bookingID
        self.existing = existing
        self.nextOrder = nextOrder
        self.onSaved = onSaved
        _kind = State(initialValue: existing?.guideKind ?? .info)
    }

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 20) {
                    header
                    kindPicker
                    fields
                    if let errorMessage {
                        errorLine(errorMessage)
                    }
                    saveButton
                }
                .padding(.horizontal, 20)
                .padding(.top, 22)
                .padding(.bottom, 32)
                .frame(maxWidth: .infinity)
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(isSaving)
        .onAppear(perform: seed)
        .onChange(of: pickerItem) { _, item in
            Task { await loadPicked(item) }
        }
    }

    // MARK: - Pieces

    private var header: some View {
        VStack(spacing: 6) {
            Text(loc.t(existing == nil ? "guide.form.newTitle" : "guide.form.editTitle"))
                .font(.system(.title2, design: .serif).weight(.bold))
                .foregroundStyle(Color.qkInk)
            Text(loc.t("guide.form.subtitle"))
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }

    private var kindPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(loc.t("guide.form.kind"))
                .font(.footnote.weight(.bold))
                .foregroundStyle(Color.qkMuted)
            Picker(loc.t("guide.form.kind"), selection: $kind) {
                ForEach(StayGuideKind.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.segmented)
            .disabled(isSaving)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var fields: some View {
        VStack(alignment: .leading, spacing: 16) {
            field(label: loc.t("guide.form.titleLabel"),
                  placeholder: loc.t("guide.form.titlePlaceholder"),
                  text: $title)

            field(label: loc.t("guide.form.bodyLabel"),
                  placeholder: loc.t("guide.form.bodyPlaceholder"),
                  text: $draftBody,
                  lines: 3...6)

            switch kind {
            case .info:
                EmptyView()
            case .placeQR:
                field(label: loc.t("guide.form.linkLabel"),
                      placeholder: loc.t("guide.form.linkPlaceholder"),
                      text: $link,
                      isURL: true)
                hint(loc.t("guide.form.linkHint"))
            case .photo:
                photoPicker
            case .attachment:
                photoPicker
                field(label: loc.t("guide.form.linkLabel"),
                      placeholder: loc.t("guide.form.linkPlaceholder"),
                      text: $link,
                      isURL: true)
                hint(loc.t("guide.form.fileHint"))
            }
        }
    }

    /// The picked photo (or the one already attached), as a tappable well.
    private var photoPicker: some View {
        // Resolved out here: `PhotosPicker`'s label closure isn't main-actor
        // isolated, so looking the string up inside it warns.
        let choosePhoto = loc.t("guide.form.photo")
        return VStack(alignment: .leading, spacing: 8) {
            PhotosPicker(selection: $pickerItem, matching: .images, photoLibrary: .shared()) {
                ZStack {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Color.qkSurface)
                        .frame(height: 168)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .strokeBorder(previewImage != nil ? Color.qkGoldDeep : Color.qkInk.opacity(0.12),
                                              lineWidth: 1)
                        )
                    if let previewImage {
                        Image(uiImage: previewImage)
                            .resizable()
                            .scaledToFill()
                            .frame(height: 168)
                            .frame(maxWidth: .infinity)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        if isEncoding {
                            ZStack {
                                Color.black.opacity(0.25)
                                ProgressView().tint(.white)
                            }
                            .frame(height: 168)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        }
                    } else {
                        VStack(spacing: 8) {
                            Image(systemName: "photo.badge.plus")
                                .font(.system(size: 26, weight: .light))
                                .foregroundStyle(Color.qkBurgundy)
                            Text(choosePhoto)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Color.qkInk)
                        }
                    }
                }
            }
            .buttonStyle(.plain)
            .disabled(isSaving)
            .accessibilityLabel(loc.t(previewImage == nil ? "guide.form.photo" : "guide.form.photoChange"))

            if previewImage != nil {
                Text(loc.t("guide.form.photoChange"))
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
        }
    }

    /// A labelled text field styled like the host-notes editor.
    private func field(
        label: String,
        placeholder: String,
        text: Binding<String>,
        lines: ClosedRange<Int> = 1...1,
        isURL: Bool = false
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.footnote.weight(.bold))
                .foregroundStyle(Color.qkMuted)
            ZStack(alignment: .topLeading) {
                if text.wrappedValue.isEmpty {
                    Text(placeholder)
                        .font(.subheadline)
                        .foregroundStyle(Color.qkMuted)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .allowsHitTesting(false)
                }
                TextField("", text: text, axis: .vertical)
                    .font(.subheadline)
                    .foregroundStyle(Color.qkInk)
                    .lineLimit(lines)
                    .textInputAutocapitalization(isURL ? .never : .sentences)
                    .autocorrectionDisabled(isURL)
                    .keyboardType(isURL ? .URL : .default)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
            }
            .background(Color.qkCream)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color.qkInk.opacity(0.08), lineWidth: 1)
            )
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func hint(_ text: String) -> some View {
        Text(text)
            .font(.caption)
            .foregroundStyle(Color.qkMuted)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func errorLine(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "exclamationmark.circle.fill")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.qkBurgundy)
            Text(text)
                .font(.footnote)
                .foregroundStyle(Color.qkInk)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var saveButton: some View {
        Button {
            Task { await save() }
        } label: {
            QKPrimaryButtonLabel(
                title: loc.t("common.save"),
                systemImage: isSaving ? nil : "tray.and.arrow.down.fill",
                isLoading: isSaving
            )
        }
        .buttonStyle(QKPressStyle())
        .disabled(isSaving || isEncoding)
        .opacity(isEncoding ? 0.6 : 1)
    }

    // MARK: - State

    /// The image shown in the picker well: the freshly-picked photo, else the
    /// one already attached to the item being edited.
    private var previewImage: UIImage? {
        if !pickedDataURL.isEmpty { return QKAvatarImage.decodeDataURL(pickedDataURL) }
        return QKAvatarImage.decodeDataURL(existing?.imageSource)
    }

    /// Seed the fields from the item being edited (once).
    private func seed() {
        guard !didSeed else { return }
        didSeed = true
        guard let existing else { return }
        title = existing.titleText ?? ""
        draftBody = existing.bodyText ?? ""
        // A `data:` photo lives in the picker well, not the link field.
        if let url = existing.urlText, StayGuideRules.isWebLink(url) {
            link = url
        } else if let url = existing.urlText {
            pickedDataURL = url
        }
    }

    /// Decode a picked photo into a `data:` URL, downscaled like the other
    /// uploads in the app.
    private func loadPicked(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        errorMessage = nil
        isEncoding = true
        defer { isEncoding = false }
        guard
            let data = try? await item.loadTransferable(type: Data.self),
            let image = UIImage(data: data),
            let dataURL = QKAvatarImage.makeDataURL(from: image, maxDimension: 1600, quality: 0.8)
        else {
            errorMessage = loc.t("guide.error.photo")
            return
        }
        pickedDataURL = dataURL
    }

    /// Build the draft and create/update it. `HostService` re-validates, so a
    /// bad item never leaves the device.
    @MainActor
    private func save() async {
        errorMessage = nil
        isSaving = true
        defer { isSaving = false }

        var draft = HostService.StayGuideDraft(kind: kind, order: existing?.order ?? nextOrder)
        draft.title = title
        draft.body = draftBody
        // Photos/files prefer the freshly-picked upload; a place QR is always
        // the typed link.
        switch kind {
        case .info:
            draft.url = ""
        case .placeQR:
            draft.url = link
        case .photo:
            draft.url = pickedDataURL
        case .attachment:
            draft.url = pickedDataURL.isEmpty ? link : pickedDataURL
        }

        do {
            if let existing {
                try await HostService.shared.updateStayGuideItem(
                    bookingID: bookingID,
                    itemID: existing.id,
                    draft: draft
                )
            } else {
                try await HostService.shared.createStayGuideItem(bookingID: bookingID, draft: draft)
            }
            onSaved()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// A reusable status pill used across reservation views. Shows a leading status
/// dot on a frosted, color-coded capsule: green (confirmed), gold (pending),
/// coral/burgundy (rejected/cancelled) — matching the redesign palette.
struct StatusBadge: View {
    let status: BookingStatus
    /// Set `true` when sitting over a photo so the pill stays legible (frosted).
    var onPhoto: Bool = true
    /// Whether the booking is paid. Pass this ONLY from the **guest** reservation
    /// views (list + detail) to surface the three guest-facing states:
    /// pending → "Waiting for approval", confirmed & unpaid → "Approved",
    /// confirmed & paid → "Paid". Leave `nil` everywhere else (host dashboard,
    /// service requests) so the badge keeps its plain `status.label` meaning.
    var paid: Bool? = nil
    /// The chip this reservation is filed under on the Trips list. Pass it from the
    /// guest reservation views so the badge and the filter chip above it always read
    /// the same words — a row badged "Cancelled" sitting under a chip that calls it
    /// "Refunded" is the filter contradicting the card. `nil` everywhere else (host
    /// dashboard, service requests), where there is no chip row to agree with.
    ///
    /// Takes precedence over `paid`, which can only describe three of the states.
    var bucket: ReservationFilterRules.Bucket? = nil

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(dot)
                .frame(width: 7, height: 7)
            Text(displayLabel)
                .font(.system(size: 11, weight: .bold))
        }
        .foregroundStyle(foreground)
        .padding(.horizontal, 11)
        .padding(.vertical, 6)
        .background {
            if onPhoto {
                Capsule().fill(.ultraThinMaterial)
                Capsule().fill(Color.qkInk.opacity(0.32))
            } else {
                Capsule().fill(tint.opacity(0.14))
            }
        }
        .clipShape(Capsule())
    }

    /// The text shown on the pill. A `bucket` wins when given (it can describe every
    /// state, including the two refunds and a payment under review). Failing that,
    /// `paid` maps pending/confirmed to the three guest-facing labels; failing that,
    /// the plain `status.label` (host dashboard, service requests).
    @MainActor
    private var displayLabel: String {
        if let bucket { return bucket.badgeLabel }
        guard let paid else { return status.label }
        switch status {
        case .pending:   return L.t("reservation.waitingApproval")
        case .confirmed: return paid ? L.t("reservation.paid") : L.t("reservation.approved")
        default:         return status.label
        }
    }

    private var dot: Color {
        // A payment waiting on us is gold like `pending` — both mean "nothing for you
        // to do yet", and colouring it green beside the paid stays would say the money
        // has cleared. The refunds keep the cancelled colouring: they ARE cancelled
        // bookings, and a colour of their own would read as a fourth kind of ending.
        if bucket == .underReview { return .qkGold }
        switch status {
        case .confirmed: return .qkSuccess
        case .pending: return .qkGold
        case .rejected, .cancelled: return .qkBurgundyLight
        default: return .qkMuted
        }
    }

    private var tint: Color { dot }

    private var foreground: Color {
        if onPhoto { return .white }
        if bucket == .underReview { return .qkGoldDeep }
        switch status {
        case .confirmed: return .qkSuccess
        case .pending: return .qkGoldDeep
        case .rejected, .cancelled: return .qkBurgundy
        default: return .qkMuted
        }
    }
}
