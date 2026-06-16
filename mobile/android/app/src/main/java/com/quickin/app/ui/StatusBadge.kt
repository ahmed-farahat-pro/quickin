package com.quickin.app.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.BookingStatus

/**
 * Color-coded reservation status badge, shared by the My Reservations list, the
 * reservation detail card, and the host requests list. Maps each [BookingStatus]
 * to a tinted capsule (amber = pending, green = confirmed, red = rejected, etc.).
 */
@Composable
fun StatusBadge(status: String, modifier: Modifier = Modifier) {
    val s = BookingStatus.from(status)
    // Aligned to the redesign palette: gold for pending, deep boutique green for confirmed.
    val (bg, fg, label) = when (s) {
        BookingStatus.Pending -> Triple(Color(0xFFFBEFD6), Color(0xFF8A5A00), "Pending")
        BookingStatus.Confirmed -> Triple(Color(0xFFD9EBE0), Color(0xFF0F5132), "Confirmed")
        BookingStatus.Rejected -> Triple(Color(0xFFF7E0DD), Color(0xFFB3261E), "Rejected")
        BookingStatus.Cancelled -> Triple(Color(0xFFEAE6DD), Color(0xFF6B6055), "Cancelled")
        BookingStatus.Completed -> Triple(Color(0xFFE5DFF0), Color(0xFF3A45A8), "Completed")
        BookingStatus.Other -> Triple(
            Color(0xFFEFE6D8), Color(0xFF5B0F16),
            status.replaceFirstChar { it.uppercase() }.ifBlank { "—" }
        )
    }
    Surface(shape = RoundedCornerShape(50), color = bg, modifier = modifier) {
        Text(
            label,
            color = fg,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
        )
    }
}
