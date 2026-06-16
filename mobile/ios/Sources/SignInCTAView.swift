import SwiftUI

/// Shown in the Profile tab when the visitor is browsing as a guest.
/// Presents `AuthView` in a sheet; once auth succeeds the sheet dismisses
/// automatically and `ProfileTab` swaps in the real `ProfileView`.
struct SignInCTAView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var loc: LocalizationManager
    @State private var showingAuth = false

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
                        .padding(.horizontal, 24)
                        .padding(.bottom, 24)
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
    }
}

#Preview {
    SignInCTAView()
        .environmentObject(AuthStore())
        .environmentObject(LocalizationManager.shared)
}
