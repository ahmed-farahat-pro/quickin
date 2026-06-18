import SwiftUI

/// The signed-in user's profile: avatar, name, email, provider, and logout.
struct ProfileView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var currency: CurrencyManager
    @StateObject private var notifications = NotificationsBadgeModel()
    @StateObject private var header = ProfileHeaderModel()

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient.qkPageWash.ignoresSafeArea()

                VStack(spacing: 0) {
                    QKBrandHeader(
                        eyebrow: loc.t("profile.eyebrow"),
                        title: loc.t("profile.title"),
                        subtitle: loc.t("profile.subtitle")
                    ) {
                        QKHeaderIconButton(
                            systemName: "bell",
                            badge: notifications.unread,
                            accessibilityLabel: loc.t("notifications.title")
                        ) {
                            NotificationsView()
                        }
                    }

                    ScrollView {
                        VStack(spacing: 24) {
                            avatar
                            identity
                            badges
                            IdentityVerificationCard()
                            GuestReviewsAboutMeSection(guestID: auth.user?.id)
                            settingsEntry
                            receiptsEntry
                            referralEntry
                            languageEntry
                            currencyEntry
                            if isHost {
                                hostEntry
                            }
                            Spacer(minLength: 8)
                            logoutButton
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.horizontal, 24)
                        .padding(.top, 24)
                        .padding(.bottom, 32)
                    }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .tint(.qkBurgundy)
        // Refresh the unread badge + profile header (bio / avatar) every time
        // the tab appears (e.g. after returning from notifications, which may
        // have marked some read, or from Edit profile, which may have changed
        // the bio / photo).
        .onAppear {
            Task {
                await notifications.refresh()
                await header.refresh()
            }
        }
        // A logout → login as someone else should drop the previous bio / avatar.
        .onChange(of: auth.user?.id) { _, _ in
            header.reset()
            Task { await header.refresh() }
        }
    }

    // MARK: - Pieces

    private var avatar: some View {
        QKPhotoAvatar(
            avatarURL: header.avatarURL ?? auth.user?.avatarURL,
            initials: initials,
            size: 100,
            gold: isHost
        )
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

            if let bio = header.bio?.trimmingCharacters(in: .whitespacesAndNewlines), !bio.isEmpty {
                Text(bio)
                    .font(.subheadline)
                    .foregroundStyle(Color.qkInk.opacity(0.8))
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 4)
                    .padding(.horizontal, 12)
            }
        }
    }

    /// Provider pill (email / google / apple) plus an account-role pill
    /// (Guest / Host) when the backend supplied a role.
    private var badges: some View {
        HStack(spacing: 10) {
            providerPill
            if let raw = auth.user?.role?.lowercased(), let role = roleLabel {
                pill(role, systemImage: raw == "host" ? "house.fill" : "suitcase.rolling.fill")
            }
        }
    }

    private var providerPill: some View {
        let provider = (auth.user?.provider ?? "email").lowercased()
        return pill(provider.capitalized, systemImage: providerIcon(provider))
    }

    /// Shared burgundy-on-tan capsule used by both badges.
    private func pill(_ text: String, systemImage: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: systemImage)
                .font(.system(size: 11, weight: .bold))
            Text(text)
                .font(.system(size: 11, weight: .bold))
        }
        .foregroundStyle(Color.qkBurgundy)
        .padding(.horizontal, 13)
        .padding(.vertical, 7)
        .background(Color.qkTan)
        .clipShape(Capsule())
    }

    /// Entry into the profile-settings screen (edit name, age, ID, phone),
    /// wrapped in a NavigationLink that mirrors `QKListRow`'s look.
    private var settingsEntry: some View {
        NavigationLink {
            ProfileSettingsView()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "person.text.rectangle.fill")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 2) {
                    Text(loc.t("profile.editProfile"))
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.qkInk)
                    Text(loc.t("profile.editProfile.subtitle"))
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.forward")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.qkTan4)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 15)
            .contentShape(Rectangle())
            .qkCard(cornerRadius: 18)
        }
        .buttonStyle(.qkTap)
    }

    /// Entry into the "Refer friends" surface (referral code + stats), wrapped in
    /// a NavigationLink that mirrors `settingsEntry`'s look.
    private var referralEntry: some View {
        NavigationLink {
            ReferralView()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "gift.fill")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 2) {
                    Text(loc.t("referral.title"))
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.qkInk)
                    Text(loc.t("referral.subtitle"))
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.forward")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.qkTan4)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 15)
            .contentShape(Rectangle())
            .qkCard(cornerRadius: 18)
        }
        .buttonStyle(.qkTap)
    }

    /// Entry into the guest "Receipts" surface (itemized paid receipts), wrapped
    /// in a NavigationLink that mirrors `settingsEntry`'s look.
    private var receiptsEntry: some View {
        NavigationLink {
            GuestReceiptsView()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "doc.text.fill")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 2) {
                    Text(loc.t("money.receipts"))
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.qkInk)
                    Text(loc.t("money.receipts.subtitle"))
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.forward")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.qkTan4)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 15)
            .contentShape(Rectangle())
            .qkCard(cornerRadius: 18)
        }
        .buttonStyle(.qkTap)
    }

    /// Entry into the app-wide display-currency picker. Shows the active currency
    /// code as a trailing hint; mirrors `settingsEntry`'s NavigationLink look.
    private var currencyEntry: some View {
        NavigationLink {
            CurrencyPickerView()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "coloncurrencysign.circle.fill")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 2) {
                    Text(loc.t("money.currency"))
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.qkInk)
                    Text(loc.t("money.currency.subtitle"))
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                }
                Spacer(minLength: 8)
                Text(currency.currency.code)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.qkBurgundy)
                Image(systemName: "chevron.forward")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.qkTan4)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 15)
            .contentShape(Rectangle())
            .qkCard(cornerRadius: 18)
        }
        .buttonStyle(.qkTap)
    }

    /// In-app language switch. A clean white card with a segmented English /
    /// العربية control. Selecting flips `loc.lang`, which re-renders the whole
    /// app and switches LTR ⇄ RTL live.
    private var languageEntry: some View {
        HStack(spacing: 12) {
            Image(systemName: "globe")
                .font(.title3)
                .foregroundStyle(Color.qkBurgundy)
                .frame(width: 26)
            Text(loc.t("profile.language"))
                .font(.headline)
                .foregroundStyle(Color.qkInk)
            Spacer()
            Picker(loc.t("profile.language"), selection: $loc.lang) {
                ForEach(AppLang.allCases) { lang in
                    Text(lang.nativeName).tag(lang)
                }
            }
            .pickerStyle(.segmented)
            .frame(width: 168)
        }
        .padding(16)
        .qkCard(cornerRadius: 18)
    }

    /// Host-only entry into the host dashboard (add listing + reservation
    /// requests). Rendered only when `role == "host"`. A burgundy-gradient card.
    private var hostEntry: some View {
        NavigationLink {
            HostDashboardView()
        } label: {
            HStack(spacing: 13) {
                Image(systemName: "house.lodge.fill")
                    .font(.title3)
                VStack(alignment: .leading, spacing: 2) {
                    Text(loc.t("profile.hostDashboard"))
                        .font(.system(size: 15, weight: .bold))
                    Text(loc.t("profile.hostDashboard.subtitle"))
                        .font(.caption)
                        .foregroundStyle(Color.qkCream.opacity(0.82))
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.forward").font(.system(size: 14, weight: .semibold))
            }
            .foregroundStyle(Color.qkCream)
            .padding(16)
            .background(LinearGradient.qkBurgundyPanel)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .shadow(color: Color.qkBurgundy.opacity(0.26), radius: 14, x: 0, y: 10)
        }
        .buttonStyle(.qkTap)
    }

    private var logoutButton: some View {
        Button(role: .destructive) {
            auth.logout()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "rectangle.portrait.and.arrow.right")
                Text(loc.t("profile.logout"))
                    .fontWeight(.bold)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .foregroundStyle(Color.qkCream)
            .background(LinearGradient.qkBurgundyCTA)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(QKPressStyle())
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

    /// Whether the signed-in user is a host (gates the host dashboard entry).
    private var isHost: Bool {
        auth.user?.role?.lowercased() == "host"
    }

    /// Friendly label for the persisted account role, or `nil` if absent.
    private var roleLabel: String? {
        switch auth.user?.role?.lowercased() {
        case "host": return loc.t("common.host")
        case "user": return loc.t("common.guest")
        default: return nil
        }
    }

    private func providerIcon(_ provider: String) -> String {
        switch provider {
        case "google": return "globe"
        case "apple": return "apple.logo"
        default: return "envelope.fill"
        }
    }
}

/// Loads the supplementary profile fields the Profile header shows but that the
/// cached `AuthUser` session doesn't carry — the `bio`, plus a fresh `avatar_url`
/// (the avatar also has an immediate fallback from `auth.user`). Fails silently:
/// the header simply falls back to initials / no bio when offline or signed out.
@MainActor
final class ProfileHeaderModel: ObservableObject {
    @Published var bio: String?
    @Published var avatarURL: String?

    func refresh() async {
        guard let profile = try? await ProfileService.shared.fetchProfile() else { return }
        bio = profile.bio
        avatarURL = profile.avatarURL
    }

    /// Clear cached values so a different account never momentarily shows the
    /// previous one's bio / photo.
    func reset() {
        bio = nil
        avatarURL = nil
    }
}

/// Lightweight unread-count loader that backs the Profile toolbar bell badge.
/// Just fetches the count; the full feed lives in `NotificationsViewModel`.
@MainActor
final class NotificationsBadgeModel: ObservableObject {
    @Published var unread = 0

    func refresh() async {
        // Silently ignore failures (incl. signed-out): the bell simply shows no
        // badge rather than surfacing an error on the profile screen.
        if let result = try? await NotificationService.shared.fetchNotifications() {
            unread = result.unread
        } else {
            unread = 0
        }
    }
}
