package com.quickin.app.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddAPhoto
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.HourglassTop
import androidx.compose.material.icons.filled.NewReleases
import androidx.compose.material.icons.filled.Report
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.quickin.app.R
import com.quickin.app.TrustBadges
import com.quickin.app.VerificationUiState
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.Gold
import com.quickin.app.ui.theme.GoldDeep
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import com.quickin.app.ui.theme.SuccessGreen
import com.quickin.app.ui.theme.Tan

private val ReportRed = Color(0xFFB3261E)

/**
 * Identity-verification card for the Profile tab — NO OCR. Shows the user's current status with a
 * colored status pill; for "unverified"/"rejected" it lets the user pick OR capture a FRONT photo,
 * a BACK photo of their ID and a SELFIE (Photo Picker, ImageOnly), shows thumbnails, optionally
 * enter their ID number, then submits all three over HTTPS via [onSubmit] (front, back, selfie,
 * idNumber?) — matching the web verification flow. The "pending"/"verified" states show a
 * read-only note. RTL-safe — rows lay out start→end.
 */
@Composable
fun VerificationCard(
    state: VerificationUiState,
    onSubmit: (front: android.net.Uri, back: android.net.Uri, selfie: android.net.Uri, idNumber: String?) -> Unit,
    modifier: Modifier = Modifier
) {
    val status = state.status.lowercase()
    val canSubmit = status == "unverified" || status == "rejected"

    // Picked FRONT / BACK / SELFIE photo URIs (Photo Picker — no storage permission needed) + id no.
    var frontUri by remember { mutableStateOf<android.net.Uri?>(null) }
    var backUri by remember { mutableStateOf<android.net.Uri?>(null) }
    var selfieUri by remember { mutableStateOf<android.net.Uri?>(null) }
    var idNumber by remember { mutableStateOf("") }

    // Clear the staged photos once a submission succeeds (status leaves the submittable states).
    androidx.compose.runtime.LaunchedEffect(status) {
        if (!canSubmit) { frontUri = null; backUri = null; selfieUri = null; idNumber = "" }
    }

    val pickFront = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri -> if (uri != null) frontUri = uri }
    val pickBack = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri -> if (uri != null) backUri = uri }
    val pickSelfie = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri -> if (uri != null) selfieUri = uri }

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
                        Icons.Filled.Shield,
                        contentDescription = null,
                        tint = Burgundy,
                        modifier = Modifier.size(20.dp)
                    )
                }
                Spacer(Modifier.width(14.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        stringResource(R.string.trust_verify),
                        color = Ink,
                        fontWeight = FontWeight.Bold,
                        fontSize = 17.sp
                    )
                    Spacer(Modifier.height(4.dp))
                    VerificationStatusPill(status)
                }
            }

            // Body copy depends on the state.
            val note = when (status) {
                "pending" -> stringResource(R.string.trust_pending_note)
                "verified" -> stringResource(R.string.trust_verified_note)
                "rejected" -> stringResource(R.string.trust_rejected_note)
                else -> stringResource(R.string.trust_verify_intro)
            }
            Text(
                note,
                color = Muted,
                fontSize = 14.sp,
                lineHeight = 20.sp,
                modifier = Modifier.padding(top = 14.dp)
            )

            if (canSubmit) {
                Spacer(Modifier.height(16.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    IdPhotoSlot(
                        label = stringResource(R.string.trust_front_photo),
                        uri = frontUri,
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
                        uri = backUri,
                        enabled = !state.isSubmitting,
                        onPick = {
                            pickBack.launch(
                                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                            )
                        },
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(Modifier.height(12.dp))
                // Selfie row (web parity): the reviewer matches the face against the ID photos.
                IdPhotoSlot(
                    label = stringResource(R.string.trust_selfie_photo),
                    uri = selfieUri,
                    enabled = !state.isSubmitting,
                    onPick = {
                        pickSelfie.launch(
                            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                        )
                    },
                    modifier = Modifier.fillMaxWidth()
                )
                if (selfieUri == null) {
                    Text(
                        stringResource(R.string.trust_selfie_hint),
                        color = Muted,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                }

                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = idNumber,
                    onValueChange = { idNumber = it },
                    label = { Text(stringResource(R.string.trust_id_number)) },
                    singleLine = true,
                    enabled = !state.isSubmitting,
                    shape = RoundedCornerShape(16.dp),
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

            if (state.error != null) {
                Text(
                    state.error.ifBlank { stringResource(R.string.trust_error) },
                    color = ReportRed,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(top = 10.dp)
                )
            }

            if (canSubmit) {
                val front = frontUri
                val back = backUri
                val selfie = selfieUri
                val ready = front != null && back != null && selfie != null && !state.isSubmitting
                Spacer(Modifier.height(16.dp))
                GradientButton(
                    onClick = {
                        if (front != null && back != null && selfie != null) {
                            onSubmit(front, back, selfie, idNumber.trim().ifBlank { null })
                        }
                    },
                    enabled = ready,
                    radius = 16.dp,
                    height = 50.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (state.isSubmitting) {
                        CircularProgressIndicator(
                            color = Color.White,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(20.dp)
                        )
                    } else {
                        Text(
                            stringResource(R.string.trust_submit),
                            color = Color.White,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp
                        )
                    }
                }
            }
        }
    }
}

/**
 * One ID-photo slot: a tappable rounded box that shows the picked photo's thumbnail (Coil renders
 * the content [uri] directly) or an "Add photo" placeholder with a label (FRONT / BACK). Tapping
 * opens the system Photo Picker via [onPick]; a checkmark overlays a chosen photo.
 */
@Composable
private fun IdPhotoSlot(
    label: String,
    uri: android.net.Uri?,
    enabled: Boolean,
    onPick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val shape = RoundedCornerShape(16.dp)
    Box(
        modifier = modifier
            .height(112.dp)
            .clip(shape)
            .background(Cream, shape)
            .border(1.dp, if (uri != null) SuccessGreen else Tan, shape)
            .clickable(enabled = enabled, onClick = onPick),
        contentAlignment = Alignment.Center
    ) {
        if (uri != null) {
            coil.compose.AsyncImage(
                model = uri,
                contentDescription = label,
                contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().height(112.dp).clip(shape)
            )
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(6.dp)
                    .size(22.dp)
                    .background(SuccessGreen, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Filled.CheckCircle,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(16.dp)
                )
            }
        } else {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(
                    Icons.Filled.AddAPhoto,
                    contentDescription = null,
                    tint = Burgundy,
                    modifier = Modifier.size(22.dp)
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    label,
                    color = Ink,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

/** A colored status pill for the verification card (gray / gold / green / red by [status]). */
@Composable
private fun VerificationStatusPill(status: String) {
    val (labelRes, tint, icon) = when (status) {
        "pending" -> Triple(R.string.trust_status_pending, Gold, Icons.Filled.HourglassTop)
        "verified" -> Triple(R.string.trust_status_verified, SuccessGreen, Icons.Filled.Verified)
        "rejected" -> Triple(R.string.trust_status_rejected, ReportRed, Icons.Filled.NewReleases)
        else -> Triple(R.string.trust_status_unverified, Muted, Icons.Filled.Shield)
    }
    Surface(
        shape = RoundedCornerShape(50),
        color = tint.copy(alpha = 0.12f)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
        ) {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(6.dp))
            Text(
                stringResource(labelRes),
                color = tint,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

/**
 * A reusable row of trust-badge chips (boutique style): Verified ✓ (gold), Superhost (burgundy),
 * New host (tan). Only the flags that are true render a chip; the row is empty (renders nothing
 * visible) when none apply. RTL-safe via [FlowRow]. [verifiedOverride] forces the Verified chip on
 * (used to light the chip immediately from `listing.hostVerified` before badges are fetched).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TrustBadgeRow(
    badges: TrustBadges,
    modifier: Modifier = Modifier,
    verifiedOverride: Boolean = false,
    chipFontSize: androidx.compose.ui.unit.TextUnit = 12.sp
) {
    val verified = badges.verified || verifiedOverride
    if (!verified && !badges.superhost && !badges.newHost) return

    FlowRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (verified) {
            TrustChip(
                label = stringResource(R.string.badge_verified),
                icon = Icons.Filled.CheckCircle,
                fg = GoldDeep,
                bg = Gold.copy(alpha = 0.16f),
                fontSize = chipFontSize
            )
        }
        if (badges.superhost) {
            TrustChip(
                label = stringResource(R.string.badge_superhost),
                icon = Icons.Filled.WorkspacePremium,
                fg = Burgundy,
                bg = Burgundy.copy(alpha = 0.10f),
                fontSize = chipFontSize
            )
        }
        if (badges.newHost) {
            TrustChip(
                label = stringResource(R.string.badge_new_host),
                icon = Icons.Filled.NewReleases,
                fg = Ink,
                bg = Tan,
                fontSize = chipFontSize
            )
        }
    }
}

/** A single rounded trust chip: a leading icon + label, on a soft tinted capsule. */
@Composable
private fun TrustChip(
    label: String,
    icon: ImageVector,
    fg: Color,
    bg: Color,
    fontSize: androidx.compose.ui.unit.TextUnit,
    iconSize: Dp = 14.dp
) {
    Surface(shape = RoundedCornerShape(50), color = bg) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
        ) {
            Icon(icon, contentDescription = null, tint = fg, modifier = Modifier.size(iconSize))
            Spacer(Modifier.width(6.dp))
            Text(label, color = fg, fontSize = fontSize, fontWeight = FontWeight.SemiBold)
        }
    }
}

/**
 * "Report this listing" entry — a quiet, full-width tappable row (muted red shield + label) shown
 * near the bottom of the listing detail. Tapping opens the [ReportListingSheet].
 */
@Composable
fun ReportListingRow(onClick: () -> Unit, modifier: Modifier = Modifier) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = Color.White,
        shadowElevation = 2.dp,
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp)
        ) {
            Icon(
                Icons.Filled.Report,
                contentDescription = null,
                tint = ReportRed,
                modifier = Modifier.size(20.dp)
            )
            Spacer(Modifier.width(12.dp))
            Text(
                stringResource(R.string.report_report),
                color = ReportRed,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp
            )
        }
    }
}

/** One report reason: a stable English [value] sent to the backend + its localized [labelRes]. */
private data class ReportReason(val value: String, val labelRes: Int)

private val REPORT_REASONS = listOf(
    ReportReason("inaccurate", R.string.report_reason_inaccurate),
    ReportReason("scam", R.string.report_reason_scam),
    ReportReason("offensive", R.string.report_reason_offensive),
    ReportReason("other", R.string.report_reason_other)
)

/**
 * The "Report this listing" bottom sheet: a single-select list of reasons (sending stable English
 * codes "inaccurate"/"scam"/"offensive"/"other"), an optional details field, and a Submit button.
 * Submit is disabled until a reason is chosen. [error] surfaces a server/validation message;
 * [isSubmitting] disables the button + shows a spinner. RTL-safe (no hardcoded start/end).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportListingSheet(
    isSubmitting: Boolean,
    error: String?,
    onSubmit: (reason: String, details: String?) -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var selectedReason by remember { mutableStateOf<String?>(null) }
    var details by remember { mutableStateOf("") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Cream
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp)
                .padding(bottom = 20.dp)
        ) {
            Text(
                stringResource(R.string.report_report),
                color = Ink,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp
            )
            Text(
                stringResource(R.string.report_reason),
                color = Muted,
                fontSize = 14.sp,
                modifier = Modifier.padding(top = 4.dp, bottom = 12.dp)
            )

            REPORT_REASONS.forEach { reason ->
                val selected = selectedReason == reason.value
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = if (selected) Burgundy.copy(alpha = 0.08f) else Color.White,
                    border = if (selected) {
                        androidx.compose.foundation.BorderStroke(1.dp, Burgundy.copy(alpha = 0.4f))
                    } else null,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 10.dp)
                        .clickable { selectedReason = reason.value }
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        RadioButton(
                            selected = selected,
                            onClick = { selectedReason = reason.value },
                            colors = RadioButtonDefaults.colors(
                                selectedColor = Burgundy,
                                unselectedColor = Muted
                            )
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            stringResource(reason.labelRes),
                            color = Ink,
                            fontSize = 15.sp,
                            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }

            OutlinedTextField(
                value = details,
                onValueChange = { details = it },
                placeholder = { Text(stringResource(R.string.report_details), color = Muted) },
                minLines = 3,
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Burgundy,
                    unfocusedBorderColor = Tan,
                    cursorColor = Burgundy,
                    focusedContainerColor = Color.White,
                    unfocusedContainerColor = Color.White
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp)
            )

            if (error != null) {
                Text(
                    error.ifBlank { stringResource(R.string.trust_error) },
                    color = ReportRed,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(top = 10.dp)
                )
            }

            Spacer(Modifier.height(16.dp))
            GradientButton(
                onClick = {
                    val reason = selectedReason ?: return@GradientButton
                    onSubmit(reason, details.trim().ifBlank { null })
                },
                enabled = selectedReason != null && !isSubmitting,
                radius = 16.dp,
                height = 52.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (isSubmitting) {
                    CircularProgressIndicator(
                        color = Color.White,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(20.dp)
                    )
                } else {
                    Text(
                        stringResource(R.string.report_submit),
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp
                    )
                }
            }
        }
    }
}

/** "Thanks for reporting" confirmation dialog, shown after a report POST succeeds. */
@Composable
fun ReportThanksDialog(onDismiss: () -> Unit) {
    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            androidx.compose.material3.TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.action_done), color = Burgundy, fontWeight = FontWeight.SemiBold)
            }
        },
        icon = {
            Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = SuccessGreen, modifier = Modifier.size(28.dp))
        },
        title = {
            Text(stringResource(R.string.report_report), fontWeight = FontWeight.Bold, color = Ink)
        },
        text = {
            Text(stringResource(R.string.report_thanks), color = Muted, fontSize = 15.sp)
        },
        containerColor = Cream
    )
}
