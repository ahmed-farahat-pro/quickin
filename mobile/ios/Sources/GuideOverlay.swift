import SwiftUI
import UIKit

// MARK: - Controller

/// Runs the in-app guide: which tour is showing, which step, and where on screen
/// each spotlighted view sits. One shared instance — `RootView` draws it,
/// Explore and Profile tag their views with `.guideAnchor(_:)`, and Profile's
/// "App guide" row starts it again. What the tours contain is `GuideRules`.
@MainActor
final class GuideController: ObservableObject {
    static let shared = GuideController()

    @Published private(set) var tour: GuideTour?
    @Published private(set) var steps: [GuideStep] = []
    @Published private(set) var index = 0
    @Published private(set) var state: GuideHostState = .signedOut
    /// A tab the guide needs on screen. `RootView` switches to it and clears this.
    @Published var requestedTab: GuideTab?
    /// Set by a closing button that hands off to a screen — Apply now, Sign in.
    /// The screen that owns that sheet performs it and clears this.
    @Published var pendingAction: GuideAction?

    /// Window-space frames of the views tagged with `.guideAnchor(_:)`, while on
    /// screen. Not published: anchors report on every scroll, and only an active
    /// tour needs to redraw for it (see `report`).
    private(set) var frames: [String: CGRect] = [:]

    var isActive: Bool { tour != nil }
    var step: GuideStep? { steps.indices.contains(index) ? steps[index] : nil }
    var isLastStep: Bool { index == steps.count - 1 }

    static var hasSeenMainTour: Bool {
        UserDefaults.standard.bool(forKey: GuideRules.seenKey)
    }

    /// Start `tour` from its first step, whatever was showing before.
    func start(_ tour: GuideTour, state: GuideHostState) {
        self.tour = tour
        self.state = state
        steps = GuideRules.steps(tour, state: state)
        index = 0
        bringUpTab()
    }

    func next() {
        guard isActive else { return }
        if isLastStep {
            finish()
        } else {
            index += 1
            bringUpTab()
        }
    }

    func back() {
        guard isActive, index > 0 else { return }
        index -= 1
        bringUpTab()
    }

    /// End the tour — finished, skipped or closed alike. The first-launch tour is
    /// then never offered automatically again on this device; it ends on Explore,
    /// where the user started — unless it hands straight over to the host tour.
    func finish(returningToExplore: Bool = true) {
        if tour == .main {
            UserDefaults.standard.set(true, forKey: GuideRules.seenKey)
            if returningToExplore { requestedTab = .explore }
        }
        tour = nil
        steps = []
        index = 0
    }

    /// The spotlight was tapped: a tab button switches to its tab, then the tour
    /// moves on. Anything else just moves on — opening a search sheet or the host
    /// application underneath the tour would hide it.
    func tapTarget() {
        if let tab = step?.tabTarget { requestedTab = tab }
        next()
    }

    func perform(_ action: GuideAction) {
        let state = self.state
        switch action {
        case .done:
            finish()
        case .startHostTour:
            finish(returningToExplore: false)
            start(.host, state: state)
        case .applyNow, .signIn:
            finish(returningToExplore: false)
            requestedTab = .profile
            pendingAction = action
        }
    }

    func report(_ anchor: String, frame: CGRect) {
        guard frames[anchor] != frame else { return }
        frames[anchor] = frame
        if isActive { objectWillChange.send() }
    }

    func clear(_ anchor: String) {
        guard frames.removeValue(forKey: anchor) != nil else { return }
        if isActive { objectWillChange.send() }
    }

    private func bringUpTab() {
        if let tab = step?.tab { requestedTab = tab }
    }
}

extension GuideHostState {
    @MainActor
    static func current(_ auth: AuthStore) -> GuideHostState {
        from(
            signedIn: auth.isAuthenticated,
            isHost: auth.user?.isHost == true,
            hostStatus: auth.user?.hostStatus.rawValue
        )
    }
}

// MARK: - Anchors

extension View {
    /// Tags this view as something the guide can spotlight (`GuideAnchor`).
    func guideAnchor(_ id: String) -> some View {
        background {
            GeometryReader { proxy in
                Color.clear
                    .onAppear { GuideController.shared.report(id, frame: proxy.frame(in: .global)) }
                    .onChange(of: proxy.frame(in: .global)) { _, frame in
                        GuideController.shared.report(id, frame: frame)
                    }
                    // A tab switch takes the view off screen; a stale frame would
                    // spotlight empty space.
                    .onDisappear { GuideController.shared.clear(id) }
            }
        }
    }

    /// The "App guide" chooser: replay the first-launch tour, or the host tour.
    func guideChooser(isPresented: Binding<Bool>) -> some View {
        modifier(GuideChooser(isPresented: isPresented))
    }
}

private struct GuideChooser: ViewModifier {
    @Binding var isPresented: Bool
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var loc: LocalizationManager

    func body(content: Content) -> some View {
        content.confirmationDialog(loc.t("guide.entry.title"), isPresented: $isPresented, titleVisibility: .visible) {
            Button(loc.t("guide.entry.mainTour")) {
                GuideController.shared.start(.main, state: .current(auth))
            }
            Button(loc.t("guide.entry.hostTour")) {
                GuideController.shared.start(.host, state: .current(auth))
            }
            Button(loc.t("common.cancel"), role: .cancel) {}
        }
    }
}

/// The tab bar is UIKit's, so its buttons can't carry `.guideAnchor`. Find the
/// button by its title instead — the same localised string the tab's `Label`
/// uses — which also stays right when Arabic mirrors the bar.
enum GuideTabBar {
    static func frame(titled title: String) -> CGRect? {
        guard let bar = findTabBar(), !bar.isHidden, bar.alpha > 0,
              let label = findLabel(titled: title, in: bar) else { return nil }
        // Widen from the title to the whole button: the bar's direct child
        // that holds it.
        var button: UIView = label
        while let parent = button.superview, parent !== bar { button = parent }
        return button.convert(button.bounds, to: nil)
    }

    private static func findLabel(titled title: String, in view: UIView) -> UILabel? {
        if let label = view as? UILabel, label.text == title { return label }
        for child in view.subviews {
            if let label = findLabel(titled: title, in: child) { return label }
        }
        return nil
    }

    private static func findTabBar() -> UITabBar? {
        let window = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)
        return window.flatMap(search)
    }

    private static func search(_ view: UIView) -> UITabBar? {
        if let bar = view as? UITabBar, bar.window != nil { return bar }
        for child in view.subviews {
            if let bar = search(child) { return bar }
        }
        return nil
    }
}

// MARK: - Overlay

/// The guide on screen: a dimmed scrim with a rounded cut-out around the step's
/// target and a card beside it. Steps with nothing to point at — or whose target
/// isn't on screen right now — get the card in the middle instead.
struct GuideOverlay: View {
    @ObservedObject private var guide = GuideController.shared
    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let spotlightPadding: CGFloat = 8
    private let gap: CGFloat = 14

    var body: some View {
        if let step = guide.step {
            GeometryReader { proxy in
                let screen = proxy.frame(in: .global)
                let hole = target(for: step, in: screen)?
                    .offsetBy(dx: -screen.minX, dy: -screen.minY)
                    .insetBy(dx: -spotlightPadding, dy: -spotlightPadding)
                let size = proxy.size

                ZStack(alignment: .topLeading) {
                    scrim(hole: hole)
                        .contentShape(Rectangle())
                        // The dimmed area swallows taps; only the spotlight acts.
                        .onTapGesture(coordinateSpace: .local) { point in
                            if hole?.contains(point) == true { guide.tapTarget() }
                        }
                        .accessibilityHidden(true)

                    if let hole {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .strokeBorder(Color.qkGold, lineWidth: 2)
                            .frame(width: hole.width, height: hole.height)
                            .offset(x: hole.minX, y: hole.minY)
                            .allowsHitTesting(false)
                    }

                    placed(card(step), hole: hole, in: size)
                }
            }
            .ignoresSafeArea()
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: guide.index)
            .transition(.opacity)
            .accessibilityAddTraits(.isModal)
            .onChange(of: guide.index) { _, _ in
                UIAccessibility.post(notification: .screenChanged, argument: nil)
            }
        }
    }

    // MARK: Target

    private func target(for step: GuideStep, in screen: CGRect) -> CGRect? {
        let rect: CGRect?
        if let tab = step.tabTarget {
            rect = GuideTabBar.frame(titled: loc.t(tabTitleKey(tab)))
        } else if let anchor = step.anchor {
            rect = guide.frames[anchor]
        } else {
            rect = nil
        }
        // Half-scrolled away counts as not on screen: a spotlight cut off by the
        // edge points at nothing the user can see.
        guard let rect, rect.width > 0, rect.height > 0, screen.contains(rect) else { return nil }
        return rect
    }

    private func tabTitleKey(_ tab: GuideTab) -> String {
        switch tab {
        case .explore: return "tab.explore"
        case .wishlist: return "tab.wishlist"
        case .trips: return "tab.trips"
        case .profile: return "tab.profile"
        }
    }

    // MARK: Scrim

    private func scrim(hole: CGRect?) -> some View {
        Rectangle()
            .fill(Color.black.opacity(0.55))
            .mask {
                Rectangle()
                    .overlay(alignment: .topLeading) {
                        if let hole {
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .frame(width: hole.width, height: hole.height)
                                .offset(x: hole.minX, y: hole.minY)
                                .blendMode(.destinationOut)
                        }
                    }
                    .compositingGroup()
            }
    }

    // MARK: Card placement

    /// Below the target when there's more room below it, above otherwise;
    /// centred when there is no target.
    @ViewBuilder
    private func placed(_ card: some View, hole: CGRect?, in size: CGSize) -> some View {
        let width = min(size.width - 32, 380)
        VStack(spacing: 0) {
            if let hole {
                if size.height - hole.maxY >= hole.minY {
                    Color.clear.frame(height: hole.maxY + gap)
                    card.frame(width: width)
                    Spacer(minLength: 0)
                } else {
                    Spacer(minLength: 0)
                    card.frame(width: width)
                    Color.clear.frame(height: size.height - hole.minY + gap)
                }
            } else {
                Spacer(minLength: 0)
                card.frame(width: width)
                Spacer(minLength: 0)
            }
        }
        .frame(width: size.width, height: size.height)
    }

    // MARK: Card

    private func card(_ step: GuideStep) -> some View {
        let stepLabel = String(format: loc.t("guide.stepOf"), guide.index + 1, guide.steps.count)
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Text(stepLabel)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.qkMuted)
                    .accessibilityHidden(true)
                dots
                Spacer(minLength: 0)
                Button { guide.finish() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Color.qkInk)
                        .frame(width: 30, height: 30)
                        .background(Color.qkCream)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(loc.t("guide.close"))
            }

            Text(loc.t(step.titleKey))
                .font(.system(.title3, design: .serif).weight(.bold))
                .foregroundStyle(Color.qkInk)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityLabel("\(stepLabel). \(loc.t(step.titleKey))")
                .accessibilityAddTraits(.isHeader)

            if let bodyKey = step.bodyKey {
                Text(loc.t(bodyKey))
                    .font(.subheadline)
                    .foregroundStyle(Color.qkMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if step.showsChecklist { checklist }

            footer
                .padding(.top, 4)
        }
        .padding(18)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: Color.black.opacity(0.18), radius: 20, x: 0, y: 10)
        .accessibilityElement(children: .contain)
    }

    private var dots: some View {
        HStack(spacing: 4) {
            ForEach(guide.steps.indices, id: \.self) { i in
                Capsule()
                    .fill(i == guide.index ? Color.qkBurgundy : Color.qkTan)
                    .frame(width: i == guide.index ? 14 : 6, height: 6)
            }
        }
        .accessibilityHidden(true)
    }

    private var checklist: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(GuideRules.requirementKeys, id: \.self) { key in
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Color.qkBurgundy)
                    Text(loc.t(key))
                        .font(.subheadline)
                        .foregroundStyle(Color.qkInk)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    @ViewBuilder
    private var footer: some View {
        HStack(spacing: 14) {
            if guide.isLastStep {
                if guide.index > 0 { textButton("guide.back") { guide.back() } }
                Spacer(minLength: 0)
                let actions = GuideRules.finalActions(guide.tour ?? .main, state: guide.state)
                ForEach(actions.dropFirst(), id: \.titleKey) { action in
                    textButton(action.titleKey) { guide.perform(action) }
                }
                if let primary = actions.first {
                    primaryButton(primary.titleKey) { guide.perform(primary) }
                }
            } else {
                textButton("guide.skip") { guide.finish() }
                Spacer(minLength: 0)
                if guide.index > 0 { textButton("guide.back") { guide.back() } }
                primaryButton("guide.next") { guide.next() }
            }
        }
    }

    private func textButton(_ key: String, action: @escaping () -> Void) -> some View {
        Button(loc.t(key), action: action)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Color.qkMuted)
            .buttonStyle(.plain)
    }

    private func primaryButton(_ key: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(loc.t(key))
                .font(.subheadline.weight(.bold))
                .foregroundStyle(Color.qkCream)
                .padding(.horizontal, 18)
                .padding(.vertical, 10)
                .background(LinearGradient.qkBurgundyCTA)
                .clipShape(Capsule())
        }
        .buttonStyle(.qkTap)
    }
}
