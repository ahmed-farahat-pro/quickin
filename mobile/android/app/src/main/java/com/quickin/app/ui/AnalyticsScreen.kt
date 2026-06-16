package com.quickin.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.EventAvailable
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.CurrencyManager
import com.quickin.app.HostAnalytics
import com.quickin.app.HostAnalyticsUiState
import com.quickin.app.R
import com.quickin.app.TopListing
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Gold
import com.quickin.app.ui.theme.GoldDeep
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.SuccessGreen
import com.quickin.app.ui.theme.Tan

private val ErrorRed = Color(0xFFB3261E)

/**
 * Host "Analytics" dashboard (Section 10, reached from the host area). A grid of stat cards
 * (listings, total + paid bookings, revenue, average rating, conversion — money converted to the
 * user's display currency via [CurrencyManager]), a simple monthly-trend bar chart drawn with plain
 * Compose [Box]es (no chart dependency), and a "Top listings" list. Loads once on first appearance
 * (`GET /api/local/host/analytics`).
 *
 * Bilingual + RTL-safe: every label is a string resource and rows are plain [Row]s that follow the
 * layout direction. Amounts are stored EGP and converted for DISPLAY only.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HostAnalyticsScreen(
    state: HostAnalyticsUiState,
    onBack: () -> Unit,
    onLoad: () -> Unit
) {
    LaunchedEffect(Unit) { if (!state.loaded) onLoad() }

    Scaffold(
        containerColor = CreamPage,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        stringResource(R.string.analytics_title),
                        color = Ink,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.action_back),
                            tint = Ink
                        )
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
            val analytics = state.analytics
            when {
                state.isLoading && analytics == null -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = Burgundy)
                    Text(
                        stringResource(R.string.analytics_loading),
                        color = Muted,
                        modifier = Modifier.padding(top = 12.dp)
                    )
                }
                state.error != null && analytics == null -> AnalyticsErrorState(
                    message = state.error,
                    onRetry = onLoad
                )
                analytics == null || analytics.isEmpty -> AnalyticsEmptyState()
                else -> AnalyticsContent(analytics)
            }
        }
    }
}

@Composable
private fun AnalyticsContent(a: HostAnalytics) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Row 1: listings + revenue.
        item {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                AnalyticsStatCard(
                    icon = Icons.Filled.Home,
                    value = a.listings.toString(),
                    label = stringResource(R.string.analytics_listings),
                    accent = Burgundy,
                    modifier = Modifier.weight(1f)
                )
                AnalyticsStatCard(
                    icon = Icons.Filled.Payments,
                    value = CurrencyManager.format(a.revenue),
                    label = stringResource(R.string.analytics_revenue),
                    accent = SuccessGreen,
                    modifier = Modifier.weight(1f)
                )
            }
        }
        // Row 2: total bookings + paid bookings.
        item {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                AnalyticsStatCard(
                    icon = Icons.Filled.EventAvailable,
                    value = a.totalBookings.toString(),
                    label = stringResource(R.string.analytics_bookings),
                    accent = Ink,
                    modifier = Modifier.weight(1f)
                )
                AnalyticsStatCard(
                    icon = Icons.Filled.CheckCircle,
                    value = a.paidBookings.toString(),
                    label = stringResource(R.string.analytics_paid_bookings),
                    accent = GoldDeep,
                    modifier = Modifier.weight(1f)
                )
            }
        }
        // Row 3: average rating + conversion.
        item {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                AnalyticsStatCard(
                    icon = Icons.Filled.Star,
                    value = if (a.reviewCount > 0) a.avgRatingText else "—",
                    label = stringResource(R.string.analytics_avg_rating),
                    accent = Gold,
                    modifier = Modifier.weight(1f)
                )
                AnalyticsStatCard(
                    icon = Icons.AutoMirrored.Filled.TrendingUp,
                    value = a.conversionPercentText,
                    label = stringResource(R.string.analytics_conversion),
                    accent = Burgundy,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // Monthly trend — a simple bar chart drawn with plain Box()es.
        item {
            BoutiqueCard(modifier = Modifier.fillMaxWidth(), shadow = 6.dp) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.BarChart, null, tint = Burgundy, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(
                            stringResource(R.string.analytics_monthly_trend),
                            color = Ink,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(Modifier.height(14.dp))
                    if (a.byMonth.isEmpty()) {
                        Text(
                            stringResource(R.string.analytics_no_data),
                            color = Muted,
                            fontSize = 14.sp
                        )
                    } else {
                        MonthlyTrendChart(a)
                    }
                }
            }
        }

        // Top listings.
        item {
            Text(
                stringResource(R.string.analytics_top_listings),
                color = Ink,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(start = 4.dp, top = 6.dp)
            )
        }
        if (a.topListings.isEmpty()) {
            item {
                Text(
                    stringResource(R.string.analytics_no_data),
                    color = Muted,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(start = 4.dp)
                )
            }
        } else {
            items(a.topListings) { listing -> TopListingRow(listing) }
        }
    }
}

/**
 * A vertical-bar monthly trend drawn entirely with Compose [Box]es (no chart library). Each bar's
 * height is scaled to the largest revenue in the series; months with no revenue still show a thin
 * baseline. The bar value tooltip is the month's booking count below each column.
 */
@Composable
private fun MonthlyTrendChart(a: HostAnalytics) {
    val maxRevenue = a.byMonth.maxOf { it.revenue }.coerceAtLeast(1.0)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(140.dp),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        a.byMonth.forEach { month ->
            // Fraction of the tallest bar; floor at a sliver so empty months are still visible.
            val fraction = (month.revenue / maxRevenue).coerceIn(0.04, 1.0).toFloat()
            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Bottom
            ) {
                // Booking count above the bar.
                Text(
                    month.bookings.toString(),
                    color = Muted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium
                )
                Spacer(Modifier.height(4.dp))
                // The bar — fills the remaining height proportionally.
                Box(
                    modifier = Modifier
                        .fillMaxHeight(fraction)
                        .fillMaxWidth()
                        .background(Burgundy, RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp))
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    shortMonthLabel(month.month),
                    color = Ink,
                    fontSize = 11.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Clip,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

/** A stat tile (icon + bold value + label) on a white boutique card. */
@Composable
private fun AnalyticsStatCard(
    icon: ImageVector,
    value: String,
    label: String,
    accent: Color,
    modifier: Modifier = Modifier
) {
    BoutiqueCard(modifier = modifier, shadow = 6.dp, radius = 18.dp) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(22.dp))
            Spacer(Modifier.height(8.dp))
            Text(
                value,
                color = Ink,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center
            )
            Text(label, color = Muted, fontSize = 12.sp, textAlign = TextAlign.Center)
        }
    }
}

/** One row in the "Top listings" list: rank + title, with booking count + revenue. */
@Composable
private fun TopListingRow(listing: TopListing) {
    BoutiqueCard(modifier = Modifier.fillMaxWidth(), shadow = 6.dp) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    listing.title,
                    fontWeight = FontWeight.Bold,
                    color = Ink,
                    fontSize = 16.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    stringResource(R.string.analytics_bookings_count, listing.bookings),
                    color = Muted,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
            Spacer(Modifier.width(12.dp))
            Text(
                CurrencyManager.format(listing.revenue),
                color = Burgundy,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun AnalyticsEmptyState() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(32.dp)
    ) {
        Icon(Icons.Filled.Insights, contentDescription = null, tint = Burgundy, modifier = Modifier.size(48.dp))
        Text(
            stringResource(R.string.analytics_empty),
            fontWeight = FontWeight.Bold,
            color = Ink,
            fontSize = 18.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 12.dp)
        )
    }
}

@Composable
private fun AnalyticsErrorState(message: String, onRetry: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(32.dp)
    ) {
        Text(
            stringResource(R.string.analytics_error),
            fontWeight = FontWeight.Bold,
            color = Ink,
            fontSize = 18.sp,
            textAlign = TextAlign.Center
        )
        Text(
            message,
            color = Muted,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp, bottom = 16.dp)
        )
        Button(
            onClick = onRetry,
            colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White)
        ) {
            Text(stringResource(R.string.action_retry))
        }
    }
}

/**
 * Shortens a month label for the chart axis. "2027-03" → "03"; an already-short label (e.g. "Mar")
 * is returned unchanged. Kept locale-stable so the axis reads the same in both languages.
 */
private fun shortMonthLabel(month: String): String {
    val parts = month.split("-")
    return if (parts.size >= 2) parts.last() else month
}
