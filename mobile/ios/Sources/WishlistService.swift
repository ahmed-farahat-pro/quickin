import Foundation

/// Networking for the saved-favorites ("Wishlist") feature against the live
/// Next.js API. Mirrors `BookingService` / `NotificationService`: pure
/// URLSession + Codable, reading the bearer token straight from `UserDefaults`
/// under `AuthStore.tokenKey` ("qk_token") so it stays decoupled from the store.
///
///   GET  {base}/api/local/wishlist
///         → { listings: [Listing], services: [Service], listingIds: [String], serviceIds: [String] }
///   POST {base}/api/local/wishlist { item_type: "listing"|"service", item_id, action? }
///         → { saved: Bool }   (toggles; `saved` reflects the new state)
struct WishlistService {
    static let shared = WishlistService()

    private let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 15
        cfg.waitsForConnectivity = true
        return URLSession(configuration: cfg)
    }()

    /// The persisted bearer token, or `nil` when browsing as a guest.
    var token: String? {
        let value = UserDefaults.standard.string(forKey: AuthStore.tokenKey)
        return (value?.isEmpty == false) ? value : nil
    }

    /// The kind of item a wishlist entry points at.
    enum ItemType: String {
        case listing
        case service
    }

    /// The full saved-items payload: the hydrated listings/services plus the raw
    /// id sets (used to paint saved hearts across the browse screens).
    struct Wishlist: Decodable {
        let listings: [Listing]
        let services: [Service]
        let listingIds: [String]
        let serviceIds: [String]

        enum CodingKeys: String, CodingKey {
            case listings, services, listingIds, serviceIds
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            listings = try c.decodeIfPresent([Listing].self, forKey: .listings) ?? []
            services = try c.decodeIfPresent([Service].self, forKey: .services) ?? []
            listingIds = try c.decodeIfPresent([String].self, forKey: .listingIds) ?? []
            serviceIds = try c.decodeIfPresent([String].self, forKey: .serviceIds) ?? []
        }

        static let empty = Wishlist(listings: [], services: [], listingIds: [], serviceIds: [])

        private init(listings: [Listing], services: [Service], listingIds: [String], serviceIds: [String]) {
            self.listings = listings
            self.services = services
            self.listingIds = listingIds
            self.serviceIds = serviceIds
        }
    }

    // MARK: - Fetch

    /// The signed-in user's full saved list. Throws `WishlistError.notSignedIn`
    /// when there is no token or the server returns 401.
    func fetch() async throws -> Wishlist {
        guard let token else { throw WishlistError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/wishlist")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw WishlistError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw WishlistError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw WishlistError.message(Self.decodeError(data) ?? "Couldn't load saved items (\(http.statusCode)).")
        }
        return try JSONDecoder().decode(Wishlist.self, from: data)
    }

    /// Just the saved-id sets — lighter than `fetch()` when only painting hearts
    /// on the browse screens. Returns empty sets when signed out (no throw) so
    /// callers can fire-and-forget on listings load.
    func fetchSavedIds() async -> (listings: Set<String>, services: Set<String>) {
        guard let wishlist = try? await fetch() else { return ([], []) }
        return (Set(wishlist.listingIds), Set(wishlist.serviceIds))
    }

    // MARK: - Toggle

    /// Toggle a listing/service in the wishlist. Returns the new saved state
    /// (`true` == now saved). Pass `action` to force "save"/"remove" instead of
    /// toggling. Throws `WishlistError.notSignedIn` when there is no token.
    @discardableResult
    func toggle(itemType: ItemType, itemID: String, action: String? = nil) async throws -> Bool {
        guard let token else { throw WishlistError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/wishlist")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        var body: [String: String] = ["item_type": itemType.rawValue, "item_id": itemID]
        if let action { body["action"] = action }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw WishlistError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw WishlistError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw WishlistError.message(Self.decodeError(data) ?? "Couldn't update favorites (\(http.statusCode)).")
        }
        struct Result: Decodable { let saved: Bool? }
        let decoded = try? JSONDecoder().decode(Result.self, from: data)
        // If the backend omits `saved`, assume the toggle succeeded as a save.
        return decoded?.saved ?? true
    }

    // MARK: - Helpers

    private static func decodeError(_ data: Data) -> String? {
        struct ErrorBody: Decodable { let error: String }
        return (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
    }
}

/// Errors surfaced to the wishlist UI.
enum WishlistError: LocalizedError {
    case notSignedIn
    case message(String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn: return "Sign in to save favorites"
        case let .message(text): return text
        }
    }
}
