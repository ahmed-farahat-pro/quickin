package com.quickin.app.ui

import android.annotation.SuppressLint
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Sell
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.AiWriterUiState
import com.quickin.app.AvatarImage
import com.quickin.app.Config
import com.quickin.app.CreateListingUiState
import com.quickin.app.HostBooking
import com.quickin.app.HostBookingsUiState
import com.quickin.app.HostListingsUiState
import com.quickin.app.Listing
import com.quickin.app.ListingApproval
import com.quickin.app.OwnershipDocUiState
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.rememberMarkerState
import com.google.maps.android.compose.rememberCameraPositionState
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

private val ErrorRed = Color(0xFFB3261E)
private val SuccessGreen = Color(0xFF2E7D32)

/** Default pin-picker camera target (all of Egypt) until the host taps the map. */
private val EGYPT = LatLng(26.8206, 30.8025)
private const val EGYPT_ZOOM = 5.5f

/**
 * Host-only area (reached from the Profile tab when role == "host"). Three tabs:
 *  • Requests — reservation requests across the host's listings, with Confirm / Reject
 *               on pending ones (`GET /api/local/host/bookings`, `PATCH /api/local/bookings/:id`).
 *  • Review guests — past guests the host can rate (`GET/POST /api/local/guest-reviews`).
 *  • Add listing — a form that POSTs `/api/local/listings`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HostScreen(
    bookingsState: HostBookingsUiState,
    createState: CreateListingUiState,
    reviewGuestsState: com.quickin.app.ReviewGuestsUiState = com.quickin.app.ReviewGuestsUiState(),
    onBack: (() -> Unit)?,
    onLoadBookings: () -> Unit,
    onConfirm: (String) -> Unit,
    onReject: (String) -> Unit,
    onMessage: (String) -> Unit,
    onLoadReviewableGuests: () -> Unit = {},
    onSubmitGuestReview: (bookingId: String, rating: Int, comment: String) -> Unit = { _, _, _ -> },
    onCreateListing: (
        title: String, description: String, location: String, country: String,
        pricePerNight: String, maxGuests: String, bedrooms: String, beds: String,
        bathrooms: String, propertyType: String, imageUrl: String,
        amenities: List<String>, lat: Double?, lng: Double?, region: String?,
        cancellationPolicy: String, ownershipDoc: String?,
        weeklyDiscount: String, monthlyDiscount: String
    ) -> Unit,
    onResetCreate: () -> Unit,
    // ---- AI listing-description writer (Section 10) ----
    aiWriter: AiWriterUiState = AiWriterUiState(),
    onGenerateDescription: (
        title: String, location: String, region: String, propertyType: String,
        bedrooms: Int, maxGuests: Int, amenities: List<String>, notes: String
    ) -> Unit = { _, _, _, _, _, _, _, _ -> },
    onConsumeGeneratedDescription: () -> Unit = {},
    onClearAiWriter: () -> Unit = {}
) {
    var tab by remember { mutableIntStateOf(0) }

    Scaffold(
        containerColor = CreamPage,
        topBar = {
            TopAppBar(
                title = { Text("Host", color = Ink, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Ink)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = CreamPage)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(CreamPage)
        ) {
            TabRow(
                selectedTabIndex = tab,
                containerColor = CreamPage,
                contentColor = Burgundy,
                indicator = { positions ->
                    if (tab < positions.size) {
                        TabRowDefaults.SecondaryIndicator(
                            Modifier.tabIndicatorOffset(positions[tab]),
                            color = Burgundy
                        )
                    }
                }
            ) {
                Tab(
                    selected = tab == 0,
                    onClick = { tab = 0 },
                    text = { Text("Requests", fontWeight = FontWeight.SemiBold) },
                    selectedContentColor = Burgundy,
                    unselectedContentColor = Muted
                )
                Tab(
                    selected = tab == 1,
                    onClick = { tab = 1 },
                    text = { Text(stringResource(com.quickin.app.R.string.reviews_review_guests), fontWeight = FontWeight.SemiBold) },
                    selectedContentColor = Burgundy,
                    unselectedContentColor = Muted
                )
                Tab(
                    selected = tab == 2,
                    onClick = { tab = 2 },
                    text = { Text("Add listing", fontWeight = FontWeight.SemiBold) },
                    selectedContentColor = Burgundy,
                    unselectedContentColor = Muted
                )
            }

            when (tab) {
                0 -> RequestsTab(
                    state = bookingsState,
                    onLoad = onLoadBookings,
                    onConfirm = onConfirm,
                    onReject = onReject,
                    onMessage = onMessage
                )
                1 -> ReviewGuestsTab(
                    state = reviewGuestsState,
                    onLoad = onLoadReviewableGuests,
                    onSubmit = onSubmitGuestReview
                )
                else -> AddListingTab(
                    state = createState,
                    onCreate = onCreateListing,
                    onReset = onResetCreate,
                    aiWriter = aiWriter,
                    onGenerateDescription = onGenerateDescription,
                    onConsumeGeneratedDescription = onConsumeGeneratedDescription,
                    onClearAiWriter = onClearAiWriter
                )
            }
        }
    }
}

// ---- Host bottom-nav destinations (role-aware tab bar) ----------------------

/**
 * "Listings" bottom-nav tab for hosts: the host's own published listings as cards, with a
 * prominent "Add a listing" entry at the top that opens the add-listing wizard. Loads the
 * host's listings on first appearance (`GET /api/local/host/listings` via [HostViewModel]).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HostListingsScreen(
    state: HostListingsUiState,
    onLoad: () -> Unit,
    onAddListing: () -> Unit,
    onOpenListing: (Listing) -> Unit = {},
    ownershipState: OwnershipDocUiState = OwnershipDocUiState(),
    onReuploadDoc: (listingId: String, ownershipDoc: String) -> Unit = { _, _ -> },
    stayDiscountState: com.quickin.app.StayDiscountUiState = com.quickin.app.StayDiscountUiState(),
    onSaveStayDiscounts: (listingId: String, weekly: Int, monthly: Int) -> Unit = { _, _, _ -> },
    contentPadding: PaddingValues = PaddingValues()
) {
    LaunchedEffect(Unit) {
        if (!state.loaded) onLoad()
    }
    Scaffold(
        containerColor = CreamPage,
        modifier = Modifier.padding(contentPadding),
        topBar = {
            TopAppBar(
                title = { Text("My listings", color = Ink, fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = CreamPage)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(CreamPage)
        ) {
            // "Add a listing" entry — always visible at the top of the tab.
            GradientButton(
                onClick = onAddListing,
                height = 52.dp,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                Icon(Icons.Filled.Add, null, tint = Color.White, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Add a listing", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            }

            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                when {
                    state.isLoading && state.listings.isEmpty() -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = Burgundy)
                        Text("Loading your listings…", color = Muted, modifier = Modifier.padding(top = 12.dp))
                    }
                    state.error != null && state.listings.isEmpty() -> Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(32.dp)
                    ) {
                        Text("Couldn't load your listings", fontWeight = FontWeight.Bold, color = Ink, fontSize = 18.sp)
                        Text(state.error, color = Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp, bottom = 16.dp))
                        Button(onClick = onLoad, colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White)) {
                            Text("Retry")
                        }
                    }
                    state.listings.isEmpty() -> Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(32.dp)
                    ) {
                        Icon(Icons.Filled.Home, contentDescription = null, tint = Burgundy, modifier = Modifier.size(48.dp))
                        Text("No listings yet", fontWeight = FontWeight.Bold, color = Ink, fontSize = 18.sp, modifier = Modifier.padding(top = 12.dp))
                        Text("Tap \"Add a listing\" above to publish your first place.", color = Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp))
                    }
                    else -> LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        items(state.listings) { listing ->
                            HostListingCard(
                                listing = listing,
                                onClick = { onOpenListing(listing) },
                                ownershipState = ownershipState,
                                onReuploadDoc = onReuploadDoc,
                                stayDiscountState = stayDiscountState,
                                onSaveStayDiscounts = onSaveStayDiscounts
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * A compact card for one of the host's own listings (title, location, price) plus its moderation
 * [ApprovalBadge]. For a pending or rejected listing the card explains the status and offers a
 * "Re-upload ownership document" action that PATCHes `/api/local/listings/:id {ownership_doc}` and
 * re-queues the listing to review.
 */
@Composable
private fun HostListingCard(
    listing: Listing,
    onClick: () -> Unit,
    ownershipState: OwnershipDocUiState,
    onReuploadDoc: (listingId: String, ownershipDoc: String) -> Unit,
    stayDiscountState: com.quickin.app.StayDiscountUiState = com.quickin.app.StayDiscountUiState(),
    onSaveStayDiscounts: (listingId: String, weekly: Int, monthly: Int) -> Unit = { _, _, _ -> }
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var processingDoc by remember { mutableStateOf(false) }
    val docPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) {
            processingDoc = true
            scope.launch {
                val dataUrl = withContext(Dispatchers.IO) {
                    AvatarImage.loadDownscaledJpegDataUrl(context, uri, maxDim = 1200)
                }
                processingDoc = false
                if (dataUrl != null) onReuploadDoc(listing.id, dataUrl)
            }
        }
    }
    // This card is "busy" while either its local downscale runs or its PATCH is in flight.
    val submitting = processingDoc ||
        (ownershipState.isSubmitting && ownershipState.listingId == listing.id)
    val justSubmitted = ownershipState.submittedId == listing.id
    val rowError = ownershipState.error?.takeIf { ownershipState.listingId == listing.id }

    BoutiqueCard(modifier = Modifier.fillMaxWidth(), onClick = onClick, shadow = 6.dp) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                val imageUrl = listing.sortedImageUrls.firstOrNull()
                Surface(shape = RoundedCornerShape(14.dp), color = Tan, modifier = Modifier.size(72.dp)) {
                    if (imageUrl != null) {
                        coil.compose.AsyncImage(
                            model = imageUrl,
                            contentDescription = listing.title,
                            contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                            modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(14.dp))
                        )
                    } else {
                        PhotoPlaceholder(modifier = Modifier.fillMaxSize())
                    }
                }
                Spacer(Modifier.width(14.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            listing.title,
                            fontWeight = FontWeight.Bold,
                            color = Ink,
                            fontSize = 16.sp,
                            maxLines = 1,
                            modifier = Modifier.weight(1f, fill = false)
                        )
                        Spacer(Modifier.width(8.dp))
                        ApprovalBadge(approval = listing.approval)
                    }
                    if (listing.location != null) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                            Icon(Icons.Filled.LocationOn, null, tint = Muted, modifier = Modifier.size(14.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(listing.location, color = Muted, fontSize = 13.sp, maxLines = 1)
                        }
                    }
                    Text(
                        "${listing.priceText} / night",
                        color = Burgundy,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                }
            }

            // Pending / rejected listings get a status note + a (re)upload affordance.
            if (listing.isPendingApproval || listing.isRejected) {
                Spacer(Modifier.height(12.dp))
                Text(
                    stringResource(
                        if (listing.isRejected) com.quickin.app.R.string.approval_rejected_note
                        else com.quickin.app.R.string.approval_pending_note
                    ),
                    color = Muted,
                    fontSize = 13.sp
                )
                if (justSubmitted) {
                    Text(
                        stringResource(com.quickin.app.R.string.approval_doc_resubmitted),
                        color = SuccessGreen,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
                if (rowError != null) {
                    Text(rowError, color = ErrorRed, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
                }
                OwnershipDocButton(
                    attached = false,
                    processing = submitting,
                    onClick = {
                        docPicker.launch(
                            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                        )
                    },
                    label = stringResource(com.quickin.app.R.string.approval_reupload),
                    modifier = Modifier.padding(top = 10.dp)
                )
            }

            // Length-of-stay discount editor — set weekly (7+) / monthly (28+) % off; PATCHes on save.
            StayDiscountEditor(
                listing = listing,
                state = stayDiscountState,
                onSave = onSaveStayDiscounts
            )
        }
    }
}

/** A small pill showing a listing's moderation state: amber (pending), green (approved), red (rejected). */
@Composable
private fun ApprovalBadge(approval: ListingApproval) {
    val (bg, fg) = when (approval) {
        ListingApproval.Pending -> Color(0xFFFFF3D6) to Color(0xFF8A6100)
        ListingApproval.Approved -> Color(0xFFE3F3E5) to SuccessGreen
        ListingApproval.Rejected -> Color(0xFFFBE3E1) to ErrorRed
    }
    Surface(shape = RoundedCornerShape(50), color = bg) {
        Text(
            stringResource(approval.labelRes),
            color = fg,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
        )
    }
}

/**
 * Inline length-of-stay discount editor on a host listing card. Collapsed it shows the current
 * discounts (or "Edit stay discounts" when none); expanded it offers two percent fields (weekly
 * 7+ / monthly 28+ nights) and a Save that PATCHes `/api/local/listings/:id`. Per-card state from
 * [StayDiscountUiState] drives the Save spinner, an inline error, and a "saved" confirmation.
 */
@Composable
private fun StayDiscountEditor(
    listing: Listing,
    state: com.quickin.app.StayDiscountUiState,
    onSave: (listingId: String, weekly: Int, monthly: Int) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    // Local edit buffers, seeded from the listing's current discounts.
    var weekly by remember(listing.id) { mutableStateOf(listing.weeklyDiscount.toString()) }
    var monthly by remember(listing.id) { mutableStateOf(listing.monthlyDiscount.toString()) }

    val isThis = state.listingId == listing.id
    val saving = isThis && state.isSaving
    val justSaved = state.savedId == listing.id
    val error = state.error?.takeIf { isThis }

    Spacer(Modifier.height(12.dp))
    HorizontalDivider(color = Tan)
    Spacer(Modifier.height(12.dp))

    // Header row — tappable to expand/collapse; shows the current discounts as a subtitle.
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .clickable { expanded = !expanded }
            .padding(vertical = 2.dp)
    ) {
        Icon(Icons.Filled.Sell, contentDescription = null, tint = Burgundy, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(8.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                stringResource(com.quickin.app.R.string.growth_discounts_title),
                color = Ink,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                if (listing.hasStayDiscount) {
                    stringResource(
                        com.quickin.app.R.string.growth_discount_off,
                        listing.weeklyDiscount,
                        listing.monthlyDiscount
                    )
                } else {
                    stringResource(com.quickin.app.R.string.growth_discounts_intro)
                },
                color = Muted,
                fontSize = 12.sp
            )
        }
        Icon(
            if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
            contentDescription = null,
            tint = Muted,
            modifier = Modifier.size(22.dp)
        )
    }

    if (expanded) {
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            PercentField(
                label = stringResource(com.quickin.app.R.string.growth_weekly_discount),
                value = weekly,
                onChange = { weekly = it },
                modifier = Modifier.weight(1f)
            )
            PercentField(
                label = stringResource(com.quickin.app.R.string.growth_monthly_discount),
                value = monthly,
                onChange = { monthly = it },
                modifier = Modifier.weight(1f)
            )
        }
        if (justSaved) {
            Text(
                stringResource(com.quickin.app.R.string.growth_discounts_saved),
                color = SuccessGreen,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
                modifier = Modifier.padding(top = 8.dp)
            )
        }
        if (error != null) {
            Text(error, color = ErrorRed, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
        }
        GradientButton(
            onClick = {
                onSave(
                    listing.id,
                    weekly.toIntOrNull()?.coerceIn(0, 100) ?: 0,
                    monthly.toIntOrNull()?.coerceIn(0, 100) ?: 0
                )
            },
            enabled = !saving,
            height = 46.dp,
            modifier = Modifier.fillMaxWidth().padding(top = 10.dp)
        ) {
            if (saving) {
                CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
            } else {
                Text(
                    stringResource(com.quickin.app.R.string.growth_save),
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp
                )
            }
        }
    }
}

/** A compact 0–100 percent input (digits only, capped at 100) used by the discount editor. */
@Composable
private fun PercentField(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    OutlinedTextField(
        value = value,
        onValueChange = { input ->
            val digits = input.filter { it.isDigit() }.take(3)
            val clamped = digits.toIntOrNull()?.coerceIn(0, 100)?.toString() ?: ""
            onChange(clamped)
        },
        label = { Text(label, fontSize = 12.sp) },
        singleLine = true,
        suffix = { Text("%") },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        shape = RoundedCornerShape(14.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Burgundy,
            unfocusedBorderColor = Tan,
            focusedLabelColor = Burgundy,
            cursorColor = Burgundy,
            focusedContainerColor = Color.White,
            unfocusedContainerColor = Color.White
        ),
        modifier = modifier
    )
}

/**
 * "Reservations" bottom-nav tab for hosts: incoming reservation requests across the host's
 * listings, with Confirm / Reject on pending ones. Reuses the same request list as the host
 * dashboard's Requests tab.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HostReservationsScreen(
    state: HostBookingsUiState,
    onLoad: () -> Unit,
    onConfirm: (String) -> Unit,
    onReject: (String) -> Unit,
    onMessage: (String) -> Unit,
    contentPadding: PaddingValues = PaddingValues()
) {
    Scaffold(
        containerColor = CreamPage,
        modifier = Modifier.padding(contentPadding),
        topBar = {
            TopAppBar(
                title = { Text("Reservations", color = Ink, fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = CreamPage)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(CreamPage)
        ) {
            RequestsTab(
                state = state,
                onLoad = onLoad,
                onConfirm = onConfirm,
                onReject = onReject,
                onMessage = onMessage
            )
        }
    }
}

/**
 * Full-screen "Add a listing" route (opened from the host Listings tab). Wraps the existing
 * add-listing wizard ([AddListingTab]) with a top app bar + back arrow.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddListingScreen(
    state: CreateListingUiState,
    onBack: () -> Unit,
    onCreateListing: (
        title: String, description: String, location: String, country: String,
        pricePerNight: String, maxGuests: String, bedrooms: String, beds: String,
        bathrooms: String, propertyType: String, imageUrl: String,
        amenities: List<String>, lat: Double?, lng: Double?, region: String?,
        cancellationPolicy: String, ownershipDoc: String?,
        weeklyDiscount: String, monthlyDiscount: String
    ) -> Unit,
    onResetCreate: () -> Unit,
    // ---- AI listing-description writer (Section 10) ----
    aiWriter: AiWriterUiState = AiWriterUiState(),
    onGenerateDescription: (
        title: String, location: String, region: String, propertyType: String,
        bedrooms: Int, maxGuests: Int, amenities: List<String>, notes: String
    ) -> Unit = { _, _, _, _, _, _, _, _ -> },
    onConsumeGeneratedDescription: () -> Unit = {},
    onClearAiWriter: () -> Unit = {}
) {
    Scaffold(
        containerColor = CreamPage,
        topBar = {
            TopAppBar(
                title = { Text("Add a listing", color = Ink, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Ink)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = CreamPage)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(CreamPage)
        ) {
            AddListingTab(
                state = state,
                onCreate = onCreateListing,
                onReset = onResetCreate,
                aiWriter = aiWriter,
                onGenerateDescription = onGenerateDescription,
                onConsumeGeneratedDescription = onConsumeGeneratedDescription,
                onClearAiWriter = onClearAiWriter
            )
        }
    }
}

// ---- Requests tab -----------------------------------------------------------

@Composable
private fun RequestsTab(
    state: HostBookingsUiState,
    onLoad: () -> Unit,
    onConfirm: (String) -> Unit,
    onReject: (String) -> Unit,
    onMessage: (String) -> Unit
) {
    // Load once when the tab first appears.
    androidx.compose.runtime.LaunchedEffect(Unit) {
        if (!state.loaded) onLoad()
    }

    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        when {
            state.isLoading && state.bookings.isEmpty() -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(color = Burgundy)
                Text("Loading requests…", color = Muted, modifier = Modifier.padding(top = 12.dp))
            }
            state.error != null && state.bookings.isEmpty() -> Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(32.dp)
            ) {
                Text("Couldn't load requests", fontWeight = FontWeight.Bold, color = Ink, fontSize = 18.sp)
                Text(state.error, color = Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp, bottom = 16.dp))
                Button(onClick = onLoad, colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White)) {
                    Text("Retry")
                }
            }
            state.bookings.isEmpty() -> Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(32.dp)
            ) {
                Icon(Icons.Filled.Inbox, contentDescription = null, tint = Burgundy, modifier = Modifier.size(48.dp))
                Text("No reservation requests", fontWeight = FontWeight.Bold, color = Ink, fontSize = 18.sp, modifier = Modifier.padding(top = 12.dp))
                Text("Requests from guests will show up here.", color = Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp))
            }
            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                state.actionMessage?.let { msg ->
                    item {
                        Text(msg, color = SuccessGreen, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    }
                }
                items(state.bookings) { booking ->
                    HostBookingCard(
                        booking = booking,
                        isActing = state.actingOn == booking.id,
                        onConfirm = { onConfirm(booking.id) },
                        onReject = { onReject(booking.id) },
                        onMessage = { onMessage(booking.id) }
                    )
                }
            }
        }
    }
}

@Composable
private fun HostBookingCard(
    booking: HostBooking,
    isActing: Boolean,
    onConfirm: () -> Unit,
    onReject: () -> Unit,
    onMessage: () -> Unit
) {
    BoutiqueCard(
        modifier = Modifier.fillMaxWidth(),
        shadow = 6.dp
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(booking.title, fontWeight = FontWeight.Bold, color = Ink, fontSize = 16.sp, maxLines = 1, modifier = Modifier.weight(1f))
                StatusBadge(booking.status)
            }
            if (booking.location != null) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                    Icon(Icons.Filled.LocationOn, null, tint = Muted, modifier = Modifier.size(15.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(booking.location, color = Muted, fontSize = 14.sp, maxLines = 1)
                }
            }
            if (booking.reservationCode.isNotBlank()) {
                Text(
                    booking.reservationCode,
                    color = Muted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.padding(top = 6.dp)
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 10.dp)) {
                Icon(Icons.Filled.DateRange, null, tint = Muted, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text(booking.dateRangeText, color = Ink, fontSize = 14.sp, fontWeight = FontWeight.Medium)
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.People, null, tint = Muted, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("${booking.guests} guest(s)", color = Muted, fontSize = 14.sp)
                }
                Text(booking.totalText, color = Burgundy, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }

            // Confirm / Reject only for pending requests.
            if (booking.isPending) {
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedButton(
                        onClick = onReject,
                        enabled = !isActing,
                        shape = RoundedCornerShape(14.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, ErrorRed),
                        colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White, contentColor = ErrorRed),
                        modifier = Modifier.weight(1f).height(46.dp)
                    ) { Text("Reject", fontWeight = FontWeight.SemiBold) }
                    Button(
                        onClick = onConfirm,
                        enabled = !isActing,
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White),
                        modifier = Modifier.weight(1f).height(46.dp)
                    ) {
                        if (isActing) {
                            CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.height(20.dp))
                        } else {
                            Text("Confirm", fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }

            // Message the guest — available on every request, pending or not.
            Spacer(Modifier.height(10.dp))
            OutlinedButton(
                onClick = onMessage,
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Burgundy),
                colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White, contentColor = Burgundy),
                modifier = Modifier.fillMaxWidth().height(46.dp)
            ) {
                Icon(Icons.Filled.ChatBubbleOutline, null, tint = Burgundy, modifier = Modifier.height(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Message", fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

// ---- Review-guests tab ------------------------------------------------------

/**
 * "Review guests" tab: the host's reviewable past guests (`GET /api/local/guest-reviews`), each as
 * a card with a 1–5 star picker, an optional comment, and a Submit that POSTs the guest review.
 * Submitted guests drop off the list. Loads once on first appearance.
 */
@Composable
private fun ReviewGuestsTab(
    state: com.quickin.app.ReviewGuestsUiState,
    onLoad: () -> Unit,
    onSubmit: (bookingId: String, rating: Int, comment: String) -> Unit
) {
    androidx.compose.runtime.LaunchedEffect(Unit) {
        if (!state.loaded) onLoad()
    }

    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        when {
            state.isLoading && state.guests.isEmpty() -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(color = Burgundy)
                Text(
                    stringResource(com.quickin.app.R.string.reviews_reviewable_guests_loading),
                    color = Muted,
                    modifier = Modifier.padding(top = 12.dp)
                )
            }
            state.error != null && state.guests.isEmpty() -> Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(32.dp)
            ) {
                Text("Couldn't load your guests", fontWeight = FontWeight.Bold, color = Ink, fontSize = 18.sp)
                Text(state.error, color = Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp, bottom = 16.dp))
                Button(onClick = onLoad, colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White)) {
                    Text("Retry")
                }
            }
            state.guests.isEmpty() -> Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(32.dp)
            ) {
                Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = Burgundy, modifier = Modifier.size(48.dp))
                Text(
                    stringResource(com.quickin.app.R.string.reviews_no_reviewable_guests),
                    fontWeight = FontWeight.Bold,
                    color = Ink,
                    fontSize = 18.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 12.dp)
                )
            }
            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                state.error?.let { msg ->
                    item { Text(msg, color = ErrorRed, fontWeight = FontWeight.SemiBold, fontSize = 14.sp) }
                }
                items(state.guests, key = { it.bookingId }) { guest ->
                    ReviewGuestCard(
                        guest = guest,
                        isSubmitting = state.actingOn == guest.bookingId,
                        onSubmit = { rating, comment -> onSubmit(guest.bookingId, rating, comment) }
                    )
                }
            }
        }
    }
}

/** One reviewable guest: a star picker + optional comment + Submit (host → guest review). */
@Composable
private fun ReviewGuestCard(
    guest: com.quickin.app.ReviewableGuest,
    isSubmitting: Boolean,
    onSubmit: (rating: Int, comment: String) -> Unit
) {
    var rating by remember { mutableIntStateOf(5) }
    var comment by remember { mutableStateOf("") }
    val guestName = guest.guestName?.takeUnless { it.isBlank() }
        ?: stringResource(com.quickin.app.R.string.reviews_guest_label)

    BoutiqueCard(modifier = Modifier.fillMaxWidth(), shadow = 6.dp) {
        Column(modifier = Modifier.padding(18.dp)) {
            Text(guestName, fontWeight = FontWeight.Bold, color = Ink, fontSize = 16.sp, maxLines = 1)
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                Icon(Icons.Filled.Home, null, tint = Muted, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(4.dp))
                Text(guest.title, color = Muted, fontSize = 13.sp, maxLines = 1, modifier = Modifier.weight(1f))
                guest.checkOut?.let {
                    Text(it, color = Muted, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                }
            }

            Spacer(Modifier.height(12.dp))
            Text(
                stringResource(com.quickin.app.R.string.reviews_your_rating),
                color = Ink,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(Modifier.height(6.dp))
            StarRatingRow(rating = rating, starSize = 26.dp, onRate = { rating = it })

            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = comment,
                onValueChange = { comment = it },
                label = { Text(stringResource(com.quickin.app.R.string.review_comment_label)) },
                minLines = 2,
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

            Spacer(Modifier.height(12.dp))
            GradientButton(
                onClick = { onSubmit(rating, comment) },
                enabled = !isSubmitting,
                modifier = Modifier.fillMaxWidth(),
                height = 48.dp
            ) {
                if (isSubmitting) {
                    CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                } else {
                    Text(
                        stringResource(com.quickin.app.R.string.reviews_submit),
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp
                    )
                }
            }
        }
    }
}

// ---- Add-listing tab --------------------------------------------------------

/** The six property types offered in Step 1. */
private val PROPERTY_TYPES = listOf("Apartment", "Villa", "House", "Chalet", "Cabin", "Guest House")

/** Curated browse areas (Step 2). The host picks one before pinning the precise location. */
private val REGIONS = listOf("North Coast", "Ain Sokhna", "El Gouna", "Cairo")

/** The amenity labels a host can toggle in Step 3 (sent to the backend as `amenities`). */
private val AMENITY_OPTIONS = listOf(
    "WiFi", "Pool", "Kitchen", "Air conditioning", "Free parking", "Washer", "TV",
    "Heating", "Workspace", "Gym", "Beach access", "Pets allowed", "Hot tub", "BBQ grill", "Breakfast"
)

private const val TOTAL_STEPS = 4

@Composable
private fun AddListingTab(
    state: CreateListingUiState,
    onCreate: (
        title: String, description: String, location: String, country: String,
        pricePerNight: String, maxGuests: String, bedrooms: String, beds: String,
        bathrooms: String, propertyType: String, imageUrl: String,
        amenities: List<String>, lat: Double?, lng: Double?, region: String?,
        cancellationPolicy: String, ownershipDoc: String?,
        weeklyDiscount: String, monthlyDiscount: String
    ) -> Unit,
    onReset: () -> Unit,
    // ---- AI listing-description writer (Section 10) ----
    aiWriter: AiWriterUiState = AiWriterUiState(),
    onGenerateDescription: (
        title: String, location: String, region: String, propertyType: String,
        bedrooms: Int, maxGuests: Int, amenities: List<String>, notes: String
    ) -> Unit = { _, _, _, _, _, _, _, _ -> },
    onConsumeGeneratedDescription: () -> Unit = {},
    onClearAiWriter: () -> Unit = {}
) {
    // A created listing replaces the wizard with a success card.
    if (state.created != null) {
        Box(modifier = Modifier.fillMaxSize().padding(28.dp), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                // Animated drawn-on checkmark (qkDraw + qkPop) for the submitted moment.
                PopIn { DrawCheckmark(size = 72.dp) }
                Text(
                    stringResource(com.quickin.app.R.string.approval_submitted_for_review),
                    fontWeight = FontWeight.Bold,
                    color = Ink,
                    fontSize = 20.sp,
                    modifier = Modifier.padding(top = 14.dp)
                )
                Text(
                    state.created.title,
                    color = Ink,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 6.dp)
                )
                Text(
                    stringResource(com.quickin.app.R.string.approval_pending_note),
                    color = Muted,
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 6.dp)
                )
                GradientButton(
                    onClick = onReset,
                    height = 52.dp,
                    modifier = Modifier.fillMaxWidth().padding(top = 24.dp)
                ) { Text("Add another listing", color = Color.White, fontWeight = FontWeight.SemiBold) }
            }
        }
        return
    }

    // ---- Wizard state (survives step changes via remember) ----
    var step by remember { mutableIntStateOf(0) } // 0..3

    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var location by remember { mutableStateOf("") }
    var country by remember { mutableStateOf("") }
    var price by remember { mutableStateOf("") }
    // Length-of-stay discounts (% off), default "0" (none). Sent on create.
    var weeklyDiscount by remember { mutableStateOf("0") }
    var monthlyDiscount by remember { mutableStateOf("0") }
    var maxGuests by remember { mutableStateOf("2") }
    var bedrooms by remember { mutableStateOf("1") }
    var beds by remember { mutableStateOf("1") }
    var bathrooms by remember { mutableStateOf("1") }
    var propertyType by remember { mutableStateOf(PROPERTY_TYPES.first()) }
    var imageUrl by remember { mutableStateOf("") }
    // Selected amenity labels (Step 3 chips). Order-preserving set of AMENITY_OPTIONS.
    val selectedAmenities = remember { mutableStateListOf<String>() }
    // Host-set cancellation policy (Step 3). Defaults to "moderate".
    var cancellationPolicy by remember { mutableStateOf(com.quickin.app.CancellationPolicy.Moderate.apiValue) }
    // Ownership/proof document as a data:image/* URL (Step 3). Null until the host picks one.
    // Sending it queues the new listing for staff review (created pending + unpublished).
    var ownershipDoc by remember { mutableStateOf<String?>(null) }
    var processingDoc by remember { mutableStateOf(false) }
    // Curated browse area (Step 2 chips). Null until the host picks one (required).
    var region by remember { mutableStateOf<String?>(null) }

    // AI writer: when the view-model returns a generated description, drop it into the editable
    // field (the host can then tweak it), and tell the view-model it's been consumed.
    LaunchedEffect(aiWriter.generated) {
        aiWriter.generated?.let {
            description = it
            onConsumeGeneratedDescription()
        }
    }
    // Clear any AI-writer state (error/loading) when the wizard leaves the screen.
    androidx.compose.runtime.DisposableEffect(Unit) {
        onDispose { onClearAiWriter() }
    }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    // Ownership-doc picker: load the picked image, downscale + JPEG-compress to a small data URL
    // off the main thread (maxDim 1200, larger than an avatar so the document stays legible).
    val docPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) {
            processingDoc = true
            scope.launch {
                val dataUrl = withContext(Dispatchers.IO) {
                    AvatarImage.loadDownscaledJpegDataUrl(context, uri, maxDim = 1200)
                }
                if (dataUrl != null) ownershipDoc = dataUrl
                processingDoc = false
            }
        }
    }
    // Coordinates from the map pin-picker. Null until the host places a pin.
    var pickedLatLng by remember { mutableStateOf<LatLng?>(null) }

    // Per-step validation of required fields; gates the Next / Publish button.
    val canAdvance = when (step) {
        0 -> title.isNotBlank()
        1 -> region != null && pickedLatLng != null
        2 -> price.isNotBlank()
        else -> true
    }

    Column(modifier = Modifier.fillMaxSize().background(CreamPage)) {
        StepHeader(step = step)

        // Animated step body — fills remaining height, scrolls internally.
        AnimatedContent(
            targetState = step,
            transitionSpec = {
                (fadeIn() togetherWith fadeOut()).using(SizeTransform(clip = false))
            },
            label = "wizard-step",
            modifier = Modifier.weight(1f).fillMaxWidth()
        ) { current ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                when (current) {
                    0 -> StepBasics(
                        title = title, onTitle = { title = it },
                        propertyType = propertyType, onPropertyType = { propertyType = it },
                        description = description, onDescription = { description = it },
                        aiWriter = aiWriter,
                        onGenerate = {
                            // Feed the AI whatever's filled so far; the current description acts as
                            // free-text "notes" the writer can build on (left field editable after).
                            onGenerateDescription(
                                title,
                                location,
                                region.orEmpty(),
                                propertyType,
                                bedrooms.toIntOrNull() ?: 1,
                                maxGuests.toIntOrNull() ?: 2,
                                selectedAmenities.toList(),
                                description
                            )
                        }
                    )
                    1 -> StepLocation(
                        region = region, onRegion = { region = it },
                        location = location, onLocation = { location = it },
                        country = country, onCountry = { country = it },
                        picked = pickedLatLng, onPick = { pickedLatLng = it }
                    )
                    2 -> StepDetails(
                        maxGuests = maxGuests, onMaxGuests = { maxGuests = it },
                        bedrooms = bedrooms, onBedrooms = { bedrooms = it },
                        beds = beds, onBeds = { beds = it },
                        bathrooms = bathrooms, onBathrooms = { bathrooms = it },
                        price = price, onPrice = { price = it },
                        weeklyDiscount = weeklyDiscount, onWeeklyDiscount = { weeklyDiscount = it },
                        monthlyDiscount = monthlyDiscount, onMonthlyDiscount = { monthlyDiscount = it },
                        imageUrl = imageUrl, onImageUrl = { imageUrl = it },
                        selectedAmenities = selectedAmenities,
                        onToggleAmenity = { amenity ->
                            if (selectedAmenities.contains(amenity)) selectedAmenities.remove(amenity)
                            else selectedAmenities.add(amenity)
                        },
                        cancellationPolicy = cancellationPolicy,
                        onCancellationPolicy = { cancellationPolicy = it },
                        ownershipDoc = ownershipDoc,
                        processingDoc = processingDoc,
                        onPickDoc = {
                            docPicker.launch(
                                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                            )
                        }
                    )
                    else -> StepReview(
                        title = title, propertyType = propertyType, region = region,
                        location = location,
                        country = country, price = price, maxGuests = maxGuests,
                        bedrooms = bedrooms, beds = beds, bathrooms = bathrooms,
                        amenities = selectedAmenities, picked = pickedLatLng,
                        cancellationPolicy = cancellationPolicy,
                        ownershipDocAttached = ownershipDoc != null,
                        weeklyDiscount = weeklyDiscount, monthlyDiscount = monthlyDiscount
                    )
                }

                if (state.error != null) {
                    Text(state.error, color = ErrorRed, fontSize = 13.sp)
                }
            }
        }

        // ---- Sticky Back / Next-or-Publish bar ----
        Surface(color = Cream, shadowElevation = 8.dp) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (step > 0) {
                    OutlinedButton(
                        onClick = { if (step > 0) step-- },
                        enabled = !state.isSubmitting,
                        shape = RoundedCornerShape(16.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Burgundy),
                        colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White, contentColor = Burgundy),
                        modifier = Modifier.weight(1f).height(54.dp)
                    ) { Text("Back", fontWeight = FontWeight.SemiBold) }
                }

                val isLast = step == TOTAL_STEPS - 1
                GradientButton(
                    onClick = {
                        if (isLast) {
                            onCreate(
                                title, description, location, country, price,
                                maxGuests, bedrooms, beds, bathrooms, propertyType, imageUrl,
                                selectedAmenities.toList(),
                                pickedLatLng?.latitude, pickedLatLng?.longitude, region,
                                cancellationPolicy, ownershipDoc,
                                weeklyDiscount, monthlyDiscount
                            )
                        } else if (canAdvance) {
                            step++
                        }
                    },
                    enabled = !state.isSubmitting && canAdvance,
                    pulse = isLast && !state.isSubmitting && canAdvance,
                    modifier = Modifier.weight(1f)
                ) {
                    if (isLast && state.isSubmitting) {
                        CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                    } else {
                        Text(if (isLast) "Publish listing" else "Next", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                    }
                }
            }
        }
    }
}

/** "Step N of 4" label, a one-line step title, and the 4-dot progress indicator. */
@Composable
private fun StepHeader(step: Int) {
    val titles = listOf("Basics", "Location", "Details", "Review")
    Column(modifier = Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Text(
                "Step ${step + 1} of $TOTAL_STEPS",
                color = Muted,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.weight(1f)
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                repeat(TOTAL_STEPS) { i ->
                    val active = i <= step
                    Box(
                        modifier = Modifier
                            .size(if (i == step) 10.dp else 8.dp)
                            .clip(CircleShape)
                            .background(if (active) Burgundy else Tan)
                    )
                }
            }
        }
        Text(
            titles[step],
            color = Ink,
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(top = 6.dp)
        )
    }
}

// ---- Step 1: Basics ---------------------------------------------------------

@Composable
private fun StepBasics(
    title: String, onTitle: (String) -> Unit,
    propertyType: String, onPropertyType: (String) -> Unit,
    description: String, onDescription: (String) -> Unit,
    aiWriter: AiWriterUiState = AiWriterUiState(),
    onGenerate: () -> Unit = {}
) {
    HostField(title, onTitle, "Title")
    PropertyTypeDropdown(selected = propertyType, onSelected = onPropertyType)
    HostField(description, onDescription, stringResource(com.quickin.app.R.string.add_description), singleLine = false)

    // ---- "Write with AI" — generates a description from the listing's details (Section 10) ----
    OutlinedButton(
        onClick = onGenerate,
        enabled = !aiWriter.isWriting && title.isNotBlank(),
        shape = RoundedCornerShape(16.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Burgundy),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White, contentColor = Burgundy),
        modifier = Modifier.fillMaxWidth().height(48.dp)
    ) {
        if (aiWriter.isWriting) {
            CircularProgressIndicator(color = Burgundy, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(10.dp))
            Text(stringResource(com.quickin.app.R.string.ai_writing), fontWeight = FontWeight.SemiBold)
        } else {
            Icon(Icons.Filled.AutoAwesome, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(stringResource(com.quickin.app.R.string.ai_write_with_ai), fontWeight = FontWeight.SemiBold)
        }
    }
    if (aiWriter.error != null) {
        Text(aiWriter.error, color = ErrorRed, fontSize = 13.sp)
    }

    Text(
        stringResource(com.quickin.app.R.string.add_basics_hint),
        color = Muted,
        fontSize = 13.sp
    )
}

/** Property-type picker backed by [PROPERTY_TYPES]. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PropertyTypeDropdown(selected: String, onSelected: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it },
        modifier = Modifier.fillMaxWidth()
    ) {
        OutlinedTextField(
            value = selected,
            onValueChange = {},
            readOnly = true,
            label = { Text("Property type") },
            trailingIcon = { Icon(Icons.Filled.ArrowDropDown, null, tint = Burgundy) },
            shape = RoundedCornerShape(18.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Burgundy,
                unfocusedBorderColor = Tan,
                focusedLabelColor = Burgundy,
                cursorColor = Burgundy,
                focusedContainerColor = Color.White,
                unfocusedContainerColor = Color.White
            ),
            modifier = Modifier
                .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                .fillMaxWidth()
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            PROPERTY_TYPES.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option, color = Ink) },
                    onClick = {
                        onSelected(option)
                        expanded = false
                    }
                )
            }
        }
    }
}

// ---- Step 2: Location -------------------------------------------------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StepLocation(
    region: String?, onRegion: (String) -> Unit,
    location: String, onLocation: (String) -> Unit,
    country: String, onCountry: (String) -> Unit,
    picked: LatLng?, onPick: (LatLng) -> Unit
) {
    // Region chips — the host picks the area first, then the precise pin below. Required.
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Filled.Place, null, tint = Burgundy, modifier = Modifier.height(18.dp))
        Spacer(Modifier.width(6.dp))
        Text("Choose an area", fontWeight = FontWeight.SemiBold, color = Ink, fontSize = 14.sp)
    }
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        REGIONS.forEach { option ->
            RegionChip(
                label = option,
                selected = region == option,
                onClick = { onRegion(option) }
            )
        }
    }
    if (region == null) {
        Text("Pick the area your place is in (required).", color = Muted, fontSize = 13.sp)
    }
    Spacer(Modifier.height(4.dp))

    LocationPicker(
        location = location,
        onLocation = onLocation,
        picked = picked,
        onPick = onPick
    )
    HostField(country, onCountry, "Country")
}

/** A single-select area pill (Step 2): filled Burgundy when selected, outlined Tan otherwise. */
@Composable
private fun RegionChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(50),
        color = if (selected) Burgundy else Color.White,
        border = androidx.compose.foundation.BorderStroke(1.dp, if (selected) Burgundy else Tan)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 9.dp)
        ) {
            if (selected) {
                Icon(Icons.Filled.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
            }
            Text(
                label,
                color = if (selected) Color.White else Ink,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

// ---- Step 3: Details --------------------------------------------------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StepDetails(
    maxGuests: String, onMaxGuests: (String) -> Unit,
    bedrooms: String, onBedrooms: (String) -> Unit,
    beds: String, onBeds: (String) -> Unit,
    bathrooms: String, onBathrooms: (String) -> Unit,
    price: String, onPrice: (String) -> Unit,
    weeklyDiscount: String, onWeeklyDiscount: (String) -> Unit,
    monthlyDiscount: String, onMonthlyDiscount: (String) -> Unit,
    imageUrl: String, onImageUrl: (String) -> Unit,
    selectedAmenities: List<String>, onToggleAmenity: (String) -> Unit,
    cancellationPolicy: String, onCancellationPolicy: (String) -> Unit,
    ownershipDoc: String?, processingDoc: Boolean, onPickDoc: () -> Unit
) {
    // +/- steppers for the counts. Each shows the current value as a Text between the
    // buttons; minimums keep the values sensible (guests >= 1, the rest >= 0).
    CounterStepper(
        label = "Max guests",
        value = maxGuests,
        min = 1,
        onChange = onMaxGuests
    )
    CounterStepper(
        label = "Bedrooms",
        value = bedrooms,
        min = 0,
        onChange = onBedrooms
    )
    CounterStepper(
        label = "Beds",
        value = beds,
        min = 0,
        onChange = onBeds
    )
    CounterStepper(
        label = "Bathrooms",
        value = bathrooms,
        min = 0,
        onChange = onBathrooms
    )
    HostField(price, { onPrice(it.filterNumeric(decimal = true)) }, "Price / night (EGP)", keyboardType = KeyboardType.Number)

    // Length-of-stay discounts — reward longer bookings (% off applied server-side to the total).
    Text(
        stringResource(com.quickin.app.R.string.growth_discounts_title),
        fontWeight = FontWeight.SemiBold,
        color = Ink,
        fontSize = 15.sp,
        modifier = Modifier.padding(top = 4.dp)
    )
    Text(
        stringResource(com.quickin.app.R.string.growth_discounts_intro),
        color = Muted,
        fontSize = 13.sp
    )
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
        PercentField(
            label = stringResource(com.quickin.app.R.string.growth_weekly_discount),
            value = weeklyDiscount,
            onChange = onWeeklyDiscount,
            modifier = Modifier.weight(1f)
        )
        PercentField(
            label = stringResource(com.quickin.app.R.string.growth_monthly_discount),
            value = monthlyDiscount,
            onChange = onMonthlyDiscount,
            modifier = Modifier.weight(1f)
        )
    }

    HostField(imageUrl, onImageUrl, "Image URL (optional)", keyboardType = KeyboardType.Uri)

    // Amenities multi-select — tap chips to toggle. Sent to the backend as `amenities`.
    Text("Amenities", fontWeight = FontWeight.SemiBold, color = Ink, fontSize = 15.sp, modifier = Modifier.padding(top = 4.dp))
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        AMENITY_OPTIONS.forEach { amenity ->
            AmenityChip(
                label = amenity,
                selected = selectedAmenities.contains(amenity),
                onClick = { onToggleAmenity(amenity) }
            )
        }
    }

    // Cancellation policy — a single-select of flexible / moderate / strict (default moderate).
    Text(
        stringResource(com.quickin.app.R.string.cancel_policy_label),
        fontWeight = FontWeight.SemiBold,
        color = Ink,
        fontSize = 15.sp,
        modifier = Modifier.padding(top = 4.dp)
    )
    CancellationPolicyPicker(
        selected = cancellationPolicy,
        onSelected = onCancellationPolicy
    )

    // Ownership/proof document — sending it queues the listing for staff review.
    Text(
        stringResource(com.quickin.app.R.string.approval_ownership_doc),
        fontWeight = FontWeight.SemiBold,
        color = Ink,
        fontSize = 15.sp,
        modifier = Modifier.padding(top = 4.dp)
    )
    Text(
        stringResource(com.quickin.app.R.string.approval_ownership_intro),
        color = Muted,
        fontSize = 13.sp
    )
    OwnershipDocButton(
        attached = ownershipDoc != null,
        processing = processingDoc,
        onClick = onPickDoc
    )

    Text("Price per night is required.", color = Muted, fontSize = 13.sp)
}

/**
 * The "Upload document" / "Document attached" button used both in the add-listing wizard and on a
 * host's pending/rejected listing card. Shows a spinner while the picked image is downscaled, a
 * filled "attached" state once a document is staged, and otherwise an outlined upload affordance.
 * [label] overrides the idle text (e.g. "Re-upload ownership document" on a rejected card).
 */
@Composable
private fun OwnershipDocButton(
    attached: Boolean,
    processing: Boolean,
    onClick: () -> Unit,
    label: String? = null,
    modifier: Modifier = Modifier
) {
    val idleText = label ?: stringResource(com.quickin.app.R.string.approval_upload_doc)
    OutlinedButton(
        onClick = onClick,
        enabled = !processing,
        shape = RoundedCornerShape(16.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, if (attached) SuccessGreen else Burgundy),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = Color.White,
            contentColor = if (attached) SuccessGreen else Burgundy
        ),
        modifier = modifier.fillMaxWidth().height(50.dp)
    ) {
        when {
            processing -> CircularProgressIndicator(
                color = Burgundy,
                strokeWidth = 2.dp,
                modifier = Modifier.size(20.dp)
            )
            attached -> {
                Icon(Icons.Filled.CheckCircle, null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(stringResource(com.quickin.app.R.string.approval_doc_attached), fontWeight = FontWeight.SemiBold)
            }
            else -> {
                Icon(Icons.Filled.Description, null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(idleText, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

/**
 * Single-select cancellation-policy picker (flexible / moderate / strict) used by the add-listing
 * wizard and the host's "Edit policy" sheet. Each option is a full-width card with its localized
 * name + one-line description; the selected one is filled Burgundy. RTL-safe (rows lay out
 * start→end and use stringResource copy).
 */
@Composable
fun CancellationPolicyPicker(
    selected: String,
    onSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val current = com.quickin.app.CancellationPolicy.from(selected)
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        com.quickin.app.CancellationPolicy.entries.forEach { policy ->
            val isSelected = policy == current
            Surface(
                onClick = { onSelected(policy.apiValue) },
                shape = RoundedCornerShape(16.dp),
                color = if (isSelected) Burgundy else Color.White,
                border = androidx.compose.foundation.BorderStroke(1.dp, if (isSelected) Burgundy else Tan),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    verticalAlignment = Alignment.Top,
                    modifier = Modifier.padding(14.dp)
                ) {
                    Icon(
                        if (isSelected) Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked,
                        contentDescription = null,
                        tint = if (isSelected) Color.White else Muted,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            stringResource(policy.labelRes),
                            color = if (isSelected) Color.White else Ink,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            stringResource(policy.descRes),
                            color = if (isSelected) Color.White.copy(alpha = 0.9f) else Muted,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(top = 2.dp)
                        )
                    }
                }
            }
        }
    }
}

/**
 * A labelled +/- stepper for an integer count (guests / bedrooms / beds / baths).
 *
 * The canonical value lives in the parent as a [String]; this composable parses it, applies
 * [min] as a floor, renders the current number as a [Text] between the − and + buttons, and
 * lifts every change back via [onChange]. Empty / non-numeric input is treated as [min] so the
 * control always shows (and sends) a real number.
 */
@Composable
private fun CounterStepper(
    label: String,
    value: String,
    min: Int,
    onChange: (String) -> Unit,
    max: Int = 50
) {
    val current = (value.toIntOrNull() ?: min).coerceIn(min, max)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(label, color = Ink, fontSize = 15.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
        Row(verticalAlignment = Alignment.CenterVertically) {
            StepperButton(
                symbol = "−",
                enabled = current > min,
                onClick = { onChange((current - 1).coerceAtLeast(min).toString()) }
            )
            Text(
                current.toString(),
                color = Ink,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.width(44.dp)
            )
            StepperButton(
                symbol = "+",
                enabled = current < max,
                onClick = { onChange((current + 1).coerceAtMost(max).toString()) }
            )
        }
    }
}

/** A circular +/- button used by [CounterStepper]; dims when [enabled] is false. */
@Composable
private fun StepperButton(symbol: String, enabled: Boolean, onClick: () -> Unit) {
    val tint = if (enabled) Burgundy else Muted.copy(alpha = 0.4f)
    Surface(
        onClick = { if (enabled) onClick() },
        enabled = enabled,
        shape = CircleShape,
        color = Color.White,
        border = androidx.compose.foundation.BorderStroke(1.5.dp, tint),
        modifier = Modifier.size(40.dp)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(symbol, color = tint, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/** A toggleable amenity pill: filled Burgundy with a check when selected, outlined Tan otherwise. */
@Composable
private fun AmenityChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(50),
        color = if (selected) Burgundy else Color.White,
        border = androidx.compose.foundation.BorderStroke(1.dp, if (selected) Burgundy else Tan)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 9.dp)
        ) {
            if (selected) {
                Icon(
                    Icons.Filled.Check,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(Modifier.width(6.dp))
            }
            Text(
                label,
                color = if (selected) Color.White else Ink,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

// ---- Step 4: Review ---------------------------------------------------------

@Composable
private fun StepReview(
    title: String, propertyType: String, region: String?, location: String, country: String,
    price: String, maxGuests: String, bedrooms: String, beds: String,
    bathrooms: String, amenities: List<String>, picked: LatLng?,
    cancellationPolicy: String, ownershipDocAttached: Boolean,
    weeklyDiscount: String = "0", monthlyDiscount: String = "0"
) {
    SectionHeader("Review your listing")
    BoutiqueCard(modifier = Modifier.fillMaxWidth(), shadow = 6.dp) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            ReviewRow("Title", title.ifBlank { "—" })
            ReviewRow("Type", propertyType)
            ReviewRow("Area", region ?: "—")
            ReviewRow(
                "Location",
                listOf(location, country).filter { it.isNotBlank() }.joinToString(", ").ifBlank { "—" }
            )
            ReviewRow("Price / night", if (price.isBlank()) "—" else "EGP $price")
            ReviewRow("Guests", maxGuests.ifBlank { "—" })
            ReviewRow("Rooms", "$bedrooms bd · $beds beds · $bathrooms ba")
            ReviewRow("Amenities", amenities.joinToString(", ").ifBlank { "None selected" })
            ReviewRow(
                stringResource(com.quickin.app.R.string.cancel_policy_label),
                stringResource(com.quickin.app.CancellationPolicy.from(cancellationPolicy).labelRes)
            )
            run {
                val w = weeklyDiscount.toIntOrNull() ?: 0
                val m = monthlyDiscount.toIntOrNull() ?: 0
                ReviewRow(
                    stringResource(com.quickin.app.R.string.growth_discounts_title),
                    if (w > 0 || m > 0) {
                        stringResource(com.quickin.app.R.string.growth_discount_off, w, m)
                    } else "—"
                )
            }
            ReviewRow(
                stringResource(com.quickin.app.R.string.approval_ownership_doc),
                if (ownershipDocAttached) {
                    stringResource(com.quickin.app.R.string.approval_doc_attached)
                } else "—"
            )
            ReviewRow(
                "Coordinates",
                picked?.let { "%.5f, %.5f".format(it.latitude, it.longitude) } ?: "Not pinned"
            )
        }
    }
    Text(
        stringResource(com.quickin.app.R.string.approval_pending_note),
        color = Muted,
        fontSize = 13.sp
    )
}

@Composable
private fun ReviewRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Text(label, color = Muted, fontSize = 14.sp, modifier = Modifier.width(120.dp))
        Text(value, color = Ink, fontSize = 14.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun HostField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    singleLine: Boolean = true,
    keyboardType: KeyboardType = KeyboardType.Text,
    modifier: Modifier = Modifier
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = singleLine,
        minLines = if (singleLine) 1 else 3,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        shape = RoundedCornerShape(18.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Burgundy,
            unfocusedBorderColor = Tan,
            focusedLabelColor = Burgundy,
            cursorColor = Burgundy,
            focusedContainerColor = Color.White,
            unfocusedContainerColor = Color.White
        ),
        modifier = modifier.fillMaxWidth()
    )
}

/**
 * Google-Maps pin-picker for the listing's precise coordinates, with a place search.
 *
 * The host can either:
 *  • type a place into the search field and submit (search icon / IME action) — the text is
 *    geocoded via the Google Geocoding HTTP API, then the camera animates to the result, the
 *    marker moves there, and the location text is filled with the `formatted_address`; or
 *  • tap the map to drop the [Marker], then drag it to fine-tune.
 *
 * Either way the chosen [LatLng] is lifted via [onPick]. The camera opens on Egypt
 * (26.8206, 30.8025) until the first point is chosen, then eases to each picked point.
 */
@Composable
private fun LocationPicker(
    location: String,
    onLocation: (String) -> Unit,
    picked: LatLng?,
    onPick: (LatLng) -> Unit
) {
    val context = LocalContext.current
    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(picked ?: EGYPT, if (picked != null) 14f else EGYPT_ZOOM)
    }
    // A single draggable marker; its position tracks the picked point as it changes.
    val markerState = rememberMarkerState(position = picked ?: EGYPT)
    val scope = rememberCoroutineScope()
    val keyboard = LocalSoftwareKeyboardController.current

    var query by remember { mutableStateOf("") }
    var searching by remember { mutableStateOf(false) }
    var searchError by remember { mutableStateOf<String?>(null) }
    var locating by remember { mutableStateOf(false) }

    // Ease the camera to the freshly-picked point and keep the marker in sync.
    LaunchedEffect(picked) {
        picked?.let {
            markerState.position = it
            cameraPositionState.animate(CameraUpdateFactory.newLatLngZoom(it, 14f))
        }
    }
    // Lift the position when a drag finishes (markerState.position updates live during drag).
    LaunchedEffect(markerState.isDragging) {
        if (!markerState.isDragging) {
            val p = markerState.position
            if (picked == null || p.latitude != picked.latitude || p.longitude != picked.longitude) {
                onPick(p)
            }
        }
    }

    fun runSearch() {
        val q = query.trim()
        if (q.isEmpty() || searching) return
        keyboard?.hide()
        searching = true
        searchError = null
        scope.launch {
            val result = geocodePlace(context, q)
            searching = false
            if (result == null) {
                searchError = "No match found. Try a more specific place."
            } else {
                if (result.address.isNotBlank()) onLocation(result.address)
                onPick(result.latLng) // LaunchedEffect(picked) recenters camera + marker
            }
        }
    }

    // Reads the device's current location via the fused provider, drops the pin there, and
    // reverse-geocodes it to fill the location text. Assumes permission is already granted.
    fun useCurrentLocation() {
        if (locating) return
        locating = true
        searchError = null
        scope.launch {
            val latLng = fetchCurrentLatLng(context)
            if (latLng == null) {
                locating = false
                searchError = "Couldn't get your location. Try searching instead."
                return@launch
            }
            onPick(latLng) // recenters camera + marker via LaunchedEffect(picked)
            // Best-effort reverse geocode for a friendly label; coordinates are what matter.
            val label = reverseGeocode(context, latLng)
            if (!label.isNullOrBlank()) onLocation(label)
            locating = false
        }
    }

    // Runtime ACCESS_FINE_LOCATION request; on grant, immediately fetch the location.
    val locationPermissionLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        contract = androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val granted = grants[android.Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            grants[android.Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (granted) {
            useCurrentLocation()
        } else {
            searchError = "Location permission denied. Search for a place instead."
        }
    }

    fun onUseCurrentLocationClick() {
        val fineGranted = androidx.core.content.ContextCompat.checkSelfPermission(
            context, android.Manifest.permission.ACCESS_FINE_LOCATION
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        val coarseGranted = androidx.core.content.ContextCompat.checkSelfPermission(
            context, android.Manifest.permission.ACCESS_COARSE_LOCATION
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        if (fineGranted || coarseGranted) {
            useCurrentLocation()
        } else {
            locationPermissionLauncher.launch(
                arrayOf(
                    android.Manifest.permission.ACCESS_FINE_LOCATION,
                    android.Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }

    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.Place, null, tint = Burgundy, modifier = Modifier.height(18.dp))
            Spacer(Modifier.width(6.dp))
            Text("Pin the exact location", fontWeight = FontWeight.SemiBold, color = Ink, fontSize = 14.sp)
        }
        Spacer(Modifier.height(8.dp))

        // Place search — geocodes on the search icon / keyboard "Search" action.
        OutlinedTextField(
            value = query,
            onValueChange = { query = it; searchError = null },
            label = { Text("Search a place") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { runSearch() }),
            trailingIcon = {
                if (searching) {
                    CircularProgressIndicator(color = Burgundy, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                } else {
                    IconButton(onClick = { runSearch() }) {
                        Icon(Icons.Filled.Search, contentDescription = "Search", tint = Burgundy)
                    }
                }
            },
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
        if (searchError != null) {
            Text(searchError!!, color = ErrorRed, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
        }
        Spacer(Modifier.height(8.dp))

        // "Use my current location" — requests ACCESS_FINE_LOCATION (if needed), then drops
        // the pin on the device's location via the fused provider.
        OutlinedButton(
            onClick = { onUseCurrentLocationClick() },
            enabled = !locating,
            shape = RoundedCornerShape(16.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, Burgundy),
            colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White, contentColor = Burgundy),
            modifier = Modifier.fillMaxWidth().height(48.dp)
        ) {
            if (locating) {
                CircularProgressIndicator(color = Burgundy, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
            } else {
                Icon(Icons.Filled.MyLocation, null, tint = Burgundy, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Use my current location", fontWeight = FontWeight.SemiBold)
            }
        }
        Spacer(Modifier.height(8.dp))

        // Editable, human-readable location text (also filled by search).
        HostField(location, onLocation, "Location (e.g. Malibu, California)")
        Spacer(Modifier.height(8.dp))

        Surface(
            shape = RoundedCornerShape(18.dp),
            color = Tan,
            shadowElevation = 2.dp,
            modifier = Modifier.fillMaxWidth().height(240.dp)
        ) {
            GoogleMap(
                modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(18.dp)),
                cameraPositionState = cameraPositionState,
                uiSettings = MapUiSettings(zoomControlsEnabled = false, mapToolbarEnabled = false),
                onMapClick = { onPick(it) }
            ) {
                if (picked != null) {
                    Marker(
                        state = markerState,
                        title = "Listing location",
                        draggable = true
                    )
                }
            }
        }
        Spacer(Modifier.height(6.dp))
        if (picked != null) {
            Text(
                "Pinned: ${"%.5f".format(picked.latitude)}, ${"%.5f".format(picked.longitude)} — drag the pin to fine-tune.",
                color = Burgundy,
                fontWeight = FontWeight.Medium,
                fontSize = 13.sp
            )
        } else {
            Text(
                "Search above or tap the map to drop a pin (required to continue).",
                color = Muted,
                fontSize = 13.sp
            )
        }
    }
}

/** A geocoding hit: the resolved coordinates plus a human-readable address. */
private data class GeocodeResult(val latLng: LatLng, val address: String)

/**
 * Forward-geocodes [query] to its top match. Tries the on-device [android.location.Geocoder]
 * first (no API key required), and falls back to the Google Geocoding HTTP API when the
 * platform geocoder is unavailable or returns nothing (common on bare emulators). Runs on
 * [Dispatchers.IO]; returns null on any failure / no results.
 */
private suspend fun geocodePlace(context: android.content.Context, query: String): GeocodeResult? =
    withContext(Dispatchers.IO) {
        platformForwardGeocode(context, query) ?: geocodeViaHttp(query)
    }

/** On-device forward geocode via [android.location.Geocoder.getFromLocationName]. */
private fun platformForwardGeocode(context: android.content.Context, query: String): GeocodeResult? =
    runCatching {
        if (!android.location.Geocoder.isPresent()) return null
        val geocoder = android.location.Geocoder(context, java.util.Locale.getDefault())
        @Suppress("DEPRECATION")
        val matches = geocoder.getFromLocationName(query, 1)
        val a = matches?.firstOrNull() ?: return null
        GeocodeResult(LatLng(a.latitude, a.longitude), a.formatLine().ifBlank { query })
    }.getOrNull()

/**
 * Reverse-geocodes [latLng] to a human-readable single-line address via the on-device
 * [android.location.Geocoder]. Returns null when unavailable or on failure (coordinates are
 * still usable — this is only for a friendly label).
 */
private suspend fun reverseGeocode(context: android.content.Context, latLng: LatLng): String? =
    withContext(Dispatchers.IO) {
        runCatching {
            if (!android.location.Geocoder.isPresent()) return@withContext null
            val geocoder = android.location.Geocoder(context, java.util.Locale.getDefault())
            @Suppress("DEPRECATION")
            val matches = geocoder.getFromLocation(latLng.latitude, latLng.longitude, 1)
            matches?.firstOrNull()?.formatLine()?.ifBlank { null }
        }.getOrNull()
    }

/** Joins an [android.location.Address]'s lines into a single comma-separated string. */
private fun android.location.Address.formatLine(): String =
    (0..maxAddressLineIndex).mapNotNull { getAddressLine(it) }
        .joinToString(", ")
        .ifBlank {
            listOfNotNull(locality, adminArea, countryName)
                .filter { it.isNotBlank() }
                .joinToString(", ")
        }

/**
 * Fetches the device's current location via the fused location provider. Caller must ensure a
 * location permission is granted. Returns null on failure / no fix. Runs its async API and
 * suspends until a result arrives (or null).
 */
@SuppressLint("MissingPermission")
private suspend fun fetchCurrentLatLng(context: android.content.Context): LatLng? =
    kotlin.runCatching {
        val client = com.google.android.gms.location.LocationServices
            .getFusedLocationProviderClient(context)
        kotlinx.coroutines.suspendCancellableCoroutine { cont ->
            val cts = com.google.android.gms.tasks.CancellationTokenSource()
            client.getCurrentLocation(
                com.google.android.gms.location.Priority.PRIORITY_HIGH_ACCURACY,
                cts.token
            ).addOnSuccessListener { loc ->
                cont.resumeWith(Result.success(loc?.let { LatLng(it.latitude, it.longitude) }))
            }.addOnFailureListener {
                cont.resumeWith(Result.success(null))
            }
            cont.invokeOnCancellation { cts.cancel() }
        }
    }.getOrNull()

/**
 * Forward geocode via the Google Geocoding HTTP API (fallback for [geocodePlace] when the
 * platform geocoder is unavailable). Returns null on any failure / no results, or when no key
 * is configured.
 */
private fun geocodeViaHttp(address: String): GeocodeResult? {
    if (Config.MAPS_API_KEY.isBlank()) return null
    return runCatching {
        val encoded = URLEncoder.encode(address, "UTF-8")
        val url = URL(
            "https://maps.googleapis.com/maps/api/geocode/json?address=$encoded&key=${Config.MAPS_API_KEY}"
        )
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 15_000
            readTimeout = 15_000
        }
        try {
            if (conn.responseCode !in 200..299) return@runCatching null
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            val json = JSONObject(body)
            val results = json.optJSONArray("results")
            if (results == null || results.length() == 0) return@runCatching null
            val first = results.getJSONObject(0)
            val loc = first.getJSONObject("geometry").getJSONObject("location")
            val lat = loc.getDouble("lat")
            val lng = loc.getDouble("lng")
            val formatted = first.optString("formatted_address", address)
            GeocodeResult(LatLng(lat, lng), formatted)
        } finally {
            conn.disconnect()
        }
    }.getOrNull()
}

/** Keeps digits (and a single dot when [decimal]); used for price / count inputs. */
private fun String.filterNumeric(decimal: Boolean = false): String {
    val filtered = filter { it.isDigit() || (decimal && it == '.') }
    if (!decimal) return filtered.take(4)
    // Allow at most one decimal point.
    val firstDot = filtered.indexOf('.')
    return if (firstDot < 0) filtered
    else filtered.substring(0, firstDot + 1) + filtered.substring(firstDot + 1).replace(".", "")
}
