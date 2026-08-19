package com.quickin.app

/**
 * Email-address validation shared by every screen that takes an email
 * (sign-up / sign-in, password reset, profile settings).
 *
 * Before 2026-08-19 this app had no address rule at all — the field was a
 * plain [androidx.compose.material3.OutlinedTextField] with an email keyboard,
 * and the backend behind it checked only that a value was present. Two classes
 * of address went straight through:
 *
 *  * `layla@email.con` — perfectly well-formed and undeliverable forever,
 *    because `.con` is not a delegated top-level domain. The user then sat on
 *    the OTP screen waiting for a code that did not exist. No regex catches
 *    this; only the root zone knows which extensions are real.
 *  * `x@mailinator.com` — a temp-mail box that receives the OTP just fine,
 *    which is exactly the problem: verifying the code proves the mailbox
 *    exists, not that anybody owns it.
 *
 * The rules mirror the server's `email-core.ts` tier for tier, and the data
 * they run on ([EmailData]) is GENERATED from that same file — see
 * `mobile/scripts/gen-email-rules.mjs`. Nothing here is a second opinion: the
 * point is that the phone refuses exactly what the API would have refused, one
 * round trip earlier.
 *
 * Pure value logic — no Compose, no coroutines — so it is trivially testable.
 */
object EmailRules {
    /** Longest address we accept — RFC 5321 caps a forward path at 254 chars. */
    const val MAX_LENGTH = 254
    private const val MAX_LOCAL_LENGTH = 64
    private const val MAX_LABEL_LENGTH = 63

    /** What is wrong with an address, in the order the checks run. */
    sealed interface Problem {
        object Required : Problem
        object TooLong : Problem
        /** Not a well-formed address at all. */
        object Format : Problem
        /**
         * Well-formed, but the extension is not a delegated TLD. [suggestion]
         * is a better whole domain to try when we have a confident guess
         * (`gmail.con` → `gmail.com`).
         */
        data class UnknownTld(val tld: String, val suggestion: String?) : Problem
        /** A known temp-mail provider. */
        object Disposable : Problem
    }

    // ---- Normalization ----------------------------------------------------

    private val LOCAL_RE = Regex("^[A-Za-z0-9!#\$%&'*+/=?^_`{|}~-]+(\\.[A-Za-z0-9!#\$%&'*+/=?^_`{|}~-]+)*$")
    private val LABEL_RE = Regex("^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")
    private val TLD_SHAPE_RE = Regex("^[a-z]{2,}$|^xn--[a-z0-9-]+$")

    /**
     * What we send to the backend: surrounding whitespace stripped and the
     * domain lowercased, matching the server's `normalizeEmail`. The local part
     * keeps its case — the server looks accounts up case-insensitively, but
     * only the domain is safe to fold in general.
     */
    fun normalized(raw: String): String {
        val trimmed = raw.trim()
        val at = trimmed.lastIndexOf('@')
        if (at < 0) return trimmed
        return trimmed.substring(0, at) + "@" + trimmed.substring(at + 1).lowercase()
    }

    /** The domain of [raw], lowercased, or `""` when there isn't one. */
    fun domainOf(raw: String): String {
        val value = normalized(raw)
        val at = value.lastIndexOf('@')
        return if (at < 0) "" else value.substring(at + 1)
    }

    // ---- The checks -------------------------------------------------------

    /**
     * True when [domain] is a mailbox provider we accept without further
     * checks. A FAST PATH, not the policy — see [EmailData.trustedDomains].
     */
    fun isTrustedDomain(domain: String): Boolean =
        EmailData.trustedDomains.contains(domain.trim().lowercase().removeSuffix("."))

    /**
     * True when [raw] is on a known temp-mail domain — or a subdomain of one,
     * so `x@sub.mailinator.com` cannot walk past an exact-match check.
     */
    fun isDisposable(raw: String): Boolean {
        val labels = domainOf(raw).split('.')
        if (labels.size < 2) return false
        for (i in 0 until labels.size - 1) {
            if (EmailData.disposableDomains.contains(labels.subList(i, labels.size).joinToString("."))) {
                return true
            }
        }
        return false
    }

    /**
     * The first thing wrong with [raw], or null when it is worth submitting.
     * Ordered cheapest-first so the message names the real problem: a malformed
     * address is a format error, not an unknown extension.
     */
    fun problemWith(raw: String): Problem? {
        val value = normalized(raw)
        if (value.isEmpty()) return Problem.Required
        if (value.length > MAX_LENGTH) return Problem.TooLong

        val at = value.lastIndexOf('@')
        if (at <= 0 || at == value.length - 1) return Problem.Format
        val local = value.substring(0, at)
        val domain = value.substring(at + 1)

        // `..` is legal only inside a quoted local part, which we don't accept.
        if (value.contains("..")) return Problem.Format
        if (local.length > MAX_LOCAL_LENGTH || !LOCAL_RE.matches(local)) return Problem.Format

        val labels = domain.split('.')
        if (labels.size < 2) return Problem.Format
        for (label in labels) {
            if (label.isEmpty() || label.length > MAX_LABEL_LENGTH || !LABEL_RE.matches(label)) {
                return Problem.Format
            }
        }

        val tld = labels.last()
        if (!TLD_SHAPE_RE.matches(tld)) return Problem.Format

        // The allowlist fast path: a known provider is real by definition, so it
        // skips the root-zone lookup and the blocklist walk. Every other domain
        // still clears both — that is what lets a company or university address
        // through while temp-mail stays out.
        if (EmailData.trustedDomains.contains(domain)) return null

        if (!EmailData.validTlds.contains(tld)) {
            return Problem.UnknownTld(tld, suggestDomain(domain))
        }
        if (isDisposable(value)) return Problem.Disposable
        return null
    }

    /**
     * Whether [raw] is worth submitting **for a new account** — the full
     * policy, temp-mail included.
     */
    fun isAcceptableForSignup(raw: String): Boolean = problemWith(raw) == null

    /**
     * Whether [raw] is worth submitting on a screen that acts on an account
     * that ALREADY exists — signing in, or asking for a reset code.
     *
     * Deliberately tolerates a disposable domain, matching the server's
     * `isValidEmail`: those screens only ever touch an existing account, so
     * refusing here would strand whoever signed up before the blocklist without
     * stopping a single new account. The temp-mail gate is on sign-up.
     */
    fun isValid(raw: String): Boolean {
        val problem = problemWith(raw)
        return problem == null || problem is Problem.Disposable
    }

    // ---- Did-you-mean -----------------------------------------------------

    /**
     * Edit distance counting a transposition as one edit (optimal string
     * alignment), abandoned once it exceeds [cap]. Transpositions have to be
     * cheap: `gmial.com` is the single most common way to misspell `gmail.com`,
     * and plain Levenshtein charges it two.
     */
    private fun distance(a: String, b: String, cap: Int): Int {
        if (a == b) return 0
        if (kotlin.math.abs(a.length - b.length) > cap) return cap + 1

        var beforePrev = IntArray(0)
        var prev = IntArray(b.length + 1) { it }

        for (i in 1..a.length) {
            val row = IntArray(b.length + 1)
            row[0] = i
            var best = row[0]
            for (j in 1..b.length) {
                val cost = if (a[i - 1] == b[j - 1]) 0 else 1
                var d = minOf(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
                if (i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1]) {
                    d = minOf(d, beforePrev[j - 2] + 1)
                }
                row[j] = d
                if (d < best) best = d
            }
            if (best > cap) return cap + 1
            beforePrev = prev
            prev = row
        }
        return prev[b.length]
    }

    /**
     * Given a domain we have already decided not to accept, the one the user
     * probably meant — or null when there is no confident guess. Candidates
     * come only from the short popular lists, never the whole root zone: `con`
     * is one deletion from `cn` (China) just as it is from `com`, and searching
     * 1,400 entries produces confident nonsense.
     */
    fun suggestDomain(raw: String): String? {
        val d = raw.trim().lowercase().removeSuffix(".")
        if (d.isEmpty() || EmailData.popularDomains.contains(d)) return null

        // Whole-domain near miss first: `gmail.con` should land on `gmail.com`,
        // not walk away with a TLD fix that reaches the same answer by luck.
        val cap = if (d.length >= 10) 2 else 1
        EmailData.popularDomains.firstOrNull { distance(d, it, cap) <= cap }?.let { return it }

        // Otherwise fix only the extension: `my-company.con` → `my-company.com`.
        val dot = d.lastIndexOf('.')
        if (dot <= 0) return null
        val tld = d.substring(dot + 1)
        if (EmailData.validTlds.contains(tld)) return null
        EmailData.popularTlds.firstOrNull { distance(tld, it, 1) <= 1 }
            ?.let { return d.substring(0, dot + 1) + it }
        return null
    }
}
