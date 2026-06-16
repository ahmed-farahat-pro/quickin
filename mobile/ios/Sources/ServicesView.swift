import SwiftUI

/// Loads the public catalogue of services from `GET /api/local/services`.
@MainActor
final class ServicesViewModel: ObservableObject {
    @Published var services: [Service] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var hasLoaded = false

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            services = try await ServiceService.shared.fetchServices()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
        hasLoaded = true
    }
}

/// The "Services" tab — a browse list of standalone experiences (jet ski,
/// diving, yacht…) any visitor can subscribe to. Mirrors `ListingsView`:
/// fully open (no login gate); subscribing prompts sign-in on `ServiceDetailView`.
struct ServicesView: View {
    @EnvironmentObject private var loc: LocalizationManager
    @StateObject private var viewModel = ServicesViewModel()
    @State private var path: [Service] = []

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                LinearGradient.qkPageWash.ignoresSafeArea()
                VStack(spacing: 0) {
                    QKBrandHeader(
                        eyebrow: loc.t("services.eyebrow"),
                        title: loc.t("services.title"),
                        subtitle: loc.t("services.subtitle")
                    )
                    content
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Service.self) { service in
                ServiceDetailView(service: service)
            }
        }
        .tint(.qkBurgundy)
        .task {
            if !viewModel.hasLoaded { await viewModel.load() }
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.services.isEmpty {
            SkeletonList(count: 5, imageHeight: 200)
        } else if viewModel.services.isEmpty {
            emptyState(viewModel.errorMessage ?? loc.t("services.empty.nothingMsg"))
        } else {
            ScrollView {
                LazyVStack(spacing: 20) {
                    ForEach(viewModel.services) { service in
                        NavigationLink(value: service) {
                            ServiceCard(service: service)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
            .refreshable { await viewModel.load() }
        }
    }

    private func emptyState(_ message: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "sparkles")
                .font(.system(size: 48))
                .foregroundStyle(Color.qkBurgundy.opacity(0.6))
            Text(loc.t("services.empty.nothing"))
                .font(.headline)
                .foregroundStyle(Color.qkInk)
            Text(message)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.qkMuted)
                .padding(.horizontal, 32)
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
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// A single experience card in the Services feed — dark photo hero with a
/// legibility scrim, category pill, gold ★ rating, title/location overlaid, and
/// a price + "Book" footer. Matches the redesign mockup.
struct ServiceCard: View {
    @EnvironmentObject private var loc: LocalizationManager
    let service: Service

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .bottomLeading) {
                ListingImageView(url: service.photoURL)
                    .frame(height: 150)
                    .frame(maxWidth: .infinity)
                    .clipped()
                    .qkPhotoScrim(strength: 0.62, start: 0.30)

                // Category pill (top-leading) + rating (top-trailing). Pinned to
                // fill the image so the overlay never drives the card wider than
                // its photo (which would push the whole card off-screen).
                VStack {
                    HStack(alignment: .top) {
                        if let category = service.category, !category.isEmpty {
                            Text(category.capitalized)
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(Color.qkBurgundy)
                                .padding(.horizontal, 10).padding(.vertical, 4)
                                .background(Color.white.opacity(0.92))
                                .clipShape(Capsule())
                        }
                        Spacer()
                        HStack(spacing: 3) {
                            Image(systemName: "star.fill")
                                .font(.system(size: 10))
                                .foregroundStyle(Color.qkGoldLight)
                            Text(String(format: "%.1f", service.displayRating))
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(.white)
                        }
                        .padding(.horizontal, 9).padding(.vertical, 4)
                        .background(.ultraThinMaterial.opacity(0.9), in: Capsule())
                        .background(Color.qkInk.opacity(0.35), in: Capsule())
                    }
                    Spacer()
                }
                .padding(11)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)

                // Title + location overlaid bottom-leading. Pinned to fill width
                // (leading-aligned, RTL-safe) so a long title is truncated rather
                // than stretching the card past the screen edge.
                VStack(alignment: .leading, spacing: 1) {
                    Text(service.title)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    if let location = service.location, !location.isEmpty {
                        Text(location)
                            .font(.system(size: 12))
                            .foregroundStyle(.white.opacity(0.9))
                            .lineLimit(1)
                    } else if let host = service.hostName, !host.isEmpty {
                        Text(String(format: loc.t("services.hostedBy"), host))
                            .font(.system(size: 12))
                            .foregroundStyle(.white.opacity(0.9))
                            .lineLimit(1)
                    }
                }
                .padding(14)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
            }

            HStack {
                HStack(spacing: 4) {
                    Text(service.priceText)
                        .font(.system(size: 17, weight: .heavy))
                        .foregroundStyle(Color.qkBurgundy)
                    Text(loc.t("services.perExperience"))
                        .font(.system(size: 12))
                        .foregroundStyle(Color.qkMuted)
                }
                Spacer()
                Text(loc.t("detail.reserve"))
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.qkCream)
                    .padding(.horizontal, 18).padding(.vertical, 9)
                    .background(LinearGradient.qkBurgundyCTA)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .qkCard(cornerRadius: 20)
    }
}

/// A burgundy-on-frosted category pill used on service cards + detail.
struct CategoryChip: View {
    let category: String

    var body: some View {
        Text(category.capitalized)
            .font(.caption2).fontWeight(.bold)
            .foregroundStyle(Color.qkBurgundy)
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background(.ultraThinMaterial)
            .clipShape(Capsule())
    }
}
