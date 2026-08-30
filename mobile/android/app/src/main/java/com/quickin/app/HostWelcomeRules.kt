package com.quickin.app

/**
 * Whether this device still owes the signed-in account the one-time "you're an approved host"
 * welcome — the moment that turns an admin's approval into something the host can actually see.
 *
 * The Kotlin twin of `HostWelcomeRules.swift` on iOS. Both must answer the same way for the same
 * account, or a host is congratulated on one phone and not the other.
 *
 * The reported defect: **nothing in the app marked the moment of approval.** `is_host` flipped
 * server-side and the UI looked exactly as it had the day before — the dashboard was reachable
 * only from a row in a "Hosting" section below Account, Receipts, Messages and Currency, so an
 * approved host had no way to learn their new surface existed. The persistent entry points fix
 * the "where"; this rule fixes the "when", pointing at the dashboard once.
 *
 * Keyed by USER id, not by a bare boolean: one device is shared by more than one account here,
 * and a device-wide flag would silently swallow the welcome for the second host to sign in on
 * the same phone.
 *
 * Pure: no Android imports, no SharedPreferences, no network — so it is unit-testable with plain
 * JVM tests. It only decides whether to show; the caller owns reading and writing the stored id.
 */
object HostWelcomeRules {

    /** The `SharedPreferences` key holding the id of the last account welcomed on this device. */
    const val KEY_HOST_WELCOME_SHOWN_FOR = "host_welcome_shown_for"

    /**
     * Whether to show the welcome now.
     *
     * @param isHost the server's `is_host` for the signed-in account. Never a local guess —
     *   approval is an admin action, and the app learns of it only by re-reading the account.
     * @param userId the signed-in account's id, or null when signed out.
     * @param shownFor the id stored under [KEY_HOST_WELCOME_SHOWN_FOR], or null if this device has
     *   never welcomed anyone.
     *
     * A guest never sees it, and neither does a host already shown it on this device. An account
     * we cannot name is not welcomed at all: with no id there is nothing to remember, so showing
     * it would mean showing it on every single launch.
     */
    fun shouldWelcome(isHost: Boolean, userId: String?, shownFor: String?): Boolean {
        if (!isHost) return false
        val id = normalize(userId) ?: return false
        return normalize(shownFor) != id
    }

    /**
     * What to write under [KEY_HOST_WELCOME_SHOWN_FOR] once the welcome has been shown, or null
     * when there is no account to remember (the caller then stores nothing).
     */
    fun shownFor(userId: String?): String? = normalize(userId)

    /**
     * Ids arrive from a JSON body and from `SharedPreferences`; treat surrounding whitespace as
     * noise so a padded copy of the same id is not read as a different account.
     */
    private fun normalize(id: String?): String? = id?.trim()?.takeUnless { it.isEmpty() }
}
