import Foundation

/// Networking for the host area + reservation detail, against the local Next.js
/// API (no Supabase). Mirrors `BookingService`: pure URLSession + Codable, and
/// reads the bearer token straight from `UserDefaults` under
/// `AuthStore.tokenKey` ("qk_token") so it stays decoupled from the auth store.
///
///   POST  {base}/api/local/listings        → 201 Listing  (403 if role != host)
///   GET   {base}/api/local/host/bookings    → [HostBooking]
///   GET   {base}/api/local/host/listings    → [Listing]
///   PATCH {base}/api/local/bookings/:id      → updated booking  (confirm | reject)
///   GET   {base}/api/local/bookings/:id      → ReservationDetail
///   GET   {base}/api/local/bookings/:id/messages → [ChatMessage] (oldest-first)
///   POST  {base}/api/local/bookings/:id/messages → 201 ChatMessage  ({ body })
struct HostService {
    static let shared = HostService()

    private let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        // Create + ownership-doc PATCH carry a base64 image, so allow extra time.
        cfg.timeoutIntervalForRequest = 20
        cfg.waitsForConnectivity = true
        return URLSession(configuration: cfg)
    }()

    /// The persisted bearer token, or `nil` when browsing as a guest.
    var token: String? {
        let value = UserDefaults.standard.string(forKey: AuthStore.tokenKey)
        return (value?.isEmpty == false) ? value : nil
    }

    // MARK: - Create listing (host only)

    /// Fields the "Add listing" form collects. Sent as the POST body.
    struct NewListing {
        var title: String
        var description: String
        var location: String
        var country: String
        /// Curated area the host picked (e.g. "North Coast"). Sent as `region`;
        /// omitted from the body when nil.
        var region: String?
        var pricePerNight: Double
        var bedrooms: Int
        var beds: Int
        var bathrooms: Int
        var maxGuests: Int
        var propertyType: String
        var imageURL: String
        /// Amenity labels the host selected (e.g. "WiFi", "Pool"). Sent as
        /// `amenities: [String]`; empty when none chosen.
        var amenities: [String] = []
        /// The host-chosen cancellation policy. Sent as `cancellation_policy`;
        /// defaults to `.moderate`.
        var cancellationPolicy: CancellationPolicy = .moderate
        /// Length-of-stay weekly discount (% off ≥7-night stays). Sent as
        /// `weekly_discount`; `0` means no discount.
        var weeklyDiscount: Int = 0
        /// Length-of-stay monthly discount (% off ≥28-night stays). Sent as
        /// `monthly_discount`; `0` means no discount.
        var monthlyDiscount: Int = 0
        /// The ownership / proof-of-ownership document the host uploaded, as a
        /// `data:image/*;base64,…` URL produced by `QKAvatarImage.makeDataURL`.
        /// Sent as `ownership_doc`; omitted from the body when empty. New
        /// listings are created pending + unpublished until an admin approves.
        var ownershipDoc: String = ""
        /// Map coordinate chosen via the host pin-picker (optional).
        var lat: Double?
        var lng: Double?
    }

    /// Create a listing. Throws `HostError.forbidden` when the signed-in account
    /// isn't a host (backend 403), `HostError.message` for other 4xx/5xx.
    @discardableResult
    func createListing(_ listing: NewListing) async throws -> Listing {
        guard let token else { throw HostError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/listings")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let trimmedImage = listing.imageURL.trimmingCharacters(in: .whitespacesAndNewlines)
        var body: [String: Any] = [
            "title": listing.title,
            "description": listing.description,
            "location": listing.location,
            "country": listing.country,
            "price_per_night": listing.pricePerNight,
            "bedrooms": listing.bedrooms,
            "beds": listing.beds,
            "bathrooms": listing.bathrooms,
            "max_guests": listing.maxGuests,
            "property_type": listing.propertyType,
        ]
        body["images"] = trimmedImage.isEmpty ? [] : [trimmedImage]
        body["amenities"] = listing.amenities
        // Host-set cancellation policy (backend `cancellation_policy` column).
        body["cancellation_policy"] = listing.cancellationPolicy.rawValue
        // Length-of-stay discounts (backend `weekly_discount` / `monthly_discount`
        // columns). Always sent (0 = no discount) so the backend records them.
        body["weekly_discount"] = max(0, min(listing.weeklyDiscount, 100))
        body["monthly_discount"] = max(0, min(listing.monthlyDiscount, 100))
        // Ownership / proof document (data: URL). When present the backend queues
        // the new listing for review; included only when the host attached one.
        let trimmedDoc = listing.ownershipDoc.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedDoc.isEmpty {
            body["ownership_doc"] = trimmedDoc
        }
        // Curated browse region the host selected (backend `region` column).
        if let region = listing.region?.trimmingCharacters(in: .whitespacesAndNewlines),
           !region.isEmpty {
            body["region"] = region
        }
        // Include the pin-picker coordinate when the host placed one. Sent as
        // top-level `lat`/`lng` so the listing shows up on the Explore map.
        if let lat = listing.lat, let lng = listing.lng {
            body["lat"] = lat
            body["lng"] = lng
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HostError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) {
            return try JSONDecoder().decode(Listing.self, from: data)
        }
        if http.statusCode == 401 { throw HostError.notSignedIn }
        if http.statusCode == 403 {
            throw HostError.forbidden(Self.decodeError(data) ?? "Only hosts can create listings.")
        }
        throw HostError.message(Self.decodeError(data) ?? "Couldn't create the listing (\(http.statusCode)).")
    }

    // MARK: - Re-submit ownership document (host only)

    /// (Re)submit a listing's ownership / proof document, re-queuing it for
    /// review (`PATCH /api/local/listings/:id` (Bearer) `{ ownership_doc }`).
    /// `doc` is a `data:image/*;base64,…` URL produced by
    /// `QKAvatarImage.makeDataURL`. The backend flips `approval_status` back to
    /// "pending" and echoes the updated listing.
    @discardableResult
    func resubmitOwnershipDoc(listingID: String, doc: String) async throws -> Listing {
        guard let token else { throw HostError.notSignedIn }

        let encoded = listingID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? listingID
        let url = URL(string: "\(Config.apiBaseURL)/api/local/listings/\(encoded)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["ownership_doc": doc])

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HostError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) {
            return try JSONDecoder().decode(Listing.self, from: data)
        }
        if http.statusCode == 401 { throw HostError.notSignedIn }
        if http.statusCode == 403 {
            throw HostError.forbidden(Self.decodeError(data) ?? "You can only update your own listings.")
        }
        throw HostError.message(Self.decodeError(data) ?? "Couldn't submit the document (\(http.statusCode)).")
    }

    // MARK: - Host reservations

    /// Reservation requests across all of the host's listings.
    func fetchHostBookings() async throws -> [HostBooking] {
        try await get("\(Config.apiBaseURL)/api/local/host/bookings", as: [HostBooking].self)
    }

    /// The host's own listings.
    func fetchHostListings() async throws -> [Listing] {
        try await get("\(Config.apiBaseURL)/api/local/host/listings", as: [Listing].self)
    }

    /// Confirm or reject a pending reservation. `action` is `confirm` or `reject`.
    @discardableResult
    func updateBooking(id: String, action: HostBookingAction) async throws -> HostBooking? {
        guard let token else { throw HostError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/bookings/\(id)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["status": action.rawValue])

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HostError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) {
            // The updated booking is returned, but the caller can refresh anyway.
            return try? JSONDecoder().decode(HostBooking.self, from: data)
        }
        if http.statusCode == 401 { throw HostError.notSignedIn }
        throw HostError.message(Self.decodeError(data) ?? "Couldn't update the request (\(http.statusCode)).")
    }

    // MARK: - Reservation detail

    /// A single reservation's full detail (drives the detail screen + QR).
    func fetchReservation(id: String) async throws -> ReservationDetail {
        try await get("\(Config.apiBaseURL)/api/local/bookings/\(id)", as: ReservationDetail.self)
    }

    // MARK: - Money (host earnings + guest receipts)

    /// The signed-in host's earnings + payout summary (drives the Earnings view).
    /// Maps 403 to `.forbidden` (account isn't a host) and 401 to `.notSignedIn`.
    func fetchHostEarnings() async throws -> HostEarnings {
        try await get("\(Config.apiBaseURL)/api/local/host/earnings", as: HostEarnings.self)
    }

    /// The signed-in guest's paid receipts, itemized (drives the Receipts view).
    func fetchReceipts() async throws -> [GuestReceipt] {
        try await get("\(Config.apiBaseURL)/api/local/receipts", as: [GuestReceipt].self)
    }

    // MARK: - Host analytics (Section 10)

    /// The signed-in host's analytics dashboard (bookings, revenue, rating,
    /// conversion, monthly trend, top listings). Maps 403 to `.forbidden`
    /// (account isn't a host) and 401 to `.notSignedIn`.
    func fetchAnalytics() async throws -> HostAnalytics {
        try await get("\(Config.apiBaseURL)/api/local/host/analytics", as: HostAnalytics.self)
    }

    /// Fetch the multi-currency FX rates (`GET /api/local/currencies`). Public —
    /// no auth. Powers the in-app currency switcher; the caller falls back to the
    /// baked-in `CurrencyRates.fallback` when this throws (offline / non-2xx).
    func fetchCurrencyRates() async throws -> CurrencyRates {
        let url = URL(string: "\(Config.apiBaseURL)/api/local/currencies")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HostError.message("Invalid response from the server.")
        }
        guard (200...299).contains(http.statusCode) else {
            throw HostError.message("Couldn't load currency rates (\(http.statusCode)).")
        }
        return try JSONDecoder().decode(CurrencyRates.self, from: data)
    }

    // MARK: - Booking chat (host ↔ guest)

    /// Fetch the message thread for a booking, oldest-first. Used by `ChatView`
    /// for the initial load and the ~4s poll.
    func fetchMessages(bookingID: String) async throws -> [ChatMessage] {
        try await get("\(Config.apiBaseURL)/api/local/bookings/\(bookingID)/messages", as: [ChatMessage].self)
    }

    /// Send a message in a booking thread. Returns the created message (201).
    @discardableResult
    func sendMessage(bookingID: String, body: String) async throws -> ChatMessage {
        guard let token else { throw HostError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/bookings/\(bookingID)/messages")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["body": body])

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HostError.message("Invalid response from the server.")
        }
        if (200...299).contains(http.statusCode) {
            return try JSONDecoder().decode(ChatMessage.self, from: data)
        }
        if http.statusCode == 401 { throw HostError.notSignedIn }
        throw HostError.message(Self.decodeError(data) ?? "Couldn't send the message (\(http.statusCode)).")
    }

    // MARK: - Helpers

    /// Authenticated GET → decoded `T`. Maps 401 to `.notSignedIn`.
    private func get<T: Decodable>(_ urlString: String, as type: T.Type) async throws -> T {
        guard let token else { throw HostError.notSignedIn }

        let url = URL(string: urlString)!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HostError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw HostError.notSignedIn }
        if http.statusCode == 403 {
            throw HostError.forbidden(Self.decodeError(data) ?? "You don't have access to that.")
        }
        guard (200...299).contains(http.statusCode) else {
            throw HostError.message(Self.decodeError(data) ?? "Request failed (\(http.statusCode)).")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    private static func decodeError(_ data: Data) -> String? {
        struct ErrorBody: Decodable { let error: String }
        return (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
    }
}

/// The PATCH action sent to confirm or reject a reservation.
enum HostBookingAction: String {
    case confirm
    case reject
}

/// Errors surfaced to the host + reservation-detail UI.
enum HostError: LocalizedError {
    case notSignedIn
    case forbidden(String)
    case message(String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn:        return "Sign in to continue"
        case let .forbidden(text): return text
        case let .message(text):   return text
        }
    }
}
