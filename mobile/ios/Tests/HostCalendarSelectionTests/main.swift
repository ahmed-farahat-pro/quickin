// Unit tests for Sources/HostCalendarSelection.swift — the Swift mirror of the web's
// test/unit/calendar-selection-core.test.mjs: the host pricing calendar's
// tap-start/tap-end selection, run grouping, month paging and swipe direction.
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

typealias S = HostCalendarSelection
let all: (String) -> Bool = { _ in true }
let CAP = 800
func sorted(_ s: Set<String>) -> [String] { s.sorted() }

// MARK: tapDay

do {
    let r = S.tapDay(selected: [], anchor: nil, date: "2026-12-20", isEditable: all, maxDays: CAP)
    check(sorted(r.selected) == ["2026-12-20"] && r.anchor == "2026-12-20", "first tap selects the day and makes it the anchor")
}
do {
    let r = S.tapDay(selected: ["2026-12-20"], anchor: "2026-12-20", date: "2026-12-23", isEditable: all, maxDays: CAP)
    check(sorted(r.selected) == ["2026-12-20", "2026-12-21", "2026-12-22", "2026-12-23"] && r.anchor == nil,
          "second tap fills the range and clears the anchor")
}
do {
    let r = S.tapDay(selected: ["2026-12-23"], anchor: "2026-12-23", date: "2026-12-21", isEditable: all, maxDays: CAP)
    check(sorted(r.selected) == ["2026-12-21", "2026-12-22", "2026-12-23"], "the end may come before the anchor")
}
do {
    let r = S.tapDay(selected: ["2026-12-20"], anchor: "2026-12-20", date: "2026-12-20", isEditable: all, maxDays: CAP)
    check(sorted(r.selected) == ["2026-12-20"] && r.anchor == nil, "tapping the anchor again keeps it as a single day")
}
do {
    let r = S.tapDay(selected: ["2026-12-20", "2026-12-21"], anchor: nil, date: "2026-12-21", isEditable: all, maxDays: CAP)
    check(sorted(r.selected) == ["2026-12-20"] && r.anchor == nil, "with nothing pending, tapping a selected day removes it")
}
do {
    let r = S.tapDay(selected: ["2026-12-01", "2026-12-02"], anchor: nil, date: "2026-12-10", isEditable: all, maxDays: CAP)
    check(sorted(r.selected) == ["2026-12-01", "2026-12-02", "2026-12-10"] && r.anchor == "2026-12-10",
          "ranges accumulate: a fresh tap starts a second range")
}
do {
    let editable: (String) -> Bool = { $0 != "2026-12-22" }
    let r = S.tapDay(selected: ["2026-12-20"], anchor: "2026-12-20", date: "2026-12-24", isEditable: editable, maxDays: CAP)
    check(sorted(r.selected) == ["2026-12-20", "2026-12-21", "2026-12-23", "2026-12-24"], "booked days inside a range are skipped")
}
do {
    let r = S.tapDay(selected: ["2026-12-20"], anchor: "2026-12-20", date: "2026-12-22", isEditable: { $0 != "2026-12-22" }, maxDays: CAP)
    check(sorted(r.selected) == ["2026-12-20"] && r.anchor == "2026-12-20", "tapping an uneditable day changes nothing")
}
do {
    let r = S.tapDay(selected: [], anchor: "2026-12-20", date: "2026-12-25", isEditable: all, maxDays: CAP)
    check(sorted(r.selected) == ["2026-12-25"] && r.anchor == "2026-12-25", "a stale anchor is ignored")
}
do {
    let r = S.tapDay(selected: ["2026-12-01"], anchor: "2026-12-01", date: "2026-12-11", isEditable: all, maxDays: 5)
    check(r.tooLong && sorted(r.selected) == ["2026-12-01"] && r.anchor == "2026-12-01",
          "a range past the cap is refused and the anchor stays pending")
}
do {
    let r = S.tapDay(selected: ["2026-01-01"], anchor: "2026-01-01", date: "2028-06-01", isEditable: all)
    check(r.tooLong, "the default cap is 800 days")
}

// MARK: rangeDays

check(S.rangeDays("2027-01-02", "2026-12-30", isEditable: all, maxDays: CAP)
      == ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"], "rangeDays is inclusive, order-independent, crosses years")
check(S.rangeDays("2026-12-01", "2026-12-10", isEditable: all, maxDays: 3).isEmpty, "rangeDays is empty past the cap")
check(S.rangeDays("nope", "2026-12-10", isEditable: all, maxDays: CAP).isEmpty, "rangeDays is empty for bad input")

// MARK: toggleMonth

do {
    let month = ["2026-12-01", "2026-12-02"]
    check(S.toggleMonth([], editable: month) == Set(month), "select month adds every editable day")
    check(S.toggleMonth(Set(month + ["2027-01-05"]), editable: month) == ["2027-01-05"], "a fully selected month is cleared")
    check(S.isMonthFullySelected(Set(month), editable: month), "fully selected month detected")
    check(!S.isMonthFullySelected([], editable: []), "a month with nothing editable is never 'fully selected'")
}

// MARK: selectionRuns / runPosition

check(S.selectionRuns(["2026-12-31", "2027-01-01", "2026-12-05", "2026-12-30"]) == [
    S.Run(start: "2026-12-05", end: "2026-12-05", days: 1),
    S.Run(start: "2026-12-30", end: "2027-01-01", days: 3),
], "runs group consecutive days across a year boundary")
check(S.selectionRuns([String]()).isEmpty, "no runs for no days")

do {
    let s: Set<String> = ["2026-12-01", "2026-12-02", "2026-12-03", "2026-12-09"]
    check(S.runPosition(s, "2026-12-01") == .start, "run start")
    check(S.runPosition(s, "2026-12-02") == .middle, "run middle")
    check(S.runPosition(s, "2026-12-03") == .end, "run end")
    check(S.runPosition(s, "2026-12-09") == .single, "single day")
    check(S.runPosition(s, "2026-12-04") == nil, "unselected day")
}

// MARK: priceSpan

do {
    let days: [String: Double] = ["a": 4200, "b": 3500]
    let span = S.priceSpan(["a", "b", "c"]) { days[$0] }
    check(span?.min == 3500 && span?.max == 4200, "price span over the selection, ignoring unloaded days")
    check(S.priceSpan(["c"]) { days[$0] } == nil, "no span when nothing is loaded")
}

// MARK: clampMonthOffset / paging

check(S.clampMonthOffset(-3, visible: 1, horizon: 24) == 0, "clamp below zero")
check(S.clampMonthOffset(30, visible: 1, horizon: 24) == 23, "one-up stops at the last month")
check(S.clampMonthOffset(30, visible: 2, horizon: 24) == 22, "two-up stops a page earlier")
check(S.clampMonthOffset(5, visible: 2, horizon: 24) == 5, "in range is untouched")
check(S.offsetsToLoad(page: 0, visible: 1) == [0, 1], "load visible + one ahead")
check(S.offsetsToLoad(page: 22, visible: 2) == [22, 23], "never load past the horizon")
check(S.monthStart("2026-11-19", 0) == "2026-11-01", "monthStart this month")
check(S.monthStart("2026-11-19", 2) == "2027-01-01", "monthStart rolls the year")
check(S.monthGrid("2026-11-01").count == 30, "Nov 2026 starts on a Sunday: no blanks")
check(S.monthGrid("2026-12-01").prefix(2).allSatisfy { $0 == nil } && S.monthGrid("2026-12-01")[2] == "2026-12-01",
      "Dec 2026 starts on a Tuesday: two blanks")
check(S.monthDays("2028-02-01").count == 29, "leap February")

// MARK: swipeDirection

check(S.swipeDirection(dx: -80, dy: 10) == .next, "leftward swipe goes forward")
check(S.swipeDirection(dx: 80, dy: 10) == .prev, "rightward swipe goes back")
check(S.swipeDirection(dx: -80, dy: 10, rtl: true) == .prev, "RTL mirrors leftward")
check(S.swipeDirection(dx: 80, dy: 10, rtl: true) == .next, "RTL mirrors rightward")
check(S.swipeDirection(dx: -30, dy: 0) == nil, "short gesture is not a swipe")
check(S.swipeDirection(dx: -80, dy: 70) == nil, "mostly-vertical gesture is not a swipe")

// MARK: compactPrice

check(S.compactPrice(2500) == "2,500", "groups thousands")
check(S.compactPrice(99_999) == "99,999", "under 100k stays whole")
check(S.compactPrice(125_000) == "125k", "six digits abbreviate")
check(S.compactPrice(1_250_000) == "1,250k", "seven digits abbreviate with grouping")

print("\n\(checks - failures)/\(checks) passed")
exit(failures == 0 ? 0 : 1)
