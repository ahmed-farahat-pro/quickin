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
    @FocusState private var codeFocused: Bool

    init(initialEmail: String, onReset: @escaping () -> Void = {}) {
        self.initialEmail = initialEmail
        self.onReset = onReset
        _email = State(initialValue: initialEmail)
    }

    private var canSend: Bool {
        !email.trimmingCharacters(in: .whitespaces).isEmpty && !auth.isLoading
    }

    private var canReset: Bool {
        code.count == codeLength && PasswordRules.meetsMin(newPassword) && !auth.isLoading
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
                        .foregroundStyle(Color.qkMuted)
                        .frame(width: 18)
                    TextField("layla@email.com", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                        .foregroundStyle(Color.qkInk)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(Color.qkCream)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
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
                Text("New password")
                    .font(.caption).fontWeight(.semibold)
                    .foregroundStyle(Color.qkMuted)
                HStack(spacing: 10) {
                    Image(systemName: "lock")
                        .foregroundStyle(Color.qkMuted)
                        .frame(width: 18)
                    Group {
                        if showPassword {
                            TextField("At least 8 characters", text: $newPassword)
                        } else {
                            SecureField("At least 8 characters", text: $newPassword)
                        }
                    }
                    .textContentType(.newPassword)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled(true)
                    .foregroundStyle(Color.qkInk)
                    Button {
                        showPassword.toggle()
                    } label: {
                        Image(systemName: showPassword ? "eye.slash" : "eye")
                            .foregroundStyle(Color.qkMuted)
                            .frame(width: 18)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(showPassword ? "Hide password" : "Show password")
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(Color.qkCream)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                PasswordStrengthView(password: newPassword)
                    .animation(.easeInOut(duration: 0.25), value: newPassword.isEmpty)
            }
        }
        .padding(18)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: Color.black.opacity(0.05), radius: 12, x: 0, y: 6)
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
            let sent = await auth.forgotPassword(email: email.trimmingCharacters(in: .whitespaces))
            if sent {
                step = .reset
                codeFocused = true
            }
        case .reset:
            let outcome = await auth.resetPassword(
                email: email.trimmingCharacters(in: .whitespaces),
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
        let sent = await auth.forgotPassword(email: email.trimmingCharacters(in: .whitespaces))
        if sent {
            code = ""
            codeFocused = true
        }
    }
}

#Preview {
    ForgotPasswordView(initialEmail: "layla@email.com")
        .environmentObject(AuthStore())
        .environmentObject(LocalizationManager.shared)
}
