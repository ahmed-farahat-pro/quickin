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
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddHome
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
import androidx.compose.material3.TextButton
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
import com.quickin.app.PaymentFlowRules
import com.quickin.app.R
import com.quickin.app.ReservationFilter
import com.quickin.app.ReservationFilterRules
import com.quickin.app.ReservationsUiState
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

/**
 * "My Reservations" / Trips tab. The sign-in prompt is gated on the AUTHORITATIVE auth state
 * ([isAuthenticated]) AND an empty list — so a signed-in user whose load is still in flight, came
 * back empty, or hit a transient 401 NEVER sees a sign-in wall:
 *   • signed-in + zero trips → a friendly empty state ("No trips yet" + an Explore CTA),
 *   • signed-in + the load failed (e.g. 401/notSignedIn while a token exists) → a neutral error
 *     with retry,
 *   • only genuinely-no-session (no token) shows the sign-in CTA.
 * Mirrors the wishlist empty-vs-sign-in distinction.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReservationsScreen(
    isAuthenticated: Boolean,
    state: ReservationsUiState,
    onSignIn: () -> Unit,
    onRetry: () -> Unit,
    /** The server's `is_host`: gates the banner's hosting shortcut. Never a local guess. */
    isHost: Boolean = false,
    /** Opens the host dashboard from the banner's hosting shortcut. */
    onOpenHost: () -> Unit = {},
    onExplore: () -> Unit = {},
    onOpen: (Booking) -> Unit = {},
    canReview: (Booking) -> Boolean = { false },
    reviewSubmitting: Boolean = false,
    reviewError: String? = null,
    onSubmitReview: (bookingId: String, rating: Int, comment: String, photos: List<String>) -> Unit = { _, _, _, _ -> },
    contentPadding: PaddingValues = PaddingValues()
) {
    // The status chip in force. Deliberately NOT hoisted into the view model: a filter that
    // outlives the screen is one a guest comes back to having forgotten they set, and a Trips
    // tab that looks empty because of a chip reads as lost bookings.
    var filter by remember { mutableStateOf(ReservationFilter.All) }

    Scaffold(
        containerColor = CreamPage,
        modifier = Modifier.padding(contentPadding),
        // The QuickIn brand banner in place of a stock title bar (iOS `ReservationsView`).
        topBar = {
            // iOS also puts a "My subscriptions" button here, but that screen has no entry point
            // on Android any more — so the hosting shortcut is the only accessory. It renders for
            // a host alone: a host's OWN reservations inbox lives in the dashboard, not in Trips.
            QkBrandHeader(
                eyebrow = stringResource(R.string.reservations_eyebrow),
                title = stringResource(R.string.reservations_title),
                subtitle = stringResource(R.string.reservations_subtitle)
            ) {
                if (isHost) {
                    QkHeaderIconButton(
                        icon = Icons.Filled.AddHome,
                        contentDescription = stringResource(R.string.cd_host_dashboard),
                        onClick = onOpenHost
                    )
                }
            }
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
                state.isLoading && state.bookings.isEmpty() -> {
                    // Skeleton cards shaped like reservation cards shimmer in place of a spinner.
                    // Checked first so the initial load never flashes a sign-in wall while the
                    // auth flag is still settling.
                    SkeletonListColumn(imageHeight = 180.dp, spacing = 16.dp)
                }
                // Genuinely signed out (no session) AND nothing to show → the sign-in CTA. Gated on
                // the authoritative auth flag + an empty list so an empty or 401/notSignedIn API
                // result while signed in is NEVER mistaken for signed-out — those fall through to
                // the neutral error / friendly empty states below.
                !isAuthenticated && state.bookings.isEmpty() -> SignInCta(onSignIn)
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
                state.bookings.isEmpty() -> EmptyReservations(onExplore = onExplore)
                else -> {
                    // The bucket each reservation is filed under, folded once per load by the
                    // shared rule rather than per chip tap.
                    val buckets = remember(state.bookings) {
                        state.bookings.associate { booking ->
                            booking.id to ReservationFilterRules.bucketFor(
                                status = booking.status,
                                // Booking's own stage, decided by PaymentFlowRules — the fold
                                // never re-reads the payment columns itself.
                                paymentStage = booking.paymentStage,
                                refundPercent = booking.refundPercent,
                                // A separate question from the stage, which calls everything
                                // cancelled NotPayable. Without it, a booking cancelled before it
                                // was ever paid carried the policy's 100% and read as "Refunded".
                                wasPaid = PaymentFlowRules.everPaid(
                                    booking.paymentStatus,
                                    booking.paymentProofStatus,
                                    booking.paidAt,
                                ),
                            )
                        }
                    }
                    // Counted over every reservation, not the visible slice — a chip has to say
                    // what it WOULD show, which is the opposite of what is on screen right now.
                    val counts = remember(buckets) {
                        ReservationFilterRules.counts(buckets.values.toList())
                    }
                    val visible = state.bookings.filter { booking ->
                        buckets[booking.id]?.let { filter.matches(it) } ?: true
                    }

                    Column(modifier = Modifier.fillMaxSize()) {
                        ReservationFilterRow(
                            counts = counts,
                            selected = filter,
                            onSelect = { filter = it }
                        )
                        if (visible.isEmpty()) {
                            // The guest HAS reservations — this chip just holds none. Saying "no
                            // trips yet" here would be a lie, so name the chip and offer the only
                            // way out (nobody can conjure a booking into a status).
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 32.dp, vertical = 44.dp)
                            ) {
                                Text(
                                    stringResource(filter.emptyMessageRes),
                                    color = Muted,
                                    textAlign = TextAlign.Center
                                )
                                TextButton(onClick = { filter = ReservationFilter.All }) {
                                    Text(
                                        stringResource(R.string.reservation_filter_show_all),
                                        color = Burgundy,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }
                        } else {
                            LazyColumn(
                                contentPadding = PaddingValues(16.dp),
                                verticalArrangement = Arrangement.spacedBy(16.dp)
                            ) {
                                items(visible, key = { it.id }) { booking ->
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
    }
}

/**
 * The status chips over the guest's reservations, badged with what each one holds.
 *
 * Chips a guest has nothing behind are dropped rather than badged 0. The host's row shows all
 * eight because that is a fixed vocabulary a host works through; these ten describe a story most
 * guests only ever see part of, and eight empty chips to scroll past would bury the two that hold
 * something. **All** and the active chip always survive, so the row can never go blank and the
 * current filter can never vanish from under the list.
 */
@Composable
private fun ReservationFilterRow(
    counts: Map<ReservationFilterRules.Bucket, Int>,
    selected: ReservationFilter,
    onSelect: (ReservationFilter) -> Unit,
    modifier: Modifier = Modifier
) {
    val visible = ReservationFilter.entries.filter { option ->
        val bucket = option.bucket ?: return@filter true  // All
        option == selected || (counts[bucket] ?: 0) > 0
    }
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = modifier
            .fillMaxWidth()
            .padding(top = 12.dp, bottom = 10.dp)
    ) {
        items(visible, key = { it.name }) { option ->
            ReservationFilterChip(
                label = stringResource(option.labelRes),
                // "All" stays bare: its count is just the number of cards below it, and every
                // other client leaves it bare for the same reason.
                count = option.bucket?.let { counts[it] ?: 0 },
                selected = selected == option,
                onClick = { onSelect(option) }
            )
        }
    }
}

/** One chip. Same recipe as HostFilterChip so the two rows are visually identical. */
@Composable
private fun ReservationFilterChip(label: String, count: Int?, selected: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(50),
        color = if (selected) Burgundy else Color.White,
        contentColor = if (selected) Color.White else Ink,
        border = BorderStroke(1.dp, if (selected) Burgundy else Tan),
        shadowElevation = if (selected) 2.dp else 0.dp
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.padding(
                start = 14.dp,
                end = if (count == null) 14.dp else 8.dp,
                top = 8.dp,
                bottom = 8.dp
            )
        ) {
            Text(label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
            if (count != null) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .background(if (selected) Color.White.copy(alpha = 0.22f) else Tan)
                        .defaultMinSize(minWidth = 20.dp)
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        count.toString(),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        color = if (selected) Color.White else Muted
                    )
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

/**
 * Friendly empty state for a SIGNED-IN user with zero trips: a calendar glyph, a title, a hint,
 * and an Explore CTA that jumps to the listings tab. Never a sign-in prompt.
 */
@Composable
private fun EmptyReservations(onExplore: () -> Unit) {
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
            modifier = Modifier.padding(top = 8.dp, bottom = 20.dp)
        )
        Button(
            onClick = onExplore,
            colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White)
        ) { Text(stringResource(R.string.reservations_empty_cta)) }
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
                    DataUrlAwareImage(
                        url = imageUrl,
                        contentDescription = booking.title,
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
                        // Guest view: badge speaks the three reservation states
                        // (Waiting for approval / Approved / Paid), payment-aware.
                        StatusBadge(booking.status, guestView = true, isPaid = booking.isPaid)
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

