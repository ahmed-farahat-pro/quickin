import Foundation

/// What the in-app guide (the first-launch walkthrough and the "how to become a
/// host" walkthrough) shows, in which order, and with which closing buttons.
///
/// The Swift twin of `GuideRules.kt` on Android and the web's guide steps — the
/// three surfaces share one spec (`mobile/APP-GUIDE-SPEC.md`), so the same
/// account sees the same tour everywhere.
///
/// Pure: no SwiftUI, no UserDefaults. The overlay (`GuideOverlay`) draws the
/// steps; `GuideController` owns the seen flag.
enum GuideRules {
    /// The `UserDefaults` key set once the first-launch tour has ended in any
    /// way — finished, skipped or closed. Per device on purpose: no account is
    /// needed to be greeted, and a reinstall greets again.
    static let seenKey = "qk.guide.main.v1.seen"

    /// The first-launch tour starts by itself only once, and never on top of
    /// something else the user has to deal with first (the splash, the signup
    /// completion screen, the notifications primer, a deep-linked detail).
    static func shouldAutoStart(seen: Bool, blocked: Bool) -> Bool {
        !seen && !blocked
    }

    /// The steps of `tour` for an account in `state`, in order.
    static func steps(_ tour: GuideTour, state: GuideHostState) -> [GuideStep] {
        switch tour {
        case .main: return mainSteps(state)
        case .host: return hostSteps(state)
        }
    }

    /// The buttons on a tour's last step, primary first. The tour always ends
    /// with a plain Done; the step before it offers the next useful move.
    static func finalActions(_ tour: GuideTour, state: GuideHostState) -> [GuideAction] {
        switch (tour, state) {
        // A host has nothing to learn from the host tour.
        case (.main, .host): return [.done]
        case (.main, _): return [.startHostTour, .done]
        case (.host, .signedOut): return [.signIn, .done]
        case (.host, .guest): return [.applyNow, .done]
        // Pending: the application is in already. Host: nothing to apply for.
        case (.host, .pending), (.host, .host): return [.done]
        }
    }

    // MARK: - Tours

    private static func mainSteps(_ state: GuideHostState) -> [GuideStep] {
        let signedOut = state == .signedOut
        return [
            GuideStep(id: "welcome"),
            GuideStep(id: "search", anchor: GuideAnchor.search, tab: .explore),
            GuideStep(id: "regions", anchor: GuideAnchor.regions, tab: .explore),
            GuideStep(id: "filters", anchor: GuideAnchor.filters, tab: .explore),
            GuideStep(id: "wishlist", tabTarget: .wishlist),
            GuideStep(id: "trips", tabTarget: .trips),
            GuideStep(id: "profile", copy: signedOut ? "profile.signedOut" : "profile", tabTarget: .profile),
            GuideStep(id: "finish", copy: state == .host ? "finish.host" : "finish"),
        ]
    }

    private static func hostSteps(_ state: GuideHostState) -> [GuideStep] {
        // Step 3 points at whichever card the Profile tab is showing this account.
        let entry: GuideStep
        switch state {
        case .signedOut:
            entry = GuideStep(id: "host.entry", copy: "host.signIn", anchor: GuideAnchor.signIn, tab: .profile)
        case .guest:
            entry = GuideStep(id: "host.entry", copy: "host.apply", anchor: GuideAnchor.hostApply, tab: .profile)
        case .pending:
            entry = GuideStep(id: "host.entry", copy: "host.pending", anchor: GuideAnchor.hostPending, tab: .profile)
        case .host:
            entry = GuideStep(id: "host.entry", copy: "host.isHost", anchor: GuideAnchor.hostDashboard, tab: .profile)
        }
        return [
            GuideStep(id: "host.intro"),
            GuideStep(id: "host.profileTab", tabTarget: .profile),
            entry,
            GuideStep(id: "host.requirements", showsChecklist: true),
            GuideStep(id: "host.review"),
            GuideStep(id: "host.afterApproval"),
        ]
    }

    /// The host tour's "what you'll need" rows, as localisation keys. Mirrors the
    /// host application form (`HostApplicationSheet`) field for field.
    static let requirementKeys = [
        "guide.host.requirements.type",
        "guide.host.requirements.name",
        "guide.host.requirements.phone",
        "guide.host.requirements.address",
        "guide.host.requirements.id",
    ]
}

enum GuideTour: Equatable {
    /// First-launch walkthrough of Explore, the tabs and Profile.
    case main
    /// How to go from guest to host.
    case host
}

/// Where an account stands on the way to hosting — all the guide needs to know
/// to pick its copy and its closing buttons.
enum GuideHostState: Equatable {
    case signedOut
    /// Signed in, no application on file — or a rejected one, which may reapply.
    case guest
    case pending
    case host

    /// - Parameter hostStatus: the server's raw `host_status` (`none` |
    ///   `pending` | `rejected` | `approved`), nil when unknown.
    static func from(signedIn: Bool, isHost: Bool, hostStatus: String?) -> GuideHostState {
        guard signedIn else { return .signedOut }
        if isHost { return .host }
        return hostStatus?.lowercased() == "pending" ? .pending : .guest
    }
}

/// The tab bar's tabs, by their `TabView` tags in `RootView`.
enum GuideTab: Int {
    case explore = 0
    case wishlist = 2
    case trips = 3
    case profile = 4
}

/// The views a step can spotlight. Each one tags itself with `.guideAnchor(_:)`.
enum GuideAnchor {
    static let search = "search"
    static let regions = "regions"
    static let filters = "filters"
    static let signIn = "host.signIn"
    static let hostApply = "host.apply"
    static let hostPending = "host.pending"
    static let hostDashboard = "host.dashboard"
}

/// What a closing button does.
enum GuideAction: Equatable {
    case done
    case startHostTour
    case applyNow
    case signIn

    var titleKey: String {
        switch self {
        case .done: return "guide.done"
        case .startHostTour: return "guide.showMeHow"
        case .applyNow: return "guide.applyNow"
        case .signIn: return "guide.signIn"
        }
    }
}

struct GuideStep: Equatable {
    let id: String
    /// Suffix of the `guide.<copy>.title` / `guide.<copy>.body` keys. Usually the
    /// id; differs where one step reads differently per account.
    let copy: String
    /// A view tagged with `.guideAnchor(anchor)` to spotlight.
    let anchor: String?
    /// The tab that must be showing for `anchor` to be on screen.
    let tab: GuideTab?
    /// A tab bar button to spotlight; tapping it switches to that tab.
    let tabTarget: GuideTab?
    let showsChecklist: Bool

    init(
        id: String,
        copy: String? = nil,
        anchor: String? = nil,
        tab: GuideTab? = nil,
        tabTarget: GuideTab? = nil,
        showsChecklist: Bool = false
    ) {
        self.id = id
        self.copy = copy ?? id
        self.anchor = anchor
        self.tab = tab
        self.tabTarget = tabTarget
        self.showsChecklist = showsChecklist
    }

    var titleKey: String { "guide.\(copy).title" }
    /// The checklist step has no body line; its rows say it all.
    var bodyKey: String? { showsChecklist ? nil : "guide.\(copy).body" }
}
