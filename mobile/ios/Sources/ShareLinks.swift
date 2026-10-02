import Foundation

/// Central builder for the web/share URLs and incoming deep-link parsing.
///
/// Shared links always point at the **web domain** (`quickin-frontend.vercel.app`)
/// so they open the website when the app isn't installed, and open the **app**
/// (Universal Link) when it is. We also accept the custom `quickin://` scheme as
/// a no-server-config fallback (e.g. `quickin://explore/<id>`).
///
/// Every share URL is derived from a single `webBase` constant so the domain
/// lives in exactly one place.
enum AppLinks {
    /// The public website base. Universal Links are configured for this host
    /// (`applinks:quickin-frontend.vercel.app`). No trailing slash.
    static let webBase = "https://quickin-frontend.vercel.app"

    /// The custom URL scheme registered in the Info.plist (`CFBundleURLTypes`).
    /// Used for the `quickin://…` fallback that needs no server-side AASA file.
    static let customScheme = "quickin"

    // MARK: - Outgoing share URLs

    /// Web URL for a listing: `https://…/explore/{id}`.
    static func listing(_ id: String) -> URL {
        url(path: "explore", id: id)
    }

    /// Web URL for a service/experience: `https://…/services/{id}`.
    static func service(_ id: String) -> URL {
        url(path: "services", id: id)
    }

    /// Web URL for a reservation: `https://…/reservation/{id}`.
    static func reservation(_ id: String) -> URL {
        url(path: "reservation", id: id)
    }

    /// Build a web URL from `webBase`, a path segment and an id. The id is
    /// percent-encoded so unusual ids never produce a malformed URL. Falls back
    /// to the bare `webBase` if (somehow) the encoded string can't form a URL.
    private static func url(path: String, id: String) -> URL {
        let encoded = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        return URL(string: "\(webBase)/\(path)/\(encoded)") ?? URL(string: webBase)!
    }

    // MARK: - Incoming link parsing

    /// A destination parsed from an incoming Universal Link or custom-scheme URL.
    enum Destination: Equatable {
        case listing(id: String)
        case service(id: String)
        case reservation(id: String)
    }

    /// Parse an incoming URL into a `Destination`, or `nil` for anything we don't
    /// recognise (so the caller can just open the app normally — no crash).
    ///
    /// Handles both shapes:
    ///   • Universal Link  — `https://quickin-frontend.vercel.app/explore/<id>`
    ///   • Custom scheme   — `quickin://explore/<id>` (host = "explore", path = "/<id>")
    ///
    /// The leading keyword may appear as either the first path component (web) or
    /// the URL host (custom scheme), so we normalise both into a token list.
    static func destination(from url: URL) -> Destination? {
        guard let tokens = pathTokens(from: url) else { return nil }
        guard tokens.count >= 2 else { return nil }
        let keyword = tokens[0].lowercased()
        let id = tokens[1].removingPercentEncoding ?? tokens[1]
        guard !id.isEmpty else { return nil }

        switch keyword {
        case "explore", "listings", "listing":
            return .listing(id: id)
        case "services", "service":
            return .service(id: id)
        case "reservation", "reservations":
            return .reservation(id: id)
        default:
            return nil
        }
    }

    /// The ordered, non-empty path tokens of one of OUR links, or `nil` for a
    /// URL that isn't ours (another host, another scheme — e.g. the Google OAuth
    /// redirect handled elsewhere).
    ///
    /// The leading keyword may appear as either the first path component (web)
    /// or the URL host (custom scheme), so both are normalised into one list:
    ///   • `https://quickin-frontend.vercel.app/explore/<id>` → ["explore", "<id>"]
    ///   • `quickin://explore/<id>`                            → ["explore", "<id>"]
    ///   • `quickin://host`                                    → ["host"]
    ///
    /// Shared with `NotificationLinkRules`, which also routes keyword-only
    /// links (`/host`, `/account`) that carry no id.
    static func pathTokens(from url: URL) -> [String]? {
        let scheme = url.scheme?.lowercased()
        let isWeb = (scheme == "https" || scheme == "http")
            && (url.host?.lowercased() == host(of: webBase))
        let isCustom = scheme == customScheme
        guard isWeb || isCustom else { return nil }

        var tokens: [String] = []
        if isCustom, let host = url.host, !host.isEmpty {
            tokens.append(host)
        }
        tokens.append(contentsOf: url.pathComponents.filter { $0 != "/" && !$0.isEmpty })
        return tokens
    }

    /// Lowercased host of a base URL string (e.g. "quickin-frontend.vercel.app").
    private static func host(of base: String) -> String {
        URL(string: base)?.host?.lowercased() ?? base
    }
}
