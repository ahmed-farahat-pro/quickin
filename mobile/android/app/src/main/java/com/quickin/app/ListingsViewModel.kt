package com.quickin.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ListingsUiState(
    val isLoading: Boolean = false,
    val listings: List<Listing> = emptyList(),
    val error: String? = null,
    /** The filters used for the current results (so the header can reflect / clear them). */
    val query: ListingQuery = ListingQuery(),
    /** Curated browse regions with counts (`GET /api/local/regions`) for the chip row. */
    val regions: List<Region> = emptyList()
)

/**
 * The "More from this host" rail on the listing detail (`GET /api/local/listings?host=<id>`).
 * [hostId] is the host the rail was loaded for, so a stale result for a previously-opened
 * listing can be ignored. The current listing is excluded by the screen, not here.
 */
data class MoreFromHostUiState(
    val hostId: String? = null,
    val listings: List<Listing> = emptyList()
)

/**
 * State for the natural-language ("Ask AI") search on the explore screen (Section 10,
 * `POST /api/local/ai/search`). This is an ADDITIONAL search mode that sits alongside the regular
 * filter search — it never mutates [ListingsUiState]. When [active] is true the screen shows the
 * AI [results] plus the parsed [filters] as chips; clearing it returns to the regular feed.
 *
 * [query] is the prose the guest typed (echoed back on the bar), [isSearching] drives the spinner,
 * and [error] surfaces a friendly note when the AI is unavailable.
 */
data class AiSearchUiState(
    val active: Boolean = false,
    val isSearching: Boolean = false,
    val query: String = "",
    val filters: AiSearchFilters = AiSearchFilters(),
    val results: List<Listing> = emptyList(),
    val error: String? = null
)

class ListingsViewModel : ViewModel() {
    private val _state = MutableStateFlow(ListingsUiState())
    val state: StateFlow<ListingsUiState> = _state.asStateFlow()

    // Natural-language ("Ask AI") search — an additional mode over the regular filter search.
    private val _aiSearch = MutableStateFlow(AiSearchUiState())
    val aiSearch: StateFlow<AiSearchUiState> = _aiSearch.asStateFlow()

    // "More from this host" rail for the currently-open listing detail.
    private val _hostListings = MutableStateFlow(MoreFromHostUiState())
    val hostListings: StateFlow<MoreFromHostUiState> = _hostListings.asStateFlow()

    // A listing fetched for an incoming deep link (https://…/explore/{id} or quickin://explore/{id}).
    // MainApp observes this and opens the detail; null once consumed (or when the fetch failed).
    private val _deepLinkListing = MutableStateFlow<Listing?>(null)
    val deepLinkListing: StateFlow<Listing?> = _deepLinkListing.asStateFlow()

    // Place-autocomplete suggestions for the Explore search location field
    // (`GET /api/local/places?q=…`). Debounced; cleared when a suggestion is chosen or the query is short.
    private val _placeSuggestions = MutableStateFlow<List<String>>(emptyList())
    val placeSuggestions: StateFlow<List<String>> = _placeSuggestions.asStateFlow()
    private var placeSuggestJob: Job? = null

    init {
        load()
        loadRegions()
    }

    /**
     * Resolves a deep-linked listing by id (`GET /api/local/listings/:id`) and publishes it on
     * [deepLinkListing] for the UI to open. A missing/invalid id or a fetch failure is silently
     * ignored so a garbage link just leaves the app where it was.
     */
    fun openListingById(id: String) {
        if (id.isBlank()) return
        viewModelScope.launch {
            SupabaseService.fetchListing(id)?.let { _deepLinkListing.value = it }
        }
    }

    /** Consumed by the UI once the deep-linked listing has been opened. */
    fun clearDeepLinkListing() {
        _deepLinkListing.value = null
    }

    /**
     * Loads the host's other listings for the detail's "More from this host" rail. Clears the
     * rail immediately (so a different host's stays never flash) and refetches; a blank
     * [hostId] just clears it. Best-effort — failures yield an empty rail (the section hides).
     */
    fun loadHostListings(hostId: String?) {
        val id = hostId?.takeIf { it.isNotBlank() }
        _hostListings.value = MoreFromHostUiState(hostId = id)
        if (id == null) return
        viewModelScope.launch {
            val listings = SupabaseService.fetchHostListings(id)
            // Ignore a result that arrived after the user opened a different host's listing.
            if (_hostListings.value.hostId == id) {
                _hostListings.value = MoreFromHostUiState(hostId = id, listings = listings)
            }
        }
    }

    /** Clears the "More from this host" rail (on leaving the detail screen). */
    fun clearHostListings() {
        _hostListings.value = MoreFromHostUiState()
    }

    /**
     * Runs a natural-language search (`POST /api/local/ai/search`): the AI parses [query] into
     * structured filters and returns matching listings. This is an additional mode — it never
     * touches the regular filter search/feed. A blank [query] just clears AI mode.
     */
    fun aiSearch(query: String) {
        val q = query.trim()
        if (q.isBlank()) {
            clearAiSearch()
            return
        }
        if (_aiSearch.value.isSearching) return
        _aiSearch.value = AiSearchUiState(active = true, isSearching = true, query = q)
        viewModelScope.launch {
            try {
                val result = SupabaseService.aiSearch(q)
                _aiSearch.value = AiSearchUiState(
                    active = true,
                    isSearching = false,
                    query = q,
                    filters = result.filters,
                    results = result.listings,
                    error = if (result.listings.isEmpty()) "No stays matched. Try rephrasing your search." else null
                )
            } catch (e: Exception) {
                _aiSearch.value = AiSearchUiState(
                    active = true,
                    isSearching = false,
                    query = q,
                    error = e.message ?: "AI search isn't available right now."
                )
            }
        }
    }

    /** Exits AI search mode and returns the screen to the regular filtered feed. */
    fun clearAiSearch() {
        _aiSearch.value = AiSearchUiState()
    }

    /**
     * Fetches place suggestions for the Explore location typeahead (`GET /api/local/places?q=…`),
     * debounced ~250ms so it fires once the user pauses typing. A short (<2 char) query clears the
     * list. Best-effort — a failed lookup just yields no suggestions.
     */
    fun suggestPlaces(query: String) {
        val q = query.trim()
        placeSuggestJob?.cancel()
        if (q.length < 2) {
            _placeSuggestions.value = emptyList()
            return
        }
        placeSuggestJob = viewModelScope.launch {
            kotlinx.coroutines.delay(250)
            val results = try { PlacesService.suggest(q) } catch (e: Exception) { emptyList() }
            _placeSuggestions.value = results
        }
    }

    /** Clears the place-suggestion dropdown (a suggestion was chosen, or the field lost relevance). */
    fun clearPlaceSuggestions() {
        placeSuggestJob?.cancel()
        _placeSuggestions.value = emptyList()
    }

    /** Re-runs the fetch with the current filters (used for Retry). */
    fun load() = fetch(_state.value.query)

    /**
     * Runs a new search with the given filters (preserves the active region, sort, and the
     * discovery filters — property type + amenities). A fresh text/date search drops any
     * pinned map [bbox] so results aren't silently constrained to an old viewport.
     */
    fun search(query: ListingQuery) {
        val current = _state.value.query
        fetch(
            query.copy(
                region = current.region,
                sort = current.sort,
                propertyType = current.propertyType,
                amenities = current.amenities,
                bbox = null
            )
        )
    }

    /**
     * Applies the discovery filters from the Filters sheet (property type + amenities) and
     * refetches, keeping the rest of the search (text / dates / guests / region / sort). Clears
     * any pinned map [bbox] so the new filters search the whole region, not the old viewport.
     */
    fun applyFilters(propertyType: String?, amenities: Set<String>) {
        fetch(
            _state.value.query.copy(
                propertyType = propertyType?.takeIf { it.isNotBlank() },
                amenities = amenities,
                bbox = null
            )
        )
    }

    /** Clears only the discovery filters (property type + amenities), keeping the rest of the search. */
    fun clearFilters() {
        val current = _state.value.query
        if (current.propertyType == null && current.amenities.isEmpty()) return
        fetch(current.copy(propertyType = null, amenities = emptySet()))
    }

    /**
     * Re-queries listings within the map's current visible viewport ("Search this area"),
     * combined with the active filters. [bbox] is "minLng,minLat,maxLng,maxLat"; a blank value
     * clears the viewport constraint.
     */
    fun searchArea(bbox: String) {
        fetch(_state.value.query.copy(bbox = bbox.takeIf { it.isNotBlank() }))
    }

    /**
     * Switches the selected region chip and refetches, keeping the rest of the search
     * (text / dates / guests / sort / discovery filters). A null [region] clears the region
     * filter ("All"). Also drops any pinned map [bbox] so the region change isn't constrained
     * to an old viewport.
     */
    fun selectRegion(region: String?) {
        fetch(_state.value.query.copy(region = region?.takeIf { it.isNotBlank() }, bbox = null))
    }

    /** Switches the sort order and refetches, keeping all other filters. */
    fun setSort(sort: ListingSort) {
        if (_state.value.query.sort == sort) return
        fetch(_state.value.query.copy(sort = sort))
    }

    /** Resets all filters and reloads the full, unfiltered list. */
    fun clear() = fetch(ListingQuery())

    /** Loads the curated browse regions for the chip row (best-effort; failures yield no chips). */
    private fun loadRegions() {
        viewModelScope.launch {
            val regions = SupabaseService.fetchRegions()
            _state.value = _state.value.copy(regions = regions)
        }
    }

    private fun fetch(query: ListingQuery) {
        _state.value = _state.value.copy(isLoading = true, error = null, query = query)
        viewModelScope.launch {
            try {
                val listings = SupabaseService.fetchListings(query)
                _state.value = _state.value.copy(
                    isLoading = false,
                    listings = listings,
                    query = query,
                    error = if (listings.isEmpty()) {
                        if (query.isActive) "No stays match your search. Try different dates or guests."
                        else "No listings found yet. Seed the database to see stays here."
                    } else null
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    listings = emptyList(),
                    error = e.message ?: "Something went wrong."
                )
            }
        }
    }
}
