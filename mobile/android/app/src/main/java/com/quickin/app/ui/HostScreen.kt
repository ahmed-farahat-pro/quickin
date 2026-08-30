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
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.defaultMinSize
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AddPhotoAlternate
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Sailing
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Sell
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
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
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.quickin.app.AiWriterUiState
import com.quickin.app.ResortCatalogUiState
import com.quickin.app.ResortChoice
import com.quickin.app.ResortOption
import com.quickin.app.WeekendDaysException
import com.quickin.app.WeekendSchedule
import com.quickin.app.AvatarImage
import com.quickin.app.Commission
import com.quickin.app.ListingCapacityPolicy
import com.quickin.app.ListingPricingRules
import com.quickin.app.MonthPriceException
import com.quickin.app.ListingTitlePolicy
import com.quickin.app.ListingGeoPolicy
import com.quickin.app.ListingGate
import com.quickin.app.Config
import com.quickin.app.CreateListingUiState
import com.quickin.app.HostBooking
import com.quickin.app.HostBookingFilter
import com.quickin.app.HostBookingFilterRules
import com.quickin.app.HostBookingsUiState
import com.quickin.app.HostListingsUiState
import com.quickin.app.HostVisibility
import com.quickin.app.Listing
import com.quickin.app.ListingApproval
import com.quickin.app.OwnershipDocLoader
import com.quickin.app.OwnershipDocRules
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
import com.quickin.app.ui.theme.Gold
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
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val ErrorRed = Color(0xFFB3261E)
private val SuccessGreen = Color(0xFF2E7D32)

/** Default pin-picker camera target (all of Egypt) until the host taps the map. */
private val EGYPT = LatLng(26.8206, 30.8025)
private const val EGYPT_ZOOM = 5.5f

/**
 * Host-only area (reached from the Profile tab when role == "host"). Four tabs:
 *  • Requests — reservation requests across the host's listings, with Confirm / Reject
 *               on pending ones (`GET /api/local/host/bookings`, `PATCH /api/local/bookings/:id`).
 *  • Review guests — past guests the host can rate (`GET/POST /api/local/guest-reviews`).
 *  • Add listing — a form that POSTs `/api/local/listings`.
 *  • Listings — the host's own listings with approval status, ownership-doc re-upload, and links
 *               into the pricing calendar and the full editor (matches the web `/host` dashboard).
 *               Length-of-stay discounts and seasonal pricing are NOT edited here: they belong to
 *               the listing editor, same as on web and iOS.
 *
 * Above the tabs sits a quick-action shelf into Earnings, Analytics and Services. Those three
 * screens have always existed on Android but were only reachable from Profile -> Hosting, which
 * is why they read as "missing" next to the iOS dashboard that lists them inline. The Profile
 * rows stay: this adds a second door to the same three screens, it does not move them.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HostScreen(
    bookingsState: HostBookingsUiState,
    createState: CreateListingUiState,
    reviewGuestsState: com.quickin.app.ReviewGuestsUiState = com.quickin.app.ReviewGuestsUiState(),
    listingsState: com.quickin.app.HostListingsUiState = com.quickin.app.HostListingsUiState(),
    onLoadListings: () -> Unit = {},
    /**
     * Opens one of the host's own listings as a GUEST sees it ("See it as a guest"). Not a plain
     * navigation: the caller re-reads the listing from the guest projection first — see
     * [com.quickin.app.GuestPreviewUiState] — so [guestPreviewState] reports that read.
     */
    onOpenListing: (Listing) -> Unit = {},
    /** Which card's guest preview is loading, and why it failed if it did. */
    guestPreviewState: com.quickin.app.GuestPreviewUiState = com.quickin.app.GuestPreviewUiState(),
    /** Opens the full listing editor (every field + photos) from a host listing card. */
    onEditListing: (Listing) -> Unit = {},
    /** Opens the pricing calendar (per-day rates + open/closed days) from a host listing card. */
    onOpenCalendar: (Listing) -> Unit = {},
    ownershipState: OwnershipDocUiState = OwnershipDocUiState(),
    onReuploadDoc: (listingId: String, ownershipDoc: String) -> Unit = { _, _ -> },
    visibilityState: com.quickin.app.ListingVisibilityUiState = com.quickin.app.ListingVisibilityUiState(),
    /** Takes a listing off the market, or puts it back — QuickIn's "delete my listing". */
    onSetPublished: (listingId: String, isPublished: Boolean) -> Unit = { _, _ -> },
    onBack: (() -> Unit)?,
    onLoadBookings: () -> Unit,
    onConfirm: (String) -> Unit,
    onReject: (String) -> Unit,
    onMessage: (String) -> Unit,
    onLoadReviewableGuests: () -> Unit = {},
    onSubmitGuestReview: (bookingId: String, rating: Int, comment: String) -> Unit = { _, _, _ -> },
    /** Opens "Earnings & payouts" (`GET /api/local/host/earnings`). Also on Profile -> Hosting. */
    onOpenEarnings: () -> Unit = {},
    /** Opens the host analytics dashboard (`GET /api/local/host/analytics`). */
    onOpenAnalytics: () -> Unit = {},
    /** Opens the host's services + subscription-request inbox (`GET /api/local/host/services`). */
    onOpenServices: () -> Unit = {},
    onCreateListing: (
        title: String, description: String, location: String, country: String,
        pricePerNight: String, maxGuests: String, bedrooms: String, beds: String,
        bathrooms: String, propertyType: String, photos: List<String>,
        amenities: List<String>, lat: Double?, lng: Double?, region: String?,
        resort: ResortChoice.Selection,
        cancellationPolicy: String, ownershipDoc: String?,
        weeklyDiscount: String, monthlyDiscount: String,
        weekendPrice: String, weekendDays: List<Int>, monthlyPrices: Map<String, Double>
    ) -> Unit,
    onResetCreate: () -> Unit,
    // ---- AI listing-description writer (Section 10) ----
    aiWriter: AiWriterUiState = AiWriterUiState(),
    onGenerateDescription: (
        title: String, location: String, region: String, propertyType: String,
        bedrooms: Int, maxGuests: Int, amenities: List<String>, notes: String
    ) -> Unit = { _, _, _, _, _, _, _, _ -> },
    onConsumeGeneratedDescription: () -> Unit = {},
    onClearAiWriter: () -> Unit = {},
    /** The resort / compound catalog for the area the host has picked, and the request to load it.
     *  Optional everywhere: an empty catalog leaves the picker offering the free-text path. */
    resortCatalog: ResortCatalogUiState = ResortCatalogUiState(),
    onLoadResorts: (String?) -> Unit = {},
    /** Platform commission — drives the "guests will see EGP X" hint under the price fields. */
    commission: Commission? = null,
    /** Whether this host may add a listing; blocks the wizard when not. */
    listingGate: ListingGate = ListingGate.UNKNOWN
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
            // Quick actions into the three host screens that are NOT tabs. Kept to one
            // compact shelf rather than three more tabs: the tab row already scrolls, and
            // a fourth/fifth/sixth tab would push "Listings" further off-screen.
            HostQuickActions(
                onOpenEarnings = onOpenEarnings,
                onOpenAnalytics = onOpenAnalytics,
                onOpenServices = onOpenServices
            )

            ScrollableTabRow(
                selectedTabIndex = tab,
                containerColor = CreamPage,
                contentColor = Burgundy,
                edgePadding = 0.dp,
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
                    text = { Text("Requests", fontWeight = FontWeight.SemiBold, maxLines = 1) },
                    selectedContentColor = Burgundy,
                    unselectedContentColor = Muted
                )
                Tab(
                    selected = tab == 1,
                    onClick = { tab = 1 },
                    text = { Text(stringResource(com.quickin.app.R.string.reviews_review_guests), fontWeight = FontWeight.SemiBold, maxLines = 1) },
                    selectedContentColor = Burgundy,
                    unselectedContentColor = Muted
                )
                Tab(
                    selected = tab == 2,
                    onClick = { tab = 2 },
                    text = { Text("Add listing", fontWeight = FontWeight.SemiBold, maxLines = 1) },
                    selectedContentColor = Burgundy,
                    unselectedContentColor = Muted
                )
                Tab(
                    selected = tab == 3,
                    onClick = { tab = 3 },
                    text = { Text("Listings", fontWeight = FontWeight.SemiBold, maxLines = 1) },
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
                2 -> AddListingTab(
                    state = createState,
                    onCreate = onCreateListing,
                    onReset = onResetCreate,
                    aiWriter = aiWriter,
                    onGenerateDescription = onGenerateDescription,
                    onConsumeGeneratedDescription = onConsumeGeneratedDescription,
                    onClearAiWriter = onClearAiWriter,
                    resortCatalog = resortCatalog,
                    onLoadResorts = onLoadResorts,
                    commission = commission,
                    listingGate = listingGate
                )
                else -> HostListingsScreen(
                    state = listingsState,
                    onLoad = onLoadListings,
                    // The wizard already lives on the "Add listing" tab — jump to it.
                    onAddListing = { tab = 2 },
                    onOpenListing = onOpenListing,
                    guestPreviewState = guestPreviewState,
                    onEditListing = onEditListing,
                    onOpenCalendar = onOpenCalendar,
                    ownershipState = ownershipState,
                    onReuploadDoc = onReuploadDoc,
                    visibilityState = visibilityState,
                    onSetPublished = onSetPublished,
                    embedded = true
                )
            }
        }
    }
}

/**
 * The three host screens that live outside the tab set — Earnings, Analytics, Services — as a
 * compact shelf under the top bar, so they are visible from every tab.
 *
 * Deliberately icon-over-label tiles rather than [SettingsRow]s: three stacked rows would cost
 * ~210dp and push the tab row below the fold on a short phone, which is the discoverability
 * problem this is meant to fix, not repeat. Strings are the ones the Profile rows already use,
 * so this adds no new translations.
 */
@Composable
private fun HostQuickActions(
    onOpenEarnings: () -> Unit,
    onOpenAnalytics: () -> Unit,
    onOpenServices: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        HostQuickAction(
            icon = Icons.Filled.Payments,
            label = stringResource(com.quickin.app.R.string.money_earnings),
            accent = Gold,
            onClick = onOpenEarnings,
            modifier = Modifier.weight(1f)
        )
        HostQuickAction(
            icon = Icons.Filled.Insights,
            label = stringResource(com.quickin.app.R.string.analytics_title),
            accent = Burgundy,
            onClick = onOpenAnalytics,
            modifier = Modifier.weight(1f)
        )
        HostQuickAction(
            icon = Icons.Filled.Sailing,
            label = stringResource(com.quickin.app.R.string.profile_host_services),
            accent = Burgundy,
            onClick = onOpenServices,
            modifier = Modifier.weight(1f)
        )
    }
}

/** One tile of [HostQuickActions]: icon in a tinted circle over a single-line label. */
@Composable
private fun HostQuickAction(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    accent: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val interaction = remember { MutableInteractionSource() }
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = Color.White,
        shadowElevation = 3.dp,
        modifier = modifier
            .qkPress(interaction)
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(vertical = 12.dp, horizontal = 6.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .background(accent.copy(alpha = 0.12f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(19.dp))
            }
            Spacer(Modifier.height(7.dp))
            Text(
                label,
                color = Ink,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center
            )
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
    /** Opens one of the host's own listings as a guest sees it ("See it as a guest"). */
    onOpenListing: (Listing) -> Unit = {},
    /** Which card's guest preview is loading, and why it failed if it did. */
    guestPreviewState: com.quickin.app.GuestPreviewUiState = com.quickin.app.GuestPreviewUiState(),
    /** Opens the full listing editor (every field + photos) for one of the host's own listings. */
    onEditListing: (Listing) -> Unit = {},
    /** Opens the pricing calendar for one of the host's own listings. */
    onOpenCalendar: (Listing) -> Unit = {},
    ownershipState: OwnershipDocUiState = OwnershipDocUiState(),
    onReuploadDoc: (listingId: String, ownershipDoc: String) -> Unit = { _, _ -> },
    visibilityState: com.quickin.app.ListingVisibilityUiState = com.quickin.app.ListingVisibilityUiState(),
    /** Takes a listing off the market, or puts it back — QuickIn's "delete my listing". */
    onSetPublished: (listingId: String, isPublished: Boolean) -> Unit = { _, _ -> },
    contentPadding: PaddingValues = PaddingValues(),
    /** True when rendered inside another screen's Scaffold (e.g. the HostScreen tab) — hides the
     *  own top app bar so the two aren't stacked. */
    embedded: Boolean = false
) {
    LaunchedEffect(Unit) {
        onLoad()
    }
    // Moderation-status filter over the host's own listings (All by default).
    var filter by remember { mutableStateOf(HostListingFilter.All) }
    val visibleListings = remember(state.listings, filter) {
        state.listings.filter { filter.matches(it.hostVisibility) }
    }
    // Counted over every listing, not the visible slice — a chip has to say what it WOULD show.
    val filterCounts = remember(state.listings) {
        hostListingFilterCounts(state.listings.map { it.hostVisibility })
    }
    Scaffold(
        containerColor = CreamPage,
        modifier = Modifier.padding(contentPadding),
        topBar = {
            if (!embedded) {
                TopAppBar(
                    title = { Text("My listings", color = Ink, fontWeight = FontWeight.Bold) },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = CreamPage)
                )
            }
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

            // Status filter — only worth showing once the host actually has listings.
            if (state.listings.isNotEmpty()) {
                HostListingFilterRow(counts = filterCounts, selected = filter, onSelect = { filter = it })
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
                    // The host has listings, just none in the selected status — keep it short so it
                    // reads as "nothing here right now", not "you have no listings".
                    visibleListings.isEmpty() -> Text(
                        filter.emptyMessage,
                        color = Muted,
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 32.dp, vertical = 24.dp)
                    )
                    else -> LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        items(visibleListings) { listing ->
                            HostListingCard(
                                listing = listing,
                                onClick = { onOpenListing(listing) },
                                guestPreviewState = guestPreviewState,
                                onEdit = { onEditListing(listing) },
                                onOpenCalendar = { onOpenCalendar(listing) },
                                ownershipState = ownershipState,
                                onReuploadDoc = onReuploadDoc,
                                visibilityState = visibilityState,
                                onSetPublished = onSetPublished
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * The moderation-status filter above the host's own listings. "Under review" is the host-facing
 * wording for [ListingApproval.Pending] (a listing waiting on staff approval, not yet public).
 * Legacy listings with no `approval_status` parse as [ListingApproval.Approved], so they read as
 * "Published" rather than disappearing behind a filter.
 *
 * Labels are hardcoded English to match the rest of the host area (localization is a follow-up).
 */
internal enum class HostListingFilter(val label: String) {
    All("All"),
    Published("Published"),
    UnderReview("Under review"),
    Rejected("Rejected"),
    Deactivated("Deactivated");

    /**
     * True when a listing in [state] belongs in this filter. Takes [Listing.hostVisibility], which
     * folds moderation and visibility together — a listing can be approved AND hidden, and filtering
     * on approval alone would file it under "Published" while guests cannot find it.
     *
     * [HostVisibility.Blocked] ("hidden by our team") deliberately has no chip: it is rare, it is
     * nothing the host can act on, and a chip that usually selects nothing is one people learn to
     * ignore. Those rows still appear under All, with their badge.
     */
    fun matches(state: HostVisibility): Boolean = when (this) {
        All -> true
        Published -> state == HostVisibility.Live
        UnderReview -> state == HostVisibility.UnderReview
        Rejected -> state == HostVisibility.Rejected
        Deactivated -> state == HostVisibility.Deactivated
    }

    /** Short muted note shown when the host has listings but none in this status. */
    val emptyMessage: String
        get() = when (this) {
            All -> "No listings to show."
            Published -> "No published listings."
            UnderReview -> "No listings under review."
            Rejected -> "No rejected listings."
            Deactivated -> "No deactivated listings."
        }
}

/**
 * How many of [states] sit behind each chip — the number each chip is badged with, so the host can
 * see what is waiting on review without clicking through to find out (and can see that a status is
 * empty without clicking at all). Matches iOS, whose chips have carried these counts since the
 * filter shipped.
 *
 * Every entry is present, zeros included. [HostListingFilter.All] holds the total; whether that is
 * worth showing is the chip row's call, not this function's.
 */
internal fun hostListingFilterCounts(states: List<HostVisibility>): Map<HostListingFilter, Int> =
    HostListingFilter.entries.associateWith { filter -> states.count { filter.matches(it) } }

/**
 * Horizontal chip row of [HostListingFilter]s above the host's listings (All · Published ·
 * Under review · Rejected). Mirrors the explore screen's sort/region chip row — the selected chip
 * is filled Burgundy, the rest are outlined Tan over white.
 */
@Composable
private fun HostListingFilterRow(
    counts: Map<HostListingFilter, Int>,
    selected: HostListingFilter,
    onSelect: (HostListingFilter) -> Unit
) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 10.dp)
    ) {
        items(HostListingFilter.entries) { option ->
            HostFilterChip(
                label = option.label,
                // "All" stays bare: its count is just the number of cards below it, and iOS leaves
                // it bare for the same reason.
                count = if (option == HostListingFilter.All) null else counts[option] ?: 0,
                selected = selected == option,
                onClick = { onSelect(option) }
            )
        }
    }
}

/**
 * A pill-shaped filter chip: filled Burgundy/white when selected, outlined Tan over white
 * otherwise. Mirrors `FilterChipPill` in ListingsScreen.kt (which is file-private there), plus the
 * small counter pill iOS's QKChip carries. Pass a null [count] to render the chip bare.
 */
@Composable
private fun HostFilterChip(label: String, count: Int?, selected: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(50),
        color = if (selected) Burgundy else Color.White,
        contentColor = if (selected) Color.White else Ink,
        border = androidx.compose.foundation.BorderStroke(1.dp, if (selected) Burgundy else Tan),
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

/**
 * A compact card for one of the host's own listings (title, location, listed date, price) plus its
 * moderation [ApprovalBadge]. For a pending or rejected listing the card explains the status and
 * offers an ownership-document action that PATCHes `/api/local/listings/:id {ownership_doc}` and
 * re-queues the listing to review. It reads "Upload…" or "Re-upload…" depending on
 * [Listing.hasOwnershipDoc], NOT on the moderation status: the document is optional at create
 * time, so a listing reaches the queue with nothing attached and there is nothing to re-upload. "Edit listing" opens the full editor
 * (every field + photos); saving there sends the listing back for review too.
 */
@Composable
private fun HostListingCard(
    listing: Listing,
    onClick: () -> Unit,
    guestPreviewState: com.quickin.app.GuestPreviewUiState = com.quickin.app.GuestPreviewUiState(),
    onEdit: () -> Unit,
    onOpenCalendar: () -> Unit,
    ownershipState: OwnershipDocUiState,
    onReuploadDoc: (listingId: String, ownershipDoc: String) -> Unit,
    visibilityState: com.quickin.app.ListingVisibilityUiState = com.quickin.app.ListingVisibilityUiState(),
    onSetPublished: (listingId: String, isPublished: Boolean) -> Unit = { _, _ -> }
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var processingDoc by remember { mutableStateOf(false) }
    // Why the last pick was refused (a .docx, an oversized scan), as a string resource. Kept apart
    // from the view-model's error: this one never reached the network.
    var docProblem by remember { mutableStateOf<Int?>(null) }
    // Opens the system document picker on images AND PDFs — a deed is as often one as the other,
    // and the photo picker could only ever offer the first.
    val docPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            processingDoc = true
            docProblem = null
            scope.launch {
                val result = withContext(Dispatchers.IO) { OwnershipDocLoader.load(context, uri) }
                processingDoc = false
                when (result) {
                    is OwnershipDocLoader.Result.Loaded -> onReuploadDoc(listing.id, result.dataUrl)
                    is OwnershipDocLoader.Result.Failed -> docProblem = result.problem.messageRes
                }
            }
        }
    }
    // This card is "busy" while either its local downscale runs or its PATCH is in flight.
    val submitting = processingDoc ||
        (ownershipState.isSubmitting && ownershipState.listingId == listing.id)
    val justSubmitted = ownershipState.submittedId == listing.id
    // A file this phone refused outranks a stale server error — it is the one the host just picked.
    val rowError = docProblem?.let { stringResource(it) }
        ?: ownershipState.error?.takeIf { ownershipState.listingId == listing.id }

    BoutiqueCard(modifier = Modifier.fillMaxWidth(), onClick = onClick, shadow = 6.dp) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                val imageUrl = listing.sortedImageUrls.firstOrNull()
                Surface(shape = RoundedCornerShape(14.dp), color = Tan, modifier = Modifier.size(72.dp)) {
                    if (imageUrl != null) {
                        // Handles both http(s) photos (Coil) and device-uploaded base64 `data:` photos.
                        DataUrlAwareImage(
                            url = imageUrl,
                            contentDescription = listing.title,
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
                        ApprovalBadge(state = listing.hostVisibility)
                    }
                    if (listing.location != null) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                            Icon(Icons.Filled.LocationOn, null, tint = Muted, modifier = Modifier.size(14.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(listing.location, color = Muted, fontSize = 13.sp, maxLines = 1)
                        }
                    }
                    // When the place was listed — omitted entirely when the backend didn't send
                    // created_at (or it can't be parsed).
                    val listedDate = remember(listing.createdAt) { formatListedDate(listing.createdAt) }
                    if (listedDate != null) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                            Icon(Icons.Filled.DateRange, null, tint = Muted, modifier = Modifier.size(14.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Listed $listedDate", color = Muted, fontSize = 12.sp, maxLines = 1)
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
                if (listing.isRejected) {
                    // Why it was rejected. The badge alone tells a host they're blocked without
                    // telling them what to change, which is the one thing the badge exists to
                    // prompt. reviewNote is null when the operator wrote no reason (it is
                    // optional) and on listings rejected before the reason was stored at all —
                    // both fall back to the generic line this block used to always show.
                    Text(
                        stringResource(com.quickin.app.R.string.approval_rejected_reason),
                        color = Burgundy,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp
                    )
                    Text(
                        listing.reviewNote
                            ?: stringResource(com.quickin.app.R.string.approval_rejected_note),
                        color = Ink,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                } else {
                    Text(
                        stringResource(com.quickin.app.R.string.approval_pending_note),
                        color = Muted,
                        fontSize = 13.sp
                    )
                }
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
                    onClick = { docPicker.launch(OwnershipDocLoader.PICKER_MIME_TYPES) },
                    // "Re-upload" only when there is something to re-upload. `justSubmitted`
                    // covers the moment between a successful PATCH and the cache refresh.
                    label = stringResource(
                        if (listing.hasOwnershipDoc || justSubmitted) {
                            com.quickin.app.R.string.approval_reupload
                        } else {
                            com.quickin.app.R.string.approval_upload_ownership_doc
                        }
                    ),
                    modifier = Modifier.padding(top = 10.dp)
                )
            }

            // "See it as a guest" — the listing exactly as a guest meets it, which is the check
            // a host wants BEFORE approval and cannot make any other way on a listing guests
            // cannot yet reach. First in the stack because it is the one action here that
            // changes nothing. The card itself is tappable too and lands in the same place.
            val previewLoading = guestPreviewState.isLoading && guestPreviewState.listingId == listing.id
            val previewError = guestPreviewState.error?.takeIf { guestPreviewState.listingId == listing.id }
            Spacer(Modifier.height(12.dp))
            OutlinedButton(
                onClick = onClick,
                enabled = !previewLoading,
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Burgundy.copy(alpha = 0.25f)),
                colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White, contentColor = Burgundy),
                modifier = Modifier.fillMaxWidth().height(46.dp)
            ) {
                if (previewLoading) {
                    CircularProgressIndicator(color = Burgundy, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
                } else {
                    Icon(Icons.Filled.Visibility, contentDescription = null, modifier = Modifier.size(18.dp))
                }
                Spacer(Modifier.width(8.dp))
                Text(stringResource(com.quickin.app.R.string.preview_guest_action), fontWeight = FontWeight.SemiBold)
            }
            if (previewError != null) {
                Text(previewError, color = ErrorRed, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
            }

            // Day-by-day rates and availability. Above the editor on purpose: this is the
            // routine errand a host opens their listings for, and unlike a full edit it does
            // NOT send the listing back to the moderation queue.
            Spacer(Modifier.height(10.dp))
            OutlinedButton(
                onClick = onOpenCalendar,
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Burgundy.copy(alpha = 0.25f)),
                colors = ButtonDefaults.outlinedButtonColors(
                    containerColor = Burgundy.copy(alpha = 0.08f),
                    contentColor = Burgundy
                ),
                modifier = Modifier.fillMaxWidth().height(46.dp)
            ) {
                Icon(Icons.Filled.DateRange, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(stringResource(com.quickin.app.R.string.calendar_open), fontWeight = FontWeight.SemiBold)
            }

            // The full editor — every field plus photo management. Saving there re-queues the
            // listing for review, so the host is warned before they commit.
            Spacer(Modifier.height(10.dp))
            OutlinedButton(
                onClick = onEdit,
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Burgundy),
                colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White, contentColor = Burgundy),
                modifier = Modifier.fillMaxWidth().height(46.dp)
            ) {
                Icon(Icons.Filled.Edit, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(stringResource(com.quickin.app.R.string.listing_edit_title), fontWeight = FontWeight.SemiBold)
            }

            // Take the listing off the market, or put it back. QuickIn has no host-facing delete —
            // this IS "remove my listing", and it keeps every booking, review and payment record
            // intact. Withheld only on Blocked, which the host cannot undo and the API refuses.
            if (listing.hostVisibility != HostVisibility.Blocked) {
                ListingVisibilityControl(
                    listing = listing,
                    state = visibilityState,
                    onSetPublished = onSetPublished
                )
            }

            // What "deactivated" / "hidden by our team" actually mean for the guests already
            // booked in. The word alone does not say, and that is the first thing a host wants
            // to know before they press anything.
            when (listing.hostVisibility) {
                HostVisibility.Deactivated -> VisibilityNote(
                    title = "You deactivated this listing",
                    body = "Guests can't find or book it. Reservations you already confirmed are " +
                        "unaffected — your guests keep their stay, their pass and your messages."
                )
                HostVisibility.Blocked -> VisibilityNote(
                    title = "Hidden by our team",
                    body = "This listing isn't visible to guests right now, and you can't change " +
                        "that from here. Contact support to find out why."
                )
                else -> Unit
            }
        }
    }
}

/**
 * "Deactivate" / "Reactivate" on a host listing card, with the confirmation that has to come
 * first.
 *
 * The dialog is not decoration: deactivating DECLINES every booking request still waiting on this
 * host — leaving them would let a guest end up with a confirmed stay at a place the host has
 * walked away from — so it names the exact count from [Listing.pendingRequestCount] before the
 * host commits, and says plainly what is NOT affected. Reactivating needs no confirmation: it
 * takes nothing away.
 */
@Composable
private fun ListingVisibilityControl(
    listing: Listing,
    state: com.quickin.app.ListingVisibilityUiState,
    onSetPublished: (listingId: String, isPublished: Boolean) -> Unit
) {
    var confirming by remember { mutableStateOf(false) }
    val isThis = state.listingId == listing.id
    val busy = isThis && state.isSubmitting
    val deactivated = listing.hostVisibility == HostVisibility.Deactivated

    Spacer(Modifier.height(12.dp))
    OutlinedButton(
        onClick = { if (deactivated) onSetPublished(listing.id, true) else confirming = true },
        enabled = !busy,
        shape = RoundedCornerShape(14.dp),
        // Reactivating is the constructive direction and gets the burgundy outline; deactivating
        // stays muted so it never competes with Edit for a distracted tap.
        border = androidx.compose.foundation.BorderStroke(1.dp, if (deactivated) Burgundy else Tan),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = Color.White,
            contentColor = if (deactivated) Burgundy else Muted
        ),
        modifier = Modifier.fillMaxWidth().height(46.dp)
    ) {
        if (busy) {
            CircularProgressIndicator(color = Muted, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
        } else {
            Icon(
                if (deactivated) Icons.Filled.Visibility else Icons.Filled.VisibilityOff,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(Modifier.width(8.dp))
            Text(if (deactivated) "Reactivate" else "Deactivate", fontWeight = FontWeight.SemiBold)
        }
    }

    if (isThis && state.message != null) {
        Text(state.message, color = Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
    }
    if (isThis && state.error != null) {
        Text(state.error, color = ErrorRed, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
    }

    if (confirming) {
        val pending = listing.pendingRequestCount
        AlertDialog(
            onDismissRequest = { confirming = false },
            title = { Text("Deactivate this listing?", fontWeight = FontWeight.Bold, color = Ink) },
            text = {
                Column {
                    Text(
                        "\u201C${listing.title}\u201D will disappear from search and nobody will " +
                            "be able to book it.",
                        color = Ink,
                        fontSize = 14.sp
                    )
                    // Nothing is said about pending requests when there are none — an empty
                    // warning trains people to click through the real one.
                    if (pending > 0) {
                        Text(
                            if (pending == 1) {
                                "1 booking request still waiting on you will be declined."
                            } else {
                                "$pending booking requests still waiting on you will be declined."
                            },
                            color = ErrorRed,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp,
                            modifier = Modifier.padding(top = 10.dp)
                        )
                    }
                    Text(
                        "Nothing is deleted. Reservations you already confirmed stay exactly as " +
                            "they are, and you can reactivate this listing at any time.",
                        color = Muted,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(top = 10.dp)
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    confirming = false
                    onSetPublished(listing.id, false)
                }) {
                    Text("Deactivate", color = ErrorRed, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirming = false }) {
                    Text("Keep it live", color = Ink)
                }
            },
            containerColor = Color.White
        )
    }
}

/** A short "here is what this state means" note under a host listing card. */
@Composable
private fun VisibilityNote(title: String, body: String) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = CreamPage,
        modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Text(title, color = Ink, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            Text(body, color = Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
        }
    }
}

/**
 * A small pill showing the state a host's own listing is in: amber (under review), green (live),
 * red (rejected), grey (the host deactivated it), warm grey (hidden by staff).
 *
 * It takes a [HostVisibility], not a [ListingApproval], because from the host's side "why can
 * nobody see this?" has one answer: a listing can be approved and still hidden, and a badge that
 * only knew about moderation would call that one "Approved" while guests could not find it.
 */
@Composable
internal fun ApprovalBadge(state: HostVisibility) {
    val (bg, fg) = when (state) {
        HostVisibility.UnderReview -> Color(0xFFFFF3D6) to Color(0xFF8A6100)
        HostVisibility.Live -> Color(0xFFE3F3E5) to SuccessGreen
        HostVisibility.Rejected -> Color(0xFFFBE3E1) to ErrorRed
        // The host's own decision, not a fault — a neutral grey, not the rejection red, or their
        // own choice would read back to them as a reprimand.
        HostVisibility.Deactivated -> Color(0xFFEDEAE6) to Muted
        HostVisibility.Blocked -> Color(0xFFF3EAE2) to Color(0xFF6A4A3C)
    }
    val label = when (state) {
        HostVisibility.UnderReview -> stringResource(ListingApproval.Pending.labelRes)
        HostVisibility.Live -> stringResource(ListingApproval.Approved.labelRes)
        HostVisibility.Rejected -> stringResource(ListingApproval.Rejected.labelRes)
        HostVisibility.Deactivated -> "Deactivated"
        HostVisibility.Blocked -> "Hidden by our team"
    }
    Surface(shape = RoundedCornerShape(50), color = bg) {
        Text(
            label,
            color = fg,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
        )
    }
}

/** Overload for the surfaces that only hold a moderation status — the editor's post-save
 *  confirmation, which has just re-queued the listing and is saying exactly that. */
@Composable
internal fun ApprovalBadge(approval: ListingApproval) {
    ApprovalBadge(
        state = when (approval) {
            ListingApproval.Pending -> HostVisibility.UnderReview
            ListingApproval.Approved -> HostVisibility.Live
            ListingApproval.Rejected -> HostVisibility.Rejected
        }
    )
}

/**
 * Formats a listing's ISO-8601 `created_at` into a short "d MMM yyyy" date (e.g. "27 Jul 2026")
 * for the "Listed …" line on a host listing card. Handles an offset/zoned timestamp
 * ("2026-07-27T10:28:00Z" / "+02:00"), a bare instant, and a plain "yyyy-MM-dd" date. Returns null
 * when [raw] is null/blank or can't be parsed, so the caller simply omits the row.
 */
private fun formatListedDate(raw: String?): String? {
    val value = raw?.takeUnless { it.isBlank() } ?: return null
    val formatter = DateTimeFormatter.ofPattern("d MMM yyyy", java.util.Locale.getDefault())
    return runCatching { OffsetDateTime.parse(value).toLocalDate().format(formatter) }
        .recoverCatching { Instant.parse(value).atZone(ZoneId.systemDefault()).toLocalDate().format(formatter) }
        // Falls back to the leading date for timestamps with no zone/offset ("2026-07-27T10:28:00").
        .recoverCatching { LocalDate.parse(value.take(10)).format(formatter) }
        .getOrNull()
}

/** A compact 0–100 percent input (digits only, capped at 100) used by the discount fields. */
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
 * The seasonal/variable-pricing section shared by the add-listing wizard and the inline editor on
 * a host listing card: a single weekend nightly-price field plus a compact 12-month list of
 * optional nightly-price fields. All amounts are EGP; blank fields mean "use the base nightly
 * price". RTL-safe — labels resolve via stringResource and the rows lay out start→end.
 *
 * [monthlyPrices] maps month "1".."12" → the current text value (absent = blank); [onMonthlyPrice]
 * lifts each edit back (an empty value clears that month). [weekendDays] are the weekdays the
 * weekend rate is charged on (`0`=Sun … `6`=Sat) and [onToggleWeekendDay] lifts each pill tap back.
 */
@Composable
private fun SeasonalPricingFields(
    weekendPrice: String,
    onWeekendPrice: (String) -> Unit,
    weekendDays: Set<Int>,
    onToggleWeekendDay: (Int) -> Unit,
    monthlyPrices: Map<String, String>,
    onMonthlyPrice: (month: String, value: String) -> Unit
) {
    val monthNames = monthLabels()
    // What is wrong with the weekend rate and with the months, right now — the same rules the API
    // runs. A `0` used to read as "no rate" at every layer, so the host saved a listing with the
    // weekend pills lit and nothing behind them, and no screen ever said so.
    val weekendProblem = ListingPricingRules.problemWith(weekendPrice)
    val weekendError = if (weekendProblem == null) null else stringResource(weekendPriceProblemRes(weekendProblem))
    val badMonth = ListingPricingRules.failingMonth(monthlyPrices)
    // Resolved once, outside the month loop: `stringResource` is itself @Composable and cannot be
    // called from inside the `forEach` lambda that lays the fields out.
    val badMonthError = if (badMonth == null) null else stringResource(
        monthPriceProblemRes(badMonth.problem), stringResource(monthNameRes(badMonth.month))
    )
    val badMonthKey = badMonth?.month?.toString()
    Text(
        stringResource(com.quickin.app.R.string.pricing_seasonal),
        fontWeight = FontWeight.SemiBold,
        color = Ink,
        fontSize = 15.sp,
        modifier = Modifier.padding(top = 4.dp)
    )
    Text(
        stringResource(com.quickin.app.R.string.pricing_seasonal_intro),
        color = Muted,
        fontSize = 13.sp
    )
    MoneyField(
        label = stringResource(com.quickin.app.R.string.pricing_weekend_price),
        value = weekendPrice,
        onChange = onWeekendPrice,
        modifier = Modifier.fillMaxWidth(),
        error = weekendError
    )
    WeekendDayPicker(
        weekendPrice = weekendPrice,
        weekendDays = weekendDays,
        onToggle = onToggleWeekendDay
    )
    Text(
        stringResource(com.quickin.app.R.string.pricing_monthly_prices),
        fontWeight = FontWeight.Medium,
        color = Ink,
        fontSize = 14.sp,
        modifier = Modifier.padding(top = 4.dp)
    )
    Text(
        stringResource(com.quickin.app.R.string.pricing_monthly_prices_intro),
        color = Muted,
        fontSize = 12.sp
    )
    // Two months per row keeps the 12-month grid compact.
    monthNames.chunked(2).forEach { pair ->
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            pair.forEach { (monthKey, monthName) ->
                MoneyField(
                    label = monthName,
                    value = monthlyPrices[monthKey].orEmpty(),
                    onChange = { onMonthlyPrice(monthKey, it) },
                    modifier = Modifier.weight(1f),
                    error = if (badMonthKey == monthKey) badMonthError else null
                )
            }
            // Pad an odd trailing item so the last single field keeps half-width alignment.
            if (pair.size == 1) Spacer(Modifier.weight(1f))
        }
    }
}

/**
 * The day pills: which weekdays this listing treats as its weekend.
 *
 * A row rather than a dropdown because the whole point is to see the week at a glance and count the
 * lit days — the two ways this can be wrong (all seven, or none under a real rate) are both about
 * how many are lit, and a picker that hides the rest of the week makes neither visible.
 *
 * The pill index IS the stored day number (`0`=Sun … `6`=Sat, Postgres' DOW), so nothing converts
 * between what the host taps and what gets saved.
 */
@Composable
private fun WeekendDayPicker(
    weekendPrice: String,
    weekendDays: Set<Int>,
    onToggle: (Int) -> Unit
) {
    val rate = weekendPrice.toDoubleOrNull()?.takeIf { it > 0.0 }
    // One short of the week: the point past which no further pill may be lit.
    val isFullWeek = weekendDays.size >= WeekendSchedule.DAYS_IN_WEEK - 1
    // The same rule the API runs, asked here so the host is told beside the pills rather than by a
    // 400 after they save.
    val problem = (WeekendSchedule.resolve(rate, weekendDays).exceptionOrNull() as? WeekendDaysException)?.problem

    Text(
        stringResource(com.quickin.app.R.string.pricing_weekend_days),
        color = Muted,
        fontSize = 12.sp,
        modifier = Modifier.padding(top = 2.dp)
    )
    Row(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        weekdayLabels().forEachIndexed { day, label ->
            val on = weekendDays.contains(day)
            // Locked rather than hidden: a host has to be able to see that the whole week is not on
            // offer, and the line below says why.
            val locked = !on && isFullWeek
            Surface(
                onClick = { onToggle(day) },
                enabled = !locked,
                shape = RoundedCornerShape(9.dp),
                color = if (on) Burgundy else Color.White,
                contentColor = if (on) Color.White else Ink,
                border = androidx.compose.foundation.BorderStroke(1.dp, if (on) Burgundy else Tan),
                modifier = Modifier.weight(1f).height(38.dp).alpha(if (locked) 0.4f else 1f)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        label,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1
                    )
                }
            }
        }
    }
    if (problem != null || isFullWeek) {
        val wholeWeek = problem == WeekendSchedule.Problem.WHOLE_WEEK || (problem == null && isFullWeek)
        Text(
            stringResource(
                if (wholeWeek) com.quickin.app.R.string.pricing_weekend_days_whole_week
                else com.quickin.app.R.string.pricing_weekend_days_none_chosen
            ),
            // Muted while it is only a warning about the locked pills; red once it would refuse a save.
            color = if (problem == null) Muted else ErrorRed,
            fontSize = 12.sp
        )
    }
}

/**
 * Localized short weekday names indexed 0–6 to match Postgres' DOW (`0`=Sun … `6`=Sat) — which is
 * what `weekend_days` stores, so the pill index needs no conversion.
 *
 * `java.time.DayOfWeek` runs MONDAY=1 … SUNDAY=7, so the list is built Sunday-first explicitly
 * rather than by rotating it after the fact.
 */
@Composable
private fun weekdayLabels(): List<String> {
    val locale = java.util.Locale.getDefault()
    val order = listOf(
        java.time.DayOfWeek.SUNDAY, java.time.DayOfWeek.MONDAY, java.time.DayOfWeek.TUESDAY,
        java.time.DayOfWeek.WEDNESDAY, java.time.DayOfWeek.THURSDAY, java.time.DayOfWeek.FRIDAY,
        java.time.DayOfWeek.SATURDAY
    )
    return order.map { it.getDisplayName(java.time.format.TextStyle.SHORT_STANDALONE, locale) }
}

/** The 12 month options as (key "1".."12", localized name) pairs, in calendar order. */
@Composable
private fun monthLabels(): List<Pair<String, String>> = listOf(
    "1" to stringResource(com.quickin.app.R.string.pricing_month_1),
    "2" to stringResource(com.quickin.app.R.string.pricing_month_2),
    "3" to stringResource(com.quickin.app.R.string.pricing_month_3),
    "4" to stringResource(com.quickin.app.R.string.pricing_month_4),
    "5" to stringResource(com.quickin.app.R.string.pricing_month_5),
    "6" to stringResource(com.quickin.app.R.string.pricing_month_6),
    "7" to stringResource(com.quickin.app.R.string.pricing_month_7),
    "8" to stringResource(com.quickin.app.R.string.pricing_month_8),
    "9" to stringResource(com.quickin.app.R.string.pricing_month_9),
    "10" to stringResource(com.quickin.app.R.string.pricing_month_10),
    "11" to stringResource(com.quickin.app.R.string.pricing_month_11),
    "12" to stringResource(com.quickin.app.R.string.pricing_month_12)
)

/**
 * A compact EGP nightly-price input (digits only) used by the seasonal-pricing fields.
 *
 * [error] is the reason this particular field can't be saved, shown under it. It sits on the field
 * rather than only above Save because there are thirteen of these on one screen and "the rate must
 * be more than zero" says nothing about which one.
 */
@Composable
private fun MoneyField(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    error: String? = null
) {
    OutlinedTextField(
        value = value,
        onValueChange = { input -> onChange(input.filter { it.isDigit() }.take(7)) },
        label = { Text(label, fontSize = 12.sp) },
        singleLine = true,
        isError = error != null,
        supportingText = error?.let { { Text(it, color = ErrorRed, fontSize = 12.sp) } },
        prefix = { Text("EGP ") },
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

/** The string resource naming a month (1..12) — the same names [monthLabels] renders, reachable
 *  from a plain `when` so a validation message can say WHICH month is wrong. */
internal fun monthNameRes(month: Int): Int = when (month) {
    1 -> com.quickin.app.R.string.pricing_month_1
    2 -> com.quickin.app.R.string.pricing_month_2
    3 -> com.quickin.app.R.string.pricing_month_3
    4 -> com.quickin.app.R.string.pricing_month_4
    5 -> com.quickin.app.R.string.pricing_month_5
    6 -> com.quickin.app.R.string.pricing_month_6
    7 -> com.quickin.app.R.string.pricing_month_7
    8 -> com.quickin.app.R.string.pricing_month_8
    9 -> com.quickin.app.R.string.pricing_month_9
    10 -> com.quickin.app.R.string.pricing_month_10
    11 -> com.quickin.app.R.string.pricing_month_11
    else -> com.quickin.app.R.string.pricing_month_12
}

/** The message resource for a rejected WEEKEND rate. */
internal fun weekendPriceProblemRes(problem: ListingPricingRules.Problem): Int =
    if (problem == ListingPricingRules.Problem.NOT_POSITIVE) {
        com.quickin.app.R.string.pricing_weekend_price_not_positive
    } else {
        com.quickin.app.R.string.pricing_weekend_price_not_a_number
    }

/** The message resource for a rejected MONTH rate — takes the month's name as its argument. */
internal fun monthPriceProblemRes(problem: ListingPricingRules.Problem): Int =
    if (problem == ListingPricingRules.Problem.NOT_POSITIVE) {
        com.quickin.app.R.string.pricing_month_price_not_positive
    } else {
        com.quickin.app.R.string.pricing_month_price_not_a_number
    }

/**
 * Converts a month→text price map into the month→Double map the API expects, keeping only the
 * months that hold a real rate.
 *
 * Lenient by design, and only safe because it is never the gate: a `0` and a blank field both come
 * out as "no rate here", which is exactly what hid the reported bug when this was the ONLY reading
 * of these fields. The screens refuse a typed zero before they ever get here — see
 * [ListingPricingRules.failingMonth] and the `blocker` chains in the wizard and the editor — so by
 * the time this runs there is no zero left to drop. It is also what the "did anything change?"
 * comparison uses, where dropping is the right answer.
 */
internal fun monthlyPricesAsDoubles(prices: Map<String, String>): Map<String, Double> {
    val out = LinkedHashMap<String, Double>()
    prices.forEach { (month, text) ->
        ListingPricingRules.checkPrice(text).getOrNull()?.let { out[month] = it }
    }
    return out
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
        bathrooms: String, propertyType: String, photos: List<String>,
        amenities: List<String>, lat: Double?, lng: Double?, region: String?,
        resort: ResortChoice.Selection,
        cancellationPolicy: String, ownershipDoc: String?,
        weeklyDiscount: String, monthlyDiscount: String,
        weekendPrice: String, weekendDays: List<Int>, monthlyPrices: Map<String, Double>
    ) -> Unit,
    onResetCreate: () -> Unit,
    // ---- AI listing-description writer (Section 10) ----
    aiWriter: AiWriterUiState = AiWriterUiState(),
    onGenerateDescription: (
        title: String, location: String, region: String, propertyType: String,
        bedrooms: Int, maxGuests: Int, amenities: List<String>, notes: String
    ) -> Unit = { _, _, _, _, _, _, _, _ -> },
    onConsumeGeneratedDescription: () -> Unit = {},
    onClearAiWriter: () -> Unit = {},
    /** The resort / compound catalog for the area the host has picked, and the request to load it.
     *  Optional everywhere: an empty catalog leaves the picker offering the free-text path. */
    resortCatalog: ResortCatalogUiState = ResortCatalogUiState(),
    onLoadResorts: (String?) -> Unit = {},
    /** Platform commission — drives the "guests will see EGP X" hint under the price fields. */
    commission: Commission? = null,
    /** Whether this host may add a listing; blocks the wizard when not. */
    listingGate: ListingGate = ListingGate.UNKNOWN
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
                onClearAiWriter = onClearAiWriter,
                resortCatalog = resortCatalog,
                onLoadResorts = onLoadResorts,
                commission = commission,
                listingGate = listingGate
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
    // Always reload when the tab appears so incoming requests are always fresh.
    androidx.compose.runtime.LaunchedEffect(Unit) {
        onLoad()
    }

    // Status filter over the host's reservations (All by default). Client-side over the
    // already-loaded rows, so switching is instant — /api/local/host/bookings takes no query
    // params and returns every reservation, the same way the listings filter works.
    var filter by remember { mutableStateOf(HostBookingFilter.All) }
    val visibleBookings = remember(state.bookings, filter) {
        state.bookings.filter { filter.matches(it.filterBucket) }
    }
    // Counted over every reservation, not the visible slice — a chip has to say what it WOULD show.
    val filterCounts = remember(state.bookings) {
        HostBookingFilterRules.counts(state.bookings.map { it.filterBucket })
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
            // No reservations at all — a different thing from "nothing in this status" below.
            // It gets no chip row, because there is nothing to filter and eight empty chips
            // would only be noise.
            state.bookings.isEmpty() -> Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(32.dp)
            ) {
                Icon(Icons.Filled.Inbox, contentDescription = null, tint = Burgundy, modifier = Modifier.size(48.dp))
                Text(stringResource(com.quickin.app.R.string.host_booking_filter_empty_all), fontWeight = FontWeight.Bold, color = Ink, fontSize = 18.sp, modifier = Modifier.padding(top = 12.dp))
                Text("Requests from guests will show up here.", color = Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp))
            }
            else -> Column(modifier = Modifier.fillMaxSize()) {
                HostBookingFilterRow(
                    counts = filterCounts,
                    selected = filter,
                    onSelect = { filter = it },
                    modifier = Modifier.padding(top = 12.dp)
                )
                if (visibleBookings.isEmpty()) {
                    // The chip row stays on screen: the only way out of an empty status is
                    // another chip, so hiding it would strand the host here.
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp)
                    ) {
                        Text(
                            stringResource(filter.emptyMessageRes),
                            color = Muted,
                            textAlign = TextAlign.Center
                        )
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        state.actionMessage?.let { msg ->
                            item {
                                Text(msg, color = SuccessGreen, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            }
                        }
                        items(visibleBookings) { booking ->
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
    }
}

/**
 * Horizontal chip row of [HostBookingFilter]s above the host's reservations (All · Awaiting your
 * reply · Awaiting payment · Confirmed · Declined · Cancelled · Refunded · Partially refunded).
 * Reuses [HostFilterChip], so it matches the listings filter and the explore screen's chip rows.
 */
@Composable
private fun HostBookingFilterRow(
    counts: Map<HostBookingFilterRules.Bucket, Int>,
    selected: HostBookingFilter,
    onSelect: (HostBookingFilter) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = modifier
            .fillMaxWidth()
            .padding(bottom = 10.dp)
    ) {
        items(HostBookingFilter.entries) { option ->
            HostFilterChip(
                label = stringResource(option.labelRes),
                // "All" stays bare: its count is just the number of cards below it, and iOS
                // leaves it bare for the same reason.
                count = option.bucket?.let { counts[it] ?: 0 },
                selected = selected == option,
                onClick = { onSelect(option) }
            )
        }
    }
}

/** The decision a host tapped on a request, held until they confirm it. */
private enum class BookingDecision { CONFIRM, REJECT }

@Composable
private fun HostBookingCard(
    booking: HostBooking,
    isActing: Boolean,
    onConfirm: () -> Unit,
    onReject: () -> Unit,
    onMessage: () -> Unit
) {
    // Both outcomes are final for the guest — a confirmed stay holds the dates, a
    // rejection is announced and cannot be taken back — so neither is sent on a
    // single tap.
    var pendingDecision by remember { mutableStateOf<BookingDecision?>(null) }

    BoutiqueCard(
        modifier = Modifier.fillMaxWidth(),
        shadow = 6.dp
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(booking.title, fontWeight = FontWeight.Bold, color = Ink, fontSize = 16.sp, maxLines = 1, modifier = Modifier.weight(1f))
                // The bucket, not just the status: `bookings.status` reads "confirmed" from
                // the moment the host taps Accept, so on its own the badge called an unpaid
                // stay and a paid one the same green "Confirmed". It is the same fold the
                // chip row above the list runs, so the two always agree.
                StatusBadge(booking.status, hostBucket = booking.filterBucket)
            }
            // Who actually sent this request. It sits directly under the listing title because a
            // host with several requests on the same place has nothing else to tell them apart by.
            // Deleted accounts come back with no name, so this row always renders SOMETHING.
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 6.dp)) {
                Icon(Icons.Filled.Person, null, tint = Burgundy, modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(4.dp))
                Text(
                    booking.guestName?.takeUnless { it.isBlank() }
                        ?: stringResource(com.quickin.app.R.string.host_booking_guest_fallback),
                    color = Ink,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1
                )
            }
            if (booking.location != null) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                    Icon(Icons.Filled.LocationOn, null, tint = Muted, modifier = Modifier.size(15.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(booking.location, color = Muted, fontSize = 14.sp, maxLines = 1)
                }
            }
            // Codes are only issued at confirmation, so a pending request has none to show.
            val code = booking.reservationCode
            if (!code.isNullOrBlank()) {
                Text(
                    code,
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
                        onClick = { pendingDecision = BookingDecision.REJECT },
                        enabled = !isActing,
                        shape = RoundedCornerShape(14.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, ErrorRed),
                        colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White, contentColor = ErrorRed),
                        modifier = Modifier.weight(1f).height(46.dp)
                    ) { Text("Reject", fontWeight = FontWeight.SemiBold) }
                    Button(
                        onClick = { pendingDecision = BookingDecision.CONFIRM },
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

    val decision = pendingDecision
    if (decision != null) {
        val rejecting = decision == BookingDecision.REJECT
        AlertDialog(
            onDismissRequest = { pendingDecision = null },
            title = {
                Text(
                    if (rejecting) "Reject this reservation?" else "Confirm this reservation?",
                    fontWeight = FontWeight.Bold,
                    color = Ink
                )
            },
            text = {
                Text(
                    if (rejecting) {
                        "The guest will be told their request was declined. This can\u2019t be undone."
                    } else {
                        "The guest will be notified, the dates will be held for them, and you can " +
                            "no longer reject this request."
                    },
                    color = Ink,
                    fontSize = 14.sp
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    pendingDecision = null
                    if (rejecting) onReject() else onConfirm()
                }) {
                    Text(
                        if (rejecting) "Reject" else "Confirm",
                        color = if (rejecting) ErrorRed else Burgundy,
                        fontWeight = FontWeight.Bold
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingDecision = null }) {
                    Text("Cancel", color = Ink)
                }
            },
            containerColor = Color.White
        )
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
        onLoad()
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

// The wizard's field sets + step bodies are `internal` (not private) so the host's listing EDITOR
// (ui/EditListingScreen.kt) renders the very same fields and validation rather than a second copy.

/** The six property types offered in Step 1. */
internal val PROPERTY_TYPES = listOf("Apartment", "Villa", "House", "Chalet", "Cabin", "Guest House")

/** Curated browse areas (Step 2). The host picks one before pinning the precise location. */
internal val REGIONS = listOf("North Coast", "Ain Sokhna", "El Gouna", "Cairo")

/** The amenity labels a host can toggle in Step 3 (sent to the backend as `amenities`). */
internal val AMENITY_OPTIONS = listOf(
    "WiFi", "Pool", "Kitchen", "Air conditioning", "Free parking", "Washer", "TV",
    "Heating", "Workspace", "Gym", "Beach access", "Pets allowed", "Hot tub", "BBQ grill", "Breakfast"
)

private const val TOTAL_STEPS = 4

/** Max device photos a host can attach to a listing (the first is the cover). */
internal const val MAX_LISTING_PHOTOS = 10

/** Enough letters to be a description. Same floor as the web's
 *  `listing-completeness-policy.ts`, which is where this rule is written down. */
internal const val MIN_DESCRIPTION_LETTERS = 20

/** Enough letters to be a place name. `12` is a door number, not an address. */
internal const val MIN_LOCATION_LETTERS = 3

/** Letters in any script — `@@@@@@` and `12345` are not a description however
 *  long they are, which is why the floors above count letters, not characters. */
internal fun letterCount(text: String): Int = text.count { it.isLetter() }

@Composable
private fun AddListingTab(
    state: CreateListingUiState,
    onCreate: (
        title: String, description: String, location: String, country: String,
        pricePerNight: String, maxGuests: String, bedrooms: String, beds: String,
        bathrooms: String, propertyType: String, photos: List<String>,
        amenities: List<String>, lat: Double?, lng: Double?, region: String?,
        resort: ResortChoice.Selection,
        cancellationPolicy: String, ownershipDoc: String?,
        weeklyDiscount: String, monthlyDiscount: String,
        weekendPrice: String, weekendDays: List<Int>, monthlyPrices: Map<String, Double>
    ) -> Unit,
    onReset: () -> Unit,
    // ---- AI listing-description writer (Section 10) ----
    aiWriter: AiWriterUiState = AiWriterUiState(),
    onGenerateDescription: (
        title: String, location: String, region: String, propertyType: String,
        bedrooms: Int, maxGuests: Int, amenities: List<String>, notes: String
    ) -> Unit = { _, _, _, _, _, _, _, _ -> },
    onConsumeGeneratedDescription: () -> Unit = {},
    onClearAiWriter: () -> Unit = {},
    /** The resort / compound catalog for the area the host has picked, and the request to load it.
     *  Optional everywhere: an empty catalog leaves the picker offering the free-text path. */
    resortCatalog: ResortCatalogUiState = ResortCatalogUiState(),
    onLoadResorts: (String?) -> Unit = {},
    /** Platform commission — drives the "guests will see EGP X" hint under the price fields. */
    commission: Commission? = null,
    /** Whether this host may list at all. Defaults to allowed so a failed fetch never
     *  locks a legitimate host out — the server refuses the write regardless. */
    listingGate: ListingGate = ListingGate.UNKNOWN
) {
    // The draft lives in an activity-scoped view-model, NOT in this composable — the host tab bar
    // and the app's bottom bar both REMOVE the wizard from composition when you leave, which used
    // to take every typed field with it. See [FormDraftsViewModel].
    val draft = viewModel<FormDraftsViewModel>().listing

    // Refuse up front rather than after a wizard's worth of typing.
    if (!listingGate.allowed) {
        ListingGateBlocked(listingGate)
        return
    }
    // A created listing replaces the wizard with a success card.
    if (state.created != null) {
        // The listing is saved, so the draft has done its job: wipe it, or "Add another listing"
        // would open the wizard on the one we just published.
        LaunchedEffect(state.created.id) { draft.clear() }
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

    // ---- Wizard state ----
    // Every typed field is delegated to the retained [ListingDraft] above rather than to a
    // `remember`, so it survives the wizard leaving composition (tab switch, back out, rotation)
    // and not just a step change. Reads and writes below are unchanged — these are the same
    // Compose state objects, only owned by something that outlives the screen.
    var step by draft.step // 0..3

    var title by draft.title
    var description by draft.description
    var location by draft.location
    var country by draft.country
    var price by draft.price
    // Length-of-stay discounts (% off), default "0" (none). Sent on create.
    var weeklyDiscount by draft.weeklyDiscount
    var monthlyDiscount by draft.monthlyDiscount
    // Seasonal pricing (optional). Weekend nightly rate (blank = none) + per-month nightly
    // overrides keyed by month "1".."12" (blank/absent months are dropped on create).
    var weekendPrice by draft.weekendPrice
    // Which weekdays the weekend rate is charged on (0=Sun … 6=Sat). Pre-filled with the default
    // weekend, so a host who never opens the picker gets exactly what the screen promised them.
    val weekendDays = draft.weekendDays
    val monthlyPrices = draft.monthlyPrices
    var maxGuests by draft.maxGuests
    var bedrooms by draft.bedrooms
    var beds by draft.beds
    var bathrooms by draft.bathrooms
    var propertyType by draft.propertyType
    // Listing photos picked from the device, encoded as data:image/jpeg data URLs (in pick order).
    // The first is the cover. At least one is required — step 3 blocks Next on an empty set.
    val photos = draft.photos
    // In-flight work, not typed input: a spinner is meaningless once the screen is gone, so these
    // two stay with the composable rather than joining the draft.
    var encodingPhotos by remember { mutableStateOf(false) }
    // Selected amenity labels (Step 3 chips). Order-preserving set of AMENITY_OPTIONS.
    val selectedAmenities = draft.selectedAmenities
    // Host-set cancellation policy (Step 3). Defaults to "moderate".
    var cancellationPolicy by draft.cancellationPolicy
    // Ownership/proof document as an image or PDF data URL (Step 3). Null until the host picks one.
    // Sending it queues the new listing for staff review (created pending + unpublished).
    var ownershipDoc by draft.ownershipDoc
    var processingDoc by remember { mutableStateOf(false) }
    // Curated browse area (Step 2 chips). Null until the host picks one (required).
    var region by draft.region
    // The resort / compound the place sits in (Step 2). NONE until the host says otherwise, which
    // is itself a complete answer — plenty of places are not in a compound. Sent as resort_id or
    // resort_name; see ResortChoice.
    var resort by draft.resort

    // The catalog belongs to the area, so it is (re)requested whenever the area changes.
    LaunchedEffect(region) { onLoadResorts(region) }
    val resortsForArea = if (resortCatalog.region == region) resortCatalog.resorts else emptyList()
    // A resort chosen under a DIFFERENT area is dropped: picking a resort is what sets the region
    // server-side, so keeping it would quietly overrule the chip the host just tapped.
    LaunchedEffect(resortsForArea, resortCatalog) {
        val chosen = resort.id
        // Only once THIS area's catalog has actually come back: a catalog still holding the
        // previous area's rows says nothing about the resort the host picked, and dropping their
        // answer while the next fetch is in flight would look like the field clearing itself.
        val loadedForThisArea = resortCatalog.loaded && resortCatalog.region == region
        if (chosen != null && loadedForThisArea && resortsForArea.none { it.id == chosen }) {
            resort = ResortChoice.Selection.NONE
        }
    }

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
    // Ownership-doc picker: a photo is downscaled + JPEG-compressed to a small data URL off the
    // main thread; a PDF is kept as it was issued. `OwnershipDocLoader` decides which, and says why
    // when it refuses one — silently dropping the pick is what left hosts staring at "Not added".
    var docProblem by remember { mutableStateOf<Int?>(null) }
    val docPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            processingDoc = true
            docProblem = null
            scope.launch {
                val result = withContext(Dispatchers.IO) { OwnershipDocLoader.load(context, uri) }
                when (result) {
                    is OwnershipDocLoader.Result.Loaded -> ownershipDoc = result.dataUrl
                    is OwnershipDocLoader.Result.Failed -> docProblem = result.problem.messageRes
                }
                processingDoc = false
            }
        }
    }
    // Listing-photo picker (multi-select): convert each picked image to a downscaled JPEG data URL
    // off the main thread (maxDim 1024), then append respecting the MAX_LISTING_PHOTOS cap.
    val photoPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(MAX_LISTING_PHOTOS)
    ) { uris ->
        if (uris.isNotEmpty()) {
            encodingPhotos = true
            scope.launch {
                val remaining = (MAX_LISTING_PHOTOS - photos.size).coerceAtLeast(0)
                val encoded = withContext(Dispatchers.IO) {
                    uris.take(remaining).mapNotNull { uri ->
                        AvatarImage.loadDownscaledJpegDataUrl(context, uri, AvatarImage.MAX_REVIEW_DIM)
                    }
                }
                photos.addAll(encoded)
                encodingPhotos = false
            }
        }
    }
    // Coordinates from the map pin-picker. Null until the host places a pin.
    var pickedLatLng by draft.pickedLatLng

    // What is wrong with the title, if anything. [ListingTitlePolicy] is the same rule the API
    // runs, so a title this step accepts is one `createListing` accepts — `12345` used to clear
    // step 1 and come back as a 400 on step 4, three steps from the field that was wrong.
    val titleProblem = ListingTitlePolicy.check(title)

    // Per-step validation of required fields; gates the Next / Publish button.
    //
    // A listing needed only a title and a price to be created — no description,
    // no address, no photo — so listings reached the database with nothing a
    // guest could read, find or look at. These gates are the same rule the web
    // enforces in `listing-completeness-policy.ts` and the API enforces in
    // `createListing`, said in the order the steps are laid out.
    //
    // Each step answers with the SENTENCE that blocks it rather than a bare Boolean, and
    // [canAdvance] is derived from that sentence being null. A greyed Next that will not say why
    // is the other half of the reported bug — the host is left guessing which of five fields the
    // app disagrees with — and deriving the gate from the reason is what stops the two from ever
    // drifting apart. Each returns the FIRST unmet requirement, in the order the fields are laid
    // out on the step, so a host who skipped several is pointed at the topmost one rather than at
    // whichever the code looked at first (the web form orders its own checks the same way).
    // The two seasonal rules, read before the `when` so their messages can be built with
    // `stringResource` (which is @Composable and so cannot live inside a `let`).
    val weekendRateProblem = ListingPricingRules.problemWith(weekendPrice)
    val badMonthRate: MonthPriceException? = ListingPricingRules.failingMonth(monthlyPrices)
    val blocker: String? = when (step) {
        // The title is the exception: when the host has typed something that is not a title,
        // StepBasics says so under the field itself, where the offending text is. Repeating it
        // here would print the same sentence twice on one screen. An EMPTY title has nothing to
        // sit under, so it is reported here like every other missing field.
        0 -> when {
            titleProblem == ListingTitlePolicy.Problem.REQUIRED ->
                listingTitleProblemMessage(titleProblem)
            titleProblem != null -> stringResource(com.quickin.app.R.string.listing_blocked_title)
            letterCount(description) < MIN_DESCRIPTION_LETTERS -> stringResource(
                com.quickin.app.R.string.listing_blocked_description, MIN_DESCRIPTION_LETTERS
            )
            else -> null
        }
        1 -> when {
            region == null -> stringResource(com.quickin.app.R.string.listing_edit_needs_region)
            // The resort itself is optional — "not in a compound" is a real answer. The one
            // combination refused is "Other" with no usable name, which the server cannot tell
            // apart from "no resort at all" and would therefore store as none. See ResortChoice.
            resortNameProblem(resort) != null -> resortNameProblemMessage(resortNameProblem(resort)!!)
            letterCount(location) < MIN_LOCATION_LETTERS -> stringResource(
                com.quickin.app.R.string.listing_blocked_location, MIN_LOCATION_LETTERS
            )
            pickedLatLng == null -> stringResource(com.quickin.app.R.string.listing_edit_needs_pin)
            else -> null
        }
        // Price, photos and the four capacity counts all live on StepDetails; step 3 is the
        // read-only review, where there is no picker or stepper to satisfy a rule with.
        // The capacity floor is the same one the API refuses a create on — see
        // ListingCapacityPolicy — so this gate only says early what the server would say late.
        2 -> when {
            capacityBlockerRes(maxGuests, bedrooms, beds, bathrooms, propertyType) != null ->
                stringResource(
                    capacityBlockerRes(maxGuests, bedrooms, beds, bathrooms, propertyType)!!,
                    *capacityBlockerArgs(maxGuests, bedrooms, beds, bathrooms, propertyType)
                )
            // `isNotBlank()` was the old gate, which let "0" through to a 400 — and the sentence
            // shown here says "more than 0", so the check has to mean it. Same test the editor
            // and the API already run.
            (price.toDoubleOrNull() ?: 0.0) <= 0.0 ->
                stringResource(com.quickin.app.R.string.listing_edit_needs_price)
            // The optional seasonal rates on this same step. Optional means a BLANK field, not a
            // zero: a typed `0` was parsed away to null on the way out and stored as no rate at
            // all, so the wizard finished and the weekend pricing the host entered was gone.
            weekendRateProblem != null -> stringResource(weekendPriceProblemRes(weekendRateProblem))
            badMonthRate != null -> stringResource(
                monthPriceProblemRes(badMonthRate.problem), stringResource(monthNameRes(badMonthRate.month))
            )
            photos.isEmpty() -> stringResource(com.quickin.app.R.string.listing_edit_needs_photo)
            else -> null
        }
        else -> null
    }
    val canAdvance = blocker == null

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
                // Step 4 is the read-only review — nothing there to mark, so nothing to explain.
                if (current < TOTAL_STEPS - 1) RequiredFieldsLegend()

                when (current) {
                    0 -> StepBasics(
                        title = title, onTitle = { title = it },
                        propertyType = propertyType, onPropertyType = { propertyType = it },
                        description = description, onDescription = { description = it },
                        titleProblem = titleProblem,
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
                        resort = resort, onResort = { resort = it },
                        resorts = resortsForArea,
                        resortsLoading = resortCatalog.isLoading,
                        location = location, onLocation = { location = it },
                        country = country, onCountry = { country = it },
                        picked = pickedLatLng, onPick = { pickedLatLng = it }
                    )
                    2 -> StepDetails(
                        propertyType = propertyType,
                        maxGuests = maxGuests, onMaxGuests = { maxGuests = it },
                        bedrooms = bedrooms, onBedrooms = { bedrooms = it },
                        beds = beds, onBeds = { beds = it },
                        bathrooms = bathrooms, onBathrooms = { bathrooms = it },
                        price = price, onPrice = { price = it },
                        weeklyDiscount = weeklyDiscount, onWeeklyDiscount = { weeklyDiscount = it },
                        monthlyDiscount = monthlyDiscount, onMonthlyDiscount = { monthlyDiscount = it },
                        weekendPrice = weekendPrice, onWeekendPrice = { weekendPrice = it },
                        weekendDays = weekendDays.toSet(),
                        onToggleWeekendDay = { day ->
                            // The seventh day is refused, not silently added: a weekend that covers
                            // the whole week leaves the nightly price applying to no night at all.
                            if (weekendDays.contains(day)) weekendDays.remove(day)
                            else if (weekendDays.size < WeekendSchedule.DAYS_IN_WEEK - 1) weekendDays.add(day)
                        },
                        monthlyPrices = monthlyPrices,
                        onMonthlyPrice = { month, value ->
                            if (value.isBlank()) monthlyPrices.remove(key = month) else monthlyPrices[month] = value
                        },
                        photos = photos,
                        encodingPhotos = encodingPhotos,
                        onAddPhotos = {
                            photoPicker.launch(
                                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                            )
                        },
                        onRemovePhoto = { index -> if (index in photos.indices) photos.removeAt(index) },
                        selectedAmenities = selectedAmenities,
                        onToggleAmenity = { amenity ->
                            if (selectedAmenities.contains(amenity)) selectedAmenities.remove(amenity)
                            else selectedAmenities.add(amenity)
                        },
                        cancellationPolicy = cancellationPolicy,
                        onCancellationPolicy = { cancellationPolicy = it },
                        ownershipDoc = ownershipDoc,
                        processingDoc = processingDoc,
                        onPickDoc = { docPicker.launch(OwnershipDocLoader.PICKER_MIME_TYPES) },
                        docProblem = docProblem,
                        commission = commission
                    )
                    else -> StepReview(
                        title = title, propertyType = propertyType, region = region,
                        resort = resortDisplayName(resort, resortsForArea),
                        location = location,
                        country = country, price = price, maxGuests = maxGuests,
                        bedrooms = bedrooms, beds = beds, bathrooms = bathrooms,
                        amenities = selectedAmenities, picked = pickedLatLng,
                        cancellationPolicy = cancellationPolicy,
                        ownershipDocAttached = ownershipDoc != null,
                        weeklyDiscount = weeklyDiscount, monthlyDiscount = monthlyDiscount,
                        weekendPrice = weekendPrice,
                        monthlyPricesCount = monthlyPricesAsDoubles(monthlyPrices).size
                    )
                }

                if (state.error != null) {
                    Text(state.error, color = ErrorRed, fontSize = 13.sp)
                }
            }
        }

        // ---- Sticky Back / Next-or-Publish bar ----
        Surface(color = Cream, shadowElevation = 8.dp) {
            Column(modifier = Modifier.fillMaxWidth()) {
                // Why Next is greyed, on screen without scrolling. It is the same value the
                // button gates on, so the two cannot disagree — see [blocker].
                StepBlockerNote(blocker)
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
                                maxGuests, bedrooms, beds, bathrooms, propertyType, photos.toList(),
                                selectedAmenities.toList(),
                                pickedLatLng?.latitude, pickedLatLng?.longitude, region, resort,
                                cancellationPolicy, ownershipDoc,
                                weeklyDiscount, monthlyDiscount,
                                weekendPrice, WeekendSchedule.normalize(weekendDays),
                                monthlyPricesAsDoubles(monthlyPrices)
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
}

/**
 * One line above the Next button naming the first thing the current step is still waiting for, or
 * nothing at all once the step is satisfied.
 *
 * The wizard used to dim Next and say nothing, so a host whose title was `12345` — or whose
 * description was nineteen letters — had a greyed button and no way to learn which field it was
 * unhappy about. Both host wizards render this, and the sentence is the same value their gate is
 * derived from, so the button and the explanation cannot disagree.
 */
@Composable
internal fun StepBlockerNote(message: String?) {
    if (message == null) return
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 20.dp, end = 20.dp, top = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.Top
    ) {
        Icon(
            Icons.Filled.Info,
            contentDescription = null,
            tint = Burgundy,
            modifier = Modifier.size(16.dp).padding(top = 2.dp)
        )
        Text(message, color = Ink, fontSize = 13.sp, lineHeight = 18.sp)
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

/**
 * The sentence a host reads for a title [ListingTitlePolicy] refused — the same four the website
 * shows, in the same four languages. One place, so the add wizard and the editor cannot word the
 * same refusal differently, and the floors come from the policy rather than being retyped here.
 */
@Composable
internal fun listingTitleProblemMessage(problem: ListingTitlePolicy.Problem): String = when (problem) {
    ListingTitlePolicy.Problem.REQUIRED ->
        stringResource(com.quickin.app.R.string.listing_title_required)
    ListingTitlePolicy.Problem.LETTERS ->
        stringResource(com.quickin.app.R.string.listing_title_letters)
    ListingTitlePolicy.Problem.TOO_SHORT ->
        stringResource(com.quickin.app.R.string.listing_title_too_short, ListingTitlePolicy.MIN_LETTERS)
    ListingTitlePolicy.Problem.TOO_LONG ->
        stringResource(com.quickin.app.R.string.listing_title_too_long, ListingTitlePolicy.MAX_LENGTH)
}

@Composable
internal fun StepBasics(
    title: String, onTitle: (String) -> Unit,
    propertyType: String, onPropertyType: (String) -> Unit,
    description: String, onDescription: (String) -> Unit,
    aiWriter: AiWriterUiState = AiWriterUiState(),
    onGenerate: () -> Unit = {},
    /** What is wrong with the title, decided by the caller via [ListingTitlePolicy]. */
    titleProblem: ListingTitlePolicy.Problem? = null
) {
    // All three carry a mark, and every mark is honest: [canAdvance] gates this
    // step on the title AND on a description of [MIN_DESCRIPTION_LETTERS], and
    // the API's `checkListingCompleteness` refuses a listing with no property
    // type. Only the title used to be spoken for — the hint literally read
    // "Title is required" while the description silently held Next grey, which
    // is the same rule-enforced-but-never-stated bug the web already fixed.
    HostField(
        title, onTitle,
        stringResource(com.quickin.app.R.string.add_title),
        required = true
    )
    // Said here, under the offending text, rather than three steps later in the API's reply.
    // REQUIRED is deliberately excluded: an empty field has nothing to correct yet, and the
    // step's blocker note above Next already asks for a title.
    if (titleProblem != null && titleProblem != ListingTitlePolicy.Problem.REQUIRED) {
        Text(
            listingTitleProblemMessage(titleProblem),
            color = ErrorRed,
            fontSize = 13.sp,
            lineHeight = 18.sp
        )
    }
    PropertyTypeDropdown(selected = propertyType, onSelected = onPropertyType)
    HostField(
        description, onDescription,
        stringResource(com.quickin.app.R.string.add_description),
        singleLine = false,
        required = true
    )

    // An asterisk says a field is required; it cannot say that nineteen letters
    // still are not a description. Naming the floor is what keeps a host from
    // staring at a Next they have no way to un-grey.
    Text(
        stringResource(com.quickin.app.R.string.add_basics_hint, MIN_DESCRIPTION_LETTERS),
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
            label = {
                RequiredLabel(
                    stringResource(com.quickin.app.R.string.add_property_type),
                    required = true
                )
            },
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
internal fun StepLocation(
    region: String?, onRegion: (String) -> Unit,
    /** The host's resort / compound answer, and the catalog to choose from. Optional by design —
     *  "not in a resort" is a real answer, and an empty catalog still leaves "Other". */
    resort: ResortChoice.Selection = ResortChoice.Selection.NONE,
    onResort: (ResortChoice.Selection) -> Unit = {},
    resorts: List<ResortOption> = emptyList(),
    resortsLoading: Boolean = false,
    location: String, onLocation: (String) -> Unit,
    country: String, onCountry: (String) -> Unit,
    picked: LatLng?, onPick: (LatLng) -> Unit
) {
    // Region chips — the host picks the area first, then the precise pin below. Required, and
    // now marked as such: the chips carry no field label, so the heading is what wears the mark.
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Filled.Place, null, tint = Burgundy, modifier = Modifier.height(18.dp))
        Spacer(Modifier.width(6.dp))
        RequiredSectionLabel("Choose an area", fontSize = 14.sp)
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
    // No "(required)" line under the chips any more: the heading above them carries the mark and
    // the note above Next says the same sentence, so a host who had skipped the area was reading
    // one rule stated three times on one screen.
    Spacer(Modifier.height(4.dp))

    // The compound, directly under the area it belongs to. The web listing form has asked this
    // since the catalog shipped and both apps never did, so every listing created on a phone
    // reached the database with no resort at all — invisible to the resort filters, and findable
    // only by whatever the host happened to write on the address line.
    //
    // The options are narrowed to the chosen area, because picking a resort also SETS the region
    // server-side and the two must not be able to disagree. Not marked required: a standalone flat
    // is not in a compound, and the only answer ever refused is "Other" with no name.
    ResortDropdown(
        selection = resort,
        onSelection = onResort,
        resorts = resorts,
        loading = resortsLoading
    )
    if (resort.isOther) {
        HostField(
            resort.name.orEmpty(),
            { onResort(ResortChoice.Selection.other(it)) },
            "Type the resort or compound name"
        )
        // Said under the box the offending text is in — but not while it is still empty, which the
        // blocker note above Next already asks for.
        ResortChoice.check(resort.name)
            ?.takeIf { it != ResortChoice.Problem.REQUIRED }
            ?.let { Text(resortNameProblemMessage(it), color = ErrorRed, fontSize = 13.sp) }
    }
    Text(
        if (resort.isOther) {
            "We'll show what you type to guests, and our team will add it to the list."
        } else {
            "Pick the compound your place is in. Choosing one also sets the area."
        },
        color = Muted,
        fontSize = 13.sp
    )
    Spacer(Modifier.height(4.dp))

    LocationPicker(
        location = location,
        onLocation = onLocation,
        picked = picked,
        onPick = onPick
    )
    // Searchable, Egypt-first country picker (parity with web's country dropdown and the
    // iOS CountryPickerField) instead of a free-text field.
    CountrySelector(value = country, onSelect = onCountry, label = "Country")

    // The pin and the words around it used to be independent: a host could pick Egypt →
    // North Coast and drop the pin in Germany, and it saved silently. This says so — and
    // deliberately does not gate the step, because a bounding box must never be the reason a
    // real property can't be listed. An ignored warning is badged for the operator who
    // approves the listing in /ops. See ListingGeoPolicy.kt.
    ListingGeoPolicy.check(picked?.latitude, picked?.longitude, country, region)?.let { problem ->
        Row(
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier
                .fillMaxWidth()
                .background(Burgundy.copy(alpha = 0.08f), RoundedCornerShape(12.dp))
                .padding(12.dp)
        ) {
            Icon(Icons.Filled.Warning, null, tint = Burgundy, modifier = Modifier.size(18.dp))
            Text(problem.message, color = Burgundy, fontSize = 13.sp)
        }
    }
}

/**
 * The resort / compound picker: "not in one", the catalog for the chosen area, and the free-text
 * escape hatch. The same three-part shape as the web `<select>`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ResortDropdown(
    selection: ResortChoice.Selection,
    onSelection: (ResortChoice.Selection) -> Unit,
    resorts: List<ResortOption>,
    loading: Boolean
) {
    var expanded by remember { mutableStateOf(false) }
    // A catalog id whose row isn't in the list — an area switched under a chosen resort — reads as
    // the neutral wording rather than leaving the field blank.
    val label = when {
        selection.isOther -> RESORT_OTHER_LABEL
        selection.id != null -> resorts.firstOrNull { it.id == selection.id }?.name ?: "Selected resort"
        else -> RESORT_NONE_LABEL
    }
    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it },
        modifier = Modifier.fillMaxWidth()
    ) {
        OutlinedTextField(
            value = label,
            onValueChange = {},
            readOnly = true,
            label = { Text("Resort / compound") },
            trailingIcon = {
                if (loading) {
                    CircularProgressIndicator(
                        color = Burgundy, strokeWidth = 2.dp, modifier = Modifier.size(18.dp)
                    )
                } else {
                    Icon(Icons.Filled.ArrowDropDown, null, tint = Burgundy)
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
            modifier = Modifier
                .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                .fillMaxWidth()
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(
                text = { Text(RESORT_NONE_LABEL, color = Ink) },
                onClick = {
                    onSelection(ResortChoice.Selection.NONE)
                    expanded = false
                }
            )
            resorts.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option.name, color = Ink) },
                    onClick = {
                        onSelection(ResortChoice.Selection.catalog(option.id))
                        expanded = false
                    }
                )
            }
            DropdownMenuItem(
                text = { Text(RESORT_OTHER_LABEL, color = Ink) },
                onClick = {
                    // Keeps whatever was already typed, so re-opening the menu doesn't erase it.
                    onSelection(ResortChoice.Selection.other(selection.name.orEmpty()))
                    expanded = false
                }
            )
        }
    }
}

internal const val RESORT_NONE_LABEL = "Not in a resort or compound"
internal const val RESORT_OTHER_LABEL = "Other — not listed"

/** What is wrong with the resort answer, or null when nothing is. Only "Other" is ever refused. */
internal fun resortNameProblem(selection: ResortChoice.Selection): ResortChoice.Problem? =
    if (selection.isOther) ResortChoice.check(selection.name) else null

/** The localized sentence for a refused resort name — the same split as
 *  [listingTitleProblemMessage]: the rule decides, the UI words it. */
@Composable
internal fun resortNameProblemMessage(problem: ResortChoice.Problem): String = when (problem) {
    ResortChoice.Problem.REQUIRED ->
        stringResource(com.quickin.app.R.string.listing_resort_name_required)
    ResortChoice.Problem.LETTERS ->
        stringResource(com.quickin.app.R.string.listing_resort_name_letters)
    ResortChoice.Problem.TOO_SHORT ->
        stringResource(com.quickin.app.R.string.listing_resort_name_too_short, ResortChoice.MIN_NAME_LETTERS)
}

/** What the review step shows for the resort: the catalog name, the host's own text, or null when
 *  the place isn't in one (the row is then skipped rather than showing an em dash). */
internal fun resortDisplayName(
    selection: ResortChoice.Selection,
    resorts: List<ResortOption>
): String? = when {
    selection.isOther -> ResortChoice.normalizeName(selection.name)
    selection.id != null -> resorts.firstOrNull { it.id == selection.id }?.name
    else -> null
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

/**
 * Why a host can't add a listing yet, and what to do about it.
 *
 * Shown instead of the wizard rather than beside it: letting someone fill in a listing
 * they cannot submit wastes their time and turns a known rule into a 403 at the end.
 * The wording is the server's, shared with the website and iOS; only the layout is local.
 */
@Composable
internal fun ListingGateBlocked(gate: ListingGate) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(gate.title, fontSize = 19.sp, fontWeight = FontWeight.Bold, color = Ink)
        Text(gate.message, fontSize = 14.sp, color = Muted, textAlign = TextAlign.Center)
        if (gate.code == "verification_rejected" && !gate.reason.isNullOrBlank()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(CreamPage, RoundedCornerShape(14.dp))
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text("Reason given by our team", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Ink)
                Text(gate.reason, fontSize = 13.sp, color = Muted)
            }
        }
        Text(
            "Your existing listings are not affected by this.",
            fontSize = 12.sp,
            color = Muted,
            textAlign = TextAlign.Center
        )
    }
}

/**
 * "Guests will see EGP X" — shown under every price field in the host forms.
 *
 * Hosts type the amount they want to RECEIVE. Guests are quoted that amount plus the platform
 * commission, so without this a host has no idea what their listing actually costs to book.
 * Renders nothing until there is a real price: an empty field isn't an error, and
 * "Guests will see EGP 0" is worse than silence.
 */
@Composable
internal fun GuestPriceHint(priceText: String, commission: Commission?) {
    val guest = commission?.guestPrice(priceText.trim().toDoubleOrNull() ?: 0.0) ?: return
    Text(
        buildAnnotatedString {
            withStyle(SpanStyle(color = Muted)) { append("Guests will see ") }
            withStyle(SpanStyle(color = Burgundy, fontWeight = FontWeight.SemiBold)) {
                append("EGP ${guest.toInt()}")
            }
            if (commission.rate > 0.0) {
                withStyle(SpanStyle(color = Muted)) {
                    append(" · includes QuickIn's ${commission.percentText}% commission — you receive the price you entered")
                }
            }
        },
        fontSize = 12.5.sp,
        lineHeight = 17.sp,
        modifier = Modifier.padding(top = 2.dp)
    )
}

// ---- Step 3: Details --------------------------------------------------------

/**
 * Which sentence explains why the capacity counts are not acceptable, or null when they are.
 *
 * Shared by the add-listing wizard and the listing editor so the two cannot drift, and returning
 * a string resource id rather than a string so both can call it outside a @Composable.
 *
 * Three distinct things can be wrong and they need different sentences: a count below the floor
 * (the pre-existing rule), a bedroom count above what this property type allows (the per-type
 * table), and — reachable only from a value some other client stored, since the steppers clamp —
 * one of the other three counts above its blanket ceiling. The caller supplies the format
 * arguments, which differ per sentence; [capacityBlockerArgs] is the matching list.
 */
internal fun capacityBlockerRes(
    maxGuests: String?, bedrooms: String?, beds: String?, bathrooms: String?, propertyType: String?
): Int? = when {
    ListingCapacityPolicy.isBelowFloor(maxGuests, bedrooms, beds, bathrooms) ->
        com.quickin.app.R.string.listing_capacity_floor
    ListingCapacityPolicy.exceedsBedroomCeiling(bedrooms, propertyType) ->
        when {
            // A type product's table does not name is refused impersonally — naming it would
            // state a per-type rule that does not exist.
            ListingCapacityPolicy.namedType(propertyType) == null ->
                com.quickin.app.R.string.listing_capacity_bedrooms_max_any
            // A studio's ceiling equals the floor, so "at most 1" is true but reads like room to
            // manoeuvre. Say the shape of the place instead.
            ListingCapacityPolicy.maxBedrooms(propertyType) == ListingCapacityPolicy.MINIMUM ->
                com.quickin.app.R.string.listing_capacity_bedrooms_exact
            else -> com.quickin.app.R.string.listing_capacity_bedrooms_max
        }
    ListingCapacityPolicy.exceedsOtherCeiling(maxGuests, beds, bathrooms) ->
        com.quickin.app.R.string.listing_capacity_other_max
    else -> null
}

/** The format arguments [capacityBlockerRes]'s sentence expects, in order. */
internal fun capacityBlockerArgs(
    maxGuests: String?, bedrooms: String?, beds: String?, bathrooms: String?, propertyType: String?
): Array<Any> = when (capacityBlockerRes(maxGuests, bedrooms, beds, bathrooms, propertyType)) {
    com.quickin.app.R.string.listing_capacity_floor -> arrayOf(ListingCapacityPolicy.MINIMUM)
    com.quickin.app.R.string.listing_capacity_bedrooms_max_any ->
        arrayOf(ListingCapacityPolicy.maxBedrooms(propertyType))
    com.quickin.app.R.string.listing_capacity_bedrooms_max,
    com.quickin.app.R.string.listing_capacity_bedrooms_exact -> arrayOf(
        ListingCapacityPolicy.namedType(propertyType) ?: "",
        ListingCapacityPolicy.maxBedrooms(propertyType)
    )
    com.quickin.app.R.string.listing_capacity_other_max -> arrayOf(
        ListingCapacityPolicy.MAX_GUESTS_CEILING,
        ListingCapacityPolicy.BEDS_CEILING,
        ListingCapacityPolicy.BATHROOMS_CEILING
    )
    else -> emptyArray()
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun StepDetails(
    /**
     * The type picked back on step 1. Read-only here — it sizes the bedroom stepper and names the
     * type in the sentence under the steppers.
     */
    propertyType: String,
    maxGuests: String, onMaxGuests: (String) -> Unit,
    bedrooms: String, onBedrooms: (String) -> Unit,
    beds: String, onBeds: (String) -> Unit,
    bathrooms: String, onBathrooms: (String) -> Unit,
    price: String, onPrice: (String) -> Unit,
    weeklyDiscount: String, onWeeklyDiscount: (String) -> Unit,
    monthlyDiscount: String, onMonthlyDiscount: (String) -> Unit,
    weekendPrice: String, onWeekendPrice: (String) -> Unit,
    weekendDays: Set<Int>, onToggleWeekendDay: (Int) -> Unit,
    monthlyPrices: Map<String, String>, onMonthlyPrice: (month: String, value: String) -> Unit,
    photos: List<String>, encodingPhotos: Boolean,
    onAddPhotos: () -> Unit, onRemovePhoto: (Int) -> Unit,
    selectedAmenities: List<String>, onToggleAmenity: (String) -> Unit,
    cancellationPolicy: String, onCancellationPolicy: (String) -> Unit,
    ownershipDoc: String?, processingDoc: Boolean, onPickDoc: () -> Unit,
    /**
     * String resource naming why the last picked document was refused (too large, not a shape we
     * store), or null. Shown under the button — a refused pick used to leave the field reading
     * "Not added" with nothing said.
     */
    docProblem: Int? = null,
    /**
     * Reorders the photo at [from] to [to]. Null (the add-listing wizard) hides the reorder
     * controls — a brand-new listing's photos are already in pick order.
     */
    onMovePhoto: ((from: Int, to: Int) -> Unit)? = null,
    /** Promotes the photo at the given index to the cover (position 0). Null hides the control. */
    onSetCoverPhoto: ((Int) -> Unit)? = null,
    /**
     * Amenity chips to offer. Defaults to the curated set; the listing editor passes that set plus
     * anything the listing already has, so an existing amenity can never be silently dropped.
     */
    amenityOptions: List<String> = AMENITY_OPTIONS,
    /** Drives the "guests will see EGP X" hints. Null until the rate loads. */
    commission: Commission? = null
) {
    // +/- steppers for the counts. Each shows the current value as a Text between the buttons.
    // All four floor at 1: bedrooms, beds and bathrooms used to floor at 0, so "0 bedrooms ·
    // 0 beds · 0 baths" was a publishable listing — see [ListingCapacityPolicy].
    //
    // The four are marked as one group, the way iOS marks them: the floor applies to all of
    // them together, and four asterisks down a column of steppers reads as decoration rather
    // than as a rule. A stepper is never empty, so the mark matters most in the editor, where
    // a listing saved before the floor existed opens holding a 0 and cannot be saved back.
    RequiredSectionLabel("Capacity")
    CounterStepper(
        label = "Max guests",
        value = maxGuests,
        min = ListingCapacityPolicy.MINIMUM,
        max = ListingCapacityPolicy.MAX_GUESTS_CEILING,
        onChange = onMaxGuests
    )
    CounterStepper(
        label = "Bedrooms",
        value = bedrooms,
        min = ListingCapacityPolicy.MINIMUM,
        // A Cabin stops at 3, a Villa at 8 — the control itself refuses what the rule refuses,
        // rather than running to 20 and failing on Next.
        max = ListingCapacityPolicy.maxBedrooms(propertyType),
        onChange = onBedrooms
    )
    CounterStepper(
        label = "Beds",
        value = beds,
        min = ListingCapacityPolicy.MINIMUM,
        max = ListingCapacityPolicy.BEDS_CEILING,
        onChange = onBeds
    )
    CounterStepper(
        label = "Bathrooms",
        value = bathrooms,
        min = ListingCapacityPolicy.MINIMUM,
        max = ListingCapacityPolicy.BATHROOMS_CEILING,
        onChange = onBathrooms
    )
    // The stepper clamps new taps but cannot lower a value it was handed, so two things reach
    // here: a row created before this rule (a stored 0, or a Studio holding 27,373 bedrooms), and
    // a host who set 6 bedrooms as a Villa and then walked back to step 1 and chose Cabin. Say
    // what has to change rather than leaving Next / Save greyed out with no reason.
    val capacityProblem = capacityBlockerRes(maxGuests, bedrooms, beds, bathrooms, propertyType)
    if (capacityProblem != null) {
        Text(
            stringResource(
                capacityProblem,
                *capacityBlockerArgs(maxGuests, bedrooms, beds, bathrooms, propertyType)
            ),
            color = Burgundy,
            fontSize = 13.sp
        )
    }
    // The one field on this step the wizard has always refused to advance past, and until now
    // the only thing saying so was a stray sentence at the very bottom of the step — five
    // controls below the field it was about. The mark says it on the field itself.
    HostField(
        price,
        { onPrice(it.filterNumeric(decimal = true)) },
        "Price / night (EGP)",
        keyboardType = KeyboardType.Number,
        required = true
    )
    GuestPriceHint(price, commission)

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

    // Seasonal pricing (optional) — a weekend nightly rate + a compact 12-month list of optional
    // nightly prices. The authoritative quote endpoint honors these for the guest's chosen dates.
    SeasonalPricingFields(
        weekendPrice = weekendPrice,
        onWeekendPrice = onWeekendPrice,
        weekendDays = weekendDays,
        onToggleWeekendDay = onToggleWeekendDay,
        monthlyPrices = monthlyPrices,
        onMonthlyPrice = onMonthlyPrice
    )
    GuestPriceHint(weekendPrice, commission)

    // Listing photos — a device multi-photo picker (the first photo is the cover). Required.
    ListingPhotoPicker(
        photos = photos,
        encoding = encodingPhotos,
        enabled = photos.size < MAX_LISTING_PHOTOS,
        onAdd = onAddPhotos,
        onRemove = onRemovePhoto,
        onMove = onMovePhoto,
        onSetCover = onSetCoverPhoto
    )

    // Amenities multi-select — tap chips to toggle. Sent to the backend as `amenities`.
    Text("Amenities", fontWeight = FontWeight.SemiBold, color = Ink, fontSize = 15.sp, modifier = Modifier.padding(top = 4.dp))
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        amenityOptions.forEach { amenity ->
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
    if (ownershipDoc != null && OwnershipDocRules.isPdfDataUrl(ownershipDoc)) {
        // A PDF has no thumbnail to show without a renderer, so the line just names the format —
        // the host already knows which file they picked, and it is only ever read in /ops.
        Text(
            stringResource(com.quickin.app.R.string.approval_doc_pdf_attached),
            color = Muted,
            fontSize = 13.sp
        )
    }
    if (docProblem != null) {
        Text(stringResource(docProblem), color = ErrorRed, fontSize = 13.sp)
    }
}

/**
 * The listing photo control, shared by the add-listing wizard and the host's listing editor: an
 * "Add photos" outlined button (disabled at the [MAX_LISTING_PHOTOS] cap) plus a horizontal row of
 * staged thumbnails, each with a remove (×) chip; the first photo carries a small "Cover" badge.
 * Mirrors the review dialog's photo picker ([ReviewPhotoThumbnail] renders the `data:` URL
 * thumbnails, which Coil can't fetch directly). At least one photo is required — both the
 * wizard's step 3 and the editor's Save block on an empty set — so the heading carries the mark;
 * this doc used to say the opposite, from back when a listing could go live with no photos.
 *
 * Passing [onMove] / [onSetCover] (the editor does; the wizard doesn't) adds a per-photo control
 * row: move earlier / make cover / move later. The arrows are auto-mirrored, so "earlier" still
 * points at the start of the row in RTL.
 */
@Composable
private fun ListingPhotoPicker(
    photos: List<String>,
    encoding: Boolean,
    enabled: Boolean,
    onAdd: () -> Unit,
    onRemove: (Int) -> Unit,
    onMove: ((from: Int, to: Int) -> Unit)? = null,
    onSetCover: ((Int) -> Unit)? = null
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        RequiredSectionLabel("Photos", modifier = Modifier.padding(top = 4.dp))
        Text(
            "Add at least one photo, up to $MAX_LISTING_PHOTOS. The first one is your cover photo.",
            color = Muted,
            fontSize = 13.sp
        )
        OutlinedButton(
            onClick = onAdd,
            enabled = enabled,
            shape = RoundedCornerShape(14.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, Tan),
            colors = ButtonDefaults.outlinedButtonColors(
                containerColor = Color.White,
                contentColor = Burgundy
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
        ) {
            if (encoding) {
                CircularProgressIndicator(color = Burgundy, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
            } else {
                Icon(Icons.Filled.AddPhotoAlternate, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Add photos", fontWeight = FontWeight.SemiBold)
            }
        }

        if (photos.isNotEmpty()) {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                itemsIndexed(photos) { index, url ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box {
                            ReviewPhotoThumbnail(
                                url = url,
                                size = 84.dp,
                                modifier = Modifier.padding(top = 6.dp, end = 6.dp)
                            )
                            // "Cover" badge on the first (cover) photo.
                            if (index == 0) {
                                Surface(
                                    color = Burgundy.copy(alpha = 0.92f),
                                    shape = RoundedCornerShape(7.dp),
                                    modifier = Modifier
                                        .align(Alignment.BottomStart)
                                        .padding(start = 4.dp, bottom = 4.dp)
                                ) {
                                    Text(
                                        "Cover",
                                        color = Color.White,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                            // Remove (×) chip pinned to the top-end corner.
                            Surface(
                                color = Ink.copy(alpha = 0.72f),
                                shape = CircleShape,
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .size(24.dp)
                                    .clickable { onRemove(index) }
                            ) {
                                Icon(
                                    Icons.Filled.Close,
                                    contentDescription = "Remove photo",
                                    tint = Color.White,
                                    modifier = Modifier.padding(4.dp)
                                )
                            }
                        }
                        // Editor-only: reorder + set-cover under each thumbnail.
                        if (onMove != null || onSetCover != null) {
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(2.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(top = 2.dp, end = 6.dp)
                            ) {
                                if (onMove != null) {
                                    PhotoActionButton(
                                        icon = Icons.AutoMirrored.Filled.ArrowBack,
                                        description = stringResource(com.quickin.app.R.string.listing_edit_move_earlier),
                                        enabled = index > 0,
                                        onClick = { onMove(index, index - 1) }
                                    )
                                }
                                if (onSetCover != null) {
                                    PhotoActionButton(
                                        icon = Icons.Filled.Star,
                                        description = stringResource(com.quickin.app.R.string.listing_edit_set_cover),
                                        enabled = index > 0,
                                        onClick = { onSetCover(index) }
                                    )
                                }
                                if (onMove != null) {
                                    PhotoActionButton(
                                        icon = Icons.AutoMirrored.Filled.ArrowForward,
                                        description = stringResource(com.quickin.app.R.string.listing_edit_move_later),
                                        enabled = index < photos.lastIndex,
                                        onClick = { onMove(index, index + 1) }
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

/** One compact icon action under a photo thumbnail (move earlier / make cover / move later). */
@Composable
private fun PhotoActionButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    description: String,
    enabled: Boolean,
    onClick: () -> Unit
) {
    IconButton(onClick = onClick, enabled = enabled, modifier = Modifier.size(28.dp)) {
        Icon(
            icon,
            contentDescription = description,
            tint = if (enabled) Burgundy else Muted.copy(alpha = 0.35f),
            modifier = Modifier.size(17.dp)
        )
    }
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
 * The canonical value lives in the parent as a [String]; this composable parses it, renders the
 * current number as a [Text] between the − and + buttons, and lifts every change back via
 * [onChange]. Empty / non-numeric input is shown as [min] so the control always displays a real
 * number.
 *
 * [min] is a floor on what the buttons can PRODUCE, not on what they display: a listing saved
 * before the capacity floor existed can arrive holding a 0, and coercing that up for display
 * would show a 1 the host never chose while the state — and the save — still carried the 0.
 * A below-floor value is shown as it is, with − disabled, so + is the only way out of it.
 */
@Composable
private fun CounterStepper(
    label: String,
    value: String,
    min: Int,
    onChange: (String) -> Unit,
    max: Int = 50
) {
    val current = (value.trim().toIntOrNull() ?: min).coerceAtMost(max)
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
    title: String, propertyType: String, region: String?,
    /** The resort / compound as it will be stored — the catalog name or the host's own text. Null
     *  when the place isn't in one, and the row is then skipped rather than showing an em dash. */
    resort: String? = null,
    location: String, country: String,
    price: String, maxGuests: String, bedrooms: String, beds: String,
    bathrooms: String, amenities: List<String>, picked: LatLng?,
    cancellationPolicy: String, ownershipDocAttached: Boolean,
    weeklyDiscount: String = "0", monthlyDiscount: String = "0",
    weekendPrice: String = "", monthlyPricesCount: Int = 0
) {
    SectionHeader("Review your listing")
    BoutiqueCard(modifier = Modifier.fillMaxWidth(), shadow = 6.dp) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            ReviewRow("Title", title.ifBlank { "—" })
            ReviewRow("Type", propertyType)
            ReviewRow("Area", region ?: "—")
            if (!resort.isNullOrBlank()) ReviewRow("Resort / compound", resort)
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
            run {
                val wknd = weekendPrice.toIntOrNull() ?: 0
                ReviewRow(
                    stringResource(com.quickin.app.R.string.pricing_seasonal),
                    if (wknd > 0 || monthlyPricesCount > 0) {
                        stringResource(com.quickin.app.R.string.pricing_seasonal_note)
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

/**
 * The burgundy `*` every gating field carries, on its own so a section header, a chip group and a
 * text field can all wear the same mark.
 *
 * The mark is the whole answer to "nothing said this was required": a rule the
 * wizard enforces at Next and states nowhere is a rule the host meets as a dead
 * button. It is read out as the word "required" rather than as an asterisk —
 * `clearAndSetSemantics` used to drop the glyph from the accessibility tree
 * altogether, which spared TalkBack the noise but left a screen-reader host
 * with no way at all to learn the field was mandatory. Mirrors `Req()` in the
 * web's new-listing form and `FieldLabel(required:)` in the iOS wizard.
 */
@Composable
private fun RequiredMark() {
    val spoken = stringResource(com.quickin.app.R.string.field_required)
    Text(
        " *",
        color = Burgundy,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.clearAndSetSemantics { contentDescription = spoken }
    )
}

/** A text-field label plus [RequiredMark] when the step gates on the field. */
@Composable
private fun RequiredLabel(label: String, required: Boolean) {
    if (!required) {
        Text(label)
        return
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(label)
        RequiredMark()
    }
}

/**
 * A section heading over a control that is not a text field — the area chips, the map, the
 * capacity steppers, the photo picker — carrying the same mark those fields' labels do.
 *
 * These were the gates with nothing to hang an asterisk on, so they went unmarked while the
 * wizard blocked Next on every one of them.
 */
@Composable
private fun RequiredSectionLabel(
    text: String,
    required: Boolean = true,
    fontSize: androidx.compose.ui.unit.TextUnit = 15.sp,
    modifier: Modifier = Modifier
) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = modifier) {
        Text(text, fontWeight = FontWeight.SemiBold, color = Ink, fontSize = fontSize)
        if (required) RequiredMark()
    }
}

/**
 * The one line that says what the marks mean, at the top of every step that has fields.
 *
 * An asterisk only reads as "required" to someone who already knows the convention; naming it
 * once is the other half of the fix, and is what the web form does above its first field.
 */
@Composable
internal fun RequiredFieldsLegend() {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("*", color = Burgundy, fontWeight = FontWeight.Bold, fontSize = 13.sp)
        Spacer(Modifier.width(6.dp))
        Text(
            stringResource(com.quickin.app.R.string.listing_required_legend),
            color = Muted,
            fontSize = 12.5.sp,
            lineHeight = 17.sp
        )
    }
}

@Composable
private fun HostField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    singleLine: Boolean = true,
    keyboardType: KeyboardType = KeyboardType.Text,
    modifier: Modifier = Modifier,
    /** Draws the burgundy asterisk. Set it on every field a step gates on. */
    required: Boolean = false
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { RequiredLabel(label, required) },
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
            RequiredSectionLabel("Pin the exact location", fontSize = 14.sp)
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

        // Editable, human-readable location text (also filled by search). Marked required —
        // both wizards gate on it reaching [MIN_LOCATION_LETTERS], and the search field above
        // it (which is genuinely optional) is the one place a host could reasonably assume the
        // opposite.
        HostField(location, onLocation, "Location (e.g. Malibu, California)", required = true)
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
            // How to place the pin, not that it is needed — the heading's mark says that.
            Text(
                "Search above or tap the map to drop a pin.",
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
