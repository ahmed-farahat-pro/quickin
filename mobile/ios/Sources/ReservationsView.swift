import SwiftUI

/// Loads the signed-in user's reservations from `GET /api/local/bookings`.
@MainActor
final class ReservationsViewModel: ObservableObject {
    @Published var bookings: [Booking] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var hasLoaded = false

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            bookings = try await BookingService.shared.fetchReservations()
        } catch BookingError.notSignedIn {
            // This load only runs when AuthStore says the user IS signed in
            // (the top-level gate shows ReservationsSignInCTA otherwise), so a
            // `notSignedIn` here is a transient/401 token hiccup — NOT a real
            // signed-out state. Surface a neutral, retryable message instead of
            // the sign-in CTA title, so a signed-in user never sees a "sign in"
            // prompt inside their own Trips list.
            errorMessage = L.t("reservations.error.session")
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
        hasLoaded = true
    }

    /// Drop cached results (used when the user signs out).
    func reset() {
        bookings = []
        errorMessage = nil
        hasLoaded = false
    }
}

/// The "Reservations" tab. Guests see a sign-in CTA; signed-in users see their
/// bookings as cards with pull-to-refresh.
struct ReservationsView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var loc: LocalizationManager
    @StateObject private var viewModel = ReservationsViewModel()
    /// The status chip in force. Deliberately NOT persisted: a filter that survives
    /// backgrounding is one a guest reopens the app into having forgotten they set,
    /// and an empty Trips tab that is empty because of a chip reads as lost bookings.
    @State private var filter: ReservationFilter = .all

    var body: some View {
        Group {
            if auth.isAuthenticated {
                signedIn
            } else {
                ReservationsSignInCTA()
            }
        }
        .animation(.easeInOut(duration: 0.25), value: auth.isAuthenticated)
        // Refresh whenever auth flips (sign-in loads, sign-out clears).
        .onChange(of: auth.isAuthenticated) { _, isAuthed in
            if isAuthed {
                Task { await viewModel.load() }
            } else {
                viewModel.reset()
            }
        }
    }

    private var signedIn: some View {
        NavigationStack {
            ZStack {
                LinearGradient.qkPageWash.ignoresSafeArea()
                VStack(spacing: 0) {
                    QKBrandHeader(
                        eyebrow: loc.t("reservations.eyebrow"),
                        title: loc.t("reservations.myTrips"),
                        subtitle: loc.t("reservations.subtitle")
                    ) {
                        HStack(spacing: 10) {
                            // Host-only; renders nothing for a guest. A host's
                            // own reservations inbox lives in the dashboard, not
                            // in Trips, so this is the shortcut across.
                            QKHostHeaderButton()
                            QKHeaderIconButton(
                                systemName: "sparkles",
                                accessibilityLabel: loc.t("reservations.mySubscriptions")
                            ) {
                                MySubscriptionsView()
                            }
                        }
                    }
                    content
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .tint(.qkBurgundy)
        // onAppear fires every time the Trips tab becomes visible (tab switch,
        // return from a detail push, etc.) — always reload so data is never stale.
        .onAppear {
            Task { await viewModel.load() }
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.bookings.isEmpty {
            SkeletonList(count: 4, imageHeight: 180)
        } else {
            // One refreshable ScrollView for EVERY state (list, empty, error) so
            // pull-to-refresh always works — previously only the populated list
            // was refreshable, so an empty list couldn't be pulled to reload.
            ScrollView {
                LazyVStack(spacing: 18) {
                    subscriptionsLink
                    if let error = viewModel.errorMessage, viewModel.bookings.isEmpty {
                        emptyState(title: loc.t("reservations.error.title"), message: error, retry: true)
                    } else if viewModel.bookings.isEmpty {
                        emptyState(title: loc.t("reservations.empty.title"), message: loc.t("reservations.empty.msg"), retry: false)
                    } else {
                        ReservationFilterBar(selection: $filter, bookings: viewModel.bookings)
                        let visible = viewModel.bookings.filter { filter.matches($0.reservationBucket) }
                        if visible.isEmpty {
                            // The guest HAS reservations — this chip just holds none.
                            // Saying "no trips yet" here would be a lie, so name the
                            // chip and offer the only way out (nobody can conjure a
                            // booking into a status).
                            filteredEmptyState
                        } else {
                            ForEach(visible) { booking in
                                NavigationLink {
                                    ReservationDetailView(booking: booking)
                                } label: {
                                    ReservationCard(booking: booking)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
            .refreshable { await viewModel.load() }
        }
    }

    /// Banner entry into the user's service subscriptions ("My subscriptions").
    private var subscriptionsLink: some View {
        NavigationLink {
            MySubscriptionsView()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "sparkles")
                    .font(.title3)
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 2) {
                    Text(loc.t("reservations.mySubscriptions"))
                        .font(.headline)
                        .foregroundStyle(Color.qkInk)
                    Text(loc.t("reservations.mySubscriptions.subtitle"))
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

    /// Shown when the guest has reservations but none behind the chosen chip. Sized
    /// far shorter than `emptyState` — the chip row is right above it and has to stay
    /// on screen, or the way out of the empty filter scrolls off with the explanation.
    private var filteredEmptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "line.3.horizontal.decrease.circle")
                .font(.system(size: 34))
                .foregroundStyle(Color.qkBurgundy.opacity(0.55))
            Text(filter.emptyMessage)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.qkMuted)
                .padding(.horizontal, 24)
            Button {
                filter = .all
            } label: {
                Text(loc.t("reservations.filter.showAll"))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.qkBurgundy)
            }
            .buttonStyle(.qkTap)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 44)
        .qkCard()
    }

    private func emptyState(title: String, message: String, retry: Bool) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "suitcase")
                .font(.system(size: 48))
                .foregroundStyle(Color.qkBurgundy.opacity(0.6))
            Text(title)
                .font(.headline)
                .foregroundStyle(Color.qkInk)
            Text(message)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.qkMuted)
                .padding(.horizontal, 32)
            if retry {
                Button {
                    Task { await viewModel.load() }
                } label: {
                    Text(loc.t("common.retry"))
                        .fontWeight(.semibold)
                        .foregroundStyle(Color.qkCream)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 11)
                        .background(LinearGradient.qkBurgundyCTA)
                        .clipShape(Capsule())
                }
                .buttonStyle(QKPressStyle())
            }
        }
        .frame(maxWidth: .infinity, minHeight: 440)
        .padding(.top, 20)
    }
}

// MARK: - The status filter

extension Booking {
    /// The chip this reservation is filed behind on the Trips list, or `nil` for a
    /// status the app does not know (it still renders, under **All**).
    ///
    /// Lives here rather than in `ReservationFilter.swift` because that file has to
    /// compile on its own for `Tests/run.sh`, and `Booking` drags in the rest of
    /// `Models.swift` with it.
    var reservationBucket: ReservationFilterRules.Bucket {
        ReservationFilterRules.bucket(for: ReservationFilterRules.Snapshot(
            status: status,
            // `paymentStage` is Booking's own, decided by PaymentFlowRules — the fold
            // never re-reads the payment columns itself.
            paymentStage: paymentStage,
            refundPercent: refundPercent,
            // A separate question from the stage, which calls everything cancelled
            // `.notPayable`. Without it, a booking cancelled before it was ever paid
            // carried the policy's 100% and read as "Refunded".
            wasPaid: PaymentFlowRules.everPaid(PaymentFlowRules.Snapshot(
                status: status,
                paymentState: paymentStatus,
                proofStatus: paymentProofStatus,
                paidAt: paidAt
            ))
        ))
    }
}

extension ReservationFilterRules.Bucket {
    /// The chip whose wording this bucket borrows. Every bucket has exactly one.
    var filter: ReservationFilter {
        switch self {
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

    /// What the pill on the card itself says. Differs from the chip label only where
    /// the chip names a GROUP and the badge describes ONE booking: "Pending" files a
    /// row, but the row tells the guest what it is waiting for.
    @MainActor
    var badgeLabel: String {
        switch self {
        case .pending:   return L.t("reservation.waitingApproval")
        case .confirmed: return L.t("reservation.paid")
        default:         return filter.label
        }
    }
}

extension ReservationFilter {
    /// Short chip label. The wording is shared with `badgeLabel` wherever the two can
    /// say the same thing, so a chip and the cards under it never disagree.
    @MainActor
    var label: String {
        switch self {
        case .all:               return L.t("explore.region.all")
        case .pending:           return L.t("status.pending")
        case .awaitingPayment:   return L.t("reservations.filter.awaitingPayment")
        case .underReview:       return L.t("reservations.filter.underReview")
        case .confirmed:         return L.t("status.confirmed")
        case .completed:         return L.t("status.completed")
        case .cancelled:         return L.t("status.cancelled")
        case .partiallyRefunded: return L.t("reservations.filter.partiallyRefunded")
        case .refunded:          return L.t("cancel.refunded")
        case .rejected:          return L.t("status.rejected")
        }
    }

    /// Muted line shown when the guest has reservations but none behind this chip.
    @MainActor
    var emptyMessage: String {
        switch self {
        case .all:               return L.t("reservations.empty.msg")
        case .pending:           return L.t("reservations.filter.empty.pending")
        case .awaitingPayment:   return L.t("reservations.filter.empty.awaitingPayment")
        case .underReview:       return L.t("reservations.filter.empty.underReview")
        case .confirmed:         return L.t("reservations.filter.empty.confirmed")
        case .completed:         return L.t("reservations.filter.empty.completed")
        case .cancelled:         return L.t("reservations.filter.empty.cancelled")
        case .partiallyRefunded: return L.t("reservations.filter.empty.partiallyRefunded")
        case .refunded:          return L.t("reservations.filter.empty.refunded")
        case .rejected:          return L.t("reservations.filter.empty.rejected")
        }
    }
}

/// Horizontal chip row that filters the guest's reservations by status. Built from
/// the shared `QKChip`, so it matches the host dashboard's listing filter and the
/// Explore region chips exactly. Observes `LocalizationManager` so the labels
/// re-render on a language switch.
struct ReservationFilterBar: View {
    @EnvironmentObject private var loc: LocalizationManager
    @Binding var selection: ReservationFilter
    /// The rows being filtered — used only to badge each chip with its count.
    let bookings: [Booking]

    /// Explicit init: the `private` environment object would otherwise make the
    /// synthesized memberwise initializer private (unusable from other files).
    init(selection: Binding<ReservationFilter>, bookings: [Booking]) {
        _selection = selection
        self.bookings = bookings
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                // Chips a guest has nothing behind are dropped rather than shown at 0.
                // The host's five chips are a fixed vocabulary they work through; these
                // ten describe a story most guests only ever see part of, and eight
                // empty chips to scroll past would bury the two that hold something.
                // "All" and the selected chip always survive, so the row cannot go
                // blank and the current filter cannot vanish from under the list.
                ForEach(visibleFilters) { filter in
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
        .accessibilityLabel(loc.t("reservations.filter.a11y"))
    }

    private var counts: [ReservationFilterRules.Bucket: Int] {
        ReservationFilterRules.counts(bookings.map(\.reservationBucket))
    }

    private var visibleFilters: [ReservationFilter] {
        let tally = counts
        return ReservationFilter.allCases.filter { filter in
            guard let bucket = filter.bucket else { return true }  // .all
            return filter == selection || (tally[bucket] ?? 0) > 0
        }
    }

    /// Row count for one chip — `nil` on "All" so it renders bare, mirroring the host
    /// filter and the Explore region chips.
    private func count(for filter: ReservationFilter) -> Int? {
        guard let bucket = filter.bucket else { return nil }
        return counts[bucket] ?? 0
    }
}

/// A single reservation card — photo hero with the status pill overlaid, a
/// serif title and location over a legibility scrim, then a dates/total footer.
struct ReservationCard: View {
    @EnvironmentObject private var loc: LocalizationManager
    let booking: Booking

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .bottomLeading) {
                ListingImageView(url: booking.image)
                    .frame(height: 160)
                    .frame(maxWidth: .infinity)
                    .clipped()
                    .qkPhotoScrim(start: 0.42)

                // Status pill (top-leading).
                VStack {
                    HStack {
                        // `bucket` is what the chip row above filed this row under, so
                        // the pill and the chip always read the same words.
                        StatusBadge(
                            status: booking.bookingStatus,
                            paid: booking.isPaid,
                            bucket: booking.reservationBucket
                        )
                        Spacer()
                    }
                    Spacer()
                }
                .padding(12)

                // Title + location overlaid bottom-leading.
                VStack(alignment: .leading, spacing: 1) {
                    Text(booking.title ?? loc.t("reservations.reservation"))
                        .font(.system(.title3, design: .serif).weight(.bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    if let location = booking.location {
                        Text(location)
                            .font(.system(size: 12))
                            .foregroundStyle(.white.opacity(0.92))
                            .lineLimit(1)
                    }
                }
                .padding(14)
            }

            HStack(spacing: 10) {
                Label(booking.dateRangeText, systemImage: "calendar")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.qkInk)
                    .labelStyle(.titleAndIcon)
                    .lineLimit(1)
                Spacer(minLength: 8)
                Text(booking.totalText)
                    .font(.system(size: 15, weight: .heavy))
                    .foregroundStyle(Color.qkBurgundy)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 13)
        }
        .qkCard()
    }
}

/// Guest CTA mirroring `SignInCTAView`, scoped to reservations.
struct ReservationsSignInCTA: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var loc: LocalizationManager
    @State private var showingAuth = false

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient.qkPageWash.ignoresSafeArea()

                VStack(spacing: 0) {
                    QKBrandHeader(
                        eyebrow: loc.t("reservations.eyebrow"),
                        title: loc.t("reservations.myTrips"),
                        subtitle: loc.t("reservations.subtitle")
                    )

                    VStack(spacing: 20) {
                        Spacer()

                        Image("logo")
                            .resizable()
                            .scaledToFit()
                            .frame(height: 64)

                        VStack(spacing: 8) {
                            Text(loc.t("cta.reservations.title"))
                                .font(.system(.title3, design: .serif).weight(.semibold))
                                .foregroundStyle(Color.qkInk)
                                .multilineTextAlignment(.center)
                            Text(loc.t("cta.reservations.subtitle"))
                                .font(.subheadline)
                                .foregroundStyle(Color.qkMuted)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 24)
                        }

                        Spacer()

                        Button {
                            showingAuth = true
                        } label: {
                            QKPrimaryButtonLabel(title: loc.t("cta.button"))
                        }
                        .buttonStyle(QKPressStyle())
                        .padding(.horizontal, 24)
                        .padding(.bottom, 24)
                    }
                    .frame(maxWidth: 480)
                    .frame(maxWidth: .infinity)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .tint(.qkBurgundy)
        .sheet(isPresented: $showingAuth) {
            AuthView().environmentObject(auth)
        }
        .onChange(of: auth.isAuthenticated) { _, isAuthed in
            if isAuthed { showingAuth = false }
        }
    }
}

#Preview {
    ReservationsView()
        .environmentObject(AuthStore())
        .environmentObject(LocalizationManager.shared)
}
