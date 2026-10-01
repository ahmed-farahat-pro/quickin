import SwiftUI

/// App-wide navigation signals used by out-of-tree callers (Siri App Intents,
/// voice shortcuts) to drive the tab bar. `RootView` observes `pendingSection`
/// and switches to the matching tab — the tab INDEX differs between the guest
/// and host tab sets, so the mapping lives in `RootView` — then clears it.
@MainActor
final class AppNavigation: ObservableObject {
    static let shared = AppNavigation()
    private init() {}

    /// A semantic destination a shortcut wants to open.
    enum Section: Equatable {
        case explore
        case reservations
        case profile
    }

    /// Set by a Siri shortcut; consumed (and reset to nil) by `RootView`.
    @Published var pendingSection: Section?

    /// A tapped push notification's `link` (the payload carries only that).
    /// Set by `AppDelegate`; consumed (and reset to nil) at the app root,
    /// which hands it to `DeepLinkRouter.openNotification`. Held here rather
    /// than routed directly because a cold-launch tap arrives before the
    /// SwiftUI tree (and its router) exists.
    @Published var pendingNotificationLink: String?
}
