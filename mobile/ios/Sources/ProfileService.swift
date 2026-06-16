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
    /// Country the user is from — stored as the English display name (matching
    /// the web). `nil` when never set.
    var country: String?
    /// Avatar source — either an `http(s)://` URL or an inline `data:image/jpeg;base64,…`
    /// data URL produced by the avatar picker. `nil` falls back to initials.
    var avatarURL: String?
    /// Identity-verification state from `verification_status`:
    /// "unverified" | "pending" | "verified" | "rejected". Defaults to
    /// "unverified" when the backend omits it — drives the "Verify your
    /// identity" card on the profile.
    var verificationStatus: String

    enum CodingKeys: String, CodingKey {
        case age, phone, email, bio, country
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
        country = try c.decodeIfPresent(String.self, forKey: .country)
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
        country: String? = nil,
        avatarURL: String?,
        verificationStatus: String = "unverified"
    ) {
        self.fullName = fullName
        self.age = age
        self.idDocument = idDocument
        self.phone = phone
        self.email = email
        self.bio = bio
        self.country = country
        self.avatarURL = avatarURL
        self.verificationStatus = verificationStatus
    }
}

/// Networking for the signed-in user's profile against the local Next.js API.
/// Mirrors `BookingService`/`HostService`: pure URLSession + Codable, reading the
/// bearer token straight from `UserDefaults` under `AuthStore.tokenKey`.
///
///   GET   {base}/api/local/profile  (Bearer qk_token) → Profile
///   PATCH {base}/api/local/profile  (Bearer qk_token) { full_name, age, id_document, phone, bio, country, avatar_url } → Profile
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

    /// Save the editable fields. Sends `{ full_name, age, id_document, phone,
    /// bio, avatar_url }`; `age`/`bio`/`avatar_url` are sent as JSON null when
    /// cleared. Returns the updated profile when the backend echoes one,
    /// otherwise the values just sent.
    @discardableResult
    func updateProfile(
        fullName: String,
        age: Int?,
        idDocument: String,
        phone: String,
        bio: String,
        country: String,
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
            "id_document": idDocument,
            "phone": phone,
        ]
        // Send the age as a number when set, explicit null when cleared.
        body["age"] = age ?? NSNull()
        // Send the bio as text, or explicit null once emptied.
        body["bio"] = bio.isEmpty ? NSNull() : bio
        // Send the country (English display name) as text, or explicit null when cleared.
        body["country"] = country.isEmpty ? NSNull() : country
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
        return Profile(
            fullName: fullName,
            age: age,
            idDocument: idDocument,
            phone: phone,
            email: nil,
            bio: bio.isEmpty ? nil : bio,
            country: country.isEmpty ? nil : country,
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
