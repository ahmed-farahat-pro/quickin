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
import androidx.compose.material.icons.filled.Badge
import androidx.compose.material.icons.filled.Cake
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DocumentScanner
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
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
import com.quickin.app.ProfileSettingsUiState
import com.quickin.app.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.Tan

private val SettingsErrorRed = Color(0xFFB3261E)
private val SettingsSuccessGreen = Color(0xFF2E7D32)

/**
 * Profile-settings screen (reached from the Profile tab's "Edit profile" entry). Loads the
 * signed-in user's profile via `GET /api/local/profile` and edits full name / age / ID-passport /
 * phone, saving via `PATCH /api/local/profile`. Styled to match the host wizard fields.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileSettingsScreen(
    state: ProfileSettingsUiState,
    onBack: () -> Unit,
    onLoad: () -> Unit,
    onSave: (fullName: String, age: String, idDocument: String, phone: String, bio: String, avatarUrl: String?, country: String) -> Unit,
    onSavedAck: () -> Unit,
    onChangePassword: (currentPassword: String, newPassword: String) -> Unit,
    onPasswordChangedAck: () -> Unit
) {
    // Always reload when the screen opens so edits are always fresh.
    LaunchedEffect(Unit) {
        onLoad()
    }

    // Editable fields, seeded from the loaded profile. Re-seed whenever a fresh profile arrives
    // (initial load or a successful save returning the canonical row).
    var fullName by remember(state.profile) { mutableStateOf(state.profile.fullName) }
    var age by remember(state.profile) { mutableStateOf(state.profile.age?.toString() ?: "") }
    var idDocument by remember(state.profile) { mutableStateOf(state.profile.idDocument) }
    var phone by remember(state.profile) { mutableStateOf(state.profile.phone) }
    var bio by remember(state.profile) { mutableStateOf(state.profile.bio) }
    // "Country you're from" — seeded from the loaded profile; the selected English display name is
    // included in the PATCH body. Re-seeded whenever a fresh profile arrives.
    var country by remember(state.profile) { mutableStateOf(state.profile.country) }
    // Avatar source to save: starts as the loaded avatar_url; replaced with a data URL when a new
    // photo is picked, or set to null when removed. Re-seeded whenever a fresh profile arrives.
    var avatarUrl by remember(state.profile) { mutableStateOf(state.profile.avatarUrl) }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var processingPhoto by remember { mutableStateOf(false) }
    var showIDScan by remember { mutableStateOf(false) }

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
        // Egyptian National ID scanner dialog — shown when the "Scan ID" button is pressed.
        if (showIDScan) {
            EgyptianIDScanScreen(
                onIdDetected = { detectedId ->
                    idDocument = detectedId
                    showIDScan = false
                },
                onDismiss = { showIDScan = false }
            )
        }

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

                    SettingsField(fullName, { fullName = it }, stringResource(R.string.settings_full_name), Icons.Filled.Person)
                    SettingsField(
                        age,
                        { input -> age = input.filter { it.isDigit() }.take(3) },
                        stringResource(R.string.settings_age),
                        Icons.Filled.Cake,
                        keyboardType = KeyboardType.Number
                    )
                    SettingsField(idDocument, { idDocument = it }, stringResource(R.string.settings_id_passport), Icons.Filled.Badge)
                    // "Scan ID" shortcut — opens the Egyptian National ID OCR scanner.
                    TextButton(
                        onClick = { showIDScan = true },
                        modifier = Modifier.align(Alignment.End)
                    ) {
                        Icon(
                            Icons.Filled.DocumentScanner,
                            contentDescription = null,
                            tint = Burgundy,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(Modifier.size(4.dp))
                        Text("Scan ID", color = Burgundy, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    }
                    SettingsField(
                        phone,
                        { phone = it },
                        stringResource(R.string.settings_phone),
                        Icons.Filled.Phone,
                        keyboardType = KeyboardType.Phone
                    )
                    // Country selector (same searchable dialog used at sign-up).
                    CountrySelector(
                        value = country,
                        onSelect = { country = it },
                        label = stringResource(R.string.settings_country),
                        enabled = !state.isSaving
                    )
                    Text(
                        stringResource(R.string.settings_country_hint),
                        color = Muted,
                        fontSize = 13.sp
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

                    Spacer(Modifier.height(4.dp))
                    GradientButton(
                        onClick = {
                            onSavedAck()
                            onSave(fullName, age, idDocument, phone, bio, avatarUrl, country)
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
}

/**
 * "Change password" block on the profile-settings screen. Current + new password fields (both with
 * the AuthScreen eye-toggle), an "Update password" button (POST /api/local/change-password), an
 * inline server error on 400, and a green confirmation on success — after which the fields clear.
 */
@Composable
private fun ChangePasswordSection(
    state: ProfileSettingsUiState,
    onChangePassword: (currentPassword: String, newPassword: String) -> Unit,
    onPasswordChangedAck: () -> Unit
) {
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }

    // On a successful change, clear the entered passwords. The "Password updated" note stays put
    // (it's only acked when the user starts another change, mirroring the profile-save flow below).
    LaunchedEffect(state.passwordChanged) {
        if (state.passwordChanged) {
            currentPassword = ""
            newPassword = ""
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
            currentPassword.isNotBlank() && passwordMeetsMin(newPassword),
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
    enabled: Boolean
) {
    var visible by remember { mutableStateOf(false) }
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        enabled = enabled,
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

@Composable
private fun SettingsField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    icon: ImageVector,
    keyboardType: KeyboardType = KeyboardType.Text
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = true,
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
