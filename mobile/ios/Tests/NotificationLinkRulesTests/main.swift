// Unit tests for Sources/NotificationLinkRules.swift — where a tapped
// notification (in-app feed row or push) takes the user.
//
// The reported defect: only `comment` / `comment_reply` notifications went
// anywhere; a booking, payment, host or verification notification did nothing
// at all when tapped. The link (a relative web path from the backend) is now
// what decides, so these checks walk every link shape the backend sends.
//
// This app has no XCTest target, so the suite is a plain executable over the same pure
// files the app compiles (plus `ShareLinks.swift`, whose `AppLinks` parser the
// rules reuse) — no UIKit, no SwiftUI, no simulator:
//
//     cd mobile/ios && ./Tests/run.sh
//
// Exits non-zero if any check fails.
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

func dest(_ link: String?, type: String? = nil, isHost: Bool = false) -> NotificationLinkRules.Destination? {
    NotificationLinkRules.destination(type: type, link: link, isHost: isHost)
}

let id = "4f1c2e9a-0000-4000-8000-000000000001"

print("Listing links open the listing, whatever the type")
check(dest("/explore/\(id)", type: "listing_approved") == .listing(id: id, focusComments: false), "typed listing link → listing")
check(dest("/explore/\(id)") == .listing(id: id, focusComments: false), "push listing link → listing")
check(dest("/explore/\(id)#comments") == .listing(id: id, focusComments: true), "#comments → focus comments")
check(dest("/explore/\(id)#COMMENTS") == .listing(id: id, focusComments: true), "fragment is case-insensitive")
check(dest("/explore/\(id)", type: "comment") == .listing(id: id, focusComments: true), "comment type focuses comments without the fragment")
check(dest("/explore/\(id)#comments", type: "comment_reply") == .listing(id: id, focusComments: true), "comment_reply → focus comments")
check(dest("/explore/\(id)?ref=push#comments") == .listing(id: id, focusComments: true), "query string is ignored")
check(dest("explore/\(id)") == .listing(id: id, focusComments: false), "missing leading slash is tolerated")
check(dest("  /explore/\(id)  ") == .listing(id: id, focusComments: false), "surrounding whitespace is tolerated")
check(dest("/explore/") == nil, "listing link without an id → nothing")

print("\nReservations")
check(dest("/reservation/\(id)", type: "booking_confirmed") == .reservation(id: id), "/reservation/<id> → that reservation")
check(dest("/reservation/\(id)") == .reservation(id: id), "push /reservation/<id> → that reservation")
check(dest("/reservations/\(id)") == .reservation(id: id), "/reservations/<id> → that reservation")
check(dest("/reservations") == .reservations, "/reservations → Trips tab")
check(dest("/reservations/") == .reservations, "trailing slash → Trips tab")

print("\nHost, account, verification")
check(dest("/host", isHost: true) == .hostDashboard, "/host for a host → dashboard")
check(dest("/host", isHost: false) == .account, "/host for a non-host → Profile (no dashboard to show)")
check(dest("/account") == .account, "/account → Profile")
check(dest("/verify-id") == .account, "/verify-id → Profile (the verification card lives there)")

print("\nRetired Services (experiences) links open Explore")
check(dest("/services/\(id)") == .explore, "/services/<id> → Explore")
check(dest("/service/\(id)") == .explore, "/service/<id> → Explore")
check(dest("/services") == .explore, "/services → Explore")
check(dest("/subscriptions") == .explore, "/subscriptions → Explore")
check(dest("/SERVICES/\(id)", type: "service_request") == .explore, "keyword is case-insensitive")
check(dest("https://quickin-frontend.vercel.app/services/\(id)") == .explore, "web URL → Explore")
check(dest("quickin://services/\(id)") == .explore, "quickin:// → Explore")
check(dest("https://evil.example.com/services/\(id)") == nil, "foreign host → nothing")
check(AppLinks.destination(from: URL(string: "https://quickin-frontend.vercel.app/services/\(id)")!) == nil, "AppLinks no longer parses a service")
check(AppLinks.isRetired(URL(string: "https://quickin-frontend.vercel.app/services/\(id)")!), "AppLinks.isRetired: web /services/<id>")
check(AppLinks.isRetired(URL(string: "quickin://subscriptions")!), "AppLinks.isRetired: quickin://subscriptions")
check(!AppLinks.isRetired(URL(string: "https://quickin-frontend.vercel.app/explore/\(id)")!), "AppLinks.isRetired: listing link is not retired")
check(!AppLinks.isRetired(URL(string: "https://evil.example.com/services/\(id)")!), "AppLinks.isRetired: foreign host is not ours")

print("\nAbsolute and custom-scheme links reuse AppLinks")
check(dest("https://quickin-frontend.vercel.app/explore/\(id)#comments") == .listing(id: id, focusComments: true), "web URL → listing")
check(dest("https://quickin-frontend.vercel.app/reservation/\(id)") == .reservation(id: id), "web URL → reservation")
check(dest("https://quickin-frontend.vercel.app/account") == .account, "web URL keyword → Profile")
check(dest("quickin://explore/\(id)") == .listing(id: id, focusComments: false), "quickin:// → listing")
check(dest("quickin://host", isHost: true) == .hostDashboard, "quickin://host → dashboard")
check(dest("quickin://reservations") == .reservations, "quickin://reservations → Trips tab")
check(dest("https://evil.example.com/explore/\(id)") == nil, "foreign host → nothing")
check(dest("mailto:someone@example.com") == nil, "foreign scheme → nothing")

print("\nEverything else opens nothing (the row is just marked read)")
check(dest("/messages") == nil, "/messages → nothing (chat is retired)")
check(dest("/messages/abc", type: "message") == nil, "/messages/<id> → nothing")
check(dest("/ops") == nil, "/ops → nothing (admin is web-only)")
check(dest("/ops/disputes", type: "dispute") == nil, "/ops/... → nothing")
check(dest(nil) == nil, "nil link → nothing")
check(dest("") == nil, "empty link → nothing")
check(dest("   ") == nil, "blank link → nothing")
check(dest("/") == nil, "bare slash → nothing")
check(dest("/something-new") == nil, "unknown path → nothing")

print("")
if failures == 0 {
    print("All \(checks) checks passed.")
} else {
    print("\(failures) of \(checks) checks FAILED.")
    exit(1)
}
