import SwiftUI
import PhotosUI

/// Loads + edits the signed-in user's profile (full name, age, phone, bio, avatar)
/// via `GET`/`PATCH /api/local/profile`. Reachable from `ProfileView`'s "Edit
/// profile" row.
///
/// The ID/passport number is shown here but NOT edited. It used to be an ordinary
/// text field, which meant anyone could rewrite their own identity number whenever
/// they liked with nobody reviewing it. Changing it now means filing a request with a
/// photo of the document, which an operator approves — see `IDChangeRequestView` and
/// `ProfileService.requestIDChange`.
@MainActor
final class ProfileSettingsViewModel: ObservableObject {
    @Published var fullName = "" {
        didSet {
            // A save refused for the name is stale the moment the name is fixed.
            // The banner sits by the button, far from the field, so leaving it up
            // while the inline hint has already gone reads as "still broken".
            if refusedForName, NameRules.problem(with: fullName) == nil {
                refusedForName = false
                saveError = nil
            }
        }
    }
    @Published var ageText = ""
    /// Read-only: the approved number on the profile. Kept as state so the row can
    /// update the moment a request is approved without a full reload.
    @Published var idDocument = ""
    /// The latest request to change it, and whether a new one may be filed.
    @Published var idChange: IDChangeState?
    @Published var phone = ""
    @Published var bio = ""
    /// Current avatar as a `data:`/`http` URL string (nil → initials fallback).
    @Published var avatarURL: String?

    @Published var isLoading = false
    @Published var isSaving = false
    @Published var loadError: String?
    @Published var saveError: String?
    @Published var didSave = false
    @Published var hasLoaded = false

    /// True while a freshly-picked photo is being downscaled + encoded.
    @Published var isProcessingPhoto = false

    // Change-password section.
    @Published var currentPassword = ""
    @Published var newPassword = ""
    @Published var confirmPassword = ""
    @Published var isChangingPassword = false
    @Published var passwordError: String?
    @Published var didChangePassword = false

    /// Whether the confirmation matches the new password. Empty counts as a
    /// match so the hint stays quiet until the user has actually typed there.
    var passwordsMatch: Bool {
        confirmPassword.isEmpty || confirmPassword == newPassword
    }

    /// All three fields filled, the new one clearing the strength bar, and the
    /// confirmation matching it — the password is only changed once the user has
    /// typed the same thing twice.
    var canChangePassword: Bool {
        !currentPassword.isEmpty
            && PasswordRules.meetsMin(newPassword)
            && confirmPassword == newPassword
            && !isChangingPassword
    }

    /// The name as it arrived from the server, so the inline hint can stay quiet
    /// until the field has actually been edited (or Save pressed). An account
    /// created before the rule existed may already hold a name that fails it —
    /// shouting at someone the moment they open Edit profile, about something they
    /// did not just do, is not how they find out.
    private var loadedFullName = ""

    /// Set the first time Save is pressed, so a name that was never touched but is
    /// still unusable is explained rather than silently refused.
    @Published var didAttemptSave = false

    /// Whether the banner currently showing is the one the name gate put there —
    /// so a network error is not cleared by typing in a different field.
    private var refusedForName = false

    /// The inline hint under the name field, or nil when there is nothing to say.
    ///
    /// `NameRules` is the Swift twin of the API's `name-policy.ts` — the same rule
    /// the server now enforces on `PATCH /api/local/profile`, checked here first so
    /// the answer arrives at the field instead of after a round trip. `12345` is
    /// non-empty, which is all this screen used to ask of a name.
    var nameError: String? {
        guard didAttemptSave || fullName != loadedFullName else { return nil }
        guard let problem = NameRules.problem(with: fullName) else { return nil }
        return L.t(problem.messageKey)
    }

    /// Parsed age (nil when empty/invalid → cleared on save).
    private var age: Int? {
        let trimmed = ageText.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? nil : Int(trimmed)
    }

    func load() async {
        isLoading = true
        loadError = nil
        defer { isLoading = false }
        do {
            let profile = try await ProfileService.shared.fetchProfile()
            apply(profile)
            hasLoaded = true
        } catch {
            loadError = error.localizedDescription
        }
        // Fetched separately and allowed to fail quietly: a profile that loaded is
        // still fully editable without it, and the ID row falls back to showing the
        // stored number with no request state rather than blocking the whole screen.
        await loadIDChange()
    }

    /// Refresh the ID row's request state. Silent on failure — see `load()`.
    func loadIDChange() async {
        idChange = try? await ProfileService.shared.fetchIDChangeState()
        if let current = idChange?.current { idDocument = current }
    }

    /// Withdraw a request that is still waiting for review.
    func cancelIDChange() async {
        guard let updated = try? await ProfileService.shared.cancelIDChangeRequest() else { return }
        idChange = updated
        idDocument = updated.current ?? ""
    }

    /// Wipe every field + flags so a different account never momentarily shows
    /// the previous one's data. Forces the next `load()` to repopulate from the
    /// new session. Called when `auth.user?.id` changes.
    func resetForAccountChange() {
        fullName = ""
        loadedFullName = ""
        didAttemptSave = false
        refusedForName = false
        ageText = ""
        idDocument = ""
        idChange = nil
        phone = ""
        bio = ""
        avatarURL = nil
        currentPassword = ""
        newPassword = ""
        confirmPassword = ""
        loadError = nil
        saveError = nil
        passwordError = nil
        didSave = false
        didChangePassword = false
        hasLoaded = false
    }

    func save() async {
        saveError = nil
        didSave = false
        didAttemptSave = true
        // Refused here rather than by the server: the name field is at the top of a
        // scrolling form and Save is at the bottom, so the banner beside the button
        // says the same sentence the field does — otherwise the button appears to do
        // nothing for anyone who cannot see the hint they just triggered.
        if let problem = NameRules.problem(with: fullName) {
            saveError = L.t(problem.messageKey)
            refusedForName = true
            return
        }
        refusedForName = false
        isSaving = true
        defer { isSaving = false }
        do {
            let updated = try await ProfileService.shared.updateProfile(
                // Normalized the way the server normalizes it, so the name that is
                // stored is the name that was judged.
                fullName: NameRules.normalized(fullName),
                age: age,
                phone: phone.trimmingCharacters(in: .whitespacesAndNewlines),
                bio: bio.trimmingCharacters(in: .whitespacesAndNewlines),
                avatarURL: avatarURL
            )
            apply(updated)
            didSave = true
        } catch {
            saveError = error.localizedDescription
        }
    }

    /// Handle a photo chosen via `PhotosPicker`: load its data off the main
    /// thread, downscale to ≤256px and JPEG-encode into a `data:` URL, then store
    /// it as the pending avatar (saved with the rest of the form on "Save").
    func handlePickedPhoto(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        isProcessingPhoto = true
        saveError = nil
        defer { isProcessingPhoto = false }
        do {
            guard
                let data = try await item.loadTransferable(type: Data.self),
                let image = UIImage(data: data),
                let dataURL = QKAvatarImage.makeDataURL(from: image)
            else {
                saveError = L.t("settings.photo.error")
                return
            }
            avatarURL = dataURL
        } catch {
            saveError = L.t("settings.photo.error")
        }
    }

    func changePassword() async {
        passwordError = nil
        didChangePassword = false
        isChangingPassword = true
        defer { isChangingPassword = false }
        do {
            try await ProfileService.shared.changePassword(
                currentPassword: currentPassword,
                newPassword: newPassword
            )
            // Clear the fields on success and show the confirmation note.
            currentPassword = ""
            newPassword = ""
            confirmPassword = ""
            didChangePassword = true
        } catch {
            passwordError = error.localizedDescription
        }
    }

    private func apply(_ profile: Profile) {
        fullName = profile.fullName ?? ""
        loadedFullName = fullName
        ageText = profile.age.map(String.init) ?? ""
        // Only overwritten when the server actually reported one. `updateProfile`'s
        // fallback echo carries no id_document (the field is not sent any more), so
        // assigning it unconditionally would blank the row after every save.
        if let stored = profile.idDocument { idDocument = stored }
        phone = profile.phone ?? ""
        bio = profile.bio ?? ""
        avatarURL = profile.avatarURL
    }
}

struct ProfileSettingsView: View {
    @StateObject private var viewModel = ProfileSettingsViewModel()
    @EnvironmentObject private var loc: LocalizationManager
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss

    @State private var showCurrentPassword = false
    @State private var showNewPassword = false
    @State private var showConfirmPassword = false

    /// Presents the ID-change request sheet — the only way to alter the ID number.
    @State private var showIDChangeSheet = false

    /// The photo selected in the avatar `PhotosPicker`, processed in
    /// `viewModel.handlePickedPhoto` into a `data:` URL on change.
    @State private var photoItem: PhotosPickerItem?

    // Face ID / Touch ID quick sign-in. `biometricKind` is the device capability
    // (the card hides when `.none`); `biometricOn` mirrors whether a session is
    // stored in the Keychain — toggling it on/off enables/clears that session.
    @State private var biometricKind: BiometricAuth.Kind = .none
    @State private var biometricOn = false

    var body: some View {
        mainContent
            .navigationTitle(loc.t("profile.editProfile"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.qkCream, for: .navigationBar)
            .tint(.qkBurgundy)
            .task { await viewModel.load() }
            .onAppear {
                biometricKind = BiometricAuth.shared.availableKind()
                biometricOn = BiometricAuth.shared.hasStoredSession
            }
            .onChange(of: viewModel.didSave) { _, saved in
                guard saved else { return }
                auth.applyProfile(
                    fullName: viewModel.fullName.trimmingCharacters(in: .whitespacesAndNewlines),
                    avatarURL: viewModel.avatarURL
                )
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { dismiss() }
            }
            .onChange(of: photoItem) { _, item in
                Task { await viewModel.handlePickedPhoto(item) }
            }
            .onChange(of: auth.user?.id) { _, _ in
                viewModel.resetForAccountChange()
                Task { await viewModel.load() }
            }
            .sheet(isPresented: $showIDChangeSheet) {
                IDChangeRequestView(currentValue: viewModel.idDocument) { state in
                    // The sheet hands back the server's new state, so the row shows
                    // "waiting for review" the moment it closes rather than after a
                    // round trip the user has to wait through.
                    viewModel.idChange = state
                }
                .environmentObject(loc)
            }
    }

    private var mainContent: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()
            if viewModel.isLoading && !viewModel.hasLoaded {
                ProgressView().tint(.qkBurgundy)
            } else {
                scrollContent
            }
        }
    }

    private var scrollContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if let loadError = viewModel.loadError, !viewModel.hasLoaded {
                    errorBanner(loadError, retry: true)
                }
                photoCard
                formCard
                if let saveError = viewModel.saveError {
                    errorBanner(saveError, retry: false)
                }
                saveButton
                passwordCard
                if biometricKind != .none {
                    securityCard
                }
            }
            .padding(20)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    // MARK: - Pieces

    private var formCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            field(
                loc.t("settings.fullName"),
                systemImage: "person.fill",
                placeholder: loc.t("settings.fullName.placeholder"),
                text: $viewModel.fullName,
                contentType: .name,
                capitalization: .words,
                errorMessage: viewModel.nameError
            )
            Divider()
            field(
                loc.t("settings.age"),
                systemImage: "number",
                placeholder: loc.t("settings.age.placeholder"),
                text: $viewModel.ageText,
                keyboard: .numberPad
            )
            Divider()
            idDocumentRow

            Divider()
            field(
                loc.t("settings.phone"),
                systemImage: "phone.fill",
                placeholder: loc.t("settings.phone.placeholder"),
                text: $viewModel.phone,
                contentType: .telephoneNumber,
                keyboard: .phonePad
            )
            Divider()
            bioField
        }
        .padding(18)
        .qkCard(lifts: false)
    }

    /// The ID / passport number — SHOWN, never edited here.
    ///
    /// This was an ordinary text field until it became clear that meant any account
    /// could rewrite its own identity number at will, reviewed by nobody. It now reads
    /// as a value with a status underneath it, and the only way to change it is a
    /// request an operator decides on. The row is deliberately not styled to look
    /// disabled-but-editable: it is a fact about the account, not a field someone is
    /// being stopped from typing in.
    private var idDocumentRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(loc.t("settings.id"), systemImage: "creditcard.fill")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.qkMuted)

            HStack(spacing: 10) {
                Text(viewModel.idDocument.isEmpty ? loc.t("settings.id.none") : viewModel.idDocument)
                    .font(.system(size: 15, weight: viewModel.idDocument.isEmpty ? .regular : .semibold))
                    .foregroundStyle(viewModel.idDocument.isEmpty ? Color.qkMuted : Color.qkInk)
                    .frame(maxWidth: .infinity, alignment: .leading)

                if viewModel.idChange?.canRequest == false {
                    Text(loc.t("idChange.status.pending"))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.qkBurgundy)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color.qkTan.opacity(0.6))
                        .clipShape(Capsule())
                }
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 44)
            .background(Color.qkTan.opacity(0.35))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            // A rejection is only useful if the reason travels with it — otherwise the
            // user resubmits the same thing and is refused again.
            if let request = viewModel.idChange?.request,
               request.status == .rejected,
               let note = request.notes, !note.isEmpty {
                Text(String(format: loc.t("idChange.rejected.reason"), note))
                    .font(.caption)
                    .foregroundStyle(Color.qkBurgundy)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if viewModel.idChange?.canRequest == false, let request = viewModel.idChange?.request {
                // Waiting: show what was asked for and offer to take it back, so a
                // number typed in error is not stuck until someone reviews it.
                Text(String(format: loc.t("idChange.pending.detail"), request.requestedValue))
                    .font(.caption)
                    .foregroundStyle(Color.qkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                Button(loc.t("idChange.withdraw")) {
                    Task { await viewModel.cancelIDChange() }
                }
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.qkBurgundy)
            } else {
                Button {
                    showIDChangeSheet = true
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .font(.system(size: 12, weight: .semibold))
                        Text(loc.t("idChange.request"))
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundStyle(Color.qkBurgundy)
                }
                .buttonStyle(.plain)
                Text(loc.t("idChange.explainer"))
                    .font(.caption2)
                    .foregroundStyle(Color.qkMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    /// Multiline "about me" editor. Uses a vertically-growing `TextField` styled
    /// like the other fields, with a min height so it reads as a paragraph box.
    private var bioField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(loc.t("settings.bio"), systemImage: "text.alignleft")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.qkMuted)
            TextField(
                loc.t("settings.bio.placeholder"),
                text: $viewModel.bio,
                axis: .vertical
            )
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

    /// Avatar preview + a `PhotosPicker` to change it. The picked photo is
    /// downscaled + encoded into a `data:` URL in the view model, then saved with
    /// the rest of the form.
    private var photoCard: some View {
        VStack(spacing: 14) {
            QKPhotoAvatar(
                avatarURL: viewModel.avatarURL,
                initials: avatarInitials,
                size: 96,
                gold: isHost
            )
            .overlay(alignment: .bottomTrailing) {
                if viewModel.isProcessingPhoto {
                    Circle()
                        .fill(Color.qkBurgundy)
                        .frame(width: 30, height: 30)
                        .overlay(ProgressView().scaleEffect(0.7).tint(.qkCream))
                }
            }

            PhotosPicker(
                selection: $photoItem,
                matching: .images,
                photoLibrary: .shared()
            ) {
                HStack(spacing: 8) {
                    Image(systemName: "camera.fill")
                        .font(.system(size: 14, weight: .semibold))
                    Text(loc.t(viewModel.avatarURL == nil ? "settings.photo" : "settings.changePhoto"))
                        .font(.system(size: 14, weight: .semibold))
                }
                .foregroundStyle(Color.qkBurgundy)
                .padding(.horizontal, 16)
                .padding(.vertical, 9)
                .background(Color.qkTan)
                .clipShape(Capsule())
            }
            .buttonStyle(.qkTap)
            .disabled(viewModel.isProcessingPhoto)
        }
        .frame(maxWidth: .infinity)
        .padding(18)
        .qkCard(lifts: false)
    }

    /// A labelled text field, optionally carrying an inline validation hint under
    /// it. The hint is styled exactly as `AuthView`'s — burgundy border, burgundy
    /// caption — because it is the same rule being explained in the same words.
    private func field(
        _ label: String,
        systemImage: String,
        placeholder: String,
        text: Binding<String>,
        contentType: UITextContentType? = nil,
        keyboard: UIKeyboardType = .default,
        capitalization: TextInputAutocapitalization = .sentences,
        errorMessage: String? = nil
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(label, systemImage: systemImage)
                .font(.caption.weight(.semibold))
                .foregroundStyle(errorMessage == nil ? Color.qkMuted : Color.qkBurgundy)
            TextField(placeholder, text: text)
                .textContentType(contentType)
                .keyboardType(keyboard)
                .textInputAutocapitalization(capitalization)
                .foregroundStyle(Color.qkInk)
                .padding(.horizontal, 14)
                .frame(height: 48)
                .background(Color.qkCream)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(
                            errorMessage == nil ? Color.qkInk.opacity(0.1) : Color.qkBurgundy.opacity(0.55),
                            lineWidth: errorMessage == nil ? 1 : 1.5
                        )
                )
            if let errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(Color.qkBurgundy)
                    .fixedSize(horizontal: false, vertical: true)
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: errorMessage)
    }

    private var saveButton: some View {
        Button {
            Task { await viewModel.save() }
        } label: {
            ZStack {
                if viewModel.isSaving {
                    ProgressView().tint(.white)
                } else if viewModel.didSave {
                    Label(loc.t("settings.saved"), systemImage: "checkmark")
                        .fontWeight(.bold)
                } else {
                    Text(loc.t("settings.saveChanges")).fontWeight(.bold)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .foregroundStyle(Color.qkCream)
            .background(LinearGradient.qkBurgundyCTA)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .opacity(viewModel.isSaving ? 0.85 : 1)
        }
        .buttonStyle(QKPressStyle())
        .disabled(viewModel.isSaving)
    }

    // MARK: - Change password

    private var passwordCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(loc.t("settings.changePassword"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.qkInk)

            secureField(
                loc.t("settings.currentPassword"),
                systemImage: "lock.fill",
                placeholder: loc.t("settings.currentPassword"),
                text: $viewModel.currentPassword,
                contentType: .password,
                isRevealed: $showCurrentPassword
            )
            Divider()
            secureField(
                loc.t("settings.newPassword"),
                systemImage: "lock.rotation",
                placeholder: loc.t("settings.newPassword.placeholder"),
                text: $viewModel.newPassword,
                contentType: .newPassword,
                isRevealed: $showNewPassword
            )

            PasswordStrengthView(password: viewModel.newPassword)
                .animation(.easeInOut(duration: 0.25), value: viewModel.newPassword.isEmpty)

            Divider()
            secureField(
                loc.t("settings.confirmPassword"),
                systemImage: "checkmark.shield",
                placeholder: loc.t("settings.confirmPassword"),
                text: $viewModel.confirmPassword,
                contentType: .newPassword,
                isRevealed: $showConfirmPassword
            )

            // A typo in the new password would otherwise lock the account out
            // silently, so the button stays disabled until both entries agree.
            // The hint waits for the user to have typed something here — an
            // empty confirmation is not yet a wrong answer.
            if !viewModel.passwordsMatch {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .foregroundStyle(Color.qkBurgundy)
                    Text(loc.t("password.mismatch"))
                        .font(.footnote)
                        .foregroundStyle(Color.qkBurgundy)
                }
                .transition(.opacity)
            }

            if let passwordError = viewModel.passwordError {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(Color.qkBurgundy)
                    Text(passwordError)
                        .font(.footnote)
                        .foregroundStyle(Color.qkInk)
                }
            } else if viewModel.didChangePassword {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Color.qkBurgundy)
                    Text(loc.t("settings.passwordUpdated"))
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Color.qkInk)
                }
                .transition(.opacity)
            }

            updatePasswordButton
        }
        .padding(18)
        .qkCard(lifts: false)
        .animation(.easeInOut(duration: 0.2), value: viewModel.didChangePassword)
        .animation(.easeInOut(duration: 0.2), value: viewModel.passwordError)
        .animation(.easeInOut(duration: 0.2), value: viewModel.passwordsMatch)
    }

    private var updatePasswordButton: some View {
        Button {
            Task { await viewModel.changePassword() }
        } label: {
            QKPrimaryButtonLabel(
                title: loc.t("settings.updatePassword"),
                isLoading: viewModel.isChangingPassword
            )
            .opacity(viewModel.canChangePassword ? 1 : 0.5)
        }
        .buttonStyle(QKPressStyle())
        .disabled(!viewModel.canChangePassword)
    }

    private func secureField(
        _ label: String,
        systemImage: String,
        placeholder: String,
        text: Binding<String>,
        contentType: UITextContentType,
        isRevealed: Binding<Bool>
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(label, systemImage: systemImage)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.qkMuted)
            HStack(spacing: 10) {
                Group {
                    if isRevealed.wrappedValue {
                        TextField(placeholder, text: text)
                    } else {
                        SecureField(placeholder, text: text)
                    }
                }
                .textContentType(contentType)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled(true)
                .foregroundStyle(Color.qkInk)
                Button {
                    isRevealed.wrappedValue.toggle()
                } label: {
                    Image(systemName: isRevealed.wrappedValue ? "eye.slash" : "eye")
                        .foregroundStyle(Color.qkMuted)
                        .frame(width: 18)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(loc.t(isRevealed.wrappedValue ? "auth.hidePassword" : "auth.showPassword"))
            }
            .padding(.horizontal, 14)
            .frame(height: 48)
            .background(Color.qkCream)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color.qkInk.opacity(0.1), lineWidth: 1)
            )
        }
    }

    // MARK: - Face ID / Touch ID

    /// Quick-sign-in toggle. ON stores the current session in the Keychain (after
    /// a confirming biometric scan) so the sign-in screen offers "Sign in with
    /// Face ID"; OFF clears it. Only shown when the device supports biometrics.
    private var securityCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(loc.t("settings.security"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.qkInk)

            HStack(spacing: 12) {
                Image(systemName: biometricKind.symbol)
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(Color.qkBurgundy)
                    .frame(width: 30)
                VStack(alignment: .leading, spacing: 2) {
                    Text(String(format: loc.t("biometric.signInWith"), biometricKind.displayName))
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.qkInk)
                    Text(loc.t("settings.biometric.subtitle"))
                        .font(.caption)
                        .foregroundStyle(Color.qkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                Toggle("", isOn: biometricBinding)
                    .labelsHidden()
                    .tint(.qkBurgundy)
            }
        }
        .padding(18)
        .qkCard(lifts: false)
    }

    /// Intercepts the toggle: flipping ON runs a confirming biometric scan + stores
    /// the session; flipping OFF clears it. The switch only follows `biometricOn`
    /// (set after the work completes), so it never flips until the change took.
    private var biometricBinding: Binding<Bool> {
        Binding(
            get: { biometricOn },
            set: { wantsOn in
                if wantsOn { enableBiometric() } else { disableBiometric() }
            }
        )
    }

    private func enableBiometric() {
        Task {
            let ok = await BiometricAuth.shared.authenticate(reason: loc.t("biometric.reason"))
            guard ok, let token = auth.currentToken, let user = auth.user else {
                biometricOn = false   // couldn't confirm / no live session → stay off
                return
            }
            BiometricAuth.shared.storeSession(token: token, user: user)
            biometricOn = true
        }
    }

    private func disableBiometric() {
        BiometricAuth.shared.clearStoredSession()
        biometricOn = false
    }

    private func errorBanner(_ message: String, retry: Bool) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color.qkBurgundy)
            Text(message)
                .font(.footnote)
                .foregroundStyle(Color.qkInk)
            Spacer()
            if retry {
                Button(loc.t("common.retry")) { Task { await viewModel.load() } }
                    .font(.footnote.weight(.semibold))
                    .tint(.qkBurgundy)
            }
        }
        .padding(14)
        .background(Color.qkTan)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    // MARK: - Derived values

    /// Whether the signed-in user is a host (gold avatar accent, matching the
    /// Profile tab). Reads the server's `is_host` — the same flag every host
    /// surface gates on — not the derived `role` string.
    private var isHost: Bool {
        auth.user?.isHost ?? false
    }

    /// Initials shown behind the avatar when no photo is set. Prefers the edited
    /// name, then the cached session name / email local-part.
    private var avatarInitials: String {
        let source: String
        let typed = viewModel.fullName.trimmingCharacters(in: .whitespacesAndNewlines)
        if !typed.isEmpty {
            source = typed
        } else if let name = auth.user?.fullName?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !name.isEmpty {
            source = name
        } else if let email = auth.user?.email, let local = email.split(separator: "@").first {
            source = String(local)
        } else {
            return "?"
        }
        let parts = source.split(separator: " ").prefix(2).compactMap { $0.first }
        let result = String(parts).uppercased()
        return result.isEmpty ? "?" : result
    }
}
