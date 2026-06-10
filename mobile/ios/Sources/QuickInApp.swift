import SwiftUI

@main
struct QuickInApp: App {
    @StateObject private var auth = AuthStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .preferredColorScheme(.light)
        }
    }
}

/// App shell. Shows the zoom-in splash on launch, then cross-fades into the
/// browse experience. Browsing (Explore) is fully open — no login gate. The
/// Profile tab handles the auth state itself: signed-in users see their
/// profile, guests see a sign-in CTA that presents `AuthView` as a sheet.
struct RootView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var showSplash = !DebugRoute.skipSplash
    @State private var selectedTab = DebugRoute.initialTab

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
                mainTabs
                    .transition(.opacity)
            }
        }
    }

    private var mainTabs: some View {
        TabView(selection: $selectedTab) {
            ListingsView()
                .tabItem { Label("Explore", systemImage: "house") }
                .tag(0)

            ReservationsView()
                .tabItem { Label("Reservations", systemImage: "calendar") }
                .tag(1)

            ProfileTab()
                .tabItem { Label("Profile", systemImage: "person.crop.circle") }
                .tag(2)
        }
        .tint(.qkBurgundy)
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
        Group {
            if auth.isAuthenticated {
                ProfileView()
            } else {
                SignInCTAView()
            }
        }
        .animation(.easeInOut(duration: 0.25), value: auth.isAuthenticated)
    }
}
