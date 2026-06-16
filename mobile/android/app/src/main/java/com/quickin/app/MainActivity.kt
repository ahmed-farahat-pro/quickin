package com.quickin.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.annotation.StringRes
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.Crossfade
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.quickin.app.ui.AddListingScreen
import com.quickin.app.ui.qkSwap
import com.quickin.app.ui.AuthScreen
import com.quickin.app.ui.AiTravelChatScreen
import com.quickin.app.ui.ChatScreen
import com.quickin.app.ui.ForgotPasswordScreen
import com.quickin.app.ui.HostAnalyticsScreen
import com.quickin.app.ui.HostListingsScreen
import com.quickin.app.ui.HostReservationsScreen
import com.quickin.app.ui.HostEarningsScreen
import com.quickin.app.ui.HostProfileScreen
import com.quickin.app.ui.HostScreen
import com.quickin.app.ui.ListingDetailScreen
import com.quickin.app.ui.HostServicesScreen
import com.quickin.app.ui.ListingsScreen
import com.quickin.app.ui.MySubscriptionsScreen
import com.quickin.app.ui.ReceiptsScreen
import com.quickin.app.ui.nightsBetween
import com.quickin.app.ui.NotificationsScreen
import com.quickin.app.ui.OtpScreen
import com.quickin.app.ui.PaymentSheet
import com.quickin.app.ui.ProfileScreen
import com.quickin.app.ui.ProfileSettingsScreen
import com.quickin.app.ui.ProfileSignInCta
import com.quickin.app.ui.ReservationDetailScreen
import com.quickin.app.ui.ReservationsScreen
import com.quickin.app.ui.ServiceDetailScreen
import com.quickin.app.ui.ServicesScreen
import com.quickin.app.ui.SplashScreen
import com.quickin.app.ui.WishlistScreen
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan
import com.quickin.app.ui.theme.QuickInTheme
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class MainActivity : AppCompatActivity() {

    // Emits the Google OAuth id_token captured from a Custom Tabs redirect, so the
    // composable layer can exchange it for a session.
    private val _googleIdToken = MutableStateFlow<String?>(null)
    val googleIdToken: StateFlow<String?> = _googleIdToken.asStateFlow()

    // Emits a deep link parsed from an incoming VIEW intent (App Link or quickin:// scheme),
    // so the composable layer can fetch the entity and open its detail. Null when none pending.
    private val _pendingDeepLink = MutableStateFlow<DeepLink?>(null)
    val pendingDeepLink: StateFlow<DeepLink?> = _pendingDeepLink.asStateFlow()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // osmdroid requires a User-Agent for its OSM tile requests (else the public tile
        // servers reject them). Must be set before any MapView is shown.
        org.osmdroid.config.Configuration.getInstance().userAgentValue = packageName
        handleIntent(intent)
        setContent {
            QuickInTheme {
                AppRoot()
            }
        }
    }

    // Activity is singleTask, so OAuth redirects AND deep links arrive here rather than a new
    // instance.
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    /**
     * Inspects an incoming VIEW intent. First tries the Google OAuth redirect; otherwise parses it
     * as a QuickIn deep link (App Link / quickin:// scheme). A link we don't recognize is ignored,
     * so the app simply opens normally (no crash on a garbage link).
     */
    private fun handleIntent(intent: Intent?) {
        val data: Uri = intent?.data ?: return
        if (intent.action != Intent.ACTION_VIEW) return
        // The OAuth redirect is a com.quickin.app:/oauth2redirect VIEW — handle it first.
        val idToken = GoogleSignIn.parseIdToken(data)
        if (idToken != null) {
            _googleIdToken.value = idToken
            return
        }
        DeepLink.parse(data)?.let { _pendingDeepLink.value = it }
    }

    /** Consumed by the composable layer once the token has been used. */
    fun clearGoogleIdToken() {
        _googleIdToken.value = null
    }

    /** Consumed by the composable layer once the deep link has been routed. */
    fun clearPendingDeepLink() {
        _pendingDeepLink.value = null
    }
}

/**
 * One destination in the glossy bottom tab bar. [key] is a stable, locale-independent identifier
 * used for navigation/data-refresh logic; [labelRes] is the translated label shown to the user.
 */
private data class TabItem(val key: String, @StringRes val labelRes: Int, val icon: ImageVector)

// GUEST (role "user") tab set — Explore · Services · Wishlist · Trips · Profile.
private val GUEST_TABS = listOf(
    TabItem("Explore", R.string.tab_explore, Icons.Filled.Explore),
    TabItem("Services", R.string.tab_services, Icons.Filled.Star),
    TabItem("wishlist", R.string.tab_wishlist, Icons.Filled.Favorite),
    TabItem("Trips", R.string.tab_trips, Icons.Filled.CalendarToday),
    TabItem("Profile", R.string.tab_profile, Icons.Filled.Person)
)

// HOST (role "host"/"admin") tab set — Listings · Reservations · Services · Profile (NO Explore).
private val HOST_TABS = listOf(
    TabItem("Listings", R.string.tab_listings, Icons.Filled.Home),
    TabItem("Reservations", R.string.tab_reservations, Icons.Filled.CalendarToday),
    TabItem("Services", R.string.tab_services, Icons.Filled.Star),
    TabItem("Profile", R.string.tab_profile, Icons.Filled.Person)
)

/** True for accounts that should see the host tab set ("host" or "admin"). */
private fun isHostRole(role: String?): Boolean =
    role.equals("host", ignoreCase = true) || role.equals("admin", ignoreCase = true)

/**
 * Glossy bottom tab bar: a soft translucent cream bar where the SELECTED tab sits
 * in a raised white rounded "pill" (icon + label) with a shadow — the glossy look.
 * The [tabs] are role-aware (guest vs host), supplied by the caller.
 */
@Composable
private fun GlossyTabBar(tabs: List<TabItem>, selected: Int, onSelect: (Int) -> Unit) {
    // A frosted cream bar with a hairline gold gloss along its top edge — the selected
    // tab rides in a raised white pill that springs + lifts as you switch.
    Surface(
        color = Cream.copy(alpha = 0.96f),
        shadowElevation = 18.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Subtle gold gloss line at the top of the bar.
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(
                        androidx.compose.ui.graphics.Brush.horizontalGradient(
                            listOf(
                                Color.Transparent,
                                com.quickin.app.ui.theme.GoldLight.copy(alpha = 0.55f),
                                Color.Transparent
                            )
                        )
                    )
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(horizontal = 6.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                tabs.forEachIndexed { index, tab ->
                    val isSelected = selected == index
                    val label = stringResource(tab.labelRes)
                    // Animated selection: the white pill fades + springs in, the colors
                    // cross-fade, and the shadow lifts — so switching tabs is *felt*.
                    val pillColor by animateColorAsState(
                        if (isSelected) Color.White else Color.Transparent,
                        animationSpec = tween(320), label = "pill"
                    )
                    val contentTint by animateColorAsState(
                        if (isSelected) Burgundy else Muted,
                        animationSpec = tween(320), label = "tint"
                    )
                    val pillScale by animateFloatAsState(
                        if (isSelected) 1f else 0.86f,
                        animationSpec = spring(dampingRatio = 0.55f, stiffness = 320f), label = "scale"
                    )
                    val pillElevation by animateDpAsState(
                        if (isSelected) 10.dp else 0.dp,
                        animationSpec = tween(320), label = "elev"
                    )
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(3.dp),
                        modifier = Modifier
                            .scale(pillScale)
                            .clip(RoundedCornerShape(22.dp))
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null
                            ) { onSelect(index) }
                            .shadow(pillElevation, RoundedCornerShape(22.dp), clip = false)
                            .background(pillColor, RoundedCornerShape(22.dp))
                            .padding(horizontal = 14.dp, vertical = 9.dp)
                    ) {
                        Icon(
                            tab.icon,
                            contentDescription = label,
                            tint = contentTint,
                            modifier = Modifier.size(24.dp)
                        )
                        Text(
                            label,
                            color = contentTint,
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            maxLines = 1
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AppRoot() {
    var showSplash by remember { mutableStateOf(true) }

    // Hold the splash for ~1.6s (covers the ~1.1s zoom), then fade into the app.
    LaunchedEffect(Unit) {
        kotlinx.coroutines.delay(1600)
        showSplash = false
    }

    Crossfade(
        targetState = showSplash,
        animationSpec = tween(durationMillis = 500),
        label = "splash"
    ) { splash ->
        if (splash) {
            SplashScreen()
        } else {
            MainApp()
        }
    }
}

@Composable
private fun MainApp() {
    val authViewModel: AuthViewModel = viewModel()
    val authState by authViewModel.state.collectAsState()
    val forgotState by authViewModel.forgot.collectAsState()

    val listingsViewModel: ListingsViewModel = viewModel()
    val listingsState by listingsViewModel.state.collectAsState()
    // Section 10: natural-language ("Ask AI") search state on the Explore screen.
    val aiSearchState by listingsViewModel.aiSearch.collectAsState()
    // The "More from this host" rail for whichever listing detail is open.
    val moreFromHostState by listingsViewModel.hostListings.collectAsState()

    val bookingsViewModel: BookingsViewModel = viewModel()
    val reservationsState by bookingsViewModel.reservations.collectAsState()
    val reserveState by bookingsViewModel.reserve.collectAsState()
    val detailState by bookingsViewModel.detail.collectAsState()
    val paymentState by bookingsViewModel.payment.collectAsState()
    val referralState by bookingsViewModel.referrals.collectAsState()

    val hostViewModel: HostViewModel = viewModel()
    val hostBookingsState by hostViewModel.bookings.collectAsState()
    val createListingState by hostViewModel.create.collectAsState()
    val hostListingsState by hostViewModel.listings.collectAsState()
    val ownershipDocState by hostViewModel.ownershipDoc.collectAsState()
    val stayDiscountState by hostViewModel.stayDiscount.collectAsState()
    val seasonalPricingState by hostViewModel.seasonalPricing.collectAsState()
    // Section 10: AI listing-description writer + host analytics dashboard.
    val aiWriterState by hostViewModel.aiWriter.collectAsState()
    val hostAnalyticsState by hostViewModel.analytics.collectAsState()

    // Money views (Section 9 — MOCK): host earnings/payouts + guest receipts.
    val moneyViewModel: MoneyViewModel = viewModel()
    val hostEarningsState by moneyViewModel.earnings.collectAsState()
    val receiptsState by moneyViewModel.receipts.collectAsState()

    val servicesViewModel: ServicesViewModel = viewModel()
    val servicesState by servicesViewModel.services.collectAsState()
    val subscribeState by servicesViewModel.subscribe.collectAsState()
    val mySubscriptionsState by servicesViewModel.mySubscriptions.collectAsState()
    val hostServicesState by servicesViewModel.host.collectAsState()
    val createServiceState by servicesViewModel.create.collectAsState()

    val chatViewModel: ChatViewModel = viewModel()
    val chatState by chatViewModel.state.collectAsState()

    // AI travel concierge (public endpoint, no auth) — opened from the Explore FAB.
    val aiTravelViewModel: AiTravelViewModel = viewModel()
    val aiTravelState by aiTravelViewModel.state.collectAsState()

    val notificationsViewModel: NotificationsViewModel = viewModel()
    val notificationsState by notificationsViewModel.state.collectAsState()

    val profileSettingsViewModel: ProfileSettingsViewModel = viewModel()
    val profileSettingsState by profileSettingsViewModel.state.collectAsState()

    // Trust & Safety: identity verification (Profile), host trust badges + report (listing detail).
    val trustViewModel: TrustViewModel = viewModel()
    val verificationState by trustViewModel.verification.collectAsState()
    val hostBadgesState by trustViewModel.hostBadges.collectAsState()
    val hostProfileState by trustViewModel.hostProfile.collectAsState()
    val reportState by trustViewModel.report.collectAsState()

    // Wishlist (saved stays/experiences) + reviews (listing reviews + leave-a-review).
    val wishlistViewModel: WishlistViewModel = viewModel()
    val wishlistState by wishlistViewModel.state.collectAsState()

    val reviewsViewModel: ReviewsViewModel = viewModel()
    val listingReviewsState by reviewsViewModel.listingReviews.collectAsState()
    val reviewSubmitState by reviewsViewModel.submit.collectAsState()
    // Two-way reviews: host's reviewable past guests + reviews received about the signed-in user.
    val reviewGuestsState by reviewsViewModel.reviewGuests.collectAsState()
    val receivedReviewsState by reviewsViewModel.receivedReviews.collectAsState()

    // Live availability for the open listing: greyed days in the guest picker (guest state) +
    // the host's block/unblock manager (host state).
    val availabilityViewModel: AvailabilityViewModel = viewModel()
    val availabilityGuestState by availabilityViewModel.guest.collectAsState()
    val availabilityHostState by availabilityViewModel.host.collectAsState()

    // Role-aware bottom-nav tab set. Hosts/admins get Listings · Reservations · Services ·
    // Profile (no Explore); everyone else gets the guest set. Switches reactively on role change.
    val isHost = isHostRole(authState.role)
    val tabs = if (isHost) HOST_TABS else GUEST_TABS

    var selectedTab by remember { mutableIntStateOf(0) }
    // Stable key of the currently-selected tab — used for role-agnostic "which tab is this" checks
    // (locale-independent, unlike the translated display label).
    val currentTabKey = tabs.getOrNull(selectedTab)?.key
    var selectedListing by remember { mutableStateOf<Listing?>(null) }
    // True while the host "Add a listing" route (full-screen) is open (from the Listings tab).
    var showAddListing by remember { mutableStateOf(false) }
    // Service whose detail (subscribe) screen is open, or null.
    var selectedService by remember { mutableStateOf<Service?>(null) }
    // Id of a reservation whose detail (QR card) screen is open, or null.
    var selectedReservationId by remember { mutableStateOf<String?>(null) }
    // The MOCK payment sheet's target when open: (bookingId, nightly EGP, nights), or null.
    // Shown after a guest creates a booking, and from an unpaid reservation's "Pay now".
    var pendingPayment by remember { mutableStateOf<Triple<String, Int, Int>?>(null) }
    // True while the host dashboard (full-screen) is open.
    var showHost by remember { mutableStateOf(false) }
    // True while the host SERVICES dashboard (full-screen) is open.
    var showHostServices by remember { mutableStateOf(false) }
    // True while the user's "My subscriptions" screen (full-screen) is open.
    var showMySubscriptions by remember { mutableStateOf(false) }
    // True while the guest "Receipts" screen (full-screen) is open (Section 9 — money views).
    var showReceipts by remember { mutableStateOf(false) }
    // True while the host "Earnings & payouts" screen (full-screen) is open (Section 9 — money views).
    var showEarnings by remember { mutableStateOf(false) }
    // True while the host "Analytics" dashboard (full-screen) is open (Section 10).
    var showAnalytics by remember { mutableStateOf(false) }
    // True while the profile-settings (edit profile) screen (full-screen) is open.
    var showProfileSettings by remember { mutableStateOf(false) }
    // Booking whose chat thread (full-screen) is open: (bookingId, title), or null.
    var chatBooking by remember { mutableStateOf<Pair<String, String?>?>(null) }
    // Host whose public profile (full-screen) is open: (hostId, fallbackHostName), or null.
    // Opened by tapping the "Hosted by …" row on a listing detail.
    var hostProfile by remember { mutableStateOf<Pair<String, String?>?>(null) }
    // True while the in-app notifications feed (full-screen) is open.
    var showNotifications by remember { mutableStateOf(false) }
    // True while the AI travel-concierge chat (full-screen) is open.
    var showAiTravel by remember { mutableStateOf(false) }
    // When true, the Profile/Reservations tab shows the full AuthScreen instead of the CTA.
    var showAuth by remember { mutableStateOf(false) }
    // True while the standalone "Forgot password" route (email → code + new password) is open.
    var showForgot by remember { mutableStateOf(false) }

    val activity = LocalContext.current as? MainActivity
    // Resolved here (composable scope) so it can be passed into the non-composable Google callback.
    val googleNotConfiguredMessage = stringResource(R.string.auth_google_not_configured)

    // POST_NOTIFICATIONS runtime permission (Android 13+). We only need the launcher's side effect
    // (the system dialog); the granted/denied result is ignored — FCM still registers either way,
    // notifications simply won't display if denied.
    val context = LocalContext.current
    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* result intentionally ignored */ }

    // Multi-currency display (Section 9): load the persisted currency choice + refresh FX rates once.
    // Safe to call on every recomposition — CurrencyManager.init is idempotent.
    LaunchedEffect(Unit) { CurrencyManager.init(context) }

    // Wishlist save/heart confirmation: a one-shot Toast ("Added to wishlist" / "Removed from
    // wishlist") on every successful toggle, from whichever screen the heart was tapped.
    val wishlistAddedMsg = stringResource(R.string.wishlist_added)
    val wishlistRemovedMsg = stringResource(R.string.wishlist_removed)
    LaunchedEffect(Unit) {
        wishlistViewModel.toast.collect { event ->
            val msg = if (event == WishlistToast.ADDED) wishlistAddedMsg else wishlistRemovedMsg
            android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    // ---- Biometric (fingerprint / face) sign-in ------------------------------------------------
    // Pending "Enable biometric sign-in" offer, published by the ViewModel right after a successful
    // email/password login. Non-null → show the enable dialog (rendered near the end of MainApp).
    val biometricOffer by authViewModel.biometricEnrollOffer.collectAsState()
    // Prompt strings resolved in composable scope so they can be passed into the non-composable
    // BiometricPrompt callback below.
    val bioTitle = stringResource(R.string.biometric_prompt_title)
    val bioSubtitle = stringResource(R.string.biometric_prompt_subtitle)
    val bioNegative = stringResource(R.string.biometric_use_password)
    // Whether to show the "Sign in with fingerprint/face" button: device can run a prompt AND a
    // session was previously stored. Re-read whenever the auth screen opens or the session changes
    // (enabling biometrics, or logout clearing it), keyed on those triggers.
    val canBiometricLogin = remember(showAuth, authState.isAuthenticated, biometricOffer) {
        BiometricAuthManager.canOfferBiometricLogin(context)
    }
    // Launches the system biometric prompt; on success restores the stored session (marks the user
    // authenticated). Cancel/negative falls back to the password form (no-op); a hard error surfaces
    // in the auth UI. Needs the FragmentActivity host (MainActivity is an AppCompatActivity).
    val launchBiometricLogin: () -> Unit = launch@{
        val host = activity ?: return@launch
        BiometricAuthManager.prompt(
            activity = host,
            title = bioTitle,
            subtitle = bioSubtitle,
            negativeButton = bioNegative,
            onSuccess = { authViewModel.loginWithBiometricSession() },
            onError = { msg -> authViewModel.showAuthMessage(msg) },
            onCancel = { /* fall back to the password form */ }
        )
    }

    // Exchange any Google id_token captured from the OAuth redirect for a session.
    val tokenFlow = remember(activity) {
        activity?.googleIdToken ?: MutableStateFlow<String?>(null)
    }
    val googleIdToken by tokenFlow.collectAsState()
    LaunchedEffect(googleIdToken) {
        val token = googleIdToken
        if (token != null) {
            authViewModel.googleSignIn(token)
            activity?.clearGoogleIdToken()
        }
    }

    // ---- Deep links (shared web App Links + quickin:// scheme) ----------------------------
    // An incoming VIEW intent parsed by MainActivity arrives here. We resolve the entity by id
    // and open its detail in the GUEST experience: listings → Explore, services → Services.
    // Reservations open the QR-card detail (auth-gated by the detail screen itself).
    val deepLinkFlow = remember(activity) {
        activity?.pendingDeepLink ?: MutableStateFlow<DeepLink?>(null)
    }
    val pendingDeepLink by deepLinkFlow.collectAsState()
    LaunchedEffect(pendingDeepLink) {
        when (val link = pendingDeepLink) {
            is DeepLink.Listing -> listingsViewModel.openListingById(link.id)
            is DeepLink.Service -> servicesViewModel.openServiceById(link.id)
            is DeepLink.Reservation -> {
                // Route into the guest experience, then open the reservation's QR-card detail.
                // The detail screen fetches it and shows a sign-in prompt when signed out.
                if (!isHost) selectedTab = GUEST_TABS.indexOfFirst { it.key == "Trips" }.coerceAtLeast(0)
                selectedService = null
                selectedListing = null
                selectedReservationId = link.id
            }
            null -> {}
        }
        if (pendingDeepLink != null) activity?.clearPendingDeepLink()
    }

    // A deep-linked listing finished loading — open its detail (guests land on Explore underneath).
    val deepLinkListing by listingsViewModel.deepLinkListing.collectAsState()
    LaunchedEffect(deepLinkListing) {
        deepLinkListing?.let { listing ->
            if (!isHost) selectedTab = 0 // Explore
            bookingsViewModel.resetReserve()
            reviewsViewModel.clearListingReviews()
            selectedService = null
            selectedReservationId = null
            selectedListing = listing
            listingsViewModel.clearDeepLinkListing()
        }
    }

    // A deep-linked service finished loading — open its detail (guests land on Services underneath).
    val deepLinkService by servicesViewModel.deepLinkService.collectAsState()
    LaunchedEffect(deepLinkService) {
        deepLinkService?.let { svc ->
            if (!isHost) selectedTab = GUEST_TABS.indexOfFirst { it.key == "Services" }.coerceAtLeast(0)
            servicesViewModel.resetSubscribe()
            selectedListing = null
            selectedReservationId = null
            selectedService = svc
            servicesViewModel.clearDeepLinkService()
        }
    }

    // After a successful sign-in, drop the auth screen and return to the profile.
    LaunchedEffect(authState.isAuthenticated) {
        if (authState.isAuthenticated) showAuth = false
    }

    // A freshly-created booking → show the MOCK payment sheet. We capture the booking id + the
    // amounts (nightly from the listing the user just reserved, nights from the booking's dates)
    // then clear the reserve state so the listing's own "Request sent" dialog is replaced by the
    // pay flow. On pay success the booking is paid + confirmed and we continue to its reservation.
    LaunchedEffect(reserveState.confirmed) {
        val booking = reserveState.confirmed
        if (booking != null && pendingPayment == null) {
            val nights = nightsBetween(booking.checkIn, booking.checkOut).coerceAtLeast(1)
            // Prefer the live listing price; fall back to deriving nightly from the booking total.
            val nightly = selectedListing?.pricePerNight?.toInt()
                ?: (booking.totalPrice / nights).toInt()
            bookingsViewModel.resetPayment()
            pendingPayment = Triple(booking.id, nightly, nights)
            bookingsViewModel.resetReserve()
        }
    }

    // Reflect a profile edit in the cached auth user the instant a save succeeds, so the Profile
    // tab header (which reads AuthViewModel's cached name) updates immediately — no re-login needed.
    LaunchedEffect(profileSettingsState.saved) {
        if (profileSettingsState.saved) {
            authViewModel.applyProfileName(profileSettingsState.profile.fullName)
        }
    }

    // Re-load the editable profile whenever the signed-in account changes (id flips on an
    // account switch, or on first sign-in). Combined with the per-user clears below, this
    // guarantees a freshly-signed-in account never sees the previous account's name/age/id/phone.
    LaunchedEffect(authState.userId) {
        if (authState.isAuthenticated && authState.userId != null) {
            profileSettingsViewModel.reloadForAccount()
        }
    }

    // When the role (hence the tab set) changes — e.g. logging in as a host, or logging out —
    // snap back to the first tab so the selection can't point past the new set's bounds.
    LaunchedEffect(isHost) {
        selectedTab = 0
        showAddListing = false
    }

    // Keep the Reservations tab in sync with auth: load on sign-in, clear on sign-out.
    LaunchedEffect(authState.isAuthenticated) {
        if (authState.isAuthenticated) {
            bookingsViewModel.loadReservations()
            servicesViewModel.loadMySubscriptions()
            // Prime the bell's unread badge as soon as we have a session.
            notificationsViewModel.load()
            // Saved hearts + reviewable stays so the explore/trip screens reflect them.
            wishlistViewModel.load()
            reviewsViewModel.loadReviewable()
            // Register this device's push token with the backend (best-effort; no-op without FCM).
            notificationsViewModel.registerDeviceToken()
            // Ask for notification permission on Android 13+ (auto-granted below) so pushes can show.
            // Only prompt when not already granted; the result is handled by the launcher above.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        } else {
            bookingsViewModel.clearReservations()
            bookingsViewModel.clearReferrals()
            servicesViewModel.clearMySubscriptions()
            notificationsViewModel.clear()
            wishlistViewModel.clear()
            reviewsViewModel.clear()
            // Drop the cached editable profile too, so the next account can't see the prior one's
            // name / age / ID / phone on the edit screen.
            profileSettingsViewModel.clear()
            // Drop the cached verification status so the next account starts from its own state.
            trustViewModel.clearVerification()
            // Drop cached earnings/receipts so the next account never sees the prior one's money.
            moneyViewModel.clear()
            // Leave any host / reservation-detail / chat / notifications / services screen on sign-out.
            showHost = false
            showHostServices = false
            showMySubscriptions = false
            showReceipts = false
            showEarnings = false
            showAnalytics = false
            showProfileSettings = false
            showNotifications = false
            showForgot = false
            selectedReservationId = null
            chatBooking = null
            // Close the host profile too (a public screen, but drop its cached state on logout).
            hostProfile = null
            trustViewModel.clearHostProfile()
            // Drop any in-flight mock payment too.
            pendingPayment = null
            bookingsViewModel.resetPayment()
        }
    }

    // Refresh data when the active tab changes, keyed by the tab's role-agnostic key.
    LaunchedEffect(currentTabKey, authState.isAuthenticated) {
        when (currentTabKey) {
            // Explore (guest) hosts the notifications bell — refresh its unread badge.
            "Explore" -> if (authState.isAuthenticated) notificationsViewModel.load()
            // Guest "Wishlist" = the user's saved stays + experiences.
            "wishlist" -> if (authState.isAuthenticated) wishlistViewModel.load()
            // Guest "Trips" = the user's own bookings.
            "Trips" -> if (authState.isAuthenticated) bookingsViewModel.loadReservations()
            // Host "Reservations" = incoming requests across the host's listings.
            "Reservations" -> if (authState.isAuthenticated) hostViewModel.loadHostBookings()
            // Services: public feed for guests, the host's own services for hosts.
            "Services" -> if (isHost) servicesViewModel.loadHost() else servicesViewModel.loadServices()
            "Listings" -> if (authState.isAuthenticated) hostViewModel.loadHostListings()
            // Profile tab renders the avatar + bio from the editable profile — load it lazily,
            // and load the identity-verification status for the "Verify your identity" card.
            "Profile" -> if (authState.isAuthenticated) {
                if (!profileSettingsState.loaded) profileSettingsViewModel.load()
                if (!verificationState.loaded) trustViewModel.loadVerification()
            }
        }
    }

    // System BACK button. State-based navigation means the OS back press isn't tied to a
    // back stack, so we pop whichever full-screen overlay is on top — mirroring the render
    // precedence below — and otherwise fall back to returning to Explore from a secondary tab.
    val otpOpen = authState.pendingEmail != null && !authState.isAuthenticated
    val forgotOpen = showForgot && !authState.isAuthenticated
    val authOpen = showAuth && !authState.isAuthenticated
    val anyOverlay = pendingPayment != null || hostProfile != null || selectedListing != null ||
        selectedService != null ||
        showMySubscriptions || showProfileSettings || showHostServices || showAiTravel ||
        chatBooking != null || selectedReservationId != null || showHost || showAddListing ||
        showNotifications || showAnalytics || otpOpen || forgotOpen || authOpen
    BackHandler(enabled = anyOverlay || selectedTab != 0) {
        when {
            // The mock payment sheet sits on top of everything — Back closes it (unless paying).
            pendingPayment != null -> {
                if (!paymentState.isPaying) {
                    pendingPayment = null
                    bookingsViewModel.resetPayment()
                }
            }
            // The host profile sits above the listing detail — Back returns to that detail.
            hostProfile != null -> { trustViewModel.clearHostProfile(); hostProfile = null }
            selectedListing != null -> { bookingsViewModel.resetReserve(); selectedListing = null }
            selectedService != null -> { servicesViewModel.resetSubscribe(); selectedService = null }
            showMySubscriptions -> showMySubscriptions = false
            showProfileSettings -> showProfileSettings = false
            showHostServices -> showHostServices = false
            showAiTravel -> showAiTravel = false
            chatBooking != null -> chatBooking = null
            selectedReservationId != null -> { bookingsViewModel.clearReservationDetail(); selectedReservationId = null }
            showAddListing -> { hostViewModel.resetCreate(); showAddListing = false }
            showHost -> showHost = false
            showAnalytics -> showAnalytics = false
            showNotifications -> showNotifications = false
            otpOpen -> authViewModel.cancelVerification()
            forgotOpen -> { authViewModel.cancelForgotPassword(); showForgot = false }
            authOpen -> { authViewModel.clearError(); showAuth = false }
            selectedTab != 0 -> selectedTab = 0
        }
    }

    // MOCK payment sheet — floats (its own scrim window) over whatever screen is active. Opened
    // after a guest creates a booking (and from an unpaid reservation's "Pay now"). On pay success
    // it shows a paid confirmation; "Done" then continues to the reservation's QR-card detail.
    val payTarget = pendingPayment
    if (payTarget != null) {
        PaymentSheet(
            nightly = payTarget.second,
            nights = payTarget.third,
            state = paymentState,
            onPay = { method -> bookingsViewModel.pay(payTarget.first, method) },
            onValidatePromo = { code, subtotal -> bookingsViewModel.validatePromo(code, subtotal) },
            onClearPromo = bookingsViewModel::clearPromo,
            onDone = {
                // Booking is now paid + confirmed — close the sheet and open its reservation.
                val bookingId = payTarget.first
                pendingPayment = null
                bookingsViewModel.resetPayment()
                bookingsViewModel.resetReserve()
                selectedListing = null
                selectedService = null
                // Land on the guest Trips tab (when applicable) under the reservation detail.
                if (!isHost) selectedTab = GUEST_TABS.indexOfFirst { it.key == "Trips" }.coerceAtLeast(0)
                selectedReservationId = bookingId
            },
            onDismiss = {
                // Dismissed before paying — drop the sheet; the booking still exists (unpaid) and
                // can be paid later from its reservation via "Pay now".
                pendingPayment = null
                bookingsViewModel.resetPayment()
            }
        )
    }

    // "Review submitted" confirmation — shown over whatever screen is active once a review POST
    // succeeds (the leave-a-review dialog closes as the stay leaves the reviewable set).
    if (reviewSubmitState.submittedBookingId != null) {
        // Refresh the explore feed so the freshly-reviewed stay shows its updated rating/count.
        LaunchedEffect(reviewSubmitState.submittedBookingId) { listingsViewModel.load() }
        com.quickin.app.ui.ReviewSubmittedDialog(onDismiss = reviewsViewModel::acknowledgeSubmit)
    }

    // "Enable biometric sign-in?" — offered right after a successful email/password login on a
    // device with an enrolled fingerprint/face. Enabling stores the session in EncryptedSharedPrefs
    // so the next visit can restore it behind a biometric check; "Not now" just dismisses the offer.
    if (biometricOffer != null) {
        AlertDialog(
            onDismissRequest = authViewModel::declineBiometricOffer,
            title = { Text(stringResource(R.string.biometric_enable_title), fontWeight = FontWeight.Bold) },
            text = { Text(stringResource(R.string.biometric_enable_message)) },
            confirmButton = {
                TextButton(onClick = authViewModel::enableBiometric) {
                    Text(stringResource(R.string.biometric_enable_confirm), color = Burgundy, fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = {
                TextButton(onClick = authViewModel::declineBiometricOffer) {
                    Text(stringResource(R.string.biometric_enable_dismiss), color = Muted)
                }
            },
            containerColor = Cream
        )
    }

    // Host PUBLIC PROFILE (reviews + their other listings). Full-screen; opened from a listing
    // detail's "Hosted by …" row. Sits above the listing detail so Back returns to it. Tapping one
    // of the host's listings opens that listing's own detail (replacing this profile). Never shows
    // the host's phone/email — the backing profile carries none.
    val openHost = hostProfile
    if (openHost != null) {
        HostProfileScreen(
            state = hostProfileState,
            hostName = openHost.second,
            onBack = {
                trustViewModel.clearHostProfile()
                hostProfile = null
            },
            onOpenListing = { other ->
                // Open the tapped listing's detail; close the host profile (Back from the detail
                // returns to the listing we came from, not back into the profile).
                trustViewModel.clearHostProfile()
                hostProfile = null
                bookingsViewModel.resetReserve()
                reviewsViewModel.clearListingReviews()
                availabilityViewModel.clearHost()
                selectedListing = other
            }
        )
        return
    }

    val current = selectedListing
    // The detail view is full-screen (no bottom bar); everything else is in the Scaffold.
    if (current != null) {
        // Load this listing's reviews (public) + the host's other stays ("More from this host")
        // + its live availability (booked + blocked days) + the host's trust badges whenever a
        // different listing is opened. The report state is reset so a prior report doesn't linger.
        LaunchedEffect(current.id) {
            reviewsViewModel.loadListingReviews(current.id)
            listingsViewModel.loadHostListings(current.hostId)
            availabilityViewModel.loadForListing(current.id)
            trustViewModel.loadHostBadges(current.hostId)
            trustViewModel.resetReport()
        }
        // True when the signed-in user is this listing's host — unlocks the availability manager.
        val isOwnHost = authState.isAuthenticated &&
            !authState.userId.isNullOrBlank() && authState.userId == current.hostId
        ListingDetailScreen(
            listing = current,
            onBack = {
                bookingsViewModel.resetReserve()
                reviewsViewModel.clearListingReviews()
                listingsViewModel.clearHostListings()
                availabilityViewModel.clearGuest()
                availabilityViewModel.clearHost()
                trustViewModel.clearHostBadges()
                trustViewModel.resetReport()
                selectedListing = null
            },
            reserveState = reserveState,
            onReserve = { checkIn, checkOut, guests ->
                bookingsViewModel.createBooking(current.id, checkIn, checkOut, guests)
            },
            onSignIn = {
                authViewModel.clearError()
                bookingsViewModel.resetReserve()
                selectedListing = null
                showAuth = true
            },
            onResetReserve = bookingsViewModel::resetReserve,
            isSaved = wishlistState.listingIds.contains(current.id),
            onToggleSaved = {
                if (authState.isAuthenticated) {
                    wishlistViewModel.toggleListing(current)
                } else {
                    authViewModel.clearError()
                    bookingsViewModel.resetReserve()
                    reviewsViewModel.clearListingReviews()
                    selectedListing = null
                    showAuth = true
                }
            },
            reviewsState = listingReviewsState,
            hostListings = moreFromHostState.listings,
            onOpenListing = { other ->
                // Open another of the host's stays in its own detail: reset the prior screen's
                // transient state, then swap the selection (the LaunchedEffect reloads for [other]).
                bookingsViewModel.resetReserve()
                reviewsViewModel.clearListingReviews()
                availabilityViewModel.clearHost()
                selectedListing = other
            },
            // Tapping "Hosted by …" opens the host's public profile (reviews + their other stays).
            onOpenHostProfile = {
                val hostId = current.hostId
                if (!hostId.isNullOrBlank()) {
                    trustViewModel.loadHostProfile(hostId)
                    hostProfile = hostId to current.hostName
                }
            },
            // Live availability: greyed days in the guest picker come from the guest state (only
            // when it's this listing's spans); the host manager is gated on owning the listing.
            unavailableRanges = if (availabilityGuestState.listingId == current.id)
                availabilityGuestState.ranges else emptyList(),
            isOwnHost = isOwnHost,
            hostAvailabilityState = availabilityHostState,
            onLoadHostAvailability = { availabilityViewModel.loadHost(current.id) },
            onAddBlock = { start, end, note -> availabilityViewModel.addBlock(current.id, start, end, note) },
            onRemoveBlock = { blockId -> availabilityViewModel.removeBlock(current.id, blockId) },
            // Trust & Safety: the host's fetched badges + the report-this-listing flow.
            hostBadges = if (hostBadgesState.hostId == current.hostId) hostBadgesState.badges
                else com.quickin.app.TrustBadges(),
            reportState = reportState,
            onSubmitReport = { reason, details -> trustViewModel.submitReport(current.id, reason, details) },
            onResetReport = trustViewModel::resetReport
        )
        return
    }

    // Service DETAIL (subscribe). Full-screen; opened from the Services tab. Mirrors the
    // listing detail: subscribing requires sign-in and shows a branded "Request sent" dialog.
    val service = selectedService
    if (service != null) {
        ServiceDetailScreen(
            service = service,
            onBack = {
                servicesViewModel.resetSubscribe()
                selectedService = null
            },
            subscribeState = subscribeState,
            onSubscribe = { note ->
                servicesViewModel.subscribe(service.id, note.ifBlank { null })
            },
            onSignIn = {
                authViewModel.clearError()
                servicesViewModel.resetSubscribe()
                selectedService = null
                showAuth = true
            },
            onResetSubscribe = servicesViewModel::resetSubscribe
        )
        return
    }

    // "My subscriptions" (the user's service requests). Full-screen; opened from Profile.
    if (showMySubscriptions && authState.isAuthenticated) {
        MySubscriptionsScreen(
            state = mySubscriptionsState,
            onBack = { showMySubscriptions = false },
            onLoad = servicesViewModel::loadMySubscriptions
        )
        return
    }

    // "Receipts" (the guest's itemized paid receipts). Full-screen; opened from Profile.
    // Section 9 — money views (MOCK).
    if (showReceipts && authState.isAuthenticated) {
        ReceiptsScreen(
            state = receiptsState,
            onBack = { showReceipts = false },
            onLoad = moneyViewModel::loadReceipts
        )
        return
    }

    // "Earnings & payouts" (the host's money view). Full-screen; opened from Profile (host only).
    // Section 9 — money views (MOCK).
    if (showEarnings && authState.isAuthenticated) {
        HostEarningsScreen(
            state = hostEarningsState,
            onBack = { showEarnings = false },
            onLoad = moneyViewModel::loadEarnings
        )
        return
    }

    // "Analytics" (the host's performance dashboard). Full-screen; opened from Profile (host only).
    // Section 10 — bookings/revenue/rating/conversion + monthly trend + top listings.
    if (showAnalytics && authState.isAuthenticated) {
        HostAnalyticsScreen(
            state = hostAnalyticsState,
            onBack = { showAnalytics = false },
            onLoad = hostViewModel::loadAnalytics
        )
        return
    }

    // Profile settings (edit full name / age / ID-passport / phone). Full-screen; opened from Profile.
    if (showProfileSettings && authState.isAuthenticated) {
        ProfileSettingsScreen(
            state = profileSettingsState,
            onBack = { showProfileSettings = false },
            onLoad = profileSettingsViewModel::load,
            onSave = { fullName, age, idDocument, phone, bio, avatarUrl, country ->
                profileSettingsViewModel.save(fullName, age, idDocument, phone, bio, avatarUrl, country)
            },
            onSavedAck = profileSettingsViewModel::acknowledgeSaved,
            onChangePassword = { current, next ->
                profileSettingsViewModel.changePassword(current, next)
            },
            onPasswordChangedAck = profileSettingsViewModel::acknowledgePasswordChanged
        )
        return
    }

    // Host SERVICES dashboard (Requests / My services / Add service). Full-screen; host accounts only.
    if (showHostServices && authState.isAuthenticated) {
        HostServicesScreen(
            state = hostServicesState,
            createState = createServiceState,
            onBack = { showHostServices = false },
            onLoad = servicesViewModel::loadHost,
            onConfirm = { id -> servicesViewModel.act(id, "confirm") },
            onReject = { id -> servicesViewModel.act(id, "reject") },
            onCreateService = { title, category, description, location, price, imageUrl ->
                servicesViewModel.createService(title, category, description, location, price, imageUrl)
            },
            onResetCreate = servicesViewModel::resetCreate
        )
        return
    }

    // AI travel concierge. Full-screen; opened from the Explore FAB. Public endpoint,
    // so no auth gate — available to guests and signed-in users alike.
    if (showAiTravel) {
        AiTravelChatScreen(
            state = aiTravelState,
            onSend = aiTravelViewModel::send,
            onRetry = aiTravelViewModel::retry,
            onClose = { showAiTravel = false }
        )
        return
    }

    // Per-booking CHAT thread. Full-screen; opened from the reservation detail
    // (guest) or a host request row. Sits above those screens so Back returns to them.
    val chat = chatBooking
    if (chat != null && authState.isAuthenticated) {
        ChatScreen(
            bookingId = chat.first,
            state = chatState,
            title = chat.second,
            onStart = chatViewModel::start,
            onRefresh = chatViewModel::refresh,
            onSend = chatViewModel::send,
            onBack = { chatBooking = null }
        )
        return
    }

    // Reservation DETAIL (QR card). Full-screen; opened from the Reservations list.
    val reservationId = selectedReservationId
    if (reservationId != null) {
        LaunchedEffect(reservationId) { bookingsViewModel.loadReservation(reservationId) }
        ReservationDetailScreen(
            state = detailState,
            onBack = {
                bookingsViewModel.clearReservationDetail()
                selectedReservationId = null
            },
            onRetry = { bookingsViewModel.loadReservation(reservationId) },
            onOpenMessages = {
                chatBooking = reservationId to detailState.reservation?.title
            },
            // Unpaid reservation → "Pay now" opens the same mock payment sheet. Amounts come from
            // the reservation (nightly derived from its total ÷ nights).
            onPayNow = {
                val r = detailState.reservation
                if (r != null) {
                    val nights = nightsBetween(r.checkIn, r.checkOut).coerceAtLeast(1)
                    val nightly = (r.totalPrice / nights).toInt()
                    bookingsViewModel.resetPayment()
                    pendingPayment = Triple(r.id, nightly, nights)
                }
            },
            canReview = reviewsViewModel.canReview(reservationId),
            reviewSubmitting = reviewSubmitState.submitting,
            reviewError = reviewSubmitState.error,
            onSubmitReview = { rating, comment, photos ->
                reviewsViewModel.submitReview(reservationId, rating, comment, photos)
            },
            // Hosts get an editable "From your host" notes panel; guests see notes read-only.
            isHost = isHost,
            notesSaving = detailState.savingNotes,
            notesError = detailState.notesError,
            onSaveHostNotes = { notes -> bookingsViewModel.setHostNotes(reservationId, notes) }
        )
        return
    }

    // "Add a listing" wizard. Full-screen; opened from the host Listings tab. Sits above the
    // tab content so Back returns to the Listings tab.
    if (showAddListing && authState.isAuthenticated) {
        AddListingScreen(
            state = createListingState,
            onBack = {
                hostViewModel.resetCreate()
                showAddListing = false
            },
            onCreateListing = { title, description, location, country, price, maxGuests, bedrooms, beds, bathrooms, propertyType, imageUrl, amenities, lat, lng, region, cancellationPolicy, ownershipDoc, weeklyDiscount, monthlyDiscount, weekendPrice, monthlyPrices ->
                hostViewModel.createListing(
                    title, description, location, country, price,
                    maxGuests, bedrooms, beds, bathrooms, propertyType, imageUrl, amenities, lat, lng, region, cancellationPolicy, ownershipDoc,
                    weeklyDiscount, monthlyDiscount, weekendPrice, monthlyPrices
                )
            },
            onResetCreate = hostViewModel::resetCreate,
            // Section 10 — AI listing-description writer.
            aiWriter = aiWriterState,
            onGenerateDescription = { title, location, region, propertyType, bedrooms, maxGuests, amenities, notes ->
                hostViewModel.generateDescription(title, location, region, propertyType, bedrooms, maxGuests, amenities, notes)
            },
            onConsumeGeneratedDescription = hostViewModel::consumeGeneratedDescription,
            onClearAiWriter = hostViewModel::clearAiWriter
        )
        return
    }

    // Host dashboard (Add listing + Reservation requests). Full-screen; host accounts only.
    if (showHost && authState.isAuthenticated) {
        HostScreen(
            bookingsState = hostBookingsState,
            createState = createListingState,
            reviewGuestsState = reviewGuestsState,
            onBack = { showHost = false },
            onLoadBookings = hostViewModel::loadHostBookings,
            onConfirm = { id -> hostViewModel.act(id, "confirm") },
            onReject = { id -> hostViewModel.act(id, "reject") },
            onMessage = { id ->
                val title = hostBookingsState.bookings.firstOrNull { it.id == id }?.title
                chatBooking = id to title
            },
            onLoadReviewableGuests = reviewsViewModel::loadReviewableGuests,
            onSubmitGuestReview = { bookingId, rating, comment ->
                reviewsViewModel.submitGuestReview(bookingId, rating, comment)
            },
            onCreateListing = { title, description, location, country, price, maxGuests, bedrooms, beds, bathrooms, propertyType, imageUrl, amenities, lat, lng, region, cancellationPolicy, ownershipDoc, weeklyDiscount, monthlyDiscount, weekendPrice, monthlyPrices ->
                hostViewModel.createListing(
                    title, description, location, country, price,
                    maxGuests, bedrooms, beds, bathrooms, propertyType, imageUrl, amenities, lat, lng, region, cancellationPolicy, ownershipDoc,
                    weeklyDiscount, monthlyDiscount, weekendPrice, monthlyPrices
                )
            },
            onResetCreate = hostViewModel::resetCreate,
            // Section 10 — AI listing-description writer.
            aiWriter = aiWriterState,
            onGenerateDescription = { title, location, region, propertyType, bedrooms, maxGuests, amenities, notes ->
                hostViewModel.generateDescription(title, location, region, propertyType, bedrooms, maxGuests, amenities, notes)
            },
            onConsumeGeneratedDescription = hostViewModel::consumeGeneratedDescription,
            onClearAiWriter = hostViewModel::clearAiWriter
        )
        return
    }

    // In-app NOTIFICATIONS feed. Full-screen; opened from the Explore top-bar bell.
    // Sits below the deep overlays above (chat / detail / host) so Back returns to Explore.
    if (showNotifications && authState.isAuthenticated) {
        NotificationsScreen(
            state = notificationsState,
            onBack = { showNotifications = false },
            onLoad = notificationsViewModel::load,
            onMarkRead = notificationsViewModel::markRead,
            onMarkAllRead = notificationsViewModel::markAllRead
        )
        return
    }

    // Email-OTP verification step (after sign-up or an unverified login). Takes priority
    // over the auth form whenever a verification is pending and we're not yet signed in.
    if (authState.pendingEmail != null && !authState.isAuthenticated) {
        // Ensure the form is the destination once verification finishes/cancels.
        showAuth = true
        OtpScreen(
            state = authState,
            onVerify = authViewModel::verifyOtp,
            onResend = authViewModel::resendOtp,
            onBack = authViewModel::cancelVerification
        )
        return
    }

    // Standalone "Forgot password" route (email → emailed code + new password). Opened from the
    // sign-in form; sits above it so Back returns to sign-in. On success the ViewModel persists the
    // returned session and the auth-sync effect drops both this route and the auth form.
    if (showForgot && !authState.isAuthenticated) {
        ForgotPasswordScreen(
            state = forgotState,
            onSendCode = authViewModel::sendResetCode,
            onReset = authViewModel::resetPassword,
            onClearError = authViewModel::clearForgotError,
            onBack = {
                authViewModel.cancelForgotPassword()
                showForgot = false
            }
        )
        return
    }

    // Full-screen auth (reached from the Profile sign-in CTA). No bottom bar.
    if (showAuth && !authState.isAuthenticated) {
        AuthScreen(
            state = authState,
            onLogin = authViewModel::login,
            onSignup = authViewModel::signup,
            onGoogleLaunch = { nonce, state ->
                activity?.let { GoogleSignIn.launch(it, nonce, state) }
            },
            onGoogleNotConfigured = {
                authViewModel.showAuthMessage(googleNotConfiguredMessage)
            },
            onForgotPassword = {
                authViewModel.cancelForgotPassword()
                showForgot = true
            },
            canBiometricLogin = canBiometricLogin,
            onBiometricLogin = launchBiometricLogin,
            onBack = {
                authViewModel.clearError()
                showAuth = false
            }
        )
        return
    }

    Scaffold(
        containerColor = CreamPage,
        bottomBar = {
            GlossyTabBar(tabs = tabs, selected = selectedTab, onSelect = { selectedTab = it })
        }
    ) { padding ->
        // Animate the screen when the active tab changes: the incoming screen fades and
        // slides a touch in the direction of travel while the outgoing one fades away,
        // so tab switches feel deliberate rather than instant.
        AnimatedContent(
            targetState = selectedTab,
            transitionSpec = {
                // The signature qkSwap: 420ms cubic-bezier(0.22,1,0.36,1), sliding in the
                // direction of travel. RTL-safe — Compose mirrors the slide offset for us.
                qkSwap(forward = targetState >= initialState)
            },
            label = "tab"
        ) { tabIndex ->
            // Switch on the role-agnostic tab key so the same content map serves both the
            // guest set (Explore · Services · Trips · Profile) and the host set (Listings ·
            // Reservations · Services · Profile). getOrNull guards against a transient index
            // that's briefly out of range while the tab set swaps on a role change.
            when (tabs.getOrNull(tabIndex)?.key) {
                "Explore" -> ListingsScreen(
                    state = listingsState,
                    onRetry = listingsViewModel::load,
                    onSelect = { selectedListing = it },
                    onSearch = listingsViewModel::search,
                    onClear = listingsViewModel::clear,
                    onSelectRegion = listingsViewModel::selectRegion,
                    onSelectSort = listingsViewModel::setSort,
                    onApplyFilters = listingsViewModel::applyFilters,
                    onClearFilters = listingsViewModel::clearFilters,
                    onSearchArea = listingsViewModel::searchArea,
                    isAuthenticated = authState.isAuthenticated,
                    onSignIn = {
                        authViewModel.clearError()
                        showAuth = true
                    },
                    unreadCount = notificationsState.unreadCount,
                    onOpenNotifications = {
                        notificationsViewModel.load()
                        showNotifications = true
                    },
                    savedListingIds = wishlistState.listingIds,
                    onToggleSaved = { listing ->
                        if (authState.isAuthenticated) {
                            wishlistViewModel.toggleListing(listing)
                        } else {
                            authViewModel.clearError()
                            showAuth = true
                        }
                    },
                    onOpenAiChat = { showAiTravel = true },
                    // Section 10 — natural-language ("Ask AI") search.
                    aiSearchState = aiSearchState,
                    onAiSearch = listingsViewModel::aiSearch,
                    onClearAiSearch = listingsViewModel::clearAiSearch,
                    contentPadding = padding
                )
                // Host-only: the host's own listings + an "Add a listing" entry.
                "Listings" -> HostListingsScreen(
                    state = hostListingsState,
                    onLoad = hostViewModel::loadHostListings,
                    onAddListing = {
                        hostViewModel.resetCreate()
                        showAddListing = true
                    },
                    onOpenListing = { listing -> selectedListing = listing },
                    ownershipState = ownershipDocState,
                    onReuploadDoc = { listingId, doc -> hostViewModel.reuploadOwnershipDoc(listingId, doc) },
                    stayDiscountState = stayDiscountState,
                    onSaveStayDiscounts = { listingId, weekly, monthly ->
                        hostViewModel.setStayDiscounts(listingId, weekly, monthly)
                    },
                    seasonalPricingState = seasonalPricingState,
                    onSaveSeasonalPricing = { listingId, weekendPrice, monthlyPrices ->
                        hostViewModel.setSeasonalPricing(listingId, weekendPrice, monthlyPrices)
                    },
                    contentPadding = padding
                )
                "Services" -> if (isHost) {
                    // Host services management (Requests / My services / Add service).
                    HostServicesScreen(
                        state = hostServicesState,
                        createState = createServiceState,
                        onBack = null, // embedded as a bottom-nav tab — no back arrow
                        onLoad = servicesViewModel::loadHost,
                        onConfirm = { id -> servicesViewModel.act(id, "confirm") },
                        onReject = { id -> servicesViewModel.act(id, "reject") },
                        onCreateService = { title, category, description, location, price, imageUrl ->
                            servicesViewModel.createService(title, category, description, location, price, imageUrl)
                        },
                        onResetCreate = servicesViewModel::resetCreate,
                        contentPadding = padding
                    )
                } else {
                    ServicesScreen(
                        state = servicesState,
                        onRetry = servicesViewModel::loadServices,
                        onSelect = { selectedService = it },
                        contentPadding = padding
                    )
                }
                // Host-only: incoming reservation requests with Confirm / Reject.
                "Reservations" -> HostReservationsScreen(
                    state = hostBookingsState,
                    onLoad = hostViewModel::loadHostBookings,
                    onConfirm = { id -> hostViewModel.act(id, "confirm") },
                    onReject = { id -> hostViewModel.act(id, "reject") },
                    onMessage = { id ->
                        val title = hostBookingsState.bookings.firstOrNull { it.id == id }?.title
                        chatBooking = id to title
                    },
                    contentPadding = padding
                )
                // Guest "Wishlist" = the user's saved stays + experiences. A top-level tab;
                // its back arrow returns to Explore (no overlay to pop). The screen itself
                // distinguishes signed-out (sign-in prompt) from signed-in-but-empty (friendly
                // empty state) using the authoritative auth flag — an empty/401 API result while
                // signed in is treated as empty, never as signed-out.
                "wishlist" -> WishlistScreen(
                    state = wishlistState,
                    isAuthenticated = authState.isAuthenticated,
                    onBack = { selectedTab = 0 },
                    onLoad = wishlistViewModel::load,
                    onSignIn = {
                        authViewModel.clearError()
                        showAuth = true
                    },
                    onOpenListing = { listing -> selectedListing = listing },
                    onOpenService = { service -> selectedService = service },
                    onToggleListing = wishlistViewModel::toggleListing,
                    onToggleService = wishlistViewModel::toggleService
                )
                // Guest "Trips" = the user's own bookings.
                "Trips" -> ReservationsScreen(
                    isAuthenticated = authState.isAuthenticated,
                    state = reservationsState,
                    onSignIn = {
                        authViewModel.clearError()
                        showAuth = true
                    },
                    onRetry = bookingsViewModel::loadReservations,
                    onOpen = { booking -> selectedReservationId = booking.id },
                    canReview = { booking -> reviewsViewModel.canReview(booking.id) },
                    reviewSubmitting = reviewSubmitState.submitting,
                    reviewError = reviewSubmitState.error,
                    onSubmitReview = { bookingId, rating, comment, photos ->
                        reviewsViewModel.submitReview(bookingId, rating, comment, photos)
                    },
                    contentPadding = padding
                )
                "Profile" -> if (authState.isAuthenticated) {
                    // Load the reviews this user has received (host → guest) for the profile section.
                    LaunchedEffect(authState.userId) {
                        reviewsViewModel.loadReceivedReviews(authState.userId)
                    }
                    ProfileScreen(
                        state = authState,
                        onLogout = authViewModel::logout,
                        profile = profileSettingsState.profile,
                        receivedReviews = receivedReviewsState,
                        verificationState = verificationState,
                        onSubmitVerification = trustViewModel::submitVerification,
                        onOpenHost = { showHost = true },
                        onOpenMySubscriptions = {
                            servicesViewModel.loadMySubscriptions()
                            showMySubscriptions = true
                        },
                        onOpenHostServices = {
                            servicesViewModel.loadHost()
                            showHostServices = true
                        },
                        onOpenSettings = {
                            profileSettingsViewModel.load()
                            showProfileSettings = true
                        },
                        onOpenReceipts = {
                            moneyViewModel.loadReceipts()
                            showReceipts = true
                        },
                        onOpenEarnings = {
                            moneyViewModel.loadEarnings()
                            showEarnings = true
                        },
                        onOpenAnalytics = {
                            hostViewModel.loadAnalytics()
                            showAnalytics = true
                        },
                        referralState = referralState,
                        onLoadReferrals = bookingsViewModel::loadReferrals,
                        modifier = Modifier.padding(padding)
                    )
                } else {
                    ProfileSignInCta(
                        onSignIn = {
                            authViewModel.clearError()
                            showAuth = true
                        },
                        modifier = Modifier.padding(padding)
                    )
                }
                else -> {}
            }
        }
    }
}
