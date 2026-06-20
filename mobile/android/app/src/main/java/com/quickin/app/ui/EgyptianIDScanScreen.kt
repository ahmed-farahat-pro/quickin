package com.quickin.app.ui

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Matrix
import android.graphics.Rect
import android.graphics.YuvImage
import android.util.Size
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Camera
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size as ComposeSize
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import com.quickin.app.AuthViewModel
import com.quickin.app.AvatarImage
import com.quickin.app.IDScanResult
import com.quickin.app.IDScanService
import com.quickin.app.TrustService
import com.quickin.app.ui.theme.Burgundy
import com.quickin.app.ui.theme.Muted
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Full-screen live-camera dialog that detects an Egyptian National ID card in real-time.
 * When a valid 14-digit ID is found, [onIdDetected] is called automatically.
 */
@Composable
fun EgyptianIDScanScreen(
    onIdDetected: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val context        = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope          = rememberCoroutineScope()

    // Camera permission
    var hasPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED
        )
    }
    val permLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> hasPermission = granted }

    LaunchedEffect(Unit) {
        if (!hasPermission) permLauncher.launch(Manifest.permission.CAMERA)
    }

    // Scan state (atomic refs for cross-thread access from the analyser thread).
    // captureRequested gates the (paid) OCR call — set only when the user taps Capture,
    // so frames are NEVER streamed automatically to the backend.
    val scanInFlight     = remember { AtomicBoolean(false) }
    val captureRequested = remember { AtomicBoolean(false) }
    val detected         = remember { AtomicBoolean(false) }

    var loadingUi  by remember { mutableStateOf(false) }
    var scanResult by remember { mutableStateOf<IDScanResult?>(null) }
    var statusText by remember { mutableStateOf("Align your ID card inside the frame, then tap Capture") }

    // Manual fallback (used when the auto-scan fails or the OCR is out of credits): the last
    // captured frame is uploaded to the backend for an admin to verify.
    var lastBitmap      by remember { mutableStateOf<Bitmap?>(null) }
    var scanFailed      by remember { mutableStateOf(false) }
    var manualSubmitting by remember { mutableStateOf(false) }
    var manualSubmitted by remember { mutableStateOf(false) }
    var manualError     by remember { mutableStateOf<String?>(null) }

    fun submitManual() {
        val bmp = lastBitmap ?: return
        val token = context.getSharedPreferences(AuthViewModel.PREFS_NAME, Context.MODE_PRIVATE)
            .getString(AuthViewModel.KEY_TOKEN, null)
        if (token.isNullOrBlank()) { manualError = "Please sign in to submit your ID."; return }
        manualError = null; manualSubmitting = true
        scope.launch {
            val doc = withContext(Dispatchers.IO) { AvatarImage.bitmapToJpegDataUrl(bmp, 1024) }
            try {
                TrustService.submitVerification(token, doc)
                manualSubmitting = false; manualSubmitted = true
            } catch (e: Exception) {
                manualSubmitting = false; manualError = e.message ?: "Upload failed. Please try again."
            }
        }
    }

    // Camera provider ref so we can unbind on dispose
    var cameraProvider by remember { mutableStateOf<ProcessCameraProvider?>(null) }
    val previewView    = remember { PreviewView(context) }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = false
        )
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            if (!hasPermission) {
                // Permission denied UI
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(Icons.Filled.Camera, contentDescription = null,
                        tint = Color.White, modifier = Modifier.size(56.dp))
                    Spacer(Modifier.height(16.dp))
                    Text("Camera access required", color = Color.White,
                        fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(8.dp))
                    Text("Grant camera permission to scan your ID",
                        color = Color.White.copy(alpha = 0.6f), fontSize = 14.sp)
                    Spacer(Modifier.height(24.dp))
                    Button(
                        onClick = { permLauncher.launch(Manifest.permission.CAMERA) },
                        colors = ButtonDefaults.buttonColors(containerColor = Burgundy)
                    ) { Text("Grant Permission", color = Color.White) }
                    Spacer(Modifier.height(12.dp))
                    TextButton(onClick = onDismiss) {
                        Text("Cancel", color = Color.White.copy(alpha = 0.6f))
                    }
                }
            } else {
                // Camera preview
                AndroidView(
                    factory = { previewView.apply { scaleType = PreviewView.ScaleType.FILL_CENTER } },
                    modifier = Modifier.fillMaxSize()
                )

                // Overlay: dim surround + card frame + corner marks
                ScanOverlay(
                    detected = scanResult?.success == true,
                    loading  = loadingUi
                )

                // Top bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                        .padding(top = 48.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("✕", color = Color.White, fontSize = 22.sp)
                    }
                    Spacer(Modifier.weight(1f))
                    Text("Scan National ID", color = Color.White,
                        fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.weight(1f))
                    Spacer(Modifier.width(48.dp))
                }

                // Bottom panel
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.BottomCenter
                ) {
                    val r = scanResult
                    if (manualSubmitted) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color.Black.copy(alpha = 0.78f),
                                    RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(Icons.Filled.CheckCircle, contentDescription = null,
                                tint = Color(0xFF4CAF50), modifier = Modifier.size(34.dp))
                            Text("Submitted for review", color = Color.White,
                                fontSize = 17.sp, fontWeight = FontWeight.Bold)
                            Text("We've received your ID. Our team will verify it shortly.",
                                color = Color.White.copy(0.8f), fontSize = 13.sp)
                            Spacer(Modifier.height(4.dp))
                            Button(
                                onClick = onDismiss,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(20.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50))
                            ) { Text("Done", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold) }
                        }
                    } else if (r != null && r.success) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(
                                    Color.Black.copy(alpha = 0.75f),
                                    RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
                                )
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Icon(Icons.Filled.CheckCircle, contentDescription = null,
                                    tint = Color(0xFF4CAF50), modifier = Modifier.size(22.dp))
                                Text("ID Detected!", color = Color.White,
                                    fontSize = 17.sp, fontWeight = FontWeight.Bold)
                            }
                            if (r.fullName != null) {
                                Text(r.fullName, color = Color.White, fontSize = 16.sp,
                                    fontWeight = FontWeight.SemiBold)
                            }
                            if (r.idNumber != null) {
                                Text(
                                    r.idNumber,
                                    color = Color.White,
                                    fontSize = 22.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    fontFamily = FontFamily.Monospace,
                                    letterSpacing = 2.sp
                                )
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                                if (r.birthDate != null)
                                    Text("📅 ${r.birthDate}", color = Color.White.copy(0.8f), fontSize = 13.sp)
                                if (r.governorate != null)
                                    Text("📍 ${r.governorate}", color = Color.White.copy(0.8f), fontSize = 13.sp)
                                if (r.gender != null)
                                    Text("⚧ ${r.gender}", color = Color.White.copy(0.8f), fontSize = 13.sp)
                            }
                            if (r.address != null) {
                                Text("🏠 ${r.address}", color = Color.White.copy(0.7f), fontSize = 12.sp)
                            }
                            Spacer(Modifier.height(4.dp))
                            Button(
                                onClick = { r.idNumber?.let { onIdDetected(it) } },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(20.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50))
                            ) {
                                Text("Use this ID", color = Color.White,
                                    fontSize = 16.sp, fontWeight = FontWeight.Bold)
                            }
                            Spacer(Modifier.height(4.dp))
                        }
                    } else {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 48.dp, start = 24.dp, end = 24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .background(Color.Black.copy(0.55f), RoundedCornerShape(16.dp))
                                    .padding(horizontal = 24.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                if (loadingUi) {
                                    CircularProgressIndicator(
                                        color = Color.White, strokeWidth = 2.dp,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Text("Reading ID…", color = Color.White, fontSize = 14.sp)
                                } else {
                                    Text(statusText, color = Color.White, fontSize = 14.sp)
                                }
                            }
                            // Manual shutter — one OCR call per tap (the backend bills per scan).
                            Button(
                                onClick = { if (!loadingUi) captureRequested.set(true) },
                                enabled = !loadingUi && !manualSubmitting,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(20.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Burgundy)
                            ) {
                                Text(
                                    if (loadingUi) "Scanning…" else "Capture & Scan",
                                    color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold
                                )
                            }
                            // Manual fallback, shown once an auto-scan has failed: upload the
                            // captured frame for an admin to verify.
                            if (scanFailed) {
                                Button(
                                    onClick = { submitManual() },
                                    enabled = !manualSubmitting && !loadingUi,
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(20.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(0.16f))
                                ) {
                                    Text(
                                        if (manualSubmitting) "Uploading…" else "Upload for manual review",
                                        color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold
                                    )
                                }
                                manualError?.let {
                                    Text(it, color = Color(0xFFFFB4A9), fontSize = 12.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Bind CameraX when permission is granted
    DisposableEffect(hasPermission) {
        if (!hasPermission) return@DisposableEffect onDispose {}

        val executor = Executors.newSingleThreadExecutor()
        val future   = ProcessCameraProvider.getInstance(context)

        future.addListener({
            val cp = future.get()
            cameraProvider = cp

            val preview = Preview.Builder().build().also {
                it.surfaceProvider = previewView.surfaceProvider
            }

            val analysis = ImageAnalysis.Builder()
                .setTargetResolution(Size(1280, 720))
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()

            @OptIn(ExperimentalGetImage::class)
            analysis.setAnalyzer(executor) { proxy ->
                // Only grab a frame and call the OCR backend when the user taps Capture.
                if (!captureRequested.get() || scanInFlight.get() || detected.get()) {
                    proxy.close()
                    return@setAnalyzer
                }
                captureRequested.set(false)
                scanInFlight.set(true)

                val bm = proxy.toOrientedBitmap()
                proxy.close()

                if (bm == null) { scanInFlight.set(false); return@setAnalyzer }

                scope.launch {
                    withContext(Dispatchers.Main) { loadingUi = true; lastBitmap = bm }
                    val r = IDScanService.scan(bm)
                    withContext(Dispatchers.Main) {
                        loadingUi = false
                        if (r.success) {
                            detected.set(true)
                            scanResult = r
                            cp.unbindAll()
                        } else {
                            scanFailed = true
                            statusText = r.message
                                ?: "Couldn't read the card automatically. You can upload it for manual review."
                        }
                    }
                    scanInFlight.set(false)
                }
            }

            cp.unbindAll()
            cp.bindToLifecycle(
                lifecycleOwner,
                CameraSelector.DEFAULT_BACK_CAMERA,
                preview, analysis
            )
        }, ContextCompat.getMainExecutor(context))

        onDispose {
            executor.shutdownNow()
            cameraProvider?.unbindAll()
        }
    }
}

// MARK: – Canvas overlay (dim surround + card border + corner marks)

@Composable
private fun ScanOverlay(detected: Boolean, loading: Boolean) {
    val borderColor = if (detected) Color(0xFF4CAF50) else Color.White
    val dimColor    = Color.Black.copy(alpha = 0.55f)

    Canvas(modifier = Modifier.fillMaxSize()) {
        val cw = size.width * 0.88f
        val ch = cw / (85.6f / 53.98f)
        val cx = (size.width - cw) / 2f
        val cy = (size.height - ch) / 2f

        // Four dim rectangles around the card window
        drawRect(dimColor, size = ComposeSize(size.width, cy))
        drawRect(dimColor, topLeft = Offset(0f, cy + ch),
            size = ComposeSize(size.width, size.height - cy - ch))
        drawRect(dimColor, topLeft = Offset(0f, cy), size = ComposeSize(cx, ch))
        drawRect(dimColor, topLeft = Offset(cx + cw, cy),
            size = ComposeSize(size.width - cx - cw, ch))

        // Card border
        drawRoundRect(
            color = borderColor,
            topLeft = Offset(cx, cy),
            size = ComposeSize(cw, ch),
            cornerRadius = CornerRadius(16.dp.toPx()),
            style = Stroke(width = if (detected) 3.5.dp.toPx() else 2.dp.toPx())
        )

        // Corner marks (4 L-shapes)
        val L  = 24.dp.toPx()
        val lw = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round)

        fun cornerPath(sx: Float, sy: Float, ex: Float, ey: Float, mx: Float, my: Float) = Path().apply {
            moveTo(sx, sy); lineTo(mx, my); lineTo(ex, ey)
        }

        drawPath(cornerPath(cx, cy + L, cx + L, cy, cx, cy), borderColor, style = lw)
        drawPath(cornerPath(cx + cw - L, cy, cx + cw, cy + L, cx + cw, cy), borderColor, style = lw)
        drawPath(cornerPath(cx + cw, cy + ch - L, cx + cw - L, cy + ch, cx + cw, cy + ch), borderColor, style = lw)
        drawPath(cornerPath(cx + L, cy + ch, cx, cy + ch - L, cx, cy + ch), borderColor, style = lw)
    }
}

// MARK: – ImageProxy → oriented Bitmap

@SuppressLint("UnsafeOptInUsageError")
private fun ImageProxy.toOrientedBitmap(): Bitmap? = runCatching {
    val img   = image ?: return null
    val yBuf  = img.planes[0].buffer
    val vBuf  = img.planes[2].buffer
    val uBuf  = img.planes[1].buffer
    val ySize = yBuf.remaining()
    val vArr  = ByteArray(vBuf.remaining()).also { vBuf.get(it) }
    val uArr  = ByteArray(uBuf.remaining()).also { uBuf.get(it) }
    val vStride    = img.planes[2].pixelStride
    val uStride    = img.planes[1].pixelStride
    val vRowStride = img.planes[2].rowStride
    val uRowStride = img.planes[1].rowStride
    val uvW = width / 2; val uvH = height / 2
    val nv21 = ByteArray(ySize + uvW * uvH * 2)
    yBuf.get(nv21, 0, ySize)
    var idx = ySize
    for (row in 0 until uvH) for (col in 0 until uvW) {
        nv21[idx++] = vArr[row * vRowStride + col * vStride]
        nv21[idx++] = uArr[row * uRowStride + col * uStride]
    }
    val yuv = YuvImage(nv21, ImageFormat.NV21, width, height, null)
    val out = ByteArrayOutputStream()
    yuv.compressToJpeg(Rect(0, 0, width, height), 85, out)
    var bm = BitmapFactory.decodeByteArray(out.toByteArray(), 0, out.size()) ?: return null
    val rot = imageInfo.rotationDegrees
    if (rot != 0) {
        val m = Matrix().apply { postRotate(rot.toFloat()) }
        bm = Bitmap.createBitmap(bm, 0, 0, bm.width, bm.height, m, true)
    }
    bm
}.getOrNull()
