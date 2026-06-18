package com.quickin.app.ui

import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Badge
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Photo
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.quickin.app.IDScanResult
import com.quickin.app.IDScanService
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Cream
import com.quickin.app.ui.theme.CreamPage
import com.quickin.app.ui.theme.Ink
import com.quickin.app.ui.theme.Muted
import kotlinx.coroutines.launch

private val ScanSuccessGreen  = Color(0xFF1B5E20)
private val ScanSuccessBg     = Color(0xFFE8F5E9)
private val ScanErrorRed      = Color(0xFFB3261E)
private val ScanErrorBg       = Color(0xFFFDECEA)

/**
 * Full-screen Dialog that lets the user pick or photograph their Egyptian National ID card,
 * sends it to the local OCR service via [IDScanService], and returns the detected ID number
 * via [onIdDetected]. Dismiss by pressing [onDismiss] or the "Cancel" button.
 *
 * @param onIdDetected called with the detected 14-digit ID number when the scan succeeds and
 *                     the user taps "Use this ID Number". Callers should fill the ID field.
 * @param onDismiss    called when the user closes the sheet without confirming.
 */
@Composable
fun EgyptianIDScanScreen(
    onIdDetected: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val scope   = rememberCoroutineScope()

    var pickedBitmap  by remember { mutableStateOf<Bitmap?>(null) }
    var isScanning    by remember { mutableStateOf(false) }
    var scanResult    by remember { mutableStateOf<IDScanResult?>(null) }

    /** Launch OCR after a bitmap is loaded from any source. */
    fun runScan(bm: Bitmap) {
        pickedBitmap = bm
        scanResult   = null
        isScanning   = true
        scope.launch {
            scanResult = IDScanService.scan(bm)
            isScanning = false
        }
    }

    /** Decode a content URI to a Bitmap on the calling coroutine (already off-main for pickers). */
    fun uriToBitmap(uri: Uri): Bitmap? = runCatching {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            ImageDecoder.decodeBitmap(ImageDecoder.createSource(context.contentResolver, uri)) { decoder, _, _ ->
                decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            }
        } else {
            @Suppress("DEPRECATION")
            MediaStore.Images.Media.getBitmap(context.contentResolver, uri)
        }
    }.getOrNull()

    // Gallery picker — uses the modern Photo Picker API.
    val galleryLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) {
            scope.launch {
                uriToBitmap(uri)?.let { runScan(it) }
            }
        }
    }

    // Camera capture — returns a small thumbnail Bitmap directly.
    val cameraLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicturePreview()
    ) { bm ->
        if (bm != null) runScan(bm)
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            shape = RoundedCornerShape(32.dp),
            color = CreamPage,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
        ) {
            Column(
                modifier = Modifier
                    .verticalScroll(rememberScrollState())
                    .padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // ── Title ───────────────────────────────────────────────────
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Badge, contentDescription = null, tint = Burgundy, modifier = Modifier.size(24.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "Scan Egyptian National ID",
                        color = Ink,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Text(
                    "Take a photo or pick from gallery. Make sure the ID card is flat and well-lit.",
                    color = Muted,
                    fontSize = 14.sp
                )

                // ── Image preview / placeholder ──────────────────────────────
                IDImageArea(
                    bitmap = pickedBitmap,
                    isScanning = isScanning
                )

                // ── Picker buttons ───────────────────────────────────────────
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = { cameraLauncher.launch(null) },
                        enabled = !isScanning,
                        shape = RoundedCornerShape(20.dp),
                        border = BorderStroke(1.5.dp, Burgundy),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Burgundy),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Filled.CameraAlt, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Camera", fontWeight = FontWeight.SemiBold)
                    }

                    OutlinedButton(
                        onClick = {
                            galleryLauncher.launch(
                                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                            )
                        },
                        enabled = !isScanning,
                        shape = RoundedCornerShape(20.dp),
                        border = BorderStroke(1.5.dp, Burgundy),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Burgundy),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Filled.Photo, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Gallery", fontWeight = FontWeight.SemiBold)
                    }
                }

                // ── Result card ───────────────────────────────────────────────
                val result = scanResult
                if (result != null) {
                    if (result.success && result.idNumber != null) {
                        IDResultCard(result = result)

                        Button(
                            onClick = { onIdDetected(result.idNumber) },
                            shape = RoundedCornerShape(20.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Burgundy),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Filled.CheckCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Use this ID Number", color = Color.White, fontWeight = FontWeight.SemiBold)
                        }
                    } else {
                        IDErrorCard(message = result.message ?: "Could not read the ID card. Please try again.")
                    }
                }

                // ── Cancel ────────────────────────────────────────────────────
                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.align(Alignment.CenterHorizontally)
                ) {
                    Text("Cancel", color = Muted, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}

// ── Sub-composables ────────────────────────────────────────────────────────────

/**
 * Dashed-border card area that shows the picked [bitmap] at 16:9 aspect ratio while the OCR is
 * running, or a placeholder prompt when no image has been selected yet.
 */
@Composable
private fun IDImageArea(bitmap: Bitmap?, isScanning: Boolean) {
    val dashColor = Burgundy.copy(alpha = 0.4f)

    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(16f / 9f)
            .clip(RoundedCornerShape(16.dp))
            .background(Cream)
            // Dashed border drawn via Canvas so we can use PathEffect.dashPathEffect.
            .dashedBorder(color = dashColor, cornerRadius = 16.dp, dashWidth = 12.dp, gapWidth = 8.dp)
    ) {
        if (bitmap != null) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = "Selected ID card image",
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
            )
            if (isScanning) {
                // Translucent overlay + spinner while OCR is running.
                Box(
                    modifier = Modifier
                        .matchParentSize()
                        .background(Color.Black.copy(alpha = 0.45f))
                        .clip(RoundedCornerShape(16.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = Color.White, strokeWidth = 3.dp, modifier = Modifier.size(36.dp))
                        Spacer(Modifier.height(8.dp))
                        Text("Scanning…", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        } else {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Filled.Badge, contentDescription = null, tint = Burgundy.copy(alpha = 0.4f), modifier = Modifier.size(48.dp))
                Spacer(Modifier.height(8.dp))
                Text("No image selected", color = Muted, fontSize = 14.sp)
                Text("Use Camera or Gallery below", color = Muted.copy(alpha = 0.7f), fontSize = 12.sp)
            }
        }
    }
}

/** Green-tinted card showing the extracted ID fields after a successful scan. */
@Composable
private fun IDResultCard(result: IDScanResult) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = ScanSuccessBg),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = ScanSuccessGreen, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text("ID Detected", color = ScanSuccessGreen, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            }
            IDResultRow("ID Number",    result.idNumber ?: "—")
            IDResultRow("Birth Date",   result.birthDate ?: "—")
            IDResultRow("Governorate",  result.governorate ?: "—")
            IDResultRow("Gender",       result.gender ?: "—")
        }
    }
}

@Composable
private fun IDResultRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = Muted, fontSize = 13.sp, fontWeight = FontWeight.Medium)
        Text(value, color = Ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}

/** Red-tinted error card shown when the OCR service returns success=false. */
@Composable
private fun IDErrorCard(message: String) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = ScanErrorBg),
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(
            text = message,
            color = ScanErrorRed,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(16.dp)
        )
    }
}

// Simple border extension replacing the dashed-border custom drawing (avoids Canvas imports)
private fun Modifier.dashedBorder(
    color: Color,
    cornerRadius: androidx.compose.ui.unit.Dp,
    @Suppress("UNUSED_PARAMETER") dashWidth: androidx.compose.ui.unit.Dp,
    @Suppress("UNUSED_PARAMETER") gapWidth: androidx.compose.ui.unit.Dp
): Modifier = this.border(1.5.dp, color, RoundedCornerShape(cornerRadius))
