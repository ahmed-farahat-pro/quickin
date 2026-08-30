import Foundation

/// Whether this device still owes the signed-in account the one-time "you're an
/// approved host" welcome — the moment that turns an admin's approval into
/// something the host can actually see.
///
/// The Swift twin of `HostWelcomeRules.kt` on Android. Both must answer the same
/// way for the same account, or a host is congratulated on one phone and not the
/// other.
///
/// The reported defect: **nothing in the app marked the moment of approval.**
/// `is_host` flipped server-side and the UI looked exactly as it had the day
/// before — the dashboard was reachable only from a card near the bottom of the
/// Profile scroll, so an approved host had no way to learn their new surface
/// existed. The persistent entry points fix the "where"; this rule fixes the
/// "when", pointing at the dashboard once, the first time we see the approval.
///
/// Keyed by USER id, not by a bare bool: one device is shared by more than one
/// account here (see the duplicate-account cases in the reservations inbox), and
/// a device-wide flag would silently swallow the welcome for the second host to
/// sign in on the same phone.
///
/// Pure: no SwiftUI, no UserDefaults, no network. It only decides whether to
/// show; the caller owns reading and writing the stored id.
enum HostWelcomeRules {
    /// The `UserDefaults` key holding the id of the last account welcomed here.
    static let storageKey = "host_welcome_announced_user_id"

    /// Whether to show the welcome now.
    ///
    /// - Parameters:
    ///   - isHost: the server's `is_host` for the signed-in account. Never a
    ///     local guess — approval is an admin action, and the app learns of it
    ///     only by re-reading the account.
    ///   - userID: the signed-in account's id, or nil when signed out.
    ///   - announcedTo: the id stored under `storageKey`, or nil if this device
    ///     has never welcomed anyone.
    ///
    /// A guest never sees it, and neither does a host who has already been shown
    /// it on this device. An account we cannot name is not welcomed at all: with
    /// no id there is nothing to remember, so showing it would mean showing it on
    /// every single launch.
    static func shouldWelcome(isHost: Bool, userID: String?, announcedTo: String?) -> Bool {
        guard isHost else { return false }
        guard let id = normalized(userID) else { return false }
        return normalized(announcedTo) != id
    }

    /// What to write to `storageKey` once the welcome has been shown, or nil when
    /// there is no account to remember (the caller then stores nothing).
    static func announced(userID: String?) -> String? {
        normalized(userID)
    }

    /// Ids arrive from a JSON body and from `UserDefaults`; treat surrounding
    /// whitespace as noise so a padded copy of the same id is not read as a
    /// different account.
    private static func normalized(_ id: String?) -> String? {
        guard let trimmed = id?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmed.isEmpty else { return nil }
        return trimmed
    }
}
