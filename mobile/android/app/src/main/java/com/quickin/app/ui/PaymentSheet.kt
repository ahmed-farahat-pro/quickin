package com.quickin.app.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CreditCard
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.PaymentReceipt
import com.quickin.app.PaymentUiState
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Gold
import com.quickin.app.ui.theme.GoldDeep
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

private val ErrorRed = Color(0xFFB3261E)

/**
 * MOCK payment sheet shown after a guest creates a booking (and optionally from an unpaid
 * reservation's "Pay now"). There is NO real gateway yet — this just mimics paying so the
 * booking flow completes end-to-end. A [ModalBottomSheet] (mirroring [DateRangePickerSheet])
 * with two phases:
 *  • the amount breakdown (subtotal · service fee 10% · total) + a decorative, disabled card
 *    row + a burgundy "Pay EGP {total}" button (spinner while paying), and
 *  • on success, a paid confirmation (drawn checkmark + "Booking confirmed & paid" + the
 *    QK-… reference), with a "Done" button that continues to the reservation.
 *
 * Amounts are computed locally for the breakdown (subtotal = nightly × nights, service fee = 10%,
 * total = subtotal + fee) — the same formula the backend uses — so the figures show instantly
 * before the (always-succeeds) request returns the authoritative [PaymentReceipt].
 *
 * The guest also picks a payment method — Card (+5% surcharge) or Bank transfer (−5% discount) —
 * which re-computes the shown total (subtotal + 10% service fee + signed method fee) and is sent
 * to the backend as the `method`.
 *
 * The guest can also enter a promo code: [onValidatePromo] previews it against the subtotal (the
 * preview nets its discount off the shown total) and the applied code is sent through the pay POST,
 * with the discount echoed on the [PaymentReceipt].
 *
 * @param nightly nightly price in EGP.
 * @param nights number of nights.
 * @param state the in-flight payment state (owned by BookingsViewModel).
 * @param onPay runs the mock payment for the booking with the chosen method ("card" | "bank_transfer").
 * @param onValidatePromo previews a promo code against the subtotal (apply / refresh the preview).
 * @param onClearPromo clears the applied/previewed promo code.
 * @param onDone called after a successful payment to dismiss + continue to the reservation.
 * @param onDismiss called when the sheet is dismissed (drag-down / scrim) before paying.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentSheet(
    nightly: Int,
    nights: Int,
    state: PaymentUiState,
    onPay: (method: String) -> Unit,
    onValidatePromo: (code: String, subtotal: Int) -> Unit = { _, _ -> },
    onClearPromo: () -> Unit = {},
    onDone: () -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val paid = state.receipt != null

    ModalBottomSheet(
        // While paying or once paid, ignore drag-to-dismiss/scrim taps so the flow isn't
        // interrupted mid-request; the paid phase exits via its explicit "Done" button.
        onDismissRequest = { if (!state.isPaying && !paid) onDismiss() },
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
                targetState = paid,
                transitionSpec = { fadeIn(tween()) togetherWith fadeOut(tween()) },
                label = "payPhase"
            ) { isPaid ->
                if (isPaid) {
                    PaidConfirmation(receipt = state.receipt!!, onDone = onDone)
                } else {
                    PayForm(
                        nightly = nightly,
                        nights = nights,
                        state = state,
                        onPay = onPay,
                        onValidatePromo = onValidatePromo,
                        onClearPromo = onClearPromo
                    )
                }
            }
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

/** The breakdown + method selector + promo code + decorative card + pay button (phase 1). */
@Composable
private fun PayForm(
    nightly: Int,
    nights: Int,
    state: PaymentUiState,
    onPay: (method: String) -> Unit,
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

        // Segmented method selector: Card (+5%) vs Bank transfer (−5%).
        MethodSelector(selected = method, onSelect = { if (!state.isPaying) method = it })

        // Amount breakdown: subtotal · service fee (10%) · signed method fee · total.
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
            onApply = onValidatePromo,
            onClear = onClearPromo
        )

        // A decorative, DISABLED card row — purely to signal "this is where the card would go".
        // No real input; the demo note below makes clear nothing is charged.
        DecorativeCardRow()

        // Clearly-labelled demo note so it's unmistakable this is not a real charge.
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Filled.Lock, contentDescription = null, tint = Muted, modifier = Modifier.size(14.dp))
            Text(
                stringResource(R.string.pay_demo_note),
                color = Muted,
                fontSize = 12.sp
            )
        }

        if (state.error != null) {
            Text(state.error, color = ErrorRed, fontSize = 14.sp)
        }

        // The primary CTA — burgundy gradient + pulsing ring; shows a spinner while paying.
        GradientButton(
            onClick = { onPay(method.api) },
            enabled = !state.isPaying,
            pulse = !state.isPaying,
            modifier = Modifier.fillMaxWidth(),
            height = 54.dp
        ) {
            if (state.isPaying) {
                CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                Spacer(Modifier.width(10.dp))
                Text(stringResource(R.string.pay_processing), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            } else {
                Text(
                    stringResource(R.string.money_pay, com.quickin.app.CurrencyManager.format(total)),
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp
                )
            }
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
 * confirmation (with a Remove action) and an invalid one shows the backend's message. RTL-safe —
 * the field/button row and the status row follow the layout direction.
 */
@Composable
private fun PromoCodeField(
    state: PaymentUiState,
    subtotal: Int,
    onApply: (code: String, subtotal: Int) -> Unit,
    onClear: () -> Unit
) {
    var code by remember { mutableStateOf("") }
    val promo = state.promo
    val applied = promo?.valid == true
    val validating = state.validatingPromo

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
                    enabled = !validating && !state.isPaying,
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
                    enabled = !validating && !state.isPaying && code.isNotBlank(),
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

/** The paid confirmation (phase 2): drawn checkmark, confirmation text, reference, Done. */
@Composable
private fun PaidConfirmation(
    receipt: PaymentReceipt,
    onDone: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Spacer(Modifier.height(8.dp))
        // qkDraw + qkPop — the green tick draws itself on inside a popping circle.
        PopIn { DrawCheckmark(size = 72.dp) }

        Text(
            stringResource(R.string.pay_confirmed_title),
            color = Ink,
            fontWeight = FontWeight.Bold,
            fontSize = 22.sp,
            textAlign = TextAlign.Center
        )

        // The QK-… reference, in a soft tan card with a label.
        Surface(
            color = Tan,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(stringResource(R.string.pay_reference), color = Muted, fontSize = 12.sp)
                Text(
                    receipt.reference.ifBlank { "—" },
                    color = Burgundy,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    letterSpacing = 2.sp
                )
                HorizontalDivider(color = Ink.copy(alpha = 0.08f), modifier = Modifier.padding(vertical = 4.dp))
                // Echo the chosen method + its signed adjustment from the authoritative receipt.
                if (receipt.methodFee != 0) {
                    val feeMagnitude = kotlin.math.abs(receipt.methodFee)
                    val isSurcharge = receipt.methodFee > 0
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            stringResource(
                                if (isSurcharge) R.string.pay_card_surcharge else R.string.pay_bank_discount
                            ),
                            color = Muted,
                            fontSize = 14.sp
                        )
                        Text(
                            (if (isSurcharge) "+" else "−") + com.quickin.app.CurrencyManager.format(feeMagnitude),
                            color = if (isSurcharge) Ink else GoldDeep,
                            fontWeight = FontWeight.Medium,
                            fontSize = 14.sp
                        )
                    }
                }
                // Echo the redeemed promo code + its discount from the authoritative receipt.
                if (receipt.hasPromo) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            stringResource(R.string.promo_discount) + " (" + receipt.promoCode + ")",
                            color = Muted,
                            fontSize = 14.sp
                        )
                        Text(
                            "−" + com.quickin.app.CurrencyManager.format(receipt.promoDiscount),
                            color = GoldDeep,
                            fontWeight = FontWeight.Medium,
                            fontSize = 14.sp
                        )
                    }
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(stringResource(R.string.detail_total), color = Muted, fontSize = 14.sp)
                    Text(com.quickin.app.CurrencyManager.format(receipt.total), color = Burgundy, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }
        }

        GradientButton(
            onClick = onDone,
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

/**
 * A purely decorative, non-interactive "card" row (gold card icon + masked number + MM/YY) on a
 * faint tan tile — it signals where a card would go without collecting any input (this is a mock).
 */
@Composable
private fun DecorativeCardRow() {
    Surface(
        color = Tan.copy(alpha = 0.45f),
        shape = RoundedCornerShape(16.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Tan),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 16.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(Gold.copy(alpha = 0.16f), RoundedCornerShape(10.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Filled.CreditCard, contentDescription = null, tint = GoldDeep, modifier = Modifier.size(22.dp))
            }
            Spacer(Modifier.width(14.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text("•••• •••• •••• 4242", color = Ink, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, letterSpacing = 1.sp)
                Text(stringResource(R.string.pay_card_demo), color = Muted, fontSize = 12.sp)
            }
            Text("12/29", color = Muted, fontSize = 13.sp)
        }
    }
}
