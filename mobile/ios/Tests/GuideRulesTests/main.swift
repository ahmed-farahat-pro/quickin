// Unit tests for Sources/GuideRules.swift — the Swift mirror of Android's GuideRulesTest.kt.
//
// The in-app guide: a first-launch walkthrough of the app, and a separate walkthrough of how a
// guest becomes a host. What is easy to get wrong, and tested here: the tour greeting someone
// twice (or on top of the signup completion screen), and the host tour offering a guest "Apply
// now" when they cannot apply — signed out, already under review, or already a host.
//
// This app has no XCTest target, so the suite is a plain executable over the same pure file the
// app compiles:
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

func ids(_ tour: GuideTour, _ state: GuideHostState) -> [String] {
    GuideRules.steps(tour, state: state).map(\.id)
}

func step(_ tour: GuideTour, _ state: GuideHostState, _ id: String) -> GuideStep? {
    GuideRules.steps(tour, state: state).first { $0.id == id }
}

print("The first-launch tour starts once, and never over something else")
check(GuideRules.shouldAutoStart(seen: false, blocked: false), "never seen, nothing on screen → start")
check(!GuideRules.shouldAutoStart(seen: true, blocked: false), "already seen → never again")
check(!GuideRules.shouldAutoStart(seen: false, blocked: true), "signup completion / primer up → wait")
check(!GuideRules.shouldAutoStart(seen: true, blocked: true), "seen and blocked → no")

print("\nThe account's host state comes from the server's fields")
check(GuideHostState.from(signedIn: false, isHost: false, hostStatus: nil) == .signedOut, "signed out")
check(GuideHostState.from(signedIn: false, isHost: true, hostStatus: "approved") == .signedOut,
      "a stale host flag without a session is still signed out")
check(GuideHostState.from(signedIn: true, isHost: false, hostStatus: "none") == .guest, "no application → guest")
check(GuideHostState.from(signedIn: true, isHost: false, hostStatus: nil) == .guest, "unknown status → guest")
check(GuideHostState.from(signedIn: true, isHost: false, hostStatus: "rejected") == .guest,
      "rejected may reapply → guest")
check(GuideHostState.from(signedIn: true, isHost: false, hostStatus: "PENDING") == .pending, "pending (any case)")
check(GuideHostState.from(signedIn: true, isHost: true, hostStatus: "pending") == .host, "is_host wins")

print("\nThe main tour: same eight steps for everyone, copy adapted")
let mainOrder = ["welcome", "search", "regions", "filters", "wishlist", "trips", "profile", "finish"]
for state in [GuideHostState.signedOut, .guest, .pending, .host] {
    check(ids(.main, state) == mainOrder, "\(state): eight steps in spec order")
}
check(step(.main, .signedOut, "profile")?.copy == "profile.signedOut", "signed out: Profile step invites sign-in")
check(step(.main, .guest, "profile")?.copy == "profile", "signed in: Profile step describes the profile")
check(step(.main, .host, "finish")?.copy == "finish.host", "host: no host pitch on the last step")
check(step(.main, .guest, "finish")?.copy == "finish", "guest: last step offers the host tour")
check(step(.main, .guest, "search")?.tab == .explore, "Explore steps bring Explore up first")
check(step(.main, .guest, "wishlist")?.tabTarget == .wishlist, "Wishlist step spotlights its tab")
check(step(.main, .guest, "trips")?.tabTarget == .trips, "Trips step spotlights its tab")
check(step(.main, .guest, "profile")?.tabTarget == .profile, "Profile step spotlights its tab")
check(step(.main, .guest, "welcome")?.anchor == nil && step(.main, .guest, "welcome")?.tabTarget == nil,
      "welcome is a centred card")

print("\nThe main tour's last step")
check(GuideRules.finalActions(.main, state: .guest) == [.startHostTour, .done], "guest: Show me how + Done")
check(GuideRules.finalActions(.main, state: .signedOut) == [.startHostTour, .done], "signed out: Show me how + Done")
check(GuideRules.finalActions(.main, state: .pending) == [.startHostTour, .done], "pending: Show me how + Done")
check(GuideRules.finalActions(.main, state: .host) == [.done], "host: Done only")

print("\nThe host tour points at whichever card Profile is showing")
let hostOrder = ["host.intro", "host.profileTab", "host.entry", "host.requirements", "host.review", "host.afterApproval"]
for state in [GuideHostState.signedOut, .guest, .pending, .host] {
    check(ids(.host, state) == hostOrder, "\(state): six steps in spec order")
}
check(step(.host, .signedOut, "host.entry")?.anchor == GuideAnchor.signIn, "signed out → the sign-in button")
check(step(.host, .guest, "host.entry")?.anchor == GuideAnchor.hostApply, "guest → the Become a host card")
check(step(.host, .pending, "host.entry")?.anchor == GuideAnchor.hostPending, "pending → the status card")
check(step(.host, .host, "host.entry")?.anchor == GuideAnchor.hostDashboard, "host → the dashboard entry")
check(GuideRules.steps(.host, state: .guest).allSatisfy { $0.anchor == nil || $0.tab == .profile },
      "every anchored host step lives on Profile")
check(step(.host, .guest, "host.profileTab")?.tabTarget == .profile, "step 2 spotlights the Profile tab")
check(step(.host, .guest, "host.requirements")?.showsChecklist == true, "requirements step shows the checklist")
check(step(.host, .guest, "host.requirements")?.bodyKey == nil, "the checklist step has no body line")
check(GuideRules.requirementKeys.count == 5, "five things to have ready, one per form section")

print("\nThe host tour's last step only offers what the account can do")
check(GuideRules.finalActions(.host, state: .guest) == [.applyNow, .done], "guest: Apply now + Done")
check(GuideRules.finalActions(.host, state: .signedOut) == [.signIn, .done], "signed out: Sign in + Done")
check(GuideRules.finalActions(.host, state: .pending) == [.done], "pending: nothing to apply for")
check(GuideRules.finalActions(.host, state: .host) == [.done], "host: nothing to apply for")

print("\nCopy keys")
check(step(.main, .guest, "search")?.titleKey == "guide.search.title", "title key")
check(step(.main, .guest, "search")?.bodyKey == "guide.search.body", "body key")
check(step(.host, .pending, "host.entry")?.titleKey == "guide.host.pending.title", "variant copy key")

print("\n\(checks - failures)/\(checks) checks passed")
exit(failures == 0 ? 0 : 1)
