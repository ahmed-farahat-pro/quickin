package com.quickin.app

/**
 * Whether a title reads as a title.
 *
 * The add-listing wizard gated step 1 on `title.isNotBlank()`, so `12345`, `@@@@@` and `-----`
 * walked past Basics, through Location and Details, and were refused by the API on step 4 — three
 * steps after the field that was wrong, with no way back to it but the Back button. iOS had the
 * same hole in the same step, and both edit screens had it too. The website never did, because
 * `/host/new` is a single page whose only gate already runs this rule; a four-step wizard is
 * where "validate on submit" turns into "validate three steps too late".
 *
 * This is the Kotlin translation of `src/lib/local/listing-title-policy.ts`, which both web
 * projects carry byte-identical (a parity script guards those two) and which the API runs on
 * create and on PATCH, and of `mobile/ios/Sources/AddListingView.swift`'s `ListingTitlePolicy`.
 * The two mobile copies are updated by hand, so **[MIN_LETTERS] and [MAX_LENGTH] are the things
 * to keep in step**. `ListingTitlePolicyTest` is what notices when they aren't.
 *
 * The rule that does the work is [Problem.LETTERS]: a title must contain letters. Not "must be
 * Latin", not "must not contain punctuation" — `Nile-view flat (2BR)` and `شقة بإطلالة على النيل`
 * are both real titles, and Franco-Arabic writes real words with numerals (`Sa7el chalet`). What
 * it refuses is a title with no letters *at all*.
 */
object ListingTitlePolicy {

    /** Enough letters to be a word. `A5` is a door number, not a listing title. */
    const val MIN_LETTERS = 3

    /** What the edit path has always capped titles at — refused, not truncated. */
    const val MAX_LENGTH = 200

    /** Why a title was refused. Mirrors `ListingTitleProblemCode` one-for-one. */
    enum class Problem { REQUIRED, LETTERS, TOO_SHORT, TOO_LONG }

    /**
     * Invisible characters people paste in without meaning to: the soft hyphen, the Mongolian
     * vowel separator, the zero-width spaces and bidi marks, the BOM. They survive a `trim()` and
     * render as nothing, so a title made only of them would otherwise read as non-blank.
     */
    private fun isInvisible(c: Char): Boolean = when (c.code) {
        0x00AD, 0x180E, 0xFEFF -> true
        in 0x200B..0x200F -> true
        in 0x202A..0x202E -> true
        in 0x2060..0x2064 -> true
        else -> false
    }

    /**
     * What gets stored: invisibles dropped, every run of whitespace collapsed to one space, ends
     * trimmed. `  Nile   view  ` and `Nile view` are one title, and storing the first means the
     * explore grid renders a gap nobody typed.
     *
     * Written as a fold rather than a regex because Java's `\\s` is ASCII-only unless the pattern
     * is compiled with UNICODE_CHARACTER_CLASS, and the policy this mirrors runs its regex under
     * the `u` flag — an Arabic title separated by a NO-BREAK SPACE has to collapse the same way on
     * all four surfaces. [Char.isWhitespace] is Unicode-aware, which is the whole point.
     */
    fun normalize(title: String?): String {
        val out = StringBuilder()
        var pendingSpace = false
        for (c in title ?: "") {
            if (isInvisible(c)) continue
            if (c.isWhitespace()) {
                if (out.isNotEmpty()) pendingSpace = true
                continue
            }
            if (pendingSpace) {
                out.append(' ')
                pendingSpace = false
            }
            out.append(c)
        }
        return out.toString()
    }

    /** How many letters the title actually contains, in any script — the policy's `\p{L}` count. */
    private fun letterCount(title: String): Int = title.count { it.isLetter() }

    /**
     * Decide a title. Returns the first problem, or null when it is acceptable.
     *
     * Order matters: [Problem.LETTERS] is checked before [Problem.TOO_SHORT] so `@@@@@` is told
     * the thing that is actually wrong with it ("a title needs words") rather than being sent back
     * to add a sixth `@`.
     */
    fun check(title: String?): Problem? {
        val value = normalize(title)
        if (value.isEmpty()) return Problem.REQUIRED
        // Count code points, not chars: a Kotlin String holds UTF-16 units, so a title of 200
        // emoji would read as 400 here and be refused for a length the host never typed.
        if (value.codePointCount(0, value.length) > MAX_LENGTH) return Problem.TOO_LONG

        val letters = letterCount(value)
        if (letters == 0) return Problem.LETTERS
        if (letters < MIN_LETTERS) return Problem.TOO_SHORT
        return null
    }

    /** True when [check] has nothing to say — the gate on a Next / Save button. */
    fun isValid(title: String?): Boolean = check(title) == null
}
