import Foundation

/// Section 10 — non-streaming AI endpoints: the host listing-description WRITER
/// and the guest natural-language SEARCH. Mirrors `HostService` / `SupabaseService`:
/// pure URLSession + Codable, with the bearer token read straight from
/// `UserDefaults` under `AuthStore.tokenKey`.
///
///   POST {base}/api/local/ai/listing-description  (Bearer)
///        body { title, location, region, propertyType, bedrooms, maxGuests,
///               amenities[], notes } → { description, ai }
///   POST {base}/api/local/ai/search               (public)
///        body { query } → { filters, listings, ai }
struct AIService {
    static let shared = AIService()

    private let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        // The model can take a moment to compose a description / parse a query.
        cfg.timeoutIntervalForRequest = 40
        cfg.waitsForConnectivity = true
        return URLSession(configuration: cfg)
    }()

    /// The persisted bearer token, or `nil` when browsing as a guest.
    private var token: String? {
        let value = UserDefaults.standard.string(forKey: AuthStore.tokenKey)
        return (value?.isEmpty == false) ? value : nil
    }

    // MARK: - Listing-description writer (Bearer)

    /// The listing details the writer turns into a description. Mirrors the
    /// backend body for `POST /api/local/ai/listing-description`.
    struct ListingDescriptionInput {
        var title: String
        var location: String
        var region: String?
        var propertyType: String
        var bedrooms: Int
        var maxGuests: Int
        var amenities: [String]
        /// Optional free-text notes/seed the host typed (the current description).
        var notes: String
    }

    /// Generate a guest-facing description from the listing's details. Returns the
    /// `description` string. Throws `AIServiceError.notSignedIn` on 401,
    /// `.unavailable` on 503 (key not configured), `.message` for other failures.
    func generateListingDescription(_ input: ListingDescriptionInput) async throws -> String {
        guard let token else { throw AIServiceError.notSignedIn }
        guard let url = URL(string: "\(Config.apiBaseURL)/api/local/ai/listing-description") else {
            throw AIServiceError.generic
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        var body: [String: Any] = [
            "title": input.title,
            "location": input.location,
            "propertyType": input.propertyType,
            "bedrooms": input.bedrooms,
            "maxGuests": input.maxGuests,
            "amenities": input.amenities,
            "notes": input.notes,
        ]
        if let region = input.region?.trimmingCharacters(in: .whitespacesAndNewlines), !region.isEmpty {
            body["region"] = region
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw AIServiceError.generic }
        if http.statusCode == 401 { throw AIServiceError.notSignedIn }
        if http.statusCode == 503 { throw AIServiceError.unavailable }
        guard (200...299).contains(http.statusCode) else {
            throw AIServiceError.message(Self.decodeError(data)
                ?? "Couldn't write the description (\(http.statusCode)).")
        }

        struct WriterResponse: Decodable { let description: String? }
        let decoded = try JSONDecoder().decode(WriterResponse.self, from: data)
        let text = decoded.description?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !text.isEmpty else { throw AIServiceError.generic }
        return text
    }

    // MARK: - Natural-language search (public)

    /// Parse a plain-language query into `{ filters, listings }`. Public — no auth
    /// required (the token is attached when present, harmlessly). Throws
    /// `AIServiceError.unavailable` on 503, `.message` for other failures.
    func search(query: String) async throws -> AISearchResult {
        guard let url = URL(string: "\(Config.apiBaseURL)/api/local/ai/search") else {
            throw AIServiceError.generic
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        request.httpBody = try JSONSerialization.data(withJSONObject: ["query": query])

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw AIServiceError.generic }
        if http.statusCode == 503 { throw AIServiceError.unavailable }
        guard (200...299).contains(http.statusCode) else {
            throw AIServiceError.message(Self.decodeError(data)
                ?? "Couldn't run the search (\(http.statusCode)).")
        }
        return try JSONDecoder().decode(AISearchResult.self, from: data)
    }

    // MARK: - Helpers

    private static func decodeError(_ data: Data) -> String? {
        struct ErrorBody: Decodable { let error: String }
        return (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
    }
}

/// Errors surfaced by the AI writer + natural-language search. Kept free of
/// `L.t` lookups (which are `@MainActor`-bound) so the service stays nonisolated,
/// matching `HostService`. The view turns each case into
/// a localized string via `localizedMessage`.
enum AIServiceError: LocalizedError {
    /// A generic transport/parse failure.
    case generic
    /// The endpoint requires sign-in (HTTP 401).
    case notSignedIn
    /// The AI service isn't configured yet (HTTP 503).
    case unavailable
    /// A specific, already-human-readable message from the server.
    case message(String)

    /// Localized text for an inline error note. Resolved on the main actor.
    @MainActor var localizedMessage: String {
        switch self {
        case .generic:     return L.t("ai.error.generic")
        case .notSignedIn: return L.t("ai.error.signIn")
        case .unavailable: return L.t("ai.error.unavailable")
        case let .message(text): return text
        }
    }
}
