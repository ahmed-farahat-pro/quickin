package com.quickin.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import com.quickin.app.ui.AuthScreen
import com.quickin.app.ui.ListingDetailScreen
import com.quickin.app.ui.ListingsScreen
import com.quickin.app.ui.ProfileScreen
import com.quickin.app.ui.ProfileSignInCta
import com.quickin.app.ui.ReservationsScreen
import com.quickin.app.ui.SplashScreen
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan
import com.quickin.app.ui.theme.QuickInTheme
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class MainActivity : ComponentActivity() {

    // Emits the Google OAuth id_token captured from a Custom Tabs redirect, so the
    // composable layer can exchange it for a session.
    private val _googleIdToken = MutableStateFlow<String?>(null)
    val googleIdToken: StateFlow<String?> = _googleIdToken.asStateFlow()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // osmdroid requires a User-Agent for its OSM tile requests (else the public tile
        // servers reject them). Must be set before any MapView is shown.
        org.osmdroid.config.Configuration.getInstance().userAgentValue = packageName
        handleOAuthRedirect(intent)
        setContent {
            QuickInTheme {
                AppRoot()
            }
        }
    }

    // Activity is singleTask, so the OAuth redirect arrives here rather than a new instance.
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleOAuthRedirect(intent)
    }

    private fun handleOAuthRedirect(intent: Intent?) {
        val data: Uri = intent?.data ?: return
        if (intent.action != Intent.ACTION_VIEW) return
        GoogleSignIn.parseIdToken(data)?.let { _googleIdToken.value = it }
    }

    /** Consumed by the composable layer once the token has been used. */
    fun clearGoogleIdToken() {
        _googleIdToken.value = null
    }
}

private enum class Tab(val label: String, val icon: ImageVector) {
    Explore("Explore", Icons.Filled.Home),
    Reservations("Reservations", Icons.Filled.DateRange),
    Profile("Profile", Icons.Filled.Person)
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

    val listingsViewModel: ListingsViewModel = viewModel()
    val listingsState by listingsViewModel.state.collectAsState()

    val bookingsViewModel: BookingsViewModel = viewModel()
    val reservationsState by bookingsViewModel.reservations.collectAsState()
    val reserveState by bookingsViewModel.reserve.collectAsState()

    var selectedTab by remember { mutableIntStateOf(Tab.Explore.ordinal) }
    var selectedListing by remember { mutableStateOf<Listing?>(null) }
    // When true, the Profile/Reservations tab shows the full AuthScreen instead of the CTA.
    var showAuth by remember { mutableStateOf(false) }

    val activity = LocalContext.current as? MainActivity

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

    // After a successful sign-in, drop the auth screen and return to the profile.
    LaunchedEffect(authState.isAuthenticated) {
        if (authState.isAuthenticated) showAuth = false
    }

    // Keep the Reservations tab in sync with auth: load on sign-in, clear on sign-out.
    LaunchedEffect(authState.isAuthenticated) {
        if (authState.isAuthenticated) bookingsViewModel.loadReservations()
        else bookingsViewModel.clearReservations()
    }

    // Refresh reservations whenever the user opens the tab while signed in.
    LaunchedEffect(selectedTab) {
        if (selectedTab == Tab.Reservations.ordinal && authState.isAuthenticated) {
            bookingsViewModel.loadReservations()
        }
    }

    val current = selectedListing
    // The detail view is full-screen (no bottom bar); everything else is in the Scaffold.
    if (current != null) {
        ListingDetailScreen(
            listing = current,
            onBack = {
                bookingsViewModel.resetReserve()
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
            onResetReserve = bookingsViewModel::resetReserve
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
                authViewModel.showAuthMessage(
                    "Add your Google client id in Config.kt to enable Google sign-in"
                )
            },
            onBack = {
                authViewModel.clearError()
                showAuth = false
            }
        )
        return
    }

    Scaffold(
        containerColor = Cream,
        bottomBar = {
            NavigationBar(containerColor = Cream) {
                Tab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = selectedTab == tab.ordinal,
                        onClick = { selectedTab = tab.ordinal },
                        icon = { Icon(tab.icon, contentDescription = tab.label) },
                        label = { Text(tab.label) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Burgundy,
                            selectedTextColor = Burgundy,
                            unselectedIconColor = Muted,
                            unselectedTextColor = Muted,
                            indicatorColor = Tan
                        )
                    )
                }
            }
        }
    ) { padding ->
        when (Tab.entries[selectedTab]) {
            Tab.Explore -> ListingsScreen(
                state = listingsState,
                onRetry = listingsViewModel::load,
                onSelect = { selectedListing = it },
                onSearch = listingsViewModel::search,
                onClear = listingsViewModel::clear,
                contentPadding = padding
            )
            Tab.Reservations -> ReservationsScreen(
                isAuthenticated = authState.isAuthenticated,
                state = reservationsState,
                onSignIn = {
                    authViewModel.clearError()
                    showAuth = true
                },
                onRetry = bookingsViewModel::loadReservations,
                contentPadding = padding
            )
            Tab.Profile -> if (authState.isAuthenticated) {
                ProfileScreen(
                    state = authState,
                    onLogout = authViewModel::logout,
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
        }
    }
}
