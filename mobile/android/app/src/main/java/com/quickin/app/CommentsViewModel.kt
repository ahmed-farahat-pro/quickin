package com.quickin.app

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * A comment write the server refused behind the policy-warning gate (409). Kept so the screen can
 * show the warning, acknowledge it and let the user retry with their text intact.
 */
data class CommentWarning(val id: String, val message: String)

/**
 * State of one listing's "Questions & comments" section.
 *
 * [busyId] is the comment whose delete / reply is in flight (or [POSTING] for a new comment).
 * [error] is the server's own wording (400 contact details, 429 rate limit, 403) shown verbatim.
 * [postedAt] bumps on a successful post so the screen can clear its input.
 */
data class ListingCommentsUiState(
    val listingId: String? = null,
    val isLoading: Boolean = false,
    val loaded: Boolean = false,
    val comments: List<ListingComment> = emptyList(),
    val isHost: Boolean = false,
    val canComment: Boolean = false,
    val loadError: String? = null,
    val busyId: String? = null,
    val error: String? = null,
    val warning: CommentWarning? = null,
    val acknowledging: Boolean = false,
    /** Shown once after acknowledging: "you can post again". */
    val acknowledged: Boolean = false,
    val postedAt: Long = 0L,
    /** Bumps when a reply save succeeds so the reply sheet can close. */
    val replySavedAt: Long = 0L,
) {
    companion object { const val POSTING = "__posting__" }
}

/** State of the host's "Guest questions" screen (`GET /api/local/host/comments`). */
data class HostCommentsUiState(
    val isLoading: Boolean = false,
    val loaded: Boolean = false,
    val comments: List<ListingComment> = emptyList(),
    val unanswered: Int = 0,
    val loadError: String? = null,
    val busyId: String? = null,
    val error: String? = null,
    val warning: CommentWarning? = null,
    val acknowledging: Boolean = false,
    val acknowledged: Boolean = false,
    val replySavedAt: Long = 0L,
)

/**
 * Owns listing comments (the public Q&A that replaced host ⇄ guest messaging) and the host's
 * cross-listing "Guest questions" feed. Reads the bearer token from SharedPreferences like the
 * other view-models; reads still work signed out.
 */
class CommentsViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences(AuthViewModel.PREFS_NAME, Context.MODE_PRIVATE)
    private fun token(): String? = prefs.getString(AuthViewModel.KEY_TOKEN, null)

    private val _listing = MutableStateFlow(ListingCommentsUiState())
    val listing: StateFlow<ListingCommentsUiState> = _listing.asStateFlow()

    private val _host = MutableStateFlow(HostCommentsUiState())
    val host: StateFlow<HostCommentsUiState> = _host.asStateFlow()

    // ---- One listing -------------------------------------------------------------

    fun loadListing(listingId: String) {
        if (listingId.isBlank()) return
        val keep = _listing.value.takeIf { it.listingId == listingId }
        _listing.value = (keep ?: ListingCommentsUiState(listingId = listingId))
            .copy(isLoading = true, loadError = null)
        viewModelScope.launch {
            try {
                val page = CommentService.fetchListingComments(token(), listingId)
                if (_listing.value.listingId != listingId) return@launch
                _listing.value = _listing.value.copy(
                    isLoading = false,
                    loaded = true,
                    comments = page.comments,
                    isHost = page.isHost,
                    canComment = page.canComment,
                )
            } catch (e: Exception) {
                if (_listing.value.listingId != listingId) return@launch
                _listing.value = _listing.value.copy(
                    isLoading = false,
                    loaded = true,
                    loadError = humanError(e, "Couldn't load comments."),
                )
            }
        }
    }

    fun clearListing() {
        _listing.value = ListingCommentsUiState()
    }

    fun post(body: String) {
        val s = _listing.value
        val listingId = s.listingId ?: return
        val token = token() ?: return
        if (s.busyId != null || !CommentRules.canSubmit(body)) return
        _listing.value = s.copy(busyId = ListingCommentsUiState.POSTING, error = null, acknowledged = false)
        viewModelScope.launch {
            try {
                val created = CommentService.postComment(token, listingId, body.trim())
                val cur = _listing.value
                _listing.value = cur.copy(
                    busyId = null,
                    comments = listOf(created) + cur.comments.filterNot { it.id == created.id },
                    postedAt = System.currentTimeMillis(),
                )
            } catch (e: Exception) {
                _listing.value = failed(_listing.value, e, "Couldn't post your comment.")
            }
        }
    }

    fun deleteComment(commentId: String) {
        val s = _listing.value
        val listingId = s.listingId ?: return
        val token = token() ?: return
        if (s.busyId != null) return
        _listing.value = s.copy(busyId = commentId, error = null)
        viewModelScope.launch {
            try {
                CommentService.deleteComment(token, listingId, commentId)
                val cur = _listing.value
                _listing.value = cur.copy(busyId = null, comments = cur.comments.filterNot { it.id == commentId })
            } catch (e: Exception) {
                _listing.value = failed(_listing.value, e, "Couldn't delete that.")
            }
        }
    }

    /** Host: create or replace the reply under [commentId] on the open listing. */
    fun saveReply(commentId: String, body: String) {
        val s = _listing.value
        val listingId = s.listingId ?: return
        saveReplyFor(listingId, commentId, body, fromHostFeed = false)
    }

    /** Host: delete the reply under [commentId] on the open listing. */
    fun deleteReply(commentId: String) {
        val s = _listing.value
        val listingId = s.listingId ?: return
        deleteReplyFor(listingId, commentId, fromHostFeed = false)
    }

    // ---- Host feed ---------------------------------------------------------------

    fun loadHost() {
        val token = token()
        if (token == null) {
            _host.value = HostCommentsUiState()
            return
        }
        _host.value = _host.value.copy(isLoading = true, loadError = null)
        viewModelScope.launch {
            try {
                val page = CommentService.fetchHostComments(token)
                _host.value = _host.value.copy(
                    isLoading = false,
                    loaded = true,
                    comments = page.comments,
                    unanswered = page.unanswered,
                )
            } catch (e: Exception) {
                _host.value = _host.value.copy(
                    isLoading = false,
                    loaded = true,
                    loadError = humanError(e, "Couldn't load guest questions."),
                )
            }
        }
    }

    fun saveHostReply(comment: ListingComment, body: String) =
        saveReplyFor(comment.listingId, comment.id, body, fromHostFeed = true)

    fun deleteHostReply(comment: ListingComment) =
        deleteReplyFor(comment.listingId, comment.id, fromHostFeed = true)

    // ---- Policy-warning gate -------------------------------------------------------

    /** Confirms the warning shown on the listing section, then lets the user retry. */
    fun acknowledgeListingWarning() {
        val w = _listing.value.warning ?: return
        val token = token() ?: return
        _listing.value = _listing.value.copy(acknowledging = true, error = null)
        viewModelScope.launch {
            try {
                PolicyWarningApi.acknowledge(token, w.id)
                _listing.value = _listing.value.copy(acknowledging = false, warning = null, acknowledged = true)
            } catch (e: Exception) {
                _listing.value = _listing.value.copy(acknowledging = false, error = humanError(e, "Couldn't save that. Please try again."))
            }
        }
    }

    fun acknowledgeHostWarning() {
        val w = _host.value.warning ?: return
        val token = token() ?: return
        _host.value = _host.value.copy(acknowledging = true, error = null)
        viewModelScope.launch {
            try {
                PolicyWarningApi.acknowledge(token, w.id)
                _host.value = _host.value.copy(acknowledging = false, warning = null, acknowledged = true)
            } catch (e: Exception) {
                _host.value = _host.value.copy(acknowledging = false, error = humanError(e, "Couldn't save that. Please try again."))
            }
        }
    }

    fun dismissListingError() {
        _listing.value = _listing.value.copy(error = null)
    }

    fun dismissHostError() {
        _host.value = _host.value.copy(error = null)
    }

    /** Wipes everything on sign-out. */
    fun clear() {
        _listing.value = ListingCommentsUiState()
        _host.value = HostCommentsUiState()
    }

    // ---- Internals -----------------------------------------------------------------

    private fun saveReplyFor(listingId: String, commentId: String, body: String, fromHostFeed: Boolean) {
        val token = token() ?: return
        if (listingId.isBlank() || !CommentRules.canSubmit(body)) return
        if (fromHostFeed) {
            if (_host.value.busyId != null) return
            _host.value = _host.value.copy(busyId = commentId, error = null, acknowledged = false)
        } else {
            if (_listing.value.busyId != null) return
            _listing.value = _listing.value.copy(busyId = commentId, error = null, acknowledged = false)
        }
        viewModelScope.launch {
            try {
                val updated = CommentService.putReply(token, listingId, commentId, body.trim())
                applyUpdated(updated, listingId, saved = true)
            } catch (e: Exception) {
                if (fromHostFeed) _host.value = failedHost(_host.value, e, "Couldn't save your reply.")
                else _listing.value = failed(_listing.value, e, "Couldn't save your reply.")
            }
        }
    }

    private fun deleteReplyFor(listingId: String, commentId: String, fromHostFeed: Boolean) {
        val token = token() ?: return
        if (listingId.isBlank()) return
        if (fromHostFeed) {
            if (_host.value.busyId != null) return
            _host.value = _host.value.copy(busyId = commentId, error = null)
        } else {
            if (_listing.value.busyId != null) return
            _listing.value = _listing.value.copy(busyId = commentId, error = null)
        }
        viewModelScope.launch {
            try {
                val updated = CommentService.deleteReply(token, listingId, commentId)
                // The DELETE answers with the comment, reply null; force it in case a sparse body
                // came back.
                applyUpdated(updated.copy(id = commentId, reply = null), listingId, saved = false)
            } catch (e: Exception) {
                if (fromHostFeed) _host.value = failedHost(_host.value, e, "Couldn't delete that.")
                else _listing.value = failed(_listing.value, e, "Couldn't delete that.")
            }
        }
    }

    /** Swaps [updated] into both the open listing's list and the host feed, keeping them in step. */
    private fun applyUpdated(updated: ListingComment, listingId: String, saved: Boolean) {
        val now = System.currentTimeMillis()
        val l = _listing.value
        if (l.listingId == listingId) {
            _listing.value = l.copy(
                busyId = if (l.busyId == updated.id) null else l.busyId,
                comments = CommentRules.replace(l.comments, updated),
                replySavedAt = if (saved) now else l.replySavedAt,
            )
        }
        val h = _host.value
        val hostList = CommentRules.replace(h.comments, updated)
        _host.value = h.copy(
            busyId = if (h.busyId == updated.id) null else h.busyId,
            comments = hostList,
            unanswered = if (h.loaded) hostList.count { !it.isAnswered } else h.unanswered,
            replySavedAt = if (saved) now else h.replySavedAt,
        )
    }

    private fun failed(s: ListingCommentsUiState, e: Exception, fallback: String): ListingCommentsUiState =
        if (e is PolicyWarningRequired) {
            s.copy(busyId = null, warning = CommentWarning(e.warningId, e.message ?: ""))
        } else {
            s.copy(busyId = null, error = humanError(e, fallback))
        }

    private fun failedHost(s: HostCommentsUiState, e: Exception, fallback: String): HostCommentsUiState =
        if (e is PolicyWarningRequired) {
            s.copy(busyId = null, warning = CommentWarning(e.warningId, e.message ?: ""))
        } else {
            s.copy(busyId = null, error = humanError(e, fallback))
        }
}
