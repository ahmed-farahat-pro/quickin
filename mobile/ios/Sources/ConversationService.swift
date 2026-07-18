import Foundation

/// Networking for the pre-booking guest ⇄ host chat (no booking required),
/// against the local Next.js API. Mirrors `HostService`: pure URLSession +
/// Codable, reading the bearer token straight from `UserDefaults` under
/// `AuthStore.tokenKey`, and reusing `HostError` so the chat UI surfaces server
/// messages exactly like the per-booking thread does.
///
///   GET  {base}/api/local/chat                          → { conversations }
///   GET  {base}/api/local/chat?conversationId=…         → { messages }
///   POST {base}/api/local/chat { listingId }            → 201 { conversationId, listingTitle }
///   POST {base}/api/local/chat { conversationId, body } → 201 { message }
///
/// The server redacts phone numbers / emails / links (they come back as
/// "[hidden]") and rejects messaging your own listing with a 400 — both are
/// surfaced inline like the booking chat.
struct ConversationService {
    static let shared = ConversationService()

    private let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 20
        cfg.waitsForConnectivity = true
        return URLSession(configuration: cfg)
    }()

    /// The persisted bearer token, or `nil` when browsing as a guest.
    var token: String? {
        let value = UserDefaults.standard.string(forKey: AuthStore.tokenKey)
        return (value?.isEmpty == false) ? value : nil
    }

    /// Every thread the signed-in user is part of (as guest or host), newest
    /// activity first. Drives the Messages inbox.
    func fetchConversations() async throws -> [ConversationSummary] {
        struct Envelope: Decodable { let conversations: [ConversationSummary] }
        let envelope = try await get("\(Config.apiBaseURL)/api/local/chat", as: Envelope.self)
        return envelope.conversations
    }

    /// Open (or reuse) the thread with a listing's host
    /// (`POST /api/local/chat { listingId }` → 201). A 400 ("You can't message
    /// your own listing", "Listing not found", …) surfaces as `HostError.message`.
    @discardableResult
    func openConversation(listingID: String) async throws -> OpenedConversation {
        try await post(["listingId": listingID], as: OpenedConversation.self)
    }

    /// Fetch a thread's messages, oldest-first. Used by `ConversationChatView`
    /// for the initial load and the ~4s poll.
    func fetchMessages(conversationID: String) async throws -> [ConversationMessage] {
        struct Envelope: Decodable { let messages: [ConversationMessage] }
        var components = URLComponents(string: "\(Config.apiBaseURL)/api/local/chat")!
        components.queryItems = [URLQueryItem(name: "conversationId", value: conversationID)]
        let envelope = try await get(components.url!.absoluteString, as: Envelope.self)
        return envelope.messages
    }

    /// Send a message in a thread (`POST /api/local/chat { conversationId, body }`
    /// → 201). A 400 ("Message is empty", "Conversation not found") surfaces as
    /// `HostError.message`.
    @discardableResult
    func sendMessage(conversationID: String, body: String) async throws -> ConversationMessage {
        struct Envelope: Decodable { let message: ConversationMessage }
        let envelope: Envelope = try await post(
            ["conversationId": conversationID, "body": body],
            as: Envelope.self
        )
        return envelope.message
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
        guard (200...299).contains(http.statusCode) else {
            throw HostError.message(Self.decodeError(data) ?? "Request failed (\(http.statusCode)).")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    /// Authenticated POST {base}/api/local/chat with a JSON object body →
    /// decoded `T`. Maps 401 to `.notSignedIn`; any other non-2xx surfaces the
    /// server's `{ error }` text.
    private func post<T: Decodable>(_ body: [String: Any], as type: T.Type) async throws -> T {
        guard let token else { throw HostError.notSignedIn }

        let url = URL(string: "\(Config.apiBaseURL)/api/local/chat")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw HostError.message("Invalid response from the server.")
        }
        if http.statusCode == 401 { throw HostError.notSignedIn }
        guard (200...299).contains(http.statusCode) else {
            throw HostError.message(Self.decodeError(data) ?? "Couldn't send the message (\(http.statusCode)).")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    private static func decodeError(_ data: Data) -> String? {
        struct ErrorBody: Decodable { let error: String }
        return (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
    }
}

/// The result of opening (or reusing) a thread with a listing's host:
/// `{ conversationId, listingTitle }`.
struct OpenedConversation: Decodable, Hashable {
    let id: String
    let listingTitle: String?

    enum CodingKeys: String, CodingKey {
        case id = "conversationId"
        case listingTitle
    }
}

/// Navigation payload for pushing `ConversationChatView` — either right after a
/// "Message host" tap opens the thread, or from a Messages-inbox row.
struct ConversationTarget: Hashable {
    let id: String
    let listingTitle: String?
    let otherName: String?
}

/// A conversation row in the Messages inbox, returned by `GET /api/local/chat`
/// (newest activity first). `isHost` is true when the signed-in user is the
/// host side of the thread (drives the "Host" badge).
struct ConversationSummary: Decodable, Identifiable, Hashable {
    let id: String
    let listingID: String?
    let listingTitle: String?
    let listingImage: String?
    let otherName: String?
    let lastMessage: String?
    let lastMessageAt: String?
    let isHost: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case listingID = "listing_id"
        case listingTitle = "listing_title"
        case listingImage = "listing_image"
        case otherName = "other_name"
        case lastMessage = "last_message"
        case lastMessageAt = "last_message_at"
        case isHost = "is_host"
    }

    /// "2h ago" style relative time for the row, parsed from the ISO
    /// `last_message_at`. Empty when the timestamp is missing or unparseable.
    var relativeTimeText: String {
        guard let lastMessageAt, let date = Self.parseDate(lastMessageAt) else { return "" }
        return Self.relativeFormatter.localizedString(for: date, relativeTo: Date())
    }

    /// Parse an ISO-8601 timestamp, tolerating both with- and without-fractional
    /// seconds (Postgres `timestamptz` serializes either way).
    private static func parseDate(_ raw: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = withFraction.date(from: raw) { return d }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: raw)
    }

    private static let relativeFormatter: RelativeDateTimeFormatter = {
        let f = RelativeDateTimeFormatter()
        f.locale = .current
        f.unitsStyle = .abbreviated
        return f
    }()
}

/// A single message in a pre-booking conversation thread, returned by
/// `GET /api/local/chat?conversationId=…` (oldest-first) and `POST` on send.
/// The server computes `mine` (sender == the signed-in user) which drives the
/// bubble alignment — no client-side id comparison needed.
struct ConversationMessage: Decodable, Identifiable, Hashable {
    let id: String
    let senderID: String
    let body: String
    let createdAt: String?
    let mine: Bool

    enum CodingKeys: String, CodingKey {
        case id, body, mine
        case senderID = "sender_id"
        case createdAt = "created_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        senderID = try c.decode(String.self, forKey: .senderID)
        body = try c.decode(String.self, forKey: .body)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        mine = try c.decodeIfPresent(Bool.self, forKey: .mine) ?? false
    }

    /// Bridge into the booking-chat bubble UI (`ChatBubble` renders a
    /// `ChatMessage`), so the conversation thread reuses the exact same bubbles.
    var asChatMessage: ChatMessage {
        ChatMessage(id: id, senderID: senderID, senderName: nil, body: body, createdAt: createdAt)
    }
}
