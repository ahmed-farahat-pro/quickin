import SwiftUI

/// A boutique "Enable Face ID / Touch ID" sheet shown after a successful
/// password sign-in — far nicer than the stock iOS confirmation dialog. Mirrors
/// `NotificationPrimerView`: a dim backdrop, a slide-up card, a gradient
/// biometric badge with a gold halo, three benefit rows, a burgundy CTA and a
/// quiet "Not now". `onEnable` stores the session; `onLater` just dismisses —
/// either way the caller finishes signing in.
struct BiometricEnableSheet: View {
    @EnvironmentObject private var loc: LocalizationManager
    let kind: BiometricAuth.Kind
    let onEnable: () -> Void
    let onLater: () -> Void

    @State private var appear = false

    private var benefits: [(icon: String, text: String)] {
        [
            ("bolt.fill", loc.t("biometric.b1")),
            ("lock.shield.fill", loc.t("biometric.b2")),
            ("slider.horizontal.3", loc.t("biometric.b3")),
        ]
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            // Dim backdrop — tap to dismiss (counts as "Not now").
            Color.black.opacity(appear ? 0.42 : 0)
                .ignoresSafeArea()
                .onTapGesture { onLater() }

            VStack(spacing: 0) {
                Capsule().fill(Color.qkInk.opacity(0.12))
                    .frame(width: 40, height: 5)
                    .padding(.top, 12)

                // Gradient biometric badge with a soft gold halo + scanning pulse.
                ZStack {
                    Circle().fill(Color.qkGold.opacity(0.18)).frame(width: 104, height: 104)
                    QKPulseRing(color: Color.qkGold, cornerRadius: 52, lineWidth: 2)
                        .frame(width: 96, height: 96)
                    Circle()
                        .fill(LinearGradient.qkBurgundyCTA)
                        .frame(width: 80, height: 80)
                        .shadow(color: Color.qkBurgundy.opacity(0.35), radius: 16, x: 0, y: 8)
                    Image(systemName: kind.symbol)
                        .font(.system(size: 35, weight: .semibold))
                        .foregroundStyle(Color.qkCream)
                        .scaleEffect(appear ? 1 : 0.6)
                }
                .frame(height: 110)
                .padding(.top, 14)

                Text(String(format: loc.t("biometric.enableTitle"), kind.displayName))
                    .font(.system(size: 23, weight: .bold))
                    .foregroundStyle(Color.qkInk)
                    .multilineTextAlignment(.center)
                    .padding(.top, 12)

                Text(String(format: loc.t("biometric.enableMessage"), kind.displayName))
                    .font(.system(size: 15))
                    .foregroundStyle(Color.qkMuted)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 30)
                    .padding(.top, 8)

                VStack(alignment: .leading, spacing: 13) {
                    ForEach(benefits, id: \.text) { b in
                        HStack(spacing: 13) {
                            Image(systemName: b.icon)
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(Color.qkGold)
                                .frame(width: 26, height: 26)
                                .background(Color.qkGold.opacity(0.12), in: Circle())
                            Text(b.text)
                                .font(.system(size: 14.5))
                                .foregroundStyle(Color.qkInk)
                            Spacer(minLength: 0)
                        }
                    }
                }
                .padding(.horizontal, 30)
                .padding(.top, 22)

                Button(action: onEnable) {
                    QKPrimaryButtonLabel(
                        title: String(format: loc.t("biometric.enable"), kind.displayName),
                        systemImage: kind.symbol
                    )
                }
                .buttonStyle(QKPressStyle())
                .padding(.horizontal, 22)
                .padding(.top, 26)

                Button(action: onLater) {
                    Text(loc.t("biometric.notNow"))
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.qkMuted)
                }
                .padding(.top, 12)
                .padding(.bottom, 14)
            }
            .frame(maxWidth: .infinity)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 34, style: .continuous))
            .shadow(color: Color.qkInk.opacity(0.28), radius: 34, x: 0, y: -4)
            .padding(.horizontal, 8)
            .padding(.bottom, 6)
            .offset(y: appear ? 0 : 460)
        }
        .onAppear {
            withAnimation(.timingCurve(0.22, 1, 0.36, 1, duration: 0.5)) { appear = true }
        }
    }
}
