import SwiftUI

/// The acknowledge gate, shown in place of the chat composer.
///
/// A moderator issued a warning about sharing contact details and the server is
/// refusing this user's messages (HTTP 409) until they confirm they have read
/// it. Nothing else notifies them — no email, no push — so this banner IS the
/// delivery, which is why it replaces the composer rather than sitting above it:
/// a notice you can ignore while still typing is not a gate.
///
/// Used by both `ChatView` (booking threads) and `ConversationChatView`
/// (pre-booking threads).
struct PolicyWarningBanner: View {
    let text: String
    let isAcknowledging: Bool
    let onAcknowledge: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(L.t("chat.warningTitle"), systemImage: "exclamationmark.triangle.fill")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(Color.qkBurgundy)

            Text(text)
                .font(.callout)
                .foregroundStyle(Color.qkInk)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)

            Button(action: onAcknowledge) {
                ZStack {
                    if isAcknowledging {
                        ProgressView().tint(.white)
                    } else {
                        Text(L.t("chat.warningAck")).font(.subheadline.weight(.bold))
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color.qkBurgundy)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .disabled(isAcknowledging)
        }
        .padding(14)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.qkBurgundy.opacity(0.35), lineWidth: 1)
        )
        .padding(.horizontal, 12)
        .padding(.top, 8)
        .padding(.bottom, 10)
    }
}
