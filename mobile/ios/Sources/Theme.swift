import SwiftUI

/// QuickIn boutique palette — mirrors the web app's design tokens.
enum Theme {
    static let burgundy = Color(red: 0x5B / 255, green: 0x0F / 255, blue: 0x16 / 255)
    static let cream    = Color(red: 0xF6 / 255, green: 0xF1 / 255, blue: 0xE6 / 255)
    static let tan      = Color(red: 0xEF / 255, green: 0xE6 / 255, blue: 0xD8 / 255)
    static let ink      = Color(red: 0x2A / 255, green: 0x22 / 255, blue: 0x20 / 255)
    static let muted    = Color(red: 0x6B / 255, green: 0x60 / 255, blue: 0x55 / 255)
}

extension Color {
    static let qkBurgundy = Theme.burgundy
    static let qkCream    = Theme.cream
    static let qkTan      = Theme.tan
    static let qkInk      = Theme.ink
    static let qkMuted    = Theme.muted
}
