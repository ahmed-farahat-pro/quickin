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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.IosShare
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Sailing
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.quickin.app.R
import com.quickin.app.Service
import com.quickin.app.ServiceRequest
import com.quickin.app.ServicesUiState
import com.quickin.app.ShareLinks
import com.quickin.app.SubscribeUiState
import com.quickin.app.shareText
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

private val ServiceErrorRed = Color(0xFFB3261E)

/**
 * "Services" browse tab. Lists standalone experiences (jet ski, diving, yacht…) as cards —
 * Coil image, a category chip, title, host, location and "$price" — styled like [ListingsScreen].
 * Tapping a card opens [ServiceDetailScreen].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServicesScreen(
    state: ServicesUiState,
    onRetry: () -> Unit,
    onSelect: (Service) -> Unit,
    contentPadding: PaddingValues = PaddingValues()
) {
    Scaffold(
        containerColor = CreamPage,
        modifier = Modifier.padding(contentPadding),
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.services_title), color = Ink, fontWeight = FontWeight.Bold) },
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
                // Skeleton cards shaped like real service cards shimmer in place of a spinner.
                state.isLoading && state.services.isEmpty() -> SkeletonListColumn(imageHeight = 200.dp)
                state.services.isEmpty() -> Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(32.dp)
                ) {
                    Icon(Icons.Filled.Sailing, contentDescription = null, tint = Burgundy, modifier = Modifier.size(48.dp))
                    Text(
                        stringResource(R.string.services_no_experiences),
                        fontWeight = FontWeight.Bold,
                        color = Ink,
                        fontSize = 18.sp,
                        modifier = Modifier.padding(top = 12.dp)
                    )
                    Text(
                        state.error ?: stringResource(R.string.services_check_back),
                        color = Muted,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 8.dp, bottom = 16.dp)
                    )
                    Button(
                        onClick = onRetry,
                        colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White)
                    ) { Text(stringResource(R.string.action_retry)) }
                }
                else -> LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp)
                ) {
                    items(state.services) { service ->
                        ServiceCard(service = service, onClick = { onSelect(service) })
                    }
                }
            }
        }
    }
}

@Composable
private fun ServiceCard(service: Service, onClick: () -> Unit) {
    BoutiqueCard(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick,
        shadow = 8.dp,
        radius = CardRadius
    ) {
        Column {
            // Full-bleed cover with a photo-overlay gradient; category chip floats on top.
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(208.dp)
                    .clip(RoundedCornerShape(topStart = CardRadius, topEnd = CardRadius))
            ) {
                val imageUrl = service.image
                if (imageUrl != null) {
                    AsyncImage(
                        model = imageUrl,
                        contentDescription = service.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize().background(Tan)
                    )
                } else {
                    PhotoPlaceholder(modifier = Modifier.fillMaxSize(), icon = Icons.Filled.Sailing)
                }
                Box(
                    modifier = Modifier
                        .matchParentSize()
                        .background(
                            Brush.verticalGradient(
                                0f to Color.Transparent,
                                0.55f to Color.Transparent,
                                1f to Ink.copy(alpha = 0.45f)
                            )
                        )
                )
                if (!service.category.isNullOrBlank()) {
                    CategoryChip(
                        service.category,
                        modifier = Modifier.padding(10.dp).align(Alignment.TopStart)
                    )
                }
            }
            Column(modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 18.dp)) {
                Text(service.title, fontWeight = FontWeight.Bold, color = Ink, fontSize = 17.sp, maxLines = 1)
                if (!service.hostName.isNullOrBlank()) {
                    Text(stringResource(R.string.services_by, service.hostName), color = Muted, fontSize = 13.sp, maxLines = 1, modifier = Modifier.padding(top = 3.dp))
                }
                if (!service.location.isNullOrBlank()) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                        Icon(
                            Icons.Filled.LocationOn,
                            contentDescription = null,
                            tint = Muted,
                            modifier = Modifier.size(15.dp)
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(service.location, color = Muted, fontSize = 14.sp, maxLines = 1)
                    }
                }
                Row(modifier = Modifier.padding(top = 10.dp), verticalAlignment = Alignment.Bottom) {
                    Text(service.priceText, fontWeight = FontWeight.Bold, color = Burgundy, fontSize = 16.sp)
                    Text(stringResource(R.string.services_per_experience), color = Muted, fontSize = 14.sp)
                }
            }
        }
    }
}

/** A small Burgundy capsule used for the service category (e.g. "Water sports"). */
@Composable
private fun CategoryChip(label: String, modifier: Modifier = Modifier) {
    Surface(
        shape = RoundedCornerShape(50),
        color = Burgundy,
        modifier = modifier
    ) {
        Text(
            label.replaceFirstChar { it.uppercase() },
            color = Color.White,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
        )
    }
}

/**
 * Service detail screen. Shows the gallery image, category, host, location, description, and a
 * "Subscribe" panel. On a successful (pending) subscription it shows a branded confirmation
 * [Dialog] identical to the listing's "Request sent" modal. Subscribing requires sign-in.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServiceDetailScreen(
    service: Service,
    onBack: () -> Unit,
    subscribeState: SubscribeUiState = SubscribeUiState(),
    onSubscribe: (note: String) -> Unit = {},
    onSignIn: () -> Unit = {},
    onResetSubscribe: () -> Unit = {}
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    Scaffold(
        containerColor = CreamPage,
        topBar = {
            TopAppBar(
                title = { Text(service.title, maxLines = 1, color = Ink, fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_back), tint = Ink)
                    }
                },
                actions = {
                    // Share this experience's public web link via the system chooser.
                    IconButton(onClick = {
                        shareText(
                            context = context,
                            text = ShareLinks.service(service.id),
                            subject = context.getString(R.string.share_subject, service.title),
                            chooserTitle = context.getString(R.string.share_chooser_title)
                        )
                    }) {
                        Icon(Icons.Filled.IosShare, contentDescription = stringResource(R.string.cd_share), tint = Burgundy)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = CreamPage)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(CreamPage)
        ) {
            item {
                // Ken Burns hero with a bottom legibility gradient.
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(300.dp)
                ) {
                    KenBurnsImage(
                        url = service.image,
                        contentDescription = null,
                        modifier = Modifier.fillMaxSize(),
                        placeholderIcon = Icons.Filled.Sailing
                    )
                    Box(
                        modifier = Modifier
                            .matchParentSize()
                            .background(
                                Brush.verticalGradient(
                                    0f to Color.Transparent,
                                    0.6f to Color.Transparent,
                                    1f to Ink.copy(alpha = 0.4f)
                                )
                            )
                    )
                }
            }
            item {
                Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        if (!service.category.isNullOrBlank()) {
                            CategoryChip(service.category)
                        }
                        Text(service.title, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Ink)
                        if (!service.hostName.isNullOrBlank()) {
                            Text(stringResource(R.string.services_hosted_by, service.hostName), color = Muted, fontSize = 14.sp)
                        }
                        if (!service.location.isNullOrBlank()) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Filled.LocationOn, null, tint = Muted, modifier = Modifier.height(18.dp))
                                Text(service.location, color = Muted, fontSize = 14.sp)
                            }
                        }
                    }
                    if (!service.description.isNullOrEmpty()) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            SectionHeader(stringResource(R.string.services_about))
                            Text(service.description, color = Muted, fontSize = 15.sp, lineHeight = 22.sp)
                        }
                    }

                    SubscribePanel(
                        service = service,
                        state = subscribeState,
                        onSubscribe = onSubscribe,
                        onSignIn = onSignIn,
                        onResetSubscribe = onResetSubscribe
                    )
                }
            }
        }
    }
}

/**
 * Subscribe section: an optional note, a live price line, and a Burgundy "Subscribe" button.
 * Renders inline feedback driven by [state] (needsSignIn / error), and a branded
 * confirmation dialog on success — mirroring the listing's ReservePanel.
 */
@Composable
private fun SubscribePanel(
    service: Service,
    state: SubscribeUiState,
    onSubscribe: (note: String) -> Unit,
    onSignIn: () -> Unit,
    onResetSubscribe: () -> Unit
) {
    var note by remember { mutableStateOf("") }

    // A successful subscription surfaces an on-brand confirmation modal over a scrim.
    // Requests start as 'pending' — awaiting the host's confirmation.
    if (state.confirmed != null) {
        SubscriptionConfirmationDialog(
            request = state.confirmed,
            serviceTitle = service.title,
            onDismiss = onResetSubscribe
        )
    }

    Surface(
        color = Color.White,
        shape = RoundedCornerShape(22.dp),
        shadowElevation = 3.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(verticalAlignment = Alignment.Bottom) {
                Text(service.priceText, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink)
                Text(stringResource(R.string.services_per_experience), fontSize = 14.sp, color = Muted)
            }

            OutlinedTextField(
                value = note,
                onValueChange = { note = it },
                label = { Text(stringResource(R.string.services_note_optional)) },
                minLines = 2,
                keyboardOptions = KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Text),
                shape = RoundedCornerShape(18.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Burgundy,
                    unfocusedBorderColor = Tan,
                    focusedLabelColor = Burgundy,
                    cursorColor = Burgundy,
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White
                ),
                modifier = Modifier.fillMaxWidth()
            )

            if (state.needsSignIn) {
                Text(stringResource(R.string.services_sign_in_to_subscribe), color = ServiceErrorRed, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            } else if (state.error != null) {
                Text(state.error, color = ServiceErrorRed, fontSize = 14.sp)
            }

            if (state.needsSignIn) {
                GradientButton(
                    onClick = onSignIn,
                    modifier = Modifier.fillMaxWidth(),
                    height = 52.dp
                ) {
                    Text(stringResource(R.string.services_sign_in_to_subscribe), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                }
            } else {
                GradientButton(
                    onClick = { onSubscribe(note) },
                    enabled = !state.isSubmitting,
                    pulse = !state.isSubmitting,
                    modifier = Modifier.fillMaxWidth(),
                    height = 52.dp
                ) {
                    if (state.isSubmitting) {
                        CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.height(22.dp))
                    } else {
                        Text(stringResource(R.string.services_subscribe), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                    }
                }
            }
        }
    }
}

/**
 * On-brand "Request sent" confirmation modal shown after a successful (pending) subscription.
 * Identical in style to the listing's ReservationConfirmationDialog: burgundy badge, title,
 * tan summary, Done.
 */
@Composable
private fun SubscriptionConfirmationDialog(
    request: ServiceRequest,
    serviceTitle: String,
    onDismiss: () -> Unit
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            color = Color.White,
            shape = RoundedCornerShape(28.dp),
            shadowElevation = 16.dp,
            modifier = Modifier
                .padding(24.dp)
                .fillMaxWidth()
                .widthIn(max = 360.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // qkDraw + qkPop — the green tick draws itself on inside a popping circle.
                PopIn { DrawCheckmark(size = 72.dp) }

                Text(
                    stringResource(R.string.detail_request_sent),
                    color = Ink,
                    fontWeight = FontWeight.Bold,
                    fontSize = 22.sp,
                    textAlign = TextAlign.Center
                )

                Text(
                    stringResource(R.string.services_waiting_host_booking, serviceTitle),
                    color = Muted,
                    fontSize = 15.sp,
                    textAlign = TextAlign.Center,
                    lineHeight = 20.sp
                )

                Surface(
                    color = Tan,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        if (!request.requestCode.isNullOrBlank()) {
                            Text(request.requestCode, color = Muted, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                            HorizontalDivider(color = Ink.copy(alpha = 0.08f))
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(stringResource(R.string.services_price), color = Muted)
                            Text(request.priceText, color = Burgundy, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                Button(
                    onClick = onDismiss,
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Burgundy,
                        contentColor = Color.White
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                ) {
                    Text(stringResource(R.string.action_done), fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}
