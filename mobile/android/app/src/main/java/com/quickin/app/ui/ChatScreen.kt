package com.quickin.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.ChatMessage
import com.quickin.app.ChatUiState
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

private val ErrorRed = Color(0xFFB3261E)
private const val POLL_INTERVAL_MS = 4_000L

/**
 * Per-booking CHAT thread (host ↔ guest). A scrolling list of message bubbles —
 * mine right-aligned in burgundy, the other party left-aligned in tan — over a
 * bottom input bar. Polls `GET /api/local/bookings/:id/messages` every ~4s and
 * POSTs new messages; both run through [ChatViewModel].
 *
 * @param title shown in the app bar (e.g. the listing/stay name), optional.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    bookingId: String,
    state: ChatUiState,
    title: String? = null,
    onStart: (String) -> Unit,
    onRefresh: () -> Unit,
    onSend: (String) -> Unit,
    onBack: () -> Unit
) {
    // Bind the thread + first load; re-binds if the bookingId changes.
    LaunchedEffect(bookingId) { onStart(bookingId) }

    // Lightweight poll: refresh every ~4s while this screen is composed.
    LaunchedEffect(bookingId) {
        while (true) {
            kotlinx.coroutines.delay(POLL_INTERVAL_MS)
            onRefresh()
        }
    }

    val listState = rememberLazyListState()
    // Keep the newest message in view as the thread grows (oldest-first list).
    LaunchedEffect(state.messages.size) {
        if (state.messages.isNotEmpty()) {
            listState.animateScrollToItem(state.messages.size - 1)
        }
    }

    // The message draft lives here (not in the input bar) so a *failed* send keeps the typed text —
    // e.g. when the backend rejects a phone number with 400. It's cleared only once a send succeeds
    // (isSending goes true → false with no error), tracked below.
    var draft by remember { mutableStateOf("") }
    var wasSending by remember { mutableStateOf(false) }
    LaunchedEffect(state.isSending, state.error) {
        if (wasSending && !state.isSending && state.error == null) {
            // The send completed successfully — clear the input for the next message.
            draft = ""
        }
        wasSending = state.isSending
    }

    Scaffold(
        containerColor = CreamPage,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Messages", color = Ink, fontWeight = FontWeight.SemiBold)
                        if (!title.isNullOrBlank()) {
                            Text(title, color = Muted, fontSize = 12.sp, maxLines = 1)
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Ink)
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
                .imePadding()
        ) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                when {
                    state.isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = Burgundy)
                    }
                    // Always the friendly empty state here; any error (load failure or a rejected
                    // send) is surfaced by the dedicated error banner just above the input bar, so
                    // a send rejection on an empty thread isn't mislabeled as a load failure.
                    state.messages.isEmpty() -> EmptyThread()
                    else -> LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(state.messages, key = { it.id }) { message ->
                            MessageBubble(message = message, mine = message.isMine(state.myId))
                        }
                    }
                }
            }

            // A transient send/refresh error sits just above the input bar — including the
            // backend's "sharing phone numbers in chat isn't allowed" 400. Always shown (even on an
            // empty thread) so a rejected first message is explained while its text is kept below.
            if (state.error != null) {
                Surface(
                    color = ErrorRed.copy(alpha = 0.10f),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(
                        state.error,
                        color = ErrorRed,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                    )
                }
            }

            ChatInputBar(
                draft = draft,
                onDraftChange = { draft = it },
                isSending = state.isSending,
                onSend = onSend
            )
        }
    }
}

@Composable
private fun EmptyThread() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp)
        ) {
            Icon(
                Icons.Filled.ChatBubbleOutline,
                contentDescription = null,
                tint = Burgundy,
                modifier = Modifier.size(44.dp)
            )
            Text(
                "No messages yet",
                fontWeight = FontWeight.Bold,
                color = Ink,
                fontSize = 17.sp,
                modifier = Modifier.padding(top = 12.dp)
            )
            Text(
                "Say hello to get the conversation started.",
                color = Muted,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 6.dp)
            )
        }
    }
}

@Composable
private fun MessageBubble(message: ChatMessage, mine: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start
    ) {
        Surface(
            color = if (mine) Burgundy else Tan,
            shape = RoundedCornerShape(
                topStart = 18.dp,
                topEnd = 18.dp,
                bottomStart = if (mine) 18.dp else 4.dp,
                bottomEnd = if (mine) 4.dp else 18.dp
            ),
            modifier = Modifier.widthIn(max = 280.dp)
        ) {
            Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)) {
                // Show the other party's name above their bubble (not on my own).
                if (!mine && message.senderName.isNotBlank()) {
                    Text(
                        message.senderName,
                        color = Burgundy,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(Modifier.height(2.dp))
                }
                Text(
                    message.body,
                    color = if (mine) Color.White else Ink,
                    fontSize = 15.sp
                )
            }
        }
    }
}

@Composable
private fun ChatInputBar(
    draft: String,
    onDraftChange: (String) -> Unit,
    isSending: Boolean,
    onSend: (String) -> Unit
) {
    val canSend = draft.isNotBlank() && !isSending

    Surface(color = Cream, shadowElevation = 8.dp) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextField(
                value = draft,
                onValueChange = onDraftChange,
                placeholder = { Text("Message", color = Muted) },
                maxLines = 4,
                shape = RoundedCornerShape(24.dp),
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White,
                    disabledContainerColor = Color.White,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                    disabledIndicatorColor = Color.Transparent,
                    cursorColor = Burgundy,
                    focusedTextColor = Ink,
                    unfocusedTextColor = Ink
                ),
                modifier = Modifier.weight(1f)
            )
            Spacer(Modifier.size(8.dp))
            Surface(
                shape = RoundedCornerShape(50),
                color = if (canSend) Burgundy else Burgundy.copy(alpha = 0.4f),
                modifier = Modifier.size(48.dp)
            ) {
                IconButton(
                    onClick = {
                        val text = draft.trim()
                        // Don't clear the draft here — the parent clears it only once the send
                        // succeeds, so a rejected message (e.g. a phone number) keeps its text.
                        if (text.isNotEmpty() && !isSending) onSend(text)
                    },
                    enabled = canSend
                ) {
                    if (isSending) {
                        CircularProgressIndicator(
                            color = Color.White,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(20.dp)
                        )
                    } else {
                        Icon(
                            Icons.AutoMirrored.Filled.Send,
                            contentDescription = "Send",
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }
    }
}
