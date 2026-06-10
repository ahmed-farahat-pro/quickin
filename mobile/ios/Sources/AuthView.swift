import SwiftUI
import AuthenticationServices

/// The authentication screen: email sign in / sign up plus **real** native
/// "Sign in with Apple" and "Continue with Google" social options.
struct AuthView: View {
    @EnvironmentObject private var auth: AuthStore

    private enum Mode: String, CaseIterable {
        case signIn = "Sign In"
        case signUp = "Sign Up"
    }

    @State private var mode: Mode = .signIn
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""

    private var isSignUp: Bool { mode == .signUp }

    private var canSubmit: Bool {
        guard !email.trimmingCharacters(in: .whitespaces).isEmpty,
              password.count >= 1 else { return false }
        if isSignUp {
            return !name.trimmingCharacters(in: .whitespaces).isEmpty
        }
        return true
    }

    var body: some View {
        ZStack {
            Color.qkCream.ignoresSafeArea()

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
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: 10) {
            Image("logo")
                .resizable()
                .scaledToFit()
                .frame(height: 56)
            Text("Boutique stays, booked in a tap.")
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
        }
        .padding(.bottom, 4)
    }

    // MARK: - Mode picker

    private var modePicker: some View {
        Picker("Mode", selection: $mode) {
            ForEach(Mode.allCases, id: \.self) { m in
                Text(m.rawValue).tag(m)
            }
        }
        .pickerStyle(.segmented)
    }

    // MARK: - Form

    private var formCard: some View {
        VStack(spacing: 14) {
            if isSignUp {
                field(
                    title: "Full name",
                    text: $name,
                    placeholder: "Layla Hassan",
                    systemImage: "person",
                    contentType: .name
                )
            }
            field(
                title: "Email",
                text: $email,
                placeholder: "layla@email.com",
                systemImage: "envelope",
                contentType: .emailAddress,
                keyboard: .emailAddress
            )
            secureField(
                title: "Password",
                text: $password,
                placeholder: "••••••••",
                systemImage: "lock"
            )
        }
        .padding(18)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: Color.black.opacity(0.05), radius: 12, x: 0, y: 6)
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
        }
    }

    private func secureField(
        title: String,
        text: Binding<String>,
        placeholder: String,
        systemImage: String
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption).fontWeight(.semibold)
                .foregroundStyle(Color.qkMuted)
            HStack(spacing: 10) {
                Image(systemName: systemImage)
                    .foregroundStyle(Color.qkMuted)
                    .frame(width: 18)
                SecureField(placeholder, text: text)
                    .textContentType(isSignUp ? .newPassword : .password)
                    .foregroundStyle(Color.qkInk)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.qkCream)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }

    // MARK: - Primary button

    private var primaryButton: some View {
        Button {
            Task { await submit() }
        } label: {
            ZStack {
                if auth.isLoading {
                    ProgressView()
                        .tint(.white)
                } else {
                    Text(isSignUp ? "Create account" : "Sign in")
                        .fontWeight(.semibold)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(Color.qkBurgundy.opacity(canSubmit && !auth.isLoading ? 1 : 0.5))
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .disabled(!canSubmit || auth.isLoading)
    }

    // MARK: - Divider

    private var orDivider: some View {
        HStack(spacing: 12) {
            Rectangle().fill(Color.qkInk.opacity(0.12)).frame(height: 1)
            Text("or")
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
                    Text("Continue with Google")
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
                Text("Add your Google iOS client id in Config.swift to enable Google sign-in")
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
            await auth.signup(name: name, email: email, password: password)
        } else {
            await auth.login(email: email, password: password)
        }
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
                    "id_token": idToken,
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
}
