package com.quickin.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.quickin.app.Booking
import com.quickin.app.R
import com.quickin.app.ReservationsUiState
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

/**
 * "My Reservations" tab. When signed out, shows a sign-in CTA (mirrors [ProfileSignInCta]).
 * When signed in, lists the user's bookings as cards, with a loading and empty state.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReservationsScreen(
    isAuthenticated: Boolean,
    state: ReservationsUiState,
    onSignIn: () -> Unit,
    onRetry: () -> Unit,
    contentPadding: PaddingValues = PaddingValues()
) {
    Scaffold(
        containerColor = Cream,
        modifier = Modifier.padding(contentPadding),
        topBar = {
            TopAppBar(
                title = { Text("My Reservations", color = Ink, fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Cream)
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(Cream),
            contentAlignment = Alignment.Center
        ) {
            when {
                !isAuthenticated -> SignInCta(onSignIn)
                state.isLoading && state.bookings.isEmpty() -> {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = Burgundy)
                        Text("Loading your reservations…", color = Muted, modifier = Modifier.padding(top = 12.dp))
                    }
                }
                state.error != null && state.bookings.isEmpty() -> {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(32.dp)
                    ) {
                        Text("Couldn't load reservations", fontWeight = FontWeight.Bold, color = Ink, fontSize = 18.sp)
                        Text(state.error, color = Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp, bottom = 16.dp))
                        Button(
                            onClick = onRetry,
                            colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White)
                        ) { Text("Retry") }
                    }
                }
                state.bookings.isEmpty() -> EmptyReservations()
                else -> {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        items(state.bookings) { booking ->
                            ReservationCard(booking)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SignInCta(onSignIn: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Image(
            painter = painterResource(R.drawable.logo),
            contentDescription = "QuickIn",
            contentScale = ContentScale.Fit,
            modifier = Modifier.height(52.dp)
        )
        Text(
            "Sign in to see your reservations",
            fontWeight = FontWeight.Bold,
            fontSize = 20.sp,
            color = Ink,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().padding(top = 28.dp)
        )
        Text(
            "Your booked stays will show up here.",
            color = Muted,
            fontSize = 15.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 28.dp)
        )
        Button(
            onClick = onSignIn,
            shape = RoundedCornerShape(18.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White),
            modifier = Modifier.fillMaxWidth().height(54.dp)
        ) {
            Text("Sign in or create account", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        }
    }
}

@Composable
private fun EmptyReservations() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(32.dp)
    ) {
        Icon(Icons.Filled.DateRange, contentDescription = null, tint = Burgundy, modifier = Modifier.size(48.dp))
        Text(
            "No reservations yet",
            fontWeight = FontWeight.Bold,
            color = Ink,
            fontSize = 18.sp,
            modifier = Modifier.padding(top = 12.dp)
        )
        Text(
            "Find a stay you love and reserve it — it'll appear here.",
            color = Muted,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}

@Composable
private fun ReservationCard(booking: Booking) {
    Surface(
        shape = RoundedCornerShape(22.dp),
        color = Color.White,
        shadowElevation = 4.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column {
            AsyncImage(
                model = booking.imageUrl,
                contentDescription = booking.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp)
                    .background(Tan)
            )
            Column(modifier = Modifier.padding(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        booking.title,
                        fontWeight = FontWeight.Bold,
                        color = Ink,
                        fontSize = 16.sp,
                        maxLines = 1,
                        modifier = Modifier.weight(1f)
                    )
                    if (booking.status != null) {
                        StatusPill(booking.status)
                    }
                }
                if (booking.location != null) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 2.dp)) {
                        Icon(
                            Icons.Filled.LocationOn,
                            contentDescription = null,
                            tint = Burgundy.copy(alpha = 0.7f),
                            modifier = Modifier.height(16.dp)
                        )
                        Text(booking.location, color = Muted, fontSize = 14.sp, maxLines = 1)
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                    Icon(Icons.Filled.DateRange, contentDescription = null, tint = Muted, modifier = Modifier.height(16.dp))
                    Text(
                        "  ${booking.dateRangeText}",
                        color = Ink,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth().padding(top = 6.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.People, contentDescription = null, tint = Muted, modifier = Modifier.height(16.dp))
                        Text("  ${booking.guests} guest(s)", color = Muted, fontSize = 14.sp)
                    }
                    Text(booking.totalText, color = Ink, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }
        }
    }
}

@Composable
private fun StatusPill(status: String) {
    Surface(shape = RoundedCornerShape(50), color = Tan) {
        Text(
            status.replaceFirstChar { it.uppercase() },
            color = Burgundy,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
        )
    }
}
