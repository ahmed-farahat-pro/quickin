import Foundation

/// Networking for reservations against the local Next.js API (no Supabase).
///
///   POST {base}/api/local/bookings  (Bearer qk_token) → 201 Booking | { error }
///   GET  {base}/api/local/bookings  (Bearer qk_token) → [Booking]
///
/// The bearer token lives in `UserDefaults` under `AuthStore.tokenKey`
/// ("qk_token"), written by `AuthStore` when the user signs in. We read it
/// straight from there so the service stays decoupled from the store.
struct BookingService {
    static let shared = BookingService()

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

    // MARK: - Create

    /// Reserve a stay. Throws `BookingError.notSignedIn` when there is no token,
    /// `BookingError.message` carrying the server's `{ error }` for 4xx
    /// responses (e.g. "Those dates are not available").
    @discardableResult
    func reserve(listingID: String, checkIn: String, checkOut: String, guests: Int) async throws -> Booking {
        guard let token else { throw BookingError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/bookings")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "listing_id": listingID,
            "check_in": checkIn,
            "check_out": checkOut,
            "guests": guests,
        ])

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw BookingError.message("Invalid response from the server.")
        }

        if (200...299).contains(http.statusCode) {
            return try JSONDecoder().decode(Booking.self, from: data)
        }
        if http.statusCode == 401 {
            throw BookingError.notSignedIn
        }
        // 400 (and other 4xx/5xx): surface the server's { error } when present.
        throw BookingError.message(Self.decodeError(data) ?? "Reservation failed (\(http.statusCode)).")
    }

    // MARK: - List

    /// The signed-in user's reservations. Throws `BookingError.notSignedIn`
    /// when there is no token or the server returns 401.
    func fetchReservations() async throws -> [Booking] {
        guard let token else { throw BookingError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/bookings")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw BookingError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw BookingError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw BookingError.message(Self.decodeError(data) ?? "Failed to load reservations (\(http.statusCode)).")
        }
        return try JSONDecoder().decode([Booking].self, from: data)
    }

    // MARK: - Helpers

    private static func decodeError(_ data: Data) -> String? {
        struct ErrorBody: Decodable { let error: String }
        return (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
    }
}

/// Errors surfaced to the reserve / reservations UI.
enum BookingError: LocalizedError {
    case notSignedIn
    case message(String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn: return "Sign in to reserve"
        case let .message(text): return text
        }
    }
}
