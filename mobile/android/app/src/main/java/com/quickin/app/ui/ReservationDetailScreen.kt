package com.quickin.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.StickyNote2
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.HourglassEmpty
import androidx.compose.material.icons.filled.IosShare
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.StarBorder
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.BookingStatus
import com.quickin.app.R
import com.quickin.app.Qr
import com.quickin.app.Reservation
import com.quickin.app.ReservationDetailUiState
import com.quickin.app.ShareLinks
import com.quickin.app.shareText
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan
import androidx.compose.ui.graphics.asImageBitmap

private val ErrorRed = Color(0xFFB3261E)

/**
 * Reservation DETAIL screen (`GET /api/local/bookings/:id`). Shows the stay details and an
 * in-app reservation CARD bearing a QR code generated from the reservation_code (via ZXing).
 * This is a plain in-app pass — NOT Apple Wallet / Google Wallet.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReservationDetailScreen(
    state: ReservationDetailUiState,
    onBack: () -> Unit,
    onRetry: () -> Unit,
    onOpenMessages: (() -> Unit)? = null,
    /** When non-null and the reservation is still unpaid, a "Pay now" button opens the mock pay sheet. */
    onPayNow: (() -> Unit)? = null,
    canReview: Boolean = false,
    reviewSubmitting: Boolean = false,
    reviewError: String? = null,
    onSubmitReview: (rating: Int, comment: String, photos: List<String>) -> Unit = { _, _, _ -> },
    /** True when the signed-in account is a host — unlocks the editable host-notes panel. */
    isHost: Boolean = false,
    /** True while a host-notes save is in flight. */
    notesSaving: Boolean = false,
    /** Error from the last host-notes save, or null. */
    notesError: String? = null,
    /** Host-only: persists the edited notes (`PATCH …/bookings/:id {host_notes}`). */
    onSaveHostNotes: (notes: String) -> Unit = {}
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    Scaffold(
        containerColor = CreamPage,
        topBar = {
            TopAppBar(
                title = { Text("Reservation", color = Ink, fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Ink)
                    }
                },
                actions = {
                    // Share this reservation's public web link — only once it has loaded
                    // (so we have a real id + title for the chooser).
                    val reservation = state.reservation
                    if (reservation != null) {
                        IconButton(onClick = {
                            shareText(
                                context = context,
                                text = ShareLinks.reservation(reservation.id),
                                subject = context.getString(R.string.share_subject, reservation.title),
                                chooserTitle = context.getString(R.string.share_chooser_title)
                            )
                        }) {
                            Icon(Icons.Filled.IosShare, contentDescription = stringResource(R.string.cd_share), tint = Burgundy)
                        }
                    }
                },
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
                state.isLoading -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = Burgundy)
                    Text("Loading your reservation…", color = Muted, modifier = Modifier.padding(top = 12.dp))
                }
                state.error != null -> Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(32.dp)
                ) {
                    Text("Couldn't load reservation", fontWeight = FontWeight.Bold, color = Ink, fontSize = 18.sp)
                    Text(state.error, color = Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp, bottom = 16.dp))
                    Button(
                        onClick = onRetry,
                        colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White)
                    ) { Text("Retry") }
                }
                state.reservation != null -> ReservationCardContent(
                    reservation = state.reservation,
                    onOpenMessages = onOpenMessages,
                    onPayNow = onPayNow,
                    canReview = canReview,
                    reviewSubmitting = reviewSubmitting,
                    reviewError = reviewError,
                    onSubmitReview = onSubmitReview,
                    isHost = isHost,
                    notesSaving = notesSaving,
                    notesError = notesError,
                    onSaveHostNotes = onSaveHostNotes
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReservationCardContent(
    reservation: Reservation,
    onOpenMessages: (() -> Unit)?,
    onPayNow: (() -> Unit)? = null,
    canReview: Boolean = false,
    reviewSubmitting: Boolean = false,
    reviewError: String? = null,
    onSubmitReview: (rating: Int, comment: String, photos: List<String>) -> Unit = { _, _, _ -> },
    isHost: Boolean = false,
    notesSaving: Boolean = false,
    notesError: String? = null,
    onSaveHostNotes: (notes: String) -> Unit = {}
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    // Public stay-pass URL the QR encodes and the card opens on tap.
    val stayUrl = remember(reservation.reservationCode) {
        ShareLinks.stay(reservation.reservationCode)
    }
    val openStayPass: () -> Unit = openStayPass@{
        if (reservation.reservationCode.isBlank()) return@openStayPass
        runCatching {
            context.startActivity(
                android.content.Intent(
                    android.content.Intent.ACTION_VIEW,
                    android.net.Uri.parse(stayUrl)
                )
            )
        }
    }

    var showReviewDialog by remember { mutableStateOf(false) }

    if (showReviewDialog) {
        LeaveReviewDialog(
            stayTitle = reservation.title,
            submitting = reviewSubmitting,
            error = reviewError,
            onSubmit = { rating, comment, photos -> onSubmitReview(rating, comment, photos) },
            onDismiss = { showReviewDialog = false }
        )
    }
    LaunchedEffect(canReview) {
        if (!canReview) showReviewDialog = false
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        // The in-app reservation card: title, city, QR, code, and trip details. The whole card is
        // tappable → opens the public stay-pass page (same URL the QR encodes).
        Surface(
            shape = RoundedCornerShape(28.dp),
            color = Color.White,
            shadowElevation = 6.dp,
            onClick = openStayPass,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // A confirmed reservation earns a drawn-on green checkmark (qkDraw + qkPop).
                if (BookingStatus.from(reservation.status) == BookingStatus.Confirmed) {
                    PopIn { DrawCheckmark(size = 64.dp) }
                    Spacer(Modifier.height(12.dp))
                }
                StatusBadge(reservation.status)
                Spacer(Modifier.height(14.dp))
                Text(
                    reservation.title,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                    color = Ink,
                    textAlign = TextAlign.Center
                )
                // City: the curated region when present, otherwise the listing location.
                val city = reservation.cityText
                if (city != null) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(top = 4.dp)
                    ) {
                        Icon(Icons.Filled.LocationOn, null, tint = Muted, modifier = Modifier.height(16.dp))
                        Text(city, color = Muted, fontSize = 14.sp)
                    }
                }

                Spacer(Modifier.height(20.dp))

                // QR encodes the public stay-pass URL (not the bare code), so a scan opens the page.
                QrBlock(stayUrl)

                Spacer(Modifier.height(10.dp))
                // Caption: the QR (and the card) opens the stay pass.
                Text(
                    stringResource(R.string.reservation_scan_or_tap),
                    color = Muted,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center
                )

                Spacer(Modifier.height(8.dp))
                Text(stringResource(R.string.reservation_code_label), color = Muted, fontSize = 12.sp)
                Text(
                    reservation.reservationCode.ifBlank { "—" },
                    color = Burgundy,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    letterSpacing = 2.sp
                )

                Spacer(Modifier.height(20.dp))
                HorizontalDivider(color = Tan)
                Spacer(Modifier.height(16.dp))

                DetailRow(Icons.Filled.DateRange, stringResource(R.string.reservation_dates), reservation.dateRangeText)
                Spacer(Modifier.height(10.dp))
                DetailRow(Icons.Filled.People, stringResource(R.string.reservation_guests_label), "${reservation.guests}")
                Spacer(Modifier.height(10.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(stringResource(R.string.detail_total), color = Muted, fontSize = 14.sp)
                    Text(reservation.totalText, color = Burgundy, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }
        }

        // "From your host" — guests see notes read-only; hosts get an inline editor below.
        HostNotesCard(
            notes = reservation.hostNotes,
            isHost = isHost,
            saving = notesSaving,
            error = notesError,
            onSave = onSaveHostNotes
        )

        // Payment is gated on host approval. The guest can only pay once the host has APPROVED the
        // request (status 'confirmed') and it's still unpaid — paying a 'pending' booking is rejected
        // by the backend. This is the primary CTA here, so it pulses.
        val isApproved = reservation.status.equals("confirmed", ignoreCase = true)
        val isAwaitingApproval = reservation.status.equals("pending", ignoreCase = true)
        if (onPayNow != null && isApproved && !reservation.isPaid) {
            GradientButton(
                onClick = onPayNow,
                radius = 18.dp,
                height = 52.dp,
                pulse = true,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Filled.CreditCard, null, tint = Color.White, modifier = Modifier.height(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(stringResource(R.string.pay_now), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            }
        } else if (isAwaitingApproval && !reservation.isPaid) {
            // Pending request — no pay button yet; surface a hint that the host must approve first.
            Surface(
                shape = RoundedCornerShape(18.dp),
                color = Cream,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 18.dp, vertical = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Icon(Icons.Filled.HourglassEmpty, null, tint = Burgundy, modifier = Modifier.height(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(
                        stringResource(R.string.reservation_awaiting_approval),
                        color = Ink,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }

        if (onOpenMessages != null) {
            GradientButton(
                onClick = onOpenMessages,
                radius = 18.dp,
                height = 52.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Filled.ChatBubbleOutline, null, tint = Color.White, modifier = Modifier.height(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(stringResource(R.string.reservation_messages), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            }
        }

        // For a confirmed stay past checkout, offer a review (server-gated via canReview).
        if (canReview) {
            androidx.compose.material3.OutlinedButton(
                onClick = { showReviewDialog = true },
                shape = RoundedCornerShape(18.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Burgundy),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Burgundy),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
            ) {
                Icon(Icons.Filled.StarBorder, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(stringResource(R.string.review_leave), fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            }
        }
    }
}

/**
 * Renders the QR for [content] (the public stay-pass URL). The image content-description names the
 * stay pass; if encoding fails it falls back to showing the raw [content] as text.
 */
@Composable
private fun QrBlock(content: String) {
    // Remember the bitmap per content so we don't re-encode on every recomposition.
    val image = remember(content) { Qr.bitmap(content, sizePx = 600)?.asImageBitmap() }
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = Color.White,
        shadowElevation = 0.dp,
        modifier = Modifier.size(220.dp)
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(8.dp)) {
            if (image != null) {
                Image(
                    bitmap = image,
                    contentDescription = stringResource(R.string.cd_stay_pass_qr),
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                Text(
                    content.ifBlank { stringResource(R.string.reservation_no_code) },
                    color = Ink,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

/**
 * The "From your host" panel.
 *  • Guests see [notes] read-only (the card is hidden entirely when there are no notes).
 *  • Hosts always see it, with a multiline editor prefilled with [notes] + a Save button that
 *    calls [onSave]; [saving] swaps the button for a spinner and [error] shows inline.
 */
@Composable
private fun HostNotesCard(
    notes: String?,
    isHost: Boolean,
    saving: Boolean,
    error: String?,
    onSave: (String) -> Unit
) {
    // Guests with no notes get nothing; hosts always get the editor.
    if (!isHost && notes.isNullOrBlank()) return

    Surface(
        shape = RoundedCornerShape(20.dp),
        color = Cream,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.AutoMirrored.Filled.StickyNote2, null, tint = Burgundy, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    stringResource(R.string.reservation_from_host),
                    color = Ink,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp
                )
            }
            Spacer(Modifier.height(12.dp))

            if (isHost) {
                // Editor prefilled with the current notes; re-seeded if the saved value changes.
                var draft by remember(notes) { mutableStateOf(notes.orEmpty()) }
                androidx.compose.material3.OutlinedTextField(
                    value = draft,
                    onValueChange = { draft = it },
                    enabled = !saving,
                    placeholder = { Text(stringResource(R.string.reservation_host_notes_hint), color = Muted) },
                    minLines = 3,
                    shape = RoundedCornerShape(16.dp),
                    colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Burgundy,
                        unfocusedBorderColor = Tan,
                        cursorColor = Burgundy,
                        focusedTextColor = Ink,
                        unfocusedTextColor = Ink,
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color.White
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
                if (error != null) {
                    Spacer(Modifier.height(8.dp))
                    Text(error, color = ErrorRed, fontSize = 13.sp)
                }
                Spacer(Modifier.height(12.dp))
                GradientButton(
                    onClick = { onSave(draft.trim()) },
                    enabled = !saving,
                    radius = 16.dp,
                    height = 48.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (saving) {
                        CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                    } else {
                        Text(
                            stringResource(R.string.reservation_save_notes),
                            color = Color.White,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp
                        )
                    }
                }
            } else {
                // Guest read-only view.
                Text(notes.orEmpty(), color = Ink, fontSize = 14.sp)
            }
        }
    }
}

@Composable
private fun DetailRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    value: String
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, null, tint = Burgundy, modifier = Modifier.height(18.dp))
        Spacer(Modifier.width(8.dp))
        Text(label, color = Muted, fontSize = 14.sp)
        Spacer(Modifier.weight(1f))
        Text(value, color = Ink, fontSize = 14.sp, fontWeight = FontWeight.Medium)
    }
}
