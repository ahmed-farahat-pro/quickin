package com.quickin.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// QuickIn boutique palette — mirrors the web app's redesign tokens.
// Burgundy family (primary).
val Burgundy = Color(0xFF5B0F16)
val BurgundyDark = Color(0xFF45070D)
val BurgundyDeep = Color(0xFF7A1620)
val BurgundyLight = Color(0xFF8A2530)

// Gold ACCENT — ratings, eyebrows, avatar rings, premium badges.
val Gold = Color(0xFFB07A2A)
val GoldLight = Color(0xFFF3C969)
val GoldSoft = Color(0xFFD8A55A)
val GoldDeep = Color(0xFF8A5A00)

// Ink (text).
val Ink = Color(0xFF2A2220)
val InkDark = Color(0xFF1D1916)
val Muted = Color(0xFF6B6055)
val MutedSoft = Color(0xFF9C9286)

// Layered creams. The page base is a warmer cream than the white card surfaces.
val Cream = Color(0xFFF6F1E6)        // surfaces / cards backdrop
val CreamPage = Color(0xFFE4DECF)    // page base (new, warmer)
val CreamRow = Color(0xFFFAF6EE)     // row hover / soft surface
val CreamSurface2 = Color(0xFFF2EDE3)

// Tan family.
val Tan = Color(0xFFEFE6D8)
val TanWarm = Color(0xFFE7DDCB)
val TanDeep = Color(0xFFD8CDB8)

// Status.
val SuccessGreen = Color(0xFF0F5132)
val SuccessGreenSoft = Color(0xFF6CC295)
val ErrorCoral = Color(0xFFE88A82)

// Password-strength meter ramp: red (weak) → gold (fair) → green (good) → deep green (strong).
val StrengthWeak = Color(0xFFB3261E)
val StrengthGood = Color(0xFF0F5132)
val StrengthStrong = Color(0xFF0A3D26)

private val QuickInColors = lightColorScheme(
    primary = Burgundy,
    onPrimary = Color.White,
    // Page base is the warm cream; cards/sheets use white + Cream explicitly.
    background = CreamPage,
    onBackground = Ink,
    surface = Color.White,
    onSurface = Ink,
    secondary = Tan,
    onSecondary = Ink,
    tertiary = Gold,
    onTertiary = Color.White
)

@Composable
fun QuickInTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = QuickInColors,
        content = content
    )
}
