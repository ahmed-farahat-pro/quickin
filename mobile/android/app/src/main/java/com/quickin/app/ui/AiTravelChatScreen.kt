package com.quickin.app.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.AiChatMessage
import com.quickin.app.AiTravelUiState
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Gold
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

private val ErrorRed = Color(0xFFB3261E)

/**
 * AI **travel concierge** chat. A branded full-screen sheet: a burgundy-accented top bar
 * (AutoAwesome sparkle + close), a scrolling transcript of bubbles (user = burgundy
 * trailing, assistant = tan leading) that auto-scrolls and shows a typing indicator while
 * the first token streams, an empty/greeting state with tappable suggestion chips, and a
 * rounded input row with a burgundy send button (disabled while streaming). Errors show
 * inline with a Retry. Styling mirrors the per-booking [ChatScreen].
 *
 * @param onSend    send a (prefilled or typed) message
 * @param onRetry   re-send the last user message after an error
 * @param onClose   dismiss the concierge
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AiTravelChatScreen(
    state: AiTravelUiState,
    onSend: (String) -> Unit,
    onRetry: () -> Unit,
    onClose: () -> Unit
) {
    val listState = rememberLazyListState()
    // Keep the newest content in view as the user sends and as tokens stream in.
    LaunchedEffect(state.messages.size, state.messages.lastOrNull()?.content) {
        if (state.messages.isNotEmpty()) {
            listState.animateScrollToItem(state.messages.size - 1)
        }
    }

    Scaffold(
        containerColor = CreamPage,
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(color = Burgundy, shape = CircleShape, modifier = Modifier.size(34.dp)) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    Icons.Filled.AutoAwesome,
                                    contentDescription = null,
                                    tint = Gold,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                        Spacer(Modifier.size(10.dp))
                        Column {
                            Text(stringResource(R.string.ai_title), color = Ink, fontWeight = FontWeight.SemiBold)
                            Text(stringResource(R.string.ai_subtitle), color = Muted, fontSize = 12.sp, maxLines = 1)
                        }
                    }
                },
                actions = {
                    IconButton(onClick = onClose) {
                        Icon(
                            Icons.Filled.Close,
                            contentDescription = stringResource(R.string.cd_ai_close),
                            tint = Ink
                        )
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
                if (state.isEmpty) {
                    GreetingState(onSuggestion = onSend)
                } else {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(state.messages, key = { it.id }) { message ->
                            // The empty assistant bubble at the tail (pre-first-token) shows
                            // the animated typing dots instead of an empty cream rectangle.
                            val isPendingAssistant = !message.isUser &&
                                message.content.isEmpty() &&
                                message.id == state.messages.last().id &&
                                state.isStreaming
                            if (isPendingAssistant) {
                                TypingBubble()
                            } else {
                                MessageBubble(message = message)
                            }
                        }
                    }
                }
            }

            // Inline error with Retry, just above the input row.
            if (state.error != null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        state.error,
                        color = ErrorRed,
                        fontSize = 12.sp,
                        modifier = Modifier.weight(1f)
                    )
                    TextButton(onClick = onRetry) {
                        Text(stringResource(R.string.action_retry), color = Burgundy, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            AiInputBar(isStreaming = state.isStreaming, onSend = onSend)
        }
    }
}

/** Empty state: sparkle, greeting copy, and tappable suggestion chips that prefill + send. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun GreetingState(onSuggestion: (String) -> Unit) {
    val suggestions = listOf(
        stringResource(R.string.ai_suggest_beach),
        stringResource(R.string.ai_suggest_summer),
        stringResource(R.string.ai_suggest_family),
        stringResource(R.string.ai_suggest_dive)
    )
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxSize()
            .padding(28.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Surface(color = Burgundy, shape = CircleShape, modifier = Modifier.size(64.dp)) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    Icons.Filled.AutoAwesome,
                    contentDescription = null,
                    tint = Gold,
                    modifier = Modifier.size(30.dp)
                )
            }
        }
        Text(
            stringResource(R.string.ai_title),
            fontWeight = FontWeight.Bold,
            color = Ink,
            fontSize = 20.sp,
            modifier = Modifier.padding(top = 16.dp)
        )
        Text(
            stringResource(R.string.ai_greeting),
            color = Muted,
            fontSize = 14.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp)
        )
        Spacer(Modifier.height(20.dp))
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            suggestions.forEach { suggestion ->
                SuggestionChip(label = suggestion, onClick = { onSuggestion(suggestion) })
            }
        }
    }
}

@Composable
private fun SuggestionChip(label: String, onClick: () -> Unit) {
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(20.dp),
        shadowElevation = 1.dp,
        modifier = Modifier.clickable(onClick = onClick)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)
        ) {
            Icon(
                Icons.Filled.AutoAwesome,
                contentDescription = null,
                tint = Gold,
                modifier = Modifier.size(15.dp)
            )
            Spacer(Modifier.size(7.dp))
            Text(label, color = Ink, fontSize = 13.sp)
        }
    }
}

@Composable
private fun MessageBubble(message: AiChatMessage) {
    val mine = message.isUser
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
            modifier = Modifier.widthIn(max = 300.dp)
        ) {
            Text(
                message.content,
                color = if (mine) Color.White else Ink,
                fontSize = 15.sp,
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 9.dp)
            )
        }
    }
}

/** Animated "…" assistant bubble shown before the first token arrives. */
@Composable
private fun TypingBubble() {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Start) {
        Surface(
            color = Tan,
            shape = RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp, bottomStart = 4.dp, bottomEnd = 18.dp)
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(5.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                val transition = rememberInfiniteTransition(label = "typing")
                repeat(3) { i ->
                    val a by transition.animateFloat(
                        initialValue = 0.3f,
                        targetValue = 1f,
                        animationSpec = infiniteRepeatable(
                            animation = tween(durationMillis = 600, delayMillis = i * 160),
                            repeatMode = RepeatMode.Reverse
                        ),
                        label = "dot$i"
                    )
                    Box(
                        modifier = Modifier
                            .size(7.dp)
                            .alpha(a)
                            .background(Burgundy, CircleShape)
                    )
                }
            }
        }
    }
}

@Composable
private fun AiInputBar(isStreaming: Boolean, onSend: (String) -> Unit) {
    var draft by remember { mutableStateOf("") }
    val canSend = draft.isNotBlank() && !isStreaming

    Surface(color = Cream, shadowElevation = 8.dp) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextField(
                value = draft,
                onValueChange = { draft = it },
                placeholder = { Text(stringResource(R.string.ai_input_placeholder), color = Muted) },
                enabled = !isStreaming,
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
                    unfocusedTextColor = Ink,
                    disabledTextColor = Ink
                ),
                modifier = Modifier.weight(1f)
            )
            Spacer(Modifier.size(8.dp))
            Surface(
                shape = CircleShape,
                color = if (canSend) Burgundy else Burgundy.copy(alpha = 0.4f),
                modifier = Modifier.size(48.dp)
            ) {
                IconButton(
                    onClick = {
                        val text = draft.trim()
                        if (text.isNotEmpty() && !isStreaming) {
                            onSend(text)
                            draft = ""
                        }
                    },
                    enabled = canSend
                ) {
                    if (isStreaming) {
                        CircularProgressIndicator(
                            color = Color.White,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(20.dp)
                        )
                    } else {
                        Icon(
                            Icons.AutoMirrored.Filled.Send,
                            contentDescription = stringResource(R.string.ai_send),
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }
    }
}
