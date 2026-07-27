package com.quickin.app.ui

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.AppNotification
import com.quickin.app.NotificationsUiState
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan
import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * In-app NOTIFICATIONS feed. Full-screen overlay (no bottom bar). Each row shows a
 * leading burgundy unread dot when the item is unread, a bold [AppNotification.title],
 * an optional muted body, and — right-aligned on the title row — the item's age
 * ("2h ago", "3 Jul") derived from the ISO-8601 `created_at` by [relativeTime].
 * Tapping a row marks it read (then reloads); the top bar carries a back arrow and a
 * "Mark all read" action.
 *
 * The app draws edge-to-edge, so the top bar uses [Modifier.statusBarsPadding] to clear
 * the status bar.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(
    state: NotificationsUiState,
    onBack: () -> Unit,
    onLoad: () -> Unit,
    onMarkRead: (String) -> Unit,
    onMarkAllRead: () -> Unit
) {
    // Refresh on open.
    LaunchedEffect(Unit) { onLoad() }

    val hasUnread = state.unreadCount > 0

    Scaffold(
        containerColor = CreamPage,
        topBar = {
            TopAppBar(
                modifier = Modifier.statusBarsPadding(),
                title = { Text("Notifications", color = Ink, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = Ink
                        )
                    }
                },
                actions = {
                    if (hasUnread) {
                        TextButton(onClick = onMarkAllRead) {
                            Icon(
                                Icons.Filled.DoneAll,
                                contentDescription = null,
                                tint = Burgundy,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(Modifier.width(6.dp))
                            Text("Mark all read", color = Burgundy, fontWeight = FontWeight.SemiBold)
                        }
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
            when {
                state.isLoading && state.notifications.isEmpty() -> {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = Burgundy)
                        Text(
                            "Loading notifications…",
                            color = Muted,
                            modifier = Modifier.padding(top = 12.dp)
                        )
                    }
                }
                state.error != null && state.notifications.isEmpty() -> {
                    ErrorState(message = state.error, onRetry = onLoad)
                }
                state.notifications.isEmpty() -> EmptyNotifications()
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(state.notifications, key = { it.id }) { notif ->
                            NotificationRow(
                                notif = notif,
                                onClick = { onMarkRead(notif.id) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NotificationRow(notif: AppNotification, onClick: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        // Unread items pop with a faint tan wash; read items sit on white.
        color = if (notif.read) Color.White else Tan.copy(alpha = 0.55f),
        shadowElevation = if (notif.read) 2.dp else 4.dp,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Leading burgundy unread dot (a transparent placeholder keeps text aligned
            // once the item is read).
            Box(
                modifier = Modifier
                    .padding(top = 5.dp)
                    .size(9.dp)
                    .background(
                        color = if (notif.read) Color.Transparent else Burgundy,
                        shape = CircleShape
                    )
            )
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.Top) {
                    Text(
                        notif.title,
                        color = Ink,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        modifier = Modifier.weight(1f)
                    )
                    // Age of the notification, right-aligned on the title row. Blank
                    // (and skipped entirely) when there's no usable timestamp.
                    val time = relativeTime(notif.createdAt)
                    if (time.isNotBlank()) {
                        Spacer(Modifier.width(8.dp))
                        Text(
                            time,
                            color = Muted,
                            fontSize = 12.sp,
                            maxLines = 1
                        )
                    }
                }
                if (!notif.body.isNullOrBlank()) {
                    Text(
                        notif.body,
                        color = Muted,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun EmptyNotifications() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(32.dp)
    ) {
        Icon(
            Icons.Filled.NotificationsNone,
            contentDescription = null,
            tint = Burgundy,
            modifier = Modifier.size(48.dp)
        )
        Text(
            "You're all caught up",
            fontWeight = FontWeight.Bold,
            color = Ink,
            fontSize = 18.sp,
            modifier = Modifier.padding(top = 12.dp)
        )
        Text(
            "Booking updates and messages will show up here.",
            color = Muted,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(32.dp)
    ) {
        Text("Couldn't load notifications", fontWeight = FontWeight.Bold, color = Ink, fontSize = 18.sp)
        Text(
            message,
            color = Muted,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp, bottom = 16.dp)
        )
        TextButton(onClick = onRetry) {
            Text("Retry", color = Burgundy, fontWeight = FontWeight.SemiBold)
        }
    }
}

/**
 * Renders an ISO-8601 timestamp as a short age label:
 *
 *   under a minute -> "Just now"    under an hour -> "5m ago"
 *   under a day    -> "2h ago"      under a week  -> "3d ago"
 *   a week or more -> "3 Jul" (plus the year, "3 Jul 2025", when it isn't this year)
 *
 * Returns "" for a missing or unparseable timestamp so the row renders no time at all
 * rather than a raw string.
 */
private fun relativeTime(iso: String?): String {
    val then = parseInstantOrNull(iso) ?: return ""
    // Clamped so small clock skew (server slightly ahead of the device) still reads "Just now".
    val seconds = Duration.between(then, OffsetDateTime.now()).seconds.coerceAtLeast(0)
    return when {
        seconds < 60 -> "Just now"
        seconds < 3_600 -> "${seconds / 60}m ago"
        seconds < 86_400 -> "${seconds / 3_600}h ago"
        seconds < 604_800 -> "${seconds / 86_400}d ago"
        else -> absoluteDate(then)
    }
}

/**
 * "3 Jul" for a date in the current year, "3 Jul 2025" otherwise — in the device's
 * time zone, with English month names to match the rest of the app's date labels.
 */
private fun absoluteDate(then: OffsetDateTime): String {
    val date = then.atZoneSameInstant(ZoneId.systemDefault()).toLocalDate()
    val pattern = if (date.year == LocalDate.now().year) "d MMM" else "d MMM yyyy"
    return date.format(DateTimeFormatter.ofPattern(pattern, Locale.ENGLISH))
}

/**
 * Parses common ISO-8601 shapes the API may emit: an offset/Z timestamp
 * (`2026-06-13T10:00:00Z`) or a bare local timestamp (`2026-06-13T10:00:00`,
 * assumed UTC). Returns null for null/blank input and anything unparseable.
 */
private fun parseInstantOrNull(iso: String?): OffsetDateTime? {
    val text = iso?.trim().orEmpty()
    if (text.isEmpty()) return null
    runCatching { return OffsetDateTime.parse(text) }
    runCatching {
        return LocalDateTime
            .parse(text, DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            .atOffset(ZoneOffset.UTC)
    }
    return null
}
