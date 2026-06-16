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
            errorMessage = L.t("cta.reservations.title")
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
                        title: loc.t("reservations.title"),
                        subtitle: loc.t("reservations.subtitle")
                    ) {
                        QKHeaderIconButton(
                            systemName: "sparkles",
                            accessibilityLabel: loc.t("reservations.mySubscriptions")
                        ) {
                            MySubscriptionsView()
                        }
                    }
                    content
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .tint(.qkBurgundy)
        .task {
            if !viewModel.hasLoaded { await viewModel.load() }
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
                        ForEach(viewModel.bookings) { booking in
                            NavigationLink {
                                ReservationDetailView(booking: booking)
                            } label: {
                                ReservationCard(booking: booking)
                            }
                            .buttonStyle(.plain)
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
                        StatusBadge(status: booking.bookingStatus)
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
                        title: loc.t("reservations.title"),
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
