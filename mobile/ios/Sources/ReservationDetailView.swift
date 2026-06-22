import SwiftUI
import CoreImage
import CoreImage.CIFilterBuiltins
import PassKit
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
                nightly: paymentNightly,
                nights: paymentNights
            ) { _ in
                // Paid + confirmed server-side → reload to refresh status/QR.
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

    /// Per-night price derived from the stored total ÷ nights. The mock pay
    /// endpoint recomputes the authoritative receipt; this is only for the
    /// pre-payment preview.
    private var paymentNightly: Int {
        guard let total = viewModel.detail?.totalPrice else { return 0 }
        return Int((total / Double(paymentNights)).rounded())
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
                    qrCard(detail)
                    fromYourHostCard(detail)
                    hostNotesEditor(detail)
                    messagesButton
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

    /// Payment area. The new flow pays *after* approval: the guest can only pay
    /// once the host has confirmed the booking (the backend rejects paying a
    /// pending booking). So we branch on the status:
    ///   • `.confirmed` & unpaid → the "Pay now" card (opens `PaymentSheet`).
    ///   • `.pending`            → an "Awaiting host approval" hint, no Pay.
    ///   • anything else / paid  → nothing.
    @ViewBuilder
    private func payNowCard(_ detail: ReservationDetail) -> some View {
        if detail.bookingStatus == .confirmed && !detail.isPaid {
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
                Button {
                    // Defense in depth: even though this card only renders for a
                    // confirmed & unpaid booking, re-check before opening payment
                    // so the pay sheet is unreachable for any other state.
                    guard detail.bookingStatus == .confirmed && !detail.isPaid else { return }
                    showingPayment = true
                } label: {
                    QKPrimaryButtonLabel(
                        title: loc.t("pay.payNow"),
                        systemImage: "lock.fill",
                        height: 50
                    )
                }
                .buttonStyle(QKPressStyle())
            }
            .padding(16)
            .qkCard()
        } else if detail.bookingStatus == .pending {
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

    /// The QR / stay pass. The QR encodes the **public pass URL**
    /// (`…/stay/<code>`), and the whole pass is tappable → opens that URL so the
    /// guest (or whoever scans it) lands on the deployed pass page.
    private func qrCard(_ detail: ReservationDetail) -> some View {
        Button {
            openURL(detail.stayPassURL)
        } label: {
            VStack(spacing: 14) {
                if let qr = QRCodeGenerator.image(from: detail.stayPassURL.absoluteString) {
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
                    Text(detail.qrPayload)
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
    /// and presents the system add-pass sheet. Enabled only once confirmed.
    @ViewBuilder
    private func walletButton(_ detail: ReservationDetail) -> some View {
        VStack(spacing: 6) {
            if detail.bookingStatus == .confirmed {
                // Themed burgundy "Add to Apple Wallet" button with a clean
                // wallet glyph, replacing the stock PassKit badge.
                Button {
                    Task { await addToWallet() }
                } label: {
                    QKPrimaryButtonLabel(
                        title: "Add to Apple Wallet",
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
            } else {
                Text("Add to Apple Wallet becomes available once the host confirms your reservation.")
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

    /// The text shown on the pill. When `paid` is supplied (guest reservation
    /// views), pending/confirmed map to the three guest-facing labels; otherwise
    /// the plain `status.label` is used (host dashboard, service requests).
    @MainActor
    private var displayLabel: String {
        guard let paid else { return status.label }
        switch status {
        case .pending:   return L.t("reservation.waitingApproval")
        case .confirmed: return paid ? L.t("reservation.paid") : L.t("reservation.approved")
        default:         return status.label
        }
    }

    private var dot: Color {
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
        switch status {
        case .confirmed: return .qkSuccess
        case .pending: return .qkGoldDeep
        case .rejected, .cancelled: return .qkBurgundy
        default: return .qkMuted
        }
    }
}
