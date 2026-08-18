import Foundation

/// Email-address validation shared by every screen that takes an email
/// (sign-up / sign-in, password reset, profile settings).
///
/// Deliberately pragmatic rather than RFC-complete: the goal is to catch the
/// typos a real user makes — a missing `@`, a missing domain or TLD, a stray
/// space, a doubled dot — without rejecting addresses the backend would happily
/// accept. Anything that clears this still gets verified for real by the OTP
/// email, which is the actual proof the address exists.
///
/// Pure value logic (no SwiftUI, no actor) so it's trivially testable, matching
/// how `PasswordRules` is structured.
enum EmailRules {
    /// Longest address we accept — RFC 5321 caps a forward path at 254 chars.
    static let maxLength = 254

    /// `local@label(.label)*.tld` — the local part is a dot-atom (common symbols
    /// allowed, but no leading/trailing/doubled dot), each domain label starts
    /// and ends alphanumeric, and the TLD is at least two letters. Anchored,
    /// matched case-insensitively.
    private static let pattern =
        "^[A-Z0-9_%+-]+(?:\\.[A-Z0-9_%+-]+)*"
        + "@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)*\\.[A-Z]{2,}$"

    /// What we send to the backend: surrounding whitespace stripped. (Case is
    /// left alone — the server lowercases when it looks the account up.)
    static func normalized(_ raw: String) -> String {
        raw.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Whether `raw` looks like an address worth submitting.
    static func isValid(_ raw: String) -> Bool {
        let email = normalized(raw)
        guard !email.isEmpty, email.count <= maxLength else { return false }
        // `..` is legal only inside a quoted local part, which we don't accept.
        guard !email.contains("..") else { return false }
        return email.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
    }
}
