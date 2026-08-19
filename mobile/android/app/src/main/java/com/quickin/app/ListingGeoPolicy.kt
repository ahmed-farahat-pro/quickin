package com.quickin.app

/**
 * The map pin has to be where the listing says it is.
 *
 * The add-listing wizard asks for the place twice: in words (the area chip, the city, the
 * country picker) and as a pin the host drops on the map. Nothing compared the two — a host
 * could choose Egypt → North Coast and drop the pin in Germany, and the listing saved without
 * a murmur, after which every surface that draws a listing on a map put that North Coast
 * chalet in Bavaria.
 *
 * This is the Kotlin translation of `src/lib/local/listing-geo-policy.ts`, which both web
 * projects carry byte-identical (a parity script guards those two), and of
 * `mobile/ios/Sources/ListingGeoPolicy.swift`. The two mobile copies are updated by hand, so
 * **the boxes below are the thing to keep in step** — they are the contract between all four
 * files. The rule is a **bounding box** per country and per curated area, not a polygon and
 * not a reverse-geocode: a reverse-geocode would be a rate-limited network call on every pin
 * drag and useless on a phone with no signal, and a box is explainable — an operator reading
 * "outside North Coast" can check it on any map.
 *
 * It **warns, it never blocks.** [StepLocation] shows the problem under the map and still lets
 * the host continue; the API stores the pin either way and badges the mismatch for the operator
 * who approves the listing in /ops. A rectangle written in a source file must not be the reason
 * a real property can't be listed — which is also why the boxes are drawn generously.
 */
object ListingGeoPolicy {

    /** A lat/lng rectangle, in degrees. [south]/[west] are the low corner. */
    data class GeoBox(
        val south: Double,
        val west: Double,
        val north: Double,
        val east: Double
    ) {
        /** Inclusive on every edge — a pin exactly on the line is inside. */
        fun contains(lat: Double, lng: Double): Boolean =
            lat >= south && lat <= north && lng >= west && lng <= east
    }

    /** Why a pin was questioned. */
    enum class ProblemCode { OUT_OF_RANGE, OUTSIDE_COUNTRY, OUTSIDE_REGION }

    /**
     * A questioned pin, and the place it disagrees with — [scope] is the country name for
     * [ProblemCode.OUTSIDE_COUNTRY] and the area name for [ProblemCode.OUTSIDE_REGION], so
     * the caller drops it into a sentence without re-deriving which field was at fault.
     */
    data class Problem(val code: ProblemCode, val scope: String) {
        /** What the host reads under the map. English, like the rest of this wizard. */
        val message: String
            get() = when (code) {
                ProblemCode.OUT_OF_RANGE ->
                    "That isn't a valid spot on the map. Tap the map again to place the pin."
                ProblemCode.OUTSIDE_COUNTRY ->
                    "This pin is outside $scope — guests will see your place there on the map. " +
                        "Move the pin, or change the country."
                ProblemCode.OUTSIDE_REGION ->
                    "This pin is outside $scope — guests browsing that area will see your place " +
                        "here. Move the pin, or change the area."
            }
    }

    /**
     * Country boxes for the countries the host form offers, padded outward from each country's
     * real extent: they answer "is this pin plausibly in the country the host chose", not
     * "where exactly is the border". A chalet pinned a few hundred metres offshore must not be
     * flagged; a pin on another continent must be.
     */
    val countryBoxes: Map<String, GeoBox> = mapOf(
        "Egypt" to GeoBox(south = 21.8, west = 24.5, north = 31.8, east = 37.1),
        "Saudi Arabia" to GeoBox(south = 15.5, west = 34.3, north = 32.3, east = 55.8),
        "United Arab Emirates" to GeoBox(south = 22.4, west = 51.4, north = 26.2, east = 56.6),
        "Kuwait" to GeoBox(south = 28.4, west = 46.4, north = 30.2, east = 48.5),
        "Qatar" to GeoBox(south = 24.4, west = 50.6, north = 26.3, east = 51.8),
        "Bahrain" to GeoBox(south = 25.5, west = 50.3, north = 26.4, east = 50.9),
        "Oman" to GeoBox(south = 16.5, west = 51.8, north = 26.5, east = 60.0),
        "Jordan" to GeoBox(south = 29.1, west = 34.8, north = 33.5, east = 39.4),
        "Lebanon" to GeoBox(south = 33.0, west = 35.0, north = 34.8, east = 36.7),
        // Wide on purpose: covers Western Sahara rather than flagging a host whose pin sits
        // south of a disputed line.
        "Morocco" to GeoBox(south = 20.7, west = -17.3, north = 36.1, east = -0.9)
    )

    /**
     * The four curated browse areas ([REGIONS]), as boxes. Wider than the tourist's idea of
     * each place, because an area is a browse chip rather than an address: "Cairo" means
     * Greater Cairo including Giza, Sheikh Zayed, 6th of October and New Cairo.
     */
    val regionBoxes: Map<String, GeoBox> = mapOf(
        "North Coast" to GeoBox(south = 30.4, west = 24.9, north = 31.7, east = 30.4),
        "Ain Sokhna" to GeoBox(south = 29.1, west = 32.0, north = 30.2, east = 32.9),
        "El Gouna" to GeoBox(south = 26.8, west = 33.2, north = 27.9, east = 34.1),
        "Cairo" to GeoBox(south = 29.5, west = 30.5, north = 30.5, east = 32.0)
    )

    /**
     * Country names that aren't the canonical spelling. The picker sends the canonical one; a
     * listing loaded for editing may carry anything.
     */
    private val countryAliases: Map<String, String> = mapOf(
        "uae" to "United Arab Emirates",
        "u.a.e." to "United Arab Emirates",
        "emirates" to "United Arab Emirates",
        "ae" to "United Arab Emirates",
        "eg" to "Egypt",
        "arab republic of egypt" to "Egypt",
        "sa" to "Saudi Arabia",
        "ksa" to "Saudi Arabia",
        "saudi" to "Saudi Arabia",
        "kw" to "Kuwait",
        "qa" to "Qatar",
        "bh" to "Bahrain",
        "om" to "Oman",
        "jo" to "Jordan",
        "lb" to "Lebanon",
        "ma" to "Morocco"
    )

    /** Area spellings that mean one of the four curated areas. */
    private val regionAliases: Map<String, String> = mapOf(
        "northcoast" to "North Coast",
        "sahel" to "North Coast",
        "el sahel" to "North Coast",
        "ein sokhna" to "Ain Sokhna",
        "sokhna" to "Ain Sokhna",
        "elgouna" to "El Gouna",
        "gouna" to "El Gouna",
        "greater cairo" to "Cairo"
    )

    /** Canonical country name for any casing/alias, or null when we don't know it. */
    fun canonicalCountry(value: String?): String? {
        val trimmed = value?.trim().orEmpty()
        if (trimmed.isEmpty()) return null
        if (countryBoxes.containsKey(trimmed)) return trimmed
        val lower = trimmed.lowercase()
        return countryBoxes.keys.firstOrNull { it.lowercase() == lower } ?: countryAliases[lower]
    }

    /** Canonical area name for any casing/alias, or null when we don't know it. */
    fun canonicalRegion(value: String?): String? {
        val trimmed = value?.trim().orEmpty()
        if (trimmed.isEmpty()) return null
        if (regionBoxes.containsKey(trimmed)) return trimmed
        val lower = trimmed.lowercase()
        return regionBoxes.keys.firstOrNull { it.lowercase() == lower } ?: regionAliases[lower]
    }

    /**
     * Does the pin agree with the words?
     *
     * Returns null — no complaint — whenever we cannot honestly judge: no pin at all (it is
     * placed later in the flow), a country we have no box for, an area we have no box for. A
     * warning the host cannot act on, shown next to the map they just used, is worse than no
     * warning.
     *
     * The country is judged before the area, so a pin in Germany on a North Coast listing
     * names the bigger, more obvious mistake.
     */
    fun check(lat: Double?, lng: Double?, country: String?, region: String?): Problem? {
        if (lat == null || lng == null) return null
        if (lat.isNaN() || lng.isNaN() || lat.isInfinite() || lng.isInfinite()) return null
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return Problem(ProblemCode.OUT_OF_RANGE, "")

        canonicalCountry(country)?.let { name ->
            val box = countryBoxes[name]
            if (box != null && !box.contains(lat, lng)) {
                return Problem(ProblemCode.OUTSIDE_COUNTRY, name)
            }
        }
        canonicalRegion(region)?.let { name ->
            val box = regionBoxes[name]
            if (box != null && !box.contains(lat, lng)) {
                return Problem(ProblemCode.OUTSIDE_REGION, name)
            }
        }
        return null
    }
}
