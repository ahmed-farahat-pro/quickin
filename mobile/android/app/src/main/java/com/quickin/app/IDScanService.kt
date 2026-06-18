package com.quickin.app

import android.graphics.Bitmap
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * Result of an Egyptian National ID scan via the local Python OCR service.
 * [success] is false when the service could not read the card — [message] carries the reason.
 */
data class IDScanResult(
    val success: Boolean,
    val idNumber: String? = null,
    val birthDate: String? = null,
    val birthYear: Int? = null,
    val governorate: String? = null,
    val gender: String? = null,
    val message: String? = null
)

/**
 * HTTP client for the Egyptian National ID OCR service running at http://10.0.2.2:8000 (the
 * emulator's alias for the host machine's localhost). Uses the same HttpURLConnection /
 * org.json / Dispatchers.IO pattern as [ProfileService].
 *
 *   POST http://10.0.2.2:8000/scan-base64
 *   Body: { "image": "<base64 JPEG, no data: prefix>" }
 *   200 success: { "success": true, "id_number": "…", "birth_date": "…", … }
 *   200 failure: { "success": false, "message": "Could not detect…" }
 */
object IDScanService {
    // 10.0.2.2 = emulator loopback; 192.168.8.24 = dev Mac on local Wi-Fi (real device)
    private const val BASE_URL = "http://192.168.8.24:8000"

    /**
     * Compresses [bitmap] to JPEG (quality 85), base64-encodes it, and POSTs it to the scan
     * endpoint. Returns an [IDScanResult] — always non-throwing; network / parse errors return
     * a failure result with the exception message.
     */
    suspend fun scan(bitmap: Bitmap): IDScanResult = withContext(Dispatchers.IO) {
        try {
            val baos = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, 85, baos)
            val b64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)

            val url = URL("$BASE_URL/scan-base64")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true
            conn.connectTimeout = 30_000
            conn.readTimeout = 30_000

            val body = JSONObject().put("image", b64).toString()
            conn.outputStream.use { it.write(body.toByteArray()) }

            val code = conn.responseCode
            val text = if (code in 200..299) {
                conn.inputStream.bufferedReader().readText()
            } else {
                conn.errorStream?.bufferedReader()?.readText() ?: "{}"
            }
            conn.disconnect()

            val json = JSONObject(text)
            IDScanResult(
                success     = json.optBoolean("success", false),
                idNumber    = json.optString("id_number").takeIf { it.isNotBlank() },
                birthDate   = json.optString("birth_date").takeIf { it.isNotBlank() },
                birthYear   = json.optInt("birth_year").takeIf { it != 0 },
                governorate = json.optString("governorate").takeIf { it.isNotBlank() },
                gender      = json.optString("gender").takeIf { it.isNotBlank() },
                message     = json.optString("message").takeIf { it.isNotBlank() }
            )
        } catch (e: Exception) {
            IDScanResult(success = false, message = e.message ?: "Unknown error")
        }
    }
}
