import Foundation

/// Networking for the Trust & Safety features (Section 6) against the local
/// Next.js API. Mirrors `BookingService`/`ProfileService`: pure URLSession +
/// Codable, reading the bearer token straight from `UserDefaults` under
/// `AuthStore.tokenKey`.
///
///   GET  {base}/api/local/verification        (Bearer) → { status, verified_at }
///   POST {base}/api/local/verification        (Bearer) { doc } → { status, … }
///   POST {base}/api/local/reports             (Bearer) { target_type, target_id, reason, details? }
///   GET  {base}/api/local/users/:id           (public)  → PublicProfile
struct TrustService {
    static let shared = TrustService()

    private let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 20   // ID uploads carry a base64 image
        cfg.waitsForConnectivity = true
        return URLSession(configuration: cfg)
    }()

    /// The persisted bearer token, or `nil` when browsing as a guest.
    var token: String? {
        let value = UserDefaults.standard.string(forKey: AuthStore.tokenKey)
        return (value?.isEmpty == false) ? value : nil
    }

    // MARK: - Identity verification

    /// Read the signed-in user's verification state
    /// (`GET /api/local/verification` (Bearer) → `{ status, verified_at }`).
    /// `status` ∈ "unverified" | "pending" | "verified" | "rejected".
    func fetchVerification() async throws -> VerificationState {
        guard let token else { throw TrustError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/verification")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw TrustError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw TrustError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw TrustError.message(Self.decodeError(data) ?? "Couldn't load your verification status (\(http.statusCode)).")
        }
        return try JSONDecoder().decode(VerificationState.self, from: data)
    }

    /// Submit an ID image for review
    /// (`POST /api/local/verification` (Bearer) `{ doc }`). `doc` is a
    /// `data:image/*;base64,…` URL produced by `QKAvatarImage.makeDataURL`.
    /// The server flips the status to "pending" and echoes the new state.
    @discardableResult
    func submitVerification(doc: String) async throws -> VerificationState {
        guard let token else { throw TrustError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/verification")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["doc": doc])

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw TrustError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw TrustError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw TrustError.message(Self.decodeError(data) ?? "Couldn't submit your ID (\(http.statusCode)).")
        }
        // Prefer the server's echoed state; fall back to "pending" per the contract.
        if let state = try? JSONDecoder().decode(VerificationState.self, from: data) {
            return state
        }
        return VerificationState(status: "pending", verifiedAt: nil)
    }

    // MARK: - Reporting

    /// File a report against a listing / user / review
    /// (`POST /api/local/reports` (Bearer) `{ target_type, target_id, reason,
    /// details? }`). Requires sign-in. `targetType` ∈ "listing" | "user" |
    /// "review". `details` is omitted when blank.
    func submitReport(
        targetType: ReportTargetType,
        targetID: String,
        reason: String,
        details: String?
    ) async throws {
        guard let token else { throw TrustError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/reports")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        var body: [String: Any] = [
            "target_type": targetType.rawValue,
            "target_id": targetID,
            "reason": reason,
        ]
        if let details = details?.trimmingCharacters(in: .whitespacesAndNewlines), !details.isEmpty {
            body["details"] = details
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw TrustError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw TrustError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw TrustError.message(Self.decodeError(data) ?? "Couldn't submit your report (\(http.statusCode)).")
        }
    }

    // MARK: - Public profile + badges

    /// Fetch another user's public, privacy-safe profile + trust badges
    /// (`GET /api/local/users/:id`). Public — no auth required. Used to render
    /// the host's badge set on listing detail.
    func fetchPublicProfile(userID: String) async throws -> PublicProfile {
        let encoded = userID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? userID
        let url = URL(string: "\(Config.apiBaseURL)/api/local/users/\(encoded)")!

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw TrustError.message("Invalid response from the server.")
        }
        guard (200...299).contains(http.statusCode) else {
            throw TrustError.message(Self.decodeError(data) ?? "Couldn't load that profile (\(http.statusCode)).")
        }
        return try JSONDecoder().decode(PublicProfile.self, from: data)
    }

    // MARK: - Helpers

    private static func decodeError(_ data: Data) -> String? {
        struct ErrorBody: Decodable { let error: String }
        return (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
    }
}

/// The verification payload returned by `GET`/`POST /api/local/verification`:
/// `{ status, verified_at }`. `verifiedAt` is set only once `status` is
/// "verified".
struct VerificationState: Decodable, Equatable {
    let statusRaw: String
    let verifiedAt: String?

    enum CodingKeys: String, CodingKey {
        case statusRaw = "status"
        case verifiedAt = "verified_at"
    }

    init(status: String, verifiedAt: String?) {
        self.statusRaw = status
        self.verifiedAt = verifiedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        statusRaw = (try c.decodeIfPresent(String.self, forKey: .statusRaw))
            .flatMap { $0.isEmpty ? nil : $0 } ?? "unverified"
        verifiedAt = try c.decodeIfPresent(String.self, forKey: .verifiedAt)
    }

    /// Strongly-typed status.
    var status: VerificationStatus { VerificationStatus(raw: statusRaw) }
}

/// The three kinds of thing a user can report. Maps 1:1 to the backend's
/// `target_type` string.
enum ReportTargetType: String {
    case listing
    case user
    case review
}

/// Errors surfaced to the verification / report UI.
enum TrustError: LocalizedError {
    case notSignedIn
    case message(String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn:       return "Sign in to continue"
        case let .message(text): return text
        }
    }
}
