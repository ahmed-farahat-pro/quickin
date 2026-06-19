import SwiftUI
import PhotosUI

/// Loads + edits the signed-in user's profile (full name, age, ID/passport,
/// phone, bio, avatar) via `GET`/`PATCH /api/local/profile`. Reachable from
/// `ProfileView`'s "Edit profile" row.
@MainActor
final class ProfileSettingsViewModel: ObservableObject {
    @Published var fullName = ""
    @Published var ageText = ""
    @Published var idDocument = ""
    @Published var phone = ""
    @Published var bio = ""
    /// Country the user is from — the English display name (matching the web).
    @Published var country = ""
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
    @Published var isChangingPassword = false
    @Published var passwordError: String?
    @Published var didChangePassword = false

    /// Both fields filled and the new one clearing the strength bar to submit.
    var canChangePassword: Bool {
        !currentPassword.isEmpty && PasswordRules.meetsMin(newPassword) && !isChangingPassword
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
    }

    /// Wipe every field + flags so a different account never momentarily shows
    /// the previous one's data. Forces the next `load()` to repopulate from the
    /// new session. Called when `auth.user?.id` changes.
    func resetForAccountChange() {
        fullName = ""
        ageText = ""
        idDocument = ""
        phone = ""
        bio = ""
        country = ""
        avatarURL = nil
        currentPassword = ""
        newPassword = ""
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
        isSaving = true
        defer { isSaving = false }
        do {
            let updated = try await ProfileService.shared.updateProfile(
                fullName: fullName.trimmingCharacters(in: .whitespacesAndNewlines),
                age: age,
                idDocument: idDocument.trimmingCharacters(in: .whitespacesAndNewlines),
                phone: phone.trimmingCharacters(in: .whitespacesAndNewlines),
                bio: bio.trimmingCharacters(in: .whitespacesAndNewlines),
                country: country.trimmingCharacters(in: .whitespacesAndNewlines),
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
            didChangePassword = true
        } catch {
            passwordError = error.localizedDescription
        }
    }

    private func apply(_ profile: Profile) {
        fullName = profile.fullName ?? ""
        ageText = profile.age.map(String.init) ?? ""
        idDocument = profile.idDocument ?? ""
        phone = profile.phone ?? ""
        bio = profile.bio ?? ""
        country = profile.country ?? ""
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
    @State private var showIDScan = false

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
            .sheet(isPresented: $showIDScan) {
                EgyptianIDScanView { detectedID in
                    viewModel.idDocument = detectedID
                }
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
                capitalization: .words
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
            field(
                loc.t("settings.id"),
                systemImage: "creditcard.fill",
                placeholder: loc.t("settings.id.placeholder"),
                text: $viewModel.idDocument,
                capitalization: .characters
            )

            // "Scan National ID" — opens the OCR sheet and pre-fills the field.
            Button {
                showIDScan = true
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "viewfinder.circle")
                        .font(.system(size: 13, weight: .semibold))
                    Text("Scan National ID")
                        .font(.system(size: 13, weight: .semibold))
                }
                .foregroundStyle(Color.qkBurgundy)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(Color.qkTan)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
            .buttonStyle(.qkTap)

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
            CountryPickerField(
                selection: $viewModel.country,
                title: loc.t("settings.country"),
                systemImage: "globe"
            )
            Divider()
            bioField
        }
        .padding(18)
        .qkCard(lifts: false)
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

    private func field(
        _ label: String,
        systemImage: String,
        placeholder: String,
        text: Binding<String>,
        contentType: UITextContentType? = nil,
        keyboard: UIKeyboardType = .default,
        capitalization: TextInputAutocapitalization = .sentences
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(label, systemImage: systemImage)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.qkMuted)
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
                        .strokeBorder(Color.qkInk.opacity(0.1), lineWidth: 1)
                )
        }
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
    /// Profile tab).
    private var isHost: Bool {
        auth.user?.role?.lowercased() == "host"
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
