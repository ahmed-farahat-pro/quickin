package com.quickin.app.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.AvatarImage
import com.quickin.app.DisputeService
import com.quickin.app.humanError
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val ErrorRed = Color(0xFFB3261E)

/** Mirrors MIN_DESCRIPTION_CHARS server-side. The server re-checks; this only
 *  spares the guest a round trip. */
private const val MIN_DESCRIPTION = 20
private const val MAX_DISPUTE_PHOTOS = 6

/**
 * Raising an issue about a stay, and following one already raised.
 *
 * Opened from a reservation. Which state it shows is decided by whether the
 * booking already has a dispute — a guest who has raised one wants its status,
 * not a second form.
 *
 * Photos go through the same downscale-to-data-URL pipeline the listing wizard
 * uses: an unmodified phone photo is several MB of base64 and would be refused
 * by the request-body limit before the route ever runs.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DisputeScreen(
    token: String?,
    bookingId: String,
    stayTitle: String?,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var categories by remember { mutableStateOf(DisputeService.DisputeCategory.FALLBACK) }
    var category by remember { mutableStateOf("") }
    var menuOpen by remember { mutableStateOf(false) }
    var description by remember { mutableStateOf("") }
    val photos = remember { mutableStateListOf<String>() }
    var encoding by remember { mutableStateOf(false) }
    var sending by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    var filed by remember { mutableStateOf<DisputeService.Dispute?>(null) }
    var events by remember { mutableStateOf<List<DisputeService.DisputeEvent>>(emptyList()) }

    // Load the category list and any dispute already on this booking. A category
    // fetch failure is not surfaced: the fallback list is already correct, and the
    // guest came here to complain, not to read about an unavailable list.
    LaunchedEffect(token, bookingId) {
        val t = token ?: return@LaunchedEffect
        runCatching { DisputeService.fetch(t) }.getOrNull()?.let { (mine, cats) ->
            categories = cats
            mine.firstOrNull { it.bookingId == bookingId }?.let { existing ->
                filed = existing
                runCatching { DisputeService.detail(t, existing.id) }.getOrNull()?.let { (d, e) ->
                    filed = d
                    events = e
                }
            }
        }
    }

    val photoPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(MAX_DISPUTE_PHOTOS)
    ) { uris ->
        if (uris.isNotEmpty()) {
            encoding = true
            scope.launch {
                val remaining = (MAX_DISPUTE_PHOTOS - photos.size).coerceAtLeast(0)
                val encoded = withContext(Dispatchers.IO) {
                    uris.take(remaining).mapNotNull { uri ->
                        AvatarImage.loadDownscaledJpegDataUrl(context, uri, AvatarImage.MAX_REVIEW_DIM)
                    }
                }
                photos.addAll(encoded)
                encoding = false
            }
        }
    }

    val canSend = category.isNotEmpty() &&
        description.trim().length >= MIN_DESCRIPTION &&
        !sending && !encoding

    fun send() {
        val t = token ?: return
        if (!canSend) return
        sending = true
        error = null
        scope.launch {
            try {
                val dispute = DisputeService.file(t, bookingId, category, description.trim(), photos.toList())
                filed = dispute
                events = runCatching { DisputeService.detail(t, dispute.id).second }.getOrDefault(emptyList())
            } catch (e: Exception) {
                // The server's validation messages are written for the guest, so
                // they surface verbatim rather than as a generic failure.
                error = humanError(e, "Could not send this. Please try again.")
            } finally {
                sending = false
            }
        }
    }

    Scaffold(
        containerColor = CreamPage,
        topBar = {
            TopAppBar(
                title = { Text(if (filed == null) "Report an issue" else "Your issue", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Back", tint = Burgundy)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Cream, titleContentColor = Ink),
            )
        },
    ) { pad ->
        Column(
            Modifier
                .padding(pad)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            val current = filed
            if (current != null) {
                // ---- Already raised ------------------------------------------
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(current.reference, fontWeight = FontWeight.Bold)
                    Text(current.statusLabel, fontWeight = FontWeight.Bold, color = Burgundy)
                }
                Text(current.categoryLabel, color = Muted, fontSize = 14.sp)
                Text(current.description, fontSize = 15.sp)

                if (current.photos.isNotEmpty()) {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(current.photos.size) { i ->
                            ReviewPhotoThumbnail(url = current.photos[i], size = 84.dp)
                        }
                    }
                }

                current.resolution?.takeIf { it.isNotBlank() }?.let { outcome ->
                    Surface(color = Color.White, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(12.dp)) {
                            Text("Outcome", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text(outcome, fontSize = 15.sp, modifier = Modifier.padding(top = 4.dp))
                        }
                    }
                }

                Text("History", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                events.forEach { e ->
                    Surface(color = Color.White, shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(10.dp)) {
                            Text(e.summary, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            e.note?.takeIf { it.isNotBlank() }?.let {
                                Text(it, fontSize = 13.sp, modifier = Modifier.padding(top = 3.dp))
                            }
                            Text(e.createdAt.take(10), color = Muted, fontSize = 12.sp)
                        }
                    }
                }
            } else {
                // ---- The form -------------------------------------------------
                stayTitle?.let { Text(it, fontWeight = FontWeight.Bold, fontSize = 17.sp) }

                Text("What is the issue about?", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                ExposedDropdownMenuBox(expanded = menuOpen, onExpandedChange = { menuOpen = !menuOpen }) {
                    OutlinedTextField(
                        value = categories.firstOrNull { it.key == category }?.label ?: "Choose one…",
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = menuOpen) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                    )
                    ExposedDropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        categories.forEach { c ->
                            DropdownMenuItem(
                                text = { Text(c.label) },
                                onClick = { category = c.key; menuOpen = false },
                            )
                        }
                    }
                }

                Text("What happened?", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    placeholder = { Text("Dates, what you expected, and what you found.") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 130.dp),
                )
                val len = description.trim().length
                if (len in 1 until MIN_DESCRIPTION) {
                    Text(
                        "A little more detail, please — at least $MIN_DESCRIPTION characters.",
                        color = Muted, fontSize = 12.sp,
                    )
                }

                Text("Photos (optional)", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                if (photos.isNotEmpty()) {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(photos.size) { i ->
                            Box {
                                ReviewPhotoThumbnail(url = photos[i], size = 78.dp)
                                IconButton(
                                    onClick = { photos.removeAt(i) },
                                    modifier = Modifier.align(Alignment.TopEnd),
                                ) {
                                    Icon(Icons.Filled.Close, contentDescription = "Remove photo ${i + 1}", tint = Ink)
                                }
                            }
                        }
                    }
                }
                if (photos.size < MAX_DISPUTE_PHOTOS) {
                    TextButton(
                        onClick = {
                            photoPicker.launch(
                                androidx.activity.result.PickVisualMediaRequest(
                                    ActivityResultContracts.PickVisualMedia.ImageOnly
                                )
                            )
                        },
                        enabled = !encoding,
                    ) {
                        Text(if (encoding) "Processing…" else "Add photos", color = Burgundy, fontWeight = FontWeight.SemiBold)
                    }
                }

                error?.let { Text(it, color = ErrorRed, fontSize = 13.sp) }

                Button(
                    onClick = { send() },
                    enabled = canSend,
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (sending) CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.padding(2.dp))
                    else Text("Send to QuickIn", fontWeight = FontWeight.Bold)
                }

                Text(
                    "This goes to the QuickIn team, not to your host.",
                    color = Muted, fontSize = 12.sp,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}
