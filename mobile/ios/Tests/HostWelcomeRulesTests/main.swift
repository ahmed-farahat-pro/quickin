// Unit tests for Sources/HostWelcomeRules.swift — the Swift mirror of Android's
// HostWelcomeRulesTest.kt.
//
// The reported defect: **the Host Dashboard was not discoverable after host approval.**
// An admin approving the application flipped `is_host` server-side and the app looked
// identical — the dashboard sat near the bottom of the Profile scroll, below Terms &
// Privacy. Persistent entry points fix where it lives; this rule fixes the moment,
// pointing an approved host at it once.
//
// The case that is easy to get wrong, and is tested hardest here, is the SHARED DEVICE:
// a device-wide "already shown" bool would welcome the first host to sign in and then
// silently swallow the welcome for every account after them.
//
// This app has no XCTest target, so the suite is a plain executable over the same pure
// file the app compiles — no UIKit, no SwiftUI, no simulator:
//
//     cd mobile/ios && ./Tests/run.sh
//
// Exits non-zero if any check fails. `Tests/` is outside the target's `sources:` in
// project.yml, so none of this is compiled into the app.
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

func welcome(isHost: Bool, _ userID: String?, seen announcedTo: String?) -> Bool {
    HostWelcomeRules.shouldWelcome(isHost: isHost, userID: userID, announcedTo: announcedTo)
}

print("A freshly approved host is welcomed once")
check(welcome(isHost: true, "user-1", seen: nil), "never welcomed on this device → show")
check(!welcome(isHost: true, "user-1", seen: "user-1"), "already welcomed → never again")

print("\nA guest is never welcomed")
check(!welcome(isHost: false, "user-1", seen: nil), "not a host → no welcome")
check(!welcome(isHost: false, "user-1", seen: "user-1"), "not a host, stale id → no welcome")
// An application under review is not an approval: only `is_host` may open this door.
check(!welcome(isHost: false, "user-2", seen: "user-1"), "pending applicant on a used device → no welcome")

print("\nOne device, several accounts — the welcome is per account")
check(welcome(isHost: true, "user-2", seen: "user-1"), "second host on the same phone → still welcomed")
check(!welcome(isHost: true, "user-2", seen: "user-2"), "…and only once for them too")

print("\nAn account we cannot name is not welcomed")
// With no id there is nothing to write down, so showing it would mean showing it on
// every launch forever — the one failure mode worse than never showing it.
check(!welcome(isHost: true, nil, seen: nil), "signed out → no welcome")
check(!welcome(isHost: true, "", seen: nil), "empty id → no welcome")
check(!welcome(isHost: true, "   ", seen: nil), "blank id → no welcome")

print("\nPadding is noise, not a different account")
check(!welcome(isHost: true, "  user-1  ", seen: "user-1"), "padded id matches the stored one")
check(!welcome(isHost: true, "user-1", seen: "  user-1 "), "padded stored id matches the account")

print("\nWhat gets written down after showing it")
check(HostWelcomeRules.announced(userID: "user-1") == "user-1", "the account's id")
check(HostWelcomeRules.announced(userID: " user-1 ") == "user-1", "trimmed before storing")
check(HostWelcomeRules.announced(userID: nil) == nil, "nobody to remember → store nothing")
check(HostWelcomeRules.announced(userID: "  ") == nil, "blank is nobody")

// Storing an untrimmed id would make the next launch's comparison fail and re-show the
// welcome, so the write and the read must normalize identically.
print("\nWriting then reading back never re-shows it")
let stored = HostWelcomeRules.announced(userID: "  user-9  ")
check(!welcome(isHost: true, "  user-9  ", seen: stored), "round-trips to no further welcome")

print("")
if failures == 0 {
    print("All \(checks) checks passed.")
} else {
    print("\(failures) of \(checks) checks FAILED.")
    exit(1)
}
