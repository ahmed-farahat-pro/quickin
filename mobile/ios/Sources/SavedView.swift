import SwiftUI

/// Loads the signed-in user's saved listings + services from
/// `GET /api/local/wishlist`.
@MainActor
final class SavedViewModel: ObservableObject {
    @Published var listings: [Listing] = []
    @Published var services: [Service] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var hasLoaded = false

    var isEmpty: Bool { listings.isEmpty && services.isEmpty }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            let wishlist = try await WishlistService.shared.fetch()
            listings = wishlist.listings
            services = wishlist.services
        } catch WishlistError.notSignedIn {
            errorMessage = L.t("saved.signInPrompt")
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
        hasLoaded = true
    }
}

/// The "Saved" screen, reached from Profile. Shows the user's saved listings and
/// services as the redesigned cards, with a friendly empty state. Tapping a card
/// pushes its detail; the heart on each card un-saves it (shared WishlistStore).
struct SavedView: View {
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var wishlist: WishlistStore
    @StateObject private var viewModel = SavedViewModel()

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()
            VStack(spacing: 0) {
                QKBrandHeader(
                    eyebrow: loc.t("saved.eyebrow"),
                    title: loc.t("saved.title"),
                    subtitle: loc.t("saved.subtitle")
                )
                content
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(for: Listing.self) { ListingDetailView(listing: $0) }
        .navigationDestination(for: Service.self) { ServiceDetailView(service: $0) }
        // Always refetch when the tab appears — never serve a stale/static list,
        // so an item saved on another screen shows up the moment you open Saved.
        // (load() keeps the current cards on screen while it refreshes, so there's
        // no skeleton flash once we already have data.)
        .onAppear {
            Task {
                await wishlist.refresh()
                await viewModel.load()
            }
        }
        // Instantly drop a card the moment its heart un-saves it while viewing.
        // (Newly-saved items are picked up by the onAppear refetch above.)
        .onChange(of: wishlist.savedListingIDs) { _, ids in
            viewModel.listings.removeAll { !ids.contains($0.id) }
        }
        .onChange(of: wishlist.savedServiceIDs) { _, ids in
            viewModel.services.removeAll { !ids.contains($0.id) }
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.isEmpty {
            SkeletonList(count: 4, imageHeight: 200)
        } else if let error = viewModel.errorMessage, viewModel.isEmpty {
            errorState(error)
        } else if viewModel.isEmpty {
            emptyState
        } else {
            ScrollView {
                LazyVStack(spacing: 20) {
                    if !viewModel.listings.isEmpty {
                        sectionHeader(loc.t("saved.stays"))
                        ForEach(viewModel.listings) { listing in
                            NavigationLink(value: listing) {
                                ListingCard(listing: listing)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    if !viewModel.services.isEmpty {
                        sectionHeader(loc.t("saved.services"))
                        ForEach(viewModel.services) { service in
                            NavigationLink(value: service) {
                                SavedServiceCard(service: service)
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

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(Color.qkMuted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 4)
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Image(systemName: "heart")
                .font(.system(size: 48))
                .foregroundStyle(Color.qkBurgundy.opacity(0.6))
            Text(loc.t("saved.empty.title"))
                .font(.headline)
                .foregroundStyle(Color.qkInk)
            Text(loc.t("saved.empty.msg"))
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.qkMuted)
                .padding(.horizontal, 32)
        }
        .frame(maxWidth: .infinity, minHeight: 440)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 44))
                .foregroundStyle(Color.qkBurgundy.opacity(0.6))
            Text(loc.t("saved.error.title"))
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
        .frame(maxWidth: .infinity, minHeight: 440)
    }
}

/// A saved-service card mirroring `ServiceCard` but with a heart that un-saves
/// it from the wishlist (the browse `ServiceCard` has no heart). Tapping the
/// card itself pushes the service detail via the enclosing `NavigationLink`.
struct SavedServiceCard: View {
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var wishlist: WishlistStore
    let service: Service

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .topTrailing) {
                ListingImageView(url: service.photoURL)
                    .frame(height: 150)
                    .frame(maxWidth: .infinity)
                    .clipped()
                    .qkPhotoScrim(strength: 0.55, start: 0.34)

                QKHeartButton(
                    isOn: Binding(
                        get: { wishlist.isServiceSaved(service.id) },
                        set: { _ in }
                    )
                ) {
                    wishlist.toggleService(service.id)
                }
                .padding(11)

                VStack(alignment: .leading, spacing: 1) {
                    Spacer()
                    Text(service.title)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    if let location = service.location, !location.isEmpty {
                        Text(location)
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
                if let category = service.category, !category.isEmpty {
                    Text(category.capitalized)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.qkBurgundy)
                        .padding(.horizontal, 10).padding(.vertical, 4)
                        .background(Color.qkTan)
                        .clipShape(Capsule())
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .qkCard(cornerRadius: 20)
    }
}
