import SwiftUI

/// App-wide saved-favorites state, injected at the root via `.environmentObject`
/// so the heart on listing cards, the listing detail, and the Saved screen all
/// share one source of truth.
///
/// Toggling is **optimistic**: the heart flips instantly, the POST runs in the
/// background, and the local set is rolled back if the request fails. Saved ids
/// are refreshed from `GET /api/local/wishlist` whenever the user signs in (and
/// cleared on sign-out).
@MainActor
final class WishlistStore: ObservableObject {
    /// Saved listing ids (drives the filled hearts on stay cards + detail).
    @Published private(set) var savedListingIDs: Set<String> = []
    /// Saved service ids (for parity with services, used by the Saved screen).
    @Published private(set) var savedServiceIDs: Set<String> = []

    init() {
        // Belt-and-suspenders: also clear on the logout broadcast so a sign-out
        // never leaves a previous account's saved hearts behind, independent of
        // the reactive `.task(id: auth.isAuthenticated)` in QuickInApp.
        NotificationCenter.default.addObserver(
            forName: .qkAuthDidLogout,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.reset() }
        }
    }

    /// Whether a given listing is currently saved.
    func isListingSaved(_ id: String) -> Bool { savedListingIDs.contains(id) }
    /// Whether a given service is currently saved.
    func isServiceSaved(_ id: String) -> Bool { savedServiceIDs.contains(id) }

    /// Pull the saved-id sets from the backend (no-op / empties when signed out).
    func refresh() async {
        let (listings, services) = await WishlistService.shared.fetchSavedIds()
        savedListingIDs = listings
        savedServiceIDs = services
    }

    /// Clear all saved state (call on sign-out).
    func reset() {
        savedListingIDs = []
        savedServiceIDs = []
    }

    /// Optimistically toggle a listing's saved state, then sync with the server.
    /// Rolls back on failure. Returns the (optimistic) new saved state.
    @discardableResult
    func toggleListing(_ id: String) -> Bool {
        let wasSaved = savedListingIDs.contains(id)
        if wasSaved { savedListingIDs.remove(id) } else { savedListingIDs.insert(id) }
        let nowSaved = !wasSaved
        Task { await self.sync(itemType: .listing, id: id, optimisticSaved: nowSaved) }
        return nowSaved
    }

    /// Optimistically toggle a service's saved state, then sync with the server.
    @discardableResult
    func toggleService(_ id: String) -> Bool {
        let wasSaved = savedServiceIDs.contains(id)
        if wasSaved { savedServiceIDs.remove(id) } else { savedServiceIDs.insert(id) }
        let nowSaved = !wasSaved
        Task { await self.sync(itemType: .service, id: id, optimisticSaved: nowSaved) }
        return nowSaved
    }

    /// Run the POST and reconcile local state with the server's authoritative
    /// `saved` flag; on error, roll back to the pre-toggle state.
    private func sync(itemType: WishlistService.ItemType, id: String, optimisticSaved: Bool) async {
        do {
            let serverSaved = try await WishlistService.shared.toggle(itemType: itemType, itemID: id)
            apply(itemType: itemType, id: id, saved: serverSaved)
        } catch {
            // Roll back to the opposite of our optimistic guess.
            apply(itemType: itemType, id: id, saved: !optimisticSaved)
        }
    }

    private func apply(itemType: WishlistService.ItemType, id: String, saved: Bool) {
        switch itemType {
        case .listing:
            if saved { savedListingIDs.insert(id) } else { savedListingIDs.remove(id) }
        case .service:
            if saved { savedServiceIDs.insert(id) } else { savedServiceIDs.remove(id) }
        }
    }
}
