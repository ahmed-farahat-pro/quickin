package com.quickin.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.StarBorder
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
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
import com.quickin.app.ui.theme.CreamPage
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
    onOpen: (Booking) -> Unit = {},
    canReview: (Booking) -> Boolean = { false },
    reviewSubmitting: Boolean = false,
    reviewError: String? = null,
    onSubmitReview: (bookingId: String, rating: Int, comment: String, photos: List<String>) -> Unit = { _, _, _, _ -> },
    contentPadding: PaddingValues = PaddingValues()
) {
    Scaffold(
        containerColor = CreamPage,
        modifier = Modifier.padding(contentPadding),
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.reservations_title), color = Ink, fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = CreamPage)
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(CreamPage),
            contentAlignment = Alignment.Center
        ) {
            when {
                !isAuthenticated -> SignInCta(onSignIn)
                state.isLoading && state.bookings.isEmpty() -> {
                    // Skeleton cards shaped like reservation cards shimmer in place of a spinner.
                    SkeletonListColumn(imageHeight = 180.dp, spacing = 16.dp)
                }
                state.error != null && state.bookings.isEmpty() -> {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(32.dp)
                    ) {
                        Text(stringResource(R.string.reservations_load_error), fontWeight = FontWeight.Bold, color = Ink, fontSize = 18.sp)
                        Text(state.error, color = Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp, bottom = 16.dp))
                        Button(
                            onClick = onRetry,
                            colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White)
                        ) { Text(stringResource(R.string.action_retry)) }
                    }
                }
                state.bookings.isEmpty() -> EmptyReservations()
                else -> {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        items(state.bookings) { booking ->
                            ReservationCard(
                                booking = booking,
                                onClick = { onOpen(booking) },
                                canReview = canReview(booking),
                                reviewSubmitting = reviewSubmitting,
                                reviewError = reviewError,
                                onSubmitReview = { rating, comment, photos ->
                                    onSubmitReview(booking.id, rating, comment, photos)
                                }
                            )
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
            stringResource(R.string.reservations_sign_in_title),
            fontWeight = FontWeight.Bold,
            fontSize = 20.sp,
            color = Ink,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().padding(top = 28.dp)
        )
        Text(
            stringResource(R.string.reservations_sign_in_subtitle),
            color = Muted,
            fontSize = 15.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 28.dp)
        )
        GradientButton(
            onClick = onSignIn,
            pulse = true,
            radius = 18.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(stringResource(R.string.profile_cta_button), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
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
            stringResource(R.string.reservations_empty_title),
            fontWeight = FontWeight.Bold,
            color = Ink,
            fontSize = 18.sp,
            modifier = Modifier.padding(top = 12.dp)
        )
        Text(
            stringResource(R.string.reservations_empty_subtitle),
            color = Muted,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReservationCard(
    booking: Booking,
    onClick: () -> Unit,
    canReview: Boolean = false,
    reviewSubmitting: Boolean = false,
    reviewError: String? = null,
    onSubmitReview: (rating: Int, comment: String, photos: List<String>) -> Unit = { _, _, _ -> }
) {
    var showReviewDialog by remember { mutableStateOf(false) }

    if (showReviewDialog) {
        LeaveReviewDialog(
            stayTitle = booking.title,
            submitting = reviewSubmitting,
            error = reviewError,
            onSubmit = { rating, comment, photos -> onSubmitReview(rating, comment, photos) },
            onDismiss = { showReviewDialog = false }
        )
    }
    // Close the dialog once a submission succeeds (the booking leaves the reviewable set).
    LaunchedEffect(canReview) {
        if (!canReview) showReviewDialog = false
    }

    BoutiqueCard(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick,
        shadow = 8.dp,
        radius = CardRadius
    ) {
        Column {
            // Full-bleed cover with a photo-overlay gradient and the status badge on top.
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(184.dp)
                    .clip(RoundedCornerShape(topStart = CardRadius, topEnd = CardRadius))
            ) {
                val imageUrl = booking.imageUrl
                if (imageUrl != null) {
                    AsyncImage(
                        model = imageUrl,
                        contentDescription = booking.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize().background(Tan)
                    )
                } else {
                    PhotoPlaceholder(modifier = Modifier.fillMaxSize())
                }
                Box(
                    modifier = Modifier
                        .matchParentSize()
                        .background(
                            Brush.verticalGradient(
                                0f to Color.Transparent,
                                0.6f to Color.Transparent,
                                1f to Ink.copy(alpha = 0.4f)
                            )
                        )
                )
                if (booking.status != null) {
                    Surface(
                        shape = RoundedCornerShape(50),
                        color = Color.White.copy(alpha = 0.94f),
                        shadowElevation = 2.dp,
                        modifier = Modifier.padding(10.dp).align(Alignment.TopEnd)
                    ) {
                        StatusBadge(booking.status)
                    }
                }
            }
            Column(modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 18.dp)) {
                Text(
                    booking.title,
                    fontWeight = FontWeight.Bold,
                    color = Ink,
                    fontSize = 17.sp,
                    maxLines = 1
                )
                if (booking.location != null) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                        Icon(
                            Icons.Filled.LocationOn,
                            contentDescription = null,
                            tint = Muted,
                            modifier = Modifier.size(15.dp)
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(booking.location, color = Muted, fontSize = 14.sp, maxLines = 1)
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 10.dp)) {
                    Icon(Icons.Filled.DateRange, contentDescription = null, tint = Muted, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(
                        booking.dateRangeText,
                        color = Ink,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.People, contentDescription = null, tint = Muted, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(stringResource(R.string.reservations_guests, booking.guests), color = Muted, fontSize = 14.sp)
                    }
                    Text(booking.totalText, color = Burgundy, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }

                // For a confirmed stay past checkout the user can leave a review (the server
                // gates eligibility — canReview reflects GET /api/local/reviews).
                if (canReview) {
                    Spacer(Modifier.height(12.dp))
                    androidx.compose.material3.OutlinedButton(
                        onClick = { showReviewDialog = true },
                        shape = RoundedCornerShape(14.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Burgundy),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Burgundy),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Filled.StarBorder, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(stringResource(R.string.review_leave), fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}

