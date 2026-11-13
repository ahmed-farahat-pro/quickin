package com.quickin.app.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Luggage
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.ButtonDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.Config
import com.quickin.app.HostApplicationRules
import com.quickin.app.HostType
import com.quickin.app.HostingDetailsDraft
import com.quickin.app.PayoutDraft
import com.quickin.app.PayoutMethodKind
import com.quickin.app.R
import com.quickin.app.SignupRole
import com.quickin.app.SignupRoleRules
import com.quickin.app.SignupStep
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

private val SignupErrorRed = Color(0xFFB3261E)

/**
 * What the stepped signup holds besides the account and identity fields (those keep their own
 * state holders): the role, the current page, the host's hosting page, and the two money
 * destinations. Saveable, so Back/Next, a rotation and the Photo Picker round trip keep it all.
 *
 * Shared by the email signup ([includeAccount] = true) and the Google "Complete your account"
 * screen ([includeAccount] = false, no Account step).
 */
@Stable
class SignupFlowState internal constructor(
    val includeAccount: Boolean,
    roleState: MutableState<String>,
    stepState: MutableState<String>,
    hostingState: MutableState<HostingDetailsDraft>,
    refundState: MutableState<PayoutDraft>,
    payoutState: MutableState<PayoutDraft>,
    attemptedState: MutableState<Boolean>,
    awaitingState: MutableState<Boolean>
) {
    private var roleRaw by roleState
    private var stepRaw by stepState
    var role: SignupRole
        get() = SignupRole.from(roleRaw)
        set(value) { roleRaw = value.apiValue }
    var step: SignupStep
        get() = SignupStep.entries.firstOrNull { it.name == stepRaw } ?: SignupStep.Role
        set(value) { stepRaw = value.name }
    var hosting by hostingState
    var refund by refundState
    var payout by payoutState
    /** Next was pressed on this page while it was incomplete — show its local problems. */
    var attempted by attemptedState
    /** A submit is in flight; when it ends with errors the flow jumps to the earliest one. */
    var awaitingResult by awaitingState

    val steps: List<SignupStep> get() = SignupRoleRules.steps(role, includeAccount)
    val stepNumber: Int? get() = SignupRoleRules.stepNumber(step, role, includeAccount)
    val isLast: Boolean get() = SignupRoleRules.isLast(step, role, includeAccount)

    fun goNext() {
        SignupRoleRules.next(step, role, includeAccount)?.let { step = it; attempted = false }
    }

    fun goBack(): Boolean {
        val prev = SignupRoleRules.previous(step, role, includeAccount) ?: return false
        step = prev
        attempted = false
        return true
    }

    /** After a refused submit: open the earliest page owning one of [fields]. */
    fun jumpToFirstError(fields: Collection<String>) {
        SignupRoleRules.firstStepWithError(fields, role, includeAccount)?.let { step = it }
    }

    fun reset() {
        step = SignupStep.Role
        attempted = false
        awaitingResult = false
    }

    /** The role half of the request body, built from what the pages hold. */
    fun roleBody(sendRefund: Boolean): Map<String, Any> = SignupRoleRules.roleBody(
        role = role,
        hosting = hosting,
        refund = refund.takeIf { sendRefund },
        payout = payout
    )
}

/**
 * Whether the current page may be left forward. The Account page is judged by the caller
 * ([accountReady]) — it owns those fields. A refund page left blank counts as a skip.
 */
internal fun SignupFlowState.currentStepReady(identity: IdentityFormState, accountReady: Boolean): Boolean =
    when (step) {
        SignupStep.Role -> true
        SignupStep.Account -> accountReady
        SignupStep.Identity -> identity.isReady
        SignupStep.Refund -> !SignupRoleRules.destinationTouched(refund) || SignupRoleRules.destinationComplete(refund)
        SignupStep.Hosting -> SignupRoleRules.hostingProblems(hosting).isEmpty()
        SignupStep.Payout -> SignupRoleRules.destinationComplete(payout)
    }

/**
 * Next / the final submit. An incomplete page stays put and shows its problems; a complete one
 * advances, or — on the last page — calls [submit] with whether a refund destination goes out.
 * [onAccountIncomplete] arms the Account page's own hints.
 */
internal fun SignupFlowState.onPrimary(
    identity: IdentityFormState,
    accountReady: Boolean,
    onAccountIncomplete: () -> Unit,
    submit: (sendRefund: Boolean) -> Unit
) {
    if (!currentStepReady(identity, accountReady)) {
        attempted = true
        when (step) {
            SignupStep.Account -> onAccountIncomplete()
            SignupStep.Identity -> { identity.phoneTouched = true; identity.idNumberTouched = true }
            else -> Unit
        }
        return
    }
    if (isLast) {
        awaitingResult = true
        submit(step == SignupStep.Refund && SignupRoleRules.destinationTouched(refund))
    } else {
        goNext()
    }
}

private val PayoutDraftSaver: Saver<PayoutDraft, Any> = listSaver(
    save = {
        listOf(
            it.method.key, it.accountName, it.bankName, it.iban, it.accountNumber,
            it.swiftBic, it.branch, it.instapayAddress
        )
    },
    restore = {
        PayoutDraft(
            method = PayoutMethodKind.fromKey(it[0])?.takeUnless { k -> k.isRetired } ?: PayoutMethodKind.BANK_ACCOUNT,
            accountName = it[1], bankName = it[2], iban = it[3], accountNumber = it[4],
            swiftBic = it[5], branch = it[6], instapayAddress = it[7]
        )
    }
)

private val HostingDraftSaver: Saver<HostingDetailsDraft, Any> = listSaver(
    save = { listOf(it.hostType.apiValue, it.address, it.company, it.notes, it.termsAccepted.toString()) },
    restore = {
        HostingDetailsDraft(
            hostType = HostType.from(it[0]),
            address = it[1], company = it[2], notes = it[3], termsAccepted = it[4] == "true"
        )
    }
)

@Composable
fun rememberSignupFlowState(includeAccount: Boolean): SignupFlowState {
    // Guest is preselected: Continue without touching the cards signs up a guest.
    val role = rememberSaveable { mutableStateOf(SignupRole.Guest.apiValue) }
    val step = rememberSaveable { mutableStateOf(SignupStep.Role.name) }
    val hosting = rememberSaveable(stateSaver = HostingDraftSaver) { mutableStateOf(HostingDetailsDraft()) }
    val refund = rememberSaveable(stateSaver = PayoutDraftSaver) { mutableStateOf(PayoutDraft()) }
    val payout = rememberSaveable(stateSaver = PayoutDraftSaver) { mutableStateOf(PayoutDraft()) }
    val attempted = rememberSaveable { mutableStateOf(false) }
    val awaiting = rememberSaveable { mutableStateOf(false) }
    return remember(includeAccount) {
        SignupFlowState(includeAccount, role, step, hosting, refund, payout, attempted, awaiting)
    }
}

// ---- Header -------------------------------------------------------------------------------------

@Composable
private fun stepTitle(step: SignupStep): String = stringResource(
    when (step) {
        SignupStep.Role -> R.string.signup_role_title
        SignupStep.Account -> R.string.signup_step_account
        SignupStep.Identity -> R.string.signup_step_identity
        SignupStep.Refund -> R.string.signup_step_refund
        SignupStep.Hosting -> R.string.signup_step_hosting
        SignupStep.Payout -> R.string.signup_step_payout
    }
)

/**
 * "Step 2 of 3" + a progress bar + the page's title. On the role screen only the title shows —
 * it is the unnumbered first screen.
 */
@Composable
fun SignupStepHeader(flow: SignupFlowState, modifier: Modifier = Modifier) {
    val number = flow.stepNumber
    val total = flow.steps.size
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (number != null) {
            Text(
                stringResource(R.string.signup_step_of, number, total),
                color = Muted,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
            LinearProgressIndicator(
                progress = { number.toFloat() / total },
                color = Burgundy,
                trackColor = Tan,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
            )
        }
        Text(
            stepTitle(flow.step),
            color = Ink,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(top = 4.dp)
        )
    }
}

// ---- Role cards ---------------------------------------------------------------------------------

/** The first screen: Guest and Host cards, Guest preselected. */
@Composable
fun SignupRoleCards(
    selected: SignupRole,
    enabled: Boolean,
    onSelect: (SignupRole) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            stringResource(R.string.signup_role_subtitle),
            color = Muted,
            fontSize = 14.sp,
            lineHeight = 20.sp
        )
        RoleCard(
            title = stringResource(R.string.signup_role_guest),
            body = stringResource(R.string.signup_role_guest_desc),
            icon = Icons.Filled.Luggage,
            selected = selected == SignupRole.Guest,
            enabled = enabled,
            onClick = { onSelect(SignupRole.Guest) }
        )
        RoleCard(
            title = stringResource(R.string.signup_role_host),
            body = stringResource(R.string.signup_role_host_desc),
            icon = Icons.Filled.Home,
            selected = selected == SignupRole.Host,
            enabled = enabled,
            onClick = { onSelect(SignupRole.Host) }
        )
    }
}

@Composable
private fun RoleCard(
    title: String,
    body: String,
    icon: ImageVector,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(18.dp),
        color = if (selected) Burgundy.copy(alpha = 0.06f) else Color.White,
        border = BorderStroke(if (selected) 2.dp else 1.dp, if (selected) Burgundy else Tan),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(16.dp)) {
            Icon(icon, contentDescription = null, tint = Burgundy, modifier = Modifier.size(28.dp))
            Spacer(Modifier.width(14.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(title, color = Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                Text(body, color = Muted, fontSize = 13.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 2.dp))
            }
            Spacer(Modifier.width(10.dp))
            Icon(
                if (selected) Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked,
                contentDescription = null,
                tint = if (selected) Burgundy else Muted,
                modifier = Modifier.size(22.dp)
            )
        }
    }
}

// ---- Hosting details ----------------------------------------------------------------------------

/**
 * The host-only page: host type, address, company (company/brokerage only), notes and the
 * required host-terms checkbox. Local problems show once Next was pressed ([showLocal]); the
 * server's per-field messages win and are dropped through [onFieldEdited] on edit.
 */
@Composable
fun HostingDetailsFields(
    draft: HostingDetailsDraft,
    onChange: (HostingDetailsDraft) -> Unit,
    enabled: Boolean,
    showLocal: Boolean,
    serverErrors: Map<String, String>,
    onFieldEdited: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val problems = SignupRoleRules.hostingProblems(draft)
    fun local(key: String): SignupRoleRules.HostingProblem? = if (showLocal) problems[key] else null

    val addressError = serverErrors[SignupRoleRules.FIELD_ADDRESS] ?: when (local(SignupRoleRules.FIELD_ADDRESS)) {
        SignupRoleRules.HostingProblem.AddressMissing -> stringResource(R.string.signup_address_required)
        SignupRoleRules.HostingProblem.AddressTooLong ->
            stringResource(R.string.signup_field_too_long, SignupRoleRules.MAX_ADDRESS_CHARS)
        else -> null
    }
    val companyError = serverErrors[SignupRoleRules.FIELD_COMPANY]
        ?: local(SignupRoleRules.FIELD_COMPANY)?.let {
            stringResource(R.string.signup_field_too_long, SignupRoleRules.MAX_COMPANY_CHARS)
        }
    val notesError = serverErrors[SignupRoleRules.FIELD_NOTES]
        ?: local(SignupRoleRules.FIELD_NOTES)?.let {
            stringResource(R.string.signup_field_too_long, SignupRoleRules.MAX_NOTES_CHARS)
        }
    val termsError = serverErrors[SignupRoleRules.FIELD_TERMS]
        ?: local(SignupRoleRules.FIELD_TERMS)?.let { stringResource(R.string.host_apply_terms_required) }

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            stringResource(R.string.host_apply_host_type),
            color = Ink,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold
        )
        HostType.entries.forEach { type ->
            val isSelected = type == draft.hostType
            Surface(
                onClick = {
                    onChange(draft.copy(hostType = type))
                    onFieldEdited(SignupRoleRules.FIELD_HOST_TYPE)
                },
                enabled = enabled,
                shape = RoundedCornerShape(16.dp),
                color = if (isSelected) Burgundy else Color.White,
                border = BorderStroke(1.dp, if (isSelected) Burgundy else Tan),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(14.dp)) {
                    Icon(
                        if (isSelected) Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked,
                        contentDescription = null,
                        tint = if (isSelected) Color.White else Muted,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(Modifier.width(12.dp))
                    Text(
                        stringResource(type.labelRes),
                        color = if (isSelected) Color.White else Ink,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
        serverErrors[SignupRoleRules.FIELD_HOST_TYPE]?.let { SignupErrorText(it) }

        SignupTextField(
            value = draft.address,
            onValueChange = {
                onChange(draft.copy(address = it))
                onFieldEdited(SignupRoleRules.FIELD_ADDRESS)
            },
            label = stringResource(R.string.host_apply_address),
            icon = Icons.Filled.LocationOn,
            enabled = enabled,
            error = addressError
        )
        if (SignupRoleRules.showsCompany(draft.hostType)) {
            SignupTextField(
                value = draft.company,
                onValueChange = {
                    onChange(draft.copy(company = it))
                    onFieldEdited(SignupRoleRules.FIELD_COMPANY)
                },
                label = stringResource(R.string.host_apply_company),
                icon = Icons.Filled.Business,
                enabled = enabled,
                error = companyError
            )
        }
        SignupTextField(
            value = draft.notes,
            onValueChange = {
                onChange(draft.copy(notes = it))
                onFieldEdited(SignupRoleRules.FIELD_NOTES)
            },
            label = stringResource(R.string.host_apply_notes),
            icon = null,
            enabled = enabled,
            error = notesError,
            singleLine = false
        )

        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .toggleable(
                    value = draft.termsAccepted,
                    enabled = enabled,
                    role = Role.Checkbox,
                    onValueChange = {
                        onChange(draft.copy(termsAccepted = it))
                        onFieldEdited(SignupRoleRules.FIELD_TERMS)
                    }
                )
        ) {
            Checkbox(
                checked = draft.termsAccepted,
                onCheckedChange = null,
                enabled = enabled,
                colors = CheckboxDefaults.colors(checkedColor = Burgundy, uncheckedColor = Muted)
            )
            Spacer(Modifier.width(8.dp))
            Text(stringResource(R.string.host_apply_terms_accept), color = Ink, fontSize = 14.sp, lineHeight = 20.sp)
        }
        TextButton(
            onClick = {
                runCatching {
                    context.startActivity(
                        Intent(Intent.ACTION_VIEW, Uri.parse(HostApplicationRules.termsUrl(Config.SHARE_WEB_BASE_URL)))
                    )
                }
            },
            colors = ButtonDefaults.textButtonColors(contentColor = Burgundy)
        ) {
            Text(stringResource(R.string.host_apply_terms_link), fontWeight = FontWeight.SemiBold)
        }
        termsError?.let { SignupErrorText(it) }
    }
}

// ---- Money destination (refund / payout) --------------------------------------------------------

/**
 * Bank account or InstaPay — the refund step (guest, optional) and the payout step (host,
 * required). The inputs are the Profile payout editor's own ([PayoutDraftFields]), so the signup
 * collects exactly what `PUT /api/local/host/payout-method` takes. The server's message for the
 * whole block ([serverError], key `payout` / `refund_method`) shows above the inputs.
 */
@Composable
fun MoneyDestinationStep(
    intro: String,
    draft: PayoutDraft,
    onChange: (PayoutDraft) -> Unit,
    enabled: Boolean,
    showLocal: Boolean,
    serverError: String?,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(intro, color = Muted, fontSize = 14.sp, lineHeight = 20.sp)
        val error = serverError ?: if (showLocal && !SignupRoleRules.destinationComplete(draft)) {
            stringResource(R.string.signup_destination_incomplete)
        } else null
        error?.let { SignupErrorText(it) }
        PayoutDraftFields(draft = draft, onChange = onChange, enabled = enabled)
    }
}

// ---- Navigation ---------------------------------------------------------------------------------

/**
 * Back / Next (or the final submit) plus an optional Skip. [busy] shows a spinner on the
 * primary button.
 */
@Composable
fun SignupNavButtons(
    showBack: Boolean,
    primaryLabel: String,
    busy: Boolean,
    onBack: () -> Unit,
    onPrimary: () -> Unit,
    onSkip: (() -> Unit)?,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (showBack) {
                OutlinedButton(
                    onClick = onBack,
                    enabled = !busy,
                    shape = RoundedCornerShape(18.dp),
                    border = BorderStroke(1.dp, Tan),
                    colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White, contentColor = Ink),
                    modifier = Modifier.height(54.dp)
                ) {
                    Text(stringResource(R.string.action_back), fontWeight = FontWeight.SemiBold)
                }
            }
            GradientButton(
                onClick = onPrimary,
                enabled = !busy,
                radius = 18.dp,
                modifier = Modifier.weight(1f)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    if (busy) {
                        CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                    } else {
                        Text(primaryLabel, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                    }
                }
            }
        }
        if (onSkip != null) {
            TextButton(
                onClick = onSkip,
                enabled = !busy,
                colors = ButtonDefaults.textButtonColors(contentColor = Burgundy),
                modifier = Modifier.align(Alignment.CenterHorizontally)
            ) {
                Text(stringResource(R.string.signup_skip), fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

// ---- Small pieces -------------------------------------------------------------------------------

@Composable
internal fun SignupErrorText(text: String) {
    Text(text, color = SignupErrorRed, fontSize = 12.sp, lineHeight = 16.sp)
}

@Composable
private fun SignupTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    icon: ImageVector?,
    enabled: Boolean,
    error: String?,
    singleLine: Boolean = true
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = singleLine,
        minLines = if (singleLine) 1 else 3,
        enabled = enabled,
        isError = error != null,
        supportingText = error?.let { { Text(it, color = SignupErrorRed, fontSize = 12.sp, lineHeight = 16.sp) } },
        leadingIcon = icon?.let { { Icon(it, contentDescription = null, tint = Burgundy) } },
        shape = RoundedCornerShape(18.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Burgundy,
            unfocusedBorderColor = Tan,
            focusedLabelColor = Burgundy,
            cursorColor = Burgundy,
            focusedContainerColor = Color.White,
            unfocusedContainerColor = Color.White,
            errorBorderColor = SignupErrorRed,
            errorLabelColor = SignupErrorRed,
            errorContainerColor = Color.White
        ),
        modifier = Modifier.fillMaxWidth()
    )
}
