package com.quickin.app

/**
 * The resort / compound a listing sits in — the host's dropdown choice, and the rule for the name
 * they may type when the catalog hasn't got theirs.
 *
 * The web listing form has asked this question since the catalog shipped; both apps never asked it
 * at all, so every listing created on a phone reached the database with **no resort**: it missed
 * every resort filter, and the compound a guest actually searches for was only ever guessable from
 * the free-text address line. Nothing was wrong on the server — `POST /api/local/listings` has
 * always accepted `resort_id` / `resort_name` — the two clients simply never sent either.
 *
 * This is the Kotlin translation of two web modules, kept deliberately small:
 * * `src/lib/resort-choice.ts` — the FORM rule ("what may be submitted"): picking "Other" and
 *   leaving the box blank is not the same answer as "no resort".
 * * the naming half of `src/lib/local/resort-core.ts` — what counts as a name at all.
 *
 * iOS carries the same rule again in `ResortChoice.swift`. All the copies are updated by hand, so
 * [MIN_NAME_LETTERS], [MAX_NAME_LENGTH] and the ORDER of the checks in [check] are the things to
 * keep in step — this file's suite (`ResortChoiceTest`) is what notices when they drift.
 *
 * What is deliberately **not** here: `resortSlug`, alias matching and the moderation queue. Those
 * decide which catalog row a typed name becomes, which is a database question the server answers
 * on the way in — a phone that guessed at it would only ever be a second opinion the write path
 * ignores.
 */
object ResortChoice {

    /** Longest name the column stores. Long enough for "Sidi Abdel Rahman Bay Resort", short
     *  enough that a paste accident can't fill the field. */
    const val MAX_NAME_LENGTH = 120

    /** Enough letters to be a name. `A5` is a villa number, not a compound. */
    const val MIN_NAME_LETTERS = 2

    /** Invisible characters people paste in without meaning to: the soft hyphen, the Mongolian
     *  vowel separator, the zero-width spaces and bidi marks, the BOM. They survive a `trim()` and
     *  render as nothing, so a "name" made only of them would otherwise read as non-empty. */
    private val INVISIBLE = setOf(
        '­', '᠎', '​', '‌', '‍', '‎', '‏',
        '‪', '‫', '‬', '‭', '‮',
        '⁠', '⁡', '⁢', '⁣', '⁤', '﻿'
    )

    /** Why a typed resort name was refused. The names are the same codes the API echoes and the
     *  web reads its `errors.resortName.*` strings by, so all three surfaces share one vocabulary. */
    enum class Problem { REQUIRED, LETTERS, TOO_SHORT }

    /**
     * Clean a host-typed name for display: drop invisibles, collapse runs of whitespace, trim, cap
     * the length. Returns null for anything blank, which is how "the host left it empty" is
     * represented everywhere downstream.
     *
     * Capitalisation and punctuation are preserved on purpose — the raw text is shown to guests as
     * typed until an admin approves a canonical spelling.
     */
    fun normalizeName(input: String?): String? {
        if (input == null) return null
        val cleaned = input
            .filterNot { it in INVISIBLE }
            .split(Regex("\\s+"))
            .filter { it.isNotEmpty() }
            .joinToString(" ")
            .take(MAX_NAME_LENGTH)
        return cleaned.ifEmpty { null }
    }

    /**
     * Decide a host-typed resort name. Returns the first problem, or null when it is acceptable.
     *
     * Order matters: [Problem.LETTERS] is checked before [Problem.TOO_SHORT] so `@@@@@` is told the
     * thing that is actually wrong with it ("write it in words") rather than being sent back to add
     * a sixth `@`.
     *
     * The rule that does the work is LETTERS: a compound name must contain letters, in **any**
     * script — `Marassi (North)`, `Sa7el Chalet` and `هاسيندا باي` are all real names a host may
     * type. What it refuses is a name with no letters at all (`@@@@@`, `12345`, `-----`), which the
     * server cannot slug and therefore stores as no resort whatsoever: the host's answer silently
     * discarded.
     *
     * Only ever applied to text the host TYPED. A resort picked from the catalog has already been
     * through /ops, and "not in a resort" is a legitimate answer — neither goes near this.
     */
    fun check(input: String?): Problem? {
        val value = normalizeName(input) ?: return Problem.REQUIRED
        val letters = value.count { it.isLetter() }
        if (letters == 0) return Problem.LETTERS
        if (letters < MIN_NAME_LETTERS) return Problem.TOO_SHORT
        return null
    }

    /** True when [check] has nothing to say — the gate on Next / Publish / Save. */
    fun isValidName(input: String?): Boolean = check(input) == null

    /** The sentence the host reads. Kept beside the rule so the wizard and the editor can't say
     *  different things about the same refusal. */
    fun message(problem: Problem): String = when (problem) {
        Problem.REQUIRED -> "Type the resort or compound name, or pick a different option."
        Problem.LETTERS ->
            "Write the resort or compound name in words — it can't be only symbols or numbers."
        Problem.TOO_SHORT ->
            "Give the full resort or compound name — it needs at least $MIN_NAME_LETTERS letters."
    }

    /**
     * What a listing write should send. A listing points at EITHER a catalog resort or free text,
     * never both — a CHECK constraint enforces it server-side — and both are null when the host
     * says the place isn't in a compound, which is a real answer rather than a missing one.
     */
    data class Selection(val id: String? = null, val name: String? = null) {

        /** True for "Other — not listed": the host is naming a compound the catalog hasn't got. */
        val isOther: Boolean get() = id == null && name != null

        companion object {
            /** "Not in a resort or compound." */
            val NONE = Selection()

            /** A row from `GET /api/local/resorts`. */
            fun catalog(id: String) = Selection(id = id)

            /** "Other — not listed", carrying whatever the host has typed so far (possibly
             *  nothing yet — [blocker] is what refuses to submit that). */
            fun other(typed: String) = Selection(name = typed)
        }
    }

    /**
     * Why the resort answer blocks the step, or null when it doesn't.
     *
     * Only "Other" is ever refused, and only over the name: a host who never touched the field has
     * answered "not in a resort". Without this the submit went through with no name at all and the
     * server — which cannot tell a blank name from "no resort chosen" — saved the listing with NO
     * resort: the host's answer silently discarded, the listing missing from every resort filter,
     * and nothing queued for the /ops catalog.
     */
    fun blocker(selection: Selection): String? {
        if (!selection.isOther) return null
        return check(selection.name)?.let { message(it) }
    }

    /** What actually goes in the request body: the typed name normalized, the id as-is. */
    fun payload(selection: Selection): Selection = when {
        !selection.id.isNullOrBlank() -> Selection(id = selection.id)
        else -> Selection(name = normalizeName(selection.name))
    }
}
