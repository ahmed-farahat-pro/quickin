import Foundation

// The become-a-host application on the SAME account (2026-11-13) — the Swift
// side of the backend's host-application-core.
//
// A guest already gave their name, phone and ID at signup, so the form never
// asks for them again: `GET /api/local/host/application` sends them as
// `profile`, the sheet shows them read-only ("From your profile"), and only
// what `profile.missing` names is asked for. The server takes these three from
// the profile whatever the client sends. The application adds the host-only
// facts: host type, address, a payout destination and acceptance of the terms.
//
// Foundation only, so Tests/run.sh can compile it without UIKit / SwiftUI.

/// A profile field the application needs. Raw values are the API's keys.
enum HostProfileField: String, CaseIterable, Hashable {
    case fullName = "full_name"
    case phone
    case nationalID = "national_id"
}

/// `profile` on `GET /api/local/host/application`:
/// `{ full_name, phone, national_id, doc_type, verification_status, missing[] }`.
///
/// Every key decodes optionally. A `missing` the server didn't send is derived
/// from which values are empty, and an unknown entry in it is dropped.
struct HostApplicantProfile: Decodable, Equatable {
    let fullName: String?
    let phone: String?
    let nationalID: String?
    let docType: String?
    let verificationStatus: String?
    let missing: [HostProfileField]

    enum CodingKeys: String, CodingKey {
        case fullName = "full_name"
        case phone
        case nationalID = "national_id"
        case docType = "doc_type"
        case verificationStatus = "verification_status"
        case missing
    }

    init(
        fullName: String? = nil,
        phone: String? = nil,
        nationalID: String? = nil,
        docType: String? = nil,
        verificationStatus: String? = nil,
        missing: [HostProfileField]? = nil
    ) {
        self.fullName = Self.clean(fullName)
        self.phone = Self.clean(phone)
        self.nationalID = Self.clean(nationalID)
        self.docType = Self.clean(docType)
        self.verificationStatus = Self.clean(verificationStatus)
        self.missing = missing ?? Self.derivedMissing(self.fullName, self.phone, self.nationalID)
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        func string(_ key: CodingKeys) -> String? { (try? c.decodeIfPresent(String.self, forKey: key)) ?? nil }
        let raw = (try? c.decodeIfPresent([String].self, forKey: .missing)) ?? nil
        self.init(
            fullName: string(.fullName),
            phone: string(.phone),
            nationalID: string(.nationalID),
            docType: string(.docType),
            verificationStatus: string(.verificationStatus),
            missing: raw.map { keys in
                HostProfileField.allCases.filter { keys.contains($0.rawValue) }
            }
        )
    }

    /// What an older server (no `profile` key) amounts to: nothing on file, so
    /// the form asks for all three exactly as it used to.
    static let legacy = HostApplicantProfile()

    func value(for field: HostProfileField) -> String? {
        switch field {
        case .fullName: return fullName
        case .phone: return phone
        case .nationalID: return nationalID
        }
    }

    /// The fields the profile supplies, in form order — shown read-only.
    var onFile: [HostProfileField] {
        HostProfileField.allCases.filter { !missing.contains($0) && value(for: $0) != nil }
    }

    /// The fields the form must ask for, in form order. A field the server did
    /// not list as missing but sent no value for is asked too: an empty
    /// "From your profile" row would be a dead end.
    var toAsk: [HostProfileField] {
        HostProfileField.allCases.filter { missing.contains($0) || value(for: $0) == nil }
    }

    private static func clean(_ s: String?) -> String? {
        let t = s?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return t.isEmpty ? nil : t
    }

    private static func derivedMissing(_ values: String?...) -> [HostProfileField] {
        zip(HostProfileField.allCases, values).filter { $0.1 == nil }.map(\.0)
    }
}

/// A field of `POST /api/local/host/apply`, keyed exactly like the backend's
/// `400 { error, fields }` map so a refusal lands under the right input.
enum HostApplicationField: String, CaseIterable, Hashable {
    case hostType = "host_type"
    case fullName = "full_name"
    case phone
    case nationalID = "national_id"
    case address
    case docType = "doc_type"
    case idFront = "id_front"
    case idBack = "id_back"
    case payout
    case terms
}

enum HostApplicationFieldErrors {
    /// The per-field messages from a `400 { error, fields }` body. Unknown keys
    /// are dropped rather than failing the parse; a missing `fields` is empty.
    static func parse(_ data: Data) -> [HostApplicationField: String] {
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let fields = object["fields"] as? [String: Any] else { return [:] }
        var out: [HostApplicationField: String] = [:]
        for (key, value) in fields {
            guard let field = HostApplicationField(rawValue: key),
                  let text = value as? String,
                  !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { continue }
            out[field] = text
        }
        return out
    }

    /// The first refused field in form order, so the sheet outlines one input
    /// and shows its message.
    static func first(_ errors: [HostApplicationField: String]) -> (HostApplicationField, String)? {
        for field in HostApplicationField.allCases {
            if let message = errors[field] { return (field, message) }
        }
        return nil
    }
}

/// Which payout destination the application form is filling in.
enum HostPayoutKind: String, Equatable {
    case bankAccount = "bank_account"
    case instapay
}

enum HostApplicationRules {
    /// The application must carry a payout destination unless one is on file
    /// (a re-applicant after a rejection). Mirrors `payoutRequired`.
    static func payoutRequired(hasPayoutOnFile: Bool) -> Bool {
        !hasPayoutOnFile
    }

    /// Only an explicit acceptance counts — mirrors `hostTermsAccepted`.
    static func termsAccepted(_ toggle: Bool) -> Bool { toggle }

    /// The first thing missing from a payout draft, as a localization key, or
    /// nil when it is complete enough to send. Presence only — the server owns
    /// the IBAN checksum / InstaPay format and answers under `fields.payout`.
    static func payoutDraftProblem(
        kind: HostPayoutKind,
        accountName: String,
        bankName: String,
        iban: String,
        accountNumber: String,
        instapayAddress: String
    ) -> String? {
        func blank(_ s: String) -> Bool { s.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        if blank(accountName) { return "hostApply.error.payout.accountName" }
        switch kind {
        case .bankAccount:
            if blank(bankName) { return "hostApply.error.payout.bank" }
            if blank(iban) && blank(accountNumber) { return "hostApply.error.payout.ibanOrAccount" }
        case .instapay:
            if blank(instapayAddress) { return "hostApply.error.payout.instapay" }
        }
        return nil
    }

    /// The host terms page, on the same site as the profile's legal links.
    static func termsURL(webBase: String) -> URL? {
        URL(string: webBase + "/terms#host")
    }
}
