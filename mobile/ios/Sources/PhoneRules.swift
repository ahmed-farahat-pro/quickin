import Foundation

/// Egyptian phone-number rules for every screen that takes a phone number
/// (the host application today, profile settings and payouts next).
///
/// The Swift twin of the web's `EG_MOBILE_REGEX` / `EG_LANDLINE_REGEX` in
/// `src/lib/constants.ts`: a mobile is `+20` + `1[0125]` + 8 digits, a landline
/// is `+20` + `[2-9]` + 7-8 digits. The host application only asked that the
/// field be non-empty, so a guest could keep typing digits well past a real
/// number and only find out after an operator failed to reach them.
///
/// Everything works on the **national significant number** (the digits after
/// the country code and the trunk `0`), so the same rules accept every form a
/// guest actually types: `01001234567`, `+20 100 123 4567`, `00201001234567`.
///
/// Pure value logic (no SwiftUI, no actor) so it's trivially testable, matching
/// how `NameRules` and `EmailRules` are structured.
enum PhoneRules {
    /// Longest national significant number Egypt issues — a 10-digit mobile
    /// (`1XXXXXXXXX`). Landlines are shorter, so this is the cap for input.
    static let maxNationalDigits = 10

    /// `1[0125]` + 8 digits — Vodafone / Etisalat / Orange / WE.
    private static let mobilePattern = "^1[0125][0-9]{8}$"

    /// `[2-9]` + 7-8 digits — the region codes with their subscriber number.
    private static let landlinePattern = "^[2-9][0-9]{6,8}$"

    /// The digits of `raw`, with the country code (`+20` / `0020` / `20`) and
    /// the trunk `0` stripped — i.e. the national significant number.
    ///
    /// A number written nationally always starts with the trunk `0`, so a
    /// leading `20` that isn't preceded by one can only be the country code.
    static func nationalDigits(_ raw: String) -> String {
        var digits = Substring(raw.filter(\.isNumber))
        if digits.hasPrefix("0020") {
            digits = digits.dropFirst(4)
        } else if digits.hasPrefix("20") {
            digits = digits.dropFirst(2)
        }
        if digits.hasPrefix("0") {
            digits = digits.dropFirst()
        }
        return String(digits)
    }

    /// What we send to the backend: the number in `+20…` form, so two guests who
    /// typed `01001234567` and `+20 100 123 4567` are stored the same way.
    /// Returns `raw` trimmed when it isn't a number we recognise, so an
    /// unexpected format is never silently mangled.
    static func normalized(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard isValid(trimmed) else { return trimmed }
        return "+20" + nationalDigits(trimmed)
    }

    /// Whether `raw` is an Egyptian mobile or landline worth submitting.
    static func isValid(_ raw: String) -> Bool {
        let national = nationalDigits(raw)
        guard !national.isEmpty else { return false }
        return national.range(of: mobilePattern, options: .regularExpression) != nil
            || national.range(of: landlinePattern, options: .regularExpression) != nil
    }

    /// `raw` with any digit past a full Egyptian number dropped, so the field
    /// simply stops accepting input instead of letting a guest type a number
    /// that can't be dialled. The characters a guest uses to space a number out
    /// (`+`, spaces, dashes, brackets) are kept as typed; anything else —
    /// letters from a paste, say — is dropped, since `.phonePad` can't produce
    /// them anyway.
    ///
    /// The allowance is measured from the prefix in front of the number, so
    /// every form gets the room it needs: 10 digits after `+20`, 11 after a
    /// national `0`, 14 for a fully-written `0020…`.
    static func capped(_ raw: String) -> String {
        let allowance = countryPrefixLength(raw) + maxNationalDigits
        var kept = ""
        var digitsKept = 0
        for character in raw {
            if character.isNumber {
                guard digitsKept < allowance else { continue }
                digitsKept += 1
                kept.append(character)
            } else if character == "+" {
                // A `+` only means anything as the very first character.
                if kept.isEmpty { kept.append(character) }
            } else if character == " " || character == "-" || character == "(" || character == ")" {
                kept.append(character)
            }
        }
        // A separator is fine mid-typing ("+20 100 " waiting for the next
        // digit), but once the number is full a trailing one is just the tail
        // of what was refused.
        if digitsKept == allowance {
            while let last = kept.last, !last.isNumber {
                kept.removeLast()
            }
        }
        return kept
    }

    /// How many leading digits of `raw` are country code and trunk `0` rather
    /// than part of the number itself.
    private static func countryPrefixLength(_ raw: String) -> Int {
        let digits = raw.filter(\.isNumber)
        if digits.hasPrefix("0020") { return 4 }
        if digits.hasPrefix("20") { return 2 }
        if digits.hasPrefix("0") { return 1 }
        return 0
    }
}
