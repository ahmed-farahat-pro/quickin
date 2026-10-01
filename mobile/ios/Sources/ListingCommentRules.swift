import Foundation

/// The pure rules behind a listing's public "Questions & comments" — the
/// feature that replaced host ⇄ guest messaging on 2026-10-02.
///
/// Mirrors `listing-comments-core.ts` on the backend: the same 1000-character
/// cap, the same "first name + last initial" byline, and the same
/// `/explore/<id>#comments` notification link. The server is the authority on
/// every one of these (it re-checks the body and builds the byline itself);
/// the client copies them only so the Post button and counters agree with what
/// the server is about to say.
///
/// Pure: no SwiftUI, no networking, so `Tests/run.sh` compiles it on its own.
enum ListingCommentRules {
    /// Longest comment or host reply, in characters after trimming.
    static let maxLength = 1000

    /// Notification types that point at a listing's comments.
    static let notificationTypes: Set<String> = ["comment", "comment_reply"]

    /// The text that would actually be sent: surrounding whitespace removed.
    static func trimmed(_ raw: String) -> String {
        raw.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Whether the Post / Save button may be enabled. Empty or over-long text
    /// is refused by the server with a 400; disabling the button first spares
    /// the round trip, but the server's wording still wins when it does answer.
    static func canSubmit(_ raw: String) -> Bool {
        let body = trimmed(raw)
        return !body.isEmpty && body.count <= maxLength
    }

    /// Characters left before the cap (negative when over it).
    static func remaining(_ raw: String) -> Int {
        maxLength - trimmed(raw).count
    }

    /// Whether to show the remaining-characters counter — only once the user is
    /// close enough to the cap for it to matter.
    static func showsCounter(_ raw: String) -> Bool {
        remaining(raw) <= 100
    }

    /// The public byline for a comment: first name + last initial ("Sara A."),
    /// or "QuickIn guest" when there is no name. The server already sends
    /// `author_name` in this shape; this is the fallback for a blank one.
    static func authorName(_ fullName: String?) -> String {
        let parts = (fullName ?? "")
            .split(whereSeparator: { $0.isWhitespace })
            .map(String.init)
        guard let first = parts.first else { return "QuickIn guest" }
        guard parts.count > 1, let initial = parts.last?.first else { return first }
        return "\(first) \(String(initial).uppercased())."
    }

    /// Up to two initials for the avatar fallback ("Sara A." → "SA").
    static func initials(_ name: String?) -> String {
        let letters = (name ?? "")
            .split(whereSeparator: { $0.isWhitespace })
            .prefix(2)
            .compactMap { $0.first(where: { $0.isLetter }) }
        let result = String(letters).uppercased()
        return result.isEmpty ? "G" : result
    }

    /// The listing a notification should open, or nil when it should open
    /// nothing in particular.
    ///
    /// A `comment` / `comment_reply` notification carries
    /// `link: "/explore/<listingId>#comments"`. A push only carries the link
    /// (no type), so with `type == nil` the `#comments` fragment is what marks
    /// it. Anything else — including the retired `message` type, whose links
    /// pointed at chat screens that no longer exist — answers nil.
    static func listingID(notificationType type: String?, link: String?) -> String? {
        guard let link = link?.trimmingCharacters(in: .whitespacesAndNewlines), !link.isEmpty else {
            return nil
        }
        let (path, fragment) = split(link)
        if let type {
            guard notificationTypes.contains(type.lowercased()) else { return nil }
        } else {
            guard fragment?.lowercased() == "comments" else { return nil }
        }
        let tokens = path.split(separator: "/").map(String.init)
        // Accept a bare path ("/explore/<id>") or a full URL
        // ("https://host/explore/<id>"): find the keyword, take what follows.
        guard let index = tokens.firstIndex(where: { ["explore", "listings", "listing"].contains($0.lowercased()) }),
              index + 1 < tokens.count else { return nil }
        let id = tokens[index + 1].removingPercentEncoding ?? tokens[index + 1]
        return id.isEmpty ? nil : id
    }

    /// Splits "path?query#fragment" into the path and the fragment (query dropped).
    private static func split(_ link: String) -> (path: String, fragment: String?) {
        var path = link
        var fragment: String?
        if let hash = path.firstIndex(of: "#") {
            fragment = String(path[path.index(after: hash)...])
            path = String(path[..<hash])
        }
        if let question = path.firstIndex(of: "?") {
            path = String(path[..<question])
        }
        return (path, fragment)
    }
}
