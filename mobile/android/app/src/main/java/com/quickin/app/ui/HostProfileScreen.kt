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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.LocationOn
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.HostProfileUiState
import com.quickin.app.HostReview
import com.quickin.app.Listing
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Gold
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

/**
 * The public profile of a host, reached by tapping the "Hosted by …" row on a listing detail.
 * Shows the host's avatar, name, bio, trust badges, host rating + member-since, the reviews
 * written about their listings, and their other listings (each opening its own detail).
 *
 * Privacy-safe: the backing [com.quickin.app.PublicProfile] carries NO phone/email — only what's
 * safe to show a guest browsing a host. RTL-safe (logical start/end, localized copy).
 *
 * @param hostName a fallback name shown in the app bar while the profile loads (from the listing).
 * @param onOpenListing opens one of the host's listings in its own detail screen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HostProfileScreen(
    state: HostProfileUiState,
    hostName: String?,
    onBack: () -> Unit,
    onOpenListing: (Listing) -> Unit
) {
    val profile = state.profile
    val displayName = profile?.fullName?.takeUnless { it.isBlank() }
        ?: hostName?.takeUnless { it.isBlank() }
        ?: stringResource(R.string.host_profile_title)

    Scaffold(
        containerColor = CreamPage,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        stringResource(R.string.host_profile_title),
                        color = Ink,
                        fontWeight = FontWeight.SemiBold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.cd_back),
                            tint = Ink
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = CreamPage)
            )
        }
    ) { padding ->
        when {
            state.isLoading && profile == null -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = Burgundy)
                }
            }
            profile == null -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        state.error ?: stringResource(R.string.host_profile_error),
                        color = Muted,
                        fontSize = 15.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(bottom = padding.calculateBottomPadding())
                        .background(CreamPage),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(top = padding.calculateTopPadding())
                ) {
                    // ---- Header: avatar + name + badges + rating/member-since + bio ----
                    item {
                        HostHeader(state = state, displayName = displayName)
                    }

                    // ---- Reviews about the host's listings ----
                    if (state.reviews.isNotEmpty()) {
                        item {
                            SectionHeader(
                                stringResource(R.string.host_profile_reviews),
                                modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp)
                            )
                        }
                        items(state.reviews, key = { it.id }) { review ->
                            Box(modifier = Modifier.padding(horizontal = 20.dp, vertical = 6.dp)) {
                                HostReviewCard(review)
                            }
                        }
                        item { Spacer(Modifier.height(8.dp)) }
                    }

                    // ---- The host's other listings (full-bleed rail) ----
                    if (state.listings.isNotEmpty()) {
                        item {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 8.dp, bottom = 24.dp),
                                verticalArrangement = Arrangement.spacedBy(14.dp)
                            ) {
                                SectionHeader(
                                    stringResource(R.string.host_profile_listings),
                                    modifier = Modifier.padding(horizontal = 20.dp)
                                )
                                LazyRow(
                                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 20.dp),
                                    horizontalArrangement = Arrangement.spacedBy(14.dp)
                                ) {
                                    items(state.listings, key = { it.id }) { listing ->
                                        HostProfileListingCard(
                                            listing = listing,
                                            onClick = { onOpenListing(listing) }
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
}

/** The host-profile header: large avatar, name, trust badges, rating + member-since, and bio. */
@Composable
private fun HostHeader(state: HostProfileUiState, displayName: String) {
    val profile = state.profile ?: return
    val badges = profile.badges
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            ProfileAvatar(
                avatarUrl = profile.avatarUrl,
                initials = initialsFor(displayName),
                size = 72.dp,
                contentDescription = displayName
            )
            Spacer(Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    displayName,
                    color = Ink,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    fontStyle = FontStyle.Italic,
                    fontFamily = FontFamily.Serif,
                    maxLines = 2
                )
                // The host's rating (gold ★ + value · count), or a "New host" tag when unrated.
                Spacer(Modifier.height(6.dp))
                // Resolve the plural here (composable scope) — passing it into the count lambda,
                // which RatingOrNew invokes for display.
                val reviewCountLabel = androidx.compose.ui.res.pluralStringResource(
                    R.plurals.reviews_count, badges.reviewCount, badges.reviewCount
                )
                RatingOrNew(
                    rating = badges.hostRating,
                    reviewCount = badges.reviewCount,
                    starSize = 15.dp,
                    fontSize = 14.sp,
                    countText = { "· $reviewCountLabel" }
                )
            }
        }

        // Trust badges (Verified / Superhost / New host) — reused from the listing detail.
        TrustBadgeRow(badges = badges)

        // "Member since {Month Year}" — only when the backend supplied a join date.
        val memberSince = formatMemberSince(badges.memberSince)
        if (memberSince != null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Filled.CalendarMonth,
                    contentDescription = null,
                    tint = Muted,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    stringResource(R.string.host_profile_member_since, memberSince),
                    color = Muted,
                    fontSize = 14.sp
                )
            }
        }

        // The host's bio, when present.
        val bio = profile.bio?.takeUnless { it.isBlank() }
        if (bio != null) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SectionHeader(stringResource(R.string.host_profile_about))
                Text(bio, color = Muted, fontSize = 15.sp, lineHeight = 22.sp)
            }
        }
    }
}

/**
 * One review about the host's listings: a gold star row + reviewer name, the listing it's about,
 * the comment, and any attached photos. Mirrors the listing-detail review card.
 */
@Composable
private fun HostReviewCard(review: HostReview) {
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
                    review.reviewerName?.takeUnless { it.isBlank() }
                        ?: stringResource(R.string.profile_guest),
                    fontWeight = FontWeight.SemiBold,
                    color = Ink,
                    fontSize = 14.sp,
                    maxLines = 1
                )
            }
            // Which stay the review is about (e.g. "Stay: Seaside Villa").
            review.listingTitle?.takeUnless { it.isBlank() }?.let { title ->
                Text(
                    stringResource(R.string.host_profile_review_for, title),
                    color = Muted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1
                )
            }
            if (!review.comment.isNullOrBlank()) {
                Text(review.comment, color = Muted, fontSize = 14.sp, lineHeight = 20.sp)
            }
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
 * A compact, fixed-width listing card for the host profile's listings rail: a cover image
 * constrained to a fixed box, title, location and price. Tapping opens the listing's detail.
 * The cover is constrained (fixed-height Box + Crop) so it never sizes to the image's pixels.
 */
@Composable
private fun HostProfileListingCard(
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

/** First letters of up to two name parts, e.g. "Layla Hassan" -> "LH" (for the avatar fallback). */
private fun initialsFor(name: String): String {
    val parts = name.trim().split(Regex("\\s+")).filter { it.isNotBlank() }
    return when {
        parts.isEmpty() -> "?"
        parts.size == 1 -> parts[0].take(1).uppercase()
        else -> (parts[0].take(1) + parts.last().take(1)).uppercase()
    }
}

/**
 * Formats an ISO-8601 join timestamp (e.g. "2023-05-01T…") into a localized "Month Year"
 * (e.g. "May 2023"). Returns null when [raw] is null/blank or can't be parsed, so the caller
 * simply hides the member-since row.
 */
private fun formatMemberSince(raw: String?): String? {
    val value = raw?.takeUnless { it.isBlank() } ?: return null
    return runCatching {
        val date = java.time.OffsetDateTime.parse(value).toLocalDate()
        val formatter = java.time.format.DateTimeFormatter.ofPattern("MMMM yyyy", java.util.Locale.getDefault())
        date.format(formatter)
    }.recoverCatching {
        // Fall back to a bare date (yyyy-MM-dd) when there's no time/zone component.
        val date = java.time.LocalDate.parse(value.take(10))
        val formatter = java.time.format.DateTimeFormatter.ofPattern("MMMM yyyy", java.util.Locale.getDefault())
        date.format(formatter)
    }.getOrNull()
}
