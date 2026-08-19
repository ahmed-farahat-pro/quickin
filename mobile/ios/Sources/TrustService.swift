import Foundation

/// Networking for the Trust & Safety features (Section 6) against the local
/// Next.js API. Mirrors `BookingService`/`ProfileService`: pure URLSession +
/// Codable, reading the bearer token straight from `UserDefaults` under
/// `AuthStore.tokenKey`.
///
///   GET  {base}/api/local/verification        (Bearer) → { status, verified_at }
///   POST {base}/api/local/verification        (Bearer) { front, back, selfie?, id_number? } → { status, … }
///   POST {base}/api/local/reports             (Bearer) { target_type, target_id, reason, details? }
///   GET  {base}/api/local/users/:id           (public)  → PublicProfile
struct TrustService {
    static let shared = TrustService()

    private let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 30   // ID uploads carry two base64 images (front + back)
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

    /// Submit FRONT + BACK ID images plus a SELFIE for review
    /// (`POST /api/local/verification` (Bearer) `{ front, back, selfie?, id_number? }`).
    /// `front`/`back`/`selfie` are `data:image/jpeg;base64,…` URLs produced by
    /// `QKAvatarImage.makeDataURL`. An optional `idNumber` is forwarded when set.
    /// The server stores FRONT→image_data, BACK→back_image_data, SELFIE→selfie_image_data,
    /// flips the status to "pending", and echoes the new state. HTTPS only
    /// (normal `apiBaseURL`).
    @discardableResult
    func submitVerification(front: String, back: String, selfie: String? = nil, idNumber: String? = nil) async throws -> VerificationState {
        guard let token else { throw TrustError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/verification")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        var body: [String: Any] = ["front": front, "back": back]
        if let selfie, !selfie.isEmpty {
            body["selfie"] = selfie
        }
        if let idNumber = idNumber?.trimmingCharacters(in: .whitespacesAndNewlines), !idNumber.isEmpty {
            body["id_number"] = idNumber
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

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

    /// Fetch the public reviews about a host's listings
    /// (`GET /api/local/users/:id/reviews`). Public — no auth required. Used by
    /// `HostProfileView` to show what guests said about the host's places. Returns
    /// the reviews newest-first as the backend orders them.
    func fetchUserReviews(userID: String) async throws -> [HostReview] {
        let encoded = userID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? userID
        let url = URL(string: "\(Config.apiBaseURL)/api/local/users/\(encoded)/reviews")!

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw TrustError.message("Invalid response from the server.")
        }
        guard (200...299).contains(http.statusCode) else {
            throw TrustError.message(Self.decodeError(data) ?? "Couldn't load those reviews (\(http.statusCode)).")
        }
        return try JSONDecoder().decode([HostReview].self, from: data)
    }

    // MARK: - Helpers

    private static func decodeError(_ data: Data) -> String? {
        struct ErrorBody: Decodable { let error: String }
        return (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
    }
}

/// The verification payload returned by `GET`/`POST /api/local/verification`:
/// `{ status, verified_at, id_number }`. `verifiedAt` is set only once `status`
/// is "verified"; `idNumber` is the number on the submission we hold, when it
/// carried one, and is what `IdentityRules` fills the host application's
/// National ID field from.
struct VerificationState: Decodable, Equatable {
    let statusRaw: String
    let verifiedAt: String?
    let idNumber: String?

    enum CodingKeys: String, CodingKey {
        case statusRaw = "status"
        case verifiedAt = "verified_at"
        case idNumber = "id_number"
    }

    init(status: String, verifiedAt: String?, idNumber: String? = nil) {
        self.statusRaw = status
        self.verifiedAt = verifiedAt
        self.idNumber = idNumber
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        statusRaw = (try c.decodeIfPresent(String.self, forKey: .statusRaw))
            .flatMap { $0.isEmpty ? nil : $0 } ?? "unverified"
        verifiedAt = try c.decodeIfPresent(String.self, forKey: .verifiedAt)
        // Older builds of the API omit it; an absent number is not an error, it
        // just means there is nothing to prefill from.
        idNumber = (try c.decodeIfPresent(String.self, forKey: .idNumber))
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .flatMap { $0.isEmpty ? nil : $0 }
    }

    /// Strongly-typed status.
    var status: VerificationStatus { VerificationStatus(raw: statusRaw) }
}

/// One identity, verified once from the profile, serving guest and host alike.
///
/// The Swift twin of the backend's `nationalIdForApplication`
/// (`host-verification-core.ts`) and of Android's `IdentityRules.kt`. It decides
/// what the become-a-host form puts in its National ID field: a **verified**
/// submission's number is shown and locked, because an admin approved a document
/// bearing it and an application carrying a different one leaves the reviewer
/// holding two answers with nothing to say which is the person's. Anything else
/// is only a seed — a reapply's own answer first, then the number on a
/// submission still under review — and stays editable, because nothing about it
/// has been approved yet.
///
/// KEEP IN SYNC with `nationalIdForApplication` and `IdentityRules.kt`: the
/// three forms write the same `host_applications.national_id`, and a field one
/// client fills in and another asks for is the redundancy this closes.
enum IdentityRules {
    /// What the National ID field starts with, and whether it may be edited.
    struct NationalIDField: Equatable {
        /// Never nil, so a `TextField` can bind to it directly.
        let value: String
        /// True when the value came from an approved ID: show it, don't ask for it.
        let locked: Bool
    }

    static func nationalID(
        status: VerificationStatus,
        submittedIDNumber: String?,
        previousNationalID: String? = nil
    ) -> NationalIDField {
        let text = { (v: String?) in (v ?? "").trimmingCharacters(in: .whitespacesAndNewlines) }
        let submitted = text(submittedIDNumber)
        if status == .verified, !submitted.isEmpty {
            return NationalIDField(value: submitted, locked: true)
        }
        let previous = text(previousNationalID)
        return NationalIDField(value: previous.isEmpty ? submitted : previous, locked: false)
    }

    /// Must someone with this `status` photograph their ID to apply as a host?
    ///
    /// The Swift twin of `needsIdentityDocuments` in the backend's
    /// `host-verification-core.ts`, which `POST /api/local/host/apply` enforces:
    /// an application with no document behind it gives the reviewer nothing to
    /// read the declared name and national ID against, so the API refuses it.
    /// This is what keeps the form from letting an applicant reach that refusal.
    ///
    /// `.verified` is already approved and `.pending` is already in the queue —
    /// it is decided together with the application — so neither uploads again.
    /// `.rejected` and "no submission" must: a rejection means "these are not
    /// good enough", and refiling the same row would put the same refused photos
    /// back in front of the reviewer. An unknown status parses as `.unverified`,
    /// the safe direction — an upload we did not need costs a photo, a document
    /// we did need costs the applicant a refused request.
    ///
    /// KEEP IN SYNC with `IdentityRules.kt` and the backend rule.
    static func needsIdentityDocuments(status: VerificationStatus) -> Bool {
        status != .verified && status != .pending
    }
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
