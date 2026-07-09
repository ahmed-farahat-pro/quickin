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
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.ChatLine
import com.quickin.app.ChatThreadService
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan
import kotlinx.coroutines.launch

private val PreChatErrorRed = Color(0xFFB3261E)
private const val PRE_CHAT_POLL_MS = 4_000L

/**
 * Pre-booking chat: a guest messaging a listing's host BEFORE reserving. Self-contained (no
 * ViewModel) — on first load it opens (or reuses) the conversation via
 * [ChatThreadService.openConversation], then polls [ChatThreadService.listMessages] every ~4s and
 * POSTs new lines with [ChatThreadService.sendMessage]. Mine are right-aligned burgundy bubbles,
 * the host's are left-aligned tan. A null [token] shows a "sign in to chat" state.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PreBookingChatScreen(
    token: String?,
    listingId: String,
    hostName: String,
    onBack: () -> Unit
) {
    if (token == null) {
        SignInToChat(hostName = hostName, onBack = onBack)
        return
    }

    val scope = rememberCoroutineScope()
    var conversationId by remember(listingId) { mutableStateOf<String?>(null) }
    var messages by remember(listingId) { mutableStateOf<List<ChatLine>>(emptyList()) }
    var isLoading by remember(listingId) { mutableStateOf(true) }
    var error by remember(listingId) { mutableStateOf<String?>(null) }
    var draft by remember(listingId) { mutableStateOf("") }
    var isSending by remember { mutableStateOf(false) }

    // Open (or reuse) the conversation, then load its first page of messages.
    LaunchedEffect(token, listingId) {
        isLoading = true
        error = null
        try {
            val cid = ChatThreadService.openConversation(token, listingId)
            if (cid.isNotBlank()) {
                conversationId = cid
                messages = ChatThreadService.listMessages(token, cid)
            } else {
                error = "Couldn't start this conversation."
            }
        } catch (e: Exception) {
            error = e.message ?: "Couldn't start this conversation."
        } finally {
            isLoading = false
        }
    }

    // Lightweight poll: refresh every ~4s once the conversation is open. Transient failures keep
    // the last good list rather than blanking the thread.
    LaunchedEffect(conversationId) {
        val cid = conversationId ?: return@LaunchedEffect
        while (true) {
            kotlinx.coroutines.delay(PRE_CHAT_POLL_MS)
            try {
                messages = ChatThreadService.listMessages(token, cid)
            } catch (_: Exception) { /* keep prior messages */ }
        }
    }

    val listState = rememberLazyListState()
    // Keep the newest message in view as the thread grows (oldest-first list).
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
    }

    val doSend: () -> Unit = send@{
        val cid = conversationId ?: return@send
        val text = draft.trim()
        if (text.isEmpty() || isSending) return@send
        isSending = true
        error = null
        scope.launch {
            try {
                val sent = ChatThreadService.sendMessage(token, cid, text)
                // Optimistic append; the next poll reconciles with the server list.
                messages = messages + sent
                draft = ""
            } catch (e: Exception) {
                // Keep the typed text so a rejected message (e.g. a phone number) isn't lost.
                error = e.message ?: "Couldn't send your message."
            } finally {
                isSending = false
            }
        }
    }

    Scaffold(
        containerColor = CreamPage,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            hostName.ifBlank { "Host" },
                            color = Ink,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1
                        )
                        Text("Ask about this stay", color = Muted, fontSize = 12.sp, maxLines = 1)
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
                    isLoading && messages.isEmpty() -> Box(
                        Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = Burgundy)
                    }
                    messages.isEmpty() -> EmptyPreChat(hostName = hostName)
                    else -> LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(messages, key = { it.id }) { line ->
                            PreChatBubble(line = line, hostName = hostName)
                        }
                    }
                }
            }

            // A transient send/load error sits just above the input bar — including the backend's
            // "sharing phone numbers in chat isn't allowed" 400.
            val err = error
            if (err != null) {
                Surface(
                    color = PreChatErrorRed.copy(alpha = 0.10f),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(
                        err,
                        color = PreChatErrorRed,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                    )
                }
            }

            PreChatInputBar(
                draft = draft,
                onDraftChange = { draft = it },
                isSending = isSending,
                enabled = conversationId != null,
                onSend = doSend
            )
        }
    }
}

@Composable
private fun PreChatBubble(line: ChatLine, hostName: String) {
    val mine = line.mine
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
                if (!mine && hostName.isNotBlank()) {
                    Text(
                        hostName,
                        color = Burgundy,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(Modifier.height(2.dp))
                }
                Text(
                    line.body,
                    color = if (mine) Color.White else Ink,
                    fontSize = 15.sp
                )
            }
        }
    }
}

@Composable
private fun EmptyPreChat(hostName: String) {
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
                "Message ${hostName.ifBlank { "the host" }}",
                fontWeight = FontWeight.Bold,
                color = Ink,
                fontSize = 17.sp,
                modifier = Modifier.padding(top = 12.dp)
            )
            Text(
                "Ask about check-in, the location, or anything before you book.",
                color = Muted,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 6.dp)
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SignInToChat(hostName: String, onBack: () -> Unit) {
    Scaffold(
        containerColor = CreamPage,
        topBar = {
            TopAppBar(
                title = { Text(hostName.ifBlank { "Message host" }, color = Ink, fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Ink)
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
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(32.dp)
            ) {
                Icon(
                    Icons.Filled.Lock,
                    contentDescription = null,
                    tint = Burgundy,
                    modifier = Modifier.size(44.dp)
                )
                Text(
                    "Sign in to chat",
                    fontWeight = FontWeight.Bold,
                    color = Ink,
                    fontSize = 18.sp,
                    modifier = Modifier.padding(top = 12.dp)
                )
                Text(
                    "Sign in to message the host before you book.",
                    color = Muted,
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 6.dp)
                )
                Button(
                    onClick = onBack,
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White),
                    modifier = Modifier.padding(top = 20.dp)
                ) {
                    Text("Go back", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
private fun PreChatInputBar(
    draft: String,
    onDraftChange: (String) -> Unit,
    isSending: Boolean,
    enabled: Boolean,
    onSend: () -> Unit
) {
    val canSend = draft.isNotBlank() && !isSending && enabled

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
                enabled = enabled,
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
                IconButton(onClick = onSend, enabled = canSend) {
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
