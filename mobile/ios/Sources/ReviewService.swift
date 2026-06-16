import Foundation

/// Networking for guest reviews against the live Next.js API. Mirrors
/// `BookingService`: pure URLSession + Codable, reading the bearer token from
/// `UserDefaults` under `AuthStore.tokenKey` ("qk_token").
///
///   GET  {base}/api/local/reviews?listing_id=ID   (public)
///         → [{ rating, comment, reviewer_name, created_at }]
///   GET  {base}/api/local/reviews                  (Bearer)
///         → reviewable stays (confirmed, past checkout, not yet reviewed)
///   POST {base}/api/local/reviews { booking_id, rating, comment }  (Bearer)
///         → 201 (success)
struct ReviewService {
    static let shared = ReviewService()

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

    // MARK: - Public reviews for a listing

    /// Reviews for a listing (public — no auth required). Returns an empty list
    /// on a non-2xx so the detail screen simply shows no reviews.
    func fetchReviews(listingID: String) async throws -> [Review] {
        var components = URLComponents(string: "\(Config.apiBaseURL)/api/local/reviews")!
        components.queryItems = [URLQueryItem(name: "listing_id", value: listingID)]
        let url = components.url!

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw ReviewError.message("Invalid response from the server.")
        }
        guard (200...299).contains(http.statusCode) else {
            throw ReviewError.message(Self.decodeError(data) ?? "Couldn't load reviews (\(http.statusCode)).")
        }
        return try JSONDecoder().decode([Review].self, from: data)
    }

    // MARK: - Reviewable stays (signed-in)

    /// The signed-in user's stays that are eligible for a review (confirmed,
    /// past checkout, not yet reviewed). Throws `ReviewError.notSignedIn` when
    /// there is no token or the server returns 401.
    func fetchReviewable() async throws -> [ReviewableStay] {
        guard let token else { throw ReviewError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/reviews")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw ReviewError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw ReviewError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw ReviewError.message(Self.decodeError(data) ?? "Couldn't load reviewable stays (\(http.statusCode)).")
        }
        return try JSONDecoder().decode([ReviewableStay].self, from: data)
    }

    /// Whether the given booking is still awaiting a review (best-effort; returns
    /// `false` on any error). Used to decide whether to surface the "Leave a
    /// review" entry on a reservation.
    func isReviewable(bookingID: String) async -> Bool {
        guard let stays = try? await fetchReviewable() else { return false }
        return stays.contains { $0.bookingId == bookingID }
    }

    // MARK: - Submit a review

    /// Submit a 1–5 star review (+ optional comment + up to 6 photos) for a
    /// completed booking. `photos` is an array of `data:image/*` or `http(s)`
    /// image URL strings. Throws `ReviewError.notSignedIn` with no token, or
    /// `ReviewError.message` carrying the server's `{ error }` for 4xx responses.
    func submit(bookingID: String, rating: Int, comment: String, photos: [String] = []) async throws {
        guard let token else { throw ReviewError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/reviews")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "booking_id": bookingID,
            "rating": rating,
            "comment": comment,
            "photos": Array(photos.prefix(6)),
        ])

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw ReviewError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw ReviewError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw ReviewError.message(Self.decodeError(data) ?? "Couldn't submit your review (\(http.statusCode)).")
        }
    }

    // MARK: - Guest reviews (host → guest)

    /// Reviews left about a guest (public — no auth required). Returns an empty
    /// list on a non-2xx so a profile simply shows no guest reviews.
    func fetchGuestReviews(guestID: String) async throws -> [GuestReview] {
        var components = URLComponents(string: "\(Config.apiBaseURL)/api/local/guest-reviews")!
        components.queryItems = [URLQueryItem(name: "guest_id", value: guestID)]
        let url = components.url!

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw ReviewError.message("Invalid response from the server.")
        }
        guard (200...299).contains(http.statusCode) else {
            throw ReviewError.message(Self.decodeError(data) ?? "Couldn't load reviews (\(http.statusCode)).")
        }
        return try JSONDecoder().decode([GuestReview].self, from: data)
    }

    /// The signed-in host's past guests that are eligible for a guest review
    /// (confirmed, past checkout, not yet reviewed by the host). Throws
    /// `ReviewError.notSignedIn` when there is no token or the server returns 401.
    func fetchReviewableGuests() async throws -> [ReviewableGuest] {
        guard let token else { throw ReviewError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/guest-reviews")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw ReviewError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw ReviewError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw ReviewError.message(Self.decodeError(data) ?? "Couldn't load reviewable guests (\(http.statusCode)).")
        }
        return try JSONDecoder().decode([ReviewableGuest].self, from: data)
    }

    /// Host leaves (or replaces) a 1–5 star review of a past guest for a booking.
    /// Throws `ReviewError.notSignedIn` with no token, or `ReviewError.message`
    /// carrying the server's `{ error }` for 4xx responses.
    func submitGuestReview(bookingID: String, rating: Int, comment: String) async throws {
        guard let token else { throw ReviewError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/guest-reviews")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "booking_id": bookingID,
            "rating": rating,
            "comment": comment,
        ])

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw ReviewError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw ReviewError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw ReviewError.message(Self.decodeError(data) ?? "Couldn't submit your review (\(http.statusCode)).")
        }
    }

    // MARK: - Helpers

    private static func decodeError(_ data: Data) -> String? {
        struct ErrorBody: Decodable { let error: String }
        return (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
    }
}

/// Errors surfaced to the reviews UI.
enum ReviewError: LocalizedError {
    case notSignedIn
    case message(String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn: return "Sign in to leave a review"
        case let .message(text): return text
        }
    }
}
