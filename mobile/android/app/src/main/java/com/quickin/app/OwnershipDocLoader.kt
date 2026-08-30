package com.quickin.app

import android.content.Context
import android.net.Uri
import android.util.Base64

/**
 * Turns a file the host picked into the `ownership_doc` value the API stores — the one path every
 * ownership-document upload on Android goes through (the add-listing wizard, the listing editor,
 * and the "(Re-)upload ownership document" button on a host's own listing card).
 *
 * Two shapes come out, matching the accept attribute on the web's file input (any image, plus
 * `application/pdf`):
 *  • a **PDF** is kept byte-for-byte (`data:application/pdf;base64,…`). There is nothing to
 *    downscale, and re-encoding a deed is how you make it illegible — so the size cap is the only
 *    thing standing between the host and a rejected request, and it is checked here.
 *  • **anything else** has to decode as an image, and takes the same downscale-to-1200px JPEG
 *    pipeline the photos take ([AvatarImage.loadDownscaledJpegDataUrl]).
 *
 * Refusals come back as an [OwnershipDocRules.Problem] so the caller can show the host which file
 * to fix, rather than dropping the pick in silence — which is what every screen did before.
 *
 * Blocking I/O: call it off the main thread (`withContext(Dispatchers.IO)`).
 */
object OwnershipDocLoader {

    /** Longest edge (px) a photographed document is downscaled to — larger than a review photo. */
    const val MAX_DOC_DIM = 1200

    /** The result of a pick: a `data:` URL ready to send, or why it was refused. */
    sealed interface Result {
        data class Loaded(val dataUrl: String) : Result
        data class Failed(val problem: OwnershipDocRules.Problem) : Result
    }

    /**
     * Read the document at [uri] (a document-picker result) and encode it. Returns
     * [Result.Failed] with [OwnershipDocRules.Problem.TOO_LARGE] for a real document that is
     * simply too big, and with `UNSUPPORTED` for anything we cannot store or display in /ops.
     */
    fun load(context: Context, uri: Uri): Result {
        val bytes = try {
            context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
        } catch (_: Exception) {
            null
        } ?: return Result.Failed(OwnershipDocRules.Problem.UNSUPPORTED)

        val dataUrl = if (OwnershipDocRules.isPdfBytes(bytes)) {
            "data:application/pdf;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
        } else {
            // Not a PDF, so it has to be an image — a .docx or a stray file falls out here.
            AvatarImage.loadDownscaledJpegDataUrl(context, uri, maxDim = MAX_DOC_DIM)
        } ?: return Result.Failed(OwnershipDocRules.Problem.UNSUPPORTED)

        OwnershipDocRules.check(dataUrl)?.let { return Result.Failed(it) }
        return Result.Loaded(dataUrl)
    }

    /** The mime types the document picker offers — the web's accept attribute, verbatim. */
    val PICKER_MIME_TYPES = arrayOf("image/*", "application/pdf")
}
