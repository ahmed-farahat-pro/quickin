package com.quickin.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ListingsUiState(
    val isLoading: Boolean = false,
    val listings: List<Listing> = emptyList(),
    val error: String? = null,
    /** The filters used for the current results (so the header can reflect / clear them). */
    val query: ListingQuery = ListingQuery()
)

class ListingsViewModel : ViewModel() {
    private val _state = MutableStateFlow(ListingsUiState())
    val state: StateFlow<ListingsUiState> = _state.asStateFlow()

    init {
        load()
    }

    /** Re-runs the fetch with the current filters (used for Retry). */
    fun load() = fetch(_state.value.query)

    /** Runs a new search with the given filters. */
    fun search(query: ListingQuery) = fetch(query)

    /** Resets all filters and reloads the full, unfiltered list. */
    fun clear() = fetch(ListingQuery())

    private fun fetch(query: ListingQuery) {
        _state.value = _state.value.copy(isLoading = true, error = null, query = query)
        viewModelScope.launch {
            try {
                val listings = SupabaseService.fetchListings(query)
                _state.value = ListingsUiState(
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
