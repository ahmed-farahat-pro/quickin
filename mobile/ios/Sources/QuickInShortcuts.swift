import AppIntents

// Siri / Shortcuts entry points. Each opens the app and jumps to a section via
// AppNavigation. The spoken phrases are registered by QuickInShortcuts (the
// AppShortcutsProvider) so they work hands-free with Siri and appear in the
// Shortcuts app — part of making QuickIn usable by voice and by VoiceOver users.

@available(iOS 16.0, *)
struct ExploreStaysIntent: AppIntent {
    static var title: LocalizedStringResource = "Explore Stays"
    static var description = IntentDescription("Open QuickIn to browse boutique stays.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        AppNavigation.shared.pendingSection = .explore
        return .result()
    }
}

@available(iOS 16.0, *)
struct ShowReservationsIntent: AppIntent {
    static var title: LocalizedStringResource = "Show My Reservations"
    static var description = IntentDescription("Open your QuickIn trips and reservations.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        AppNavigation.shared.pendingSection = .reservations
        return .result()
    }
}

@available(iOS 16.0, *)
struct OpenProfileIntent: AppIntent {
    static var title: LocalizedStringResource = "Open My Profile"
    static var description = IntentDescription("Open your QuickIn profile and identity verification.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        AppNavigation.shared.pendingSection = .profile
        return .result()
    }
}

@available(iOS 16.0, *)
struct QuickInShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: ExploreStaysIntent(),
            phrases: [
                "Explore stays on \(.applicationName)",
                "Find a stay on \(.applicationName)",
                "Browse \(.applicationName)",
            ],
            shortTitle: "Explore Stays",
            systemImageName: "house"
        )
        AppShortcut(
            intent: ShowReservationsIntent(),
            phrases: [
                "Show my reservations on \(.applicationName)",
                "Open my trips on \(.applicationName)",
            ],
            shortTitle: "My Reservations",
            systemImageName: "calendar"
        )
        AppShortcut(
            intent: OpenProfileIntent(),
            phrases: [
                "Open my \(.applicationName) profile",
                "Verify my identity on \(.applicationName)",
            ],
            shortTitle: "My Profile",
            systemImageName: "person.crop.circle"
        )
    }
}
