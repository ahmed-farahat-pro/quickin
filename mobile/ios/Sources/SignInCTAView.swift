import SwiftUI

/// Shown in the Profile tab when the visitor is browsing as a guest.
/// Presents `AuthView` in a sheet; once auth succeeds the sheet dismisses
/// automatically and `ProfileTab` swaps in the real `ProfileView`.
struct SignInCTAView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var showingAuth = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.qkCream.ignoresSafeArea()

                VStack(spacing: 20) {
                    Spacer()

                    Image("logo")
                        .resizable()
                        .scaledToFit()
                        .frame(height: 64)

                    VStack(spacing: 8) {
                        Text("Sign in to manage your trips")
                            .font(.system(.title3, design: .serif).weight(.semibold))
                            .foregroundStyle(Color.qkInk)
                            .multilineTextAlignment(.center)
                        Text("Save favorites, book stays, and keep your reservations in one place.")
                            .font(.subheadline)
                            .foregroundStyle(Color.qkMuted)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 24)
                    }

                    Spacer()

                    Button {
                        showingAuth = true
                    } label: {
                        Text("Sign in or create account")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .background(Color.qkBurgundy)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    .padding(.horizontal, 24)
                    .padding(.bottom, 24)
                }
                .frame(maxWidth: 480)
                .frame(maxWidth: .infinity)
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Color.qkCream, for: .navigationBar)
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
}
