import Foundation

/// One turn in the AI concierge conversation. `role` is `"user"` or
/// `"assistant"`; `content` is the message text. Encoded as the request body's
/// `messages` array and decoded never (the stream returns deltas, not turns).
struct AIMessage: Codable, Equatable {
    let role: String
    var content: String
}

/// Streams the travel-concierge reply from the backend.
///
///   POST {base}/api/local/ai/chat
///   body: { "messages": [ { role, content }, … ] }   (the whole conversation)
///
/// The response is **Server-Sent Events** (`text/event-stream`). We read it line
/// by line with `URLSession.bytes(for:)` and, for each `data:` line:
///   • `{"delta":"…"}`  → hand the text fragment to `onDelta` (append it live)
///   • `{"error":"…"}`  → throw `AIChatError.message(…)`
///   • `[DONE]`         → end of stream, stop
///
/// Auth is optional (public endpoint); we attach the bearer token when present,
/// mirroring `NotificationService`, but a signed-out guest can chat too.
struct AITravelChatService {
    static let shared = AITravelChatService()

    private let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        // Generous request timeout: the model can take a moment before the first
        // token, and the connection then stays open for the whole stream.
        cfg.timeoutIntervalForRequest = 60
        cfg.waitsForConnectivity = true
        return URLSession(configuration: cfg)
    }()

    /// The persisted bearer token, or `nil` when browsing as a guest. Optional
    /// for this endpoint — sending it is fine, omitting it is fine.
    private var token: String? {
        let value = UserDefaults.standard.string(forKey: AuthStore.tokenKey)
        return (value?.isEmpty == false) ? value : nil
    }

    /// Open the stream and feed every text fragment to `onDelta` as it arrives.
    /// Returns once the server sends `[DONE]`. Throws `AIChatError` on a non-2xx
    /// response or an inline `{"error":…}` event. `onDelta` is always invoked on
    /// the main actor so callers can mutate UI state directly.
    func stream(messages: [AIMessage], onDelta: @escaping @MainActor (String) -> Void) async throws {
        guard let url = URL(string: "\(Config.apiBaseURL)/api/local/ai/chat") else {
            throw AIChatError.generic
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try JSONEncoder().encode(RequestBody(messages: messages))

        let (bytes, response) = try await session.bytes(for: request)

        guard let http = response as? HTTPURLResponse else {
            throw AIChatError.generic
        }

        // Non-200: the body is JSON `{"error":"…"}` (e.g. 503 when the key isn't
        // configured). Drain the stream into Data and surface a friendly message.
        guard (200...299).contains(http.statusCode) else {
            var data = Data()
            for try await byte in bytes { data.append(byte) }
            if http.statusCode == 503 {
                throw AIChatError.unavailable
            }
            if let serverMessage = Self.decodeError(data) {
                throw AIChatError.message(serverMessage)
            }
            throw AIChatError.generic
        }

        for try await line in bytes.lines {
            // SSE frames are `data: <payload>`; blank lines separate events.
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            guard trimmed.hasPrefix("data:") else { continue }
            let payload = String(trimmed.dropFirst("data:".count))
                .trimmingCharacters(in: .whitespaces)
            if payload.isEmpty { continue }
            if payload == "[DONE]" { return }

            guard let json = payload.data(using: .utf8) else { continue }
            let event = try? JSONDecoder().decode(StreamEvent.self, from: json)
            if let error = event?.error, !error.isEmpty {
                throw AIChatError.message(error)
            }
            if let delta = event?.delta, !delta.isEmpty {
                await onDelta(delta)
            }
        }
    }

    // MARK: - Wire types

    private struct RequestBody: Encodable {
        let messages: [AIMessage]
    }

    /// A single SSE data frame. Both fields are optional so one decoder handles
    /// `{"delta":…}` and `{"error":…}` frames alike.
    private struct StreamEvent: Decodable {
        let delta: String?
        let error: String?
    }

    private static func decodeError(_ data: Data) -> String? {
        struct ErrorBody: Decodable { let error: String }
        return (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
    }
}

/// Errors surfaced to the concierge UI.
///
/// The enum is deliberately free of `L.t` lookups (which are `@MainActor`-bound)
/// so the service stays nonisolated, mirroring `NotificationService` /
/// `BookingService`. The view model — already on the main actor — turns each
/// case into a localized string via `localizedMessage`.
enum AIChatError: LocalizedError {
    /// A generic transport/parse failure.
    case generic
    /// The AI service isn't configured yet (HTTP 503) — show a soft note.
    case unavailable
    /// A specific, already-human-readable message from the server.
    case message(String)

    /// Localized text for the inline error bubble. Resolved on the main actor.
    @MainActor var localizedMessage: String {
        switch self {
        case .generic: return L.t("ai.error.generic")
        case .unavailable: return L.t("ai.error.unavailable")
        case let .message(text): return text
        }
    }
}
