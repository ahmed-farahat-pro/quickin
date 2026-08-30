package com.quickin.app.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.HourglassEmpty
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.QrCode2
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.AvatarImage
import com.quickin.app.Qr
import com.quickin.app.R
import com.quickin.app.StayGuideItem
import com.quickin.app.StayGuideKind
import com.quickin.app.openLink
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val GuideErrorRed = Color(0xFFB3261E)

/** Longest edge a picked stay-guide photo is downscaled to before base64-encoding. */
private const val GUIDE_PHOTO_MAX_DIM = 1200

/**
 * The host-authored **stay guide** for one reservation: info blocks, a photo gallery, QR codes to
 * places, and attachments.
 *
 *  • **Guest** — read-only, grouped by kind, rendered next to the QR card.
 *  • **Host** — the same content plus an editor (add / edit / reorder / delete).
 *
 * The GUEST is gated on [hasStayPass], the exact same gate as the QR itself — the guide IS what the
 * pass leads to (gate codes, Wi-Fi, directions), so it must not open before the payment does. The
 * server agrees: `listStayGuide` returns an empty guide to a guest without a live pass.
 *
 * The HOST is gated on [canEdit] instead — approval, not payment — so they can write their check-in
 * notes while the guest pays; a host on an unapproved booking gets one line explaining that
 * approving the request unlocks the editor. A guest whose host hasn't written anything gets nothing
 * at all — no empty state for content that isn't theirs.
 */
@Composable
fun StayGuideSection(
    items: List<StayGuideItem>,
    isHost: Boolean,
    hasStayPass: Boolean,
    canEdit: Boolean,
    loading: Boolean,
    saving: Boolean,
    error: String?,
    onAddItem: (kind: StayGuideKind, title: String?, body: String?, url: String?) -> Unit,
    onUpdateItem: (itemId: String, title: String?, body: String?, url: String?) -> Unit,
    onMoveItem: (index: Int, up: Boolean) -> Unit,
    onDeleteItem: (itemId: String) -> Unit
) {
    // A host sees the section as soon as they can edit it (approved), even while the stay is
    // unpaid; a guest only once their pass is live.
    val visible = if (isHost) canEdit || hasStayPass else hasStayPass
    if (!visible) {
        if (isHost) StayGuideLockedCard()
        return
    }
    // Only the editor justifies an otherwise-empty card. A host who can no longer edit (checked-out
    // booking) reads it exactly like a guest, so an empty guide renders nothing for them too.
    if (!(isHost && canEdit) && items.isEmpty() && !loading) return

    Surface(
        shape = RoundedCornerShape(20.dp),
        color = Cream,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.MenuBook, null, tint = Burgundy, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    stringResource(
                        if (isHost) R.string.stay_guide_host_title else R.string.stay_guide_title
                    ),
                    color = Ink,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp
                )
            }

            if (loading && items.isEmpty()) {
                CircularProgressIndicator(
                    color = Burgundy,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(22.dp)
                )
            }
            if (error != null) {
                Text(error, color = GuideErrorRed, fontSize = 13.sp)
            }

            if (isHost && canEdit) {
                Text(
                    stringResource(R.string.stay_guide_host_hint),
                    color = Muted,
                    fontSize = 13.sp,
                    lineHeight = 18.sp
                )
                if (items.isEmpty() && !loading) {
                    Text(stringResource(R.string.stay_guide_host_empty), color = Muted, fontSize = 13.sp)
                }
                items.forEachIndexed { index, item ->
                    HostGuideRow(
                        item = item,
                        index = index,
                        count = items.size,
                        saving = saving,
                        onMove = { up -> onMoveItem(index, up) },
                        onSave = { title, body, url -> onUpdateItem(item.id, title, body, url) },
                        onDelete = { onDeleteItem(item.id) }
                    )
                }
                AddStayGuideItemForm(saving = saving, error = error, onAdd = onAddItem)
            } else {
                GuestStayGuide(items)
            }
        }
    }
}

/** Shown to a host on a booking they haven't approved: the guide unlocks at confirmation. */
@Composable
private fun StayGuideLockedCard() {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = Cream,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Filled.HourglassEmpty, null, tint = Muted, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                stringResource(R.string.stay_guide_locked),
                color = Ink,
                fontSize = 13.sp,
                lineHeight = 18.sp
            )
        }
    }
}

// ---- Guest (read-only) -------------------------------------------------------

/**
 * The guest's view, grouped by kind in a fixed order (info → photos → places → files) and, within
 * each group, in the host's chosen order. All text is plain — it is host-supplied content shown to
 * a guest, so it is only ever rendered as [Text], never as markup.
 */
@Composable
private fun GuestStayGuide(items: List<StayGuideItem>) {
    val context = LocalContext.current
    val info = items.filter { it.kind == StayGuideKind.Info }
    val photos = items.filter { it.kind == StayGuideKind.Photo }
    val places = items.filter { it.kind == StayGuideKind.PlaceQr }
    val files = items.filter { it.kind == StayGuideKind.Attachment }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        info.forEach { item -> GuideInfoBlock(item) }

        if (photos.isNotEmpty()) {
            GuideSubheader(Icons.Filled.PhotoLibrary, stringResource(R.string.stay_guide_photos))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                photos.forEach { photo -> GuidePhoto(photo) }
            }
        }

        if (places.isNotEmpty()) {
            GuideSubheader(Icons.Filled.QrCode2, stringResource(R.string.stay_guide_places))
            places.forEach { place ->
                GuidePlaceCard(place, onOpen = { openLink(context, place.url) })
            }
        }

        if (files.isNotEmpty()) {
            GuideSubheader(Icons.Filled.AttachFile, stringResource(R.string.stay_guide_attachments))
            files.forEach { file -> GuideAttachmentRow(file) }
        }
    }
}

@Composable
private fun GuideSubheader(icon: ImageVector, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = Muted, modifier = Modifier.size(15.dp))
        Spacer(Modifier.width(6.dp))
        Text(label, color = Muted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

/** One "info" block: an optional heading plus the host's text. */
@Composable
private fun GuideInfoBlock(item: StayGuideItem) {
    Surface(shape = RoundedCornerShape(16.dp), color = Color.White, modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Info, null, tint = Burgundy, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text(
                    item.title ?: stringResource(item.kind.labelRes),
                    color = Ink,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp
                )
            }
            val body = item.body
            if (!body.isNullOrBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(body, color = Ink, fontSize = 14.sp, lineHeight = 20.sp)
            }
        }
    }
}

/** One gallery thumbnail + its caption. Handles device photos (`data:` URLs) and http(s) images. */
@Composable
private fun GuidePhoto(item: StayGuideItem) {
    Column(modifier = Modifier.width(150.dp)) {
        DataUrlAwareImage(
            url = item.url,
            contentDescription = item.title,
            modifier = Modifier
                .size(150.dp)
                .clip(RoundedCornerShape(14.dp))
        )
        val caption = item.title ?: item.body
        if (!caption.isNullOrBlank()) {
            Spacer(Modifier.height(6.dp))
            Text(
                caption,
                color = Muted,
                fontSize = 12.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

/**
 * A place the host wants the guest to visit: a real scannable QR for the link, plus a tappable
 * "Open" button for guests reading on the same phone. The link is always http(s) — the backend
 * rejects `data:` / `javascript:` for this kind.
 */
@Composable
private fun GuidePlaceCard(item: StayGuideItem, onOpen: () -> Unit) {
    val url = item.url.orEmpty()
    val qr = remember(url) { Qr.bitmap(url, sizePx = 400)?.asImageBitmap() }
    Surface(shape = RoundedCornerShape(16.dp), color = Color.White, modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                item.title ?: stringResource(item.kind.labelRes),
                color = Ink,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp
            )
            val body = item.body
            if (!body.isNullOrBlank()) {
                Spacer(Modifier.height(4.dp))
                Text(body, color = Muted, fontSize = 13.sp)
            }
            Spacer(Modifier.height(10.dp))
            Surface(shape = RoundedCornerShape(14.dp), color = Color.White, modifier = Modifier.size(150.dp)) {
                Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(6.dp)) {
                    if (qr != null) {
                        Image(
                            bitmap = qr,
                            contentDescription = stringResource(
                                R.string.cd_place_qr,
                                item.title ?: stringResource(item.kind.labelRes)
                            ),
                            contentScale = ContentScale.Fit,
                            modifier = Modifier.fillMaxSize()
                        )
                    } else {
                        Text(url, color = Muted, fontSize = 11.sp, maxLines = 4, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            OutlinedButton(
                onClick = onOpen,
                enabled = url.isNotBlank(),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, Burgundy),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Burgundy)
            ) {
                Text(stringResource(R.string.stay_guide_open), fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            }
        }
    }
}

/**
 * One attachment. An http(s) file gets an "Open" action; a device-uploaded `data:` file has no
 * external handler on Android, so it is previewed inline instead of offering a link that would
 * fail to resolve.
 */
@Composable
private fun GuideAttachmentRow(item: StayGuideItem) {
    val context = LocalContext.current
    val url = item.url
    val inlineOnly = AvatarImage.isDataUrl(url)
    Surface(shape = RoundedCornerShape(16.dp), color = Color.White, modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.AttachFile, null, tint = Burgundy, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        item.title ?: stringResource(item.kind.labelRes),
                        color = Ink,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    val body = item.body
                    if (!body.isNullOrBlank()) {
                        Text(body, color = Muted, fontSize = 13.sp)
                    }
                }
                if (!inlineOnly && !url.isNullOrBlank()) {
                    TextButton(onClick = { openLink(context, url) }) {
                        Text(
                            stringResource(R.string.stay_guide_open),
                            color = Burgundy,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp
                        )
                    }
                }
            }
            if (inlineOnly) {
                Spacer(Modifier.height(10.dp))
                DataUrlAwareImage(
                    url = url,
                    contentDescription = item.title,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp)
                        .clip(RoundedCornerShape(12.dp))
                )
            }
        }
    }
}

// ---- Host editor -------------------------------------------------------------

/**
 * One editable row in the host's guide: a compact summary with reorder / edit / delete actions, and
 * an inline editor when expanded.
 *
 * A `data:` URL (a device-uploaded photo or file) is never put into a text field — it can be
 * megabytes of base64 — so for those the editor exposes only the title + caption. The link field
 * appears for place QRs and for link-backed attachments.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HostGuideRow(
    item: StayGuideItem,
    index: Int,
    count: Int,
    saving: Boolean,
    onMove: (up: Boolean) -> Unit,
    onSave: (title: String?, body: String?, url: String?) -> Unit,
    onDelete: () -> Unit
) {
    var editing by remember(item.id) { mutableStateOf(false) }
    var title by remember(item.id, item.title) { mutableStateOf(item.title.orEmpty()) }
    var body by remember(item.id, item.body) { mutableStateOf(item.body.orEmpty()) }
    var link by remember(item.id, item.url) {
        mutableStateOf(if (AvatarImage.isDataUrl(item.url)) "" else item.url.orEmpty())
    }
    val linkEditable = !AvatarImage.isDataUrl(item.url) &&
        (item.kind == StayGuideKind.PlaceQr || item.kind == StayGuideKind.Attachment)
    val linkOk = !linkEditable || item.kind.isValidUrl(link.trim())

    Surface(shape = RoundedCornerShape(16.dp), color = Color.White, modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(kindIcon(item.kind), null, tint = Burgundy, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        item.title ?: stringResource(item.kind.labelRes),
                        color = Ink,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    val subtitle = item.body?.takeIf { it.isNotBlank() }
                        ?: item.url?.takeIf { it.isNotBlank() && !AvatarImage.isDataUrl(it) }
                        ?: stringResource(item.kind.labelRes)
                    Text(
                        subtitle,
                        color = Muted,
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                IconButton(
                    onClick = { onMove(true) },
                    enabled = index > 0 && !saving,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        Icons.Filled.ArrowUpward,
                        contentDescription = stringResource(R.string.stay_guide_move_up),
                        tint = Muted,
                        modifier = Modifier.size(17.dp)
                    )
                }
                IconButton(
                    onClick = { onMove(false) },
                    enabled = index < count - 1 && !saving,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        Icons.Filled.ArrowDownward,
                        contentDescription = stringResource(R.string.stay_guide_move_down),
                        tint = Muted,
                        modifier = Modifier.size(17.dp)
                    )
                }
                IconButton(onClick = { editing = !editing }, modifier = Modifier.size(32.dp)) {
                    Icon(
                        Icons.Filled.Edit,
                        contentDescription = stringResource(R.string.stay_guide_edit),
                        tint = Burgundy,
                        modifier = Modifier.size(17.dp)
                    )
                }
                IconButton(onClick = onDelete, enabled = !saving, modifier = Modifier.size(32.dp)) {
                    Icon(
                        Icons.Filled.DeleteOutline,
                        contentDescription = stringResource(R.string.stay_guide_delete),
                        tint = GuideErrorRed,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }

            if (editing) {
                Spacer(Modifier.height(10.dp))
                GuideField(
                    value = title,
                    onValueChange = { title = it.take(StayGuideKind.MAX_TITLE_LENGTH) },
                    label = stringResource(R.string.stay_guide_title_label),
                    enabled = !saving
                )
                Spacer(Modifier.height(8.dp))
                GuideField(
                    value = body,
                    onValueChange = { body = it.take(StayGuideKind.MAX_BODY_LENGTH) },
                    label = stringResource(R.string.stay_guide_body_label),
                    enabled = !saving,
                    minLines = 3
                )
                if (linkEditable) {
                    Spacer(Modifier.height(8.dp))
                    GuideField(
                        value = link,
                        onValueChange = { link = it },
                        label = stringResource(R.string.stay_guide_link_label),
                        enabled = !saving
                    )
                    if (link.isNotBlank() && !linkOk) {
                        Spacer(Modifier.height(4.dp))
                        Text(stringResource(R.string.stay_guide_invalid_link), color = GuideErrorRed, fontSize = 12.sp)
                    }
                }
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GradientButton(
                        onClick = {
                            onSave(
                                title.trim(),
                                body.trim(),
                                if (linkEditable) link.trim() else null
                            )
                            editing = false
                        },
                        enabled = !saving && linkOk,
                        radius = 14.dp,
                        height = 42.dp,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            stringResource(R.string.stay_guide_save),
                            color = Color.White,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp
                        )
                    }
                    TextButton(onClick = { editing = false }, enabled = !saving) {
                        Text(stringResource(R.string.action_cancel), color = Muted, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}

/**
 * The "add an item" form: a kind picker, then only the fields that kind needs. Photos (and photo
 * attachments) go through the system photo picker and are downscaled to a JPEG `data:` URL, the
 * same recipe used for listing photos and payment screenshots.
 */
@Composable
private fun AddStayGuideItemForm(
    saving: Boolean,
    error: String?,
    onAdd: (kind: StayGuideKind, title: String?, body: String?, url: String?) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var kind by remember { mutableStateOf(StayGuideKind.Info) }
    var title by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }
    var link by remember { mutableStateOf("") }
    var pickedPhoto by remember { mutableStateOf<String?>(null) }
    var encoding by remember { mutableStateOf(false) }
    var submitted by remember { mutableStateOf(false) }

    // Clear the form once a submit finishes cleanly; on failure the input is kept so the host can
    // fix the error and retry rather than retyping everything.
    LaunchedEffect(saving) {
        if (!saving && submitted) {
            submitted = false
            if (error == null) {
                title = ""
                body = ""
                link = ""
                pickedPhoto = null
            }
        }
    }

    val photoPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) {
            encoding = true
            scope.launch {
                val dataUrl = withContext(Dispatchers.IO) {
                    AvatarImage.loadDownscaledJpegDataUrl(context, uri, maxDim = GUIDE_PHOTO_MAX_DIM)
                }
                pickedPhoto = dataUrl
                encoding = false
            }
        }
    }

    // What actually gets sent as `url` for the selected kind.
    val effectiveUrl: String? = when (kind) {
        StayGuideKind.Info -> null
        StayGuideKind.Photo -> pickedPhoto
        StayGuideKind.PlaceQr -> link.trim().ifBlank { null }
        StayGuideKind.Attachment -> pickedPhoto ?: link.trim().ifBlank { null }
    }
    val hasContent = when (kind) {
        StayGuideKind.Info -> title.isNotBlank() || body.isNotBlank()
        else -> !effectiveUrl.isNullOrBlank()
    }
    // Mirrors the backend's rules so an obviously bad item never costs a round trip.
    val urlOk = kind.isValidUrl(effectiveUrl)
    val canAdd = !saving && !encoding && hasContent && urlOk

    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            stringResource(R.string.stay_guide_kind_label),
            color = Ink,
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp
        )
        Spacer(Modifier.height(8.dp))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            StayGuideKind.entries.forEach { option ->
                GuideKindChip(
                    label = stringResource(option.labelRes),
                    selected = kind == option,
                    onClick = {
                        if (kind != option) {
                            // Don't carry a photo or a link across kinds — they mean different things.
                            kind = option
                            link = ""
                            pickedPhoto = null
                        }
                    }
                )
            }
        }

        Spacer(Modifier.height(10.dp))
        GuideField(
            value = title,
            onValueChange = { title = it.take(StayGuideKind.MAX_TITLE_LENGTH) },
            label = stringResource(R.string.stay_guide_title_label),
            enabled = !saving
        )
        Spacer(Modifier.height(8.dp))
        GuideField(
            value = body,
            onValueChange = { body = it.take(StayGuideKind.MAX_BODY_LENGTH) },
            label = stringResource(R.string.stay_guide_body_label),
            enabled = !saving,
            minLines = if (kind == StayGuideKind.Info) 3 else 1
        )

        if (kind == StayGuideKind.PlaceQr || kind == StayGuideKind.Attachment) {
            Spacer(Modifier.height(8.dp))
            GuideField(
                value = link,
                onValueChange = { link = it },
                label = stringResource(R.string.stay_guide_link_label),
                enabled = !saving && pickedPhoto == null
            )
            if (link.isNotBlank() && !kind.isValidUrl(link.trim())) {
                Spacer(Modifier.height(4.dp))
                Text(stringResource(R.string.stay_guide_invalid_link), color = GuideErrorRed, fontSize = 12.sp)
            }
        }

        if (kind == StayGuideKind.Photo || kind == StayGuideKind.Attachment) {
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedButton(
                    onClick = {
                        photoPicker.launch(
                            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                        )
                    },
                    enabled = !saving && !encoding,
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, Burgundy),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Burgundy)
                ) {
                    Text(
                        stringResource(R.string.stay_guide_choose_photo),
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp
                    )
                }
                Spacer(Modifier.width(10.dp))
                when {
                    encoding -> CircularProgressIndicator(
                        color = Burgundy,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(18.dp)
                    )
                    pickedPhoto != null -> {
                        Text(
                            stringResource(R.string.stay_guide_photo_ready),
                            color = Muted,
                            fontSize = 13.sp
                        )
                        // Lets the host back out of a picked photo (and re-enables the link field
                        // for an attachment, since a photo takes precedence over a typed link).
                        TextButton(onClick = { pickedPhoto = null }, enabled = !saving) {
                            Text(
                                stringResource(R.string.stay_guide_delete),
                                color = Muted,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp
                            )
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(12.dp))
        GradientButton(
            onClick = {
                submitted = true
                onAdd(
                    kind,
                    title.trim().ifBlank { null },
                    body.trim().ifBlank { null },
                    effectiveUrl
                )
            },
            enabled = canAdd,
            radius = 16.dp,
            height = 46.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            if (saving) {
                CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
            } else {
                Text(
                    stringResource(R.string.stay_guide_add),
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp
                )
            }
        }
    }
}

/** The pill kind picker — mirrors the filter pills used on the explore / host screens. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GuideKindChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(50),
        color = if (selected) Burgundy else Color.White,
        contentColor = if (selected) Color.White else Ink,
        border = BorderStroke(1.dp, if (selected) Burgundy else Tan),
        shadowElevation = if (selected) 2.dp else 0.dp
    ) {
        Text(
            label,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
        )
    }
}

/** The one text-field style used across the guide editor (matches the host-notes editor). */
@Composable
private fun GuideField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    enabled: Boolean,
    minLines: Int = 1
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        enabled = enabled,
        label = { Text(label) },
        minLines = minLines,
        shape = RoundedCornerShape(14.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Burgundy,
            unfocusedBorderColor = Tan,
            focusedLabelColor = Burgundy,
            cursorColor = Burgundy,
            focusedTextColor = Ink,
            unfocusedTextColor = Ink,
            focusedContainerColor = Color.White,
            unfocusedContainerColor = Color.White
        ),
        modifier = Modifier.fillMaxWidth()
    )
}

/** The little glyph that stands for each kind in the host's list. */
private fun kindIcon(kind: StayGuideKind): ImageVector = when (kind) {
    StayGuideKind.Info -> Icons.Filled.Info
    StayGuideKind.Photo -> Icons.Filled.PhotoLibrary
    StayGuideKind.PlaceQr -> Icons.Filled.QrCode2
    StayGuideKind.Attachment -> Icons.Filled.AttachFile
}
