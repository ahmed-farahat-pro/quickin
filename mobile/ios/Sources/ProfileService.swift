import Foundation

/// The signed-in user's editable profile, returned by `GET /api/local/profile`
/// and updated via `PATCH /api/local/profile`. All fields are optional so the
/// screen renders even when the backend has only some of them filled in.
struct Profile: Codable, Equatable {
    var fullName: String?
    var age: Int?
    var idDocument: String?
    var phone: String?
    var email: String?
    /// Free-text "about me" blurb shown under the name on the profile screen.
    var bio: String?
    /// Avatar source — either an `http(s)://` URL or an inline `data:image/jpeg;base64,…`
    /// data URL produced by the avatar picker. `nil` falls back to initials.
    var avatarURL: String?
    /// Identity-verification state from `verification_status`:
    /// "unverified" | "pending" | "verified" | "rejected". Defaults to
    /// "unverified" when the backend omits it — drives the "Verify your
    /// identity" card on the profile.
    var verificationStatus: String

    enum CodingKeys: String, CodingKey {
        case age, phone, email, bio
        case fullName = "full_name"
        case idDocument = "id_document"
        case avatarURL = "avatar_url"
        case verificationStatus = "verification_status"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        fullName = try c.decodeIfPresent(String.self, forKey: .fullName)
        age = try c.decodeIfPresent(Int.self, forKey: .age)
        idDocument = try c.decodeIfPresent(String.self, forKey: .idDocument)
        phone = try c.decodeIfPresent(String.self, forKey: .phone)
        email = try c.decodeIfPresent(String.self, forKey: .email)
        bio = try c.decodeIfPresent(String.self, forKey: .bio)
        avatarURL = try c.decodeIfPresent(String.self, forKey: .avatarURL)
        verificationStatus = (try c.decodeIfPresent(String.self, forKey: .verificationStatus))
            .flatMap { $0.isEmpty ? nil : $0 } ?? "unverified"
    }

    /// Memberwise initializer (kept because the custom `init(from:)` above
    /// suppresses the synthesized one). Used by `updateProfile`'s fallback echo.
    init(
        fullName: String?,
        age: Int?,
        idDocument: String?,
        phone: String?,
        email: String?,
        bio: String?,
        avatarURL: String?,
        verificationStatus: String = "unverified"
    ) {
        self.fullName = fullName
        self.age = age
        self.idDocument = idDocument
        self.phone = phone
        self.email = email
        self.bio = bio
        self.avatarURL = avatarURL
        self.verificationStatus = verificationStatus
    }
}

/// Networking for the signed-in user's profile against the local Next.js API.
/// Mirrors `BookingService`/`HostService`: pure URLSession + Codable, reading the
/// bearer token straight from `UserDefaults` under `AuthStore.tokenKey`.
///
///   GET   {base}/api/local/profile  (Bearer qk_token) → Profile
///   PATCH {base}/api/local/profile  (Bearer qk_token) { full_name, age, id_document, phone, bio, avatar_url } → Profile
struct ProfileService {
    static let shared = ProfileService()

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

    // MARK: - Read

    /// Load the signed-in user's profile.
    func fetchProfile() async throws -> Profile {
        guard let token else { throw ProfileError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/profile")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw ProfileError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw ProfileError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw ProfileError.message(Self.decodeError(data) ?? "Couldn't load your profile (\(http.statusCode)).")
        }
        return try JSONDecoder().decode(Profile.self, from: data)
    }

    // MARK: - Update

    /// Save the editable fields. Sends `{ full_name, age, phone, bio, avatar_url }`;
    /// `age`/`bio`/`avatar_url` are sent as JSON null when cleared. Returns the
    /// updated profile when the backend echoes one, otherwise the values just sent.
    ///
    /// `id_document` is deliberately NOT sent. It is identity, and the endpoint now
    /// refuses any value that differs from what is stored — changing it goes through
    /// `requestIDChange` and an operator's approval. Sending the unchanged value would
    /// be accepted, but there is no reason to put a person's ID number on the wire on
    /// every bio edit.
    @discardableResult
    func updateProfile(
        fullName: String,
        age: Int?,
        phone: String,
        bio: String,
        avatarURL: String?
    ) async throws -> Profile {
        guard let token else { throw ProfileError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/profile")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        var body: [String: Any] = [
            "full_name": fullName,
            "phone": phone,
        ]
        // Send the age as a number when set, explicit null when cleared.
        body["age"] = age ?? NSNull()
        // Send the bio as text, or explicit null once emptied.
        body["bio"] = bio.isEmpty ? NSNull() : bio
        // Send the avatar (http URL or data: URL), or explicit null when removed.
        body["avatar_url"] = avatarURL ?? NSNull()
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw ProfileError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw ProfileError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw ProfileError.message(Self.decodeError(data) ?? "Couldn't save your profile (\(http.statusCode)).")
        }
        // Prefer the server's echo; fall back to the submitted values.
        if let updated = try? JSONDecoder().decode(Profile.self, from: data) {
            return updated
        }
        // The echo is what carries id_document back; without one there is nothing
        // truthful to put here, so it stays nil rather than inventing a value.
        return Profile(
            fullName: fullName,
            age: age,
            idDocument: nil,
            phone: phone,
            email: nil,
            bio: bio.isEmpty ? nil : bio,
            avatarURL: avatarURL,
            verificationStatus: "unverified"
        )
    }

    // MARK: - Change password

    /// Change the signed-in user's password
    /// (`POST /api/local/change-password` (Bearer) `{ current_password,
    /// new_password }` → `{ ok: true }`). Throws `ProfileError.message` carrying
    /// the server `{ error }` on a 400 (e.g. wrong current password).
    func changePassword(currentPassword: String, newPassword: String) async throws {
        guard let token else { throw ProfileError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/change-password")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "current_password": currentPassword,
            "new_password": newPassword,
        ])

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw ProfileError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw ProfileError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw ProfileError.message(Self.decodeError(data) ?? "Couldn't change your password (\(http.statusCode)).")
        }
    }

    // MARK: - Helpers

    private static func decodeError(_ data: Data) -> String? {
        struct ErrorBody: Decodable { let error: String }
        return (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
    }

    // MARK: - ID change requests

    /// The current ID number and the state of any request to change it
    /// (`GET /api/local/profile/id-change` (Bearer)).
    func fetchIDChangeState() async throws -> IDChangeState {
        guard let token else { throw ProfileError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/profile/id-change")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw ProfileError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw ProfileError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw ProfileError.message(Self.decodeError(data) ?? "Couldn't load your ID request (\(http.statusCode)).")
        }
        return try JSONDecoder().decode(IDChangeState.self, from: data)
    }

    /// Ask for the ID number on the profile to be changed
    /// (`POST /api/local/profile/id-change` (Bearer)
    /// `{ requested_value, doc_type, front, back?, reason? }`).
    ///
    /// The front image is required by the server: without a document the reviewer has
    /// nothing to check the typed number against. Resubmitting replaces a request that
    /// is still waiting rather than queueing a second one.
    @discardableResult
    func requestIDChange(
        requestedValue: String,
        docType: String,
        front: String,
        back: String?,
        reason: String
    ) async throws -> IDChangeState {
        guard let token else { throw ProfileError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/profile/id-change")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        var body: [String: Any] = [
            "requested_value": requestedValue,
            "doc_type": docType,
            "front": front,
        ]
        if let back, !back.isEmpty { body["back"] = back }
        let trimmedReason = reason.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedReason.isEmpty { body["reason"] = trimmedReason }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw ProfileError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw ProfileError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            // A 400 here carries the core's own wording ("A national ID number is 14
            // digits"), which is exactly what the user needs to see.
            throw ProfileError.message(Self.decodeError(data) ?? "Couldn't send your request (\(http.statusCode)).")
        }
        return try JSONDecoder().decode(IDChangeState.self, from: data)
    }

    /// Withdraw a request that is still awaiting review
    /// (`DELETE /api/local/profile/id-change` (Bearer)).
    @discardableResult
    func cancelIDChangeRequest() async throws -> IDChangeState {
        guard let token else { throw ProfileError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/profile/id-change")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw ProfileError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw ProfileError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw ProfileError.message(Self.decodeError(data) ?? "Couldn't withdraw your request (\(http.statusCode)).")
        }
        return try JSONDecoder().decode(IDChangeState.self, from: data)
    }
}

// MARK: - ID change models

/// Where a request to change the profile's ID number has got to.
enum IDChangeStatus: String, Codable {
    case pending, approved, rejected
}

/// One request to change the ID number, as the server reports it back.
struct IDChangeRequest: Codable, Equatable {
    var id: String
    var status: IDChangeStatus
    var requestedValue: String
    var currentValue: String?
    var docType: String
    var reason: String?
    /// The operator's note. On a rejection this is the reason to show the user.
    var notes: String?
    var submittedAt: String?
    var reviewedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, status, reason, notes
        case requestedValue = "requested_value"
        case currentValue = "current_value"
        case docType = "doc_type"
        case submittedAt = "submitted_at"
        case reviewedAt = "reviewed_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? ""
        // An unknown status is treated as pending: it is the state that shows the
        // safest thing (waiting, action hidden) rather than offering a resubmit that
        // the server would refuse. Decoded via the raw string so a value this build
        // does not know about degrades instead of failing the whole response.
        let rawStatus = try c.decodeIfPresent(String.self, forKey: .status)
        status = rawStatus.flatMap(IDChangeStatus.init(rawValue:)) ?? .pending
        requestedValue = try c.decodeIfPresent(String.self, forKey: .requestedValue) ?? ""
        currentValue = try c.decodeIfPresent(String.self, forKey: .currentValue)
        docType = try c.decodeIfPresent(String.self, forKey: .docType) ?? "national_id"
        reason = try c.decodeIfPresent(String.self, forKey: .reason)
        notes = try c.decodeIfPresent(String.self, forKey: .notes)
        submittedAt = try c.decodeIfPresent(String.self, forKey: .submittedAt)
        reviewedAt = try c.decodeIfPresent(String.self, forKey: .reviewedAt)
    }
}

/// The ID number on the profile plus whatever became of the latest request for it.
struct IDChangeState: Codable, Equatable {
    /// The value on the profile right now — the only one that counts.
    var current: String?
    var request: IDChangeRequest?
    /// False only while a request is waiting; the screen hides the action on false.
    var canRequest: Bool

    enum CodingKeys: String, CodingKey {
        case current, request
        case canRequest = "can_request"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        current = try c.decodeIfPresent(String.self, forKey: .current)
        request = try c.decodeIfPresent(IDChangeRequest.self, forKey: .request)
        canRequest = try c.decodeIfPresent(Bool.self, forKey: .canRequest) ?? true
    }

    init(current: String?, request: IDChangeRequest?, canRequest: Bool) {
        self.current = current
        self.request = request
        self.canRequest = canRequest
    }
}

/// The identity documents a change request may be filed against. Mirrors DOC_TYPES
/// in the backend's host-verification-core.ts, so a request and a verification always
/// mean the same thing by 'passport'.
enum IDDocumentType: String, CaseIterable, Identifiable {
    case nationalID = "national_id"
    case passport
    case residencePermit = "residence_permit"

    var id: String { rawValue }

    var labelKey: String {
        switch self {
        case .nationalID:      return "idChange.docType.nationalId"
        case .passport:        return "idChange.docType.passport"
        case .residencePermit: return "idChange.docType.residencePermit"
        }
    }
}

/// Errors surfaced to the profile-settings UI.
enum ProfileError: LocalizedError {
    case notSignedIn
    case message(String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn:       return "Sign in to edit your profile"
        case let .message(text): return text
        }
    }
}
