package com.quickin.app

/**
 * What a host may type into a seasonal price field — the weekend nightly rate, and the twelve
 * per-month rates under it.
 *
 * The Kotlin twin of `checkWeekendPrice` / `checkMonthlyPrices` in `listing-pricing-core.ts`, the
 * file the website's host forms and the API both run. [WeekendSchedule] is the twin of the other
 * half of that file — which DAYS the weekend rate is charged on — and the two are asked together
 * on every save.
 *
 * The rule is one sentence: **an empty field clears the rate, and a rate the host actually typed
 * has to be money.**
 *
 * Both halves matter. Empty is how weekend pricing is turned off and how a month goes back to the
 * base nightly price, so it can never be an error. `0` is the opposite — it is a typo or a misread
 * field, and it used to be coerced into the first: every call site read the text as
 * `toDoubleOrNull()?.takeIf { it > 0.0 }`, which answers null to a `0` and to an empty field
 * alike. The request went out with `weekend_price: null`, the API's own `cleanPrice` would have
 * dropped it anyway, the listing saved, and the pricing screen reopened blank with nothing said.
 *
 * Pure: no Compose, no network, no formatting. The screens turn a [Problem] into a localized
 * sentence; this decides only what is wrong.
 */
object ListingPricingRules {
    /** Months in a year — the keys a seasonal price map is indexed by, "1".."12". */
    const val MONTHS_IN_YEAR = 12

    /** How a typed rate can fail. Screens switch on this, not on text. */
    enum class Problem {
        /** Not a number at all — `abc`, `1,500`, `--`. */
        NOT_A_NUMBER,

        /** A number, but not a price — `0`, `-200`. */
        NOT_POSITIVE
    }

    /**
     * Judge one typed rate.
     *
     * - `success(null)` — the field is empty, i.e. no rate. This is what CLEARS a stored one, and
     *   it is the resting state of most listings.
     * - `success(rate)` — a real nightly rate, rounded to whole EGP the way the server stores it.
     * - `failure` — the host typed something that is not a price.
     */
    fun checkPrice(text: String): Result<Double?> {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return Result.success(null)
        val value = trimmed.toDoubleOrNull()
        if (value == null || !value.isFinite()) return Result.failure(ListingPriceException(Problem.NOT_A_NUMBER))
        if (value <= 0.0) return Result.failure(ListingPriceException(Problem.NOT_POSITIVE))
        return Result.success(Math.round(value).toDouble())
    }

    /**
     * Judge the twelve month fields together, in calendar order.
     *
     * Answers only the months the host actually priced — a blank month has no opinion and falls
     * through to the base nightly price, so it is dropped rather than reported. Keys outside 1..12
     * are dropped too: the pricing ladder can never reach them, so there is nothing to tell the
     * host about them.
     *
     * Ordered so the month reported back is the FIRST bad one on the screen rather than whichever
     * the map happened to enumerate first — the host reads their form top to bottom.
     */
    fun checkMonths(prices: Map<String, String>): Result<Map<String, Double>> {
        val out = LinkedHashMap<String, Double>()
        for (month in 1..MONTHS_IN_YEAR) {
            val key = month.toString()
            val text = prices[key] ?: continue
            val checked = checkPrice(text)
            val problem = (checked.exceptionOrNull() as? ListingPriceException)?.problem
            if (problem != null) return Result.failure(MonthPriceException(month, problem))
            checked.getOrNull()?.let { out[key] = it }
        }
        return Result.success(out)
    }

    /**
     * Which month, if any, the host has to fix right now — the question the month fields ask
     * themselves as they render, so a bad field is marked where it is rather than only when Save
     * is pressed.
     */
    fun failingMonth(prices: Map<String, String>): MonthPriceException? =
        checkMonths(prices).exceptionOrNull() as? MonthPriceException

    /** What is wrong with [text] right now, or null when it is a rate or is empty. */
    fun problemWith(text: String): Problem? =
        (checkPrice(text).exceptionOrNull() as? ListingPriceException)?.problem
}

/** Carries a [ListingPricingRules.Problem] out of `checkPrice` as a `Result` failure. */
open class ListingPriceException(val problem: ListingPricingRules.Problem) : Exception(problem.name)

/** The same, plus WHICH month (1..12) it was — a host with twelve fields open needs to be told. */
class MonthPriceException(
    val month: Int,
    problem: ListingPricingRules.Problem
) : ListingPriceException(problem)
