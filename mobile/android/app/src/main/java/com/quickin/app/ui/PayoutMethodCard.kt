package com.quickin.app.ui

import androidx.compose.foundation.background
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.AlternateEmail
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Numbers
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.HostPayoutMethod
import com.quickin.app.PayoutDraft
import com.quickin.app.PayoutMethodKind
import com.quickin.app.PayoutUiState
import com.quickin.app.R
import com.quickin.app.WalletProviderKind
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

/**
 * "Payment information" card for the Profile tab — where QuickIn sends a host's earnings.
 *
 * Two states in one card: a PREVIEW of what is saved, so the host can confirm it went in
 * correctly, and an inline EDITOR for adding or replacing it. A host with nothing saved opens
 * straight into the editor; one with a method saved sees the preview and opts into editing.
 *
 * Every field is shown back in full, IBAN and account number included: those are the payout
 * destination, they are meant to be handed out, and a masked IBAN is one a host cannot check.
 * Host-only — [PayoutUiState.hidden] is set when the server refuses a guest, and the card then
 * renders nothing. RTL-safe (rows lay out start→end).
 */
@Composable
fun PayoutMethodCard(
    state: PayoutUiState,
    onSave: (PayoutDraft) -> Unit,
    onRemove: () -> Unit,
    modifier: Modifier = Modifier
) {
    if (state.hidden) return

    val saved = state.method
    var editing by remember { mutableStateOf(false) }
    // Open the editor by default when there is nothing to preview. Keyed on whether a method
    // exists so a successful save closes the editor and a removal reopens it.
    LaunchedEffect(saved == null, state.loaded) {
        if (state.loaded) editing = saved == null
    }

    BoutiqueCard(modifier = modifier.fillMaxWidth(), shadow = 6.dp) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .background(Burgundy.copy(alpha = 0.12f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        iconFor(saved?.kind),
                        contentDescription = null,
                        tint = Burgundy,
                        modifier = Modifier.size(20.dp)
                    )
                }
                Spacer(Modifier.width(14.dp))
                Text(
                    stringResource(R.string.payout_title),
                    color = Ink,
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp,
                    modifier = Modifier.weight(1f)
                )
                if (saved != null) {
                    PayoutAddedPill()
                }
            }

            Text(
                stringResource(
                    if (saved != null) R.string.payout_subtitle_set else R.string.payout_subtitle_empty
                ),
                color = Muted,
                fontSize = 14.sp,
                lineHeight = 20.sp,
                modifier = Modifier.padding(top = 14.dp)
            )

            if (saved != null && !editing) {
                Spacer(Modifier.height(16.dp))
                PayoutPreview(saved)
                Spacer(Modifier.height(16.dp))
                GradientButton(
                    onClick = { editing = true },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        stringResource(R.string.payout_change),
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp
                    )
                }
                Spacer(Modifier.height(8.dp))
                PayoutTextButton(
                    text = stringResource(
                        if (state.isSubmitting) R.string.payout_removing else R.string.payout_remove
                    ),
                    enabled = !state.isSubmitting,
                    onClick = onRemove
                )
            } else {
                Spacer(Modifier.height(16.dp))
                PayoutEditor(
                    existing = saved,
                    isSubmitting = state.isSubmitting,
                    onSave = onSave,
                    onCancel = if (saved != null) ({ editing = false }) else null
                )
            }

            if (state.error != null) {
                Spacer(Modifier.height(12.dp))
                Text(
                    state.error,
                    color = Burgundy,
                    fontSize = 13.sp,
                    lineHeight = 18.sp
                )
            }
        }
    }
}

// ---- Preview ------------------------------------------------------------------

@Composable
private fun PayoutAddedPill() {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .background(Burgundy.copy(alpha = 0.12f), RoundedCornerShape(999.dp))
            .padding(horizontal = 10.dp, vertical = 5.dp)
    ) {
        Icon(
            Icons.Filled.CheckCircle,
            contentDescription = null,
            tint = Burgundy,
            modifier = Modifier.size(12.dp)
        )
        Spacer(Modifier.width(5.dp))
        Text(
            stringResource(R.string.payout_badge_added),
            color = Burgundy,
            fontWeight = FontWeight.Bold,
            fontSize = 11.sp
        )
    }
}

/** What is on file — the point of the section is that a host can read it back and confirm it. */
@Composable
private fun PayoutPreview(saved: HostPayoutMethod) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Tan.copy(alpha = 0.45f), RoundedCornerShape(16.dp))
            .padding(16.dp)
    ) {
        Text(
            methodLabel(saved.kind),
            color = Burgundy,
            fontWeight = FontWeight.Bold,
            fontSize = 11.sp
        )
        Spacer(Modifier.height(6.dp))
        Text(
            saved.display,
            color = Ink,
            fontWeight = FontWeight.Bold,
            fontSize = 17.sp
        )
        Spacer(Modifier.height(10.dp))
        PayoutPreviewRow(stringResource(R.string.payout_field_account_name), saved.accountName)
        if (saved.kind == PayoutMethodKind.BANK_ACCOUNT) {
            if (saved.bankName.isNotBlank()) {
                PayoutPreviewRow(stringResource(R.string.payout_field_bank), saved.bankName)
            }
            if (saved.ibanFormatted.isNotBlank()) {
                PayoutPreviewRow(stringResource(R.string.payout_field_iban), saved.ibanFormatted)
            }
            if (saved.accountNumber.isNotBlank()) {
                PayoutPreviewRow(stringResource(R.string.payout_field_account_number), saved.accountNumber)
            }
            if (saved.swiftBic.isNotBlank()) {
                PayoutPreviewRow(stringResource(R.string.payout_field_swift), saved.swiftBic)
            }
            if (saved.branch.isNotBlank()) {
                PayoutPreviewRow(stringResource(R.string.payout_field_branch), saved.branch)
            }
        }
    }
}

@Composable
private fun PayoutPreviewRow(label: String, value: String) {
    Row(
        verticalAlignment = Alignment.Top,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp)
    ) {
        Text(label, color = Muted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.weight(1f))
        Text(
            value,
            color = Ink,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.End
        )
    }
}

// ---- Editor -------------------------------------------------------------------

@Composable
private fun PayoutEditor(
    existing: HostPayoutMethod?,
    isSubmitting: Boolean,
    onSave: (PayoutDraft) -> Unit,
    onCancel: (() -> Unit)?
) {
    var method by remember(existing) {
        mutableStateOf(existing?.kind ?: PayoutMethodKind.BANK_ACCOUNT)
    }
    var accountName by remember(existing) { mutableStateOf(existing?.accountName.orEmpty()) }
    val isBank = existing?.kind == PayoutMethodKind.BANK_ACCOUNT
    var bankName by remember(existing) { mutableStateOf(if (isBank) existing.bankName else "") }
    // Seeded in the grouped form a host reads off a statement; the server strips the spaces.
    var iban by remember(existing) { mutableStateOf(if (isBank) existing.ibanFormatted else "") }
    var accountNumber by remember(existing) { mutableStateOf(if (isBank) existing.accountNumber else "") }
    var swiftBic by remember(existing) { mutableStateOf(if (isBank) existing.swiftBic else "") }
    var branch by remember(existing) { mutableStateOf(if (isBank) existing.branch else "") }
    var instapayAddress by remember(existing) {
        mutableStateOf(if (existing?.kind == PayoutMethodKind.INSTAPAY) existing.accountRef else "")
    }
    var walletProvider by remember(existing) {
        mutableStateOf(
            if (existing?.kind == PayoutMethodKind.WALLET) WalletProviderKind.fromKey(existing.provider)
            else WalletProviderKind.VODAFONE_CASH
        )
    }
    var walletNumber by remember(existing) {
        mutableStateOf(if (existing?.kind == PayoutMethodKind.WALLET) existing.accountRef else "")
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            stringResource(R.string.payout_choose_method),
            color = Muted,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold
        )
        PayoutMethodPicker(
            selected = method,
            enabled = !isSubmitting,
            onSelected = { method = it }
        )

        PayoutField(
            value = accountName,
            onValueChange = { accountName = it },
            label = stringResource(R.string.payout_field_account_name),
            icon = Icons.Filled.Person,
            enabled = !isSubmitting,
            placeholder = stringResource(R.string.payout_placeholder_account_name)
        )

        when (method) {
            PayoutMethodKind.BANK_ACCOUNT -> {
                PayoutField(
                    value = bankName,
                    onValueChange = { bankName = it },
                    label = stringResource(R.string.payout_field_bank),
                    icon = Icons.Filled.AccountBalance,
                    enabled = !isSubmitting,
                    placeholder = stringResource(R.string.payout_placeholder_bank)
                )
                PayoutField(
                    value = iban,
                    onValueChange = { iban = it },
                    label = stringResource(R.string.payout_field_iban),
                    icon = Icons.Filled.Numbers,
                    enabled = !isSubmitting,
                    placeholder = stringResource(R.string.payout_placeholder_iban)
                )
                Text(
                    stringResource(R.string.payout_bank_hint),
                    color = Muted,
                    fontSize = 12.sp,
                    lineHeight = 17.sp
                )
                PayoutField(
                    value = accountNumber,
                    onValueChange = { accountNumber = it },
                    label = stringResource(R.string.payout_field_account_number),
                    icon = Icons.Filled.CreditCard,
                    enabled = !isSubmitting,
                    placeholder = stringResource(R.string.payout_placeholder_account_number),
                    keyboardType = KeyboardType.Number
                )
                PayoutField(
                    value = swiftBic,
                    onValueChange = { swiftBic = it },
                    label = stringResource(R.string.payout_field_swift_optional),
                    icon = Icons.Filled.Public,
                    enabled = !isSubmitting,
                    placeholder = stringResource(R.string.payout_placeholder_swift)
                )
                PayoutField(
                    value = branch,
                    onValueChange = { branch = it },
                    label = stringResource(R.string.payout_field_branch_optional),
                    icon = Icons.Filled.Place,
                    enabled = !isSubmitting,
                    placeholder = stringResource(R.string.payout_placeholder_branch)
                )
            }

            PayoutMethodKind.INSTAPAY -> {
                PayoutField(
                    value = instapayAddress,
                    onValueChange = { instapayAddress = it },
                    label = stringResource(R.string.payout_field_instapay_address),
                    icon = Icons.Filled.AlternateEmail,
                    enabled = !isSubmitting,
                    placeholder = stringResource(R.string.payout_placeholder_instapay_address),
                    keyboardType = KeyboardType.Email
                )
                Text(
                    stringResource(R.string.payout_instapay_hint),
                    color = Muted,
                    fontSize = 12.sp,
                    lineHeight = 17.sp
                )
            }

            PayoutMethodKind.WALLET -> {
                Text(
                    stringResource(R.string.payout_field_wallet_provider),
                    color = Muted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
                WalletProviderPicker(
                    selected = walletProvider,
                    enabled = !isSubmitting,
                    onSelected = { walletProvider = it }
                )
                PayoutField(
                    value = walletNumber,
                    onValueChange = { walletNumber = it },
                    label = stringResource(R.string.payout_field_wallet_number),
                    icon = Icons.Filled.Phone,
                    enabled = !isSubmitting,
                    placeholder = stringResource(R.string.payout_placeholder_wallet_number),
                    keyboardType = KeyboardType.Phone
                )
            }
        }

        Spacer(Modifier.height(4.dp))
        GradientButton(
            onClick = {
                onSave(
                    PayoutDraft(
                        method = method,
                        accountName = accountName,
                        bankName = bankName,
                        iban = iban,
                        accountNumber = accountNumber,
                        swiftBic = swiftBic,
                        branch = branch,
                        instapayAddress = instapayAddress,
                        walletProvider = walletProvider,
                        walletNumber = walletNumber
                    )
                )
            },
            enabled = !isSubmitting,
            modifier = Modifier.fillMaxWidth()
        ) {
            if (isSubmitting) {
                CircularProgressIndicator(
                    color = Color.White,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(22.dp)
                )
            } else {
                Text(
                    stringResource(R.string.payout_save),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp
                )
            }
        }
        if (onCancel != null) {
            PayoutTextButton(
                text = stringResource(R.string.action_cancel),
                enabled = !isSubmitting,
                onClick = onCancel
            )
        }
    }
}

/** The three destinations, as full-width selectable cards (mirrors the host-type picker). */
@Composable
private fun PayoutMethodPicker(
    selected: PayoutMethodKind,
    enabled: Boolean,
    onSelected: (PayoutMethodKind) -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        PayoutMethodKind.entries.forEach { kind ->
            val isSelected = kind == selected
            Surface(
                onClick = { onSelected(kind) },
                enabled = enabled,
                shape = RoundedCornerShape(16.dp),
                color = if (isSelected) Burgundy else Color.White,
                border = androidx.compose.foundation.BorderStroke(
                    1.dp,
                    if (isSelected) Burgundy else Tan
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(14.dp)
                ) {
                    Icon(
                        if (isSelected) Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked,
                        contentDescription = null,
                        tint = if (isSelected) Color.White else Muted,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(Modifier.width(12.dp))
                    Icon(
                        iconFor(kind),
                        contentDescription = null,
                        tint = if (isSelected) Color.White else Burgundy,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(
                        methodLabel(kind),
                        color = if (isSelected) Color.White else Ink,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp
                    )
                }
            }
        }
    }
}

/** Wallet providers, as a compact selectable list. */
@Composable
private fun WalletProviderPicker(
    selected: WalletProviderKind,
    enabled: Boolean,
    onSelected: (WalletProviderKind) -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        WalletProviderKind.entries.forEach { provider ->
            val isSelected = provider == selected
            Surface(
                onClick = { onSelected(provider) },
                enabled = enabled,
                shape = RoundedCornerShape(14.dp),
                color = if (isSelected) Burgundy.copy(alpha = 0.10f) else Color.White,
                border = androidx.compose.foundation.BorderStroke(
                    1.dp,
                    if (isSelected) Burgundy else Tan
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 11.dp)
                ) {
                    Icon(
                        if (isSelected) Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked,
                        contentDescription = null,
                        tint = if (isSelected) Burgundy else Muted,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(
                        walletProviderLabel(provider),
                        color = Ink,
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                        fontSize = 14.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun PayoutField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    icon: ImageVector,
    enabled: Boolean,
    placeholder: String? = null,
    keyboardType: KeyboardType = KeyboardType.Text
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        placeholder = placeholder?.let { { Text(it, color = Muted) } },
        singleLine = true,
        enabled = enabled,
        leadingIcon = { Icon(icon, contentDescription = null, tint = Burgundy) },
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
        modifier = Modifier.fillMaxWidth()
    )
}

@Composable
private fun PayoutTextButton(text: String, enabled: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        enabled = enabled,
        color = Color.Transparent,
        shape = RoundedCornerShape(999.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(
            text,
            color = if (enabled) Burgundy else Muted,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(vertical = 12.dp)
        )
    }
}

// ---- Labels -------------------------------------------------------------------

private fun iconFor(kind: PayoutMethodKind?): ImageVector = when (kind) {
    PayoutMethodKind.BANK_ACCOUNT -> Icons.Filled.AccountBalance
    PayoutMethodKind.INSTAPAY -> Icons.Filled.SwapHoriz
    PayoutMethodKind.WALLET -> Icons.Filled.AccountBalanceWallet
    null -> Icons.Filled.Payments
}

@Composable
private fun methodLabel(kind: PayoutMethodKind?): String = stringResource(
    when (kind) {
        PayoutMethodKind.BANK_ACCOUNT -> R.string.payout_method_bank_account
        PayoutMethodKind.INSTAPAY -> R.string.payout_method_instapay
        PayoutMethodKind.WALLET -> R.string.payout_method_wallet
        null -> R.string.payout_title
    }
)

@Composable
private fun walletProviderLabel(provider: WalletProviderKind): String = stringResource(
    when (provider) {
        WalletProviderKind.VODAFONE_CASH -> R.string.payout_wallet_vodafone_cash
        WalletProviderKind.ETISALAT_CASH -> R.string.payout_wallet_etisalat_cash
        WalletProviderKind.ORANGE_MONEY -> R.string.payout_wallet_orange_money
        WalletProviderKind.WE_PAY -> R.string.payout_wallet_we_pay
        WalletProviderKind.OTHER -> R.string.payout_wallet_other
    }
)
