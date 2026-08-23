import Foundation

/// Name validation for every screen that takes a person's name — sign-up, Edit
/// profile, and the host application.
///
/// The Swift twin of the backend's `name-policy.ts`. Signup asked only that the
/// field be non-empty, so `12345` created an account whose display name is
/// `12345` — the name a host reads next to a booking request. The server refuses
/// that now; this checks the same thing before the request so a guest is told at
/// the field rather than after a round trip.
///
/// The rule that does the work is `invalidCharacters`: a name is made of letters
/// and nothing else. Letters in any script — Arabic, Latin, Cyrillic and the CJK
/// ideographs alike — plus the three characters that hold a real name together:
/// the space between its parts, the hyphen in `Jean-Luc`, the apostrophe in
/// `O'Brien`. Digits, `@`, `.`, `_`, emoji and every other symbol are refused.
///
/// This is stricter than the rule that shipped first, which asked only that a
/// name contain *some* letter and so accepted Franco-Arabic spellings like
/// `Ma7moud` and `3omar`. Those are refused now — the field is matched against
/// an ID document at verification, and `Ma7moud` is not what the document says.
///
/// KEEP IN SYNC with `name-policy.ts` and Android's `NameRules.kt`: all three
/// create accounts in the same `users` table, and a rule that only holds on one
/// of the three doors is not a rule.
///
/// Pure value logic (no SwiftUI, no actor) so it's trivially testable, matching
/// how `EmailRules` and `PasswordRules` are structured.
enum NameRules {
    /// Two letters. A one-character name is almost always a slip, not a mononym.
    static let minLetters = 2

    /// Longest name we send — the server refuses more.
    static let maxLength = 60

    /// Why a name was refused. The cases mirror the API's `nameProblem.code`, so
    /// a server rejection and a local one can show the same sentence.
    enum Problem {
        case missing
        case invalidCharacters
        case noLetters
        case tooShort
        case tooLong

        /// The localization key for this problem's message.
        var messageKey: String {
            switch self {
            case .missing: return "auth.fullName.required"
            case .invalidCharacters: return "auth.fullName.invalidCharacters"
            case .noLetters: return "auth.fullName.noLetters"
            case .tooShort: return "auth.fullName.tooShort"
            case .tooLong: return "auth.fullName.tooLong"
            }
        }
    }

    /// The characters a name may hold that are not letters: the space between
    /// its parts, the apostrophe of `O'Brien`, the hyphen of `Jean-Luc`.
    ///
    /// Both punctuation marks are listed twice because the keyboard does not
    /// send the one on the keycap: smart punctuation rewrites `'` to `’`
    /// (U+2019) as it is typed, and a name pasted from a document carries the
    /// typographic hyphens (U+2010, U+2011) with it. Refusing those would refuse
    /// `O’Brien` for a substitution the guest never made and cannot see.
    private static let allowedPunctuation: Set<Character> = [
        " ", "'", "\u{2019}", "-", "\u{2010}", "\u{2011}",
    ]

    /// Invisible characters a paste brings with it: the soft hyphen, the
    /// Mongolian vowel separator, the zero-width spaces and bidi marks, the BOM.
    /// They are not whitespace, so they survive the split below and render as
    /// nothing — the server strips them before it looks, and so must this, or a
    /// pasted name would be refused here for characters that never reach it.
    private static let invisible: Set<Unicode.Scalar> = {
        var set: Set<Unicode.Scalar> = ["\u{00AD}", "\u{180E}", "\u{FEFF}"]
        for range in [0x200B...0x200F, 0x202A...0x202E, 0x2060...0x2064] {
            for value in range {
                if let scalar = Unicode.Scalar(value) { set.insert(scalar) }
            }
        }
        return set
    }()

    /// What we send to the backend: invisibles dropped, whitespace runs
    /// collapsed, ends trimmed — so "  Layla   Hassan " and "Layla Hassan"
    /// arrive as one name. Matches the server's `normalizeName`.
    static func normalized(_ raw: String) -> String {
        let visible = String(String.UnicodeScalarView(raw.unicodeScalars.filter { !invisible.contains($0) }))
        return visible
            .split(whereSeparator: { $0.isWhitespace || $0.isNewline })
            .joined(separator: " ")
    }

    /// The problem with `raw`, or nil when it is usable as a name.
    ///
    /// Order matters: `invalidCharacters` is decided before `noLetters` and
    /// `tooShort`, so "5" and "A1" are told the thing that is actually wrong
    /// with them rather than being sent back to type another character.
    /// `noLetters` survives that for the names made entirely of the punctuation
    /// this rule does allow — "-----" — which are legal characters arranged into
    /// something that is still not a name.
    static func problem(with raw: String) -> Problem? {
        let name = normalized(raw)
        if name.isEmpty { return .missing }
        if name.count > maxLength { return .tooLong }
        // A Character here is a grapheme cluster, so `é` typed as `e` + U+0301
        // is one letter and not a letter followed by a stray mark — which is why
        // this needs no counterpart to the server's `\p{M}`.
        if name.contains(where: { !$0.isLetter && !allowedPunctuation.contains($0) }) {
            return .invalidCharacters
        }
        let letters = name.reduce(into: 0) { count, ch in if ch.isLetter { count += 1 } }
        if letters == 0 { return .noLetters }
        if letters < minLetters { return .tooShort }
        return nil
    }

    /// Whether `raw` is a name worth submitting.
    static func isValid(_ raw: String) -> Bool {
        problem(with: raw) == nil
    }
}
