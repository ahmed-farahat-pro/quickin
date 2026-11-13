// Unit tests for Sources/SignupRoleRules.swift — the Swift side of the backend's
// signup-role-core (test/unit/signup-role-core.test.mjs).
//
// The stepped, role-aware signup: which pages each role walks, which page owns
// each key of a 400's `fields` (so the app jumps to the earliest bad page), what
// the hosting page checks locally, and the exact body the one final POST sends —
// a skipped refund sends nothing, a retired wallet is never built.
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

print("\nSignupRole")
check(SignupRole.preselected == .guest, "Guest is preselected")
check(SignupRole(raw: nil) == .guest, "no role is a guest (old client)")
check(SignupRole(raw: " HOST ") == .host, "host is case/space tolerant")
check(SignupRole(raw: "admin") == .guest, "anything else is a guest")

print("\nSteps per role")
check(SignupRoleRules.steps(for: .guest) == [.account, .identity, .refund], "guest: account → identity → refund")
check(SignupRoleRules.steps(for: .host) == [.account, .identity, .hosting, .payout], "host: account → identity → hosting → payout")
check(SignupRoleRules.steps(for: .guest, includeAccount: false) == [.identity, .refund], "Google guest: identity → refund")
check(SignupRoleRules.steps(for: .host, includeAccount: false) == [.identity, .hosting, .payout], "Google host: identity → hosting → payout")
check(SignupStep.refund.isSkippable && !SignupStep.payout.isSkippable, "only refund is skippable")

print("\nStep indicator")
let ind = SignupRoleRules.indicator(index: 1, role: .guest)
check(ind.current == 2 && ind.total == 3, "guest page 2 reads Step 2 of 3")
let hostInd = SignupRoleRules.indicator(index: 3, role: .host)
check(hostInd.current == 4 && hostInd.total == 4, "host last page reads Step 4 of 4")
let clamped = SignupRoleRules.indicator(index: 9, role: .guest, includeAccount: false)
check(clamped.current == 2 && clamped.total == 2, "out-of-range index is clamped")
check(SignupRoleRules.progress(index: 0, role: .host) == 0.25, "progress 1/4")

print("\nErrors → steps")
check(SignupRoleRules.step(forErrorKey: "email") == .account, "email → account")
check(SignupRoleRules.step(forErrorKey: "full_name") == .account, "full_name → account")
check(SignupRoleRules.step(forErrorKey: "id_back") == .identity, "id_back → identity")
check(SignupRoleRules.step(forErrorKey: "phone") == .identity, "phone → identity")
check(SignupRoleRules.step(forErrorKey: "terms") == .hosting, "terms → hosting")
check(SignupRoleRules.step(forErrorKey: "company") == .hosting, "company → hosting")
check(SignupRoleRules.step(forErrorKey: "payout") == .payout, "payout → payout")
check(SignupRoleRules.step(forErrorKey: "refund_method") == .refund, "refund_method → refund")
check(SignupRoleRules.step(forErrorKey: "future_field") == nil, "unknown key owns no page")

check(SignupRoleRules.firstStepWithError(keys: ["payout", "address", "id_front"], role: .host) == 1,
      "host: identity error wins over hosting + payout")
check(SignupRoleRules.firstStepWithError(keys: ["payout", "terms"], role: .host) == 2,
      "host: hosting before payout")
check(SignupRoleRules.firstStepWithError(keys: ["refund_method"], role: .guest) == 2, "guest: refund page")
check(SignupRoleRules.firstStepWithError(keys: ["phone"], role: .host, includeAccount: false) == 0,
      "Google: identity is page 0")
check(SignupRoleRules.firstStepWithError(keys: ["email"], role: .guest, includeAccount: false) == nil,
      "Google: an account key has no page")
check(SignupRoleRules.firstStepWithError(keys: ["payout"], role: .guest) == nil,
      "a payout key never lands on a guest's walk")
check(SignupRoleRules.firstStepWithError(keys: [String](), role: .host) == nil, "no errors → nil")

print("\nfieldErrors parsing")
let bad = Data(#"{"error":"Please check the highlighted fields","fields":{"phone":"Taken","payout":"Bad IBAN","x":"  ","n":3}}"#.utf8)
let parsed = SignupRoleRules.fieldErrors(status: 400, data: bad)
check(parsed == ["phone": "Taken", "payout": "Bad IBAN"], "fields read; blanks and non-strings dropped")
let emailBad = SignupRoleRules.fieldErrors(status: 400, data: Data(#"{"error":"Use a real domain","emailProblem":"tld"}"#.utf8))
check(emailBad == ["email": "Use a real domain"], "emailProblem lands on email")
let weak = SignupRoleRules.fieldErrors(status: 400, data: Data(#"{"error":"Too weak","passwordProblem":"short"}"#.utf8))
check(weak == ["password": "Too weak"], "passwordProblem lands on password")
let exists = SignupRoleRules.fieldErrors(status: 409, data: Data(#"{"error":"An account with this email already exists."}"#.utf8))
check(exists["email"] != nil, "409 already-exists lands on email")
check(SignupRoleRules.fieldErrors(status: 500, data: Data("oops".utf8)).isEmpty, "non-JSON → empty")

print("\nHosting page")
let okHosting = SignupRoleRules.hostingProblems(hostType: "individual", address: "1 Nile St", company: "", notes: "", termsAccepted: true)
check(okHosting.isEmpty, "address + terms is enough")
let missing = SignupRoleRules.hostingProblems(hostType: "company", address: "   ", company: "", notes: "", termsAccepted: false)
check(missing["address"] != nil && missing["terms"] != nil, "address and terms required")
check(missing["company"] == nil, "company stays optional for a company")
check(SignupRoleRules.hostingProblems(hostType: "llc", address: "a", company: "", notes: "", termsAccepted: true)["host_type"] != nil,
      "unknown host type refused")
check(SignupRoleRules.hostingProblems(hostType: "individual", address: String(repeating: "a", count: 301), company: "", notes: "", termsAccepted: true)["address"] != nil,
      "address over 300 refused")
check(SignupRoleRules.hostingProblems(hostType: "individual", address: "a", company: String(repeating: "c", count: 200), notes: "", termsAccepted: true)["company"] == nil,
      "an individual's company is ignored")
check(SignupRoleRules.companyApplies(hostType: "brokerage") && !SignupRoleRules.companyApplies(hostType: "individual"),
      "company shown for company/brokerage only")

print("\nDestination")
typealias Dest = SignupRoleRules.Destination
check(Dest().isBlank, "an untouched destination is blank")
check(Dest().problemKey == "hostApply.error.payout.accountName", "name first")
var bank = Dest(method: .bankAccount, accountName: "Layla", bankName: "CIB")
check(bank.problemKey == "hostApply.error.payout.ibanOrAccount", "IBAN or account number needed")
bank.accountNumber = "123456"
check(bank.problemKey == nil, "account number alone is enough")
let bankBody = bank.body
check(bankBody["method"] as? String == "bank_account", "bank method")
check(bankBody["swift_bic"] == nil && bankBody["branch"] == nil, "blank optional bank fields omitted")
check(bankBody["instapay_address"] == nil, "no InstaPay fields on a bank body")
let insta = Dest(method: .instapay, accountName: " Layla ", bankName: "leftover", instapayAddress: "layla@instapay")
check(insta.problemKey == nil, "InstaPay complete")
check(insta.body.count == 3 && insta.body["bank_name"] == nil, "InstaPay body carries only its fields")
check(insta.body["account_name"] as? String == "Layla", "values trimmed")
check(Dest(method: .instapay, accountName: "L").problemKey == "hostApply.error.payout.instapay", "InstaPay address needed")

print("\nRole body")
let guestSkip = SignupRoleRules.roleBody(role: .guest, refund: nil)
check(guestSkip.count == 1 && guestSkip["role"] as? String == "guest", "skipped refund sends only role")
let guestBlank = SignupRoleRules.roleBody(role: .guest, refund: Dest())
check(guestBlank["refund_method"] == nil, "a blank refund is not sent")
let guestRefund = SignupRoleRules.roleBody(role: .guest, refund: insta)
check((guestRefund["refund_method"] as? [String: Any])?["method"] as? String == "instapay", "filled refund sent")
check(guestRefund["payout"] == nil && guestRefund["host_type"] == nil, "guest sends no host fields")

let hostBody = SignupRoleRules.roleBody(role: .host, hostType: "individual", address: "  1   Nile St ",
                                        company: "Acme", notes: "  ", termsAccepted: true, payout: bank, refund: insta)
check(hostBody["role"] as? String == "host", "host role")
check(hostBody["address"] as? String == "1 Nile St", "address collapsed")
check(hostBody["company"] == nil, "individual sends no company")
check(hostBody["notes"] == nil, "blank notes omitted")
check(hostBody["terms_accepted"] as? Bool == true, "terms_accepted true")
check((hostBody["payout"] as? [String: Any])?["account_number"] as? String == "123456", "payout object sent")
check(hostBody["refund_method"] == nil, "host never sends refund_method")
let broker = SignupRoleRules.roleBody(role: .host, hostType: "brokerage", address: "a", company: " Nile  Homes ",
                                      notes: "Line 1\nLine 2", termsAccepted: true, payout: bank)
check(broker["company"] as? String == "Nile Homes", "brokerage sends collapsed company")
check(broker["notes"] as? String == "Line 1\nLine 2", "notes keep line breaks")
check(JSONSerialization.isValidJSONObject(broker), "body is valid JSON")

print("\n\(checks - failures)/\(checks) passed")
exit(failures == 0 ? 0 : 1)
