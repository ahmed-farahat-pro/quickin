package com.quickin.app

/**
 * One sub-area (compound / district) inside a [Destination], from `GET /api/local/destinations`,
 * e.g. {"slug":"marassi","name":"Marassi","name_ar":"مراسي","km_marker":124.0,"count":2}.
 * [slug] is what the listings feed takes as `area=`.
 */
data class SubArea(
    val id: String,
    val slug: String,
    val name: String,
    val nameAr: String? = null,
    /** Kilometre marker on the coast road (North Coast / Sokhna); null when not applicable. */
    val kmMarker: Double? = null,
    val locationNote: String? = null,
    val count: Int = 0
)

/**
 * A browse region in the Explore rail (`GET /api/local/destinations`, already in rail order),
 * with its icon key and its optional [subAreas]. [name] is the exact English value the
 * listings feed takes as `region=`.
 */
data class Destination(
    val name: String,
    val slug: String,
    val nameAr: String? = null,
    val icon: String? = null,
    val count: Int = 0,
    val subAreas: List<SubArea> = emptyList()
)

/** The rail's icon vocabulary. The UI maps each to a Material icon; [PLACE] is the fallback. */
enum class DestinationIcon {
    WAVES, SUNRISE, WIND, LANDMARK, BUILDING, PYRAMID, ANCHOR, UMBRELLA, FISH, SAILBOAT, SHELL, MOUNTAIN, PLACE
}

/**
 * Pure (JVM-testable) rules for the destinations rail: icon-key mapping, which name to show,
 * the km label, and how selecting a region / sub-area changes the listings query.
 */
object DestinationRules {

    /** Maps the backend's icon key to the rail icon; anything unknown (or null) is [DestinationIcon.PLACE]. */
    fun iconFor(key: String?): DestinationIcon = when (key?.trim()?.lowercase()) {
        "waves" -> DestinationIcon.WAVES
        "sunrise" -> DestinationIcon.SUNRISE
        "wind" -> DestinationIcon.WIND
        "landmark" -> DestinationIcon.LANDMARK
        "building" -> DestinationIcon.BUILDING
        "pyramid" -> DestinationIcon.PYRAMID
        "anchor" -> DestinationIcon.ANCHOR
        "umbrella" -> DestinationIcon.UMBRELLA
        "fish" -> DestinationIcon.FISH
        "sailboat" -> DestinationIcon.SAILBOAT
        "shell" -> DestinationIcon.SHELL
        "mountain" -> DestinationIcon.MOUNTAIN
        else -> DestinationIcon.PLACE
    }

    /** The Arabic name when the app is in Arabic and one exists; the English name otherwise. */
    fun displayName(name: String, nameAr: String?, arabic: Boolean): String =
        if (arabic && !nameAr.isNullOrBlank()) nameAr.trim() else name

    fun displayName(d: Destination, arabic: Boolean): String = displayName(d.name, d.nameAr, arabic)
    fun displayName(s: SubArea, arabic: Boolean): String = displayName(s.name, s.nameAr, arabic)

    /**
     * Arabic names for the 12 curated regions, used where a region is known only by its English
     * value (the host form's area chips). The value sent to the API stays English.
     */
    val REGION_NAMES_AR: Map<String, String> = mapOf(
        "North Coast" to "الساحل الشمالي",
        "Ain Sokhna" to "العين السخنة",
        "Ras Sudr" to "رأس سدر",
        "Cairo" to "القاهرة",
        "New Cairo" to "القاهرة الجديدة",
        "Giza" to "الجيزة",
        "Alexandria" to "الإسكندرية",
        "Marsa Matrouh" to "مطروح",
        "Hurghada" to "الغردقة",
        "El Gouna" to "الجونة",
        "Sharm El Sheikh" to "شرم الشيخ",
        "Dahab" to "دهب"
    )

    /** Display name for a region known only by its English value. */
    fun regionDisplayName(region: String, arabic: Boolean): String =
        displayName(region, REGION_NAMES_AR[region], arabic)

    /**
     * The km number for a sub-area chip suffix ("124", "36.5"), or null when there is no marker.
     * Whole kilometres drop the ".0"; anything else keeps one decimal.
     */
    fun kmNumber(km: Double?): String? {
        if (km == null || km.isNaN() || km.isInfinite() || km < 0) return null
        return if (km % 1.0 == 0.0) km.toLong().toString()
        else String.format(java.util.Locale.US, "%.1f", km)
    }

    /** The English-format suffix label ("km 124"); the UI uses a localized string around [kmNumber]. */
    fun kmLabel(km: Double?): String? = kmNumber(km)?.let { "km $it" }

    /** The destination matching [regionName] (the selected `region=`), if any. */
    fun find(destinations: List<Destination>, regionName: String?): Destination? =
        if (regionName.isNullOrBlank()) null
        else destinations.firstOrNull { it.name.equals(regionName, ignoreCase = true) }

    /** Sub-areas to show under the rail for the selected region; empty hides the row. */
    fun subAreasFor(destinations: List<Destination>, regionName: String?): List<SubArea> =
        find(destinations, regionName)?.subAreas.orEmpty()

    /**
     * Selecting a region (null = "All") always resets the sub-area and drops any pinned map box,
     * keeping the rest of the search.
     */
    fun selectRegion(query: ListingQuery, region: String?): ListingQuery =
        query.copy(region = region?.takeIf { it.isNotBlank() }, area = null, bbox = null)

    /**
     * Selecting a sub-area (null = the region's "All") keeps the region and sets `area=`.
     * A sub-area with no region selected is ignored (the row only exists under a region).
     */
    fun selectArea(query: ListingQuery, areaSlug: String?): ListingQuery {
        if (query.region.isNullOrBlank()) return query.copy(area = null)
        return query.copy(area = areaSlug?.takeIf { it.isNotBlank() }, bbox = null)
    }
}
