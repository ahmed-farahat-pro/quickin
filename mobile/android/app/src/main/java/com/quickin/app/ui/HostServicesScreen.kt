package com.quickin.app.ui

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Sailing
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.quickin.app.CreateServiceUiState
import com.quickin.app.HostServicesUiState
import com.quickin.app.Service
import com.quickin.app.ServiceRequest
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

private val HostErrorRed = Color(0xFFB3261E)
private val HostSuccessGreen = Color(0xFF2E7D32)

/**
 * Host-only "Services" area (reached from the Profile tab when role == "host"). Three tabs,
 * mirroring [HostScreen]:
 *  • Requests — subscription requests across the host's services, Accept / Reject on pending
 *               (`GET /api/local/host/service-requests`, `PATCH /api/local/service-requests/:id`).
 *  • My services — the host's published services (`GET /api/local/host/services`).
 *  • Add service — a form that POSTs `/api/local/services`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HostServicesScreen(
    state: HostServicesUiState,
    createState: CreateServiceUiState,
    onBack: (() -> Unit)?,
    onLoad: () -> Unit,
    onConfirm: (String) -> Unit,
    onReject: (String) -> Unit,
    onCreateService: (
        title: String, category: String, description: String,
        location: String, price: String, imageUrl: String
    ) -> Unit,
    onResetCreate: () -> Unit,
    contentPadding: PaddingValues = PaddingValues()
) {
    var tab by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        onLoad()
    }

    Scaffold(
        containerColor = CreamPage,
        modifier = Modifier.padding(contentPadding),
        topBar = {
            TopAppBar(
                title = { Text("Host services", color = Ink, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Ink)
                        }
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
        ) {
            TabRow(
                selectedTabIndex = tab,
                containerColor = CreamPage,
                contentColor = Burgundy,
                indicator = { positions ->
                    if (tab < positions.size) {
                        TabRowDefaults.SecondaryIndicator(
                            Modifier.tabIndicatorOffset(positions[tab]),
                            color = Burgundy
                        )
                    }
                }
            ) {
                Tab(
                    selected = tab == 0,
                    onClick = { tab = 0 },
                    text = { Text("Requests", fontWeight = FontWeight.SemiBold) },
                    selectedContentColor = Burgundy,
                    unselectedContentColor = Muted
                )
                Tab(
                    selected = tab == 1,
                    onClick = { tab = 1 },
                    text = { Text("My services", fontWeight = FontWeight.SemiBold) },
                    selectedContentColor = Burgundy,
                    unselectedContentColor = Muted
                )
                Tab(
                    selected = tab == 2,
                    onClick = { tab = 2 },
                    text = { Text("Add service", fontWeight = FontWeight.SemiBold) },
                    selectedContentColor = Burgundy,
                    unselectedContentColor = Muted
                )
            }

            when (tab) {
                0 -> ServiceRequestsTab(
                    state = state,
                    onLoad = onLoad,
                    onConfirm = onConfirm,
                    onReject = onReject
                )
                1 -> MyServicesTab(state = state, onLoad = onLoad)
                else -> AddServiceTab(
                    state = createState,
                    onCreate = onCreateService,
                    onReset = onResetCreate
                )
            }
        }
    }
}

// ---- Requests tab -----------------------------------------------------------

@Composable
private fun ServiceRequestsTab(
    state: HostServicesUiState,
    onLoad: () -> Unit,
    onConfirm: (String) -> Unit,
    onReject: (String) -> Unit
) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        when {
            state.isLoading && state.requests.isEmpty() -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(color = Burgundy)
                Text("Loading requests…", color = Muted, modifier = Modifier.padding(top = 12.dp))
            }
            state.error != null && state.requests.isEmpty() -> Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(32.dp)
            ) {
                Text("Couldn't load requests", fontWeight = FontWeight.Bold, color = Ink, fontSize = 18.sp)
                Text(state.error, color = Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp, bottom = 16.dp))
                Button(onClick = onLoad, colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White)) {
                    Text("Retry")
                }
            }
            state.requests.isEmpty() -> Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(32.dp)
            ) {
                Icon(Icons.Filled.Inbox, contentDescription = null, tint = Burgundy, modifier = Modifier.size(48.dp))
                Text("No subscription requests", fontWeight = FontWeight.Bold, color = Ink, fontSize = 18.sp, modifier = Modifier.padding(top = 12.dp))
                Text("Requests from guests will show up here.", color = Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp))
            }
            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                state.actionMessage?.let { msg ->
                    item {
                        Text(msg, color = HostSuccessGreen, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    }
                }
                items(state.requests) { request ->
                    HostServiceRequestCard(
                        request = request,
                        isActing = state.actingOn == request.id,
                        onConfirm = { onConfirm(request.id) },
                        onReject = { onReject(request.id) }
                    )
                }
            }
        }
    }
}

@Composable
private fun HostServiceRequestCard(
    request: ServiceRequest,
    isActing: Boolean,
    onConfirm: () -> Unit,
    onReject: () -> Unit
) {
    BoutiqueCard(
        modifier = Modifier.fillMaxWidth(),
        shadow = 6.dp
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(request.serviceTitle, fontWeight = FontWeight.Bold, color = Ink, fontSize = 16.sp, maxLines = 1, modifier = Modifier.weight(1f))
                StatusBadge(request.status)
            }
            if (!request.serviceLocation.isNullOrBlank()) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                    Icon(Icons.Filled.LocationOn, null, tint = Muted, modifier = Modifier.size(15.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(request.serviceLocation, color = Muted, fontSize = 14.sp, maxLines = 1)
                }
            }
            // Requester identity, so the host knows who's asking.
            if (!request.requesterName.isNullOrBlank() || !request.requesterEmail.isNullOrBlank()) {
                Text(
                    listOfNotNull(request.requesterName, request.requesterEmail).joinToString(" · "),
                    color = Ink,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
            if (!request.requestCode.isNullOrBlank()) {
                Text(request.requestCode, color = Muted, fontSize = 12.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 6.dp))
            }
            if (!request.note.isNullOrBlank()) {
                Text("“${request.note}”", color = Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
            ) {
                if (!request.preferredDate.isNullOrBlank()) {
                    Text("Preferred: ${request.preferredDate}", color = Muted, fontSize = 14.sp)
                } else {
                    Spacer(Modifier.width(1.dp))
                }
                Text(request.priceText, color = Burgundy, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }

            // Confirm / Reject only for pending requests.
            if (request.isPending) {
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedButton(
                        onClick = onReject,
                        enabled = !isActing,
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, HostErrorRed),
                        colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White, contentColor = HostErrorRed),
                        modifier = Modifier.weight(1f).height(46.dp)
                    ) { Text("Reject", fontWeight = FontWeight.SemiBold) }
                    Button(
                        onClick = onConfirm,
                        enabled = !isActing,
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White),
                        modifier = Modifier.weight(1f).height(46.dp)
                    ) {
                        if (isActing) {
                            CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.height(20.dp))
                        } else {
                            Text("Accept", fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
    }
}

// ---- My-services tab --------------------------------------------------------

@Composable
private fun MyServicesTab(state: HostServicesUiState, onLoad: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        when {
            state.isLoading && state.services.isEmpty() -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(color = Burgundy)
                Text("Loading your services…", color = Muted, modifier = Modifier.padding(top = 12.dp))
            }
            state.services.isEmpty() -> Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(32.dp)
            ) {
                Icon(Icons.Filled.Sailing, contentDescription = null, tint = Burgundy, modifier = Modifier.size(48.dp))
                Text("No services yet", fontWeight = FontWeight.Bold, color = Ink, fontSize = 18.sp, modifier = Modifier.padding(top = 12.dp))
                Text("Add a service from the \"Add service\" tab.", color = Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp))
            }
            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                items(state.services) { service ->
                    HostServiceCard(service)
                }
            }
        }
    }
}

@Composable
private fun HostServiceCard(service: Service) {
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
                val imageUrl = service.image
                if (imageUrl != null) {
                    AsyncImage(
                        model = imageUrl,
                        contentDescription = service.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(168.dp)
                            .background(Tan)
                    )
                } else {
                    PhotoPlaceholder(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(168.dp),
                        icon = Icons.Filled.Sailing
                    )
                }
            }
            Column(modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 18.dp)) {
                Text(service.title, fontWeight = FontWeight.Bold, color = Ink, fontSize = 17.sp, maxLines = 1)
                if (!service.category.isNullOrBlank()) {
                    Text(
                        service.category.replaceFirstChar { it.uppercase() },
                        color = Burgundy,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(top = 3.dp)
                    )
                }
                if (!service.location.isNullOrBlank()) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                        Icon(Icons.Filled.LocationOn, null, tint = Muted, modifier = Modifier.size(15.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(service.location, color = Muted, fontSize = 14.sp, maxLines = 1)
                    }
                }
                Text(service.priceText, color = Burgundy, fontWeight = FontWeight.Bold, fontSize = 16.sp, modifier = Modifier.padding(top = 10.dp))
            }
        }
    }
}

// ---- Add-service tab --------------------------------------------------------

@Composable
private fun AddServiceTab(
    state: CreateServiceUiState,
    onCreate: (
        title: String, category: String, description: String,
        location: String, price: String, imageUrl: String
    ) -> Unit,
    onReset: () -> Unit
) {
    // A created service replaces the form with a success card.
    if (state.created != null) {
        Box(modifier = Modifier.fillMaxSize().padding(28.dp), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                // Animated drawn-on checkmark (qkDraw + qkPop) for the published moment.
                PopIn { DrawCheckmark(size = 72.dp) }
                Text("Service published", fontWeight = FontWeight.Bold, color = Ink, fontSize = 20.sp, modifier = Modifier.padding(top = 14.dp))
                Text(
                    state.created.title,
                    color = Muted,
                    fontSize = 15.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 6.dp)
                )
                GradientButton(
                    onClick = onReset,
                    height = 52.dp,
                    modifier = Modifier.fillMaxWidth().padding(top = 24.dp)
                ) { Text("Add another service", color = Color.White, fontWeight = FontWeight.SemiBold) }
            }
        }
        return
    }

    var title by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var location by remember { mutableStateOf("") }
    var price by remember { mutableStateOf("") }
    var imageUrl by remember { mutableStateOf("") }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Sailing, null, tint = Burgundy)
                Spacer(Modifier.width(8.dp))
                Text("New service", fontWeight = FontWeight.Bold, color = Ink, fontSize = 18.sp)
            }
        }
        item { ServiceField(title, { title = it }, "Title (e.g. Sunset yacht cruise)") }
        item { ServiceField(category, { category = it }, "Category (e.g. Water sports)") }
        item { ServiceField(description, { description = it }, "Description", singleLine = false) }
        item { ServiceField(location, { location = it }, "Location (e.g. Dubai Marina)") }
        item { ServiceField(price, { price = it.filterNumericService(decimal = true) }, "Price (USD)", keyboardType = KeyboardType.Number) }
        item { ServiceField(imageUrl, { imageUrl = it }, "Image URL", keyboardType = KeyboardType.Uri) }

        if (state.error != null) {
            item { Text(state.error, color = HostErrorRed, fontSize = 13.sp) }
        }

        item {
            GradientButton(
                onClick = { onCreate(title, category, description, location, price, imageUrl) },
                enabled = !state.isSubmitting,
                pulse = !state.isSubmitting,
                radius = 18.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (state.isSubmitting) {
                    CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                } else {
                    Text("Publish service", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                }
            }
        }
    }
}

@Composable
private fun ServiceField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    singleLine: Boolean = true,
    keyboardType: KeyboardType = KeyboardType.Text,
    modifier: Modifier = Modifier
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = singleLine,
        minLines = if (singleLine) 1 else 3,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        shape = RoundedCornerShape(18.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Burgundy,
            unfocusedBorderColor = Tan,
            focusedLabelColor = Burgundy,
            cursorColor = Burgundy,
            focusedContainerColor = Color.White,
            unfocusedContainerColor = Color.White
        ),
        modifier = modifier.fillMaxWidth()
    )
}

/** Keeps digits (and a single dot when [decimal]); used for the price input. */
private fun String.filterNumericService(decimal: Boolean = false): String {
    val filtered = filter { it.isDigit() || (decimal && it == '.') }
    if (!decimal) return filtered.take(6)
    val firstDot = filtered.indexOf('.')
    return if (firstDot < 0) filtered
    else filtered.substring(0, firstDot + 1) + filtered.substring(firstDot + 1).replace(".", "")
}
