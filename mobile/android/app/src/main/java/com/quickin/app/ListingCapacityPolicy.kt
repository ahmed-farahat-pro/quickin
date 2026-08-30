package com.quickin.app

/**
 * How small a place is allowed to claim to be.
 *
 * The capacity steppers on the add-listing wizard floored bedrooms, beds and bathrooms at
 * **zero** — only "Max guests" carried a floor of 1 — so a host could walk the wizard through
 * with 0 bedrooms and 0 beds and publish a chalet whose card reads "0 bedrooms · 0 beds ·
 * 0 baths". A stay with nowhere to sleep is not a stay, and those three numbers are the line
 * under every listing card, the thing a guest filters and compares on. iOS had the same hole in
 * the same three steppers, and so did the API, which floored the values at 0 on create and on
 * PATCH.
 *
 * This is the Kotlin translation of `src/lib/local/listing-capacity-policy.ts`, which both web
 * projects carry byte-identical (a parity script guards those two) and which the API now runs on
 * both doors, and of `mobile/ios/Sources/AddListingView.swift`'s `ListingCapacityPolicy`. The two
 * mobile copies are updated by hand, so **[MINIMUM] is the thing to keep in step** — it is the
 * contract between all four files, and [MIN_CAPACITY] is what it is called on the other side.
 *
 * **A studio is 1 bedroom, not 0.** The property type already says "Studio", and a capacity line
 * of zeroes tells a guest nothing. If studios should be modelled with 0 bedrooms one day,
 * [MINIMUM] is the single constant to change here.
 */
object ListingCapacityPolicy {

    /** The floor under every count. One, not zero. */
    const val MINIMUM = 1

    /**
     * The largest value each stepper offers. No rule refuses a bigger number — these are the
     * ceilings the controls have always had, kept so a stepper stays usable rather than because
     * 21 bedrooms is an error. (The API has no upper bound at all: a cap invented there would
     * start refusing edits to rows that already exist.)
     */
    const val MAX_GUESTS_CEILING = 32
    const val BEDROOMS_CEILING = 20
    const val BEDS_CEILING = 30
    const val BATHROOMS_CEILING = 20

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

    /** True when all four counts clear the floor — the gate on Next / Publish / Save. */
    fun allValid(maxGuests: String?, bedrooms: String?, beds: String?, bathrooms: String?): Boolean =
        isValid(maxGuests) && isValid(bedrooms) && isValid(beds) && isValid(bathrooms)

    /**
     * What the editor should show for a stored count.
     *
     * A **null** column is a question nobody asked, so it opens at the floor rather than at 0 —
     * seeding it with 0 would put words in a host's mouth and then refuse them for it. A stored
     * **0** is different: some host did press Publish on it before this rule existed, so it is
     * shown as it is and the editor blocks Save until they raise it.
     */
    fun seed(stored: Int?): String = (stored ?: MINIMUM).toString()
}
