import Foundation

// MARK: - Destinations tree (GET /api/local/destinations)
//
// The Explore screen's two-level browse rail: a region ("North Coast") and,
// under it, the sub-areas a guest can narrow to ("Marassi · km 124"). The
// endpoint answers the whole tree in rail order, so the app never sorts it.
//
// Pure Foundation on purpose — no SwiftUI — so `Tests/run.sh` can compile this
// file on its own and check the rules below without a simulator.

/// One sub-area under a region, e.g. Marassi under North Coast.
struct DestinationSubArea: Codable, Identifiable, Hashable {
    let id: String
    /// What the listings feed filters on: `area=<slug>`.
    let slug: String
    let name: String
    let nameAr: String?
    /// The Alexandria–Matrouh road marker, for the North Coast compounds.
    let kmMarker: Double?
    let locationNote: String?
    let count: Int

    enum CodingKeys: String, CodingKey {
        case id, slug, name, count
        case nameAr = "name_ar"
        case kmMarker = "km_marker"
        case locationNote = "location_note"
    }

    init(id: String, slug: String, name: String, nameAr: String? = nil,
         kmMarker: Double? = nil, locationNote: String? = nil, count: Int = 0) {
        self.id = id
        self.slug = slug
        self.name = name
        self.nameAr = nameAr
        self.kmMarker = kmMarker
        self.locationNote = locationNote
        self.count = count
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        slug = try c.decode(String.self, forKey: .slug)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? slug
        name = try c.decode(String.self, forKey: .name)
        nameAr = try c.decodeIfPresent(String.self, forKey: .nameAr)
        kmMarker = try c.decodeIfPresent(Double.self, forKey: .kmMarker)
        locationNote = try c.decodeIfPresent(String.self, forKey: .locationNote)
        count = try c.decodeIfPresent(Int.self, forKey: .count) ?? 0
    }
}

/// One top-level region on the rail, with its sub-areas (possibly none).
struct Destination: Codable, Identifiable, Hashable {
    /// The English region name — also the value the feed filters on
    /// (`region=<name>`) and what a listing stores in `region`.
    let name: String
    let slug: String
    let nameAr: String?
    /// An icon KEY ("waves", "pyramid", …), not an SF Symbol name — see
    /// `DestinationRules.symbol(forIcon:)`.
    let icon: String?
    let count: Int
    let subAreas: [DestinationSubArea]

    var id: String { slug }

    enum CodingKeys: String, CodingKey {
        case name, slug, icon, count
        case nameAr = "name_ar"
        case subAreas = "sub_areas"
    }

    init(name: String, slug: String, nameAr: String? = nil, icon: String? = nil,
         count: Int = 0, subAreas: [DestinationSubArea] = []) {
        self.name = name
        self.slug = slug
        self.nameAr = nameAr
        self.icon = icon
        self.count = count
        self.subAreas = subAreas
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decode(String.self, forKey: .name)
        slug = try c.decodeIfPresent(String.self, forKey: .slug)
            ?? DestinationRules.slug(for: name)
        nameAr = try c.decodeIfPresent(String.self, forKey: .nameAr)
        icon = try c.decodeIfPresent(String.self, forKey: .icon)
        count = try c.decodeIfPresent(Int.self, forKey: .count) ?? 0
        // A region with no compounds may omit the key or send null.
        subAreas = try c.decodeIfPresent([DestinationSubArea].self, forKey: .subAreas) ?? []
    }
}

// MARK: - Rules

enum DestinationRules {
    /// The SF Symbol drawn for "All" at the head of the rail.
    static let allSymbol = "square.grid.2x2"
    /// Drawn for an icon key this build doesn't know (a region added later).
    static let fallbackSymbol = "mappin"

    /// Backend icon key → SF Symbol. Every symbol here exists on iOS 17, the
    /// deployment target (`fossil.shell` is the youngest, SF Symbols 5).
    static let iconSymbols: [String: String] = [
        "waves": "water.waves",
        "sunrise": "sunrise",
        "wind": "wind",
        "landmark": "building.columns",
        "building": "building.2",
        "pyramid": "triangle",
        "anchor": "ferry",
        "umbrella": "beach.umbrella",
        "fish": "fish",
        "sailboat": "sailboat",
        "shell": "fossil.shell",
        "mountain": "mountain.2",
    ]

    static func symbol(forIcon key: String?) -> String {
        let k = (key ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return iconSymbols[k] ?? fallbackSymbol
    }

    /// The twelve regions, in rail order, with the icon key and Arabic name the
    /// backend serves. Used when `/destinations` fails and the rail is rebuilt
    /// from the flat `/regions` facets, and by the host form's area picker.
    static let knownRegions: [(name: String, icon: String, nameAr: String)] = [
        ("North Coast", "waves", "الساحل الشمالي"),
        ("Ain Sokhna", "sunrise", "العين السخنة"),
        ("Ras Sudr", "wind", "رأس سدر"),
        ("Cairo", "landmark", "القاهرة"),
        ("New Cairo", "building", "القاهرة الجديدة"),
        ("Giza", "pyramid", "الجيزة"),
        ("Alexandria", "anchor", "الإسكندرية"),
        ("Marsa Matrouh", "umbrella", "مطروح"),
        ("Hurghada", "fish", "الغردقة"),
        ("El Gouna", "sailboat", "الجونة"),
        ("Sharm El Sheikh", "shell", "شرم الشيخ"),
        ("Dahab", "mountain", "دهب"),
    ]

    /// The English region values, in order — what a listing may store.
    static var regionNames: [String] { knownRegions.map(\.name) }

    /// Arabic name for a known English region, or `nil` when unknown.
    static func arabicName(forRegion name: String) -> String? {
        knownRegions.first { $0.name.caseInsensitiveCompare(name) == .orderedSame }?.nameAr
    }

    /// What a guest reads: the Arabic name when the app is in Arabic and one
    /// exists (and isn't blank), otherwise the English name.
    static func displayName(english: String, arabic: String?, isArabic: Bool) -> String {
        guard isArabic,
              let ar = arabic?.trimmingCharacters(in: .whitespacesAndNewlines),
              !ar.isEmpty else { return english }
        return ar
    }

    /// The muted suffix on a sub-area chip: "km 124", "km 124.5", or `nil`
    /// when the compound has no road marker (or a nonsense one).
    static func kmLabel(_ marker: Double?) -> String? {
        guard let marker, marker.isFinite, marker >= 0 else { return nil }
        if marker == marker.rounded() { return "km \(Int(marker))" }
        return "km \(String(format: "%.1f", marker))"
    }

    /// `"North Coast"` → `"north-coast"`; only used when a payload omits a slug.
    static func slug(for name: String) -> String {
        name.lowercased()
            .split { !$0.isLetter && !$0.isNumber }
            .joined(separator: "-")
    }

    /// Rebuild a rail from the old flat `/regions` facets (name + count) when
    /// `/destinations` is unavailable. No sub-areas — the sub row stays hidden.
    static func fallback(fromFacets facets: [(region: String, count: Int)]) -> [Destination] {
        facets.map { facet in
            let known = knownRegions.first { $0.name.caseInsensitiveCompare(facet.region) == .orderedSame }
            return Destination(
                name: facet.region,
                slug: slug(for: facet.region),
                nameAr: known?.nameAr,
                icon: known?.icon,
                count: facet.count,
                subAreas: []
            )
        }
    }

    /// The sub-areas offered under `region` — empty for "All", an unknown
    /// region, or a region without compounds (the sub row then hides).
    static func subAreas(for region: String?, in destinations: [Destination]) -> [DestinationSubArea] {
        guard let region else { return [] }
        return destinations.first { $0.name == region }?.subAreas ?? []
    }
}

/// Which region and sub-area the Explore rail has selected. A value type so the
/// two transition rules are testable without the view model.
struct DestinationSelection: Equatable {
    /// English region name; `nil` = "All".
    var region: String?
    /// Sub-area slug; `nil` = the whole region. Always `nil` when `region` is.
    var area: String?

    /// Pick a region (or `nil` for "All"). Always clears the sub-area: a
    /// compound belongs to one region, so it can't survive a region change.
    /// Returns whether anything changed (i.e. whether to refetch).
    @discardableResult
    mutating func selectRegion(_ newRegion: String?) -> Bool {
        let changed = newRegion != region || area != nil
        region = newRegion
        area = nil
        return changed
    }

    /// Pick a sub-area slug (or `nil` for the region's "All"). Ignored while no
    /// region is selected. Returns whether anything changed.
    @discardableResult
    mutating func selectArea(_ newArea: String?) -> Bool {
        guard region != nil else { return false }
        guard newArea != area else { return false }
        area = newArea
        return true
    }
}
