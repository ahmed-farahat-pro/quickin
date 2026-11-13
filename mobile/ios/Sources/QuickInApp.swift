import SwiftUI
import GoogleMaps

@main
struct QuickInApp: App {
    // Bridges UIKit's APNs device-token callbacks into SwiftUI so we can register
    // the push token with the backend after login (see PushManager / AppDelegate).
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var auth = AuthStore()
    // Shared so the model enums (ListingSort etc.) and the views observe the
    // same language source. `LocalizationManager.shared` is the single instance.
    @StateObject private var localization = LocalizationManager.shared
    // App-wide display-currency controller (EGP base + USD/EUR/GBP/SAR/AED).
    // Converts prices for display only; bookings stay EGP. Mirrors how the
    // localization manager is provided so the tree re-renders on a switch.
    @StateObject private var currency = CurrencyManager.shared
    // App-wide saved-favorites state, shared by the listing cards, the listing
    // detail heart, and the Saved screen.
    @StateObject private var wishlist = WishlistStore()
    // Routes incoming Universal Links / `quickin://` URLs to the right detail.
    @StateObject private var deepLink = DeepLinkRouter()
    // Drives the in-app "Turn on notifications" primer.
    @StateObject private var push = PushManager.shared

    init() {
        // Initialize the Google Maps iOS SDK once at launch so every GMSMapView
        // (Explore map + host pin-picker) can render. The key lives in Config.
        if !Config.googleMapsAPIKey.isEmpty {
            GMSServices.provideAPIKey(Config.googleMapsAPIKey)
        }
        QKAppearance.apply()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .environmentObject(localization)
                .environmentObject(currency)
                .environmentObject(wishlist)
                .environmentObject(deepLink)
                // Open the app from a shared web link (Universal Link) or the
                // custom `quickin://` scheme. The router parses + resolves the
                // target; unknown links are ignored (the app just opens).
                .onOpenURL { url in
                    deepLink.handle(url)
                }
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                    if let url = activity.webpageURL {
                        deepLink.handle(url)
                    }
                }
                // A tapped push → wherever its link points
                // (`NotificationLinkRules`: listing, reservation, Trips, host
                // dashboard, Profile, Explore — or nothing).
                .onReceive(AppNavigation.shared.$pendingNotificationLink) { link in
                    guard let link else { return }
                    AppNavigation.shared.pendingNotificationLink = nil
                    deepLink.openNotification(type: nil, link: link, isHost: auth.user?.isHost == true)
                }
                // Present the deep-linked entity over whatever tab is showing,
                // in its own navigation stack (guest detail experience).
                .fullScreenCover(item: $deepLink.route) { route in
                    DeepLinkDetailHost(route: route)
                        .environmentObject(auth)
                        .environmentObject(localization)
                        .environmentObject(currency)
                        .environmentObject(wishlist)
                }
                // Flip the entire UI to RTL + switch the locale when Arabic is
                // selected. Driven by the published `lang`, so toggling the
                // in-app language picker re-lays the whole tree live.
                .environment(\.layoutDirection, localization.lang.layoutDirection)
                .environment(\.locale, Locale(identifier: localization.lang.localeIdentifier))
                .preferredColorScheme(.light)
                // Fetch live FX rates once at launch for the currency switcher.
                // Fails silently → the baked-in static rates stay in place.
                .task {
                    await currency.refreshRates()
                }
                // React to sign-in / sign-out:
                //  • Register the device's push token (best-effort; never blocks).
                //  • Load (or clear) the saved-favorites id sets.
                // Fires on launch too when a session was restored.
                .task(id: auth.isAuthenticated) {
                    if auth.isAuthenticated {
                        // Surface the in-app notifications primer (if never asked)
                        // + register the device token. No silent system dialog.
                        push.refreshPermissionState()
                        push.registerWithBackendIfAvailable()
                        await wishlist.refresh()
                    } else {
                        wishlist.reset()
                    }
                }
                // Custom, on-brand notifications primer (a boutique bottom sheet —
                // not the stock iOS alert). Only appears when the OS status is
                // still notDetermined. "Allow" then fires the real system prompt.
                .overlay {
                    if push.shouldPromptForPermission {
                        NotificationPrimerView(
                            onAllow: {
                                push.shouldPromptForPermission = false
                                push.requestAuthorizationAndRegister()
                            },
                            onLater: { push.shouldPromptForPermission = false }
                        )
                        .environmentObject(localization)
                        .transition(.opacity)
                        .zIndex(20)
                    }
                }
                .animation(.easeInOut(duration: 0.25), value: push.shouldPromptForPermission)
        }
    }
}

/// App shell. Shows the zoom-in splash on launch, then cross-fades into the
/// browse experience. Browsing (Explore) is fully open — no login gate. The
/// Profile tab handles the auth state itself: signed-in users see their
/// profile, guests see a sign-in CTA that presents `AuthView` as a sheet.
struct RootView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var loc: LocalizationManager
    @State private var showSplash = !DebugRoute.skipSplash
    @State private var selectedTab = DebugRoute.initialTab
    // Lets Siri App Intents (see QuickInShortcuts) jump to a tab.
    @ObservedObject private var nav = AppNavigation.shared
    @EnvironmentObject private var deepLink: DeepLinkRouter
    // The in-app guide, and the notifications primer it must never cover.
    @ObservedObject private var guide = GuideController.shared
    @ObservedObject private var push = PushManager.shared

    var body: some View {
        ZStack {
            if showSplash {
                SplashView {
                    withAnimation(.easeInOut(duration: 0.45)) {
                        showSplash = false
                    }
                }
                .transition(.opacity)
            } else {
                // Unified account: EVERYONE — guest or host — gets the single
                // guest tab set. A host keeps all guest abilities and reaches
                // host features (manage listings + reservations) from Profile.
                guestTabs
            }

            // Signup identity: an account that still owes its phone + ID (a
            // first Google sign-in) is held here until it hands them over —
            // `identity_complete` comes from every auth response and the
            // `/api/auth/me` re-read on launch. An overlay rather than a modal so
            // it can't race the sign-in sheet's dismissal; sign out is the only
            // other way off it.
            if !showSplash, auth.isAuthenticated, auth.user?.identity.needsCompletion == true {
                CompleteAccountView()
                    .transition(.opacity)
                    .zIndex(50)
            }

            // The first-launch tour and the host tour (`GuideRules`), above the
            // tabs and below the signup completion screen.
            if !showSplash, guide.isActive {
                GuideOverlay()
                    .zIndex(40)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: auth.user?.identity.needsCompletion)
        .animation(.easeInOut(duration: 0.25), value: guide.isActive)
        // The guide moves between tabs as its steps need them.
        .onChange(of: guide.requestedTab) { _, tab in
            guard let tab else { return }
            selectedTab = tab.rawValue
            guide.requestedTab = nil
        }
        // Greet a first launch once whatever else wants the screen is gone —
        // re-run each time that changes, after a beat so the tabs have laid out.
        .task(id: guideBlocked) {
            guard !guideBlocked else { return }
            try? await Task.sleep(nanoseconds: 700_000_000)
            guard !Task.isCancelled, !guide.isActive,
                  GuideRules.shouldAutoStart(seen: GuideController.hasSeenMainTour, blocked: guideBlocked)
            else { return }
            guide.start(.main, state: .current(auth))
        }
        // App-level "Added/Removed from wishlist" toast — floats above the tab
        // bar so every heart toggle (cards, detail hero, Saved) confirms visibly.
        .wishlistToast()
        // Siri / Shortcuts navigation: apply a pending section to the right tab
        // when it arrives or on cold launch.
        .onChange(of: nav.pendingSection) { _, section in applyPending(section) }
        .onAppear { applyPending(nav.pendingSection) }
    }

    /// Something the first-launch tour must not start on top of.
    private var guideBlocked: Bool {
        showSplash
            || DebugRoute.suppressGuide
            || auth.user?.identity.needsCompletion == true
            || push.shouldPromptForPermission
            || deepLink.route != nil
    }

    /// Map a Siri-requested section to the correct tab index in the unified
    /// (guest) tab set, then clear the request so it doesn't re-fire.
    private func applyPending(_ section: AppNavigation.Section?) {
        guard let section else { return }
        switch section {
        case .explore:      selectedTab = 0
        case .reservations: selectedTab = 3
        case .profile:      selectedTab = 4
        }
        AppNavigation.shared.pendingSection = nil
    }

    // MARK: - Tabs (unified account — every user)

    /// Explore · Wishlist · Trips · Profile — the open browse experience.
    /// Wishlist surfaces the saved stays as a top-level tab (also reachable
    /// historically from Profile). Tag 1 belonged to the retired Services tab;
    /// the remaining tags are kept stable so `applyPending` / `DebugRoute`
    /// indices don't shift.
    private var guestTabs: some View {
        TabView(selection: $selectedTab) {
            ListingsView(onOpenProfile: { selectedTab = 4 })
                .tabItem { Label(loc.t("tab.explore"), systemImage: "house") }
                .tag(0)

            WishlistTab()
                .tabItem { Label(loc.t("tab.wishlist"), systemImage: "heart.fill") }
                .tag(2)

            ReservationsView()
                .tabItem { Label(loc.t("tab.trips"), systemImage: "calendar") }
                .tag(3)

            ProfileTab()
                .tabItem { Label(loc.t("tab.profile"), systemImage: "person.crop.circle") }
                .tag(4)
        }
        .tint(.qkBurgundy)
    }
}

/// Global UIKit appearance for the redesign: a frosted, glossy tab bar and
/// warm-cream nav bars with burgundy-tinted titles. Applied once at launch.
enum QKAppearance {
    static func apply() {
        let burgundy = UIColor(Color.qkBurgundy)
        let ink = UIColor(Color.qkInk)
        let cream = UIColor(Color.qkCream)

        // ── Navigation bar: cream surface, large serif-flavored titles. ──
        let nav = UINavigationBarAppearance()
        nav.configureWithOpaqueBackground()
        nav.backgroundColor = cream
        nav.shadowColor = .clear
        let largeFont = UIFont.systemFont(ofSize: 30, weight: .bold)
        let serif = UIFontDescriptor(name: "Georgia-Bold", size: 30)
        nav.largeTitleTextAttributes = [
            .foregroundColor: ink,
            .font: UIFont(descriptor: serif, size: 30) ?? largeFont,
        ]
        nav.titleTextAttributes = [.foregroundColor: ink]
        UINavigationBar.appearance().standardAppearance = nav
        UINavigationBar.appearance().scrollEdgeAppearance = nav
        UINavigationBar.appearance().compactAppearance = nav
        UINavigationBar.appearance().tintColor = burgundy

        // ── Tab bar: frosted glass, raised glossy feel. ──
        let tab = UITabBarAppearance()
        tab.configureWithDefaultBackground()
        tab.backgroundEffect = UIBlurEffect(style: .systemUltraThinMaterialLight)
        tab.backgroundColor = UIColor(Color.qkCream.opacity(0.55))
        tab.shadowColor = UIColor(Color.qkInk.opacity(0.08))

        let item = tab.stackedLayoutAppearance
        item.selected.iconColor = burgundy
        item.selected.titleTextAttributes = [
            .foregroundColor: burgundy,
            .font: UIFont.systemFont(ofSize: 10, weight: .bold),
        ]
        let unselected = UIColor(Color.qkMuted)
        item.normal.iconColor = unselected
        item.normal.titleTextAttributes = [
            .foregroundColor: unselected,
            .font: UIFont.systemFont(ofSize: 10, weight: .semibold),
        ]
        UITabBar.appearance().standardAppearance = tab
        UITabBar.appearance().scrollEdgeAppearance = tab
        UITabBar.appearance().tintColor = burgundy
    }
}

/// Launch-argument hooks used only for CLI screenshot verification.
/// Pass `-uitest 1` to skip the splash, and `-uitestTab <0|1|2>` to preselect
/// a tab. Has no effect on a normal launch (all flags default off).
enum DebugRoute {
    static var skipSplash: Bool {
        UserDefaults.standard.bool(forKey: "uitest")
    }
    /// CLI screenshot runs start on a fresh simulator, where the first-launch
    /// tour would cover every screen. Off under `-uitest` unless `-uitestGuide 1`.
    static var suppressGuide: Bool {
        skipSplash && !UserDefaults.standard.bool(forKey: "uitestGuide")
    }
    static var initialTab: Int {
        UserDefaults.standard.object(forKey: "uitestTab") != nil
            ? UserDefaults.standard.integer(forKey: "uitestTab")
            : 0
    }
}

/// Profile tab router: the signed-in `ProfileView`, or a guest sign-in CTA.
struct ProfileTab: View {
    @EnvironmentObject private var auth: AuthStore

    var body: some View {
        QKScreenSwap(key: auth.isAuthenticated) {
            if auth.isAuthenticated {
                ProfileView()
            } else {
                SignInCTAView()
            }
        }
    }
}

/// Wishlist tab router: the signed-in `SavedView` (saved stays),
/// or a guest sign-in CTA. `SavedView` relies on an enclosing `NavigationStack`
/// for its large title + push destinations, so it's wrapped here (matching the
/// Trips tab). The `QKScreenSwap` preserves the redesign's content
/// transition when the auth state flips.
struct WishlistTab: View {
    @EnvironmentObject private var auth: AuthStore

    var body: some View {
        QKScreenSwap(key: auth.isAuthenticated) {
            if auth.isAuthenticated {
                NavigationStack {
                    SavedView()
                }
                .tint(.qkBurgundy)
            } else {
                SignInCTAView(
                    showsGuideEntry: false,
                    eyebrowKey: "saved.eyebrow",
                    titleKey: "saved.title",
                    subtitleKey: "saved.subtitle",
                    ctaTitleKey: "saved.signInPrompt",
                    ctaSubtitleKey: "saved.subtitle"
                )
            }
        }
    }
}
