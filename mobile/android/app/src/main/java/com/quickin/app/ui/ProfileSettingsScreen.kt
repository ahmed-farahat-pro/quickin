package com.quickin.app.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Notes
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Autorenew
import androidx.compose.material.icons.filled.Badge
import androidx.compose.material.icons.filled.Cake
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.AvatarImage
import com.quickin.app.IdChangeState
import com.quickin.app.IdDocumentType
import com.quickin.app.NameRules
import com.quickin.app.ProfileSettingsUiState
import com.quickin.app.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

private val SettingsErrorRed = Color(0xFFB3261E)
private val SettingsSuccessGreen = Color(0xFF2E7D32)

/**
 * Profile-settings screen (reached from the Profile tab's "Edit profile" entry). Loads the
 * signed-in user's profile via `GET /api/local/profile` and edits full name / age / phone / bio,
 * saving via `PATCH /api/local/profile`. Styled to match the host wizard fields.
 *
 * The ID / passport number is SHOWN here but not edited. It used to be an ordinary text field,
 * which meant any account could rewrite its own identity number at will with nobody reviewing it.
 * Changing it now means filing a request with a photo of the document, which an operator approves
 * — see [IdChangeRequestSheet] and `ProfileService.requestIdChange`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileSettingsScreen(
    state: ProfileSettingsUiState,
    onBack: () -> Unit,
    onLoad: () -> Unit,
    onSave: (fullName: String, age: String, phone: String, bio: String, avatarUrl: String?) -> Unit,
    onSavedAck: () -> Unit,
    onChangePassword: (currentPassword: String, newPassword: String) -> Unit,
    onPasswordChangedAck: () -> Unit,
    /** Files a request to change the ID number: value, doc type, front data URL, optional back, reason. */
    onRequestIdChange: (
        requestedValue: String,
        docType: String,
        front: String,
        back: String?,
        reason: String
    ) -> Unit = { _, _, _, _, _ -> },
    /** Withdraws a request that is still awaiting review. */
    onCancelIdChange: () -> Unit = {},
    /** Clears the ID section's inline error once it has been shown. */
    onClearIdChangeError: () -> Unit = {}
) {
    // Always reload when the screen opens so edits are always fresh.
    LaunchedEffect(Unit) {
        onLoad()
    }

    // Editable fields, seeded from the loaded profile. Re-seed whenever a fresh profile arrives
    // (initial load or a successful save returning the canonical row).
    var fullName by remember(state.profile) { mutableStateOf(state.profile.fullName) }
    var age by remember(state.profile) { mutableStateOf(state.profile.age?.toString() ?: "") }
    var phone by remember(state.profile) { mutableStateOf(state.profile.phone) }
    var bio by remember(state.profile) { mutableStateOf(state.profile.bio) }
    // Avatar source to save: starts as the loaded avatar_url; replaced with a data URL when a new
    // photo is picked, or set to null when removed. Re-seeded whenever a fresh profile arrives.
    var avatarUrl by remember(state.profile) { mutableStateOf(state.profile.avatarUrl) }

    // Set the first time Save is pressed, so a name that was never touched but is still unusable
    // is explained rather than silently refused. Until then the hint waits for an actual edit —
    // an account created before the name rule existed may already hold a name that fails it.
    var didAttemptSave by remember(state.profile) { mutableStateOf(false) }
    // The name rule, checked here as well as on the server (see NameRules / name-policy.ts). This
    // field used to ask only that the string be non-empty, so `12345` went through and came back
    // as a 400 the user read at the bottom of a scrolling form, in the server's English.
    val nameError = nameFieldError(fullName, didAttemptSave || fullName != state.profile.fullName)

    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var processingPhoto by remember { mutableStateOf(false) }

    /** Presents the ID-change request sheet — the only way to alter the ID number. */
    var showIdChangeSheet by remember { mutableStateOf(false) }

    // Photo picker: load the picked image, downscale + JPEG-compress to a small data URL off the
    // main thread, then stage it as the avatar (saved with the rest of the profile).
    val photoPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) {
            processingPhoto = true
            scope.launch {
                val dataUrl = withContext(Dispatchers.IO) {
                    AvatarImage.loadDownscaledJpegDataUrl(context, uri)
                }
                if (dataUrl != null) avatarUrl = dataUrl
                processingPhoto = false
            }
        }
    }

    Scaffold(
        containerColor = CreamPage,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.profile_edit_profile), color = Ink, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.cd_back), tint = Ink)
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
            when {
                state.isLoading && !state.loaded -> Column(
                    modifier = Modifier.fillMaxSize(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    CircularProgressIndicator(color = Burgundy)
                    Text(stringResource(R.string.settings_loading), color = Muted, modifier = Modifier.padding(top = 12.dp))
                }

                else -> Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 20.dp, vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    // Avatar picker: current photo (or initials) + Change/Add and Remove actions.
                    AvatarPicker(
                        avatarUrl = avatarUrl,
                        initials = initialsForAvatar(fullName, state.profile.email),
                        processing = processingPhoto,
                        onPick = {
                            photoPicker.launch(
                                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                            )
                        },
                        onRemove = { avatarUrl = null }
                    )

                    if (state.profile.email.isNotBlank()) {
                        Text(
                            state.profile.email,
                            color = Muted,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    SettingsField(
                        fullName,
                        { fullName = it },
                        stringResource(R.string.settings_full_name),
                        Icons.Filled.Person,
                        isError = nameError != null
                    )
                    if (nameError != null) {
                        Text(nameError, color = SettingsErrorRed, fontSize = 13.sp)
                    }
                    SettingsField(
                        age,
                        { input -> age = input.filter { it.isDigit() }.take(3) },
                        stringResource(R.string.settings_age),
                        Icons.Filled.Cake,
                        keyboardType = KeyboardType.Number
                    )
                    IdDocumentRow(
                        // The id-change fetch is the fresher source once it lands; before that
                        // the profile row is all there is.
                        current = state.idChange?.current?.takeIf { it.isNotBlank() }
                            ?: state.profile.idDocument,
                        idChange = state.idChange,
                        busy = state.isIdChangeBusy,
                        onRequest = { showIdChangeSheet = true },
                        onWithdraw = onCancelIdChange
                    )
                    SettingsField(
                        phone,
                        { phone = it },
                        stringResource(R.string.settings_phone),
                        Icons.Filled.Phone,
                        keyboardType = KeyboardType.Phone
                    )
                    BioField(value = bio, onValueChange = { bio = it })

                    if (state.error != null) {
                        Text(state.error, color = SettingsErrorRed, fontSize = 14.sp)
                    }
                    if (state.saved) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Filled.CheckCircle,
                                contentDescription = null,
                                tint = SettingsSuccessGreen,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(Modifier.size(6.dp))
                            Text(stringResource(R.string.settings_profile_saved), color = SettingsSuccessGreen, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        }
                    }

                    // The name is refused beside the button as well as under the field: the field is
                    // at the top of a scrolling form and Save is at the bottom, so a button whose
                    // only effect is a hint the user cannot see reads as a button that does nothing.
                    if (didAttemptSave && nameError != null) {
                        Text(nameError, color = SettingsErrorRed, fontSize = 14.sp)
                    }

                    Spacer(Modifier.height(4.dp))
                    GradientButton(
                        onClick = {
                            didAttemptSave = true
                            if (NameRules.problemWith(fullName) != null) return@GradientButton
                            onSavedAck()
                            // Normalized the way the server normalizes it, so the name that is
                            // stored is the name that was judged.
                            onSave(NameRules.normalized(fullName), age, phone, bio, avatarUrl)
                        },
                        enabled = !state.isSaving,
                        pulse = !state.isSaving,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (state.isSaving) {
                            CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                        } else {
                            Text(stringResource(R.string.settings_save_changes), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                        }
                    }

                    Text(
                        stringResource(R.string.settings_phone_private),
                        color = Muted,
                        fontSize = 13.sp,
                        textAlign = TextAlign.Start
                    )

                    Spacer(Modifier.height(8.dp))
                    HorizontalDivider(color = Tan)
                    Spacer(Modifier.height(8.dp))

                    ChangePasswordSection(
                        state = state,
                        onChangePassword = onChangePassword,
                        onPasswordChangedAck = onPasswordChangedAck
                    )
                }
            }
        }
    }

    if (showIdChangeSheet) {
        IdChangeRequestSheet(
            current = state.idChange?.current?.takeIf { it.isNotBlank() } ?: state.profile.idDocument,
            busy = state.isIdChangeBusy,
            error = state.idChangeError,
            onDismiss = {
                showIdChangeSheet = false
                onClearIdChangeError()
            },
            onSubmit = { value, docType, front, back, reason ->
                onRequestIdChange(value, docType, front, back, reason)
            }
        )

        // Closed on SUCCESS, not on submit. The server is what validates the number
        // ("A national ID number is 14 digits"), so dismissing the moment the button is
        // tapped would throw that message away and leave the user with a form that
        // silently did nothing. A filed request is the one unambiguous success signal:
        // canRequest goes false because one is now waiting.
        LaunchedEffect(state.idChange?.canRequest) {
            if (state.idChange?.canRequest == false) showIdChangeSheet = false
        }
    }
}

/**
 * "Change password" block on the profile-settings screen. Current + new + confirm password fields
 * (all with the AuthScreen eye-toggle), an "Update password" button (POST
 * /api/local/change-password), an inline server error on 400, and a green confirmation on success —
 * after which the fields clear. The new password is asked for twice because a typo in it would lock
 * the account out silently; the button stays disabled until both entries agree.
 */
@Composable
private fun ChangePasswordSection(
    state: ProfileSettingsUiState,
    onChangePassword: (currentPassword: String, newPassword: String) -> Unit,
    onPasswordChangedAck: () -> Unit
) {
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }

    // An empty confirmation is not yet a wrong answer — the hint waits until something is typed.
    val passwordsMismatch = confirmPassword.isNotEmpty() && confirmPassword != newPassword

    // On a successful change, clear the entered passwords. The "Password updated" note stays put
    // (it's only acked when the user starts another change, mirroring the profile-save flow below).
    LaunchedEffect(state.passwordChanged) {
        if (state.passwordChanged) {
            currentPassword = ""
            newPassword = ""
            confirmPassword = ""
        }
    }

    SectionHeader(
        title = stringResource(R.string.settings_change_password),
        caption = stringResource(R.string.settings_password_caption)
    )
    Spacer(Modifier.height(14.dp))

    PasswordField(
        value = currentPassword,
        onValueChange = { currentPassword = it },
        label = stringResource(R.string.settings_current_password),
        enabled = !state.isChangingPassword
    )
    Spacer(Modifier.height(14.dp))
    PasswordField(
        value = newPassword,
        onValueChange = { newPassword = it },
        label = stringResource(R.string.settings_new_password),
        enabled = !state.isChangingPassword
    )
    Spacer(Modifier.height(12.dp))
    PasswordStrength(password = newPassword)

    Spacer(Modifier.height(14.dp))
    PasswordField(
        value = confirmPassword,
        onValueChange = { confirmPassword = it },
        label = stringResource(R.string.settings_confirm_password),
        enabled = !state.isChangingPassword,
        isError = passwordsMismatch
    )
    if (passwordsMismatch) {
        Spacer(Modifier.height(6.dp))
        Text(stringResource(R.string.password_mismatch), color = SettingsErrorRed, fontSize = 13.sp)
    }

    if (state.passwordError != null) {
        Spacer(Modifier.height(10.dp))
        Text(state.passwordError, color = SettingsErrorRed, fontSize = 14.sp)
    }
    if (state.passwordChanged) {
        Spacer(Modifier.height(10.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                Icons.Filled.CheckCircle,
                contentDescription = null,
                tint = SettingsSuccessGreen,
                modifier = Modifier.size(18.dp)
            )
            Spacer(Modifier.size(6.dp))
            Text(stringResource(R.string.settings_password_updated), color = SettingsSuccessGreen, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
        }
    }

    Spacer(Modifier.height(14.dp))
    GradientButton(
        onClick = {
            onPasswordChangedAck()
            onChangePassword(currentPassword, newPassword)
        },
        enabled = !state.isChangingPassword &&
            currentPassword.isNotBlank() && passwordMeetsMin(newPassword) &&
            confirmPassword == newPassword,
        modifier = Modifier.fillMaxWidth()
    ) {
        if (state.isChangingPassword) {
            CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
        } else {
            Text(stringResource(R.string.settings_update_password), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        }
    }
}

/** A password field matching [SettingsField] styling, with an independent reveal toggle. */
@Composable
private fun PasswordField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    enabled: Boolean,
    isError: Boolean = false
) {
    var visible by remember { mutableStateOf(false) }
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        enabled = enabled,
        isError = isError,
        singleLine = true,
        leadingIcon = { Icon(Icons.Filled.Lock, contentDescription = null, tint = Burgundy) },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
        visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
        trailingIcon = {
            IconButton(onClick = { visible = !visible }) {
                Icon(
                    imageVector = if (visible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                    contentDescription = stringResource(if (visible) R.string.auth_hide_password else R.string.auth_show_password),
                    tint = Muted
                )
            }
        },
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

/**
 * The ID / passport number — SHOWN, never edited here.
 *
 * This was an ordinary [SettingsField] until it became clear that meant any account could rewrite
 * its own identity number at will, reviewed by nobody. It now reads as a value with its status
 * underneath, and the only way to change it is a request an operator decides on. Deliberately not
 * styled as a disabled text field: it is a fact about the account, not a field the user is being
 * stopped from typing into.
 */
@Composable
private fun IdDocumentRow(
    current: String,
    idChange: IdChangeState?,
    busy: Boolean,
    onRequest: () -> Unit,
    onWithdraw: () -> Unit
) {
    // Null state means the request fetch has not landed; treat it as "you may ask", which is
    // true for everyone who has no request waiting — the server refuses a second one anyway.
    val waiting = idChange?.canRequest == false
    val request = idChange?.request

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.Badge, contentDescription = null, tint = Burgundy, modifier = Modifier.size(18.dp))
            Spacer(Modifier.size(8.dp))
            Text(
                stringResource(R.string.settings_id_passport),
                color = Muted,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
        Spacer(Modifier.height(6.dp))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(18.dp))
                .background(Tan.copy(alpha = 0.35f))
                .padding(horizontal = 16.dp, vertical = 14.dp)
        ) {
            Text(
                text = current.ifBlank { stringResource(R.string.settings_id_none) },
                color = if (current.isBlank()) Muted else Ink,
                fontSize = 15.sp,
                fontWeight = if (current.isBlank()) FontWeight.Normal else FontWeight.SemiBold,
                modifier = Modifier.weight(1f)
            )
            if (waiting) {
                // A capsule, not loose text: the wait is a badge on the value, matching iOS.
                Text(
                    stringResource(R.string.id_change_status_pending),
                    color = Burgundy,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(Tan.copy(alpha = 0.6f))
                        .padding(horizontal = 10.dp, vertical = 5.dp)
                )
            }
        }

        // A rejection is only useful if the reason travels with it — otherwise the user
        // resubmits the same thing and is refused again.
        if (request != null && request.status == "rejected" && request.notes.isNotBlank()) {
            Spacer(Modifier.height(6.dp))
            Text(
                stringResource(R.string.id_change_rejected_reason, request.notes),
                color = Burgundy,
                fontSize = 12.sp
            )
        }

        Spacer(Modifier.height(6.dp))
        if (waiting && request != null) {
            Text(
                stringResource(R.string.id_change_pending_detail, request.requestedValue),
                color = Muted,
                fontSize = 12.sp
            )
            TextButton(onClick = onWithdraw, enabled = !busy) {
                Text(stringResource(R.string.id_change_withdraw), color = Burgundy, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            }
        } else {
            TextButton(onClick = onRequest, enabled = !busy) {
                Icon(
                    Icons.Filled.Autorenew,
                    contentDescription = null,
                    tint = Burgundy,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(Modifier.size(6.dp))
                Text(stringResource(R.string.id_change_request), color = Burgundy, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            }
            Text(stringResource(R.string.id_change_explainer), color = Muted, fontSize = 12.sp)
        }
    }
}

/**
 * The request form: which document, the new number, a photo of it, and an optional reason.
 *
 * A bottom sheet rather than an alert, matching the sheet iOS presents (and the report
 * sheet elsewhere in this app): the form carries two photo tiles and four fields, which an alert's
 * squeezed width turned into a scrolling column of anonymous text buttons.
 *
 * The front photo is required and the submit button stays disabled without it — the server
 * refuses the request anyway, because a reviewer with no document has nothing to check the typed
 * number against. The number itself is NOT validated here: those rules live in one shared core
 * the API and the admin console both read, so the server's 400 carries the wording to show.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun IdChangeRequestSheet(
    current: String,
    busy: Boolean,
    error: String?,
    onDismiss: () -> Unit,
    onSubmit: (requestedValue: String, docType: String, front: String, back: String?, reason: String) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    var docType by remember { mutableStateOf(IdDocumentType.NATIONAL_ID) }
    var newNumber by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("") }
    var frontDataUrl by remember { mutableStateOf<String?>(null) }
    var backDataUrl by remember { mutableStateOf<String?>(null) }
    // The picked Uri is kept beside the encoded data URL purely so the tile can show a thumbnail —
    // seeing the photo is how you catch a blurry or wrong-side shot before an operator does.
    var frontUri by remember { mutableStateOf<android.net.Uri?>(null) }
    var backUri by remember { mutableStateOf<android.net.Uri?>(null) }
    var pickingFront by remember { mutableStateOf(true) }
    var processing by remember { mutableStateOf(false) }

    val docPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) {
            processing = true
            val wantFront = pickingFront
            scope.launch {
                // 1280px, not the avatar default: a document number has to stay legible to
                // the person reviewing it.
                val dataUrl = withContext(Dispatchers.IO) {
                    AvatarImage.loadDownscaledJpegDataUrl(context, uri, maxDim = 1280)
                }
                if (dataUrl != null) {
                    if (wantFront) {
                        frontDataUrl = dataUrl
                        frontUri = uri
                    } else {
                        backDataUrl = dataUrl
                        backUri = uri
                    }
                }
                processing = false
            }
        }
    }

    val canSubmit = frontDataUrl != null && newNumber.isNotBlank() && !busy && !processing

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = CreamPage
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                stringResource(R.string.id_change_title),
                color = Ink,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp
            )
            Text(stringResource(R.string.id_change_intro), color = Muted, fontSize = 14.sp)
            if (current.isNotBlank()) {
                Text(stringResource(R.string.id_change_current, current), color = Muted, fontSize = 12.sp)
            }

            FieldLabel(stringResource(R.string.id_change_doc_type))
            // Fixed height: "Residence permit" wraps to two lines in French and Arabic as well as
            // English, and a segment that grows on its own leaves the row visibly stepped.
            SingleChoiceSegmentedButtonRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
            ) {
                IdDocumentType.entries.forEachIndexed { index, type ->
                    SegmentedButton(
                        selected = docType == type,
                        onClick = { docType = type },
                        shape = SegmentedButtonDefaults.itemShape(index, IdDocumentType.entries.size),
                        colors = SegmentedButtonDefaults.colors(
                            activeContainerColor = Burgundy,
                            activeContentColor = Color.White,
                            activeBorderColor = Burgundy,
                            inactiveContainerColor = Color.White,
                            inactiveContentColor = Muted,
                            inactiveBorderColor = Tan
                        ),
                        icon = {}
                    ) {
                        Text(
                            stringResource(type.labelRes),
                            fontSize = 12.sp,
                            lineHeight = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            textAlign = TextAlign.Center,
                            maxLines = 2
                        )
                    }
                }
            }

            SettingsField(
                value = newNumber,
                onValueChange = { input ->
                    // A national ID is digits; the other two are alphanumeric.
                    newNumber = if (docType == IdDocumentType.NATIONAL_ID) {
                        input.filter { it.isDigit() }.take(14)
                    } else {
                        input.take(24)
                    }
                },
                label = stringResource(R.string.id_change_new_number),
                icon = Icons.Filled.Badge,
                keyboardType = if (docType == IdDocumentType.NATIONAL_ID) KeyboardType.Number else KeyboardType.Text
            )

            FieldLabel(stringResource(R.string.id_change_photos))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                // The same tile the verification card uses, so an ID is asked for the same way
                // wherever the app asks for one.
                IdPhotoSlot(
                    label = stringResource(R.string.id_change_front),
                    uri = frontUri,
                    enabled = !processing && !busy,
                    onPick = {
                        pickingFront = true
                        docPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                    },
                    modifier = Modifier.weight(1f)
                )
                IdPhotoSlot(
                    label = stringResource(R.string.id_change_back),
                    uri = backUri,
                    enabled = !processing && !busy,
                    onPick = {
                        pickingFront = false
                        docPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                    },
                    modifier = Modifier.weight(1f)
                )
            }
            Text(stringResource(R.string.id_change_photos_hint), color = Muted, fontSize = 12.sp)

            BioFieldLike(
                value = reason,
                onValueChange = { reason = it },
                label = stringResource(R.string.id_change_reason),
                hint = stringResource(R.string.id_change_reason_hint)
            )

            if (error != null) {
                Text(error, color = SettingsErrorRed, fontSize = 13.sp)
            }

            GradientButton(
                onClick = { frontDataUrl?.let { onSubmit(newNumber, docType.key, it, backDataUrl, reason) } },
                enabled = canSubmit,
                radius = 18.dp,
                height = 52.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (busy || processing) {
                    CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                } else {
                    Icon(
                        Icons.AutoMirrored.Filled.Send,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(Modifier.size(8.dp))
                    Text(
                        stringResource(R.string.id_change_submit),
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp
                    )
                }
            }
            TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.action_cancel), color = Muted, fontSize = 14.sp)
            }
        }
    }
}

/** The small caption above a field or group, matching the iOS form's section labels. */
@Composable
private fun FieldLabel(text: String) {
    Text(text, color = Muted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
}

/** A multiline field with a caller-supplied label — [BioField] with the copy passed in. */
@Composable
private fun BioFieldLike(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    hint: String
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        placeholder = { Text(hint, color = Muted) },
        singleLine = false,
        minLines = 2,
        maxLines = 4,
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
private fun SettingsField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    icon: ImageVector,
    keyboardType: KeyboardType = KeyboardType.Text,
    /** Draws the field in the error colour — pair it with the sentence saying why. */
    isError: Boolean = false
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = true,
        isError = isError,
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

/** Multiline "about me" field matching [SettingsField] styling but allowing several lines. */
@Composable
private fun BioField(
    value: String,
    onValueChange: (String) -> Unit
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(stringResource(R.string.account_bio)) },
        placeholder = { Text(stringResource(R.string.account_bio_hint), color = Muted) },
        singleLine = false,
        minLines = 3,
        maxLines = 6,
        leadingIcon = { Icon(Icons.AutoMirrored.Filled.Notes, contentDescription = null, tint = Burgundy) },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
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

/**
 * Avatar editor row: a circular preview of [avatarUrl] (photo) or the [initials] fallback, with a
 * "Change/Add photo" button that opens the system photo picker and a "Remove photo" text button
 * (shown only when a photo is set). A spinner overlays the preview while a pick is being processed.
 */
@Composable
private fun AvatarPicker(
    avatarUrl: String?,
    initials: String,
    processing: Boolean,
    onPick: () -> Unit,
    onRemove: () -> Unit
) {
    val hasPhoto = !avatarUrl.isNullOrBlank()
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Box(contentAlignment = Alignment.Center) {
            ProfileAvatar(
                avatarUrl = avatarUrl,
                initials = initials,
                size = 84.dp,
                contentDescription = stringResource(R.string.account_photo_desc)
            )
            if (processing) {
                Box(
                    modifier = Modifier
                        .size(84.dp)
                        .clip(CircleShape)
                        .background(Color.Black.copy(alpha = 0.35f)),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
                }
            }
        }

        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                stringResource(R.string.account_photo),
                color = Ink,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = onPick, enabled = !processing) {
                    Icon(
                        Icons.Filled.PhotoCamera,
                        contentDescription = null,
                        tint = Burgundy,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(Modifier.size(6.dp))
                    Text(
                        stringResource(if (hasPhoto) R.string.account_change_photo else R.string.account_add_photo),
                        color = Burgundy,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp
                    )
                }
                if (hasPhoto) {
                    TextButton(onClick = onRemove, enabled = !processing) {
                        Text(
                            stringResource(R.string.account_remove_photo),
                            color = SettingsErrorRed,
                            fontWeight = FontWeight.Medium,
                            fontSize = 14.sp
                        )
                    }
                }
            }
        }
    }
}

/** Initials for the avatar fallback — from the name being edited, falling back to the email. */
private fun initialsForAvatar(name: String, email: String): String {
    val source = name.trim().ifBlank { email.substringBefore('@') }
    val parts = source.trim().split(Regex("[\\s._]+")).filter { it.isNotBlank() }
    return when {
        parts.isEmpty() -> "?"
        parts.size == 1 -> parts[0].take(1).uppercase()
        else -> (parts[0].take(1) + parts.last().take(1)).uppercase()
    }
}
