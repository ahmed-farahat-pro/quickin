import SwiftUI

/// Loads the signed-in user's service subscriptions from
/// `GET /api/local/service-requests`. Mirrors `ReservationsViewModel`.
@MainActor
final class MySubscriptionsViewModel: ObservableObject {
    @Published var requests: [ServiceRequest] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var hasLoaded = false

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            requests = try await ServiceService.shared.myServiceRequests()
        } catch ServiceError.notSignedIn {
            errorMessage = "Sign in to see your subscriptions."
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
        hasLoaded = true
    }
}

/// "My subscriptions" — the user's service requests with a pending/confirmed/
/// rejected status badge. Pushed from Reservations (and Profile). Mirrors the
/// reservation list aesthetic.
struct MySubscriptionsView: View {
    @StateObject private var viewModel = MySubscriptionsViewModel()

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()
            content
        }
        .navigationTitle("My subscriptions")
        .navigationBarTitleDisplayMode(.large)
        .toolbarBackground(Color.qkCream, for: .navigationBar)
        .task {
            if !viewModel.hasLoaded { await viewModel.load() }
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.requests.isEmpty {
            SkeletonList(count: 4, imageHeight: 180)
        } else if let error = viewModel.errorMessage, viewModel.requests.isEmpty {
            emptyState(title: "Couldn't load subscriptions", message: error, retry: true)
        } else if viewModel.requests.isEmpty {
            emptyState(title: "No subscriptions yet", message: "When you request an experience, it'll show up here.", retry: false)
        } else {
            ScrollView {
                LazyVStack(spacing: 18) {
                    ForEach(viewModel.requests) { request in
                        SubscriptionCard(request: request)
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
            Image(systemName: "sparkles")
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
                        .foregroundStyle(Color.qkCream)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 11)
                        .background(LinearGradient.qkBurgundyCTA)
                        .clipShape(Capsule())
                }
                .buttonStyle(QKPressStyle())
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// A single service-subscription card. Mirrors `ReservationCard`.
struct SubscriptionCard: View {
    let request: ServiceRequest

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ListingImageView(url: request.photoURL)
                .frame(height: 180)
                .frame(maxWidth: .infinity)
                .clipped()

            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(request.serviceTitle ?? "Experience")
                        .font(.headline)
                        .foregroundStyle(Color.qkInk)
                        .lineLimit(1)
                    Spacer()
                    StatusBadge(status: request.requestStatus)
                }
                if let category = request.serviceCategory, !category.isEmpty {
                    Label(category.capitalized, systemImage: "tag.fill")
                        .font(.subheadline)
                        .foregroundStyle(Color.qkMuted)
                        .lineLimit(1)
                }
                if let location = request.serviceLocation, !location.isEmpty {
                    Label(location, systemImage: "mappin.and.ellipse")
                        .font(.subheadline)
                        .foregroundStyle(Color.qkMuted)
                        .lineLimit(1)
                }
                if !request.preferredDateText.isEmpty {
                    Label(request.preferredDateText, systemImage: "calendar")
                        .font(.subheadline)
                        .foregroundStyle(Color.qkInk)
                }
                HStack(spacing: 4) {
                    if let host = request.hostName, !host.isEmpty {
                        Label("Hosted by \(host)", systemImage: "person.crop.circle")
                            .foregroundStyle(Color.qkMuted)
                            .lineLimit(1)
                    }
                    Spacer()
                    Text(request.priceText)
                        .fontWeight(.bold)
                        .foregroundStyle(Color.qkInk)
                }
                .font(.subheadline)
                .padding(.top, 2)

                if let code = request.requestCode, !code.isEmpty {
                    Text(code)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(Color.qkMuted)
                }
            }
            .padding(14)
        }
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: Color.black.opacity(0.06), radius: 12, x: 0, y: 6)
    }
}
