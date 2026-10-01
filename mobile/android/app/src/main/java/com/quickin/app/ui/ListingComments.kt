package com.quickin.app.ui

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.QuestionAnswer
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.quickin.app.CommentRules
import com.quickin.app.HostCommentsUiState
import com.quickin.app.ListingComment
import com.quickin.app.ListingCommentsUiState
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

private val CommentErrorRed = Color(0xFFB3261E)

private fun initialsOf(name: String): String =
    name.split(' ').filter { it.isNotBlank() }.take(2).joinToString("") { it.take(1).uppercase() }.ifBlank { "?" }

/**
 * The listing detail's "Questions & comments" section (below reviews) — the public Q&A that
 * replaced host ⇄ guest messaging. Anyone reads; a signed-in non-host asks; the host replies
 * (one reply per comment). Server 400 / 403 / 429 wording is shown verbatim; a 409 policy
 * warning swaps the Post button for [PolicyWarningBanner] and keeps the typed text for a retry.
 *
 * [guestAction] wraps every write so the host's "See it as a guest" preview stays inert.
 */
@Composable
fun ListingCommentsSection(
    state: ListingCommentsUiState,
    isSignedIn: Boolean,
    onSignIn: () -> Unit,
    onRetry: () -> Unit,
    onPost: (String) -> Unit,
    onDelete: (commentId: String) -> Unit,
    onSaveReply: (commentId: String, body: String) -> Unit,
    onDeleteReply: (commentId: String) -> Unit,
    onAcknowledgeWarning: () -> Unit,
    onDismissError: () -> Unit,
    guestAction: (() -> Unit) -> Unit = { it() },
    modifier: Modifier = Modifier,
) {
    var draft by rememberSaveable(state.listingId) { mutableStateOf("") }
    var confirmDelete by remember { mutableStateOf<ListingComment?>(null) }
    var replyTarget by remember { mutableStateOf<ListingComment?>(null) }
    // A successful post clears the input.
    LaunchedEffect(state.postedAt) { if (state.postedAt != 0L) draft = "" }

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            SectionHeader(stringResource(R.string.comments_title), modifier = Modifier.weight(1f))
            if (state.comments.isNotEmpty()) {
                Surface(color = Tan, shape = RoundedCornerShape(50)) {
                    Text(
                        "${state.comments.size}",
                        color = Burgundy,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp)
                    )
                }
            }
        }

        // Composer: signed out → sign-in prompt; can_comment → input; host → none (they reply).
        when {
            !isSignedIn -> OutlinedButton(
                onClick = onSignIn,
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, Burgundy),
                colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White, contentColor = Burgundy),
                modifier = Modifier.fillMaxWidth().height(48.dp)
            ) {
                Text(stringResource(R.string.comments_sign_in), fontWeight = FontWeight.SemiBold)
            }
            state.canComment && !state.isHost -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = draft,
                    onValueChange = { if (it.length <= CommentRules.MAX_BODY) draft = it },
                    placeholder = { Text(stringResource(R.string.comments_input_hint), color = Muted) },
                    minLines = 2,
                    maxLines = 6,
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color.White,
                        focusedBorderColor = Burgundy
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
                Text(stringResource(R.string.comments_public_hint), color = Muted, fontSize = 12.sp)
                val warning = state.warning
                if (warning != null && replyTarget == null) {
                    PolicyWarningBanner(
                        text = warning.message,
                        isAcknowledging = state.acknowledging,
                        onAcknowledge = onAcknowledgeWarning
                    )
                } else {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            "${draft.length}/${CommentRules.MAX_BODY}",
                            color = Muted,
                            fontSize = 12.sp,
                            modifier = Modifier.weight(1f)
                        )
                        val posting = state.busyId == ListingCommentsUiState.POSTING
                        Button(
                            onClick = { guestAction { onPost(draft) } },
                            enabled = CommentRules.canSubmit(draft) && state.busyId == null,
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White)
                        ) {
                            if (posting) {
                                CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
                            } else {
                                Text(stringResource(R.string.comments_post), fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }
            }
        }

        if (state.acknowledged && state.warning == null) {
            Text(stringResource(R.string.comments_warning_ack), color = Muted, fontSize = 13.sp)
        }
        // The server's own words (contact details, rate limit, host-on-own-listing…).
        if (state.error != null && replyTarget == null) {
            ErrorNote(state.error, onDismiss = onDismissError)
        }

        when {
            state.isLoading && state.comments.isEmpty() -> Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(color = Burgundy, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(10.dp))
                Text(stringResource(R.string.comments_loading), color = Muted, fontSize = 14.sp)
            }
            state.loadError != null && state.comments.isEmpty() -> Row(verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.comments_load_error), color = Muted, fontSize = 14.sp, modifier = Modifier.weight(1f))
                TextButton(onClick = onRetry) {
                    Text(stringResource(R.string.action_retry), color = Burgundy, fontWeight = FontWeight.SemiBold)
                }
            }
            state.comments.isEmpty() -> Text(
                stringResource(if (state.isHost) R.string.comments_empty_host else R.string.comments_empty),
                color = Muted,
                fontSize = 14.sp
            )
            else -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                state.comments.forEach { c ->
                    CommentCard(
                        comment = c,
                        isHost = state.isHost,
                        busy = state.busyId == c.id,
                        enabled = state.busyId == null,
                        onDelete = { confirmDelete = c },
                        onReply = { guestAction { replyTarget = c } },
                        onDeleteReply = { guestAction { onDeleteReply(c.id) } }
                    )
                }
            }
        }
    }

    confirmDelete?.let { c ->
        AlertDialog(
            onDismissRequest = { confirmDelete = null },
            title = { Text(stringResource(R.string.comments_delete_title), fontWeight = FontWeight.Bold, color = Ink) },
            text = { Text(stringResource(R.string.comments_delete_body), color = Muted) },
            confirmButton = {
                TextButton(onClick = {
                    confirmDelete = null
                    guestAction { onDelete(c.id) }
                }) { Text(stringResource(R.string.comments_delete), color = CommentErrorRed, fontWeight = FontWeight.SemiBold) }
            },
            dismissButton = {
                TextButton(onClick = { confirmDelete = null }) {
                    Text(stringResource(R.string.action_cancel), color = Burgundy)
                }
            },
            containerColor = CreamPage
        )
    }

    replyTarget?.let { c ->
        ReplySheet(
            comment = c,
            busy = state.busyId == c.id,
            error = state.error,
            warning = state.warning?.message,
            acknowledging = state.acknowledging,
            acknowledged = state.acknowledged,
            savedAt = state.replySavedAt,
            onSave = { body -> onSaveReply(c.id, body) },
            onAcknowledge = onAcknowledgeWarning,
            onDismiss = {
                replyTarget = null
                onDismissError()
            }
        )
    }
}

/** One comment: author, relative time, body, and the host's reply indented under a "Host" label. */
@Composable
private fun CommentCard(
    comment: ListingComment,
    isHost: Boolean,
    busy: Boolean,
    enabled: Boolean,
    onDelete: () -> Unit,
    onReply: () -> Unit,
    onDeleteReply: () -> Unit,
    showListing: Boolean = false,
    onOpenListing: (() -> Unit)? = null,
) {
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(18.dp),
        shadowElevation = 2.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (showListing) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .clickable(enabled = onOpenListing != null) { onOpenListing?.invoke() }
                ) {
                    if (!comment.listingImage.isNullOrBlank()) {
                        AsyncImage(
                            model = comment.listingImage,
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.size(36.dp).clip(RoundedCornerShape(8.dp))
                        )
                        Spacer(Modifier.width(10.dp))
                    }
                    Column(Modifier.weight(1f)) {
                        Text(
                            comment.listingTitle ?: "",
                            color = Ink,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            stringResource(R.string.host_questions_view_listing),
                            color = Burgundy,
                            fontSize = 12.sp
                        )
                    }
                    StatusPill(
                        stringResource(if (comment.isAnswered) R.string.host_questions_answered else R.string.host_questions_unanswered),
                        highlighted = !comment.isAnswered
                    )
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                ProfileAvatar(avatarUrl = comment.authorAvatar, initials = initialsOf(comment.authorName), size = 32.dp)
                Spacer(Modifier.width(10.dp))
                Text(
                    if (comment.mine) "${comment.authorName} · ${stringResource(R.string.comments_you_label)}" else comment.authorName,
                    color = Ink,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                val time = relativeTime(comment.createdAt)
                if (time.isNotBlank()) Text(time, color = Muted, fontSize = 12.sp)
            }
            Text(comment.body, color = Ink, fontSize = 14.sp, lineHeight = 20.sp)

            val reply = comment.reply
            if (reply != null) {
                Row(Modifier.fillMaxWidth().padding(start = 12.dp)) {
                    Box(Modifier.width(3.dp).heightIn(min = 36.dp).background(Tan, RoundedCornerShape(2.dp)))
                    Spacer(Modifier.width(10.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(stringResource(R.string.comments_host_label), color = Burgundy, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            val rt = relativeTime(reply.createdAt)
                            if (rt.isNotBlank()) Text(" · $rt", color = Muted, fontSize = 12.sp)
                        }
                        Text(reply.body, color = Muted, fontSize = 14.sp, lineHeight = 20.sp)
                    }
                }
            }

            // Actions: Delete on your own comment; Reply / Edit reply / Delete reply for the host.
            if (comment.mine || isHost) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (busy) {
                        CircularProgressIndicator(color = Burgundy, strokeWidth = 2.dp, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                    }
                    if (isHost) {
                        TextButton(onClick = onReply, enabled = enabled, contentPadding = PaddingValues(horizontal = 8.dp)) {
                            Text(
                                stringResource(if (reply == null) R.string.comments_reply else R.string.comments_edit_reply),
                                color = Burgundy,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        if (reply != null) {
                            TextButton(onClick = onDeleteReply, enabled = enabled, contentPadding = PaddingValues(horizontal = 8.dp)) {
                                Text(stringResource(R.string.comments_delete_reply), color = CommentErrorRed)
                            }
                        }
                    }
                    if (comment.mine) {
                        TextButton(onClick = onDelete, enabled = enabled, contentPadding = PaddingValues(horizontal = 8.dp)) {
                            Text(stringResource(R.string.comments_delete), color = CommentErrorRed)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatusPill(text: String, highlighted: Boolean) {
    Surface(
        color = if (highlighted) Burgundy else Tan,
        shape = RoundedCornerShape(50)
    ) {
        Text(
            text,
            color = if (highlighted) Color.White else Burgundy,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        )
    }
}

@Composable
private fun ErrorNote(text: String, onDismiss: () -> Unit) {
    Surface(
        color = CommentErrorRed.copy(alpha = 0.10f),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onDismiss)
    ) {
        Text(text, color = CommentErrorRed, fontSize = 13.sp, modifier = Modifier.padding(12.dp))
    }
}

/**
 * The host's reply editor. A ModalBottomSheet whose content SCROLLS (verticalScroll + imePadding):
 * a clipped, non-scrolling sheet once hid a whole feature in this app, and the keyboard plus the
 * policy-warning banner can easily push the Save button off a short screen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReplySheet(
    comment: ListingComment,
    busy: Boolean,
    error: String?,
    warning: String?,
    acknowledging: Boolean,
    acknowledged: Boolean,
    savedAt: Long,
    onSave: (String) -> Unit,
    onAcknowledge: () -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var text by rememberSaveable(comment.id) { mutableStateOf(comment.reply?.body.orEmpty()) }
    // Close once a save for this sheet lands (savedAt moves past its value at open).
    val openedAt = remember(comment.id) { savedAt }
    LaunchedEffect(savedAt) { if (savedAt != openedAt) onDismiss() }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = Cream) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .imePadding()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp)
                .padding(bottom = 20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                stringResource(R.string.comments_reply_title, comment.authorName),
                color = Ink,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp
            )
            Surface(color = Color.White, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
                Text(comment.body, color = Muted, fontSize = 14.sp, modifier = Modifier.padding(12.dp))
            }
            OutlinedTextField(
                value = text,
                onValueChange = { if (it.length <= CommentRules.MAX_BODY) text = it },
                placeholder = { Text(stringResource(R.string.comments_reply_hint), color = Muted) },
                minLines = 3,
                maxLines = 8,
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White,
                    focusedBorderColor = Burgundy
                ),
                modifier = Modifier.fillMaxWidth()
            )
            Row {
                Text(stringResource(R.string.comments_public_hint), color = Muted, fontSize = 12.sp, modifier = Modifier.weight(1f))
                Text("${text.length}/${CommentRules.MAX_BODY}", color = Muted, fontSize = 12.sp)
            }
            if (acknowledged && warning == null) {
                Text(stringResource(R.string.comments_warning_ack), color = Muted, fontSize = 13.sp)
            }
            if (error != null) {
                Text(error, color = CommentErrorRed, fontSize = 13.sp)
            }
            if (warning != null) {
                PolicyWarningBanner(text = warning, isAcknowledging = acknowledging, onAcknowledge = onAcknowledge)
            } else {
                Button(
                    onClick = { onSave(text) },
                    enabled = !busy && CommentRules.canSubmit(text),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White),
                    modifier = Modifier.fillMaxWidth().height(50.dp)
                ) {
                    if (busy) {
                        CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                    } else {
                        Text(stringResource(R.string.comments_save_reply), fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}

/**
 * The host's "Guest questions" screen (`GET /api/local/host/comments`): every comment across their
 * listings, unanswered first, with the unanswered count up top and inline Reply / Edit / Delete
 * reply. Tapping a row's listing header opens that listing's detail (its comments section).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HostCommentsScreen(
    state: HostCommentsUiState,
    onBack: () -> Unit,
    onLoad: () -> Unit,
    onOpenListing: (listingId: String) -> Unit,
    onSaveReply: (ListingComment, String) -> Unit,
    onDeleteReply: (ListingComment) -> Unit,
    onAcknowledgeWarning: () -> Unit,
    onDismissError: () -> Unit,
) {
    LaunchedEffect(Unit) { onLoad() }
    var replyTarget by remember { mutableStateOf<ListingComment?>(null) }

    Scaffold(
        containerColor = CreamPage,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.host_questions_title), color = Ink, fontWeight = FontWeight.Bold) },
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
            modifier = Modifier.fillMaxSize().padding(padding).background(CreamPage),
            contentAlignment = Alignment.Center
        ) {
            when {
                state.isLoading && state.comments.isEmpty() -> CircularProgressIndicator(color = Burgundy)
                state.loadError != null && state.comments.isEmpty() -> Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(32.dp)
                ) {
                    Text(stringResource(R.string.host_questions_error), color = Ink, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
                    Text(state.loadError, color = Muted, fontSize = 13.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 6.dp))
                    TextButton(onClick = onLoad) {
                        Text(stringResource(R.string.action_retry), color = Burgundy, fontWeight = FontWeight.SemiBold)
                    }
                }
                state.loaded && state.comments.isEmpty() -> Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(32.dp)
                ) {
                    Icon(Icons.Filled.QuestionAnswer, contentDescription = null, tint = Burgundy, modifier = Modifier.size(48.dp))
                    Text(
                        stringResource(R.string.host_questions_empty_title),
                        color = Ink,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        modifier = Modifier.padding(top = 12.dp)
                    )
                    Text(
                        stringResource(R.string.host_questions_empty_body),
                        color = Muted,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
                else -> LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    item {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                Modifier.size(10.dp).background(
                                    if (state.unanswered > 0) Burgundy else Tan,
                                    CircleShape
                                )
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                if (state.unanswered > 0) stringResource(R.string.host_questions_count, state.unanswered)
                                else stringResource(R.string.host_questions_none),
                                color = Ink,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                    if (state.error != null && replyTarget == null) {
                        item { ErrorNote(state.error, onDismiss = onDismissError) }
                    }
                    if (state.acknowledged && state.warning == null) {
                        item { Text(stringResource(R.string.comments_warning_ack), color = Muted, fontSize = 13.sp) }
                    }
                    items(state.comments, key = { it.id }) { c ->
                        CommentCard(
                            comment = c,
                            isHost = true,
                            busy = state.busyId == c.id,
                            enabled = state.busyId == null,
                            onDelete = {},
                            onReply = { replyTarget = c },
                            onDeleteReply = { onDeleteReply(c) },
                            showListing = true,
                            onOpenListing = if (c.listingId.isNotBlank()) ({ onOpenListing(c.listingId) }) else null
                        )
                    }
                }
            }
        }
    }

    replyTarget?.let { c ->
        ReplySheet(
            comment = c,
            busy = state.busyId == c.id,
            error = state.error,
            warning = state.warning?.message,
            acknowledging = state.acknowledging,
            acknowledged = state.acknowledged,
            savedAt = state.replySavedAt,
            onSave = { body -> onSaveReply(c, body) },
            onAcknowledge = onAcknowledgeWarning,
            onDismiss = {
                replyTarget = null
                onDismissError()
            }
        )
    }
}
