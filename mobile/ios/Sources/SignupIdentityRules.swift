import Foundation

/// Signup identity — every account created from 2026-11-13 on gives a phone
/// number and an identity document (type, number, front + back photos) when it
/// signs up. The Swift side of the backend's `signup-identity-core.ts`.
///
/// What the app decides from it:
///   - `identity_complete == false` (a first Google sign-in that hasn't handed
///     anything over yet) → the blocking "Complete your account" screen;
///   - a PENDING document stops nothing — browse and book as normal;
///   - a REJECTED one shows the reviewer's reason and a re-upload action, and
///     booking is refused until a new document is filed.
///
/// Pure value logic (Foundation only, no SwiftUI) so `Tests/run.sh` can compile
/// it on its own — see `Tests/SignupIdentityRulesTests`.

/// The identity half of an auth user payload: `identity_required`,
/// `identity_complete`, `verification_status`, `verification_note`.
///
/// Decoded TOLERANTLY: a backend that predates the rule sends none of these,
/// and that account must read as complete — otherwise every existing user of an
/// older server would be locked behind the completion screen.
struct AccountIdentity: Codable, Equatable {
    /// True only for accounts created after the cutover.
    var required: Bool
    /// False only while a required account still owes its phone or document.
    var complete: Bool
    /// `unverified` | `pending` | `verified` | `rejected` (unknown → `unverified`).
    var status: String
    /// The reviewer's reason — present only on a rejection.
    var note: String?

    /// What an account looks like to a backend that doesn't send the fields.
    static let legacy = AccountIdentity(required: false, complete: true, status: "unverified", note: nil)

    enum CodingKeys: String, CodingKey {
        case required = "identity_required"
        case complete = "identity_complete"
        case status = "verification_status"
        case note = "verification_note"
    }

    init(required: Bool, complete: Bool, status: String, note: String?) {
        self.required = required
        self.complete = complete
        self.status = AccountIdentity.normalizedStatus(status)
        self.note = AccountIdentity.cleanNote(note)
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        required = (try? c.decodeIfPresent(Bool.self, forKey: .required)) ?? false
        complete = (try? c.decodeIfPresent(Bool.self, forKey: .complete)) ?? true
        status = AccountIdentity.normalizedStatus((try? c.decodeIfPresent(String.self, forKey: .status)) ?? nil)
        note = AccountIdentity.cleanNote((try? c.decodeIfPresent(String.self, forKey: .note)) ?? nil)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(required, forKey: .required)
        try c.encode(complete, forKey: .complete)
        try c.encode(status, forKey: .status)
        try c.encodeIfPresent(note, forKey: .note)
    }

    static func normalizedStatus(_ raw: String?) -> String {
        let s = (raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return ["pending", "verified", "rejected"].contains(s) ? s : "unverified"
    }

    private static func cleanNote(_ raw: String?) -> String? {
        let t = (raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }

    /// The blocking "Complete your account" screen is owed.
    var needsCompletion: Bool { !complete }

    /// The signup document was rejected: show the reason, offer a re-upload,
    /// and expect bookings to be refused until one is filed.
    var isRejected: Bool { required && status == "rejected" }

    /// The reason to show beside a rejection (nil when there isn't one).
    var rejectionNote: String? { isRejected ? note : nil }

    /// This account's identity after the server echoed a new state (the
    /// completion endpoint and a re-upload both answer with one).
    func updated(status newStatus: String, note newNote: String? = nil, complete newComplete: Bool? = nil) -> AccountIdentity {
        AccountIdentity(
            required: required,
            complete: newComplete ?? complete,
            status: newStatus,
            note: AccountIdentity.normalizedStatus(newStatus) == "rejected" ? newNote : nil
        )
    }
}

/// The request fields a signup / completion form sends, keyed exactly like the
/// backend's `{ error, fields }` map so a 400 lands under the right input.
enum IdentityField: String, CaseIterable, Hashable {
    case phone
    case docType = "doc_type"
    case idNumber = "id_number"
    case idFront = "id_front"
    case idBack = "id_back"
}

enum IdentityFieldErrors {
    /// The per-field messages from a `400 { error, fields }` body. Keys the app
    /// doesn't know (a future field) are dropped rather than failing the parse;
    /// an absent or malformed `fields` is an empty map.
    static func parse(_ data: Data) -> [IdentityField: String] {
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let fields = object["fields"] as? [String: Any] else { return [:] }
        var out: [IdentityField: String] = [:]
        for (key, value) in fields {
            guard let field = IdentityField(rawValue: key),
                  let text = value as? String,
                  !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { continue }
            out[field] = text
        }
        return out
    }
}

/// Why `POST /api/local/bookings` refused a reservation on identity grounds:
/// `403 { error, code }`. Clients switch on `code`, never on the message.
enum BookingIdentityBlock: String, Equatable {
    case incomplete = "identity_incomplete"
    case rejected = "identity_rejected"

    /// The block and the server's message, or nil for any other response.
    static func parse(status: Int, data: Data) -> (block: BookingIdentityBlock, message: String)? {
        guard status == 403,
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let code = object["code"] as? String,
              let block = BookingIdentityBlock(rawValue: code) else { return nil }
        let message = (object["error"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return (block, message)
    }
}

/// The number on an identity document. Twin of `normalizeDocumentNumber` in
/// the backend's `id-change-core.ts`: a national ID is exactly 14 digits; a
/// passport or residence permit is 5–24 letters/digits. Spaces and dashes are
/// readability, not part of the number.
enum IDNumberRules {
    static let nationalIDDigits = 14
    static let minChars = 5
    static let maxChars = 24

    enum Problem: Equatable {
        case empty
        case nationalIDDigitsOnly
        case nationalIDLength
        case lettersAndDigitsOnly
        case length

        var messageKey: String {
            switch self {
            case .empty: return "signupId.error.idNumberRequired"
            case .nationalIDDigitsOnly: return "signupId.error.nationalIdDigits"
            case .nationalIDLength: return "signupId.error.nationalIdLength"
            case .lettersAndDigitsOnly: return "signupId.error.idNumberChars"
            case .length: return "signupId.error.idNumberLength"
            }
        }
    }

    /// Upper-cased, Arabic-Indic digits folded, spaces and dashes removed.
    static func canonical(_ raw: String) -> String {
        PhoneRules.asciiDigits(raw)
            .uppercased()
            .filter { $0 != " " && $0 != "-" && !$0.isNewline && $0 != "\t" }
    }

    /// `docType` is the request value (`national_id` / `passport` / `residence_permit`).
    static func problem(_ raw: String, docType: String) -> Problem? {
        let value = canonical(raw)
        if value.isEmpty { return .empty }
        if docType == "national_id" {
            if !value.allSatisfy({ $0.isASCII && $0.isNumber }) { return .nationalIDDigitsOnly }
            if value.count != nationalIDDigits { return .nationalIDLength }
            return nil
        }
        if !value.allSatisfy({ $0.isASCII && ($0.isNumber || ($0.isLetter && $0.isUppercase)) }) {
            return .lettersAndDigitsOnly
        }
        if value.count < minChars || value.count > maxChars { return .length }
        return nil
    }
}

/// The identity fields a signup (or the Google completion step) posts. The
/// photos are `data:image/jpeg;base64,…` URLs, already downscaled.
struct SignupIdentityPayload: Equatable {
    var phone: String
    var docType: String
    var idNumber: String
    var idFront: String
    var idBack: String

    /// The request body, keyed exactly like `IdentityField`.
    var body: [String: String] {
        [
            IdentityField.phone.rawValue: phone.trimmingCharacters(in: .whitespacesAndNewlines),
            IdentityField.docType.rawValue: docType,
            IdentityField.idNumber.rawValue: IDNumberRules.canonical(idNumber),
            IdentityField.idFront.rawValue: idFront,
            IdentityField.idBack.rawValue: idBack,
        ]
    }
}
