import SwiftUI
import AuthenticationServices

/// The authentication screen: email sign in / sign up plus **real** native
/// "Sign in with Apple" and "Continue with Google" social options.
struct AuthView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var loc: LocalizationManager

    private enum Mode: String, CaseIterable {
        case signIn
        case signUp
    }

    @State private var mode: Mode = .signIn
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false
    /// Optional referral code entered at signup, forwarded to OTP verification.
    @State private var referralCode = ""
    /// Country the new user is from (English display name), sent with the
    /// signup request. Optional — empty means "not provided".
    @State private var country = ""

    /// Identifiable wrapper so the OTP email can drive a `fullScreenCover(item:)`.
    /// Carries an optional `referralCode` captured at signup so it survives the
    /// hand-off to the OTP screen.
    private struct OTPSession: Identifiable {
        let email: String
        let referralCode: String?
        var id: String { email }
    }

    /// When non-nil, the OTP verification screen is presented for this email
    /// (set after a `pending` signup or an unverified-email login).
    @State private var otpSession: OTPSession?

    /// Drives the forgot-password reset sheet (sign-in mode only).
    @State private var showForgotPassword = false

    // MARK: Biometric sign-in state

    /// What this device supports (Face ID / Touch ID / none). Resolved on appear.
    @State private var biometricKind: BiometricAuth.Kind = .none
    /// Whether a biometric session is on file (shows the unlock button).
    @State private var hasStoredBiometric = false
    /// Drives the post-login "Enable Face ID?" confirmation dialog.
    @State private var showEnableBiometric = false
    /// The freshly-authenticated session held until the user accepts/declines
    /// the enable-biometric prompt (so we can store it on accept).
    @State private var pendingBiometricSession: (token: String, user: AuthUser)?

    private var isSignUp: Bool { mode == .signUp }

    /// Whether to offer the "Sign in with Face ID" button: only in sign-in mode,
    /// when the device supports biometrics and a session is stored.
    private var canUseBiometricSignIn: Bool {
        !isSignUp && biometricKind != .none && hasStoredBiometric
    }

    private var canSubmit: Bool {
        guard !email.trimmingCharacters(in: .whitespaces).isEmpty else { return false }
        if isSignUp {
            // New account: require a name + a password that clears the strength bar.
            return !name.trimmingCharacters(in: .whitespaces).isEmpty
                && PasswordRules.meetsMin(password)
        }
        // Sign-in just needs a non-empty password; strength is enforced at signup.
        return password.count >= 1
    }

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 24) {
                    header
                    modePicker
                    formCard
                    if let error = auth.errorMessage {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(Color.qkBurgundy)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .transition(.opacity)
                    }
                    primaryButton
                    if canUseBiometricSignIn {
                        biometricButton
                    }
                    orDivider
                    socialButtons
                    Spacer(minLength: 8)
                }
                .padding(.horizontal, 24)
                .padding(.top, 56)
                .padding(.bottom, 32)
                .frame(maxWidth: 480)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .tint(.qkBurgundy)
        .animation(.easeInOut(duration: 0.2), value: mode)
        .animation(.easeInOut(duration: 0.2), value: auth.errorMessage)
        // OTP verification step. Presented after a `pending` signup or when a
        // login reports the email still needs verification.
        .fullScreenCover(item: $otpSession) { session in
            OTPVerificationView(email: session.email, referralCode: session.referralCode) {
                // Verified: AuthStore now holds the session. Dismiss the OTP
                // cover; the parent sheet auto-dismisses on `isAuthenticated`.
                otpSession = nil
            }
            .environmentObject(auth)
        }
        // Forgot-password reset flow (request code → reset). On success it
        // stores the session; the presenting sheet dismisses on `isAuthenticated`.
        .sheet(isPresented: $showForgotPassword) {
            ForgotPasswordView(initialEmail: email)
                .environmentObject(auth)
                .environmentObject(loc)
        }
        .animation(.easeInOut(duration: 0.2), value: canUseBiometricSignIn)
        // Resolve biometric capability + whether a session is stored each time
        // the screen appears (covers returning after a logout).
        .onAppear {
            refreshBiometricState()
            // CLI screenshot hook: force-present the enable-Face ID sheet so its
            // design can be captured without enrolling biometrics + logging in.
            if UserDefaults.standard.bool(forKey: "uitestBioSheet") {
                biometricKind = .faceID
                showEnableBiometric = true
            }
            // CLI screenshot hook: force the "Sign in with Face ID" button visible.
            if UserDefaults.standard.bool(forKey: "uitestBioButton") {
                biometricKind = .faceID
                hasStoredBiometric = true
            }
        }
        // Offer to enable Face ID / Touch ID after a fresh password login — a
        // custom boutique sheet (not the stock iOS dialog). Either choice commits
        // the staged session so the user finishes signing in.
        .overlay {
            if showEnableBiometric {
                BiometricEnableSheet(
                    kind: biometricKind,
                    onEnable: {
                        if let session = pendingBiometricSession {
                            BiometricAuth.shared.storeSession(token: session.token, user: session.user)
                            hasStoredBiometric = true
                        }
                        showEnableBiometric = false
                        finishAuthenticated()
                    },
                    onLater: {
                        showEnableBiometric = false
                        finishAuthenticated()
                    }
                )
                .environmentObject(loc)
                .transition(.opacity)
                .zIndex(30)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: showEnableBiometric)
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: 10) {
            Image("logo")
                .resizable()
                .scaledToFit()
                .frame(height: 56)
            Text(loc.t("auth.tagline"))
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
        }
        .padding(.bottom, 4)
    }

    // MARK: - Mode picker

    private var modePicker: some View {
        Picker("Mode", selection: $mode) {
            ForEach(Mode.allCases, id: \.self) { m in
                Text(loc.t(m == .signIn ? "auth.signIn" : "auth.signUp")).tag(m)
            }
        }
        .pickerStyle(.segmented)
    }

    // MARK: - Form

    private var formCard: some View {
        VStack(spacing: 14) {
            if isSignUp {
                field(
                    title: loc.t("auth.fullName"),
                    text: $name,
                    placeholder: loc.t("auth.fullName.placeholder"),
                    systemImage: "person",
                    contentType: .name
                )
            }
            field(
                title: loc.t("auth.email"),
                text: $email,
                placeholder: "layla@email.com",
                systemImage: "envelope",
                contentType: .emailAddress,
                keyboard: .emailAddress
            )
            secureField(
                title: loc.t("auth.password"),
                text: $password,
                placeholder: "••••••••",
                systemImage: "lock",
                isRevealed: $showPassword
            )
            if isSignUp {
                PasswordStrengthView(password: password)
                    .animation(.easeInOut(duration: 0.25), value: password.isEmpty)
                CountryPickerField(
                    selection: $country,
                    title: loc.t("signup.country"),
                    systemImage: "globe"
                )
                field(
                    title: loc.t("referral.signupField"),
                    text: $referralCode,
                    placeholder: loc.t("referral.signupPlaceholder"),
                    systemImage: "gift"
                )
            }
            if !isSignUp {
                Button {
                    auth.setError(nil)
                    showForgotPassword = true
                } label: {
                    Text(loc.t("auth.forgotPassword"))
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Color.qkBurgundy)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }
                .buttonStyle(.plain)
                .disabled(auth.isLoading)
            }
        }
        .padding(18)
        .qkCard(lifts: false)
    }

    private func field(
        title: String,
        text: Binding<String>,
        placeholder: String,
        systemImage: String,
        contentType: UITextContentType? = nil,
        keyboard: UIKeyboardType = .default
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption).fontWeight(.semibold)
                .foregroundStyle(Color.qkMuted)
            HStack(spacing: 10) {
                Image(systemName: systemImage)
                    .foregroundStyle(Color.qkMuted)
                    .frame(width: 18)
                TextField(placeholder, text: text)
                    .textContentType(contentType)
                    .keyboardType(keyboard)
                    .textInputAutocapitalization(keyboard == .emailAddress ? .never : .words)
                    .autocorrectionDisabled(keyboard == .emailAddress)
                    .foregroundStyle(Color.qkInk)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.qkCream)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color.qkInk.opacity(0.1), lineWidth: 1)
            )
        }
    }

    private func secureField(
        title: String,
        text: Binding<String>,
        placeholder: String,
        systemImage: String,
        isRevealed: Binding<Bool>
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption).fontWeight(.semibold)
                .foregroundStyle(Color.qkMuted)
            HStack(spacing: 10) {
                Image(systemName: systemImage)
                    .foregroundStyle(Color.qkMuted)
                    .frame(width: 18)
                Group {
                    if isRevealed.wrappedValue {
                        TextField(placeholder, text: text)
                    } else {
                        SecureField(placeholder, text: text)
                    }
                }
                .textContentType(isSignUp ? .newPassword : .password)
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
            .padding(.vertical, 12)
            .background(Color.qkCream)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color.qkInk.opacity(0.1), lineWidth: 1)
            )
        }
    }

    // MARK: - Primary button

    private var primaryButton: some View {
        Button {
            Task { await submit() }
        } label: {
            QKPrimaryButtonLabel(
                title: loc.t(isSignUp ? "auth.createAccount" : "auth.signIn"),
                isLoading: auth.isLoading
            )
            .opacity(canSubmit && !auth.isLoading ? 1 : 0.5)
            .background(alignment: .center) {
                if canSubmit && !auth.isLoading {
                    QKPulseRing(cornerRadius: 16)
                }
            }
        }
        .buttonStyle(QKPressStyle())
        .disabled(!canSubmit || auth.isLoading)
    }

    // MARK: - Biometric sign-in button

    /// "Sign in with Face ID / Touch ID" — shown in sign-in mode when a session
    /// is stored. A bordered burgundy button with the matching SF Symbol.
    private var biometricButton: some View {
        Button {
            Task { await handleBiometricSignIn() }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: biometricKind.symbol)
                    .font(.system(size: 20, weight: .semibold))
                Text(String(format: loc.t("biometric.signInWith"), biometricKind.displayName))
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .foregroundStyle(Color.qkBurgundy)
            .background(Color.qkSurface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.qkBurgundy.opacity(0.4), lineWidth: 1.5)
            )
        }
        .buttonStyle(QKPressStyle())
        .disabled(auth.isLoading)
        .accessibilityLabel(String(format: loc.t("biometric.signInWith"), biometricKind.displayName))
    }

    // MARK: - Divider

    private var orDivider: some View {
        HStack(spacing: 12) {
            Rectangle().fill(Color.qkInk.opacity(0.12)).frame(height: 1)
            Text(loc.t("common.or"))
                .font(.footnote)
                .foregroundStyle(Color.qkMuted)
            Rectangle().fill(Color.qkInk.opacity(0.12)).frame(height: 1)
        }
        .padding(.vertical, 2)
    }

    // MARK: - Social buttons

    private var socialButtons: some View {
        VStack(spacing: 12) {
            // REAL native Sign in with Apple. Requires the "Sign in with Apple"
            // capability + an Apple Developer Team set in Xcode signing; the
            // button compiles and is fully wired and works once that is set.
            SignInWithAppleButton(.continue) { request in
                request.requestedScopes = [.fullName, .email]
            } onCompletion: { result in
                handleApple(result)
            }
            .signInWithAppleButtonStyle(.black)
            .frame(height: 52)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .disabled(auth.isLoading)

            // Continue with Google — white button, border, "G" glyph.
            // Gated on Config.googleClientID: empty → inline note (no demo call).
            Button {
                Task { await handleGoogle() }
            } label: {
                HStack(spacing: 8) {
                    Text("G")
                        .font(.system(size: 18, weight: .bold, design: .default))
                        .foregroundStyle(Color.qkBurgundy)
                    Text(loc.t("auth.continueWithGoogle"))
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(Color.white)
                .foregroundStyle(Color.qkInk)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(Color.qkInk.opacity(0.18), lineWidth: 1)
                )
            }
            .disabled(auth.isLoading)

            if Config.googleClientID.isEmpty {
                Text(loc.t("auth.googleNote"))
                    .font(.caption2)
                    .foregroundStyle(Color.qkMuted)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }
        }
        .opacity(auth.isLoading ? 0.6 : 1)
    }

    // MARK: - Actions

    private func submit() async {
        if isSignUp {
            let outcome = await auth.signup(name: name, email: email, password: password, country: country)
            await handle(outcome, session: nil)
            return
        }

        // Sign in. When the device can offer Face ID / Touch ID and no session
        // is stored yet, log in *deferred* so we can show the "Enable Face ID?"
        // prompt before the presenting sheet auto-dismisses. Otherwise use the
        // normal path (which signs in immediately).
        if biometricKind != .none && !hasStoredBiometric {
            let (outcome, session) = await auth.loginDeferred(email: email, password: password)
            await handle(outcome, session: session)
        } else {
            let outcome = await auth.login(email: email, password: password)
            await handle(outcome, session: nil)
        }
    }

    /// Route an auth outcome. When `session` is non-nil the login was deferred
    /// for the biometric opt-in prompt; otherwise the session (if any) is
    /// already live.
    private func handle(_ outcome: AuthOutcome, session: AuthSuccess?) async {
        switch outcome {
        case .authenticated:
            if let session {
                // Deferred path: stash the session and ask to enable biometrics.
                // The session is committed when the prompt is answered.
                pendingBiometricSession = (session.token, session.user)
                showEnableBiometric = true
            }
            // Non-deferred path: session is already live; the presenting sheet
            // dismisses on `auth.isAuthenticated`. Nothing to do.
        case .needsVerification(let verifyEmail):
            // For an unverified-email login, send a fresh code before showing
            // the OTP screen (signup already emailed one). Errors surface via
            // `auth.errorMessage`.
            if !isSignUp {
                await auth.resendOTP(email: verifyEmail)
            }
            // Carry the referral code only on the signup path (an unverified
            // login never entered one).
            let trimmedReferral = referralCode.trimmingCharacters(in: .whitespaces)
            otpSession = OTPSession(
                email: verifyEmail,
                referralCode: (isSignUp && !trimmedReferral.isEmpty) ? trimmedReferral : nil
            )
        case .failed:
            break
        }
    }

    /// Commit the staged session (from a deferred login) so the app advances
    /// into the signed-in experience. Called after the enable-biometric prompt
    /// is answered (enabled or not).
    private func finishAuthenticated() {
        guard let pending = pendingBiometricSession else { return }
        auth.commitDeferredSession(AuthSuccess(token: pending.token, user: pending.user))
        pendingBiometricSession = nil
    }

    /// Resolve the device's biometric capability and whether a session is on
    /// file, so the sign-in button + opt-in prompt show only when relevant.
    private func refreshBiometricState() {
        biometricKind = BiometricAuth.shared.availableKind()
        hasStoredBiometric = BiometricAuth.shared.hasStoredSession
    }

    /// Run the Face ID / Touch ID unlock: prompt → load the stored session →
    /// adopt it (signs in). On a biometric failure we stay on the form so the
    /// user can fall back to their password. If the stored session is missing
    /// we clear the button and surface a note.
    private func handleBiometricSignIn() async {
        auth.setError(nil)
        let ok = await BiometricAuth.shared.authenticate(reason: loc.t("biometric.reason"))
        guard ok else {
            // Cancel / no-match / lockout: fall back to password silently unless
            // it was an outright failure worth noting. Keep it quiet on cancel.
            return
        }
        guard let session = BiometricAuth.shared.loadStoredSession() else {
            // Stored session vanished (e.g. cleared elsewhere): hide the button.
            BiometricAuth.shared.clearStoredSession()
            hasStoredBiometric = false
            auth.setError(loc.t("biometric.sessionExpired"))
            return
        }
        // Adopt the stored token + user → signs in (sheet dismisses reactively).
        auth.adopt(token: session.token, user: session.user)
    }

    /// Handle the native Apple authorization result. On success we forward the
    /// identity token + full name (Apple only sends the name on first sign-in)
    /// to the backend `/api/auth/apple`, which verifies it and returns
    /// `{ token, user }`.
    private func handleApple(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            guard
                let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = credential.identityToken,
                let idToken = String(data: tokenData, encoding: .utf8)
            else {
                auth.setError("Apple sign-in did not return an identity token.")
                return
            }
            let fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
                .compactMap { $0 }
                .joined(separator: " ")
                .trimmingCharacters(in: .whitespaces)

            Task {
                await auth.exchangeSocial(path: "/api/auth/apple", body: [
                    "identityToken": idToken,
                    "full_name": fullName,
                ])
            }
        case .failure(let error):
            // User cancelled? Stay quiet; otherwise surface the error.
            if (error as NSError).code == ASAuthorizationError.canceled.rawValue {
                auth.setError(nil)
            } else {
                auth.setError(error.localizedDescription)
            }
        }
    }

    /// Run the real Google OAuth flow (ASWebAuthenticationSession + PKCE) and
    /// POST the resulting id_token to `/api/auth/google`. If no client id is
    /// configured we surface the inline note instead of calling anything.
    private func handleGoogle() async {
        guard !Config.googleClientID.isEmpty else {
            auth.setError("Add your Google iOS client id in Config.swift to enable Google sign-in")
            return
        }
        do {
            let result = try await GoogleSignIn.signIn()
            await auth.exchangeSocial(path: "/api/auth/google", body: [
                "id_token": result.idToken,
            ])
        } catch GoogleSignIn.SignInError.cancelled {
            auth.setError(nil)
        } catch {
            auth.setError(error.localizedDescription)
        }
    }
}

#Preview {
    AuthView()
        .environmentObject(AuthStore())
        .environmentObject(LocalizationManager.shared)
}
