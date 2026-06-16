package com.quickin.app.ui

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Sailing
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.quickin.app.Listing
import com.quickin.app.R
import com.quickin.app.Service
import com.quickin.app.WishlistUiState
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

/**
 * "Saved" screen — the user's wishlist. Lists saved stays and experiences as the redesigned
 * boutique cards (tappable into their detail screens), each with a filled heart that unsaves it.
 * Shows a loading state, an error retry, and a friendly empty state. Reached from Profile.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WishlistScreen(
    state: WishlistUiState,
    /**
     * The authoritative auth state (from AuthViewModel). Drives the signed-out vs empty
     * distinction: an empty/null wishlist while signed in is an EMPTY state, never a sign-in wall.
     */
    isAuthenticated: Boolean,
    onBack: () -> Unit,
    onLoad: () -> Unit,
    onSignIn: () -> Unit = {},
    onOpenListing: (Listing) -> Unit = {},
    onOpenService: (Service) -> Unit = {},
    onToggleListing: (Listing) -> Unit = {},
    onToggleService: (Service) -> Unit = {}
) {
    Scaffold(
        containerColor = CreamPage,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.wishlist_title), color = Ink, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_back), tint = Ink)
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
                state.isLoading && state.data.isEmpty -> {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = Burgundy)
                        Text(stringResource(R.string.wishlist_loading), color = Muted, modifier = Modifier.padding(top = 12.dp))
                    }
                }
                // Genuinely signed out (no session) AND nothing to show → a sign-in prompt. Checked
                // BEFORE the empty/error branches so an empty or 401 API result while signed in is
                // never mistaken for signed-out (that path falls through to the friendly empty state).
                !isAuthenticated && state.data.isEmpty -> WishlistSignedOut(onSignIn = onSignIn)
                state.error != null && state.data.isEmpty -> {
                    EmptyState(message = state.error, onRetry = onLoad)
                }
                state.data.isEmpty -> WishlistEmpty()
                else -> {
                    LazyColumn(
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        if (state.data.listings.isNotEmpty()) {
                            item {
                                SectionHeader(
                                    stringResource(R.string.wishlist_stays),
                                    eyebrow = stringResource(R.string.wishlist_eyebrow)
                                )
                            }
                            items(state.data.listings) { listing ->
                                SlideUpOnAppear {
                                    SavedListingCard(
                                        listing = listing,
                                        onClick = { onOpenListing(listing) },
                                        onToggleSaved = { onToggleListing(listing) }
                                    )
                                }
                            }
                        }
                        if (state.data.services.isNotEmpty()) {
                            item {
                                SectionHeader(stringResource(R.string.wishlist_experiences))
                            }
                            items(state.data.services) { service ->
                                SlideUpOnAppear {
                                    SavedServiceCard(
                                        service = service,
                                        onClick = { onOpenService(service) },
                                        onToggleSaved = { onToggleService(service) }
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

/** Saved stay card: a full-bleed Ken Burns cover with a filled heart (unsave), title, location, price + rating. */
@Composable
private fun SavedListingCard(
    listing: Listing,
    onClick: () -> Unit,
    onToggleSaved: () -> Unit
) {
    BoutiqueCard(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick,
        shadow = 8.dp,
        radius = CardRadius
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(190.dp)
                    .clip(RoundedCornerShape(topStart = CardRadius, topEnd = CardRadius))
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
                HeartButton(
                    modifier = Modifier.align(Alignment.TopEnd).padding(11.dp),
                    filled = true,
                    onToggle = onToggleSaved
                )
            }
            Column(modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        listing.title,
                        fontWeight = FontWeight.Bold,
                        color = Ink,
                        fontSize = 17.sp,
                        maxLines = 1,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                    Spacer(Modifier.width(8.dp))
                    RatingOrNew(rating = listing.rating, reviewCount = listing.reviewCount)
                }
                if (listing.location != null) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                        Icon(Icons.Filled.LocationOn, contentDescription = null, tint = Muted, modifier = Modifier.size(15.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(listing.location, color = Muted, fontSize = 14.sp, maxLines = 1)
                    }
                }
                Row(modifier = Modifier.padding(top = 8.dp), verticalAlignment = Alignment.Bottom) {
                    Text(listing.priceText, fontWeight = FontWeight.Bold, color = Burgundy, fontSize = 16.sp)
                    Text(stringResource(R.string.listing_per_night), color = Muted, fontSize = 14.sp)
                }
            }
        }
    }
}

/** Saved experience card: cover (or sailing placeholder) with a filled heart, title, location, price. */
@Composable
private fun SavedServiceCard(
    service: Service,
    onClick: () -> Unit,
    onToggleSaved: () -> Unit
) {
    BoutiqueCard(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick,
        shadow = 8.dp,
        radius = CardRadius
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(190.dp)
                    .clip(RoundedCornerShape(topStart = CardRadius, topEnd = CardRadius))
            ) {
                val imageUrl = service.image
                if (imageUrl != null) {
                    AsyncImage(
                        model = imageUrl,
                        contentDescription = service.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize().background(Tan)
                    )
                } else {
                    PhotoPlaceholder(modifier = Modifier.fillMaxSize(), icon = Icons.Filled.Sailing)
                }
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
                HeartButton(
                    modifier = Modifier.align(Alignment.TopEnd).padding(11.dp),
                    filled = true,
                    onToggle = onToggleSaved
                )
            }
            Column(modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 16.dp)) {
                Text(service.title, fontWeight = FontWeight.Bold, color = Ink, fontSize = 17.sp, maxLines = 1)
                if (!service.location.isNullOrBlank()) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                        Icon(Icons.Filled.LocationOn, contentDescription = null, tint = Muted, modifier = Modifier.size(15.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(service.location, color = Muted, fontSize = 14.sp, maxLines = 1)
                    }
                }
                Row(modifier = Modifier.padding(top = 8.dp), verticalAlignment = Alignment.Bottom) {
                    Text(service.priceText, fontWeight = FontWeight.Bold, color = Burgundy, fontSize = 16.sp)
                    Text(stringResource(R.string.services_per_experience), color = Muted, fontSize = 14.sp)
                }
            }
        }
    }
}

/** Friendly empty state for the Saved screen: an outlined heart, a title, and a hint. */
@Composable
private fun WishlistEmpty() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(32.dp)
    ) {
        Surface(
            shape = androidx.compose.foundation.shape.CircleShape,
            color = Burgundy.copy(alpha = 0.10f),
            modifier = Modifier.size(72.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.FavoriteBorder, contentDescription = null, tint = Burgundy, modifier = Modifier.size(34.dp))
            }
        }
        Text(
            stringResource(R.string.wishlist_empty_title),
            fontWeight = FontWeight.Bold,
            color = Ink,
            fontSize = 18.sp,
            modifier = Modifier.padding(top = 16.dp)
        )
        Text(
            stringResource(R.string.wishlist_empty_subtitle),
            color = Muted,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}

/**
 * Signed-out state for the Saved screen: an outlined heart, a title, a prompt, and a sign-in CTA.
 * Shown ONLY when there's genuinely no session — distinct from the signed-in-but-empty state.
 */
@Composable
private fun WishlistSignedOut(onSignIn: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(32.dp)
    ) {
        Surface(
            shape = androidx.compose.foundation.shape.CircleShape,
            color = Burgundy.copy(alpha = 0.10f),
            modifier = Modifier.size(72.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.FavoriteBorder, contentDescription = null, tint = Burgundy, modifier = Modifier.size(34.dp))
            }
        }
        Text(
            stringResource(R.string.wishlist_empty_title),
            fontWeight = FontWeight.Bold,
            color = Ink,
            fontSize = 18.sp,
            modifier = Modifier.padding(top = 16.dp)
        )
        Text(
            stringResource(R.string.wishlist_sign_in),
            color = Muted,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp, bottom = 16.dp)
        )
        androidx.compose.material3.Button(
            onClick = onSignIn,
            colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White)
        ) { Text(stringResource(R.string.profile_cta_button)) }
    }
}

/** Compact error/empty fallback with a retry button (mirrors the explore empty state). */
@Composable
private fun EmptyState(message: String, onRetry: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(32.dp)
    ) {
        Text(stringResource(R.string.wishlist_empty_title), fontWeight = FontWeight.Bold, color = Ink, fontSize = 18.sp)
        Text(message, color = Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp, bottom = 16.dp))
        androidx.compose.material3.Button(
            onClick = onRetry,
            colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White)
        ) { Text(stringResource(R.string.action_retry)) }
    }
}
