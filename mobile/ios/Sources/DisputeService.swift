import Foundation

/// Guest disputes — raising an issue about a stay, and following it.
///
///   GET  {base}/api/local/disputes                → { disputes, categories }
///   GET  {base}/api/local/disputes?id=…           → { dispute, events }
///   POST {base}/api/local/disputes                → 201 { dispute }
///        { bookingId, category, description, photos[] }
///
/// NOT `/bookings/:id/dispute` — that path is the *payment* dispute ("the host
/// rejected my proof and I did pay"), a different thing with its own lifecycle.
///
/// The category list is fetched rather than hardcoded, so adding one server-side
/// doesn't need an app release. `DisputeCategory.fallback` covers a cold start
/// with no network.
enum DisputeService {
    private static var token: String? {
        let value = UserDefaults.standard.string(forKey: AuthStore.tokenKey)
        return (value?.isEmpty == false) ? value : nil
    }

    /// Every dispute this guest has filed, newest first, plus the category list.
    static func fetch() async throws -> (disputes: [Dispute], categories: [DisputeCategory]) {
        struct Envelope: Decodable {
            let disputes: [Dispute]
            let categories: [DisputeCategory]?
        }
        let env = try await get("\(Config.apiBaseURL)/api/local/disputes", as: Envelope.self)
        return (env.disputes, env.categories ?? DisputeCategory.fallback)
    }

    /// One dispute with its full history.
    static func detail(id: String) async throws -> (dispute: Dispute, events: [DisputeEvent]) {
        struct Envelope: Decodable { let dispute: Dispute; let events: [DisputeEvent] }
        var components = URLComponents(string: "\(Config.apiBaseURL)/api/local/disputes")!
        components.queryItems = [URLQueryItem(name: "id", value: id)]
        let env = try await get(components.url!.absoluteString, as: Envelope.self)
        return (env.dispute, env.events)
    }

    /// Which bookings can still be disputed, and which already have one. Resolved
    /// server-side so the eligibility rule lives in one place.
    static func eligibility() async throws -> (eligible: Set<String>, existing: [String: String]) {
        struct Envelope: Decodable { let eligible: [String]; let existing: [String: String] }
        let env = try await get("\(Config.apiBaseURL)/api/local/disputes?eligible=1", as: Envelope.self)
        return (Set(env.eligible), env.existing)
    }

    /// File a dispute. A 400 carries the server's own wording ("please add a bit
    /// more detail"), which is written to be shown to the guest verbatim.
    @discardableResult
    static func file(
        bookingID: String,
        category: String,
        description: String,
        photos: [String]
    ) async throws -> Dispute {
        guard let token else { throw HostError.notSignedIn }
        let url = URL(string: "\(Config.apiBaseURL)/api/local/disputes")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "bookingId": bookingID,
            "category": category,
            "description": description,
            "photos": photos,
        ])
        // Photos can be several MB of base64, so allow more than the default.
        request.timeoutInterval = 60

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HostError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw HostError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw HostError.message(decodeError(data) ?? "Could not send this. Please try again.")
        }
        struct Envelope: Decodable { let dispute: Dispute }
        return try JSONDecoder().decode(Envelope.self, from: data).dispute
    }

    // MARK: - Helpers

    private static func get<T: Decodable>(_ urlString: String, as type: T.Type) async throws -> T {
        guard let token else { throw HostError.notSignedIn }
        var request = URLRequest(url: URL(string: urlString)!)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HostError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw HostError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw HostError.message(decodeError(data) ?? "Request failed (\(http.statusCode)).")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    private static func decodeError(_ data: Data) -> String? {
        struct Body: Decodable { let error: String }
        return (try? JSONDecoder().decode(Body.self, from: data))?.error
    }
}

// MARK: - Models

/// One category a guest can file under. Server-supplied so the list can grow
/// without an app release.
struct DisputeCategory: Decodable, Hashable, Identifiable {
    let key: String
    let label: String
    var id: String { key }

    /// Used only when the list can't be fetched — mirrors DISPUTE_CATEGORIES in
    /// the server's disputes-core.
    static let fallback: [DisputeCategory] = [
        .init(key: "not_as_described", label: "Listing not as described"),
        .init(key: "cleanliness", label: "Cleanliness"),
        .init(key: "checkin", label: "Check-in or access problem"),
        .init(key: "host_unresponsive", label: "Host unresponsive"),
        .init(key: "safety", label: "Safety or security concern"),
        .init(key: "overcharged", label: "Overcharged / refund request"),
        .init(key: "damage", label: "Damage or missing items"),
        .init(key: "other", label: "Other"),
    ]
}

struct Dispute: Decodable, Hashable, Identifiable {
    let id: String
    let bookingID: String
    let category: String
    let description: String
    let photos: [String]
    let status: String
    let resolution: String?
    let createdAt: String
    let listingTitle: String?
    let reservationCode: String?

    enum CodingKeys: String, CodingKey {
        case id
        case bookingID = "booking_id"
        case category, description, photos, status, resolution
        case createdAt = "created_at"
        case listingTitle = "listing_title"
        case reservationCode = "reservation_code"
    }

    /// "QK-1A2B3C" — the same short handle /ops shows, derived from the id so the
    /// two can never disagree.
    var reference: String {
        let hex = id.replacingOccurrences(of: "-", with: "").prefix(6).uppercased()
        return hex.isEmpty ? "—" : "QK-\(hex)"
    }

    var statusLabel: String {
        switch status {
        case "open": return "Open"
        case "in_review": return "In review"
        case "resolved": return "Resolved"
        case "closed": return "Closed"
        default: return status.capitalized
        }
    }

    var categoryLabel: String {
        DisputeCategory.fallback.first { $0.key == category }?.label ?? "Other"
    }
}

struct DisputeEvent: Decodable, Hashable, Identifiable {
    let id: String
    let fromStatus: String?
    let toStatus: String
    let note: String?
    let actorName: String?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case fromStatus = "from_status"
        case toStatus = "to_status"
        case note
        case actorName = "actor_name"
        case createdAt = "created_at"
    }

    /// "Dispute filed" for the opening row, "Open → In review" thereafter.
    var summary: String {
        func label(_ s: String) -> String {
            switch s {
            case "open": return "Open"
            case "in_review": return "In review"
            case "resolved": return "Resolved"
            case "closed": return "Closed"
            default: return s.capitalized
            }
        }
        guard let from = fromStatus else { return "Dispute filed" }
        return "\(label(from)) → \(label(toStatus))"
    }
}
