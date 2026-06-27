package com.quickin.app

import android.app.Application
import android.content.Context
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * State for the identity-verification card on the Profile tab
 * (`GET` / `POST /api/local/verification`).
 */
data class VerificationUiState(
    val isLoading: Boolean = false,
    val loaded: Boolean = false,
    /** "unverified" | "pending" | "verified" | "rejected". */
    val status: String = "unverified",
    /** True while the picked ID photo is being downscaled + uploaded. */
    val isSubmitting: Boolean = false,
    /** Inline error for the verification card, or null. */
    val error: String? = null
)

/**
 * State for the public profile + trust badges of the host on an open listing detail
 * (`GET /api/local/users/:id`, no auth). Drives the Superhost / New host chips that
 * augment the lightweight Verified chip read from [Listing.hostVerified].
 */
data class HostBadgesUiState(
    /** The host id these badges belong to (so a stale fetch for another host is ignored). */
    val hostId: String? = null,
    val badges: TrustBadges = TrustBadges()
)

/**
 * State for the full host-profile screen (opened by tapping the "Hosted by …" row on a listing).
 * Aggregates the host's public profile (`GET /api/local/users/:id`), the reviews about their
 * listings (`GET /api/local/users/:id/reviews`), and their other listings
 * (`GET /api/local/listings?host=:id`). Carries NO PII (no phone/email).
 */
data class HostProfileUiState(
    /** The host id this state belongs to (so a stale fetch for another host is ignored). */
    val hostId: String? = null,
    val isLoading: Boolean = false,
    /** The host's public profile (name, avatar, bio, rating, badges), or null until loaded/failed. */
    val profile: PublicProfile? = null,
    /** Reviews written about the host's listings (newest-first). */
    val reviews: List<HostReview> = emptyList(),
    /** The host's other listings (excluding the one the viewer came from is up to the screen). */
    val listings: List<Listing> = emptyList(),
    /** Inline error for the profile header, or null. */
    val error: String? = null
)

/**
 * State for the "Report this listing" sheet (`POST /api/local/reports`).
 */
data class ReportUiState(
    val isSubmitting: Boolean = false,
    /** Set to true after a successful report (drives the "thanks" confirmation). */
    val submitted: Boolean = false,
    /** Inline error for the report sheet, or null. */
    val error: String? = null,
    /** True when the user tried to report while signed out (route to auth). */
    val needsSignIn: Boolean = false
)

/**
 * Owns the Trust & Safety flows: the signed-in user's identity verification (Profile tab),
 * the open listing's host trust badges (listing detail), and reporting a listing.
 *
 * Reads the bearer token directly from SharedPreferences ("qk_auth" / "token") — the same store
 * [AuthViewModel] / [BookingsViewModel] use — so it works regardless of which screen triggers it.
 */
class TrustViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences(
        AuthViewModel.PREFS_NAME, Context.MODE_PRIVATE
    )

    private val _verification = MutableStateFlow(VerificationUiState())
    val verification: StateFlow<VerificationUiState> = _verification.asStateFlow()

    private val _hostBadges = MutableStateFlow(HostBadgesUiState())
    val hostBadges: StateFlow<HostBadgesUiState> = _hostBadges.asStateFlow()

    private val _hostProfile = MutableStateFlow(HostProfileUiState())
    val hostProfile: StateFlow<HostProfileUiState> = _hostProfile.asStateFlow()

    private val _report = MutableStateFlow(ReportUiState())
    val report: StateFlow<ReportUiState> = _report.asStateFlow()

    private fun token(): String? = prefs.getString(AuthViewModel.KEY_TOKEN, null)

    // ---- Identity verification (signed-in user) -------------------------------

    /** Loads the signed-in user's verification status. No-op (friendly state) when signed out. */
    fun loadVerification() {
        val token = token() ?: run {
            _verification.value = VerificationUiState(loaded = true)
            return
        }
        _verification.value = _verification.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            try {
                val state = TrustService.fetchVerification(token)
                _verification.value = _verification.value.copy(
                    isLoading = false,
                    loaded = true,
                    status = state.status,
                    error = null
                )
            } catch (e: Exception) {
                _verification.value = _verification.value.copy(
                    isLoading = false,
                    loaded = true,
                    error = e.message
                )
            }
        }
    }

    /**
     * Submits the FRONT photo at [frontUri] and the BACK photo at [backUri] for verification — NO
     * OCR. Both are downscaled off the main thread to `data:image/jpeg;base64,…` data URLs (≤1024px)
     * and POSTed over HTTPS together with an optional [idNumber], flipping the status to "pending"
     * on success. A null decode or a network failure surfaces [VerificationUiState.error].
     */
    fun submitVerification(frontUri: Uri, backUri: Uri, idNumber: String? = null) {
        if (_verification.value.isSubmitting) return
        val token = token() ?: run {
            _verification.value = _verification.value.copy(error = "Please sign in.")
            return
        }
        _verification.value = _verification.value.copy(isSubmitting = true, error = null)
        val context = getApplication<Application>().applicationContext
        viewModelScope.launch {
            try {
                val (front, back) = withContext(Dispatchers.IO) {
                    val f = async { AvatarImage.loadDownscaledJpegDataUrl(context, frontUri, maxDim = 1024) }
                    val b = async { AvatarImage.loadDownscaledJpegDataUrl(context, backUri, maxDim = 1024) }
                    f.await() to b.await()
                }
                if (front == null || back == null) {
                    throw IllegalStateException("Couldn't read those images.")
                }
                val state = TrustService.submitVerification(token, front, back, idNumber)
                _verification.value = _verification.value.copy(
                    isSubmitting = false,
                    loaded = true,
                    status = state.status,
                    error = null
                )
            } catch (e: Exception) {
                _verification.value = _verification.value.copy(
                    isSubmitting = false,
                    error = e.message
                )
            }
        }
    }

    /** Clears verification state on logout so the next account starts fresh. */
    fun clearVerification() {
        _verification.value = VerificationUiState()
    }

    // ---- Host trust badges (listing detail) -----------------------------------

    /**
     * Fetches the host's public profile for [hostId] and publishes its trust badges so the
     * listing detail can show Superhost / New host chips. Silently no-ops on a blank id or any
     * failure (the detail still shows the lightweight Verified chip from the listing itself).
     */
    fun loadHostBadges(hostId: String?) {
        if (hostId.isNullOrBlank()) {
            _hostBadges.value = HostBadgesUiState()
            return
        }
        // Don't refetch the same host we already have badges for.
        if (_hostBadges.value.hostId == hostId && _hostBadges.value.badges != TrustBadges()) return
        _hostBadges.value = HostBadgesUiState(hostId = hostId)
        viewModelScope.launch {
            val profile = TrustService.fetchPublicProfile(hostId)
            if (profile != null) {
                _hostBadges.value = HostBadgesUiState(hostId = hostId, badges = profile.badges)
            }
        }
    }

    /** Clears the host badges when leaving a listing detail. */
    fun clearHostBadges() {
        _hostBadges.value = HostBadgesUiState()
    }

    // ---- Host profile (tap "Hosted by …") -------------------------------------

    /**
     * Loads the full host profile for [hostId]: the public profile, the reviews about their
     * listings, and their other listings — all in parallel, all public (no auth, no PII). The
     * profile header surfaces an error if the (key) profile fetch fails; reviews/listings simply
     * stay empty on failure. Re-opening the same host that's already loaded is a no-op.
     */
    fun loadHostProfile(hostId: String?) {
        if (hostId.isNullOrBlank()) {
            _hostProfile.value = HostProfileUiState()
            return
        }
        // Already loaded for this host — keep what we have.
        if (_hostProfile.value.hostId == hostId && _hostProfile.value.profile != null) return
        _hostProfile.value = HostProfileUiState(hostId = hostId, isLoading = true)
        viewModelScope.launch {
            val profileDeferred = async { TrustService.fetchPublicProfile(hostId) }
            val reviewsDeferred = async { TrustService.fetchHostReviews(hostId) }
            val listingsDeferred = async { SupabaseService.fetchHostListings(hostId) }
            val profile = profileDeferred.await()
            val reviews = reviewsDeferred.await()
            val listings = listingsDeferred.await()
            // A stale result (the user opened a different host meanwhile) is ignored.
            if (_hostProfile.value.hostId != hostId) return@launch
            _hostProfile.value = HostProfileUiState(
                hostId = hostId,
                isLoading = false,
                profile = profile,
                reviews = reviews,
                listings = listings,
                error = if (profile == null) "Couldn't load this host." else null
            )
        }
    }

    /** Clears the host profile when leaving the host-profile screen. */
    fun clearHostProfile() {
        _hostProfile.value = HostProfileUiState()
    }

    // ---- Reporting (signed-in user) -------------------------------------------

    /**
     * Files a report against [listingId] with the chosen [reason] code ("inaccurate" | "scam" |
     * "offensive" | "other") and optional [details]. Surfaces:
     *  • needsSignIn = true when signed out (and on a 401 from the server),
     *  • submitted = true on success,
     *  • error = {message} otherwise.
     */
    fun submitReport(listingId: String, reason: String, details: String?) {
        if (_report.value.isSubmitting) return
        val token = token() ?: run {
            _report.value = ReportUiState(needsSignIn = true)
            return
        }
        _report.value = ReportUiState(isSubmitting = true)
        viewModelScope.launch {
            try {
                TrustService.submitReport(token, "listing", listingId, reason, details)
                _report.value = ReportUiState(submitted = true)
            } catch (e: TrustService.HttpError) {
                if (e.code == 401) {
                    _report.value = ReportUiState(needsSignIn = true)
                } else {
                    _report.value = ReportUiState(error = e.message)
                }
            } catch (e: Exception) {
                _report.value = ReportUiState(error = e.message)
            }
        }
    }

    /** Resets the report sheet (on dismiss, after a success/error, or when leaving the screen). */
    fun resetReport() {
        _report.value = ReportUiState()
    }
}
