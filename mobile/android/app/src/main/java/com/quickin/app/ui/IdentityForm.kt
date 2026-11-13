package com.quickin.app.ui

import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Badge
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.quickin.app.AuthViewModel
import com.quickin.app.CompleteIdentityUiState
import com.quickin.app.IdDocType
import com.quickin.app.PhoneRules
import com.quickin.app.R
import com.quickin.app.SignupIdentityRules
import com.quickin.app.SignupRoleRules
import com.quickin.app.SignupStep
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

private val IdentityErrorRed = Color(0xFFB3261E)

/**
 * What the identity form holds: phone, document type + number, and both ID photos. Shared by the
 * email sign-up form and the blocking "Complete your account" screen, which send the same five
 * fields. Saveable, so a config change or the Photo Picker round trip keeps what was entered.
 */
@Stable
class IdentityFormState internal constructor(
    phoneState: MutableState<String>,
    docTypeState: MutableState<String>,
    idNumberState: MutableState<String>,
    frontState: MutableState<Uri?>,
    backState: MutableState<Uri?>,
    phoneTouchedState: MutableState<Boolean>,
    idNumberTouchedState: MutableState<Boolean>
) {
    var phone by phoneState
    private var docTypeRaw by docTypeState
    var docType: IdDocType
        get() = IdDocType.from(docTypeRaw)
        set(value) { docTypeRaw = value.apiValue }
    var idNumber by idNumberState
    var front by frontState
    var back by backState
    var phoneTouched by phoneTouchedState
    var idNumberTouched by idNumberTouchedState

    /** Every field still unacceptable, keyed like the API's `fields`. */
    val problems: Map<String, SignupIdentityRules.Problem>
        get() = SignupIdentityRules.problems(phone, docType, idNumber, front != null, back != null)

    val isReady: Boolean get() = problems.isEmpty()
}

@Composable
fun rememberIdentityFormState(): IdentityFormState {
    val phone = rememberSaveable { mutableStateOf("") }
    val docType = rememberSaveable { mutableStateOf(IdDocType.NationalId.apiValue) }
    val idNumber = rememberSaveable { mutableStateOf("") }
    val front = rememberSaveable { mutableStateOf<Uri?>(null) }
    val back = rememberSaveable { mutableStateOf<Uri?>(null) }
    val phoneTouched = rememberSaveable { mutableStateOf(false) }
    val idTouched = rememberSaveable { mutableStateOf(false) }
    return remember { IdentityFormState(phone, docType, idNumber, front, back, phoneTouched, idTouched) }
}

/**
 * The identity fields: phone, which document, its number and a photo of each side. Local problems
 * are shown once a field has been left (never while it is still being typed); the server's per-field
 * refusals ([serverErrors], keyed like the API's `fields`) win over them and are dropped through
 * [onFieldEdited] as soon as the user changes that field.
 */
@Composable
fun IdentityFormFields(
    form: IdentityFormState,
    enabled: Boolean,
    serverErrors: Map<String, String>,
    onFieldEdited: (field: String) -> Unit,
    modifier: Modifier = Modifier
) {
    val pickFront = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) { form.front = uri; onFieldEdited(SignupIdentityRules.FIELD_ID_FRONT) }
    }
    val pickBack = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) { form.back = uri; onFieldEdited(SignupIdentityRules.FIELD_ID_BACK) }
    }
    val problems = form.problems

    val phoneError = serverErrors[SignupIdentityRules.FIELD_PHONE]
        ?: when (problems[SignupIdentityRules.FIELD_PHONE]) {
            SignupIdentityRules.Problem.PhoneInvalid ->
                if (form.phoneTouched) stringResource(R.string.identity_phone_invalid) else null
            SignupIdentityRules.Problem.PhoneMissing ->
                if (form.phoneTouched) stringResource(R.string.identity_phone_required) else null
            else -> null
        }
    val idNumberError = serverErrors[SignupIdentityRules.FIELD_ID_NUMBER]
        ?: if (form.idNumberTouched && problems.containsKey(SignupIdentityRules.FIELD_ID_NUMBER)) {
            stringResource(
                if (form.docType == IdDocType.NationalId) R.string.identity_id_number_national
                else R.string.identity_id_number_other
            )
        } else null

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            stringResource(R.string.identity_section_title),
            color = Ink,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold
        )
        Text(
            stringResource(R.string.identity_section_intro),
            color = Muted,
            fontSize = 13.sp,
            lineHeight = 18.sp
        )

        IdentityTextField(
            value = form.phone,
            onValueChange = {
                form.phone = PhoneRules.filterInput(it)
                if (form.phoneTouched) form.phoneTouched = false
                onFieldEdited(SignupIdentityRules.FIELD_PHONE)
            },
            label = stringResource(R.string.identity_phone),
            icon = Icons.Filled.Phone,
            enabled = enabled,
            keyboardType = KeyboardType.Phone,
            error = phoneError,
            onFocusLost = { form.phoneTouched = true }
        )

        Text(
            stringResource(R.string.host_apply_doc_type),
            color = Ink,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold
        )
        DocTypePicker(
            selected = form.docType,
            enabled = enabled,
            onSelected = {
                form.docType = it
                onFieldEdited(SignupIdentityRules.FIELD_DOC_TYPE)
                onFieldEdited(SignupIdentityRules.FIELD_ID_NUMBER)
            }
        )
        serverErrors[SignupIdentityRules.FIELD_DOC_TYPE]?.let { FieldErrorText(it) }

        IdentityTextField(
            value = form.idNumber,
            onValueChange = {
                // Arabic-Indic digits are digits; fold them so the number reads the same everywhere.
                form.idNumber = PhoneRules.toAsciiDigits(it).take(32)
                if (form.idNumberTouched) form.idNumberTouched = false
                onFieldEdited(SignupIdentityRules.FIELD_ID_NUMBER)
            },
            label = stringResource(R.string.identity_id_number),
            icon = Icons.Filled.Badge,
            enabled = enabled,
            keyboardType = if (form.docType == IdDocType.NationalId) KeyboardType.Number else KeyboardType.Ascii,
            capitalization = KeyboardCapitalization.Characters,
            error = idNumberError,
            onFocusLost = { form.idNumberTouched = true }
        )

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(modifier = Modifier.weight(1f)) {
                IdPhotoSlot(
                    label = stringResource(R.string.trust_front_photo),
                    uri = form.front,
                    enabled = enabled,
                    onPick = {
                        pickFront.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                    },
                    modifier = Modifier.fillMaxWidth()
                )
                serverErrors[SignupIdentityRules.FIELD_ID_FRONT]?.let { FieldErrorText(it) }
            }
            Column(modifier = Modifier.weight(1f)) {
                IdPhotoSlot(
                    label = stringResource(R.string.trust_back_photo),
                    uri = form.back,
                    enabled = enabled,
                    onPick = {
                        pickBack.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                    },
                    modifier = Modifier.fillMaxWidth()
                )
                serverErrors[SignupIdentityRules.FIELD_ID_BACK]?.let { FieldErrorText(it) }
            }
        }
    }
}

@Composable
private fun FieldErrorText(text: String) {
    Text(
        text,
        color = IdentityErrorRed,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        modifier = Modifier.padding(top = 4.dp)
    )
}

@Composable
private fun IdentityTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    icon: ImageVector,
    enabled: Boolean,
    keyboardType: KeyboardType,
    error: String?,
    onFocusLost: () -> Unit,
    capitalization: KeyboardCapitalization = KeyboardCapitalization.None
) {
    var wasFocused by remember { mutableStateOf(false) }
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = true,
        enabled = enabled,
        isError = error != null,
        supportingText = error?.let { { Text(it, color = IdentityErrorRed, fontSize = 12.sp, lineHeight = 16.sp) } },
        leadingIcon = { Icon(icon, contentDescription = null, tint = Burgundy) },
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType, capitalization = capitalization),
        shape = RoundedCornerShape(18.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Burgundy,
            unfocusedBorderColor = Tan,
            focusedLabelColor = Burgundy,
            cursorColor = Burgundy,
            focusedContainerColor = Color.White,
            unfocusedContainerColor = Color.White,
            errorBorderColor = IdentityErrorRed,
            errorLabelColor = IdentityErrorRed,
            errorContainerColor = Color.White
        ),
        modifier = Modifier
            .fillMaxWidth()
            .onFocusChanged { focus ->
                if (focus.isFocused) {
                    wasFocused = true
                } else if (wasFocused) {
                    wasFocused = false
                    onFocusLost()
                }
            }
    )
}

/**
 * The blocking "Complete your account" screen, for an account that owes its phone + ID (a first
 * Google sign-in arrives without them). There is no way back into the app from here — Back steps
 * back through the pages and, on the first one, leaves the app instead ([onExitApp]) — but signing
 * out always stays possible.
 *
 * The same role-aware steps as the email signup minus Account: Guest/Host cards (Guest
 * preselected) → Identity → (Refund, optional | Hosting → Payout). Everything is posted once at
 * the end through [AuthViewModel.submitCompleteAccount], which also adopts the host state the
 * response returns. [onSubmit] is the pre-role entry point, kept so existing callers compile; the
 * role-aware submit goes through [authViewModel] (the activity's instance, as MainActivity's).
 */
@Composable
fun CompleteAccountScreen(
    state: CompleteIdentityUiState,
    @Suppress("UNUSED_PARAMETER")
    onSubmit: (phone: String, docType: String, idNumber: String, front: Uri, back: Uri) -> Unit,
    onFieldEdited: (field: String) -> Unit,
    onSignOut: () -> Unit,
    onExitApp: () -> Unit,
    authViewModel: AuthViewModel = viewModel()
) {
    val form = rememberIdentityFormState()
    val flow = rememberSignupFlowState(includeAccount = false)
    BackHandler { if (!flow.goBack()) onExitApp() }
    val busy = state.isSubmitting

    // Every step's errors arrive together: when a submit ends refused, open the earliest page
    // that owns one of them.
    LaunchedEffect(busy) {
        if (!busy && flow.awaitingResult) {
            flow.awaitingResult = false
            if (state.fieldErrors.isNotEmpty()) flow.jumpToFirstError(state.fieldErrors.keys)
        }
    }

    val submit: (Boolean) -> Unit = { sendRefund ->
        val front = form.front
        val back = form.back
        if (front != null && back != null) {
            authViewModel.submitCompleteAccount(
                form.phone, form.docType.apiValue, form.idNumber, front, back,
                flow.roleBody(sendRefund)
            )
        } else {
            flow.awaitingResult = false
            flow.step = SignupStep.Identity
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CreamPage)
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 28.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text(
            stringResource(R.string.complete_account_title),
            color = Ink,
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold
        )
        if (flow.step == SignupStep.Role) {
            Text(
                stringResource(R.string.complete_account_intro),
                color = Muted,
                fontSize = 14.sp,
                lineHeight = 20.sp
            )
        }
        SignupStepHeader(flow)
        when (flow.step) {
            SignupStep.Role, SignupStep.Account -> SignupRoleCards(
                selected = flow.role,
                enabled = !busy,
                onSelect = { flow.role = it }
            )
            SignupStep.Identity -> {
                IdentityFormFields(
                    form = form,
                    enabled = !busy,
                    serverErrors = state.fieldErrors,
                    onFieldEdited = onFieldEdited
                )
                if (flow.attempted && !form.isReady) {
                    Text(stringResource(R.string.identity_required_hint), color = Muted, fontSize = 13.sp)
                }
            }
            SignupStep.Refund -> MoneyDestinationStep(
                intro = stringResource(R.string.signup_refund_intro),
                draft = flow.refund,
                onChange = { flow.refund = it; onFieldEdited(SignupRoleRules.FIELD_REFUND_METHOD) },
                enabled = !busy,
                showLocal = flow.attempted,
                serverError = state.fieldErrors[SignupRoleRules.FIELD_REFUND_METHOD]
            )
            SignupStep.Hosting -> HostingDetailsFields(
                draft = flow.hosting,
                onChange = { flow.hosting = it },
                enabled = !busy,
                showLocal = flow.attempted,
                serverErrors = state.fieldErrors,
                onFieldEdited = onFieldEdited
            )
            SignupStep.Payout -> MoneyDestinationStep(
                intro = stringResource(R.string.host_apply_payout_intro),
                draft = flow.payout,
                onChange = { flow.payout = it; onFieldEdited(SignupRoleRules.FIELD_PAYOUT) },
                enabled = !busy,
                showLocal = flow.attempted,
                serverError = state.fieldErrors[SignupRoleRules.FIELD_PAYOUT]
            )
        }
        if (state.error != null) {
            Text(state.error, color = IdentityErrorRed, fontSize = 13.sp)
        }
        Spacer(Modifier.height(4.dp))
        SignupNavButtons(
            showBack = flow.step != SignupStep.Role,
            primaryLabel = stringResource(
                if (flow.isLast) R.string.complete_account_submit else R.string.signup_next
            ),
            busy = busy,
            onBack = { flow.goBack() },
            onPrimary = {
                flow.onPrimary(
                    identity = form,
                    accountReady = true,
                    onAccountIncomplete = {},
                    submit = submit
                )
            },
            onSkip = if (SignupRoleRules.isSkippable(flow.step)) {
                { flow.awaitingResult = true; submit(false) }
            } else null
        )
        TextButton(
            onClick = onSignOut,
            enabled = !state.isSubmitting,
            colors = ButtonDefaults.textButtonColors(contentColor = Burgundy),
            modifier = Modifier.align(Alignment.CenterHorizontally)
        ) {
            Text(stringResource(R.string.profile_log_out), fontWeight = FontWeight.SemiBold)
        }
    }
}

/**
 * "Your ID was not approved" — the reviewer's [note] (when there is one) and a re-upload action.
 * Shown on the Profile tab and above the reserve panel while the account's ID is rejected, since a
 * rejected ID stops new bookings until a new one is uploaded.
 */
@Composable
fun IdentityRejectedNotice(
    note: String?,
    onReupload: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = IdentityErrorRed.copy(alpha = 0.07f),
        border = androidx.compose.foundation.BorderStroke(1.dp, IdentityErrorRed.copy(alpha = 0.35f)),
        modifier = modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Filled.WarningAmber,
                    contentDescription = null,
                    tint = IdentityErrorRed,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(Modifier.width(10.dp))
                Text(
                    stringResource(R.string.identity_rejected_title),
                    color = Ink,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp
                )
            }
            Text(
                if (note.isNullOrBlank()) stringResource(R.string.identity_rejected_body_no_reason)
                else stringResource(R.string.identity_rejected_body, note),
                color = Ink,
                fontSize = 14.sp,
                lineHeight = 20.sp,
                modifier = Modifier.padding(top = 8.dp)
            )
            TextButton(
                onClick = onReupload,
                colors = ButtonDefaults.textButtonColors(contentColor = Burgundy),
                modifier = Modifier.padding(top = 4.dp)
            ) {
                Text(stringResource(R.string.identity_reupload), fontWeight = FontWeight.SemiBold)
            }
        }
    }
}
