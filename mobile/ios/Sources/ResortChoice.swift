import Foundation

/// The resort / compound a listing sits in — the host's dropdown choice and the
/// rule for the name they may type when the catalog doesn't have theirs.
///
/// The web listing form has asked this question since the catalog shipped; both
/// apps never asked it at all, so every listing created on a phone reached the
/// database with no resort: it missed every resort filter, and the compound a
/// guest actually searches for was only ever guessable from the free-text
/// address line. Nothing was wrong on the server — `POST /api/local/listings`
/// has always accepted `resort_id` / `resort_name` — the two clients simply
/// never sent either.
///
/// This is the Swift translation of two web modules, kept deliberately small:
/// • `src/lib/resort-choice.ts` — the FORM rule ("what may be submitted"), i.e.
///   picking "Other" and leaving the box blank is not "no resort".
/// • the naming half of `src/lib/local/resort-core.ts` — what counts as a name.
/// Android carries the same rule again in `ResortChoice.kt`. All the copies are
/// updated by hand, so [minNameLetters], [maxNameLength] and the order of the
/// checks in [check] are the things to keep in step.
///
/// What is NOT here, on purpose: `resortSlug`, alias matching and the submission
/// queue. Those decide which catalog row a typed name BECOMES, which is a
/// database question the server answers on the way in — a phone that guessed at
/// it would only ever be a second opinion the write path ignores.
enum ResortChoice {

    /// Longest name the column stores. Long enough for "Sidi Abdel Rahman Bay
    /// Resort", short enough that a paste accident can't fill the field.
    static let maxNameLength = 120

    /// Enough letters to be a name. `A5` is a villa number, not a compound.
    static let minNameLetters = 2

    /// Invisible characters people paste in without meaning to: the soft hyphen,
    /// the Mongolian vowel separator, the zero-width spaces and bidi marks, the
    /// BOM. They survive a trim and render as nothing, so a "name" made only of
    /// them would otherwise read as non-empty.
    private static let invisibles = CharacterSet(charactersIn: "\u{00AD}\u{180E}\u{200B}\u{200C}\u{200D}\u{200E}\u{200F}\u{202A}\u{202B}\u{202C}\u{202D}\u{202E}\u{2060}\u{2061}\u{2062}\u{2063}\u{2064}\u{FEFF}")

    /// Why a typed resort name was refused. The raw values are the same codes the
    /// API echoes and the web reads its `errors.resortName.*` strings by, so the
    /// three surfaces localize one vocabulary.
    enum ProblemCode: String {
        case required
        case letters
        case tooShort
    }

    struct Problem: Equatable {
        let code: ProblemCode
    }

    /// Clean a host-typed name for display: drop invisibles, collapse runs of
    /// whitespace, trim, cap the length. Returns nil for anything blank, which is
    /// how "the host left it empty" is represented everywhere downstream.
    ///
    /// Capitalisation and punctuation are preserved on purpose — the raw text is
    /// shown to guests as typed until an admin approves a canonical spelling.
    static func normalizeName(_ input: String?) -> String? {
        guard let input else { return nil }
        let stripped = String(input.unicodeScalars.filter { !invisibles.contains($0) })
        let collapsed = stripped
            .components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        let capped = String(collapsed.prefix(maxNameLength))
        return capped.isEmpty ? nil : capped
    }

    /// Decide a host-typed resort name. Returns the first problem, or nil when it
    /// is acceptable.
    ///
    /// Order matters: `.letters` is checked before `.tooShort` so `@@@@@` is told
    /// the thing that is actually wrong with it ("write it in words") rather than
    /// being sent back to add a sixth `@`.
    ///
    /// The rule that does the work is `.letters`: a compound name must contain
    /// letters, in ANY script — `Marassi (North)`, `Sa7el Chalet` and
    /// `هاسيندا باي` are all real names a host may type. What it refuses is a
    /// name with no letters at all (`@@@@@`, `12345`, `-----`), which the server
    /// cannot slug and therefore stores as no resort whatsoever: the host's
    /// answer silently discarded.
    ///
    /// Only ever applied to text the host TYPED. A resort picked from the
    /// catalog has already been through /ops, and "not in a resort" is a
    /// legitimate answer — neither goes anywhere near this.
    static func check(_ input: String?) -> Problem? {
        guard let value = normalizeName(input) else { return Problem(code: .required) }
        let letters = value.reduce(into: 0) { total, ch in if ch.isLetter { total += 1 } }
        if letters == 0 { return Problem(code: .letters) }
        if letters < minNameLetters { return Problem(code: .tooShort) }
        return nil
    }

    /// True when [check] has nothing to say — the gate on Next / Publish / Save.
    static func isValidName(_ input: String?) -> Bool { check(input) == nil }

    /// The sentence to show the host, localized. `tooShort` names the floor, so
    /// the string carries one `%@`; the other two ignore it.
    @MainActor
    static func message(_ problem: Problem) -> String {
        String(format: L.t("listing.blocked.resortName.\(problem.code.rawValue)"), "\(minNameLetters)")
    }

    /// What the host's dropdown choice currently is. `.none` and `.catalog` are
    /// both complete answers; `.other` is the only one that needs a name with it.
    enum Selection: Equatable {
        /// "Not in a resort or compound".
        case none
        /// A row from `GET /api/local/resorts`, sent as `resort_id`.
        case catalog(id: String)
        /// "Other — not listed": free text, sent as `resort_name`.
        case other
    }

    /// What a listing write should send for a given choice, or nil for the field
    /// that doesn't apply. A listing points at EITHER a catalog resort or free
    /// text, never both — a CHECK constraint enforces it server-side.
    static func payload(_ selection: Selection, typedName: String) -> (resortId: String?, resortName: String?) {
        switch selection {
        case .none:
            return (nil, nil)
        case .catalog(let id):
            return (id, nil)
        case .other:
            return (nil, normalizeName(typedName))
        }
    }

    /// Why the resort answer blocks the step, or nil when it doesn't.
    ///
    /// Only "Other" is ever refused, and only for the name: a host who hasn't
    /// touched the field has answered "not in a resort", which is fine. Without
    /// this the submit went through with no name at all and the server — which
    /// cannot tell a blank name from "no resort chosen" — saved the listing with
    /// NO resort: the host's answer silently discarded.
    @MainActor
    static func blocker(_ selection: Selection, typedName: String) -> String? {
        guard selection == .other, let problem = check(typedName) else { return nil }
        return message(problem)
    }
}
