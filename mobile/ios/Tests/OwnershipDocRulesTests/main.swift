// Unit tests for Sources/OwnershipDocRules.swift — the Swift mirror of the backend's
// test/unit/ownership-doc-core.test.mjs and of Android's OwnershipDocRulesTest.kt.
//
// The reported defect: **both ownership-document upload entry points on iOS and Android accepted
// only image files**, so a host holding a PDF deed — the shape a registry, developer or utility
// actually issues — had to photograph it off their screen. The web has taken
// `image/*,application/pdf` since 2026-08-19; the API stores either. These tests pin the three
// answers the phone now has to give the same way the web does: what a PDF looks like, what is
// refused outright, and where the size cap bites.
//
// This app has no XCTest target, so the suite is a plain executable over the same pure file the
// app compiles — no UIKit, no SwiftUI, no simulator:
//
//     cd mobile/ios && ./Tests/run.sh
//
// Exits non-zero if any check fails. `Tests/` is outside the target's `sources:` in project.yml,
// so none of this is compiled into the app.
import Foundation

var failures = 0
var checks = 0

func check(_ condition: Bool, _ label: String) {
    checks += 1
    if condition {
        print("  PASS \(label)")
    } else {
        print("  FAIL \(label)")
        failures += 1
    }
}

/// A `data:application/pdf` URL whose payload really is a PDF.
let pdfBytes = Data("%PDF-1.7\nreal deed bytes".utf8)
let realPdf = OwnershipDocRules.pdfDataURL(from: pdfBytes) ?? ""
let jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=="

print("\nA PDF is a document — the whole point of the fix")
check(!realPdf.isEmpty, "PDF bytes encode to a data URL")
check(realPdf.hasPrefix("data:application/pdf;base64,"), "encoded with the pdf mime")
check(OwnershipDocRules.isPdfDataURL(realPdf), "isPdfDataURL accepts it")
check(OwnershipDocRules.isOwnershipDocSrc(realPdf), "storable as an ownership doc")
check(OwnershipDocRules.check(realPdf) == nil, "no problem with it")

print("\nThe mime label alone is not trusted — the first bytes decide")
// A .docx (or anything else) relabelled as a PDF by the picker: the payload is not `%PDF-`.
let fakePdf = "data:application/pdf;base64," + Data("PK\u{03}\u{04}not a pdf".utf8).base64EncodedString()
check(!OwnershipDocRules.isPdfDataURL(fakePdf), "a mislabelled payload is not a PDF")
check(OwnershipDocRules.check(fakePdf) == .unsupported, "and is refused")
check(OwnershipDocRules.pdfDataURL(from: Data("PK\u{03}\u{04}".utf8)) == nil, "non-PDF bytes encode to nothing")
check(OwnershipDocRules.pdfDataURL(from: Data()) == nil, "empty bytes encode to nothing")

print("\nPhotos still work — the fix ADDS a shape, it replaces nothing")
check(OwnershipDocRules.isImageDataURL(jpeg), "a JPEG data URL is an image")
check(OwnershipDocRules.check(jpeg) == nil, "and is accepted")
check(OwnershipDocRules.check("https://example.com/deed.pdf") == nil, "an http(s) link is accepted")

print("\nWhat stays refused")
// SVG is an image by mime and a script host in practice; /ops will not render one.
check(OwnershipDocRules.check("data:image/svg+xml;base64,PHN2Zz4=") == .unsupported, "SVG refused")
check(
    OwnershipDocRules.check("data:application/msword;base64,0M8R4A==") == .unsupported,
    "a Word document is refused — /ops cannot display one"
)
check(OwnershipDocRules.check("") == .missing, "nothing attached is 'missing'")
check(OwnershipDocRules.check("   ") == .missing, "whitespace is nothing attached")
check(OwnershipDocRules.check("deed.pdf") == .unsupported, "a bare filename is refused")

print("\nThe size cap, and the order the questions are asked in")
let oversizedPdf = "data:application/pdf;base64,JVBERi0" + String(repeating: "A", count: OwnershipDocRules.maxCharacters)
check(OwnershipDocRules.check(oversizedPdf) == .tooLarge, "an oversized PDF is 'too large', not 'unsupported'")
let oversizedJunk = "data:application/msword;base64,A" + String(repeating: "A", count: OwnershipDocRules.maxCharacters)
check(OwnershipDocRules.check(oversizedJunk) == .unsupported, "an oversized non-document is still 'unsupported'")
check(OwnershipDocRules.maxCharacters == 3_500_000, "same cap the API enforces")

print("\nEach problem names a localized sentence")
check(OwnershipDocRules.Problem.tooLarge.localizationKey == "approval.docTooLarge", "too large has its own key")
check(
    OwnershipDocRules.Problem.missing.localizationKey == OwnershipDocRules.Problem.unsupported.localizationKey,
    "missing and unsupported share one, as on the web"
)

print("\n\(checks - failures)/\(checks) checks passed")
if failures > 0 {
    print("\(failures) FAILED")
    exit(1)
}
