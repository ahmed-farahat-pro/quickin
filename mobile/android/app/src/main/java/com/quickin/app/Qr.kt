package com.quickin.app

import android.graphics.Bitmap
import android.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel

/**
 * Pure-Kotlin QR code generation for the in-app reservation card.
 * Uses ZXing core only (com.google.zxing:core) — no Android-UI ZXing module —
 * encoding a [content] string into a square [Bitmap] we render via Compose Image.
 *
 * This is an in-app code (scannable by reception), not Apple Wallet / Google Wallet.
 */
object Qr {

    /**
     * Encodes [content] (e.g. a reservation_code) as a black-on-white QR [Bitmap] of
     * [sizePx] × [sizePx]. Returns null if [content] is blank or encoding fails, so the
     * caller can fall back to showing the code as plain text.
     */
    fun bitmap(content: String, sizePx: Int = 600): Bitmap? {
        if (content.isBlank()) return null
        return try {
            val hints = mapOf(
                EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
                EncodeHintType.MARGIN to 1
            )
            val matrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, sizePx, sizePx, hints)
            val w = matrix.width
            val h = matrix.height
            val pixels = IntArray(w * h)
            for (y in 0 until h) {
                val offset = y * w
                for (x in 0 until w) {
                    pixels[offset + x] = if (matrix[x, y]) Color.BLACK else Color.WHITE
                }
            }
            Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888).apply {
                setPixels(pixels, 0, w, 0, 0, w, h)
            }
        } catch (_: Exception) {
            null
        }
    }
}

/** Compose convenience: a QR [androidx.compose.ui.graphics.ImageBitmap] or null. */
fun rememberableQrImage(content: String, sizePx: Int = 600) =
    Qr.bitmap(content, sizePx)?.asImageBitmap()
