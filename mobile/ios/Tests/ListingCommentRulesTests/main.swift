// Unit tests for Sources/ListingCommentRules.swift — the client half of a
// listing's public "Questions & comments", which replaced host ⇄ guest
// messaging on 2026-10-02.
//
// What matters most here is notification routing: a `comment` / `comment_reply`
// must open the listing's comments, and the retired `message` type — whose old
// rows are still in people's feeds — must open nothing, never a chat screen.
//
// This app has no XCTest target, so the suite is a plain executable over the same pure
// file the app compiles — no UIKit, no SwiftUI, no simulator:
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

print("Body limits match the server's (1000 chars after trimming)")
check(!ListingCommentRules.canSubmit(""), "empty is refused")
check(!ListingCommentRules.canSubmit("   \n\t "), "whitespace-only is refused")
check(ListingCommentRules.canSubmit("Is the pool heated?"), "a question is allowed")
check(ListingCommentRules.canSubmit(String(repeating: "a", count: 1000)), "exactly 1000 is allowed")
check(!ListingCommentRules.canSubmit(String(repeating: "a", count: 1001)), "1001 is refused")
check(ListingCommentRules.canSubmit("  " + String(repeating: "a", count: 1000) + "  "), "surrounding spaces don't count")
check(ListingCommentRules.trimmed("  hi \n") == "hi", "trimmed drops surrounding whitespace")
check(ListingCommentRules.remaining("abc") == 997, "remaining counts down")
check(ListingCommentRules.remaining(String(repeating: "a", count: 1005)) == -5, "remaining goes negative over the cap")
check(!ListingCommentRules.showsCounter("short"), "no counter far from the cap")
check(ListingCommentRules.showsCounter(String(repeating: "a", count: 950)), "counter near the cap")

print("\nBylines mirror the server's authorDisplayName")
check(ListingCommentRules.authorName("Sara Ahmed") == "Sara A.", "first name + last initial")
check(ListingCommentRules.authorName("sara mohamed ahmed") == "sara A.", "last word's initial, uppercased")
check(ListingCommentRules.authorName("Sara") == "Sara", "single name stays")
check(ListingCommentRules.authorName("   ") == "QuickIn guest", "blank → QuickIn guest")
check(ListingCommentRules.authorName(nil) == "QuickIn guest", "nil → QuickIn guest")
check(ListingCommentRules.initials("Sara A.") == "SA", "initials skip the period")
check(ListingCommentRules.initials("") == "G", "no name → G")

print("\nComment notifications open the listing's comments")
let id = "4f1c2e9a-0000-4000-8000-000000000001"
check(ListingCommentRules.listingID(notificationType: "comment", link: "/explore/\(id)#comments") == id, "comment → listing id")
check(ListingCommentRules.listingID(notificationType: "comment_reply", link: "/explore/\(id)#comments") == id, "comment_reply → listing id")
check(ListingCommentRules.listingID(notificationType: "COMMENT", link: "/explore/\(id)#comments") == id, "type is case-insensitive")
check(ListingCommentRules.listingID(notificationType: "comment", link: "/explore/\(id)") == id, "typed row works without the fragment")
check(ListingCommentRules.listingID(notificationType: "comment", link: "https://quickin-frontend.vercel.app/explore/\(id)#comments") == id, "full URL works")
check(ListingCommentRules.listingID(notificationType: "comment", link: "/explore/\(id)?ref=push#comments") == id, "query string is ignored")

print("\nPushes carry only the link — the #comments fragment marks them")
check(ListingCommentRules.listingID(notificationType: nil, link: "/explore/\(id)#comments") == id, "push with #comments → listing id")
check(ListingCommentRules.listingID(notificationType: nil, link: "/explore/\(id)") == nil, "push without #comments → nothing")

print("\nEverything else opens nothing special")
check(ListingCommentRules.listingID(notificationType: "message", link: "/messages/abc") == nil, "retired message type → nothing")
check(ListingCommentRules.listingID(notificationType: "message", link: "/explore/\(id)#comments") == nil, "message type never routes, whatever the link")
check(ListingCommentRules.listingID(notificationType: "booking_confirmed", link: "/reservations/abc") == nil, "booking → nothing (not this feature)")
check(ListingCommentRules.listingID(notificationType: "comment", link: nil) == nil, "no link → nothing")
check(ListingCommentRules.listingID(notificationType: "comment", link: "  ") == nil, "blank link → nothing")
check(ListingCommentRules.listingID(notificationType: "comment", link: "/explore/#comments") == nil, "missing id → nothing")
check(ListingCommentRules.listingID(notificationType: "comment", link: "/host/comments") == nil, "unknown path → nothing")

print("")
if failures == 0 {
    print("All \(checks) checks passed.")
} else {
    print("\(failures) of \(checks) checks FAILED.")
    exit(1)
}
