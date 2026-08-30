package com.quickin.app

/**
 * How small — and how large — a place is allowed to claim to be.
 *
 * The capacity steppers on the add-listing wizard floored bedrooms, beds and bathrooms at
 * **zero** — only "Max guests" carried a floor of 1 — so a host could walk the wizard through
 * with 0 bedrooms and 0 beds and publish a chalet whose card reads "0 bedrooms · 0 beds ·
 * 0 baths". A stay with nowhere to sleep is not a stay, and those three numbers are the line
 * under every listing card, the thing a guest filters and compares on. iOS had the same hole in
 * the same three steppers, and so did the API, which floored the values at 0 on create and on
 * PATCH.
 *
 * The CEILING is the other half, and it was missing everywhere. The bedroom stepper stopped at 20
 * because that is as far as the control scrolled, not because anything refused a bigger number —
 * so a Chalet with 12 bedrooms and a Studio with 27,373 both live on Neon today. Bedrooms are now
 * capped **per property type** ([MAX_BEDROOMS_BY_PROPERTY_TYPE]), because "too many" only means
 * something once you know what the place is: 8 bedrooms is an ordinary villa and an impossible
 * guest suite. The other three counts get one blanket ceiling each — no per-type table, but the
 * same keypad types into them, so leaving them open would move 27,373 one field to the right.
 *
 * This is the Kotlin translation of `src/lib/local/listing-capacity-policy.ts`, which both web
 * projects carry byte-identical (a parity script guards those two) and which the API runs on
 * both doors, and of `mobile/ios/Sources/ListingCapacityPolicy.swift`. The two mobile copies are
 * updated by hand, so **[MINIMUM] and [MAX_BEDROOMS_BY_PROPERTY_TYPE] are the things to keep in
 * step** — they are the contract between all four files, and `MIN_CAPACITY` /
 * `MAX_BEDROOMS_BY_PROPERTY_TYPE` are what they are called on the other side.
 *
 * **A studio is 1 bedroom, not 0.** Product's table says a studio "must be 0", meaning it has no
 * separate bedroom; [MINIMUM] is 1. The two statements are the same statement — the single room
 * IS the bedroom — so a studio's ceiling is also 1: exactly one, and never two.
 */
object ListingCapacityPolicy {

    /** The floor under every count. One, not zero. */
    const val MINIMUM = 1

    /**
     * The most bedrooms each property type may claim — product's table, keyed by the stored
     * English `property_type` lowercased. The value is stored in English on purpose (clients
     * translate the label only), so a lowercased key is the whole normalisation this needs.
     */
    val MAX_BEDROOMS_BY_PROPERTY_TYPE: Map<String, Int> = mapOf(
        "apartment" to 5,
        "house" to 6,
        "villa" to 8,
        "cabin" to 3,
        "studio" to 1,
        "loft" to 3,
        "chalet" to 6,
        "cottage" to 4,
        "guest suite" to 2,
    )

    /**
     * The bedroom ceiling for a type the table does not name.
     *
     * The most permissive number product gave (Villa's 8), on purpose: an unlisted type —
     * 'Guest House', which this app's own picker offers and product's table omits, or anything a
     * future release adds — must never be judged HARDER than a type product has actually ruled
     * on. Add the type to the table to tighten it.
     */
    const val DEFAULT_MAX_BEDROOMS = 8

    /**
     * The blanket ceiling on the three counts with no per-type table. These are the ceilings the
     * steppers have offered all along, promoted from "as far as the control scrolls" to an actual
     * rule. There is no `BEDROOMS_CEILING` any more — that number depends on the property type,
     * and [maxBedrooms] is what resolves it.
     */
    const val MAX_GUESTS_CEILING = 32
    const val BEDS_CEILING = 30
    const val BATHROOMS_CEILING = 20

    /**
     * The table key for a stored property type, or null when the caller said nothing usable.
     * Lowercased with inner runs of whitespace collapsed, so "Guest  suite" and "guest suite"
     * are one type.
     */
    fun normalizeKey(propertyType: String?): String? {
        val key = propertyType?.split(" ", "\t", "\n")?.filter { it.isNotEmpty() }
            ?.joinToString(" ")?.lowercase()
        return if (key.isNullOrEmpty()) null else key
    }

    /** The bedroom ceiling for what this place says it is. */
    fun maxBedrooms(propertyType: String?): Int {
        val key = normalizeKey(propertyType) ?: return DEFAULT_MAX_BEDROOMS
        return MAX_BEDROOMS_BY_PROPERTY_TYPE[key] ?: DEFAULT_MAX_BEDROOMS
    }

    /**
     * The property type as an error sentence should spell it, or null when it has no bearing on
     * the ceiling. Only a type the table actually names is echoed: telling a host "a Guest House
     * can have at most 8 bedrooms" would state a rule that does not exist for their type.
     */
    fun namedType(propertyType: String?): String? {
        val key = normalizeKey(propertyType) ?: return null
        if (!MAX_BEDROOMS_BY_PROPERTY_TYPE.containsKey(key)) return null
        return key.replaceFirstChar { it.uppercase() }
    }

    /**
     * True when one count clears the floor.
     *
     * The value arrives as the [String] the stepper and the form state hold, so a blank or
     * non-numeric field is **not** silently read as the floor here — that is what
     * `value.toIntOrNull() ?: min` used to do, and it is how an empty field became a number
     * nobody typed. Blank is invalid, and the caller says so.
     */
    fun isValid(value: String?): Boolean {
        val n = value?.trim()?.toIntOrNull() ?: return false
        return n >= MINIMUM
    }

    /** True when every count clears its floor AND its ceiling — the gate on Next / Publish / Save.
     *
     *  [propertyType] is what the listing will BE once saved — the value the host has selected,
     *  not the one already stored — because retyping a 6-bedroom Villa as a Cabin changes both
     *  halves of the rule in one edit. */
    fun allValid(
        maxGuests: String?,
        bedrooms: String?,
        beds: String?,
        bathrooms: String?,
        propertyType: String?
    ): Boolean =
        !isBelowFloor(maxGuests, bedrooms, beds, bathrooms) &&
            !exceedsBedroomCeiling(bedrooms, propertyType) &&
            !exceedsOtherCeiling(maxGuests, beds, bathrooms)

    /**
     * True when at least one count is below the floor — the half of the rule the existing
     * "must each be at least 1" sentence explains. A blank or non-numeric field counts as below
     * it, for the same reason [isValid] refuses one.
     */
    fun isBelowFloor(maxGuests: String?, bedrooms: String?, beds: String?, bathrooms: String?):
        Boolean = !isValid(maxGuests) || !isValid(bedrooms) || !isValid(beds) || !isValid(bathrooms)

    /**
     * True when the bedroom count is more than this property type allows. A blank or non-numeric
     * field is not "too many" — [isBelowFloor] is what reports that.
     */
    fun exceedsBedroomCeiling(bedrooms: String?, propertyType: String?): Boolean {
        val n = bedrooms?.trim()?.toIntOrNull() ?: return false
        return n > maxBedrooms(propertyType)
    }

    /**
     * True when one of the three blanket-capped counts is over its ceiling. Only reachable from a
     * stored value — the steppers clamp new taps.
     */
    fun exceedsOtherCeiling(maxGuests: String?, beds: String?, bathrooms: String?): Boolean {
        // A blank or non-numeric field is not "too many" — isBelowFloor is what reports that.
        fun over(value: String?, ceiling: Int): Boolean {
            val n = value?.trim()?.toIntOrNull() ?: return false
            return n > ceiling
        }
        return over(maxGuests, MAX_GUESTS_CEILING) ||
            over(beds, BEDS_CEILING) ||
            over(bathrooms, BATHROOMS_CEILING)
    }

    /**
     * What the editor should show for a stored count.
     *
     * A **null** column is a question nobody asked, so it opens at the floor rather than at 0 —
     * seeding it with 0 would put words in a host's mouth and then refuse them for it. A stored
     * value outside the range is different: some host did press Publish on it before this rule
     * existed, so it is shown as it is and the editor blocks Save until they correct it.
     */
    fun seed(stored: Int?): String = (stored ?: MINIMUM).toString()
}
