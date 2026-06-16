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

    /// The most recent "Added / Removed from wishlist" event, published so a
    /// single app-level overlay can show a transient toast. Exactly ONE toast is
    /// emitted per toggle, AFTER the server responds, reflecting the server's
    /// authoritative `saved` value. Each emission carries a fresh `id` so the
    /// overlay re-triggers even on repeat actions.
    @Published var lastToast: WishlistToast?

    /// Item ids with a toggle request currently in flight. A second tap on the
    /// same item is ignored until the first completes, so a double-tap can never
    /// fire two opposing toggles (or two toasts).
    private var inFlightListingIDs: Set<String> = []
    private var inFlightServiceIDs: Set<String> = []

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
    /// The heart flips instantly for responsiveness, but the toast is emitted
    /// once from the server result inside `sync`. Rolls back on failure. Ignores
    /// taps while a toggle for this id is already in flight. Returns the
    /// (optimistic) new saved state.
    @discardableResult
    func toggleListing(_ id: String) -> Bool {
        // Ignore a re-tap while this item's toggle is still resolving, so a
        // double-tap can't toggle twice (or emit two toasts).
        guard !inFlightListingIDs.contains(id) else { return savedListingIDs.contains(id) }
        let wasSaved = savedListingIDs.contains(id)
        if wasSaved { savedListingIDs.remove(id) } else { savedListingIDs.insert(id) }
        let nowSaved = !wasSaved
        inFlightListingIDs.insert(id)
        Task { await self.sync(itemType: .listing, id: id, optimisticSaved: nowSaved) }
        return nowSaved
    }

    /// Optimistically toggle a service's saved state, then sync with the server.
    /// Same single-toast-from-server + in-flight guard behavior as listings.
    @discardableResult
    func toggleService(_ id: String) -> Bool {
        guard !inFlightServiceIDs.contains(id) else { return savedServiceIDs.contains(id) }
        let wasSaved = savedServiceIDs.contains(id)
        if wasSaved { savedServiceIDs.remove(id) } else { savedServiceIDs.insert(id) }
        let nowSaved = !wasSaved
        inFlightServiceIDs.insert(id)
        Task { await self.sync(itemType: .service, id: id, optimisticSaved: nowSaved) }
        return nowSaved
    }

    /// Publish a fresh toast reflecting the given saved state.
    private func emitToast(saved: Bool) {
        lastToast = WishlistToast(saved: saved)
    }

    /// Run the POST and reconcile local state with the server's authoritative
    /// `saved` flag, then emit EXACTLY ONE toast based on that result. On error,
    /// roll back to the pre-toggle state and toast the (reverted) true state.
    /// Always clears the in-flight flag so future taps are accepted.
    private func sync(itemType: WishlistService.ItemType, id: String, optimisticSaved: Bool) async {
        defer { clearInFlight(itemType: itemType, id: id) }
        do {
            let serverSaved = try await WishlistService.shared.toggle(itemType: itemType, itemID: id)
            apply(itemType: itemType, id: id, saved: serverSaved)
            // Single source of truth for the toast: the server's authoritative
            // `saved` value (true → "Added", false → "Removed").
            emitToast(saved: serverSaved)
        } catch {
            // Roll back to the opposite of our optimistic guess, and toast the
            // reverted state so the message matches what actually stuck.
            apply(itemType: itemType, id: id, saved: !optimisticSaved)
            emitToast(saved: !optimisticSaved)
        }
    }

    /// Drop the in-flight marker for an item once its toggle settles.
    private func clearInFlight(itemType: WishlistService.ItemType, id: String) {
        switch itemType {
        case .listing: inFlightListingIDs.remove(id)
        case .service: inFlightServiceIDs.remove(id)
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
