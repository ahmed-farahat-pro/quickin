import SwiftUI

/// The signed-in user's profile: avatar, name, email, provider, and logout.
struct ProfileView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var currency: CurrencyManager
    @StateObject private var notifications = NotificationsBadgeModel()
    @StateObject private var header = ProfileHeaderModel()
    /// True while the "Become a host" request is in flight.
    @State private var isBecomingHost = false
    /// Drives the "Delete your account?" confirmation sheet.
    @State private var showDeleteConfirm = false
    /// True while the account-deletion request is in flight.
    @State private var isDeletingAccount = false

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
                            } else {
                                becomeHostButton
                            }
                            Spacer(minLength: 8)
                            logoutButton
                            deleteAccountButton
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
        // In-app account deletion (App Store Guideline 5.1.1(v)). A polished
        // destructive confirmation sheet precedes the irreversible delete; on
        // success `auth.deleteAccount()` clears the session, which routes the app
        // back to the auth screen. On failure the error is surfaced inline on the
        // sheet (via `auth.errorMessage`), keeping the user in context.
        .sheet(isPresented: $showDeleteConfirm) {
            DeleteAccountSheet(
                isDeleting: $isDeletingAccount,
                onConfirm: {
                    // Clear any prior inline error before retrying, then run the
                    // delete. The sheet owns the in-flight flag (spinner). On
                    // success the session is cleared and the sheet's host view is
                    // torn down with the signed-in experience; on failure we keep
                    // the sheet up so the inline error is visible.
                    auth.setError(nil)
                    return await auth.deleteAccount()
                },
                onCancel: { showDeleteConfirm = false }
            )
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
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
            if let role = roleLabel {
                pill(role, systemImage: isHost ? "house.fill" : "suitcase.rolling.fill")
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

    /// In-app language switch. A clean white card with a dropdown menu listing
    /// all languages by native name. Selecting flips `loc.lang`, which re-renders
    /// the whole app and switches LTR ⇄ RTL live.
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
            .pickerStyle(.menu)
            .tint(Color.qkBurgundy)
            .labelsHidden()
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

    /// "Become a host" CTA, shown only when the account isn't a host yet. Calls
    /// `POST /api/local/host/become`; on success the account's `is_host` flips
    /// to true and `hostEntry` replaces this button (no re-login). A burgundy
    /// card matching `hostEntry`'s look so the upgrade reads as the same surface.
    private var becomeHostButton: some View {
        Button {
            Task {
                isBecomingHost = true
                _ = await auth.becomeHost()
                isBecomingHost = false
            }
        } label: {
            HStack(spacing: 13) {
                if isBecomingHost {
                    ProgressView()
                        .tint(.qkCream)
                        .frame(width: 22)
                } else {
                    Image(systemName: "house.lodge.fill")
                        .font(.title3)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(loc.t("profile.becomeHost"))
                        .font(.system(size: 15, weight: .bold))
                    Text(loc.t("profile.becomeHost.subtitle"))
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
            .opacity(isBecomingHost ? 0.85 : 1)
        }
        .buttonStyle(.qkTap)
        .disabled(isBecomingHost)
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

    /// Destructive "Delete account" row (App Store Guideline 5.1.1(v)). Low-
    /// emphasis red text below Sign out; tapping opens the confirmation sheet.
    private var deleteAccountButton: some View {
        Button(role: .destructive) {
            showDeleteConfirm = true
        } label: {
            HStack(spacing: 8) {
                if isDeletingAccount {
                    ProgressView()
                        .tint(.red)
                        .frame(width: 16)
                } else {
                    Image(systemName: "trash")
                }
                Text(loc.t("account.delete"))
                    .fontWeight(.semibold)
            }
            .font(.subheadline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .foregroundStyle(Color.red)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isDeletingAccount)
        .padding(.top, 2)
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

    /// Whether the signed-in account is a host (gates the host dashboard entry
    /// vs. the "Become a host" CTA). Uses the unified-account `is_host` flag.
    private var isHost: Bool {
        auth.user?.isHost ?? false
    }

    /// Friendly label for the account-type pill, derived from `is_host`.
    private var roleLabel: String? {
        guard auth.user != nil else { return nil }
        return isHost ? loc.t("common.host") : loc.t("common.guest")
    }

    private func providerIcon(_ provider: String) -> String {
        switch provider {
        case "google": return "globe"
        case "apple": return "apple.logo"
        default: return "envelope.fill"
        }
    }
}

/// Polished destructive confirmation for permanent account deletion (App Store
/// Guideline 5.1.1(v)). Presented as a sheet from `ProfileView`: a burgundy-
/// tinted warning icon, a clear title, the list of what's permanently removed,
/// an "this can't be undone" emphasis, a prominent destructive "Delete account"
/// button (with an in-flight spinner), and Cancel. Boutique style using the
/// app's existing tokens.
private struct DeleteAccountSheet: View {
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var auth: AuthStore

    /// Bound to the parent's in-flight flag so the button shows a spinner and
    /// both Cancel + dismissal are disabled mid-request.
    @Binding var isDeleting: Bool
    /// Performs the delete; returns `true` on success.
    let onConfirm: () async -> Bool
    /// Dismisses the sheet without deleting.
    let onCancel: () -> Void

    private let removedItems: [(icon: String, key: String)] = [
        ("person.crop.circle", "account.delete.itemAccount"),
        ("house", "account.delete.itemListings"),
        ("calendar", "account.delete.itemBookings"),
        ("star", "account.delete.itemReviews"),
    ]

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 22) {
                    warningIcon
                        .padding(.top, 28)

                    Text(loc.t("account.delete.confirmTitle"))
                        .font(.system(.title2, design: .serif).weight(.bold))
                        .foregroundStyle(Color.qkInk)
                        .multilineTextAlignment(.center)

                    removedList

                    irreversibleNote

                    if let error = auth.errorMessage, !error.isEmpty {
                        Text(error)
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(Color.red)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                    }

                    actionButtons
                        .padding(.top, 4)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 28)
                .frame(maxWidth: .infinity)
            }
        }
        .tint(.qkBurgundy)
        .interactiveDismissDisabled(isDeleting)
    }

    private var warningIcon: some View {
        Image(systemName: "exclamationmark.triangle.fill")
            .font(.system(size: 34, weight: .bold))
            .foregroundStyle(Color.qkBurgundy)
            .frame(width: 76, height: 76)
            .background(Color.qkBurgundy.opacity(0.12))
            .clipShape(Circle())
            .overlay(Circle().stroke(Color.qkBurgundy.opacity(0.18), lineWidth: 1))
    }

    private var removedList: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(loc.t("account.delete.intro"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.qkInk)

            ForEach(removedItems, id: \.key) { item in
                HStack(spacing: 12) {
                    Image(systemName: item.icon)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.qkBurgundy)
                        .frame(width: 22)
                    Text(loc.t(item.key))
                        .font(.subheadline)
                        .foregroundStyle(Color.qkInk.opacity(0.85))
                    Spacer(minLength: 0)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .qkCard(cornerRadius: 18)
    }

    private var irreversibleNote: some View {
        HStack(spacing: 8) {
            Image(systemName: "lock.fill")
                .font(.system(size: 12, weight: .bold))
            Text(loc.t("account.delete.irreversible"))
                .font(.footnote.weight(.bold))
        }
        .foregroundStyle(Color.qkBurgundy)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 11)
        .padding(.horizontal, 14)
        .background(Color.qkBurgundy.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var actionButtons: some View {
        VStack(spacing: 12) {
            Button {
                Task {
                    isDeleting = true
                    let ok = await onConfirm()
                    isDeleting = false
                    // On failure the inline error (auth.errorMessage) is shown and
                    // the sheet stays up. On success the parent tears down with
                    // the signed-in experience, so no explicit dismiss is needed.
                    _ = ok
                }
            } label: {
                HStack(spacing: 8) {
                    if isDeleting {
                        ProgressView()
                            .tint(.qkCream)
                            .frame(width: 18)
                    } else {
                        Image(systemName: "trash.fill")
                    }
                    Text(loc.t("account.delete.confirm"))
                        .fontWeight(.bold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .foregroundStyle(Color.qkCream)
                .background(LinearGradient.qkBurgundyCTA)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .opacity(isDeleting ? 0.85 : 1)
            }
            .buttonStyle(QKPressStyle())
            .disabled(isDeleting)

            Button(role: .cancel) {
                onCancel()
            } label: {
                Text(loc.t("common.cancel"))
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .foregroundStyle(Color.qkInk)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(isDeleting)
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
