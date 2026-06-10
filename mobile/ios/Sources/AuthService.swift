import Foundation
import SwiftUI

/// The authenticated user returned by the local Next.js auth API.
struct AuthUser: Codable, Equatable {
    let id: String
    let email: String
    let fullName: String?
    let provider: String?
    let avatarURL: String?

    enum CodingKeys: String, CodingKey {
        case id, email, provider
        case fullName = "full_name"
        case avatarURL = "avatar_url"
    }
}

/// Shape of a successful auth response: `{ token, user }`.
struct AuthSuccess: Decodable {
    let token: String
    let user: AuthUser
}

/// Shape of an error response: `{ error }`.
private struct AuthErrorBody: Decodable {
    let error: String
}

/// Holds the signed-in session and talks to the local auth endpoints.
///
/// Persists the bearer token in `UserDefaults` under `qk_token` and restores
/// the session on launch. No Supabase, no third-party SDKs — pure URLSession.
@MainActor
final class AuthStore: ObservableObject {
    @Published var isAuthenticated = false
    @Published var user: AuthUser?
    @Published var errorMessage: String?
    @Published var isLoading = false

    static let tokenKey = "qk_token"
    private static let userKey = "qk_user"

    private let defaults: UserDefaults
    private let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 15
        cfg.waitsForConnectivity = true
        return URLSession(configuration: cfg)
    }()

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        restoreSession()
    }

    // MARK: - Session restore / persistence

    private func restoreSession() {
        guard let token = defaults.string(forKey: Self.tokenKey), !token.isEmpty else {
            return
        }
        isAuthenticated = true
        if let data = defaults.data(forKey: Self.userKey),
           let saved = try? JSONDecoder().decode(AuthUser.self, from: data) {
            user = saved
        }
    }

    private func persist(token: String, user: AuthUser) {
        defaults.set(token, forKey: Self.tokenKey)
        if let data = try? JSONEncoder().encode(user) {
            defaults.set(data, forKey: Self.userKey)
        }
        self.user = user
        self.isAuthenticated = true
    }

    // MARK: - Public actions

    func login(email: String, password: String) async {
        await perform(path: "/api/auth/login", body: [
            "email": email,
            "password": password,
        ])
    }

    func signup(name: String, email: String, password: String) async {
        await perform(path: "/api/auth/signup", body: [
            "email": email,
            "password": password,
            "full_name": name,
        ])
    }

    /// Persist a `{token, user}` obtained outside the email flow (e.g. the
    /// native Apple / Google sign-in flows in `AuthView`). Mirrors the email
    /// path so the session restores on next launch.
    func adopt(token: String, user: AuthUser) {
        errorMessage = nil
        persist(token: token, user: user)
    }

    /// Surface an error from a view-driven social flow.
    func setError(_ message: String?) {
        errorMessage = message
    }

    /// POST a JSON body to a social endpoint and, on success, adopt the
    /// returned session. Returns `true` on success. Used by `AuthView`'s
    /// Apple / Google handlers. Decodes `{ error }` on failure.
    @discardableResult
    func exchangeSocial(path: String, body: [String: String]) async -> Bool {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        guard let url = URL(string: Config.apiBaseURL + path) else {
            errorMessage = "Invalid server URL."
            return false
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                errorMessage = "Invalid response from the server."
                return false
            }
            if (200...299).contains(http.statusCode) {
                let result = try JSONDecoder().decode(AuthSuccess.self, from: data)
                persist(token: result.token, user: result.user)
                return true
            }
            if let decoded = try? JSONDecoder().decode(AuthErrorBody.self, from: data) {
                errorMessage = decoded.error
            } else {
                errorMessage = "Something went wrong (\(http.statusCode)). Please try again."
            }
            return false
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func logout() {
        defaults.removeObject(forKey: Self.tokenKey)
        defaults.removeObject(forKey: Self.userKey)
        user = nil
        errorMessage = nil
        isAuthenticated = false
    }

    // MARK: - Networking

    private func perform(path: String, body: [String: String]) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        guard let url = URL(string: Config.apiBaseURL + path) else {
            errorMessage = "Invalid server URL."
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                errorMessage = "Invalid response from the server."
                return
            }

            if (200...299).contains(http.statusCode) {
                let result = try JSONDecoder().decode(AuthSuccess.self, from: data)
                persist(token: result.token, user: result.user)
            } else {
                // Try to decode { error }, otherwise fall back to a generic message.
                if let decoded = try? JSONDecoder().decode(AuthErrorBody.self, from: data) {
                    errorMessage = decoded.error
                } else {
                    errorMessage = "Something went wrong (\(http.statusCode)). Please try again."
                }
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
