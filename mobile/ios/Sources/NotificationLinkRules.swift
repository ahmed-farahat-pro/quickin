import Foundation

/// Where a tapped notification goes — the in-app feed row and the push tap
/// both come through here (`DeepLinkRouter.openNotification`).
///
/// The backend stores each notification's `link` as a relative web path
/// (the same paths the website routes), e.g.:
///
///   `/explore/<listingId>[#comments]`  → that listing (scrolled to its comments)
///   `/reservation/<bookingId>`        → that reservation's detail (guest side)
///   `/reservations`                   → the Trips tab
///   `/host`                           → the host dashboard
///   `/account`                        → the Profile tab
///   `/verify-id`                      → ID verification (lives on Profile)
///   `/subscriptions`                  → "My subscriptions"
///   `/messages`, `/ops`, blank, other → nothing (the row is just marked read)
///
/// Absolute web URLs (`https://quickin-frontend.vercel.app/explore/<id>`) and
/// the `quickin://` scheme are accepted too: every link is turned into one of
/// our URLs and parsed by `AppLinks`, so there is exactly one link parser.
///
/// The LINK decides, not the notification `type`: a push carries no type at
/// all, and a listing link is a listing whatever type sent it. The type only
/// adds one thing — a `comment` / `comment_reply` row focuses the comments
/// even if its link lost the `#comments` fragment.
///
/// Pure: Foundation + `AppLinks` only, so `Tests/run.sh` compiles it alone.
enum NotificationLinkRules {
    enum Destination: Equatable {
        case listing(id: String, focusComments: Bool)
        case service(id: String)
        case reservation(id: String)
        /// The guest Trips / Reservations tab.
        case reservations
        /// The host dashboard (only ever produced for a host — see `isHost`).
        case hostDashboard
        /// The Profile tab.
        case account
        /// The user's service subscriptions ("My subscriptions").
        case subscriptions
    }

    /// Notification types whose listing link should open on the comments.
    static let commentTypes: Set<String> = ["comment", "comment_reply"]

    /// The destination for a tapped notification, or nil to open nothing.
    ///
    /// `isHost`: whether the signed-in account is a host (server `is_host`).
    /// A `/host` link for anyone else opens Profile, where the host
    /// application lives, rather than a dashboard the backend won't fill.
    static func destination(type: String?, link: String?, isHost: Bool) -> Destination? {
        guard let url = url(for: link) else { return nil }
        let focusComments = url.fragment?.lowercased() == "comments"
            || commentTypes.contains(type?.lowercased() ?? "")

        // Id-bearing links: listing / service / reservation.
        if let parsed = AppLinks.destination(from: url) {
            switch parsed {
            case .listing(let id): return .listing(id: id, focusComments: focusComments)
            case .service(let id): return .service(id: id)
            case .reservation(let id): return .reservation(id: id)
            }
        }

        // Keyword-only links (`/host`, `/account`, …).
        guard let tokens = AppLinks.pathTokens(from: url), let first = tokens.first else { return nil }
        switch first.lowercased() {
        case "reservations", "trips":
            return .reservations
        case "host":
            return isHost ? .hostDashboard : .account
        case "account", "profile":
            return .account
        // No standalone ID-verification screen exists on iOS: it is a card on
        // the Profile tab (`IdentityVerificationCard`), so Profile is the screen.
        case "verify-id":
            return .account
        case "subscriptions":
            return .subscriptions
        default:
            // `/messages` (chat is retired), `/ops` (admin, web only), unknown.
            return nil
        }
    }

    /// The link as one of our URLs: absolute links are kept as-is (`AppLinks`
    /// then refuses a foreign host), relative paths are resolved against the
    /// web base. Nil for a blank or unparseable link.
    static func url(for link: String?) -> URL? {
        guard let raw = link?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return nil
        }
        if let absolute = URL(string: raw), absolute.scheme != nil {
            return absolute
        }
        let path = raw.hasPrefix("/") ? raw : "/" + raw
        return URL(string: AppLinks.webBase + path)
    }
}
