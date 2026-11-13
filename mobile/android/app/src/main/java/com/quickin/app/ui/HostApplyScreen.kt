package com.quickin.app.ui

import androidx.compose.foundation.background
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Badge
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import android.content.Intent
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import com.quickin.app.Config
import com.quickin.app.HostApplicationRules
import com.quickin.app.PayoutDraft
import com.quickin.app.HostApplyUiState
import com.quickin.app.HostType
import com.quickin.app.IdDocType
import com.quickin.app.IdentityRules
import com.quickin.app.NameRules
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

private val HostApplyErrorRed = Color(0xFFB3261E)

/** What the form hands back on submit — everything `POST /api/local/host/apply` takes. */
data class HostApplySubmission(
    /** Only the profile fields the profile is MISSING; the server takes the rest from the profile. */
    val profileValues: Map<String, String>,
    val address: String,
    val company: String?,
    val hostType: String,
    val notes: String?,
    val termsAccepted: Boolean,
    /** Null when a payout method is on file and the applicant keeps it. */
    val payout: PayoutDraft?,
    /** All three are null for an applicant whose documents are already on file. */
    val docType: String?,
    val idFront: Uri?,
    val idBack: Uri?
)

/**
 * "Apply to host" form (reached from the Profile tab's host card, for a first application or a
 * re-application after a rejection). A guest becomes a host on the SAME account, so the form never
 * re-asks what the profile already holds: `GET /api/local/host/application` ([onLoad]) returns the
 * name, phone and ID number on file — shown read-only under "From your profile" — and the list of
 * fields the profile is missing, which are the only profile inputs shown. The application adds the
 * host-only facts: host type, address, optional company/notes, a payout destination (reusing the
 * Profile tab's payout fields; the one on file is shown read-only), and acceptance of the host terms.
 * Rules live in [HostApplicationRules] (unit-tested).
 *
 * Submitting NEVER grants hosting: the application lands in the admin queue as "pending" and only
 * an approval flips `is_host`, so the profile card switches to the read-only "under review" state
 * once [HostApplyUiState.submitted] flips and [onSubmitted] closes this screen.
 *
 * Identity documents: asked for only when nothing usable is on file
 * ([IdentityRules.needsIdentityDocuments], the twin of the API's rule).
 *
 * Full-screen and vertically scrollable (never a bottom sheet — those have clipped before).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HostApplyScreen(
    state: HostApplyUiState,
    onBack: () -> Unit,
    onLoad: () -> Unit,
    onSubmit: (HostApplySubmission) -> Unit,
    /** Called once the application is on file, so the caller can close this screen. */
    onSubmitted: () -> Unit,
    accountName: String? = null,
    hostType: String? = null,
    /** The applicant's identity-verification status ("unverified" | "pending" | "verified" | "rejected"). */
    verificationStatus: String = "unverified",
    /** The national ID on that submission, when it carried one. */
    verifiedIdNumber: String? = null
) {
    LaunchedEffect(Unit) { onLoad() }

    val info = state.info
    val profile = info?.profile
    // Which profile fields get an input. Without a `profile` (older server, or the read failed)
    // this is all three — the pre-2026-11-13 form, which such a server still reads.
    val askedFields = HostApplicationRules.fieldsToAsk(profile)
    val onFile = HostApplicationRules.onFile(profile)

    // Seeds for the profile inputs, used only when that field is asked for.
    val idField = IdentityRules.nationalId(verificationStatus, verifiedIdNumber)
    var fullName by remember(profile) {
        mutableStateOf(profile?.fullName ?: accountName.orEmpty())
    }
    var nationalId by remember(idField, profile) { mutableStateOf(idField.value) }
    var phone by remember(profile) { mutableStateOf(profile?.phone.orEmpty()) }
    var address by remember { mutableStateOf("") }
    var company by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var selectedType by remember { mutableStateOf(HostType.from(hostType)) }
    var termsAccepted by remember { mutableStateOf(false) }

    // Payout: required unless one is on file; the on-file one is shown read-only and kept unless
    // the applicant chooses to replace it.
    val payoutOnFile = info?.payoutMethod
    var replacingPayout by remember(payoutOnFile) { mutableStateOf(false) }
    var payoutDraft by remember { mutableStateOf(initialPayoutDraft(null)) }
    val sendPayout = HostApplicationRules.sendPayout(payoutOnFile != null, replacingPayout)

    // The identity documents. The server's own status wins when it sent one.
    val identityStatus = profile?.verificationStatus ?: verificationStatus
    val needsId = IdentityRules.needsIdentityDocuments(identityStatus)
    var docType by remember { mutableStateOf(IdDocType.NationalId) }
    var idFront by remember { mutableStateOf<Uri?>(null) }
    var idBack by remember { mutableStateOf<Uri?>(null) }
    val pickFront = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri -> if (uri != null) idFront = uri }
    val pickBack = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri -> if (uri != null) idBack = uri }

    // The application is on file — hand control back so the profile can show "under review".
    LaunchedEffect(state.submitted) {
        if (state.submitted) onSubmitted()
    }

    val asksName = HostApplicationRules.FULL_NAME in askedFields
    val nameProblem = if (asksName) NameRules.problemWith(fullName) else null
    val showNameError = asksName && fullName.isNotBlank() && nameProblem != null

    val askedValues = mapOf(
        HostApplicationRules.FULL_NAME to fullName,
        HostApplicationRules.PHONE to phone,
        HostApplicationRules.NATIONAL_ID to nationalId
    ).filterKeys { it in askedFields }

    val ready = HostApplicationRules.canSubmit(
        HostApplicationRules.Readiness(
            askedValues = askedValues,
            askedFields = askedFields,
            nameOk = nameProblem == null,
            address = address,
            idDocumentsReady = !needsId || (idFront != null && idBack != null),
            payoutOnFile = payoutOnFile != null && !replacingPayout,
            payoutDraft = payoutDraft,
            termsAccepted = termsAccepted
        )
    )
    val busy = state.isSubmitting
    val errors = state.fieldErrors
    val context = LocalContext.current

    Scaffold(
        containerColor = CreamPage,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        stringResource(R.string.host_apply_title),
                        color = Ink,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.cd_back),
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
                .background(CreamPage)
        ) {
            if (!state.loaded && state.isLoading) {
                CircularProgressIndicator(color = Burgundy, modifier = Modifier.align(Alignment.Center))
                return@Box
            }
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .imePadding()
                    .padding(horizontal = 20.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    stringResource(R.string.host_apply_intro_v2),
                    color = Muted,
                    fontSize = 14.sp,
                    lineHeight = 20.sp
                )

                // ---- From your profile (read-only) ----
                if (onFile.isNotEmpty()) {
                    FromProfileCard(
                        rows = onFile,
                        errors = errors
                    )
                }

                // ---- Only what the profile is missing ----
                if (askedFields.isNotEmpty() && profile != null) {
                    Text(
                        stringResource(R.string.host_apply_profile_missing),
                        color = Muted,
                        fontSize = 14.sp,
                        lineHeight = 20.sp
                    )
                }
                if (asksName) {
                    HostApplyField(
                        value = fullName,
                        onValueChange = { fullName = it },
                        label = stringResource(R.string.host_apply_full_name),
                        icon = Icons.Filled.Person,
                        enabled = !busy,
                        isError = showNameError || errors.containsKey(HostApplicationRules.FULL_NAME),
                        errorText = when {
                            showNameError && nameProblem != null -> nameProblemMessage(nameProblem)
                            else -> errors[HostApplicationRules.FULL_NAME]
                        }
                    )
                }
                if (HostApplicationRules.NATIONAL_ID in askedFields) {
                    HostApplyField(
                        value = nationalId,
                        onValueChange = { nationalId = it },
                        label = stringResource(R.string.host_apply_national_id),
                        icon = Icons.Filled.Badge,
                        enabled = !busy && !idField.locked,
                        isError = errors.containsKey(HostApplicationRules.NATIONAL_ID),
                        errorText = errors[HostApplicationRules.NATIONAL_ID],
                        supportingText = if (idField.locked) {
                            stringResource(R.string.host_apply_national_id_locked)
                        } else {
                            null
                        }
                    )
                }
                if (HostApplicationRules.PHONE in askedFields) {
                    HostApplyField(
                        value = phone,
                        onValueChange = { phone = it },
                        label = stringResource(R.string.host_apply_phone),
                        icon = Icons.Filled.Phone,
                        enabled = !busy,
                        keyboardType = KeyboardType.Phone,
                        isError = errors.containsKey(HostApplicationRules.PHONE),
                        errorText = errors[HostApplicationRules.PHONE]
                    )
                }

                // ---- The application itself ----
                HostApplyField(
                    value = address,
                    onValueChange = { address = it },
                    label = stringResource(R.string.host_apply_address),
                    icon = Icons.Filled.LocationOn,
                    enabled = !busy,
                    isError = errors.containsKey(HostApplicationRules.ADDRESS),
                    errorText = errors[HostApplicationRules.ADDRESS]
                )
                HostApplyField(
                    value = company,
                    onValueChange = { company = it },
                    label = stringResource(R.string.host_apply_company),
                    icon = Icons.Filled.Business,
                    enabled = !busy
                )

                // Host type — the canonical apiValue ("individual"/"company"/"brokerage") is sent,
                // the label follows the app's locale.
                SectionTitle(stringResource(R.string.host_apply_host_type))
                HostTypePicker(
                    selected = selectedType,
                    enabled = !busy,
                    onSelected = { selectedType = it }
                )
                FieldErrorText(errors[HostApplicationRules.HOST_TYPE])

                // ---- Proof of identity ----
                SectionTitle(stringResource(R.string.host_apply_id_section))
                Text(
                    stringResource(
                        if (needsId) R.string.host_apply_id_intro else R.string.host_apply_id_on_file
                    ),
                    color = Muted,
                    fontSize = 14.sp,
                    lineHeight = 20.sp
                )
                if (needsId) {
                    SectionTitle(stringResource(R.string.host_apply_doc_type))
                    DocTypePicker(
                        selected = docType,
                        enabled = !busy,
                        onSelected = { docType = it }
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        IdPhotoSlot(
                            label = stringResource(R.string.trust_front_photo),
                            uri = idFront,
                            enabled = !busy,
                            onPick = {
                                pickFront.launch(
                                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                                )
                            },
                            modifier = Modifier.weight(1f)
                        )
                        IdPhotoSlot(
                            label = stringResource(R.string.trust_back_photo),
                            uri = idBack,
                            enabled = !busy,
                            onPick = {
                                pickBack.launch(
                                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                                )
                            },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
                FieldErrorText(
                    listOf("doc_type", "id_front", "id_back", "id_number")
                        .mapNotNull { errors[it] }
                        .distinct()
                        .joinToString("\n")
                        .ifBlank { null }
                )

                // ---- Payout destination ----
                SectionTitle(stringResource(R.string.host_apply_payout_section))
                if (payoutOnFile != null && !replacingPayout) {
                    Text(
                        stringResource(R.string.host_apply_payout_on_file),
                        color = Muted,
                        fontSize = 14.sp,
                        lineHeight = 20.sp
                    )
                    PayoutPreview(payoutOnFile)
                    HostApplyTextButton(
                        text = stringResource(R.string.host_apply_payout_replace),
                        enabled = !busy,
                        onClick = { replacingPayout = true }
                    )
                } else {
                    Text(
                        stringResource(R.string.host_apply_payout_intro),
                        color = Muted,
                        fontSize = 14.sp,
                        lineHeight = 20.sp
                    )
                    PayoutDraftFields(
                        draft = payoutDraft,
                        onChange = { payoutDraft = it },
                        enabled = !busy
                    )
                    if (payoutOnFile != null) {
                        HostApplyTextButton(
                            text = stringResource(R.string.host_apply_payout_keep),
                            enabled = !busy,
                            onClick = { replacingPayout = false }
                        )
                    }
                }
                FieldErrorText(errors[HostApplicationRules.PAYOUT])

                // Notes — free text for anything the reviewer should know (optional).
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text(stringResource(R.string.host_apply_notes)) },
                    minLines = 3,
                    enabled = !busy,
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

                // ---- Host terms (required) ----
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .toggleable(
                            value = termsAccepted,
                            enabled = !busy,
                            role = Role.Checkbox,
                            onValueChange = { termsAccepted = it }
                        )
                ) {
                    Checkbox(
                        checked = termsAccepted,
                        onCheckedChange = null,
                        enabled = !busy,
                        colors = CheckboxDefaults.colors(checkedColor = Burgundy, uncheckedColor = Muted)
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        stringResource(R.string.host_apply_terms_accept),
                        color = Ink,
                        fontSize = 14.sp,
                        lineHeight = 20.sp
                    )
                }
                HostApplyTextButton(
                    text = stringResource(R.string.host_apply_terms_link),
                    enabled = true,
                    onClick = {
                        runCatching {
                            context.startActivity(
                                Intent(
                                    Intent.ACTION_VIEW,
                                    Uri.parse(HostApplicationRules.termsUrl(Config.SHARE_WEB_BASE_URL))
                                )
                            )
                        }
                    }
                )
                FieldErrorText(
                    errors[HostApplicationRules.TERMS]?.let { stringResource(R.string.host_apply_terms_required) }
                )

                if (state.error != null) {
                    Text(
                        state.error.ifBlank { stringResource(R.string.host_apply_error) },
                        color = HostApplyErrorRed,
                        fontSize = 14.sp
                    )
                }

                Spacer(Modifier.height(4.dp))
                GradientButton(
                    onClick = {
                        onSubmit(
                            HostApplySubmission(
                                profileValues = askedValues,
                                address = address,
                                company = company.trim().ifBlank { null },
                                hostType = selectedType.apiValue,
                                notes = notes.trim().ifBlank { null },
                                termsAccepted = termsAccepted,
                                payout = if (sendPayout) payoutDraft else null,
                                // Omitted, not blanked, when the identity is already on file — the
                                // server takes their absence as "use the submission you already have".
                                docType = if (needsId) docType.apiValue else null,
                                idFront = if (needsId) idFront else null,
                                idBack = if (needsId) idBack else null
                            )
                        )
                    },
                    enabled = ready && !busy,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (busy) {
                        CircularProgressIndicator(
                            color = Color.White,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(22.dp)
                        )
                    } else {
                        Text(
                            stringResource(R.string.host_apply_submit),
                            color = Color.White,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp
                        )
                    }
                }

                if (!ready) {
                    Text(
                        stringResource(
                            if (needsId) R.string.host_apply_required_id else R.string.host_apply_required_v2
                        ),
                        color = Muted,
                        fontSize = 13.sp
                    )
                }

                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

/**
 * The read-only "From your profile" card: the name, phone and ID number the application files,
 * taken from the account. Edited from Profile, not here. A server error on one of them (e.g. a
 * name from before the name policy) is shown under its row.
 */
@Composable
private fun FromProfileCard(rows: List<Pair<String, String>>, errors: Map<String, String>) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White, RoundedCornerShape(18.dp))
            .border(1.dp, Tan, RoundedCornerShape(18.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text(
            stringResource(R.string.host_apply_from_profile),
            color = Ink,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold
        )
        rows.forEach { (field, value) ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    when (field) {
                        HostApplicationRules.PHONE -> Icons.Filled.Phone
                        HostApplicationRules.NATIONAL_ID -> Icons.Filled.Badge
                        else -> Icons.Filled.Person
                    },
                    contentDescription = null,
                    tint = Burgundy,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        stringResource(
                            when (field) {
                                HostApplicationRules.PHONE -> R.string.host_apply_phone
                                HostApplicationRules.NATIONAL_ID -> R.string.host_apply_national_id
                                else -> R.string.host_apply_full_name
                            }
                        ),
                        color = Muted,
                        fontSize = 12.sp
                    )
                    Text(value, color = Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                    errors[field]?.let {
                        Text(it, color = HostApplyErrorRed, fontSize = 12.sp, lineHeight = 16.sp)
                    }
                }
            }
        }
        Text(
            stringResource(R.string.host_apply_from_profile_hint),
            color = Muted,
            fontSize = 12.sp,
            lineHeight = 17.sp
        )
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(text, color = Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
}

/** A server field error under a section; renders nothing when there is none. */
@Composable
private fun FieldErrorText(text: String?) {
    if (text.isNullOrBlank()) return
    Text(text, color = HostApplyErrorRed, fontSize = 13.sp, lineHeight = 18.sp)
}

@Composable
private fun HostApplyTextButton(text: String, enabled: Boolean, onClick: () -> Unit) {
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
            modifier = Modifier.padding(vertical = 10.dp)
        )
    }
}

/** One labelled application field: a leading burgundy icon on a white rounded outlined field. */
@Composable
private fun HostApplyField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    icon: ImageVector,
    enabled: Boolean,
    keyboardType: KeyboardType = KeyboardType.Text,
    isError: Boolean = false,
    /** Shown under the field when [isError]; the reason, not just a red border. */
    errorText: String? = null,
    /** Shown under the field when there is nothing wrong — e.g. why it is read-only. */
    supportingText: String? = null
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = true,
        enabled = enabled,
        isError = isError,
        supportingText = (errorText ?: supportingText)?.let { text ->
            {
                Text(
                    text,
                    color = if (errorText != null) HostApplyErrorRed else Muted,
                    fontSize = 12.sp,
                    lineHeight = 16.sp
                )
            }
        },
        leadingIcon = { Icon(icon, contentDescription = null, tint = Burgundy) },
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        shape = RoundedCornerShape(18.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Burgundy,
            unfocusedBorderColor = Tan,
            focusedLabelColor = Burgundy,
            cursorColor = Burgundy,
            focusedContainerColor = Color.White,
            unfocusedContainerColor = Color.White,
            errorBorderColor = HostApplyErrorRed,
            errorLabelColor = HostApplyErrorRed,
            errorCursorColor = HostApplyErrorRed,
            errorContainerColor = Color.White
        ),
        modifier = Modifier.fillMaxWidth()
    )
}

/**
 * Single-select identity-document picker (National ID / Passport / Residence permit). Shares
 * [HostTypePicker]'s card styling — the reviewer checks the photo against whatever is chosen here,
 * which is why the API refuses an unknown value rather than assuming National ID.
 */
@Composable
internal fun DocTypePicker(
    selected: IdDocType,
    enabled: Boolean,
    onSelected: (IdDocType) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        IdDocType.entries.forEach { type ->
            val isSelected = type == selected
            Surface(
                onClick = { onSelected(type) },
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
                    Text(
                        stringResource(type.labelRes),
                        color = if (isSelected) Color.White else Ink,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

/**
 * Single-select host-type picker (individual / company / brokerage). Mirrors the add-listing
 * wizard's [CancellationPolicyPicker]: each option is a full-width card, the selected one filled
 * Burgundy. RTL-safe (rows lay out start→end).
 */
@Composable
private fun HostTypePicker(
    selected: HostType,
    enabled: Boolean,
    onSelected: (HostType) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        HostType.entries.forEach { type ->
            val isSelected = type == selected
            Surface(
                onClick = { onSelected(type) },
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
                    Text(
                        stringResource(type.labelRes),
                        color = if (isSelected) Color.White else Ink,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}
