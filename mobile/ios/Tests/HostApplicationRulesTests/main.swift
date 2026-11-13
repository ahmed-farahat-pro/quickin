// Unit tests for Sources/HostApplicationRules.swift — the Swift side of the
// backend's host-application-core (test/unit/host-application-core.test.mjs).
//
// A guest becomes a host on the SAME account, so the form must never re-ask what
// the profile holds; an OLDER server that sends no `profile` must still get the
// full form; a 400's `fields` (incl. `terms` / `payout`) must land under the
// right input; and the payout presence check must match what the server needs.
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

func profile(_ json: String) -> HostApplicantProfile? {
    try? JSONDecoder().decode(HostApplicantProfile.self, from: Data(json.utf8))
}

print("\nHostApplicantProfile — what the form shows vs asks")
let complete = profile(#"{"full_name":"Mona Adel","phone":"+201001234567","national_id":"29801011234567","doc_type":"national_id","verification_status":"verified","missing":[]}"#)
check(complete?.toAsk == [], "a complete profile asks for nothing")
check(complete?.onFile == [.fullName, .phone, .nationalID], "all three shown read-only, in form order")
check(complete?.value(for: .phone) == "+201001234567", "values are carried through")

let noID = profile(#"{"full_name":"Mona Adel","phone":"+201001234567","national_id":null,"verification_status":"rejected","missing":["national_id"]}"#)
check(noID?.toAsk == [.nationalID], "a rejected ID → only the ID number is asked")
check(noID?.onFile == [.fullName, .phone], "name + phone still read-only")

let legacyAccount = profile(#"{"full_name":"Mona Adel","phone":null,"national_id":null,"missing":["phone","national_id"]}"#)
check(legacyAccount?.toAsk == [.phone, .nationalID], "a pre-signup-rule account is asked for what it lacks")

let noMissingKey = profile(#"{"full_name":"Mona","phone":"  ","national_id":"123"}"#)
check(noMissingKey?.toAsk == [.phone], "absent `missing` is derived from empty values (blank counts as empty)")

let unknownMissing = profile(#"{"full_name":"Mona","phone":"+20100","national_id":"1","missing":["full_name","favourite_colour"]}"#)
check(unknownMissing?.toAsk == [.fullName], "an unknown `missing` entry is dropped; a listed one is asked even with a value")
check(unknownMissing?.onFile == [.phone, .nationalID], "a field listed missing is never shown read-only")

let inconsistent = profile(#"{"full_name":null,"phone":"+20100","national_id":"1","missing":[]}"#)
check(inconsistent?.toAsk == [.fullName], "a value the server didn't send is asked, never shown as an empty row")

check(profile("{}")?.toAsk == HostProfileField.allCases, "an empty profile object asks for everything")
check(HostApplicantProfile.legacy.toAsk == HostProfileField.allCases, "legacy (older server) asks for everything")
check(HostApplicantProfile.legacy.onFile.isEmpty, "legacy shows nothing read-only")
check(profile(#"{"missing":"phone"}"#) != nil, "a malformed `missing` never fails the decode")

print("\nHostApplicationFieldErrors — a 400 lands under the right input")
let body = Data(#"{"error":"Please check the highlighted fields","fields":{"terms":"Accept the host terms to apply","payout":"That IBAN doesn't look right — please check it","address":"Address is required","mystery":"x","phone":"  "}}"#.utf8)
let errors = HostApplicationFieldErrors.parse(body)
check(errors[.terms] == "Accept the host terms to apply", "terms parsed")
check(errors[.payout]?.hasPrefix("That IBAN") == true, "payout parsed with the server's sentence")
check(errors[.address] != nil, "address parsed")
check(errors.count == 3, "unknown keys and blank messages dropped")
check(HostApplicationFieldErrors.first(errors)?.0 == .address, "first refused field follows form order (address before payout/terms)")
check(HostApplicationFieldErrors.first([.terms: "t", .payout: "p"])?.0 == .payout, "payout before terms")
check(HostApplicationFieldErrors.parse(Data(#"{"error":"Already a host"}"#.utf8)).isEmpty, "no `fields` → empty map")
check(HostApplicationFieldErrors.parse(Data("not json".utf8)).isEmpty, "garbage → empty map")
check(HostApplicationField(rawValue: "id_front") == .idFront, "ID document keys are known")

print("\nHostApplicationRules — payout + terms")
check(HostApplicationRules.payoutRequired(hasPayoutOnFile: false), "no payout on file → required")
check(!HostApplicationRules.payoutRequired(hasPayoutOnFile: true), "payout on file → not asked again")
check(!HostApplicationRules.termsAccepted(false), "terms off → refused")
check(HostApplicationRules.termsAccepted(true), "terms on → accepted")

func problem(_ kind: HostPayoutKind, name: String = "Mona Adel", bank: String = "", iban: String = "", account: String = "", instapay: String = "") -> String? {
    HostApplicationRules.payoutDraftProblem(kind: kind, accountName: name, bankName: bank, iban: iban, accountNumber: account, instapayAddress: instapay)
}
check(problem(.bankAccount, name: " ", bank: "NBE", iban: "EG38") == "hostApply.error.payout.accountName", "account name required")
check(problem(.bankAccount) == "hostApply.error.payout.bank", "bank name required for a bank account")
check(problem(.bankAccount, bank: "NBE") == "hostApply.error.payout.ibanOrAccount", "IBAN or account number required")
check(problem(.bankAccount, bank: "NBE", iban: "EG380019000500000000263180002") == nil, "IBAN alone is enough")
check(problem(.bankAccount, bank: "NBE", account: "1234567") == nil, "account number alone is enough")
check(problem(.instapay) == "hostApply.error.payout.instapay", "InstaPay address required")
check(problem(.instapay, instapay: "mona@instapay") == nil, "InstaPay complete")
check(problem(.instapay, bank: "", iban: "") == "hostApply.error.payout.instapay", "bank fields don't matter for InstaPay")
check(HostApplicationRules.termsURL(webBase: "https://quickin-frontend.vercel.app")?.absoluteString == "https://quickin-frontend.vercel.app/terms#host", "terms URL opens the host section of /terms")

print("\n\(checks - failures)/\(checks) passed")
if failures > 0 { exit(1) }
