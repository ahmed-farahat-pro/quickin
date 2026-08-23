package com.quickin.app

/**
 * Name validation for every screen that takes a person's name — sign-up, the
 * host application and profile settings.
 *
 * The Kotlin twin of the backend's `name-policy.ts` and of iOS's
 * `NameRules.swift`. The sign-up form here asked nothing of the field at all:
 * the submit button was gated on the address and the password only, so an
 * account could be created with no name whatsoever. The server does not stop
 * that either — a signup with no `full_name` falls back to the local part of
 * the address (`fallbackNameFromEmail`), because a social login legitimately
 * arrives without one. So the only door that can refuse an empty name typed
 * into this form is this form.
 *
 * That name is what a host reads next to a booking request, what a review is
 * signed with, and what an operator matches against an ID document at
 * verification time. `layla@gmail.com` silently becoming the guest "layla" is
 * not the same thing as a guest telling us who they are.
 *
 * The rule that does the work is [Problem.InvalidCharacters]: a name is made of
 * letters and nothing else. Letters in any script — Arabic, Latin, Cyrillic and
 * the CJK ideographs alike — plus the marks that sit on top of them (harakat, a
 * Devanagari matra, the accent of a decomposed `José`), plus the three
 * characters that hold a real name together: the space between its parts, the
 * hyphen in `Jean-Luc`, the apostrophe in `O'Brien`. Digits, `@`, `.`, `_`,
 * emoji and every other symbol are refused.
 *
 * This is stricter than the rule that shipped first, which asked only that a
 * name contain *some* letter and so accepted Franco-Arabic spellings like
 * `Ma7moud` and `3omar`. Those are refused now — the field is matched against
 * an ID document at verification, and `Ma7moud` is not what the document says.
 *
 * KEEP IN SYNC with `name-policy.ts` and `NameRules.swift` — all three create
 * accounts in the same `users` table, and a rule that only holds on one of the
 * three doors is not a rule.
 *
 * Pure value logic — no Compose, no coroutines — so it is trivially testable,
 * matching how [EmailRules] is structured.
 */
object NameRules {
    /** Two letters. A one-character name is almost always a slip, not a mononym. */
    const val MIN_LETTERS = 2

    /** Long enough for a full Arabic name with all its parts; the server refuses more. */
    const val MAX_LENGTH = 60

    /** What is wrong with a name, in the order the checks run. */
    sealed interface Problem {
        object Required : Problem
        /** Something in there is not a letter — `Layla2`, `Ma7moud`, `j.doe`, an emoji. */
        object InvalidCharacters : Problem
        /** Letters in no script at all, from characters that are otherwise legal — `----`. */
        object NoLetters : Problem
        object TooShort : Problem
        object TooLong : Problem
    }

    // Invisible characters people paste in without meaning to: the soft hyphen,
    // the Mongolian vowel separator, the zero-width spaces and bidi marks, the
    // BOM. They survive a trim and render as nothing, so a name made only of
    // them would otherwise read as non-empty — strip them before anything else
    // looks.
    private val INVISIBLE = Regex("[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]")

    // Whitespace is collapsed by hand rather than by a regex, because there is
    // no regex that says this portably: `\s` is the ASCII five, and the inline
    // `(?U)` flag that would widen it is a Java extension ICU does not accept —
    // on Android `Regex("(?U)\\s+")` throws PatternSyntaxException the first
    // time this object is touched, taking the whole sign-up screen down with it.
    // Kotlin's `Char.isWhitespace` is `Character.isWhitespace || isSpaceChar`,
    // which is exactly the set the server's `\s+/gu` matches — the non-breaking
    // spaces a paste from a document carries in included.

    // The characters a name may hold that are not letters: the space between its
    // parts, the apostrophe of `O'Brien`, the hyphen of `Jean-Luc`.
    //
    // Both punctuation marks are listed twice because the keyboard does not send
    // the one on the keycap: smart punctuation rewrites `'` to `’` (U+2019) as
    // it is typed, and a name pasted from a document carries the typographic
    // hyphens (U+2010, U+2011) with it. Refusing those would refuse `O’Brien`
    // for a substitution the guest never made and cannot see.
    //
    // Only U+0020 is listed for the space because [normalized] runs first and
    // has already collapsed every other kind of whitespace into it.
    private val ALLOWED_PUNCTUATION = setOf(' ', '\'', '\u2019', '-', '\u2010', '\u2011')

    // The combining marks: a harakat over an Arabic letter, a Devanagari matra,
    // the accent of a `José` a keyboard sent decomposed as `e` + U+0301. None of
    // them is a letter to `Character.isLetter`, and refusing them would refuse
    // the scripts this rule exists to serve. The server spells this `\p{M}`.
    private val MARK_TYPES = setOf(
        Character.NON_SPACING_MARK.toInt(),
        Character.COMBINING_SPACING_MARK.toInt(),
        Character.ENCLOSING_MARK.toInt(),
    )

    /**
     * What we send to the backend: invisibles dropped, every run of whitespace
     * collapsed to one space, ends trimmed. `  Layla   Hassan  ` and
     * `Layla Hassan` are one name, and storing the second means a host never
     * sees the first. Matches the server's `normalizeName` exactly.
     */
    fun normalized(raw: String): String {
        val out = StringBuilder(raw.length)
        // A space is only emitted once something follows it, which trims both
        // ends and collapses every run in the same pass.
        var pendingSpace = false
        for (ch in raw.replace(INVISIBLE, "")) {
            if (ch.isWhitespace()) {
                pendingSpace = out.isNotEmpty()
                continue
            }
            if (pendingSpace) {
                out.append(' ')
                pendingSpace = false
            }
            out.append(ch)
        }
        return out.toString()
    }

    /**
     * Walk [name] one code point at a time, handing each to [action]. Iterating
     * `Char` would split a letter outside the BMP into two halves, neither of
     * which is a letter — the server sees one character there, so this has to
     * as well.
     */
    private inline fun forEachCodePoint(name: String, action: (Int) -> Unit) {
        var i = 0
        while (i < name.length) {
            val cp = name.codePointAt(i)
            action(cp)
            i += Character.charCount(cp)
        }
    }

    private fun isNamePart(cp: Int): Boolean =
        Character.isLetter(cp) ||
            Character.getType(cp) in MARK_TYPES ||
            (Character.charCount(cp) == 1 && cp.toChar() in ALLOWED_PUNCTUATION)

    /** How many letters the name actually contains, in any script. */
    private fun letterCount(name: String): Int {
        var count = 0
        forEachCodePoint(name) { if (Character.isLetter(it)) count++ }
        return count
    }

    /** True when every code point of [name] belongs in a name. */
    private fun isAllLetters(name: String): Boolean {
        var ok = true
        forEachCodePoint(name) { if (!isNamePart(it)) ok = false }
        return ok
    }

    /**
     * The problem with [raw], or null when it is usable as a name.
     *
     * Order matters: [Problem.InvalidCharacters] is decided before
     * [Problem.NoLetters] and [Problem.TooShort], so `5` and `A1` are told the
     * thing that is actually wrong with them ("a name is letters only") rather
     * than being sent back to type another character. [Problem.NoLetters]
     * survives that for the names made entirely of the punctuation this rule
     * does allow — `----` — which are legal characters arranged into something
     * that is still not a name.
     */
    fun problemWith(raw: String): Problem? {
        val name = normalized(raw)
        if (name.isEmpty()) return Problem.Required
        // Count code points, not UTF-16 units — an emoji is one character to
        // whoever typed it, and a name of 60 Arabic characters must not read as
        // 120. This is what the server counts too.
        if (name.codePointCount(0, name.length) > MAX_LENGTH) return Problem.TooLong
        if (!isAllLetters(name)) return Problem.InvalidCharacters

        val letters = letterCount(name)
        if (letters == 0) return Problem.NoLetters
        if (letters < MIN_LETTERS) return Problem.TooShort
        return null
    }

    /** True when there is nothing to say about [raw] — the gate on a submit button. */
    fun isValid(raw: String): Boolean = problemWith(raw) == null
}
