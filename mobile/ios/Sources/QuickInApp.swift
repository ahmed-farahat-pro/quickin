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

    /// Whether the signed-in account manages a place (host or admin). Drives the
    /// host tab set. Guests (role "user") and signed-out visitors see the guest
    /// tabs. Recomputed from the published `auth.user`, so it flips reactively
    /// after login / registration / logout.
    private var isHost: Bool {
        switch auth.user?.role?.lowercased() {
        case "host", "admin": return true
        default: return false
        }
    }

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
                QKScreenSwap(key: isHost) {
                    if isHost {
                        hostTabs
                    } else {
                        guestTabs
                    }
                }
                // Switch the tab set reactively when the role changes (e.g. after
                // a host signs in / out). Reset to the first tab so the selection
                // can never point at a tab that the new set doesn't show.
                .onChange(of: isHost) { _, _ in
                    selectedTab = 0
                }
            }
        }
    }

    // MARK: - Guest tabs (role "user" / signed-out)

    /// Explore · Services · Wishlist · Trips · Profile — the open browse
    /// experience. Wishlist surfaces the saved stays & experiences as a
    /// top-level tab (also reachable historically from Profile).
    private var guestTabs: some View {
        TabView(selection: $selectedTab) {
            ListingsView(onOpenProfile: { selectedTab = 4 })
                .tabItem { Label(loc.t("tab.explore"), systemImage: "house") }
                .tag(0)

            ServicesView()
                .tabItem { Label(loc.t("tab.services"), systemImage: "sparkles") }
                .tag(1)

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

    // MARK: - Host tabs (role "host" / "admin")

    /// Listings · Reservations · Services · Profile — managing a place. No
    /// Explore tab; Listings/Reservations/Services reuse the host screens.
    private var hostTabs: some View {
        TabView(selection: $selectedTab) {
            HostListingsTab()
                .tabItem { Label(loc.t("tab.listings"), systemImage: "house") }
                .tag(0)

            HostReservationsTab()
                .tabItem { Label(loc.t("tab.reservations"), systemImage: "calendar") }
                .tag(1)

            HostServicesTab()
                .tabItem { Label(loc.t("tab.services"), systemImage: "sparkles") }
                .tag(2)

            ProfileTab()
                .tabItem { Label(loc.t("tab.profile"), systemImage: "person.crop.circle") }
                .tag(3)
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

/// Wishlist tab router: the signed-in `SavedView` (saved stays & experiences),
/// or a guest sign-in CTA. `SavedView` relies on an enclosing `NavigationStack`
/// for its large title + push destinations, so it's wrapped here (matching the
/// Services / Trips tabs). The `QKScreenSwap` preserves the redesign's content
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
