package com.quickin.app.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddPhotoAlternate
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.quickin.app.AvatarImage
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val ReviewErrorRed = Color(0xFFB3261E)

/** Max photos a guest can attach to a stay review (matches the backend cap). */
private const val MAX_REVIEW_PHOTOS = 6

/**
 * "Leave a review" modal for a completed stay. A 1–5 gold star picker, an optional comment, and an
 * optional photo picker (up to [MAX_REVIEW_PHOTOS]); Submit POSTs the review with the encoded
 * photos. Mirrors QuickIn's boutique dialog styling. [submitting]/[error] reflect the in-flight
 * POST.
 *
 * Rendered in a [Dialog] over a scrim; [usePlatformDefaultWidth] is disabled so the width
 * matches the app's card styling.
 */
@Composable
fun LeaveReviewDialog(
    stayTitle: String,
    submitting: Boolean,
    error: String?,
    onSubmit: (rating: Int, comment: String, photos: List<String>) -> Unit,
    onDismiss: () -> Unit
) {
    var rating by remember { mutableIntStateOf(5) }
    var comment by remember { mutableStateOf("") }
    // Picked photos encoded as data:image/jpeg data URLs, in pick order.
    val photos = remember { mutableStateListOf<String>() }
    var encodingPhotos by remember { mutableStateOf(false) }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // Multi-image picker: convert each picked image to a downscaled JPEG data URL off the main
    // thread, then append (respecting the MAX_REVIEW_PHOTOS cap).
    val photoPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(MAX_REVIEW_PHOTOS)
    ) { uris ->
        if (uris.isNotEmpty()) {
            encodingPhotos = true
            scope.launch {
                val remaining = (MAX_REVIEW_PHOTOS - photos.size).coerceAtLeast(0)
                val encoded = withContext(Dispatchers.IO) {
                    uris.take(remaining).mapNotNull { uri ->
                        AvatarImage.loadDownscaledJpegDataUrl(context, uri, AvatarImage.MAX_REVIEW_DIM)
                    }
                }
                photos.addAll(encoded)
                encodingPhotos = false
            }
        }
    }

    Dialog(
        onDismissRequest = { if (!submitting) onDismiss() },
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            color = Color.White,
            shape = RoundedCornerShape(28.dp),
            shadowElevation = 16.dp,
            modifier = Modifier
                .padding(24.dp)
                .fillMaxWidth()
                .widthIn(max = 380.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    stringResource(R.string.review_dialog_title),
                    color = Ink,
                    fontWeight = FontWeight.Bold,
                    fontSize = 22.sp,
                    textAlign = TextAlign.Center
                )
                Text(
                    stringResource(R.string.review_dialog_subtitle, stayTitle),
                    color = Muted,
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center,
                    lineHeight = 20.sp
                )

                // 1–5 gold star picker.
                StarRatingRow(
                    rating = rating,
                    starSize = 30.dp,
                    onRate = { rating = it }
                )

                OutlinedTextField(
                    value = comment,
                    onValueChange = { comment = it },
                    label = { Text(stringResource(R.string.review_comment_label)) },
                    minLines = 3,
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

                // Photo picker: an "Add photos" button + a thumbnail row with remove (×) chips.
                ReviewPhotoPicker(
                    photos = photos,
                    encoding = encodingPhotos,
                    enabled = !submitting && photos.size < MAX_REVIEW_PHOTOS,
                    onAdd = {
                        photoPicker.launch(
                            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                        )
                    },
                    onRemove = { index -> if (index in photos.indices) photos.removeAt(index) }
                )

                if (error != null) {
                    Text(error, color = ReviewErrorRed, fontSize = 14.sp, textAlign = TextAlign.Center)
                }

                GradientButton(
                    onClick = { onSubmit(rating, comment, photos.toList()) },
                    enabled = !submitting && !encodingPhotos,
                    modifier = Modifier.fillMaxWidth(),
                    height = 52.dp
                ) {
                    if (submitting) {
                        CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                    } else {
                        Text(stringResource(R.string.review_submit), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                    }
                }

                TextButton(onClick = { if (!submitting) onDismiss() }) {
                    Text(stringResource(R.string.action_cancel), color = Muted, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

/**
 * The "Review submitted" confirmation — a green drawn-on checkmark + a thank-you, shown after a
 * successful POST. Mirrors the "Request sent" modal.
 */
@Composable
fun ReviewSubmittedDialog(onDismiss: () -> Unit) {
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
                PopIn { DrawCheckmark(size = 72.dp) }
                Text(
                    stringResource(R.string.review_thanks_title),
                    color = Ink,
                    fontWeight = FontWeight.Bold,
                    fontSize = 22.sp,
                    textAlign = TextAlign.Center
                )
                Text(
                    stringResource(R.string.review_thanks_subtitle),
                    color = Muted,
                    fontSize = 15.sp,
                    textAlign = TextAlign.Center,
                    lineHeight = 20.sp
                )
                androidx.compose.material3.Button(
                    onClick = onDismiss,
                    shape = RoundedCornerShape(16.dp),
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
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

/**
 * The review photo attach control: an "Add photos" outlined button (disabled at the cap or while
 * a pick is encoding) plus a horizontal row of staged thumbnails, each with a remove (×) chip.
 */
@Composable
private fun ReviewPhotoPicker(
    photos: List<String>,
    encoding: Boolean,
    enabled: Boolean,
    onAdd: () -> Unit,
    onRemove: (Int) -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        OutlinedButton(
            onClick = onAdd,
            enabled = enabled,
            shape = RoundedCornerShape(14.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, Tan),
            colors = androidx.compose.material3.ButtonDefaults.outlinedButtonColors(
                containerColor = Color.White,
                contentColor = Burgundy
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
        ) {
            if (encoding) {
                CircularProgressIndicator(color = Burgundy, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
            } else {
                Icon(Icons.Filled.AddPhotoAlternate, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text(stringResource(R.string.reviews_add_photos), fontWeight = FontWeight.SemiBold)
            }
        }

        if (photos.isNotEmpty()) {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                itemsIndexed(photos) { index, url ->
                    Box {
                        ReviewPhotoThumbnail(
                            url = url,
                            size = 72.dp,
                            modifier = Modifier.padding(top = 6.dp, end = 6.dp)
                        )
                        // Remove (×) chip pinned to the top-end corner.
                        Surface(
                            color = Ink.copy(alpha = 0.72f),
                            shape = CircleShape,
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .size(24.dp)
                                .clickable { onRemove(index) }
                        ) {
                            Icon(
                                Icons.Filled.Close,
                                contentDescription = stringResource(R.string.reviews_remove_photo),
                                tint = Color.White,
                                modifier = Modifier.padding(4.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * A single review photo thumbnail clipped to a rounded square. Decodes `data:` URLs to a [Bitmap]
 * off the composition (Coil 2.7.0 has no data-URI fetcher); loads `http(s)` URLs via Coil's
 * AsyncImage. Reuses the same decode helper as avatars ([AvatarImage.decodeDataUrlToBitmap]).
 */
@Composable
fun ReviewPhotoThumbnail(
    url: String,
    modifier: Modifier = Modifier,
    size: androidx.compose.ui.unit.Dp = 96.dp,
    contentDescription: String? = null
) {
    val shape = RoundedCornerShape(12.dp)
    val base = modifier
        .size(size)
        .clip(shape)
        .background(Tan, shape)
    if (AvatarImage.isDataUrl(url)) {
        var bitmap by remember(url) { mutableStateOf<android.graphics.Bitmap?>(null) }
        androidx.compose.runtime.LaunchedEffect(url) {
            bitmap = withContext(Dispatchers.IO) { AvatarImage.decodeDataUrlToBitmap(url) }
        }
        val bmp = bitmap
        if (bmp != null) {
            Image(
                bitmap = bmp.asImageBitmap(),
                contentDescription = contentDescription,
                contentScale = ContentScale.Crop,
                modifier = base
            )
        } else {
            Box(modifier = base)
        }
    } else {
        coil.compose.AsyncImage(
            model = url,
            contentDescription = contentDescription,
            contentScale = ContentScale.Crop,
            modifier = base
        )
    }
}
