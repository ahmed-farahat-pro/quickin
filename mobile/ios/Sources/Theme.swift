import SwiftUI

/// QuickIn boutique palette — mirrors the web app's redesign tokens.
///
/// The redesign adds a **gold accent** (ratings, eyebrows, avatar rings,
/// premium badges) and a set of layered creams so surfaces read as stacked
/// warm paper. Burgundy stays the brand primary; ink/muted/tan are unchanged.
enum Theme {
    // Brand burgundy + ramp.
    static let burgundy      = Color(hex: 0x5B0F16)
    static let burgundyDark  = Color(hex: 0x45070D)
    static let burgundyMid   = Color(hex: 0x7A1620)
    static let burgundyLight = Color(hex: 0x8A2530)

    // Gold accent + ramp.
    static let gold      = Color(hex: 0xB07A2A)
    static let goldLight = Color(hex: 0xF3C969)
    static let goldSoft  = Color(hex: 0xD8A55A)
    static let goldDeep  = Color(hex: 0x8A5A00)

    // Ink (text) ramp.
    static let ink      = Color(hex: 0x2A2220)
    static let inkDark  = Color(hex: 0x14110F)
    static let muted    = Color(hex: 0x6B6055)
    static let mutedSoft = Color(hex: 0x9C9286)

    // Layered creams (page base → surfaces). The page background is the warm
    // base cream; cards sit on the lighter surface cream.
    static let pageBase = Color(hex: 0xE4DECF)
    static let cream    = Color(hex: 0xF6F1E6)
    static let creamRow = Color(hex: 0xFAF6EE) // row hover / nested fill
    static let cream2   = Color(hex: 0xF2EDE3)
    static let cream3   = Color(hex: 0xE9E3D6)
    static let cream4   = Color(hex: 0xE0D9C9)

    // Tan ramp.
    static let tan      = Color(hex: 0xEFE6D8)
    static let tan2     = Color(hex: 0xE7DDCB)
    static let tan3     = Color(hex: 0xD8CDB8)
    static let tan4     = Color(hex: 0xCBB9A8)

    // Status.
    static let success     = Color(hex: 0x0F5132)
    static let successSoft = Color(hex: 0x6CC295)
    static let errorCoral  = Color(hex: 0xE88A82)
}

extension Color {
    // Keep the original token names working everywhere.
    static let qkBurgundy = Theme.burgundy
    static let qkCream    = Theme.cream
    static let qkTan      = Theme.tan
    static let qkInk      = Theme.ink
    static let qkMuted    = Theme.muted

    // New redesign tokens.
    static let qkBurgundyDark  = Theme.burgundyDark
    static let qkBurgundyMid   = Theme.burgundyMid
    static let qkBurgundyLight = Theme.burgundyLight
    static let qkGold      = Theme.gold
    static let qkGoldLight = Theme.goldLight
    static let qkGoldSoft  = Theme.goldSoft
    static let qkGoldDeep  = Theme.goldDeep
    static let qkMutedSoft = Theme.mutedSoft
    static let qkPage      = Theme.pageBase
    static let qkCreamRow  = Theme.creamRow
    static let qkSurface   = Color.white
    static let qkTan2      = Theme.tan2
    static let qkTan3      = Theme.tan3
    static let qkTan4      = Theme.tan4
    static let qkSuccess   = Theme.success

    /// Hex literal (`0xRRGGBB`) → opaque `Color`.
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red:   Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue:  Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}

// MARK: - Brand gradients

extension LinearGradient {
    /// Burgundy CTA / nav header: `135deg, #5B0F16 → #8a2530`.
    static let qkBurgundyCTA = LinearGradient(
        colors: [Theme.burgundy, Theme.burgundyLight],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
    /// Burgundy panel: `135deg, #5B0F16 → #7a1620`.
    static let qkBurgundyPanel = LinearGradient(
        colors: [Theme.burgundy, Theme.burgundyMid],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
    /// Deep burgundy backdrop (confirm screen): `180deg, #5B0F16 → #45070d`.
    static let qkBurgundyDeep = LinearGradient(
        colors: [Theme.burgundy, Theme.burgundyDark],
        startPoint: .top, endPoint: .bottom
    )
    /// Gold avatar / badge: `135deg, #B07A2A → #d8a55a`.
    static let qkGoldAvatar = LinearGradient(
        colors: [Theme.gold, Theme.goldSoft],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
    /// Tan tile: `135deg, #e7ddcb → #d8cdb8`.
    static let qkTanTile = LinearGradient(
        colors: [Theme.tan2, Theme.tan3],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
    /// Warm cream page wash (radial-ish top-down): cream2 → cream3 → cream4.
    static let qkPageWash = LinearGradient(
        colors: [Theme.cream2, Theme.cream3, Theme.cream4],
        startPoint: .top, endPoint: .bottom
    )
}
