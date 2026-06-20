import SwiftUI

/// Email one-time-code verification screen.
///
/// Presented after a successful `/signup` (which returns `{ pending: true }`
/// with no token) or when `/login` reports the email is not yet verified. The
/// user enters the 6-digit code emailed to them; on success the returned
/// `{ token, user }` is stored by `AuthStore` and the app shows them signed in.
///
/// Themed in the QuickIn boutique palette (burgundy / cream / tan) to match
/// `AuthView`.
struct OTPVerificationView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var loc: LocalizationManager

    /// The email the code was sent to. Fixed for the lifetime of the screen.
    let email: String

    /// An optional referral code captured at signup, forwarded to `verifyOTP`
    /// so the new account is credited to the referring friend. `nil` for the
    /// unverified-login path (where no signup referral was entered).
    var referralCode: String? = nil

    /// Called once verification succeeds and a session is established, so the
    /// presenter (e.g. `AuthView`) can dismiss this screen.
    var onVerified: () -> Void = {}

    private let codeLength = 6

    @State private var code = ""
    @FocusState private var fieldFocused: Bool
    @State private var didResend = false
    @State private var resendCooldown = 0

    private var canVerify: Bool {
        code.count == codeLength && !auth.isLoading
    }

    var body: some View {
        ZStack {
            LinearGradient.qkPageWash.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 24) {
                    header
                    codeCard
                    if let error = auth.errorMessage {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(Color.qkBurgundy)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .transition(.opacity)
                    }
                    verifyButton
                    resendRow
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
        .animation(.easeInOut(duration: 0.2), value: auth.errorMessage)
        .animation(.easeInOut(duration: 0.2), value: didResend)
        .onAppear { fieldFocused = true }
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: 10) {
            Image(systemName: "envelope.badge")
                .font(.system(size: 40, weight: .regular))
                .foregroundStyle(Color.qkBurgundy)
                .padding(.bottom, 2)
            Text(loc.t("otp.title"))
                .font(.system(.title2, design: .serif).weight(.semibold))
                .foregroundStyle(Color.qkInk)
            Text(loc.t("otp.subtitle"))
                .font(.subheadline)
                .foregroundStyle(Color.qkMuted)
                .multilineTextAlignment(.center)
            Text(email)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.qkInk)
                .multilineTextAlignment(.center)
        }
    }

    // MARK: - Code entry

    /// A tappable card showing six boxed digits backed by a single hidden
    /// numeric field. Tapping anywhere focuses the field.
    private var codeCard: some View {
        VStack(spacing: 14) {
            ZStack {
                // Hidden text field that actually captures input.
                TextField("", text: $code)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .focused($fieldFocused)
                    .foregroundStyle(.clear)
                    .tint(.clear)
                    .accentColor(.clear)
                    .opacity(0.02)
                    .onChange(of: code) { _, newValue in
                        // Keep digits only, clamp to the code length.
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
            .onTapGesture { fieldFocused = true }
        }
        .padding(18)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: Color.black.opacity(0.05), radius: 12, x: 0, y: 6)
    }

    private func digitBox(at index: Int) -> some View {
        let characters = Array(code)
        let hasDigit = index < characters.count
        let isCurrent = index == characters.count && fieldFocused
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

    // MARK: - Verify

    private var verifyButton: some View {
        Button {
            Task { await verify() }
        } label: {
            QKPrimaryButtonLabel(title: loc.t("otp.verify"), isLoading: auth.isLoading)
                .opacity(canVerify ? 1 : 0.5)
        }
        .buttonStyle(QKPressStyle())
        .disabled(!canVerify)
    }

    // MARK: - Resend

    private var resendRow: some View {
        VStack(spacing: 6) {
            HStack(spacing: 4) {
                Text(loc.t("otp.didntGet"))
                    .font(.footnote)
                    .foregroundStyle(Color.qkMuted)
                if resendCooldown > 0 {
                    Text(verbatim: "Resend in \(resendCooldown)s")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Color.qkMuted)
                } else {
                    Button {
                        Task { await resend() }
                    } label: {
                        Text(loc.t("otp.resend"))
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Color.qkBurgundy)
                    }
                    .disabled(auth.isLoading)
                }
            }
            if didResend {
                Text(loc.t("otp.resent"))
                    .font(.caption2)
                    .foregroundStyle(Color.qkMuted)
                    .transition(.opacity)
            }
        }
    }

    // MARK: - Actions

    private func verify() async {
        let outcome = await auth.verifyOTP(email: email, code: code, referralCode: referralCode)
        if outcome == .authenticated {
            onVerified()
        }
    }

    private func resend() async {
        didResend = false
        let ok = await auth.resendOTP(email: email)
        if ok {
            code = ""
            didResend = true
            fieldFocused = true
            startCooldown()
        }
    }

    /// 30-second countdown that disables Resend (mirrors the server's resend cooldown).
    private func startCooldown() {
        resendCooldown = 30
        Task {
            while resendCooldown > 0 {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                await MainActor.run { if resendCooldown > 0 { resendCooldown -= 1 } }
            }
        }
    }
}

#Preview {
    OTPVerificationView(email: "layla@email.com")
        .environmentObject(AuthStore())
        .environmentObject(LocalizationManager.shared)
}
