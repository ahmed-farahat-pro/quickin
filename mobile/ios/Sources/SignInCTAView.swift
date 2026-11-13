import SwiftUI

/// Shown in the Profile tab when the visitor is browsing as a guest.
/// Presents `AuthView` in a sheet; once auth succeeds the sheet dismisses
/// automatically and `ProfileTab` swaps in the real `ProfileView`.
struct SignInCTAView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var loc: LocalizationManager
    @State private var showingAuth = false
    @State private var showingGuide = false
    @ObservedObject private var guide = GuideController.shared

    /// The Profile tab's copy: offers the "App guide" link and is where the host
    /// tour points a signed-out visitor to sign in. The Wishlist tab's is not.
    var showsGuideEntry: Bool = true

    /// Header content — localization keys, defaulting to the Profile tab. The
    /// Wishlist tab passes its own so each tab's headline reads correctly.
    var eyebrowKey: String = "profile.eyebrow"
    var titleKey: String = "profile.title"
    var subtitleKey: String = "profile.subtitle"
    /// The centered CTA copy (defaults to the Profile prompt).
    var ctaTitleKey: String = "cta.profile.title"
    var ctaSubtitleKey: String = "cta.profile.subtitle"

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient.qkPageWash.ignoresSafeArea()

                VStack(spacing: 0) {
                    QKBrandHeader(
                        eyebrow: loc.t(eyebrowKey),
                        title: loc.t(titleKey),
                        subtitle: loc.t(subtitleKey)
                    )

                    VStack(spacing: 20) {
                        Spacer()

                        Image("logo")
                            .resizable()
                            .scaledToFit()
                            .frame(height: 64)

                        VStack(spacing: 8) {
                            Text(loc.t(ctaTitleKey))
                                .font(.system(.title3, design: .serif).weight(.semibold))
                                .foregroundStyle(Color.qkInk)
                                .multilineTextAlignment(.center)
                            Text(loc.t(ctaSubtitleKey))
                                .font(.subheadline)
                                .foregroundStyle(Color.qkMuted)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 24)
                        }

                        Spacer()

                        Button {
                            showingAuth = true
                        } label: {
                            QKPrimaryButtonLabel(title: loc.t("cta.button"))
                        }
                        .buttonStyle(QKPressStyle())
                        .modifier(GuideSignInAnchor(enabled: showsGuideEntry))
                        .padding(.horizontal, 24)
                        .padding(.bottom, showsGuideEntry ? 8 : 24)

                        if showsGuideEntry {
                            Button {
                                showingGuide = true
                            } label: {
                                Label(loc.t("guide.entry.title"), systemImage: "questionmark.circle")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Color.qkBurgundy)
                            }
                            .buttonStyle(.plain)
                            .padding(.bottom, 20)
                        }
                    }
                    .frame(maxWidth: 480)
                    .frame(maxWidth: .infinity)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .tint(.qkBurgundy)
        .sheet(isPresented: $showingAuth) {
            AuthView()
                .environmentObject(auth)
        }
        // Auto-dismiss the sheet the moment authentication completes.
        .onChange(of: auth.isAuthenticated) { _, isAuthed in
            if isAuthed { showingAuth = false }
        }
        .guideChooser(isPresented: $showingGuide)
        // The host tour's closing "Sign in" lands here.
        .onReceive(guide.$pendingAction) { action in
            guard showsGuideEntry, action == .signIn else { return }
            guide.pendingAction = nil
            showingAuth = true
        }
    }
}

/// Tags the Profile tab's sign-in button for the host tour — and only that one,
/// so the Wishlist tab's copy of this screen can't claim the same spotlight.
private struct GuideSignInAnchor: ViewModifier {
    let enabled: Bool

    func body(content: Content) -> some View {
        if enabled {
            content.guideAnchor(GuideAnchor.signIn)
        } else {
            content
        }
    }
}

#Preview {
    SignInCTAView()
        .environmentObject(AuthStore())
        .environmentObject(LocalizationManager.shared)
}
