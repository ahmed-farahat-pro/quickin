package com.quickin.app

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import java.io.ByteArrayOutputStream

/**
 * Avatar image helpers shared by the Profile tab and the profile-settings editor.
 *
 * The backend stores `avatar_url` as either an `http(s)` URL or an inline
 * `data:image/jpeg;base64,…` data URL. Picked photos are kept small by downscaling to
 * [MAX_AVATAR_DIM]px and JPEG-compressing before base64-encoding, so the PATCH body stays modest.
 * Coil (the app's image loader) ships no data-URI fetcher in 2.7.0, so data URLs are decoded to a
 * [Bitmap] here and http(s) URLs are left for `AsyncImage`.
 */
object AvatarImage {

    /** Longest edge (px) a stored avatar is downscaled to before JPEG compression. */
    const val MAX_AVATAR_DIM = 256

    /** Longest edge (px) a stored review photo is downscaled to (larger than an avatar). */
    const val MAX_REVIEW_DIM = 1024

    /** JPEG quality (0..100) used when encoding a picked avatar to a data URL. */
    private const val JPEG_QUALITY = 80

    /** True for a `data:` URL we must decode ourselves (Coil can't fetch these in 2.7.0). */
    fun isDataUrl(url: String?): Boolean = url != null && url.startsWith("data:", ignoreCase = true)

    /**
     * Loads the image at [uri] (a gallery/photo-picker result), downscales it so its longest edge
     * is ≤ [maxDim]px (defaults to [MAX_AVATAR_DIM] for avatars; pass [MAX_REVIEW_DIM] for review
     * photos), JPEG-compresses it, and returns a `data:image/jpeg;base64,…` data URL. Returns null
     * if the image can't be read/decoded.
     *
     * Decodes with `inSampleSize` first (cheap, power-of-two subsample) to avoid loading a full-size
     * photo into memory, then does an exact scale to the final box.
     */
    fun loadDownscaledJpegDataUrl(context: Context, uri: Uri, maxDim: Int = MAX_AVATAR_DIM): String? {
        return try {
            // Pass 1: read just the bounds so we can pick an inSampleSize.
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            context.contentResolver.openInputStream(uri)?.use { input ->
                BitmapFactory.decodeStream(input, null, bounds)
            }
            val srcW = bounds.outWidth
            val srcH = bounds.outHeight
            if (srcW <= 0 || srcH <= 0) return null

            // Pass 2: decode subsampled, then scale exactly to fit within maxDim.
            val decodeOpts = BitmapFactory.Options().apply {
                inSampleSize = sampleSizeFor(srcW, srcH, maxDim)
            }
            val decoded = context.contentResolver.openInputStream(uri)?.use { input ->
                BitmapFactory.decodeStream(input, null, decodeOpts)
            } ?: return null

            val scaled = scaleToFit(decoded, maxDim)
            if (scaled !== decoded) decoded.recycle()

            val bytes = ByteArrayOutputStream().use { out ->
                scaled.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)
                out.toByteArray()
            }
            scaled.recycle()
            val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
            "data:image/jpeg;base64,$base64"
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Downscales [bitmap] so its longest edge is ≤ [maxDim]px, JPEG-compresses it, and returns a
     * `data:image/jpeg;base64,…` data URL. Used by the manual ID-verification fallback to upload a
     * camera frame the OCR couldn't read.
     */
    fun bitmapToJpegDataUrl(bitmap: Bitmap, maxDim: Int = MAX_REVIEW_DIM): String {
        val scaled = scaleToFit(bitmap, maxDim)
        val bytes = ByteArrayOutputStream().use { out ->
            scaled.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)
            out.toByteArray()
        }
        if (scaled !== bitmap) scaled.recycle()
        return "data:image/jpeg;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
    }

    /**
     * Decodes a `data:image/...;base64,…` data URL to a [Bitmap] for display, or null if [dataUrl]
     * is not a (decodable) base64 data URL.
     */
    fun decodeDataUrlToBitmap(dataUrl: String?): Bitmap? {
        if (dataUrl == null || !isDataUrl(dataUrl)) return null
        val comma = dataUrl.indexOf(',')
        if (comma < 0) return null
        // Only base64 payloads are supported (the only form the app writes / the API returns).
        if (!dataUrl.substring(0, comma).contains("base64", ignoreCase = true)) return null
        return try {
            val bytes = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        } catch (_: Exception) {
            null
        }
    }

    /** Largest power-of-two subsample that keeps both dimensions ≥ [target]. */
    private fun sampleSizeFor(width: Int, height: Int, target: Int): Int {
        var sample = 1
        var w = width
        var h = height
        while (w / 2 >= target && h / 2 >= target) {
            w /= 2
            h /= 2
            sample *= 2
        }
        return sample
    }

    /** Scales [src] down so its longest edge is [maxDim]px (keeps aspect ratio; never upscales). */
    private fun scaleToFit(src: Bitmap, maxDim: Int): Bitmap {
        val longest = maxOf(src.width, src.height)
        if (longest <= maxDim) return src
        val ratio = maxDim.toFloat() / longest
        val w = (src.width * ratio).toInt().coerceAtLeast(1)
        val h = (src.height * ratio).toInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(src, w, h, true)
    }
}
