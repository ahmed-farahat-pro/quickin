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
}
