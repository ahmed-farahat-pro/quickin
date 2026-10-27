// Unit tests for Sources/DestinationRules.swift — the Explore destinations rail
// (regions → sub-areas from GET /api/local/destinations).
//
// This app has no XCTest target, so the suite is a plain executable over the same pure
// file the app compiles:
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

print("Icon keys map to SF Symbols")
check(DestinationRules.symbol(forIcon: "waves") == "water.waves", "waves → water.waves")
check(DestinationRules.symbol(forIcon: "pyramid") == "triangle", "pyramid → triangle")
check(DestinationRules.symbol(forIcon: "mountain") == "mountain.2", "mountain → mountain.2")
check(DestinationRules.symbol(forIcon: " Shell ") == "fossil.shell", "keys are trimmed + case-insensitive")
check(DestinationRules.symbol(forIcon: "volcano") == "mappin", "unknown key → mappin")
check(DestinationRules.symbol(forIcon: nil) == "mappin", "missing key → mappin")
let keys = ["waves", "sunrise", "wind", "landmark", "building", "pyramid", "anchor",
            "umbrella", "fish", "sailboat", "shell", "mountain"]
check(keys.allSatisfy { DestinationRules.symbol(forIcon: $0) != "mappin" }, "all 12 backend keys are mapped")

print("\nDisplay names follow the app language")
check(DestinationRules.displayName(english: "Dahab", arabic: "دهب", isArabic: true) == "دهب", "Arabic → name_ar")
check(DestinationRules.displayName(english: "Dahab", arabic: "دهب", isArabic: false) == "Dahab", "English → name")
check(DestinationRules.displayName(english: "Dahab", arabic: nil, isArabic: true) == "Dahab", "no name_ar → English")
check(DestinationRules.displayName(english: "Dahab", arabic: "  ", isArabic: true) == "Dahab", "blank name_ar → English")

print("\nKm marker suffix")
check(DestinationRules.kmLabel(124) == "km 124", "whole marker → km 124")
check(DestinationRules.kmLabel(124.5) == "km 124.5", "fractional marker keeps one decimal")
check(DestinationRules.kmLabel(nil) == nil, "no marker → no suffix")
check(DestinationRules.kmLabel(-3) == nil, "negative marker → no suffix")

print("\nHost form regions")
check(DestinationRules.regionNames == ["North Coast", "Ain Sokhna", "Ras Sudr", "Cairo", "New Cairo", "Giza",
                                       "Alexandria", "Marsa Matrouh", "Hurghada", "El Gouna",
                                       "Sharm El Sheikh", "Dahab"], "the 12 regions, rail order, exact values")
check(DestinationRules.arabicName(forRegion: "marsa matrouh") == "مطروح", "Arabic lookup is case-insensitive")
check(DestinationRules.arabicName(forRegion: "Atlantis") == nil, "unknown region → nil")

print("\nDecoding the destinations tree")
let json = """
[{"name":"North Coast","slug":"north-coast","name_ar":"الساحل الشمالي","icon":"waves","count":3,
  "sub_areas":[{"id":"a","slug":"marassi","name":"Marassi","name_ar":"مراسي","km_marker":124.0,"location_note":null,"count":2},
               {"id":"b","slug":"hacienda","name":"Hacienda","count":1}]},
 {"name":"Dahab","slug":"dahab","name_ar":"دهب","icon":"mountain","count":0,"sub_areas":[]},
 {"name":"Giza","slug":"giza","icon":"pyramid","count":0}]
"""
let tree = try! JSONDecoder().decode([Destination].self, from: Data(json.utf8))
check(tree.count == 3, "three regions decoded in order")
check(tree[0].subAreas.count == 2 && tree[0].subAreas[0].kmMarker == 124, "sub-areas + km marker decoded")
check(tree[0].subAreas[1].kmMarker == nil && tree[0].subAreas[1].nameAr == nil, "missing optional fields → nil")
check(tree[2].subAreas.isEmpty, "missing sub_areas → empty")
check(DestinationRules.subAreas(for: "North Coast", in: tree).map(\.slug) == ["marassi", "hacienda"], "sub row for North Coast")
check(DestinationRules.subAreas(for: "Dahab", in: tree).isEmpty, "no sub row for Dahab")
check(DestinationRules.subAreas(for: nil, in: tree).isEmpty, "no sub row for All")

print("\nFallback from flat /regions facets")
let fb = DestinationRules.fallback(fromFacets: [(region: "Ain Sokhna", count: 4), (region: "Atlantis", count: 1)])
check(fb.map(\.slug) == ["ain-sokhna", "atlantis"], "slugs derived from names")
check(fb[0].icon == "sunrise" && fb[0].nameAr == "العين السخنة", "known region keeps its icon + Arabic name")
check(fb[1].icon == nil && fb.allSatisfy { $0.subAreas.isEmpty }, "unknown region → no icon; never sub-areas")

print("\nSelecting a region resets the sub-area")
var sel = DestinationSelection()
check(!sel.selectArea("marassi"), "no area without a region")
check(sel.selectRegion("North Coast"), "pick North Coast → refetch")
check(sel.selectArea("marassi") && sel.area == "marassi", "pick Marassi → refetch with area")
check(!sel.selectArea("marassi"), "same area again → no refetch")
check(sel.selectRegion("North Coast") && sel.area == nil, "re-tapping the region clears the area and refetches")
check(!sel.selectRegion("North Coast"), "same region, no area → no refetch")
_ = sel.selectArea("marassi")
check(sel.selectRegion("Dahab") && sel.region == "Dahab" && sel.area == nil, "switching region clears the area")
_ = sel.selectRegion(nil)
check(sel == DestinationSelection(), "All clears both")

print("\n\(checks - failures)/\(checks) checks passed")
exit(failures == 0 ? 0 : 1)
