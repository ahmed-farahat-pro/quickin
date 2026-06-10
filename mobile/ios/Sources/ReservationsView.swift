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
            errorMessage = "Sign in to see your reservations."
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
                Color.qkCream.ignoresSafeArea()
                content
            }
            .navigationTitle("Reservations")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Color.qkCream, for: .navigationBar)
        }
        .tint(.qkBurgundy)
        .task {
            if !viewModel.hasLoaded { await viewModel.load() }
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.bookings.isEmpty {
            ProgressView("Loading your trips…")
                .tint(.qkBurgundy)
                .foregroundStyle(Color.qkMuted)
        } else if let error = viewModel.errorMessage, viewModel.bookings.isEmpty {
            emptyState(title: "Couldn't load reservations", message: error, retry: true)
        } else if viewModel.bookings.isEmpty {
            emptyState(title: "No reservations yet", message: "When you book a stay, it'll show up here.", retry: false)
        } else {
            ScrollView {
                LazyVStack(spacing: 18) {
                    ForEach(viewModel.bookings) { booking in
                        ReservationCard(booking: booking)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
            .refreshable { await viewModel.load() }
        }
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
                    Text("Retry")
                        .fontWeight(.semibold)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 10)
                        .background(Color.qkBurgundy)
                        .foregroundStyle(.white)
                        .clipShape(Capsule())
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// A single reservation card.
struct ReservationCard: View {
    let booking: Booking

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            AsyncImage(url: URL(string: booking.image ?? Listing.placeholder)) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().aspectRatio(contentMode: .fill)
                case .failure:
                    Color.qkTan.overlay(Image(systemName: "photo").foregroundStyle(Color.qkMuted))
                default:
                    Color.qkTan.overlay(ProgressView().tint(.qkBurgundy))
                }
            }
            .frame(height: 180)
            .frame(maxWidth: .infinity)
            .clipped()

            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(booking.title ?? "Reservation")
                        .font(.headline)
                        .foregroundStyle(Color.qkInk)
                        .lineLimit(1)
                    Spacer()
                    if let status = booking.status {
                        Text(status.capitalized)
                            .font(.caption2).fontWeight(.semibold)
                            .padding(.horizontal, 10).padding(.vertical, 4)
                            .background(Color.qkTan)
                            .foregroundStyle(Color.qkBurgundy)
                            .clipShape(Capsule())
                    }
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
                HStack(spacing: 4) {
                    Label("\(booking.guests) guest\(booking.guests == 1 ? "" : "s")", systemImage: "person.2.fill")
                        .foregroundStyle(Color.qkMuted)
                    Spacer()
                    Text(booking.totalText)
                        .fontWeight(.bold)
                        .foregroundStyle(Color.qkInk)
                }
                .font(.subheadline)
                .padding(.top, 2)
            }
            .padding(14)
        }
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: Color.black.opacity(0.06), radius: 12, x: 0, y: 6)
    }
}

/// Guest CTA mirroring `SignInCTAView`, scoped to reservations.
struct ReservationsSignInCTA: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var showingAuth = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.qkCream.ignoresSafeArea()

                VStack(spacing: 20) {
                    Spacer()

                    Image("logo")
                        .resizable()
                        .scaledToFit()
                        .frame(height: 64)

                    VStack(spacing: 8) {
                        Text("Sign in to see your reservations")
                            .font(.system(.title3, design: .serif).weight(.semibold))
                            .foregroundStyle(Color.qkInk)
                            .multilineTextAlignment(.center)
                        Text("Your upcoming and past trips live here once you're signed in.")
                            .font(.subheadline)
                            .foregroundStyle(Color.qkMuted)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 24)
                    }

                    Spacer()

                    Button {
                        showingAuth = true
                    } label: {
                        Text("Sign in or create account")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .background(Color.qkBurgundy)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    .padding(.horizontal, 24)
                    .padding(.bottom, 24)
                }
                .frame(maxWidth: 480)
                .frame(maxWidth: .infinity)
            }
            .navigationTitle("Reservations")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Color.qkCream, for: .navigationBar)
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
}
