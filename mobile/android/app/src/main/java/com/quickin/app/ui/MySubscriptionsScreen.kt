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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Sailing
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.quickin.app.MySubscriptionsUiState
import com.quickin.app.ServiceRequest
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

/**
 * "My subscriptions" full-screen list (reached from Profile). Lists the user's service
 * requests as cards with a [StatusBadge] (pending / confirmed / rejected). Mirrors
 * [ReservationsScreen]'s signed-in body.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MySubscriptionsScreen(
    state: MySubscriptionsUiState,
    onBack: () -> Unit,
    onLoad: () -> Unit
) {
    LaunchedEffect(Unit) {
        onLoad()
    }

    Scaffold(
        containerColor = CreamPage,
        topBar = {
            TopAppBar(
                title = { Text("My subscriptions", color = Ink, fontWeight = FontWeight.Bold) },
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
            when {
                // Skeleton cards shaped like subscription cards shimmer in place of a spinner.
                state.isLoading && state.requests.isEmpty() -> SkeletonListColumn(imageHeight = 180.dp, spacing = 16.dp)
                state.error != null && state.requests.isEmpty() -> Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(32.dp)
                ) {
                    Text("Couldn't load subscriptions", fontWeight = FontWeight.Bold, color = Ink, fontSize = 18.sp)
                    Text(state.error, color = Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp, bottom = 16.dp))
                    Button(
                        onClick = onLoad,
                        colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White)
                    ) { Text("Retry") }
                }
                state.requests.isEmpty() -> Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(32.dp)
                ) {
                    Icon(Icons.Filled.Sailing, contentDescription = null, tint = Burgundy, modifier = Modifier.size(48.dp))
                    Text(
                        "No subscriptions yet",
                        fontWeight = FontWeight.Bold,
                        color = Ink,
                        fontSize = 18.sp,
                        modifier = Modifier.padding(top = 12.dp)
                    )
                    Text(
                        "Subscribe to an experience and it'll appear here.",
                        color = Muted,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
                else -> LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    items(state.requests) { request ->
                        SubscriptionCard(request)
                    }
                }
            }
        }
    }
}

@Composable
private fun SubscriptionCard(request: ServiceRequest) {
    BoutiqueCard(
        modifier = Modifier.fillMaxWidth(),
        shadow = 8.dp,
        radius = CardRadius
    ) {
        Column {
            Box(
                modifier = Modifier
                    .padding(8.dp)
                    .clip(RoundedCornerShape(20.dp))
            ) {
                val imageUrl = request.imageUrl
                if (imageUrl != null) {
                    AsyncImage(
                        model = imageUrl,
                        contentDescription = request.serviceTitle,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(184.dp)
                            .background(Tan)
                    )
                } else {
                    PhotoPlaceholder(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(184.dp),
                        icon = Icons.Filled.Sailing
                    )
                }
                Surface(
                    shape = RoundedCornerShape(50),
                    color = Color.White.copy(alpha = 0.94f),
                    shadowElevation = 2.dp,
                    modifier = Modifier.padding(10.dp).align(Alignment.TopEnd)
                ) {
                    StatusBadge(request.status)
                }
            }
            Column(modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 18.dp)) {
                Text(
                    request.serviceTitle,
                    fontWeight = FontWeight.Bold,
                    color = Ink,
                    fontSize = 17.sp,
                    maxLines = 1
                )
                if (!request.serviceCategory.isNullOrBlank()) {
                    Text(
                        request.serviceCategory.replaceFirstChar { it.uppercase() },
                        color = Burgundy,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(top = 3.dp)
                    )
                }
                if (!request.serviceLocation.isNullOrBlank()) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                        Icon(
                            Icons.Filled.LocationOn,
                            contentDescription = null,
                            tint = Muted,
                            modifier = Modifier.size(15.dp)
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(request.serviceLocation, color = Muted, fontSize = 14.sp, maxLines = 1)
                    }
                }
                if (!request.note.isNullOrBlank()) {
                    Text(
                        "“${request.note}”",
                        color = Muted,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp)
                ) {
                    if (!request.requestCode.isNullOrBlank()) {
                        Text(request.requestCode, color = Muted, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                    } else {
                        Spacer(Modifier.width(1.dp))
                    }
                    Text(request.priceText, color = Burgundy, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }
        }
    }
}
