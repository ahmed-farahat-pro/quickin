import SwiftUI

/// The signed-in user's profile: avatar, name, email, provider, and logout.
struct ProfileView: View {
    @EnvironmentObject private var auth: AuthStore

    var body: some View {
        NavigationStack {
            ZStack {
                Color.qkCream.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 24) {
                        avatar
                        identity
                        providerPill
                        Spacer(minLength: 8)
                        logoutButton
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 24)
                    .padding(.top, 24)
                    .padding(.bottom, 32)
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Color.qkCream, for: .navigationBar)
        }
        .tint(.qkBurgundy)
    }

    // MARK: - Pieces

    private var avatar: some View {
        Circle()
            .fill(Color.qkBurgundy)
            .frame(width: 104, height: 104)
            .overlay(
                Text(initials)
                    .font(.system(size: 38, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)
            )
            .shadow(color: Color.qkBurgundy.opacity(0.25), radius: 14, x: 0, y: 8)
            .padding(.top, 12)
    }

    private var identity: some View {
        VStack(spacing: 6) {
            Text(displayName)
                .font(.system(.title, design: .serif).weight(.semibold))
                .foregroundStyle(Color.qkInk)
                .multilineTextAlignment(.center)

            if let email = auth.user?.email, !email.isEmpty {
                Text(email)
                    .font(.subheadline)
                    .foregroundStyle(Color.qkMuted)
            }
        }
    }

    @ViewBuilder
    private var providerPill: some View {
        let provider = (auth.user?.provider ?? "email").lowercased()
        HStack(spacing: 6) {
            Image(systemName: providerIcon(provider))
                .font(.caption)
            Text(provider.capitalized)
                .font(.caption.weight(.semibold))
        }
        .foregroundStyle(Color.qkBurgundy)
        .padding(.horizontal, 14)
        .padding(.vertical, 7)
        .background(Color.qkTan)
        .clipShape(Capsule())
        .overlay(
            Capsule().stroke(Color.qkBurgundy.opacity(0.15), lineWidth: 1)
        )
    }

    private var logoutButton: some View {
        Button(role: .destructive) {
            auth.logout()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "rectangle.portrait.and.arrow.right")
                Text("Log out")
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Color.qkBurgundy)
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .padding(.top, 8)
    }

    // MARK: - Derived values

    private var displayName: String {
        if let name = auth.user?.fullName?.trimmingCharacters(in: .whitespacesAndNewlines),
           !name.isEmpty {
            return name
        }
        // Fall back to the local-part of the email, or a friendly default.
        if let email = auth.user?.email, let local = email.split(separator: "@").first {
            return String(local)
        }
        return "Guest"
    }

    private var initials: String {
        let source = displayName
        let parts = source
            .split(separator: " ")
            .prefix(2)
            .compactMap { $0.first }
        let result = String(parts).uppercased()
        return result.isEmpty ? "?" : result
    }

    private func providerIcon(_ provider: String) -> String {
        switch provider {
        case "google": return "globe"
        case "apple": return "apple.logo"
        default: return "envelope.fill"
        }
    }
}
