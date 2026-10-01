import Foundation

/// Networking for a listing's public "Questions & comments" (the feature that
/// replaced host ⇄ guest messaging). Mirrors `ReviewService`: pure URLSession +
/// Codable, reading the bearer token from `UserDefaults` under
/// `AuthStore.tokenKey` ("qk_token").
///
///   GET    {base}/api/local/listings/:id/comments                 (auth optional)
///          → { comments: [ListingComment], is_host, can_comment }
///   POST   {base}/api/local/listings/:id/comments { body }        → 201 { comment }
///   DELETE {base}/api/local/listings/:id/comments/:cid            → { ok }   (author / admin)
///   PUT    {base}/api/local/listings/:id/comments/:cid/reply { body } → { comment } (host)
///   DELETE {base}/api/local/listings/:id/comments/:cid/reply      → { comment } (host)
///   GET    {base}/api/local/host/comments                         → { comments, unanswered }
///
/// Errors: 401 → `.notSignedIn`; 409 with a policy warning → `.policyWarning`
/// (acknowledge via `PolicyWarningService`, then retry); 429 → `.rateLimited`;
/// any other non-2xx → `.message` carrying the server's `{ error }` verbatim —
/// the contact-details refusal in particular is worded for the user.
struct ListingCommentsService {
    static let shared = ListingCommentsService()

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

    private func commentsURL(_ listingID: String, _ suffix: String = "") -> URL {
        let id = listingID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? listingID
        return URL(string: "\(Config.apiBaseURL)/api/local/listings/\(id)/comments\(suffix)")!
    }

    private func encoded(_ id: String) -> String {
        id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
    }

    // MARK: - Reads

    /// Comments on a listing, newest first. Public: the token is sent when
    /// present so the server can fill `mine`, `is_host` and `can_comment`.
    func fetch(listingID: String) async throws -> ListingCommentsPage {
        let data = try await send("GET", commentsURL(listingID), requiresAuth: false)
        return try JSONDecoder().decode(ListingCommentsPage.self, from: data)
    }

    /// The signed-in host's comments across all their listings (unanswered first).
    func fetchHostComments() async throws -> HostCommentsPage {
        let url = URL(string: "\(Config.apiBaseURL)/api/local/host/comments")!
        let data = try await send("GET", url, requiresAuth: true)
        return try JSONDecoder().decode(HostCommentsPage.self, from: data)
    }

    // MARK: - Writes

    /// Post a top-level comment. Returns the created comment.
    func post(listingID: String, body: String) async throws -> ListingComment {
        let data = try await send("POST", commentsURL(listingID), body: ["body": body], requiresAuth: true)
        return try JSONDecoder().decode(CommentEnvelope.self, from: data).comment
    }

    /// Delete one of your own comments.
    func delete(listingID: String, commentID: String) async throws {
        _ = try await send("DELETE", commentsURL(listingID, "/\(encoded(commentID))"), requiresAuth: true)
    }

    /// Create or replace the host's reply. Returns the comment with the reply filled.
    func reply(listingID: String, commentID: String, body: String) async throws -> ListingComment {
        let data = try await send(
            "PUT", commentsURL(listingID, "/\(encoded(commentID))/reply"),
            body: ["body": body], requiresAuth: true
        )
        return try JSONDecoder().decode(CommentEnvelope.self, from: data).comment
    }

    /// Remove the host's reply. Returns the comment with `reply == nil`.
    func deleteReply(listingID: String, commentID: String) async throws -> ListingComment {
        let data = try await send("DELETE", commentsURL(listingID, "/\(encoded(commentID))/reply"), requiresAuth: true)
        return try JSONDecoder().decode(CommentEnvelope.self, from: data).comment
    }

    // MARK: - Transport

    private struct CommentEnvelope: Decodable { let comment: ListingComment }

    private func send(
        _ method: String,
        _ url: URL,
        body: [String: Any]? = nil,
        requiresAuth: Bool
    ) async throws -> Data {
        let token = self.token
        if requiresAuth && token == nil { throw CommentError.notSignedIn }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw CommentError.message(nil)
        }
        if (200...299).contains(http.statusCode) { return data }
        switch http.statusCode {
        case 401:
            throw CommentError.notSignedIn
        case 409:
            if let w = PolicyWarningBody.decode(data) {
                throw CommentError.policyWarning(id: w.id, text: w.message)
            }
        case 429:
            throw CommentError.rateLimited(Self.decodeError(data))
        default:
            break
        }
        throw CommentError.message(Self.decodeError(data))
    }

    private static func decodeError(_ data: Data) -> String? {
        struct ErrorBody: Decodable { let error: String? }
        let text = (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return (text?.isEmpty == false) ? text : nil
    }
}

/// Errors surfaced to the comments UI. A `nil` server message means the
/// caller should fall back to its own localized copy.
enum CommentError: Error {
    case notSignedIn
    /// A moderator's warning is waiting to be acknowledged before anything
    /// else may be posted. Carries the warning so the UI can show it at once.
    case policyWarning(id: String, text: String)
    case rateLimited(String?)
    case message(String?)
}

// MARK: - Models

/// One public comment on a listing, with the host's single reply (if any).
/// The host "Guest questions" feed adds `listing_title` / `listing_image`.
struct ListingComment: Decodable, Identifiable, Hashable {
    struct Reply: Decodable, Hashable {
        let body: String
        let createdAt: String?

        enum CodingKeys: String, CodingKey {
            case body
            case createdAt = "created_at"
        }
    }

    let id: String
    var listingID: String
    let userID: String
    let authorName: String
    let authorAvatar: String?
    let body: String
    let createdAt: String?
    let mine: Bool
    let reply: Reply?
    var listingTitle: String?
    var listingImage: String?

    enum CodingKeys: String, CodingKey {
        case id, body, mine, reply
        case listingID = "listing_id"
        case userID = "user_id"
        case authorName = "author_name"
        case authorAvatar = "author_avatar"
        case createdAt = "created_at"
        case listingTitle = "listing_title"
        case listingImage = "listing_image"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        listingID = (try? c.decodeIfPresent(String.self, forKey: .listingID)) ?? ""
        userID = (try? c.decodeIfPresent(String.self, forKey: .userID)) ?? ""
        let rawName = try? c.decodeIfPresent(String.self, forKey: .authorName)
        let trimmedName = rawName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        authorName = trimmedName.isEmpty ? ListingCommentRules.authorName(nil) : trimmedName
        authorAvatar = try? c.decodeIfPresent(String.self, forKey: .authorAvatar)
        body = (try? c.decodeIfPresent(String.self, forKey: .body)) ?? ""
        createdAt = try? c.decodeIfPresent(String.self, forKey: .createdAt)
        mine = (try? c.decodeIfPresent(Bool.self, forKey: .mine)) ?? false
        reply = try? c.decodeIfPresent(Reply.self, forKey: .reply)
        listingTitle = try? c.decodeIfPresent(String.self, forKey: .listingTitle)
        listingImage = try? c.decodeIfPresent(String.self, forKey: .listingImage)
    }
}

/// `GET /listings/:id/comments`.
struct ListingCommentsPage: Decodable {
    let comments: [ListingComment]
    let isHost: Bool
    let canComment: Bool

    enum CodingKeys: String, CodingKey {
        case comments
        case isHost = "is_host"
        case canComment = "can_comment"
    }

    init(comments: [ListingComment] = [], isHost: Bool = false, canComment: Bool = false) {
        self.comments = comments
        self.isHost = isHost
        self.canComment = canComment
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        comments = (try? c.decodeIfPresent([ListingComment].self, forKey: .comments)) ?? []
        isHost = (try? c.decodeIfPresent(Bool.self, forKey: .isHost)) ?? false
        canComment = (try? c.decodeIfPresent(Bool.self, forKey: .canComment)) ?? false
    }
}

/// `GET /host/comments`.
struct HostCommentsPage: Decodable {
    let comments: [ListingComment]
    let unanswered: Int

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        comments = (try? c.decodeIfPresent([ListingComment].self, forKey: .comments)) ?? []
        unanswered = (try? c.decodeIfPresent(Int.self, forKey: .unanswered))
            ?? comments.filter { $0.reply == nil }.count
    }

    enum CodingKeys: String, CodingKey { case comments, unanswered }
}
