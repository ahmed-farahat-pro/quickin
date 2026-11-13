import Foundation

/// Signup role — from 2026-11-13 a first-time signup picks Guest or Host and
/// walks through stepped pages; everything is POSTed once at the end. The Swift
/// side of the backend's `signup-role-core.ts`:
///
///   guest: account → identity → refund (optional, skippable)
///   host:  account → identity → hosting → payout (required)
///
/// The Google "Complete your account" screen walks the same pages minus
/// `account` (the account already exists).
///
/// Pure value logic (Foundation only, no SwiftUI) so `Tests/run.sh` can compile
/// it on its own — see `Tests/SignupRoleRulesTests`.

/// Who the new account signs up as. Anything but a literal `host` is a guest,
/// exactly like `normalizeSignupRole` on the server.
enum SignupRole: String, CaseIterable, Equatable {
    case guest
    case host

    init(raw: String?) {
        self = (raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "host" ? .host : .guest
    }

    /// The card that is selected before the user touches anything.
    static let preselected: SignupRole = .guest
}

/// One page of the stepped signup.
enum SignupStep: String, CaseIterable, Equatable {
    case account
    case identity
    case refund
    case hosting
    case payout

    /// The localization key of the page title.
    var titleKey: String { "signupFlow.step.\(rawValue)" }

    /// The refund page is the only one that can be skipped.
    var isSkippable: Bool { self == .refund }
}

enum SignupRoleRules {
    // MARK: Steps

    /// The pages a role walks through, in order — what the step indicator
    /// counts. Mirrors `SIGNUP_STEPS`; `includeAccount` is false for the Google
    /// completion screen.
    static func steps(for role: SignupRole, includeAccount: Bool = true) -> [SignupStep] {
        let all: [SignupStep] = role == .host
            ? [.account, .identity, .hosting, .payout]
            : [.account, .identity, .refund]
        return includeAccount ? all : all.filter { $0 != .account }
    }

    /// "Step `current` of `total`" for a 0-based page index (clamped).
    static func indicator(index: Int, role: SignupRole, includeAccount: Bool = true) -> (current: Int, total: Int) {
        let total = steps(for: role, includeAccount: includeAccount).count
        guard total > 0 else { return (0, 0) }
        return (min(max(index, 0), total - 1) + 1, total)
    }

    /// 0…1 for a progress bar.
    static func progress(index: Int, role: SignupRole, includeAccount: Bool = true) -> Double {
        let (current, total) = indicator(index: index, role: role, includeAccount: includeAccount)
        return total == 0 ? 0 : Double(current) / Double(total)
    }

    // MARK: Errors → steps

    /// Which page owns a key of the server's `400 { error, fields }` map. Nil
    /// for a key the app doesn't know (a future field).
    static func step(forErrorKey key: String) -> SignupStep? {
        switch key {
        case "full_name", "name", "email", "password", "confirm_password":
            return .account
        case "phone", "doc_type", "id_number", "id_front", "id_back":
            return .identity
        case "host_type", "address", "company", "notes", "terms", "terms_accepted":
            return .hosting
        case "payout":
            return .payout
        case "refund_method":
            return .refund
        default:
            return nil
        }
    }

    /// The index of the earliest page (for this role's walk) that has an error,
    /// or nil when none of the keys belongs to a page on that walk.
    static func firstStepWithError(
        keys: some Sequence<String>,
        role: SignupRole,
        includeAccount: Bool = true
    ) -> Int? {
        let walk = steps(for: role, includeAccount: includeAccount)
        let owning = Set(keys.compactMap(step(forErrorKey:)))
        return walk.firstIndex(where: owning.contains)
    }

    /// The per-field messages of a refused signup, as `[key: message]`.
    ///
    /// Reads `fields` and also the account-page problems the signup route
    /// reports outside it (`emailProblem` / `passwordProblem` / `nameProblem`
    /// beside a top-level `error`, or a 409 "already exists"), so those land on
    /// the account page too. Blank messages and non-string values are dropped.
    static func fieldErrors(status: Int, data: Data) -> [String: String] {
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
        var out: [String: String] = [:]
        if let fields = object["fields"] as? [String: Any] {
            for (key, value) in fields {
                guard let text = value as? String, !blank(text) else { continue }
                out[key] = text.trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }
        let message = ((object["error"] as? String) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !message.isEmpty {
            if object["emailProblem"] != nil || status == 409 { out["email"] = out["email"] ?? message }
            if object["passwordProblem"] != nil { out["password"] = out["password"] ?? message }
            if object["nameProblem"] != nil { out["full_name"] = out["full_name"] ?? message }
        }
        return out
    }

    // MARK: Hosting page

    /// Companies and brokerages may give a company name; individuals don't.
    static func companyApplies(hostType: String) -> Bool {
        hostType == "company" || hostType == "brokerage"
    }

    /// Local presence checks for the hosting page, as `[key: localization key]`.
    /// Address and the terms box are required; company and notes are optional.
    /// Lengths match the server's caps (300 / 120 / 1000).
    static func hostingProblems(hostType: String, address: String, company: String, notes: String, termsAccepted: Bool) -> [String: String] {
        var out: [String: String] = [:]
        if !["individual", "company", "brokerage"].contains(hostType) { out["host_type"] = "signupFlow.error.hostType" }
        let addr = collapsed(address)
        if addr.isEmpty { out["address"] = "hostApply.error.address" }
        else if addr.count > 300 { out["address"] = "signupFlow.error.tooLong" }
        if companyApplies(hostType: hostType), collapsed(company).count > 120 { out["company"] = "signupFlow.error.tooLong" }
        if notes.trimmingCharacters(in: .whitespacesAndNewlines).count > 1000 { out["notes"] = "signupFlow.error.tooLong" }
        if !termsAccepted { out["terms"] = "hostApply.error.terms" }
        return out
    }

    // MARK: Money destination (payout / refund)

    /// The destination a payout or refund page sends — the same body as
    /// `PUT /api/local/host/payout-method`. `wallet` is retired and never built.
    struct Destination: Equatable {
        enum Method: String { case bankAccount = "bank_account", instapay }
        var method: Method = .bankAccount
        var accountName = ""
        var bankName = ""
        var iban = ""
        var accountNumber = ""
        var swiftBic = ""
        var branch = ""
        var instapayAddress = ""

        /// Nothing typed at all — the guest's refund page treats that as a skip.
        var isBlank: Bool {
            [accountName, bankName, iban, accountNumber, swiftBic, branch, instapayAddress].allSatisfy(blank)
        }

        /// The first thing missing, as a localization key, or nil. Presence
        /// only — the server owns the IBAN checksum / InstaPay format.
        var problemKey: String? {
            if blank(accountName) { return "hostApply.error.payout.accountName" }
            switch method {
            case .bankAccount:
                if blank(bankName) { return "hostApply.error.payout.bank" }
                if blank(iban) && blank(accountNumber) { return "hostApply.error.payout.ibanOrAccount" }
            case .instapay:
                if blank(instapayAddress) { return "hostApply.error.payout.instapay" }
            }
            return nil
        }

        /// Only the fields the chosen method carries; optional bank fields are
        /// omitted when blank.
        var body: [String: Any] {
            var out: [String: Any] = [
                "method": method.rawValue,
                "account_name": trimmed(accountName),
            ]
            switch method {
            case .bankAccount:
                out["bank_name"] = trimmed(bankName)
                out["iban"] = trimmed(iban)
                out["account_number"] = trimmed(accountNumber)
                if !blank(swiftBic) { out["swift_bic"] = trimmed(swiftBic) }
                if !blank(branch) { out["branch"] = trimmed(branch) }
            case .instapay:
                out["instapay_address"] = trimmed(instapayAddress)
            }
            return out
        }
    }

    // MARK: Request body

    /// The role half of `POST /api/auth/signup` / `POST /api/local/account/identity`.
    /// Guest: `role` + `refund_method` only when one was filled in (a skip sends
    /// nothing). Host: `role`, `host_type`, `address`, `company` (business types,
    /// when given), `notes` (when given), `terms_accepted: true` and `payout`.
    static func roleBody(
        role: SignupRole,
        hostType: String = "individual",
        address: String = "",
        company: String = "",
        notes: String = "",
        termsAccepted: Bool = false,
        payout: Destination? = nil,
        refund: Destination? = nil
    ) -> [String: Any] {
        var out: [String: Any] = ["role": role.rawValue]
        switch role {
        case .guest:
            if let refund, !refund.isBlank { out["refund_method"] = refund.body }
        case .host:
            out["host_type"] = hostType
            out["address"] = collapsed(address)
            if companyApplies(hostType: hostType), !blank(company) { out["company"] = collapsed(company) }
            if !blank(notes) { out["notes"] = notes.trimmingCharacters(in: .whitespacesAndNewlines) }
            out["terms_accepted"] = termsAccepted
            if let payout { out["payout"] = payout.body }
        }
        return out
    }

    // MARK: Helpers

    fileprivate static func blank(_ s: String) -> Bool {
        s.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    fileprivate static func trimmed(_ s: String) -> String {
        s.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Whitespace runs folded to one space, then trimmed (the server's `str`).
    static func collapsed(_ s: String) -> String {
        s.split(whereSeparator: { $0.isWhitespace || $0.isNewline }).joined(separator: " ")
    }
}

private func blank(_ s: String) -> Bool { SignupRoleRules.blank(s) }
private func trimmed(_ s: String) -> String { SignupRoleRules.trimmed(s) }
