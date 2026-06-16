import SwiftUI

/// A single trust chip — an SF Symbol + label in a tinted capsule. Used to show
/// "Verified ✓", "Superhost", "New host", etc. RTL-safe (HStack mirrors).
struct QKTrustChip: View {
    let systemImage: String
    let text: String
    /// The accent color for the icon + text + capsule tint.
    var tint: Color = .qkBurgundy

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: systemImage)
                .font(.system(size: 11, weight: .bold))
            Text(text)
                .font(.system(size: 12, weight: .bold))
                .lineLimit(1)
        }
        .foregroundStyle(tint)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(tint.opacity(0.12))
        .clipShape(Capsule())
        .overlay(Capsule().strokeBorder(tint.opacity(0.22), lineWidth: 1))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(text)
    }
}

/// A wrapping row of trust chips derived from a `TrustBadges` payload. Shows the
/// Verified / Superhost / New host chips whenever they apply; renders nothing
/// when none do (so callers can drop it in unconditionally). RTL-safe.
struct QKTrustBadgesRow: View {
    @EnvironmentObject private var loc: LocalizationManager
    let badges: TrustBadges

    var body: some View {
        if hasAny {
            // A horizontally-scrolling row keeps long chip sets on one line
            // without clipping, and mirrors correctly under RTL.
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    if badges.verified {
                        QKTrustChip(
                            systemImage: "checkmark.seal.fill",
                            text: loc.t("badge.verified"),
                            tint: .qkBurgundy
                        )
                    }
                    if badges.superhost {
                        QKTrustChip(
                            systemImage: "star.circle.fill",
                            text: loc.t("badge.superhost"),
                            tint: .qkGoldDeep
                        )
                    }
                    if badges.newHost {
                        QKTrustChip(
                            systemImage: "sparkles",
                            text: loc.t("badge.newHost"),
                            tint: .qkGoldDeep
                        )
                    }
                }
                .padding(.vertical, 1)
            }
            .scrollClipDisabled()
        }
    }

    /// Whether any of the three displayed chips apply.
    private var hasAny: Bool { badges.verified || badges.superhost || badges.newHost }
}

/// Convenience: a single "Verified host" chip driven only by a listing's
/// `hostVerified` flag, for use before/without the full public-profile fetch.
struct QKVerifiedHostChip: View {
    @EnvironmentObject private var loc: LocalizationManager

    var body: some View {
        QKTrustChip(
            systemImage: "checkmark.seal.fill",
            text: loc.t("badge.verifiedHost"),
            tint: .qkBurgundy
        )
    }
}
