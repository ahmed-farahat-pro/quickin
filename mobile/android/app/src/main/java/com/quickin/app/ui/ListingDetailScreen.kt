package com.quickin.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Bathtub
import androidx.compose.material.icons.filled.Bed
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.quickin.app.Listing
import com.quickin.app.ReserveUiState
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

private val ErrorRed = Color(0xFFB3261E)
private val SuccessGreen = Color(0xFF2E7D32)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ListingDetailScreen(
    listing: Listing,
    onBack: () -> Unit,
    reserveState: ReserveUiState = ReserveUiState(),
    onReserve: (checkIn: String, checkOut: String, guests: Int) -> Unit = { _, _, _ -> },
    onSignIn: () -> Unit = {},
    onResetReserve: () -> Unit = {}
) {
    Scaffold(
        containerColor = Cream,
        topBar = {
            TopAppBar(
                title = { Text(listing.title, maxLines = 1, color = Ink, fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Ink)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Cream)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(Cream)
        ) {
            item { Gallery(listing) }
            item {
                Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(listing.title, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Ink)
                        if (listing.location != null) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Filled.LocationOn, null, tint = Muted, modifier = Modifier.height(18.dp))
                                Text(listing.location, color = Muted, fontSize = 14.sp)
                            }
                        }
                        if (listing.isGuestFavorite) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Filled.Star, null, tint = Burgundy, modifier = Modifier.height(16.dp))
                                Text("Guest favorite", color = Burgundy, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                        Spec(Icons.Filled.People, listing.maxGuests, "guests")
                        Spec(Icons.Filled.Bed, listing.bedrooms, "bedrooms")
                        Spec(Icons.Filled.Bed, listing.beds, "beds")
                        Spec(Icons.Filled.Bathtub, listing.bathrooms, "baths")
                    }
                    if (!listing.description.isNullOrEmpty()) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("About this place", fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                            Text(listing.description, color = Muted, fontSize = 15.sp)
                        }
                    }

                    ReservePanel(
                        listing = listing,
                        state = reserveState,
                        onReserve = onReserve,
                        onSignIn = onSignIn,
                        onResetReserve = onResetReserve
                    )
                }
            }
        }
    }
}

/**
 * Reserve section: check-in / check-out date pickers, guests, a live "nights × price" total,
 * and a Burgundy Reserve button. Renders inline feedback driven by [state]:
 *  • needsSignIn -> "Sign in to reserve" with a CTA,
 *  • error -> the server message (e.g. "Those dates are not available"),
 *  • confirmed -> a success confirmation.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReservePanel(
    listing: Listing,
    state: ReserveUiState,
    onReserve: (checkIn: String, checkOut: String, guests: Int) -> Unit,
    onSignIn: () -> Unit,
    onResetReserve: () -> Unit
) {
    var checkIn by remember { mutableStateOf("") }
    var checkOut by remember { mutableStateOf("") }
    var guests by remember { mutableStateOf("1") }
    var showDatePicker by remember { mutableStateOf(false) }

    val nights = nightsBetween(checkIn, checkOut)
    val total = nights * listing.pricePerNight
    val canReserve = nights > 0 && !state.isSubmitting

    if (showDatePicker) {
        DateRangePickerSheet(
            initialCheckIn = checkIn.ifBlank { null },
            initialCheckOut = checkOut.ifBlank { null },
            onApply = { ci, co ->
                checkIn = ci ?: ""
                checkOut = co ?: ""
                showDatePicker = false
                // Picking new dates clears any stale error / sign-in prompt.
                if (state.error != null || state.needsSignIn) onResetReserve()
            },
            onDismiss = { showDatePicker = false }
        )
    }

    Surface(
        color = Color.White,
        shape = RoundedCornerShape(22.dp),
        shadowElevation = 3.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(verticalAlignment = Alignment.Bottom) {
                Text(listing.priceText, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink)
                Text(" / night", fontSize = 14.sp, color = Muted)
            }

            // A successful reservation replaces the form with a confirmation card.
            if (state.confirmed != null) {
                val b = state.confirmed
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = SuccessGreen)
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "Reservation confirmed",
                        color = SuccessGreen,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                }
                Text(
                    "${b.checkIn} → ${b.checkOut} · ${b.guests} guest(s)",
                    color = Muted,
                    fontSize = 14.sp
                )
                Text(
                    "Total ${b.totalText}",
                    color = Ink,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp
                )
                Button(
                    onClick = onResetReserve,
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White),
                    modifier = Modifier.fillMaxWidth().height(50.dp)
                ) {
                    Text("Book another stay", fontWeight = FontWeight.SemiBold)
                }
                return@Column
            }

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                DateTapField(
                    label = "Check-in",
                    value = checkIn,
                    onClick = { showDatePicker = true },
                    modifier = Modifier.weight(1f)
                )
                DateTapField(
                    label = "Check-out",
                    value = checkOut,
                    onClick = { showDatePicker = true },
                    modifier = Modifier.weight(1f)
                )
            }

            OutlinedTextField(
                value = guests,
                onValueChange = { input -> guests = input.filter { it.isDigit() }.take(2) },
                label = { Text("Guests") },
                singleLine = true,
                leadingIcon = { Icon(Icons.Filled.People, contentDescription = null, tint = Burgundy) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                shape = RoundedCornerShape(18.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Burgundy,
                    unfocusedBorderColor = Tan,
                    focusedLabelColor = Burgundy,
                    cursorColor = Burgundy,
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White
                ),
                modifier = Modifier.fillMaxWidth()
            )

            // Live total = nights × price.
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    if (nights > 0) "${listing.priceText} × $nights night(s)" else "Select your dates",
                    color = Muted,
                    fontSize = 14.sp
                )
                if (nights > 0) {
                    Text(
                        "${listing.currencySymbol}${total.toInt()}",
                        color = Ink,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                }
            }

            if (state.needsSignIn) {
                Text("Sign in to reserve", color = ErrorRed, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            } else if (state.error != null) {
                Text(state.error, color = ErrorRed, fontSize = 14.sp)
            }

            if (state.needsSignIn) {
                Button(
                    onClick = onSignIn,
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White),
                    modifier = Modifier.fillMaxWidth().height(52.dp)
                ) {
                    Text("Sign in to reserve", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                }
            } else {
                Button(
                    onClick = {
                        onReserve(checkIn, checkOut, guests.toIntOrNull()?.coerceAtLeast(1) ?: 1)
                    },
                    enabled = canReserve,
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Burgundy,
                        contentColor = Color.White,
                        disabledContainerColor = Burgundy.copy(alpha = 0.4f),
                        disabledContentColor = Color.White
                    ),
                    modifier = Modifier.fillMaxWidth().height(52.dp)
                ) {
                    if (state.isSubmitting) {
                        CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.height(22.dp))
                    } else {
                        Text("Reserve", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun Gallery(listing: Listing) {
    val urls = listing.sortedImageUrls
    val pagerState = rememberPagerState(pageCount = { urls.size })
    HorizontalPager(state = pagerState) { page ->
        AsyncImage(
            model = urls[page],
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxWidth()
                .height(300.dp)
                .background(Tan)
        )
    }
}

@Composable
private fun Spec(icon: ImageVector, value: Int?, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(icon, contentDescription = null, tint = Burgundy)
        Text("${value ?: 0}", fontWeight = FontWeight.SemiBold, color = Ink, modifier = Modifier.padding(top = 4.dp))
        Text(label, color = Muted, fontSize = 12.sp)
    }
}

/**
 * A tappable outlined "date field" for the reserve panel. Shows its label and the selected date
 * (e.g. "Mar 10") or an "Add" placeholder; tapping opens the custom [DateRangePickerSheet].
 */
@Composable
private fun DateTapField(
    label: String,
    value: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val date = parseLocalDate(value.ifBlank { null })
    val shown = date?.let {
        "${it.month.getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.ENGLISH)} ${it.dayOfMonth}"
    }
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, Tan),
        modifier = modifier
            .height(60.dp)
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Filled.DateRange, contentDescription = null, tint = Burgundy, modifier = Modifier.height(20.dp))
            Spacer(Modifier.width(10.dp))
            Column {
                Text(label, color = Muted, fontSize = 12.sp)
                Text(
                    shown ?: "Add",
                    color = if (shown != null) Ink else Muted,
                    fontSize = 15.sp,
                    fontWeight = if (shown != null) FontWeight.SemiBold else FontWeight.Normal
                )
            }
        }
    }
}
