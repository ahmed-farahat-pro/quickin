package com.quickin.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ViewList
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.quickin.app.Listing
import com.quickin.app.ListingQuery
import com.quickin.app.R
import com.quickin.app.ListingsUiState
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ListingsScreen(
    state: ListingsUiState,
    onRetry: () -> Unit,
    onSelect: (Listing) -> Unit,
    onSearch: (ListingQuery) -> Unit = {},
    onClear: () -> Unit = {},
    contentPadding: PaddingValues = PaddingValues()
) {
    Scaffold(
        containerColor = Cream,
        modifier = Modifier.padding(contentPadding),
        topBar = {
            TopAppBar(
                title = {
                    // Brand logo (small) in the Explore top bar.
                    Image(
                        painter = painterResource(R.drawable.logo),
                        contentDescription = "QuickIn",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.height(34.dp)
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Cream)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(Cream)
        ) {
            SearchHeader(
                query = state.query,
                onSearch = onSearch,
                onClear = onClear
            )

            // List / Map toggle. Defaults to List; both modes render the same searched listings.
            var viewMode by remember { mutableStateOf(ViewMode.List) }
            ViewModeToggle(
                selected = viewMode,
                onSelect = { viewMode = it }
            )

            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                when {
                    state.isLoading && state.listings.isEmpty() -> {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = Burgundy)
                            Text("Finding stays…", color = Muted, modifier = Modifier.padding(top = 12.dp))
                        }
                    }
                    // Keep the empty/error state for List mode; the Map mode handles "no mappable
                    // stays" itself, so still render the map when listings exist.
                    state.listings.isEmpty() && viewMode == ViewMode.List -> {
                        EmptyState(message = state.error ?: "No stays yet.", onRetry = onRetry)
                    }
                    viewMode == ViewMode.Map -> {
                        ListingsMap(
                            listings = state.listings,
                            onSelect = onSelect,
                            onClose = { viewMode = ViewMode.List },
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                    else -> {
                        LazyColumn(
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(20.dp)
                        ) {
                            items(state.listings) { listing ->
                                ListingCard(listing = listing, onClick = { onSelect(listing) })
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Whether the Explore tab shows the card list or the OSM map. */
private enum class ViewMode { List, Map }

/**
 * Segmented List / Map control shown under the search header. The selected segment is filled
 * Burgundy with white content; the unselected segment is plain over the cream background.
 */
@Composable
private fun ViewModeToggle(
    selected: ViewMode,
    onSelect: (ViewMode) -> Unit
) {
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(16.dp),
        shadowElevation = 2.dp,
        modifier = Modifier
            .padding(horizontal = 16.dp)
            .padding(bottom = 4.dp)
    ) {
        Row(modifier = Modifier.padding(4.dp)) {
            ViewModeSegment(
                label = "List",
                icon = Icons.AutoMirrored.Filled.ViewList,
                isSelected = selected == ViewMode.List,
                onClick = { onSelect(ViewMode.List) },
                modifier = Modifier.weight(1f)
            )
            ViewModeSegment(
                label = "Map",
                icon = Icons.Filled.Map,
                isSelected = selected == ViewMode.Map,
                onClick = { onSelect(ViewMode.Map) },
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun ViewModeSegment(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        color = if (isSelected) Burgundy else Color.Transparent,
        contentColor = if (isSelected) Color.White else Muted,
        shape = RoundedCornerShape(12.dp),
        modifier = modifier
            .height(40.dp)
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(icon, contentDescription = null, modifier = Modifier.height(18.dp))
            Spacer(Modifier.width(6.dp))
            Text(label, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
        }
    }
}

/**
 * Search header: a Location field, a tappable Dates row (opens the custom range calendar),
 * a Guests count, and Search + Clear actions. On Search, emits a [ListingQuery]; Clear resets.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SearchHeader(
    query: ListingQuery,
    onSearch: (ListingQuery) -> Unit,
    onClear: () -> Unit
) {
    var location by remember(query) { mutableStateOf(query.location ?: "") }
    var checkIn by remember(query) { mutableStateOf(query.checkIn ?: "") }
    var checkOut by remember(query) { mutableStateOf(query.checkOut ?: "") }
    var guests by remember(query) { mutableStateOf(query.guests?.toString() ?: "") }
    var showDatePicker by remember { mutableStateOf(false) }

    if (showDatePicker) {
        DateRangePickerSheet(
            initialCheckIn = checkIn.ifBlank { null },
            initialCheckOut = checkOut.ifBlank { null },
            onApply = { ci, co ->
                checkIn = ci ?: ""
                checkOut = co ?: ""
                showDatePicker = false
                // Apply immediately runs the search with the chosen dates.
                onSearch(
                    ListingQuery(
                        location = location.trim().ifBlank { null },
                        guests = guests.toIntOrNull()?.takeIf { it > 0 },
                        checkIn = checkIn.ifBlank { null },
                        checkOut = checkOut.ifBlank { null }
                    )
                )
            },
            onDismiss = { showDatePicker = false }
        )
    }

    Surface(
        color = Color.White,
        shape = RoundedCornerShape(22.dp),
        shadowElevation = 3.dp,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            SearchTextField(
                value = location,
                onValueChange = { location = it },
                label = "Where to?",
                leadingIcon = Icons.Filled.LocationOn
            )

            DatesRow(
                checkIn = checkIn,
                checkOut = checkOut,
                onClick = { showDatePicker = true }
            )

            SearchTextField(
                value = guests,
                onValueChange = { input -> guests = input.filter { it.isDigit() }.take(2) },
                label = "Guests",
                leadingIcon = Icons.Filled.People,
                keyboardType = KeyboardType.Number
            )

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(
                    onClick = {
                        onSearch(
                            ListingQuery(
                                location = location.trim().ifBlank { null },
                                guests = guests.toIntOrNull()?.takeIf { it > 0 },
                                checkIn = checkIn.ifBlank { null },
                                checkOut = checkOut.ifBlank { null }
                            )
                        )
                    },
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Burgundy,
                        contentColor = Color.White
                    ),
                    modifier = Modifier
                        .weight(1f)
                        .height(50.dp)
                ) {
                    Icon(Icons.Filled.Search, contentDescription = null, modifier = Modifier.height(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Search", fontWeight = FontWeight.SemiBold)
                }
                OutlinedButton(
                    onClick = {
                        location = ""
                        checkIn = ""
                        checkOut = ""
                        guests = ""
                        onClear()
                    },
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Burgundy),
                    modifier = Modifier.height(50.dp)
                ) {
                    Text("Clear", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
private fun SearchTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    leadingIcon: androidx.compose.ui.graphics.vector.ImageVector,
    keyboardType: KeyboardType = KeyboardType.Text
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = true,
        leadingIcon = { Icon(leadingIcon, contentDescription = null, tint = Burgundy) },
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
        modifier = Modifier.fillMaxWidth()
    )
}

/**
 * A tappable, outlined "Dates" row that opens the custom [DateRangePickerSheet]. Shows the
 * selected range (e.g. "Mar 10 → Mar 14") or the "Add dates" placeholder when empty. Styled to
 * match the other search fields.
 */
@Composable
private fun DatesRow(
    checkIn: String,
    checkOut: String,
    onClick: () -> Unit
) {
    val ci = parseLocalDate(checkIn.ifBlank { null })
    val co = parseLocalDate(checkOut.ifBlank { null })
    val label = when {
        ci != null && co != null -> "${dateChip(ci)} → ${dateChip(co)}"
        ci != null -> "${dateChip(ci)} → Add check-out"
        else -> "Add dates"
    }
    val hasDates = ci != null

    Surface(
        color = Color.White,
        shape = RoundedCornerShape(18.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Tan),
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp)
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Filled.DateRange, contentDescription = null, tint = Burgundy)
            Spacer(Modifier.width(12.dp))
            Text(
                text = label,
                color = if (hasDates) Ink else Muted,
                fontSize = 15.sp,
                fontWeight = if (hasDates) FontWeight.SemiBold else FontWeight.Normal
            )
        }
    }
}

/** "Mar 10" short label for the Dates row. */
private fun dateChip(date: java.time.LocalDate): String =
    "${date.month.getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.ENGLISH)} ${date.dayOfMonth}"

@Composable
private fun EmptyState(message: String, onRetry: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(32.dp)
    ) {
        Text("Nothing to show yet", fontWeight = FontWeight.Bold, color = Ink, fontSize = 18.sp)
        Text(
            message,
            color = Muted,
            modifier = Modifier.padding(top = 8.dp, bottom = 16.dp)
        )
        Button(onClick = onRetry) { Text("Retry") }
    }
}

@Composable
private fun ListingCard(listing: Listing, onClick: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(22.dp),
        color = Color.White,
        shadowElevation = 4.dp,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Column {
            Box {
                AsyncImage(
                    model = listing.sortedImageUrls.first(),
                    contentDescription = listing.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(220.dp)
                        .background(Tan)
                )
                if (listing.isGuestFavorite) {
                    Surface(
                        shape = RoundedCornerShape(50),
                        color = Color.White.copy(alpha = 0.9f),
                        modifier = Modifier.padding(12.dp).align(Alignment.TopEnd)
                    ) {
                        Text(
                            "Guest favorite",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Ink,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                        )
                    }
                }
            }
            Column(modifier = Modifier.padding(14.dp)) {
                Text(listing.title, fontWeight = FontWeight.Bold, color = Ink, fontSize = 16.sp, maxLines = 1)
                if (listing.location != null) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 2.dp)) {
                        Icon(
                            Icons.Filled.LocationOn,
                            contentDescription = null,
                            tint = Burgundy.copy(alpha = 0.7f),
                            modifier = Modifier.height(16.dp)
                        )
                        Text(listing.location, color = Muted, fontSize = 14.sp, maxLines = 1)
                    }
                }
                Row(modifier = Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(listing.priceText, fontWeight = FontWeight.Bold, color = Ink, fontSize = 15.sp)
                    Text(" night", color = Muted, fontSize = 14.sp)
                }
            }
        }
    }
}
