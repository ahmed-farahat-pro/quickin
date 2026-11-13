// Unit tests for Sources/SignupIdentityRules.swift and the account-phone half of
// Sources/PhoneRules.swift — the Swift side of the backend's signup-identity-core
// (test/unit/signup-identity-core.test.mjs) and phone-core.
//
// Every new account gives a phone + an identity document at signup. What the app
// has to get right on its own: an OLDER backend that sends none of the identity
// fields must never lock a user behind the completion screen; a 400's `fields`
// must land under the right input; a booking 403 is switched on `code`, never on
// the message; and the phone / ID-number fields must accept exactly what the API
// accepts.
//
//     cd mobile/ios && ./Tests/run.sh
import Foundation

var failures = 0
var checks = 0

func check(_ condition: Bool, _ label: String) {
    checks += 1
    if condition {
        print("  PASS \(label)")
    } else {
        print("  FAIL \(label)")
        failures += 1
    }
}

func decode(_ json: String) -> AccountIdentity? {
    try? JSONDecoder().decode(AccountIdentity.self, from: Data(json.utf8))
}

print("\nAccountIdentity — tolerant decoding")
let legacy = decode(#"{"id":"u1","email":"a@b.co"}"#)
check(legacy == AccountIdentity.legacy, "absent fields decode as the legacy (complete) account")
check(legacy?.needsCompletion == false, "an older backend never shows the completion screen")
check(legacy?.isRejected == false, "an older backend never shows a rejection")

let owed = decode(#"{"identity_required":true,"identity_complete":false,"verification_status":"unverified","verification_note":null}"#)
check(owed?.needsCompletion == true, "a new Google account owes its identity")

let pending = decode(#"{"identity_required":true,"identity_complete":true,"verification_status":"pending"}"#)
check(pending?.needsCompletion == false && pending?.isRejected == false, "pending: nothing blocks")

let rejected = decode(#"{"identity_required":true,"identity_complete":true,"verification_status":"rejected","verification_note":"  Photo blurry "}"#)
check(rejected?.isRejected == true, "rejected + required → rejection notice")
check(rejected?.rejectionNote == "Photo blurry", "the reason is trimmed and surfaced")

let oldRejected = decode(#"{"identity_required":false,"identity_complete":true,"verification_status":"rejected","verification_note":"x"}"#)
check(oldRejected?.isRejected == false, "a pre-cutover account is never held by the signup rule")

let weird = decode(#"{"identity_required":true,"identity_complete":true,"verification_status":"WAT"}"#)
check(weird?.status == "unverified", "an unknown status reads as unverified")

let wrongTypes = decode(#"{"identity_required":"yes","identity_complete":null}"#)
check(wrongTypes == AccountIdentity.legacy, "wrongly-typed fields fall back instead of failing the user decode")

if let r = rejected, let data = try? JSONEncoder().encode(r) {
    check(decode(String(decoding: data, as: UTF8.self)) == r, "encode → decode round-trips (the qk_user cache)")
} else {
    check(false, "encode → decode round-trips (the qk_user cache)")
}

if let r = rejected {
    let resubmitted = r.updated(status: "pending")
    check(!resubmitted.isRejected && resubmitted.note == nil, "a re-upload clears the rejection and its note")
}

print("\nIdentityFieldErrors — a 400 lands under the right input")
let body = #"{"error":"Please check the highlighted fields","fields":{"phone":"This phone number is already used by another account","id_back":"A photo of the back of your ID is required","future_field":"?"}}"#
let parsed = IdentityFieldErrors.parse(Data(body.utf8))
check(parsed[.phone] == "This phone number is already used by another account", "duplicate phone message under phone")
check(parsed[.idBack] != nil, "id_back mapped")
check(parsed.count == 2, "unknown keys are dropped")
check(IdentityFieldErrors.parse(Data(#"{"error":"x"}"#.utf8)).isEmpty, "no fields → empty map")
check(IdentityFieldErrors.parse(Data("not json".utf8)).isEmpty, "garbage → empty map")

print("\nBookingIdentityBlock — switch on code, never the message")
let inc = BookingIdentityBlock.parse(status: 403, data: Data(#"{"error":"Add your phone","code":"identity_incomplete"}"#.utf8))
check(inc?.block == .incomplete, "identity_incomplete")
let rej = BookingIdentityBlock.parse(status: 403, data: Data(#"{"error":"Your ID was not approved: blurry. Upload a new one to book.","code":"identity_rejected"}"#.utf8))
check(rej?.block == .rejected && rej?.message.contains("blurry") == true, "identity_rejected keeps the server message (with the reason)")
check(BookingIdentityBlock.parse(status: 403, data: Data(#"{"error":"identity_rejected"}"#.utf8)) == nil, "a message that merely mentions the code is not a block")
check(BookingIdentityBlock.parse(status: 400, data: Data(#"{"code":"identity_rejected"}"#.utf8)) == nil, "only a 403 is an identity block")
check(BookingIdentityBlock.parse(status: 403, data: Data(#"{"code":"something_else"}"#.utf8)) == nil, "an unknown code is not a block")

print("\nIDNumberRules — the same answers as normalizeDocumentNumber")
check(IDNumberRules.problem("29801011234567", docType: "national_id") == nil, "14-digit national ID")
check(IDNumberRules.problem("٢٩٨٠١٠١١٢٣٤٥٦٧", docType: "national_id") == nil, "Arabic-Indic national ID folds to ASCII")
check(IDNumberRules.problem("2980 1011 234-567", docType: "national_id") == nil, "spaces and dashes are readability")
check(IDNumberRules.problem("2980101123456", docType: "national_id") == .nationalIDLength, "13 digits refused")
check(IDNumberRules.problem("29801011234A67", docType: "national_id") == .nationalIDDigitsOnly, "a letter in a national ID refused")
check(IDNumberRules.problem("  ", docType: "national_id") == .empty, "blank refused")
check(IDNumberRules.problem("a1234567", docType: "passport") == nil, "passport lower-case is upper-cased")
check(IDNumberRules.problem("A12", docType: "passport") == .length, "passport too short")
check(IDNumberRules.problem(String(repeating: "A", count: 25), docType: "residence_permit") == .length, "permit too long")
check(IDNumberRules.problem("A12#456", docType: "passport") == .lettersAndDigitsOnly, "symbols refused")

print("\nPhoneRules (account) — the same answers as phone-core")
check(PhoneRules.filterAccountInput("010abc1234") == "0101234", "letters dropped as typed")
check(PhoneRules.filterAccountInput("٠١٠١٢٣٤٥٦٧٨") == "01012345678", "Arabic-Indic digits folded")
check(PhoneRules.filterAccountInput("+20 10+1") == "+20 101", "a + survives only in front")
check(PhoneRules.filterAccountInput(String(repeating: "1", count: 40)).count == 24, "capped at 24 characters")
check(PhoneRules.isValidAccountPhone("01012345678"), "Egyptian mobile")
check(PhoneRules.isValidAccountPhone("+20 101 234 5678"), "Egyptian mobile with +20")
check(PhoneRules.isValidAccountPhone("00201012345678"), "Egyptian mobile with 0020")
check(!PhoneRules.isValidAccountPhone("0101234567"), "a mobile one digit short")
check(PhoneRules.isValidAccountPhone("0223456789"), "Cairo landline")
check(PhoneRules.isValidAccountPhone("+44 20 7946 0958"), "a UK number (host abroad)")
check(PhoneRules.isValidAccountPhone("+966 50 123 4567"), "a Saudi mobile")
check(!PhoneRules.isValidAccountPhone("+1234567"), "7 digits is too short")
check(!PhoneRules.isValidAccountPhone("asdf"), "letters refused")
check(!PhoneRules.isValidAccountPhone(""), "empty refused")
check(PhoneRules.isValidAccountPhone("٠١٠١٢٣٤٥٦٧٨"), "Arabic-Indic mobile is valid")

print("\n\(checks - failures)/\(checks) passed")
exit(failures == 0 ? 0 : 1)
