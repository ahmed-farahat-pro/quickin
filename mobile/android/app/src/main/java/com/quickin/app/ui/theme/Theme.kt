package com.quickin.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// QuickIn boutique palette — mirrors the web app's design tokens.
val Burgundy = Color(0xFF5B0F16)
val Cream = Color(0xFFF6F1E6)
val Tan = Color(0xFFEFE6D8)
val Ink = Color(0xFF2A2220)
val Muted = Color(0xFF6B6055)

private val QuickInColors = lightColorScheme(
    primary = Burgundy,
    onPrimary = Color.White,
    background = Cream,
    onBackground = Ink,
    surface = Color.White,
    onSurface = Ink,
    secondary = Tan,
    onSecondary = Ink
)

@Composable
fun QuickInTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = QuickInColors,
        content = content
    )
}
