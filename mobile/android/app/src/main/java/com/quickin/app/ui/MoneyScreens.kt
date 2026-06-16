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
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.HourglassEmpty
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.CurrencyManager
import com.quickin.app.GuestReceipt
import com.quickin.app.HostEarningItem
import com.quickin.app.HostEarningsUiState
import com.quickin.app.R
import com.quickin.app.ReceiptsUiState
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.GoldDeep
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.SuccessGreen
import com.quickin.app.ui.theme.Tan

private val ErrorRed = Color(0xFFB3261E)

// ============================================================================
// Host earnings / payouts (Section 9 — MOCK)
// ============================================================================

/**
 * Host "Earnings & payouts" screen (reached from the host area). Three stat cards (total earned /
 * paid out / pending, all converted to the user's display currency via [CurrencyManager]) sit above
 * a per-booking breakdown — each row showing the stay, dates, the host's net, and a paid-out /
 * upcoming badge. Loads once on first appearance (`GET /api/local/host/earnings`).
 *
 * Bilingual + RTL-safe: every label is a string resource and rows are plain [Row]s that follow the
 * layout direction. Amounts are stored EGP and converted for DISPLAY only — bookings stay EGP.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HostEarningsScreen(
    state: HostEarningsUiState,
    onBack: () -> Unit,
    onLoad: () -> Unit
) {
    LaunchedEffect(Unit) { if (!state.loaded) onLoad() }

    Scaffold(
        containerColor = CreamPage,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        stringResource(R.string.money_earnings),
                        color = Ink,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.action_back),
                            tint = Ink
                        )
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
            val earnings = state.earnings
            when {
                state.isLoading && earnings == null -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = Burgundy)
                    Text(
                        stringResource(R.string.money_loading_earnings),
                        color = Muted,
                        modifier = Modifier.padding(top = 12.dp)
                    )
                }
                state.error != null && earnings == null -> MoneyErrorState(
                    title = stringResource(R.string.money_earnings_error),
                    message = state.error,
                    onRetry = onLoad
                )
                earnings == null || earnings.recent.isEmpty() && earnings.totalEarned == 0.0 -> MoneyEmptyState(
                    icon = Icons.Filled.Payments,
                    title = stringResource(R.string.money_no_earnings)
                )
                else -> LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    item {
                        // Three stat cards: total earned / paid out / pending.
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            EarningsStatCard(
                                icon = Icons.Filled.AccountBalanceWallet,
                                value = CurrencyManager.format(earnings.totalEarned),
                                label = stringResource(R.string.money_total_earned),
                                accent = Burgundy,
                                modifier = Modifier.weight(1f)
                            )
                            EarningsStatCard(
                                icon = Icons.Filled.CheckCircle,
                                value = CurrencyManager.format(earnings.paidOut),
                                label = stringResource(R.string.money_paid_out),
                                accent = SuccessGreen,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                    item {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            EarningsStatCard(
                                icon = Icons.Filled.HourglassEmpty,
                                value = CurrencyManager.format(earnings.pending),
                                label = stringResource(R.string.money_pending),
                                accent = GoldDeep,
                                modifier = Modifier.weight(1f)
                            )
                            EarningsStatCard(
                                icon = Icons.Filled.Payments,
                                value = earnings.bookingsCount.toString(),
                                label = stringResource(R.string.money_bookings),
                                accent = Ink,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                    // Commission note (e.g. "Platform commission: 10%").
                    if (earnings.commissionRate > 0.0) {
                        item {
                            Text(
                                stringResource(R.string.money_commission_note, earnings.commissionPercentText),
                                color = Muted,
                                fontSize = 13.sp,
                                modifier = Modifier.padding(start = 4.dp, top = 2.dp)
                            )
                        }
                    }
                    item {
                        Text(
                            stringResource(R.string.money_payouts),
                            color = Ink,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(start = 4.dp, top = 6.dp)
                        )
                    }
                    items(earnings.recent, key = { it.bookingId }) { item ->
                        EarningRow(item)
                    }
                }
            }
        }
    }
}

/** A stat tile (icon + bold value + label) for the earnings summary, on a white boutique card. */
@Composable
private fun EarningsStatCard(
    icon: ImageVector,
    value: String,
    label: String,
    accent: Color,
    modifier: Modifier = Modifier
) {
    BoutiqueCard(modifier = modifier, shadow = 6.dp, radius = 18.dp) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(22.dp))
            Spacer(Modifier.height(8.dp))
            Text(
                value,
                color = Ink,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center
            )
            Text(label, color = Muted, fontSize = 12.sp, textAlign = TextAlign.Center)
        }
    }
}

/** One booking in the earnings breakdown: title + dates + the host's net + a status badge. */
@Composable
private fun EarningRow(item: HostEarningItem) {
    BoutiqueCard(modifier = Modifier.fillMaxWidth(), shadow = 6.dp) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    item.title.ifBlank { "—" },
                    fontWeight = FontWeight.Bold,
                    color = Ink,
                    fontSize = 16.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                Spacer(Modifier.width(8.dp))
                MoneyStatusBadge(paidOut = item.isPaidOut)
            }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                Icon(Icons.Filled.DateRange, null, tint = Muted, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text(item.dateRangeText, color = Ink, fontSize = 14.sp, fontWeight = FontWeight.Medium)
            }
            // Paid-out date, when released.
            if (item.isPaidOut && !item.paidAt.isNullOrBlank()) {
                Text(
                    stringResource(R.string.money_paid_on, shortDate(item.paidAt)),
                    color = Muted,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
            Spacer(Modifier.height(10.dp))
            HorizontalDivider(color = Tan)
            Spacer(Modifier.height(10.dp))
            // Gross (guest paid) → your net.
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(stringResource(R.string.money_gross), color = Muted, fontSize = 13.sp)
                Text(CurrencyManager.format(item.gross), color = Ink, fontSize = 13.sp)
            }
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(stringResource(R.string.money_net), color = Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                Text(
                    CurrencyManager.format(item.net),
                    color = Burgundy,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

/** A paid-out (green) / upcoming (gold) capsule for an earnings row. */
@Composable
private fun MoneyStatusBadge(paidOut: Boolean) {
    val (bg, fg, label) = if (paidOut) {
        Triple(Color(0xFFD9EBE0), SuccessGreen, stringResource(R.string.money_status_paid_out))
    } else {
        Triple(Color(0xFFFBEFD6), GoldDeep, stringResource(R.string.money_status_upcoming))
    }
    Surface(shape = RoundedCornerShape(50), color = bg) {
        Text(
            label,
            color = fg,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
        )
    }
}

// ============================================================================
// Guest receipts (Section 9 — MOCK)
// ============================================================================

/**
 * Guest "Receipts" screen (reached from the Profile tab). Lists each paid receipt as an itemized
 * card: subtotal, service fee, the signed method fee, a promo discount when one applies, and the
 * net total — plus the reservation code and paid date. All amounts convert to the user's display
 * currency via [CurrencyManager]. Loads once on first appearance (`GET /api/local/receipts`).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReceiptsScreen(
    state: ReceiptsUiState,
    onBack: () -> Unit,
    onLoad: () -> Unit
) {
    LaunchedEffect(Unit) { if (!state.loaded) onLoad() }

    Scaffold(
        containerColor = CreamPage,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        stringResource(R.string.money_receipts),
                        color = Ink,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.action_back),
                            tint = Ink
                        )
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
                state.isLoading && state.receipts.isEmpty() -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = Burgundy)
                    Text(
                        stringResource(R.string.money_loading_receipts),
                        color = Muted,
                        modifier = Modifier.padding(top = 12.dp)
                    )
                }
                state.error != null && state.receipts.isEmpty() -> MoneyErrorState(
                    title = stringResource(R.string.money_receipts_error),
                    message = state.error,
                    onRetry = onLoad
                )
                state.receipts.isEmpty() -> MoneyEmptyState(
                    icon = Icons.AutoMirrored.Filled.ReceiptLong,
                    title = stringResource(R.string.money_no_receipts)
                )
                else -> LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    items(state.receipts, key = { it.bookingId }) { receipt ->
                        ReceiptCard(receipt)
                    }
                }
            }
        }
    }
}

/** One itemized receipt: title + reservation code + dates, the price breakdown, and the total. */
@Composable
private fun ReceiptCard(receipt: GuestReceipt) {
    BoutiqueCard(modifier = Modifier.fillMaxWidth(), shadow = 6.dp) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        receipt.title.ifBlank { stringResource(R.string.money_receipt) },
                        fontWeight = FontWeight.Bold,
                        color = Ink,
                        fontSize = 16.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (receipt.reservationCode.isNotBlank()) {
                        Text(
                            receipt.reservationCode,
                            color = Muted,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                }
                Icon(
                    Icons.AutoMirrored.Filled.ReceiptLong,
                    contentDescription = null,
                    tint = Burgundy,
                    modifier = Modifier.size(22.dp)
                )
            }

            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                Icon(Icons.Filled.DateRange, null, tint = Muted, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text(receipt.dateRangeText, color = Ink, fontSize = 14.sp, fontWeight = FontWeight.Medium)
            }

            Spacer(Modifier.height(12.dp))
            // Itemized breakdown on a soft tan tile.
            Surface(color = Cream, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    ReceiptLine(
                        label = stringResource(R.string.money_subtotal),
                        value = CurrencyManager.format(receipt.subtotal)
                    )
                    ReceiptLine(
                        label = stringResource(R.string.money_service_fee),
                        value = CurrencyManager.format(receipt.serviceFee)
                    )
                    // Signed method fee — surcharge in ink, discount in gold; only when non-zero.
                    if (receipt.methodFee != 0.0) {
                        val isSurcharge = receipt.methodFee > 0.0
                        val magnitude = kotlin.math.abs(receipt.methodFee)
                        ReceiptLine(
                            label = stringResource(R.string.money_method_fee),
                            value = (if (isSurcharge) "+" else "−") + CurrencyManager.format(magnitude),
                            valueColor = if (isSurcharge) Ink else GoldDeep
                        )
                    }
                    // Promo discount, when one was applied.
                    if (receipt.hasPromo) {
                        ReceiptLine(
                            label = stringResource(R.string.money_promo_discount) +
                                (receipt.promoCode?.let { " ($it)" } ?: ""),
                            value = "−" + CurrencyManager.format(receipt.promoDiscount),
                            valueColor = GoldDeep
                        )
                    }
                    HorizontalDivider(color = Tan)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(stringResource(R.string.money_total), color = Ink, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text(
                            CurrencyManager.format(receipt.total),
                            color = Burgundy,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp
                        )
                    }
                }
            }

            // Paid-on date.
            if (!receipt.paidAt.isNullOrBlank()) {
                Text(
                    stringResource(R.string.money_paid_on, shortDate(receipt.paidAt)),
                    color = Muted,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(top = 10.dp)
                )
            }
        }
    }
}

/** A label/value row inside a receipt breakdown. [valueColor] tints the value (e.g. a discount). */
@Composable
private fun ReceiptLine(label: String, value: String, valueColor: Color = Ink) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, color = Muted, fontSize = 14.sp)
        Text(value, color = valueColor, fontSize = 14.sp, fontWeight = FontWeight.Medium)
    }
}

// ---- Shared empty / error states --------------------------------------------

@Composable
private fun MoneyEmptyState(icon: ImageVector, title: String) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(32.dp)
    ) {
        Icon(icon, contentDescription = null, tint = Burgundy, modifier = Modifier.size(48.dp))
        Text(
            title,
            fontWeight = FontWeight.Bold,
            color = Ink,
            fontSize = 18.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 12.dp)
        )
    }
}

@Composable
private fun MoneyErrorState(title: String, message: String, onRetry: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(32.dp)
    ) {
        Text(title, fontWeight = FontWeight.Bold, color = Ink, fontSize = 18.sp, textAlign = TextAlign.Center)
        Text(
            message,
            color = Muted,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp, bottom = 16.dp)
        )
        Button(
            onClick = onRetry,
            colors = ButtonDefaults.buttonColors(containerColor = Burgundy, contentColor = Color.White)
        ) {
            Text(stringResource(R.string.action_retry))
        }
    }
}

/** Trims an ISO-8601 timestamp to its date part ("2027-03-14"); returns it unchanged if unparseable. */
private fun shortDate(iso: String): String =
    iso.takeWhile { it != 'T' }.ifBlank { iso }
