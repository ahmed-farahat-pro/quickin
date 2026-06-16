import SwiftUI

/// Shared amenity catalog used by the host add-listing wizard (multi-select
/// chips) and the listing detail "What this place offers" grid. Keeping the
/// list + icon mapping in one place means both screens stay in sync.
enum Amenities {
    /// The selectable amenities offered in the add-listing wizard, in display
    /// order. The exact strings are what get sent to the backend and rendered
    /// back on the detail screen.
    static let all: [String] = [
        "WiFi",
        "Pool",
        "Kitchen",
        "Air conditioning",
        "Free parking",
        "Washer",
        "TV",
        "Heating",
        "Workspace",
        "Gym",
        "Beach access",
        "Pets allowed",
        "Hot tub",
        "BBQ grill",
        "Breakfast",
    ]

    /// Display label for an amenity in the active language. The canonical English
    /// value is always what's stored / sent to the backend; this only swaps the
    /// shown text to Arabic when the app is in Arabic. Unknown values fall back to
    /// their raw string.
    @MainActor
    static func label(for amenity: String) -> String {
        guard LocalizationManager.shared.lang == .ar else { return amenity }
        return arabicLabels[amenity.lowercased()] ?? amenity
    }

    /// Arabic display strings keyed by the lowercased canonical English value.
    private static let arabicLabels: [String: String] = [
        "wifi": "واي فاي",
        "pool": "حمام سباحة",
        "kitchen": "مطبخ",
        "air conditioning": "تكييف",
        "free parking": "موقف مجاني",
        "washer": "غسالة",
        "tv": "تلفزيون",
        "heating": "تدفئة",
        "workspace": "مساحة عمل",
        "gym": "صالة رياضية",
        "beach access": "وصول للشاطئ",
        "pets allowed": "يُسمح بالحيوانات",
        "hot tub": "جاكوزي",
        "bbq grill": "شواية",
        "breakfast": "إفطار",
    ]

    /// SF Symbol paired with an amenity label. Case-insensitive lookup against
    /// the known set, falling back to a neutral checkmark for any unknown value
    /// the backend might return.
    static func icon(for amenity: String) -> String {
        switch amenity.lowercased() {
        case "wifi":             return "wifi"
        case "pool":             return "figure.pool.swim"
        case "kitchen":          return "fork.knife"
        case "air conditioning": return "snowflake"
        case "free parking":     return "parkingsign"
        case "washer":           return "washer"
        case "tv":               return "tv"
        case "heating":          return "thermometer.sun"
        case "workspace":        return "desktopcomputer"
        case "gym":              return "dumbbell"
        case "beach access":     return "beach.umbrella"
        case "pets allowed":     return "pawprint"
        case "hot tub":          return "bathtub"
        case "bbq grill":        return "flame"
        case "breakfast":        return "cup.and.saucer"
        default:                 return "checkmark.circle"
        }
    }
}
