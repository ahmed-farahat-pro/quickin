package com.quickin.app

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch

/**
 * State for the wishlist. [listingIds]/[serviceIds] drive the saved-heart fill across the
 * browse + detail screens; [data] backs the dedicated "Saved" screen (full saved cards).
 * [needsSignIn] flips true when a signed-out user taps a heart, so the host can prompt sign-in.
 */
data class WishlistUiState(
    val isLoading: Boolean = false,
    val data: WishlistData = WishlistData(),
    val listingIds: Set<String> = emptySet(),
    val serviceIds: Set<String> = emptySet(),
    val error: String? = null,
    val loaded: Boolean = false,
    val needsSignIn: Boolean = false
)

/** A one-shot confirmation for the save/heart control, surfaced as a Toast by the host. */
enum class WishlistToast { ADDED, REMOVED }

/**
 * Owns the user's wishlist. Reads the bearer token straight from SharedPreferences
 * ("qk_auth" / "token") — the same store the other view-models use — so the heart toggles and
 * the Saved screen work regardless of which screen triggers a load.
 *
 *   [load]            — refresh saved items + id sets (no-op, friendly state, when signed out)
 *   [toggleListing]   — optimistically flip a listing's saved state, then POST (reconcile on fail)
 *   [toggleService]   — same for a service
 *   [isListingSaved]  — quick membership check for the heart fill
 *   [clear]           — wipe state on logout
 */
class WishlistViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences(
        AuthViewModel.PREFS_NAME, Context.MODE_PRIVATE
    )

    private val _state = MutableStateFlow(WishlistUiState())
    val state: StateFlow<WishlistUiState> = _state.asStateFlow()

    /**
     * One-shot confirmation events for the heart/save control. Emitted on a successful toggle so the
     * host (MainApp) can show an "Added to wishlist" / "Removed from wishlist" Toast. A [Channel]
     * (not a StateFlow) so each tap fires exactly once and isn't replayed on recomposition.
     */
    private val _toast = Channel<WishlistToast>(Channel.BUFFERED)
    val toast = _toast.receiveAsFlow()

    private fun token(): String? = prefs.getString(AuthViewModel.KEY_TOKEN, null)

    /** Loads the signed-in user's saved items + id sets. No-op (friendly state) when signed out. */
    fun load() {
        val token = token()
        if (token == null) {
            _state.value = WishlistUiState(loaded = true)
            return
        }
        _state.value = _state.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            try {
                val data = WishlistService.fetchWishlist(token)
                _state.value = WishlistUiState(
                    isLoading = false,
                    data = data,
                    listingIds = data.listingIds,
                    serviceIds = data.serviceIds,
                    loaded = true,
                    error = null
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    loaded = true,
                    error = e.message ?: "Could not load saved items."
                )
            }
        }
    }

    /** True when [listingId] is currently in the wishlist. */
    fun isListingSaved(listingId: String): Boolean = _state.value.listingIds.contains(listingId)

    /** True when [serviceId] is currently in the wishlist. */
    fun isServiceSaved(serviceId: String): Boolean = _state.value.serviceIds.contains(serviceId)

    /**
     * Toggles a listing's saved state. Optimistically flips the id set (so the heart updates
     * instantly), POSTs the change, and on failure reverts. When signed out, raises [needsSignIn]
     * so the caller can prompt sign-in.
     */
    fun toggleListing(listing: Listing) {
        val token = token()
        if (token == null) {
            _state.value = _state.value.copy(needsSignIn = true)
            return
        }
        val current = _state.value
        val wasSaved = current.listingIds.contains(listing.id)
        val nextIds = current.listingIds.toMutableSet().apply {
            if (wasSaved) remove(listing.id) else add(listing.id)
        }
        // Keep the Saved screen's listing cards in sync with the optimistic flip.
        val nextListings = if (wasSaved) {
            current.data.listings.filterNot { it.id == listing.id }
        } else {
            if (current.data.listings.any { it.id == listing.id }) current.data.listings
            else current.data.listings + listing
        }
        _state.value = current.copy(
            listingIds = nextIds,
            data = current.data.copy(listings = nextListings, listingIds = nextIds)
        )

        viewModelScope.launch {
            try {
                val saved = WishlistService.toggle(
                    token,
                    WishlistService.ItemType.LISTING,
                    listing.id,
                    action = if (wasSaved) "unsave" else "save"
                )
                // Reconcile the local state with the server's authoritative `saved`, then confirm.
                applyListingSaved(listing, saved)
                _toast.trySend(if (saved) WishlistToast.ADDED else WishlistToast.REMOVED)
            } catch (e: WishlistService.HttpError) {
                if (e.code == 401) _state.value = _state.value.copy(needsSignIn = true)
                revertListing(listing.id, wasSaved)
            } catch (_: Exception) {
                revertListing(listing.id, wasSaved)
            }
        }
    }

    /** Toggles a service's saved state (optimistic, with revert-on-failure). Mirrors [toggleListing]. */
    fun toggleService(service: Service) {
        val token = token()
        if (token == null) {
            _state.value = _state.value.copy(needsSignIn = true)
            return
        }
        val current = _state.value
        val wasSaved = current.serviceIds.contains(service.id)
        val nextIds = current.serviceIds.toMutableSet().apply {
            if (wasSaved) remove(service.id) else add(service.id)
        }
        val nextServices = if (wasSaved) {
            current.data.services.filterNot { it.id == service.id }
        } else {
            if (current.data.services.any { it.id == service.id }) current.data.services
            else current.data.services + service
        }
        _state.value = current.copy(
            serviceIds = nextIds,
            data = current.data.copy(services = nextServices, serviceIds = nextIds)
        )

        viewModelScope.launch {
            try {
                val saved = WishlistService.toggle(
                    token,
                    WishlistService.ItemType.SERVICE,
                    service.id,
                    action = if (wasSaved) "unsave" else "save"
                )
                applyServiceSaved(service, saved)
                _toast.trySend(if (saved) WishlistToast.ADDED else WishlistToast.REMOVED)
            } catch (e: WishlistService.HttpError) {
                if (e.code == 401) _state.value = _state.value.copy(needsSignIn = true)
                revertService(service.id, wasSaved)
            } catch (_: Exception) {
                revertService(service.id, wasSaved)
            }
        }
    }

    /** Clears the transient "sign in to save" flag once the host has surfaced/acted on it. */
    fun clearNeedsSignIn() {
        if (_state.value.needsSignIn) _state.value = _state.value.copy(needsSignIn = false)
    }

    /** Wipes wishlist state on logout so a new user doesn't see stale saves. */
    fun clear() {
        _state.value = WishlistUiState()
    }

    /**
     * Reconciles a listing's saved state to the server's authoritative [saved] value (idempotent:
     * sets membership rather than toggling), keeping the id set + the Saved screen's cards in sync.
     */
    private fun applyListingSaved(listing: Listing, saved: Boolean) {
        val s = _state.value
        val ids = s.listingIds.toMutableSet().apply {
            if (saved) add(listing.id) else remove(listing.id)
        }
        val listings = if (saved) {
            if (s.data.listings.any { it.id == listing.id }) s.data.listings
            else s.data.listings + listing
        } else {
            s.data.listings.filterNot { it.id == listing.id }
        }
        _state.value = s.copy(
            listingIds = ids,
            data = s.data.copy(listings = listings, listingIds = ids)
        )
    }

    /** Reconciles a service's saved state to the server's authoritative [saved] value (idempotent). */
    private fun applyServiceSaved(service: Service, saved: Boolean) {
        val s = _state.value
        val ids = s.serviceIds.toMutableSet().apply {
            if (saved) add(service.id) else remove(service.id)
        }
        val services = if (saved) {
            if (s.data.services.any { it.id == service.id }) s.data.services
            else s.data.services + service
        } else {
            s.data.services.filterNot { it.id == service.id }
        }
        _state.value = s.copy(
            serviceIds = ids,
            data = s.data.copy(services = services, serviceIds = ids)
        )
    }

    /** Restores a listing's id-set membership after a failed toggle. */
    private fun revertListing(listingId: String, wasSaved: Boolean) {
        val s = _state.value
        val reverted = s.listingIds.toMutableSet().apply {
            if (wasSaved) add(listingId) else remove(listingId)
        }
        _state.value = s.copy(listingIds = reverted, data = s.data.copy(listingIds = reverted))
    }

    /** Restores a service's id-set membership after a failed toggle. */
    private fun revertService(serviceId: String, wasSaved: Boolean) {
        val s = _state.value
        val reverted = s.serviceIds.toMutableSet().apply {
            if (wasSaved) add(serviceId) else remove(serviceId)
        }
        _state.value = s.copy(serviceIds = reverted, data = s.data.copy(serviceIds = reverted))
    }
}
