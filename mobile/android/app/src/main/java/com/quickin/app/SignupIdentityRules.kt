package com.quickin.app

/**
 * Signup identity — every account created from 2026-11-13 on gives a phone number and an identity
 * document (type, number, front + back photos) when it signs up, guest or host alike.
 *
 * The Kotlin twin of the backend's `signup-identity-core.ts`, `phone-core.ts` and the document-number
 * half of `id-change-core.ts`. Everything here is pure value logic — no Android framework, no
 * org.json — so it runs on the desktop JVM (see SignupIdentityRulesTest).
 *
 * KEEP IN SYNC with those cores: the form must refuse exactly what the API refuses, or the user
 * learns about it from a 400 instead of from the field.
 */

/**
 * "Is this a phone number?" — the port of `phone-core.ts`. Format only: there is no SMS check.
 * Arabic-Indic (٠-٩) and Persian (۰-۹) digits are folded to ASCII, because an Arabic keyboard types
 * them and they are digits.
 */
object PhoneRules {

    /** Longest input accepted before normalizing (E.164's 15 digits plus room for separators). */
    const val MAX_PHONE_CHARS = 24
    const val MIN_PHONE_DIGITS = 8
    const val MAX_PHONE_DIGITS = 15

    private val PHONE_SHAPE = Regex("^\\+?[\\d\\s().-]+$")

    /** Arabic-Indic and Persian digits folded to ASCII; everything else untouched. */
    fun toAsciiDigits(s: String): String {
        val out = StringBuilder(s.length)
        for (c in s) {
            out.append(
                when (c) {
                    in '٠'..'٩' -> '0' + (c - '٠')
                    in '۰'..'۹' -> '0' + (c - '۰')
                    else -> c
                }
            )
        }
        return out.toString()
    }

    /**
     * What a phone field holds after a keystroke: the typed text with anything that is not part of a
     * phone number dropped (mirrors `filterPhoneInput`). Only filters — [normalize] still decides.
     */
    fun filterInput(v: String): String {
        val s = toAsciiDigits(v)
        val plus = if (s.trimStart().startsWith("+")) "+" else ""
        val kept = s.filter { it.isAsciiDigit() || it == ' ' || it == '(' || it == ')' || it == '.' || it == '-' }
        return (plus + kept.trimStart()).take(MAX_PHONE_CHARS)
    }

    /**
     * The canonical form of [v] (Egyptian numbers as local `01XXXXXXXXX`, others as `+<digits>`),
     * or null when it is not a phone number. Mirrors `normalizePhone`.
     */
    fun normalize(v: String?): String? {
        val raw = toAsciiDigits(v.orEmpty().trim())
        if (raw.isEmpty() || raw.length > MAX_PHONE_CHARS) return null
        if (!PHONE_SHAPE.matches(raw)) return null
        val digits = raw.replace(Regex("[\\s().-]"), "").removePrefix("+").let {
            if (it.startsWith("00")) it.substring(2) else it
        }
        if (digits.isEmpty() || !digits.all { it.isAsciiDigit() }) return null
        val local = when {
            digits.startsWith("20") -> "0" + digits.substring(2)
            digits.startsWith("0") -> digits
            else -> null
        }
        if (local != null) {
            if (local.startsWith("01")) return if (Regex("^01\\d{9}$").matches(local)) local else null
            return if (Regex("^0[2-9]\\d{6,9}$").matches(local)) local else null
        }
        if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) return null
        return "+$digits"
    }

    fun isValid(v: String?): Boolean = normalize(v) != null

    private fun Char.isAsciiDigit() = this in '0'..'9'
}

/**
 * The number on an identity document — the port of `normalizeDocumentNumber` (id-change-core.ts).
 * A national ID is exactly 14 digits; a passport / residence permit is 5–24 letters and digits.
 * Spaces and dashes typed for readability are dropped, letters are upper-cased.
 */
object DocumentNumberRules {

    const val NATIONAL_ID_DIGITS = 14
    const val MIN_CHARS = 5
    const val MAX_CHARS = 24

    enum class Problem { Empty, NationalIdDigitsOnly, NationalIdLength, Characters, Length }

    /** Upper-cased, spaces/dashes removed, Arabic-Indic digits folded to ASCII. */
    fun canonical(v: String?): String =
        PhoneRules.toAsciiDigits(v.orEmpty()).uppercase().replace(Regex("[\\s-]+"), "")

    /** What is wrong with [v] as a number on a [docType] document, or null when it is fine. */
    fun problemWith(v: String?, docType: IdDocType): Problem? {
        val raw = canonical(v)
        if (raw.isEmpty()) return Problem.Empty
        if (docType == IdDocType.NationalId) {
            if (!raw.all { it in '0'..'9' }) return Problem.NationalIdDigitsOnly
            if (raw.length != NATIONAL_ID_DIGITS) return Problem.NationalIdLength
            return null
        }
        if (!raw.all { it in '0'..'9' || it in 'A'..'Z' }) return Problem.Characters
        if (raw.length < MIN_CHARS || raw.length > MAX_CHARS) return Problem.Length
        return null
    }
}

/**
 * The identity half of an account, as every auth response and `GET /api/auth/me` carry it:
 * `identity_required`, `identity_complete`, `verification_status`, `verification_note`.
 *
 * Parsed tolerantly — an older backend that sends none of these reads as "not required, complete",
 * so nobody is ever trapped on the "Complete your account" screen by a missing field.
 */
data class AccountIdentity(
    val required: Boolean = false,
    val complete: Boolean = true,
    /** "unverified" | "pending" | "verified" | "rejected". */
    val status: String = STATUS_UNVERIFIED,
    /** The reviewer's reason — only ever set when [status] is "rejected". */
    val note: String? = null
) {
    /** Whether the Profile ID upload asks for a selfie. Accounts under the signup identity
     *  rule gave front + back only at signup, so a re-upload asks for the same (iOS and
     *  web agree); older accounts keep the selfie. */
    val selfieRequired: Boolean get() = !required

    /** A new account (e.g. a first Google sign-in) still owes its phone + ID: block the app. */
    val needsCompletion: Boolean get() = required && !complete

    /** The ID was rejected: show the reason and a re-upload action; booking is refused until then. */
    val rejected: Boolean get() = required && complete && status == STATUS_REJECTED

    companion object {
        const val STATUS_UNVERIFIED = "unverified"
        const val STATUS_PENDING = "pending"
        const val STATUS_VERIFIED = "verified"
        const val STATUS_REJECTED = "rejected"

        /**
         * Builds the state from raw JSON values (null = the key was absent / JSON null). An absent
         * `identity_complete` reads as complete; an unknown status as "unverified"; the note is kept
         * only on a rejection.
         */
        fun from(required: Boolean?, complete: Boolean?, status: String?, note: String?): AccountIdentity {
            val s = when (val raw = status?.trim()?.lowercase()) {
                STATUS_PENDING, STATUS_VERIFIED, STATUS_REJECTED -> raw
                else -> STATUS_UNVERIFIED
            }
            val cleanNote = note?.trim()?.takeUnless { it.isEmpty() || it.equals("null", ignoreCase = true) }
            return AccountIdentity(
                required = required == true,
                complete = complete ?: true,
                status = s,
                note = if (s == STATUS_REJECTED) cleanNote else null
            )
        }
    }
}

/**
 * Why `POST /api/local/bookings` refused with 403 — read from the response's `code`, never from the
 * message (which is for people).
 */
enum class IdentityBlock(val code: String) {
    /** The account still owes its phone / ID → the "Complete your account" screen. */
    Incomplete("identity_incomplete"),
    /** The ID was rejected → show the message (it carries the reason) and the re-upload flow. */
    Rejected("identity_rejected");

    companion object {
        fun from(code: String?): IdentityBlock? = entries.firstOrNull { it.code == code?.trim() }
    }
}

/**
 * Field-by-field check of the identity form (the email signup form and the "Complete your account"
 * screen send the same five fields). Keys match the API's `fields` map so a server error and a local
 * one land under the same field.
 */
object SignupIdentityRules {

    const val FIELD_PHONE = "phone"
    const val FIELD_DOC_TYPE = "doc_type"
    const val FIELD_ID_NUMBER = "id_number"
    const val FIELD_ID_FRONT = "id_front"
    const val FIELD_ID_BACK = "id_back"

    enum class Problem { PhoneMissing, PhoneInvalid, IdNumber, FrontMissing, BackMissing }

    /** Every field that is not yet acceptable, keyed like the API's `fields`. Empty = ready to send. */
    fun problems(
        phone: String,
        docType: IdDocType,
        idNumber: String,
        hasFront: Boolean,
        hasBack: Boolean
    ): Map<String, Problem> = buildMap {
        when {
            phone.isBlank() -> put(FIELD_PHONE, Problem.PhoneMissing)
            !PhoneRules.isValid(phone) -> put(FIELD_PHONE, Problem.PhoneInvalid)
        }
        if (DocumentNumberRules.problemWith(idNumber, docType) != null) put(FIELD_ID_NUMBER, Problem.IdNumber)
        if (!hasFront) put(FIELD_ID_FRONT, Problem.FrontMissing)
        if (!hasBack) put(FIELD_ID_BACK, Problem.BackMissing)
    }
}
