import SwiftUI

/// A boutique, on-brand "turn on notifications" primer shown BEFORE the system
/// permission dialog — far nicer than the stock iOS alert. "Allow" then fires the
/// real OS prompt; "Not now" just dismisses. Slides up over a dimmed backdrop.
struct NotificationPrimerView: View {
    @EnvironmentObject private var loc: LocalizationManager
    let onAllow: () -> Void
    let onLater: () -> Void

    @State private var appear = false

    private var benefits: [(icon: String, text: String)] {
        [
            ("calendar.badge.checkmark", loc.t("notif.prompt.b1")),
            ("bubble.left.and.bubble.right.fill", loc.t("notif.prompt.b2")),
            ("sparkles", loc.t("notif.prompt.b3")),
        ]
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            // Dim backdrop — tap to dismiss.
            Color.black.opacity(appear ? 0.42 : 0)
                .ignoresSafeArea()
                .onTapGesture { onLater() }

            VStack(spacing: 0) {
                Capsule().fill(Color.qkInk.opacity(0.12))
                    .frame(width: 40, height: 5)
                    .padding(.top, 12)

                // Gradient bell badge with a soft gold halo.
                ZStack {
                    Circle().fill(Color.qkGold.opacity(0.18)).frame(width: 104, height: 104)
                    Circle()
                        .fill(LinearGradient.qkBurgundyCTA)
                        .frame(width: 80, height: 80)
                        .shadow(color: Color.qkBurgundy.opacity(0.35), radius: 16, x: 0, y: 8)
                    Image(systemName: "bell.badge.fill")
                        .font(.system(size: 33, weight: .semibold))
                        .foregroundStyle(Color.qkCream)
                        .scaleEffect(appear ? 1 : 0.6)
                }
                .frame(height: 110)
                .padding(.top, 14)

                Text(loc.t("notif.prompt.title"))
                    .font(.system(size: 23, weight: .bold))
                    .foregroundStyle(Color.qkInk)
                    .multilineTextAlignment(.center)
                    .padding(.top, 12)

                Text(loc.t("notif.prompt.body"))
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

                Button(action: onAllow) {
                    QKPrimaryButtonLabel(title: loc.t("notif.prompt.allow"), systemImage: "bell.fill")
                }
                .buttonStyle(QKPressStyle())
                .padding(.horizontal, 22)
                .padding(.top, 26)

                Button(action: onLater) {
                    Text(loc.t("notif.prompt.later"))
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
            .offset(y: appear ? 0 : 420)
        }
        .onAppear {
            withAnimation(.timingCurve(0.22, 1, 0.36, 1, duration: 0.5)) { appear = true }
        }
    }
}
