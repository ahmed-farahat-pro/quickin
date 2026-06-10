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

    /// Fetch listings, optionally filtered by the search header.
    /// Query params: `location`, `guests`, `checkIn`/`checkOut` (yyyy-MM-dd).
    /// Empty / nil params are omitted so an unfiltered call returns everything.
    func fetchListings(
        location: String? = nil,
        guests: Int? = nil,
        checkIn: String? = nil,
        checkOut: String? = nil
    ) async throws -> [Listing] {
        var components = URLComponents(string: "\(Config.apiBaseURL)/api/local/listings")!
        var items: [URLQueryItem] = []
        let trimmedLocation = location?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let trimmedLocation, !trimmedLocation.isEmpty {
            items.append(URLQueryItem(name: "location", value: trimmedLocation))
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
