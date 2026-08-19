import Foundation

/// Email-address validation shared by every screen that takes an email
/// (sign-up / sign-in, password reset, profile settings).
///
/// Until 2026-08-19 this was a shape check and nothing more, which let two
/// classes of address straight through to a backend that checked even less:
///
/// * `layla@email.con` — perfectly well-formed, and undeliverable forever,
///   because `.con` is not a delegated top-level domain. The guest then sat on
///   the OTP screen waiting for a code that did not exist. No regex can catch
///   this; only the root zone knows which extensions are real.
/// * `x@mailinator.com` — a temp-mail box that receives the OTP just fine,
///   which is exactly the problem: verifying the code proves the mailbox
///   exists, not that anybody owns it.
///
/// The rules now mirror the server's `email-core.ts` tier for tier, and the
/// data they run on (`EmailData`) is GENERATED from that same file — see
/// `mobile/scripts/gen-email-rules.mjs`. Nothing here is a second opinion: the
/// point is that the phone refuses exactly what the API would have refused,
/// one round trip earlier.
///
/// Pure value logic (no SwiftUI, no actor) so it's trivially testable, matching
/// how `PasswordRules` and `NameRules` are structured.
enum EmailRules {
    /// Longest address we accept — RFC 5321 caps a forward path at 254 chars.
    static let maxLength = 254
    private static let maxLocalLength = 64
    private static let maxLabelLength = 63

    /// What is wrong with an address, in the order the checks run.
    enum Problem: Equatable {
        case required
        case tooLong
        /// Not a well-formed address at all.
        case format
        /// Well-formed, but the extension is not a delegated TLD.
        /// `suggestion` is a better whole domain to try, when we have a
        /// confident guess (`gmail.con` → `gmail.com`).
        case unknownTld(tld: String, suggestion: String?)
        /// A known temp-mail provider.
        case disposable
    }

    // ---- Normalization ----------------------------------------------------

    /// What we send to the backend: surrounding whitespace stripped and the
    /// domain lowercased, matching the server's `normalizeEmail`. The local
    /// part keeps its case — the server looks accounts up case-insensitively,
    /// but only the domain is safe to fold in general.
    static func normalized(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let at = trimmed.lastIndex(of: "@") else { return trimmed }
        let local = trimmed[trimmed.startIndex..<at]
        let domain = trimmed[trimmed.index(after: at)...]
        return local + "@" + domain.lowercased()
    }

    /// The domain of `raw`, lowercased, or `""` when there isn't one.
    static func domain(of raw: String) -> String {
        let value = normalized(raw)
        guard let at = value.lastIndex(of: "@") else { return "" }
        return String(value[value.index(after: at)...])
    }

    // ---- The checks -------------------------------------------------------

    private static let localPattern =
        "^[A-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[A-Z0-9!#$%&'*+/=?^_`{|}~-]+)*$"
    private static let labelPattern = "^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$"
    private static let tldShapePattern = "^[a-z]{2,}$|^xn--[a-z0-9-]+$"

    private static func matches(_ s: String, _ pattern: String) -> Bool {
        s.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
    }

    /// True when `domain` is a mailbox provider we accept without further
    /// checks. A FAST PATH, not the policy — see `EmailData.trustedDomains`.
    static func isTrustedDomain(_ domain: String) -> Bool {
        EmailData.trustedDomains.contains(
            domain.trimmingCharacters(in: .whitespaces).lowercased()
                .replacingOccurrences(of: "\\.$", with: "", options: .regularExpression)
        )
    }

    /// True when `raw` is on a known temp-mail domain — or a subdomain of one,
    /// so `x@sub.mailinator.com` cannot walk past an exact-match check.
    static func isDisposable(_ raw: String) -> Bool {
        let d = domain(of: raw)
        guard !d.isEmpty else { return false }
        let labels = d.split(separator: ".").map(String.init)
        guard labels.count >= 2 else { return false }
        for i in 0..<(labels.count - 1) {
            if EmailData.disposableDomains.contains(labels[i...].joined(separator: ".")) {
                return true
            }
        }
        return false
    }

    /// The first thing wrong with `raw`, or nil when it is worth submitting.
    /// Ordered cheapest-first so the message names the real problem: a
    /// malformed address is a format error, not an unknown extension.
    static func problem(with raw: String) -> Problem? {
        let value = normalized(raw)
        if value.isEmpty { return .required }
        if value.count > maxLength { return .tooLong }

        guard let at = value.lastIndex(of: "@"), at != value.startIndex else { return .format }
        let local = String(value[value.startIndex..<at])
        let domain = String(value[value.index(after: at)...])
        if domain.isEmpty { return .format }

        // `..` is legal only inside a quoted local part, which we don't accept.
        if value.contains("..") { return .format }
        if local.count > maxLocalLength || !matches(local, localPattern) { return .format }

        let labels = domain.split(separator: ".", omittingEmptySubsequences: false).map(String.init)
        if labels.count < 2 { return .format }
        for label in labels {
            if label.isEmpty || label.count > maxLabelLength || !matches(label, labelPattern) {
                return .format
            }
        }

        guard let tld = labels.last, matches(tld, tldShapePattern) else { return .format }

        // The allowlist fast path: a known provider is real by definition, so it
        // skips the root-zone lookup and the blocklist walk. Every other domain
        // still clears both — that is what lets a company or university address
        // through while temp-mail stays out.
        if EmailData.trustedDomains.contains(domain) { return nil }

        if !EmailData.validTlds.contains(tld) {
            return .unknownTld(tld: tld, suggestion: suggestDomain(domain))
        }
        if isDisposable(value) { return .disposable }
        return nil
    }

    /// Whether `raw` looks like an address worth submitting **for a new
    /// account** — the full policy, temp-mail included.
    static func isAcceptableForSignup(_ raw: String) -> Bool {
        problem(with: raw) == nil
    }

    /// Whether `raw` is worth submitting on a screen that acts on an account
    /// that ALREADY exists — signing in, or asking for a reset code.
    ///
    /// Deliberately tolerates a disposable domain, matching the server's
    /// `isValidEmail`: those screens only ever touch an existing account, so
    /// refusing here would strand whoever signed up before the blocklist
    /// without stopping a single new account. The temp-mail gate is on sign-up.
    static func isValid(_ raw: String) -> Bool {
        switch problem(with: raw) {
        case .none, .some(.disposable): return true
        default: return false
        }
    }

    // ---- Did-you-mean -----------------------------------------------------

    /// Edit distance counting a transposition as one edit (optimal string
    /// alignment), abandoned once it exceeds `cap`. Transpositions have to be
    /// cheap: `gmial.com` is the single most common way to misspell
    /// `gmail.com`, and plain Levenshtein charges it two.
    private static func distance(_ a: [Character], _ b: [Character], cap: Int) -> Int {
        if a == b { return 0 }
        if abs(a.count - b.count) > cap { return cap + 1 }

        var beforePrev: [Int] = []
        var prev = Array(0...b.count)

        for i in 1...a.count {
            var row = Array(repeating: 0, count: b.count + 1)
            row[0] = i
            var best = row[0]
            for j in 1...b.count {
                let cost = a[i - 1] == b[j - 1] ? 0 : 1
                var d = min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
                if i > 1, j > 1, a[i - 1] == b[j - 2], a[i - 2] == b[j - 1] {
                    d = min(d, beforePrev[j - 2] + 1)
                }
                row[j] = d
                if d < best { best = d }
            }
            if best > cap { return cap + 1 }
            beforePrev = prev
            prev = row
        }
        return prev[b.count]
    }

    /// Given a domain we have already decided not to accept, the one the guest
    /// probably meant — or nil when there is no confident guess. Candidates
    /// come only from the short popular lists, never the whole root zone:
    /// `con` is one deletion from `cn` (China) just as it is from `com`, and
    /// searching 1,400 entries produces confident nonsense.
    static func suggestDomain(_ raw: String) -> String? {
        let d = raw.trimmingCharacters(in: .whitespaces).lowercased()
            .replacingOccurrences(of: "\\.$", with: "", options: .regularExpression)
        if d.isEmpty || EmailData.popularDomains.contains(d) { return nil }

        // Whole-domain near miss first: `gmail.con` should land on `gmail.com`,
        // not walk away with a TLD fix that reaches the same answer by luck.
        let chars = Array(d)
        let cap = d.count >= 10 ? 2 : 1
        for candidate in EmailData.popularDomains
        where distance(chars, Array(candidate), cap: cap) <= cap {
            return candidate
        }

        // Otherwise fix only the extension: `my-company.con` → `my-company.com`.
        guard let dot = d.lastIndex(of: "."), dot != d.startIndex else { return nil }
        let tld = String(d[d.index(after: dot)...])
        if EmailData.validTlds.contains(tld) { return nil }
        let tldChars = Array(tld)
        for candidate in EmailData.popularTlds
        where distance(tldChars, Array(candidate), cap: 1) <= 1 {
            return String(d[..<d.index(after: dot)]) + candidate
        }
        return nil
    }

    // ---- Copy -------------------------------------------------------------

    /// The localized sentence for a refused address. Built here rather than
    /// exposing a bare `messageKey` (the way `NameRules` does) because two of
    /// the cases carry data the sentence has to name.
    @MainActor
    static func message(for problem: Problem, in raw: String) -> String {
        switch problem {
        case .required, .format:
            return L.t("auth.email.invalid")
        case .tooLong:
            return L.t("auth.email.tooLong")
        case .disposable:
            return L.t("auth.email.disposable")
        case let .unknownTld(tld, suggestion):
            let head = String(format: L.t("auth.email.badTld"), tld)
            guard let suggestion else { return head }
            let value = normalized(raw)
            let local = value.lastIndex(of: "@").map { String(value[value.startIndex..<$0]) } ?? ""
            let full = String(format: L.t("auth.email.didYouMean"), "\(local)@\(suggestion)")
            return "\(head) \(full)"
        }
    }
}
