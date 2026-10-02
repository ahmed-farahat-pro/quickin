package com.quickin.app

/**
 * Where a notification's `link` opens — for an in-app notifications row AND for a push tap.
 * Pure Kotlin (no `android.net.Uri`), so it runs under plain JVM tests (`NotificationLinkRulesTest`).
 *
 * The backend's links are relative web paths. The `type` is deliberately ignored: the link alone
 * decides the destination, so any notification pointing at `/explore/<id>` opens that listing.
 *
 *   /explore/<id>[#comments]  → [DeepLink.Listing] (comments focus on `#comments` / `?focus=comments`)
 *   /reservation/<id>         → [DeepLink.Reservation] (the guest's reservation detail)
 *   /reservations             → [DeepLink.Tab] `reservations` (guest Trips tab)
 *   /host                     → [DeepLink.Tab] `host`          (host dashboard; non-hosts land on Profile)
 *   /account                  → [DeepLink.Tab] `profile`
 *   /verify-id                → [DeepLink.Tab] `profile`       (no standalone ID screen — the
 *                                                               verification card lives on Profile)
 *   /subscriptions            → [DeepLink.Tab] `subscriptions` (My subscriptions screen)
 *   /messages, /ops, blank, anything else → null (the row / push only marks itself read)
 *
 * A push tap carries the destination as a canonical app-scheme URI ([pushLink]) which
 * MainActivity hands to the one inbound parser, [DeepLink.parse].
 */
object NotificationLinkRules {

    /** Tab keys this file can emit; each must be in [DeepLink]'s `TAB_KEYS` so a push round-trips. */
    const val TAB_RESERVATIONS = "reservations"
    const val TAB_HOST = "host"
    const val TAB_PROFILE = "profile"
    const val TAB_SUBSCRIPTIONS = "subscriptions"

    /**
     * The destination for [link], or null when it routes nowhere. Accepts the backend's relative
     * shape (`/explore/<id>#comments`) as well as `https://host/explore/<id>` and
     * `quickin://explore/<id>`.
     */
    fun destination(link: String?): DeepLink? {
        var s = link?.trim().orEmpty()
        if (s.isEmpty()) return null

        val fragment = s.substringAfter('#', "").takeIf { it.isNotEmpty() }
        s = s.substringBefore('#')
        val query = s.substringAfter('?', "")
        s = s.substringBefore('?')

        val schemeEnd = s.indexOf("://")
        if (schemeEnd >= 0) {
            val scheme = s.substring(0, schemeEnd).lowercase()
            val rest = s.substring(schemeEnd + 3)
            s = when (scheme) {
                // https://host/explore/<id> — the route is the path.
                "http", "https" -> "/" + rest.substringAfter('/', "")
                // quickin://explore/<id> — the route sits in the authority.
                Config.DEEP_LINK_SCHEME -> "/$rest"
                else -> return null
            }
        }

        val segs = s.split('/').filter { it.isNotBlank() }
        val route = segs.getOrNull(0)?.lowercase() ?: return null
        val id = segs.getOrNull(1)

        return when (route) {
            "explore", "listing", "listings" ->
                id?.let { DeepLink.Listing(it, focusComments = CommentRules.wantsComments(fragment, focusParam(query))) }
            "reservation" -> id?.let { DeepLink.Reservation(it) }
            "reservations" -> if (id != null) DeepLink.Reservation(id) else DeepLink.Tab(TAB_RESERVATIONS)
            "host" -> DeepLink.Tab(TAB_HOST)
            "account", "profile", "verify-id" -> DeepLink.Tab(TAB_PROFILE)
            "subscriptions" -> DeepLink.Tab(TAB_SUBSCRIPTIONS)
            else -> null // /messages, /ops, unknown
        }
    }

    /**
     * The `quickin://…` URI a push tap should carry into MainActivity, or null to just open the
     * app. Built from [destination] in the shape [DeepLink.parse] reads back, so the push and the
     * in-app row can never disagree. [type] is accepted for call-site clarity but not consulted.
     */
    @Suppress("UNUSED_PARAMETER")
    fun pushLink(type: String?, link: String?): String? = destination(link)?.let(::toUri)

    /** The canonical app-scheme URI for [dest]. */
    fun toUri(dest: DeepLink): String {
        val scheme = Config.DEEP_LINK_SCHEME
        return when (dest) {
            is DeepLink.Listing -> "$scheme://explore/${dest.id}" + if (dest.focusComments) "#comments" else ""
            is DeepLink.Reservation -> "$scheme://reservation/${dest.id}"
            is DeepLink.Service -> "$scheme://services/${dest.id}"
            is DeepLink.Tab -> "$scheme://${dest.key}"
        }
    }

    private fun focusParam(query: String): String? =
        query.split('&').firstOrNull { it.substringBefore('=').equals("focus", ignoreCase = true) }
            ?.substringAfter('=', "")
}
