import SwiftUI
import PhotosUI

/// Loads the host's reservation requests and listings for the host dashboard.
@MainActor
final class HostDashboardViewModel: ObservableObject {
    @Published var requests: [HostBooking] = []
    @Published var listings: [Listing] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var hasLoaded = false

    /// Ids currently being confirmed/rejected, to disable their buttons.
    @Published var updatingIDs: Set<String> = []

    func load() async {
        isLoading = true
        errorMessage = nil
        async let bookings = HostService.shared.fetchHostBookings()
        async let listings = HostService.shared.fetchHostListings()
        do {
            let (b, l) = try await (bookings, listings)
            requests = b
            self.listings = l
        } catch HostError.notSignedIn {
            errorMessage = "Sign in as a host to manage your place."
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
        hasLoaded = true
    }

    /// Pending requests first (newest-feeling), then the rest.
    var pendingRequests: [HostBooking] {
        requests.filter { $0.bookingStatus == .pending }
    }

    var pastRequests: [HostBooking] {
        requests.filter { $0.bookingStatus != .pending }
    }

    func update(_ booking: HostBooking, action: HostBookingAction) async {
        updatingIDs.insert(booking.id)
        defer { updatingIDs.remove(booking.id) }
        do {
            _ = try await HostService.shared.updateBooking(id: booking.id, action: action)
            // Re-fetch to reflect the authoritative new status.
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// The host area: "Add listing" entry, reservation requests with Confirm /
/// Reject, and the host's current listings. Reachable from Profile only when
/// the signed-in user's role == "host".
struct HostDashboardView: View {
    @StateObject private var viewModel = HostDashboardViewModel()
    @State private var showingAddListing = false

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()
            content
        }
        .navigationTitle("Host")
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(Color.qkCream, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showingAddListing = true
                } label: {
                    Image(systemName: "plus")
                }
                .tint(.qkBurgundy)
            }
        }
        .sheet(isPresented: $showingAddListing) {
            AddListingView(onCreated: {
                Task { await viewModel.load() }
            })
        }
        .task { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && !viewModel.hasLoaded {
            ProgressView("Loading your place…")
                .tint(.qkBurgundy)
                .foregroundStyle(Color.qkMuted)
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    statsPanel
                    addListingCard
                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(Color.qkBurgundy)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    requestsSection
                    reviewGuestsCard
                    listingsSection

                    Divider()
                        .padding(.vertical, 4)

                    HostServicesSection()
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
            .refreshable { await viewModel.load() }
        }
    }

    // MARK: - Stats panel

    /// Burgundy-gradient earnings panel with an eyebrow + three quick stats,
    /// mirroring the mockup's "This month" hero. Values are derived from what we
    /// already loaded (listing count + pending requests) so it reads as live.
    private var statsPanel: some View {
        VStack(alignment: .leading, spacing: 14) {
            QKEyebrow(text: L.t("host.stats.thisMonth"), color: Color.qkCream.opacity(0.7))
            Text("\(viewModel.listings.count)")
                .font(.system(.largeTitle, design: .serif).weight(.heavy))
                .foregroundStyle(Color.qkCream)
            HStack(spacing: 22) {
                stat(value: "\(viewModel.listings.count)", label: L.t("host.stats.listings"))
                stat(value: "\(viewModel.pendingRequests.count)", label: L.t("host.stats.pending"))
                stat(value: "\(viewModel.requests.count)", label: L.t("host.stats.requests"))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(LinearGradient.qkBurgundyPanel)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: Color.qkBurgundy.opacity(0.26), radius: 16, x: 0, y: 12)
    }

    private func stat(value: String, label: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value)
                .font(.system(size: 18, weight: .heavy))
                .foregroundStyle(Color.qkCream)
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(Color.qkCream.opacity(0.75))
        }
    }

    // MARK: - Add listing CTA

    /// Dashed-border white card (mockup style) prompting a new listing.
    private var addListingCard: some View {
        Button {
            showingAddListing = true
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "house.badge.plus")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(width: 44, height: 44)
                    .background(Color.qkTan)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Add a listing")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.qkInk)
                    Text("List a new place for guests to book.")
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.forward")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.qkBurgundy)
            }
            .padding(15)
            .background(Color.qkSurface)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .strokeBorder(Color.qkBurgundy.opacity(0.3), style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
            )
        }
        .buttonStyle(.qkTap)
    }

    // MARK: - Reservation requests

    private var requestsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Reservation requests")
                .font(.system(.title3, design: .serif).weight(.semibold))
                .foregroundStyle(Color.qkInk)

            if viewModel.requests.isEmpty {
                emptyHint(icon: "tray", text: "No requests yet. They'll appear here when a guest books one of your places.")
            } else {
                ForEach(viewModel.pendingRequests) { booking in
                    HostRequestCard(
                        booking: booking,
                        isUpdating: viewModel.updatingIDs.contains(booking.id),
                        onConfirm: { Task { await viewModel.update(booking, action: .confirm) } },
                        onReject: { Task { await viewModel.update(booking, action: .reject) } }
                    )
                }
                if !viewModel.pastRequests.isEmpty {
                    Text("Past")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.qkMuted)
                        .padding(.top, 4)
                    ForEach(viewModel.pastRequests) { booking in
                        HostRequestCard(booking: booking, isUpdating: false, onConfirm: nil, onReject: nil)
                    }
                }
            }
        }
    }

    // MARK: - Review your guests

    /// Entry into the "Review your guests" surface, where the host can leave a
    /// star rating + comment for past guests. Tan card matching `QKListRow` look.
    private var reviewGuestsCard: some View {
        NavigationLink {
            ReviewGuestsView()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "star.bubble.fill")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(width: 44, height: 44)
                    .background(Color.qkTan)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(L.t("reviews.reviewGuests"))
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.qkInk)
                    Text(L.t("reviews.reviewGuests.subtitle"))
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                        .lineLimit(2)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.forward")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.qkTan4)
            }
            .padding(15)
            .contentShape(Rectangle())
            .qkCard(cornerRadius: 18)
        }
        .buttonStyle(.qkTap)
    }

    // MARK: - Host listings

    private var listingsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Your listings")
                .font(.system(.title3, design: .serif).weight(.semibold))
                .foregroundStyle(Color.qkInk)

            if viewModel.listings.isEmpty {
                emptyHint(icon: "house", text: "You haven't published a listing yet. Tap “Add a listing” to get started.")
            } else {
                ForEach(viewModel.listings) { listing in
                    HostListingRow(listing: listing, onResubmitted: {
                        Task { await viewModel.load() }
                    })
                }
            }
        }
    }

    private func emptyHint(icon: String, text: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(Color.qkBurgundy.opacity(0.6))
            Text(text)
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .qkCard(cornerRadius: 18)
    }
}

/// A reservation request row. Pending rows show Confirm / Reject; resolved rows
/// show only their status badge (pass `nil` handlers).
struct HostRequestCard: View {
    let booking: HostBooking
    let isUpdating: Bool
    let onConfirm: (() -> Void)?
    let onReject: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(booking.title ?? "Reservation")
                    .font(.headline)
                    .foregroundStyle(Color.qkInk)
                    .lineLimit(1)
                Spacer()
                StatusBadge(status: booking.bookingStatus, onPhoto: false)
            }
            if let location = booking.location {
                Label(location, systemImage: "mappin.and.ellipse")
                    .font(.subheadline)
                    .foregroundStyle(Color.qkMuted)
                    .lineLimit(1)
            }
            Label(booking.dateRangeText, systemImage: "calendar")
                .font(.subheadline)
                .foregroundStyle(Color.qkInk)
            HStack {
                Label("\(booking.guests) guest\(booking.guests == 1 ? "" : "s")", systemImage: "person.2.fill")
                    .foregroundStyle(Color.qkMuted)
                Spacer()
                Text(booking.totalText)
                    .fontWeight(.bold)
                    .foregroundStyle(Color.qkInk)
            }
            .font(.subheadline)

            if let code = booking.reservationCode, !code.isEmpty {
                Text(code)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(Color.qkMuted)
            }

            if onConfirm != nil || onReject != nil {
                actionButtons
            }

            messageButton
        }
        .padding(16)
        .qkCard(cornerRadius: 20)
    }

    /// Opens the per-booking chat with the guest.
    private var messageButton: some View {
        NavigationLink {
            ChatView(bookingID: booking.id)
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "bubble.left.and.bubble.right.fill")
                Text(L.t("host.message"))
                    .fontWeight(.semibold)
            }
            .font(.subheadline)
            .frame(maxWidth: .infinity)
            .frame(height: 40)
            .background(Color.qkSurface)
            .foregroundStyle(Color.qkBurgundy)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color.qkInk.opacity(0.12), lineWidth: 1)
            )
        }
        .buttonStyle(.qkTap)
        .padding(.top, 2)
    }

    private var actionButtons: some View {
        HStack(spacing: 12) {
            Button {
                onReject?()
            } label: {
                Text(L.t("host.action.reject"))
                    .fontWeight(.bold)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .background(Color.qkTan)
                    .foregroundStyle(Color.qkBurgundy)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.qkTap)
            .disabled(isUpdating)

            Button {
                onConfirm?()
            } label: {
                QKPrimaryButtonLabel(
                    title: L.t("host.action.confirm"),
                    isLoading: isUpdating,
                    cornerRadius: 12,
                    height: 44
                )
                .opacity(isUpdating ? 0.85 : 1)
            }
            .buttonStyle(QKPressStyle(shadowRadius: 8))
            .disabled(isUpdating)
        }
        .padding(.top, 4)
    }
}

/// A compact row for one of the host's own listings — thumbnail, an approval
/// status badge (Pending review / Approved / Rejected), title, location, gold ★
/// and burgundy price. When the listing is pending or rejected, a
/// "Re-upload ownership document" `PhotosPicker` lets the host (re)submit the
/// proof doc, which PATCHes the listing and re-queues it to pending.
/// RTL-safe; DesignKit tokens throughout.
struct HostListingRow: View {
    @EnvironmentObject private var loc: LocalizationManager
    let listing: Listing
    /// Called after a successful re-submit so the parent can re-fetch the
    /// authoritative status.
    var onResubmitted: () -> Void

    /// Locally-tracked status so the badge flips to "Pending review" the instant
    /// a re-submit succeeds, before the parent's refetch lands. Seeded from the
    /// listing's decoded `approval_status`.
    @State private var status: ApprovalStatus
    /// The doc selected in the re-upload `PhotosPicker`, processed on change.
    @State private var docItem: PhotosPickerItem?
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    init(listing: Listing, onResubmitted: @escaping () -> Void) {
        self.listing = listing
        self.onResubmitted = onResubmitted
        _status = State(initialValue: listing.approval)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 13) {
                ListingImageView(url: listing.sortedImageURLs.first, placeholderLabel: "", placeholderIconSize: 22)
                    .frame(width: 84, height: 84)
                    .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))

                VStack(alignment: .leading, spacing: 5) {
                    statusBadge

                    Text(listing.title)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.qkInk)
                        .lineLimit(1)
                    if let location = listing.location {
                        Text(location)
                            .font(.system(size: 12))
                            .foregroundStyle(Color.qkMuted)
                            .lineLimit(1)
                    }
                    HStack(spacing: 8) {
                        Text("\(listing.priceText) / \(loc.t("common.night"))")
                            .font(.system(size: 13, weight: .heavy))
                            .foregroundStyle(Color.qkBurgundy)
                        QKListingRating(listing: listing, size: 12)
                    }
                }
                Spacer(minLength: 0)
            }

            // Re-upload ownership doc when the listing is awaiting review or was
            // rejected. Approved listings need no action, so the row stays compact.
            if status.canResubmitDoc {
                reuploadButton

                if let errorMessage {
                    HStack(alignment: .top, spacing: 6) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(Color.qkBurgundy)
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(Color.qkInk)
                        Spacer(minLength: 0)
                    }
                }
            }
        }
        .padding(12)
        .qkCard(cornerRadius: 18)
        .onChange(of: docItem) { _, item in
            Task { await resubmit(item) }
        }
    }

    // MARK: - Pieces

    /// Coloured status capsule reflecting the listing's moderation state.
    private var statusBadge: some View {
        HStack(spacing: 5) {
            Image(systemName: statusIcon)
                .font(.system(size: 9, weight: .bold))
            Text(statusLabel)
                .font(.system(size: 10, weight: .bold))
        }
        .foregroundStyle(statusTint)
        .padding(.horizontal, 9).padding(.vertical, 3)
        .background(statusTint.opacity(0.12))
        .clipShape(Capsule())
    }

    private var reuploadButton: some View {
        PhotosPicker(
            selection: $docItem,
            matching: .images,
            photoLibrary: .shared()
        ) {
            HStack(spacing: 7) {
                if isSubmitting {
                    ProgressView().controlSize(.small).tint(.qkBurgundy)
                } else {
                    Image(systemName: "doc.badge.arrow.up")
                        .font(.system(size: 13, weight: .semibold))
                }
                Text(loc.t("approval.reupload"))
                    .font(.system(size: 13, weight: .bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            .foregroundStyle(Color.qkBurgundy)
            .frame(maxWidth: .infinity)
            .frame(height: 40)
            .background(Color.qkTan)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color.qkBurgundy.opacity(0.18), lineWidth: 1)
            )
            .opacity(isSubmitting ? 0.85 : 1)
        }
        .buttonStyle(.plain)
        .disabled(isSubmitting)
    }

    // MARK: - Re-submit

    /// Downscale + encode the picked document and PATCH it; on success flip the
    /// local badge to "Pending review" and ask the parent to refetch.
    private func resubmit(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        errorMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }
        guard
            let data = try? await item.loadTransferable(type: Data.self),
            let image = UIImage(data: data),
            let dataURL = QKAvatarImage.makeDataURL(from: image, maxDimension: 1200, quality: 0.8)
        else {
            errorMessage = loc.t("trust.uploadError")
            return
        }
        do {
            let updated = try await HostService.shared.resubmitOwnershipDoc(listingID: listing.id, doc: dataURL)
            status = updated.approval
            onResubmitted()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Derived values

    private var statusLabel: String {
        switch status {
        case .pending:  return loc.t("approval.pending")
        case .approved: return loc.t("approval.approved")
        case .rejected: return loc.t("approval.rejected")
        }
    }

    private var statusIcon: String {
        switch status {
        case .pending:  return "clock.fill"
        case .approved: return "checkmark.circle.fill"
        case .rejected: return "exclamationmark.triangle.fill"
        }
    }

    private var statusTint: Color {
        switch status {
        case .pending:  return .qkGoldDeep
        case .approved: return .qkSuccess
        case .rejected: return .qkBurgundy
        }
    }
}
