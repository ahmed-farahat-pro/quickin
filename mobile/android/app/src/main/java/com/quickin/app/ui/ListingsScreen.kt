package com.quickin.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import com.quickin.app.ui.theme.GoldLight
import kotlin.math.PI
import kotlin.math.sin
import androidx.compose.foundation.Image
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
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ViewList
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.SwapVert
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FabPosition
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.quickin.app.CurrencyManager
import com.quickin.app.Listing
import com.quickin.app.ListingQuery
import com.quickin.app.ListingSort
import com.quickin.app.R
import com.quickin.app.ListingsUiState
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Gold
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
    onSelectRegion: (String?) -> Unit = {},
    onSelectSort: (ListingSort) -> Unit = {},
    onApplyFilters: (propertyType: String?, amenities: Set<String>) -> Unit = { _, _ -> },
    onClearFilters: () -> Unit = {},
    onSearchArea: (String) -> Unit = {},
    isAuthenticated: Boolean = false,
    onSignIn: () -> Unit = {},
    unreadCount: Int = 0,
    onOpenNotifications: () -> Unit = {},
    savedListingIds: Set<String> = emptySet(),
    onToggleSaved: (Listing) -> Unit = {},
    onOpenAiChat: () -> Unit = {},
    // ---- Natural-language ("Ask AI") search (Section 10) ----
    aiSearchState: com.quickin.app.AiSearchUiState = com.quickin.app.AiSearchUiState(),
    onAiSearch: (String) -> Unit = {},
    onClearAiSearch: () -> Unit = {},
    contentPadding: PaddingValues = PaddingValues()
) {
    // The discovery-filters bottom sheet (amenities + property type).
    var showFilters by remember { mutableStateOf(false) }
    if (showFilters) {
        FiltersSheet(
            selectedPropertyType = state.query.propertyType,
            selectedAmenities = state.query.amenities,
            onApply = { propertyType, amenities ->
                onApplyFilters(propertyType, amenities)
                showFilters = false
            },
            onClear = onClearFilters,
            onDismiss = { showFilters = false }
        )
    }
    Scaffold(
        containerColor = CreamPage,
        modifier = Modifier.padding(contentPadding),
        floatingActionButton = {
            // "Ask AI" travel-concierge entry — burgundy circle with an animated
            // "sun over the sea" mark, bottom-end above the bottom nav.
            FloatingActionButton(
                onClick = onOpenAiChat,
                containerColor = Burgundy,
                contentColor = Color.White,
                shape = CircleShape
            ) {
                VacationWavesIcon(
                    size = 28.dp,
                    contentDescription = stringResource(R.string.cd_ask_ai)
                )
            }
        },
        floatingActionButtonPosition = FabPosition.End,
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
                actions = {
                    if (isAuthenticated) {
                        // Notifications bell with an unread badge (signed-in only).
                        NotificationsBell(
                            unreadCount = unreadCount,
                            onClick = onOpenNotifications
                        )
                    } else {
                        // Login entry point right on the Home tab — opens login/signup.
                        TextButton(onClick = onSignIn) {
                            Text(stringResource(R.string.explore_log_in), color = Burgundy, fontWeight = FontWeight.Bold)
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
            SearchHeader(
                query = state.query,
                onSearch = onSearch,
                onClear = onClear
            )

            // Natural-language ("Ask AI") search — an additional mode over the regular search above.
            NaturalLanguageSearchBar(
                state = aiSearchState,
                onSearch = onAiSearch,
                onClear = onClearAiSearch
            )

            if (aiSearchState.active) {
                // ---- AI search results mode: parsed-filter chips + matched listings ----
                AiSearchResults(
                    state = aiSearchState,
                    onSelect = onSelect,
                    savedListingIds = savedListingIds,
                    onToggleSaved = onToggleSaved,
                    onRetry = { onAiSearch(aiSearchState.query) }
                )
                return@Column
            }

            // Region filter chips ("All" + one per region with its count) + sort control.
            RegionChipsRow(
                regions = state.regions,
                selectedRegion = state.query.region,
                onSelectRegion = onSelectRegion
            )
            // Sort chips (scrollable) led by a Filters button that opens the discovery sheet.
            SortRow(
                selected = state.query.sort,
                onSelect = onSelectSort,
                filterCount = state.query.discoveryFilterCount,
                onOpenFilters = { showFilters = true }
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
                        // Skeleton cards shaped like real listings shimmer in place of a spinner.
                        SkeletonListColumn(imageHeight = 220.dp)
                    }
                    // Keep the empty/error state for List mode; the Map mode handles "no mappable
                    // stays" itself, so still render the map when listings exist.
                    state.listings.isEmpty() && viewMode == ViewMode.List -> {
                        EmptyState(message = state.error ?: stringResource(R.string.explore_no_stays), onRetry = onRetry)
                    }
                    viewMode == ViewMode.Map -> {
                        ListingsMap(
                            listings = state.listings,
                            onSelect = onSelect,
                            onClose = { viewMode = ViewMode.List },
                            onSearchArea = onSearchArea,
                            isSearching = state.isLoading,
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                    else -> {
                        LazyColumn(
                            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 16.dp),
                            verticalArrangement = Arrangement.spacedBy(18.dp)
                        ) {
                            // Boutique hero atop the list: a Ken Burns cover with a gold
                            // eyebrow + a Playfair-style italic headline, drawn from the
                            // first stay's photo (falls back to a tan placeholder).
                            item {
                                ListingsHero(
                                    imageUrl = state.listings.firstOrNull()?.sortedImageUrls?.firstOrNull()
                                )
                            }
                            items(state.listings) { listing ->
                                SlideUpOnAppear {
                                    ListingCard(
                                        listing = listing,
                                        onClick = { onSelect(listing) },
                                        isSaved = savedListingIds.contains(listing.id),
                                        onToggleSaved = { onToggleSaved(listing) }
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

/**
 * The natural-language ("Ask AI") search bar (Section 10). A single text field + an "Ask AI" action
 * that POSTs the prose to `/api/local/ai/search`; the parent shows the parsed filters + matched
 * listings. When a search is active an inline "Clear" chip exits the mode. RTL-safe (a plain Row).
 */
@Composable
private fun NaturalLanguageSearchBar(
    state: com.quickin.app.AiSearchUiState,
    onSearch: (String) -> Unit,
    onClear: () -> Unit
) {
    var query by remember(state.query) { mutableStateOf(state.query) }
    val keyboard = androidx.compose.ui.platform.LocalSoftwareKeyboardController.current

    Surface(
        color = Color.White,
        shape = RoundedCornerShape(22.dp),
        shadowElevation = 3.dp,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .padding(bottom = 8.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.AutoAwesome, contentDescription = null, tint = Burgundy, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    placeholder = { Text(stringResource(R.string.ai_search_placeholder), maxLines = 1) },
                    singleLine = true,
                    shape = RoundedCornerShape(16.dp),
                    keyboardOptions = KeyboardOptions(imeAction = androidx.compose.ui.text.input.ImeAction.Search),
                    keyboardActions = androidx.compose.foundation.text.KeyboardActions(
                        onSearch = { if (query.isNotBlank()) { keyboard?.hide(); onSearch(query) } }
                    ),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Burgundy,
                        unfocusedBorderColor = Tan,
                        cursorColor = Burgundy,
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color.White
                    ),
                    modifier = Modifier.weight(1f)
                )
                Spacer(Modifier.width(8.dp))
                Button(
                    onClick = { if (query.isNotBlank()) { keyboard?.hide(); onSearch(query) } },
                    enabled = !state.isSearching && query.isNotBlank(),
                    shape = RoundedCornerShape(16.dp),
                    contentPadding = PaddingValues(horizontal = 14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White),
                    modifier = Modifier.height(52.dp)
                ) {
                    if (state.isSearching) {
                        androidx.compose.material3.CircularProgressIndicator(
                            color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(18.dp)
                        )
                    } else {
                        Text(stringResource(R.string.ai_search), fontWeight = FontWeight.SemiBold, maxLines = 1)
                    }
                }
            }
            // When a search is active, offer an inline "Clear AI search" affordance.
            if (state.active) {
                TextButton(
                    onClick = { query = ""; onClear() },
                    modifier = Modifier.align(Alignment.End)
                ) {
                    Text(stringResource(R.string.ai_search_clear), color = Burgundy, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

/**
 * Renders an active natural-language search: a chip row of the [AiSearchFilters] the AI parsed
 * ("how we read your search"), then the matched listings (or a loading / empty / error state).
 */
@Composable
private fun AiSearchResults(
    state: com.quickin.app.AiSearchUiState,
    onSelect: (Listing) -> Unit,
    savedListingIds: Set<String>,
    onToggleSaved: (Listing) -> Unit,
    onRetry: () -> Unit
) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        when {
            state.isSearching && state.results.isEmpty() -> {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    androidx.compose.material3.CircularProgressIndicator(color = Burgundy)
                    Text(
                        stringResource(R.string.ai_searching),
                        color = Muted,
                        modifier = Modifier.padding(top = 12.dp)
                    )
                }
            }
            state.error != null && state.results.isEmpty() -> {
                EmptyState(message = state.error, onRetry = onRetry)
            }
            else -> {
                LazyColumn(
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(18.dp)
                ) {
                    // Parsed-filter chips — show the guest how their words were understood.
                    if (state.filters.hasAny) {
                        item { AiParsedFiltersRow(state.filters) }
                    }
                    items(state.results) { listing ->
                        SlideUpOnAppear {
                            ListingCard(
                                listing = listing,
                                onClick = { onSelect(listing) },
                                isSaved = savedListingIds.contains(listing.id),
                                onToggleSaved = { onToggleSaved(listing) }
                            )
                        }
                    }
                }
            }
        }
    }
}

/** A wrapped chip row of the AI-parsed filters, led by a "Parsed filters" label. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AiParsedFiltersRow(filters: com.quickin.app.AiSearchFilters) {
    val chips = buildList {
        filters.q?.takeUnless { it.isBlank() }?.let { add(it) }
        filters.region?.takeUnless { it.isBlank() }?.let { add(it) }
        filters.propertyType?.takeUnless { it.isBlank() }?.let { add(it) }
        filters.guests?.takeIf { it > 0 }?.let { add(stringResource(R.string.search_many_guests, it)) }
        filters.minPrice?.let { add(stringResource(R.string.ai_filter_min_price, CurrencyManager.format(it))) }
        filters.maxPrice?.let { add(stringResource(R.string.ai_filter_max_price, CurrencyManager.format(it))) }
        filters.amenities.forEach { add(it) }
    }
    Column {
        Text(
            stringResource(R.string.ai_parsed_filters),
            color = Muted,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            chips.forEach { label -> AiFilterChip(label) }
        }
    }
}

/** A small burgundy-tinted pill for one parsed AI filter. */
@Composable
private fun AiFilterChip(label: String) {
    Surface(shape = RoundedCornerShape(50), color = Burgundy.copy(alpha = 0.10f)) {
        Text(
            label,
            color = Burgundy,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
        )
    }
}

/**
 * Bell icon in the Explore top bar with a small burgundy unread badge. The badge
 * (a count, capped at "9+") overlays the bell's top-end corner and is hidden at zero.
 */
@Composable
private fun NotificationsBell(unreadCount: Int, onClick: () -> Unit) {
    Box(contentAlignment = Alignment.Center) {
        IconButton(onClick = onClick) {
            Icon(
                Icons.Filled.NotificationsNone,
                contentDescription = stringResource(R.string.cd_notifications),
                tint = Burgundy
            )
        }
        if (unreadCount > 0) {
            Surface(
                color = Burgundy,
                shape = CircleShape,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 6.dp, end = 6.dp)
            ) {
                Text(
                    text = if (unreadCount > 9) "9+" else unreadCount.toString(),
                    color = Color.White,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    modifier = Modifier
                        .defaultMinSize(minWidth = 16.dp, minHeight = 16.dp)
                        .padding(horizontal = 4.dp, vertical = 1.dp)
                )
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
                label = stringResource(R.string.view_list),
                icon = Icons.AutoMirrored.Filled.ViewList,
                isSelected = selected == ViewMode.List,
                onClick = { onSelect(ViewMode.List) },
                modifier = Modifier.weight(1f)
            )
            ViewModeSegment(
                label = stringResource(R.string.view_map),
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
 * Horizontal chip row of curated regions under the search field. Leads with an "All" chip
 * (clears the region filter), then one chip per region showing its count (e.g. "Ain Sokhna · 2").
 * The selected chip is filled Burgundy. Hidden entirely when no regions are available.
 */
@Composable
private fun RegionChipsRow(
    regions: List<com.quickin.app.Region>,
    selectedRegion: String?,
    onSelectRegion: (String?) -> Unit
) {
    if (regions.isEmpty()) return
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        item {
            FilterChipPill(
                label = stringResource(R.string.filter_all),
                selected = selectedRegion == null,
                onClick = { onSelectRegion(null) }
            )
        }
        items(regions) { region ->
            FilterChipPill(
                label = region.chipLabel,
                selected = selectedRegion == region.region,
                onClick = { onSelectRegion(region.region) }
            )
        }
    }
}

/**
 * Sort control under the region chips: a horizontal row of chips
 * (Recommended · Price ↑ · Price ↓ · Newest). Tapping one re-runs the search with `sort=`.
 * Leads with a Filters button (showing a count badge when discovery filters are active) that
 * opens the amenities + property-type sheet.
 */
@Composable
private fun SortRow(
    selected: ListingSort,
    onSelect: (ListingSort) -> Unit,
    filterCount: Int = 0,
    onOpenFilters: () -> Unit = {}
) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 4.dp)
    ) {
        item {
            FiltersButton(count = filterCount, onClick = onOpenFilters)
        }
        item {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(start = 2.dp, end = 2.dp)) {
                Icon(Icons.Filled.SwapVert, contentDescription = null, tint = Muted, modifier = Modifier.size(18.dp))
            }
        }
        items(ListingSort.entries) { sort ->
            FilterChipPill(
                label = stringResource(sort.labelRes),
                selected = selected == sort,
                onClick = { onSelect(sort) }
            )
        }
    }
}

/**
 * The "Filters" entry chip in the sort row: a tune icon + label, filled Burgundy when any
 * discovery filter is active (with the active count), outlined over white otherwise.
 */
@Composable
private fun FiltersButton(count: Int, onClick: () -> Unit) {
    val active = count > 0
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(50),
        color = if (active) Burgundy else Color.White,
        contentColor = if (active) Color.White else Ink,
        border = androidx.compose.foundation.BorderStroke(1.dp, if (active) Burgundy else Tan),
        shadowElevation = if (active) 2.dp else 0.dp
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
        ) {
            Icon(Icons.Filled.Tune, contentDescription = null, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(6.dp))
            Text(
                stringResource(R.string.filters_button),
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1
            )
            if (active) {
                Spacer(Modifier.width(6.dp))
                Surface(color = Color.White, shape = CircleShape) {
                    Text(
                        count.toString(),
                        color = Burgundy,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        modifier = Modifier
                            .defaultMinSize(minWidth = 16.dp, minHeight = 16.dp)
                            .padding(horizontal = 4.dp, vertical = 1.dp)
                    )
                }
            }
        }
    }
}

/** A pill-shaped filter chip: filled Burgundy/white when selected, outlined Tan over white otherwise. */
@Composable
private fun FilterChipPill(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(50),
        color = if (selected) Burgundy else Color.White,
        contentColor = if (selected) Color.White else Ink,
        border = androidx.compose.foundation.BorderStroke(1.dp, if (selected) Burgundy else Tan),
        shadowElevation = if (selected) 2.dp else 0.dp
    ) {
        Text(
            label,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
        )
    }
}

/**
 * The canonical property types the `propertyType=` filter matches (backend contract:
 * Apartment, Chalet, House, Villa). The English [value] is what's sent to the API; [labelRes]
 * is the localized chip label.
 */
private val PROPERTY_TYPE_FILTERS = listOf(
    "Apartment" to R.string.property_type_apartment,
    "Chalet" to R.string.property_type_chalet,
    "House" to R.string.property_type_house,
    "Villa" to R.string.property_type_villa
)

/**
 * The canonical amenities the `amenities=` filter matches (same vocabulary the host add-listing
 * flow uses). The English [value] is what's sent to the API; [labelRes] is the localized label.
 */
private val AMENITY_FILTERS = listOf(
    "WiFi" to R.string.amenity_wifi,
    "Pool" to R.string.amenity_pool,
    "Kitchen" to R.string.amenity_kitchen,
    "Air conditioning" to R.string.amenity_air_conditioning,
    "Free parking" to R.string.amenity_free_parking,
    "Washer" to R.string.amenity_washer,
    "TV" to R.string.amenity_tv,
    "Heating" to R.string.amenity_heating,
    "Workspace" to R.string.amenity_workspace,
    "Gym" to R.string.amenity_gym,
    "Beach access" to R.string.amenity_beach_access,
    "Pets allowed" to R.string.amenity_pets_allowed,
    "Hot tub" to R.string.amenity_hot_tub,
    "BBQ grill" to R.string.amenity_bbq_grill,
    "Breakfast" to R.string.amenity_breakfast
)

/**
 * The discovery-filters bottom sheet: a single-select property-type row (led by an "Any type"
 * chip) and a multi-select amenities grid, plus Clear-all + Show-stays actions. Selections are
 * staged locally and only committed on [onApply]; the canonical English value (not the localized
 * label) is sent to the API. RTL-safe — relies on Compose's automatic mirroring.
 */
@OptIn(ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun FiltersSheet(
    selectedPropertyType: String?,
    selectedAmenities: Set<String>,
    onApply: (propertyType: String?, amenities: Set<String>) -> Unit,
    onClear: () -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    // Staged selections — applied on "Show stays", discarded on dismiss.
    var propertyType by remember { mutableStateOf(selectedPropertyType) }
    var amenities by remember { mutableStateOf(selectedAmenities) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = CreamPage
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 8.dp)
        ) {
            // Title row with a Clear-all action.
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    stringResource(R.string.filters_title),
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = Ink,
                    modifier = Modifier.weight(1f)
                )
                TextButton(
                    onClick = {
                        propertyType = null
                        amenities = emptySet()
                        onClear()
                    }
                ) {
                    Text(stringResource(R.string.filters_clear), color = Burgundy, fontWeight = FontWeight.SemiBold)
                }
            }

            Spacer(Modifier.height(8.dp))

            // Property type — single-select, "Any type" clears it.
            Text(
                stringResource(R.string.filters_property_type),
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = Ink,
                modifier = Modifier.padding(bottom = 10.dp)
            )
            androidx.compose.foundation.layout.FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                FilterChipPill(
                    label = stringResource(R.string.filters_any_type),
                    selected = propertyType == null,
                    onClick = { propertyType = null }
                )
                PROPERTY_TYPE_FILTERS.forEach { (value, labelRes) ->
                    FilterChipPill(
                        label = stringResource(labelRes),
                        selected = propertyType == value,
                        onClick = { propertyType = if (propertyType == value) null else value }
                    )
                }
            }

            Spacer(Modifier.height(20.dp))

            // Amenities — multi-select; the listing must have ALL chosen amenities.
            Text(
                stringResource(R.string.filters_amenities),
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = Ink,
                modifier = Modifier.padding(bottom = 10.dp)
            )
            androidx.compose.foundation.layout.FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                AMENITY_FILTERS.forEach { (value, labelRes) ->
                    val on = amenities.contains(value)
                    FilterChipPill(
                        label = stringResource(labelRes),
                        selected = on,
                        onClick = {
                            amenities = if (on) amenities - value else amenities + value
                        }
                    )
                }
            }

            Spacer(Modifier.height(24.dp))

            // Apply — commits the staged selections and runs the search.
            Button(
                onClick = { onApply(propertyType, amenities) },
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
            ) {
                Text(stringResource(R.string.filters_apply), fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }

            Spacer(Modifier.height(8.dp))
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
    // Collapsed by default so listings own the screen; tap the bar to expand the form.
    var expanded by remember { mutableStateOf(false) }

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

    // Summary shown on the collapsed bar.
    val titleText = location.ifBlank { stringResource(R.string.search_where_to) }
    val datesText = if (checkIn.isNotBlank() && checkOut.isNotBlank())
        stringResource(R.string.search_dates_selected) else stringResource(R.string.search_anytime)
    val guestCount = guests.toIntOrNull()?.takeIf { it > 0 }
    val guestsText = when {
        guestCount == null -> stringResource(R.string.search_any_guests)
        guestCount == 1 -> stringResource(R.string.search_one_guest)
        else -> stringResource(R.string.search_many_guests, guestCount)
    }

    Surface(
        color = Color.White,
        shape = RoundedCornerShape(22.dp),
        shadowElevation = 3.dp,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        Column {
            // Collapsed/clickable bar — tap to expand or collapse the full form.
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { expanded = !expanded }
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Filled.Search, contentDescription = null, tint = Burgundy)
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        if (expanded) stringResource(R.string.search_search_stays) else titleText,
                        color = Ink,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp,
                        maxLines = 1
                    )
                    if (!expanded) {
                        Text(
                            stringResource(R.string.search_summary, datesText, guestsText),
                            color = Muted,
                            fontSize = 12.sp,
                            maxLines = 1
                        )
                    }
                }
                Icon(
                    if (expanded) Icons.Filled.KeyboardArrowUp else Icons.Filled.Tune,
                    contentDescription = stringResource(if (expanded) R.string.search_collapse else R.string.search_expand),
                    tint = Burgundy
                )
            }

            AnimatedVisibility(
                visible = expanded,
                enter = expandVertically() + fadeIn(),
                exit = shrinkVertically() + fadeOut()
            ) {
                Column(
                    modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    SearchTextField(
                        value = location,
                        onValueChange = { location = it },
                        label = stringResource(R.string.search_where_to),
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
                        label = stringResource(R.string.search_guests),
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
                                expanded = false
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
                            Text(stringResource(R.string.action_search), fontWeight = FontWeight.SemiBold)
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
                            Text(stringResource(R.string.action_clear), fontWeight = FontWeight.SemiBold)
                        }
                    }
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
        ci != null -> "${dateChip(ci)} → ${stringResource(R.string.search_add_checkout)}"
        else -> stringResource(R.string.search_add_dates)
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
        Text(stringResource(R.string.explore_nothing_to_show), fontWeight = FontWeight.Bold, color = Ink, fontSize = 18.sp)
        Text(
            message,
            color = Muted,
            modifier = Modifier.padding(top = 8.dp, bottom = 16.dp)
        )
        Button(onClick = onRetry) { Text(stringResource(R.string.action_retry)) }
    }
}

/**
 * Boutique explore hero: a Ken Burns cover photo with a dark legibility gradient, a gold
 * eyebrow ("NORTH COAST · EGYPT") and a Playfair-style italic headline. Sits at the top of
 * the list to set the tone, mirroring the web/iOS redesign.
 */
@Composable
private fun ListingsHero(imageUrl: String?) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(210.dp)
            .clip(RoundedCornerShape(CardRadius))
    ) {
        KenBurnsImage(
            url = imageUrl,
            contentDescription = null,
            modifier = Modifier.fillMaxSize()
        )
        // Legibility overlay (transparent → dark at the bottom).
        Box(
            modifier = Modifier
                .matchParentSize()
                .background(
                    Brush.verticalGradient(
                        0f to Color.Transparent,
                        0.45f to Color.Transparent,
                        1f to Ink.copy(alpha = 0.62f)
                    )
                )
        )
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(20.dp)
        ) {
            GoldEyebrow(stringResource(R.string.hero_eyebrow))
            Spacer(Modifier.height(6.dp))
            Text(
                stringResource(R.string.hero_title),
                color = Color.White,
                fontSize = 26.sp,
                fontWeight = FontWeight.Bold,
                fontStyle = FontStyle.Italic,
                fontFamily = FontFamily.Serif,
                lineHeight = 30.sp
            )
        }
    }
}

@Composable
private fun ListingCard(
    listing: Listing,
    onClick: () -> Unit,
    isSaved: Boolean = false,
    onToggleSaved: () -> Unit = {}
) {
    BoutiqueCard(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick,
        shadow = 10.dp,
        radius = CardRadius
    ) {
        Column {
            // Full-bleed cover with a photo-overlay gradient; gold ★ favorite badge (pop-in)
            // top-start, springy heart top-end. The image gently zooms (Ken Burns) for life.
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(210.dp)
                    .clip(RoundedCornerShape(topStart = CardRadius, topEnd = CardRadius))
            ) {
                val imageUrl = listing.sortedImageUrls.firstOrNull()
                KenBurnsImage(
                    url = imageUrl,
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
                if (listing.isGuestFavorite) {
                    PopIn(modifier = Modifier.align(Alignment.TopStart).padding(12.dp)) {
                        Surface(
                            shape = RoundedCornerShape(50),
                            color = Color.White.copy(alpha = 0.94f),
                            shadowElevation = 2.dp
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 11.dp, vertical = 6.dp)
                            ) {
                                Icon(
                                    Icons.Filled.Star,
                                    contentDescription = null,
                                    tint = Gold,
                                    modifier = Modifier.size(13.dp)
                                )
                                Spacer(Modifier.width(4.dp))
                                Text(
                                    stringResource(R.string.listing_guest_favorite),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Ink
                                )
                            }
                        }
                    }
                }
                HeartButton(
                    modifier = Modifier.align(Alignment.TopEnd).padding(11.dp),
                    filled = isSaved,
                    onToggle = onToggleSaved
                )
            }
            Column(modifier = Modifier.padding(start = 18.dp, end = 18.dp, top = 14.dp, bottom = 18.dp)) {
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
                    // Real rating (gold ★ + value) or a "New" tag when there are no reviews yet.
                    RatingOrNew(rating = listing.rating, reviewCount = listing.reviewCount)
                }
                if (listing.location != null) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                        Icon(
                            Icons.Filled.LocationOn,
                            contentDescription = null,
                            tint = Muted,
                            modifier = Modifier.size(15.dp)
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(listing.location, color = Muted, fontSize = 14.sp, maxLines = 1)
                    }
                }
                Row(
                    modifier = Modifier.padding(top = 10.dp),
                    verticalAlignment = Alignment.Bottom
                ) {
                    Text(
                        com.quickin.app.CurrencyManager.format(listing.pricePerNight),
                        fontWeight = FontWeight.Bold,
                        color = Burgundy,
                        fontSize = 17.sp
                    )
                    Text(stringResource(R.string.listing_per_night), color = Muted, fontSize = 14.sp)
                }
            }
        }
    }
}

/**
 * Animated "sun over the sea" mark for the AI travel-concierge FAB: a gold sun
 * and two scrolling cream/gold sine waves drawn on a [Canvas], looping forever.
 * Vacation-themed and continuously animated.
 */
@Composable
private fun VacationWavesIcon(size: Dp = 28.dp, contentDescription: String = "") {
    val transition = rememberInfiniteTransition(label = "waves")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = (2.0 * PI).toFloat(),
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 2400, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "phase"
    )
    Canvas(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .semantics { this.contentDescription = contentDescription }
    ) {
        val w = this.size.width
        val h = this.size.height

        fun wavePath(baseline: Float, amp: Float, wavelength: Float, ph: Float): Path {
            val p = Path()
            p.moveTo(0f, baseline)
            var x = 0f
            while (x <= w) {
                val y = baseline + amp * sin((x / wavelength) * 2f * PI.toFloat() + ph)
                p.lineTo(x, y)
                x += 2f
            }
            p.lineTo(w, h)
            p.lineTo(0f, h)
            p.close()
            return p
        }

        // Sun (upper-trailing).
        drawCircle(color = GoldLight, radius = h * 0.13f, center = Offset(w * 0.72f, h * 0.26f))
        // Back wave (gold, translucent) + front wave (cream).
        drawPath(wavePath(h * 0.56f, h * 0.07f, w * 0.72f, phase), color = GoldLight.copy(alpha = 0.55f))
        drawPath(wavePath(h * 0.66f, h * 0.085f, w * 0.58f, phase + (PI * 0.9).toFloat()), color = Cream)
    }
}
