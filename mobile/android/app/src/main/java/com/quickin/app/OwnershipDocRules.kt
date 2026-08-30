package com.quickin.app

/**
 * What a host may attach as proof of ownership — the Kotlin twin of the web's
 * `src/lib/local/ownership-doc-core.ts`, the file both Next.js backends run, and of iOS's
 * `OwnershipDocRules.swift`.
 *
 * A title deed, a utility bill or a syndicate letter reaches a host as a photo OR as a PDF
 * (registries, developers and utilities all issue PDFs), so three shapes are legal: an image data
 * URL, an `application/pdf` data URL, or an http(s) link. Both phones were image-only until
 * 2026-08-26 — the web has accepted PDFs since 2026-08-19 — which left a host holding a PDF deed
 * no option but to photograph it off their screen, and a screen photo of a deed is exactly the
 * document /ops keeps rejecting as illegible.
 *
 * A PDF is stored exactly as it was picked. There is nothing to downscale, so [MAX_CHARS] is a cap
 * hosts actually meet: 3.5M chars of data URL is roughly a 2.5 MB file once base64 has added its
 * third. The pickers check it before the request goes out, so the host is told which file is too
 * big rather than that "saving failed".
 *
 * Word documents are deliberately NOT accepted: /ops streams these bytes into an operator's
 * browser and a .docx cannot be displayed there — an unreviewable document is worse than a
 * refused upload.
 *
 * Pure Kotlin: no Android imports, no `android.util.Base64`, so the JVM unit test
 * (`OwnershipDocRulesTest`) runs it directly. The encoding half lives in [OwnershipDocLoader].
 */
object OwnershipDocRules {

    /** Cap on an inline proof-of-ownership document (~3.5M chars of base64) — the API's number. */
    const val MAX_CHARS = 3_500_000

    /**
     * Base64 of `%PDF-`, the five bytes every PDF opens with.
     *
     * The mime a picker reports is whatever the provider wrote there, and Android hands back
     * `application/octet-stream` for a .pdf often enough that trusting the label alone would refuse
     * real documents and admit fake ones. The payload's first bytes are the thing that cannot lie,
     * so they decide.
     */
    private const val PDF_BASE64_MAGIC = "JVBERi0"

    /** The same five bytes unencoded — what a file picked out of the document picker looks like. */
    private val PDF_MAGIC_BYTES = "%PDF-".toByteArray(Charsets.US_ASCII)

    /** How an attached document can fail. Screens map this to a string resource, not to text. */
    enum class Problem {
        /** Nothing attached at all. */
        MISSING,

        /** Attached, but not a shape we store (a .docx, an SVG, a stray string). */
        UNSUPPORTED,

        /** A real document, but past [MAX_CHARS]. */
        TOO_LARGE;

        /**
         * The string resource shown to the host. MISSING and UNSUPPORTED share one, as they do on
         * the web: from the form's side "nothing attached" and "that file isn't a document we take"
         * have the same fix.
         */
        val messageRes: Int
            get() = if (this == TOO_LARGE) R.string.approval_doc_too_large
            else R.string.approval_doc_unsupported
    }

    /** True when [bytes] open with `%PDF-` — the only thing that makes a file a PDF here. */
    fun isPdfBytes(bytes: ByteArray): Boolean {
        if (bytes.size < PDF_MAGIC_BYTES.size) return false
        for (i in PDF_MAGIC_BYTES.indices) if (bytes[i] != PDF_MAGIC_BYTES[i]) return false
        return true
    }

    /** True for a `data:application/pdf;base64,…` URL whose bytes really are a PDF. */
    fun isPdfDataUrl(value: String?): Boolean {
        val (header, payload) = split(value) ?: return false
        if (!header.contains("application/pdf") || !header.contains("base64")) return false
        return payload.startsWith(PDF_BASE64_MAGIC)
    }

    /**
     * True for a `data:image/…;base64,…` URL. SVG is an image by mime and a script host in
     * practice, so /ops refuses to render one — refusing it here too means the host is told at pick
     * time instead of storing a document no operator can open.
     */
    fun isImageDataUrl(value: String?): Boolean {
        val (header, _) = split(value) ?: return false
        if (!header.startsWith("data:image/") || !header.contains("base64")) return false
        return !header.startsWith("data:image/svg")
    }

    /** True for a value we would store in `listings.ownership_doc` (size aside). */
    fun isOwnershipDocSrc(value: String?): Boolean {
        val doc = value?.trim().orEmpty()
        if (isImageDataUrl(doc) || isPdfDataUrl(doc)) return true
        val lower = doc.lowercase()
        return (lower.startsWith("http://") || lower.startsWith("https://")) &&
            doc.none { it.isWhitespace() }
    }

    /** What is wrong with an attached document, or null when nothing is. */
    fun check(value: String?): Problem? {
        val doc = value?.trim().orEmpty()
        if (doc.isEmpty()) return Problem.MISSING
        if (!isOwnershipDocSrc(doc)) return Problem.UNSUPPORTED
        // Checked last: a 4 MB JPEG should be told it is too large, not "unsupported".
        if (doc.length > MAX_CHARS) return Problem.TOO_LARGE
        return null
    }

    /**
     * Split a data URL into its lowercased header (everything before the comma) and the head of its
     * payload, whitespace squeezed out of both — a base64 payload can arrive line-wrapped, and only
     * the first few characters are ever compared.
     */
    private fun split(value: String?): Pair<String, String>? {
        val doc = value?.trim().orEmpty()
        if (!doc.startsWith("data:", ignoreCase = true)) return null
        val comma = doc.indexOf(',')
        if (comma < 0) return null
        val header = doc.substring(0, comma).lowercase().filterNot { it.isWhitespace() }
        val payload = doc.substring(comma + 1).take(64).filterNot { it.isWhitespace() }
        return header to payload
    }
}
