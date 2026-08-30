import Foundation

/// What a host may attach as proof of ownership — the Swift twin of the web's
/// `src/lib/local/ownership-doc-core.ts`, the file both Next.js backends run.
///
/// A title deed, a utility bill or a syndicate letter reaches a host as a photo
/// OR as a PDF (registries, developers and utilities all issue PDFs), so three
/// shapes are legal: an image data URL, an `application/pdf` data URL, or an
/// http(s) link. Both phones were image-only until 2026-08-26 — the web accepted
/// PDFs from 2026-08-19 — which left a host holding a PDF deed no option but to
/// photograph it off their screen, and a screen photo of a deed is exactly the
/// document /ops keeps rejecting as illegible.
///
/// A PDF is stored exactly as it was picked. There is nothing to downscale, so
/// `maxCharacters` is a cap hosts actually meet: 3.5M chars of data URL is
/// roughly a 2.5 MB file once base64 has added its third. The pickers check it
/// before the request goes out, so the host is told which file is too big rather
/// than that "saving failed".
///
/// Word documents are deliberately NOT accepted: /ops streams these bytes into
/// an operator's browser and a .docx cannot be displayed there — an unreviewable
/// document is worse than a refused upload.
///
/// Pure: no SwiftUI, no UIKit, no network — the screens turn a `Problem` into a
/// localized sentence, this decides only what is wrong. Tested by
/// `Tests/OwnershipDocRulesTests` (see `Tests/run.sh`).
///
/// KEEP IN SYNC — ownership-doc-core.ts (web + backend) and Android's
/// `OwnershipDocRules.kt` answer the same three questions with the same numbers.
enum OwnershipDocRules {

    /// Cap on an inline proof-of-ownership document (~3.5M chars of base64),
    /// the same number the API enforces.
    static let maxCharacters = 3_500_000

    /// Base64 of `%PDF-`, the five bytes every PDF opens with.
    ///
    /// The mime in a data URL is whatever the picker wrote there, and iOS hands
    /// back `application/octet-stream` for a .pdf often enough that trusting the
    /// label alone would refuse real documents and admit fake ones. The payload's
    /// first bytes are the thing that cannot lie, so they decide.
    private static let pdfBase64Magic = "JVBERi0"

    /// The same five bytes, unencoded — what a file picked out of Files looks
    /// like before it is base64'd.
    private static let pdfMagicBytes: [UInt8] = Array("%PDF-".utf8)

    /// How an attached document can fail. Screens switch on this, not on text.
    enum Problem {
        /// Nothing attached at all.
        case missing
        /// Attached, but not a shape we store (a .docx, an SVG, a stray string).
        case unsupported
        /// A real document, but past `maxCharacters`.
        case tooLarge

        /// The localization key for the sentence shown to the host. `missing`
        /// and `unsupported` share one, as they do on the web: from the form's
        /// side "nothing attached" and "that file isn't a document we take" have
        /// the same fix.
        var localizationKey: String {
            self == .tooLarge ? "approval.docTooLarge" : "approval.docUnsupported"
        }
    }

    /// True for a `data:application/pdf;base64,…` URL whose bytes really are a PDF.
    static func isPdfDataURL(_ value: String) -> Bool {
        guard let (header, payload) = split(value) else { return false }
        guard header.contains("application/pdf"), header.contains("base64") else { return false }
        return payload.hasPrefix(pdfBase64Magic)
    }

    /// True for a `data:image/…;base64,…` URL. SVG is an image by mime and a
    /// script host in practice, so /ops refuses to render it — refusing it here
    /// too means the host is told at pick time instead of storing a document no
    /// operator can open.
    static func isImageDataURL(_ value: String) -> Bool {
        guard let (header, _) = split(value) else { return false }
        guard header.hasPrefix("data:image/"), header.contains("base64") else { return false }
        return !header.hasPrefix("data:image/svg")
    }

    /// True for a value we would store in `listings.ownership_doc` (size aside).
    static func isOwnershipDocSrc(_ value: String) -> Bool {
        let doc = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if isImageDataURL(doc) || isPdfDataURL(doc) { return true }
        let lower = doc.lowercased()
        return (lower.hasPrefix("http://") || lower.hasPrefix("https://"))
            && !doc.contains(where: { $0.isWhitespace })
    }

    /// What is wrong with an attached document, or nil when nothing is.
    static func check(_ value: String) -> Problem? {
        let doc = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if doc.isEmpty { return .missing }
        if !isOwnershipDocSrc(doc) { return .unsupported }
        // Checked last: a 4 MB JPEG should be told it is too large, not "unsupported".
        if doc.count > maxCharacters { return .tooLarge }
        return nil
    }

    /// Wrap PDF bytes as a data URL, or nil when the bytes are not a PDF — the
    /// only gate between "the picker said .pdf" and what we send. Size is left
    /// to `check`, so an oversized deed is reported as too large rather than
    /// unreadable.
    static func pdfDataURL(from data: Data) -> String? {
        guard data.count >= pdfMagicBytes.count else { return nil }
        guard Array(data.prefix(pdfMagicBytes.count)) == pdfMagicBytes else { return nil }
        return "data:application/pdf;base64,\(data.base64EncodedString())"
    }

    /// Split a data URL into its lowercased header (everything before the comma)
    /// and its payload, with whitespace squeezed out of both — a base64 payload
    /// off a file picker can arrive line-wrapped.
    private static func split(_ value: String) -> (header: String, payload: String)? {
        let doc = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard doc.lowercased().hasPrefix("data:"), let comma = doc.firstIndex(of: ",") else { return nil }
        let header = doc[doc.startIndex..<comma].lowercased().filter { !$0.isWhitespace }
        let payload = doc[doc.index(after: comma)...].prefix(64).filter { !$0.isWhitespace }
        return (header, String(payload))
    }
}
