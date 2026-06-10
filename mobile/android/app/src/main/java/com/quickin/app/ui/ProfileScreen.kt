package com.quickin.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.AuthUiState
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan
import java.util.Locale

/**
 * Profile tab: shows the signed-in user's avatar (initials), name, email,
 * a provider pill, and a logout button. Styled to match AuthScreen.
 */
@Composable
fun ProfileScreen(
    state: AuthUiState,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier
) {
    val name = state.userName?.takeUnless { it.isBlank() } ?: "Guest"
    val email = state.email?.takeUnless { it.isBlank() }
    val provider = state.provider?.takeUnless { it.isBlank() } ?: "email"

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Cream)
            .padding(horizontal = 28.dp, vertical = 40.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                "Profile",
                fontWeight = FontWeight.Bold,
                fontSize = 28.sp,
                color = Ink,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 28.dp)
            )

            // Avatar — Burgundy circle with white initials.
            Box(
                modifier = Modifier
                    .size(112.dp)
                    .background(Burgundy, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    initialsOf(name),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 40.sp
                )
            }

            Text(
                name,
                fontWeight = FontWeight.Bold,
                fontSize = 24.sp,
                color = Ink,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 20.dp)
            )

            if (email != null) {
                Text(
                    email,
                    color = Muted,
                    fontSize = 15.sp,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 6.dp)
                )
            }

            // Provider pill (email / google / apple).
            ProviderPill(provider, modifier = Modifier.padding(top = 14.dp))

            Box(modifier = Modifier.weight(1f))

            // Log out
            Button(
                onClick = onLogout,
                shape = RoundedCornerShape(18.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Burgundy,
                    contentColor = Color.White
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp)
            ) {
                Text("Log out", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            }
        }
    }
}

/**
 * Profile tab shown when the user is NOT signed in: the brand logo, a prompt,
 * and a Burgundy CTA that opens the auth screen. Browsing stays fully usable
 * without an account; signing in is only needed to manage trips.
 */
@Composable
fun ProfileSignInCta(
    onSignIn: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Cream)
            .padding(horizontal = 28.dp, vertical = 40.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Image(
                painter = painterResource(R.drawable.logo),
                contentDescription = "QuickIn",
                contentScale = ContentScale.Fit,
                modifier = Modifier.height(52.dp)
            )

            Text(
                "Sign in to manage your trips",
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
                color = Ink,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 28.dp)
            )

            Text(
                "Save favorites, book stays, and view your bookings.",
                color = Muted,
                fontSize = 15.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp, bottom = 28.dp)
            )

            Button(
                onClick = onSignIn,
                shape = RoundedCornerShape(18.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Burgundy,
                    contentColor = Color.White
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp)
            ) {
                Text(
                    "Sign in or create account",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp
                )
            }
        }
    }
}

@Composable
private fun ProviderPill(provider: String, modifier: Modifier = Modifier) {
    val label = provider.replaceFirstChar {
        if (it.isLowerCase()) it.titlecase(Locale.getDefault()) else it.toString()
    }
    Surface(
        shape = RoundedCornerShape(50),
        color = Tan,
        modifier = modifier
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .background(Burgundy, CircleShape)
            )
            Text(
                label,
                color = Ink,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(start = 8.dp)
            )
        }
    }
}

/** First letters of up to two name parts, e.g. "Layla Hassan" -> "LH". */
private fun initialsOf(name: String): String {
    val parts = name.trim().split(Regex("\\s+")).filter { it.isNotBlank() }
    return when {
        parts.isEmpty() -> "?"
        parts.size == 1 -> parts[0].take(1).uppercase(Locale.getDefault())
        else -> (parts[0].take(1) + parts.last().take(1)).uppercase(Locale.getDefault())
    }
}
