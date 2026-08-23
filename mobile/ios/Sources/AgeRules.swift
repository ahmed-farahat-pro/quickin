import Foundation

/// Age validation for Edit profile — the one screen on iOS that writes
/// `users.age`.
///
/// The Swift twin of the backend's `profile-core.ts` (`MIN_AGE`, `MAX_AGE`,
/// `parseAge`, `checkAge`), and the counterpart of the digit filter Android's
/// `ProfileSettingsScreen` has always had.
///
/// The field took any string the number pad could produce and handed it to
/// `Int(_:)`, so `01012345678` was stored as the age `1012345678`. That is not a
/// slipped keystroke — it is a phone number in a field that renders as free text
/// next to a name, which is exactly what `contentguard.ts` keeps out of the
/// name, the bio and every chat message. A guard that watches the two text
/// fields either side of this one and not this one is not a guard, so the age
/// is now a number in a plausible range and nothing else.
///
/// The bounds are a plausibility check, not an eligibility rule — the same
/// wording `profile-core.ts` carries: whether an account has to be 18 to book is
/// a decision for the booking door, where it can be held against an ID document,
/// not for a number the user types about themselves.
///
/// KEEP IN SYNC with `profile-core.ts`, whose copies the backend's
/// `check-profile-core-parity.mjs` holds together. The bounds are also spelled
/// out in the `settings.age.*` strings in `Localization.swift` — there is no
/// interpolation in `L.t`, so changing one means changing the other.
///
/// Pure value logic (no SwiftUI, no actor), matching how `NameRules`,
/// `EmailRules` and `PhoneRules` are structured.
enum AgeRules {
    /// The narrowest and widest age we will store.
    static let minAge = 13
    static let maxAge = 120

    /// Three digits — `maxAge` is three, and a fourth can only be a year, a
    /// phone number or a slip. This is what stops `01012345678` at the keyboard
    /// rather than at the save button.
    static let maxDigits = 3

    /// Why an age was refused. The cases mirror the API's `ageProblem.code`, so
    /// a server rejection and a local one show the same sentence.
    enum Problem {
        case notANumber
        case tooYoung
        case tooOld

        /// The localization key for this problem's message.
        var messageKey: String {
            switch self {
            case .notANumber: return "settings.age.notANumber"
            case .tooYoung: return "settings.age.tooYoung"
            case .tooOld: return "settings.age.tooOld"
            }
        }
    }

    /// Invisible characters a paste brings with it — the same set `NameRules`
    /// strips, and for the same reason: they survive `.trim()` and render as
    /// nothing, so a field holding only those would otherwise read as filled in.
    private static let invisible: Set<Unicode.Scalar> = {
        var set: Set<Unicode.Scalar> = ["\u{00AD}", "\u{180E}", "\u{FEFF}"]
        for range in [0x200B...0x200F, 0x202A...0x202E, 0x2060...0x2064] {
            for value in range {
                if let scalar = Unicode.Scalar(value) { set.insert(scalar) }
            }
        }
        return set
    }()

    /// Arabic-Indic (`٣٤`) and Persian (`۳۴`) digits folded to ASCII. The app
    /// runs in Arabic and the number pad on an Arabic keyboard sends those, so a
    /// rule that only understood ASCII would refuse a guest typing their own age
    /// correctly. `profile-core.ts` folds the same two ranges.
    static func toAsciiDigits(_ raw: String) -> String {
        String(raw.map { character in
            guard let value = character.unicodeScalars.first?.value,
                  character.unicodeScalars.count == 1,
                  (0x0660...0x0669).contains(value) || (0x06F0...0x06F9).contains(value)
            else { return character }
            return Character(String(value & 0xF))
        })
    }

    /// True when the field was left empty — which is not an error. Age is
    /// optional, and clearing it is a thing a person is allowed to do.
    static func isBlank(_ raw: String) -> Bool {
        visible(raw).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// What the field should hold after a keystroke: the ASCII form of whatever
    /// digits were typed, and at most `maxDigits` of them. Everything else is
    /// dropped — a `.numberPad` cannot produce it, so it can only have arrived
    /// on a paste.
    static func capped(_ raw: String) -> String {
        String(toAsciiDigits(visible(raw)).filter(\.isNumber).prefix(maxDigits))
    }

    /// The age to store, or nil when the field is empty or holds something that
    /// is not a plain whole number.
    ///
    /// Deliberately stricter than `Int(_:)`, which happily reads `1012345678`
    /// and (via `Double`) values like `3e2`. Callers ask `problem(with:)` first,
    /// so the two never disagree about a value that would be sent.
    static func parsed(_ raw: String) -> Int? {
        if isBlank(raw) { return nil }
        let digits = toAsciiDigits(visible(raw)).trimmingCharacters(in: .whitespacesAndNewlines)
        guard digits.count <= maxDigits, !digits.isEmpty, digits.allSatisfy(\.isNumber) else { return nil }
        return Int(digits)
    }

    /// The problem with `raw`, or nil when it is an age worth storing — which
    /// includes an empty field, since the age is optional.
    static func problem(with raw: String) -> Problem? {
        if isBlank(raw) { return nil }
        guard let age = parsed(raw) else { return .notANumber }
        if age < minAge { return .tooYoung }
        if age > maxAge { return .tooOld }
        return nil
    }

    /// Whether `raw` is an age worth submitting.
    static func isValid(_ raw: String) -> Bool {
        problem(with: raw) == nil
    }

    /// `raw` with the invisible characters dropped.
    private static func visible(_ raw: String) -> String {
        String(String.UnicodeScalarView(raw.unicodeScalars.filter { !invisible.contains($0) }))
    }
}
