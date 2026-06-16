import Foundation

/// Networking for the in-app notifications feed against the local Next.js API
/// (no Supabase). Mirrors `BookingService` / `ServiceService`: pure URLSession +
/// Codable, reading the bearer token straight from `UserDefaults` under
/// `AuthStore.tokenKey` ("qk_token") so it stays decoupled from the auth store.
///
///   GET   {base}/api/local/notifications          → { notifications: [AppNotification], unreadCount: Int }
///   PATCH {base}/api/local/notifications/:id       → { ok: true }  (mark one read)
///   POST  {base}/api/local/notifications/read-all  → { ok: true }  (mark all read)
struct NotificationService {
    static let shared = NotificationService()

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

    /// Shape of the list response: `{ notifications, unreadCount }`.
    private struct Feed: Decodable {
        let notifications: [AppNotification]
        let unreadCount: Int
    }

    // MARK: - List

    /// The signed-in user's notifications plus the unread count. Throws
    /// `NotificationError.notSignedIn` when there is no token or the server
    /// returns 401.
    func fetchNotifications() async throws -> (items: [AppNotification], unread: Int) {
        guard let token else { throw NotificationError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/notifications")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw NotificationError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw NotificationError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw NotificationError.message(Self.decodeError(data) ?? "Failed to load notifications (\(http.statusCode)).")
        }
        let feed = try JSONDecoder().decode(Feed.self, from: data)
        return (feed.notifications, feed.unreadCount)
    }

    // MARK: - Mutations

    /// Mark a single notification read. Ignores the `{ ok: true }` body.
    func markRead(id: String) async throws {
        guard let token else { throw NotificationError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/notifications/\(id)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw NotificationError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw NotificationError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw NotificationError.message(Self.decodeError(data) ?? "Couldn't update the notification (\(http.statusCode)).")
        }
    }

    // MARK: - Device token registration (push)

    /// Register this device's push token with the backend so the server can
    /// deliver FCM/APNs pushes to the signed-in user.
    ///
    ///   PATCH {base}/api/local/notifications/register { fcm_token, platform }
    ///
    /// Best-effort and silent: requires a bearer token (no-op when signed out)
    /// and swallows transport/HTTP errors — push registration must never block
    /// or surface an error in the UI.
    func registerDeviceToken(_ deviceToken: String, platform: String = "ios") async {
        guard let token, !deviceToken.isEmpty else { return }

        guard let url = URL(string: "\(Config.apiBaseURL)/api/local/notifications/register") else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        // Send both the canonical `fcm_token` (the DB column) plus a couple of
        // common aliases so the backend accepts the token regardless of the
        // exact field name it reads.
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "fcm_token": deviceToken,
            "token": deviceToken,
            "platform": platform,
        ])

        _ = try? await session.data(for: request)
    }

    /// Mark every notification read. Ignores the `{ ok: true }` body.
    func markAllRead() async throws {
        guard let token else { throw NotificationError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/notifications/read-all")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw NotificationError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw NotificationError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw NotificationError.message(Self.decodeError(data) ?? "Couldn't update notifications (\(http.statusCode)).")
        }
    }

    // MARK: - Helpers

    private static func decodeError(_ data: Data) -> String? {
        struct ErrorBody: Decodable { let error: String }
        return (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
    }
}

/// Errors surfaced to the notifications UI.
enum NotificationError: LocalizedError {
    case notSignedIn
    case message(String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn: return "Sign in to see notifications"
        case let .message(text): return text
        }
    }
}
