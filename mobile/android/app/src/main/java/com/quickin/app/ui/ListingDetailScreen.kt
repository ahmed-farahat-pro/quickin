package com.quickin.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.AcUnit
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.EventBusy
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Bathtub
import androidx.compose.material.icons.filled.BeachAccess
import androidx.compose.material.icons.filled.Bed
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.FreeBreakfast
import androidx.compose.material.icons.filled.HotTub
import androidx.compose.material.icons.filled.Kitchen
import androidx.compose.material.icons.filled.LocalLaundryService
import androidx.compose.material.icons.filled.LocalParking
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.OutdoorGrill
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Pets
import androidx.compose.material.icons.filled.Pool
import androidx.compose.material.icons.filled.Sell
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Thermostat
import androidx.compose.material.icons.filled.Tv
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material.icons.filled.Work
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.quickin.app.Booking
import com.quickin.app.R
import com.quickin.app.Listing
import com.quickin.app.ListingReviewsUiState
import com.quickin.app.ReserveUiState
import com.quickin.app.StayQuote
import com.quickin.app.SupabaseService
import com.quickin.app.Review
import com.quickin.app.ShareLinks
import com.quickin.app.shareText
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Gold
import com.quickin.app.ui.theme.GoldDeep
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

private val ErrorRed = Color(0xFFB3261E)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ListingDetailScreen(
    listing: Listing,
    onBack: () -> Unit,
    reserveState: ReserveUiState = ReserveUiState(),
    onReserve: (checkIn: String, checkOut: String, adults: Int, children: Int, infants: Int, pets: Int) -> Unit = { _, _, _, _, _, _ -> },
    onSignIn: () -> Unit = {},
    onResetReserve: () -> Unit = {},
    isSaved: Boolean = false,
    onToggleSaved: () -> Unit = {},
    reviewsState: ListingReviewsUiState = ListingReviewsUiState(),
    /** The host's other listings (for the "More from this host" rail). The current listing is excluded here. */
    hostListings: List<Listing> = emptyList(),
    /** Opens another of the host's listings in its own detail screen. */
    onOpenListing: (Listing) -> Unit = {},
    /** Opens the host's public profile (reviews + their other listings) from the "Hosted by" row. */
    onOpenHostProfile: () -> Unit = {},
    /** Booked + host-blocked spans for this listing; greys out those days in the reserve picker. */
    unavailableRanges: List<com.quickin.app.AvailabilityRange> = emptyList(),
    /**
     * True when the signed-in user is this listing's host. Shows a "Manage availability" entry
     * that opens the host block/unblock sheet instead of the guest reserve panel's picker.
     */
    isOwnHost: Boolean = false,
    /** Host availability manager state (blocks + booked spans), driven by AvailabilityViewModel. */
    hostAvailabilityState: com.quickin.app.HostAvailabilityUiState = com.quickin.app.HostAvailabilityUiState(),
    /** Loads the host's availability for this listing (called when the manager sheet opens). */
    onLoadHostAvailability: () -> Unit = {},
    /** Host blocks [start, end) (yyyy-MM-dd, half-open) on this listing. */
    onAddBlock: (start: String, end: String, note: String?) -> Unit = { _, _, _ -> },
    /** Host removes a block by id. */
    onRemoveBlock: (blockId: String) -> Unit = {},
    /**
     * Host-only cancellation-policy editor state (`PATCH /api/local/listings/:id`), driven by
     * HostViewModel. Lets the owning host change the policy from the detail screen.
     */
    cancellationPolicyState: com.quickin.app.CancellationPolicyUiState = com.quickin.app.CancellationPolicyUiState(),
    /** Host saves a new cancellation policy ("flexible"|"moderate"|"strict") for this listing. */
    onSaveCancellationPolicy: (policy: String) -> Unit = {},
    /**
     * The host's fetched trust badges (Superhost / New host / verified) from their public profile.
     * Augments the lightweight Verified chip read from [Listing.hostVerified]; empty until fetched.
     */
    hostBadges: com.quickin.app.TrustBadges = com.quickin.app.TrustBadges(),
    /**
     * State for the "Report this listing" sheet (in-flight / error / submitted / needs-sign-in),
     * driven by TrustViewModel.
     */
    reportState: com.quickin.app.ReportUiState = com.quickin.app.ReportUiState(),
    /** Files a report on this listing: (reason code, optional details). */
    onSubmitReport: (reason: String, details: String?) -> Unit = { _, _ -> },
    /** Resets the report state (sheet dismiss / after success / leaving the screen). */
    onResetReport: () -> Unit = {}
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    // The host's *other* stays — exclude the one we're viewing; the rail hides when empty.
    val moreFromHost = remember(hostListings, listing.id) {
        hostListings.filter { it.id != listing.id }
    }
    // True while the "Report this listing" bottom sheet is open.
    var showReportSheet by remember { mutableStateOf(false) }

    // A signed-out report attempt routes to sign-in (closing the sheet + resetting state first).
    androidx.compose.runtime.LaunchedEffect(reportState.needsSignIn) {
        if (reportState.needsSignIn) {
            showReportSheet = false
            onResetReport()
            onSignIn()
        }
    }
    // On a successful report, close the sheet — the "thanks" dialog (below) takes over.
    androidx.compose.runtime.LaunchedEffect(reportState.submitted) {
        if (reportState.submitted) showReportSheet = false
    }

    Scaffold(containerColor = CreamPage) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = padding.calculateBottomPadding())
                .background(CreamPage)
        ) {
            // Edge-to-edge Ken Burns hero with an overlaid back button, share + heart and a dark
            // legibility gradient — the boutique detail header.
            item {
                DetailHero(
                    listing,
                    onBack,
                    isSaved = isSaved,
                    onToggleSaved = onToggleSaved,
                    onShare = {
                        shareText(
                            context = context,
                            text = ShareLinks.listing(listing.id),
                            subject = context.getString(R.string.share_subject, listing.title),
                            chooserTitle = context.getString(R.string.share_chooser_title)
                        )
                    }
                )
            }
            item {
                Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            listing.title,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold,
                            fontStyle = FontStyle.Italic,
                            fontFamily = FontFamily.Serif,
                            color = Ink
                        )
                        // Real rating (gold ★ + value · count) or a "New" tag when no reviews yet.
                        val reviewCountLabel = androidx.compose.ui.res.pluralStringResource(
                            R.plurals.reviews_count, listing.reviewCount, listing.reviewCount
                        )
                        RatingOrNew(
                            rating = listing.rating,
                            reviewCount = listing.reviewCount,
                            starSize = 16.dp,
                            fontSize = 14.sp,
                            countText = { "· $reviewCountLabel" }
                        )
                        if (listing.location != null) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Filled.LocationOn, null, tint = Muted, modifier = Modifier.height(18.dp))
                                Text(listing.location, color = Muted, fontSize = 14.sp)
                            }
                        }
                        if (listing.isGuestFavorite) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Filled.Star, null, tint = Gold, modifier = Modifier.height(16.dp))
                                Spacer(Modifier.width(4.dp))
                                Text(stringResource(R.string.listing_guest_favorite), color = GoldDeep, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                    // "Hosted by {host}" — gold avatar (host initial) + name + trust badges.
                    // Tappable (chevron) when we have a host id, opening the host's public profile.
                    if (!listing.hostName.isNullOrBlank()) {
                        HostedByRow(
                            hostName = listing.hostName,
                            hostVerified = listing.hostVerified,
                            hostBadges = hostBadges,
                            onClick = if (!listing.hostId.isNullOrBlank()) onOpenHostProfile else null
                        )
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        StatChip(Icons.Filled.People, "${listing.maxGuests ?: 0}", stringResource(R.string.detail_guests), modifier = Modifier.weight(1f))
                        StatChip(Icons.Filled.Bed, "${listing.bedrooms ?: 0}", stringResource(R.string.detail_bedrooms), modifier = Modifier.weight(1f))
                        StatChip(Icons.Filled.Bed, "${listing.beds ?: 0}", stringResource(R.string.detail_beds), modifier = Modifier.weight(1f))
                        StatChip(Icons.Filled.Bathtub, "${listing.bathrooms ?: 0}", stringResource(R.string.detail_baths), modifier = Modifier.weight(1f))
                    }
                    if (!listing.description.isNullOrEmpty()) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            SectionHeader(stringResource(R.string.detail_about_place))
                            Text(listing.description, color = Muted, fontSize = 15.sp, lineHeight = 22.sp)
                        }
                    }

                    if (listing.amenities.isNotEmpty()) {
                        AmenitiesSection(listing.amenities)
                    }

                    // The effective policy: a freshly-saved value (for this listing) wins over the
                    // listing's own field so the row updates right after the host edits it.
                    val effectivePolicy =
                        if (cancellationPolicyState.listingId == listing.id)
                            cancellationPolicyState.savedPolicy ?: listing.cancellationPolicy
                        else listing.cancellationPolicy

                    // "Cancellation policy" row — name + one-line explanation (every viewer sees it).
                    CancellationPolicySection(policy = effectivePolicy)

                    ReservePanel(
                        listing = listing,
                        state = reserveState,
                        onReserve = onReserve,
                        onSignIn = onSignIn,
                        onResetReserve = onResetReserve,
                        unavailableRanges = unavailableRanges,
                        isOwnHost = isOwnHost,
                        hostAvailabilityState = hostAvailabilityState,
                        onLoadHostAvailability = onLoadHostAvailability,
                        onAddBlock = onAddBlock,
                        onRemoveBlock = onRemoveBlock,
                        cancellationPolicy = effectivePolicy,
                        cancellationPolicyState = cancellationPolicyState,
                        onSaveCancellationPolicy = onSaveCancellationPolicy
                    )

                    // Guest reviews for this stay (real, from GET /api/local/reviews?listing_id=).
                    ReviewsSection(listing = listing, state = reviewsState)

                    // "Report this listing" — opens the report bottom sheet (Trust & Safety).
                    ReportListingRow(onClick = { showReportSheet = true })
                }
            }
            // "More from this host" — a horizontal rail of the host's other stays. Full-bleed
            // (its own item, outside the padded content) so cards can edge-scroll. Hidden when none.
            if (moreFromHost.isNotEmpty()) {
                item {
                    MoreFromHostSection(
                        listings = moreFromHost,
                        onOpenListing = onOpenListing,
                        modifier = Modifier.padding(bottom = 24.dp)
                    )
                }
            }
        }

        // "Report this listing" bottom sheet — reason single-select + optional details + submit.
        if (showReportSheet) {
            ReportListingSheet(
                isSubmitting = reportState.isSubmitting,
                error = reportState.error,
                onSubmit = { reason, details -> onSubmitReport(reason, details) },
                onDismiss = {
                    showReportSheet = false
                    onResetReport()
                }
            )
        }

        // "Thanks for reporting" confirmation — shown once the report POST succeeds.
        if (reportState.submitted) {
            ReportThanksDialog(onDismiss = onResetReport)
        }
    }
}

/**
 * "Hosted by {name}" — a gold [GradientAvatar] bearing the host's initial next to the host's
 * name, with the host's trust badges beneath. The Verified chip lights immediately from
 * [hostVerified] (the listing's own flag); [hostBadges] adds Superhost / New host once the host's
 * public profile is fetched. RTL-safe: the Row lays out start→end so the avatar leads in both
 * reading directions.
 *
 * When [onClick] is non-null the whole row is tappable and shows a trailing chevron, opening the
 * host's public profile (their reviews + other listings).
 */
@Composable
private fun HostedByRow(
    hostName: String,
    hostVerified: Boolean = false,
    hostBadges: com.quickin.app.TrustBadges = com.quickin.app.TrustBadges(),
    onClick: (() -> Unit)? = null
) {
    val initial = hostName.trim().firstOrNull()?.uppercase() ?: "?"
    val rowModifier = Modifier
        .fillMaxWidth()
        .padding(top = 2.dp)
        .let { if (onClick != null) it.clickable(onClick = onClick) else it }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = rowModifier
    ) {
        GradientAvatar(initials = initial, size = 36.dp)
        Spacer(Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                stringResource(R.string.detail_hosted_by, hostName),
                color = Ink,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1
            )
            // Trust badges: Verified is lit from the listing flag right away; Superhost / New host
            // appear once the host's public profile loads. Renders nothing when no badge applies.
            TrustBadgeRow(
                badges = hostBadges,
                verifiedOverride = hostVerified,
                modifier = Modifier.padding(top = 6.dp)
            )
        }
        // A trailing chevron hints the row is tappable → the host's profile (auto-mirrors in RTL).
        if (onClick != null) {
            Icon(
                Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = stringResource(R.string.host_profile_view),
                tint = Muted,
                modifier = Modifier.size(24.dp)
            )
        }
    }
}

/**
 * "More from this host" — a section header above a horizontal [LazyRow] of the host's other
 * listings as the redesigned boutique cards. Each card opens its own detail. The header is
 * inset to match the page padding while the rail itself bleeds to the screen edges.
 */
@Composable
private fun MoreFromHostSection(
    listings: List<Listing>,
    onOpenListing: (Listing) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        SectionHeader(
            stringResource(R.string.detail_more_from_host),
            modifier = Modifier.padding(horizontal = 20.dp)
        )
        LazyRow(
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            items(listings, key = { it.id }) { item ->
                HostListingCard(
                    listing = item,
                    onClick = { onOpenListing(item) }
                )
            }
        }
    }
}

/**
 * A compact, fixed-width version of the explore listing card for the "More from this host"
 * rail: a Ken Burns cover, title, location and price. Tapping opens the listing's detail.
 */
@Composable
private fun HostListingCard(
    listing: Listing,
    onClick: () -> Unit
) {
    BoutiqueCard(
        modifier = Modifier.width(220.dp),
        onClick = onClick,
        shadow = 8.dp
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(150.dp)
            ) {
                KenBurnsImage(
                    url = listing.sortedImageUrls.firstOrNull(),
                    contentDescription = listing.title,
                    modifier = Modifier.fillMaxSize()
                )
                Box(
                    modifier = Modifier
                        .matchParentSize()
                        .background(
                            Brush.verticalGradient(
                                0f to Color.Transparent,
                                0.55f to Color.Transparent,
                                1f to Ink.copy(alpha = 0.45f)
                            )
                        )
                )
            }
            Column(modifier = Modifier.padding(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        listing.title,
                        fontWeight = FontWeight.Bold,
                        color = Ink,
                        fontSize = 15.sp,
                        maxLines = 1,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                    Spacer(Modifier.width(6.dp))
                    RatingOrNew(rating = listing.rating, reviewCount = listing.reviewCount, fontSize = 12.sp, starSize = 12.dp)
                }
                if (listing.location != null) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                        Icon(Icons.Filled.LocationOn, contentDescription = null, tint = Muted, modifier = Modifier.size(13.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(listing.location, color = Muted, fontSize = 13.sp, maxLines = 1)
                    }
                }
                Row(modifier = Modifier.padding(top = 8.dp), verticalAlignment = Alignment.Bottom) {
                    Text(com.quickin.app.CurrencyManager.format(listing.pricePerNight), fontWeight = FontWeight.Bold, color = Burgundy, fontSize = 15.sp)
                    Text(stringResource(R.string.listing_per_night), color = Muted, fontSize = 13.sp)
                }
            }
        }
    }
}

/**
 * "Reviews" block on the listing detail: a header with the average rating, then each guest's
 * star row + name + comment. Renders a quiet "no reviews yet" line when the stay is unreviewed,
 * and a small spinner row while loading.
 */
@Composable
private fun ReviewsSection(listing: Listing, state: ListingReviewsUiState) {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            SectionHeader(stringResource(R.string.reviews_title), modifier = Modifier.weight(1f))
            if (listing.reviewCount > 0 && listing.rating > 0.0) {
                GoldRatingRow(
                    rating = listing.ratingText,
                    starSize = 16.dp,
                    fontSize = 15.sp
                )
            }
        }

        when {
            state.isLoading && state.reviews.isEmpty() -> {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(color = Burgundy, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(10.dp))
                    Text(stringResource(R.string.reviews_loading), color = Muted, fontSize = 14.sp)
                }
            }
            state.reviews.isEmpty() -> {
                Text(stringResource(R.string.reviews_empty), color = Muted, fontSize = 14.sp)
            }
            else -> {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    state.reviews.forEach { review -> ReviewCard(review) }
                }
            }
        }
    }
}

/** One guest review: a gold star row with the rating, the reviewer's name, and their comment. */
@Composable
private fun ReviewCard(review: Review) {
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(18.dp),
        shadowElevation = 2.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                StarRatingRow(rating = review.rating, starSize = 14.dp)
                Spacer(Modifier.width(10.dp))
                Text(
                    review.reviewerName?.takeUnless { it.isBlank() } ?: stringResource(R.string.profile_guest),
                    fontWeight = FontWeight.SemiBold,
                    color = Ink,
                    fontSize = 14.sp,
                    maxLines = 1
                )
            }
            if (!review.comment.isNullOrBlank()) {
                Text(review.comment, color = Muted, fontSize = 14.sp, lineHeight = 20.sp)
            }
            // Reviewer's attached photos as a horizontal thumbnail row (data: decoded, http via Coil).
            if (review.photos.isNotEmpty()) {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(review.photos) { photo ->
                        ReviewPhotoThumbnail(
                            url = photo,
                            size = 92.dp,
                            contentDescription = stringResource(R.string.reviews_photo_desc)
                        )
                    }
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
    onReserve: (checkIn: String, checkOut: String, adults: Int, children: Int, infants: Int, pets: Int) -> Unit,
    onSignIn: () -> Unit,
    onResetReserve: () -> Unit,
    unavailableRanges: List<com.quickin.app.AvailabilityRange> = emptyList(),
    isOwnHost: Boolean = false,
    hostAvailabilityState: com.quickin.app.HostAvailabilityUiState = com.quickin.app.HostAvailabilityUiState(),
    onLoadHostAvailability: () -> Unit = {},
    onAddBlock: (start: String, end: String, note: String?) -> Unit = { _, _, _ -> },
    onRemoveBlock: (blockId: String) -> Unit = {},
    cancellationPolicy: String = "moderate",
    cancellationPolicyState: com.quickin.app.CancellationPolicyUiState = com.quickin.app.CancellationPolicyUiState(),
    onSaveCancellationPolicy: (policy: String) -> Unit = {}
) {
    var checkIn by remember { mutableStateOf("") }
    var checkOut by remember { mutableStateOf("") }
    var adults by remember { mutableStateOf(1) }
    var children by remember { mutableStateOf(0) }
    var infants by remember { mutableStateOf(0) }
    var pets by remember { mutableStateOf(0) }
    var showDatePicker by remember { mutableStateOf(false) }
    // Host-only: the "Manage availability" block/unblock sheet.
    var showAvailabilityManager by remember { mutableStateOf(false) }
    // Host-only: the "Edit cancellation policy" sheet.
    var showPolicyEditor by remember { mutableStateOf(false) }

    val nights = nightsBetween(checkIn, checkOut)
    // Base, client-side estimate (nights × nightly). The authoritative quote below replaces it once
    // both dates are chosen; this is the fallback shown while it loads or if the request fails.
    val estimateTotal = nights * listing.pricePerNight
    val canReserve = nights > 0 && !state.isSubmitting

    // Authoritative stay quote (honors weekend + monthly + length-of-stay discount). Fetched from
    // the public quote endpoint whenever both dates are set; debounced so rapid changes coalesce.
    // On any failure we keep [quote] null and fall back to [estimateTotal].
    var quote by remember(listing.id) { mutableStateOf<StayQuote?>(null) }
    var quoteLoading by remember(listing.id) { mutableStateOf(false) }
    var quoteFailed by remember(listing.id) { mutableStateOf(false) }
    LaunchedEffect(listing.id, checkIn, checkOut) {
        if (nights <= 0) {
            quote = null; quoteLoading = false; quoteFailed = false
            return@LaunchedEffect
        }
        quoteLoading = true
        quoteFailed = false
        // Debounce so dragging across the date picker doesn't fire a request per day.
        kotlinx.coroutines.delay(350)
        val result = SupabaseService.fetchStayQuote(listing.id, checkIn, checkOut)
        // Guard against a stale response: only apply if these are still the chosen dates.
        if (nightsBetween(checkIn, checkOut) == nights) {
            quote = result
            quoteFailed = result == null
            quoteLoading = false
        }
    }
    // The total used for display + the breakdown: the quote's authoritative total when present,
    // otherwise the local estimate.
    val displayTotal = quote?.total ?: estimateTotal

    if (showDatePicker) {
        DateRangePickerSheet(
            initialCheckIn = checkIn.ifBlank { null },
            initialCheckOut = checkOut.ifBlank { null },
            unavailableRanges = unavailableRanges,
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

    if (showAvailabilityManager) {
        AvailabilityManagerSheet(
            state = hostAvailabilityState,
            onAddBlock = onAddBlock,
            onRemoveBlock = onRemoveBlock,
            onDismiss = { showAvailabilityManager = false }
        )
    }

    // A successful reservation surfaces a branded, on-brand confirmation modal over a
    // scrim. Bookings start as 'pending' — awaiting the host's confirmation.
    if (state.confirmed != null) {
        val b = state.confirmed
        ReservationConfirmationDialog(
            booking = b,
            listingTitle = listing.title,
            onDismiss = onResetReserve
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
                Text(com.quickin.app.CurrencyManager.format(listing.pricePerNight), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink)
                Text(stringResource(R.string.listing_per_night), fontSize = 14.sp, color = Muted)
            }

            // Length-of-stay discount note (e.g. "Weekly −10% · Monthly −20%"), shown when the host
            // offers one. The backend applies the discount to the total server-side.
            if (listing.hasStayDiscount) {
                StayDiscountNote(
                    weekly = listing.weeklyDiscount,
                    monthly = listing.monthlyDiscount
                )
            }

            // Seasonal pricing note — shown when the host set a weekend rate or any per-month price.
            // The quote endpoint resolves the exact total for the guest's chosen dates below.
            if (listing.hasSeasonalPricing) {
                SeasonalRatesNote()
            }

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                DateTapField(
                    label = stringResource(R.string.detail_check_in),
                    value = checkIn,
                    onClick = { showDatePicker = true },
                    modifier = Modifier.weight(1f)
                )
                DateTapField(
                    label = stringResource(R.string.detail_check_out),
                    value = checkOut,
                    onClick = { showDatePicker = true },
                    modifier = Modifier.weight(1f)
                )
            }

            val maxGuests = listing.maxGuests ?: 16
            Column(modifier = Modifier.fillMaxWidth()) {
                GuestStepperRow("Adults", "Age 13+", adults, 1, maxGuests) { adults = it }
                GuestStepperRow("Children", "Ages 2–12", children, 0, (maxGuests - adults).coerceAtLeast(0)) { children = it }
                GuestStepperRow("Infants", "Under 2", infants, 0, 5) { infants = it }
                GuestStepperRow("Pets", "Service animals welcome", pets, 0, 5) { pets = it }
            }

            // Price breakdown. With no dates: a "select your dates" hint. With dates: the
            // authoritative quote (nightlyAvg × nights, subtotal, any length-of-stay discount, and
            // the total) once it resolves, or the local estimate (nights × nightly) as a fallback.
            if (nights <= 0) {
                Text(
                    stringResource(R.string.detail_select_dates),
                    color = Muted,
                    fontSize = 14.sp
                )
            } else {
                val q = quote
                if (q != null) {
                    // Resolved seasonal quote: average nightly × nights, subtotal, optional discount.
                    QuoteLine(
                        label = stringResource(
                            R.string.pricing_nights,
                            com.quickin.app.CurrencyManager.format(q.nightlyAvg),
                            q.nights
                        ),
                        value = com.quickin.app.CurrencyManager.format(q.subtotal)
                    )
                    if (q.hasDiscount) {
                        QuoteLine(
                            label = stringResource(R.string.growth_discount_off_label, q.discountPercent),
                            value = "−" + com.quickin.app.CurrencyManager.format(q.subtotal - q.total),
                            valueColor = GoldDeep
                        )
                    }
                } else {
                    // Fallback estimate while the quote loads or after a failure (nights × nightly).
                    QuoteLine(
                        label = stringResource(
                            R.string.detail_nights,
                            com.quickin.app.CurrencyManager.format(listing.pricePerNight),
                            nights
                        ),
                        value = com.quickin.app.CurrencyManager.format(estimateTotal)
                    )
                }

                // A subtle note when an exact quote couldn't be fetched (estimate is shown instead).
                if (quoteFailed) {
                    Text(
                        stringResource(R.string.pricing_quote_error),
                        color = Muted,
                        fontSize = 12.sp
                    )
                }

                HorizontalDivider(color = Tan)

                // Total row — uses the quote total when present, otherwise the estimate.
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            stringResource(R.string.detail_total),
                            color = Ink,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp
                        )
                        if (quoteLoading) {
                            Spacer(Modifier.width(8.dp))
                            CircularProgressIndicator(
                                color = Burgundy,
                                strokeWidth = 2.dp,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                    }
                    Text(
                        com.quickin.app.CurrencyManager.format(displayTotal),
                        color = Ink,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                }
            }

            if (state.needsSignIn) {
                Text(stringResource(R.string.detail_sign_in_to_reserve), color = ErrorRed, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            } else if (state.error != null) {
                Text(state.error, color = ErrorRed, fontSize = 14.sp)
            }

            if (state.needsSignIn) {
                GradientButton(
                    onClick = onSignIn,
                    modifier = Modifier.fillMaxWidth(),
                    height = 52.dp
                ) {
                    Text(stringResource(R.string.detail_sign_in_to_reserve), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                }
            } else {
                // The primary CTA on this screen — burgundy gradient + pulsing ring (qkPulse).
                GradientButton(
                    onClick = {
                        onReserve(checkIn, checkOut, adults, children, infants, pets)
                    },
                    enabled = canReserve,
                    pulse = canReserve,
                    modifier = Modifier.fillMaxWidth(),
                    height = 52.dp
                ) {
                    if (state.isSubmitting) {
                        CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.height(22.dp))
                    } else {
                        Text(stringResource(R.string.detail_reserve), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                    }
                }
            }

            // Host of this listing: a calendar manager to block / unblock date ranges. Opening
            // it loads the listing's current spans (booked read-only + blocked removable).
            if (isOwnHost) {
                OutlinedButton(
                    onClick = {
                        onLoadHostAvailability()
                        showAvailabilityManager = true
                    },
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, Burgundy),
                    colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White, contentColor = Burgundy),
                    modifier = Modifier.fillMaxWidth().height(52.dp)
                ) {
                    Icon(Icons.Filled.DateRange, contentDescription = null, tint = Burgundy, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(stringResource(R.string.availability_manage), fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                }
            }
        }
    }
}

/**
 * A small gold "length-of-stay discount" note shown under the nightly price when the host offers
 * one (e.g. "Weekly −10% · Monthly −20%"). Only the discount(s) that are set are shown; the
 * backend applies the discount to the total server-side (≥28 nights → monthly, ≥7 → weekly).
 * RTL-safe — a leading tag icon then a [Text] that follows the layout direction.
 */
@Composable
private fun StayDiscountNote(weekly: Int, monthly: Int) {
    val label = when {
        weekly > 0 && monthly > 0 -> stringResource(R.string.growth_discount_off, weekly, monthly)
        monthly > 0 -> stringResource(R.string.growth_discount_monthly_off, monthly)
        else -> stringResource(R.string.growth_discount_weekly_off, weekly)
    }
    Surface(
        color = Gold.copy(alpha = 0.16f),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            Icon(Icons.Filled.Sell, contentDescription = null, tint = GoldDeep, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text(label, color = GoldDeep, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

/**
 * A small gold "Weekend & seasonal rates apply" note shown under the nightly price when the host
 * set a weekend rate or any per-month price. The exact total for the guest's chosen dates is
 * resolved by the quote endpoint and shown in the breakdown below. RTL-safe.
 */
@Composable
private fun SeasonalRatesNote() {
    Surface(
        color = Gold.copy(alpha = 0.16f),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            Icon(Icons.Filled.DateRange, contentDescription = null, tint = GoldDeep, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                stringResource(R.string.pricing_seasonal_note),
                color = GoldDeep,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

/**
 * One "label … value" line in the reserve panel's price breakdown (e.g. "EGP 1,200 × 3 nights"
 * on the start, the amount on the end). RTL-safe via [Arrangement.SpaceBetween]. [valueColor]
 * defaults to [Ink] but can be tinted (e.g. gold for a discount line).
 */
@Composable
private fun QuoteLine(label: String, value: String, valueColor: Color = Ink) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, color = Muted, fontSize = 14.sp, modifier = Modifier.weight(1f, fill = false))
        Spacer(Modifier.width(8.dp))
        Text(value, color = valueColor, fontSize = 14.sp, fontWeight = FontWeight.Medium)
    }
}

/**
 * On-brand "Request sent" confirmation modal shown after a successful (pending) reservation.
 * Rendered in a [Dialog] so it floats over a dimming scrim; [usePlatformDefaultWidth] is
 * disabled so we control the width to match QuickIn's boutique card styling.
 */
@Composable
private fun ReservationConfirmationDialog(
    booking: Booking,
    listingTitle: String,
    onDismiss: () -> Unit
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            color = Color.White,
            shape = RoundedCornerShape(28.dp),
            shadowElevation = 16.dp,
            modifier = Modifier
                .padding(24.dp)
                .fillMaxWidth()
                .widthIn(max = 360.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // qkDraw + qkPop — the green tick draws itself on inside a popping circle.
                PopIn { DrawCheckmark(size = 72.dp) }

                Text(
                    stringResource(R.string.detail_request_sent),
                    color = Ink,
                    fontWeight = FontWeight.Bold,
                    fontSize = 22.sp,
                    textAlign = TextAlign.Center
                )

                Text(
                    stringResource(R.string.detail_waiting_host_stay, listingTitle),
                    color = Muted,
                    fontSize = 15.sp,
                    textAlign = TextAlign.Center,
                    lineHeight = 20.sp
                )

                Surface(
                    color = Tan,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            stringResource(R.string.detail_booking_summary, booking.checkIn, booking.checkOut, booking.guests),
                            color = Muted,
                            fontSize = 13.sp
                        )
                        HorizontalDivider(color = Ink.copy(alpha = 0.08f))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(stringResource(R.string.detail_total), color = Muted)
                            Text(booking.totalText, color = Burgundy, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                Button(
                    onClick = onDismiss,
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Burgundy,
                        contentColor = Color.White
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                ) {
                    Text(stringResource(R.string.action_done), fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

/**
 * The boutique detail hero. A single-photo listing gets a slow Ken Burns drift; multi-photo
 * listings keep a swipeable pager with a "2 / 5" indicator. Either way a dark legibility
 * gradient is laid over the bottom, with a frosted circular back button (start) and a springy
 * heart (end) floating on top. Both controls sit below the status bar.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DetailHero(
    listing: Listing,
    onBack: () -> Unit,
    isSaved: Boolean = false,
    onToggleSaved: () -> Unit = {},
    onShare: () -> Unit = {}
) {
    val urls = listing.sortedImageUrls
    val heroHeight = 320.dp
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(heroHeight)
    ) {
        if (urls.size > 1) {
            val pagerState = rememberPagerState(pageCount = { urls.size })
            HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
                // Constrain the page image to the hero box explicitly (fixed height + width +
                // Crop + clip) so it can never lay out at the photo's intrinsic pixel size and
                // stretch the screen — the responsiveness fix.
                AsyncImage(
                    model = urls[page],
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(heroHeight)
                        .clip(RoundedCornerShape(0.dp))
                        .background(Tan)
                )
            }
            Surface(
                shape = RoundedCornerShape(50),
                color = Ink.copy(alpha = 0.55f),
                modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp)
            ) {
                Text(
                    "${pagerState.currentPage + 1} / ${urls.size}",
                    color = Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                )
            }
        } else {
            KenBurnsImage(
                url = urls.firstOrNull(),
                contentDescription = listing.title,
                modifier = Modifier.fillMaxSize()
            )
        }
        // Legibility gradient (top + bottom) so the overlaid controls always read.
        Box(
            modifier = Modifier
                .matchParentSize()
                .background(
                    Brush.verticalGradient(
                        0f to Ink.copy(alpha = 0.22f),
                        0.28f to Color.Transparent,
                        1f to Ink.copy(alpha = 0.40f)
                    )
                )
        )
        // Frosted circular back button — uses logical TopStart so it mirrors under RTL.
        Box(
            modifier = Modifier
                .align(Alignment.TopStart)
                .statusBarsPadding()
                .padding(12.dp)
                .size(40.dp)
                .background(Color.White.copy(alpha = 0.92f), CircleShape)
                .clickable(onClick = onBack),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_back), tint = Ink, modifier = Modifier.size(20.dp))
        }
        // Share + heart sit together at the end edge (RTL-mirrored). Share leads the heart.
        Row(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .statusBarsPadding()
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            ShareButton(onClick = onShare, size = 40.dp)
            HeartButton(
                filled = isSaved,
                onToggle = onToggleSaved,
                size = 40.dp
            )
        }
    }
}

/**
 * "What this place offers" — the listing's amenities as an icon+label grid (two per row).
 * Each amenity maps to a representative Material icon, falling back to a generic check.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AmenitiesSection(amenities: List<String>) {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        SectionHeader(stringResource(R.string.detail_what_offers))
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            maxItemsInEachRow = 2,
            modifier = Modifier.fillMaxWidth()
        ) {
            amenities.forEach { amenity ->
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = Tan.copy(alpha = 0.5f),
                    modifier = Modifier.fillMaxWidth(0.46f)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 12.dp)
                    ) {
                        Icon(
                            amenityIcon(amenity),
                            contentDescription = null,
                            tint = Burgundy,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(Modifier.width(10.dp))
                        Text(amenity, color = Ink, fontSize = 14.sp, maxLines = 2)
                    }
                }
            }
        }
    }
}

/** "Cancellation policy" row — the host-set policy name + its one-line explanation.
 *  Every viewer sees it; copy + name follow the app locale (RTL-safe). */
@Composable
private fun CancellationPolicySection(policy: String) {
    val p = com.quickin.app.CancellationPolicy.from(policy)
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        SectionHeader(stringResource(R.string.cancel_policy))
        Surface(
            shape = RoundedCornerShape(14.dp),
            color = Tan.copy(alpha = 0.5f),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                verticalAlignment = Alignment.Top,
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 14.dp)
            ) {
                Icon(
                    Icons.Filled.EventBusy,
                    contentDescription = null,
                    tint = Burgundy,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(Modifier.width(12.dp))
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(stringResource(p.labelRes), color = Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                    Text(stringResource(p.descRes), color = Ink.copy(alpha = 0.7f), fontSize = 13.sp)
                }
            }
        }
    }
}

/** Maps an amenity label to a representative icon (case-insensitive), defaulting to a check. */
private fun amenityIcon(amenity: String): ImageVector = when (amenity.trim().lowercase()) {
    "wifi" -> Icons.Filled.Wifi
    "pool" -> Icons.Filled.Pool
    "kitchen" -> Icons.Filled.Kitchen
    "air conditioning" -> Icons.Filled.AcUnit
    "free parking" -> Icons.Filled.LocalParking
    "washer" -> Icons.Filled.LocalLaundryService
    "tv" -> Icons.Filled.Tv
    "heating" -> Icons.Filled.Thermostat
    "workspace" -> Icons.Filled.Work
    "gym" -> Icons.Filled.FitnessCenter
    "beach access" -> Icons.Filled.BeachAccess
    "pets allowed" -> Icons.Filled.Pets
    "hot tub" -> Icons.Filled.HotTub
    "bbq grill" -> Icons.Filled.OutdoorGrill
    "breakfast" -> Icons.Filled.FreeBreakfast
    else -> Icons.Filled.CheckCircle
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
                    shown ?: stringResource(R.string.detail_add),
                    color = if (shown != null) Ink else Muted,
                    fontSize = 15.sp,
                    fontWeight = if (shown != null) FontWeight.SemiBold else FontWeight.Normal
                )
            }
        }
    }
}

// ---- Host availability manager ---------------------------------------------

/**
 * Host-only "Manage availability" bottom sheet for the open listing. The host:
 *  • picks a start → end range (the same boutique calendar; already-unavailable days are greyed)
 *    and taps "Block dates" to POST a manual block (half-open `[start, end)`);
 *  • sees the current manual blocks, each removable; and
 *  • sees booked guest spans read-only.
 * The list refreshes after every add/remove (driven by [com.quickin.app.AvailabilityViewModel]).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AvailabilityManagerSheet(
    state: com.quickin.app.HostAvailabilityUiState,
    onAddBlock: (start: String, end: String, note: String?) -> Unit,
    onRemoveBlock: (blockId: String) -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    // The range the host is about to block (yyyy-MM-dd), plus an optional note.
    var pendingStart by remember { mutableStateOf<String?>(null) }
    var pendingEnd by remember { mutableStateOf<String?>(null) }
    var note by remember { mutableStateOf("") }
    var showPicker by remember { mutableStateOf(false) }

    // Block picker — greys out days already booked/blocked so the host can't double-book.
    if (showPicker) {
        DateRangePickerSheet(
            initialCheckIn = pendingStart,
            initialCheckOut = pendingEnd,
            unavailableRanges = state.ranges,
            onApply = { s, e ->
                pendingStart = s
                pendingEnd = e
                showPicker = false
            },
            onDismiss = { showPicker = false }
        )
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = CreamPage,
        contentColor = Ink
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 24.dp)
        ) {
            item {
                Text(
                    stringResource(R.string.availability_manage),
                    color = Ink,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                    modifier = Modifier.padding(top = 4.dp, bottom = 2.dp)
                )
                Text(
                    stringResource(R.string.availability_manage_subtitle),
                    color = Muted,
                    fontSize = 13.sp
                )
                Spacer(Modifier.height(16.dp))
            }

            // ---- Add-block form ----
            item {
                val rangeLabel = if (pendingStart != null && pendingEnd != null) {
                    "$pendingStart → $pendingEnd"
                } else null
                Surface(
                    color = Color.White,
                    shape = RoundedCornerShape(18.dp),
                    border = BorderStroke(1.dp, Tan),
                    modifier = Modifier.fillMaxWidth().clickable { showPicker = true }
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Filled.DateRange, contentDescription = null, tint = Burgundy, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(10.dp))
                        Text(
                            rangeLabel ?: stringResource(R.string.availability_pick_range),
                            color = if (rangeLabel != null) Ink else Muted,
                            fontSize = 15.sp,
                            fontWeight = if (rangeLabel != null) FontWeight.SemiBold else FontWeight.Normal
                        )
                    }
                }
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    label = { Text(stringResource(R.string.availability_note_optional)) },
                    singleLine = true,
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
                Spacer(Modifier.height(10.dp))
                val canAdd = pendingStart != null && pendingEnd != null && !state.isAdding
                Button(
                    onClick = {
                        val s = pendingStart
                        val e = pendingEnd
                        if (s != null && e != null) {
                            onAddBlock(s, e, note.ifBlank { null })
                            // Reset the form for the next block; the list refreshes via the VM.
                            pendingStart = null
                            pendingEnd = null
                            note = ""
                        }
                    },
                    enabled = canAdd,
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Burgundy,
                        contentColor = Color.White,
                        disabledContainerColor = Burgundy.copy(alpha = 0.4f),
                        disabledContentColor = Color.White
                    ),
                    modifier = Modifier.fillMaxWidth().height(50.dp)
                ) {
                    if (state.isAdding) {
                        CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                    } else {
                        Icon(Icons.Filled.Add, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(stringResource(R.string.availability_block_dates), fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                    }
                }
                if (state.error != null) {
                    Spacer(Modifier.height(8.dp))
                    Text(state.error, color = ErrorRed, fontSize = 13.sp)
                }
                Spacer(Modifier.height(20.dp))
            }

            // ---- Current blocks (removable) ----
            item {
                SectionHeader(stringResource(R.string.availability_blocked))
                Spacer(Modifier.height(10.dp))
            }
            if (state.isLoading && state.ranges.isEmpty()) {
                item {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 8.dp)) {
                        CircularProgressIndicator(color = Burgundy, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(10.dp))
                        Text(stringResource(R.string.availability_loading), color = Muted, fontSize = 14.sp)
                    }
                }
            } else if (state.blocks.isEmpty()) {
                item {
                    Text(stringResource(R.string.availability_no_blocks), color = Muted, fontSize = 14.sp)
                }
            } else {
                items(state.blocks, key = { it.id }) { block ->
                    AvailabilityRow(
                        range = block,
                        removable = true,
                        removing = state.removingId == block.id,
                        onRemove = { onRemoveBlock(block.id) }
                    )
                    Spacer(Modifier.height(10.dp))
                }
            }

            // ---- Booked spans (read-only) ----
            if (state.booked.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(10.dp))
                    SectionHeader(stringResource(R.string.availability_booked))
                    Spacer(Modifier.height(10.dp))
                }
                items(state.booked, key = { "booked-" + it.id + it.start }) { booked ->
                    AvailabilityRow(
                        range = booked,
                        removable = false,
                        removing = false,
                        onRemove = {}
                    )
                    Spacer(Modifier.height(10.dp))
                }
            }
        }
    }
}

/**
 * One row in the availability manager: the span's date range plus either a remove button
 * (manual host blocks) or a read-only "Booked" lock (guest reservations). Shows the host's note
 * under a block when present.
 */
@Composable
private fun AvailabilityRow(
    range: com.quickin.app.AvailabilityRange,
    removable: Boolean,
    removing: Boolean,
    onRemove: () -> Unit
) {
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(16.dp),
        shadowElevation = 2.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                if (removable) Icons.Filled.EventBusy else Icons.Filled.Lock,
                contentDescription = null,
                tint = if (removable) Burgundy else Muted,
                modifier = Modifier.size(20.dp)
            )
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(range.dateRangeText, color = Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                if (!range.note.isNullOrBlank()) {
                    Text(range.note, color = Muted, fontSize = 13.sp, maxLines = 2)
                }
            }
            if (removable) {
                if (removing) {
                    CircularProgressIndicator(color = Burgundy, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                } else {
                    IconButton(onClick = onRemove) {
                        Icon(
                            Icons.Filled.Close,
                            contentDescription = stringResource(R.string.availability_remove),
                            tint = ErrorRed
                        )
                    }
                }
            }
        }
    }
}

/** One labelled +/- row of the guest breakdown (adults/children/infants/pets). */
@Composable
private fun GuestStepperRow(
    label: String,
    sub: String,
    value: Int,
    min: Int,
    max: Int,
    onChange: (Int) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(label, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            Text(sub, fontSize = 12.sp, color = Muted)
        }
        IconButton(
            onClick = { onChange(value - 1) },
            enabled = value > min,
            modifier = Modifier.semantics { contentDescription = "Decrease $label" }
        ) {
            Text("−", fontSize = 22.sp, color = if (value > min) Burgundy else Muted)
        }
        Text(
            "$value",
            modifier = Modifier.widthIn(min = 24.dp).padding(horizontal = 4.dp),
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold
        )
        IconButton(
            onClick = { onChange(value + 1) },
            enabled = value < max,
            modifier = Modifier.semantics { contentDescription = "Increase $label" }
        ) {
            Text("+", fontSize = 22.sp, color = if (value < max) Burgundy else Muted)
        }
    }
}
