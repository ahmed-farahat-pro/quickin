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
import com.quickin.app.HostApplyUiState
import com.quickin.app.HostType
import com.quickin.app.IdDocType
import com.quickin.app.IdentityRules
import com.quickin.app.R
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

private val HostApplyErrorRed = Color(0xFFB3261E)

/**
 * "Apply to host" form (reached from the Profile tab's host card, for a first application or a
 * re-application after a rejection). Collects the data the admin queue needs — full name, national
 * ID, phone, address, an optional company/brokerage, the host type, optional notes and a photo of
 * both sides of an identity document — and posts it to `POST /api/local/host/apply`.
 *
 * Submitting NEVER grants hosting: the application lands in the admin queue as "pending" and only
 * an approval flips `is_host`, so the profile card switches to the read-only "under review" state
 * once [HostApplyUiState.submitted] flips and [onSubmitted] closes this screen.
 *
 * [accountName] prefills the name field, [hostType] the picker (so a rejected applicant re-applies
 * with what they chose before). Styled to match the profile-settings fields; RTL-safe.
 *
 * Identity is verified ONCE and serves guest and host alike, so [verificationStatus] /
 * [verifiedIdNumber] carry any submission we already hold into this form: a verified applicant's
 * national ID is shown and locked rather than retyped, and their documents are not asked for at all
 * ([IdentityRules], the twin of the API's `nationalIdForApplication` and `needsIdentityDocuments`).
 *
 * Everyone else photographs their document HERE, as part of applying. A reviewer decides an
 * application by reading the declared name and national ID against that document, so the API
 * refuses an application carrying none — this form asks for exactly what it requires.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HostApplyScreen(
    state: HostApplyUiState,
    onBack: () -> Unit,
    onSubmit: (
        fullName: String,
        nationalId: String,
        phone: String,
        address: String,
        company: String?,
        hostType: String,
        notes: String?,
        /** All three are null for an applicant whose documents are already on file. */
        docType: String?,
        idFront: Uri?,
        idBack: Uri?
    ) -> Unit,
    /** Called once the application is on file, so the caller can close this screen. */
    onSubmitted: () -> Unit,
    accountName: String? = null,
    hostType: String? = null,
    /** The applicant's identity-verification status ("unverified" | "pending" | "verified" | "rejected"). */
    verificationStatus: String = "unverified",
    /** The national ID on that submission, when it carried one. */
    verifiedIdNumber: String? = null
) {
    // What the identity we already hold says this field should be. Recomputed if the verification
    // read lands after the screen opens; the applicant's own typing wins from then on, because it
    // is passed back in as the previous value.
    val idField = IdentityRules.nationalId(verificationStatus, verifiedIdNumber)
    var fullName by remember { mutableStateOf(accountName.orEmpty()) }
    var nationalId by remember(idField) { mutableStateOf(idField.value) }
    var phone by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var company by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var selectedType by remember { mutableStateOf(HostType.from(hostType)) }

    // The identity documents. Asked for only when there is nothing usable on file — the same rule
    // the API enforces, so the form never asks for a photo the server would ignore, nor omits one
    // it demands. The system Photo Picker needs no storage permission.
    val needsId = IdentityRules.needsIdentityDocuments(verificationStatus)
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

    // A name has to be a name, not just non-empty: an operator reads this against the ID photos,
    // and "12345" is not one. One letter in any script passes — Char.isLetter() covers Arabic as
    // readily as Latin — which is the rule the API applies too (name-policy.ts, and NameRules.swift
    // on iOS). Digits are fine alongside letters: Franco-Arabic spells real names with them
    // (Ma7moud, 3omar). The API's finer refusals (under two letters, over 60 characters) come back
    // as a message in the banner; this catches the one a guest actually hits.
    val nameHasLetters = fullName.any { it.isLetter() }
    // Only complain once they've typed something; an untouched field is not an error.
    val showNameError = fullName.isNotBlank() && !nameHasLetters

    // Everything the backend validates as required — the documents included — so the button stays
    // disabled until they're filled and an incomplete form never costs the user a round-trip.
    val idReady = !needsId || (idFront != null && idBack != null)
    val ready = fullName.isNotBlank() && nameHasLetters && nationalId.isNotBlank() &&
        phone.isNotBlank() && address.isNotBlank() && idReady

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
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    stringResource(R.string.host_apply_intro),
                    color = Muted,
                    fontSize = 14.sp,
                    lineHeight = 20.sp
                )

                HostApplyField(
                    value = fullName,
                    onValueChange = { fullName = it },
                    label = stringResource(R.string.host_apply_full_name),
                    icon = Icons.Filled.Person,
                    enabled = !state.isSubmitting,
                    isError = showNameError,
                    errorText = if (showNameError) {
                        stringResource(R.string.host_apply_error_full_name_letters)
                    } else {
                        null
                    }
                )
                HostApplyField(
                    value = nationalId,
                    onValueChange = { nationalId = it },
                    label = stringResource(R.string.host_apply_national_id),
                    icon = Icons.Filled.Badge,
                    // Locked, not removed: the value still travels with the request, and the
                    // field is still read out by TalkBack.
                    enabled = !state.isSubmitting && !idField.locked,
                    supportingText = if (idField.locked) {
                        stringResource(R.string.host_apply_national_id_locked)
                    } else {
                        null
                    }
                )
                HostApplyField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = stringResource(R.string.host_apply_phone),
                    icon = Icons.Filled.Phone,
                    enabled = !state.isSubmitting,
                    keyboardType = KeyboardType.Phone
                )
                HostApplyField(
                    value = address,
                    onValueChange = { address = it },
                    label = stringResource(R.string.host_apply_address),
                    icon = Icons.Filled.LocationOn,
                    enabled = !state.isSubmitting
                )
                HostApplyField(
                    value = company,
                    onValueChange = { company = it },
                    label = stringResource(R.string.host_apply_company),
                    icon = Icons.Filled.Business,
                    enabled = !state.isSubmitting
                )

                // Host type — the canonical apiValue ("individual"/"company"/"brokerage") is sent,
                // the label follows the app's locale.
                Text(
                    stringResource(R.string.host_apply_host_type),
                    color = Ink,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold
                )
                HostTypePicker(
                    selected = selectedType,
                    enabled = !state.isSubmitting,
                    onSelected = { selectedType = it }
                )

                // Proof of identity. Shown as a settled fact for an applicant we already hold
                // documents for — they verified once from the Profile tab, and the server links
                // this application to that submission rather than asking for the same photos.
                Text(
                    stringResource(R.string.host_apply_id_section),
                    color = Ink,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    stringResource(
                        if (needsId) R.string.host_apply_id_intro else R.string.host_apply_id_on_file
                    ),
                    color = Muted,
                    fontSize = 14.sp,
                    lineHeight = 20.sp
                )
                if (needsId) {
                    Text(
                        stringResource(R.string.host_apply_doc_type),
                        color = Ink,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    DocTypePicker(
                        selected = docType,
                        enabled = !state.isSubmitting,
                        onSelected = { docType = it }
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        IdPhotoSlot(
                            label = stringResource(R.string.trust_front_photo),
                            uri = idFront,
                            enabled = !state.isSubmitting,
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
                            enabled = !state.isSubmitting,
                            onPick = {
                                pickBack.launch(
                                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                                )
                            },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }

                // Notes — free text for anything the reviewer should know (optional).
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text(stringResource(R.string.host_apply_notes)) },
                    minLines = 3,
                    enabled = !state.isSubmitting,
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
                            fullName,
                            nationalId,
                            phone,
                            address,
                            company.trim().ifBlank { null },
                            selectedType.apiValue,
                            notes.trim().ifBlank { null },
                            // Omitted, not blanked, when the identity is already on file — the
                            // server takes their absence as "use the submission you already have".
                            if (needsId) docType.apiValue else null,
                            if (needsId) idFront else null,
                            if (needsId) idBack else null
                        )
                    },
                    enabled = ready && !state.isSubmitting,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (state.isSubmitting) {
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
                            if (needsId) R.string.host_apply_required_id else R.string.host_apply_required
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
private fun DocTypePicker(
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
