import SwiftUI
import PhotosUI
import UIKit

/// The signed-in user's profile: avatar, name, email, provider, and logout.
struct ProfileView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var currency: CurrencyManager
    @Environment(\.openURL) private var openURL
    @StateObject private var notifications = NotificationsBadgeModel()
    @StateObject private var header = ProfileHeaderModel()
    @StateObject private var hostApplication = HostApplicationModel()
    /// Drives the "Become a host" application sheet.
    @State private var showHostApply = false
    /// Drives the "Delete your account?" confirmation sheet.
    @State private var showDeleteConfirm = false
    /// True while the account-deletion request is in flight.
    @State private var isDeletingAccount = false
    /// True while the one-time "you're an approved host" welcome is showing.
    /// Decided by `HostWelcomeRules` against a per-account id in `UserDefaults`.
    @State private var showHostWelcome = false

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
                            // Hosting sits right under the identity for EVERY account, so the
                            // surface a host needs most is the first thing they see. It used to
                            // be the reverse: a guest's "Become a host" card was up here while
                            // the approved host's dashboard was buried below Terms & Privacy —
                            // approval made the feature HARDER to find than applying for it.
                            if isHost {
                                if showHostWelcome { hostWelcomeCard }
                                hostEntry
                            } else {
                                // Renders whichever of the four application states applies.
                                hostApplicationSection
                            }
                            IdentityVerificationCard()
                            // Payment information — where QuickIn sends this
                            // host's earnings. Hosts only; a guest has none.
                            if isHost {
                                HostPayoutCard()
                            }
                            GuestReviewsAboutMeSection(guestID: auth.user?.id)
                            settingsEntry
                            receiptsEntry
                            messagesEntry
                            languageEntry
                            currencyEntry
                            legalSection
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
        // the bio / photo). Also re-reads the authoritative account so an
        // approved / rejected host application lands without a relaunch — the
        // server's `is_host` + `host_status` always win over the local cache.
        .onAppear {
            Task {
                await auth.refreshSession()
                // Only non-hosts have an application worth reading (a host's
                // surface is the dashboard, not the four-state card).
                if !isHost { await hostApplication.refresh() }
                // AFTER the session refresh, never before: an approval that
                // landed while the app was closed only exists in the response
                // above, and asking first would greet the host a launch late.
                refreshHostWelcome()
                await notifications.refresh()
                await header.refresh()
            }
        }
        // A logout → login as someone else should drop the previous bio / avatar.
        .onChange(of: auth.user?.id) { _, _ in
            header.reset()
            hostApplication.reset()
            showHostWelcome = false
            Task {
                await header.refresh()
                if !isHost { await hostApplication.refresh() }
                refreshHostWelcome()
            }
        }
        // Become a host: the application form (also used to reapply after a
        // rejection). Submitting files it for admin review — it never grants
        // host, so on success we only flip the local status to `pending`.
        .sheet(isPresented: $showHostApply) {
            HostApplicationSheet(
                existing: hostApplication.application,
                fallbackName: auth.user?.fullName,
                onSubmitted: { hostType in
                    auth.applyHostApplicationSubmitted(hostType: hostType)
                    Task { await hostApplication.refresh() }
                }
            )
            .presentationDragIndicator(.visible)
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

    /// Provider pill (email / google, plus legacy `apple` rows from before Sign
    /// in with Apple was removed) plus an account-role pill (Guest / Host) when
    /// the backend supplied a role.
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

    /// Entry into the Messages inbox (guest ⇄ host conversations; web /messages
    /// parity), wrapped in a NavigationLink that mirrors `settingsEntry`'s look.
    private var messagesEntry: some View {
        NavigationLink {
            MessagesView()
        } label: {
            entryLabel(
                icon: "bubble.left.and.bubble.right.fill",
                title: loc.t("profile.messages"),
                subtitle: loc.t("profile.messages.sub")
            )
        }
        .buttonStyle(.qkTap)
    }

    /// "Support & legal" — the public web pages (Terms / Privacy / About /
    /// Contact), same links as the site footer, opened in the browser.
    private var legalSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(loc.t("profile.supportLegal"))
                .font(.system(.title3, design: .serif).weight(.semibold))
                .foregroundStyle(Color.qkInk)
            legalRow(icon: "doc.plaintext.fill", title: loc.t("legal.terms"), path: "/terms")
            legalRow(icon: "hand.raised.fill", title: loc.t("legal.privacy"), path: "/privacy")
            legalRow(icon: "info.circle.fill", title: loc.t("legal.about"), path: "/about")
            legalRow(icon: "envelope.fill", title: loc.t("legal.contact"), path: "/contact")
        }
    }

    /// One legal row: opens the site's public page at `path` in the browser.
    private func legalRow(icon: String, title: String, path: String) -> some View {
        Button {
            if let url = URL(string: AppLinks.webBase + path) {
                openURL(url)
            }
        } label: {
            entryLabel(icon: icon, title: title, subtitle: nil)
        }
        .buttonStyle(.qkTap)
    }

    /// The shared card row used by the messages + legal entries (icon, title,
    /// optional subtitle, trailing chevron) — mirrors `settingsEntry`'s label.
    private func entryLabel(icon: String, title: String, subtitle: String?) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(Color.qkBurgundy)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.qkInk)
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                }
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

    /// The one-time "you're an approved host" welcome, shown above `hostEntry`
    /// the first time this device sees the account come back with `is_host`.
    ///
    /// Approval happens in `/ops`, out of the app's sight: the account simply
    /// starts answering `is_host: true` on its next read, with nothing on screen
    /// to mark it. Without this the host has to *notice* that a card changed near
    /// the top of a screen they may not open for days.
    ///
    /// Deliberately a cream-and-gold card rather than a second burgundy one, so
    /// it reads as a note ABOUT the dashboard sitting underneath it instead of a
    /// duplicate of it. It appears once per account (`HostWelcomeRules`); the
    /// permanent ways in — this card's neighbour and the banner shortcut on
    /// Explore and Trips — carry the discovery from then on.
    private var hostWelcomeCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.title2)
                    .foregroundStyle(Color.qkGoldDeep)
                VStack(alignment: .leading, spacing: 4) {
                    Text(loc.t("host.welcome.title"))
                        .font(.system(size: 17, weight: .bold, design: .serif))
                        .foregroundStyle(Color.qkInk)
                    Text(loc.t("host.welcome.subtitle"))
                        .font(.system(size: 13.5))
                        .foregroundStyle(Color.qkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }

            HStack(spacing: 10) {
                // Opening the dashboard IS the acknowledgement — a host who has
                // been there does not need welcoming to it again.
                NavigationLink {
                    HostDashboardView()
                } label: {
                    Text(loc.t("host.welcome.cta"))
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color.qkCream)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 11)
                        .background(LinearGradient.qkBurgundyCTA)
                        .clipShape(Capsule())
                }
                .buttonStyle(.qkTap)
                .simultaneousGesture(TapGesture().onEnded { dismissHostWelcome() })

                Button {
                    dismissHostWelcome()
                } label: {
                    Text(loc.t("host.welcome.dismiss"))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.qkMuted)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 11)
                }
                .buttonStyle(.qkTap)
                Spacer(minLength: 0)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.qkSurface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(Color.qkGold.opacity(0.55), lineWidth: 1.5)
        )
        .shadow(color: Color.qkGoldDeep.opacity(0.16), radius: 14, x: 0, y: 8)
        .transition(.opacity.combined(with: .move(edge: .top)))
    }

    /// Ask `HostWelcomeRules` whether this account is still owed the welcome.
    /// Called after every session refresh, so an approval that landed while the
    /// app was closed shows up the moment the profile is opened.
    private func refreshHostWelcome() {
        showHostWelcome = HostWelcomeRules.shouldWelcome(
            isHost: isHost,
            userID: auth.user?.id,
            announcedTo: UserDefaults.standard.string(forKey: HostWelcomeRules.storageKey)
        )
    }

    /// Retire the welcome for this account and hide it. Writing the id BEFORE
    /// the animation matters: the card is dismissed by navigating away from it
    /// too, and an unwritten id would greet the host again on their way back.
    private func dismissHostWelcome() {
        if let id = HostWelcomeRules.announced(userID: auth.user?.id) {
            UserDefaults.standard.set(id, forKey: HostWelcomeRules.storageKey)
        }
        withAnimation(.easeInOut(duration: 0.25)) { showHostWelcome = false }
    }

    /// Host-only entry into the host dashboard (add listing + reservation
    /// requests). Rendered only when the server says `is_host` — an approved
    /// application, never a local flag. A burgundy-gradient card.
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

    /// The become-a-host surface for a non-host account, branching on the
    /// server-derived `host_status`. There's no instant promotion any more: the
    /// CTA opens the application form, an admin reviews it in `/ops`, and only
    /// then does `is_host` flip (which `hostEntry` gates on).
    ///
    /// `approved` is unreachable here — the contract guarantees it implies
    /// `is_host`, and this whole section is skipped for hosts.
    @ViewBuilder
    private var hostApplicationSection: some View {
        switch hostStatus {
        case .none:     becomeHostButton
        case .pending:  hostPendingCard
        case .rejected: hostRejectedCard
        case .approved: EmptyView()
        }
    }

    /// "Become a host" CTA, shown when there's no application on file. Opens the
    /// application sheet. A burgundy card matching `hostEntry`'s look so the
    /// upgrade reads as the same surface.
    private var becomeHostButton: some View {
        Button {
            showHostApply = true
        } label: {
            HStack(spacing: 13) {
                Image(systemName: "house.lodge.fill")
                    .font(.title3)
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
        }
        .buttonStyle(.qkTap)
    }

    /// `pending` — the application is with the admins. Read-only on purpose:
    /// there's nothing for the applicant to do but wait.
    private var hostPendingCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            hostStatusHeader(
                icon: "clock.fill",
                title: loc.t("hostApply.pending.title"),
                badge: loc.t("hostApply.pending.badge"),
                tint: .qkGoldDeep
            )
            Text(loc.t("hostApply.pending.body"))
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
                .fixedSize(horizontal: false, vertical: true)

            if let submitted = hostApplication.application?.submittedText {
                Text(submitted)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.qkMuted.opacity(0.85))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .qkCard(cornerRadius: 18, lifts: false)
    }

    /// `rejected` — show the admin's reason (when they left one) and offer a
    /// reapply, which reopens the same form (the backend upserts on resubmit).
    private var hostRejectedCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            hostStatusHeader(
                icon: "exclamationmark.triangle.fill",
                title: loc.t("hostApply.rejected.title"),
                badge: loc.t("hostApply.rejected.badge"),
                tint: .qkBurgundy
            )
            Text(loc.t("hostApply.rejected.body"))
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
                .fixedSize(horizontal: false, vertical: true)

            if let note = auth.user?.hostReviewNote?.trimmingCharacters(in: .whitespacesAndNewlines),
               !note.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text(loc.t("hostApply.rejected.reason"))
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Color.qkBurgundy)
                    Text(note)
                        .font(.footnote)
                        .foregroundStyle(Color.qkInk)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(Color.qkBurgundy.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }

            Button {
                showHostApply = true
            } label: {
                QKPrimaryButtonLabel(title: loc.t("hostApply.reapply"), systemImage: "arrow.clockwise", height: 48)
            }
            .buttonStyle(QKPressStyle())
            .padding(.top, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .qkCard(cornerRadius: 18, lifts: false)
    }

    /// Shared title row for the pending / rejected cards: a tinted glyph, the
    /// title, and a status pill — mirrors `IdentityVerificationCard`'s header.
    private func hostStatusHeader(icon: String, title: String, badge: String, tint: Color) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 24)
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.qkInk)
                // The titles name the flow ("Host application under review"), so
                // let them wrap next to the pill instead of truncating on small screens.
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 8)
            Text(badge)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(tint)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(tint.opacity(0.12))
                .clipShape(Capsule())
        }
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
    /// vs. the "Become a host" CTA). Uses the unified-account `is_host` flag —
    /// the server's value, refreshed on every appearance, never a local guess.
    private var isHost: Bool {
        auth.user?.isHost ?? false
    }

    /// Where the account sits in the become-a-host flow, from the server's
    /// derived `host_status`. Drives which of the four states is rendered.
    private var hostStatus: HostStatus {
        auth.user?.hostStatus ?? .none
    }

    /// Friendly label for the account-type pill, derived from `is_host`.
    private var roleLabel: String? {
        guard auth.user != nil else { return nil }
        return isHost ? loc.t("common.host") : loc.t("common.guest")
    }

    private func providerIcon(_ provider: String) -> String {
        switch provider {
        case "google": return "globe"
        // Legacy: accounts created while Sign in with Apple was still offered.
        case "apple": return "apple.logo"
        default: return "envelope.fill"
        }
    }
}

// MARK: - Become a host (application → admin review)

/// Reads the signed-in account's host application
/// (`GET /api/local/host/application`) so the profile can date the "under
/// review" card and prefill the form when a rejected applicant reapplies. Fails
/// silently: without it the cards simply drop the extras. The authoritative
/// status still comes from `auth.user?.hostStatus`, never from here.
@MainActor
final class HostApplicationModel: ObservableObject {
    @Published var application: HostApplication?

    func refresh() async {
        guard let state = try? await HostService.shared.fetchHostApplication() else { return }
        application = state.application
    }

    /// Clear the cached row so a different account never momentarily shows the
    /// previous one's application.
    func reset() {
        application = nil
    }
}

/// The "Become a host" application form, presented as a sheet from
/// `ProfileView`. Collects what an admin needs to review — full name, national
/// ID, phone, address, host type, an optional company name and optional notes —
/// and POSTs them to `/api/local/host/apply`.
///
/// Submitting does **not** make the account a host: the backend files the
/// application as `pending` and an admin approves it in `/ops`. The same form
/// doubles as the reapply surface after a rejection (the backend upserts on the
/// `UNIQUE (user_id)` constraint), so it prefills from the previous submission.
private struct HostApplicationSheet: View {
    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.dismiss) private var dismiss

    /// The previous submission, when there is one (drives the prefill).
    let existing: HostApplication?
    /// The account's name, used when the application has none yet.
    let fallbackName: String?
    /// Called after a successful submit so the profile can flip to `pending`.
    let onSubmitted: (HostType) -> Void

    @State private var draft = HostService.HostApplicationDraft()
    /// True once the National ID came from an approved document, which makes the
    /// field read-only (`IdentityRules`).
    @State private var nationalIDLocked = false
    /// Whether this applicant still has to photograph their ID. Starts true — the
    /// safe direction while the verification read is in flight, since the API
    /// requires the documents from everyone we hold none for; the `.task` below
    /// clears it for an applicant who verified from the profile already.
    @State private var needsIdentityDocuments = true
    /// The staged photos, before they are encoded into the draft on submit.
    @State private var idFrontImage: UIImage?
    @State private var idBackImage: UIImage?
    @State private var idFrontPickerItem: PhotosPickerItem?
    @State private var idBackPickerItem: PhotosPickerItem?
    /// Which slot is decoding a picked photo (an iCloud photo has to download
    /// first, and an empty slot looks like nothing happened).
    @State private var loadingIDSide: IDSide?
    /// Set when a camera capture is in progress, naming the slot it fills.
    @State private var cameraIDSide: IDSide?
    @State private var isSubmitting = false
    @State private var didSubmit = false
    @State private var errorMessage: String?
    /// Set when client-side validation fails, so the offending field is named.
    @State private var invalidField: Field?
    /// Guards the one-shot seed so a re-appearance never overwrites typing.
    @State private var didPrefill = false

    private enum Field { case fullName, nationalID, phone, address, idDocuments }

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()

            if didSubmit {
                successPanel
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        intro
                        formCard
                        if let errorMessage {
                            errorBanner(errorMessage)
                        }
                        submitButton
                        cancelButton
                    }
                    .padding(20)
                    .padding(.bottom, 12)
                }
                .scrollDismissesKeyboard(.interactively)
            }
        }
        .tint(.qkBurgundy)
        .interactiveDismissDisabled(isSubmitting)
        .onAppear(perform: prefill)
        // One identity, verified once from the profile, serves guest and host
        // alike — so the number on a verified ID is read from what we already
        // hold instead of being asked for again. Failing silently is right: the
        // field simply stays empty and editable, exactly as it was before.
        .task {
            guard let state = try? await TrustService.shared.fetchVerification() else { return }
            applyIdentity(state)
        }
    }

    // MARK: - Pieces

    private var intro: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(loc.t("hostApply.title"))
                .font(.system(.title2, design: .serif).weight(.bold))
                .foregroundStyle(Color.qkInk)
            Text(loc.t("hostApply.subtitle"))
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 8)
    }

    private var formCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            hostTypePicker
            Divider()
            field(
                loc.t("hostApply.fullName"),
                systemImage: "person.fill",
                placeholder: loc.t("hostApply.fullName.placeholder"),
                text: $draft.fullName,
                field: .fullName,
                contentType: .name,
                capitalization: .words
            )
            Divider()
            field(
                loc.t("hostApply.nationalId"),
                systemImage: "creditcard.fill",
                placeholder: loc.t("hostApply.nationalId.placeholder"),
                text: $draft.nationalID,
                field: .nationalID,
                capitalization: .characters,
                isLocked: nationalIDLocked,
                lockedNote: loc.t("hostApply.nationalId.locked")
            )
            Divider()
            field(
                loc.t("hostApply.phone"),
                systemImage: "phone.fill",
                placeholder: loc.t("hostApply.phone.placeholder"),
                text: $draft.phone,
                field: .phone,
                contentType: .telephoneNumber,
                keyboard: .phonePad,
                // Stop at a full Egyptian number rather than accepting digits
                // an operator could never dial.
                sanitize: PhoneRules.capped
            )
            Divider()
            field(
                loc.t("hostApply.address"),
                systemImage: "mappin.and.ellipse",
                placeholder: loc.t("hostApply.address.placeholder"),
                text: $draft.address,
                field: .address,
                contentType: .fullStreetAddress
            )
            // Only companies and brokerages carry a trading name.
            if draft.hostType.isBusiness {
                Divider()
                field(
                    loc.t(draft.hostType == .brokerage ? "hostApply.brokerage" : "hostApply.company"),
                    systemImage: "building.2.fill",
                    placeholder: loc.t("hostApply.company.placeholder"),
                    text: $draft.company,
                    field: nil,
                    contentType: .organizationName,
                    capitalization: .words
                )
            }
            Divider()
            identitySection
            Divider()
            notesField
        }
        .padding(18)
        .qkCard(lifts: false)
    }

    /// Proof of identity — the document the reviewer reads the name and national
    /// ID above against. Shown as a settled fact for an applicant who verified
    /// from the profile already; everyone else photographs both sides here,
    /// because an application without one is refused by the API.
    @ViewBuilder
    private var identitySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(loc.t("hostApply.identity"), systemImage: "person.text.rectangle")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.qkMuted)
            if needsIdentityDocuments {
                Text(loc.t("hostApply.identity.intro"))
                    .font(.caption)
                    .foregroundStyle(Color.qkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                Picker(loc.t("hostApply.identity.docType"), selection: $draft.docType) {
                    ForEach(IDDocumentType.allCases) { type in
                        Text(loc.t(type.labelKey)).tag(type)
                    }
                }
                .pickerStyle(.segmented)
                HStack(alignment: .top, spacing: 12) {
                    idPhotoSlot(title: loc.t("hostApply.identity.front"), image: idFrontImage,
                                pickerItem: $idFrontPickerItem, side: .front)
                    idPhotoSlot(title: loc.t("hostApply.identity.back"), image: idBackImage,
                                pickerItem: $idBackPickerItem, side: .back)
                }
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(invalidField == .idDocuments ? Color.qkBurgundy : .clear, lineWidth: 1)
                        .padding(-6)
                )
            } else {
                Label(loc.t("hostApply.identity.onFile"), systemImage: "checkmark.seal.fill")
                    .font(.caption)
                    .foregroundStyle(Color.qkMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .onChange(of: idFrontPickerItem) { _, item in
            Task { await loadPickedID(item, side: .front) }
        }
        .onChange(of: idBackPickerItem) { _, item in
            Task { await loadPickedID(item, side: .back) }
        }
        .fullScreenCover(item: $cameraIDSide) { side in
            IDCameraPicker { image in setIDImage(image, side: side) }
                .ignoresSafeArea()
        }
    }

    /// One ID-photo slot: the thumbnail (or a placeholder), a "choose from
    /// library" button and, where there is a camera, a "take photo" one. Mirrors
    /// the verification card's slot so an ID looks the same wherever we ask.
    private func idPhotoSlot(
        title: String,
        image: UIImage?,
        pickerItem: Binding<PhotosPickerItem?>,
        side: IDSide
    ) -> some View {
        VStack(spacing: 8) {
            Text(title)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(Color.qkMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.qkTan)
                    .frame(height: 88)
                if loadingIDSide == side {
                    ProgressView().tint(Color.qkBurgundy)
                } else if let image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .frame(height: 88)
                        .frame(maxWidth: .infinity)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                } else {
                    Image(systemName: "creditcard")
                        .font(.system(size: 24, weight: .light))
                        .foregroundStyle(Color.qkBurgundy.opacity(0.5))
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(image != nil ? "\(title) — \(loc.t("hostApply.identity.chosen"))" : title)
            HStack(spacing: 6) {
                PhotosPicker(selection: pickerItem, matching: .images, photoLibrary: .shared()) {
                    Label(loc.t("trust.choose"), systemImage: "photo")
                        .labelStyle(.iconOnly)
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .frame(height: 34)
                        .foregroundStyle(Color.qkBurgundy)
                        .background(Color.qkTan)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(QKPressStyle())
                .accessibilityLabel("\(loc.t("trust.choose")) — \(title)")
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    Button {
                        cameraIDSide = side
                    } label: {
                        Label(loc.t("trust.takePhoto"), systemImage: "camera.fill")
                            .labelStyle(.iconOnly)
                            .font(.system(size: 14, weight: .semibold))
                            .frame(maxWidth: .infinity)
                            .frame(height: 34)
                            .foregroundStyle(Color.qkCream)
                            .background(Color.qkBurgundy)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .buttonStyle(QKPressStyle())
                    .accessibilityLabel("\(loc.t("trust.takePhoto")) — \(title)")
                }
            }
        }
        .frame(maxWidth: .infinity)
        .disabled(isSubmitting)
    }

    /// Individual / Company / Brokerage — sent as `host_type` (web parity).
    private var hostTypePicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(loc.t("hostApply.type"), systemImage: "person.2.fill")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.qkMuted)
            HStack(spacing: 8) {
                ForEach(HostType.allCases) { type in
                    QKChip(title: type.label, isSelected: draft.hostType == type) {
                        draft.hostType = type
                    }
                }
                Spacer(minLength: 0)
            }
        }
    }

    /// Multiline "anything else" box, styled like `ProfileSettingsView`'s bio.
    private var notesField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(loc.t("hostApply.notes"), systemImage: "text.alignleft")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.qkMuted)
            TextField(loc.t("hostApply.notes.placeholder"), text: $draft.notes, axis: .vertical)
                .lineLimit(3...6)
                .textInputAutocapitalization(.sentences)
                .foregroundStyle(Color.qkInk)
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .frame(minHeight: 96, alignment: .topLeading)
                .background(Color.qkCream)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(Color.qkInk.opacity(0.1), lineWidth: 1)
                )
        }
    }

    /// One labelled text field. `field` names the validation slot so a failed
    /// check can outline the offending input (nil for the optional ones).
    /// `sanitize`, when given, rewrites what the guest types as they type it —
    /// used by the phone field to refuse over-long input at the keyboard.
    private func field(
        _ label: String,
        systemImage: String,
        placeholder: String,
        text: Binding<String>,
        field: Field?,
        contentType: UITextContentType? = nil,
        keyboard: UIKeyboardType = .default,
        capitalization: TextInputAutocapitalization = .sentences,
        sanitize: ((String) -> String)? = nil,
        isLocked: Bool = false,
        lockedNote: String? = nil
    ) -> some View {
        let isInvalid = field != nil && field == invalidField
        return VStack(alignment: .leading, spacing: 6) {
            Label(label, systemImage: systemImage)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.qkMuted)
            TextField(placeholder, text: text)
                .textContentType(contentType)
                .keyboardType(keyboard)
                .textInputAutocapitalization(capitalization)
                .onChange(of: text.wrappedValue) { _, newValue in
                    guard let sanitize else { return }
                    let cleaned = sanitize(newValue)
                    if cleaned != newValue { text.wrappedValue = cleaned }
                }
                // Locked, not removed: the value still travels with the request,
                // and VoiceOver still reads the field and its number out.
                .disabled(isLocked)
                .foregroundStyle(isLocked ? Color.qkMuted : Color.qkInk)
                .padding(.horizontal, 14)
                .frame(height: 48)
                .background(Color.qkCream)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(
                            isInvalid ? Color.qkBurgundy : Color.qkInk.opacity(0.1),
                            lineWidth: isInvalid ? 1.5 : 1
                        )
                )
            if isLocked, let lockedNote {
                Label(lockedNote, systemImage: "checkmark.seal.fill")
                    .font(.caption2)
                    .foregroundStyle(Color.qkMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func errorBanner(_ message: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color.qkBurgundy)
            Text(message)
                .font(.footnote)
                .foregroundStyle(Color.qkInk)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.qkBurgundy.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var submitButton: some View {
        Button {
            Task { await submit() }
        } label: {
            QKPrimaryButtonLabel(
                title: loc.t(isSubmitting ? "hostApply.submitting" : "hostApply.submit"),
                systemImage: isSubmitting ? nil : "paperplane.fill",
                isLoading: isSubmitting
            )
        }
        .buttonStyle(QKPressStyle())
        .disabled(isSubmitting)
    }

    private var cancelButton: some View {
        Button(role: .cancel) {
            dismiss()
        } label: {
            Text(loc.t("common.cancel"))
                .fontWeight(.semibold)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .foregroundStyle(Color.qkInk)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isSubmitting)
    }

    /// Shown in place of the form once the application is filed — the profile
    /// behind the sheet has already flipped to its "under review" card.
    private var successPanel: some View {
        VStack(spacing: 18) {
            QKDrawCheck(size: 84)
            Text(loc.t("hostApply.success.title"))
                .font(.system(.title2, design: .serif).weight(.bold))
                .foregroundStyle(Color.qkInk)
                .multilineTextAlignment(.center)
            Text(loc.t("hostApply.success.body"))
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            Button {
                dismiss()
            } label: {
                QKPrimaryButtonLabel(title: loc.t("hostApply.success.done"))
            }
            .buttonStyle(QKPressStyle())
            .padding(.top, 4)
        }
        .padding(.horizontal, 28)
    }

    // MARK: - Actions

    /// Seed the form from the previous submission (reapply) or, failing that,
    /// from the account's own name. Runs once when the sheet appears.
    private func prefill() {
        guard !didPrefill else { return }
        didPrefill = true
        draft.fullName = existing?.fullName ?? fallbackName ?? ""
        draft.nationalID = existing?.nationalID ?? ""
        draft.phone = existing?.phone ?? ""
        draft.address = existing?.address ?? ""
        draft.company = existing?.company ?? ""
        draft.notes = existing?.notes ?? ""
        draft.hostType = HostType(raw: existing?.hostType)
    }

    /// Fold the identity we already hold into the form.
    ///
    /// The number on a **verified** ID is the one an admin approved, so it is
    /// shown and locked — an application contradicting the document beside it in
    /// /ops leaves the reviewer with two answers and nothing to choose between
    /// them. Anything else only seeds an empty field and stays editable, which
    /// is also why passing the current draft as `previousNationalID` is safe:
    /// the rule hands back what the applicant already typed rather than a
    /// late-arriving read stamping over it mid-sentence.
    private func applyIdentity(_ state: VerificationState) {
        let idField = IdentityRules.nationalID(
            status: state.status,
            submittedIDNumber: state.idNumber,
            previousNationalID: draft.nationalID
        )
        draft.nationalID = idField.value
        nationalIDLocked = idField.locked
        // The same submission answers the other half: someone whose ID is
        // approved, or already in the reviewer's queue, does not photograph it
        // again — the server links this application to the row it already has.
        needsIdentityDocuments = IdentityRules.needsIdentityDocuments(status: state.status)
    }

    /// Decode a picked photo into the slot it was chosen for, off the main thread.
    /// Goes through `QKPhotoPickerLoader` for the same reason the verification card
    /// does: an iCloud or Live Photo has no data representation to hand over, and
    /// that failure used to reach the user as a raw `CoreTransferable` error.
    private func loadPickedID(_ item: PhotosPickerItem?, side: IDSide) async {
        guard let item else { return }
        errorMessage = nil
        loadingIDSide = side
        defer { if loadingIDSide == side { loadingIDSide = nil } }
        switch await QKPhotoPickerLoader.loadImage(from: item) {
        case .success(let image): setIDImage(image, side: side)
        case .failure(let reason): errorMessage = loc.t(reason.messageKey)
        }
    }

    private func setIDImage(_ image: UIImage, side: IDSide) {
        // Clear any stale complaint, so a slot filled from the camera after a
        // failed pick doesn't leave the old error reading as a failed submission.
        errorMessage = nil
        if invalidField == .idDocuments { invalidField = nil }
        switch side {
        case .front: idFrontImage = image
        case .back: idBackImage = image
        case .selfie: break
        }
    }

    /// Validate the required fields client-side (same rules the backend
    /// enforces), then POST. On success flip to the confirmation panel and let
    /// the profile know so its card becomes "under review".
    private func submit() async {
        errorMessage = nil
        invalidField = nil

        if let failure = firstValidationFailure() {
            invalidField = failure.0
            errorMessage = loc.t(failure.1)
            return
        }

        isSubmitting = true
        defer { isSubmitting = false }
        // Send the phone in one canonical `+20…` form, so the same number typed
        // as `01001234567` and `+20 100 123 4567` is filed identically.
        var payload = draft
        payload.phone = PhoneRules.normalized(draft.phone)
        // Encode the ID photos only for an applicant who has to send them; an
        // already-verified one sends none, which is how the server knows to reuse
        // the submission it already holds.
        if needsIdentityDocuments {
            guard
                let front = idFrontImage.flatMap({ QKAvatarImage.makeDataURL(from: $0, maxDimension: 1280, quality: 0.8) }),
                let back = idBackImage.flatMap({ QKAvatarImage.makeDataURL(from: $0, maxDimension: 1280, quality: 0.8) })
            else {
                invalidField = .idDocuments
                errorMessage = loc.t("hostApply.error.idDocuments")
                return
            }
            payload.idFront = front
            payload.idBack = back
        } else {
            payload.idFront = nil
            payload.idBack = nil
        }
        do {
            try await HostService.shared.submitHostApplication(payload)
            onSubmitted(draft.hostType)
            didSubmit = true
        } catch {
            // Prefer the server's own text ("Already a host", "Application
            // already under review", a 400's message) over a generic line.
            let text = error.localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines)
            errorMessage = text.isEmpty ? loc.t("hostApply.error.submit") : text
        }
    }

    /// The first required field that fails, and the message key that explains it.
    /// Mirrors the backend's own validation so the round-trip is rarely needed.
    private func firstValidationFailure() -> (Field, String)? {
        let checks: [(slot: Field, value: String, messageKey: String)] = [
            (.fullName, draft.fullName, "hostApply.error.fullName"),
            (.nationalID, draft.nationalID, "hostApply.error.nationalId"),
            (.phone, draft.phone, "hostApply.error.phone"),
            (.address, draft.address, "hostApply.error.address"),
        ]
        for check in checks
        where check.value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return (check.slot, check.messageKey)
        }
        // Non-empty is not enough for the name: an operator reads it against the
        // ID photos, and "12345" is not a name. Same rule and same sentences as
        // sign-up — `NameRules` is the Swift twin of the API's name-policy.ts.
        if let problem = NameRules.problem(with: draft.fullName) {
            return (.fullName, problem.messageKey)
        }
        // The field already refuses over-long input, but a short or malformed
        // number still has to be caught before an operator tries to call it.
        // `PhoneRules` is the Swift twin of the web's EG_MOBILE/LANDLINE regex.
        if !PhoneRules.isValid(draft.phone) {
            return (.phone, "hostApply.error.phoneFormat")
        }
        // An application with no document behind it is refused by the API — there
        // is nothing for the reviewer to read the name and number above against —
        // so catch it here rather than spending a round trip on it.
        if needsIdentityDocuments, idFrontImage == nil || idBackImage == nil {
            return (.idDocuments, "hostApply.error.idDocuments")
        }
        return nil
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
