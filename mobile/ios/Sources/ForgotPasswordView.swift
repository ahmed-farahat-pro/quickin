import SwiftUI

/// Password-reset flow, presented as a sheet from `AuthView`'s sign-in screen.
///
/// Two steps:
///   1. **Request** — enter the account email → `POST /api/auth/forgot-password`
///      emails a 6-digit code.
///   2. **Reset** — enter the 6-digit code + a new password →
///      `POST /api/auth/reset-password` returns `{ token, user }`. On success the
///      session is stored by `AuthStore` (the user is signed in) and the sheet
///      dismisses.
///
/// Themed in the QuickIn boutique palette (burgundy / cream / tan) to match
/// `AuthView` and `OTPVerificationView`.
struct ForgotPasswordView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var loc: LocalizationManager
    @Environment(\.dismiss) private var dismiss

    /// Pre-fill the email with whatever the user already typed on the sign-in
    /// screen, so they rarely have to retype it.
    let initialEmail: String

    /// Called once the reset succeeds and a session is established, so the
    /// presenter (`AuthView`) can react (it dismisses on `auth.isAuthenticated`).
    var onReset: () -> Void = {}

    private enum Step { case request, reset }

    private let codeLength = 6

    @State private var step: Step = .request
    @State private var email: String
    @State private var code = ""
    @State private var newPassword = ""
    @State private var showPassword = false
    /// The new password typed a second time. A typo here would lock the account
    /// out with no way back except another reset, so it's asked for twice.
    @State private var confirmPassword = ""
    @State private var showConfirmPassword = false
    @FocusState private var codeFocused: Bool
    @FocusState private var emailFocused: Bool

    /// Set once the user has left the email field with something typed. Until
    /// then we stay quiet — nagging about a malformed address while it's still
    /// being typed reads as broken. Same behaviour as `AuthView`.
    @State private var emailTouched = false

    init(initialEmail: String, onReset: @escaping () -> Void = {}) {
        self.initialEmail = initialEmail
        self.onReset = onReset
        _email = State(initialValue: initialEmail)
    }

    /// The inline hint under the email field: shown only once the user has
    /// committed a non-empty address we would refuse. The sentence names the
    /// actual problem, so `layla@gmail.con` — which used to sail through and
    /// leave the user waiting for a code that could never be delivered — comes
    /// back as "“.con” isn't a valid domain extension. Did you mean
    /// layla@gmail.com?".
    ///
    /// `isValid` tolerates a disposable domain on purpose: a reset only ever
    /// mails an account that already exists, so refusing one here would strand
    /// whoever signed up before the blocklist. Sign-up is where that gate is.
    private var emailError: String? {
        guard emailTouched, !EmailRules.normalized(email).isEmpty,
              !EmailRules.isValid(email), let problem = EmailRules.problem(with: email) else {
            return nil
        }
        return EmailRules.message(for: problem, in: email)
    }

    private var canSend: Bool {
        // A malformed address can never receive a reset code — gate the button
        // on the format, not just on the field being non-empty.
        EmailRules.isValid(email) && !auth.isLoading
    }

    private var canReset: Bool {
        code.count == codeLength
            && PasswordRules.meetsMin(newPassword)
            && confirmPassword == newPassword
            && !auth.isLoading
    }

    /// True while the confirmation contradicts the new password. Empty is not a
    /// mismatch — the hint waits until the user has typed something there.
    private var passwordsMismatch: Bool {
        !confirmPassword.isEmpty && confirmPassword != newPassword
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient.qkPageWash.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 24) {
                        header
                        switch step {
                        case .request: requestCard
                        case .reset:   resetCard
                        }
                        if let error = auth.errorMessage {
                            Text(error)
                                .font(.footnote)
                                .foregroundStyle(Color.qkBurgundy)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: .infinity, alignment: .center)
                                .transition(.opacity)
                        }
                        primaryButton
                        if step == .reset {
                            resendRow
                        }
                        Spacer(minLength: 8)
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 32)
                    .padding(.bottom, 32)
                    .frame(maxWidth: 480)
                    .frame(maxWidth: .infinity)
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .navigationTitle("Reset password")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.qkCream, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .tint(.qkBurgundy)
                }
            }
            .tint(.qkBurgundy)
            // Leaving the email field (tapping elsewhere, hitting return,
            // dismissing the keyboard) is what arms the format hint.
            .onChange(of: emailFocused) { _, focused in
                if !focused && !EmailRules.normalized(email).isEmpty {
                    emailTouched = true
                }
            }
            .animation(.easeInOut(duration: 0.2), value: step)
            .animation(.easeInOut(duration: 0.2), value: auth.errorMessage)
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: 10) {
            Image(systemName: step == .request ? "lock.rotation" : "envelope.badge")
                .font(.system(size: 40, weight: .regular))
                .foregroundStyle(Color.qkBurgundy)
                .padding(.bottom, 2)
            Text(step == .request ? "Forgot your password?" : "Enter your code")
                .font(.system(.title2, design: .serif).weight(.semibold))
                .foregroundStyle(Color.qkInk)
            Text(step == .request
                 ? "Enter your email and we'll send you a 6-digit reset code."
                 : "We sent a 6-digit code to \(email). Enter it with a new password.")
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
                .multilineTextAlignment(.center)
        }
    }

    // MARK: - Step 1: request code

    private var requestCard: some View {
        VStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Email")
                    .font(.caption).fontWeight(.semibold)
                    .foregroundStyle(Color.qkMuted)
                HStack(spacing: 10) {
                    Image(systemName: "envelope")
                        .foregroundStyle(emailError == nil ? Color.qkMuted : Color.qkBurgundy)
                        .frame(width: 18)
                    TextField("layla@email.com", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                        .foregroundStyle(Color.qkInk)
                        .focused($emailFocused)
                        .submitLabel(.send)
                        .onSubmit { Task { await primaryAction() } }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(Color.qkCream)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(
                            emailError == nil ? Color.clear : Color.qkBurgundy.opacity(0.55),
                            lineWidth: emailError == nil ? 0 : 1.5
                        )
                )
                // Inline validation hint, matching AuthView's email field.
                if let emailError {
                    Text(emailError)
                        .font(.caption)
                        .foregroundStyle(Color.qkBurgundy)
                        .fixedSize(horizontal: false, vertical: true)
                        .transition(.opacity)
                }
            }
            .animation(.easeInOut(duration: 0.2), value: emailError)
        }
        .padding(18)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: Color.black.opacity(0.05), radius: 12, x: 0, y: 6)
    }

    // MARK: - Step 2: code + new password

    private var resetCard: some View {
        VStack(spacing: 16) {
            // Six boxed digits backed by a single hidden numeric field.
            VStack(alignment: .leading, spacing: 6) {
                Text("Reset code")
                    .font(.caption).fontWeight(.semibold)
                    .foregroundStyle(Color.qkMuted)
                ZStack {
                    TextField("", text: $code)
                        .keyboardType(.numberPad)
                        .textContentType(.oneTimeCode)
                        .focused($codeFocused)
                        .foregroundStyle(.clear)
                        .tint(.clear)
                        .accentColor(.clear)
                        .opacity(0.02)
                        .onChange(of: code) { _, newValue in
                            let digits = newValue.filter(\.isNumber)
                            let trimmed = String(digits.prefix(codeLength))
                            if trimmed != code { code = trimmed }
                        }

                    HStack(spacing: 10) {
                        ForEach(0..<codeLength, id: \.self) { index in
                            digitBox(at: index)
                        }
                    }
                    .allowsHitTesting(false)
                }
                .contentShape(Rectangle())
                .onTapGesture { codeFocused = true }
            }

            // New password with an eye toggle, matching AuthView.
            VStack(alignment: .leading, spacing: 6) {
                passwordField(
                    title: "New password",
                    placeholder: "At least 8 characters",
                    systemImage: "lock",
                    text: $newPassword,
                    isRevealed: $showPassword
                )

                PasswordStrengthView(password: newPassword)
                    .animation(.easeInOut(duration: 0.25), value: newPassword.isEmpty)
            }

            // Typed again, because a typo in a password the user has never used
            // before locks them out until they run this whole flow a second time.
            VStack(alignment: .leading, spacing: 6) {
                passwordField(
                    title: loc.t("auth.confirmPassword"),
                    placeholder: loc.t("auth.confirmPassword"),
                    systemImage: "checkmark.shield",
                    text: $confirmPassword,
                    isRevealed: $showConfirmPassword,
                    isError: passwordsMismatch
                )

                if passwordsMismatch {
                    Text(loc.t("password.mismatch"))
                        .font(.caption)
                        .foregroundStyle(Color.qkBurgundy)
                        .fixedSize(horizontal: false, vertical: true)
                        .transition(.opacity)
                }
            }
            .animation(.easeInOut(duration: 0.2), value: passwordsMismatch)
        }
        .padding(18)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: Color.black.opacity(0.05), radius: 12, x: 0, y: 6)
    }

    /// A labelled password box with the AuthView eye toggle. `isError` tints the
    /// border burgundy for the confirm field's mismatch state.
    private func passwordField(
        title: String,
        placeholder: String,
        systemImage: String,
        text: Binding<String>,
        isRevealed: Binding<Bool>,
        isError: Bool = false
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption).fontWeight(.semibold)
                .foregroundStyle(Color.qkMuted)
            HStack(spacing: 10) {
                Image(systemName: systemImage)
                    .foregroundStyle(isError ? Color.qkBurgundy : Color.qkMuted)
                    .frame(width: 18)
                Group {
                    if isRevealed.wrappedValue {
                        TextField(placeholder, text: text)
                    } else {
                        SecureField(placeholder, text: text)
                    }
                }
                .textContentType(.newPassword)
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
                .accessibilityLabel(isRevealed.wrappedValue ? "Hide password" : "Show password")
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.qkCream)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(
                        isError ? Color.qkBurgundy.opacity(0.55) : Color.clear,
                        lineWidth: 1.5
                    )
            )
        }
    }

    private func digitBox(at index: Int) -> some View {
        let characters = Array(code)
        let hasDigit = index < characters.count
        let isCurrent = index == characters.count && codeFocused
        return Text(hasDigit ? String(characters[index]) : "")
            .font(.system(size: 24, weight: .semibold, design: .rounded))
            .foregroundStyle(Color.qkInk)
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .background(Color.qkCream)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(
                        isCurrent ? Color.qkBurgundy : Color.qkInk.opacity(0.12),
                        lineWidth: isCurrent ? 2 : 1
                    )
            )
    }

    // MARK: - Primary button

    private var primaryButton: some View {
        let enabled = step == .request ? canSend : canReset
        return Button {
            Task { await primaryAction() }
        } label: {
            QKPrimaryButtonLabel(
                title: step == .request ? "Send reset code" : "Reset password",
                isLoading: auth.isLoading
            )
            .opacity(enabled ? 1 : 0.5)
        }
        .buttonStyle(QKPressStyle())
        .disabled(!enabled)
    }

    // MARK: - Resend (step 2)

    private var resendRow: some View {
        HStack(spacing: 4) {
            Text("Didn't get it?")
                .font(.footnote)
                .foregroundStyle(Color.qkMuted)
            Button {
                Task { await resend() }
            } label: {
                Text("Send a new code")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Color.qkBurgundy)
            }
            .disabled(auth.isLoading)
        }
    }

    // MARK: - Actions

    private func primaryAction() async {
        switch step {
        case .request:
            // Guard again at the call site: the button is disabled for a
            // malformed address, but the keyboard's return key shouldn't be
            // able to slip one past. Surface the hint instead of calling out.
            guard let email = validatedEmail() else { return }
            let sent = await auth.forgotPassword(email: email)
            if sent {
                step = .reset
                codeFocused = true
            }
        case .reset:
            guard let email = validatedEmail() else { return }
            let outcome = await auth.resetPassword(
                email: email,
                code: code,
                password: newPassword
            )
            if outcome == .authenticated {
                onReset()
                dismiss()
            }
        }
    }

    private func resend() async {
        guard let email = validatedEmail() else { return }
        let sent = await auth.forgotPassword(email: email)
        if sent {
            code = ""
            codeFocused = true
        }
    }

    /// The trimmed address to send, or `nil` when it's malformed — in which
    /// case the inline hint is armed so the user sees why nothing happened.
    private func validatedEmail() -> String? {
        let trimmed = EmailRules.normalized(email)
        guard EmailRules.isValid(trimmed) else {
            emailTouched = true
            emailFocused = true
            return nil
        }
        return trimmed
    }
}

#Preview {
    ForgotPasswordView(initialEmail: "layla@email.com")
        .environmentObject(AuthStore())
        .environmentObject(LocalizationManager.shared)
}
