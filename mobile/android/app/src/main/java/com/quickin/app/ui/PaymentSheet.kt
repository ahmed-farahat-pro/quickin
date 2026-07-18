package com.quickin.app.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.HourglassTop
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.AvatarImage
import com.quickin.app.BookingService
import com.quickin.app.PaymentUiState
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.GoldDeep
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val ErrorRed = Color(0xFFB3261E)

/**
 * Payment sheet shown after a guest creates a booking (and from an unpaid reservation's "Pay now").
 * Mirrors the website + iOS: a single **Instapay bank-transfer** flow (Paymob card checkout was
 * removed). The guest sends the booking amount to the host's Instapay handle
 * (`GET /api/local/payment-config`), uploads a screenshot of the transfer
 * (`POST /api/local/bookings/:id/payment-proof`), and the host confirms the booking after checking
 * it. A [ModalBottomSheet] hosts the whole flow; on submission it shows an "Awaiting host approval"
 * confirmation whose Done button calls [onPaid].
 *
 * @param total the booking total in EGP — the exact amount the guest transfers via Instapay.
 * @param nights number of nights (for the "for N nights" caption).
 * @param bookingId the booking being paid (target of `payment-proof`).
 * @param token the bearer token, or null when signed out (the body then surfaces a sign-in note).
 * @param state retained for call-site compatibility; unused by the Instapay flow.
 * @param onValidatePromo retained for call-site compatibility; unused by the Instapay flow.
 * @param onClearPromo retained for call-site compatibility; unused by the Instapay flow.
 * @param onPaid called once the transfer screenshot is submitted (awaiting approval) to dismiss + continue.
 * @param onDismiss called when the sheet is dismissed (drag-down / scrim) before submitting.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentSheet(
    total: Int,
    nights: Int,
    bookingId: String,
    token: String?,
    @Suppress("UNUSED_PARAMETER") state: PaymentUiState,
    @Suppress("UNUSED_PARAMETER") onValidatePromo: (code: String, subtotal: Int) -> Unit = { _, _ -> },
    @Suppress("UNUSED_PARAMETER") onClearPromo: () -> Unit = {},
    onPaid: () -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = CreamPage,
        contentColor = Ink
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            InstapayPayBody(
                total = total,
                nights = nights,
                token = token,
                bookingId = bookingId,
                onPaid = onPaid
            )
        }
    }
}

/**
 * The Instapay bank-transfer body. Shows the amount to transfer, fetches the transfer destination
 * (`getPaymentConfig`), displays the Instapay handle with a copy button + the host's instructions,
 * lets the guest pick a transfer screenshot from the gallery (Photo Picker → downscaled base64 data
 * URL), then submits it via `submitPaymentProof`. On success it switches to an "Awaiting host
 * approval" confirmation whose Done button calls [onPaid]. Emitted directly into [PaymentSheet]'s Column.
 */
@Composable
private fun InstapayPayBody(
    total: Int,
    nights: Int,
    token: String?,
    bookingId: String,
    onPaid: () -> Unit
) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val scope = rememberCoroutineScope()

    var config by remember { mutableStateOf<BookingService.PaymentConfig?>(null) }
    // Start "loading" when signed-in so the first frame shows the spinner, not a
    // transient "couldn't load" before LaunchedEffect runs.
    var loadingConfig by remember { mutableStateOf(token != null) }
    var configError by remember { mutableStateOf(false) }

    // Picked screenshot: the content Uri drives the thumbnail; the data URL is uploaded.
    var pickedUri by remember { mutableStateOf<android.net.Uri?>(null) }
    var imageDataUrl by remember { mutableStateOf<String?>(null) }
    var encoding by remember { mutableStateOf(false) }

    var submitting by remember { mutableStateOf(false) }
    var submitError by remember { mutableStateOf<String?>(null) }
    var submitted by remember { mutableStateOf(false) }

    val pickShot = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) {
            pickedUri = uri
            imageDataUrl = null
            submitError = null
            encoding = true
            scope.launch {
                val dataUrl = withContext(Dispatchers.IO) {
                    AvatarImage.loadDownscaledJpegDataUrl(context, uri, AvatarImage.MAX_REVIEW_DIM)
                }
                imageDataUrl = dataUrl
                encoding = false
            }
        }
    }

    // Load the transfer destination once the sheet is shown.
    LaunchedEffect(token) {
        val t = token ?: return@LaunchedEffect
        loadingConfig = true
        configError = false
        try {
            config = BookingService.getPaymentConfig(t)
        } catch (_: Exception) {
            configError = true
        } finally {
            loadingConfig = false
        }
    }

    // Success — awaiting the host's approval of the uploaded transfer.
    if (submitted) {
        InstapayAwaiting(onContinue = onPaid)
        return
    }

    // Header.
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            stringResource(R.string.pay_title),
            color = Ink,
            fontWeight = FontWeight.Bold,
            fontSize = 22.sp,
            modifier = Modifier.padding(top = 4.dp)
        )
        Text(stringResource(R.string.instapay_subtitle), color = Muted, fontSize = 14.sp)
    }

    if (token == null) {
        Text(stringResource(R.string.instapay_sign_in), color = ErrorRed, fontSize = 14.sp)
        return
    }

    // Amount to transfer (the exact booking total, in EGP).
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(20.dp),
        shadowElevation = 2.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(stringResource(R.string.instapay_amount_to_send), color = Muted, fontSize = 13.sp)
            Text(
                "EGP $total",
                color = Burgundy,
                fontWeight = FontWeight.Bold,
                fontSize = 28.sp
            )
            Text(
                if (nights == 1) stringResource(R.string.instapay_for_one_night)
                else stringResource(R.string.instapay_for_nights, stringResource(R.string.pay_nights_count, nights)),
                color = Muted,
                fontSize = 12.sp
            )
        }
    }

    // Transfer destination card: the Instapay handle (copyable) + the host's instructions.
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(20.dp),
        shadowElevation = 2.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                stringResource(R.string.instapay_send_to),
                color = Muted,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
            when {
                loadingConfig -> {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(color = Burgundy, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(10.dp))
                        Text(stringResource(R.string.instapay_loading), color = Muted, fontSize = 14.sp)
                    }
                }
                configError || config == null -> {
                    Text(stringResource(R.string.instapay_load_error), color = ErrorRed, fontSize = 14.sp)
                }
                config!!.instapayHandle.isBlank() -> {
                    Text(stringResource(R.string.instapay_no_handle), color = Ink, fontSize = 14.sp)
                }
                else -> {
                    val cfg = config!!
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            cfg.instapayHandle,
                            color = Ink,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedButton(
                            onClick = {
                                clipboard.setText(AnnotatedString(cfg.instapayHandle))
                                android.widget.Toast
                                    .makeText(context, context.getString(R.string.instapay_copied), android.widget.Toast.LENGTH_SHORT)
                                    .show()
                            },
                            shape = RoundedCornerShape(12.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Burgundy),
                            colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White, contentColor = Burgundy)
                        ) {
                            Icon(Icons.Filled.ContentCopy, contentDescription = stringResource(R.string.instapay_copy), modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(stringResource(R.string.instapay_copy), fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        }
                    }
                    if (cfg.instructions.isNotBlank()) {
                        HorizontalDivider(color = Tan)
                        Text(cfg.instructions, color = Muted, fontSize = 14.sp, lineHeight = 20.sp)
                    }
                }
            }
        }
    }

    // Screenshot picker: a tappable box that shows the picked thumbnail or an "Add screenshot" prompt.
    val slotShape = RoundedCornerShape(16.dp)
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(150.dp)
            .clip(slotShape)
            .background(Color.White, slotShape)
            .border(1.dp, if (pickedUri != null) GoldDeep else Tan, slotShape)
            .clickable(enabled = !submitting) {
                pickShot.launch(
                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                )
            },
        contentAlignment = Alignment.Center
    ) {
        val uri = pickedUri
        if (uri != null) {
            coil.compose.AsyncImage(
                model = uri,
                contentDescription = stringResource(R.string.instapay_add_screenshot),
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().height(150.dp).clip(slotShape)
            )
            if (encoding) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp)
                        .size(28.dp)
                        .background(Color.Black.copy(alpha = 0.35f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(16.dp))
                }
            }
        } else {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(Icons.Filled.Image, contentDescription = null, tint = Burgundy, modifier = Modifier.size(26.dp))
                Spacer(Modifier.height(8.dp))
                Text(stringResource(R.string.instapay_add_screenshot), color = Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
    if (pickedUri != null && !encoding) {
        Text(
            stringResource(R.string.instapay_change_screenshot),
            color = Burgundy,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center
        )
    }

    if (submitError != null) {
        Text(submitError!!, color = ErrorRed, fontSize = 14.sp)
    }

    // Submit the screenshot as proof of payment; the host approves later.
    GradientButton(
        onClick = {
            val img = imageDataUrl ?: run {
                submitError = context.getString(R.string.instapay_missing_screenshot)
                return@GradientButton
            }
            submitError = null
            submitting = true
            scope.launch {
                try {
                    BookingService.submitPaymentProof(token, bookingId, img)
                    submitted = true
                } catch (e: BookingService.HttpError) {
                    submitError = when (e.code) {
                        401 -> context.getString(R.string.instapay_sign_in)
                        // 400 can be a missing screenshot, "too large", or "already paid" — prefer
                        // the server's message, falling back to the missing-screenshot copy.
                        400 -> e.message ?: context.getString(R.string.instapay_missing_screenshot)
                        else -> e.message ?: context.getString(R.string.instapay_load_error)
                    }
                } catch (e: Exception) {
                    submitError = e.message ?: context.getString(R.string.instapay_load_error)
                } finally {
                    submitting = false
                }
            }
        },
        // Require a valid transfer destination too — don't let the guest "submit a transfer" when
        // the Instapay handle never loaded / isn't set.
        enabled = imageDataUrl != null && !submitting && !encoding && config?.instapayHandle?.isNotBlank() == true,
        modifier = Modifier.fillMaxWidth(),
        height = 54.dp
    ) {
        if (submitting) {
            CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
            Spacer(Modifier.width(10.dp))
            Text(stringResource(R.string.instapay_submitting), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        } else {
            Text(stringResource(R.string.instapay_submit), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        }
    }

    // Reassuring note: the host confirms after verifying the transfer.
    Text(stringResource(R.string.instapay_note), color = Muted, fontSize = 12.sp)
}

/**
 * The Instapay success state: the proof was uploaded and is now awaiting the host's approval. A
 * single Done button continues (dismisses the sheet) via [onContinue].
 */
@Composable
private fun InstapayAwaiting(onContinue: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Spacer(Modifier.height(8.dp))
        Box(
            modifier = Modifier
                .size(72.dp)
                .background(GoldDeep.copy(alpha = 0.14f), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Filled.HourglassTop, contentDescription = null, tint = GoldDeep, modifier = Modifier.size(36.dp))
        }
        Text(
            stringResource(R.string.instapay_awaiting_title),
            color = Ink,
            fontWeight = FontWeight.Bold,
            fontSize = 22.sp,
            textAlign = TextAlign.Center
        )
        Text(
            stringResource(R.string.instapay_awaiting_body),
            color = Muted,
            fontSize = 14.sp,
            textAlign = TextAlign.Center
        )
        GradientButton(
            onClick = onContinue,
            modifier = Modifier.fillMaxWidth(),
            height = 52.dp
        ) {
            Text(stringResource(R.string.action_done), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        }
    }
}
