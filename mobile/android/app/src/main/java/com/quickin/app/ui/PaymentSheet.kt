package com.quickin.app.ui

import com.quickin.app.humanError

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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.HourglassTop
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.Button
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
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.AvatarImage
import com.quickin.app.BookingService
import com.quickin.app.FlashCheckout
import com.quickin.app.FlashCheckoutRules
import com.quickin.app.PaymentUiState
import com.quickin.app.Qr
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.GoldDeep
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val ErrorRed = Color(0xFFB3261E)

/**
 * Payment sheet shown after a guest creates a booking (and from an unpaid reservation's "Pay now").
 * Mirrors the website + iOS: a **manual transfer** flow (Paymob card checkout was removed). The
 * guest sends the booking amount to one of QuickIn's accounts (`GET /api/local/payment-config`),
 * uploads a screenshot of the transfer (`POST /api/local/bookings/:id/payment-proof`), and it is
 * confirmed after being checked. A [ModalBottomSheet] hosts the whole flow; on submission it shows
 * an "Awaiting host approval" confirmation whose Done button calls [onPaid].
 *
 * There are two destinations — **Instapay** and a **bank account** — each with its own admin
 * toggle. Which appear comes from `availableMethods`, never from a list hardcoded here, and the
 * picker is hidden when only one is offered because a single-option choice is not a choice.
 *
 * A third, **automatic** method — **Flash** (card / mobile wallet / Valu) — replaces the screenshot
 * with a hosted checkout page; see [FlashPayPanel]. Once the server reports the booking paid the
 * sheet shows a "Payment confirmed" state whose Done button also calls [onPaid].
 *
 * @param total the booking total in EGP — the exact amount the guest transfers.
 * @param nights number of nights (for the "for N nights" caption).
 * @param bookingId the booking being paid (target of `payment-proof`).
 * @param token the bearer token, or null when signed out (the body then surfaces a sign-in note).
 * @param state retained for call-site compatibility; unused by the transfer flow.
 * @param onValidatePromo retained for call-site compatibility; unused by the transfer flow.
 * @param onClearPromo retained for call-site compatibility; unused by the transfer flow.
 * @param onPaid called once the transfer screenshot is submitted (awaiting approval), or a Flash
 *   payment is confirmed, to dismiss + continue.
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
        // The body MUST scroll. Its natural height (amount card + method picker + a
        // destination card that can carry a 164dp QR or four bank fields + the screenshot
        // slot + submit) overruns a phone screen, and a ModalBottomSheet caps its content at
        // the available height — so without this the screenshot picker and the submit button
        // are simply clipped away with no way to reach them, which reads as "Android has no
        // proof upload". iOS has always wrapped the same body in a ScrollView.
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            TransferPayBody(
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
 * One "label / value / Copy" line in the bank destination. Renders nothing for a blank value, so
 * the optional IBAN simply doesn't appear when the admin left it out.
 *
 * [copyValue] is what lands on the clipboard, which is not always what is on screen: the IBAN is
 * displayed in groups of four and copied compact.
 */
@Composable
private fun BankField(
    label: String,
    value: String,
    mono: Boolean = false,
    copyValue: String? = null
) {
    if (value.isBlank()) return
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(3.dp)
    ) {
        Text(label, color = Muted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                value,
                color = Ink,
                fontWeight = FontWeight.Bold,
                fontSize = if (mono) 16.sp else 15.sp,
                fontFamily = if (mono) androidx.compose.ui.text.font.FontFamily.Monospace else null,
                modifier = Modifier.weight(1f)
            )
            if (!copyValue.isNullOrBlank()) {
                OutlinedButton(
                    onClick = {
                        clipboard.setText(AnnotatedString(copyValue))
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
        }
    }
}

/**
 * The manual-transfer body. Shows the amount to transfer, fetches the destinations
 * (`getPaymentConfig`), lets the guest pick between the offered methods and shows that one's
 * details, lets them pick a transfer screenshot from the gallery (Photo Picker → downscaled base64
 * data URL), then submits it via `submitPaymentProof` along with the method they chose. On success
 * it switches to an "Awaiting host approval" confirmation whose Done button calls [onPaid].
 * Emitted directly into [PaymentSheet]'s Column.
 */
@Composable
private fun TransferPayBody(
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
    // The destination the guest tapped. Null until they choose, so the shown method can fall back
    // to whatever the server offers first — that way "the admin switched Instapay off" needs no
    // special case here.
    var pickedMethod by remember { mutableStateOf<BookingService.PaymentMethod?>(null) }

    // Picked screenshot: the content Uri drives the thumbnail; the data URL is uploaded.
    var pickedUri by remember { mutableStateOf<android.net.Uri?>(null) }
    var imageDataUrl by remember { mutableStateOf<String?>(null) }
    var encoding by remember { mutableStateOf(false) }

    var submitting by remember { mutableStateOf(false) }
    var submitError by remember { mutableStateOf<String?>(null) }
    var submitted by remember { mutableStateOf(false) }
    // Set by the Flash panel once the server reports the booking paid.
    var flashPaid by remember { mutableStateOf(false) }

    // The methods the server offers, and the one on screen: the guest's pick while it is still
    // offered, else the first offered (Flash, when it is available).
    val offered = config?.availableMethods.orEmpty()
    val shownMethod = pickedMethod?.takeIf { offered.contains(it) } ?: offered.firstOrNull()
    val isFlash = shownMethod == BookingService.PaymentMethod.FLASH

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
    // Success — Flash confirmed the payment; nothing left for anyone to review.
    if (flashPaid) {
        FlashPaid(onContinue = onPaid)
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
        Text(
            stringResource(if (isFlash) R.string.pay_flash_header_subtitle else R.string.pay_methods_subtitle),
            color = Muted,
            fontSize = 14.sp
        )
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
            Text(
                stringResource(if (isFlash) R.string.pay_flash_amount else R.string.instapay_amount_to_send),
                color = Muted,
                fontSize = 13.sp
            )
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
            // Segmented pills, one per offered method — rendered from the server's list, so a
            // method the admin switched off simply isn't here. Hidden entirely for a single one.
            if (offered.size > 1) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    offered.forEach { m ->
                        val on = m == shownMethod
                        val pillShape = RoundedCornerShape(12.dp)
                        Text(
                            stringResource(
                                when (m) {
                                    BookingService.PaymentMethod.FLASH -> R.string.pay_methods_flash
                                    BookingService.PaymentMethod.BANK_TRANSFER -> R.string.pay_methods_bank_transfer
                                    BookingService.PaymentMethod.INSTAPAY -> R.string.pay_methods_instapay
                                }
                            ),
                            color = if (on) Color.White else Ink,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier
                                .weight(1f)
                                .clip(pillShape)
                                .background(if (on) Burgundy else Color.White, pillShape)
                                .border(1.dp, if (on) Burgundy else Tan, pillShape)
                                .clickable { pickedMethod = m }
                                .padding(vertical = 12.dp)
                        )
                    }
                }
                HorizontalDivider(color = Tan)
            }

            // There is no destination to send to when Flash collects the money itself.
            if (!isFlash) {
                Text(
                    stringResource(R.string.instapay_send_to),
                    color = Muted,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
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
                !config!!.isConfigured -> {
                    Text(stringResource(R.string.instapay_no_handle), color = Ink, fontSize = 14.sp)
                }
                isFlash -> {
                    Text(stringResource(R.string.pay_methods_flash), color = Ink, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Text(stringResource(R.string.pay_methods_flash_subtitle), color = Muted, fontSize = 14.sp, lineHeight = 20.sp)
                }
                shownMethod == BookingService.PaymentMethod.BANK_TRANSFER -> {
                    val bank = config!!.bank
                    // Nothing is masked — a masked account number is one nobody can send money to.
                    BankField(stringResource(R.string.pay_methods_bank_name), bank.bankName)
                    BankField(stringResource(R.string.pay_methods_account_name), bank.accountName)
                    BankField(
                        stringResource(R.string.pay_methods_account_number),
                        bank.accountNumber,
                        mono = true,
                        copyValue = bank.accountNumber
                    )
                    // Shown in groups of four the way a bank prints one, but copied compact —
                    // that is the form a banking app's field wants.
                    BankField(
                        stringResource(R.string.pay_methods_iban),
                        bank.ibanFormatted,
                        mono = true,
                        copyValue = bank.iban
                    )
                    if (bank.instructions.isNotBlank()) {
                        HorizontalDivider(color = Tan)
                        Text(bank.instructions, color = Muted, fontSize = 14.sp, lineHeight = 20.sp)
                    }
                }
                else -> {
                    val cfg = config!!
                    // Resolve the QR once per config rather than on every recomposition: the
                    // admin's uploaded image when there is one, else encode qr_payload (the
                    // link if set, else the handle) locally with the bundled ZXing core.
                    val qr = remember(cfg.instapayQrImage, cfg.qrPayload) {
                        AvatarImage.decodeDataUrlToBitmap(cfg.instapayQrImage.takeIf { it.isNotBlank() })
                            ?: cfg.qrPayload.takeIf { it.isNotBlank() }?.let { Qr.bitmap(it) }
                    }
                    if (qr != null) {
                        val qrShape = RoundedCornerShape(14.dp)
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            androidx.compose.foundation.Image(
                                bitmap = qr.asImageBitmap(),
                                contentDescription = stringResource(R.string.instapay_scan_hint),
                                // Nearest-neighbour keeps the QR modules square instead of blurring
                                // them when the small bitmap is scaled up.
                                filterQuality = FilterQuality.None,
                                modifier = Modifier
                                    .size(164.dp)
                                    .clip(qrShape)
                                    .background(Color.White, qrShape)
                                    .border(1.dp, Tan, qrShape)
                                    .padding(8.dp)
                            )
                            Text(
                                stringResource(R.string.instapay_scan_hint),
                                color = Muted,
                                fontSize = 12.sp,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                    // A link-only destination is valid, so the handle row is conditional.
                    if (cfg.instapayHandle.isNotBlank()) {
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
                    }
                    // Hands the deep link to the system: Instapay opens when it has verified the
                    // host as an App Link, otherwise the browser does. Nothing reports back — the
                    // guest still uploads a screenshot below.
                    cfg.linkOrNull?.let { link ->
                        Button(
                            onClick = {
                                val opened = runCatching {
                                    context.startActivity(
                                        android.content.Intent(
                                            android.content.Intent.ACTION_VIEW,
                                            android.net.Uri.parse(link)
                                        ).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                                    )
                                }.isSuccess
                                if (!opened) {
                                    android.widget.Toast
                                        .makeText(context, context.getString(R.string.instapay_open_failed), android.widget.Toast.LENGTH_SHORT)
                                        .show()
                                }
                            },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp)
                        ) {
                            Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(8.dp))
                            Text(stringResource(R.string.instapay_open), fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
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

    // Flash has no screenshot: its own pay button, waiting state and polling replace everything below.
    if (isFlash) {
        FlashPayPanel(
            total = total,
            token = token,
            bookingId = bookingId,
            onConfirmed = { flashPaid = true }
        )
        return
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
                    BookingService.submitPaymentProof(
                        token,
                        bookingId,
                        img,
                        // The server validates this against its own vocabulary. Always a manual
                        // method — never Flash, which has no proof to upload. Falling back to
                        // Instapay only matters if the config never loaded, and the button is
                        // disabled in that case.
                        BookingService.PaymentMethod.forProof(pickedMethod, offered)
                    )
                    submitted = true
                } catch (e: BookingService.HttpError) {
                    submitError = when (e.code) {
                        401 -> context.getString(R.string.instapay_sign_in)
                        // 400 can be a missing screenshot, "too large", or "already paid" — prefer
                        // the server's message, falling back to the missing-screenshot copy.
                        400 -> humanError(e, context.getString(R.string.instapay_missing_screenshot))
                        else -> humanError(e, context.getString(R.string.instapay_load_error))
                    }
                } catch (e: Exception) {
                    submitError = humanError(e, context.getString(R.string.instapay_load_error))
                } finally {
                    submitting = false
                }
            }
        },
        // Require a loaded, offered destination too — don't let the guest "submit a transfer"
        // when the config never loaded, or when the admin has switched every method off. This
        // used to test the Instapay handle specifically, which would have blocked a bank-only
        // destination.
        enabled = imageDataUrl != null && !submitting && !encoding && config?.isConfigured == true,
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

/**
 * The Flash (useflash.app) card/wallet checkout, shown in place of the screenshot upload.
 *
 * "Pay EGP X" POSTs `flash-checkout` and opens the returned hosted page in a Custom Tab. Flash has
 * no return URL, so nothing tells the app the guest finished: while the checkout is open it polls
 * the GET endpoint every [FlashCheckoutRules.POLL_INTERVAL_MS], re-checks whenever the app comes
 * back to the foreground, and offers a manual "Check payment status". Polling stops on `paid`, when
 * the order closes, after [FlashCheckoutRules.POLL_TIMEOUT_MS], or when the sheet goes away (the
 * effects leave composition with it). On `paid` it calls [onConfirmed].
 *
 * A failed / canceled / expired order shows why and the same Pay button — POSTing again mints a
 * fresh link.
 */
@Composable
private fun FlashPayPanel(
    total: Int,
    token: String,
    bookingId: String,
    onConfirmed: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val lifecycleOwner = LocalLifecycleOwner.current

    var checkout by remember { mutableStateOf<FlashCheckout?>(null) }
    var starting by remember { mutableStateOf(false) }
    var checking by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    // Shown under a manual check that found nothing yet.
    var notice by remember { mutableStateOf<String?>(null) }
    // When the current polling window opened; null while there is nothing to wait for.
    var pollStartedAt by remember { mutableStateOf<Long?>(null) }
    var timedOut by remember { mutableStateOf(false) }

    val phase = FlashCheckoutRules.phase(checkout)

    fun settle(c: FlashCheckout) {
        checkout = c
        if (FlashCheckoutRules.phase(c) == FlashCheckoutRules.Phase.Paid) onConfirmed()
    }

    // Refreshes from the server. A background poll fails quietly (the next one retries); a manual
    // check reports what it found.
    suspend fun refresh(manual: Boolean) {
        if (manual) {
            checking = true
            error = null
            notice = null
        }
        try {
            val c = BookingService.flashCheckoutStatus(token, bookingId)
            settle(c)
            if (manual && FlashCheckoutRules.phase(c) == FlashCheckoutRules.Phase.Waiting) {
                notice = context.getString(R.string.pay_flash_not_yet)
                // A manual check after the window closed opens a new one.
                if (timedOut) {
                    timedOut = false
                    pollStartedAt = System.currentTimeMillis()
                }
            }
        } catch (e: Exception) {
            if (manual) error = humanError(e, context.getString(R.string.pay_flash_error))
        } finally {
            if (manual) checking = false
        }
    }

    fun openLink(link: String) {
        val uri = android.net.Uri.parse(link)
        val opened = runCatching {
            androidx.browser.customtabs.CustomTabsIntent.Builder().build().launchUrl(context, uri)
        }.isSuccess || runCatching {
            context.startActivity(
                android.content.Intent(android.content.Intent.ACTION_VIEW, uri)
                    .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        }.isSuccess
        if (!opened) {
            android.widget.Toast
                .makeText(context, context.getString(R.string.instapay_open_failed), android.widget.Toast.LENGTH_SHORT)
                .show()
        }
    }

    fun start() {
        starting = true
        error = null
        notice = null
        scope.launch {
            try {
                val c = BookingService.flashCheckout(token, bookingId)
                settle(c)
                val link = c.paymentLink
                when {
                    c.paid -> Unit
                    link != null -> {
                        openLink(link)
                        timedOut = false
                        pollStartedAt = System.currentTimeMillis()
                    }
                    else -> error = context.getString(R.string.pay_flash_error)
                }
            } catch (e: BookingService.HttpError) {
                // 409 flash_unavailable / not_payable, 400 below_minimum, 502 flash_error — the
                // server's `error` says which, in words the guest can act on.
                error = if (e.code == 401) context.getString(R.string.instapay_sign_in)
                else humanError(e, context.getString(R.string.pay_flash_error))
            } catch (e: Exception) {
                error = humanError(e, context.getString(R.string.pay_flash_error))
            } finally {
                starting = false
            }
        }
    }

    // Resume a checkout already in flight — the guest may have closed the sheet mid-payment and
    // reopened it from "Pay now". Quiet on failure: the Pay button is the fallback.
    LaunchedEffect(bookingId) {
        try {
            val c = BookingService.flashCheckoutStatus(token, bookingId)
            settle(c)
            if (FlashCheckoutRules.phase(c) == FlashCheckoutRules.Phase.Waiting) {
                pollStartedAt = System.currentTimeMillis()
            }
        } catch (_: Exception) {
        }
    }

    // Poll while waiting. Reads the live state each lap, so a manual check or a resume that
    // settles the checkout ends the loop too.
    LaunchedEffect(phase, pollStartedAt) {
        while (FlashCheckoutRules.shouldPoll(FlashCheckoutRules.phase(checkout), pollStartedAt, System.currentTimeMillis())) {
            delay(FlashCheckoutRules.POLL_INTERVAL_MS)
            refresh(manual = false)
        }
        if (FlashCheckoutRules.phase(checkout) == FlashCheckoutRules.Phase.Waiting && pollStartedAt != null) {
            timedOut = true
        }
    }

    // Coming back from the Custom Tab is the likeliest moment the payment just landed.
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME &&
                FlashCheckoutRules.phase(checkout) == FlashCheckoutRules.Phase.Waiting
            ) {
                scope.launch { refresh(manual = false) }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    if (phase == FlashCheckoutRules.Phase.Waiting) {
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
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (timedOut) {
                    Icon(Icons.Filled.HourglassTop, contentDescription = null, tint = GoldDeep, modifier = Modifier.size(28.dp))
                } else {
                    CircularProgressIndicator(color = Burgundy, strokeWidth = 2.dp, modifier = Modifier.size(28.dp))
                }
                Text(
                    stringResource(R.string.pay_flash_waiting_title),
                    color = Ink,
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp,
                    textAlign = TextAlign.Center
                )
                Text(
                    stringResource(if (timedOut) R.string.pay_flash_timeout else R.string.pay_flash_waiting_body),
                    color = Muted,
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    textAlign = TextAlign.Center
                )
            }
        }

        notice?.let { Text(it, color = Muted, fontSize = 13.sp, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center) }
        error?.let { Text(it, color = ErrorRed, fontSize = 14.sp) }

        GradientButton(
            onClick = { scope.launch { refresh(manual = true) } },
            enabled = !checking,
            modifier = Modifier.fillMaxWidth(),
            height = 54.dp
        ) {
            if (checking) {
                CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                Spacer(Modifier.width(10.dp))
                Text(stringResource(R.string.pay_flash_checking), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            } else {
                Text(stringResource(R.string.pay_flash_check), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            }
        }
        checkout?.paymentLink?.let { link ->
            OutlinedButton(
                onClick = { openLink(link) },
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Burgundy),
                colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White, contentColor = Burgundy),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(46.dp)
            ) {
                Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(stringResource(R.string.pay_flash_reopen), fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            }
        }
    } else {
        // Idle or Retry: the Pay button, with the reason the last attempt ended when there was one.
        if (phase == FlashCheckoutRules.Phase.Retry) {
            Text(
                stringResource(
                    if (checkout?.status == "expired") R.string.pay_flash_expired else R.string.pay_flash_failed
                ),
                color = ErrorRed,
                fontSize = 14.sp
            )
        }
        error?.let { Text(it, color = ErrorRed, fontSize = 14.sp) }

        GradientButton(
            onClick = { start() },
            enabled = !starting,
            modifier = Modifier.fillMaxWidth(),
            height = 54.dp
        ) {
            if (starting) {
                CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                Spacer(Modifier.width(10.dp))
                Text(stringResource(R.string.pay_flash_opening), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            } else {
                Text(stringResource(R.string.pay_flash_pay, total), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            }
        }
    }

    Text(stringResource(R.string.pay_flash_note), color = Muted, fontSize = 12.sp)
}

/**
 * The Flash success state: the server reports the booking paid. A single Done button continues
 * (dismisses the sheet and refreshes the reservation) via [onContinue].
 */
@Composable
private fun FlashPaid(onContinue: () -> Unit) {
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
            Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = GoldDeep, modifier = Modifier.size(36.dp))
        }
        Text(
            stringResource(R.string.pay_flash_paid_title),
            color = Ink,
            fontWeight = FontWeight.Bold,
            fontSize = 22.sp,
            textAlign = TextAlign.Center
        )
        Text(
            stringResource(R.string.pay_flash_paid_body),
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
