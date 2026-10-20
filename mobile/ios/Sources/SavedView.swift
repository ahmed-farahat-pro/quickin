import SwiftUI

/// Loads the signed-in user's saved listings from
/// `GET /api/local/wishlist`.
@MainActor
final class SavedViewModel: ObservableObject {
    @Published var listings: [Listing] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var hasLoaded = false

    var isEmpty: Bool { listings.isEmpty }
    /// `true` only when the user is genuinely signed out (no session). Drives the
    /// sign-in prompt; an empty list while signed in is NOT signed-out.
    @Published var isSignedOut = false

    /// Load the wishlist. `isAuthenticated` is the authoritative auth state from
    /// `AuthStore`: when the user is signed in we treat an empty result — or even
    /// a transient `notSignedIn` from the API (e.g. token race) — as an EMPTY
    /// wishlist, never as signed-out. Only a real signed-out state shows the
    /// sign-in prompt.
    func load(isAuthenticated: Bool) async {
        isLoading = true
        errorMessage = nil
        do {
            let wishlist = try await WishlistService.shared.fetch()
            listings = wishlist.listings
            isSignedOut = false
        } catch WishlistError.notSignedIn {
            if isAuthenticated {
                // Signed in per AuthStore but the API reported no session —
                // surface it as an empty wishlist, not a sign-in wall.
                listings = []
                isSignedOut = false
            } else {
                isSignedOut = true
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
        hasLoaded = true
    }
}

/// The "Saved" screen, reached from Profile. Shows the user's saved listings
/// as the redesigned cards, with a friendly empty state. Tapping a card
/// pushes its detail; the heart on each card un-saves it (shared WishlistStore).
struct SavedView: View {
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var wishlist: WishlistStore
    @EnvironmentObject private var auth: AuthStore
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
        // Always refetch when the tab appears — never serve a stale/static list,
        // so an item saved on another screen shows up the moment you open Saved.
        // (load() keeps the current cards on screen while it refreshes, so there's
        // no skeleton flash once we already have data.)
        .onAppear {
            Task {
                await wishlist.refresh()
                await viewModel.load(isAuthenticated: auth.isAuthenticated)
            }
        }
        // Instantly drop a card the moment its heart un-saves it while viewing.
        // (Newly-saved items are picked up by the onAppear refetch above.)
        .onChange(of: wishlist.savedListingIDs) { _, ids in
            viewModel.listings.removeAll { !ids.contains($0.id) }
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.isEmpty {
            SkeletonList(count: 4, imageHeight: 200)
        } else if viewModel.isSignedOut && viewModel.isEmpty {
            // Genuinely signed out (no session) → prompt to sign in.
            signedOutState
        } else if let error = viewModel.errorMessage, viewModel.isEmpty {
            errorState(error)
        } else if viewModel.isEmpty {
            // Signed in but nothing saved → friendly empty state.
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
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
            .refreshable { await viewModel.load(isAuthenticated: auth.isAuthenticated) }
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

    /// Shown only when genuinely signed out (no session) — distinct from the
    /// signed-in-but-empty state above.
    private var signedOutState: some View {
        VStack(spacing: 14) {
            Image(systemName: "heart.text.square")
                .font(.system(size: 48))
                .foregroundStyle(Color.qkBurgundy.opacity(0.6))
            Text(loc.t("saved.signedOut.title"))
                .font(.headline)
                .foregroundStyle(Color.qkInk)
            Text(loc.t("saved.signInPrompt"))
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
                Task { await viewModel.load(isAuthenticated: auth.isAuthenticated) }
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
