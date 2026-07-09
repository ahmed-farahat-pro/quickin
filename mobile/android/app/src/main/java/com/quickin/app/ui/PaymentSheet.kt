package com.quickin.app.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
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
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.HourglassTop
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Sell
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.text.input.ImeAction
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
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
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

// Sentinel error keys resolved to localized strings at display time (avoids reading resources off
// the composition thread inside the coroutine).
private const val UNAVAILABLE_ERROR = "__pay_unavailable__"
private const val SIGN_IN_ERROR = "__pay_sign_in__"
private const val PAYMENT_FAILED_ERROR = "__pay_failed__"

/** The internal phase of the Paymob payment flow inside the sheet. */
private enum class PayPhase {
    /** The breakdown + Pay button. */
    Form,

    /** Calling `pay-init` (fetching the Paymob checkout URL). */
    Initializing,

    /** Hosted checkout is open in the WebView dialog. */
    Checkout,

    /** WebView closed; polling the booking for the webhook-driven paid state. */
    Polling,

    /** Booking read as paid — short confirmation before continuing. */
    Confirmed,

    /** Polling timed out still unpaid — the webhook likely lands shortly. */
    Processing
}

/**
 * Payment sheet shown after a guest creates a booking (and from an unpaid reservation's "Pay now").
 * A [ModalBottomSheet] showing the informational price breakdown (subtotal · service fee · total)
 * and a "Pay {amount} {currency}" button. Tapping Pay calls `pay-init` and opens Paymob's HOSTED
 * checkout in an in-app WebView ([PaymobCheckoutScreen]) — card details are entered on Paymob's
 * page, never collected in our UI. When the WebView reaches our return URL the sheet polls the
 * booking (the server webhook marks it paid) and either confirms or shows a "processing" note.
 *
 * The price breakdown still uses the local formula (subtotal = nightly × nights, service fee = 10%,
 * plus the signed method fee and any previewed promo discount) so the figures show before checkout.
 *
 * @param nightly nightly price in EGP.
 * @param nights number of nights.
 * @param bookingId the booking being paid (target of `pay-init` + polling).
 * @param token the bearer token, or null when signed out (the Pay button then surfaces a sign-in note).
 * @param state the in-flight payment/promo state (owned by BookingsViewModel — drives the promo UI).
 * @param onValidatePromo previews a promo code against the subtotal (apply / refresh the preview).
 * @param onClearPromo clears the applied/previewed promo code.
 * @param onPaid called once the booking is confirmed paid (or "processing") to dismiss + continue.
 * @param onDismiss called when the sheet is dismissed (drag-down / scrim) before paying.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentSheet(
    nightly: Int,
    nights: Int,
    bookingId: String,
    token: String?,
    state: PaymentUiState,
    onValidatePromo: (code: String, subtotal: Int) -> Unit = { _, _ -> },
    onClearPromo: () -> Unit = {},
    onPaid: () -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()

    var phase by remember { mutableStateOf(PayPhase.Form) }
    var error by remember { mutableStateOf<String?>(null) }
    // The pay-init result while the checkout dialog is open.
    var payInit by remember { mutableStateOf<BookingService.PayInit?>(null) }

    val busy = phase == PayPhase.Initializing || phase == PayPhase.Polling
    // While initializing / in checkout / polling / done, ignore drag-to-dismiss so the flow isn't
    // interrupted mid-payment; it exits via its explicit buttons / completion.
    val locked = phase != PayPhase.Form

    fun startPolling() {
        val t = token ?: return
        phase = PayPhase.Polling
        scope.launch {
            val paid = try {
                BookingService.pollBookingPaid(t, bookingId)
            } catch (_: Exception) {
                false
            }
            phase = if (paid) PayPhase.Confirmed else PayPhase.Processing
        }
    }

    fun startPay() {
        val t = token ?: run {
            error = SIGN_IN_ERROR
            phase = PayPhase.Form
            return
        }
        error = null
        phase = PayPhase.Initializing
        scope.launch {
            try {
                val init = BookingService.payInit(t, bookingId)
                when {
                    // Already settled (e.g. paid in another session) — skip checkout, just continue.
                    init.alreadyPaid -> phase = PayPhase.Confirmed
                    init.checkoutUrl.isBlank() -> {
                        error = UNAVAILABLE_ERROR
                        phase = PayPhase.Form
                    }
                    else -> {
                        payInit = init
                        phase = PayPhase.Checkout
                    }
                }
            } catch (e: BookingService.HttpError) {
                // 503 = Paymob keys not configured server-side → friendly "unavailable" message.
                error = if (e.code == 503) UNAVAILABLE_ERROR else (e.message ?: PAYMENT_FAILED_ERROR)
                phase = PayPhase.Form
            } catch (e: Exception) {
                error = e.message ?: PAYMENT_FAILED_ERROR
                phase = PayPhase.Form
            }
        }
    }

    ModalBottomSheet(
        onDismissRequest = { if (!locked) onDismiss() },
        sheetState = sheetState,
        containerColor = CreamPage,
        contentColor = Ink
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp)
        ) {
            AnimatedContent(
                targetState = phase == PayPhase.Confirmed || phase == PayPhase.Processing,
                transitionSpec = { fadeIn(tween()) togetherWith fadeOut(tween()) },
                label = "payPhase"
            ) { isDone ->
                if (isDone) {
                    PayOutcome(processing = phase == PayPhase.Processing, onContinue = onPaid)
                } else {
                    PayForm(
                        nightly = nightly,
                        nights = nights,
                        bookingId = bookingId,
                        token = token,
                        state = state,
                        busy = busy,
                        error = error,
                        onPay = { startPay() },
                        onValidatePromo = onValidatePromo,
                        onClearPromo = onClearPromo,
                        onPaid = onPaid
                    )
                }
            }
        }
    }

    // The Paymob hosted checkout, shown full-screen over the sheet while [phase] == Checkout.
    val init = payInit
    if (phase == PayPhase.Checkout && init != null) {
        Dialog(
            onDismissRequest = {
                // Back / scrim on the checkout dialog = cancel (no charge).
                payInit = null
                phase = PayPhase.Form
            },
            properties = DialogProperties(usePlatformDefaultWidth = false)
        ) {
            PaymobCheckoutScreen(
                checkoutUrl = init.checkoutUrl,
                returnUrlPrefix = init.returnUrlPrefix,
                onFinished = {
                    payInit = null
                    startPolling()
                },
                onCancel = {
                    payInit = null
                    phase = PayPhase.Form
                }
            )
        }
    }
}

/** A short fade tween for the phase swap (kept private so the import stays local). */
private fun tween() = androidx.compose.animation.core.tween<Float>(durationMillis = 260)

/** The payment methods the guest can pick. Carries the API value + signed rate on the subtotal. */
private enum class PayMethod(val api: String, val rate: Double) {
    Card("card", 0.05),
    BankTransfer("bank_transfer", -0.05)
}

/**
 * The form phase. A top-level payment-channel choice — "Card (Paymob)" (the existing hosted-checkout
 * flow, unchanged) or "Instapay transfer" (a manual bank transfer where the guest uploads a
 * screenshot for the host to approve) — sits above the channel-specific body.
 */
@Composable
private fun PayForm(
    nightly: Int,
    nights: Int,
    bookingId: String,
    token: String?,
    state: PaymentUiState,
    busy: Boolean,
    error: String?,
    onPay: () -> Unit,
    onValidatePromo: (code: String, subtotal: Int) -> Unit,
    onClearPromo: () -> Unit,
    onPaid: () -> Unit
) {
    // Card (Paymob) by default; Instapay is the manual bank-transfer alternative.
    var channel by remember { mutableStateOf(PayChannel.Paymob) }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                stringResource(R.string.pay_title),
                color = Ink,
                fontWeight = FontWeight.Bold,
                fontSize = 22.sp,
                modifier = Modifier.padding(top = 4.dp)
            )
            Text(
                stringResource(R.string.pay_subtitle),
                color = Muted,
                fontSize = 14.sp
            )
        }

        // Top-level channel selector: card checkout vs Instapay bank transfer.
        PayChannelSelector(selected = channel, enabled = !busy, onSelect = { channel = it })

        when (channel) {
            PayChannel.Paymob -> PaymobPayBody(
                nightly = nightly,
                nights = nights,
                state = state,
                busy = busy,
                error = error,
                onPay = onPay,
                onValidatePromo = onValidatePromo,
                onClearPromo = onClearPromo
            )
            PayChannel.Instapay -> InstapayPayBody(
                token = token,
                bookingId = bookingId,
                onPaid = onPaid
            )
        }
    }
}

/**
 * The Paymob (hosted card checkout) body — the original form content, unchanged: the segmented
 * card/bank fee selector, the price breakdown, the promo field, the secure-checkout note, and the
 * "Pay {amount}" CTA that opens Paymob's hosted checkout. Emitted directly into [PayForm]'s Column.
 */
@Composable
private fun PaymobPayBody(
    nightly: Int,
    nights: Int,
    state: PaymentUiState,
    busy: Boolean,
    error: String?,
    onPay: () -> Unit,
    onValidatePromo: (code: String, subtotal: Int) -> Unit,
    onClearPromo: () -> Unit
) {
    val nightsLabel = stringResource(R.string.pay_nights_count, nights)
    val subtotal = nightly * nights
    val serviceFee = Math.round(subtotal * 0.1).toInt()

    // Default = card. The method's signed rate adjusts the subtotal (+5% card / −5% bank).
    var method by remember { mutableStateOf(PayMethod.Card) }
    // Mirror the backend: methodFee = round(subtotal × rate); total = subtotal + serviceFee + methodFee.
    val methodFee = Math.round(subtotal * method.rate).toInt()
    // A previewed, valid promo nets its discount off the shown total (the backend re-applies it).
    val promoDiscount = state.promo?.takeIf { it.valid }?.discount ?: 0
    val total = (subtotal + serviceFee + methodFee - promoDiscount).coerceAtLeast(0)
    val currency = "EGP"

    // Segmented method selector: Card (+5%) vs Bank transfer (−5%).
    MethodSelector(selected = method, onSelect = { if (!busy) method = it })

    // Amount breakdown: subtotal · service fee (10%) · signed method fee · total. Informational.
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
            PriceRow(
                label = com.quickin.app.CurrencyManager.format(nightly) + " × " + nightsLabel,
                value = com.quickin.app.CurrencyManager.format(subtotal)
            )
            PriceRow(
                label = stringResource(R.string.pay_service_fee),
                value = com.quickin.app.CurrencyManager.format(serviceFee)
            )
            // Signed method line: surcharge in ink, discount in gold; magnitude is |methodFee|.
            val feeMagnitude = kotlin.math.abs(methodFee)
            if (method == PayMethod.Card) {
                PriceRow(
                    label = stringResource(R.string.pay_card_surcharge),
                    value = "+" + com.quickin.app.CurrencyManager.format(feeMagnitude),
                    valueColor = Ink
                )
            } else {
                PriceRow(
                    label = stringResource(R.string.pay_bank_discount),
                    value = "−" + com.quickin.app.CurrencyManager.format(feeMagnitude),
                    valueColor = GoldDeep
                )
            }
            // Applied promo discount line (only when a valid code is previewed).
            if (promoDiscount > 0) {
                PriceRow(
                    label = stringResource(R.string.promo_discount),
                    value = "−" + com.quickin.app.CurrencyManager.format(promoDiscount),
                    valueColor = GoldDeep
                )
            }
            HorizontalDivider(color = Tan)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    stringResource(R.string.detail_total),
                    color = Ink,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
                Text(
                    com.quickin.app.CurrencyManager.format(total),
                    color = Burgundy,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
            }
        }
    }

    // Promo code — the guest can preview + apply a discount before paying.
    PromoCodeField(
        state = state,
        subtotal = subtotal,
        busy = busy,
        onApply = onValidatePromo,
        onClear = onClearPromo
    )

    // Secure-checkout note: card entry happens on Paymob's hosted page, not here.
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Icon(Icons.Filled.Lock, contentDescription = null, tint = Muted, modifier = Modifier.size(14.dp))
        Text(
            stringResource(R.string.pay_secure_note),
            color = Muted,
            fontSize = 12.sp
        )
    }

    if (error != null) {
        val message = when (error) {
            UNAVAILABLE_ERROR -> stringResource(R.string.pay_unavailable)
            SIGN_IN_ERROR -> stringResource(R.string.pay_sign_in)
            PAYMENT_FAILED_ERROR -> stringResource(R.string.pay_failed)
            else -> error
        }
        Text(message, color = ErrorRed, fontSize = 14.sp)
    }

    // The primary CTA — opens Paymob's hosted checkout. The total is informational; the server
    // computes the authoritative amount on pay-init.
    GradientButton(
        onClick = onPay,
        enabled = !busy,
        pulse = !busy,
        modifier = Modifier.fillMaxWidth(),
        height = 54.dp
    ) {
        if (busy) {
            CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
            Spacer(Modifier.width(10.dp))
            Text(stringResource(R.string.pay_processing), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        } else {
            Text(
                stringResource(R.string.money_pay_currency, com.quickin.app.CurrencyManager.format(total), currency),
                color = Color.White,
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp
            )
        }
    }
}

/** The two top-level payment channels: card via Paymob, or a manual Instapay bank transfer. */
private enum class PayChannel { Paymob, Instapay }

/**
 * The top-level channel selector ("Card (Paymob)" / "Instapay transfer"), styled like
 * [MethodSelector] — the selected segment fills burgundy, the other is a tappable tan tile. RTL-safe.
 */
@Composable
private fun PayChannelSelector(
    selected: PayChannel,
    enabled: Boolean,
    onSelect: (PayChannel) -> Unit
) {
    Surface(
        color = Tan.copy(alpha = 0.55f),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            MethodSegment(
                label = "Card (Paymob)",
                selected = selected == PayChannel.Paymob,
                onClick = { if (enabled) onSelect(PayChannel.Paymob) },
                modifier = Modifier.weight(1f)
            )
            MethodSegment(
                label = "Instapay transfer",
                selected = selected == PayChannel.Instapay,
                onClick = { if (enabled) onSelect(PayChannel.Instapay) },
                modifier = Modifier.weight(1f)
            )
        }
    }
}

/**
 * The Instapay bank-transfer body. Fetches the transfer destination (`getPaymentConfig`), shows the
 * Instapay handle with a copy button + the host's instructions, lets the guest pick a transfer
 * screenshot from the gallery (Photo Picker → downscaled base64 data URL), then submits it via
 * `submitPaymentProof`. On success it switches to an "Awaiting host approval" confirmation whose
 * Done button calls [onPaid]. Errors (sign-in / missing screenshot / other) use the sheet's error
 * styling. Emitted directly into [PayForm]'s Column.
 */
@Composable
private fun InstapayPayBody(
    token: String?,
    bookingId: String,
    onPaid: () -> Unit
) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val scope = rememberCoroutineScope()

    var config by remember { mutableStateOf<BookingService.PaymentConfig?>(null) }
    var loadingConfig by remember { mutableStateOf(false) }
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

    // Load the transfer destination once the Instapay channel is shown.
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

    if (token == null) {
        Text(
            "Please sign in to pay by Instapay transfer.",
            color = ErrorRed,
            fontSize = 14.sp
        )
        return
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
                "Send the transfer to",
                color = Muted,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
            when {
                loadingConfig -> {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(color = Burgundy, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(10.dp))
                        Text("Loading transfer details…", color = Muted, fontSize = 14.sp)
                    }
                }
                configError || config == null -> {
                    Text(
                        "Couldn't load the transfer details. Please try again.",
                        color = ErrorRed,
                        fontSize = 14.sp
                    )
                }
                else -> {
                    val cfg = config!!
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            cfg.instapayHandle.ifBlank { "—" },
                            color = Ink,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            modifier = Modifier.weight(1f)
                        )
                        if (cfg.instapayHandle.isNotBlank()) {
                            OutlinedButton(
                                onClick = {
                                    clipboard.setText(AnnotatedString(cfg.instapayHandle))
                                    android.widget.Toast
                                        .makeText(context, "Copied", android.widget.Toast.LENGTH_SHORT)
                                        .show()
                                },
                                shape = RoundedCornerShape(12.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Burgundy),
                                colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White, contentColor = Burgundy)
                            ) {
                                Icon(Icons.Filled.ContentCopy, contentDescription = "Copy", modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("Copy", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            }
                        }
                    }
                    if (cfg.instructions.isNotBlank()) {
                        HorizontalDivider(color = Tan)
                        Text(
                            cfg.instructions,
                            color = Muted,
                            fontSize = 14.sp,
                            lineHeight = 20.sp
                        )
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
                contentDescription = "Transfer screenshot",
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
                Text("Add transfer screenshot", color = Ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }

    if (submitError != null) {
        Text(submitError!!, color = ErrorRed, fontSize = 14.sp)
    }

    // Submit the screenshot as proof of payment; the host approves later.
    GradientButton(
        onClick = {
            val img = imageDataUrl ?: run {
                submitError = "Please add your transfer screenshot."
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
                        401 -> "Please sign in to continue."
                        400 -> "Please add your transfer screenshot."
                        else -> e.message ?: "Couldn't submit your screenshot. Please try again."
                    }
                } catch (e: Exception) {
                    submitError = e.message ?: "Couldn't submit your screenshot. Please try again."
                } finally {
                    submitting = false
                }
            }
        },
        enabled = imageDataUrl != null && !submitting && !encoding,
        modifier = Modifier.fillMaxWidth(),
        height = 54.dp
    ) {
        if (submitting) {
            CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
            Spacer(Modifier.width(10.dp))
            Text("Submitting…", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        } else {
            Text("I've paid — submit screenshot", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        }
    }
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
            "Awaiting host approval",
            color = Ink,
            fontWeight = FontWeight.Bold,
            fontSize = 22.sp,
            textAlign = TextAlign.Center
        )
        Text(
            "We've sent your transfer screenshot to the host. Your booking is confirmed once they approve it.",
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
 * A two-option segmented control for the payment method: "Card (+5%)" / "Bank transfer (−5%)".
 * The selected segment fills burgundy with white text; the other is a tappable tan tile. The
 * whole control sits in a tan track and is RTL-safe (a plain [Row] follows the layout direction).
 */
@Composable
private fun MethodSelector(selected: PayMethod, onSelect: (PayMethod) -> Unit) {
    Surface(
        color = Tan.copy(alpha = 0.55f),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            MethodSegment(
                label = stringResource(R.string.pay_method_card),
                selected = selected == PayMethod.Card,
                onClick = { onSelect(PayMethod.Card) },
                modifier = Modifier.weight(1f)
            )
            MethodSegment(
                label = stringResource(R.string.pay_method_bank),
                selected = selected == PayMethod.BankTransfer,
                onClick = { onSelect(PayMethod.BankTransfer) },
                modifier = Modifier.weight(1f)
            )
        }
    }
}

/** One segment of [MethodSelector]: burgundy pill when selected, otherwise a clickable transparent tile. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MethodSegment(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        color = if (selected) Burgundy else Color.Transparent,
        contentColor = if (selected) Color.White else Ink,
        shape = RoundedCornerShape(13.dp),
        shadowElevation = if (selected) 2.dp else 0.dp,
        onClick = onClick,
        modifier = modifier
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .fillMaxWidth()
                .height(44.dp)
                .padding(horizontal = 8.dp)
        ) {
            Text(
                label,
                color = if (selected) Color.White else Ink,
                fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
                fontSize = 14.sp,
                textAlign = TextAlign.Center
            )
        }
    }
}

/**
 * Promo-code entry: a text field + Apply button that previews the code against [subtotal] via
 * [onApply]. While validating it shows a spinner; once previewed, a valid code shows an "applied"
 * confirmation (with a Remove action) and an invalid one shows the backend's message. RTL-safe.
 */
@Composable
private fun PromoCodeField(
    state: PaymentUiState,
    subtotal: Int,
    busy: Boolean,
    onApply: (code: String, subtotal: Int) -> Unit,
    onClear: () -> Unit
) {
    var code by remember { mutableStateOf("") }
    val promo = state.promo
    val applied = promo?.valid == true
    val validating = state.validatingPromo
    val disabled = validating || busy

    Surface(
        color = Color.White,
        shape = RoundedCornerShape(20.dp),
        shadowElevation = 2.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Icon(Icons.Filled.Sell, contentDescription = null, tint = Burgundy, modifier = Modifier.size(16.dp))
                Text(
                    stringResource(R.string.promo_have_code),
                    color = Ink,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = code,
                    onValueChange = {
                        code = it
                        // Editing the code drops any prior preview so the total resets.
                        if (promo != null) onClear()
                    },
                    label = { Text(stringResource(R.string.promo_code)) },
                    singleLine = true,
                    enabled = !disabled,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { if (code.isNotBlank()) onApply(code, subtotal) }),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Burgundy,
                        unfocusedBorderColor = Tan,
                        focusedLabelColor = Burgundy,
                        cursorColor = Burgundy,
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color.White
                    ),
                    modifier = Modifier.weight(1f)
                )
                OutlinedButton(
                    onClick = { if (code.isNotBlank()) onApply(code, subtotal) },
                    enabled = !disabled && code.isNotBlank(),
                    shape = RoundedCornerShape(14.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Burgundy),
                    colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White, contentColor = Burgundy),
                    modifier = Modifier.height(56.dp)
                ) {
                    if (validating) {
                        CircularProgressIndicator(color = Burgundy, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
                    } else {
                        Text(stringResource(R.string.promo_apply), fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            // Result line: applied confirmation (+ Remove) or the not-valid message.
            if (promo != null && !validating) {
                if (applied) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = GoldDeep, modifier = Modifier.size(16.dp))
                            Text(
                                stringResource(R.string.promo_applied) + " · " + promo.discountText,
                                color = GoldDeep,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        TextButton(onClick = { code = ""; onClear() }) {
                            Text(stringResource(R.string.promo_remove), color = Muted, fontSize = 13.sp)
                        }
                    }
                } else {
                    Text(
                        promo.message ?: stringResource(R.string.promo_invalid),
                        color = ErrorRed,
                        fontSize = 13.sp
                    )
                }
            }
        }
    }
}

/**
 * The outcome phase shown after the hosted checkout closes: a confirmed tick (the booking read as
 * paid) or a "payment is processing" note (poll timed out — the webhook lands shortly). Either way a
 * single button continues to the reservation.
 */
@Composable
private fun PayOutcome(processing: Boolean, onContinue: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Spacer(Modifier.height(8.dp))
        if (processing) {
            CircularProgressIndicator(color = Burgundy, strokeWidth = 3.dp, modifier = Modifier.size(56.dp))
        } else {
            PopIn { DrawCheckmark(size = 72.dp) }
        }

        Text(
            stringResource(if (processing) R.string.pay_processing_title else R.string.pay_confirmed_title),
            color = Ink,
            fontWeight = FontWeight.Bold,
            fontSize = 22.sp,
            textAlign = TextAlign.Center
        )
        Text(
            stringResource(if (processing) R.string.pay_processing_body else R.string.pay_confirmed_body),
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

/** A label/value row used in the price breakdown. [valueColor] tints the value (e.g. a discount). */
@Composable
private fun PriceRow(label: String, value: String, valueColor: Color = Ink) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, color = Muted, fontSize = 14.sp)
        Text(value, color = valueColor, fontSize = 14.sp, fontWeight = FontWeight.Medium)
    }
}
