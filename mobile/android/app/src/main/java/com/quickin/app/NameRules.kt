package com.quickin.app

/**
 * Name validation for every screen that takes a person's name — sign-up today,
 * the host application and profile settings next.
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
 * The rule that does the work is [Problem.NoLetters]: a name must contain
 * letters. Deliberately not "must contain no digits" — Franco-Arabic writes
 * real names with numerals (`Ma7moud`, `3omar`), and refusing those would turn
 * away exactly the guests this app is built for. What it refuses is a name with
 * no letters *at all*: `12345`, `0100`, `٠١٢٣`, `----`.
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
        /** Letters in no script at all — `12345`, `----`. */
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

    /** How many letters the name actually contains, in any script. */
    private fun letterCount(name: String): Int = name.count { it.isLetter() }

    /**
     * The problem with [raw], or null when it is usable as a name.
     *
     * Order matters: [Problem.NoLetters] is decided before [Problem.TooShort],
     * so `5` is told the thing that is actually wrong with it ("a name contains
     * letters") rather than being sent back to type a second digit.
     */
    fun problemWith(raw: String): Problem? {
        val name = normalized(raw)
        if (name.isEmpty()) return Problem.Required
        // Count code points, not UTF-16 units — an emoji is one character to
        // whoever typed it, and a name of 60 Arabic characters must not read as
        // 120. This is what the server counts too.
        if (name.codePointCount(0, name.length) > MAX_LENGTH) return Problem.TooLong

        val letters = letterCount(name)
        if (letters == 0) return Problem.NoLetters
        if (letters < MIN_LETTERS) return Problem.TooShort
        return null
    }

    /** True when there is nothing to say about [raw] — the gate on a submit button. */
    fun isValid(raw: String): Boolean = problemWith(raw) == null
}
