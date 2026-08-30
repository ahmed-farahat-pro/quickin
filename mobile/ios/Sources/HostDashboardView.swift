import SwiftUI

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

    /// Which status the reservations list is narrowed to. Client-side over the
    /// already-loaded rows, so switching is instant — `/api/local/host/bookings`
    /// takes no query params and returns every reservation, the same way the
    /// listings filter works.
    @Published var bookingFilter: HostBookingFilter = .all

    /// The reservations the chip row currently selects.
    var filteredRequests: [HostBooking] {
        requests.filter { bookingFilter.matches($0.filterBucket) }
    }

    /// Pending requests first (newest-feeling), then the rest — within whatever
    /// the chip row has selected, so the Pending-first ordering survives
    /// filtering instead of fighting it.
    var pendingRequests: [HostBooking] {
        filteredRequests.filter { $0.bookingStatus == .pending }
    }

    var pastRequests: [HostBooking] {
        filteredRequests.filter { $0.bookingStatus != .pending }
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
    /// Which moderation state the "Your listings" section is narrowed to.
    /// Client-side over the already-loaded rows, so switching is instant.
    @State private var listingFilter: HostListingFilter = .all

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
                        .accessibilityLabel(L.t("host.addListing"))
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
                    analyticsCard
                    earningsCard
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
                    .accessibilityLabel(L.t("host.addListing"))
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
                // No reservations at all — a different thing from "nothing in
                // this status" below. It gets no chip row, because there is
                // nothing to filter and eight empty chips would only be noise.
                emptyHint(icon: "tray", text: "No requests yet. They'll appear here when a guest books one of your places.")
            } else {
                HostBookingFilterBar(selection: $viewModel.bookingFilter, bookings: viewModel.requests)

                if viewModel.filteredRequests.isEmpty {
                    emptyHint(icon: "line.3.horizontal.decrease.circle", text: viewModel.bookingFilter.emptyMessage)
                }

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

    // MARK: - Analytics & earnings

    /// Entry into the host analytics dashboard (revenue, bookings, conversion,
    /// monthly trend). Same card look as `reviewGuestsCard`.
    private var analyticsCard: some View {
        NavigationLink {
            HostAnalyticsView()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "chart.bar.fill")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(width: 44, height: 44)
                    .background(Color.qkTan)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(L.t("analytics.title"))
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.qkInk)
                    Text(L.t("analytics.subtitle"))
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

    /// Entry into the host earnings & payouts surface. Same card look as
    /// `reviewGuestsCard`.
    private var earningsCard: some View {
        NavigationLink {
            HostEarningsView()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "banknote.fill")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(width: 44, height: 44)
                    .background(Color.qkTan)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(L.t("money.earnings"))
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.qkInk)
                    Text(L.t("money.earnings.subtitle"))
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
                HostListingFilterBar(selection: $listingFilter, listings: viewModel.listings)

                if filteredListings.isEmpty {
                    // A filter that selects nothing gets its own short line rather
                    // than the generic "you haven't published anything" hint.
                    Text(listingFilter.emptyMessage)
                        .font(.subheadline)
                        .foregroundStyle(Color.qkMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 4)
                } else {
                    ForEach(filteredListings) { listing in
                        HostListingRow(listing: listing, onChanged: {
                            Task { await viewModel.load() }
                        })
                    }
                }
            }
        }
    }

    /// The host's listings narrowed to the selected status chip.
    private var filteredListings: [Listing] {
        viewModel.listings.filter { listingFilter.matches($0.hostVisibility) }
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
    /// The decision the host tapped, held until they confirm it in the alert.
    /// Both outcomes are final for the guest — a confirmed stay blocks the
    /// dates, a rejection is announced and cannot be taken back — so neither
    /// one is sent straight from the tap.
    private enum PendingDecision {
        case confirm
        case reject
    }

    let booking: HostBooking
    let isUpdating: Bool
    let onConfirm: (() -> Void)?
    let onReject: (() -> Void)?

    @State private var pendingDecision: PendingDecision?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(booking.title ?? "Reservation")
                    .font(.headline)
                    .foregroundStyle(Color.qkInk)
                    .lineLimit(1)
                Spacer()
                // The bucket, not just the status: `bookings.status` reads "confirmed"
                // from the moment the host taps Accept, so on its own the badge called
                // an unpaid stay and a paid one the same green "Confirmed". Same fold
                // the chip row above the list runs, so the two always agree.
                StatusBadge(status: booking.bookingStatus, onPhoto: false, hostBucket: booking.filterBucket)
            }
            // Who actually sent this request, directly under the listing title — a host with
            // several requests on the same place has nothing else to tell them apart by.
            Label(guestDisplayName, systemImage: "person.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.qkInk)
                .lineLimit(1)
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
        .alert(
            pendingDecision == .reject
                ? L.t("host.action.reject.title")
                : L.t("host.action.confirm.title"),
            isPresented: Binding(
                get: { pendingDecision != nil },
                set: { if !$0 { pendingDecision = nil } }
            ),
            presenting: pendingDecision
        ) { decision in
            Button(L.t("common.cancel"), role: .cancel) { pendingDecision = nil }
            switch decision {
            case .reject:
                Button(L.t("host.action.reject"), role: .destructive) {
                    pendingDecision = nil
                    onReject?()
                }
            case .confirm:
                Button(L.t("host.action.confirm")) {
                    pendingDecision = nil
                    onConfirm?()
                }
            }
        } message: { decision in
            Text(
                decision == .reject
                    ? L.t("host.action.reject.body")
                    : L.t("host.action.confirm.body")
            )
        }
    }

    /// Who sent this request, ready to render: the guest's own name, or a generic
    /// "Guest" when their account is gone. Never empty. Lives here rather than on
    /// `HostBooking` because `L.t` is main-actor isolated and the model is not.
    private var guestDisplayName: String {
        guard let name = booking.guestName,
              !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else { return L.t("host.booking.guestFallback") }
        return name
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
                pendingDecision = .reject
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
                pendingDecision = .confirm
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

// MARK: - Host reservation status filter

/// The localized half of `HostBookingFilter`. The enum itself lives in
/// `HostBookingFilterRules.swift` and stays free of SwiftUI and the localization
/// table so `Tests/run.sh` can build it without the app.
extension HostBookingFilter {
    /// Short chip label. Reuses the wording the row badges already show, so a
    /// chip and the badges under it always read the same.
    @MainActor
    var label: String {
        switch self {
        case .all:               return L.t("explore.region.all")
        case .pending:           return L.t("host.bookingFilter.pending")
        case .awaitingPayment:   return L.t("host.bookingFilter.awaitingPayment")
        case .confirmed:         return L.t("host.bookingFilter.confirmed")
        case .rejected:          return L.t("host.bookingFilter.rejected")
        case .cancelled:         return L.t("host.bookingFilter.cancelled")
        case .refunded:          return L.t("host.bookingFilter.refunded")
        case .partiallyRefunded: return L.t("host.bookingFilter.partiallyRefunded")
        }
    }

    /// Muted line shown when this chip selects no reservations at all.
    @MainActor
    var emptyMessage: String {
        self == .all
            ? L.t("host.bookingFilter.empty.all")
            : L.t("host.bookingFilter.empty.filtered")
    }
}

/// Horizontal chip row that filters the host's reservations by status. Built
/// from the shared `QKChip`, so it matches the listings filter directly above it
/// and the Explore region chips. Observes `LocalizationManager` so the labels
/// re-render on a language switch.
struct HostBookingFilterBar: View {
    @EnvironmentObject private var loc: LocalizationManager
    @Binding var selection: HostBookingFilter
    /// The rows being filtered — used only to badge each chip with its count.
    let bookings: [HostBooking]

    /// Explicit init: the `private` environment object would otherwise make the
    /// synthesized memberwise initializer private (unusable from other files).
    init(selection: Binding<HostBookingFilter>, bookings: [HostBooking]) {
        _selection = selection
        self.bookings = bookings
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(HostBookingFilter.allCases) { filter in
                    QKChip(
                        title: filter.label,
                        count: count(for: filter),
                        isSelected: selection == filter,
                        action: { selection = filter }
                    )
                }
            }
            .padding(.vertical, 2)
        }
    }

    /// Row count for one chip — `nil` on "All" so it renders bare, mirroring the
    /// listings filter. Counted over every reservation rather than the visible
    /// slice: a chip has to say what it WOULD show.
    private func count(for filter: HostBookingFilter) -> Int? {
        guard filter != .all else { return nil }
        let tally = HostBookingFilterRules.counts(bookings.map(\.filterBucket))
        return filter.bucket.flatMap { tally[$0] } ?? 0
    }
}

// MARK: - Host listing status filter

/// The status filter above the host's own listings: All · Published · Under
/// review · Rejected · Deactivated. Maps onto `Listing.hostVisibility`, which
/// folds moderation and visibility together; legacy / missing `approval_status`
/// values decode as `.approved`, so they land under "Published".
///
/// There is no chip for `.blocked` ("hidden by our team"). It is rare, it is
/// nothing the host can act on, and a chip that usually selects nothing is one
/// people learn to ignore — those rows still carry their badge under "All".
enum HostListingFilter: String, CaseIterable, Identifiable, Equatable {
    case all
    case published
    case underReview
    case rejected
    case deactivated

    var id: String { rawValue }

    /// Short chip label. Reuses the badge wording the rows already show, so the
    /// chip and the row badge always read the same.
    @MainActor
    var label: String {
        switch self {
        case .all:         return L.t("explore.region.all")
        case .published:   return L.t("host.filter.published")
        case .underReview: return L.t("approval.pending")
        case .rejected:    return L.t("approval.rejected")
        case .deactivated: return L.t("visibility.badge.deactivated")
        }
    }

    /// `true` when a listing in `state` belongs under this chip. `.blocked` has no
    /// chip of its own, so it only ever appears under "All".
    func matches(_ state: HostVisibility) -> Bool {
        switch self {
        case .all:         return true
        case .published:   return state == .live
        case .underReview: return state == .underReview
        case .rejected:    return state == .rejected
        case .deactivated: return state == .deactivated
        }
    }

    /// Muted line shown when this chip selects no rows at all.
    @MainActor
    var emptyMessage: String {
        switch self {
        case .all:         return L.t("host.listings.empty")
        case .published:   return L.t("host.filter.empty.published")
        case .underReview: return L.t("host.filter.empty.underReview")
        case .rejected:    return L.t("host.filter.empty.rejected")
        case .deactivated: return L.t("host.filter.empty.deactivated")
        }
    }
}

/// Horizontal chip row that filters the host's listings by moderation state.
/// Built from the shared `QKChip` (selected fills burgundy with cream text,
/// unselected is a white pill with a hairline border) so it matches the Explore
/// screen's region chips exactly. Observes `LocalizationManager` so the labels
/// re-render on a language switch.
struct HostListingFilterBar: View {
    @EnvironmentObject private var loc: LocalizationManager
    @Binding var selection: HostListingFilter
    /// The rows being filtered — used only to badge each chip with its count.
    let listings: [Listing]

    /// Explicit init: the `private` environment object would otherwise make the
    /// synthesized memberwise initializer private (unusable from other files).
    init(selection: Binding<HostListingFilter>, listings: [Listing]) {
        _selection = selection
        self.listings = listings
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(HostListingFilter.allCases) { filter in
                    QKChip(
                        title: filter.label,
                        count: count(for: filter),
                        isSelected: selection == filter,
                        action: { selection = filter }
                    )
                }
            }
            .padding(.vertical, 2)
        }
    }

    /// Row count for one chip — `nil` on "All" so it renders bare, mirroring the
    /// Explore region chips.
    private func count(for filter: HostListingFilter) -> Int? {
        guard filter != .all else { return nil }
        return listings.filter { filter.matches($0.hostVisibility) }.count
    }
}

/// The coloured state capsule on the host's own listings — Under review /
/// Approved / Rejected / Deactivated / Hidden by our team. Extracted so every
/// host surface that has to say "nobody can see this listing" — the listing rows
/// and the listing editor's post-save confirmation — shows the exact same chip.
///
/// It reads a `HostVisibility`, not an `ApprovalStatus`, because from the host's
/// side "why can nobody see this?" has one answer: a listing can be approved and
/// still hidden, and a chip that only knew about moderation would call that one
/// "Approved" while guests could not find it.
struct HostApprovalBadge: View {
    @EnvironmentObject private var loc: LocalizationManager
    let state: HostVisibility

    /// Explicit init: the `private` environment object would otherwise make the
    /// synthesized memberwise initializer private (unusable from other files).
    init(state: HostVisibility) {
        self.state = state
    }

    /// Convenience for the surfaces that only hold a moderation status (the
    /// editor's post-save confirmation, which has just re-queued the listing and
    /// is saying so).
    init(status: ApprovalStatus) {
        switch status {
        case .pending:  self.state = .underReview
        case .approved: self.state = .live
        case .rejected: self.state = .rejected
        }
    }

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: icon)
                .font(.system(size: 9, weight: .bold))
            Text(label)
                .font(.system(size: 10, weight: .bold))
        }
        .foregroundStyle(tint)
        .padding(.horizontal, 9).padding(.vertical, 3)
        .background(tint.opacity(0.12))
        .clipShape(Capsule())
    }

    private var label: String {
        switch state {
        case .underReview:  return loc.t("approval.pending")
        case .live:         return loc.t("approval.approved")
        case .rejected:     return loc.t("approval.rejected")
        case .deactivated:  return loc.t("visibility.badge.deactivated")
        case .blocked:      return loc.t("visibility.badge.blocked")
        }
    }

    private var icon: String {
        switch state {
        case .underReview:  return "clock.fill"
        case .live:         return "checkmark.circle.fill"
        case .rejected:     return "exclamationmark.triangle.fill"
        case .deactivated:  return "eye.slash.fill"
        case .blocked:      return "lock.fill"
        }
    }

    private var tint: Color {
        switch state {
        case .underReview:  return .qkGoldDeep
        case .live:         return .qkSuccess
        case .rejected:     return .qkBurgundy
        // Deactivated is the host's own decision, not a fault — a muted grey, not
        // the rejection burgundy, or their own choice would read as a reprimand.
        case .deactivated:  return .qkMuted
        case .blocked:      return .qkGoldDeep
        }
    }
}

/// A compact row for one of the host's own listings — thumbnail, an approval
/// status badge (Under review / Approved / Rejected), title, location, gold ★
/// and burgundy price. "Edit listing" opens the full editor (every field plus
/// photos); saving there sends the listing back to the admin queue, which the
/// badge reflects at once. When the listing is pending or rejected, an
/// `OwnershipDocPicker` (photo library or a PDF from Files) lets the host
/// (re)submit the proof doc, which PATCHes
/// the listing and re-queues it to pending. It says "Upload" or "Re-upload"
/// depending on whether one is actually on file — the document is optional at
/// create time, so most listings in the queue have never had one.
/// RTL-safe; DesignKit tokens throughout.
struct HostListingRow: View {
    @EnvironmentObject private var loc: LocalizationManager
    // Held only to hand on to the guest preview: a sheet gets its own environment,
    // and `ListingDetailView` reads all three (sign-in state, the saved-listings
    // store and the display currency).
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var wishlist: WishlistStore
    @EnvironmentObject private var currency: CurrencyManager
    let listing: Listing
    /// Called after any successful change to this listing — an ownership-doc
    /// re-submit or a full edit — so the parent can re-fetch the authoritative
    /// status.
    var onChanged: () -> Void

    /// Locally-tracked status so the badge flips to "Under review" the instant
    /// a re-submit or an edit succeeds, before the parent's refetch lands.
    /// Seeded from the listing's decoded `approval_status`.
    @State private var status: ApprovalStatus
    /// Locally-tracked visibility, for the same reason: the badge and the button
    /// have to flip the moment a deactivate returns, not a refetch later.
    @State private var deactivated: Bool
    @State private var isPublished: Bool
    /// Requests waiting on the host. Named in the confirmation, and zeroed by a
    /// deactivate — which declines all of them.
    @State private var pendingRequests: Int
    /// Whether a proof-of-ownership document is on file, tracked locally for the
    /// same reason as the status above: the button has to read "Re-upload" the
    /// moment a submit succeeds, not a refetch later. Seeded from the decoded
    /// `has_ownership_doc`, which is false for a listing that never had one —
    /// the document is optional at create time, so that is the common case in
    /// the queue and NOT something `approvalStatus` can tell us.
    @State private var hasDoc: Bool
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    /// Presents the full listing editor.
    @State private var showingEditor = false
    /// The GUEST-projection copy of this listing, fetched on demand and presented
    /// as the guest preview. Nil whenever the preview is closed.
    @State private var previewListing: Listing?
    /// True while that fetch is in flight, so the button can show a spinner
    /// instead of looking dead on a slow connection.
    @State private var isLoadingPreview = false
    /// Presents the day-by-day pricing calendar for this listing.
    @State private var showingCalendar = false
    /// The "this will decline N requests" confirmation, shown before a deactivate
    /// and never skipped — the decline is the one irreversible part.
    @State private var confirmingDeactivate = false
    /// What just happened, in the host's words: "3 requests were declined", or
    /// "reactivated, but it stays hidden until…". Cleared on the next action.
    @State private var noticeMessage: String?

    init(listing: Listing, onChanged: @escaping () -> Void) {
        self.listing = listing
        self.onChanged = onChanged
        _status = State(initialValue: listing.approval)
        _deactivated = State(initialValue: listing.unpublishedByHost)
        _isPublished = State(initialValue: listing.isPublished)
        _pendingRequests = State(initialValue: listing.pendingRequestCount)
        _hasDoc = State(initialValue: listing.hasOwnershipDoc)
    }

    /// The row's single state, from the same rules the backend enforces. Built
    /// from the LOCAL copies so it follows an action immediately.
    private var visibility: HostVisibility {
        if deactivated { return .deactivated }
        switch status {
        case .rejected: return .rejected
        case .pending: return .underReview
        case .approved: return isPublished ? .live : .blocked
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 13) {
                ListingImageView(url: listing.sortedImageURLs.first, placeholderLabel: "", placeholderIconSize: 22)
                    .frame(width: 84, height: 84)
                    .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))

                VStack(alignment: .leading, spacing: 5) {
                    HostApprovalBadge(state: visibility)

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
                    // "Listed 27 Jul 2026" — hidden entirely when the backend
                    // omits `created_at` or the timestamp doesn't parse.
                    if !listing.listedDateText.isEmpty {
                        Text(loc.t("host.listing.listedOn")
                            .replacingOccurrences(of: "%@", with: listing.listedDateText))
                            .font(.system(size: 11))
                            .foregroundStyle(Color.qkMuted)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
            }

            // Why it was rejected. A red badge alone tells a host they're blocked
            // without telling them what to change, which is the one thing the badge
            // exists to prompt. Driven by the LOCAL `status`, not the decoded one, so
            // it disappears the instant a re-submit or an edit flips this row back to
            // "Under review" — the server has cleared the note by then anyway.
            if status == .rejected {
                rejectionReason
            }

            // "See it as a guest" — the listing exactly as a guest meets it, which
            // is the check a host wants BEFORE approval and cannot make any other
            // way on a listing guests cannot yet reach. First in the stack because
            // it is the one action here that changes nothing.
            previewButton

            // Day-by-day rates and availability. Above the editor on purpose:
            // this is the routine errand, and unlike a full edit it does NOT
            // send the listing back to the admin queue.
            calendarButton

            // Every field of the listing (and its photos) is editable from here.
            editButton

            // (Re-)upload the ownership doc when the listing is awaiting review or
            // was rejected. Approved listings need no action, so the row stays
            // compact.
            if status.canResubmitDoc {
                ownershipDocButton
            }

            // Take the listing off the market, or put it back. QuickIn has no
            // host-facing delete — this IS "remove my listing", and it keeps every
            // booking, review and payment record intact. Withheld only on
            // `.blocked`, which the host cannot undo and the API would refuse.
            if visibility != .blocked {
                visibilityButton
            }

            // What "deactivated" / "hidden by our team" actually mean for the
            // guests already booked in. The word alone does not say, and it is the
            // first thing a host wants to know.
            if visibility == .deactivated || visibility == .blocked {
                visibilityNote
            }

            if let noticeMessage {
                Text(noticeMessage)
                    .font(.footnote)
                    .foregroundStyle(Color.qkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

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
        .padding(12)
        .qkCard(cornerRadius: 18)
        .sheet(isPresented: $showingCalendar) {
            HostCalendarView(listing: listing)
                .environmentObject(loc)
        }
        // The guest preview. Its own NavigationStack so the detail screen's pushes
        // (the host profile, "more from this host") still have somewhere to go.
        .sheet(item: $previewListing) { preview in
            NavigationStack {
                ListingDetailView(listing: preview, previewAsGuest: true)
                    // The "more from this host" strip pushes by value, and the
                    // stack that normally registers this destination is not the
                    // one presenting here. Those rows come from the public
                    // `?host=` read, so they are guest projections too.
                    .navigationDestination(for: Listing.self) {
                        ListingDetailView(listing: $0, previewAsGuest: true)
                    }
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button(loc.t("common.done")) { previewListing = nil }
                                .tint(.qkBurgundy)
                        }
                    }
                    .environmentObject(loc)
                    .environmentObject(auth)
                    .environmentObject(wishlist)
                    .environmentObject(currency)
            }
        }
        .sheet(isPresented: $showingEditor) {
            EditListingView(listing: listing) { updated in
                // Reflect the new moderation state immediately, then let the
                // parent re-fetch the authoritative rows.
                status = updated.approval
                isPublished = updated.isPublished
                onChanged()
            }
        }
        // An alert, not an inline toggle: the decline is irreversible, and the
        // host has to read the count before it happens.
        .alert(loc.t("visibility.confirm.title"), isPresented: $confirmingDeactivate) {
            Button(loc.t("visibility.confirm.cancel"), role: .cancel) {}
            Button(loc.t("visibility.confirm.cta"), role: .destructive) {
                Task { await setPublished(false) }
            }
        } message: {
            Text(confirmMessage)
        }
    }

    /// The alert body: what happens, what it will cost, and what it will NOT
    /// touch. The pending-request warning is omitted entirely when there are
    /// none — an empty warning trains people to click through the real one.
    private var confirmMessage: String {
        var lines = [
            loc.t("visibility.confirm.body").replacingOccurrences(of: "%@", with: listing.title)
        ]
        if pendingRequests > 0 {
            lines.append(
                loc.t("visibility.confirm.declines")
                    .replacingOccurrences(of: "%d", with: "\(pendingRequests)")
            )
        }
        lines.append(loc.t("visibility.confirm.reassurance"))
        return lines.joined(separator: "\n\n")
    }

    // MARK: - Pieces

    /// The operator's reason for rejecting this listing, or generic guidance when
    /// they left none — `review_note` is nil both when the note was skipped (it is
    /// optional) and on listings rejected before the reason was stored at all.
    private var rejectionReason: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(loc.t("approval.rejectedReason"))
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Color.qkBurgundy)
            Text(listing.reviewNote ?? loc.t("approval.rejectedNoReason"))
                .font(.system(size: 13))
                .foregroundStyle(Color.qkInk)
                // Staff text of unknown length: let it wrap freely rather than
                // truncating the one thing the host needs to read.
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .multilineTextAlignment(.leading)
        .padding(10)
        .background(Color.qkBurgundy.opacity(0.07))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    /// Opens the pricing calendar: per-day rates, and opening/closing days.
    /// Styled as editButton's quieter twin — same geometry, tinted fill — because
    /// the two sit together and only differ in how consequential they are.
    /// Opens the listing as a guest sees it. Nothing about the listing changes.
    private var previewButton: some View {
        Button {
            Task { await openPreview() }
        } label: {
            HStack(spacing: 7) {
                if isLoadingPreview {
                    ProgressView()
                        .controlSize(.mini)
                        .tint(Color.qkBurgundy)
                } else {
                    Image(systemName: "eye")
                        .font(.system(size: 13, weight: .semibold))
                }
                Text(loc.t("preview.guest.action"))
                    .font(.system(size: 13, weight: .bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            .foregroundStyle(Color.qkBurgundy)
            .frame(maxWidth: .infinity)
            .frame(height: 40)
            .background(Color.qkSurface)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color.qkBurgundy.opacity(0.25), lineWidth: 1)
            )
        }
        .buttonStyle(.qkTap)
        .disabled(isSubmitting || isLoadingPreview)
        .accessibilityLabel(loc.t("preview.guest.action"))
    }

    /// Fetches the GUEST projection of this listing and presents it.
    ///
    /// Deliberately NOT the copy this row already holds: host reads come back from
    /// `LISTING_COLS_HOST`, whose prices are the host's own raw amounts, while a
    /// guest is quoted those plus the platform commission. Previewing the local
    /// object would show the host a nightly rate no guest will ever be offered —
    /// the single number the preview exists to check. The read is authenticated,
    /// which is also what lets it resolve at all while the listing is unpublished.
    private func openPreview() async {
        isLoadingPreview = true
        defer { isLoadingPreview = false }
        errorMessage = nil
        do {
            previewListing = try await SupabaseService.shared.fetchListing(id: listing.id)
        } catch {
            errorMessage = loc.t("preview.guest.failed")
        }
    }

    private var calendarButton: some View {
        Button {
            showingCalendar = true
        } label: {
            HStack(spacing: 7) {
                Image(systemName: "calendar")
                    .font(.system(size: 13, weight: .semibold))
                Text(loc.t("calendar.open"))
                    .font(.system(size: 13, weight: .bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            .foregroundStyle(Color.qkBurgundy)
            .frame(maxWidth: .infinity)
            .frame(height: 40)
            .background(Color.qkBurgundy.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color.qkBurgundy.opacity(0.25), lineWidth: 1)
            )
        }
        .buttonStyle(.qkTap)
        .disabled(isSubmitting)
    }

    /// Opens the full listing editor (every field + photo management). Saving
    /// there sends the listing back for review — the editor warns first.
    private var editButton: some View {
        Button {
            showingEditor = true
        } label: {
            HStack(spacing: 7) {
                Image(systemName: "square.and.pencil")
                    .font(.system(size: 13, weight: .semibold))
                Text(loc.t("listing.edit.action"))
                    .font(.system(size: 13, weight: .bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            .foregroundStyle(Color.qkBurgundy)
            .frame(maxWidth: .infinity)
            .frame(height: 40)
            .background(Color.qkSurface)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color.qkBurgundy.opacity(0.25), lineWidth: 1)
            )
        }
        .buttonStyle(.qkTap)
        .disabled(isSubmitting)
    }

    /// The ownership-document picker. Its LABEL is not the same question as the
    /// row's status: `hasDoc` says whether there is a document to re-upload, and
    /// a listing can be pending or rejected without ever having had one.
    private var ownershipDocButton: some View {
        OwnershipDocPicker(
            onPicked: { doc in Task { await resubmit(doc) } },
            onProblem: { errorMessage = $0 }
        ) { isProcessing in
            HStack(spacing: 7) {
                if isSubmitting || isProcessing {
                    ProgressView().controlSize(.small).tint(.qkBurgundy)
                } else {
                    Image(systemName: "doc.badge.arrow.up")
                        .font(.system(size: 13, weight: .semibold))
                }
                Text(loc.t(hasDoc ? "approval.reupload" : "approval.uploadDoc"))
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

    /// Deactivate / Reactivate. Deliberately the quietest button in the row when
    /// it takes a listing down — it must never compete with Edit for a distracted
    /// tap — and the warmer tinted twin when it puts one back, which is the
    /// constructive direction.
    private var visibilityButton: some View {
        Button {
            noticeMessage = nil
            if deactivated {
                Task { await setPublished(true) }
            } else {
                confirmingDeactivate = true
            }
        } label: {
            HStack(spacing: 7) {
                if isSubmitting {
                    ProgressView().controlSize(.small).tint(.qkMuted)
                } else {
                    Image(systemName: deactivated ? "eye.fill" : "eye.slash")
                        .font(.system(size: 13, weight: .semibold))
                }
                Text(loc.t(deactivated ? "visibility.reactivate" : "visibility.deactivate"))
                    .font(.system(size: 13, weight: .bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            .foregroundStyle(deactivated ? Color.qkBurgundy : Color.qkMuted)
            .frame(maxWidth: .infinity)
            .frame(height: 40)
            .background(deactivated ? Color.qkBurgundy.opacity(0.08) : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(
                        deactivated ? Color.qkBurgundy.opacity(0.25) : Color.qkMuted.opacity(0.25),
                        lineWidth: 1
                    )
            )
            .opacity(isSubmitting ? 0.85 : 1)
        }
        .buttonStyle(.qkTap)
        .disabled(isSubmitting)
    }

    /// "You deactivated this" / "Hidden by our team" — and, crucially, what that
    /// did NOT do to the reservations the host already has.
    private var visibilityNote: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(loc.t(deactivated ? "visibility.note.deactivated.title" : "visibility.note.blocked.title"))
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Color.qkInk)
            Text(loc.t(deactivated ? "visibility.note.deactivated.body" : "visibility.note.blocked.body"))
                .font(.system(size: 13))
                .foregroundStyle(Color.qkMuted)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .multilineTextAlignment(.leading)
        .padding(10)
        .background(Color.qkMuted.opacity(0.07))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    // MARK: - Visibility

    /// Flip the listing's visibility and report what ACTUALLY happened — which is
    /// not always what was asked. A reactivate can come back still hidden (an
    /// account block, the identity gate or the review queue outranks the host),
    /// and saying "it's live again" then would be a straight lie.
    private func setPublished(_ next: Bool) async {
        errorMessage = nil
        noticeMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let result = try await HostService.shared.setListingPublished(listingID: listing.id, isPublished: next)
            deactivated = !next
            isPublished = result.isPublished
            if let updated = result.listing {
                status = updated.approval
                pendingRequests = updated.pendingRequestCount
            } else if !next {
                // The deactivate declined every one of them.
                pendingRequests = 0
            }
            if next && !result.isPublished {
                noticeMessage = blockedNotice(result.blockedBy) ?? result.blockedMessage
            } else if !next && result.declinedRequests > 0 {
                noticeMessage = loc.t("visibility.declined")
                    .replacingOccurrences(of: "%d", with: "\(result.declinedRequests)")
            }
            onChanged()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// The localized "reactivated, but…" line for the party still holding the
    /// listing. Nil for a code this build has no string for — the caller then
    /// falls back to the server's own sentence rather than saying nothing.
    private func blockedNotice(_ code: String?) -> String? {
        switch code {
        case "verification": return loc.t("visibility.blocked.verification")
        case "staff":        return loc.t("visibility.blocked.staff")
        case "rejected":     return loc.t("visibility.blocked.rejected")
        case "under_review": return loc.t("visibility.blocked.underReview")
        default:             return nil
        }
    }

    // MARK: - Re-submit

    /// PATCH the picked document — a photo or a PDF, already encoded and size-
    /// checked by `OwnershipDocPicker`; on success flip the local badge to
    /// "Under review" and ask the parent to refetch.
    private func resubmit(_ dataURL: String) async {
        errorMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let updated = try await HostService.shared.resubmitOwnershipDoc(listingID: listing.id, doc: dataURL)
            status = updated.approval
            // There is now certainly a document on file, whatever the refreshed
            // row says — so the button becomes "Re-upload" immediately.
            hasDoc = true
            onChanged()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
