import Foundation

/// Name validation for every screen that takes a person's name (sign-up today,
/// profile settings next).
///
/// The Swift twin of the backend's `name-policy.ts`. Signup asked only that the
/// field be non-empty, so `12345` created an account whose display name is
/// `12345` — the name a host reads next to a booking request. The server refuses
/// that now; this checks the same thing before the request so a guest is told at
/// the field rather than after a round trip.
///
/// The rule that does the work is `noLetters`: a name must contain letters.
/// Deliberately not "no digits" — Franco-Arabic writes real names with numerals
/// (`Ma7moud`, `3omar`), and refusing those would turn away exactly the guests
/// this app is built for. What it refuses is a name with no letters at all.
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
        case noLetters
        case tooShort
        case tooLong

        /// The localization key for this problem's message.
        var messageKey: String {
            switch self {
            case .missing: return "auth.fullName.required"
            case .noLetters: return "auth.fullName.noLetters"
            case .tooShort: return "auth.fullName.tooShort"
            case .tooLong: return "auth.fullName.tooLong"
            }
        }
    }

    /// What we send to the backend: whitespace runs collapsed, ends trimmed —
    /// so "  Layla   Hassan " and "Layla Hassan" arrive as one name.
    static func normalized(_ raw: String) -> String {
        raw.split(whereSeparator: { $0.isWhitespace || $0.isNewline })
            .joined(separator: " ")
    }

    /// The problem with `raw`, or nil when it is usable as a name.
    ///
    /// Order matters: `noLetters` is decided before `tooShort`, so "5" is told
    /// the thing that is actually wrong with it rather than being sent back to
    /// type a second digit.
    static func problem(with raw: String) -> Problem? {
        let name = normalized(raw)
        if name.isEmpty { return .missing }
        if name.count > maxLength { return .tooLong }
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
