package com.quickin.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.ui.theme.Burgundy

// Matches the file-private constant used by the chat screens.
private val ErrorRed = Color(0xFFB3261E)

/**
 * The acknowledge gate, shown in place of the chat composer.
 *
 * A moderator issued a warning about sharing contact details and the API is
 * refusing this user's messages (HTTP 409) until they confirm they have read it.
 * Nothing else notifies them — no email, no push — so this banner IS the
 * delivery, which is why it replaces the input bar rather than sitting above it:
 * a notice you can ignore while still typing is not a gate.
 *
 * Used by both [ChatScreen] (booking threads) and the pre-booking thread screen.
 */
@Composable
fun PolicyWarningBanner(
    text: String,
    isAcknowledging: Boolean,
    onAcknowledge: () -> Unit,
) {
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Column(Modifier.padding(14.dp)) {
            Text(
                "A note from QuickIn",
                color = ErrorRed,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 6.dp),
            )
            Text(
                text,
                fontSize = 14.sp,
                modifier = Modifier.padding(bottom = 12.dp),
            )
            Button(
                onClick = onAcknowledge,
                enabled = !isAcknowledging,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White),
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (isAcknowledging) {
                    CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.padding(2.dp))
                } else {
                    Text("I understand", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
