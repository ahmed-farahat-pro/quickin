import Foundation

/// Minimal HTTP client for the local Next.js API — just enough to browse listings.
/// No third-party dependencies: pure URLSession + Codable.
struct SupabaseService {
    static let shared = SupabaseService()

    private let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 15
        cfg.waitsForConnectivity = true
        return URLSession(configuration: cfg)
    }()

    /// Fetch listings, optionally filtered by the search header + discovery
    /// filters. Query params: `location`, `region`, `guests`, `checkIn`/`checkOut`
    /// (yyyy-MM-dd), `sort`, `propertyType`, `amenities` (comma-joined; the listing
    /// must have ALL), and `bbox` (`minLng,minLat,maxLng,maxLat` for "Search this
    /// area"). Empty / nil params are omitted so an unfiltered call returns
    /// everything.
    func fetchListings(
        location: String? = nil,
        region: String? = nil,
        guests: Int? = nil,
        checkIn: String? = nil,
        checkOut: String? = nil,
        sort: ListingSort = .recommended,
        propertyType: String? = nil,
        amenities: [String] = [],
        bbox: BBox? = nil
    ) async throws -> [Listing] {
        var components = URLComponents(string: "\(Config.apiBaseURL)/api/local/listings")!
        var items: [URLQueryItem] = []
        let trimmedLocation = location?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let trimmedLocation, !trimmedLocation.isEmpty {
            items.append(URLQueryItem(name: "location", value: trimmedLocation))
        }
        let trimmedRegion = region?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let trimmedRegion, !trimmedRegion.isEmpty {
            items.append(URLQueryItem(name: "region", value: trimmedRegion))
        }
        if let guests, guests > 0 {
            items.append(URLQueryItem(name: "guests", value: String(guests)))
        }
        if let checkIn, !checkIn.isEmpty {
            items.append(URLQueryItem(name: "checkIn", value: checkIn))
        }
        if let checkOut, !checkOut.isEmpty {
            items.append(URLQueryItem(name: "checkOut", value: checkOut))
        }
        // Only send a non-default sort; "recommended" is the backend default.
        if sort != .recommended {
            items.append(URLQueryItem(name: "sort", value: sort.rawValue))
        }
        let trimmedType = propertyType?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let trimmedType, !trimmedType.isEmpty {
            items.append(URLQueryItem(name: "propertyType", value: trimmedType))
        }
        // Amenities are comma-joined; the backend requires the listing to have ALL.
        if !amenities.isEmpty {
            items.append(URLQueryItem(name: "amenities", value: amenities.joined(separator: ",")))
        }
        // Visible-region box for "Search this area" — west,south,east,north.
        if let bbox {
            items.append(URLQueryItem(name: "bbox", value: bbox.queryValue))
        }
        if !items.isEmpty { components.queryItems = items }
        let url = components.url!

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)

        guard let http = response as? HTTPURLResponse else {
            throw SupabaseError.invalidResponse
        }
        guard (200...299).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw SupabaseError.server(status: http.statusCode, body: body)
        }

        return try JSONDecoder().decode([Listing].self, from: data)
    }

    /// Fetch a single host's published listings (`GET /api/local/listings?host=ID`).
    /// Used by the "More from this host" section on listing detail. Returns an
    /// empty list on a non-2xx so the section simply hides itself.
    func fetchHostListings(hostID: String) async throws -> [Listing] {
        var components = URLComponents(string: "\(Config.apiBaseURL)/api/local/listings")!
        components.queryItems = [URLQueryItem(name: "host", value: hostID)]
        let url = components.url!

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw SupabaseError.invalidResponse
        }
        guard (200...299).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw SupabaseError.server(status: http.statusCode, body: body)
        }
        return try JSONDecoder().decode([Listing].self, from: data)
    }

    /// Fetch a single listing by id (`GET /api/local/listings/:id`). Used to
    /// resolve an incoming deep link (`/explore/<id>`) into a full `Listing` so
    /// the detail screen can be presented. Throws on a non-2xx (e.g. 404).
    func fetchListing(id: String) async throws -> Listing {
        let encoded = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        let url = URL(string: "\(Config.apiBaseURL)/api/local/listings/\(encoded)")!

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw SupabaseError.invalidResponse
        }
        guard (200...299).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw SupabaseError.server(status: http.statusCode, body: body)
        }
        return try JSONDecoder().decode(Listing.self, from: data)
    }

    /// Fetch a listing's calendar availability
    /// (`GET /api/local/listings/:id/availability`). Public — no auth. Returns the
    /// booked + host-blocked spans (`[start, end)`, half-open) so the date picker
    /// can grey out unavailable days. Throws on a non-2xx.
    func fetchAvailability(listingID: String) async throws -> [AvailabilityRange] {
        let encoded = listingID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? listingID
        let url = URL(string: "\(Config.apiBaseURL)/api/local/listings/\(encoded)/availability")!

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw SupabaseError.invalidResponse
        }
        guard (200...299).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw SupabaseError.server(status: http.statusCode, body: body)
        }
        return try JSONDecoder().decode([AvailabilityRange].self, from: data)
    }

    /// Fetch the curated browse regions with their listing counts
    /// (`GET /api/local/regions`). Drives the Explore region chips. Returns an
    /// empty list on a non-2xx so the UI simply falls back to "All".
    func fetchRegions() async throws -> [RegionFacet] {
        let url = URL(string: "\(Config.apiBaseURL)/api/local/regions")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw SupabaseError.invalidResponse
        }
        guard (200...299).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw SupabaseError.server(status: http.statusCode, body: body)
        }
        return try JSONDecoder().decode([RegionFacet].self, from: data)
    }

    /// Place autocomplete for the Explore search bar
    /// (`GET /api/local/places?q=…` → `{ places: [String] }`). Public — no auth.
    /// An empty query returns the curated popular destinations. Best-effort:
    /// returns an empty list on any failure so the search field never breaks.
    func fetchPlaceSuggestions(query: String) async -> [String] {
        struct Envelope: Decodable { let places: [String] }
        var components = URLComponents(string: "\(Config.apiBaseURL)/api/local/places")!
        components.queryItems = [URLQueryItem(name: "q", value: query)]
        guard let url = components.url else { return [] }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse,
              (200...299).contains(http.statusCode),
              let envelope = try? JSONDecoder().decode(Envelope.self, from: data)
        else { return [] }
        return envelope.places
    }
}

/// Sort order for the Explore listings, mapping 1:1 to the backend `sort=` param.
enum ListingSort: String, CaseIterable, Identifiable, Equatable {
    case recommended
    case priceAsc  = "price_asc"
    case priceDesc = "price_desc"
    case newest

    var id: String { rawValue }

    /// Short label for the sort control.
    @MainActor
    var label: String {
        switch self {
        case .recommended: return L.t("sort.recommended")
        case .priceAsc:    return L.t("sort.priceAsc")
        case .priceDesc:   return L.t("sort.priceDesc")
        case .newest:      return L.t("sort.newest")
        }
    }

    /// SF Symbol shown beside each option in the sort menu.
    var systemImage: String {
        switch self {
        case .recommended: return "sparkles"
        case .priceAsc:    return "arrow.up"
        case .priceDesc:   return "arrow.down"
        case .newest:      return "clock"
        }
    }
}

enum SupabaseError: LocalizedError {
    case invalidResponse
    case server(status: Int, body: String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid response from the server."
        case let .server(status, body):
            return "Server error \(status): \(body)"
        }
    }
}
