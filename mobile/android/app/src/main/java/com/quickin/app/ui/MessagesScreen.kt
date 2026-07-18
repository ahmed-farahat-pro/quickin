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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
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
import com.quickin.app.ConversationSummary
import com.quickin.app.ChatThreadService
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Gold
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan
import java.time.Duration
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter

/**
 * Messages INBOX — every guest ↔ host conversation the signed-in user is part of
 * (`GET /api/local/chat`), newest activity first. Mirrors the web `/messages` page. Self-contained
 * (no ViewModel): loads on appear; while a thread is open this screen leaves composition, so
 * returning from a thread re-triggers the load and the row's last-message preview is fresh.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MessagesScreen(
    token: String?,
    onOpenConversation: (conversationId: String, title: String) -> Unit,
    onBack: () -> Unit
) {
    var conversations by remember { mutableStateOf<List<ConversationSummary>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    // Bumped by the Retry button to re-run the load effect.
    var reloadKey by remember { mutableStateOf(0) }

    LaunchedEffect(token, reloadKey) {
        if (token == null) {
            isLoading = false
            return@LaunchedEffect
        }
        isLoading = true
        error = null
        try {
            conversations = ChatThreadService.listConversations(token)
        } catch (e: Exception) {
            error = e.message ?: "Couldn't load your messages."
        } finally {
            isLoading = false
        }
    }

    Scaffold(
        containerColor = CreamPage,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        stringResource(R.string.messages_title),
                        color = Ink,
                        fontWeight = FontWeight.Bold
                    )
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
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(CreamPage)
        ) {
            when {
                token == null -> MessagesSignIn(onBack = onBack)
                isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Burgundy)
                }
                error != null -> Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .align(Alignment.Center)
                        .padding(32.dp)
                ) {
                    Text(
                        stringResource(R.string.messages_error_title),
                        fontWeight = FontWeight.Bold,
                        color = Ink,
                        fontSize = 18.sp
                    )
                    Text(
                        error.orEmpty(),
                        color = Muted,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 8.dp, bottom = 16.dp)
                    )
                    Button(
                        onClick = { reloadKey += 1 },
                        colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White)
                    ) { Text("Retry") }
                }
                conversations.isEmpty() -> Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .align(Alignment.Center)
                        .padding(32.dp)
                ) {
                    Icon(
                        Icons.Filled.ChatBubbleOutline,
                        contentDescription = null,
                        tint = Burgundy,
                        modifier = Modifier.size(44.dp)
                    )
                    Text(
                        stringResource(R.string.messages_empty_title),
                        fontWeight = FontWeight.Bold,
                        color = Ink,
                        fontSize = 17.sp,
                        modifier = Modifier.padding(top = 12.dp)
                    )
                    Text(
                        stringResource(R.string.messages_empty_body),
                        color = Muted,
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                }
                else -> LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(conversations, key = { it.id }) { convo ->
                        ConversationRow(
                            convo = convo,
                            onClick = {
                                onOpenConversation(
                                    convo.id,
                                    convo.otherName ?: convo.listingTitle.orEmpty()
                                )
                            }
                        )
                    }
                }
            }
        }
    }
}

/** One inbox row: listing thumb, other party (+ "Host" badge), last message preview, timestamp. */
@Composable
private fun ConversationRow(convo: ConversationSummary, onClick: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = Color.White,
        shadowElevation = 4.dp,
        onClick = onClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp)
        ) {
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = Tan,
                modifier = Modifier.size(56.dp)
            ) {
                if (convo.listingImage != null) {
                    AsyncImage(
                        model = convo.listingImage,
                        contentDescription = convo.listingTitle,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(RoundedCornerShape(14.dp))
                    )
                } else {
                    PhotoPlaceholder(modifier = Modifier.fillMaxSize())
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        convo.otherName ?: stringResource(R.string.messages_title),
                        color = Ink,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                    if (convo.isHost) {
                        Spacer(Modifier.width(6.dp))
                        Surface(
                            shape = CircleShape,
                            color = Gold.copy(alpha = 0.18f)
                        ) {
                            Text(
                                stringResource(R.string.messages_host_badge),
                                color = Burgundy,
                                fontWeight = FontWeight.Bold,
                                fontSize = 10.sp,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                            )
                        }
                    }
                    Spacer(Modifier.weight(1f))
                    Text(
                        inboxRelativeTime(convo.lastMessageAt),
                        color = Muted,
                        fontSize = 11.sp
                    )
                }
                if (!convo.listingTitle.isNullOrBlank()) {
                    Text(
                        convo.listingTitle,
                        color = Burgundy,
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 1.dp)
                    )
                }
                Text(
                    convo.lastMessage ?: stringResource(R.string.messages_no_messages),
                    color = if (convo.lastMessage != null) Muted else Muted.copy(alpha = 0.7f),
                    fontSize = 13.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
            Spacer(Modifier.width(6.dp))
            Icon(
                Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = Muted,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

/** Signed-out state: the inbox needs an account (mirrors the web `/messages` sign-in gate). */
@Composable
private fun MessagesSignIn(onBack: () -> Unit) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
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
                stringResource(R.string.messages_sign_in_title),
                fontWeight = FontWeight.Bold,
                color = Ink,
                fontSize = 18.sp,
                modifier = Modifier.padding(top = 12.dp)
            )
            Text(
                stringResource(R.string.messages_sign_in_body),
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

/** Short relative label ("just now", "2h ago", "3d ago"); falls back to the raw string. */
private fun inboxRelativeTime(iso: String): String {
    if (iso.isBlank()) return ""
    val then = runCatching { OffsetDateTime.parse(iso) }.getOrNull()
        ?: runCatching {
            java.time.LocalDateTime
                .parse(iso, DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                .atOffset(java.time.ZoneOffset.UTC)
        }.getOrNull() ?: return iso
    val seconds = Duration.between(then, OffsetDateTime.now()).seconds
    val s = if (seconds < 0) 0 else seconds
    return when {
        s < 60 -> "now"
        s < 3_600 -> "${s / 60}m"
        s < 86_400 -> "${s / 3_600}h"
        s < 604_800 -> "${s / 86_400}d"
        else -> "${s / 604_800}w"
    }
}
