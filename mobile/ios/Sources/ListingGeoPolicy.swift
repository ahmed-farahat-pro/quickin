import CoreLocation
import Foundation

/// The map pin has to be where the listing says it is.
///
/// The add-listing wizard asks for the place twice: in words (the Region chip,
/// the city, the Country picker) and as a pin the host drops on the map. Nothing
/// compared the two — on the web a host could choose Egypt → North Coast and
/// click the map in Germany, and the listing saved without a murmur. The same
/// two fields are independent here.
///
/// This is the Swift translation of `src/lib/local/listing-geo-policy.ts`, which
/// both web projects carry byte-identical (a parity script guards those two).
/// Android carries the same rule again in `ListingGeoPolicy.kt`. Both mobile
/// copies are updated by hand, so the numbers below are the thing to keep in
/// step. The rule is a **bounding box** per country and per curated area — not a
/// polygon and not a reverse-geocode, which would be a rate-limited network call
/// on every pin drag and useless on a phone with no signal.
///
/// It **warns, it never blocks.** `AddListingView` shows the problem under the
/// map and still lets the host continue; the API stores the pin either way and
/// badges the mismatch for the operator who approves the listing in /ops. A
/// rectangle written in a source file must not be the reason a real property
/// can't be listed — which is also why the boxes are drawn generously.
enum ListingGeoPolicy {

    /// A lat/lng rectangle, in degrees. `south`/`west` are the low corner.
    struct GeoBox {
        let south: Double
        let west: Double
        let north: Double
        let east: Double

        func contains(_ coordinate: CLLocationCoordinate2D) -> Bool {
            coordinate.latitude >= south && coordinate.latitude <= north
                && coordinate.longitude >= west && coordinate.longitude <= east
        }
    }

    /// Why a pin was questioned.
    enum ProblemCode {
        case outOfRange
        case outsideCountry
        case outsideRegion
    }

    /// A questioned pin, and the place it disagrees with (the country name for
    /// `.outsideCountry`, the region name for `.outsideRegion`).
    struct Problem {
        let code: ProblemCode
        let scope: String

        /// What the host reads under the map.
        var message: String {
            switch code {
            case .outOfRange:
                return "That isn't a valid spot on the map. Tap the map again to place the pin."
            case .outsideCountry:
                return "This pin is outside \(scope) — guests will see your place there on the map. Move the pin, or change the country."
            case .outsideRegion:
                return "This pin is outside \(scope) — guests browsing that area will see your place here. Move the pin, or change the region."
            }
        }
    }

    /// Country boxes for the countries the host form offers, padded outward from
    /// each country's real extent: they answer "is this pin plausibly in the
    /// country the host chose", not "where exactly is the border". A chalet
    /// pinned a few hundred metres offshore must not be flagged; a pin on
    /// another continent must be.
    static let countryBoxes: [String: GeoBox] = [
        "Egypt": GeoBox(south: 21.8, west: 24.5, north: 31.8, east: 37.1),
        "Saudi Arabia": GeoBox(south: 15.5, west: 34.3, north: 32.3, east: 55.8),
        "United Arab Emirates": GeoBox(south: 22.4, west: 51.4, north: 26.2, east: 56.6),
        "Kuwait": GeoBox(south: 28.4, west: 46.4, north: 30.2, east: 48.5),
        "Qatar": GeoBox(south: 24.4, west: 50.6, north: 26.3, east: 51.8),
        "Bahrain": GeoBox(south: 25.5, west: 50.3, north: 26.4, east: 50.9),
        "Oman": GeoBox(south: 16.5, west: 51.8, north: 26.5, east: 60.0),
        "Jordan": GeoBox(south: 29.1, west: 34.8, north: 33.5, east: 39.4),
        "Lebanon": GeoBox(south: 33.0, west: 35.0, north: 34.8, east: 36.7),
        // Wide on purpose: covers Western Sahara rather than flagging a host
        // whose pin sits south of a disputed line.
        "Morocco": GeoBox(south: 20.7, west: -17.3, north: 36.1, east: -0.9),
    ]

    /// The four curated browse areas (`ListingFormOptions.regions`), as boxes.
    /// Wider than the tourist's idea of each place, because a region is a browse
    /// chip rather than an address: "Cairo" means Greater Cairo including Giza,
    /// Sheikh Zayed, 6th of October and New Cairo.
    static let regionBoxes: [String: GeoBox] = [
        "North Coast": GeoBox(south: 30.4, west: 24.9, north: 31.7, east: 30.4),
        "Ain Sokhna": GeoBox(south: 29.1, west: 32.0, north: 30.2, east: 32.9),
        "El Gouna": GeoBox(south: 26.8, west: 33.2, north: 27.9, east: 34.1),
        "Cairo": GeoBox(south: 29.5, west: 30.5, north: 30.5, east: 32.0),
    ]

    /// Country names that aren't the canonical spelling (the picker sends the
    /// canonical one; a listing loaded for editing may carry anything).
    private static let countryAliases: [String: String] = [
        "uae": "United Arab Emirates",
        "u.a.e.": "United Arab Emirates",
        "emirates": "United Arab Emirates",
        "ae": "United Arab Emirates",
        "eg": "Egypt",
        "arab republic of egypt": "Egypt",
        "sa": "Saudi Arabia",
        "ksa": "Saudi Arabia",
        "saudi": "Saudi Arabia",
        "kw": "Kuwait",
        "qa": "Qatar",
        "bh": "Bahrain",
        "om": "Oman",
        "jo": "Jordan",
        "lb": "Lebanon",
        "ma": "Morocco",
    ]

    /// Region spellings that mean one of the four curated areas.
    private static let regionAliases: [String: String] = [
        "northcoast": "North Coast",
        "sahel": "North Coast",
        "el sahel": "North Coast",
        "ein sokhna": "Ain Sokhna",
        "sokhna": "Ain Sokhna",
        "elgouna": "El Gouna",
        "gouna": "El Gouna",
        "greater cairo": "Cairo",
    ]

    /// Canonical country name for any casing/alias, or `nil` when unknown.
    static func canonicalCountry(_ value: String?) -> String? {
        let trimmed = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if countryBoxes[trimmed] != nil { return trimmed }
        let lower = trimmed.lowercased()
        if let exact = countryBoxes.keys.first(where: { $0.lowercased() == lower }) { return exact }
        return countryAliases[lower]
    }

    /// Canonical region name for any casing/alias, or `nil` when unknown.
    static func canonicalRegion(_ value: String?) -> String? {
        let trimmed = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if regionBoxes[trimmed] != nil { return trimmed }
        let lower = trimmed.lowercased()
        if let exact = regionBoxes.keys.first(where: { $0.lowercased() == lower }) { return exact }
        return regionAliases[lower]
    }

    /// Does the pin agree with the words?
    ///
    /// Returns `nil` — no complaint — whenever we cannot honestly judge: no pin
    /// at all (it is placed later in the flow), a country we have no box for, a
    /// region we have no box for. A warning the host cannot act on, shown next to
    /// the map they just used, is worse than no warning.
    ///
    /// The country is judged before the region, so a pin in Germany on a North
    /// Coast listing names the bigger, more obvious mistake.
    static func check(
        coordinate: CLLocationCoordinate2D?,
        country: String?,
        region: String?
    ) -> Problem? {
        guard let coordinate else { return nil }
        guard coordinate.latitude.isFinite, coordinate.longitude.isFinite else { return nil }
        guard abs(coordinate.latitude) <= 90, abs(coordinate.longitude) <= 180 else {
            return Problem(code: .outOfRange, scope: "")
        }

        if let name = canonicalCountry(country), let box = countryBoxes[name], !box.contains(coordinate) {
            return Problem(code: .outsideCountry, scope: name)
        }
        if let name = canonicalRegion(region), let box = regionBoxes[name], !box.contains(coordinate) {
            return Problem(code: .outsideRegion, scope: name)
        }
        return nil
    }
}
